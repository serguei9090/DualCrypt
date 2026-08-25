use crate::error::DencError;
use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use chacha20poly1305::XChaCha20Poly1305;
use chacha20poly1305::XNonce;
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use zeroize::Zeroize;

pub const DEFAULT_CHUNK_SIZE: usize = 64 * 1024; // 64 KiB
pub const TAG_SIZE: usize = 16; // 16 bytes AEAD authentication tag

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum CipherSuite {
    Aes256Gcm = 0x01,
    XChaCha20Poly1305 = 0x02,
}

impl TryFrom<u8> for CipherSuite {
    type Error = DencError;
    fn try_from(val: u8) -> Result<Self, Self::Error> {
        match val {
            0x01 => Ok(CipherSuite::Aes256Gcm),
            0x02 => Ok(CipherSuite::XChaCha20Poly1305),
            other => Err(DencError::UnsupportedCipher(other)),
        }
    }
}

/// Generates a random 24-byte base nonce.
pub fn generate_base_nonce() -> [u8; 24] {
    let mut nonce = [0u8; 24];
    OsRng.fill_bytes(&mut nonce);
    nonce
}

/// Computes a 12-byte per-chunk nonce for AES-256-GCM.
/// Nonce = BaseNonce[0..7] || counter (4B BE) || is_last (1B: 0x01 if final, 0x00 otherwise).
pub fn derive_aes_chunk_nonce(base_nonce: &[u8; 24], counter: u32, is_last: bool) -> [u8; 12] {
    let mut nonce = [0u8; 12];
    nonce[0..7].copy_from_slice(&base_nonce[0..7]);
    nonce[7..11].copy_from_slice(&counter.to_be_bytes());
    nonce[11] = if is_last { 0x01 } else { 0x00 };
    nonce
}

/// Computes a 24-byte per-chunk nonce for XChaCha20-Poly1305.
pub fn derive_xchacha_chunk_nonce(base_nonce: &[u8; 24], counter: u32, is_last: bool) -> [u8; 24] {
    let mut nonce = *base_nonce;
    nonce[19..23].copy_from_slice(&counter.to_be_bytes());
    nonce[23] = if is_last { 0x01 } else { 0x00 };
    nonce
}

/// Encrypts an input stream into an output stream chunk by chunk with authenticated framing.
pub fn encrypt_stream_chunks<R: Read, W: Write, F: FnMut(u64, u64)>(
    reader: &mut R,
    writer: &mut W,
    key: &[u8; 32],
    base_nonce: &[u8; 24],
    cipher_suite: CipherSuite,
    header_aad: &[u8],
    total_bytes: u64,
    chunk_size: usize,
    mut progress_cb: F,
    cancel_flag: Option<Arc<AtomicBool>>,
) -> Result<u64, DencError> {
    let mut buffer = vec![0u8; chunk_size];
    let mut chunk_counter: u32 = 0;
    let mut bytes_processed: u64 = 0;

    let aes_cipher = if cipher_suite == CipherSuite::Aes256Gcm {
        Some(Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key)))
    } else {
        None
    };

    let xchacha_cipher = if cipher_suite == CipherSuite::XChaCha20Poly1305 {
        Some(XChaCha20Poly1305::new(chacha20poly1305::Key::from_slice(
            key,
        )))
    } else {
        None
    };

    // Buffer one chunk ahead to accurately detect the final chunk (is_last)
    let mut current_chunk_len = read_full_chunk(reader, &mut buffer)?;

    // If empty file, write one empty final chunk
    if current_chunk_len == 0 {
        let is_last = true;
        let mut aad = Vec::with_capacity(header_aad.len() + 5);
        aad.extend_from_slice(header_aad);
        aad.extend_from_slice(&chunk_counter.to_be_bytes());
        aad.push(0x01);

        let ciphertext = match cipher_suite {
            CipherSuite::Aes256Gcm => {
                let nonce = derive_aes_chunk_nonce(base_nonce, chunk_counter, is_last);
                let payload = Payload {
                    msg: &[],
                    aad: &aad,
                };
                aes_cipher
                    .as_ref()
                    .unwrap()
                    .encrypt(Nonce::from_slice(&nonce), payload)
                    .map_err(|_| DencError::IntegrityCheckFailed)?
            }
            CipherSuite::XChaCha20Poly1305 => {
                let nonce = derive_xchacha_chunk_nonce(base_nonce, chunk_counter, is_last);
                let payload = Payload {
                    msg: &[],
                    aad: &aad,
                };
                xchacha_cipher
                    .as_ref()
                    .unwrap()
                    .encrypt(XNonce::from_slice(&nonce), payload)
                    .map_err(|_| DencError::IntegrityCheckFailed)?
            }
        };

        writer.write_all(&(ciphertext.len() as u32).to_le_bytes())?;
        writer.write_all(&ciphertext)?;
        progress_cb(0, 0);
        return Ok(0);
    }

    let mut next_buffer = vec![0u8; chunk_size];

    loop {
        if let Some(ref flag) = cancel_flag {
            if flag.load(Ordering::Relaxed) {
                buffer.zeroize();
                next_buffer.zeroize();
                return Err(DencError::Cancelled);
            }
        }

        let next_chunk_len = read_full_chunk(reader, &mut next_buffer)?;
        let is_last = next_chunk_len == 0;

        let mut aad = Vec::with_capacity(header_aad.len() + 5);
        aad.extend_from_slice(header_aad);
        aad.extend_from_slice(&chunk_counter.to_be_bytes());
        aad.push(if is_last { 0x01 } else { 0x00 });

        let plaintext_slice = &buffer[..current_chunk_len];

        let ciphertext = match cipher_suite {
            CipherSuite::Aes256Gcm => {
                let nonce = derive_aes_chunk_nonce(base_nonce, chunk_counter, is_last);
                let payload = Payload {
                    msg: plaintext_slice,
                    aad: &aad,
                };
                aes_cipher
                    .as_ref()
                    .unwrap()
                    .encrypt(Nonce::from_slice(&nonce), payload)
                    .map_err(|_| DencError::IntegrityCheckFailed)?
            }
            CipherSuite::XChaCha20Poly1305 => {
                let nonce = derive_xchacha_chunk_nonce(base_nonce, chunk_counter, is_last);
                let payload = Payload {
                    msg: plaintext_slice,
                    aad: &aad,
                };
                xchacha_cipher
                    .as_ref()
                    .unwrap()
                    .encrypt(XNonce::from_slice(&nonce), payload)
                    .map_err(|_| DencError::IntegrityCheckFailed)?
            }
        };

        // Write chunk header: [CiphertextLen (u32 LE)] [Ciphertext with Tag]
        writer.write_all(&(ciphertext.len() as u32).to_le_bytes())?;
        writer.write_all(&ciphertext)?;

        bytes_processed += current_chunk_len as u64;
        progress_cb(bytes_processed, total_bytes);

        if is_last {
            break;
        }

        // Advance to next chunk
        std::mem::swap(&mut buffer, &mut next_buffer);
        current_chunk_len = next_chunk_len;
        chunk_counter += 1;
    }

    buffer.zeroize();
    next_buffer.zeroize();
    Ok(bytes_processed)
}

/// Decrypts an authenticated encrypted stream chunk by chunk.
pub fn decrypt_stream_chunks<R: Read, W: Write, F: FnMut(u64, u64)>(
    reader: &mut R,
    writer: &mut W,
    key: &[u8; 32],
    base_nonce: &[u8; 24],
    cipher_suite: CipherSuite,
    header_aad: &[u8],
    total_cipher_bytes: u64,
    mut progress_cb: F,
    cancel_flag: Option<Arc<AtomicBool>>,
) -> Result<u64, DencError> {
    let mut chunk_counter: u32 = 0;
    let mut total_decrypted_bytes: u64 = 0;
    let mut bytes_read: u64 = 0;
    let mut saw_final_chunk = false;

    let aes_cipher = if cipher_suite == CipherSuite::Aes256Gcm {
        Some(Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key)))
    } else {
        None
    };

    let xchacha_cipher = if cipher_suite == CipherSuite::XChaCha20Poly1305 {
        Some(XChaCha20Poly1305::new(chacha20poly1305::Key::from_slice(
            key,
        )))
    } else {
        None
    };

    let mut len_buf = [0u8; 4];

    while !saw_final_chunk {
        if let Some(ref flag) = cancel_flag {
            if flag.load(Ordering::Relaxed) {
                return Err(DencError::Cancelled);
            }
        }

        match reader.read_exact(&mut len_buf) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => {
                return Err(DencError::PrematureStreamEnd);
            }
            Err(e) => return Err(DencError::Io(e)),
        }

        let chunk_len = u32::from_le_bytes(len_buf) as usize;
        if chunk_len < TAG_SIZE {
            return Err(DencError::IntegrityCheckFailed);
        }

        let mut cipher_chunk = vec![0u8; chunk_len];
        reader.read_exact(&mut cipher_chunk)?;
        bytes_read += 4 + chunk_len as u64;

        // Try decrypting as intermediate chunk (is_last = false) first; if fail, try as final chunk (is_last = true)
        let mut plaintext = None;

        for &is_last in &[false, true] {
            let mut aad = Vec::with_capacity(header_aad.len() + 5);
            aad.extend_from_slice(header_aad);
            aad.extend_from_slice(&chunk_counter.to_be_bytes());
            aad.push(if is_last { 0x01 } else { 0x00 });

            let decrypted = match cipher_suite {
                CipherSuite::Aes256Gcm => {
                    let nonce = derive_aes_chunk_nonce(base_nonce, chunk_counter, is_last);
                    let payload = Payload {
                        msg: &cipher_chunk,
                        aad: &aad,
                    };
                    aes_cipher
                        .as_ref()
                        .unwrap()
                        .decrypt(Nonce::from_slice(&nonce), payload)
                }
                CipherSuite::XChaCha20Poly1305 => {
                    let nonce = derive_xchacha_chunk_nonce(base_nonce, chunk_counter, is_last);
                    let payload = Payload {
                        msg: &cipher_chunk,
                        aad: &aad,
                    };
                    xchacha_cipher
                        .as_ref()
                        .unwrap()
                        .decrypt(XNonce::from_slice(&nonce), payload)
                }
            };

            if let Ok(data) = decrypted {
                plaintext = Some((data, is_last));
                break;
            }
        }

        let (mut data, is_last) = plaintext.ok_or(DencError::IntegrityCheckFailed)?;
        writer.write_all(&data)?;
        total_decrypted_bytes += data.len() as u64;
        data.zeroize();

        progress_cb(bytes_read, total_cipher_bytes);

        if is_last {
            saw_final_chunk = true;
            break;
        }

        chunk_counter += 1;
    }

    if !saw_final_chunk {
        return Err(DencError::PrematureStreamEnd);
    }

    Ok(total_decrypted_bytes)
}

fn read_full_chunk<R: Read>(reader: &mut R, mut buf: &mut [u8]) -> Result<usize, DencError> {
    let mut total_read = 0;
    while !buf.is_empty() {
        match reader.read(buf) {
            Ok(0) => break,
            Ok(n) => {
                total_read += n;
                let tmp = buf;
                buf = &mut tmp[n..];
            }
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(e) => return Err(DencError::Io(e)),
        }
    }
    Ok(total_read)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn test_aes_streaming_roundtrip() {
        let key = [0x77u8; 32];
        let base_nonce = generate_base_nonce();
        let header_aad = b"TEST_HEADER_AAD_V1";
        let plaintext =
            b"Hello, Enterprise Cryptographic World! Streaming 64KB+ chunk test.".repeat(1000);

        let mut encrypted_output = Vec::new();
        let total_len = plaintext.len() as u64;

        encrypt_stream_chunks(
            &mut Cursor::new(&plaintext),
            &mut encrypted_output,
            &key,
            &base_nonce,
            CipherSuite::Aes256Gcm,
            header_aad,
            total_len,
            1024, // Small chunks for test
            |_, _| {},
            None,
        )
        .expect("Encryption failed");

        let mut decrypted_output = Vec::new();
        let cipher_len = encrypted_output.len() as u64;

        decrypt_stream_chunks(
            &mut Cursor::new(&encrypted_output),
            &mut decrypted_output,
            &key,
            &base_nonce,
            CipherSuite::Aes256Gcm,
            header_aad,
            cipher_len,
            |_, _| {},
            None,
        )
        .expect("Decryption failed");

        assert_eq!(plaintext, decrypted_output.as_slice());
    }

    #[test]
    fn test_xchacha20_streaming_roundtrip() {
        let key = [0x88u8; 32];
        let base_nonce = generate_base_nonce();
        let header_aad = b"TEST_HEADER_AAD_XCHACHA";
        let plaintext = b"XChaCha20-Poly1305 Enterprise Roundtrip Validation.".repeat(500);

        let mut encrypted_output = Vec::new();
        let total_len = plaintext.len() as u64;

        encrypt_stream_chunks(
            &mut Cursor::new(&plaintext),
            &mut encrypted_output,
            &key,
            &base_nonce,
            CipherSuite::XChaCha20Poly1305,
            header_aad,
            total_len,
            2048,
            |_, _| {},
            None,
        )
        .expect("Encryption failed");

        let mut decrypted_output = Vec::new();
        let cipher_len = encrypted_output.len() as u64;

        decrypt_stream_chunks(
            &mut Cursor::new(&encrypted_output),
            &mut decrypted_output,
            &key,
            &base_nonce,
            CipherSuite::XChaCha20Poly1305,
            header_aad,
            cipher_len,
            |_, _| {},
            None,
        )
        .expect("Decryption failed");

        assert_eq!(plaintext, decrypted_output.as_slice());
    }

    #[test]
    fn test_tampered_ciphertext_fails() {
        let key = [0x55u8; 32];
        let base_nonce = generate_base_nonce();
        let header_aad = b"TEST_AAD";
        let plaintext = b"Strict tamper-resistance test.";

        let mut encrypted_output = Vec::new();
        encrypt_stream_chunks(
            &mut Cursor::new(&plaintext),
            &mut encrypted_output,
            &key,
            &base_nonce,
            CipherSuite::Aes256Gcm,
            header_aad,
            plaintext.len() as u64,
            64,
            |_, _| {},
            None,
        )
        .unwrap();

        // Tamper with a byte in the encrypted stream
        let tamper_idx = encrypted_output.len() - 5;
        encrypted_output[tamper_idx] ^= 0xFF;

        let mut decrypted_output = Vec::new();
        let res = decrypt_stream_chunks(
            &mut Cursor::new(&encrypted_output),
            &mut decrypted_output,
            &key,
            &base_nonce,
            CipherSuite::Aes256Gcm,
            header_aad,
            encrypted_output.len() as u64,
            |_, _| {},
            None,
        );

        assert!(matches!(res, Err(DencError::IntegrityCheckFailed)));
    }
}
