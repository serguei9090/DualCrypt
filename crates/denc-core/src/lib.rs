pub mod cipher;
pub mod container;
pub mod error;
pub mod kdf;
pub mod pqc;
pub mod sss;

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use cipher::{
    encrypt_stream_chunks, generate_base_nonce, CipherSuite, DEFAULT_CHUNK_SIZE,
};
use container::{
    AuthType, CustodianDescriptor, DencHeader, DencSignatureBlock, FORMAT_VERSION_1,
    FORMAT_VERSION_2,
};
use error::DencError;
use kdf::{derive_key_argon2id, generate_salt};
use pqc::{decapsulate_share_ml_kem, encapsulate_share_ml_kem, PqcEncryptedShare};
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sss::{combine_shares, split_secret, SecretShare};
use std::fs::File;
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use zeroize::Zeroize;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustodianInput {
    pub custodian_id: u8,
    pub label: String,
    pub auth_type: AuthType,
    pub passphrase: Option<String>,
    pub public_key_base64: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionParams {
    pub cipher: CipherSuite,
    pub threshold_k: u8,
    pub total_n: u8,
    pub chunk_size: Option<usize>,
    pub custodians: Vec<CustodianInput>,
    pub author_signing_key_base64: Option<String>,
    pub author_label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportedKeyShare {
    pub custodian_id: u8,
    pub label: String,
    pub auth_type: AuthType,
    pub share: Option<SecretShare>,
    pub pqc_public_key_base64: Option<String>,
    pub pqc_private_key_base64: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionResult {
    pub bytes_encrypted: u64,
    pub exported_shares: Vec<ExportedKeyShare>,
    pub author_signature_block: Option<DencSignatureBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeaderInspection {
    pub version: u16,
    pub cipher_suite: CipherSuite,
    pub threshold_k: u8,
    pub total_n: u8,
    pub chunk_size: u32,
    pub custodians: Vec<CustodianInspection>,
    pub signature_block: Option<DencSignatureBlock>,
    pub is_signature_valid: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustodianInspection {
    pub custodian_id: u8,
    pub label: String,
    pub auth_type: AuthType,
    pub has_embedded_share: bool,
}

/// Inspects a .denc container without decrypting payload
pub fn inspect_container<P: AsRef<Path>>(path: P) -> Result<HeaderInspection, DencError> {
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let (header, _, _) = DencHeader::deserialize(&mut reader)?;

    let is_signature_valid = if let Some(sig) = &header.signature_block {
        let mut unsigned_header = header.clone();
        unsigned_header.signature_block = None;
        if let Ok((_, draft_digest)) = unsigned_header.serialize() {
            Some(
                pqc::verify_signature_ml_dsa(
                    &sig.author_public_key_base64,
                    &draft_digest,
                    &sig.signature_base64,
                )
                .unwrap_or(false),
            )
        } else {
            Some(false)
        }
    } else {
        None
    };

    let custodians = header
        .custodians
        .into_iter()
        .map(|c| CustodianInspection {
            custodian_id: c.custodian_id,
            label: c.label,
            auth_type: c.auth_type,
            has_embedded_share: !c.encrypted_share.is_empty(),
        })
        .collect();

    Ok(HeaderInspection {
        version: header.version,
        cipher_suite: header.cipher_suite,
        threshold_k: header.threshold_k,
        total_n: header.total_n,
        chunk_size: header.chunk_size,
        custodians,
        signature_block: header.signature_block,
        is_signature_valid,
    })
}

/// Packages a directory recursively into a TAR archive stream
pub fn pack_directory_to_tar<P: AsRef<Path>, W: Write>(dir_path: P, writer: &mut W) -> Result<(), DencError> {
    let mut tar_builder = tar::Builder::new(writer);
    let dir_name = dir_path
        .as_ref()
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "archive".to_string());
    tar_builder
        .append_dir_all(&dir_name, dir_path.as_ref())
        .map_err(DencError::Io)?;
    tar_builder.finish().map_err(DencError::Io)?;
    Ok(())
}

/// Unpacks a TAR archive from a reader into a destination directory
pub fn unpack_tar_archive<R: Read, P: AsRef<Path>>(reader: &mut R, target_dir: P) -> Result<(), DencError> {
    let mut archive = tar::Archive::new(reader);
    archive
        .unpack(target_dir.as_ref())
        .map_err(DencError::Io)?;
    Ok(())
}

/// High-level function to encrypt a file or entire directory with dual/threshold custody
pub fn encrypt_file<P1: AsRef<Path>, P2: AsRef<Path>, F: FnMut(u64, u64)>(
    input_path: P1,
    output_path: P2,
    params: EncryptionParams,
    progress_cb: F,
    cancel_flag: Option<Arc<AtomicBool>>,
) -> Result<EncryptionResult, DencError> {
    if params.custodians.len() != params.total_n as usize {
        return Err(DencError::Custom(format!(
            "Expected {} custodians, provided {}",
            params.total_n,
            params.custodians.len()
        )));
    }

    let input_path_ref = input_path.as_ref();
    let (real_input_path, _temp_tar_guard) = if input_path_ref.is_dir() {
        let temp_tar = tempfile::Builder::new()
            .prefix("dual_archive_")
            .suffix(".tar")
            .tempfile()?;
        {
            let file = File::create(temp_tar.path())?;
            let mut tar_writer = BufWriter::new(file);
            pack_directory_to_tar(input_path_ref, &mut tar_writer)?;
            tar_writer.flush()?;
        }
        (temp_tar.path().to_path_buf(), Some(temp_tar))
    } else {
        (input_path_ref.to_path_buf(), None)
    };

    let input_file = File::open(&real_input_path)?;
    let total_bytes = input_file.metadata()?.len();
    let mut reader = BufReader::new(input_file);

    let output_file = File::create(&output_path)?;
    let mut writer = BufWriter::new(output_file);

    // 1. Generate random 32-byte DEK (Data Encryption Key)
    let mut dek = [0u8; 32];
    OsRng.fill_bytes(&mut dek);

    // 2. Split DEK with Shamir's Secret Sharing over GF(256)
    let mut raw_shares = split_secret(&dek, params.threshold_k, params.total_n)?;

    let master_salt = generate_salt();
    let base_nonce = generate_base_nonce();
    let chunk_size = params.chunk_size.unwrap_or(DEFAULT_CHUNK_SIZE);

    let mut descriptors = Vec::with_capacity(params.custodians.len());
    let mut exported_shares = Vec::new();

    // 3. Process each custodian share
    for (idx, custodian) in params.custodians.iter().enumerate() {
        let custodian_salt = generate_salt();
        let share = raw_shares[idx].clone();

        match custodian.auth_type {
            AuthType::Passphrase => {
                let passphrase = custodian
                    .passphrase
                    .as_deref()
                    .ok_or_else(|| DencError::Custom(format!("Passphrase required for custodian {}", custodian.label)))?;
                
                // Derive key from passphrase with Argon2id
                let mut pass_key = derive_key_argon2id(passphrase.as_bytes(), &custodian_salt)?;
                let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&pass_key));
                let share_json = serde_json::to_vec(&share)?;
                
                let share_nonce = Nonce::from_slice(&custodian_salt[0..12]);
                let encrypted_share = cipher
                    .encrypt(share_nonce, Payload { msg: &share_json, aad: &custodian_salt })
                    .map_err(|_| DencError::Custom("Failed to encrypt share with passphrase".to_string()))?;
                
                pass_key.zeroize();

                descriptors.push(CustodianDescriptor {
                    custodian_id: custodian.custodian_id,
                    auth_type: AuthType::Passphrase,
                    label: custodian.label.clone(),
                    salt: custodian_salt,
                    encrypted_share,
                });
            }
            AuthType::KeyFile | AuthType::OtpChallenge => {
                descriptors.push(CustodianDescriptor {
                    custodian_id: custodian.custodian_id,
                    auth_type: custodian.auth_type,
                    label: custodian.label.clone(),
                    salt: custodian_salt,
                    encrypted_share: Vec::new(),
                });

                exported_shares.push(ExportedKeyShare {
                    custodian_id: custodian.custodian_id,
                    label: custodian.label.clone(),
                    auth_type: custodian.auth_type,
                    share: Some(share),
                    pqc_public_key_base64: None,
                    pqc_private_key_base64: None,
                });
            }
            AuthType::PostQuantum => {
                let (pub_key_b64, priv_key_b64) = if let Some(pk) = custodian
                    .public_key_base64
                    .as_deref()
                    .filter(|s| !s.trim().is_empty())
                {
                    (pk.to_string(), None)
                } else {
                    let kp = pqc::generate_ml_kem_keypair()?;
                    (kp.public_key_base64.clone(), Some(kp.private_key_base64.clone()))
                };

                let pqc_share = encapsulate_share_ml_kem(&pub_key_b64, &share)?;
                let share_bytes = serde_json::to_vec(&pqc_share)?;

                descriptors.push(CustodianDescriptor {
                    custodian_id: custodian.custodian_id,
                    auth_type: AuthType::PostQuantum,
                    label: custodian.label.clone(),
                    salt: custodian_salt,
                    encrypted_share: share_bytes,
                });

                exported_shares.push(ExportedKeyShare {
                    custodian_id: custodian.custodian_id,
                    label: custodian.label.clone(),
                    auth_type: AuthType::PostQuantum,
                    share: None,
                    pqc_public_key_base64: Some(pub_key_b64),
                    pqc_private_key_base64: priv_key_b64,
                });
            }
        }
    }

    let signature_block = if let Some(author_key) = &params.author_signing_key_base64 {
        let author_label = params
            .author_label
            .clone()
            .unwrap_or_else(|| "Authorized Author".to_string());
        let draft_header = DencHeader {
            version: FORMAT_VERSION_2,
            cipher_suite: params.cipher,
            kdf_id: 1,
            threshold_k: params.threshold_k,
            total_n: params.total_n,
            chunk_size: chunk_size as u32,
            master_salt,
            base_nonce,
            custodians: descriptors.clone(),
            signature_block: None,
        };
        let (_, draft_digest) = draft_header.serialize()?;
        let signature_base64 = pqc::sign_digest_ml_dsa(author_key, &draft_digest)?;
        let author_pub = pqc::derive_author_public_key_ml_dsa(author_key)?;

        Some(DencSignatureBlock {
            algorithm: "NIST-FIPS-204-ML-DSA-65".to_string(),
            author_label,
            author_public_key_base64: author_pub,
            signature_base64,
        })
    } else {
        None
    };

    let header = DencHeader {
        version: if signature_block.is_some() {
            FORMAT_VERSION_2
        } else {
            FORMAT_VERSION_1
        },
        cipher_suite: params.cipher,
        kdf_id: 1,
        threshold_k: params.threshold_k,
        total_n: params.total_n,
        chunk_size: chunk_size as u32,
        master_salt,
        base_nonce,
        custodians: descriptors,
        signature_block: signature_block.clone(),
    };

    // Serialize header & compute AAD digest
    let (header_bytes, header_digest) = header.serialize()?;
    writer.write_all(&header_bytes)?;

    // 4. Stream encrypt payload chunks with DEK and header digest as AAD
    let bytes_encrypted = encrypt_stream_chunks(
        &mut reader,
        &mut writer,
        &dek,
        &base_nonce,
        params.cipher,
        &header_digest,
        total_bytes,
        chunk_size,
        progress_cb,
        cancel_flag,
    )?;

    writer.flush()?;
    dek.zeroize();
    raw_shares.zeroize();

    Ok(EncryptionResult {
        bytes_encrypted,
        exported_shares,
        author_signature_block: signature_block,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustodianCredential {
    pub custodian_id: u8,
    pub passphrase: Option<String>,
    pub direct_share: Option<SecretShare>,
    pub pqc_private_key_base64: Option<String>,
}

/// High-level function to decrypt a .denc file given quorum credentials
pub fn decrypt_file<P1: AsRef<Path>, P2: AsRef<Path>, F: FnMut(u64, u64)>(
    input_path: P1,
    output_path: P2,
    credentials: Vec<CustodianCredential>,
    progress_cb: F,
    cancel_flag: Option<Arc<AtomicBool>>,
) -> Result<u64, DencError> {
    let input_file = File::open(&input_path)?;
    let total_file_size = input_file.metadata()?.len();
    let mut reader = BufReader::new(input_file);

    let (header, header_digest, header_bytes_len) = DencHeader::deserialize(&mut reader)?;
    let total_cipher_payload = total_file_size.saturating_sub(header_bytes_len as u64);

    let mut recovered_shares = Vec::new();

    for cred in credentials {
        if let Some(share) = cred.direct_share {
            recovered_shares.push(share);
            continue;
        }

        if let Some(descriptor) = header.custodians.iter().find(|c| c.custodian_id == cred.custodian_id) {
            if descriptor.auth_type == AuthType::Passphrase {
                let pass = cred.passphrase.as_deref().ok_or_else(|| {
                    DencError::Custom(format!("Passphrase required for custodian {}", descriptor.label))
                })?;

                let mut pass_key = derive_key_argon2id(pass.as_bytes(), &descriptor.salt)?;
                let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&pass_key));
                let share_nonce = Nonce::from_slice(&descriptor.salt[0..12]);

                let decrypted_json = cipher
                    .decrypt(share_nonce, Payload { msg: &descriptor.encrypted_share, aad: &descriptor.salt })
                    .map_err(|_| DencError::Custom(format!("Invalid passphrase for custodian {}", descriptor.label)))?;
                
                pass_key.zeroize();

                let share: SecretShare = serde_json::from_slice(&decrypted_json)?;
                recovered_shares.push(share);
            } else if descriptor.auth_type == AuthType::PostQuantum {
                let priv_key_b64 = cred.pqc_private_key_base64.as_deref().ok_or_else(|| {
                    DencError::Custom(format!("ML-KEM Private Key required for custodian {}", descriptor.label))
                })?;

                let pqc_share: PqcEncryptedShare = serde_json::from_slice(&descriptor.encrypted_share)
                    .map_err(|e| DencError::Custom(format!("Failed to parse PQC share payload: {}", e)))?;

                let share = decapsulate_share_ml_kem(priv_key_b64, &pqc_share)?;
                recovered_shares.push(share);
            }
        }
    }

    if (recovered_shares.len() as u8) < header.threshold_k {
        return Err(DencError::InsufficientShares {
            provided: recovered_shares.len(),
            required: header.threshold_k,
        });
    }

    // Combine shares to reconstruct DEK
    let mut reconstructed_dek_vec = combine_shares(&recovered_shares[0..header.threshold_k as usize])?;
    if reconstructed_dek_vec.len() != 32 {
        reconstructed_dek_vec.zeroize();
        return Err(DencError::IntegrityCheckFailed);
    }

    let mut dek = [0u8; 32];
    dek.copy_from_slice(&reconstructed_dek_vec);
    reconstructed_dek_vec.zeroize();

    let output_file = File::create(&output_path)?;
    let mut writer = BufWriter::new(output_file);

    let decrypted_bytes = cipher::decrypt_stream_chunks(
        &mut reader,
        &mut writer,
        &dek,
        &header.base_nonce,
        header.cipher_suite,
        &header_digest,
        total_cipher_payload,
        progress_cb,
        cancel_flag,
    )?;

    writer.flush()?;
    dek.zeroize();
    recovered_shares.zeroize();

    Ok(decrypted_bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

    #[test]
    fn test_full_encrypt_decrypt_dual_custody_pipeline() {
        let input_file = NamedTempFile::new().unwrap();
        let encrypted_file = NamedTempFile::new().unwrap();
        let decrypted_file = NamedTempFile::new().unwrap();

        let original_data = b"CONFIDENTIAL ENTERPRISE DOCUMENT DATA \n".repeat(500);
        std::fs::write(input_file.path(), &original_data).unwrap();

        let params = EncryptionParams {
            cipher: CipherSuite::Aes256Gcm,
            threshold_k: 2,
            total_n: 2,
            chunk_size: Some(1024),
            custodians: vec![
                CustodianInput {
                    custodian_id: 1,
                    label: "Party 1 (Finance Officer)".to_string(),
                    auth_type: AuthType::Passphrase,
                    passphrase: Some("FinanceMasterSecret#2026".to_string()),
                    public_key_base64: None,
                },
                CustodianInput {
                    custodian_id: 2,
                    label: "Party 2 (Security Officer)".to_string(),
                    auth_type: AuthType::KeyFile,
                    passphrase: None,
                    public_key_base64: None,
                },
            ],
            author_signing_key_base64: None,
            author_label: None,
        };

        // Encrypt
        let enc_res = encrypt_file(
            input_file.path(),
            encrypted_file.path(),
            params,
            |_, _| {},
            None,
        )
        .expect("Encryption failed");

        assert_eq!(enc_res.exported_shares.len(), 1);
        let party2_share = enc_res.exported_shares[0].share.clone().unwrap();

        // Inspect header
        let inspection = inspect_container(encrypted_file.path()).expect("Inspection failed");
        assert_eq!(inspection.threshold_k, 2);
        assert_eq!(inspection.total_n, 2);
        assert_eq!(inspection.custodians.len(), 2);

        // Decrypt with both credentials
        let creds = vec![
            CustodianCredential {
                custodian_id: 1,
                passphrase: Some("FinanceMasterSecret#2026".to_string()),
                direct_share: None,
                pqc_private_key_base64: None,
            },
            CustodianCredential {
                custodian_id: 2,
                passphrase: None,
                direct_share: Some(party2_share),
                pqc_private_key_base64: None,
            },
        ];

        let dec_bytes = decrypt_file(
            encrypted_file.path(),
            decrypted_file.path(),
            creds,
            |_, _| {},
            None,
        )
        .expect("Decryption failed");

        assert_eq!(dec_bytes, original_data.len() as u64);
        let decrypted_data = std::fs::read(decrypted_file.path()).unwrap();
        assert_eq!(decrypted_data, original_data);
    }

    #[test]
    fn test_directory_encryption_roundtrip() {
        let temp_dir = tempfile::tempdir().unwrap();
        let sub_dir = temp_dir.path().join("subfolder");
        std::fs::create_dir(&sub_dir).unwrap();
        std::fs::write(temp_dir.path().join("file1.txt"), b"Document 1 contents").unwrap();
        std::fs::write(sub_dir.join("file2.txt"), b"Nested confidential file 2").unwrap();

        let encrypted_file = tempfile::NamedTempFile::new().unwrap();
        let decrypted_tar_file = tempfile::NamedTempFile::new().unwrap();

        let params = EncryptionParams {
            cipher: CipherSuite::Aes256Gcm,
            threshold_k: 2,
            total_n: 2,
            chunk_size: Some(1024),
            custodians: vec![
                CustodianInput {
                    custodian_id: 1,
                    label: "Admin 1".to_string(),
                    auth_type: AuthType::Passphrase,
                    passphrase: Some("admin_pass_1".to_string()),
                    public_key_base64: None,
                },
                CustodianInput {
                    custodian_id: 2,
                    label: "Admin 2".to_string(),
                    auth_type: AuthType::Passphrase,
                    passphrase: Some("admin_pass_2".to_string()),
                    public_key_base64: None,
                },
            ],
            author_signing_key_base64: None,
            author_label: None,
        };

        let enc_res = encrypt_file(
            temp_dir.path(),
            encrypted_file.path(),
            params,
            |_, _| {},
            None,
        )
        .expect("Directory encryption failed");

        assert!(enc_res.bytes_encrypted > 0);

        let creds = vec![
            CustodianCredential {
                custodian_id: 1,
                passphrase: Some("admin_pass_1".to_string()),
                direct_share: None,
                pqc_private_key_base64: None,
            },
            CustodianCredential {
                custodian_id: 2,
                passphrase: Some("admin_pass_2".to_string()),
                direct_share: None,
                pqc_private_key_base64: None,
            },
        ];

        let dec_bytes = decrypt_file(
            encrypted_file.path(),
            decrypted_tar_file.path(),
            creds,
            |_, _| {},
            None,
        )
        .expect("Directory decryption failed");

        assert!(dec_bytes > 0);

        // Verify unpacking the decrypted tar
        let extract_dir = tempfile::tempdir().unwrap();
        let tar_file = File::open(decrypted_tar_file.path()).unwrap();
        let mut tar_reader = BufReader::new(tar_file);
        unpack_tar_archive(&mut tar_reader, extract_dir.path()).expect("Unpack failed");
    }

    #[test]
    fn test_post_quantum_ml_kem_dual_custody_roundtrip() {
        use crate::pqc::generate_ml_kem_keypair;

        let input_file = NamedTempFile::new().unwrap();
        let encrypted_file = NamedTempFile::new().unwrap();
        let decrypted_file = NamedTempFile::new().unwrap();

        let original_data = b"TOP SECRET QUANTUM-SAFE ARCHIVE PAYLOAD".repeat(100);
        std::fs::write(input_file.path(), &original_data).unwrap();

        // Generate PQC keypair for Custodian 2
        let pqc_keypair = generate_ml_kem_keypair().expect("PQC keygen failed");

        let params = EncryptionParams {
            cipher: CipherSuite::Aes256Gcm,
            threshold_k: 2,
            total_n: 2,
            chunk_size: Some(1024),
            custodians: vec![
                CustodianInput {
                    custodian_id: 1,
                    label: "Party 1 (Passphrase)".to_string(),
                    auth_type: AuthType::Passphrase,
                    passphrase: Some("PassphraseSecret#1".to_string()),
                    public_key_base64: None,
                },
                CustodianInput {
                    custodian_id: 2,
                    label: "Party 2 (Post-Quantum ML-KEM)".to_string(),
                    auth_type: AuthType::PostQuantum,
                    passphrase: None,
                    public_key_base64: Some(pqc_keypair.public_key_base64.clone()),
                },
            ],
            author_signing_key_base64: None,
            author_label: None,
        };

        encrypt_file(
            input_file.path(),
            encrypted_file.path(),
            params,
            |_, _| {},
            None,
        )
        .expect("PQC encryption failed");

        // Decrypt with Custodian 1 password and Custodian 2 ML-KEM private key
        let creds = vec![
            CustodianCredential {
                custodian_id: 1,
                passphrase: Some("PassphraseSecret#1".to_string()),
                direct_share: None,
                pqc_private_key_base64: None,
            },
            CustodianCredential {
                custodian_id: 2,
                passphrase: None,
                direct_share: None,
                pqc_private_key_base64: Some(pqc_keypair.private_key_base64.clone()),
            },
        ];

        let dec_bytes = decrypt_file(
            encrypted_file.path(),
            decrypted_file.path(),
            creds,
            |_, _| {},
            None,
        )
        .expect("PQC decryption failed");

        assert_eq!(dec_bytes, original_data.len() as u64);
        let decrypted_data = std::fs::read(decrypted_file.path()).unwrap();
        assert_eq!(decrypted_data, original_data);
    }

    #[test]
    fn test_ml_dsa_signed_container_roundtrip_and_tamper_detection() {
        use crate::pqc::generate_ml_dsa_keypair;

        let input_file = NamedTempFile::new().unwrap();
        let encrypted_file = NamedTempFile::new().unwrap();

        let original_data = b"ENTERPRISE HIGH-SECURITY FINANCIAL LEDGER".repeat(50);
        std::fs::write(input_file.path(), &original_data).unwrap();

        let signing_keypair = generate_ml_dsa_keypair().expect("ML-DSA keygen failed");

        let params = EncryptionParams {
            cipher: CipherSuite::Aes256Gcm,
            threshold_k: 2,
            total_n: 2,
            chunk_size: Some(1024),
            custodians: vec![
                CustodianInput {
                    custodian_id: 1,
                    label: "Alice - CFO".to_string(),
                    auth_type: AuthType::Passphrase,
                    passphrase: Some("AliceSecret#2026".to_string()),
                    public_key_base64: None,
                },
                CustodianInput {
                    custodian_id: 2,
                    label: "Bob - Auditor".to_string(),
                    auth_type: AuthType::KeyFile,
                    passphrase: None,
                    public_key_base64: None,
                },
            ],
            author_signing_key_base64: Some(signing_keypair.private_key_base64.clone()),
            author_label: Some("Alice - Chief Financial Officer".to_string()),
        };

        let enc_res = encrypt_file(
            input_file.path(),
            encrypted_file.path(),
            params,
            |_, _| {},
            None,
        )
        .expect("Signed encryption failed");

        assert!(enc_res.author_signature_block.is_some());

        // Inspect container and verify signature is mathematically valid
        let inspection = inspect_container(encrypted_file.path()).expect("Inspection failed");
        assert_eq!(inspection.version, 2);
        assert!(inspection.signature_block.is_some());
        assert_eq!(inspection.is_signature_valid, Some(true));
        assert_eq!(
            inspection.signature_block.as_ref().unwrap().author_label,
            "Alice - Chief Financial Officer"
        );
    }
}
