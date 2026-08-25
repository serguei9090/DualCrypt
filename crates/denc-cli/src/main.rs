mod config;

use clap::{Args, Parser, Subcommand};
use colored::*;
use config::*;
use denc_core::cipher::CipherSuite;
use denc_core::container::{AuthType, DencManifest};
use denc_core::pqc::{generate_ml_dsa_keypair, generate_ml_kem_keypair, PlainPqcKeyFile};
use denc_core::sss::SecretShare;
use denc_core::{
    decrypt_file, encrypt_file, inspect_container, CustodianCredential, CustodianInput,
    EncryptionParams,
};
use indicatif::{ProgressBar, ProgressStyle};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};

#[derive(Parser)]
#[command(
    name = "denc",
    author = "DualCrypt Enterprise Security",
    version = "2.0.0",
    about = "Zero-Trust Multi-Party Threshold File Encryption & Automation CLI",
    long_about = "DualCrypt Enterprise CLI - High-assurance threshold file encryption, post-quantum cryptography (NIST FIPS 203 ML-KEM / FIPS 204 ML-DSA), automated CI/CD pipeline integration, container inspection, key generation, and local web serving."
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Encrypt a file or directory into an authenticated .denc container
    Encrypt(EncryptArgs),

    /// Decrypt an authenticated .denc container with threshold quorum credentials
    Decrypt(DecryptArgs),

    /// Inspect a .denc container header, compliance manifest, and custodian roster
    Inspect(InspectArgs),

    /// Generate standalone NIST FIPS 203 (ML-KEM-768) or FIPS 204 (ML-DSA-65) keypairs
    PqcKeygen(PqcKeygenArgs),

    /// Generate standalone Shamir secret shares for manual key distribution
    #[command(alias = "keygen")]
    SssKeygen(SssKeygenArgs),

    /// Launch the embedded local Web UI server
    Serve(ServeArgs),
}

#[derive(Args, Debug)]
pub struct EncryptArgs {
    /// Input file or directory to encrypt
    #[arg(value_name = "INPUT_PATH")]
    pub input: Option<PathBuf>,

    /// Output .denc container destination path
    #[arg(short, long, value_name = "OUTPUT_PATH")]
    pub output: Option<PathBuf>,

    /// Path to a JSON or YAML configuration recipe file (use '-' to read from stdin)
    #[arg(long, value_name = "CONFIG_PATH")]
    pub config: Option<PathBuf>,

    /// Required threshold (k) of custodians needed to decrypt [default: 2]
    #[arg(short = 'k', long, value_name = "K")]
    pub threshold: Option<u8>,

    /// Total number (n) of custodian shares to generate [default: 2]
    #[arg(short = 'n', long, value_name = "N")]
    pub total: Option<u8>,

    /// Cipher suite: 'aes-256-gcm' (default) or 'xchacha20-poly1305'
    #[arg(long)]
    pub cipher: Option<String>,

    /// Output directory to export generated .pqc and .dkey key share files [default: .]
    #[arg(long = "key-dir", value_name = "DIR")]
    pub key_dir: Option<PathBuf>,

    /// Custodian definition in format 'id:label:auth_type[:passphrase_or_pubkey]' 
    /// (e.g. -c 1:"Alice (SecOps)":pqc -c 2:"Bob (Audit)":passphrase:Secret123)
    #[arg(short = 'c', long = "custodian", value_name = "SPEC")]
    pub custodians: Vec<String>,

    /// Convenience flag: add a Post-Quantum custodian by ID and optional label 'id[:label]' (e.g. --pqc 1:"SecOps Lead")
    #[arg(long = "pqc", value_name = "ID[:LABEL]")]
    pub pqc_custodians: Vec<String>,

    /// Custodian passphrases in format 'id:passphrase' (e.g. -p 1:SecretPass1 -p 2:SecretPass2)
    #[arg(short = 'p', long = "passphrase", value_name = "ID:PASSPHRASE")]
    pub passphrases: Vec<String>,

    /// Governance manifest classification: TOP_SECRET, CONFIDENTIAL, RESTRICTED, UNCLASSIFIED
    #[arg(long, value_name = "LEVEL")]
    pub classification: Option<String>,

    /// Governance manifest purpose or scope description
    #[arg(long, value_name = "PURPOSE")]
    pub purpose: Option<String>,

    /// Governance manifest organization or department
    #[arg(long, value_name = "ORG")]
    pub organization: Option<String>,

    /// Custodian timelock in format 'id:unix_timestamp_utc' (e.g. --timelock 3:1750000000)
    #[arg(long = "timelock", value_name = "ID:TIMESTAMP")]
    pub timelocks: Vec<String>,

    /// Author NIST FIPS 204 ML-DSA-65 Private Signing Key (Base64) to digitally sign container
    #[arg(long = "author-signing-key", value_name = "BASE64_KEY")]
    pub author_signing_key: Option<String>,

    /// Author identity label for digital signature metadata
    #[arg(long = "author-label", value_name = "LABEL")]
    pub author_label: Option<String>,

    /// Output machine-readable JSON summary for CI/CD automation pipelines
    #[arg(long)]
    pub json: bool,

    /// Suppress interactive progress bars and non-error messages
    #[arg(short = 'q', long)]
    pub quiet: bool,
}

#[derive(Args, Debug)]
pub struct DecryptArgs {
    /// Path to .denc container
    #[arg(value_name = "INPUT_PATH")]
    pub input: Option<PathBuf>,

    /// Destination output file or directory
    #[arg(short, long, value_name = "OUTPUT_PATH")]
    pub output: Option<PathBuf>,

    /// Path to a JSON or YAML decryption configuration file (use '-' to read from stdin)
    #[arg(long, value_name = "CONFIG_PATH")]
    pub config: Option<PathBuf>,

    /// Custodian passphrase in format 'id:passphrase' (e.g. -p 1:SecretPass1)
    #[arg(short = 'p', long = "passphrase", value_name = "ID:PASSPHRASE")]
    pub passphrases: Vec<String>,

    /// Custodian keyfile (.dkey or .pqc) in format 'id:path/to/key' (e.g. -f 1:custodian_1.pqc)
    #[arg(short = 'f', long = "keyfile", value_name = "ID:PATH")]
    pub keyfiles: Vec<String>,

    /// Custodian Post-Quantum private key file or base64 'id:path/to/custodian.pqc' or 'id:BASE64'
    #[arg(long = "pqc-key", value_name = "ID:KEY_OR_PATH")]
    pub pqc_keys: Vec<String>,

    /// Output machine-readable JSON summary for CI/CD automation pipelines
    #[arg(long)]
    pub json: bool,

    /// Suppress interactive progress bars and non-error messages
    #[arg(short = 'q', long)]
    pub quiet: bool,
}

#[derive(Args, Debug)]
pub struct InspectArgs {
    /// Path to .denc container
    #[arg(required = true, value_name = "CONTAINER_PATH")]
    pub input: PathBuf,

    /// Output metadata in raw JSON format
    #[arg(long)]
    pub json: bool,
}

#[derive(Args, Debug)]
pub struct PqcKeygenArgs {
    /// Cryptographic algorithm: 'kem' / 'ml-kem-768' (default) or 'dsa' / 'ml-dsa-65'
    #[arg(short = 'a', long, default_value = "ml-kem-768")]
    pub algorithm: String,

    /// Optional file path to save the generated private key / keypair JSON
    #[arg(short, long, value_name = "OUTPUT_PATH")]
    pub output: Option<PathBuf>,

    /// Output machine-readable JSON to stdout
    #[arg(long)]
    pub json: bool,
}

#[derive(Args, Debug)]
pub struct SssKeygenArgs {
    /// Secret string or key to split (if omitted, CSPRNG generates 32 random bytes)
    #[arg(short, long)]
    pub secret: Option<String>,

    /// Threshold (k) required to reconstruct
    #[arg(short = 'k', long, default_value_t = 2)]
    pub threshold: u8,

    /// Total shares (n) to produce
    #[arg(short = 'n', long, default_value_t = 3)]
    pub total: u8,

    /// Output machine-readable JSON to stdout
    #[arg(long)]
    pub json: bool,
}

#[derive(Args, Debug)]
pub struct ServeArgs {
    /// Network interface to bind: '127.0.0.1' (localhost only) or '0.0.0.0' (public/LAN)
    #[arg(short = 'H', long, default_value = "127.0.0.1")]
    pub host: String,

    /// Port number to listen on
    #[arg(short, long, default_value_t = 8080)]
    pub port: u16,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Encrypt(args) => {
            handle_encrypt(args).await?;
        }
        Commands::Decrypt(args) => {
            handle_decrypt(args).await?;
        }
        Commands::Inspect(args) => {
            handle_inspect(args)?;
        }
        Commands::PqcKeygen(args) => {
            handle_pqc_keygen(args)?;
        }
        Commands::SssKeygen(args) => {
            handle_sss_keygen(args)?;
        }
        Commands::Serve(args) => {
            handle_serve(args.host, args.port).await?;
        }
    }

    Ok(())
}

async fn handle_encrypt(args: EncryptArgs) -> Result<(), Box<dyn std::error::Error>> {
    // 1. Optionally parse config recipe
    let file_cfg = if let Some(cfg_path) = &args.config {
        let content = read_config_content(cfg_path)?;
        Some(parse_encrypt_config(&content)?)
    } else {
        None
    };

    // 2. Resolve input & output paths
    let input_path = args
        .input
        .or_else(|| file_cfg.as_ref().and_then(|c| c.input.clone()))
        .ok_or_else(|| {
            "Missing input payload path. Provide positional <INPUT_PATH> or 'input' in --config."
        })?;

    if !input_path.exists() {
        eprintln!("{}: Input path does not exist: {:?}", "Error".red().bold(), input_path);
        std::process::exit(1);
    }

    let out_path = args
        .output
        .or_else(|| file_cfg.as_ref().and_then(|c| c.output.clone()))
        .unwrap_or_else(|| {
            let mut p = input_path.clone();
            let name = format!("{}.denc", p.file_name().unwrap().to_string_lossy());
            p.set_file_name(name);
            p
        });

    let threshold_k = args
        .threshold
        .or_else(|| file_cfg.as_ref().and_then(|c| c.threshold_k))
        .unwrap_or(2);

    let total_n = args
        .total
        .or_else(|| file_cfg.as_ref().and_then(|c| c.total_n))
        .unwrap_or(2);

    let cipher_str = args
        .cipher
        .or_else(|| file_cfg.as_ref().and_then(|c| c.cipher.clone()))
        .unwrap_or_else(|| "aes-256-gcm".to_string());

    let cipher_suite = match cipher_str.to_lowercase().as_str() {
        "xchacha20-poly1305" | "xchacha" => CipherSuite::XChaCha20Poly1305,
        _ => CipherSuite::Aes256Gcm,
    };

    let key_dir = args
        .key_dir
        .or_else(|| file_cfg.as_ref().and_then(|c| c.key_dir.clone()))
        .unwrap_or_else(|| PathBuf::from("."));

    // 3. Build custodian inputs
    let mut custodian_map: HashMap<u8, CustodianInput> = HashMap::new();

    // From file config if present
    if let Some(cfg) = &file_cfg {
        if let Some(custs) = &cfg.custodians {
            for c in custs {
                let auth_type = match c.auth_type.as_deref().unwrap_or("").to_lowercase().as_str() {
                    "keyfile" => AuthType::KeyFile,
                    "otp" => AuthType::OtpChallenge,
                    "passphrase" | "password" => AuthType::Passphrase,
                    _ => AuthType::PostQuantum,
                };
                custodian_map.insert(
                    c.id,
                    CustodianInput {
                        custodian_id: c.id,
                        label: c.label.clone().unwrap_or_else(|| format!("Custodian {}", c.id)),
                        auth_type,
                        passphrase: c.passphrase.clone(),
                        public_key_base64: c.public_key_base64.clone(),
                    },
                );
            }
        }
    }

    // Parse CLI passphrases (-p 1:Secret)
    for p in &args.passphrases {
        if let Some((id_str, pass)) = p.split_once(':') {
            if let Ok(id) = id_str.parse::<u8>() {
                let entry = custodian_map.entry(id).or_insert_with(|| CustodianInput {
                    custodian_id: id,
                    label: format!("Custodian {}", id),
                    auth_type: AuthType::Passphrase,
                    passphrase: None,
                    public_key_base64: None,
                });
                entry.auth_type = AuthType::Passphrase;
                entry.passphrase = Some(pass.to_string());
            }
        }
    }

    // Parse CLI convenience PQC flags (--pqc 1 or --pqc 1:SecOps)
    for pqc in &args.pqc_custodians {
        let (id, label) = if let Some((id_str, lbl)) = pqc.split_once(':') {
            (id_str.parse::<u8>().ok(), Some(lbl.to_string()))
        } else {
            (pqc.parse::<u8>().ok(), None)
        };
        if let Some(id) = id {
            let entry = custodian_map.entry(id).or_insert_with(|| CustodianInput {
                custodian_id: id,
                label: format!("Custodian {}", id),
                auth_type: AuthType::PostQuantum,
                passphrase: None,
                public_key_base64: None,
            });
            entry.auth_type = AuthType::PostQuantum;
            if let Some(lbl) = label {
                entry.label = lbl;
            }
        }
    }

    // Parse CLI generic custodians (-c 1:"SecOps":pqc or -c 2:"Audit":passphrase:Secret123)
    for c in &args.custodians {
        let parts: Vec<&str> = c.splitn(4, ':').collect();
        if !parts.is_empty() {
            if let Ok(id) = parts[0].parse::<u8>() {
                let label = if parts.len() > 1 && !parts[1].trim().is_empty() {
                    parts[1].trim().to_string()
                } else {
                    format!("Custodian {}", id)
                };
                let auth_str = if parts.len() > 2 { parts[2].to_lowercase() } else { "pqc".to_string() };
                let (auth_type, pass, pk) = match auth_str.as_str() {
                    "passphrase" | "password" => {
                        let p = if parts.len() > 3 { Some(parts[3].to_string()) } else { None };
                        (AuthType::Passphrase, p, None)
                    }
                    "keyfile" => (AuthType::KeyFile, None, None),
                    "otp" => (AuthType::OtpChallenge, None, None),
                    _ => {
                        let pk = if parts.len() > 3 { Some(parts[3].to_string()) } else { None };
                        (AuthType::PostQuantum, None, pk)
                    }
                };
                custodian_map.insert(
                    id,
                    CustodianInput {
                        custodian_id: id,
                        label,
                        auth_type,
                        passphrase: pass,
                        public_key_base64: pk,
                    },
                );
            }
        }
    }

    // Fill missing custodians up to total_n
    for i in 1..=total_n {
        custodian_map.entry(i).or_insert_with(|| CustodianInput {
            custodian_id: i,
            label: format!("Custodian {}", i),
            auth_type: AuthType::PostQuantum,
            passphrase: None,
            public_key_base64: None,
        });
    }

    let mut custodians: Vec<CustodianInput> = custodian_map.into_values().collect();
    custodians.sort_by_key(|c| c.custodian_id);
    custodians.truncate(total_n as usize);

    // 4. Governance Manifest
    let mut timelocks: HashMap<u8, u64> = file_cfg
        .as_ref()
        .and_then(|c| c.manifest.as_ref())
        .and_then(|m| m.custodian_timelocks.clone())
        .unwrap_or_default();

    for t in &args.timelocks {
        if let Some((id_str, ts_str)) = t.split_once(':') {
            if let (Ok(id), Ok(ts)) = (id_str.parse::<u8>(), ts_str.parse::<u64>()) {
                timelocks.insert(id, ts);
            }
        }
    }

    let classification = args
        .classification
        .or_else(|| file_cfg.as_ref().and_then(|c| c.manifest.as_ref()).and_then(|m| m.classification.clone()))
        .unwrap_or_else(|| "RESTRICTED".to_string());

    let purpose = args
        .purpose
        .or_else(|| file_cfg.as_ref().and_then(|c| c.manifest.as_ref()).and_then(|m| m.purpose.clone()));

    let organization = args
        .organization
        .or_else(|| file_cfg.as_ref().and_then(|c| c.manifest.as_ref()).and_then(|m| m.organization.clone()));

    let created_at_utc = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let manifest = Some(DencManifest {
        classification,
        purpose,
        organization,
        created_at_utc,
        original_filename: input_path.file_name().map(|n| n.to_string_lossy().to_string()),
        custodian_timelocks: if timelocks.is_empty() { None } else { Some(timelocks) },
    });

    // 5. Author Digital Signature
    let author_signing_key = args
        .author_signing_key
        .or_else(|| file_cfg.as_ref().and_then(|c| c.author.as_ref()).and_then(|a| a.signing_key_base64.clone()));

    let author_label = args
        .author_label
        .or_else(|| file_cfg.as_ref().and_then(|c| c.author.as_ref()).and_then(|a| a.label.clone()));

    let params = EncryptionParams {
        cipher: cipher_suite,
        threshold_k,
        total_n,
        chunk_size: file_cfg.as_ref().and_then(|c| c.chunk_size),
        custodians,
        author_signing_key_base64: author_signing_key,
        author_label,
        manifest,
    };

    let is_json = args.json;
    let is_quiet = args.quiet || is_json;

    if !is_quiet {
        println!("{}", "═".repeat(60).cyan());
        println!(" {}", "DUALCRYPT ENTERPRISE ENCRYPTOR".cyan().bold());
        println!("{}", "═".repeat(60).cyan());
        println!("  {:<18} {:?}", "Source Payload:".bright_white(), input_path);
        println!("  {:<18} {:?}", "Encrypted Container:".bright_white(), out_path);
        println!("  {:<18} {:?}", "Cipher Suite:".bright_white(), cipher_suite);
        println!("  {:<18} {}-of-{} Custodians", "Quorum Policy:".bright_white(), threshold_k, total_n);
    }

    let pb = if !is_quiet {
        let p = ProgressBar::new(100);
        p.set_style(
            ProgressStyle::default_bar()
                .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({eta}) {msg}")?
                .progress_chars("#>-"),
        );
        Some(p)
    } else {
        None
    };

    let pb_clone = pb.clone();
    let res = encrypt_file(
        &input_path,
        &out_path,
        params,
        move |processed, total| {
            if let Some(p) = &pb_clone {
                if total > 0 {
                    p.set_length(total);
                    p.set_position(processed);
                    p.set_message("Streaming AEAD");
                }
            }
        },
        None,
    )?;

    if let Some(p) = pb {
        p.finish_with_message("Container Finalized & Authenticated");
    }

    // Export keys to key_dir
    std::fs::create_dir_all(&key_dir)?;
    let mut exported_keys_json = Vec::new();

    for s in &res.exported_shares {
        if s.auth_type == AuthType::PostQuantum {
            let key_filename = format!("custodian_{}.pqc", s.custodian_id);
            let key_path = key_dir.join(&key_filename);
            let pqc_file = PlainPqcKeyFile {
                algorithm: "NIST-FIPS-203-ML-KEM-768".to_string(),
                custodian_id: s.custodian_id,
                label: s.label.clone(),
                public_key_base64: s.pqc_public_key_base64.clone().unwrap_or_default(),
                private_key_base64: s.pqc_private_key_base64.clone().unwrap_or_default(),
            };
            let json = serde_json::to_string_pretty(&pqc_file)?;
            std::fs::write(&key_path, json)?;

            if !is_quiet {
                println!("  ✔ Saved Post-Quantum Key P{} -> {:?}", s.custodian_id, key_path);
            }

            exported_keys_json.push(CliExportedKeyJson {
                custodian_id: s.custodian_id,
                label: s.label.clone(),
                auth_type: "postquantum".to_string(),
                file_path: Some(key_path.to_string_lossy().to_string()),
                public_key_base64: s.pqc_public_key_base64.clone(),
                has_private_key: s.pqc_private_key_base64.is_some(),
            });
        } else if let Some(share) = &s.share {
            let key_filename = format!("custodian_{}.dkey", s.custodian_id);
            let key_path = key_dir.join(&key_filename);
            let json = serde_json::to_string_pretty(share)?;
            std::fs::write(&key_path, json)?;

            if !is_quiet {
                println!("  ✔ Saved Share P{} -> {:?}", s.custodian_id, key_path);
            }

            exported_keys_json.push(CliExportedKeyJson {
                custodian_id: s.custodian_id,
                label: s.label.clone(),
                auth_type: "keyfile".to_string(),
                file_path: Some(key_path.to_string_lossy().to_string()),
                public_key_base64: None,
                has_private_key: false,
            });
        }
    }

    if is_json {
        let sig_json = res.author_signature_block.map(|s| CliSignatureJson {
            algorithm: s.algorithm,
            author_label: s.author_label,
            author_public_key_base64: s.author_public_key_base64,
            signature_base64: s.signature_base64,
        });

        let json_out = CliEncryptJsonOutput {
            status: "success".to_string(),
            operation: "encrypt".to_string(),
            input_path: input_path.to_string_lossy().to_string(),
            container_path: out_path.to_string_lossy().to_string(),
            bytes_encrypted: res.bytes_encrypted,
            threshold_k,
            total_n,
            cipher_suite: format!("{:?}", cipher_suite),
            exported_keys: exported_keys_json,
            author_signature: sig_json,
        };

        println!("{}", serde_json::to_string_pretty(&json_out)?);
    } else if !is_quiet {
        println!("\n{}", "✔ Encryption Succeeded!".green().bold());
        println!("  Total Bytes Encrypted: {}", res.bytes_encrypted);
        println!("  Container Saved: {:?}", out_path);
    }

    Ok(())
}

async fn handle_decrypt(args: DecryptArgs) -> Result<(), Box<dyn std::error::Error>> {
    // 1. Optionally parse config recipe
    let file_cfg = if let Some(cfg_path) = &args.config {
        let content = read_config_content(cfg_path)?;
        Some(parse_decrypt_config(&content)?)
    } else {
        None
    };

    let input_path = args
        .input
        .or_else(|| file_cfg.as_ref().and_then(|c| c.input.clone()))
        .ok_or_else(|| {
            "Missing input container path. Provide positional <INPUT_PATH> or 'input' in --config."
        })?;

    if !input_path.exists() {
        eprintln!("{}: Container file does not exist: {:?}", "Error".red().bold(), input_path);
        std::process::exit(1);
    }

    let out_path = args
        .output
        .or_else(|| file_cfg.as_ref().and_then(|c| c.output.clone()))
        .unwrap_or_else(|| {
            let s = input_path.to_string_lossy().to_string();
            if s.ends_with(".denc") {
                PathBuf::from(&s[..s.len() - 5])
            } else {
                PathBuf::from(format!("{}.decrypted", s))
            }
        });

    let mut credentials = Vec::new();

    // From file config if present
    if let Some(cfg) = &file_cfg {
        if let Some(custs) = &cfg.custodians {
            for c in custs {
                let mut cred = CustodianCredential {
                    custodian_id: c.id,
                    passphrase: c.passphrase.clone(),
                    direct_share: None,
                    pqc_private_key_base64: c.pqc_private_key_base64.clone(),
                };

                if let Some(pqc_path) = &c.pqc_keyfile {
                    let content = std::fs::read_to_string(pqc_path)?;
                    if let Ok(pqc_file) = serde_json::from_str::<PlainPqcKeyFile>(&content) {
                        cred.pqc_private_key_base64 = Some(pqc_file.private_key_base64);
                    }
                }

                if let Some(kf_path) = &c.keyfile {
                    let content = std::fs::read_to_string(kf_path)?;
                    if let Ok(share) = serde_json::from_str::<SecretShare>(&content) {
                        cred.direct_share = Some(share);
                    } else if let Ok(pqc_file) = serde_json::from_str::<PlainPqcKeyFile>(&content) {
                        cred.pqc_private_key_base64 = Some(pqc_file.private_key_base64);
                    }
                }

                credentials.push(cred);
            }
        }
    }

    // CLI Passphrases
    for p in &args.passphrases {
        if let Some((id_str, pass)) = p.split_once(':') {
            if let Ok(id) = id_str.parse::<u8>() {
                credentials.push(CustodianCredential {
                    custodian_id: id,
                    passphrase: Some(pass.to_string()),
                    direct_share: None,
                    pqc_private_key_base64: None,
                });
            }
        }
    }

    // CLI Keyfiles (handles both .dkey and .pqc files)
    for f in &args.keyfiles {
        if let Some((id_str, path_str)) = f.split_once(':') {
            if let Ok(id) = id_str.parse::<u8>() {
                let content = std::fs::read_to_string(path_str)?;
                if let Ok(pqc_file) = serde_json::from_str::<PlainPqcKeyFile>(&content) {
                    credentials.push(CustodianCredential {
                        custodian_id: id,
                        passphrase: None,
                        direct_share: None,
                        pqc_private_key_base64: Some(pqc_file.private_key_base64),
                    });
                } else if let Ok(share) = serde_json::from_str::<SecretShare>(&content) {
                    credentials.push(CustodianCredential {
                        custodian_id: id,
                        passphrase: None,
                        direct_share: Some(share),
                        pqc_private_key_base64: None,
                    });
                }
            }
        }
    }

    // CLI PQC keys
    for q in &args.pqc_keys {
        if let Some((id_str, val)) = q.split_once(':') {
            if let Ok(id) = id_str.parse::<u8>() {
                let priv_b64 = if Path::new(val).exists() {
                    let content = std::fs::read_to_string(val)?;
                    if let Ok(pqc_file) = serde_json::from_str::<PlainPqcKeyFile>(&content) {
                        pqc_file.private_key_base64
                    } else {
                        content.trim().to_string()
                    }
                } else {
                    val.trim().to_string()
                };

                credentials.push(CustodianCredential {
                    custodian_id: id,
                    passphrase: None,
                    direct_share: None,
                    pqc_private_key_base64: Some(priv_b64),
                });
            }
        }
    }

    let is_json = args.json;
    let is_quiet = args.quiet || is_json;

    if !is_quiet {
        println!("{}", "═".repeat(60).green());
        println!(" {}", "DUALCRYPT ENTERPRISE DECRYPTOR".green().bold());
        println!("{}", "═".repeat(60).green());
        println!("  {:<18} {:?}", "Encrypted Container:".bright_white(), input_path);
        println!("  {:<18} {:?}", "Output Destination:".bright_white(), out_path);
    }

    let pb = if !is_quiet {
        let p = ProgressBar::new(100);
        p.set_style(
            ProgressStyle::default_bar()
                .template("{spinner:.green} [{elapsed_precise}] [{bar:40.green/emerald}] {bytes}/{total_bytes} ({eta}) {msg}")?
                .progress_chars("#>-"),
        );
        Some(p)
    } else {
        None
    };

    let pb_clone = pb.clone();
    let bytes_decrypted = decrypt_file(
        &input_path,
        &out_path,
        credentials,
        move |processed, total| {
            if let Some(p) = &pb_clone {
                if total > 0 {
                    p.set_length(total);
                    p.set_position(processed);
                    p.set_message("Verifying AEAD & Stream Decrypting");
                }
            }
        },
        None,
    )?;

    if let Some(p) = pb {
        p.finish_with_message("Integrity Verified & Payload Restored");
    }

    if is_json {
        let json_out = CliDecryptJsonOutput {
            status: "success".to_string(),
            operation: "decrypt".to_string(),
            input_path: input_path.to_string_lossy().to_string(),
            output_path: out_path.to_string_lossy().to_string(),
            bytes_decrypted,
        };
        println!("{}", serde_json::to_string_pretty(&json_out)?);
    } else if !is_quiet {
        println!("\n{}", "✔ Decryption Succeeded!".green().bold());
        println!("  Total Bytes Decrypted: {}", bytes_decrypted);
        println!("  Saved To: {:?}", out_path);
    }

    Ok(())
}

fn handle_inspect(args: InspectArgs) -> Result<(), Box<dyn std::error::Error>> {
    let inspection = inspect_container(&args.input)?;

    if args.json {
        println!("{}", serde_json::to_string_pretty(&inspection)?);
        return Ok(());
    }

    println!("{}", "═".repeat(60).cyan());
    println!(" {}", "CONTAINER METADATA INSPECTOR".cyan().bold());
    println!("{}", "═".repeat(60).cyan());
    println!("  {:<20} {:?}", "File Path:".bright_white(), args.input);
    println!("  {:<20} {}", "Format Version:".bright_white(), inspection.version);
    println!("  {:<20} {:?}", "Cipher Suite:".bright_white(), inspection.cipher_suite);
    println!(
        "  {:<20} {}-of-{} Custodians",
        "Threshold Quorum:".bright_white(),
        inspection.threshold_k,
        inspection.total_n
    );
    if let Some(sig) = &inspection.signature_block {
        let valid_str = if inspection.is_signature_valid == Some(true) {
            "✔ VALID (NIST FIPS 204 ML-DSA-65)".green().bold()
        } else {
            "✖ INVALID / TAMPERED".red().bold()
        };
        println!("  {:<20} {}", "Author Signature:".bright_white(), valid_str);
        println!("  {:<20} {}", "Author Identity:".bright_white(), sig.author_label.cyan());
    }

    if let Some(man) = &inspection.manifest {
        println!("\n{}", "  Governance & Compliance Manifest:".magenta().bold());
        let class_badge = match man.classification.to_uppercase().as_str() {
            "TOP_SECRET" | "TOP SECRET" => man.classification.red().bold(),
            "CONFIDENTIAL" => man.classification.yellow().bold(),
            "RESTRICTED" => man.classification.purple().bold(),
            _ => man.classification.blue().bold(),
        };
        println!("   • Classification : {}", class_badge);
        if let Some(p) = &man.purpose {
            println!("   • Purpose/Scope  : {}", p.bright_white());
        }
        if let Some(org) = &man.organization {
            println!("   • Organization   : {}", org.cyan());
        }
    }

    println!("\n{}", "  Custodian Roster:".yellow().bold());
    for c in &inspection.custodians {
        let auth_str = match c.auth_type {
            AuthType::Passphrase => "Passphrase (Embedded)".green(),
            AuthType::KeyFile => "Key File / Token (.dkey)".cyan(),
            AuthType::OtpChallenge => "OTP Challenge".purple(),
            AuthType::PostQuantum => "Post-Quantum (ML-KEM-768)".magenta(),
        };
        let timelock_str = if let Some(t) = c.timelock_not_before_utc {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            if now < t {
                format!(" | ⏳ Time-Locked (UTC {})", t).yellow().to_string()
            } else {
                " | ✓ Timelock Expired (Active)".green().to_string()
            }
        } else {
            String::new()
        };
        println!(
            "   • [P{}] {:<22} | Auth: {}{}",
            c.custodian_id,
            c.label.bold(),
            auth_str,
            timelock_str
        );
    }
    println!("{}", "═".repeat(60).cyan());

    Ok(())
}

fn handle_pqc_keygen(args: PqcKeygenArgs) -> Result<(), Box<dyn std::error::Error>> {
    let algo = args.algorithm.to_lowercase();
    let is_dsa = algo.contains("dsa") || algo.contains("signature");

    let (alg_name, key_type, pub_b64, priv_b64) = if is_dsa {
        let kp = generate_ml_dsa_keypair()?;
        (
            "NIST-FIPS-204-ML-DSA-65".to_string(),
            "signing".to_string(),
            kp.public_key_base64.clone(),
            kp.private_key_base64.clone(),
        )
    } else {
        let kp = generate_ml_kem_keypair()?;
        (
            "NIST-FIPS-203-ML-KEM-768".to_string(),
            "kem".to_string(),
            kp.public_key_base64.clone(),
            kp.private_key_base64.clone(),
        )
    };

    if let Some(out_path) = &args.output {
        let json = serde_json::json!({
            "algorithm": alg_name,
            "key_type": key_type,
            "public_key_base64": pub_b64,
            "private_key_base64": priv_b64,
        });
        std::fs::write(out_path, serde_json::to_string_pretty(&json)?)?;
    }

    if args.json {
        let json_out = CliPqcKeygenJsonOutput {
            status: "success".to_string(),
            algorithm: alg_name,
            key_type,
            public_key_base64: pub_b64,
            private_key_base64: priv_b64,
        };
        println!("{}", serde_json::to_string_pretty(&json_out)?);
    } else {
        println!("{}", "═".repeat(60).magenta());
        println!(" {}", format!("POST-QUANTUM KEYGEN ({})", alg_name).magenta().bold());
        println!("{}", "═".repeat(60).magenta());
        println!("  {:<18} {}", "Algorithm:".bright_white(), alg_name);
        println!("  {:<18} {}", "Key Type:".bright_white(), key_type);
        println!("  {:<18} {}", "Public Key (B64):".bright_white(), pub_b64);
        println!("  {:<18} {}", "Private Key (B64):".bright_white(), "[PROTECTED / ZEROIZED ON PRINT]");
        if let Some(out) = &args.output {
            println!("  {:<18} {:?}", "Saved To:".bright_white(), out);
        }
    }

    Ok(())
}

fn handle_sss_keygen(args: SssKeygenArgs) -> Result<(), Box<dyn std::error::Error>> {
    use denc_core::sss::split_secret;
    use rand::RngCore;

    let mut secret_bytes = [0u8; 32];
    if let Some(s) = args.secret {
        let b = s.as_bytes();
        let len = b.len().min(32);
        secret_bytes[..len].copy_from_slice(&b[..len]);
    } else {
        rand::rngs::OsRng.fill_bytes(&mut secret_bytes);
    }

    let shares = split_secret(&secret_bytes, args.threshold, args.total)?;

    if args.json {
        println!("{}", serde_json::to_string_pretty(&shares)?);
    } else {
        println!("{}", "═".repeat(60).yellow());
        println!(" {}", "SHAMIR SECRET SHARING KEYGEN".yellow().bold());
        println!("{}", "═".repeat(60).yellow());
        println!("  Threshold Policy: {}-of-{} required\n", args.threshold, args.total);

        for share in shares {
            println!("── Custodian Share #{} ──", share.id);
            println!("{}", serde_json::to_string_pretty(&share)?);
            println!();
        }
    }

    Ok(())
}

async fn handle_serve(host: String, port: u16) -> Result<(), Box<dyn std::error::Error>> {
    use axum::http::StatusCode;
    use axum::response::Html;
    use axum::routing::get;
    use axum::Router;

    println!("{}", "═".repeat(60).cyan());
    println!(" {}", "DUALCRYPT EMBEDDED WEB SERVER".cyan().bold());
    println!("{}", "═".repeat(60).cyan());

    let is_public = host == "0.0.0.0";
    if is_public {
        println!("  {}: Bound to 0.0.0.0 (Accessible across Local LAN)", "Notice".yellow().bold());
    } else {
        println!("  {}: Bound to 127.0.0.1 (Localhost Only)", "Security".green().bold());
    }

    let app = Router::new()
        .route("/", get(|| async {
            Html(r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DualCrypt Enterprise Web</title>
  <style>
    body { background: #070a12; color: #f1f5f9; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #0f172a; border: 1px solid #334155; padding: 2rem; border-radius: 1rem; max-width: 500px; text-align: center; box-shadow: 0 0 30px rgba(6,182,212,0.2); }
    h1 { color: #38bdf8; margin-top: 0; font-size: 1.5rem; }
    p { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; }
    .badge { background: #064e3b; color: #34d399; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: bold; border: 1px solid #059669; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">SERVER ACTIVE</span>
    <h1>🛡️ DualCrypt Enterprise Web</h1>
    <p>Zero-Trust Threshold Cryptography & Disaster Recovery Platform.</p>
    <p>WebAssembly (Wasm) cryptographic engine active.</p>
  </div>
</body>
</html>"#)
        }))
        .route("/api/health", get(|| async { (StatusCode::OK, "{\"status\":\"healthy\",\"server\":\"DualCrypt-Embedded-v2\"}") }));

    let addr: SocketAddr = format!("{}:{}", host, port).parse()?;
    println!("  {:<18} http://localhost:{}", "Web Address:".bright_white(), port);
    if is_public {
        println!("  {:<18} http://0.0.0.0:{}", "LAN Address:".bright_white(), port);
    }
    println!("\n  Press {} to terminate web server.\n", "Ctrl+C".bright_red().bold());

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
