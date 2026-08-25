# 📋 DualCrypt Enterprise Changelog

All notable changes to the **DualCrypt Enterprise** platform are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.5.5] - 2026-08-25

### 🌟 Release Highlights
Version `0.5.5` introduces complete **Directory & Folder Hierarchy Encryption and Decryption** across Desktop, CLI, and Web platforms. It adds native directory drag-and-drop loading, in-memory streaming POSIX USTAR archiving, automatic subfolder extraction on decryption, an **Interactive Directory Collision Resolution Modal** in the Desktop UI, and a dedicated `--overwrite` (`-w`, `-f`, `--force`) CLI flag for automated workflows.

---

### 🚀 Added
- **Unified Directory Drag & Drop**:
  - **Desktop (Tauri v2)**: Native OS directory path capture via `onDragDropEvent` listener and Explorer / Finder drag-and-drop.
  - **Web & Browser**: Recursive directory traversal via HTML5 `webkitGetAsEntry` and directory readers to load nested folder trees into in-memory TAR streams without temporary unencrypted disk writes.
  - **Animated Packaging Feedback**: Real-time spinner and phase status during directory TAR packaging.
- **Automatic Folder Hierarchy Extraction**:
  - **`denc-core`**: Automatic detection of directory payloads via manifest and USTAR magic headers, unpacking nested file structures directly into destination directories.
  - **Tauri Desktop**: Automatic creation of dedicated subfolders when extracting to parent folders (e.g. `D:\Downloads\IconsTest\`) with exact extraction path reporting.
  - **Web Client**: Automatic packaging of decrypted directory hierarchies as `.tar` archives with clean `📁 RESTORED DIRECTORY` badges.
- **Interactive Directory Collision Resolution (Desktop UI)**:
  - Added `CollisionResolutionModal.tsx` displaying when a target folder or file already exists at the chosen destination.
  - Offers 3 actionable choices: **[ Create "<Folder> (1)" (Safe Auto-Version) ]**, **[ Overwrite & Merge In-Place ]**, or **[ Select Another Destination Directory ]**.
- **CLI Collision Handling & `--overwrite` Flag**:
  - Added `--overwrite` (`-w`, `-f`, `--force`) flag to `denc decrypt`.
  - Added interactive prompt in terminal mode (`[O]verwrite / [V]ersion / [C]ancel`) and safe auto-versioning fallback in headless CI/CD mode.

---

## [0.5.4] - 2026-08-25

### 🌟 Release Highlights
Version `0.5.4` fixes the in-browser container header parsing RangeError, adds robust dual-format `.denc` container inspection (handling both standard binary containers and JSON envelopes), integrates genuine WebAssembly/WebCrypto post-quantum key generation, eliminates all legacy mock fallbacks across platforms, and enables HTML5 directory selection.

---

### 🐛 Fixed
- **Web Container Parsing RangeError**: Fixed DataView boundary offset errors by implementing dual-format support for both native standard binary `.denc` containers and JSON envelope streams with strict length bounds checking.
- **Passphrase Prompt Mismatch**: Fixed issue where files encrypted with keyfiles or PQC keys mistakenly prompted for passphrases on web decryption by reading genuine descriptor headers.
- **Auto-Confirming Key Pickers**: Replaced immediate dummy share emission with standard HTML5 file pickers (`.pqc`, `.dkey`, `.json`) verifying uploaded key credentials before unlocking.
- **Legacy Mock Elimination**: Replaced placeholder PQC key strings with real WebAssembly (`wasm_generate_pqc_keypair` / `wasm_generate_ml_dsa_keypair`) and CSPRNG key generation, and upgraded folder selection to standard HTML5 `webkitdirectory`.

---

## [0.5.3] - 2026-08-25

### 🌟 Release Highlights
Version `0.5.3` introduces the authoritative **Security & Assurance Manifest** (`docs/SECURITY_MANIFEST.md`), integrates **Standalone Cross-Platform CLI Binaries** into CI/CD release workflows (producing standalone `denc-windows-x86_64.exe`, `denc-linux-x86_64`, and `denc-macos-universal` assets), and synchronizes end-to-end documentation across the platform.

---

### 🚀 Added
- **Security & Assurance Manifest (`docs/SECURITY_MANIFEST.md`)**:
  - Detailed threat modeling, $GF(256)$ information-theoretic threshold proofs, and AEAD stream framing specifications.
  - Multi-tier key custody guarantees: NIST FIPS 203 ML-KEM-768, Argon2id ($m=64\text{ MB}, t=3, p=4$), YubiKey capacitive touch, and Air-Gapped Optical camera-to-screen QR enclaves.
  - Memory zeroization (`ZeroizeOnDrop`) protocols, constant-time Russian Peasant finite field arithmetic, and strict $O(1)$ streaming memory consumption ($<20\text{ MB}$ RAM footprint).
  - Headless CI/CD zero-leakage security posture (`stdin` recipe piping, isolated `/tmp` keys).
- **Standalone Cross-Platform CLI Release Pipeline (`.github/workflows/release-desktop.yml`)**:
  - Automated compilation and attachment of standalone `denc` CLI binaries on Windows (`.exe`), Linux (ELF binary), and macOS (universal Mach-O) for every release tag.

---

### 🔧 Improvements & Maintenance
- **Version Harmonization**: Bumped workspace packages, crates, Android manifests, desktop components, and Tauri configuration to version `0.5.3`.

---

## [0.5.2] - 2026-08-25

### 🌟 Release Highlights
Version `0.5.2` delivers full **Headless CI/CD Pipeline Automation & PQC Key Generation** for the standalone CLI (`denc-cli`), enabling enterprise DevOps and SecOps teams to automate threshold encryption, post-quantum key distribution, and container verification in automated build pipelines (e.g. GitHub Actions, GitLab CI, Jenkins) with **zero human intervention**.

---

### 🚀 Added
- **Headless CI/CD Automation Engine (`crates/denc-cli/src/config.rs`)**:
  - Full YAML & JSON recipe file deserialization (`denc encrypt --config ci_recipe.yaml`).
  - Dynamic standard input (`stdin`) streaming support (`--config -`) for passing sensitive configurations directly in-memory.
  - Complete parity with desktop UI: custom custodian labels, auth types (`postquantum`, `passphrase`, `keyfile`, `otp`), compliance manifests, and timelocks.
- **Automated Post-Quantum Key Export**:
  - Automatic generation of NIST FIPS 203 (ML-KEM-768) keypairs per custodian and structured export into `--key-dir` (`custodian_*.pqc`).
  - Standalone Post-Quantum Keygen (`denc pqc-keygen -a kem` and `denc pqc-keygen -a dsa`).
- **Machine-Readable `--json` Output Mode**:
  - Pure structured JSON emitted on `stdout` with byte counts, hashes, container paths, and exported key paths for automated scripting (`jq` / Python / PowerShell).
- **Interactive Terminal Help & Copy-Pasteable Examples**:
  - Comprehensive `--help` documentation and embedded usage examples across all subcommands (`encrypt`, `decrypt`, `inspect`, `pqc-keygen`, `sss-keygen`, `serve`).

---

### 🔧 Improvements & Maintenance
- **Version Harmonization**: Bumped workspace packages, crates, Android manifests, desktop components, and Tauri configuration to version `0.5.2`.
- **Automated Integration Test Suite (`scratch/test_ci_pipeline.py`)**: Added end-to-end integration tests validating PQC keygen, flag encryption, inspection, PQC decryption, YAML recipes, and hybrid threshold unlock.

---

## [0.5.1] - 2026-08-25

### 🌟 Release Highlights
Version `0.5.1` introduces a dedicated **About DualCrypt & Feedback Portal** in the Enterprise Settings sidebar and an enhanced **Integrated Help & Feedback Dialog** on the Mobile Authenticator, giving users comprehensive architectural overviews, community appreciation, and direct pathways for submitting feature requests and reporting bugs via GitHub and direct email.

---

### 🚀 Added
- **About DualCrypt Settings Section (`src/components/settings/panels/AboutPanel.tsx`)**:
  - Full architectural overview of Shamir's Secret Sharing over $GF(256)$, NIST FIPS 203 (ML-KEM-768), NIST FIPS 204 (ML-DSA-65), and AEAD bulk encryption ciphers.
  - User appreciation & community gratitude banner.
  - Direct email action button and 1-click clipboard copy for `serguei@aiopsforge.com`.
  - Direct repository link for GitHub Pull Requests and Issue reporting.
  - System memory zeroization and zero-telemetry assurance notices.
- **Enhanced Mobile Authenticator Help & Feedback Modal (`apps/mobile-android/src/App.tsx`)**:
  - Two-tab modal interface accessible from the top header `?` icon:
    - **About & Support**: App overview, gratitude message, direct email button to `serguei@aiopsforge.com`, email clipboard copy button, and GitHub links.
    - **Air-Gap Specs**: Detailed air-gap specifications covering zero network permissions, optical camera-to-screen QR streams, and PBKDF2/AES-256-GCM encrypted vault storage.

---

### 🔧 Improvements & Maintenance
- **Version Harmonization**: Bumped workspace packages, crates, Android manifests, and Tauri configuration to version `0.5.1`.
- **Dynamic Release Packaging**: Enhanced Android CI/CD workflow to dynamically generate tagged `.apk` and `.aab` artifacts for every semantic release.

---

## [0.5.0] - 2026-08-24

### 🌟 Release Highlights
Version `0.5.0` establishes the unified **DualCrypt Enterprise** brand identity, adds **Zero-Knowledge Encrypted-at-Rest Storage** for the Android Authenticator, streamlines the **Optical Air-Gap Webcam Handshake**, and integrates complete **GitHub Actions CI/CD automation** for multi-platform desktop, web, and signed Android packaging.

---

### 🚀 Added
- **Zero-Knowledge Encrypted-at-Rest Mobile Vault**:
  - Implemented client-side **PBKDF2 (SHA-256, 100,000 rounds)** key derivation and **AES-256-GCM** authenticated storage (`apps/mobile-android/src/lib/cryptoVault.ts`).
  - Added volatile in-memory session key management and instant key zeroization on app lock.
  - Implemented seamless auto-migration of legacy unencrypted keys into authenticated v2 envelopes.
- **Enterprise CI/CD Automation Pipelines**:
  - `ci.yml`: Automated Biome formatting/linter check, multi-OS Rust cryptographic tests, and TypeScript build checks on every push and pull request.
  - `deploy-pages.yml`: Automated Zero-Knowledge in-browser WebAssembly decryptor deployment to GitHub Pages.
  - `release-desktop.yml`: Automated multi-platform desktop packaging for Windows (`.msi`, `.exe`), Linux (`.deb`, `.AppImage`), and macOS (universal `.dmg`).
  - `release-android.yml`: Automated Android compilation with cryptographic code signing (`apksigner` / `zipalign`) producing standalone `.apk` and Google Play `.aab` bundles.
- **Release Credential Management**:
  - Created secure, gitignored `release_credentials/` local infrastructure with production Android keystores (`dualcrypt-release.jks`), Tauri update keypairs, and comprehensive Google Drive backup manifests.

---

### 🎨 UI / UX & Design Standardization
- **Cyber-Minimalist Enterprise Design**: Standardized typography (`Inter` for UI, `JetBrains Mono` for cryptographic hashes), unified dark canvas (`#080B13`), and replaced all legacy `zinc-*` styles with `slate-*` tokens.
- **Enhanced Air-Gap Optical Handshake UX**:
  - Resolved webcam `AbortError` / play promise race conditions.
  - Added multi-tier webcam acquisition supporting USB and laptop cameras.
  - Added `[ 🔄 Retry Camera ]` action and `[ 📋 Paste Response Data Manually ]` fallback form for workstations without physical cameras.
- **Clean Hardware Diagnostics**: Removed developer simulator toggle to enforce strict physical FIDO2 / YubiKey root-of-trust detection.

---

### 🔒 Cryptography & Core
- **Post-Quantum Security**: Verified NIST FIPS 203 (ML-KEM-768 / Kyber) and NIST FIPS 204 (ML-DSA-65 / Dilithium) container signatures and tamper detection.
- **Threshold Scheme**: Validated $GF(256)$ Shamir Secret Sharing with constant-time multiplication and zero-knowledge reconstruction.
- **Test Integrity**: 22/22 unit and integration tests passing in `denc-core`.
