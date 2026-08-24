# 🔐 DualCrypt Cryptographic Specification

This document details the exact cryptographic primitives, mathematical constructions, framing protocols, and security parameters used in DualCrypt Enterprise.

---

## 1. Symmetric Bulk Encryption & Chunked AEAD Framing

DualCrypt supports two NIST-approved and RFC-standardized Authenticated Encryption with Associated Data (AEAD) ciphers:
* **AES-256-GCM** (NIST SP 800-38D)
* **XChaCha20-Poly1305** (RFC 8439 / libsodium extended nonce)

### 1.1 Chunk Framing Protocol
To support multi-gigabyte or streaming inputs without loading full files into memory, DualCrypt divides plaintext into $64\text{ KiB}$ ($65,536\text{ bytes}$) chunks.

Each chunk $i \in \{0, 1, \dots, M\}$ is encrypted with:
$$\text{Chunk Ciphertext}_i = \text{AEAD\_Encrypt}(K_{\text{DEK}}, N_i, P_i, \text{AAD}_i)$$

Where:
* $K_{\text{DEK}}$: 256-bit cryptographically secure random Data Encryption Key generated via OS CSPRNG (`getrandom`).
* $N_i$: Derived chunk nonce computed as:
  * For AES-256-GCM (12-byte nonce): $N_i = \text{Base Nonce}[0..8] \parallel \text{be\_bytes}(i)$
  * For XChaCha20-Poly1305 (24-byte nonce): $N_i = \text{Base Nonce}[0..16] \parallel \text{be\_bytes}(i)$
* $\text{AAD}_i$ (Associated Data):
  $$\text{AAD}_i = \text{Header SHA-256 Digest} \parallel \text{be\_bytes}(i) \parallel \text{is\_final\_byte}$$

> **Security Guarantee**: Binding the canonical header digest and chunk counter into the authenticated Associated Data prevents ciphertext truncation, chunk reordering, and cross-file chunk transplantation attacks.

---

## 2. Threshold Secret Sharing over $\text{GF}(256)$

The Master Data Encryption Key $K_{\text{DEK}}$ is partitioned into $n$ secret shares such that any $k$ shares can reconstruct $K_{\text{DEK}}$, while any $k - 1$ shares provide zero information about $K_{\text{DEK}}$.

### 2.1 Finite Field Representation
Calculations are performed over the Galois Field $\text{GF}(2^8)$ defined by the irreducible polynomial:
$$P(x) = x^8 + x^4 + x^3 + x + 1 \quad (\text{hex: } 0\text{x}11\text{B})$$

Field multiplication is implemented using **constant-time Russian Peasant multiplication** to eliminate side-channel timing leaks:
```rust
pub fn gf256_mul(mut a: u8, mut b: u8) -> u8 {
    let mut p = 0u8;
    for _ in 0..8 {
        if (b & 1) != 0 {
            p ^= a;
        }
        let hi_bit_set = (a & 0x80) != 0;
        a <<= 1;
        if hi_bit_set {
            a ^= 0x1b; // x^8 = x^4 + x^3 + x + 1 mod 2
        }
        b >>= 1;
    }
    p
}
```

### 2.2 Polynomial Construction & Lagrange Interpolation
For each byte index $j \in \{0, \dots, 31\}$ of $K_{\text{DEK}}$:
1. Select random polynomial coefficients $a_1, \dots, a_{k-1} \stackrel{\$}{\leftarrow} \text{GF}(256)$.
2. Define the polynomial:
   $$f_j(x) = K_{\text{DEK}}[j] + a_1 x + a_2 x^2 + \dots + a_{k-1} x^{k-1}$$
3. For custodian $i \in \{1, \dots, n\}$, evaluate share value $y_{i, j} = f_j(i)$.

To reconstruct $K_{\text{DEK}}[j]$ from any subset of $k$ distinct custodian points $\{(x_1, y_1), \dots, (x_k, y_k)\}$:
$$K_{\text{DEK}}[j] = \sum_{m=1}^{k} y_m \prod_{\substack{l=1 \\ l \neq m}}^{k} \frac{0 - x_l}{x_m - x_l} \pmod{P(x)}$$

---

## 3. Post-Quantum Cryptography (PQC)

### 3.1 NIST FIPS 203: ML-KEM-768 (Kyber-768)
* **Application**: Asynchronous custodian share encapsulation.
* **Parameters**: Security Category 3 (equivalent to AES-192 against classical / quantum attacks).
* **Workflow**:
  1. Custodian generates keypair $(pk, sk)$.
  2. Encryptor generates random share $S_i$ and encapsulates it:
     $$(c, K_{\text{shared}}) = \text{ML-KEM-768.Encapsulate}(pk)$$
  3. $S_i$ is encrypted with $K_{\text{shared}}$ using AES-256-GCM and stored in the container header.
  4. Custodian decapsulates $K_{\text{shared}} = \text{ML-KEM-768.Decapsulate}(sk, c)$ and decrypts $S_i$.

### 3.2 NIST FIPS 204: ML-DSA-65 (Dilithium-3)
* **Application**: Author identity signature & immutable header tamper-proofing.
* **Parameters**: Security Category 3.
* **Workflow**:
  1. Author serializes canonical container header without signature block.
  2. Author computes $\text{Digest} = \text{SHA-256}(\text{Header Bytes})$.
  3. Author signs $\sigma = \text{ML-DSA-65.Sign}(sk_{\text{author}}, \text{Digest})$.
  4. Embeds $\sigma$ and $pk_{\text{author}}$ in `HeaderSignatureBlock`.

---

## 4. Key Derivation & Password Hardening

* **Algorithm**: **Argon2id** (RFC 9106)
* **Parameters**:
  * Memory Cost: $64\text{ MiB}$ ($65,536\text{ KiB}$)
  * Time Cost (Iterations): $3\text{ passes}$
  * Parallelism: $4\text{ threads}$
  * Salt: 32 cryptographically random bytes generated per custodian.
* **Output**: 256-bit Key Encryption Key (KEK) used to wrap the custodian's Shamir share.

---

## 5. Time-Locked Recovery Escrow Specification

* **Header Tag**: `custodian_timelocks: HashMap<u8, u64>` inside `DencManifest`.
* **Enforcement Rule**:
  $$\text{If } \exists \, t_i \in \text{custodian\_timelocks}[i] \text{ such that } \text{now\_utc}() < t_i \implies \text{Reject share with } \text{DencError::TimelockActive}$$
* **Mathematical Integrity**: `custodian_timelocks` is part of `DencManifest`, which is included in the canonical header digest verified by ML-DSA-65 signatures and AEAD Associated Data.
