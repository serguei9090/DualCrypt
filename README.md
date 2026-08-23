# 🛡️ DualCrypt Enterprise

> **Zero-Trust Multi-Party Threshold File Encryption & Disaster Escrow Platform**  
> Engineered with **Rust (`denc-core`)**, **Tauri v2**, **React 19**, and **Tailwind CSS**.

---

## 🌟 Executive Overview

**DualCrypt Enterprise** is a high-assurance, zero-trust cryptographic system designed for organizations where sensitive data must **never be controlled by a single individual**. 

Traditional encryption creates a dangerous single point of failure: if one password is leaked, data is compromised; if that person leaves or loses the key, data is permanently lost. **DualCrypt** solves this by implementing **$k$-of-$n$ threshold secret sharing** alongside streaming Authenticated Encryption with Associated Data (AEAD).

```
                      +-----------------------------+
                      |   Source File (Plaintext)   |
                      +-----------------------------+
                                     |
                [ Random 256-bit Ephemeral Master DEK ]
                                     |
           +-------------------------+-------------------------+
           |                                                   |
           v                                                   v
+-----------------------+                         +-------------------------+
|  Shamir Secret Split  |                         | Streaming AEAD Pipeline |
|       GF(256)         |                         |  (AES-256-GCM / XChaCha)|
+-----------------------+                         +-------------------------+
    |       |       |                                          |
 Cust 1  Cust 2  Cust 3 (Escrow)                               v
 (Pass)  (.dkey) (.dkey)                          [ Authenticated .denc ]
```

---

## 🔐 Core Cryptographic Architecture

| Component | Standard / Primitive | Cryptographic Guarantee |
| :--- | :--- | :--- |
| **Symmetric Bulk Encryption** | **AES-256-GCM** / **XChaCha20-Poly1305** | 256-bit entropy, 128-bit post-quantum security against Grover's algorithm. |
| **Stream Integrity Framing** | **Chunked AEAD (64 KiB chunks)** | Header SHA-256 digest bound to chunk AAD counter + final chunk flag; prevents byte tampering, reordering, and truncation. |
| **Threshold Secret Sharing** | **Shamir's Scheme over $\text{GF}(256)$** | Information-Theoretically Secure polynomial interpolation ($x^8 + x^4 + x^3 + x + 1$); holding $<k$ shares reveals $0$ bits of master key. |
| **Side-Channel Resistance** | **Constant-Time Russian Peasant Multiplication** | Zero table lookups or data-dependent branching in finite field operations. |
| **Key Derivation (KDF)** | **Argon2id** ($m=64\text{ MB}, t=3, p=4$) | RFC 9106 memory-hard KDF resistant to GPU/ASIC brute-force attacks. |
| **Memory Hygiene** | **`Zeroize` & `ZeroizeOnDrop`** | Master DEKs, intermediate keys, and reconstructed shares are purged from RAM immediately on drop. |

---

## 📦 Container Binary Format (`.denc`)

The `.denc` container encapsulates the metadata and chunked authenticated stream in a single binary envelope:

```
+---------------------------------------------------------------+
| Magic Bytes "DENC" (4B) | Version (2B) | Cipher ID (1B)       |
+---------------------------------------------------------------+
| KDF ID (1B) | Threshold K (1B) | Total N (1B) | Chunk Size(4B)|
+---------------------------------------------------------------+
| Master Salt (32B) | Base Nonce (24B)                          |
+---------------------------------------------------------------+
| Custodian Count (2B)                                          |
|  [ For each custodian: ]                                      |
|    - Custodian ID (1B) | Auth Type (1B)                       |
|    - Label Length (2B) | Label UTF-8 Bytes                    |
|    - Custodian Salt (32B)                                     |
|    - Encrypted Share Length (2B) | Ciphertext Bytes           |
+---------------------------------------------------------------+
| Chunk 0: [ Length (4B LE) ] [ AES-GCM Ciphertext + 16B Tag ]  |
| Chunk 1: [ Length (4B LE) ] [ AES-GCM Ciphertext + 16B Tag ]  |
| ...                                                           |
| Chunk M (Final): [ Length (4B LE) ] [ Final Tag ]             |
+---------------------------------------------------------------+
```

---

## 🚀 Key Features

* **🛡️ $k$-of-$n$ Quorum Flexibility**: Configure strict dual-custody (2-of-2), majority board quorums (3-of-5), or disaster escrow models (2-of-3).
* **⚡ High-Throughput Streaming**: Processes gigabyte-scale files at disk speeds with constant $O(1)$ memory consumption ($<20\text{ MB}$ RAM).
* **🔑 Key Escrow & Share Management**: Export keys as standalone `.dkey` files, zip archives with automated README instructions, or embed them directly inside the `.denc` container protected by Argon2id passphrases.
* **🛑 Instant Job Cancellation**: Thread-safe atomic cancellation tokens allow aborting in-flight encryption/decryption jobs without leaving corrupt artifacts.

---

## 🗺️ Product Roadmap

### 🟢 Phase 1: Near-Term Enhancements (Low & Medium Complexity)
- [ ] **PIN-Protected `.dkey` Key Exports**: Option to encrypt exported `.dkey` files with a local password/PIN using Argon2id + AES-256-GCM.
- [ ] **Folder & Multi-File Archiving**: Native in-memory TAR packaging to encrypt entire folders and directories into a single `.denc` file.
- [ ] **Settings Tab & Integrated SMTP Email Dispatch**: Built-in SMTP server configuration (Host, Port, STARTTLS/SSL, Credentials) allowing direct email delivery of `.dkey` shares to authorized custodians upon encryption completion.
- [ ] **YubiKey / FIDO2 Hardware Token Support**: Authorize custodian shares using WebAuthn / PKCS#11 hardware keys (HMAC-SHA1 challenge-response or FIDO2 credentials).

### 🟡 Phase 2: Advanced Co-Presence & Interoperability
- [ ] **Air-Gapped Mobile QR Handshake**: Dynamic animated QR code generator/scanner for zero-network mobile device share approval.
- [ ] **Post-Quantum Hybrid KEM (ML-KEM / Kyber-768)**: NIST FIPS 203 public-key encapsulation for asynchronous custodian key distribution.
- [ ] **Tamper-Proof Audit Logging**: Cryptographically signed audit manifests embedded in container headers.
- [ ] **Standalone Headless CLI (`denc-cli`)**: Command-line binary for automated server backups and CI/CD pipelines.

---

## 🌐 API Feasibility Analysis: Should DualCrypt Provide an API?

When considering whether to expose an API for DualCrypt, we must weigh enterprise integration against zero-trust threat models:

| Architecture Model | Pros | Cons / Risks | Recommendation |
| :--- | :--- | :--- | :--- |
| **Option A: Local Headless CLI / Local Named Pipe IPC** | • 100% Zero-Network attack surface.<br>• Perfect for CI/CD, backup scripts, and local service automation.<br>• No plaintext keys over HTTP. | • Requires local binary installation on target machines. | **✅ Highly Recommended** |
| **Option B: Embedded Rust Crate / C-FFI / Wasm Library** | • In-process zero-overhead integration into existing apps.<br>• Compiles to WebAssembly for zero-knowledge web clients. | • Requires developers to write integration code in their language. | **✅ Already Implemented (`denc-core`)** |
| **Option C: Centralized Remote REST / gRPC Server** | • Easy remote trigger from webhooks or backend services. | • **Violates Zero-Trust**: Plaintext files or master key shares would transit a central network daemon.<br>• Major honeypot target for attackers. | **❌ Strongly Discouraged** (Except as an air-gapped KMS plugin). |

### Conclusion on API:
DualCrypt should prioritize a **Local Headless CLI (`denc-cli`)** and **Wasm/C-FFI SDK** rather than a remote cloud HTTP API, ensuring that **private data and secret shares never touch an unauthenticated network server**.

---

## 🛠️ Development & Building

### Prerequisites
* **Rust**: `1.80+` (with `cargo`)
* **Bun**: `1.0+`
* **Biome**: Globally installed (`biome check --write .`)

### Run Locally
```bash
# Install frontend dependencies
bun install

# Run desktop application in development mode
bun run tauri dev
```

### Run Core Cryptographic Tests
```bash
cargo test --workspace
```
