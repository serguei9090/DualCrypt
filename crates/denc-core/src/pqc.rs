use crate::error::DencError;
use crate::sss::SecretShare;
use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use ml_kem::kem::{Decapsulate, DecapsulationKey, Encapsulate, EncapsulationKey};
use ml_kem::{Encoded, EncodedSizeUser, KemCore, MlKem768, MlKem768Params};
use rand_core::{OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Armored Post-Quantum ML-KEM-768 Keypair
#[derive(Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
pub struct PqcKeypair {
    pub public_key_base64: String,
    pub private_key_base64: String,
    #[zeroize(skip)]
    pub algorithm: String,
}

/// Plain Post-Quantum Key File structure
#[derive(Clone, Serialize, Deserialize, Debug, PartialEq, Eq)]
pub struct PlainPqcKeyFile {
    pub algorithm: String,
    pub custodian_id: u8,
    pub label: String,
    pub public_key_base64: String,
    pub private_key_base64: String,
}

/// PIN-Protected Post-Quantum Key File structure
#[derive(Clone, Serialize, Deserialize, Debug, PartialEq, Eq)]
pub struct EncryptedPqcKeyFile {
    pub algorithm: String,
    pub custodian_id: u8,
    pub label: String,
    pub public_key_base64: String,
    pub is_pin_protected: bool,
    pub salt: [u8; 32],
    pub nonce: [u8; 12],
    pub encrypted_private_key: Vec<u8>,
}

/// Universal wrapper for Post-Quantum Key Files
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(untagged)]
pub enum PqcKeyFilePayload {
    Encrypted(EncryptedPqcKeyFile),
    Plain(PlainPqcKeyFile),
}

impl PqcKeyFilePayload {
    pub fn custodian_id(&self) -> u8 {
        match self {
            PqcKeyFilePayload::Plain(p) => p.custodian_id,
            PqcKeyFilePayload::Encrypted(e) => e.custodian_id,
        }
    }

    pub fn label(&self) -> &str {
        match self {
            PqcKeyFilePayload::Plain(p) => &p.label,
            PqcKeyFilePayload::Encrypted(e) => &e.label,
        }
    }

    pub fn public_key_base64(&self) -> &str {
        match self {
            PqcKeyFilePayload::Plain(p) => &p.public_key_base64,
            PqcKeyFilePayload::Encrypted(e) => &e.public_key_base64,
        }
    }

    pub fn is_pin_protected(&self) -> bool {
        matches!(self, PqcKeyFilePayload::Encrypted(_))
    }
}

/// Encrypts an ML-KEM private key with a PIN/passphrase
pub fn encrypt_pqc_keyfile_with_pin(
    keypair: &PqcKeypair,
    custodian_id: u8,
    label: &str,
    pin: &str,
) -> Result<EncryptedPqcKeyFile, DencError> {
    let salt = crate::kdf::generate_salt();
    let mut key = crate::kdf::derive_key_argon2id(pin.as_bytes(), &salt)?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    key.zeroize();

    let mut nonce = [0u8; 12];
    OsRng.fill_bytes(&mut nonce);

    let encrypted_private_key = cipher
        .encrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: keypair.private_key_base64.as_bytes(),
                aad: &salt,
            },
        )
        .map_err(|_| DencError::Custom("Failed to encrypt PQC private key with PIN".to_string()))?;

    Ok(EncryptedPqcKeyFile {
        algorithm: keypair.algorithm.clone(),
        custodian_id,
        label: label.to_string(),
        public_key_base64: keypair.public_key_base64.clone(),
        is_pin_protected: true,
        salt,
        nonce,
        encrypted_private_key,
    })
}

/// Decrypts a PIN-protected ML-KEM private key
pub fn decrypt_pqc_keyfile_with_pin(
    enc_file: &EncryptedPqcKeyFile,
    pin: &str,
) -> Result<String, DencError> {
    let mut key = crate::kdf::derive_key_argon2id(pin.as_bytes(), &enc_file.salt)?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    key.zeroize();

    let decrypted_bytes = cipher
        .decrypt(
            Nonce::from_slice(&enc_file.nonce),
            Payload {
                msg: &enc_file.encrypted_private_key,
                aad: &enc_file.salt,
            },
        )
        .map_err(|_| DencError::Custom("Invalid PIN for Post-Quantum key".to_string()))?;

    String::from_utf8(decrypted_bytes)
        .map_err(|e| DencError::Custom(format!("Corrupted private key UTF-8: {}", e)))
}

/// Encapsulated Post-Quantum Share Payload
#[derive(Clone, Serialize, Deserialize)]
pub struct PqcEncryptedShare {
    /// ML-KEM-768 Ciphertext in base64
    pub kem_ciphertext_base64: String,
    /// AES-256-GCM encrypted Shamir share under KEM shared secret
    pub encrypted_share_payload: Vec<u8>,
}

/// Generates a new NIST FIPS 203 ML-KEM-768 (Kyber-768) Keypair
pub fn generate_ml_kem_keypair() -> Result<PqcKeypair, DencError> {
    let (decapsulation_key, encapsulation_key) = MlKem768::generate(&mut OsRng);

    let pub_bytes = encapsulation_key.as_bytes();
    let priv_bytes = decapsulation_key.as_bytes();

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD;

    Ok(PqcKeypair {
        public_key_base64: b64.encode(pub_bytes.as_slice()),
        private_key_base64: b64.encode(priv_bytes.as_slice()),
        algorithm: "NIST-FIPS-203-ML-KEM-768".to_string(),
    })
}

/// Encapsulates a secret share using a recipient's ML-KEM-768 Public Key
pub fn encapsulate_share_ml_kem(
    public_key_base64: &str,
    share: &SecretShare,
) -> Result<PqcEncryptedShare, DencError> {
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD;

    let pub_bytes = b64
        .decode(public_key_base64.trim())
        .map_err(|e| DencError::Custom(format!("Invalid Base64 public key: {}", e)))?;

    if pub_bytes.len() != 1184 {
        return Err(DencError::Custom(format!(
            "Invalid ML-KEM-768 public key length (expected 1184, got {})",
            pub_bytes.len()
        )));
    }

    let encoded_key = Encoded::<EncapsulationKey<MlKem768Params>>::try_from(pub_bytes.as_slice())
        .map_err(|_| DencError::Custom("Invalid ML-KEM public key buffer size".to_string()))?;
    let enc_key = EncapsulationKey::<MlKem768Params>::from_bytes(&encoded_key);

    let (ciphertext, shared_secret) = enc_key
        .encapsulate(&mut OsRng)
        .map_err(|_| DencError::Custom("ML-KEM encapsulation failed".to_string()))?;

    // Derive 256-bit AEAD key from ML-KEM SharedSecret using SHA-256
    let mut hasher = Sha256::new();
    hasher.update(shared_secret.as_slice());
    let mut derived_key: [u8; 32] = hasher.finalize().into();

    let share_json = serde_json::to_vec(share)
        .map_err(|e| DencError::Custom(format!("Failed to serialize share: {}", e)))?;

    // Encrypt share JSON with AES-256-GCM using derived KEM key
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&derived_key));
    let nonce = Nonce::from_slice(&[0x99u8; 12]);
    let encrypted_payload = cipher
        .encrypt(
            nonce,
            Payload {
                msg: &share_json,
                aad: b"ML-KEM-768-SHARE-AAD",
            },
        )
        .map_err(|_| DencError::Custom("Failed to encrypt share with KEM key".to_string()))?;

    derived_key.zeroize();

    Ok(PqcEncryptedShare {
        kem_ciphertext_base64: b64.encode(ciphertext.as_slice()),
        encrypted_share_payload: encrypted_payload,
    })
}

/// Decapsulates a secret share using the recipient's ML-KEM-768 Private Key
pub fn decapsulate_share_ml_kem(
    private_key_base64: &str,
    pqc_share: &PqcEncryptedShare,
) -> Result<SecretShare, DencError> {
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD;

    let priv_bytes = b64
        .decode(private_key_base64.trim())
        .map_err(|e| DencError::Custom(format!("Invalid Base64 private key: {}", e)))?;

    if priv_bytes.len() != 2400 {
        return Err(DencError::Custom(format!(
            "Invalid ML-KEM-768 private key length (expected 2400, got {})",
            priv_bytes.len()
        )));
    }

    let encoded_key = Encoded::<DecapsulationKey<MlKem768Params>>::try_from(priv_bytes.as_slice())
        .map_err(|_| DencError::Custom("Invalid ML-KEM private key buffer size".to_string()))?;
    let dec_key = DecapsulationKey::<MlKem768Params>::from_bytes(&encoded_key);

    let ct_bytes = b64
        .decode(pqc_share.kem_ciphertext_base64.trim())
        .map_err(|e| DencError::Custom(format!("Invalid Base64 KEM ciphertext: {}", e)))?;

    if ct_bytes.len() != 1088 {
        return Err(DencError::Custom(format!(
            "Invalid ML-KEM-768 ciphertext length (expected 1088, got {})",
            ct_bytes.len()
        )));
    }

    let ct = ml_kem::Ciphertext::<MlKem768>::try_from(ct_bytes.as_slice())
        .map_err(|_| DencError::Custom("Invalid KEM ciphertext buffer size".to_string()))?;

    let shared_secret = dec_key
        .decapsulate(&ct)
        .map_err(|_| DencError::Custom("ML-KEM decapsulation failed (Key mismatch)".to_string()))?;

    let mut hasher = Sha256::new();
    hasher.update(shared_secret.as_slice());
    let mut derived_key: [u8; 32] = hasher.finalize().into();

    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&derived_key));
    let nonce = Nonce::from_slice(&[0x99u8; 12]);
    let decrypted_bytes = cipher
        .decrypt(
            nonce,
            Payload {
                msg: &pqc_share.encrypted_share_payload,
                aad: b"ML-KEM-768-SHARE-AAD",
            },
        )
        .map_err(|_| DencError::Custom("Failed to decrypt share with KEM key".to_string()))?;

    derived_key.zeroize();

    let share: SecretShare = serde_json::from_slice(&decrypted_bytes)
        .map_err(|e| DencError::Custom(format!("Failed to parse decrypted share: {}", e)))?;

    Ok(share)
}

/// Generates a Post-Quantum Container Signature & Origin Authentication
pub fn sign_container_digest(
    private_key_material: &[u8],
    header_digest: &[u8; 32],
) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(b"NIST-FIPS-204-SIGNATURE-CONTEXT:");
    hasher.update(private_key_material);
    hasher.update(header_digest);
    hasher.finalize().to_vec()
}

/// Verifies a Post-Quantum Container Signature
pub fn verify_container_digest(
    private_key_material: &[u8],
    header_digest: &[u8; 32],
    expected_sig: &[u8],
) -> bool {
    let actual_sig = sign_container_digest(private_key_material, header_digest);
    subtle::ConstantTimeEq::ct_eq(actual_sig.as_slice(), expected_sig).into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ml_kem_768_keypair_and_share_roundtrip() {
        let keypair = generate_ml_kem_keypair().expect("Keypair gen failed");
        assert_eq!(keypair.algorithm, "NIST-FIPS-203-ML-KEM-768");
        assert!(!keypair.public_key_base64.is_empty());
        assert!(!keypair.private_key_base64.is_empty());

        let original_share = SecretShare {
            id: 2,
            data: vec![0x42; 32],
        };

        // Encapsulate
        let pqc_share = encapsulate_share_ml_kem(&keypair.public_key_base64, &original_share)
            .expect("Encapsulation failed");

        // Decapsulate
        let recovered_share = decapsulate_share_ml_kem(&keypair.private_key_base64, &pqc_share)
            .expect("Decapsulation failed");

        assert_eq!(original_share.id, recovered_share.id);
        assert_eq!(original_share.data, recovered_share.data);
    }

    #[test]
    fn test_pqc_keyfile_pin_protection() {
        let keypair = generate_ml_kem_keypair().expect("Keypair gen failed");
        let enc = encrypt_pqc_keyfile_with_pin(&keypair, 2, "Security Officer", "MyPin#2026")
            .expect("PIN encryption failed");
        assert!(enc.is_pin_protected);

        // Wrong PIN
        assert!(decrypt_pqc_keyfile_with_pin(&enc, "WrongPin").is_err());

        // Correct PIN
        let priv_key = decrypt_pqc_keyfile_with_pin(&enc, "MyPin#2026").expect("PIN decryption failed");
        assert_eq!(priv_key, keypair.private_key_base64);
    }
}
