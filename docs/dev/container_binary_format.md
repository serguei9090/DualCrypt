# 📦 `.denc` Container Binary Format Specification

This document provides the byte-level binary specification for the authenticated `.denc` container format (Format Version 1 and Version 2).

---

## 📑 Contents
1. [Overall Container Byte Map](#1-overall-container-byte-map)
2. [Fixed Header Fields](#2-fixed-header-fields)
3. [Custodian Descriptors Block](#3-custodian-descriptors-block)
4. [Format Version 2 Extensions (Signature & Manifest)](#4-format-version-2-extensions-signature--manifest)
5. [Payload Streaming Chunks Framing](#5-payload-streaming-chunks-framing)

---

## 1. Overall Container Byte Map

```
+===================================================================+
|                     AUTHENTICATED HEADER BLOCK                    |
+-------------------------------------------------------------------+
| Magic Bytes: "DENC" (4B: 0x44 0x45 0x4E 0x43)                     |
| Format Version (2B, Big Endian: 0x0001 or 0x0002)                 |
| Cipher Suite ID (1B: 0x01 = AES-256-GCM, 0x02 = XChaCha20)       |
| KDF Suite ID (1B: 0x01 = Argon2id)                                |
| Threshold K (1B) | Total N (1B)                                    |
| Chunk Size (4B, Big Endian: e.g. 65536)                           |
| Master Salt (32B)                                                 |
| Base Nonce (24B)                                                  |
| Custodian Count (2B, Big Endian)                                  |
|   [ Repeated for each Custodian 1..N ]                            |
|     - Custodian ID (1B)                                           |
|     - Auth Type (1B: 0x01=Passphrase, 0x02=KeyFile, 0x03=PQC)    |
|     - Label Length (2B, BE) + Label UTF-8 Bytes                   |
|     - Salt (32B)                                                  |
|     - Encrypted Share Length (2B, BE) + Ciphertext Bytes          |
|                                                                   |
| [ FORMAT V2 ONLY: Manifest & Signatures ]                         |
|   - Manifest Present Flag (1B: 0x01 or 0x00)                      |
|     [ If Present: Length (4B, BE) + Manifest JSON UTF-8 Bytes ]    |
|   - Signature Block Present Flag (1B: 0x01 or 0x00)               |
|     [ If Present: Length (4B, BE) + Signature JSON UTF-8 Bytes ]  |
+===================================================================+
|                     STREAMING PAYLOAD CHUNKS                      |
+-------------------------------------------------------------------+
| Chunk 0:                                                          |
|   - Ciphertext Byte Length (4B, Little Endian)                    |
|   - Ciphertext Bytes (Chunk Payload + 16B Poly1305/GCM Tag)       |
| Chunk 1:                                                          |
|   - Ciphertext Byte Length (4B, Little Endian)                    |
|   - Ciphertext Bytes (Chunk Payload + 16B Tag)                    |
| ...                                                               |
| Chunk M (Final Chunk):                                            |
|   - Ciphertext Byte Length (4B, Little Endian)                    |
|   - Final Ciphertext Bytes (Remaining Data + 16B Final Tag)       |
+===================================================================+
```

---

## 2. Fixed Header Fields

| Field | Offset | Size | Type | Description |
| :--- | :---: | :---: | :--- | :--- |
| `magic` | 0 | 4 bytes | `[u8; 4]` | ASCII `"DENC"` (`0x44 0x45 0x4E 0x43`) |
| `version` | 4 | 2 bytes | `u16` (BE) | `1` (Legacy Basic) or `2` (PQC Manifest & Signatures) |
| `cipher_id` | 6 | 1 byte | `u8` | `1` = AES-256-GCM, `2` = XChaCha20-Poly1305 |
| `kdf_id` | 7 | 1 byte | `u8` | `1` = Argon2id ($64\text{ MB}, t=3, p=4$) |
| `threshold_k` | 8 | 1 byte | `u8` | Minimum quorum shares required ($1 \le k \le 255$) |
| `total_n` | 9 | 1 byte | `u8` | Total shares created ($k \le n \le 255$) |
| `chunk_size` | 10 | 4 bytes | `u32` (BE) | Default: `65536` ($64\text{ KiB}$) |
| `master_salt` | 14 | 32 bytes | `[u8; 32]` | Container-wide master salt |
| `base_nonce` | 46 | 24 bytes | `[u8; 24]` | Base IV for deriving sequential chunk nonces |

---

## 3. Custodian Descriptors Block

Immediately following `base_nonce`:
* `custodian_count`: 2 bytes (`u16` BE).
* Repeated for each custodian $i \in \{1, \dots, n\}$:
  * `custodian_id`: 1 byte (`u8`).
  * `auth_type`: 1 byte (`0x01` = Passphrase, `0x02` = KeyFile / AirGap, `0x03` = PostQuantum ML-KEM).
  * `label_len`: 2 bytes (`u16` BE).
  * `label`: UTF-8 bytes of length `label_len`.
  * `salt`: 32 bytes (`[u8; 32]`).
  * `encrypted_share_len`: 2 bytes (`u16` BE).
  * `encrypted_share`: Bytes of length `encrypted_share_len`.

---

## 4. Format Version 2 Extensions (Signature & Manifest)

When `version == 2`:
1. **Manifest Flag**: 1 byte (`0x01` if present, `0x00` if absent).
   * If `0x01`: 4 bytes (`u32` BE) length followed by JSON UTF-8 payload encoding:
     ```json
     {
       "created_at_utc": 1771800000,
       "classification": "TOP_SECRET",
       "purpose": "Financial Audit Backup",
       "organization": "Enterprise SecOps",
       "custodian_timelocks": {
         "3": 1779577600
       }
     }
     ```
2. **Signature Block Flag**: 1 byte (`0x01` if present, `0x00` if absent).
   * If `0x01`: 4 bytes (`u32` BE) length followed by JSON UTF-8 payload encoding:
     ```json
     {
       "algorithm": "NIST-FIPS-204-ML-DSA-65",
       "author_label": "Alice - CISO",
       "author_public_key_base64": "...",
       "signature_base64": "..."
     }
     ```

---

## 5. Payload Streaming Chunks Framing

Following the header, raw ciphertext chunks are serialized sequentially:
* Each chunk begins with a 4-byte Little Endian integer (`u32` LE) indicating the byte length of the ciphertext chunk.
* Followed by the chunk payload ciphertext plus the 16-byte authentication tag (Poly1305 or GCM GHASH).
* The reader reads chunks until EOF. If the final chunk flag or authentication tag fails to verify against the canonical header AAD, the entire decryption is aborted.
