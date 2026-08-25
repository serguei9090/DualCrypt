# 🛡️ DualCrypt Enterprise Documentation Hub

Welcome to the central documentation portal for **DualCrypt Enterprise** — the zero-trust multi-party threshold file encryption and disaster escrow platform engineered with **Rust (`denc-core`, `denc-cli`, `denc-wasm`)**, **Tauri v2**, **React 19**, **Tailwind CSS**, and **Capacitor Android**.

---

## 🧭 Navigation Matrix

The documentation is organized into two distinct sections tailored for end-users/operators and core engineers/developers:

```
docs/
├── index.md                         # 📍 Master Documentation Hub (You are here)
│
├── user/                            # 📖 USER & OPERATOR DOCUMENTATION
│   ├── index.md                     # User Documentation Index
│   ├── quickstart.md                # 5-Minute Quickstart (Desktop, CLI, Mobile)
│   ├── encryption_guide.md          # File & Folder Encryption, Quorum Setup, Passports
│   ├── decryption_guide.md          # Decryption Workflows & 1-Click Explorer Launch
│   ├── custodian_methods.md         # 4 Custodian Methods (Passphrase, Keyfile, YubiKey, PQC)
│   ├── airgap_authenticator.md      # 100% Offline Mobile Authenticator & Optical Fountain Protocol
│   ├── key_vault_escrow.md          # Key Escrow & Post-Quantum Keypair Vault
│   ├── cli_reference.md             # Complete `denc` CLI Reference & Automated Recipes
│   ├── web_client.md                # Zero-Knowledge Browser Decryptor & Web Server
│   └── faq_troubleshooting.md       # Troubleshooting, Timelock Diagnostics & Recovery
│
└── dev/                             # 🛠️ DEVELOPER & ARCHITECT DOCUMENTATION
    ├── index.md                     # Developer Documentation Index
    ├── architecture.md              # System Architecture & Mermaid Diagrams
    ├── cryptography_deep_dive.md    # Mathematical & Algorithmic Cryptography Specification
    ├── container_binary_format.md   # .denc Container Binary Layout & Header Framing
    ├── codebase_structure.md        # Monorepo Anatomy & Component Interfaces
    ├── setup_and_building.md        # Local Dev Environment, Build Matrix & Testing
    ├── ci_cd_and_automation.md      # CI/CD Automation (GitHub Actions, Bash, Python)
    └── contributing.md              # Contribution Guidelines, Formatting & Security Standards
```

---

## 🌟 Executive Summary & Core Capabilities

| Capability | Technical Standard | Enterprise Guarantee |
| :--- | :--- | :--- |
| **Multi-Party Threshold Custody** | Shamir's Secret Sharing over $\text{GF}(256)$ | $k$-of-$n$ quorum enforcement. Holding $< k$ shares reveals mathematically $0$ bits of master key entropy. |
| **Symmetric Bulk Ciphers** | AES-256-GCM / XChaCha20-Poly1305 | Authenticated Encryption with Associated Data (AEAD) streaming in 64 KiB chunks with $O(1)$ memory consumption. |
| **Post-Quantum Cryptography** | NIST FIPS 203 ML-KEM-768 (Kyber) | Quantum-resistant asymmetric key encapsulation for custodian share delivery. |
| **Tamper-Evident Signatures** | NIST FIPS 204 ML-DSA-65 (Dilithium) | Quantum-safe digital container signatures bound to canonical header digest and compliance manifest. |
| **Time-Locked Disaster Escrow** | Cryptographic Epoch Verification | Recovery shares sealed until specific UTC timestamps to prevent unauthorized early access. |
| **Hardware Token Root-of-Trust** | Physical YubiKey USB (`VID 0x1050`) | Capacitive-touch hardware token presence required to unlock custodian shares. |
| **Air-Gapped Optical Sign-Off** | Animated QR Fountain Framing + CRC32 | 100% offline authorization between desktop and mobile devices with zero network or cable connection. |
| **Automated Headless CI/CD** | `denc` CLI + Declarative YAML/JSON Recipes | Fully automated encryption, decryption, and container verification in server pipelines. |

---

## 🚀 Quick Links by Audience

### For End-Users & Security Officers
* [**5-Minute Quickstart Guide**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/quickstart.md): Install native desktop apps, configure your first $k$-of-$n$ container, and decrypt.
* [**File & Folder Encryption Manual**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/encryption_guide.md): Learn how to encrypt individual files or entire folders with classification manifests.
* [**Air-Gapped Mobile Authenticator**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/airgap_authenticator.md): Use your offline Android device to optically authorize decryption.
* [**CLI Manual & Recipes**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/user/cli_reference.md): Run automated backups via `denc encrypt` and `denc decrypt`.

### For Developers, Cryptographers & SecOps
* [**System Architecture & Diagrams**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/dev/architecture.md): Explore interactive Mermaid diagrams of the cryptographic pipeline and Tauri bridge.
* [**Cryptographic Specification**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/dev/cryptography_deep_dive.md): Review finite field arithmetic, constant-time multiplication, and PQC parameters.
* [**.denc Binary Container Layout**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/dev/container_binary_format.md): Binary specifications for container parsing and header authentication.
* [**CI/CD & Automation Snippets**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/dev/ci_cd_and_automation.md): Production GitHub Actions workflow, Bash scripts, and Python automation helpers (`uv run`).

---

## 🔒 Security Invariants

1. **Zero Server Trust**: Cryptographic operations occur strictly inside local device memory. Plaintext and key material are never transmitted across networks.
2. **Deterministic Memory Zeroization**: Master DEKs, polynomial coefficients, and unencrypted shares implement `zeroize::ZeroizeOnDrop` or explicit zeroization upon exiting scope.
3. **Constant Memory Footprint**: Chunked streaming processes multi-gigabyte files with a flat memory footprint ($<25\text{ MB}$ RAM).
4. **Information-Theoretic Secret Sharing**: Possession of $k-1$ shares provides zero mathematical advantage in recovering the Data Encryption Key.
