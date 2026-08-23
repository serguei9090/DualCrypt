use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

#[derive(Default, Clone)]
pub struct AppState {
    jobs: Arc<Mutex<HashMap<String, CancellationToken>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            jobs: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn register_job(&self, job_id: &str, token: CancellationToken) {
        let mut map = self.jobs.lock().await;
        map.insert(job_id.to_string(), token);
    }

    pub async fn abort_job(&self, job_id: &str) -> Result<(), String> {
        let mut map = self.jobs.lock().await;
        if let Some(token) = map.remove(job_id) {
            token.cancel();
            Ok(())
        } else {
            Err(format!("Job with ID {job_id} not found"))
        }
    }

    pub async fn finish_job(&self, job_id: &str) {
        let mut map = self.jobs.lock().await;
        map.remove(job_id);
    }
}
