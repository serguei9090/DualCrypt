# 🔒 Comprehensive Encryption & Quorum Guide

DualCrypt Enterprise allows you to encrypt files of any size (from small documents to multi-terabyte datasets) and entire directory hierarchies into authenticated `.denc` binary containers.

---

## 📑 Contents
1. [Selecting Input: Single Files vs. Directory Archives](#1-selecting-input-single-files-vs-directory-archives)
2. [Configuring Quorum & Thresholds ($k$-of-$n$)](#2-configuring-quorum--thresholds-k-of-n)
3. [Choosing Bulk Cipher Suites](#3-choosing-bulk-cipher-suites)
4. [Provenance Passport & Compliance Metadata](#4-provenance-passport--compliance-metadata)
5. [Time-Locked Disaster Escrow](#5-time-locked-disaster-escrow)
6. [NIST FIPS 204 Digital Signatures (ML-DSA-65)](#6-nist-fips-204-digital-signatures-ml-dsa-65)
7. [Encryption Execution & Key Distribution](#7-encryption-execution--key-distribution)

---

## 1. Selecting Input: Single Files vs. Directory Archives

### Single File Encryption
* Drag any single file (e.g. `.pdf`, `.zip`, `.sqlite`, `.mp4`, `.docx`) into the dropzone, or click **Browse Files**.
* DualCrypt displays the filename, byte size, file extension badge, and MIME category.

### Directory / Folder Encryption (Automatic TAR Packaging)
* Drag an entire folder into the dropzone, or click **Browse Folder**.
* DualCrypt automatically streams all child files and subdirectories into an in-memory or temporary TAR stream before applying authenticated chunk encryption.
* When decrypted, the directory structure is completely restored.

---

## 2. Configuring Quorum & Thresholds ($k$-of-$n$)

The quorum system enforces multi-party governance:

```
Total Custodians (n) = 3
Threshold Required (k) = 2

       +-------------------------------+
       | Master Data Encryption Key    |
       +-------------------------------+
                       |
        (Shamir GF(256) Secret Split)
         /             |             \
        v              v              v
  [Share 1: Alice] [Share 2: Bob] [Share 3: Charlie]
  
  Valid Quorums to Decrypt:
  - Alice + Bob       (2 shares) -> SUCCESS
  - Alice + Charlie   (2 shares) -> SUCCESS
  - Bob + Charlie     (2 shares) -> SUCCESS
  - Alice alone       (1 share)  -> MATHEMATICALLY IMPOSSIBLE (0 bits revealed)
```

### Common Quorum Configurations

| Scenario | $k$ (Threshold) | $n$ (Total) | Description | Best For |
| :--- | :---: | :---: | :--- | :--- |
| **Strict Dual Custody** | 2 | 2 | Both designated parties must agree to decrypt. | High-value wire transfers, C-suite memos. |
| **Dual Custody + Escrow** | 2 | 3 | Any 2 of 3 custodians can unlock (e.g. CFO + CEO, or CFO + Escrow Key). | Disaster recovery, personnel turnover backup. |
| **Board Majority** | 3 | 5 | 3 out of 5 committee members required. | Regulatory disclosures, cryptographic root keys. |

---

## 3. Choosing Bulk Cipher Suites

In the **Cipher Suite** dropdown, select between two enterprise-grade authenticated ciphers:

| Cipher | Key Size | Nonce Size | Hardware Acceleration | Use Case |
| :--- | :---: | :---: | :--- | :--- |
| **AES-256-GCM** *(Default)* | 256 bits | 12 bytes | Intel/AMD AES-NI, ARMv8 Crypto Extensions | NIST compliance, maximum throughput on desktop/servers ($>2\text{ GB/s}$). |
| **XChaCha20-Poly1305** | 256 bits | 24 bytes | Pure software / SIMD AVX2/NEON | Extended nonce resilience, systems without dedicated AES instructions. |

Both ciphers are wrapped in **64 KiB chunked AEAD framing** where every chunk is bound to the container's canonical header digest and chunk counter.

---

## 4. Provenance Passport & Compliance Metadata

DualCrypt allows embedding an immutable governance manifest inside the authenticated container header:

1. Expand the **📋 Compliance & Governance Manifest** panel.
2. Configure the following fields:
   * **Classification Level**: `UNCLASSIFIED`, `RESTRICTED`, `CONFIDENTIAL`, or `TOP_SECRET`.
   * **Purpose / Scope**: Short description of why the container was generated (e.g. `Quarterly Financial Ledger Backup`).
   * **Organization / Dept**: The issuing entity (e.g. `Finance & Audit Group`).
   * **Retention Expiry**: Optional deletion/retention epoch timestamp.
3. This metadata is bound into the container header digest and signed by the author, making metadata tampering immediately detectable.

---

## 5. Time-Locked Disaster Escrow

To protect against lost keys while preventing premature insider decryption, you can configure **Time-Locked Recovery Shares**:

1. On any custodian card (e.g., Custodian 3 — "Disaster Recovery Escrow"), check **`[x] ⏳ Time-Lock Escrow`**.
2. Select an activation timestamp in UTC:
   * Use the interactive calendar & clock picker, or
   * Click a quick preset: **`+30 Days`**, **`+90 Days`**, **`+6 Months`**, or **`+1 Year`**.
3. **Behavior at Decryption**:
   * If a user attempts to use this share before the UTC timestamp, the software rejects it with `DencError::TimelockActive`.
   * After the timestamp expires, the share becomes active and can count toward the $k$-of-$n$ quorum.

---

## 6. NIST FIPS 204 Digital Signatures (ML-DSA-65)

Ensure non-repudiation and origin authenticity using Post-Quantum Digital Signatures:

1. Check **`[x] Digitally Sign Container (NIST FIPS 204 ML-DSA-65)`**.
2. Enter the Author Identity (e.g. `Alice - Chief Security Officer`).
3. Paste the author's Base64-encoded private signing key, or load a `.dsa` keyfile.
4. DualCrypt signs the canonical container header digest. Any modification to the encrypted ciphertext, custodian configuration, or manifest will invalidate the signature during inspection and decryption.

---

## 7. Encryption Execution & Key Distribution

1. Click **`[ 🔒 Encrypt Container ]`**.
2. Choose where to save the `.denc` output container.
3. DualCrypt displays the live progress ring and split-screen custodian status.
4. If any custodian was configured as a **Key File (`.dkey`)** or **Post-Quantum Keypair (`.pqc`)**, DualCrypt automatically exports the corresponding credential files.
5. Safely distribute exported key files to the respective custodians (e.g. via air-gap USB, secure enclave, or encrypted channel).
