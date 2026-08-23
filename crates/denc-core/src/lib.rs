pub mod cipher;
pub mod container;
pub mod error;
pub mod kdf;
pub mod sss;

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use cipher::{
    encrypt_stream_chunks, generate_base_nonce, CipherSuite, DEFAULT_CHUNK_SIZE,
};
use container::{AuthType, CustodianDescriptor, DencHeader, FORMAT_VERSION_1};
use error::DencError;
use kdf::{derive_key_argon2id, generate_salt};
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sss::{combine_shares, split_secret, SecretShare};
use std::fs::File;
use std::io::{BufReader, BufWriter, Write};
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionParams {
    pub cipher: CipherSuite,
    pub threshold_k: u8,
    pub total_n: u8,
    pub chunk_size: Option<usize>,
    pub custodians: Vec<CustodianInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportedKeyShare {
    pub custodian_id: u8,
    pub label: String,
    pub share: SecretShare,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionResult {
    pub bytes_encrypted: u64,
    pub exported_shares: Vec<ExportedKeyShare>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeaderInspection {
    pub version: u16,
    pub cipher_suite: CipherSuite,
    pub threshold_k: u8,
    pub total_n: u8,
    pub chunk_size: u32,
    pub custodians: Vec<CustodianInspection>,
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
    })
}

/// High-level function to encrypt a file with dual/threshold custody
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

    let input_file = File::open(&input_path)?;
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
                    share,
                });
            }
        }
    }

    let header = DencHeader {
        version: FORMAT_VERSION_1,
        cipher_suite: params.cipher,
        kdf_id: 1,
        threshold_k: params.threshold_k,
        total_n: params.total_n,
        chunk_size: chunk_size as u32,
        master_salt,
        base_nonce,
        custodians: descriptors,
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
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustodianCredential {
    pub custodian_id: u8,
    pub passphrase: Option<String>,
    pub direct_share: Option<SecretShare>,
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
                },
                CustodianInput {
                    custodian_id: 2,
                    label: "Party 2 (Security Officer)".to_string(),
                    auth_type: AuthType::KeyFile,
                    passphrase: None,
                },
            ],
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
        let party2_share = enc_res.exported_shares[0].share.clone();

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
            },
            CustodianCredential {
                custodian_id: 2,
                passphrase: None,
                direct_share: Some(party2_share),
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
}
