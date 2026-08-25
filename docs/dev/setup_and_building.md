# 💻 Developer Setup, Environment & Build Matrix

This guide provides instructions for setting up your local development environment, installing required toolchains, compiling all targets, and running automated test suites.

---

## 📑 Core Tooling Matrix

| Tool / Runtime | Standard Command | Purpose |
| :--- | :--- | :--- |
| **Rust Toolchain** | `cargo`, `rustc` ($\ge 1.80$) | Compiles `denc-core`, `denc-cli`, and Tauri backend. |
| **JavaScript / TypeScript** | `bun` ($\ge 1.1$) | Package management and frontend development. Prefer `bun` over `npm`. |
| **JS / TS Runner** | `bunx` | Tool runner. Prefer `bunx` over `npx`. |
| **Linter & Formatter** | `biome` | Global linter & formatter (`biome check --write .`). |
| **WebAssembly Pack** | `wasm-pack` | Compiles `crates/denc-wasm` to JavaScript/WASM bindings. |
| **Python Helpers** | `uv` | Runs automated Python test harnesses (`uv run script.py`). |

---

## 🛠️ 1. Initial Environment Setup

### 1.1 Clone Repository & Install JS Dependencies
```bash
# Clone the repository
git clone https://github.com/serguei9090/DualCrypt.git
cd DualCrypt

# Install root dependencies via bun
bun install
```

### 1.2 Install Rust & WASM Target
```bash
# Add WebAssembly target to Rust
rustup target add wasm32-unknown-unknown

# Install wasm-pack
cargo install wasm-pack
```

### 1.3 Linux System Dependencies (Ubuntu / Debian only)
If building native Linux desktop binaries:
```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

---

## 🏗️ 2. Building Project Targets

### 2.1 Build WebAssembly Module (`denc-wasm`)
```bash
cd crates/denc-wasm
wasm-pack build --target web --out-dir ../../src/wasm
cd ../..
```

### 2.2 Run Desktop Application in Development Mode
```bash
# Launches Vite live server + Tauri v2 native desktop window
bun run tauri dev
```

### 2.3 Build Standalone CLI Binary (`denc`)
```bash
# Build optimized release binary
cargo build --release -p denc-cli

# Binary output is located at:
# target/release/denc (Linux/macOS) or target/release/denc.exe (Windows)
```

### 2.4 Build Desktop Production Installers (MSI, DMG, AppImage)
```bash
bun run tauri build
```

### 2.5 Build Android Authenticator App
```bash
cd apps/mobile-android
bun install
bun run build

# Sync web assets to native Android project
bunx cap sync android

# Open in Android Studio or build with Gradle:
cd android && ./gradlew assembleDebug
```

---

## 🧪 3. Running Automated Test Suites

### 3.1 Rust Cryptographic Tests (Workspace)
```bash
# Run all unit tests in denc-core and denc-cli
cargo test --workspace --verbose
```

### 3.2 TypeScript / Air-Gap Protocol Tests
```bash
# Run tests for shared-airgap and frontend modules
bun test
```

### 3.3 Linting & Code Formatting
```bash
# Check and auto-fix formatting across JS/TS/JSON
biome check --write .

# Format Rust code
cargo fmt --all
```
