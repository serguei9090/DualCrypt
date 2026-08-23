use lettre::message::header::ContentType;
use lettre::message::{Attachment, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: Option<String>,
    pub security: String, // "tls" | "starttls" | "none"
    pub from_email: String,
    pub from_name: String,
}

#[derive(Debug, Deserialize)]
pub struct SendCustodianEmailRequest {
    pub config: SmtpConfig,
    pub recipient_email: String,
    pub custodian_label: String,
    pub share_filename: String,
    pub share_content: String,
    pub is_pin_protected: bool,
    pub pin_code: Option<String>,
    pub custom_note: Option<String>,
}

fn get_config_path() -> PathBuf {
    let base_dir = std::env::var("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            std::env::var("USERPROFILE")
                .map(PathBuf::from)
                .unwrap_or_else(|_| PathBuf::from("."))
        });
    let mut path = base_dir.join("DualCrypt");
    let _ = fs::create_dir_all(&path);
    path.push("smtp_config.json");
    path
}

#[tauri::command]
pub async fn save_smtp_config(config: SmtpConfig) -> Result<(), String> {
    let path = get_config_path();
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Serialization error: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("Failed to save SMTP config: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn load_smtp_config() -> Result<Option<SmtpConfig>, String> {
    let path = get_config_path();
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read SMTP config: {e}"))?;
    let config: SmtpConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse SMTP config: {e}"))?;
    Ok(Some(config))
}

fn build_smtp_transport(config: &SmtpConfig) -> Result<AsyncSmtpTransport<Tokio1Executor>, String> {
    let builder = match config.security.to_lowercase().as_str() {
        "starttls" => AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&config.host)
            .map_err(|e| format!("SMTP STARTTLS Relay error: {e}"))?,
        "tls" => AsyncSmtpTransport::<Tokio1Executor>::relay(&config.host)
            .map_err(|e| format!("SMTP TLS Relay error: {e}"))?,
        _ => AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&config.host),
    };

    let mut transport = builder.port(config.port);

    if let (Some(password), user) = (&config.password, &config.username) {
        if !user.trim().is_empty() && !password.trim().is_empty() {
            transport = transport.credentials(Credentials::new(user.clone(), password.clone()));
        }
    }

    Ok(transport.build())
}

#[tauri::command]
pub async fn test_smtp_connection(config: SmtpConfig, test_recipient: String) -> Result<String, String> {
    let transport = build_smtp_transport(&config)?;

    let from_header = format!("{} <{}>", config.from_name, config.from_email);
    let email = Message::builder()
        .from(from_header.parse().map_err(|e| format!("Invalid 'from' email format: {e}"))?)
        .to(test_recipient.parse().map_err(|e| format!("Invalid test recipient format: {e}"))?)
        .subject("DualCrypt Enterprise - SMTP Connection Test")
        .header(ContentType::TEXT_PLAIN)
        .body(
            "Greetings from DualCrypt Enterprise.\n\n\
            This is an automated verification email confirming that your SMTP server parameters are correctly configured for secure custodian key dispatch.\n\n\
            Zero-Trust Threshold Cryptography Platform."
                .to_string(),
        )
        .map_err(|e| format!("Message building error: {e}"))?;

    transport
        .send(email)
        .await
        .map_err(|e| format!("SMTP Send failed: {e}"))?;

    Ok("SMTP Connection Verified and Test Email Delivered Successfully!".to_string())
}

#[tauri::command]
pub async fn send_custodian_key_email(request: SendCustodianEmailRequest) -> Result<String, String> {
    let transport = build_smtp_transport(&request.config)?;

    let from_header = format!("{} <{}>", request.config.from_name, request.config.from_email);
    
    let pin_instructions = if request.is_pin_protected {
        if let Some(ref pin) = request.pin_code {
            format!("\n🔐 PIN PROTECTION ACTIVE:\nYour key share file is encrypted. Your decryption PIN is: {}\nPlease store this PIN separately from the attached file.\n", pin)
        } else {
            "\n🔐 PIN PROTECTION ACTIVE:\nYour key share file is encrypted with a secret PIN. You will need this PIN when unlocking files.\n".to_string()
        }
    } else {
        "\n⚠️ Note: This key share file is unencrypted. Store it securely on an encrypted partition or offline token.\n".to_string()
    };

    let custom_note_section = if let Some(ref note) = request.custom_note {
        if !note.trim().is_empty() {
            format!("\nAdmin Note: {}\n", note)
        } else {
            "".to_string()
        }
    } else {
        "".to_string()
    };

    let body_text = format!(
        "Hello {},\n\n\
        You have been designated as an authorized cryptographic custodian in DualCrypt Enterprise.\n\n\
        Attached to this email is your cryptographic key share ({}) required for multi-party file reconstruction.\n\
        {}{}\n\
        INSTRUCTIONS FOR DECRYPTION:\n\
        1. Download and save the attached .dkey file.\n\
        2. Open DualCrypt Enterprise and switch to the 'Quorum Unlock & Decrypt' tab.\n\
        3. Provide this .dkey file to fulfill your custodian authorization requirement.\n\n\
        DualCrypt Zero-Trust Governance Team",
        request.custodian_label,
        request.share_filename,
        pin_instructions,
        custom_note_section
    );

    let text_part = SinglePart::plain(body_text);
    let attachment_part = Attachment::new(request.share_filename)
        .body(request.share_content, ContentType::parse("application/json").unwrap());

    let multipart = MultiPart::mixed()
        .singlepart(text_part)
        .singlepart(attachment_part);

    let email = Message::builder()
        .from(from_header.parse().map_err(|e| format!("Invalid sender format: {e}"))?)
        .to(request.recipient_email.parse().map_err(|e| format!("Invalid recipient format: {e}"))?)
        .subject(format!("DualCrypt Custodian Key Share: {}", request.custodian_label))
        .multipart(multipart)
        .map_err(|e| format!("Message building error: {e}"))?;

    transport
        .send(email)
        .await
        .map_err(|e| format!("Failed to send custodian email: {e}"))?;

    Ok(format!("Key share successfully emailed to {}", request.recipient_email))
}
