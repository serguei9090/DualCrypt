# ❓ Troubleshooting, Diagnostics & FAQ

This guide provides answers to frequently asked questions and troubleshooting steps for common error states in DualCrypt Enterprise.

---

## 📑 Contents
1. [Frequently Asked Questions (FAQ)](#1-frequently-asked-questions-faq)
2. [Common Error Codes & Diagnostic Solutions](#2-common-error-codes--diagnostic-solutions)
3. [Time-Lock Error Resolution](#3-time-lock-error-resolution)
4. [Lost Keys & Disaster Recovery Procedures](#4-lost-keys--disaster-recovery-procedures)
5. [Hardware Token & Camera Troubleshooting](#5-hardware-token--camera-troubleshooting)

---

## 1. Frequently Asked Questions (FAQ)

### Q: Can one custodian decrypt the file alone?
**No.** DualCrypt utilizes Shamir's Secret Sharing over $\text{GF}(256)$ with polynomial degree $t = k - 1$. An unauthorized party holding $k - 1$ or fewer shares has strictly $0$ information about the master key.

### Q: Does DualCrypt upload files or encryption keys to any cloud server?
**No.** DualCrypt operates on a strict **zero-trust, zero-server** model. All encryption, key splitting, and decryption logic runs locally on your device CPU/RAM.

### Q: What is the maximum supported file size?
DualCrypt uses an $O(1)$ constant-memory chunked streaming pipeline ($64\text{ KiB}$ chunks). You can encrypt files or directory archives of arbitrary size (100+ GB) using under $25\text{ MB}$ of system RAM.

### Q: Is DualCrypt safe against future quantum computers?
**Yes.** DualCrypt incorporates **NIST FIPS 203 ML-KEM-768 (Kyber)** for quantum-safe asymmetric share encapsulation and **NIST FIPS 204 ML-DSA-65 (Dilithium)** for quantum-safe digital signatures.

---

## 2. Common Error Codes & Diagnostic Solutions

| Error | Cause | Recommended Solution |
| :--- | :--- | :--- |
| **`DencError::InsufficientShares { provided: X, required: Y }`** | The number of valid custodian credentials provided is less than threshold $k$. | Provide additional custodian credentials until the threshold meter turns green ($X \ge Y$). |
| **`DencError::IntegrityCheckFailed`** | The file ciphertext has been modified, corrupted during transfer, or an incorrect key was used. | Ensure the `.denc` file was not truncated during copy or download. Re-verify custodian passwords. |
| **`DencError::InvalidMagicBytes`** | The file is not a valid `.denc` container or the header is corrupted. | Verify that the file begins with the `DENC` magic bytes (`0x44 0x45 0x4E 0x43`). |
| **`DencError::TimelockActive { unlock_time, current_time }`** | A custodian share has an active time-lock escrow restriction that has not expired. | Wait until the specified UTC timestamp has elapsed, or use an alternative custodian to fulfill the quorum. |
| **`DencError::InvalidSignature`** | The NIST FIPS 204 container signature failed validation against the header digest. | The container header or metadata was modified after being signed. Do not trust untrusted files. |

---

## 3. Time-Lock Error Resolution

If you encounter `DencError::TimelockActive`:
1. Use `denc inspect container.denc` to view the exact UTC release timestamp:
   ```bash
   denc inspect container.denc
   ```
2. Check your system clock to ensure your local clock is accurately synchronized via NTP.
3. If the container configured a redundant quorum (e.g. 2-of-3 with Custodian 1 & 2 as immediate executives and Custodian 3 as the timelocked escrow), ask Custodian 2 to authenticate instead.

---

## 4. Lost Keys & Disaster Recovery Procedures

* **Lost Passphrase / Keyfile**:
  * Because DualCrypt uses information-theoretically secure Shamir's Secret Sharing, lost keys cannot be recovered by any backdoor.
  * If your quorum was configured with $n > k$ (e.g. 2-of-3 or 3-of-5), use the remaining available custodians to fulfill quorum.
  * If a Time-Locked Recovery share was created during encryption, wait until the timelock expiration date to unlock using the recovery escrow key.

---

## 5. Hardware Token & Camera Troubleshooting

### YubiKey Not Detected
* Ensure the YubiKey is firmly inserted into a functioning USB port.
* On Linux, ensure `udev` rules permit user access to USB devices (`VID 0x1050`).
* Re-open the DualCrypt Hardware Settings panel to refresh USB enumeration.

### Animated QR Camera Scan Fails
* Adjust screen brightness on the desktop to prevent camera glare.
* Hold the phone 12–18 inches away from the computer screen.
* Ensure room lighting is even and there is no direct reflective spotlighting on the screen.
