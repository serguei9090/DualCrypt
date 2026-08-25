# 🔓 Comprehensive Decryption & Quorum Verification Guide

This guide describes how to inspect, verify, and decrypt authenticated `.denc` containers using DualCrypt Enterprise Desktop, Web Client, or CLI.

---

## 📑 Contents
1. [Opening Containers (Double-Click & Drag-and-Drop)](#1-opening-containers-double-click--drag-and-drop)
2. [Reviewing the Provenance Passport & Author Signature](#2-reviewing-the-provenance-passport--author-signature)
3. [Providing Custodian Credentials](#3-providing-custodian-credentials)
4. [Live Threshold Meter & Quorum Resolution](#4-live-threshold-meter--quorum-resolution)
5. [Time-Lock Enforcement During Decryption](#5-time-lock-enforcement-during-decryption)
6. [Executing Decryption & Verifying Payload](#6-executing-decryption--verifying-payload)

---

## 1. Opening Containers (Double-Click & Drag-and-Drop)

### Method A: Windows Explorer / macOS Finder 1-Click Launch
DualCrypt registers native OS file associations for `.denc` files. When you double-click any `.denc` file in your file manager:
1. DualCrypt opens automatically.
2. It navigates directly to the **Decrypt** view.
3. The container header is immediately parsed, verified, and displayed.

### Method B: Drag and Drop into DualCrypt
1. Open DualCrypt Enterprise and switch to the **Decrypt** tab.
2. Drag and drop any `.denc` file onto the dropzone, or click **Select .denc File**.

---

## 2. Reviewing the Provenance Passport & Author Signature

Upon loading a container, DualCrypt renders the **Provenance Passport** card above the custodian grid:

```
+--------------------------------------------------------------------------+
| 🛡️ PROVENANCE PASSPORT                   [ TOP_SECRET ] [ AES-256-GCM ] |
| Purpose: Quarterly Financial Ledger Backup                                |
| Issuing Org: Enterprise SecOps & Compliance                              |
| Created: 2026-08-25 14:00 UTC          Threshold: 2 of 3 Custodians Req   |
| Author Signature: [ ✅ VERIFIED NIST FIPS 204 ML-DSA-65 ]                |
| Signed By: Alice - Chief Information Security Officer                    |
+--------------------------------------------------------------------------+
```

* **Classification Badge**: Highlights whether the payload is `UNCLASSIFIED`, `RESTRICTED`, `CONFIDENTIAL`, or `TOP_SECRET`.
* **Author Signature Indicator**:
  * **Green Badge (`✅ VALID SIGNATURE`)**: Confirms that the header, metadata, and custodian parameters have not been tampered with and were signed by the verified author.
  * **Red Badge (`❌ TAMPERED / INVALID`)**: Warns that header bytes were modified or corrupted.

---

## 3. Providing Custodian Credentials

The custodian grid shows each required slot and its designated authentication method:

### 1. Passphrase Slot
* Enter the custodian's passphrase into the input field.
* DualCrypt derives the Key Encryption Key in real time using Argon2id ($64\text{ MB}$ memory-hard) and attempts to unwrap the embedded Shamir share.

### 2. Key File (`.dkey`) Slot
* Click **Select .dkey File** and browse to the exported key token.
* If the `.dkey` file is PIN-protected, enter the PIN when prompted.

### 3. Physical YubiKey Slot
* Insert the authorized YubiKey into any USB port.
* DualCrypt detects the device (`VID 0x1050`) and prompts you to physically touch the capacitive gold contact.

### 4. Post-Quantum KEM Slot (`.pqc`)
* Click **Select .pqc Private Key** or paste the Base64-encoded NIST FIPS 203 ML-KEM-768 private key.
* DualCrypt decapsulates the shared secret in constant time to recover the Shamir share.

---

## 4. Live Threshold Meter & Quorum Resolution

As credentials are provided, the **Live Threshold Meter** reflects the cryptographic progress:

```
[ 0 / 2 Custodians ] ⚪ Gray   - No credentials provided.
[ 1 / 2 Custodians ] 🟡 Yellow - 1 valid share recovered. Insufficient quorum.
[ 2 / 2 Custodians ] 🟢 Green  - 2 valid shares recovered. QUORUM SATISFIED.
```

Once the number of verified shares reaches or exceeds $k$, the **`[ 🔓 Decrypt Container ]`** button becomes active.

---

## 5. Time-Lock Enforcement During Decryption

If a custodian share was configured with a **Time-Lock Escrow**:
* DualCrypt evaluates the current UTC time against the sealed epoch timestamp.
* If the release time has **not yet arrived**:
  * The slot displays **`⏳ TIME-LOCKED (Unlocks on YYYY-MM-DD HH:MM UTC)`**.
  * The share is locked and cannot contribute to the threshold meter.
* If the release time has **passed**:
  * The slot displays **`🔓 TIME-LOCK EXPIRED (Available for Quorum)`** and can be unlocked normally.

---

## 6. Executing Decryption & Verifying Payload

1. Click **`[ 🔓 Decrypt Container ]`**.
2. Select the destination file path or directory for the restored plaintext.
3. DualCrypt reconstructs the Data Encryption Key ($K_{\text{DEK}}$) via Lagrange interpolation over $\text{GF}(256)$ and begins streaming the ciphertext chunks.
4. **Stream Integrity Verification**:
   * Every 64 KiB chunk has its Poly1305 or GCM authentication tag validated against the header digest and chunk counter.
   * If any byte of the ciphertext is damaged or modified, decryption aborts immediately with `DencError::IntegrityCheckFailed`.
5. Upon successful completion, the master key is **zeroized from memory**, and your original file or folder is ready.
