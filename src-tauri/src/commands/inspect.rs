use denc_core::container::AuthType;
use denc_core::inspect_container;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct HeaderMetadataResponse {
    pub version: u16,
    pub cipher: String,
    pub threshold_k: u8,
    pub total_n: u8,
    pub chunk_size: u32,
    pub custodians: Vec<CustodianMetadata>,
    pub signature_block: Option<denc_core::container::DencSignatureBlock>,
    pub is_signature_valid: Option<bool>,
    pub manifest: Option<denc_core::container::DencManifest>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CustodianMetadata {
    pub custodian_id: u8,
    pub label: String,
    pub auth_type: String,
    pub has_embedded_share: bool,
}

#[tauri::command]
pub fn inspect_denc_file(file_path: String) -> Result<HeaderMetadataResponse, String> {
    let header = inspect_container(&file_path).map_err(|e| e.to_string())?;

    let custodians = header
        .custodians
        .into_iter()
        .map(|c| {
            let auth_type_str = match c.auth_type {
                AuthType::Passphrase => "passphrase",
                AuthType::KeyFile => "keyfile",
                AuthType::OtpChallenge => "otp",
                AuthType::PostQuantum => "pqc",
            };
            CustodianMetadata {
                custodian_id: c.custodian_id,
                label: c.label,
                auth_type: auth_type_str.to_string(),
                has_embedded_share: c.has_embedded_share,
            }
        })
        .collect();

    let cipher_str = match header.cipher_suite {
        denc_core::cipher::CipherSuite::Aes256Gcm => "AES-256-GCM",
        denc_core::cipher::CipherSuite::XChaCha20Poly1305 => "XChaCha20-Poly1305",
    };

    Ok(HeaderMetadataResponse {
        version: header.version,
        cipher: cipher_str.to_string(),
        threshold_k: header.threshold_k,
        total_n: header.total_n,
        chunk_size: header.chunk_size,
        custodians,
        signature_block: header.signature_block,
        is_signature_valid: header.is_signature_valid,
        manifest: header.manifest,
    })
}
