# 🛡️ DualCrypt Enterprise

> **Zero-Trust Multi-Party Threshold File Encryption & Disaster Escrow Platform**  
> Engineered with **Rust (`denc-core`, `denc-cli`, `denc-wasm`)**, **Tauri v2**, **React 19**, and **Tailwind CSS**.

[![GitHub Release](https://img.shields.io/github/v/release/serguei9090/DualCrypt?color=0ea5e9&label=Release)](https://github.com/serguei9090/DualCrypt/releases/latest)
[![CI / Quality Gate](https://github.com/serguei9090/DualCrypt/actions/workflows/ci.yml/badge.svg)](https://github.com/serguei9090/DualCrypt/actions/workflows/ci.yml)
[![Web Client](https://img.shields.io/badge/Web%20Client-Live%20Demo-10b981)](https://serguei9090.github.io/DualCrypt/)
[![License: DualCrypt 1.0](https://img.shields.io/badge/License-DualCrypt%20Source--Available%201.0-blue.svg)](LICENSE.md)

> [!NOTE]
> **Production Releases Ready**: Download pre-compiled native installers for Windows, macOS, Linux, and Android from the **[GitHub Releases Page](https://github.com/serguei9090/DualCrypt/releases/tag/v0.5.0)** or try the **[Zero-Knowledge Web Client](https://serguei9090.github.io/DualCrypt/)**.

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

## 📚 Documentation Hub

Detailed architectural specifications and operational manuals are available in the [`docs/`](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs) directory:

| Document | Description |
| :--- | :--- |
| **[📖 User Guide](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/USER_GUIDE.md)** | Complete step-by-step manual for desktop, mobile air-gap, and CLI workflows. |
| **[🏛️ System Architecture](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/ARCHITECTURE.md)** | Technical layout across Rust crates, Tauri v2 bridge, TypeScript ESM packages, and mobile Android targets. |
| **[🔐 Cryptographic Specification](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/CRYPTOGRAPHY_SPEC.md)** | Mathematical specifications for $GF(256)$ Shamir sharing, NIST FIPS 203/204 PQC, and AEAD framing. |
| **[📱 Android Testing & Store Guide](file:///i:/01-Master_Code/Apps/Dual_Encryption/androidtest.md)** | LAN testing, keystore signing, and building `.apk` / `.aab` for Google Play Store. |
| **[🔮 Enterprise Feature Roadmap](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/FUTURE_ROADMAP_SPEC.md)** | Detailed problem statements and technical specifications for upcoming roadmap milestones. |

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

* **📲 Dedicated Android Authenticator & Dynamic Optical Handshake**:
  * **Zero Code Duplication (`packages/shared-airgap`)**: Shared optical fountain protocol engine, CRC checksums, and schemas used by both Desktop and Android.
  * **Dedicated Android App (`apps/mobile-android`)**: 100% offline mobile authenticator built with Tauri v2 Android target.
  * **Biometric Hardware Protection & Master PIN**: First-launch setup prompt configuring Master PIN and hardware biometrics (Fingerprint / Face Unlock) to secure stored key shares.
  * **1-Click Phone Enrollment (`[ 📲 Scan to Phone (QR) ]`)**: When encrypting, scan the QR code to save the key directly to the phone's offline vault, organized by container filename and custodian role.
  * **1-Click Quorum Unlock (`[ 📲 QR ]`)**: In the Decrypt tab, tap `[ 📲 QR ]` on any custodian slot to launch the split-screen optical handshake and unlock via camera.
  * **On-Device Provenance Passport**: Displays security classification (`TOP SECRET 🔴`), issuing organization, and file name before signing release.
* **📋 Embedded Immutable Container Manifest & Governance Passport**:
  * Cryptographically signed governance metadata embedded directly inside `.denc` container headers.
  * **Security Classification Levels**: `TOP SECRET 🔴`, `CONFIDENTIAL 🟠`, `INTERNAL 🔵`, `RESTRICTED 🟣`, `GENERAL 🟢`.
  * **Governance Fields**: Purpose/Scope summary, Issuing Organization & Department, and UTC Creation Timestamp.
  * **Mathematical Tamper-Proof Binding**: Embedded in the header AAD digest and protected by NIST FIPS 204 ML-DSA-65 digital signatures.
  * **Interactive Provenance Passport**: Sleek high-contrast metadata passport rendered in the Decrypt tab, allowing custodians to verify classification and intent before authorizing quorum unlocking.
* **🔏 NIST FIPS 204 Digital Container Signatures (ML-DSA-65 / Dilithium)**:
  * Authors can digitally sign `.denc` containers using post-quantum ML-DSA-65 keys.
  * Mathematical origin authentication & anti-tampering verification over the canonical header digest before custodian unlocking.
  * Verified Author badge displayed in container inspection and unlock workflows.
* **📜 Operational Activity & Audit History Ledger**:
  * Persistent local ledger recording file operations, custodian counts, quorum configurations, and signature verification status.
  * Real-time search, filter pills (`All`, `Encrypted`, `Decrypted`), summary statistics, and one-click **CSV / JSON exports**.
  * Configurable environment switch (`VITE_ENABLE_AUDIT_HISTORY=true/false`) to disable persistence for public web or demo environments.
* **⚛️ NIST FIPS 203 Post-Quantum Cryptography (ML-KEM-768)**:
  * Armored public/private key generation for quantum-resistant share exchange.
  * Recipient custodians can encapsulate shares with their public key without pre-sharing passwords.
* **🌐 Zero-Knowledge WebAssembly (Wasm) Engine (`crates/denc-wasm`)**:
  * Direct in-browser cryptographic engine compiling pure Rust core to WebAssembly.
  * Zero server-side plaintext exposure: 100% of cryptography executes within browser memory.
* **💻 Headless CLI (`denc-cli`)**: Standalone command-line binary `denc` for server backups, automation scripts, and CI/CD pipelines.
* **🔑 Actionable Key Escrow & Post-Quantum Vault**:
  * **⚡ ML-KEM-768 & ML-DSA-65 Generators**: Create standalone quantum-resistant keypairs (`.pqc.pub` / `.pqc` and `.dsa.pub` / `.dsa`) with optional Argon2id PIN encryption.
  * **🌐 Shareable Public Keys & Certificates**: Export public keys to colleagues for future encryption jobs without sharing private secrets.
  * **🔍 Key Token & PIN Inspector**: Inspect `.dkey`, `.pqc`, and `.dsa` files offline and verify PIN unlocking directly in memory.
* **⚡ 1-Click Streamlined Slot Setup & Recipient Key Reuse**:
  * **`⚡ Auto-Generate` (1-Click)**: Instant auto-keypair generation for quick workflows.
  * **`📂 Use Recipient Key`**: Upload `.pqc.pub` or paste a colleague's public key to encrypt on their behalf.
* **🔐 Optional PIN / Passphrase Protection for Key Files**: Exported `.dkey` (SSS) and `.pqc` / `.dsa` files can be PIN-protected via Argon2id key derivation and authenticated AES-256-GCM encryption.
* **🎨 Standardized Cyber-Minimalist Enterprise Interface**:
  * **Unified Dark Palette**: Strict adherence to `#080B13` obsidian background, `slate-900` surface cards, and `slate-800` borders across all 5 navigation tabs.
  * **Typography Matrix**: `Inter` for clean high-contrast readability and `JetBrains Mono` for cryptographic fingerprints, key hashes, and container digests.
  * **Accessible Keyboard Navigation & ARIA**: Full WCAG 2.1 compliance with visible cyan focus rings (`focus-visible:ring-cyan-500`), live regions (`aria-live="polite"`), semantic `<section>` landmarks, and `progressbar` roles on threshold meters.
  * **Interactive Visual Feedback**: Smooth split-screen progress feedback for custodians, real-time threshold meters, and glowing status pills for tamper-evident provenance.
* **📦 Bulk Key Packaging & Direct Dispatch**: Export all custodian keys in a single ZIP archive (`.zip`) with `README_CUSTODIAN_KEYS.txt`, copy Base64 public/private keys directly to the clipboard, or dispatch via SMTP email with custom instructions.
* **🌐 Embedded Zero-Knowledge Web Server**: Self-host locally from the desktop app or run headlessly via CLI (`denc serve`) with flexible interface binding:
  * `🔒 Localhost Only (127.0.0.1)` for local-machine security.
  * `🌐 Local LAN (0.0.0.0)` for team access across local subnet/Wi-Fi.
* **⚙️ Enterprise Settings Sidebar & About Portal**: 2-column sidebar navigation organizing Email/SMTP, Local Web Server, Hardware/YubiKey, Cryptographic Defaults, and a dedicated **About DualCrypt** panel (providing architectural resumes, user appreciation, and direct channels for GitHub PRs / bug submissions to `serguei@aiopsforge.com`).
* **❓ Integrated Mobile Help & About Dialog**: Tap the `?` header icon in the mobile authenticator to inspect air-gap security specifications, review app architecture, and access 1-click email/GitHub feedback channels.
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
- [x] **Dynamic Animated QR Handshake & Mobile Authenticator**: 2-way challenge-response animated QR code generator/scanner enabling 100% air-gapped custodian sign-off via offline mobile devices with Biometric/PIN protection. *(Completed)*

### 🟡 Phase 2: Post-Quantum Cryptography (PQC)
- [x] **ML-KEM-768 (Kyber-768)**: NIST FIPS 203 public-key encapsulation for asynchronous custodian key distribution without pre-shared secrets. *(Completed)*
- [x] **ML-DSA-65 (Dilithium-3)**: NIST FIPS 204 post-quantum container signatures and verification. *(Completed)*

### 🔵 Phase 3: Governance & Shell Integration
- [x] **Immutable Container Audit Manifest**: Cryptographically signed audit manifests embedded in container headers with classification, timestamps, and custodian provenance. *(Completed)*
- [x] **Headless CLI (`denc-cli`)**: Standalone binary for automated server backups, scripts, and CI/CD pipelines. *(Completed)*
- [x] **Embedded Local Web Server**: Workstation & CLI HTTP server with Localhost/LAN binding. *(Completed)*
- [x] **Native Windows File Associations & NSIS Bundle**: Branded `.denc`, `.dkey`, `.pqc` shell associations and 1-click double-click to decrypt. *(Completed)*

### 🟣 Phase 4: Client-Side Web Client
- [x] **Zero-Knowledge WebAssembly (Wasm)**: Direct in-browser decryptor compiled from `denc-core` without server-side plaintext exposure. *(Completed)*
- [x] **Free Static Web Hosting CI/CD**: 1-click GitHub Pages & Cloudflare Pages deployment workflows. *(Completed)*

### 🟠 Phase 5: Time-Locked Recovery & Advanced Quorums
- [x] **Time-Locked Recovery Shares (Dead Man's Quorum)**: Cryptographically sealed recovery shares (`custodian_timelocks`) that cannot be reconstructed before a specified UTC release date. *(Completed)*

### 🔒 Phase 6: Universal Hardware Security (Low–Medium Complexity)
- [ ] **FIDO2 / WebAuthn & Passkey Integration**: Native hardware-backed authentication via standard CTAP2 / WebAuthn protocols across Desktop, WebAssembly, and Android (Touch ID, Windows Hello, and YubiKey FIDO2). See [Detailed Specification](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/FUTURE_ROADMAP_SPEC.md#1--phase-6-fido2--webauthn--passkey-hardware-integration).

### 👥 Phase 7: Hierarchical & Role-Based Governance (Medium Complexity)
- [ ] **Role-Based Quorums & Policy Trees**: Enforce multi-tier department signing rules (e.g., $(\text{Executive} \ge 1) \land (\text{Legal} \ge 1)$) to eliminate uniform quorum vulnerabilities and prevent custodian collusion. See [Detailed Specification](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/FUTURE_ROADMAP_SPEC.md#2--phase-7-role-based--hierarchical-quorums-multi-tier-policy-rules).

### 🌐 Phase 8: Distributed Real-Time Co-Presence (Medium–High Complexity)
- [ ] **WebRTC Zero-Knowledge Quorum Relay**: Real-time multi-party unlock rooms over peer-to-peer WebRTC data channels with post-quantum ML-KEM encapsulation, eliminating manual out-of-band keyfile/email transfers for remote teams. See [Detailed Specification](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/FUTURE_ROADMAP_SPEC.md#3--phase-8-webrtc--remote-zero-knowledge-quorum-relay).

### 🏢 Phase 9: Enterprise Identity & Lifecycle (High Complexity)
- [ ] **Enterprise SSO & Directory Sync (Okta First)**: OIDC/OAuth2 with PKCE, automated corporate public-key binding, and SCIM 2.0 deprovisioning/revocation webhooks with Okta universal directory support. See [Detailed Specification](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/FUTURE_ROADMAP_SPEC.md#4--phase-9-enterprise-sso--directory-sync-oidc--scim--active-directory--okta-1st).

---

## 🚀 CI/CD & Automated Release Matrix

The repository features enterprise GitHub Actions automation workflows covering continuous testing, web deployment, multi-platform desktop packaging, and signed Android mobile releases.

```mermaid
flowchart TD
    Push[Push / Pull Request] --> CI[CI Quality Gate]
    CI --> Biome[Biome Lint & Format]
    CI --> Cargo[Cargo Workspace Tests]
    CI --> Web[Desktop & Mobile Web Build]

    Tag[Release Tag v* / Dispatch] --> CD[CD Release Pipelines]
    CD --> Pages[GitHub Pages Web Portal]
    CD --> Desktop[Windows .msi/.exe | Linux .deb/.AppImage | macOS .dmg]
    CD --> Android[Signed Android APK & AAB]
```

### Automated Workflows

| Workflow | File | Trigger | Output / Artifacts |
| :--- | :--- | :--- | :--- |
| **CI Quality Gate** | [`.github/workflows/ci.yml`](file:///.github/workflows/ci.yml) | Push & PR (`main`, `master`) | Biome check, Cargo tests, WASM build, Desktop & Android build tests. |
| **GitHub Pages** | [`.github/workflows/deploy-pages.yml`](file:///.github/workflows/deploy-pages.yml) | Push to `main`/`master` | Live Zero-Knowledge in-browser decryptor & mobile portal. |
| **Desktop Releases** | [`.github/workflows/release-desktop.yml`](file:///.github/workflows/release-desktop.yml) | Tags `v*` or Manual Dispatch | Multi-OS binaries: Windows (`.msi`, `.exe`), Linux (`.deb`, `.AppImage`), macOS (`.dmg`). |
| **Signed Android** | [`.github/workflows/release-android.yml`](file:///.github/workflows/release-android.yml) | Tags `v*` or Manual Dispatch | Cryptographically signed `.apk` and Google Play `.aab` bundles. |

### 🔐 Configuring GitHub Repository Secrets

To enable production code signing for Android APKs and desktop auto-updates, configure the following secrets in **Repository Settings $\rightarrow$ Secrets and variables $\rightarrow$ Actions**:

| Secret Name | Purpose | Example / Format |
| :--- | :--- | :--- |
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded release `.jks` keystore | `cat release.jks \| base64` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password | `your-keystore-password` |
| `ANDROID_KEY_ALIAS` | Key alias in keystore | `dualcrypt-key` |
| `ANDROID_KEY_PASSWORD` | Specific key password | `your-key-password` |
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri updater signature private key | Generated via `tauri signer generate` |

*(Note: If Android secrets are omitted, the workflow automatically generates an ephemeral self-signed key so builds never fail).*

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

# Run mobile authenticator in development mode
bun run mobile:dev

# Run CLI directly
cargo run -p denc-cli -- --help
```

### Run Full Test Suite
```bash
cargo test --workspace
biome check .
bun run build
bun run mobile:build
```

---

## 📜 Licensing & Contributor Governance

### 1. Primary License: DualCrypt Source-Available License ([LICENSE.md](file:///LICENSE.md))
DualCrypt Enterprise is licensed under the **[DualCrypt Source-Available License](file:///LICENSE.md)**:

* **🆓 Free Use Grant**: Use of the software is granted **100% free of charge** for:
  - Personal, study, educational, academic, and non-commercial research purposes.
  - Internal business use by any company, startup, or non-profit organization with **less than \$1,000,000 in annual revenue** AND **fewer than 25 employees**.
* **🏢 Organizations & Permissions**:
  - Reselling, redistributing for a fee, or offering the software as a paid hosted cloud/SaaS service requires prior written permission.
  - Organizations exceeding the Free Use thresholds (revenue $\ge$ \$1M or $\ge$ 25 employees) seeking permission can contact: [`serguei@aiopsforge.com`](mailto:serguei@aiopsforge.com).

### 2. Contributor License Agreement (CLA)
To ensure long-term architectural integrity and licensing rights, all contributors submitting pull requests must agree to the automated **[Contributor License Agreement (CLA)](file:///CLA.md)** via the repository's CLA bot.

