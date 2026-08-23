export type AuthType = "passphrase" | "keyfile" | "otp" | "pqc" | "postquantum" | "yubikey";

export interface CustodianDescriptorInfo {
  custodian_id: number;
  label: string;
  auth_type: AuthType;
  has_embedded_share: boolean;
}

export interface ContainerHeaderInfo {
  version: number;
  cipher: string;
  threshold_k: number;
  total_n: number;
  chunk_size: number;
  custodians: CustodianDescriptorInfo[];
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
