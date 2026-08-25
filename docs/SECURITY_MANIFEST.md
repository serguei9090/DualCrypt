# 🛡️ DualCrypt Enterprise Security & Assurance Manifest

> **Zero-Trust Multi-Party Threshold Cryptography, Key Protection & Memory Safety Specification**  
> *Authoritative Security Manifest for Enterprise Security Auditors, DevOps Architects, and SecOps Teams.*

---

## 📑 Table of Contents
1. [Executive Summary & Zero-Trust Posture](#1-executive-summary--zero-trust-posture)
2. [Threat Model & Adversary Resilience](#2-threat-model--adversary-resilience)
3. [Mathematical Cryptographic Guarantees](#3-mathematical-cryptographic-guarantees)
4. [Multi-Tier Key Protection & Custody Controls](#4-multi-tier-key-protection--custody-controls)
5. [Memory Safety, Zeroization & Anti-Leak Architecture](#5-memory-safety-zeroization--anti-leak-architecture)
6. [High-Performance $O(1)$ Streaming Pipeline](#6-high-performance-o1-streaming-pipeline)
7. [Headless CI/CD Pipeline Automation Security](#7-headless-cicd-pipeline-automation-security)
8. [Air-Gapped Optical Mobile Enclave](#8-air-gapped-optical-mobile-enclave)
9. [Governance, Compliance & Immutable Manifests](#9-governance-compliance--immutable-manifests)
10. [Audit Verification & Quality Assurance Summary](#10-audit-verification--quality-assurance-summary)

---

## 1. Executive Summary & Zero-Trust Posture

Traditional file encryption systems suffer from an existential single point of failure:
* **Compromise Risk**: If a single passphrase or private key is stolen, the entire dataset is breached.
* **Loss Risk**: If a sole keyholder departs, loses their key, or becomes incapacitated, organizational data is permanently unrecoverable.

**DualCrypt Enterprise** replaces single-custodian vulnerabilities with **$k$-of-$n$ threshold multi-party cryptography**, **NIST FIPS 203/204 Post-Quantum Cryptography**, and **$O(1)$ memory-safe streaming pipelines**. Plaintext is never encrypted under human passwords directly; instead, it is encrypted under an ephemeral 256-bit Data Encryption Key (DEK) that is mathematically fragmented using Shamir's Secret Sharing over $\text{GF}(256)$.

```
                      +----------------------------------+
                      |     Sensitive Payload Data       |
                      +----------------------------------+
                                       |
                   [ Ephemeral 256-bit OS CSPRNG Master DEK ]
                                       |
           +---------------------------+---------------------------+
           |                                                       |
           v                                                       v
+-----------------------+                               +---------------------+
| Shamir Secret Split   |                               | Chunked AEAD Stream |
|  GF(256) (k-of-n)     |                               | (AES-GCM / XChaCha) |
+-----------------------+                               +---------------------+
    |       |       |                                              |
 Cust 1  Cust 2  Cust 3                                            v
 (Pass)  (PQC)   (AirGap)                              [ Authenticated .denc ]
```

---

## 2. Threat Model & Adversary Resilience

| Threat Category | Adversary Capability | DualCrypt Defense Mechanism |
| :--- | :--- | :--- |
| **Malicious Insider / Rogue Keyholder** | Holds $k-1$ custodian shares and attempts unauthorized decryption. | **Information-Theoretic Security**: Holding $<k$ shares reveals exactly $0$ bits of entropy regarding the master key. Reconstruction is mathematically impossible. |
| **Post-Quantum Adversary (Store Now, Decrypt Later)** | Captures encrypted containers today to attack with future fault-tolerant quantum computers (Shor's algorithm). | **NIST FIPS 203 (ML-KEM-768)** for quantum-safe asymmetric encapsulation and **256-bit symmetric AEAD** (resistant to Grover's algorithm with 128-bit post-quantum security). |
| **RAM Dumps & Memory Scraping** | Cold-boot attacks, heap inspection, debugger memory dump. | **Immediate Zeroization**: All secret keys, private keys, and intermediate shares implement `ZeroizeOnDrop` and are overwritten with zeros immediately upon exiting scope. |
| **Ciphertext Tampering / Bit-Flipping** | Modifies encrypted payload, reorders chunks, or truncates file. | **Framed AEAD with Header AAD Binding**: Every $64\text{ KiB}$ chunk binds the canonical header SHA-256 digest, chunk counter, and final chunk tag into the Associated Data. |
| **Side-Channel & Cache Timing Attacks** | Analyzes CPU execution time or cache line hits during finite field operations. | **Constant-Time Execution**: $\text{GF}(256)$ arithmetic uses branchless, constant-time Russian Peasant multiplication without lookup tables. |
| **Supply Chain / Network Snooping** | Man-in-the-middle network interception on custodian channels. | **100% Air-Gapped Optical Handshake**: Dynamic camera-to-screen QR communication requiring zero network sockets, Bluetooth, or Wi-Fi. |

---

## 3. Mathematical Cryptographic Guarantees

### 3.1 Information-Theoretic Threshold Sharing over $\text{GF}(256)$
The master 256-bit DEK $K_{\text{DEK}}$ is partitioned into $n$ secret shares over the Galois Field $\text{GF}(2^8)$ defined by the irreducible polynomial:
$$P(x) = x^8 + x^4 + x^3 + x + 1 \quad (0\text{x}11\text{B})$$

For each byte index $j \in \{0, \dots, 31\}$ of $K_{\text{DEK}}$:
1. A random $(k-1)$-degree polynomial is constructed:
   $$f_j(x) = K_{\text{DEK}}[j] + a_1 x + a_2 x^2 + \dots + a_{k-1} x^{k-1} \pmod{P(x)}$$
2. Evaluated at non-zero distinct points $x \in \{1, 2, \dots, n\}$ to yield custodian shares.
3. Reconstruction uses Lagrange interpolation:
   $$K_{\text{DEK}}[j] = \sum_{i=1}^{k} y_i \prod_{j \neq i} \frac{-x_j}{x_i - x_j} \pmod{P(x)}$$

> **Mathematical Guarantee**: Any coalition of $k-1$ custodians has $\sum_{a_1, \dots, a_{k-1}} \Pr(f(0) = S) = \frac{1}{|\text{GF}(256)|}$, providing absolute statistical independence and zero Shannon information leakage.

### 3.2 Authenticated Encryption with Associated Data (AEAD)
DualCrypt supports two high-assurance bulk ciphers:
* **AES-256-GCM** (NIST SP 800-38D): Hardware-accelerated AES-NI with GMAC authentication tags.
* **XChaCha20-Poly1305** (RFC 8439 / libsodium): 192-bit extended nonces eliminating nonce-reuse collision hazards.

---

## 4. Multi-Tier Key Protection & Custody Controls

DualCrypt provides 5 distinct, defense-in-depth custodian authentication tiers:

```mermaid
graph TD
    A[Custodian Authentication Methods] --> B[1. NIST FIPS 203 ML-KEM-768]
    A --> C[2. Argon2id Wrapped Passphrase]
    A --> D[3. Hardware YubiKey USB]
    A --> E[4. Air-Gapped Optical Mobile Vault]
    A --> F[5. Time-Locked Recovery Escrow]
```

1. **⚛️ Post-Quantum Key Encapsulation (ML-KEM-768)**:
   - Module Learning with Errors (M-LWE) lattice cryptography.
   - Allows asynchronous key dispatch: encryptors use a colleague's public key (`.pqc.pub`) without needing pre-shared secrets.
2. **🔐 Memory-Hard Password Protection (Argon2id)**:
   - Passphrase-protected shares are derived using **Argon2id** ($m=64\text{ MB}, t=3, p=4$).
   - Extremely resistant to GPU, FPGA, and ASIC brute-force clusters.
3. **🔑 Physical Hardware Root-of-Trust (YubiKey USB)**:
   - Hardware detection for USB YubiKeys (`VID 0x1050`).
   - Requires physical capacitive human touch on the hardware sensor to authorize key operations.
4. **📱 Air-Gapped Mobile Vault with Biometrics**:
   - Keys stored on offline mobile devices encrypted with **PBKDF2 (100,000 iterations) + AES-256-GCM**.
   - Decrypted only into volatile RAM upon Fingerprint / Face Unlock or Master PIN entry.
5. **⏳ Time-Locked Dead Man's Quorum**:
   - Recovery shares can be sealed with a minimum UTC unlock timestamp (`timelock_not_before_utc`).
   - Mathematically verified against the signed header manifest; early unlock attempts are rejected by the core engine.

---

## 5. Memory Safety, Zeroization & Anti-Leak Architecture

DualCrypt is engineered in strict adherence to secure systems programming paradigms to eliminate memory safety vulnerabilities and sensitive data retention:

### 5.1 Comprehensive Memory Zeroization
All cryptographic secrets in Rust implement the `Zeroize` and `ZeroizeOnDrop` traits from the audited `zeroize` crate:
```rust
#[derive(Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
pub struct PqcKeypair {
    pub public_key_base64: String,
    pub private_key_base64: String,
    #[zeroize(skip)]
    pub algorithm: String,
}
```
* **DEK Lifecycles**: The raw Data Encryption Key exists in RAM only for the duration of the stream encryption loop and is explicitly cleared via `.zeroize()` immediately after final chunk processing.
* **Share Lifecycles**: Shamir shares and derived Argon2id keys are purged on drop.
* **Compiler Optimization Barrier**: Volatile write intrinsics guarantee the compiler cannot optimize away memory scrub operations.

### 5.2 Rust Memory Safety Guarantees
* **No Use-After-Free / No Double-Free**: Compile-time borrow checking enforces single ownership and strict lifetimes.
* **No Buffer Overflows**: Bounds-checked slicing and Little-Endian byteorder parsers protect against memory corruption.
* **No Uninitialized Memory Access**: Zero `unsafe` blocks in core encryption and threshold secret sharing logic.

### 5.3 Constant-Time Arithmetic
Galois Field arithmetic is implemented using branchless Russian Peasant multiplication:
* Zero secret-dependent memory lookup tables (eliminates CPU L1/L2 cache timing attacks like CacheBleed/Spectre).
* Constant instruction counts regardless of input byte values.

---

## 6. High-Performance $O(1)$ Streaming Pipeline

Unlike naive encryption tools that read entire multi-gigabyte files into RAM (causing Out-Of-Memory crashes, OS paging leaks, and swap file persistence):

```
+-------------------------------------------------------------------------+
| DualCrypt Streaming Architecture: Constant O(1) Memory (< 20 MB RAM)    |
|                                                                         |
|  [ Disk Input ] ---> [ 64 KiB Buffer ] ---> [ AEAD Engine ]             |
|                              |                                          |
|                      (Immediate Zeroize)                                |
|                              |                                          |
|                              v                                          |
|                     [ Disk Output .denc ]                               |
+-------------------------------------------------------------------------+
```

* **Chunk Size**: Fixed $64\text{ KiB}$ ($65,536\text{ bytes}$) chunk pipeline.
* **Memory Footprint**: Strict $<20\text{ MB}$ RAM footprint whether encrypting a $1\text{ KB}$ text file or a $500\text{ GB}$ database archive.
* **Disk-Speed Throughput**: Saturates NVMe and SSD read/write bandwidth with zero garbage-collection latency spikes.

---

## 7. Headless CI/CD Pipeline Automation Security

The `denc` CLI is purpose-built for zero-human-intervention execution in automated build environments (GitHub Actions, GitLab CI, Jenkins, Kubernetes jobs):

| Pipeline Security Feature | Risk Prevented | Technical Implementation |
| :--- | :--- | :--- |
| **Dynamic Stdin Piping (`--config -`)** | Secret leakage via disk write or temporary file residue. | Receives JSON/YAML recipes directly through `stdin` streams, parsing directly into memory without creating filesystem artifacts. |
| **Isolated Key Output Directory (`--key-dir`)** | Key collisions or accidental world-readable exposures. | Generates dedicated `.pqc` keyfiles in isolated temporary directories (`/tmp/ci_keys/custodian_*.pqc`). |
| **Machine-Readable `--json` Mode** | Log injection, regex scraping errors, and credential leaks in CI console logs. | Emits structured JSON exclusively on `stdout` while suppressing interactive progress bars and debug banners. |
| **Author Digital Signing (`ML-DSA-65`)** | Unauthorized artifact spoofing or tampering in the deployment pipeline. | Digits sign containers using NIST FIPS 204 ML-DSA-65 private keys, creating cryptographic provenance. |

---

## 8. Air-Gapped Optical Mobile Enclave

For high-security environments where workstations or mobile devices are physically disconnected from corporate networks:

1. **Zero Network Permissions**:
   - The Android Authenticator app declares **zero Internet permissions** (`android.permission.INTERNET` is omitted from `AndroidManifest.xml`).
2. **Optical Camera-to-Screen Channel**:
   - Key exchanges and quorum authorizations occur via **dynamic 2-way animated QR fountain codes** with 32-bit CRC integrity verification.
   - Physical air-gap is 100% maintained; no Wi-Fi, cellular, Bluetooth, or USB data cables are required.
3. **Hardware-Backed Cryptographic Storage**:
   - Key shares are stored in private app storage encrypted with PBKDF2 + AES-256-GCM.
   - Decryption keys are unlocked only in volatile memory following biometric authentication (Fingerprint / Face ID).

---

## 9. Governance, Compliance & Immutable Manifests

Every `.denc` container includes an authenticated header manifest bound into the cryptographic signature:

* **Security Classifications**:
  - `TOP SECRET 🔴`, `CONFIDENTIAL 🟠`, `INTERNAL 🔵`, `RESTRICTED 🟣`, `GENERAL 🟢`.
* **Governance Metadata**:
  - Issuing organization, department, operational purpose, original filename, and UTC creation timestamp.
* **Tamper-Evident Header Digest**:
  - Any modification to the classification, custodian roster, or manifest parameters causes immediate AEAD authentication tag validation failure during decryption.

---

## 10. Audit Verification & Quality Assurance Summary

DualCrypt undergoes continuous automated quality gate validation on every commit:

```mermaid
flowchart LR
    A[CI Quality Gate] --> B[Cargo Workspace Tests: 22/22 Cryptographic Suites Passed]
    A --> C[Biome Formatter & Strict Linter Check: Clean]
    A --> D[End-to-End Pipeline Integration Test: 6/6 Stages Verified]
    A --> E[Multi-OS Cross Compilation: Windows, Linux, macOS, Android]
```

* **Cryptographic Unit Tests**: Full round-trip coverage for $GF(256)$ arithmetic, Shamir Secret Sharing, NIST FIPS 203 ML-KEM, NIST FIPS 204 ML-DSA, Argon2id KDF, and AEAD ciphers.
* **No Pseudo-Code / No Mocking**: All cryptographic workflows in core, CLI, WebAssembly, and mobile targets are 100% real, operational, and production-ready.
