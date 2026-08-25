use crate::error::DencError;
use argon2::{Algorithm, Argon2, Params, Version};
use rand::rngs::OsRng;
use rand::RngCore;
use zeroize::Zeroize;

pub const SALT_LEN: usize = 32;
pub const KEY_LEN: usize = 32;

/// Derives a 256-bit symmetric key from a password and salt using Argon2id.
pub fn derive_key_argon2id(password: &[u8], salt: &[u8]) -> Result<[u8; KEY_LEN], DencError> {
    if salt.len() < 16 {
        return Err(DencError::KdfError(
            "Salt must be at least 16 bytes".to_string(),
        ));
    }

    // Enterprise Argon2id parameters (m_cost = 64 MB, t_cost = 3, p_cost = 4)
    let params =
        Params::new(65536, 3, 4, Some(KEY_LEN)).map_err(|e| DencError::KdfError(e.to_string()))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut key = [0u8; KEY_LEN];
    argon2
        .hash_password_into(password, salt, &mut key)
        .map_err(|e| DencError::KdfError(e.to_string()))?;

    Ok(key)
}

/// Generates a cryptographically secure 32-byte salt using OsRng.
pub fn generate_salt() -> [u8; SALT_LEN] {
    let mut salt = [0u8; SALT_LEN];
    OsRng.fill_bytes(&mut salt);
    salt
}

/// Helper struct that holds derived key material and automatically zeroizes memory on drop.
pub struct ZeroizedKey {
    pub key: [u8; KEY_LEN],
}

impl Drop for ZeroizedKey {
    fn drop(&mut self) {
        self.key.zeroize();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_argon2id_derivation() {
        let password = b"P@ssw0rdEnterprise2026";
        let salt = generate_salt();
        let key1 = derive_key_argon2id(password, &salt).expect("KDF failed");
        let key2 = derive_key_argon2id(password, &salt).expect("KDF failed");
        assert_eq!(key1, key2);

        let salt2 = generate_salt();
        let key3 = derive_key_argon2id(password, &salt2).expect("KDF failed");
        assert_ne!(key1, key3);
    }
}
