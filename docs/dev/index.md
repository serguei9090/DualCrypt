# 🛠️ DualCrypt Enterprise Developer & Architecture Hub

Welcome to the **Developer & Engineering Documentation Hub** for DualCrypt Enterprise. This section details the internal architecture, mathematical cryptographic foundations, binary formats, local environment setup, and CI/CD pipelines.

---

## 📑 Developer Documentation Index

| Technical Document | Core Focus | Key Topics |
| :--- | :--- | :--- |
| [**🏛️ System Architecture & Diagrams**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/dev/architecture.md) | High-Level Architecture & Component Topologies | Mermaid diagrams, data flows, Tauri bridge, WASM worker model, optical fountain state machines. |
| [**🔐 Cryptography Deep Dive**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/dev/cryptography_deep_dive.md) | Mathematical & Algorithmic Specifications | Galois Field $\text{GF}(256)$ arithmetic, constant-time Russian Peasant multiplier, NIST FIPS 203/204 PQC, Argon2id, zeroization. |
| [**📦 Container Binary Format (`.denc`)**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/dev/container_binary_format.md) | Binary Protocol & Framing Specification | Header byte layouts (v1/v2), AEAD chunk framing, manifest serialization, signature envelopes. |
| [**📂 Codebase Topology & Monorepo**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/dev/codebase_structure.md) | Package Anatomy & Interfaces | `crates/denc-core`, `crates/denc-cli`, `crates/denc-wasm`, `src-tauri`, `packages/shared-airgap`, `src/`, `apps/mobile-android/`. |
| [**💻 Setup & Building Guide**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/dev/setup_and_building.md) | Environment Matrix & Tooling | Cargo, Bun, Biome, Android SDK / Capacitor, building native installers, WebAssembly compilation, test execution. |
| [**⚙️ CI/CD & Automation Pipelines**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/dev/ci_cd_and_automation.md) | Production Automation Scripts & Workflows | Multi-OS GitHub Actions workflow, unified Bash automation runner, and `uv`-compliant Python script for batch testing and verification. |
| [**🤝 Contributing & Code Quality**](file:///i:/01-Master_Code/Apps/Dual_Encryption/docs/dev/contributing.md) | Quality Gates & Contribution Rules | Memory hygiene checklist, Biome formatting, Cargo check, Conventional Commits cadence. |

---

## 🏗️ Core Engineering Principles

1. **Memory Safety & Zeroization**:
   All intermediate secrets (master Data Encryption Keys, Shamir polynomial coefficients, private keys, Argon2id derived keys) must implement `zeroize::ZeroizeOnDrop` or explicit zeroization to prevent cold-boot and forensic memory scraping.
2. **Stream Processing with $O(1)$ Memory Overhead**:
   Payload processing is strictly chunked ($64\text{ KiB}$). Regardless of whether input data is $10\text{ MB}$ or $10\text{ TB}$, maximum RAM usage must remain $<25\text{ MB}$.
3. **No Mocking / Zero Pseudo-Code**:
   Production-ready cryptographic logic must be executed at all times. Simulated flows or mock placeholders are strictly prohibited in core engines.
4. **Strict Isolation of Desktop vs. Mobile Runtimes**:
   Mobile device emulators and phone mockups must never be embedded in the desktop UI. Desktop and mobile entry points maintain separate builds and lifecycles.
