# 📖 DualCrypt Enterprise User Documentation

Welcome to the **DualCrypt Enterprise User Guide Hub**. This section provides complete operational documentation for end-users, system administrators, security officers, and enterprise custodians.

---

## 📑 User Documentation Index

| Guide | Description | Target Audience |
| :--- | :--- | :--- |
| [**🚀 5-Minute Quickstart**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/quickstart.md) | Installation, initial setup, and your first 2-of-2 dual custody encryption and decryption. | All users & operators |
| [**🔒 File & Folder Encryption**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/encryption_guide.md) | Comprehensive manual for packaging files/folders into `.denc` containers, configuring quorums, and applying compliance metadata. | Security Officers, Creators |
| [**🔓 Container Decryption**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/decryption_guide.md) | Step-by-step decryption workflows, Windows Explorer double-click launch, and passport review. | Custodians, Auditors |
| [**👥 Custodian Authentication Methods**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/custodian_methods.md) | Guide to Passphrases, External `.dkey` Key Files, Physical YubiKey USB tokens, and Post-Quantum ML-KEM keys. | All Custodians |
| [**📲 Air-Gapped Mobile Authenticator**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/airgap_authenticator.md) | 100% offline Android sign-off using animated QR optical fountain streams and biometric verification. | Mobile Custodians |
| [**🏛️ Key Escrow & Post-Quantum Vault**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/key_vault_escrow.md) | Generating standalone ML-KEM-768 / ML-DSA-65 keypairs, inspecting keys, and managing escrows. | Security Administrators |
| [**⚡ Standalone CLI Reference (`denc`)**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/cli_reference.md) | Command-line usage, headless automation, YAML/JSON recipes, and piping. | DevOps, Sysadmins |
| [**🌐 Zero-Knowledge Web Client**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/web_client.md) | Running in-browser WebAssembly decryption and local LAN server operations. | Remote Custodians |
| [**❓ Troubleshooting & FAQ**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/faq_troubleshooting.md) | Diagnostic solutions for common errors, timelock restrictions, damaged containers, and key loss. | Support & Operators |

---

## 🎯 Key Concepts for Operators

### 1. What is Threshold Cryptography ($k$-of-$n$)?
In traditional encryption, a single password unlocks sensitive files. If that password is stolen or forgotten, disaster ensues. DualCrypt divides the master Data Encryption Key into $n$ separate cryptographic shares using **Shamir's Secret Sharing over $\text{GF}(256)$**. You configure a threshold $k \le n$ (such as 2-of-2 or 2-of-3):
* Any $k$ authorized custodians can combine their credentials to decrypt the container.
* Any unauthorized group holding fewer than $k$ shares learns **mathematically zero bits** of the underlying key.

### 2. What is a `.denc` Container?
A `.denc` file is an authenticated, tamper-proof binary envelope that packages your encrypted payload alongside:
* An authenticated header with custodian metadata and wrapped shares.
* A cryptographic **Provenance Passport** containing classification level, organization, and timestamp.
* Optional **NIST FIPS 204 ML-DSA-65** digital author signatures.
* Optional **Time-Locked Escrow** deadlines that mathematically block early decryption.

### 3. What is Air-Gapped Optical Sign-Off?
For high-security operations, a custodian can keep their cryptographic secret on an **offline Android device**. Decryption requests and responses are transmitted purely by pointing cameras at animated flashing QR codes on screen — zero Wi-Fi, zero Bluetooth, and zero USB cables required.
