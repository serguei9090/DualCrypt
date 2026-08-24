import type { AirGapEnrollmentKey } from "../../../../packages/shared-airgap/src/index";
import {
  base64ToUint8Array,
  decryptVaultData,
  type EncryptedVaultEnvelope,
  encryptVaultData,
  generateRandomBytes,
} from "./cryptoVault";

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

const VAULT_CONFIG_KEY = "dualcrypt_mobile_auth_config_v2";
const VAULT_ENCRYPTED_STORAGE_KEY = "dualcrypt_mobile_vault_encrypted_v2";
const LEGACY_VAULT_STORAGE_KEY = "dualcrypt_mobile_vault_v1";
const LEGACY_CONFIG_KEY = "dualcrypt_mobile_auth_config_v1";

export interface AuthConfig {
  isConfigured: boolean;
  saltBase64: string;
  pinVerifier: string;
  useBiometrics: boolean;
  biometricWrappedKeyBase64?: string;
}

export function loadAuthConfig(): AuthConfig {
  try {
    const raw = localStorage.getItem(VAULT_CONFIG_KEY);
    if (raw) return JSON.parse(raw);

    // Check for legacy v1 config
    const legacyRaw = localStorage.getItem(LEGACY_CONFIG_KEY);
    if (legacyRaw) {
      const parsedLegacy = JSON.parse(legacyRaw);
      if (parsedLegacy.isConfigured) {
        return {
          isConfigured: false, // Force re-setup or PIN validation to encrypt with v2
          saltBase64: "",
          pinVerifier: "",
          useBiometrics: parsedLegacy.useBiometrics ?? false,
        };
      }
    }

    return { isConfigured: false, saltBase64: "", pinVerifier: "", useBiometrics: false };
  } catch {
    return { isConfigured: false, saltBase64: "", pinVerifier: "", useBiometrics: false };
  }
}

export function saveAuthConfig(config: AuthConfig): void {
  localStorage.setItem(VAULT_CONFIG_KEY, JSON.stringify(config));
}

/**
 * Loads and decrypts all vault keys using the active session CryptoKey.
 * Also seamlessly migrates legacy unencrypted v1 keys into the encrypted envelope.
 */
export async function loadEncryptedVaultKeys(vaultKey: CryptoKey): Promise<VaultKeyItem[]> {
  try {
    const raw = localStorage.getItem(VAULT_ENCRYPTED_STORAGE_KEY);
    if (!raw) {
      // Check if legacy unencrypted keys exist to migrate
      const legacyRaw = localStorage.getItem(LEGACY_VAULT_STORAGE_KEY);
      if (legacyRaw) {
        try {
          const legacyKeys: VaultKeyItem[] = JSON.parse(legacyRaw);
          if (Array.isArray(legacyKeys) && legacyKeys.length > 0) {
            // Encrypt and save under v2
            const config = loadAuthConfig();
            const salt = config.saltBase64
              ? base64ToUint8Array(config.saltBase64)
              : generateRandomBytes(32);
            await saveEncryptedVaultKeysArray(legacyKeys, vaultKey, salt);
            localStorage.removeItem(LEGACY_VAULT_STORAGE_KEY);
            return legacyKeys;
          }
        } catch {
          // ignore corrupted legacy data
        }
      }
      return [];
    }

    const envelope: EncryptedVaultEnvelope = JSON.parse(raw);
    const keys = await decryptVaultData<VaultKeyItem[]>(envelope, vaultKey);
    return Array.isArray(keys) ? keys : [];
  } catch (err) {
    console.error("Failed to decrypt vault keys at rest:", err);
    throw new Error("Unable to decrypt vault keys with provided credentials.");
  }
}

/**
 * Encrypts and writes the complete key array to authenticated persistent storage.
 */
async function saveEncryptedVaultKeysArray(
  keys: VaultKeyItem[],
  vaultKey: CryptoKey,
  salt: Uint8Array,
): Promise<void> {
  const envelope = await encryptVaultData(keys, vaultKey, salt);
  localStorage.setItem(VAULT_ENCRYPTED_STORAGE_KEY, JSON.stringify(envelope));
}

/**
 * Adds an enrolled key into the encrypted vault container at rest.
 */
export async function saveEncryptedVaultKey(
  enrollment: AirGapEnrollmentKey,
  vaultKey: CryptoKey,
  salt: Uint8Array,
): Promise<VaultKeyItem> {
  const currentKeys = await loadEncryptedVaultKeys(vaultKey);
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

  const updated = [newItem, ...currentKeys];
  await saveEncryptedVaultKeysArray(updated, vaultKey, salt);
  return newItem;
}

/**
 * Deletes a key from the encrypted vault container at rest.
 */
export async function deleteEncryptedVaultKey(
  id: string,
  vaultKey: CryptoKey,
  salt: Uint8Array,
): Promise<void> {
  const currentKeys = await loadEncryptedVaultKeys(vaultKey);
  const updated = currentKeys.filter((k) => k.id !== id);
  await saveEncryptedVaultKeysArray(updated, vaultKey, salt);
}

/**
 * Wipes the entire encrypted storage (for vault factory reset).
 */
export function wipeVaultStorage(): void {
  localStorage.removeItem(VAULT_ENCRYPTED_STORAGE_KEY);
  localStorage.removeItem(VAULT_CONFIG_KEY);
  localStorage.removeItem(LEGACY_VAULT_STORAGE_KEY);
  localStorage.removeItem(LEGACY_CONFIG_KEY);
}
