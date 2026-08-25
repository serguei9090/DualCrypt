use crate::error::DencError;
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use zeroize::{Zeroize, ZeroizeOnDrop};

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Key, Nonce};

/// A single share of a split secret in Shamir's Secret Sharing scheme.
#[derive(Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop, PartialEq, Eq)]
pub struct SecretShare {
    /// Distinct X-coordinate in GF(256) (1..=255)
    pub id: u8,
    /// Evaluated Y-coordinates for each byte of the secret
    pub data: Vec<u8>,
}

impl std::fmt::Debug for SecretShare {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SecretShare")
            .field("id", &self.id)
            .field("data_len", &self.data.len())
            .finish()
    }
}

/// A PIN-protected / password-encrypted key share
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EncryptedSecretShare {
    pub id: u8,
    pub is_encrypted: bool,
    pub salt: [u8; 32],
    pub nonce: [u8; 12],
    pub ciphertext: Vec<u8>,
}

impl std::fmt::Debug for EncryptedSecretShare {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("EncryptedSecretShare")
            .field("id", &self.id)
            .field("is_encrypted", &self.is_encrypted)
            .finish()
    }
}

impl SecretShare {
    /// Encrypts this key share with a PIN/passphrase using Argon2id + AES-256-GCM
    pub fn encrypt_with_pin(&self, pin: &str) -> Result<EncryptedSecretShare, DencError> {
        let salt = crate::kdf::generate_salt();
        let mut key = crate::kdf::derive_key_argon2id(pin.as_bytes(), &salt)?;
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
        key.zeroize();

        let mut nonce = [0u8; 12];
        OsRng.fill_bytes(&mut nonce);
        let plain_bytes = serde_json::to_vec(self)?;
        let ciphertext = cipher
            .encrypt(
                Nonce::from_slice(&nonce),
                Payload {
                    msg: &plain_bytes,
                    aad: &salt,
                },
            )
            .map_err(|_| DencError::Custom("Failed to encrypt share with PIN".to_string()))?;

        Ok(EncryptedSecretShare {
            id: self.id,
            is_encrypted: true,
            salt,
            nonce,
            ciphertext,
        })
    }
}

impl EncryptedSecretShare {
    /// Decrypts a PIN-protected key share
    pub fn decrypt_with_pin(&self, pin: &str) -> Result<SecretShare, DencError> {
        let mut key = crate::kdf::derive_key_argon2id(pin.as_bytes(), &self.salt)?;
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
        key.zeroize();

        let plain_bytes = cipher
            .decrypt(
                Nonce::from_slice(&self.nonce),
                Payload {
                    msg: &self.ciphertext,
                    aad: &self.salt,
                },
            )
            .map_err(|_| DencError::Custom("Invalid PIN for key share".to_string()))?;

        let share: SecretShare = serde_json::from_slice(&plain_bytes)?;
        Ok(share)
    }
}

/// Universal wrapper representing either a plain or PIN-protected key file
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(untagged)]
pub enum KeyFilePayload {
    Encrypted(EncryptedSecretShare),
    Plain(SecretShare),
}

impl KeyFilePayload {
    pub fn id(&self) -> u8 {
        match self {
            KeyFilePayload::Plain(s) => s.id,
            KeyFilePayload::Encrypted(e) => e.id,
        }
    }

    pub fn is_pin_protected(&self) -> bool {
        matches!(self, KeyFilePayload::Encrypted(_))
    }
}

/// Constant-time addition / subtraction in GF(256) is bitwise XOR.
#[inline(always)]
pub fn gf256_add(a: u8, b: u8) -> u8 {
    a ^ b
}

/// Constant-time multiplication in GF(256) with irreducible polynomial 0x11B (x^8 + x^4 + x^3 + x + 1).
/// Uses 8-step Russian Peasant multiplication.
#[inline(always)]
pub fn gf256_mul(mut a: u8, mut b: u8) -> u8 {
    let mut p: u8 = 0;
    for _ in 0..8 {
        // If the LSB of b is 1, add a to product p
        let mask = (b & 1).wrapping_neg();
        p ^= a & mask;

        // Check if MSB of a is 1 before shift
        let carry = (a >> 7) & 1;
        let carry_mask = carry.wrapping_neg();

        a <<= 1;
        a ^= 0x1B & carry_mask; // 0x11B modulo x^8 = 0x1B
        b >>= 1;
    }
    p
}

/// Constant-time exponentiation in GF(256): compute base^exp.
pub fn gf256_pow(base: u8, mut exp: u8) -> u8 {
    let mut res: u8 = 1;
    let mut b = base;
    while exp > 0 {
        if exp & 1 == 1 {
            res = gf256_mul(res, b);
        }
        b = gf256_mul(b, b);
        exp >>= 1;
    }
    res
}

/// Constant-time multiplicative inverse in GF(256) using Fermat's Little Theorem:
/// a^(-1) = a^(254) for any non-zero a. (0 returns 0).
#[inline(always)]
pub fn gf256_inv(a: u8) -> u8 {
    if a == 0 {
        0
    } else {
        gf256_pow(a, 254)
    }
}

/// Split a secret byte slice into `total_n` shares such that any `threshold_k` shares can reconstruct it.
pub fn split_secret(
    secret: &[u8],
    threshold_k: u8,
    total_n: u8,
) -> Result<Vec<SecretShare>, DencError> {
    if threshold_k == 0 || total_n == 0 || threshold_k > total_n {
        return Err(DencError::InvalidThreshold {
            threshold: threshold_k,
            total: total_n,
        });
    }

    if secret.is_empty() {
        return Err(DencError::Custom("Secret cannot be empty".to_string()));
    }

    let secret_len = secret.len();
    let mut shares = Vec::with_capacity(total_n as usize);

    for i in 1..=total_n {
        shares.push(SecretShare {
            id: i,
            data: vec![0u8; secret_len],
        });
    }

    let mut rng = OsRng;

    // For each byte position of the secret, generate a random polynomial of degree (threshold_k - 1)
    // f(x) = secret[byte_idx] + a_1*x + a_2*x^2 + ... + a_{k-1}*x^{k-1}
    for byte_idx in 0..secret_len {
        let mut coeffs = vec![0u8; threshold_k as usize];
        coeffs[0] = secret[byte_idx];
        for coeff in coeffs.iter_mut().skip(1) {
            *coeff = (rng.next_u32() & 0xFF) as u8;
        }

        // Evaluate polynomial f(x) at x = 1..=total_n using Horner's rule
        for (share_idx, share) in shares.iter_mut().enumerate() {
            let x = (share_idx + 1) as u8;
            let mut val = 0u8;
            for coeff in coeffs.iter().rev() {
                val = gf256_add(gf256_mul(val, x), *coeff);
            }
            share.data[byte_idx] = val;
        }
        coeffs.zeroize();
    }

    Ok(shares)
}

/// Reconstruct the original secret from a subset of `SecretShare`s.
pub fn combine_shares(shares: &[SecretShare]) -> Result<Vec<u8>, DencError> {
    if shares.is_empty() {
        return Err(DencError::InsufficientShares {
            provided: 0,
            required: 1,
        });
    }

    let mut seen_ids = HashSet::new();
    let secret_len = shares[0].data.len();

    for share in shares {
        if share.id == 0 {
            return Err(DencError::InvalidShareCoordinate(0));
        }
        if !seen_ids.insert(share.id) {
            return Err(DencError::DuplicateShare(share.id));
        }
        if share.data.len() != secret_len {
            return Err(DencError::MismatchedShareLength {
                expected: secret_len,
                actual: share.data.len(),
            });
        }
    }

    let k = shares.len();
    let mut secret = vec![0u8; secret_len];

    // Compute Lagrange basis polynomial values l_i(0) = product_{j != i} (x_j / (x_i ^ x_j))
    let mut lagrange_coeffs = Vec::with_capacity(k);
    for i in 0..k {
        let xi = shares[i].id;
        let mut num = 1u8;
        let mut den = 1u8;

        for j in 0..k {
            if i != j {
                let xj = shares[j].id;
                num = gf256_mul(num, xj);
                den = gf256_mul(den, gf256_add(xi, xj));
            }
        }

        let basis_at_zero = gf256_mul(num, gf256_inv(den));
        lagrange_coeffs.push(basis_at_zero);
    }

    // Reconstruct each byte of the secret: S = sum_{i=0}^{k-1} y_i * l_i(0)
    for byte_idx in 0..secret_len {
        let mut byte_val = 0u8;
        for i in 0..k {
            let yi = shares[i].data[byte_idx];
            let term = gf256_mul(yi, lagrange_coeffs[i]);
            byte_val = gf256_add(byte_val, term);
        }
        secret[byte_idx] = byte_val;
    }

    Ok(secret)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gf256_arithmetic() {
        assert_eq!(gf256_add(0x57, 0x83), 0xD4);
        assert_eq!(gf256_mul(0x53, 0xCA), 0x01); // 0x53 and 0xCA are inverses in AES GF(256)
        assert_eq!(gf256_inv(0x53), 0xCA);
        assert_eq!(gf256_mul(0x53, gf256_inv(0x53)), 1);
    }

    #[test]
    fn test_sss_roundtrip_2_of_3() {
        let secret = b"Enterprise Dual-Control Key 2026!";
        let shares = split_secret(secret, 2, 3).expect("Split failed");
        assert_eq!(shares.len(), 3);

        // Any 2 shares must reconstruct
        let subset_1_2 = vec![shares[0].clone(), shares[1].clone()];
        assert_eq!(combine_shares(&subset_1_2).unwrap(), secret);

        let subset_2_3 = vec![shares[1].clone(), shares[2].clone()];
        assert_eq!(combine_shares(&subset_2_3).unwrap(), secret);

        let subset_1_3 = vec![shares[0].clone(), shares[2].clone()];
        assert_eq!(combine_shares(&subset_1_3).unwrap(), secret);
    }

    #[test]
    fn test_sss_roundtrip_3_of_5() {
        let secret = vec![0x42u8; 32];
        let shares = split_secret(&secret, 3, 5).expect("Split failed");

        let subset = vec![shares[1].clone(), shares[3].clone(), shares[4].clone()];
        assert_eq!(combine_shares(&subset).unwrap(), secret);
    }

    #[test]
    fn test_sss_single_share_fails_for_threshold_2() {
        let secret = b"super-confidential-dek-material";
        let shares = split_secret(secret, 2, 2).expect("Split failed");

        let subset = vec![shares[0].clone()];
        // Reconstructing with fewer shares yields mathematically bogus data, not the original secret
        let bogus = combine_shares(&subset).unwrap();
        assert_ne!(bogus, secret);
    }

    #[test]
    fn test_pin_protected_share_roundtrip() {
        let secret = b"Enterprise Security Token 2026";
        let shares = split_secret(secret, 2, 2).expect("Split failed");
        let original_share = shares[0].clone();

        let pin = "987654";
        let encrypted_share = original_share
            .encrypt_with_pin(pin)
            .expect("PIN encryption failed");
        assert!(encrypted_share.is_encrypted);

        // Wrong PIN should fail
        let wrong_res = encrypted_share.decrypt_with_pin("000000");
        assert!(wrong_res.is_err());

        // Correct PIN should recover identical SecretShare
        let recovered_share = encrypted_share
            .decrypt_with_pin(pin)
            .expect("PIN decryption failed");
        assert_eq!(recovered_share.id, original_share.id);
        assert_eq!(recovered_share.data, original_share.data);
    }
}
