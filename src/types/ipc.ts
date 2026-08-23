import type { ExportedShare } from "./container";

export interface ProgressPayload {
  job_id: string;
  bytes_processed: number;
  total_bytes: number;
  percentage: number;
  throughput_bytes_per_sec: number;
  eta_seconds: number;
  phase: string;
}

export interface EncryptCustodianRequest {
  custodian_id: number;
  label: string;
  auth_type: string;
  passphrase?: string;
}

export interface StartEncryptRequest {
  input_path: string;
  output_path: string;
  cipher: string;
  threshold_k: number;
  total_n: number;
  custodians: EncryptCustodianRequest[];
}

export interface EncryptResponse {
  job_id: string;
  bytes_encrypted: number;
  exported_shares: ExportedShare[];
}

export interface DecryptCredentialRequest {
  custodian_id: number;
  passphrase?: string;
  share_data_json?: string;
}

export interface StartDecryptRequest {
  input_path: string;
  output_path: string;
  credentials: DecryptCredentialRequest[];
}

export interface DecryptResponse {
  job_id: string;
  bytes_decrypted: number;
}
