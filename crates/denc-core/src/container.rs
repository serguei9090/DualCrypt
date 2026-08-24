use crate::cipher::CipherSuite;
use crate::error::DencError;
use byteorder::{LittleEndian, ReadBytesExt, WriteBytesExt};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{Read, Write};

pub const MAGIC_BYTES: &[u8; 4] = b"DENC";
pub const FORMAT_VERSION_1: u16 = 1;
pub const FORMAT_VERSION_2: u16 = 2;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum AuthType {
    Passphrase = 0x01,
    KeyFile = 0x02,
    OtpChallenge = 0x03,
    PostQuantum = 0x04,
}

impl TryFrom<u8> for AuthType {
    type Error = DencError;
    fn try_from(val: u8) -> Result<Self, Self::Error> {
        match val {
            0x01 => Ok(AuthType::Passphrase),
            0x02 => Ok(AuthType::KeyFile),
            0x03 => Ok(AuthType::OtpChallenge),
            0x04 => Ok(AuthType::PostQuantum),
            _ => Err(DencError::Custom(format!("Unknown auth type: {val}"))),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CustodianDescriptor {
    pub custodian_id: u8,
    pub auth_type: AuthType,
    pub label: String,
    pub salt: [u8; 32],
    /// If encrypted in container (e.g. passphrase protected share), contains the ciphertext slice
    pub encrypted_share: Vec<u8>,
}

/// NIST FIPS 204 ML-DSA-65 Digital Container Signature block
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DencSignatureBlock {
    pub algorithm: String, // "NIST-FIPS-204-ML-DSA-65"
    pub author_label: String,
    pub author_public_key_base64: String,
    pub signature_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DencHeader {
    pub version: u16,
    pub cipher_suite: CipherSuite,
    pub kdf_id: u8,
    pub threshold_k: u8,
    pub total_n: u8,
    pub chunk_size: u32,
    pub master_salt: [u8; 32],
    pub base_nonce: [u8; 24],
    pub custodians: Vec<CustodianDescriptor>,
    pub signature_block: Option<DencSignatureBlock>,
}

impl DencHeader {
    /// Serializes header into binary bytes and returns (header_bytes, header_sha256_digest)
    pub fn serialize(&self) -> Result<(Vec<u8>, [u8; 32]), DencError> {
        let mut buf = Vec::with_capacity(256);

        let effective_version = if self.signature_block.is_some() && self.version < FORMAT_VERSION_2 {
            FORMAT_VERSION_2
        } else {
            self.version
        };

        // Magic & Version
        buf.write_all(MAGIC_BYTES)?;
        buf.write_u16::<LittleEndian>(effective_version)?;

        // Cipher & KDF & Thresholds
        buf.write_u8(self.cipher_suite as u8)?;
        buf.write_u8(self.kdf_id)?;
        buf.write_u8(self.threshold_k)?;
        buf.write_u8(self.total_n)?;
        buf.write_u32::<LittleEndian>(self.chunk_size)?;

        // Salts & Nonces
        buf.write_all(&self.master_salt)?;
        buf.write_all(&self.base_nonce)?;

        // Custodian Descriptors
        buf.write_u16::<LittleEndian>(self.custodians.len() as u16)?;
        for c in &self.custodians {
            buf.write_u8(c.custodian_id)?;
            buf.write_u8(c.auth_type as u8)?;

            let label_bytes = c.label.as_bytes();
            buf.write_u16::<LittleEndian>(label_bytes.len() as u16)?;
            buf.write_all(label_bytes)?;

            buf.write_all(&c.salt)?;

            buf.write_u16::<LittleEndian>(c.encrypted_share.len() as u16)?;
            buf.write_all(&c.encrypted_share)?;
        }

        // Optional Signature Block (for Version >= 2)
        if effective_version >= FORMAT_VERSION_2 {
            if let Some(sig) = &self.signature_block {
                buf.write_u8(1)?;
                let sig_json = serde_json::to_vec(sig)
                    .map_err(|e| DencError::Custom(format!("Failed to serialize signature block: {e}")))?;
                buf.write_u16::<LittleEndian>(sig_json.len() as u16)?;
                buf.write_all(&sig_json)?;
            } else {
                buf.write_u8(0)?;
            }
        }

        let digest: [u8; 32] = Sha256::digest(&buf).into();
        Ok((buf, digest))
    }

    /// Deserializes header from reader, validating magic and returning (Header, SHA256 digest, total header bytes read)
    pub fn deserialize<R: Read>(reader: &mut R) -> Result<(Self, [u8; 32], usize), DencError> {
        let mut raw_header_bytes = Vec::new();
        let mut magic = [0u8; 4];
        reader.read_exact(&mut magic)?;
        raw_header_bytes.extend_from_slice(&magic);

        if &magic != MAGIC_BYTES {
            return Err(DencError::InvalidMagic(magic));
        }

        let version = reader.read_u16::<LittleEndian>()?;
        raw_header_bytes.extend_from_slice(&version.to_le_bytes());
        if version != FORMAT_VERSION_1 && version != FORMAT_VERSION_2 {
            return Err(DencError::UnsupportedVersion(version));
        }

        let cipher_byte = reader.read_u8()?;
        raw_header_bytes.push(cipher_byte);
        let cipher_suite = CipherSuite::try_from(cipher_byte)?;

        let kdf_id = reader.read_u8()?;
        raw_header_bytes.push(kdf_id);

        let threshold_k = reader.read_u8()?;
        raw_header_bytes.push(threshold_k);

        let total_n = reader.read_u8()?;
        raw_header_bytes.push(total_n);

        let chunk_size = reader.read_u32::<LittleEndian>()?;
        raw_header_bytes.extend_from_slice(&chunk_size.to_le_bytes());

        let mut master_salt = [0u8; 32];
        reader.read_exact(&mut master_salt)?;
        raw_header_bytes.extend_from_slice(&master_salt);

        let mut base_nonce = [0u8; 24];
        reader.read_exact(&mut base_nonce)?;
        raw_header_bytes.extend_from_slice(&base_nonce);

        let custodian_count = reader.read_u16::<LittleEndian>()?;
        raw_header_bytes.extend_from_slice(&custodian_count.to_le_bytes());

        let mut custodians = Vec::with_capacity(custodian_count as usize);
        for _ in 0..custodian_count {
            let custodian_id = reader.read_u8()?;
            raw_header_bytes.push(custodian_id);

            let auth_type_byte = reader.read_u8()?;
            raw_header_bytes.push(auth_type_byte);
            let auth_type = AuthType::try_from(auth_type_byte)?;

            let label_len = reader.read_u16::<LittleEndian>()? as usize;
            raw_header_bytes.extend_from_slice(&(label_len as u16).to_le_bytes());
            let mut label_buf = vec![0u8; label_len];
            reader.read_exact(&mut label_buf)?;
            raw_header_bytes.extend_from_slice(&label_buf);
            let label = String::from_utf8(label_buf)
                .map_err(|_| DencError::Custom("Invalid UTF-8 in label".to_string()))?;

            let mut salt = [0u8; 32];
            reader.read_exact(&mut salt)?;
            raw_header_bytes.extend_from_slice(&salt);

            let share_len = reader.read_u16::<LittleEndian>()? as usize;
            raw_header_bytes.extend_from_slice(&(share_len as u16).to_le_bytes());
            let mut encrypted_share = vec![0u8; share_len];
            reader.read_exact(&mut encrypted_share)?;
            raw_header_bytes.extend_from_slice(&encrypted_share);

            custodians.push(CustodianDescriptor {
                custodian_id,
                auth_type,
                label,
                salt,
                encrypted_share,
            });
        }

        let signature_block = if version >= FORMAT_VERSION_2 {
            let has_sig_byte = reader.read_u8()?;
            raw_header_bytes.push(has_sig_byte);
            if has_sig_byte == 1 {
                let sig_len = reader.read_u16::<LittleEndian>()? as usize;
                raw_header_bytes.extend_from_slice(&(sig_len as u16).to_le_bytes());
                let mut sig_buf = vec![0u8; sig_len];
                reader.read_exact(&mut sig_buf)?;
                raw_header_bytes.extend_from_slice(&sig_buf);
                let sig: DencSignatureBlock = serde_json::from_slice(&sig_buf)
                    .map_err(|e| DencError::Custom(format!("Failed to parse signature block: {e}")))?;
                Some(sig)
            } else {
                None
            }
        } else {
            None
        };

        let digest: [u8; 32] = Sha256::digest(&raw_header_bytes).into();
        let total_bytes = raw_header_bytes.len();

        Ok((
            DencHeader {
                version,
                cipher_suite,
                kdf_id,
                threshold_k,
                total_n,
                chunk_size,
                master_salt,
                base_nonce,
                custodians,
                signature_block,
            },
            digest,
            total_bytes,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn test_header_serialization_roundtrip() {
        let header = DencHeader {
            version: 1,
            cipher_suite: CipherSuite::Aes256Gcm,
            kdf_id: 1,
            threshold_k: 2,
            total_n: 3,
            chunk_size: 65536,
            master_salt: [0x11u8; 32],
            base_nonce: [0x22u8; 24],
            custodians: vec![
                CustodianDescriptor {
                    custodian_id: 1,
                    auth_type: AuthType::Passphrase,
                    label: "Party 1 (Primary Recipient)".to_string(),
                    salt: [0x33u8; 32],
                    encrypted_share: vec![1, 2, 3, 4, 5],
                },
                CustodianDescriptor {
                    custodian_id: 2,
                    auth_type: AuthType::KeyFile,
                    label: "Party 2 (Disaster Escrow)".to_string(),
                    salt: [0x44u8; 32],
                    encrypted_share: vec![],
                },
            ],
            signature_block: None,
        };

        let (bytes, digest1) = header.serialize().expect("Serialization failed");
        let mut cursor = Cursor::new(&bytes);
        let (parsed_header, digest2, bytes_read) =
            DencHeader::deserialize(&mut cursor).expect("Deserialization failed");

        assert_eq!(header, parsed_header);
        assert_eq!(digest1, digest2);
        assert_eq!(bytes.len(), bytes_read);
    }

    #[test]
    fn test_header_v2_signature_block_roundtrip() {
        let header = DencHeader {
            version: 2,
            cipher_suite: CipherSuite::XChaCha20Poly1305,
            kdf_id: 1,
            threshold_k: 2,
            total_n: 2,
            chunk_size: 65536,
            master_salt: [0x55u8; 32],
            base_nonce: [0x66u8; 24],
            custodians: vec![CustodianDescriptor {
                custodian_id: 1,
                auth_type: AuthType::PostQuantum,
                label: "Alice - CSO".to_string(),
                salt: [0x77u8; 32],
                encrypted_share: vec![],
            }],
            signature_block: Some(DencSignatureBlock {
                algorithm: "NIST-FIPS-204-ML-DSA-65".to_string(),
                author_label: "Alice - Chief Security Officer".to_string(),
                author_public_key_base64: "MII...test...pubkey".to_string(),
                signature_base64: "MII...test...sig".to_string(),
            }),
        };

        let (bytes, digest1) = header.serialize().expect("Serialization failed");
        let mut cursor = Cursor::new(&bytes);
        let (parsed_header, digest2, bytes_read) =
            DencHeader::deserialize(&mut cursor).expect("Deserialization failed");

        assert_eq!(header, parsed_header);
        assert_eq!(digest1, digest2);
        assert_eq!(bytes.len(), bytes_read);
        assert!(parsed_header.signature_block.is_some());
    }
}
