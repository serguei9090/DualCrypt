use denc_core::cipher::{
    decrypt_stream_chunks, encrypt_stream_chunks, generate_base_nonce, DEFAULT_CHUNK_SIZE,
};
use denc_core::container::{
    AuthType, CustodianDescriptor, DencHeader, DencSignatureBlock, FORMAT_VERSION_1,
    FORMAT_VERSION_2,
};
use denc_core::kdf::{derive_key_argon2id, generate_salt};
use denc_core::pqc::{
    decapsulate_share_ml_kem, encapsulate_share_ml_kem, generate_ml_dsa_keypair,
    generate_ml_kem_keypair, sign_digest_ml_dsa, verify_signature_ml_dsa, PqcEncryptedShare,
};
use denc_core::sss::{combine_shares, split_secret, SecretShare};
use denc_core::{
    CustodianCredential, CustodianInspection, EncryptionParams, ExportedKeyShare, HeaderInspection,
};
use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use rand_core::{OsRng, RngCore};
use std::io::{BufReader, Cursor, Write};
use wasm_bindgen::prelude::*;
use zeroize::Zeroize;

#[wasm_bindgen]
pub fn wasm_generate_pqc_keypair() -> Result<JsValue, JsValue> {
    let keypair = generate_ml_kem_keypair()
        .map_err(|e| JsValue::from_str(&format!("PQC Keygen failed: {}", e)))?;
    serde_wasm_bindgen::to_value(&keypair)
        .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
}

#[wasm_bindgen]
pub fn wasm_generate_ml_dsa_keypair() -> Result<JsValue, JsValue> {
    let keypair = generate_ml_dsa_keypair()
        .map_err(|e| JsValue::from_str(&format!("ML-DSA Keygen failed: {}", e)))?;
    serde_wasm_bindgen::to_value(&keypair)
        .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
}

#[wasm_bindgen]
pub fn wasm_inspect_denc(bytes: &[u8]) -> Result<JsValue, JsValue> {
    let mut reader = BufReader::new(bytes);
    let (header, _, _) = DencHeader::deserialize(&mut reader)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse DENC header: {}", e)))?;

    let is_signature_valid = if let Some(sig) = &header.signature_block {
        let mut unsigned_header = header.clone();
        unsigned_header.signature_block = None;
        if let Ok((_, draft_digest)) = unsigned_header.serialize() {
            Some(
                verify_signature_ml_dsa(
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

    let timelocks_map = header
        .manifest
        .as_ref()
        .and_then(|m| m.custodian_timelocks.as_ref());

    let custodians: Vec<CustodianInspection> = header
        .custodians
        .into_iter()
        .map(|c| {
            let timelock = timelocks_map.and_then(|m| m.get(&c.custodian_id).copied());
            CustodianInspection {
                custodian_id: c.custodian_id,
                label: c.label,
                auth_type: c.auth_type,
                has_embedded_share: !c.encrypted_share.is_empty(),
                timelock_not_before_utc: timelock,
            }
        })
        .collect();

    let inspection = HeaderInspection {
        version: header.version,
        cipher_suite: header.cipher_suite,
        threshold_k: header.threshold_k,
        total_n: header.total_n,
        chunk_size: header.chunk_size,
        custodians,
        signature_block: header.signature_block,
        is_signature_valid,
        manifest: header.manifest,
    };

    serde_wasm_bindgen::to_value(&inspection)
        .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
}

#[wasm_bindgen]
pub fn wasm_encrypt_payload(
    payload_bytes: &[u8],
    params_json: &str,
) -> Result<JsValue, JsValue> {
    let params: EncryptionParams = serde_json::from_str(params_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid params JSON: {}", e)))?;

    if params.custodians.len() != params.total_n as usize {
        return Err(JsValue::from_str(&format!(
            "Expected {} custodians, provided {}",
            params.total_n,
            params.custodians.len()
        )));
    }

    // 1. Generate random 32-byte DEK
    let mut dek = [0u8; 32];
    OsRng.fill_bytes(&mut dek);

    // 2. Split DEK with Shamir Secret Sharing
    let mut raw_shares = split_secret(&dek, params.threshold_k, params.total_n)
        .map_err(|e| JsValue::from_str(&format!("SSS splitting failed: {}", e)))?;

    let master_salt = generate_salt();
    let base_nonce = generate_base_nonce();
    let chunk_size = params.chunk_size.unwrap_or(DEFAULT_CHUNK_SIZE);

    let mut descriptors = Vec::with_capacity(params.custodians.len());
    let mut exported_shares = Vec::new();

    for (idx, custodian) in params.custodians.iter().enumerate() {
        let custodian_salt = generate_salt();
        let share = raw_shares[idx].clone();

        match custodian.auth_type {
            AuthType::Passphrase => {
                let passphrase = custodian
                    .passphrase
                    .as_deref()
                    .ok_or_else(|| JsValue::from_str(&format!("Passphrase required for custodian {}", custodian.label)))?;

                let mut pass_key = derive_key_argon2id(passphrase.as_bytes(), &custodian_salt)
                    .map_err(|e| JsValue::from_str(&format!("KDF failed: {}", e)))?;
                let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&pass_key));
                let share_json = serde_json::to_vec(&share)
                    .map_err(|e| JsValue::from_str(&format!("Serialize share error: {}", e)))?;

                let share_nonce = Nonce::from_slice(&custodian_salt[0..12]);
                let encrypted_share = cipher
                    .encrypt(share_nonce, Payload { msg: &share_json, aad: &custodian_salt })
                    .map_err(|_| JsValue::from_str("Failed to encrypt share with passphrase"))?;

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
                    let kp = generate_ml_kem_keypair()
                        .map_err(|e| JsValue::from_str(&format!("PQC keygen error: {}", e)))?;
                    (kp.public_key_base64.clone(), Some(kp.private_key_base64.clone()))
                };

                let pqc_share = encapsulate_share_ml_kem(&pub_key_b64, &share)
                    .map_err(|e| JsValue::from_str(&format!("ML-KEM Encapsulation failed: {}", e)))?;
                let share_bytes = serde_json::to_vec(&pqc_share)
                    .map_err(|e| JsValue::from_str(&format!("Serialize PQC share error: {}", e)))?;

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
            manifest: params.manifest.clone(),
        };
        let (_, draft_digest) = draft_header.serialize()
            .map_err(|e| JsValue::from_str(&format!("Draft header error: {}", e)))?;
        let signature_base64 = sign_digest_ml_dsa(author_key, &draft_digest)
            .map_err(|e| JsValue::from_str(&format!("Signing failed: {}", e)))?;
        let author_pub = denc_core::pqc::derive_author_public_key_ml_dsa(author_key)
            .map_err(|e| JsValue::from_str(&format!("Derive public key failed: {}", e)))?;

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
        version: if signature_block.is_some() || params.manifest.is_some() {
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
        manifest: params.manifest.clone(),
    };

    let (header_bytes, header_digest) = header.serialize()
        .map_err(|e| JsValue::from_str(&format!("Serialize header failed: {}", e)))?;

    let mut output_bytes = Vec::new();
    output_bytes.write_all(&header_bytes)
        .map_err(|e| JsValue::from_str(&format!("Write header error: {}", e)))?;

    let mut input_cursor = Cursor::new(payload_bytes);
    let total_bytes = payload_bytes.len() as u64;

    encrypt_stream_chunks(
        &mut input_cursor,
        &mut output_bytes,
        &dek,
        &base_nonce,
        params.cipher,
        &header_digest,
        total_bytes,
        chunk_size,
        |_, _| {},
        None,
    ).map_err(|e| JsValue::from_str(&format!("Stream encryption error: {}", e)))?;

    dek.zeroize();
    raw_shares.zeroize();

    #[derive(serde::Serialize)]
    struct WasmEncResult {
        encrypted_bytes: Vec<u8>,
        exported_shares: Vec<ExportedKeyShare>,
        author_signature_block: Option<DencSignatureBlock>,
    }

    let out = WasmEncResult {
        encrypted_bytes: output_bytes,
        exported_shares,
        author_signature_block: signature_block,
    };

    serde_wasm_bindgen::to_value(&out)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen]
pub fn wasm_decrypt_payload(
    denc_bytes: &[u8],
    creds_json: &str,
) -> Result<Vec<u8>, JsValue> {
    let credentials: Vec<CustodianCredential> = serde_json::from_str(creds_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid credentials JSON: {}", e)))?;

    let mut reader = BufReader::new(denc_bytes);
    let (header, header_digest, header_bytes_len) = DencHeader::deserialize(&mut reader)
        .map_err(|e| JsValue::from_str(&format!("Deserialize header error: {}", e)))?;

    let total_cipher_payload = (denc_bytes.len() as u64).saturating_sub(header_bytes_len as u64);
    let mut recovered_shares = Vec::new();

    for cred in credentials {
        if let Some(share) = cred.direct_share {
            recovered_shares.push(share);
            continue;
        }

        if let Some(descriptor) = header.custodians.iter().find(|c| c.custodian_id == cred.custodian_id) {
            if descriptor.auth_type == AuthType::Passphrase {
                let pass = cred.passphrase.as_deref().ok_or_else(|| {
                    JsValue::from_str(&format!("Passphrase required for custodian {}", descriptor.label))
                })?;

                let mut pass_key = derive_key_argon2id(pass.as_bytes(), &descriptor.salt)
                    .map_err(|e| JsValue::from_str(&format!("KDF error: {}", e)))?;
                let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&pass_key));
                let share_nonce = Nonce::from_slice(&descriptor.salt[0..12]);

                let decrypted_json = cipher
                    .decrypt(share_nonce, Payload { msg: &descriptor.encrypted_share, aad: &descriptor.salt })
                    .map_err(|_| JsValue::from_str(&format!("Invalid passphrase for custodian {}", descriptor.label)))?;

                pass_key.zeroize();

                let share: SecretShare = serde_json::from_slice(&decrypted_json)
                    .map_err(|e| JsValue::from_str(&format!("Parse share JSON failed: {}", e)))?;
                recovered_shares.push(share);
            } else if descriptor.auth_type == AuthType::PostQuantum {
                let priv_key_b64 = cred.pqc_private_key_base64.as_deref().ok_or_else(|| {
                    JsValue::from_str(&format!("ML-KEM Private Key required for custodian {}", descriptor.label))
                })?;

                let pqc_share: PqcEncryptedShare = serde_json::from_slice(&descriptor.encrypted_share)
                    .map_err(|e| JsValue::from_str(&format!("Parse PQC share error: {}", e)))?;

                let share = decapsulate_share_ml_kem(priv_key_b64, &pqc_share)
                    .map_err(|e| JsValue::from_str(&format!("ML-KEM Decapsulation error: {}", e)))?;
                recovered_shares.push(share);
            }
        }
    }

    if (recovered_shares.len() as u8) < header.threshold_k {
        return Err(JsValue::from_str(&format!(
            "Insufficient shares: provided {}, required {}",
            recovered_shares.len(),
            header.threshold_k
        )));
    }

    let mut reconstructed_dek_vec = combine_shares(&recovered_shares[0..header.threshold_k as usize])
        .map_err(|e| JsValue::from_str(&format!("Combine shares error: {}", e)))?;

    if reconstructed_dek_vec.len() != 32 {
        reconstructed_dek_vec.zeroize();
        return Err(JsValue::from_str("DEK integrity check failed"));
    }

    let mut dek = [0u8; 32];
    dek.copy_from_slice(&reconstructed_dek_vec);
    reconstructed_dek_vec.zeroize();

    let mut decrypted_output = Vec::new();

    decrypt_stream_chunks(
        &mut reader,
        &mut decrypted_output,
        &dek,
        &header.base_nonce,
        header.cipher_suite,
        &header_digest,
        total_cipher_payload,
        |_, _| {},
        None,
    ).map_err(|e| JsValue::from_str(&format!("Stream decryption error: {}", e)))?;

    dek.zeroize();
    recovered_shares.zeroize();

    Ok(decrypted_output)
}
