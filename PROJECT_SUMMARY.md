# Project Blueprint: Enterprise Dual-Control & Threshold Encryption System

## 1. Executive Summary & Vision
This project is an enterprise-grade **Dual-Control / Multi-Party Threshold File Encryption Platform** designed for high-assurance, zero-trust environments. It enables scenarios where sensitive payloads are encrypted and can only be decrypted when a predefined quorum of authorized parties ($k$-of-$n$ threshold, e.g., 2-of-2 or 2-of-3) are physically co-present or concurrently submit their cryptographic shares.

### Key Use Case (3-Party Enterprise Flow)
* **Party 1 (P1 - Recipient/Client)**
* **Party 2 (P2 - Intermediary/Relay/Broker)**
* **Party 3 (P3 - Originator/Provider)**
* **Workflow**: P3 shares sensitive data with P1 via P2. P1 cannot decrypt the data alone; a designated custodian from P3 must be physically present at the workstation (or provide an ephemeral token/QR) to reconstruct the key and unlock the file. P2 acts as an untrusted intermediary holding no keys.

---

## 2. Technology Stack Decision

| Layer | Chosen Technology | Rationale |
| :--- | :--- | :--- |
| **Crypto Core** | **Rust** (`aes-gcm`, `sharks`/`vss`, `fips203`/`ml-kem`, `zeroize`, `subtle`) | Industry gold standard for memory safety, deterministic key zeroization in RAM (`ZeroizeOnDrop`), constant-time execution against side-channels, and native Post-Quantum support. |
| **Desktop App** | **Tauri v2** | Native, ultra-lightweight desktop binary (~10–15 MB), sandboxed OS WebViews (Edge WebView2 / WKWebView), strict IPC Access Control Lists (ACLs), low attack surface. |
| **Web App** | **WebAssembly (Wasm)** | The core Rust crypto engine compiles directly to client-side Wasm for 100% zero-knowledge in-browser encryption/decryption without server-side plaintext exposure. |
| **Frontend UI** | **React + TypeScript + Tailwind CSS** (via Bun & Vite) | Ideal for rapid "vibecoding", instant hot-reloading, and creating sleek, minimalist, cyber/dark-mode enterprise interfaces. |
| **Runtime & Tooling** | `bun` (JS/TS), `cargo` (Rust), `biome` (lint/format), `git` | Standardized tooling matrix. |

---

## 3. Cryptographic Architecture & Post-Quantum Design

### 3.1 Bulk Encryption (Data Encryption Key - DEK)
* **Algorithm**: **AES-256-GCM** or **XChaCha20-Poly1305** (AEAD authenticated encryption).
* **Quantum Resistance**: 256-bit symmetric keys provide 128-bit security against Grover's quantum search algorithm, meeting NIST and NSA CNSA 2.0 quantum-safe criteria.

### 3.2 Threshold Secret Sharing
* **Algorithm**: **Shamir’s Secret Sharing (SSS) over Galois Field $GF(256)$ / Verifiable Secret Sharing (Pedersen/Feldman VSS)**.
* **Quantum Security**: Information-Theoretically Secure. Even an adversary with infinite quantum computing power holding $k-1$ shares has zero mathematical information about the DEK.
* **Quorum Configuration**: Configurable $(k, n)$ thresholds (e.g., 2-of-2 strict dual custody, 2-of-3 with disaster recovery escrow).

### 3.3 Post-Quantum Public-Key Transport & Identity
* **Key Encapsulation**: **ML-KEM-768 / Kyber-768** (NIST FIPS 203) for quantum-safe asymmetric transmission of individual Shamir shares.
* **Digital Signatures**: **ML-DSA-65 / Dilithium-3** (NIST FIPS 204) for origin authentication and non-repudiation.

### 3.4 Memory Hygiene
* Sensitive buffers, share fragments, and reconstructed keys are protected using Rust's `zeroize` and `mlock` to prevent leaking key material to disk swap or retaining artifacts in memory after scope exit.

---

## 4. File Container Specification (`.denc`)

The output file replaces legacy loose JSON/password files with a binary authenticated container:
```
+-------------------------------------------------------------+
| Header: Magic Bytes "DENC" (4B) | Version (2B) | Cipher ID  |
+-------------------------------------------------------------+
| Threshold Header: Quorum (k, n) | Salt (32B) | Nonce (12B)  |
+-------------------------------------------------------------+
| Recipient Descriptors & SSS Share Metadata                  |
|  - Custodian 1 (P1): Key ID / Encrypted Share Slice         |
|  - Custodian 2 (P3): Key ID / Ephemeral Challenge Slot      |
+-------------------------------------------------------------+
| Post-Quantum Digital Signature (ML-DSA-65)                  |
+-------------------------------------------------------------+
| Authenticated Ciphertext Stream (AES-256-GCM)               |
+-------------------------------------------------------------+
| AEAD Authentication Tag (16B)                               |
+-------------------------------------------------------------+
```

---

## 5. UI/UX & Co-Presence Interactions
1. **Dual-Custody Split Screen**: Clean, minimalist UI with dual input quadrants (Custodian 1 & Custodian 2).
2. **Air-Gapped QR Handshake**: Challenge-response dynamic QR codes for mobile authenticator approval.
3. **Hardware Token Ready**: YubiKey / FIDO2 tap or OTP share integration.
4. **Visual Threshold Meter**: Real-time feedback showing quorum status (e.g., `1 of 2 custodians verified`).

---

## 6. Migration Plan & Next Steps (For Next Session)

1. **Workspace Hygiene**:
   * Move legacy Python prototypes (`dual_encrypt.py`, `dual_decrypt_v2.py`, etc.) into an `/archive` folder.
   * Configure `.gitignore` for Rust (`target/`), Node/Bun (`node_modules/`, `dist/`), Python (`.venv/`, `__pycache__/`), and scratch files (`/scratch`).
2. **Scaffold Project Foundation**:
   * Create `tauri-app` with Vite + React + TypeScript via `bun`.
   * Initialize the Rust cryptographic core crate (`denc-core`) with AES-256-GCM, SSS, and zeroize.
3. **Implement UI & Wasm Bridge**:
   * Build the minimal dual-custody interface.
   * Connect Tauri IPC commands (Desktop) and Wasm bindings (Web).
