# 🛡️ DualCrypt Enterprise

> **Zero-Trust Multi-Party Threshold File Encryption & Disaster Escrow Platform**  
> Engineered with **Rust (`denc-core`, `denc-cli`, `denc-wasm`)**, **Tauri v2**, **React 19**, and **Tailwind CSS**.

[![GitHub Release](https://img.shields.io/github/v/release/serguei9090/DualCrypt?color=0ea5e9&label=Release)](https://github.com/serguei9090/DualCrypt/releases/latest)
[![CI / Quality Gate](https://github.com/serguei9090/DualCrypt/actions/workflows/ci.yml/badge.svg)](https://github.com/serguei9090/DualCrypt/actions/workflows/ci.yml)
[![Web Client](https://img.shields.io/badge/Web%20Client-Live%20Demo-10b981)](https://serguei9090.github.io/DualCrypt/)
[![License: DualCrypt 1.0](https://img.shields.io/badge/License-DualCrypt%20Source--Available%201.0-blue.svg)](LICENSE.md)

> [!NOTE]
> **Production Releases Ready**: Download pre-compiled native installers for Windows, macOS, Linux, and Android from the **[GitHub Releases Page](https://github.com/serguei9090/DualCrypt/releases/tag/v0.5.5)** or try the **[Zero-Knowledge Web Client](https://serguei9090.github.io/DualCrypt/)**.

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

The complete enterprise documentation suite is hosted in the [`docs/`](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs) directory, anchored by the **[Master Documentation Portal](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/index.md)**:

### 📖 [User Documentation Hub](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/index.md)
* **[🚀 5-Minute Quickstart](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/quickstart.md)**: Install desktop, CLI, or Android apps and perform your first 2-of-2 encryption.
* **[🔒 File & Folder Encryption Manual](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/encryption_guide.md)**: Packaging payloads, setting $k$-of-$n$ quorums, timelocks, and digital signatures.
* **[🔓 Container Decryption & Explorer 1-Click](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/decryption_guide.md)**: Opening containers, checking Provenance Passports, and unlocking shares.
* **[👥 Custodian Authentication Methods](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/custodian_methods.md)**: Passphrases, `.dkey` Keyfiles, physical YubiKeys, and Post-Quantum ML-KEM keys.
* **[📲 Air-Gapped Mobile Authenticator](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/airgap_authenticator.md)**: 100% offline Android sign-off via optical QR fountain framing.
* **[🏛️ Key Escrow & Post-Quantum Vault](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/key_vault_escrow.md)**: Generating and testing ML-KEM and ML-DSA keys.
* **[⚡ Standalone CLI Reference (`denc`)](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/cli_reference.md)**: Headless commands, recipe automation, and piping.
* **[🌐 Zero-Knowledge Web Client](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/web_client.md)**: Browser-based WebAssembly decryptor and local LAN serving.
* **[❓ Troubleshooting & FAQ](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/faq_troubleshooting.md)**: Common errors, timelock resolution, and disaster recovery.

### 🛠️ [Developer Documentation Hub](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/dev/index.md)
* **[🏛️ System Architecture & Diagrams](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/dev/architecture.md)**: Mermaid architecture diagrams, data flows, Tauri IPC, and WASM workers.
* **[🔐 Cryptography Deep Dive](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/dev/cryptography_deep_dive.md)**: $GF(256)$ finite field arithmetic, constant-time multiplication, PQC, and AEAD framing.
* **[📦 `.denc` Binary Container Format](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/dev/container_binary_format.md)**: Binary protocol specification, header layout, and chunk framing.
* **[📂 Monorepo Topology](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/dev/codebase_structure.md)**: Codebase tour across Rust crates, Tauri backend, shared packages, and apps.
* **[💻 Setup & Building Guide](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/dev/setup_and_building.md)**: Prerequisites, build matrix, and running automated test suites.
* **[⚙️ CI/CD & Automation Snippets](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/dev/ci_cd_and_automation.md)**: GitHub Actions workflow, Bash scripts, and `uv` Python automation.
* **[🤝 Contributing & Standards](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/dev/contributing.md)**: Engineering guidelines, memory hygiene checklist, and commit conventions.

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
* **📁 Directory & Folder Archiving with Zero-Friction Drag & Drop**:
  * **Unified Folder Drag & Drop**: Drag and drop entire directory trees directly onto the dropzone in Desktop (native OS paths) and Web (HTML5 `webkitGetAsEntry` recursive scanner) environments.
  * **Streaming In-Memory Packaging**: Bundles folder hierarchies into standardized POSIX USTAR archives without writing unencrypted temporary files to disk.
  * **Automatic Directory Extraction on Decryption**: When decrypting a container holding a folder payload, the system automatically detects directory manifests and extracts the complete folder structure and nested files directly into the chosen destination (or outputs `.tar` if explicitly requested).
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

## 💻 Standalone CLI Tool (`denc`) & Headless CI/CD Automation

DualCrypt provides a high-performance native CLI binary (`denc`) for headless automation, server backups, zero-trust distribution, and programmatic CI/CD pipelines (e.g. GitHub Actions, GitLab CI, Jenkins) with **zero human intervention**.

### 1. Key Features
* **Zero Human Intervention**: Pass all encryption recipes via CLI arguments, JSON/YAML recipe files, or direct `stdin` piping.
* **Post-Quantum Key Distribution (NIST FIPS 203 ML-KEM-768)**: Generates quantum-safe asymmetric keypairs (`custodian_*.pqc`) into a temporary directory so CI pipelines can securely dispatch them to respective custodians via email or vault APIs.
* **NIST FIPS 204 Container Signatures (ML-DSA-65)**: Sign production artifacts with the CI release bot's private key to guarantee origin authenticity.
* **Machine-Readable `--json` Mode**: Emits structured JSON on `stdout` detailing container paths, byte counts, and key locations for easy parsing with `jq` or Python.
* **Full Governance Manifest**: Configure classification (`TOP_SECRET`, `CONFIDENTIAL`), purpose, organization, and timelocks directly from CI.

---

### 2. Command Reference

#### 🔐 Encrypting Artifacts (`denc encrypt`)
```bash
# A. Quick CLI flags with Post-Quantum (PQC) custodians and manifest:
denc encrypt release_v2.tar.gz \
  -o release_v2.tar.gz.denc \
  -k 2 -n 2 \
  --key-dir /tmp/ci_keys \
  --pqc 1:"Alice (SecOps Lead)" \
  --pqc 2:"Bob (VP Engineering)" \
  --classification "TOP_SECRET" \
  --purpose "Automated Production Release" \
  --organization "DualCrypt Enterprise Security" \
  --author-signing-key "$CI_RELEASE_DSA_PRIVATE_KEY" \
  --author-label "CI Automated Release Bot" \
  --json

# B. Programmatic recipe via YAML / JSON config file:
denc encrypt --config ci_recipe.yaml --json

# C. Direct dynamic stdin piping without writing config to disk:
cat ci_recipe.json | denc encrypt --config - --json
```

#### 🔓 Decrypting Containers (`denc decrypt`)
```bash
# Decrypt using generated Post-Quantum (.pqc) key files:
denc decrypt release_v2.tar.gz.denc \
  -o restored_release.tar.gz \
  -f 1:/tmp/ci_keys/custodian_1.pqc \
  -f 2:/tmp/ci_keys/custodian_2.pqc \
  --json

# Decrypt using hybrid credentials (PQC key + Passphrase):
denc decrypt backup.denc \
  --pqc-key 1:custodian_1.pqc \
  -p 2:"SuperSecurePassword!" \
  --json

# Force in-place overwrite when target destination folder/file already exists:
denc decrypt backup.denc -o /data/vault --overwrite -p 1:Pass1 -p 2:Pass2
```

#### 🔍 Inspecting Containers (`denc inspect`)
```bash
# Inspect container header, signatures, and compliance manifest:
denc inspect release_v2.tar.gz.denc --json
```

#### ⚛️ Post-Quantum Key Generation (`denc pqc-keygen`)
```bash
# Generate ML-KEM-768 keypair for recipient encryption:
denc pqc-keygen -a kem -o custodian_kem.json --json

# Generate ML-DSA-65 signing keypair for CI release bot:
denc pqc-keygen -a dsa -o bot_signing_key.json --json
```

---

### 3. CI/CD Pipeline Integration Example (GitHub Actions)

Here is a complete workflow demonstrating how CI builds an artifact, encrypts it with threshold Post-Quantum keys, and emails/dispatches each key to the respective custodian:

```yaml
name: Secure Threshold Release Pipeline

on:
  push:
    tags: ['v*']

jobs:
  secure-encrypt-and-dispatch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Application Payload
        run: |
          tar -czf release_payload.tar.gz ./dist

      - name: Encrypt Payload & Generate PQC Keys via DualCrypt CLI
        id: encrypt_step
        run: |
          # Run denc in JSON mode
          RESULT=$(denc encrypt release_payload.tar.gz \
            -o release_payload.tar.gz.denc \
            -k 2 -n 2 \
            --key-dir /tmp/keys \
            --pqc 1:"Alice (SecOps Lead)" \
            --pqc 2:"Bob (VP Engineering)" \
            --classification "TOP_SECRET" \
            --purpose "v${{ github.ref_name }} Production Release" \
            --organization "Enterprise Security" \
            --json)

          echo "ENCRYPT_RESULT=$RESULT" >> $GITHUB_ENV

          # Extract generated key paths using jq
          KEY1=$(echo "$RESULT" | jq -r '.exported_keys[] | select(.custodian_id==1) | .file_path')
          KEY2=$(echo "$RESULT" | jq -r '.exported_keys[] | select(.custodian_id==2) | .file_path')
          echo "KEY1_PATH=$KEY1" >> $GITHUB_ENV
          echo "KEY2_PATH=$KEY2" >> $GITHUB_ENV

      - name: Dispatch Custodian 1 Key to Alice (SecOps)
        uses: dawidd6/action-send-mail@v3
        with:
          server_address: smtp.enterprise.com
          server_port: 587
          username: ${{ secrets.MAIL_USERNAME }}
          password: ${{ secrets.MAIL_PASSWORD }}
          subject: "[DualCrypt] Release Custodian 1 Key: ${{ github.ref_name }}"
          to: alice-secops@enterprise.com
          from: ci-release-bot@enterprise.com
          body: "Hello Alice, attached is your Post-Quantum (ML-KEM-768) threshold key for release ${{ github.ref_name }}."
          attachments: ${{ env.KEY1_PATH }}

      - name: Dispatch Custodian 2 Key to Bob (VP Engineering)
        uses: dawidd6/action-send-mail@v3
        with:
          server_address: smtp.enterprise.com
          server_port: 587
          username: ${{ secrets.MAIL_USERNAME }}
          password: ${{ secrets.MAIL_PASSWORD }}
          subject: "[DualCrypt] Release Custodian 2 Key: ${{ github.ref_name }}"
          to: bob-vpeng@enterprise.com
          from: ci-release-bot@enterprise.com
          body: "Hello Bob, attached is your Post-Quantum (ML-KEM-768) threshold key for release ${{ github.ref_name }}."
          attachments: ${{ env.KEY2_PATH }}

      - name: Upload Encrypted Container Release Asset
        uses: softprops/action-gh-release@v2
        with:
          files: release_payload.tar.gz.denc
```

---

### 4. Configuration Schema (`ci_recipe.yaml` / `ci_recipe.json`)

```yaml
# CI/CD Encryption Recipe
input: "build/production_bundle.tar.gz"
output: "artifacts/production_bundle.tar.gz.denc"
threshold_k: 2
total_n: 3
cipher: "aes-256-gcm" # or 'xchacha20-poly1305'
key_dir: "/tmp/release_keys"

manifest:
  classification: "TOP_SECRET"
  purpose: "Automated Production Release Deployment"
  organization: "Enterprise SecOps"
  custodian_timelocks:
    3: 1775000000 # Custodian 3 locked until specified UTC timestamp

author:
  label: "CI/CD Release Bot"
  signing_key_base64: "..." # NIST FIPS 204 ML-DSA-65 Private Key

custodians:
  - id: 1
    label: "Alice (SecOps)"
    auth_type: "postquantum"
  - id: 2
    label: "Bob (Infra Lead)"
    auth_type: "postquantum"
  - id: 3
    label: "Emergency Escrow Vault"
    auth_type: "keyfile"
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

