use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineCustodianConfig {
    pub id: u8,
    pub label: Option<String>,
    #[serde(default)]
    pub auth_type: Option<String>, // "postquantum" | "pqc" | "passphrase" | "keyfile" | "otp"
    pub passphrase: Option<String>,
    pub public_key_base64: Option<String>,
    pub timelock_utc: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineManifestConfig {
    pub classification: Option<String>,
    pub purpose: Option<String>,
    pub organization: Option<String>,
    pub custodian_timelocks: Option<HashMap<u8, u64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineAuthorConfig {
    pub label: Option<String>,
    pub signing_key_base64: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineEncryptConfig {
    pub input: Option<PathBuf>,
    pub output: Option<PathBuf>,
    pub threshold_k: Option<u8>,
    pub total_n: Option<u8>,
    pub cipher: Option<String>,
    pub chunk_size: Option<usize>,
    pub key_dir: Option<PathBuf>,
    pub custodians: Option<Vec<PipelineCustodianConfig>>,
    pub manifest: Option<PipelineManifestConfig>,
    pub author: Option<PipelineAuthorConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineDecryptCustodianConfig {
    pub id: u8,
    pub passphrase: Option<String>,
    pub keyfile: Option<PathBuf>,
    pub pqc_keyfile: Option<PathBuf>,
    pub pqc_private_key_base64: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineDecryptConfig {
    pub input: Option<PathBuf>,
    pub output: Option<PathBuf>,
    pub custodians: Option<Vec<PipelineDecryptCustodianConfig>>,
}

/// Loads string content from a file path or standard input (if "-")
pub fn read_config_content(path_or_dash: &Path) -> Result<String, Box<dyn std::error::Error>> {
    if path_or_dash.to_string_lossy() == "-" {
        let mut buf = String::new();
        std::io::stdin().read_to_string(&mut buf)?;
        Ok(buf)
    } else {
        Ok(std::fs::read_to_string(path_or_dash)?)
    }
}

/// Parses encryption configuration from JSON or YAML content
pub fn parse_encrypt_config(
    content: &str,
) -> Result<PipelineEncryptConfig, Box<dyn std::error::Error>> {
    if let Ok(cfg) = serde_json::from_str::<PipelineEncryptConfig>(content) {
        return Ok(cfg);
    }
    let cfg: PipelineEncryptConfig = serde_yaml::from_str(content)?;
    Ok(cfg)
}

/// Parses decryption configuration from JSON or YAML content
pub fn parse_decrypt_config(
    content: &str,
) -> Result<PipelineDecryptConfig, Box<dyn std::error::Error>> {
    if let Ok(cfg) = serde_json::from_str::<PipelineDecryptConfig>(content) {
        return Ok(cfg);
    }
    let cfg: PipelineDecryptConfig = serde_yaml::from_str(content)?;
    Ok(cfg)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliExportedKeyJson {
    pub custodian_id: u8,
    pub label: String,
    pub auth_type: String,
    pub file_path: Option<String>,
    pub public_key_base64: Option<String>,
    pub has_private_key: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliSignatureJson {
    pub algorithm: String,
    pub author_label: String,
    pub author_public_key_base64: String,
    pub signature_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliEncryptJsonOutput {
    pub status: String,
    pub operation: String,
    pub input_path: String,
    pub container_path: String,
    pub bytes_encrypted: u64,
    pub threshold_k: u8,
    pub total_n: u8,
    pub cipher_suite: String,
    pub exported_keys: Vec<CliExportedKeyJson>,
    pub author_signature: Option<CliSignatureJson>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliDecryptJsonOutput {
    pub status: String,
    pub operation: String,
    pub input_path: String,
    pub output_path: String,
    pub bytes_decrypted: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliPqcKeygenJsonOutput {
    pub status: String,
    pub algorithm: String,
    pub key_type: String,
    pub public_key_base64: String,
    pub private_key_base64: String,
}
