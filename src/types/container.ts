export type AuthType = "passphrase" | "keyfile" | "otp" | "pqc" | "postquantum" | "yubikey";

export interface DencSignatureBlock {
  algorithm: string;
  author_label: string;
  author_public_key_base64: string;
  signature_base64: string;
}

export interface DencManifest {
  classification: string; // "TOP_SECRET" | "CONFIDENTIAL" | "INTERNAL" | "RESTRICTED" | "GENERAL"
  purpose?: string;
  organization?: string;
  created_at_utc: number;
  original_filename?: string;
  is_directory?: boolean;
  custodian_timelocks?: Record<number, number>;
}

export interface CustodianDescriptorInfo {
  custodian_id: number;
  label: string;
  auth_type: AuthType;
  has_embedded_share: boolean;
  timelock_not_before_utc?: number;
}

export interface ContainerHeaderInfo {
  version: number;
  cipher: string;
  threshold_k: number;
  total_n: number;
  chunk_size: number;
  custodians: CustodianDescriptorInfo[];
  signature_block?: DencSignatureBlock;
  is_signature_valid?: boolean;
  manifest?: DencManifest;
}

export interface SecretShareData {
  id: number;
  data: number[];
}

export interface ExportedShare {
  custodian_id: number;
  label: string;
  auth_type?: AuthType | string;
  share?: SecretShareData;
  pqc_public_key_base64?: string;
  pqc_private_key_base64?: string;
}
