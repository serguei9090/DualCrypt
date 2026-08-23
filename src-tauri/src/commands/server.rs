use axum::http::StatusCode;
use axum::response::Html;
use axum::routing::get;
use axum::Router;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tokio::sync::oneshot;
use tower_http::cors::{Any, CorsLayer};

static IS_RUNNING: AtomicBool = AtomicBool::new(false);
static ACTIVE_HOST: Mutex<Option<String>> = Mutex::new(None);
static ACTIVE_PORT: Mutex<Option<u16>> = Mutex::new(None);
static SHUTDOWN_TX: Mutex<Option<oneshot::Sender<()>>> = Mutex::new(None);

#[derive(Debug, Serialize, Deserialize)]
pub struct WebServerStatus {
    pub is_running: bool,
    pub host: String,
    pub port: u16,
    pub url: String,
    pub is_public: bool,
}

#[tauri::command]
pub async fn start_local_web_server(host: String, port: u16) -> Result<WebServerStatus, String> {
    if IS_RUNNING.load(Ordering::SeqCst) {
        return Ok(get_local_web_server_status()?);
    }

    let addr_str = format!("{}:{}", host, port);
    let addr: SocketAddr = addr_str
        .parse()
        .map_err(|e| format!("Invalid IP/Host address: {}", e))?;

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("Failed to bind to {}: {}", addr_str, e))?;

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    {
        let mut tx_guard = SHUTDOWN_TX.lock().unwrap();
        *tx_guard = Some(shutdown_tx);

        let mut h_guard = ACTIVE_HOST.lock().unwrap();
        *h_guard = Some(host.clone());

        let mut p_guard = ACTIVE_PORT.lock().unwrap();
        *p_guard = Some(port);
    }

    IS_RUNNING.store(true, Ordering::SeqCst);

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route(
            "/",
            get(|| async {
                Html(r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DualCrypt Enterprise Web</title>
  <style>
    body { background: #070a12; color: #f1f5f9; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #0f172a; border: 1px solid #334155; padding: 2.5rem; border-radius: 1.25rem; max-width: 540px; text-align: center; box-shadow: 0 0 40px rgba(6,182,212,0.2); }
    h1 { color: #38bdf8; margin-top: 0.5rem; font-size: 1.6rem; font-weight: 800; }
    p { color: #94a3b8; font-size: 0.95rem; line-height: 1.6; }
    .badge { background: #064e3b; color: #34d399; padding: 0.35rem 0.85rem; border-radius: 9999px; font-size: 0.75rem; font-weight: bold; border: 1px solid #059669; display: inline-block; }
    .footer { font-size: 0.8rem; color: #64748b; margin-top: 1.5rem; border-top: 1px solid #1e293b; padding-top: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">● LOCAL ENGINE ONLINE</span>
    <h1>🛡️ DualCrypt Enterprise Web</h1>
    <p>Zero-Trust Threshold Cryptography & Disaster Key Escrow Service.</p>
    <p>Your local workstation is serving the DualCrypt zero-knowledge decryption and inspection interface.</p>
    <div class="footer">Zero-Knowledge Guarantee: Cryptographic keys never leave local RAM.</div>
  </div>
</body>
</html>"#)
            }),
        )
        .route(
            "/api/health",
            get(|| async {
                (
                    StatusCode::OK,
                    "{\"status\":\"healthy\",\"engine\":\"DualCrypt-Embedded-v2\"}",
                )
            }),
        )
        .layer(cors);

    tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                let _ = shutdown_rx.await;
            })
            .await
            .ok();

        IS_RUNNING.store(false, Ordering::SeqCst);
    });

    get_local_web_server_status()
}

#[tauri::command]
pub fn stop_local_web_server() -> Result<(), String> {
    if let Ok(mut tx_guard) = SHUTDOWN_TX.lock() {
        if let Some(tx) = tx_guard.take() {
            let _ = tx.send(());
        }
    }
    IS_RUNNING.store(false, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn get_local_web_server_status() -> Result<WebServerStatus, String> {
    let is_running = IS_RUNNING.load(Ordering::SeqCst);
    let host = ACTIVE_HOST
        .lock()
        .unwrap()
        .clone()
        .unwrap_or_else(|| "127.0.0.1".to_string());
    let port = ACTIVE_PORT.lock().unwrap().unwrap_or(8080);
    let is_public = host == "0.0.0.0";
    let url = if is_public {
        format!("http://localhost:{}", port)
    } else {
        format!("http://{}:{}", host, port)
    };

    Ok(WebServerStatus {
        is_running,
        host,
        port,
        url,
        is_public,
    })
}
