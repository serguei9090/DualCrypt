# 📖 DualCrypt Enterprise User Guide

Welcome to the **DualCrypt Enterprise User Guide**. This document walks through all primary features and workflows.

---

## 📑 Table of Contents
1. [Encrypting Files & Directories](#1-encrypting-files--directories)
2. [Configuring Custodians & Methods](#2-configuring-custodians--methods)
3. [Time-Locked Recovery Escrow](#3-time-locked-recovery-escrow)
4. [NIST FIPS 204 Digital Signatures](#4-nist-fips-204-digital-signatures)
5. [Decrypting Containers](#5-decrypting-containers)
6. [Air-Gapped Optical Mobile Authenticator](#6-air-gapped-optical-mobile-authenticator)
7. [Key Escrow & Post-Quantum Vault](#7-key-escrow--post-quantum-vault)
8. [Standalone CLI Automation (`denc`)](#8-standalone-cli-automation-denc)

---

## 1. Encrypting Files & Directories

1. Launch **DualCrypt Enterprise**.
2. Drag and drop any single file (PDF, ZIP, DB, video) or an entire directory into the **Source File Dropzone**.
3. Choose your encryption algorithm:
   * **AES-256-GCM** (Default, NIST compliant, Hardware accelerated).
   * **XChaCha20-Poly1305** (Software-fast, extended nonce).
4. Configure the Quorum:
   * **Threshold ($k$)**: Minimum custodians required to decrypt (e.g. `2`).
   * **Total Custodians ($n$)**: Total shares created (e.g. `3`).

---

## 2. Configuring Custodians & Methods

For each custodian quadrant in the grid, select one of the 4 authentication methods:

| Method | Description | Best For |
| :--- | :--- | :--- |
| **Passphrase** | Enters a strong human password (embedded in container header wrapped via Argon2id). | Executive passphrases. |
| **Key File (`.dkey`)** | Generates an external binary key token with optional PIN protection. | Safe storage on USB drives or smartcards. |
| **YubiKey Hardware Token** | Scans connected USB YubiKeys (`VID 0x1050`) requiring physical capacitive touch. | Hardware-rooted zero-trust custody. |
| **⚛️ Post-Quantum KEM** | Encapsulates share using NIST FIPS 203 ML-KEM-768 public key (`.pqc.pub`). | Asynchronous key dispatch to colleagues. |

---

## 3. Time-Locked Recovery Escrow

To create a recovery share that can only be unlocked after a certain date:
1. On the designated recovery custodian card (e.g., Custodian 3), check **`[x] ⏳ Time-Lock Escrow`**.
2. Use the **Interactive Calendar Picker** to select the release date and time (UTC), or click a quick chip (**`+30D`**, **`+90D`**, **`+6M`**, **`+1Yr`**).
3. When the container is encrypted, this restriction is mathematically sealed into the signed manifest.
4. If anyone attempts to decrypt before that timestamp, the slot displays **`⏳ TIME-LOCKED`** and cannot be used for quorum.

---

## 4. NIST FIPS 204 Digital Signatures

1. Check **`[x] Digitally Sign Container (NIST FIPS 204 ML-DSA-65)`**.
2. Paste or select the author's private ML-DSA signing key (`.dsa` / Base64).
3. Enter the Author's Identity or Department Name (e.g. `Chief Information Security Officer`).
4. DualCrypt generates a quantum-resistant signature over the canonical container header.

---

## 5. Decrypting Containers

### Option A: 1-Click Double-Click (Windows Explorer)
Double-click any `.denc` file in Windows Explorer. DualCrypt automatically opens, switches to the **Decrypt** tab, and loads the container's **Provenance Passport**.

### Option B: Drag and Drop
1. Open the **Decrypt** tab in DualCrypt.
2. Drop the `.denc` file into the dropzone.
3. Review the **Provenance Passport** (Classification badge, Organization, Author signature).
4. For each required custodian ($k$-of-$n$):
   * Custodian 1: Enter password or select `.dkey` file.
   * Custodian 2: Enter password or select `.dkey` file.
5. The **Threshold Meter** turns green (`2/2 Quorum Met`).
6. Click **`[ 🔓 Decrypt Container ]`** and choose where to save the restored plaintext file.

---

## 6. Air-Gapped Optical Mobile Authenticator

1. On the Custodian Card, click **`📲 100% Air-Gapped Optical Sign-Off`**.
2. The desktop displays an animated flashing QR stream containing the challenge.
3. Open the **DualCrypt Authenticator** app on your offline Android phone.
4. Scan the desktop screen with the phone camera $\rightarrow$ authorize with Fingerprint or Master PIN.
5. Point the desktop camera at the phone's animated QR response $\rightarrow$ Custodian is verified instantly without any cables or network!

---

## 7. Key Escrow & Post-Quantum Vault

Switch to the **Key Escrow Vault** tab to:
* Generate standalone **ML-KEM-768** keypairs (`.pqc` / `.pqc.pub`).
* Generate standalone **ML-DSA-65** signature keypairs (`.dsa` / `.dsa.pub`).
* Inspect and test unlocking any `.dkey`, `.pqc`, or `.dsa` file with its PIN in memory.
* Copy public certificates to clipboard to send to colleagues.

---

## 8. Standalone CLI Automation (`denc`)

For automated scripts, scheduled cron backups, and CI/CD pipelines:

```bash
# Encrypt backup with 2-of-2 dual custody
denc encrypt db_dump.sql -o db_dump.sql.denc -k 2 -n 2 -p 1:PassAlpha -p 2:PassBeta

# Inspect container metadata
denc inspect db_dump.sql.denc

# Decrypt container
denc decrypt db_dump.sql.denc -o restored_db.sql -p 1:PassAlpha -p 2:PassBeta

# Launch local zero-knowledge web server
denc serve --host 127.0.0.1 --port 3000
```
