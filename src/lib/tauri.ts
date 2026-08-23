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

export async function saveKeyFile(filePath: string, share: unknown): Promise<void> {
  if (!isTauriEnvironment()) return;
  await invoke("save_keyfile", { filePath, share });
}

export async function saveAllKeyFilesZip(filePath: string, shares: ExportedShare[]): Promise<void> {
  if (!isTauriEnvironment()) return;
  await invoke("save_all_keyfiles_zip", { filePath, shares });
}

export async function parseKeyFile(filePath: string): Promise<unknown> {
  if (!isTauriEnvironment()) {
    return { id: 2, data: Array(32).fill(0xbb) };
  }
  return await invoke("parse_keyfile", { filePath });
}
