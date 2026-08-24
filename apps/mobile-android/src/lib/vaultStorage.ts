import type { AirGapEnrollmentKey } from "../../../../packages/shared-airgap/src/index";

export interface VaultKeyItem {
  id: string;
  fileName: string;
  custodianId: number;
  custodianLabel: string;
  authType: string;
  shareDataJson?: string;
  pqcPrivateKeyBase64?: string;
  passphrase?: string;
  saltBase64?: string;
  enrolledAt: string;
}

const VAULT_STORAGE_KEY = "dualcrypt_mobile_vault_v1";
const VAULT_CONFIG_KEY = "dualcrypt_mobile_auth_config_v1";

export interface AuthConfig {
  isConfigured: boolean;
  pinHash: string;
  useBiometrics: boolean;
}

export function loadAuthConfig(): AuthConfig {
  try {
    const raw = localStorage.getItem(VAULT_CONFIG_KEY);
    if (!raw) return { isConfigured: false, pinHash: "", useBiometrics: false };
    return JSON.parse(raw);
  } catch {
    return { isConfigured: false, pinHash: "", useBiometrics: false };
  }
}

export function saveAuthConfig(config: AuthConfig): void {
  localStorage.setItem(VAULT_CONFIG_KEY, JSON.stringify(config));
}

export function loadVaultKeys(): VaultKeyItem[] {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveVaultKey(enrollment: AirGapEnrollmentKey): VaultKeyItem {
  const keys = loadVaultKeys();
  const newItem: VaultKeyItem = {
    id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    fileName: enrollment.fileName,
    custodianId: enrollment.custodianId,
    custodianLabel: enrollment.custodianLabel,
    authType: enrollment.authType,
    shareDataJson: enrollment.shareDataJson,
    pqcPrivateKeyBase64: enrollment.pqcPrivateKeyBase64,
    passphrase: enrollment.passphrase,
    saltBase64: enrollment.saltBase64,
    enrolledAt: new Date().toISOString(),
  };

  const updated = [newItem, ...keys];
  localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(updated));
  return newItem;
}

export function deleteVaultKey(id: string): void {
  const keys = loadVaultKeys();
  const updated = keys.filter((k) => k.id !== id);
  localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(updated));
}
