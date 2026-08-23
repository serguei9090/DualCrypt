use crate::state::AppState;
use denc_core::cipher::CipherSuite;
use denc_core::container::AuthType;
use denc_core::{encrypt_file, CustodianInput, EncryptionParams, ExportedKeyShare};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::ipc::Channel;

#[derive(Debug, Serialize, Clone)]
pub struct ProgressPayload {
    pub job_id: String,
    pub bytes_processed: u64,
    pub total_bytes: u64,
    pub percentage: f32,
    pub throughput_bytes_per_sec: u64,
    pub eta_seconds: u32,
    pub phase: String,
}

#[derive(Debug, Deserialize)]
pub struct EncryptCustodianPayload {
    pub custodian_id: u8,
    pub label: String,
    pub auth_type: String, // "passphrase" | "keyfile" | "otp" | "postquantum"
    pub passphrase: Option<String>,
    pub public_key_base64: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StartEncryptRequest {
    pub input_path: String,
    pub output_path: String,
    pub cipher: String, // "aes-256-gcm" | "xchacha20-poly1305"
    pub threshold_k: u8,
    pub total_n: u8,
    pub custodians: Vec<EncryptCustodianPayload>,
}

#[derive(Debug, Serialize)]
pub struct EncryptResponse {
    pub job_id: String,
    pub bytes_encrypted: u64,
    pub exported_shares: Vec<ExportedKeyShare>,
}

#[tauri::command]
pub async fn start_encryption(
    request: StartEncryptRequest,
    on_progress: Channel<ProgressPayload>,
    state: tauri::State<'_, AppState>,
) -> Result<EncryptResponse, String> {
    let job_id = uuid::Uuid::new_v4().to_string();
    let cancel_token = tokio_util::sync::CancellationToken::new();
    state.register_job(&job_id, cancel_token.clone()).await;

    let cipher = match request.cipher.to_lowercase().as_str() {
        "xchacha20-poly1305" => CipherSuite::XChaCha20Poly1305,
        _ => CipherSuite::Aes256Gcm,
    };

    let mut custodians = Vec::new();
    for c in request.custodians {
        let auth_type = match c.auth_type.to_lowercase().as_str() {
            "keyfile" => AuthType::KeyFile,
            "otp" => AuthType::OtpChallenge,
            "postquantum" | "pqc" => AuthType::PostQuantum,
            _ => AuthType::Passphrase,
        };
        custodians.push(CustodianInput {
            custodian_id: c.custodian_id,
            label: c.label,
            auth_type,
            passphrase: c.passphrase,
            public_key_base64: c.public_key_base64,
        });
    }

    let params = EncryptionParams {
        cipher,
        threshold_k: request.threshold_k,
        total_n: request.total_n,
        chunk_size: None,
        custodians,
    };

    let input_path = request.input_path.clone();
    let output_path = request.output_path.clone();
    let job_id_clone = job_id.clone();

    let cancel_flag = Arc::new(AtomicBool::new(false));
    let cancel_flag_watcher = cancel_flag.clone();

    tokio::spawn(async move {
        cancel_token.cancelled().await;
        cancel_flag_watcher.store(true, Ordering::Relaxed);
    });

    let result = tokio::task::spawn_blocking(move || {
        let start_time = Instant::now();
        let mut last_emit = Instant::now();

        let progress_cb = |processed: u64, total: u64| {
            if last_emit.elapsed().as_millis() > 50 || processed == total {
                last_emit = Instant::now();
                let elapsed_secs = start_time.elapsed().as_secs_f64().max(0.001);
                let throughput = (processed as f64 / elapsed_secs) as u64;
                let percentage = if total > 0 {
                    (processed as f32 / total as f32) * 100.0
                } else {
                    100.0
                };
                let remaining_bytes = total.saturating_sub(processed);
                let eta_seconds = if throughput > 0 {
                    (remaining_bytes / throughput) as u32
                } else {
                    0
                };

                let _ = on_progress.send(ProgressPayload {
                    job_id: job_id_clone.clone(),
                    bytes_processed: processed,
                    total_bytes: total,
                    percentage,
                    throughput_bytes_per_sec: throughput,
                    eta_seconds,
                    phase: if processed == total {
                        "Finalizing Authenticated Container".to_string()
                    } else {
                        "Streaming AEAD Cipher".to_string()
                    },
                });
            }
        };

        encrypt_file(
            &input_path,
            &output_path,
            params,
            progress_cb,
            Some(cancel_flag),
        )
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    state.finish_job(&job_id).await;

    Ok(EncryptResponse {
        job_id,
        bytes_encrypted: result.bytes_encrypted,
        exported_shares: result.exported_shares,
    })
}
