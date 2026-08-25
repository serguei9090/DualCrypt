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

export async function getLaunchFile(): Promise<string | null> {
  if (!isTauriEnvironment()) return null;
  try {
    return await invoke<string | null>("get_cli_launch_file");
  } catch {
    return null;
  }
}

export async function inspectDencFile(
  filePath: string,
  fileBytes?: Uint8Array,
): Promise<ContainerHeaderInfo> {
  if (!isTauriEnvironment()) {
    if (fileBytes && fileBytes.length > 0) {
      const { inspectWebDenc } = await import("./webCrypto");
      return await inspectWebDenc(fileBytes);
    }
    throw new Error("Cannot inspect file on web without binary payload");
  }
  return await invoke<ContainerHeaderInfo>("inspect_denc_file", { filePath });
}

export async function executeEncryption(
  request: StartEncryptRequest,
  onProgress: (payload: ProgressPayload) => void,
): Promise<EncryptResponse> {
  if (!isTauriEnvironment()) {
    const { executeWebEncryption } = await import("./webCrypto");
    return await executeWebEncryption(request, onProgress);
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
    const { executeWebDecryption } = await import("./webCrypto");
    return await executeWebDecryption(request, onProgress);
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
    const { generateWebPqcKeypair } = await import("./webCrypto");
    return await generateWebPqcKeypair();
  }
  return await invoke<PqcKeypair>("generate_pqc_keypair");
}

export async function generateMlDsaKeypair(): Promise<PqcKeypair> {
  if (!isTauriEnvironment()) {
    const { generateWebMlDsaKeypair } = await import("./webCrypto");
    return await generateWebMlDsaKeypair();
  }
  return await invoke<PqcKeypair>("generate_ml_dsa_keypair");
}

export async function parseKeyFile(
  filePath: string,
  pin?: string,
  fileContent?: string,
): Promise<KeyFileParseResult> {
  if (!isTauriEnvironment()) {
    if (fileContent) {
      const { parseWebKeyFileContent } = await import("./webCrypto");
      return parseWebKeyFileContent(fileContent, pin);
    }
    throw new Error("No key file content provided in browser mode");
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

export interface CollisionCheckResult {
  exists: boolean;
  is_dir: boolean;
  suggested_path: string;
}

export async function checkPathCollision(targetPath: string): Promise<CollisionCheckResult> {
  if (!isTauriEnvironment()) {
    return { exists: false, is_dir: false, suggested_path: targetPath };
  }
  return await invoke<CollisionCheckResult>("check_path_collision", { targetPath });
}
