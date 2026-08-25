# 📋 DualCrypt Enterprise Changelog

All notable changes to the **DualCrypt Enterprise** platform are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
