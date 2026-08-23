# 🛡️ Project Guidelines & Rules: Dual-Control & Threshold Encryption Platform

This document establishes the operational rules, coding standards, vibecoding workflows, and security guardrails for AI agents and developers working across all sessions on this codebase.

---

## 🚀 1. Core Tooling & Runtime Matrix

Always use the specified tools for their respective runtimes. Do not invoke legacy or unapproved tooling.

| Category | Standard | Command / Tool | Execution Guideline |
| :--- | :--- | :--- | :--- |
| **Package Management & JS/TS Runtime** | `bun` | `bun add`, `bun run`, `bun test` | Always prefer `bun` over `npm`/`yarn`/`pnpm`. |
| **JS/TS Execution & Runner** | `bunx` | `bunx <cmd>` | Prefer `bunx` over `npx` unless mandatory. |
| **JS / TS Quality & Linter** | `biome` | `biome check --write <path>` | Pre-installed globally. Run directly without wrappers. |
| **Rust Compiler & Package Manager** | `cargo` / `rustc` | `cargo check`, `cargo test`, `cargo build` | Native Rust toolchain. |
| **Desktop Framework** | `tauri` (v2) | `bun run tauri dev`, `bun run tauri build` | OS-native WebView wrapper. |
| **Python Helpers (Scratch only)** | `uv` | `uv run <script>` | Never use global python/pip directly. |
| **Version Control & Commits** | `git` | `git commit -m "..."` | Mandatory commit cadence (see Section 2). |

---

## 📌 2. Git Workflow & Mandatory Commit Cadence

* **Commit After Every Feature / Major Change**:
  * You **MUST** create a descriptive git commit immediately after completing every feature, structural refactoring, or major milestone.
  * Never bundle multiple unrelated features into a single uncommitted blob.
* **Commit Message Format (Conventional Commits)**:
  * `feat(<scope>): <description>` for new features (e.g., `feat(crypto): implement shamir GF(256) share generation`).
  * `fix(<scope>): <description>` for bug fixes (e.g., `fix(ui): correct dual custody unlock progress meter`).
  * `refactor(<scope>): <description>` for code restructuring without behavioral changes.
  * `test(<scope>): <description>` for new unit/integration test suites.
  * `docs(<scope>): <description>` for documentation updates.
* **Pre-Commit Quality Gate & Documentation Synchronization**:
  * Before committing, always run:
    1. `biome check --write .` (for JS/TS)
    2. `cargo check` and `cargo test` (for Rust crypto core)
  * **Continuous Documentation Sync**: Whenever a new feature, UI/UX workflow, configuration tab, or architectural design is implemented or modified, **`README.md` MUST be updated** in the same commit to keep documentation 100% in sync with the codebase.
  * Ensure working directory is clean and buildable.

---

## 🎨 3. "Vibecoding" & UI/UX Design Standards

* **Aesthetic Standard**:
  * Create **sleek, minimalist, cyber-themed enterprise interfaces** (dark mode by default, subtle glassmorphism, crisp borders, high-contrast typography, zero generic clutter).
  * Use modern typography (e.g., Inter, JetBrains Mono for cryptographic hashes/keys).
* **Speed & Modularity**:
  * Keep components small, modular, and reusable.
  * Utilize instant hot-reloading with Vite + React + Tailwind CSS.
  * Provide real-time interactive feedback for cryptographic operations (e.g., glowing threshold indicators, visual split-screen progress for Custodian 1 & Custodian 2).
* **No Placeholders**:
  * Never use pseudo-code or mock placeholders in core cryptographic flows. All encryption, splitting, and verification logic must be real and functional.

---

## 🔒 4. Cryptographic Hygiene & Security Checklist

* **Memory Safety & Zeroization**:
  * In Rust, all key material, shares, and sensitive buffers must implement `zeroize::ZeroizeOnDrop` or be explicitly cleared with `.zeroize()` when going out of scope.
  * Never print private keys, raw Shamir shares, or unhashed passwords into logs or stdout.
* **Bulk Encryption**:
  * Use **AES-256-GCM** or **XChaCha20-Poly1305** (AEAD mode). Never use CBC, ECB, or unauthenticated modes.
  * Generate cryptographically secure random nonces and salts using OS CSPRNG (`getrandom` / `rand::rngs::OsRng`). Never reuse a nonce with the same key.
* **Threshold Sharing (SSS)**:
  * Implement Shamir’s Secret Sharing over $GF(256)$ with polynomial degree $t = k - 1$.
  * Support configurable quorums (e.g., 2-of-2 strict dual custody, 2-of-3 with recovery share).
* **Post-Quantum Cryptography (PQC)**:
  * Integrate NIST FIPS 203 (**ML-KEM-768 / Kyber**) for quantum-safe asymmetric transport of shares.
  * Integrate NIST FIPS 204 (**ML-DSA-65 / Dilithium**) for digital signatures and tamper-proofing.
* **Container Format (`.denc`)**:
  * All encrypted outputs must adhere to the authenticated `.denc` binary container format. Never save raw plaintext passwords to `.txt` files.

---

## 🧰 5. Dynamic Task Automation & Scratch Engineering

* **Isolation Rule**:
  * All transient helper scripts, diagnostic tools, and test generators must reside exclusively in the root `/scratch` directory (e.g., `scratch/test_entropy.py`, `scratch/benchmark_shamir.rs`).
* **Git Isolation**:
  * The `/scratch` directory must remain ignored in `.gitignore` to prevent leaking transient automation utilities into production history.

---

## ✅ 6. Checklist Before Declaring Any Task Complete

1. [ ] **Rust Core**: Compiles cleanly with zero compiler warnings (`cargo check`).
2. [ ] **Unit Tests**: All cryptographic tests pass (`cargo test`).
3. [ ] **Lint & Format**: Cleaned with `biome check --write .` (and `cargo fmt`).
4. [ ] **Memory Inspection**: Sensitive key variables are properly dropped/zeroized.
5. [ ] **Documentation**: `README.md` updated to reflect any new features, settings, or architectural additions.
6. [ ] **Git State**: Clean commit created with conventional commit message.
