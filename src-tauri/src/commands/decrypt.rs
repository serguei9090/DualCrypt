use crate::state::AppState;
use denc_core::sss::SecretShare;
use denc_core::{decrypt_file, CustodianCredential};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::ipc::Channel;

#[derive(Debug, Serialize, Clone)]
pub struct DecryptProgressPayload {
    pub job_id: String,
    pub bytes_processed: u64,
    pub total_bytes: u64,
    pub percentage: f32,
    pub throughput_bytes_per_sec: u64,
    pub eta_seconds: u32,
    pub phase: String,
}

#[derive(Debug, Deserialize)]
pub struct DecryptCredentialPayload {
    pub custodian_id: u8,
    pub passphrase: Option<String>,
    pub share_data_json: Option<String>,
    pub pqc_private_key_base64: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StartDecryptRequest {
    pub input_path: String,
    pub output_path: String,
    pub credentials: Vec<DecryptCredentialPayload>,
}

#[derive(Debug, Serialize)]
pub struct DecryptResponse {
    pub job_id: String,
    pub bytes_decrypted: u64,
}

#[tauri::command]
pub async fn start_decryption(
    request: StartDecryptRequest,
    on_progress: Channel<DecryptProgressPayload>,
    state: tauri::State<'_, AppState>,
) -> Result<DecryptResponse, String> {
    let job_id = uuid::Uuid::new_v4().to_string();
    let cancel_token = tokio_util::sync::CancellationToken::new();
    state.register_job(&job_id, cancel_token.clone()).await;

    let mut credentials = Vec::new();
    for c in request.credentials {
        let direct_share = if let Some(json_str) = c.share_data_json {
            let share: SecretShare = serde_json::from_str(&json_str)
                .map_err(|e| format!("Invalid key share file format: {e}"))?;
            Some(share)
        } else {
            None
        };

        credentials.push(CustodianCredential {
            custodian_id: c.custodian_id,
            passphrase: c.passphrase,
            direct_share,
            pqc_private_key_base64: c.pqc_private_key_base64,
        });
    }

    let input_path = request.input_path.clone();
    let output_path = request.output_path.clone();
    let job_id_clone = job_id.clone();

    let cancel_flag = Arc::new(AtomicBool::new(false));
    let cancel_flag_watcher = cancel_flag.clone();

    tokio::spawn(async move {
        cancel_token.cancelled().await;
        cancel_flag_watcher.store(true, Ordering::Relaxed);
    });

    let bytes_decrypted = tokio::task::spawn_blocking(move || {
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

                let _ = on_progress.send(DecryptProgressPayload {
                    job_id: job_id_clone.clone(),
                    bytes_processed: processed,
                    total_bytes: total,
                    percentage,
                    throughput_bytes_per_sec: throughput,
                    eta_seconds,
                    phase: if processed == total {
                        "Verifying AEAD Authentication Tag".to_string()
                    } else {
                        "Streaming Decryption & Integrity Verification".to_string()
                    },
                });
            }
        };

        decrypt_file(
            &input_path,
            &output_path,
            credentials,
            progress_cb,
            Some(cancel_flag),
        )
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    state.finish_job(&job_id).await;

    Ok(DecryptResponse {
        job_id,
        bytes_decrypted,
    })
}

#[tauri::command]
pub async fn cancel_active_job(
    job_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.abort_job(&job_id).await
}
