# 🔐 Cryptographic Specification & Deep Dive

This document details the exact mathematical constructions, side-channel countermeasures, post-quantum algorithms, and cryptographic hygiene rules enforced across DualCrypt Enterprise.

---

## 📑 Contents
1. [Galois Field $\text{GF}(256)$ & Shamir Secret Sharing](#1-galois-field-textgf256--shamir-secret-sharing)
2. [Constant-Time Russian Peasant Multiplier](#2-constant-time-russian-peasant-multiplier)
3. [Polynomial Construction & Lagrange Interpolation](#3-polynomial-construction--lagrange-interpolation)
4. [Symmetric Chunked AEAD Framing & AAD Tamper-Proofing](#4-symmetric-chunked-aead-framing--aad-tamper-proofing)
5. [NIST FIPS 203 Post-Quantum KEM (ML-KEM-768 / Kyber)](#5-nist-fips-203-post-quantum-kem-ml-kem-768--kyber)
6. [NIST FIPS 204 Post-Quantum Signatures (ML-DSA-65 / Dilithium)](#6-nist-fips-204-post-quantum-signatures-ml-dsa-65--dilithium)
7. [Argon2id Memory-Hard Key Derivation](#7-argon2id-memory-hard-key-derivation)
8. [Memory Hygiene & Deterministic Zeroization](#8-memory-hygiene--deterministic-zeroization)

---

## 1. Galois Field $\text{GF}(256)$ & Shamir Secret Sharing

DualCrypt splits the 256-bit ($32\text{-byte}$) Master Data Encryption Key ($K_{\text{DEK}}$) byte-by-byte into $n$ polynomial evaluations over the finite field $\text{GF}(2^8)$.

### Irreducible Polynomial
$\text{GF}(2^8)$ is defined by the AES irreducible polynomial:
$$P(x) = x^8 + x^4 + x^3 + x + 1 \quad (\text{0x11B})$$

Field addition and subtraction are identical and equivalent to bitwise XOR:
$$a + b = a - b = a \oplus b$$

---

## 2. Constant-Time Russian Peasant Multiplier

To avoid cache timing attacks, table lookup timing side-channels, and CPU data-dependent branch leaks, finite field multiplication is executed in constant time using the Russian Peasant algorithm:

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
            a ^= 0x1b; // Modulo irreducible polynomial x^8 + x^4 + x^3 + x + 1
        }
        b >>= 1;
    }
    p
}
```

Field inversion is computed via Fermat's Little Theorem ($a^{-1} = a^{254} \pmod{P(x)}$):
```rust
pub fn gf256_inv(a: u8) -> u8 {
    if a == 0 {
        return 0;
    }
    let mut res = 1u8;
    let mut base = a;
    let mut exp = 254u8;
    while exp > 0 {
        if (exp & 1) != 0 {
            res = gf256_mul(res, base);
        }
        base = gf256_mul(base, base);
        exp >>= 1;
    }
    res
}
```

---

## 3. Polynomial Construction & Lagrange Interpolation

For each byte index $j \in \{0, \dots, 31\}$ of $K_{\text{DEK}}$:
1. Sample random polynomial coefficients $a_1, \dots, a_{k-1} \stackrel{\$}{\leftarrow} \text{GF}(256)$ using OS CSPRNG (`getrandom`).
2. Construct polynomial:
   $$f_j(x) = K_{\text{DEK}}[j] \oplus a_1 x \oplus a_2 x^2 \oplus \dots \oplus a_{k-1} x^{k-1}$$
3. Evaluate share $y_{i, j} = f_j(i)$ for each custodian $i \in \{1, \dots, n\}$.

### Lagrange Reconstruction
Given any subset of $k$ distinct custodian points $\{(x_1, y_1), \dots, (x_k, y_k)\}$:
$$K_{\text{DEK}}[j] = \bigoplus_{m=1}^{k} \left( y_m \otimes \bigotimes_{\substack{l=1 \\ l \neq m}}^{k} \frac{x_l}{x_m \oplus x_l} \right)$$

---

## 4. Symmetric Chunked AEAD Framing & AAD Tamper-Proofing

Plaintext is partitioned into $64\text{ KiB}$ ($65,536\text{ bytes}$) chunks. Each chunk $i \in \{0, 1, \dots, M\}$ is encrypted as:
$$\text{Ciphertext}_i = \text{AEAD\_Encrypt}(K_{\text{DEK}}, N_i, P_i, \text{AAD}_i)$$

### Derived Nonce ($N_i$)
* **AES-256-GCM (12-byte Nonce)**:
  $$N_i = \text{Base Nonce}[0..8] \parallel \text{be\_u32}(i)$$
* **XChaCha20-Poly1305 (24-byte Nonce)**:
  $$N_i = \text{Base Nonce}[0..16] \parallel \text{be\_u32}(i) \parallel [0\text{x}00; 4]$$

### Authenticated Associated Data ($\text{AAD}_i$)
$$\text{AAD}_i = \text{SHA-256}(\text{Canonical Header Bytes}) \parallel \text{be\_u32}(i) \parallel \text{is\_final\_byte}$$

> **Security Guarantee**: Binding the SHA-256 digest of the entire container header, the sequential chunk index, and the terminal chunk flag guarantees that chunks cannot be reordered, duplicated, truncated, or transplanted into other containers.

---

## 5. NIST FIPS 203 Post-Quantum KEM (ML-KEM-768 / Kyber)

* **Parameter Set**: ML-KEM-768 (Security Category 3, 192-bit classical & quantum security).
* **Key Generation**: Generates public encapsulation key ($pk$, 1184 bytes) and decapsulation private key ($sk$, 2400 bytes).
* **Encapsulation Workflow**:
  $$(c, K_{\text{shared}}) = \text{ML-KEM-768.Encapsulate}(pk)$$
  The custodian's Shamir share is encrypted with $K_{\text{shared}}$ via AES-256-GCM and the ciphertext $c$ (1088 bytes) is embedded in the `.denc` header.

---

## 6. NIST FIPS 204 Post-Quantum Signatures (ML-DSA-65 / Dilithium)

* **Parameter Set**: ML-DSA-65 (Security Category 3).
* **Workflow**:
  1. Author serializes canonical container header without the signature block.
  2. Author computes $\text{Digest} = \text{SHA-256}(\text{Draft Header Bytes})$.
  3. Author generates signature $\sigma = \text{ML-DSA-65.Sign}(sk_{\text{author}}, \text{Digest})$ (3309 bytes).
  4. Embeds $\sigma$ and $pk_{\text{author}}$ (1952 bytes) into the container's `HeaderSignatureBlock`.

---

## 7. Argon2id Memory-Hard Key Derivation

* **Standard**: RFC 9106
* **Memory Cost ($m$)**: $64\text{ MiB}$ ($65,536\text{ KiB}$)
* **Time Cost ($t$)**: $3\text{ passes}$
* **Parallelism ($p$)**: $4\text{ threads}$
* **Salt**: 32 cryptographically secure random bytes sampled per custodian from `OsRng`.

---

## 8. Memory Hygiene & Deterministic Zeroization

DualCrypt enforces zeroization of all sensitive key material using the Rust `zeroize` crate:
* `dek: [u8; 32]` implements `Zeroize` and is cleared immediately upon finishing chunk encryption/decryption.
* `SecretShare` implements `ZeroizeOnDrop`.
* Derived Argon2id KEK buffers and intermediate Lagrange polynomials are cleared in memory before returning to callers.
