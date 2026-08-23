# 🛡️ DualCrypt Enterprise

> **Zero-Trust Multi-Party Threshold File Encryption & Disaster Escrow Platform**  
> Engineered with **Rust (`denc-core`, `denc-cli`, `denc-wasm`)**, **Tauri v2**, **React 19**, and **Tailwind CSS**.

---

## 🌟 Executive Overview

**DualCrypt Enterprise** is a high-assurance, zero-trust cryptographic system designed for organizations where sensitive data must **never be controlled by a single individual**. 

Traditional encryption creates a dangerous single point of failure: if one password is leaked, data is compromised; if that person leaves or loses the key, data is permanently lost. **DualCrypt** solves this by implementing **$k$-of-$n$ threshold secret sharing** alongside streaming Authenticated Encryption with Associated Data (AEAD) and **NIST FIPS 203 Post-Quantum Cryptography**.

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
    |       |       |       |                                  |
 Cust 1  Cust 2  Cust 3  Cust 4                                v
 (Pass)  (.dkey) (Yubi)  (ML-KEM)                     [ Authenticated .denc ]
```

---

## 🔐 Core Cryptographic Architecture

| Component | Standard / Primitive | Cryptographic Guarantee |
| :--- | :--- | :--- |
| **Symmetric Bulk Encryption** | **AES-256-GCM** / **XChaCha20-Poly1305** | 256-bit entropy, 128-bit post-quantum security against Grover's algorithm. |
| **Stream Integrity Framing** | **Chunked AEAD (64 KiB chunks)** | Header SHA-256 digest bound to chunk AAD counter + final chunk flag; prevents byte tampering, reordering, and truncation. |
| **Threshold Secret Sharing** | **Shamir's Scheme over $\text{GF}(256)$** | Information-Theoretically Secure polynomial interpolation ($x^8 + x^4 + x^3 + x + 1$); holding $<k$ shares reveals $0$ bits of master key. |
| **Post-Quantum Encapsulation** | **NIST FIPS 203 ML-KEM-768 (Kyber)** | Lattice-based Module Learning with Errors (M-LWE); quantum-safe asymmetric key encapsulation for custodians. |
| **Container Origin Authentication** | **NIST FIPS 204 Signatures (Dilithium)** | Post-quantum tamper-evident container signatures over canonical header digest. |
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
|    - Custodian ID (1B) | Auth Type (1B: 0x01..0x04)           |
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

* **⚛️ NIST FIPS 203 Post-Quantum Cryptography (ML-KEM-768)**:
  * Armored public/private key generation for quantum-resistant share exchange.
  * Recipient custodians can encapsulate shares with their public key without pre-sharing passwords.
* **🌐 Zero-Knowledge WebAssembly (Wasm) Engine (`crates/denc-wasm`)**:
  * Direct in-browser cryptographic engine compiling pure Rust core to WebAssembly.
  * Zero server-side plaintext exposure: 100% of cryptography executes within browser memory.
* **💻 Headless CLI (`denc-cli`)**: Standalone command-line binary `denc` for server backups, automation scripts, and CI/CD pipelines.
* **⚛️ NIST FIPS 203 ML-KEM-768 Post-Quantum Key Encapsulation**: Quantum-safe asymmetric share encapsulation protecting against "Harvest Now, Decrypt Later" quantum adversary attacks.
* **⚡ 1-Click Streamlined Slot Setup**: Standardized 1-click slot confirmation across Passphrase, Key File, YubiKey, and Post-Quantum modes.
* **🔐 Optional PIN / Passphrase Protection for Key Files**: Exported `.dkey` (SSS) and `.pqc` (ML-KEM-768) files can be PIN-protected via Argon2id key derivation and authenticated AES-256-GCM encryption.
* **📦 Bulk Key Packaging & Direct Dispatch**: Export all custodian keys in a single ZIP archive (`.zip`) with `README_CUSTODIAN_KEYS.txt`, copy Base64 public/private keys directly to the clipboard, or dispatch via SMTP email with custom instructions.
* **🌐 Embedded Zero-Knowledge Web Server**: Self-host locally from the desktop app or run headlessly via CLI (`denc serve`) with flexible interface binding:
  * `🔒 Localhost Only (127.0.0.1)` for local-machine security.
  * `🌐 Local LAN (0.0.0.0)` for team access across local subnet/Wi-Fi.
* **⚙️ Enterprise Settings Sidebar**: 2-column sidebar navigation organizing Email/SMTP, Local Web Server, Hardware/YubiKey, and Cryptographic Defaults.
* **🛡️ $k$-of-$n$ Quorum Flexibility**: Configure strict dual-custody (2-of-2), majority board quorums (3-of-5), or disaster escrow models (2-of-3).
* **⚡ High-Throughput Streaming**: Processes gigabyte-scale files at disk speeds with constant $O(1)$ memory consumption ($<20\text{ MB}$ RAM).
* **📁 Directory & Folder Archiving**: Native streaming TAR bundling to encrypt entire directory hierarchies seamlessly into a single `.denc` container.
* **🔑 Hardware Token & YubiKey Support**: Real physical USB device scanning (`VID_1050`) with an explicit 4-way selector (`[ Passphrase ]`, `[ Key File ]`, `[ YubiKey ]`, `[ ⚛️ PQC KEM ]`).

---

## ☁️ 100% Free Public Web Hosting (GitHub Pages & Cloudflare Pages)

Because DualCrypt uses a **Zero-Knowledge client-side WebAssembly architecture**, the entire application can be hosted for free with unlimited bandwidth on static web hosting providers.

### 1. GitHub Pages (Automated via GitHub Actions)
A pre-configured CI/CD workflow is included at `.github/workflows/deploy-pages.yml`.
1. Push your repository to GitHub.
2. In your repo, go to **Settings** → **Pages** → **Build and deployment**.
3. Under **Source**, select **GitHub Actions**.
4. The workflow will automatically compile the Rust Wasm engine, build the Vite frontend, and deploy to `https://<username>.github.io/<repo>/`.

### 2. Cloudflare Pages
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/) and navigate to **Workers & Pages**.
2. Click **Create Application** → **Pages** → **Connect to Git**.
3. Set the build configuration:
   * **Framework Preset**: `Vite`
   * **Build command**: `bun run build`
   * **Build output directory**: `dist`
4. Click **Save and Deploy**. Your Zero-Knowledge decryptor is live worldwide on Cloudflare's global edge.

---

## 💻 Standalone CLI Tool (`denc`)

DualCrypt provides a native command-line utility for automation and headless server environments:

```bash
# 1. Encrypt a file with 2-of-2 dual custody
denc encrypt secret_backup.tar.gz -o backup.denc -k 2 -n 2 -p 1:CustOnePass -p 2:CustTwoPass

# 2. Encrypt an entire directory and export keyfiles (.dkey)
denc encrypt ./data_vault/ -o vault.denc -k 2 -n 3 --key-dir ./keys/

# 3. Decrypt a container with passphrases & key files
denc decrypt backup.denc -o restored_backup.tar.gz -p 1:CustOnePass -p 2:CustTwoPass

# 4. Inspect container metadata without decrypting
denc inspect backup.denc

# 5. Launch the embedded web server on custom interface & port
denc serve --host 0.0.0.0 --port 8080
```

---

## 🗺️ Product Roadmap

### 🟢 Phase 1: Air-Gapped Co-Presence & Mobile
- [ ] **Dynamic Animated QR Handshake**: Challenge-response animated QR code generator/scanner enabling 100% air-gapped custodian sign-off via offline mobile devices.

### 🟡 Phase 2: Post-Quantum Cryptography (PQC)
- [x] **ML-KEM-768 (Kyber-768)**: NIST FIPS 203 public-key encapsulation for asynchronous custodian key distribution without pre-shared secrets. *(Completed)*
- [x] **ML-DSA-65 (Dilithium-3)**: NIST FIPS 204 post-quantum container signatures and verification. *(Completed)*

### 🔵 Phase 3: Governance & Shell Integration
- [ ] **Immutable Container Audit Trail**: Cryptographically signed audit manifests embedded in container headers with creation timestamps and custodian records.
- [x] **Headless CLI (`denc-cli`)**: Standalone binary for automated server backups, scripts, and CI/CD pipelines. *(Completed)*
- [x] **Embedded Local Web Server**: Workstation & CLI HTTP server with Localhost/LAN binding. *(Completed)*
- [ ] **Windows Explorer Context Menu**: Right-click shell extension integration ("Encrypt with DualCrypt Enterprise").

### 🟣 Phase 4: Client-Side Web Client
- [x] **Zero-Knowledge WebAssembly (Wasm)**: Direct in-browser decryptor compiled from `denc-core` without server-side plaintext exposure. *(Completed)*
- [x] **Free Static Web Hosting CI/CD**: 1-click GitHub Pages & Cloudflare Pages deployment workflows. *(Completed)*

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

# Run CLI directly
cargo run -p denc-cli -- --help
```

### Run Full Test Suite
```bash
cargo test --workspace
```
