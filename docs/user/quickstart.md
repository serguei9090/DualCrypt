# 🚀 5-Minute Quickstart Guide

This guide gets you up and running with **DualCrypt Enterprise** in five minutes. You will install the application, create your first multi-party encrypted container, and decrypt it using dual custody.

---

## 📥 1. Installation

### Desktop Application (Windows, macOS, Linux)
1. Download the latest installer for your operating system from the **[Releases Page](https://github.com/serguei9090/DualCrypt/releases/latest)**:
   * **Windows**: `DualCrypt-Setup.msi` or `.exe`
   * **macOS**: `DualCrypt.dmg` (Universal Apple Silicon & Intel)
   * **Linux**: `DualCrypt.AppImage` or `.deb`
2. Run the installer and launch **DualCrypt Enterprise**.

### Offline Mobile Authenticator (Android)
1. Download `DualCrypt-Authenticator.apk` onto your Android phone.
2. Install the application. Note that no network permissions are required or requested.
3. Set your 6-digit Master PIN or enable Biometric unlock (Fingerprint / Face Unlock).

### Standalone CLI Binary (`denc`)
Pre-compiled standalone binaries with zero external dependencies are available in the release assets:
```bash
# Verify installation
denc --version
```

---

## 🔒 2. Encrypting Your First File (2-of-2 Dual Custody)

In this scenario, we will encrypt a sensitive file requiring **two custodians** (Party 1: Passphrase, Party 2: External Key File) to collaborate before it can be opened.

```
+----------------------------------------------------------------+
|  [ File Dropzone: financial_audit_2026.pdf (14.2 MB) ]         |
|  Cipher: [ AES-256-GCM ]      Quorum: [ Threshold: 2 / Total: 2]|
+----------------------------------------------------------------+
| [ Custodian 1 ]                     | [ Custodian 2 ]          |
| Label: CFO (Alice)                  | Label: Auditor (Bob)     |
| Method: Passphrase                  | Method: Key File (.dkey) |
| Pass: ••••••••••••                  | [ Generate .dkey Token ] |
+----------------------------------------------------------------+
```

1. Launch **DualCrypt** and ensure you are on the **Encrypt** tab.
2. **Select File**: Drag and drop `financial_audit_2026.pdf` (or any file/folder) into the file dropzone.
3. **Configure Quorum**:
   * Set **Threshold ($k$)** to `2`.
   * Set **Total Custodians ($n$)** to `2`.
4. **Configure Custodian 1 (Alice)**:
   * Label: `Alice (CFO)`
   * Method: Select **Passphrase**.
   * Enter a secure passphrase: `AliceSecurePass#2026`.
5. **Configure Custodian 2 (Bob)**:
   * Label: `Bob (Auditor)`
   * Method: Select **Key File (`.dkey`)**.
6. **Execute Encryption**:
   * Click **`[ 🔒 Encrypt Container ]`**.
   * Save the resulting container as `financial_audit_2026.pdf.denc`.
   * DualCrypt prompts you to save Bob's external key file (`custodian_2.dkey`). Store it safely on a USB drive or in Bob's secure storage.

---

## 🔓 3. Decrypting Your Container

To open `financial_audit_2026.pdf.denc`:

1. **Open Container**:
   * **Option A**: Double-click `financial_audit_2026.pdf.denc` in Windows Explorer / macOS Finder.
   * **Option B**: Open DualCrypt, navigate to the **Decrypt** tab, and drop the `.denc` file into the dropzone.
2. **Review Provenance Passport**:
   * The container header is parsed instantaneously. You will see the required quorum (`2/2 Required`), algorithm (`AES-256-GCM`), and custodian roster.
3. **Provide Custodian 1 Credential**:
   * In Custodian 1's quadrant, enter Alice's passphrase: `AliceSecurePass#2026`.
   * The progress meter updates to `1/2 Custodians Verified` (Yellow).
4. **Provide Custodian 2 Credential**:
   * In Custodian 2's quadrant, click **Browse** and select Bob's `custodian_2.dkey` file.
   * The progress meter turns glowing green: `2/2 Threshold Quorum Met`.
5. **Restore Plaintext**:
   * Click **`[ 🔓 Decrypt File ]`** and choose where to save the restored PDF.
   * The file is streamed and verified with full AEAD authentication.

---

## ⚡ 4. Fast CLI Equivalents

You can perform the exact same workflow in a headless terminal or server script using `denc`:

```bash
# Encrypt with 2-of-2 passphrases
denc encrypt backup.tar.gz -o backup.denc -k 2 -n 2 -p 1:SecretAlpha -p 2:SecretBeta

# Decrypt with 2-of-2 passphrases
denc decrypt backup.denc -o restored_backup.tar.gz -p 1:SecretAlpha -p 2:SecretBeta
```

---

## ⏭️ Next Steps

* Learn about [**Post-Quantum ML-KEM-768 Custodians**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/custodian_methods.md#4-post-quantum-key-encapsulation-nist-fips-203-ml-kem-768).
* Set up [**Time-Locked Disaster Escrow**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/encryption_guide.md#3-time-locked-recovery-escrow).
* Configure [**Air-Gapped Optical Sign-Off with Android**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/airgap_authenticator.md).
