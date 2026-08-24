pub mod commands;
pub mod state;

use commands::app::get_cli_launch_file;
use commands::decrypt::{cancel_active_job, start_decryption};
use commands::email::{
    load_smtp_config, save_smtp_config, send_custodian_key_email, test_smtp_connection,
};
use commands::encrypt::start_encryption;
use commands::inspect::inspect_denc_file;
use commands::server::{
    get_local_web_server_status, start_local_web_server, stop_local_web_server,
};
use commands::shares::{
    generate_ml_dsa_keypair, generate_pqc_keypair, parse_keyfile, save_all_keyfiles_zip,
    save_keyfile,
};
use commands::yubikey::{list_hardware_tokens, perform_hardware_token_challenge};
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
            get_cli_launch_file,
            inspect_denc_file,
            start_encryption,
            start_decryption,
            cancel_active_job,
            save_keyfile,
            save_all_keyfiles_zip,
            parse_keyfile,
            generate_pqc_keypair,
            generate_ml_dsa_keypair,
            save_smtp_config,
            load_smtp_config,
            test_smtp_connection,
            send_custodian_key_email,
            list_hardware_tokens,
            perform_hardware_token_challenge,
            start_local_web_server,
            stop_local_web_server,
            get_local_web_server_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running DualCrypt Enterprise application");
}
