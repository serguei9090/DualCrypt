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
