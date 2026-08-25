# 📂 Codebase Anatomy & Monorepo Structure

This guide provides a comprehensive tour of the DualCrypt Enterprise monorepo, its component boundaries, and internal interfaces.

---

## 📑 Monorepo Topology Overview

```
Dual_Encryption/
├── Cargo.toml                       # Rust Workspace definition
├── package.json                     # Bun Root package & monorepo scripts
├── biome.json                       # Biome Linter & Formatter configuration
│
├── crates/                          # 🦀 RUST CRATES & CORE ENGINES
│   ├── denc-core/                   # Pure cryptographic engine (SSS, AEAD, PQC, .denc)
│   ├── denc-cli/                    # Standalone automation command-line binary
│   └── denc-wasm/                   # WebAssembly bindings (wasm-bindgen)
│
├── src-tauri/                       # 🖥️ TAURI v2 OS DESKTOP BRIDGE
│   ├── Cargo.toml                   # Tauri backend dependencies
│   └── src/
│       ├── commands/                # Strongly-typed IPC command handlers
│       ├── state.rs                 # Managed app state
│       └── lib.rs                   # Window setup & lifecycle hooks
│
├── packages/                        # 📦 SHARED LIBRARIES (TS/ESM)
│   └── shared-airgap/               # Optical fountain coding & CRC32 protocol
│
├── src/                             # ⚛️ DESKTOP FRONTEND (React 19 + Vite + Tailwind)
│   ├── components/                  # Modular UI components (Quorum, Escrow, Dropzone)
│   ├── wasm/                        # Generated WebAssembly artifacts
│   └── App.tsx                      # Root application router & state
│
├── apps/                            # 📱 DEDICATED APP TARGETS
│   └── mobile-android/              # 100% Offline Android Authenticator (Capacitor)
│
└── docs/                            # 📚 DOCUMENTATION SUITE
    ├── user/                        # End-user & operator documentation
    └── dev/                         # Developer & architecture documentation
```

---

## 🦀 1. `crates/denc-core` (Pure Rust Cryptographic Engine)

`denc-core` is the zero-dependency-on-UI cryptographic engine that powers all other targets.

| Module | File | Core Responsibilities |
| :--- | :--- | :--- |
| `sss` | [`crates/denc-core/src/sss.rs`](file:///i:/01-Master_Code/Apps/Dual_Encryption/crates/denc-core/src/sss.rs) | Finite field arithmetic ($\text{GF}(256)$), Russian Peasant multiplier, polynomial secret splitting, Lagrange interpolation. |
| `cipher` | [`crates/denc-core/src/cipher.rs`](file:///i:/01-Master_Code/Apps/Dual_Encryption/crates/denc-core/src/cipher.rs) | AES-256-GCM and XChaCha20-Poly1305 streaming AEAD chunk encryption and decryption. |
| `pqc` | [`crates/denc-core/src/pqc.rs`](file:///i:/01-Master_Code/Apps/Dual_Encryption/crates/denc-core/src/pqc.rs) | NIST FIPS 203 ML-KEM-768 key encapsulation and NIST FIPS 204 ML-DSA-65 digital signatures (`fips203`, `fips204` crates). |
| `container` | [`crates/denc-core/src/container.rs`](file:///i:/01-Master_Code/Apps/Dual_Encryption/crates/denc-core/src/container.rs) | Binary `.denc` header serialization, deserialization, digest calculation, and manifest handling. |
| `kdf` | [`crates/denc-core/src/kdf.rs`](file:///i:/01-Master_Code/Apps/Dual_Encryption/crates/denc-core/src/kdf.rs) | Argon2id memory-hard key derivation. |
| `lib` | [`crates/denc-core/src/lib.rs`](file:///i:/01-Master_Code/Apps/Dual_Encryption/crates/denc-core/src/lib.rs) | High-level `encrypt_file`, `decrypt_file`, `inspect_container`, TAR packaging, and unit tests. |

---

## ⚡ 2. `crates/denc-cli` (Standalone CLI Binary)

Provides the standalone `denc` executable:
* `main.rs`: CLI argument parsing via `clap v4`, progress bars with `indicatif`, formatted terminal outputs with `colored`.
* `config.rs`: YAML and JSON declarative recipe parser and stdin piping handlers.

---

## 🌐 3. `crates/denc-wasm` (WebAssembly Browser Module)

Exposes `denc-core` functionality to JavaScript and Web Workers via `wasm-bindgen`:
* `WasmHeaderInspection`: In-browser container header inspection.
* `wasm_decrypt_buffer`: Client-side payload decryption.
* `wasm_pqc_keygen`: Browser-based ML-KEM key generation.

---

## 🖥️ 4. `src-tauri` (Tauri v2 OS Desktop Bridge)

* Integrates native OS capabilities: file system access, OS drag-and-drop events, system tray, window resizing, file associations (`.denc`), and YubiKey USB detection.
* `src/commands/`: Clean separation of IPC command handlers (`encrypt.rs`, `decrypt.rs`, `inspect.rs`, `yubikey.rs`, `shares.rs`, `server.rs`).

---

## 📦 5. `packages/shared-airgap` (Shared TypeScript ESM)

* Shared between the Desktop UI and Mobile Android app to eliminate protocol duplication.
* Implements the animated optical QR fountain frame serializer, frame fragmentation, and CRC32 payload integrity checking.

---

## 📱 6. `apps/mobile-android` (Dedicated Offline Authenticator)

* Built with Capacitor and React 19.
* Features hardware biometric authentication gates, localized encrypted key storage, and full-screen camera QR scanner.
