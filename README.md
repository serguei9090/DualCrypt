# 🛡️ DualCrypt Enterprise

> **Zero-Trust Multi-Party Threshold File Encryption & Disaster Escrow Platform**  
> Engineered with **Rust (`denc-core`)**, **Tauri v2**, **React 19**, and **Tailwind CSS**.

---

## 🌟 Executive Overview

**DualCrypt Enterprise** is a high-assurance, zero-trust cryptographic system designed for organizations where sensitive data must **never be controlled by a single individual**. 

Traditional encryption creates a dangerous single point of failure: if one password is leaked, data is compromised; if that person leaves or loses the key, data is permanently lost. **DualCrypt** solves this by implementing **$k$-of-$n$ threshold secret sharing** alongside streaming Authenticated Encryption with Associated Data (AEAD).

```
                      +-----------------------------+
                      |   Source File / Directory   |
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
 (Pass)  (.dkey) (YubiKey)                        [ Authenticated .denc ]
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
| **Hardware Token Security** | **Physical YubiKey USB Detection (VID 0x1050)** | Direct hardware root-of-trust authentication requiring physical capacitive touch. |
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

## 🚀 Live Features

* **🛡️ $k$-of-$n$ Quorum Flexibility**: Configure strict dual-custody (2-of-2), majority board quorums (3-of-5), or disaster escrow models (2-of-3).
* **⚡ High-Throughput Streaming**: Processes gigabyte-scale files at disk speeds with constant $O(1)$ memory consumption ($<20\text{ MB}$ RAM).
* **📁 Directory & Folder Archiving**: Native streaming TAR bundling to encrypt entire directory hierarchies seamlessly into a single `.denc` container.
* **🔐 PIN-Protected `.dkey` Key Shares**: Exported key share files can be encrypted with an optional PIN/password using Argon2id + AES-256-GCM.
* **⚙️ Settings Tab & Integrated SMTP Email Relay**: Configure custom SMTP relay servers (Host, Port, STARTTLS/TLS, Credentials) with interactive test-send diagnostics and encrypted local OS storage.
* **📧 One-Click Custodian Email Dispatch**: Directly dispatch `.dkey` shares and instructions to authorized custodians from the completion screen.
* **🔑 Hardware Token & YubiKey Support**: Real physical USB device scanning (`VID_1050`) with an explicit 3-way selector (`[ Passphrase ]`, `[ Key File ]`, `[ YubiKey ]`) and a developer simulator toggle.
* **🛑 Instant Job Cancellation**: Thread-safe atomic cancellation tokens allow aborting in-flight encryption/decryption jobs without leaving corrupt artifacts.

---

## 🗺️ Product Roadmap

### 🟢 Phase 1: Air-Gapped Co-Presence & Mobile
- [ ] **Dynamic Animated QR Handshake**: Challenge-response animated QR code generator/scanner enabling 100% air-gapped custodian sign-off via offline mobile devices.

### 🟡 Phase 2: Post-Quantum Cryptography (PQC)
- [ ] **ML-KEM-768 (Kyber-768)**: NIST FIPS 203 public-key encapsulation for asynchronous custodian key distribution without pre-shared secrets.
- [ ] **ML-DSA-65 (Dilithium-3)**: NIST FIPS 204 post-quantum digital signatures embedded in container headers for origin authentication and non-repudiation.

### 🔵 Phase 3: Governance, Automation & Shell Integration
- [ ] **Immutable Container Audit Trail**: Cryptographically signed audit manifests embedded in container headers with creation timestamps and custodian records.
- [ ] **Headless CLI (`denc-cli`)**: Standalone binary for automated server backups, scripts, and CI/CD pipelines.
- [ ] **Windows Explorer Context Menu**: Right-click shell extension integration ("Encrypt with DualCrypt Enterprise").

### 🟣 Phase 4: Client-Side Web Client
- [ ] **Zero-Knowledge WebAssembly (Wasm)**: Direct in-browser decryptor compiled from `denc-core` without server-side plaintext exposure.

---

## 🌐 API Feasibility Analysis: Should DualCrypt Provide an API?

| Architecture Model | Pros | Cons / Risks | Recommendation |
| :--- | :--- | :--- | :--- |
| **Option A: Local Headless CLI / Local Named Pipe IPC** | • 100% Zero-Network attack surface.<br>• Perfect for CI/CD, backup scripts, and local service automation.<br>• No plaintext keys over HTTP. | • Requires local binary installation on target machines. | **✅ Highly Recommended** |
| **Option B: Embedded Rust Crate / C-FFI / Wasm Library** | • In-process zero-overhead integration into existing apps.<br>• Compiles to WebAssembly for zero-knowledge web clients. | • Requires developers to write integration code in their language. | **✅ Already Implemented (`denc-core`)** |
| **Option C: Centralized Remote REST / gRPC Server** | • Easy remote trigger from webhooks or backend services. | • **Violates Zero-Trust**: Plaintext files or master key shares would transit a central network daemon.<br>• Major honeypot target for attackers. | **❌ Strongly Discouraged** (Except as an air-gapped KMS plugin). |

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
