use std::env;
use std::path::Path;

/// Checks if DualCrypt was launched via Windows Explorer file association double-click
#[tauri::command]
pub fn get_cli_launch_file() -> Result<Option<String>, String> {
    let args: Vec<String> = env::args().collect();
    if args.len() > 1 {
        let candidate = &args[1];
        let p = Path::new(candidate);
        if p.exists() && p.is_file() {
            if let Some(ext) = p.extension() {
                let ext_lower = ext.to_string_lossy().to_lowercase();
                if ext_lower == "denc" || ext_lower == "dkey" || ext_lower == "pqc" {
                    return Ok(Some(candidate.clone()));
                }
            }
        }
    }
    Ok(None)
}

#[derive(Debug, serde::Serialize)]
pub struct CollisionCheckResult {
    pub exists: bool,
    pub is_dir: bool,
    pub suggested_path: String,
}

/// Checks if target path exists and computes next non-conflicting suggested path
#[tauri::command]
pub fn check_path_collision(target_path: String) -> Result<CollisionCheckResult, String> {
    let p = Path::new(&target_path);
    if !p.exists() {
        return Ok(CollisionCheckResult {
            exists: false,
            is_dir: false,
            suggested_path: target_path,
        });
    }

    let is_dir = p.is_dir();
    let parent = p.parent().unwrap_or_else(|| Path::new(""));
    let file_stem = p
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let extension = p
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();

    let mut counter = 1;
    loop {
        let candidate_name = if is_dir {
            format!("{file_stem} ({counter})")
        } else {
            format!("{file_stem} ({counter}){extension}")
        };
        let candidate_path = parent.join(&candidate_name);
        if !candidate_path.exists() {
            return Ok(CollisionCheckResult {
                exists: true,
                is_dir,
                suggested_path: candidate_path.to_string_lossy().to_string(),
            });
        }
        counter += 1;
    }
}
