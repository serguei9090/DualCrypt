# 🤝 Contributing & Engineering Standards

Thank you for contributing to **DualCrypt Enterprise**! This document establishes the engineering guidelines, cryptographic review requirements, and pre-commit quality gates required for all contributions.

---

## 📑 Core Standards Checklist

Before submitting a Pull Request, verify that you have satisfied all items:

1. [ ] **Rust Cryptographic Core**: All code in `denc-core`, `denc-cli`, `denc-wasm`, and `src-tauri` compiles with zero warnings:
   ```bash
   cargo check --workspace --all-targets
   ```
2. [ ] **Unit & Roundtrip Tests**: All cryptographic unit tests and end-to-end roundtrip suites pass:
   ```bash
   cargo test --workspace --verbose
   bun test
   ```
3. [ ] **Code Formatting & Linting**: Cleaned and auto-fixed with Biome and rustfmt:
   ```bash
   biome check --write .
   cargo fmt --all
   ```
4. [ ] **Memory Zeroization**: All master keys, intermediate shares, and plaintext buffers implement `zeroize::ZeroizeOnDrop` or explicit `.zeroize()` calls.
5. [ ] **Target Isolation**: Mobile device emulators or mobile-specific views are **never** embedded inside the desktop user interface.
6. [ ] **Documentation Synchronization**: When adding or altering a feature, UI tab, or CLI command, both `docs/` and `README.md` must be updated in the same commit.

---

## 🎨 Code Style & Quality Pipelines

### JavaScript & TypeScript (Biome)
* **Direct Invocation**: Run `biome` directly (installed globally) without runtime wrappers.
* **Auto-Fixing**: Always pass `--write`:
  ```bash
  biome check --write .
  ```

### Rust Toolchain
* Ensure code follows standard Rust idioms (`clippy` clean).
* Avoid `unwrap()` or `expect()` in production code paths; return structured `DencError` variants instead.

### Python Helpers & Scratch Engineering
* Any helper scripts must use `uv run`:
  ```bash
  uv run <script_path>.py
  ```
* All transient automation scripts must reside exclusively inside `/scratch` (which is ignored by Git).

---

## 📌 Commit Message Conventions (Conventional Commits)

Commit messages must follow the Conventional Commits specification:

| Prefix | Scope / Type | Example |
| :--- | :--- | :--- |
| `feat` | New feature or capability | `feat(pqc): integrate NIST FIPS 204 ML-DSA-65 signatures` |
| `fix` | Bug fix | `fix(escrow): resolve timelock epoch timezone edgecase` |
| `refactor` | Restructuring without behavioral change | `refactor(core): streamline streaming AEAD buffer allocation` |
| `test` | New tests or improvements | `test(sss): add Lagrange interpolation benchmark tests` |
| `docs` | Documentation additions / updates | `docs(user): add air-gap optical QR sign-off manual` |

---

## 🔒 Cryptographic Review Requirements

Any PR modifying files under `crates/denc-core/` or `packages/shared-airgap/` requires:
* Verification of constant-time properties (no secret-dependent branches or lookups).
* Validation of nonce uniqueness and counter bounds.
* Confirmation that unauthenticated plaintext is never released prior to AEAD tag verification.
