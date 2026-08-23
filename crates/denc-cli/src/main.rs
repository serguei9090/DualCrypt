use clap::{Parser, Subcommand};
use colored::*;
use denc_core::cipher::CipherSuite;
use denc_core::container::AuthType;
use denc_core::sss::SecretShare;
use denc_core::{
    decrypt_file, encrypt_file, inspect_container, CustodianCredential, CustodianInput,
    EncryptionParams,
};
use indicatif::{ProgressBar, ProgressStyle};
use std::net::SocketAddr;
use std::path::PathBuf;

#[derive(Parser)]
#[command(
    name = "denc",
    author = "DualCrypt Enterprise Security",
    version = "2.0.0",
    about = "Zero-Trust Multi-Party Threshold File Encryption & Web Server",
    long_about = "DualCrypt Enterprise CLI - High-assurance threshold file encryption, container inspection, key generation, and local web serving."
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Encrypt a file or whole directory into an authenticated .denc container
    Encrypt {
        /// Input file or directory to encrypt
        #[arg(required = true)]
        input: PathBuf,

        /// Output .denc container path
        #[arg(short, long)]
        output: Option<PathBuf>,

        /// Required threshold (k) of custodians needed to decrypt
        #[arg(short = 'k', long, default_value_t = 2)]
        threshold: u8,

        /// Total number (n) of custodian shares to generate
        #[arg(short = 'n', long, default_value_t = 2)]
        total: u8,

        /// Cipher suite: 'aes-256-gcm' (default) or 'xchacha20-poly1305'
        #[arg(long, default_value = "aes-256-gcm")]
        cipher: String,

        /// Custodian passphrases in format 'id:passphrase' (e.g. -p 1:SecretPass1 -p 2:SecretPass2)
        #[arg(short = 'p', long = "passphrase")]
        passphrases: Vec<String>,

        /// Output directory to save exported .dkey share files
        #[arg(long = "key-dir")]
        key_dir: Option<PathBuf>,
    },

    /// Decrypt an authenticated .denc container with threshold credentials
    Decrypt {
        /// Path to .denc container
        #[arg(required = true)]
        input: PathBuf,

        /// Destination output file or directory
        #[arg(short, long)]
        output: Option<PathBuf>,

        /// Custodian passphrase in format 'id:passphrase' (e.g. -p 1:SecretPass1)
        #[arg(short = 'p', long = "passphrase")]
        passphrases: Vec<String>,

        /// Custodian .dkey key file in format 'id:path/to/key.dkey' (e.g. -f 2:custodian_2.dkey)
        #[arg(short = 'f', long = "keyfile")]
        keyfiles: Vec<String>,
    },

    /// Inspect a .denc container header and display custodian descriptors
    Inspect {
        /// Path to .denc container
        #[arg(required = true)]
        input: PathBuf,

        /// Output metadata in raw JSON format
        #[arg(long)]
        json: bool,
    },

    /// Generate standalone Shamir secret shares for testing or manual key distribution
    Keygen {
        /// Secret string or key to split
        #[arg(short, long)]
        secret: Option<String>,

        /// Threshold (k) required to reconstruct
        #[arg(short = 'k', long, default_value_t = 2)]
        threshold: u8,

        /// Total shares (n) to produce
        #[arg(short = 'n', long, default_value_t = 3)]
        total: u8,
    },

    /// Launch the embedded local Web UI server
    Serve {
        /// Network interface to bind: '127.0.0.1' (localhost only) or '0.0.0.0' (public/LAN)
        #[arg(short = 'H', long, default_value = "127.0.0.1")]
        host: String,

        /// Port number to listen on
        #[arg(short, long, default_value_t = 8080)]
        port: u16,
    },
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Encrypt {
            input,
            output,
            threshold,
            total,
            cipher,
            passphrases,
            key_dir,
        } => {
            handle_encrypt(input, output, threshold, total, cipher, passphrases, key_dir).await?;
        }
        Commands::Decrypt {
            input,
            output,
            passphrases,
            keyfiles,
        } => {
            handle_decrypt(input, output, passphrases, keyfiles).await?;
        }
        Commands::Inspect { input, json } => {
            handle_inspect(input, json)?;
        }
        Commands::Keygen {
            secret,
            threshold,
            total,
        } => {
            handle_keygen(secret, threshold, total)?;
        }
        Commands::Serve { host, port } => {
            handle_serve(host, port).await?;
        }
    }

    Ok(())
}

async fn handle_encrypt(
    input: PathBuf,
    output: Option<PathBuf>,
    threshold_k: u8,
    total_n: u8,
    cipher_name: String,
    passphrases: Vec<String>,
    key_dir: Option<PathBuf>,
) -> Result<(), Box<dyn std::error::Error>> {
    if !input.exists() {
        eprintln!("{}: Input path does not exist: {:?}", "Error".red().bold(), input);
        std::process::exit(1);
    }

    let out_path = output.unwrap_or_else(|| {
        let mut p = input.clone();
        let name = format!("{}.denc", p.file_name().unwrap().to_string_lossy());
        p.set_file_name(name);
        p
    });

    let cipher_suite = match cipher_name.to_lowercase().as_str() {
        "xchacha20-poly1305" | "xchacha" => CipherSuite::XChaCha20Poly1305,
        _ => CipherSuite::Aes256Gcm,
    };

    println!("{}", "═".repeat(60).cyan());
    println!(" {}", "DUALCRYPT ENTERPRISE ENCRYPTOR".cyan().bold());
    println!("{}", "═".repeat(60).cyan());
    println!("  {:<18} {:?}", "Source Payload:".bright_white(), input);
    println!("  {:<18} {:?}", "Encrypted Container:".bright_white(), out_path);
    println!("  {:<18} {:?}", "Cipher Suite:".bright_white(), cipher_suite);
    println!("  {:<18} {}-of-{} Custodians", "Quorum Policy:".bright_white(), threshold_k, total_n);

    // Build custodian inputs
    let mut pass_map = std::collections::HashMap::new();
    for p in passphrases {
        if let Some((id_str, pass)) = p.split_once(':') {
            if let Ok(id) = id_str.parse::<u8>() {
                pass_map.insert(id, pass.to_string());
            }
        }
    }

    let mut custodians = Vec::new();
    for i in 1..=total_n {
        let pass = pass_map.get(&i).cloned();
        let auth_type = if pass.is_some() {
            AuthType::Passphrase
        } else {
            AuthType::KeyFile
        };

        custodians.push(CustodianInput {
            custodian_id: i,
            label: format!("Custodian {}", i),
            auth_type,
            passphrase: pass,
            public_key_base64: None,
        });
    }

    let params = EncryptionParams {
        cipher: cipher_suite,
        threshold_k,
        total_n,
        chunk_size: None,
        custodians,
    };

    let pb = ProgressBar::new(100);
    pb.set_style(
        ProgressStyle::default_bar()
            .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({eta}) {msg}")?
            .progress_chars("#>-"),
    );

    let pb_clone = pb.clone();
    let res = encrypt_file(
        &input,
        &out_path,
        params,
        move |processed, total| {
            if total > 0 {
                pb_clone.set_length(total);
                pb_clone.set_position(processed);
                pb_clone.set_message("Streaming AEAD");
            }
        },
        None,
    )?;

    pb.finish_with_message("Container Finalized & Authenticated");

    println!("\n{}", "✔ Encryption Succeeded!".green().bold());
    println!("  Total Bytes Encrypted: {}", res.bytes_encrypted);

    // Export any key shares if produced
    if !res.exported_shares.is_empty() {
        println!("\n{}", "🔑 Exported Custodian Key Shares:".yellow().bold());
        let target_key_dir = key_dir.unwrap_or_else(|| PathBuf::from("."));
        std::fs::create_dir_all(&target_key_dir)?;

        for s in &res.exported_shares {
            let key_filename = format!("custodian_{}.dkey", s.custodian_id);
            let key_path = target_key_dir.join(&key_filename);
            let json = serde_json::to_string_pretty(&s.share)?;
            std::fs::write(&key_path, json)?;
            println!("  ✔ Saved Share P{} -> {:?}", s.custodian_id, key_path);
        }
    }

    Ok(())
}

async fn handle_decrypt(
    input: PathBuf,
    output: Option<PathBuf>,
    passphrases: Vec<String>,
    keyfiles: Vec<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    if !input.exists() {
        eprintln!("{}: Container file does not exist: {:?}", "Error".red().bold(), input);
        std::process::exit(1);
    }

    let out_path = output.unwrap_or_else(|| {
        let s = input.to_string_lossy().to_string();
        if s.ends_with(".denc") {
            PathBuf::from(&s[..s.len() - 5])
        } else {
            PathBuf::from(format!("{}.decrypted", s))
        }
    });

    println!("{}", "═".repeat(60).green());
    println!(" {}", "DUALCRYPT ENTERPRISE DECRYPTOR".green().bold());
    println!("{}", "═".repeat(60).green());
    println!("  {:<18} {:?}", "Encrypted Container:".bright_white(), input);
    println!("  {:<18} {:?}", "Output Destination:".bright_white(), out_path);

    let mut credentials = Vec::new();

    for p in passphrases {
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

    for f in keyfiles {
        if let Some((id_str, path_str)) = f.split_once(':') {
            if let Ok(id) = id_str.parse::<u8>() {
                let content = std::fs::read_to_string(path_str)?;
                let share: SecretShare = serde_json::from_str(&content)?;
                credentials.push(CustodianCredential {
                    custodian_id: id,
                    passphrase: None,
                    direct_share: Some(share),
                    pqc_private_key_base64: None,
                });
            }
        }
    }

    let pb = ProgressBar::new(100);
    pb.set_style(
        ProgressStyle::default_bar()
            .template("{spinner:.green} [{elapsed_precise}] [{bar:40.green/emerald}] {bytes}/{total_bytes} ({eta}) {msg}")?
            .progress_chars("#>-"),
    );

    let pb_clone = pb.clone();
    let bytes_decrypted = decrypt_file(
        &input,
        &out_path,
        credentials,
        move |processed, total| {
            if total > 0 {
                pb_clone.set_length(total);
                pb_clone.set_position(processed);
                pb_clone.set_message("Verifying AEAD & Stream Decrypting");
            }
        },
        None,
    )?;

    pb.finish_with_message("Integrity Verified & Payload Restored");
    println!("\n{}", "✔ Decryption Succeeded!".green().bold());
    println!("  Total Bytes Decrypted: {}", bytes_decrypted);
    println!("  Saved To: {:?}", out_path);

    Ok(())
}

fn handle_inspect(input: PathBuf, json: bool) -> Result<(), Box<dyn std::error::Error>> {
    let inspection = inspect_container(&input)?;

    if json {
        println!("{}", serde_json::to_string_pretty(&inspection)?);
        return Ok(());
    }

    println!("{}", "═".repeat(60).cyan());
    println!(" {}", "CONTAINER METADATA INSPECTOR".cyan().bold());
    println!("{}", "═".repeat(60).cyan());
    println!("  {:<20} {:?}", "File Path:".bright_white(), input);
    println!("  {:<20} {}", "Format Version:".bright_white(), inspection.version);
    println!("  {:<20} {:?}", "Cipher Suite:".bright_white(), inspection.cipher_suite);
    println!(
        "  {:<20} {}-of-{} Custodians",
        "Threshold Quorum:".bright_white(),
        inspection.threshold_k,
        inspection.total_n
    );
    println!("  {:<20} {} KiB", "Streaming Chunk:".bright_white(), inspection.chunk_size / 1024);

    println!("\n{}", "  Custodian Roster:".yellow().bold());
    for c in &inspection.custodians {
        let auth_str = match c.auth_type {
            AuthType::Passphrase => "Passphrase (Embedded)".green(),
            AuthType::KeyFile => "Key File / Token (.dkey)".cyan(),
            AuthType::OtpChallenge => "OTP Challenge".purple(),
            AuthType::PostQuantum => "Post-Quantum (ML-KEM-768)".magenta(),
        };
        println!(
            "   • [P{}] {:<22} | Auth: {}",
            c.custodian_id,
            c.label.bold(),
            auth_str
        );
    }
    println!("{}", "═".repeat(60).cyan());

    Ok(())
}

fn handle_keygen(
    secret_str: Option<String>,
    k: u8,
    n: u8,
) -> Result<(), Box<dyn std::error::Error>> {
    use denc_core::sss::split_secret;
    use rand::RngCore;

    let mut secret_bytes = [0u8; 32];
    if let Some(s) = secret_str {
        let b = s.as_bytes();
        let len = b.len().min(32);
        secret_bytes[..len].copy_from_slice(&b[..len]);
    } else {
        rand::rngs::OsRng.fill_bytes(&mut secret_bytes);
    }

    let shares = split_secret(&secret_bytes, k, n)?;

    println!("{}", "═".repeat(60).yellow());
    println!(" {}", "SHAMIR SECRET SHARING KEYGEN".yellow().bold());
    println!("{}", "═".repeat(60).yellow());
    println!("  Threshold Policy: {}-of-{} required\n", k, n);

    for share in shares {
        println!("── Custodian Share #{} ──", share.id);
        println!("{}", serde_json::to_string_pretty(&share)?);
        println!();
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
