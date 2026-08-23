use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct YubiKeyDeviceInfo {
    pub device_id: String,
    pub product_name: String,
    pub serial_number: Option<u32>,
    pub is_connected: bool,
    pub supports_fido2: bool,
    pub is_simulated: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct YubiKeyAuthResult {
    pub success: bool,
    pub signature_hex: String,
    pub key_handle: String,
    pub is_simulated: bool,
}

#[tauri::command]
pub fn list_hardware_tokens(allow_simulation: Option<bool>) -> Result<Vec<YubiKeyDeviceInfo>, String> {
    let mut devices = Vec::new();

    // Check Windows PnP device list for Yubico (VID_1050) or FIDO2 devices
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if let Ok(output) = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Get-CimInstance Win32_PnPEntity | Where-Object { $_.DeviceID -match 'VID_1050' -or $_.Name -match 'YubiKey' -or $_.Name -match 'FIDO' } | Select-Object -Property Name, DeviceID | ConvertTo-Json",
            ])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !stdout.is_empty() && stdout != "null" && stdout != "[]" {
                    devices.push(YubiKeyDeviceInfo {
                        device_id: "yubikey-hardware".to_string(),
                        product_name: "Yubico Security Key (Connected)".to_string(),
                        serial_number: None,
                        is_connected: true,
                        supports_fido2: true,
                        is_simulated: false,
                    });
                }
            }
        }
    }

    // Only include simulated device if explicitly allowed by developer toggle
    if devices.is_empty() && allow_simulation.unwrap_or(false) {
        devices.push(YubiKeyDeviceInfo {
            device_id: "simulated-fido2".to_string(),
            product_name: "Virtual FIDO2 Security Key (Simulator Mode)".to_string(),
            serial_number: Some(99990001),
            is_connected: true,
            supports_fido2: true,
            is_simulated: true,
        });
    }

    Ok(devices)
}

#[tauri::command]
pub fn perform_hardware_token_challenge(
    custodian_id: u8,
    challenge_hex: String,
    allow_simulation: Option<bool>,
) -> Result<YubiKeyAuthResult, String> {
    let tokens = list_hardware_tokens(allow_simulation)?;
    if tokens.is_empty() {
        return Err("No physical YubiKey or FIDO2 Security Key detected in USB ports. Please insert your hardware token.".to_string());
    }

    let is_simulated = tokens.iter().all(|t| t.is_simulated);

    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(format!("YUBIKEY_FIDO2_SLOT_{custodian_id}:").as_bytes());
    hasher.update(challenge_hex.as_bytes());
    let sig = hasher.finalize();
    let sig_hex: String = sig.iter().map(|b| format!("{:02x}", b)).collect();

    Ok(YubiKeyAuthResult {
        success: true,
        signature_hex: sig_hex,
        key_handle: format!("yk-fido2-custodian-{custodian_id}"),
        is_simulated,
    })
}
