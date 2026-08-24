/**
 * 🔒 Zero-Knowledge Cryptographic Vault Engine (Mobile Android)
 *
 * Utilizes the Web Crypto API to derive AES-256-GCM encryption keys
 * via PBKDF2 (SHA-256, 100,000 iterations) with CSPRNG salts and 96-bit IVs.
 */

export interface EncryptedVaultEnvelope {
  version: 2;
  saltBase64: string;
  ivBase64: string;
  ciphertextBase64: string;
  updatedAt: string;
}

/** Convert Uint8Array to standard Base64 string */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Convert Base64 string to Uint8Array */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Generate cryptographically secure random bytes */
export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Derives an AES-256-GCM CryptoKey from a Master PIN and salt using PBKDF2 (100,000 rounds).
 */
export async function deriveVaultKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const pinBytes = encoder.encode(pin);

  const baseKey = await crypto.subtle.importKey("raw", pinBytes, { name: "PBKDF2" }, false, [
    "deriveKey",
    "deriveBits",
  ]);

  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: 100_000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Computes a constant-time verifiable PIN verification hash using PBKDF2 (SHA-256).
 */
export async function createPinVerifier(pin: string, salt: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const pinBytes = encoder.encode(pin);

  const baseKey = await crypto.subtle.importKey("raw", pinBytes, { name: "PBKDF2" }, false, [
    "deriveBits",
  ]);

  const verifierBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: 100_000,
      hash: "SHA-256",
    },
    baseKey,
    256,
  );

  return uint8ArrayToBase64(new Uint8Array(verifierBits));
}

/**
 * Encrypts arbitrary serializable vault data using AES-256-GCM with a random 12-byte IV.
 */
export async function encryptVaultData<T>(
  data: T,
  vaultKey: CryptoKey,
  salt: Uint8Array,
): Promise<EncryptedVaultEnvelope> {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));
  const iv = generateRandomBytes(12);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as unknown as BufferSource,
      tagLength: 128,
    },
    vaultKey,
    plaintext,
  );

  return {
    version: 2,
    saltBase64: uint8ArrayToBase64(salt),
    ivBase64: uint8ArrayToBase64(iv),
    ciphertextBase64: uint8ArrayToBase64(new Uint8Array(ciphertextBuffer)),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Decrypts and verifies an authenticated AES-256-GCM vault envelope.
 * Throws an Error if the key is incorrect or ciphertext has been modified.
 */
export async function decryptVaultData<T>(
  envelope: EncryptedVaultEnvelope,
  vaultKey: CryptoKey,
): Promise<T> {
  const iv = base64ToUint8Array(envelope.ivBase64);
  const ciphertext = base64ToUint8Array(envelope.ciphertextBase64);

  const plaintextBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv as unknown as BufferSource,
      tagLength: 128,
    },
    vaultKey,
    ciphertext as unknown as BufferSource,
  );

  const decoder = new TextDecoder();
  const jsonStr = decoder.decode(plaintextBuffer);
  return JSON.parse(jsonStr) as T;
}
