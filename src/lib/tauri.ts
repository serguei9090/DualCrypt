import { Channel, invoke } from "@tauri-apps/api/core";
import type { ContainerHeaderInfo, ExportedShare } from "../types/container";
import type {
  DecryptResponse,
  EncryptResponse,
  ProgressPayload,
  StartDecryptRequest,
  StartEncryptRequest,
} from "../types/ipc";

export const isTauriEnvironment = (): boolean => {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
};

export async function inspectDencFile(filePath: string): Promise<ContainerHeaderInfo> {
  if (!isTauriEnvironment()) {
    // Web mock simulation
    return {
      version: 1,
      cipher: "AES-256-GCM",
      threshold_k: 2,
      total_n: 2,
      chunk_size: 65536,
      custodians: [
        {
          custodian_id: 1,
          label: "Party 1 (Primary Recipient)",
          auth_type: "passphrase",
          has_embedded_share: true,
        },
        {
          custodian_id: 2,
          label: "Party 2 (Security Custodian)",
          auth_type: "keyfile",
          has_embedded_share: false,
        },
      ],
    };
  }
  return await invoke<ContainerHeaderInfo>("inspect_denc_file", { filePath });
}

export async function executeEncryption(
  request: StartEncryptRequest,
  onProgress: (payload: ProgressPayload) => void,
): Promise<EncryptResponse> {
  if (!isTauriEnvironment()) {
    // Simulated progressive encryption in web mode
    const total = 50 * 1024 * 1024;
    for (let i = 1; i <= 20; i++) {
      await new Promise((r) => setTimeout(r, 60));
      const processed = (total / 20) * i;
      onProgress({
        job_id: "mock-job",
        bytes_processed: processed,
        total_bytes: total,
        percentage: (i / 20) * 100,
        throughput_bytes_per_sec: 42 * 1024 * 1024,
        eta_seconds: Math.max(0, 20 - i) * 0.06,
        phase: i === 20 ? "Finalizing Container" : "Streaming AEAD Cipher",
      });
    }
    return {
      job_id: "mock-job",
      bytes_encrypted: total,
      exported_shares: request.custodians
        .filter((c) => c.auth_type !== "passphrase")
        .map((c) => ({
          custodian_id: c.custodian_id,
          label: c.label,
          share: { id: c.custodian_id, data: Array(32).fill(0xaa) },
        })),
    };
  }

  const channel = new Channel<ProgressPayload>();
  channel.onmessage = onProgress;

  return await invoke<EncryptResponse>("start_encryption", {
    request,
    onProgress: channel,
  });
}

export async function executeDecryption(
  request: StartDecryptRequest,
  onProgress: (payload: ProgressPayload) => void,
): Promise<DecryptResponse> {
  if (!isTauriEnvironment()) {
    const total = 50 * 1024 * 1024;
    for (let i = 1; i <= 20; i++) {
      await new Promise((r) => setTimeout(r, 60));
      const processed = (total / 20) * i;
      onProgress({
        job_id: "mock-job-dec",
        bytes_processed: processed,
        total_bytes: total,
        percentage: (i / 20) * 100,
        throughput_bytes_per_sec: 55 * 1024 * 1024,
        eta_seconds: Math.max(0, 20 - i) * 0.06,
        phase: i === 20 ? "Verified Authentication Tag" : "Streaming Decryption",
      });
    }
    return {
      job_id: "mock-job-dec",
      bytes_decrypted: total,
    };
  }

  const channel = new Channel<ProgressPayload>();
  channel.onmessage = onProgress;

  return await invoke<DecryptResponse>("start_decryption", {
    request,
    onProgress: channel,
  });
}

export async function cancelJob(jobId: string): Promise<void> {
  if (!isTauriEnvironment()) return;
  await invoke("cancel_active_job", { jobId });
}

export interface KeyFileParseResult {
  custodian_id: number;
  share: { id: number; data: number[] } | null;
  pqc_private_key_base64?: string;
  is_pin_protected: boolean;
  is_pqc: boolean;
}

export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  security: "tls" | "starttls" | "none";
  from_email: string;
  from_name: string;
}

export interface SendCustodianEmailParams {
  config: SmtpConfig;
  recipient_email: string;
  custodian_label: string;
  share_filename: string;
  share_content: string;
  is_pin_protected: boolean;
  pin_code?: string;
  custom_note?: string;
}

export interface YubiKeyDevice {
  device_id: string;
  product_name: string;
  serial_number?: number;
  is_connected: boolean;
  supports_fido2: boolean;
  is_simulated: boolean;
}

export interface YubiKeyAuthResult {
  success: boolean;
  signature_hex: string;
  key_handle: string;
  is_simulated: boolean;
}

export function isSimulationEnabled(): boolean {
  return localStorage.getItem("dual_enable_hardware_simulation") === "true";
}

export function setSimulationEnabled(enabled: boolean): void {
  localStorage.setItem("dual_enable_hardware_simulation", enabled ? "true" : "false");
}

export async function listHardwareTokens(allowSimulation?: boolean): Promise<YubiKeyDevice[]> {
  const sim = allowSimulation ?? isSimulationEnabled();
  if (!isTauriEnvironment()) {
    return sim
      ? [
          {
            device_id: "simulated-fido2",
            product_name: "Virtual FIDO2 Security Key (Simulator Mode)",
            serial_number: 99990001,
            is_connected: true,
            supports_fido2: true,
            is_simulated: true,
          },
        ]
      : [];
  }
  return await invoke<YubiKeyDevice[]>("list_hardware_tokens", {
    allowSimulation: sim,
  });
}

export async function performHardwareTokenChallenge(
  custodianId: number,
  challengeHex: string,
  allowSimulation?: boolean,
): Promise<YubiKeyAuthResult> {
  const sim = allowSimulation ?? isSimulationEnabled();
  if (!isTauriEnvironment()) {
    if (!sim) {
      throw new Error(
        "No physical YubiKey detected. Please plug in a hardware key or enable Simulation Mode in Settings.",
      );
    }
    await new Promise((r) => setTimeout(r, 400));
    return {
      success: true,
      signature_hex: "3fa98e0c12da94812f0",
      key_handle: `mock-fido2-${custodianId}`,
      is_simulated: true,
    };
  }
  return await invoke<YubiKeyAuthResult>("perform_hardware_token_challenge", {
    custodianId,
    challengeHex,
    allowSimulation: sim,
  });
}

export async function saveKeyFile(
  filePath: string,
  share?: unknown,
  pin?: string,
  pqcPublicKeyBase64?: string,
  pqcPrivateKeyBase64?: string,
  custodianId?: number,
  label?: string,
): Promise<void> {
  if (!isTauriEnvironment()) return;
  await invoke("save_keyfile", {
    filePath,
    share,
    pin,
    pqcPublicKeyBase64,
    pqcPrivateKeyBase64,
    custodianId,
    label,
  });
}

export async function saveAllKeyFilesZip(
  filePath: string,
  shares: ExportedShare[],
  pins?: Record<number, string>,
): Promise<void> {
  if (!isTauriEnvironment()) return;
  await invoke("save_all_keyfiles_zip", { filePath, shares, pins });
}

export interface PqcKeypair {
  public_key_base64: string;
  private_key_base64: string;
  algorithm: string;
}

export async function generatePqcKeypair(): Promise<PqcKeypair> {
  if (!isTauriEnvironment()) {
    // Web fallback key generation
    return {
      public_key_base64: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzqX3q...",
      private_key_base64: "MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQ...",
      algorithm: "NIST-FIPS-203-ML-KEM-768",
    };
  }
  return await invoke<PqcKeypair>("generate_pqc_keypair");
}

export async function generateMlDsaKeypair(): Promise<PqcKeypair> {
  if (!isTauriEnvironment()) {
    // Web fallback key generation
    return {
      public_key_base64: "MII...ML_DSA_65_PUBLIC_KEY...",
      private_key_base64: "MII...ML_DSA_65_PRIVATE_SEED...",
      algorithm: "NIST-FIPS-204-ML-DSA-65",
    };
  }
  return await invoke<PqcKeypair>("generate_ml_dsa_keypair");
}

export async function parseKeyFile(filePath: string, pin?: string): Promise<KeyFileParseResult> {
  if (!isTauriEnvironment()) {
    return {
      custodian_id: 2,
      share: { id: 2, data: Array(32).fill(0xbb) },
      is_pin_protected: false,
      is_pqc: false,
    };
  }
  return await invoke<KeyFileParseResult>("parse_keyfile", { filePath, pin });
}

export async function saveSmtpConfig(config: SmtpConfig): Promise<void> {
  if (!isTauriEnvironment()) {
    localStorage.setItem("dual_smtp_config", JSON.stringify(config));
    return;
  }
  await invoke("save_smtp_config", { config });
}

export async function loadSmtpConfig(): Promise<SmtpConfig | null> {
  if (!isTauriEnvironment()) {
    const raw = localStorage.getItem("dual_smtp_config");
    return raw ? JSON.parse(raw) : null;
  }
  return await invoke<SmtpConfig | null>("load_smtp_config");
}

export async function testSmtpConnection(
  config: SmtpConfig,
  testRecipient: string,
): Promise<string> {
  if (!isTauriEnvironment()) {
    await new Promise((r) => setTimeout(r, 600));
    return `[Mock Web] Test email sent successfully to ${testRecipient}`;
  }
  return await invoke<string>("test_smtp_connection", {
    config,
    testRecipient,
  });
}

export async function sendCustodianKeyEmail(request: SendCustodianEmailParams): Promise<string> {
  if (!isTauriEnvironment()) {
    await new Promise((r) => setTimeout(r, 800));
    return `[Mock Web] Share emailed to ${request.recipient_email}`;
  }
  return await invoke<string>("send_custodian_key_email", { request });
}

export interface WebServerStatus {
  is_running: boolean;
  host: string;
  port: number;
  url: string;
  is_public: boolean;
}

export async function startLocalWebServer(host: string, port: number): Promise<WebServerStatus> {
  if (!isTauriEnvironment()) {
    return {
      is_running: true,
      host,
      port,
      url: host === "0.0.0.0" ? `http://localhost:${port}` : `http://${host}:${port}`,
      is_public: host === "0.0.0.0",
    };
  }
  return await invoke<WebServerStatus>("start_local_web_server", { host, port });
}

export async function stopLocalWebServer(): Promise<void> {
  if (!isTauriEnvironment()) return;
  await invoke("stop_local_web_server");
}

export async function getLocalWebServerStatus(): Promise<WebServerStatus> {
  if (!isTauriEnvironment()) {
    return {
      is_running: false,
      host: "127.0.0.1",
      port: 8080,
      url: "http://127.0.0.1:8080",
      is_public: false,
    };
  }
  return await invoke<WebServerStatus>("get_local_web_server_status");
}
