# 👥 Custodian Authentication Methods Guide

DualCrypt Enterprise supports four enterprise-grade authentication methods for individual custodian shares. Different custodians in the same quorum can use different methods (e.g. Custodian 1 uses Passphrase, Custodian 2 uses YubiKey, Custodian 3 uses Post-Quantum KEM).

---

## 📑 Comparison Matrix

| Method | Share Location | Cryptographic Mechanism | Resistance / Security Profile | Best Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **Passphrase** | Embedded in `.denc` header | Argon2id KDF ($64\text{ MB}$) + AES-256-GCM | Resistant to GPU/ASIC dictionary attacks | Executive passwords, memorable secrets |
| **Key File (`.dkey`)** | Exported binary file | Direct 32-byte Shamir share + optional PIN | High physical security; isolated from header | Air-gapped USB storage, safe deposit boxes |
| **Physical YubiKey** | Physical hardware token | USB HID/CCID challenge-response (`VID 0x1050`) | Hardware root-of-trust; immune to software keyloggers | Zero-trust workstation operators |
| **⚛️ Post-Quantum KEM** | Embedded in `.denc` header | NIST FIPS 203 ML-KEM-768 key encapsulation | Quantum-proof (Security Category 3, 192-bit equiv) | Asynchronous cross-organizational dispatch |

---

## 1. Passphrase Authentication

When choosing **Passphrase**:
1. The user inputs a strong password.
2. DualCrypt generates a cryptographically random 32-byte salt (`OsRng`).
3. DualCrypt derives a 256-bit Key Encryption Key (KEK) using **Argon2id**:
   * Memory Cost: $64\text{ MiB}$ ($65,536\text{ KiB}$)
   * Time Cost: $3\text{ passes}$
   * Parallelism: $4\text{ threads}$
4. The custodian's Shamir share is encrypted with the KEK via AES-256-GCM and embedded directly into the `.denc` header.
5. **Decryption**: Entering the correct passphrase regenerates the KEK and unwraps the share. The derived KEK is zeroized immediately.

---

## 2. Key File (`.dkey`) Authentication

When choosing **Key File (`.dkey`)**:
1. The Shamir share is **NOT** stored inside the `.denc` container header. The header only contains a zero-length placeholder descriptor.
2. Upon encryption, DualCrypt exports a standalone `.dkey` file containing the raw Shamir share and coordinate.
3. You can optionally apply a **PIN / Password** to encrypt the `.dkey` file itself.
4. **Decryption**: To unlock this slot, the operator must browse and select the corresponding `.dkey` file from their local disk or USB token.

---

## 3. Physical YubiKey USB Authentication

When choosing **YubiKey Hardware Token**:
1. DualCrypt polls connected USB devices for Yubico hardware (`Vendor ID: 0x1050`).
2. When detected, the custodian slot displays the connected device model (e.g. `YubiKey 5 NFC / 5C`).
3. To encrypt or decrypt, DualCrypt sends a hardware challenge to the YubiKey requiring physical user presence (capacitive gold disc touch).
4. The response is used to bind and release the custodian share.
5. **Decryption**: The physical YubiKey must be plugged in and touched when prompted.

---

## 4. Post-Quantum Key Encapsulation (NIST FIPS 203 ML-KEM-768)

When choosing **Post-Quantum KEM**:
1. **Asymmetric Key Exchange**:
   * The recipient/custodian generates an ML-KEM-768 keypair in the [**Key Escrow Vault**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/key_vault_escrow.md) and shares their public key (`.pqc.pub` or Base64 string) with the encryptor.
2. **Encapsulation**:
   * DualCrypt encapsulates a fresh shared secret against the custodian's ML-KEM-768 public key:
     $$(c, K_{\text{shared}}) = \text{ML-KEM-768.Encapsulate}(pk)$$
   * The Shamir share is encrypted with $K_{\text{shared}}$ and the ciphertext $c$ is embedded in the `.denc` header.
3. **Decapsulation / Decryption**:
   * The recipient provides their private key (`.pqc` file or Base64 string).
   * DualCrypt decapsulates $K_{\text{shared}} = \text{ML-KEM-768.Decapsulate}(sk, c)$ and recovers the Shamir share.
   * **Quantum Immunity**: Immune to Shor's algorithm and large-scale quantum computers.
