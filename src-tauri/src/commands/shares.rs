use denc_core::sss::SecretShare;
use denc_core::ExportedKeyShare;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

#[tauri::command]
pub fn save_keyfile(file_path: String, share: SecretShare) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&share).map_err(|e| e.to_string())?;
    
    if let Some(parent) = Path::new(&file_path).parent() {
        if !parent.as_os_str().is_empty() {
            let _ = std::fs::create_dir_all(parent);
        }
    }

    std::fs::write(&file_path, json).map_err(|e| format!("Failed to save key file to '{file_path}': {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn save_all_keyfiles_zip(
    file_path: String,
    shares: Vec<ExportedKeyShare>,
) -> Result<(), String> {
    if let Some(parent) = Path::new(&file_path).parent() {
        if !parent.as_os_str().is_empty() {
            let _ = std::fs::create_dir_all(parent);
        }
    }

    let file = File::create(&file_path)
        .map_err(|e| format!("Failed to create zip file at '{file_path}': {e}"))?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    for s in &shares {
        let sanitized_label: String = s
            .label
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
            .collect();
        let filename = format!("custodian_{}_{}.dkey", s.custodian_id, sanitized_label);

        zip.start_file(&filename, options)
            .map_err(|e| format!("Failed to add entry '{filename}' to zip: {e}"))?;

        let json = serde_json::to_string_pretty(&s.share)
            .map_err(|e| format!("Serialization error for {filename}: {e}"))?;

        zip.write_all(json.as_bytes())
            .map_err(|e| format!("Write error for {filename}: {e}"))?;
    }

    // Add a README text file inside the zip for enterprise custodians
    zip.start_file("README_CUSTODIAN_KEYS.txt", options)
        .map_err(|e| format!("Failed to add README to zip: {e}"))?;
    let readme_text = format!(
        "DualCrypt Enterprise Key Share Archive\n\
        ========================================\n\
        Total Key Shares in this archive: {}\n\n\
        INSTRUCTIONS:\n\
        - Distribute each .dkey file to its respective authorized custodian.\n\
        - Do NOT store all keys on the same workstation or unencrypted channel.\n\
        - To decrypt the file, the required quorum of custodians must provide their keys in DualCrypt Enterprise.\n",
        shares.len()
    );
    zip.write_all(readme_text.as_bytes())
        .map_err(|e| format!("Write error for README: {e}"))?;

    zip.finish()
        .map_err(|e| format!("Failed to finalize zip file: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn parse_keyfile(file_path: String) -> Result<SecretShare, String> {
    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read key file '{file_path}': {e}"))?;
    let share: SecretShare = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid key share file format in '{file_path}': {e}"))?;
    Ok(share)
}
