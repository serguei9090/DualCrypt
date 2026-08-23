use denc_core::container::AuthType;
use denc_core::pqc::{
    decrypt_pqc_keyfile_with_pin, encrypt_pqc_keyfile_with_pin, PlainPqcKeyFile, PqcKeyFilePayload,
    PqcKeypair,
};
use denc_core::sss::{KeyFilePayload, SecretShare};
use denc_core::ExportedKeyShare;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

#[derive(Debug, Serialize, Deserialize)]
pub struct KeyFileParseResponse {
    pub share: Option<SecretShare>,
    pub is_pin_protected: bool,
    pub custodian_id: u8,
    pub pqc_private_key_base64: Option<String>,
    pub is_pqc: bool,
}

#[tauri::command]
pub fn save_keyfile(
    file_path: String,
    share: Option<SecretShare>,
    pqc_public_key_base64: Option<String>,
    pqc_private_key_base64: Option<String>,
    custodian_id: Option<u8>,
    label: Option<String>,
    pin: Option<String>,
) -> Result<(), String> {
    if let Some(parent) = Path::new(&file_path).parent() {
        if !parent.as_os_str().is_empty() {
            let _ = std::fs::create_dir_all(parent);
        }
    }

    let cid = custodian_id.unwrap_or(1);
    let lbl = label.unwrap_or_else(|| format!("Custodian {}", cid));

    let json = if let Some(priv_b64) = pqc_private_key_base64 {
        let pub_b64 = pqc_public_key_base64.unwrap_or_default();
        let keypair = PqcKeypair {
            public_key_base64: pub_b64.clone(),
            private_key_base64: priv_b64.clone(),
            algorithm: "NIST-FIPS-203-ML-KEM-768".to_string(),
        };

        if let Some(pin_str) = pin.as_deref().filter(|p| !p.trim().is_empty()) {
            let enc_pqc = encrypt_pqc_keyfile_with_pin(&keypair, cid, &lbl, pin_str)
                .map_err(|e| format!("Failed to encrypt Post-Quantum key with PIN: {e}"))?;
            serde_json::to_string_pretty(&enc_pqc).map_err(|e| e.to_string())?
        } else {
            let plain_pqc = PlainPqcKeyFile {
                algorithm: "NIST-FIPS-203-ML-KEM-768".to_string(),
                custodian_id: cid,
                label: lbl,
                public_key_base64: pub_b64,
                private_key_base64: priv_b64,
            };
            serde_json::to_string_pretty(&plain_pqc).map_err(|e| e.to_string())?
        }
    } else if let Some(s) = share {
        if let Some(pin_str) = pin.as_deref().filter(|p| !p.trim().is_empty()) {
            let enc_share = s
                .encrypt_with_pin(pin_str)
                .map_err(|e| format!("Failed to encrypt share with PIN: {e}"))?;
            serde_json::to_string_pretty(&enc_share).map_err(|e| e.to_string())?
        } else {
            serde_json::to_string_pretty(&s).map_err(|e| e.to_string())?
        }
    } else {
        return Err("No share or PQC key provided to save".to_string());
    };

    std::fs::write(&file_path, json)
        .map_err(|e| format!("Failed to save key file to '{file_path}': {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn save_all_keyfiles_zip(
    file_path: String,
    shares: Vec<ExportedKeyShare>,
    pins: Option<HashMap<u8, String>>,
) -> Result<(), String> {
    if let Some(parent) = Path::new(&file_path).parent() {
        if !parent.as_os_str().is_empty() {
            let _ = std::fs::create_dir_all(parent);
        }
    }

    let file = File::create(&file_path)
        .map_err(|e| format!("Failed to create zip file at '{file_path}': {e}"))?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    let empty_pins = HashMap::new();
    let pins_map = pins.as_ref().unwrap_or(&empty_pins);

    for s in &shares {
        let sanitized_label: String = s
            .label
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
            .collect();

        if s.auth_type == AuthType::PostQuantum || s.pqc_private_key_base64.is_some() {
            let filename = format!("custodian_{}_{}.pqc", s.custodian_id, sanitized_label);
            zip.start_file(&filename, options)
                .map_err(|e| format!("Failed to add entry '{filename}' to zip: {e}"))?;

            let pub_b64 = s.pqc_public_key_base64.clone().unwrap_or_default();
            let priv_b64 = s.pqc_private_key_base64.clone().unwrap_or_default();
            let keypair = PqcKeypair {
                public_key_base64: pub_b64.clone(),
                private_key_base64: priv_b64.clone(),
                algorithm: "NIST-FIPS-203-ML-KEM-768".to_string(),
            };

            let json = if let Some(pin) = pins_map.get(&s.custodian_id).filter(|p| !p.trim().is_empty()) {
                let enc_pqc = encrypt_pqc_keyfile_with_pin(&keypair, s.custodian_id, &s.label, pin)
                    .map_err(|e| format!("Failed to encrypt PQC key with PIN: {e}"))?;
                serde_json::to_string_pretty(&enc_pqc)
                    .map_err(|e| format!("Serialization error for {filename}: {e}"))?
            } else {
                let plain_pqc = PlainPqcKeyFile {
                    algorithm: "NIST-FIPS-203-ML-KEM-768".to_string(),
                    custodian_id: s.custodian_id,
                    label: s.label.clone(),
                    public_key_base64: pub_b64,
                    private_key_base64: priv_b64,
                };
                serde_json::to_string_pretty(&plain_pqc)
                    .map_err(|e| format!("Serialization error for {filename}: {e}"))?
            };

            zip.write_all(json.as_bytes())
                .map_err(|e| format!("Write error for {filename}: {e}"))?;
        } else if let Some(share) = &s.share {
            let filename = format!("custodian_{}_{}.dkey", s.custodian_id, sanitized_label);
            zip.start_file(&filename, options)
                .map_err(|e| format!("Failed to add entry '{filename}' to zip: {e}"))?;

            let json = if let Some(pin) = pins_map.get(&s.custodian_id).filter(|p| !p.trim().is_empty()) {
                let enc_share = share
                    .encrypt_with_pin(pin)
                    .map_err(|e| format!("Failed to encrypt share with PIN: {e}"))?;
                serde_json::to_string_pretty(&enc_share)
                    .map_err(|e| format!("Serialization error for {filename}: {e}"))?
            } else {
                serde_json::to_string_pretty(share)
                    .map_err(|e| format!("Serialization error for {filename}: {e}"))?
            };

            zip.write_all(json.as_bytes())
                .map_err(|e| format!("Write error for {filename}: {e}"))?;
        }
    }

    // Add a README text file inside the zip for enterprise custodians
    zip.start_file("README_CUSTODIAN_KEYS.txt", options)
        .map_err(|e| format!("Failed to add README to zip: {e}"))?;
    let readme_text = format!(
        "DualCrypt Enterprise Key Share Archive\n\
        ========================================\n\
        Total Key Share / Token slots in this archive: {}\n\n\
        FILE FORMATS:\n\
        - .dkey : Shamir Secret Sharing (SSS) key file\n\
        - .pqc  : NIST FIPS 203 ML-KEM-768 Post-Quantum Private Key\n\n\
        INSTRUCTIONS:\n\
        - Distribute each key file securely to its authorized custodian.\n\
        - If PIN/passphrase protection was enabled during export, the custodian must enter their PIN to unlock their key during decryption.\n\
        - Do NOT store all keys on the same workstation or unencrypted channel.\n\
        - To decrypt the container, the required quorum of custodians must provide their keys in DualCrypt Enterprise.\n",
        shares.len()
    );
    zip.write_all(readme_text.as_bytes())
        .map_err(|e| format!("Write error for README: {e}"))?;

    zip.finish()
        .map_err(|e| format!("Failed to finalize zip file: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn parse_keyfile(file_path: String, pin: Option<String>) -> Result<KeyFileParseResponse, String> {
    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read key file '{file_path}': {e}"))?;

    // 1. Try parsing as Post-Quantum Key File (.pqc)
    if let Ok(pqc_payload) = serde_json::from_str::<PqcKeyFilePayload>(&content) {
        return match pqc_payload {
            PqcKeyFilePayload::Plain(plain) => Ok(KeyFileParseResponse {
                custodian_id: plain.custodian_id,
                share: None,
                is_pin_protected: false,
                pqc_private_key_base64: Some(plain.private_key_base64),
                is_pqc: true,
            }),
            PqcKeyFilePayload::Encrypted(enc) => {
                let custodian_id = enc.custodian_id;
                if let Some(pin_str) = pin.as_deref().filter(|p| !p.trim().is_empty()) {
                    let decrypted_priv = decrypt_pqc_keyfile_with_pin(&enc, pin_str)
                        .map_err(|e| format!("PIN decryption failed: {e}"))?;
                    Ok(KeyFileParseResponse {
                        custodian_id,
                        share: None,
                        is_pin_protected: true,
                        pqc_private_key_base64: Some(decrypted_priv),
                        is_pqc: true,
                    })
                } else {
                    Ok(KeyFileParseResponse {
                        custodian_id,
                        share: None,
                        is_pin_protected: true,
                        pqc_private_key_base64: None,
                        is_pqc: true,
                    })
                }
            }
        };
    }

    // 2. Try parsing as Shamir Secret Share (.dkey)
    let parsed: KeyFilePayload = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid key share file format in '{file_path}': {e}"))?;

    match parsed {
        KeyFilePayload::Plain(share) => Ok(KeyFileParseResponse {
            custodian_id: share.id,
            share: Some(share),
            is_pin_protected: false,
            pqc_private_key_base64: None,
            is_pqc: false,
        }),
        KeyFilePayload::Encrypted(enc_share) => {
            let custodian_id = enc_share.id;
            if let Some(pin_str) = pin.as_deref().filter(|p| !p.trim().is_empty()) {
                let decrypted_share = enc_share
                    .decrypt_with_pin(pin_str)
                    .map_err(|e| format!("PIN decryption failed: {e}"))?;
                Ok(KeyFileParseResponse {
                    custodian_id,
                    share: Some(decrypted_share),
                    is_pin_protected: true,
                    pqc_private_key_base64: None,
                    is_pqc: false,
                })
            } else {
                Ok(KeyFileParseResponse {
                    custodian_id,
                    share: None,
                    is_pin_protected: true,
                    pqc_private_key_base64: None,
                    is_pqc: false,
                })
            }
        }
    }
}

#[tauri::command]
pub fn generate_pqc_keypair() -> Result<denc_core::pqc::PqcKeypair, String> {
    denc_core::pqc::generate_ml_kem_keypair()
        .map_err(|e| format!("ML-KEM keypair generation failed: {e}"))
}
