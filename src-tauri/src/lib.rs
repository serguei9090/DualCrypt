pub mod commands;
pub mod state;

use commands::decrypt::{cancel_active_job, start_decryption};
use commands::encrypt::start_encryption;
use commands::inspect::inspect_denc_file;
use commands::shares::{parse_keyfile, save_all_keyfiles_zip, save_keyfile};
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            inspect_denc_file,
            start_encryption,
            start_decryption,
            cancel_active_job,
            save_keyfile,
            save_all_keyfiles_zip,
            parse_keyfile
        ])
        .run(tauri::generate_context!())
        .expect("error while running DualCrypt Enterprise application");
}
