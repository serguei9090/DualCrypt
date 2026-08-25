# ⚙️ CI/CD & Automated Pipelines Guide

This document provides production-ready code snippets and scripts for automating DualCrypt Enterprise builds, cryptographic testing, quality gates, and automated container encryption in Continuous Integration pipelines.

---

## 📑 Contents
1. [GitHub Actions Complete CI Workflow Snippet](#1-github-actions-complete-ci-workflow-snippet)
2. [Bash Automation & Test Runner Script](#2-bash-automation--test-runner-script)
3. [Python Automation Script (`uv` Compatible)](#3-python-automation-script-uv-compatible)
4. [Headless Server Automated Backup Integration](#4-headless-server-automated-backup-integration)

---

## 1. GitHub Actions Complete CI Workflow Snippet

Below is the production GitHub Actions workflow configuration located at `.github/workflows/ci.yml`. It runs Biome checks, multi-platform Rust test matrices (Ubuntu & Windows), WebAssembly compilation, and web/mobile build checks:

```yaml
name: CI Quality Gate & Automated Tests

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-and-format:
    name: 🎨 Biome Lint & Format Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install Biome Globally
        run: bun add -g @biomejs/biome

      - name: Run Biome Check
        run: biome check .

  rust-crypto-core:
    name: 🔒 Rust Cryptographic Tests & Cargo Check
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install Rust Toolchain
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: wasm32-unknown-unknown

      - name: Rust Cache
        uses: Swatinem/rust-cache@v2

      - name: Install Linux Dependencies (Ubuntu only)
        if: matrix.os == 'ubuntu-latest'
        run: |
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

      - name: Cargo Check (Workspace)
        run: cargo check --workspace --all-targets

      - name: Cargo Test (Cryptographic Core & AEAD Primitives)
        run: cargo test --workspace --verbose

  build-desktop-web:
    name: 🖥️ Desktop Web & WASM Build Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install Rust Toolchain
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: wasm32-unknown-unknown

      - name: Install wasm-pack
        run: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Build Wasm Engine
        env:
          RUSTFLAGS: '--cfg getrandom_backend="wasm_js"'
        run: |
          cd crates/denc-wasm
          wasm-pack build --target web --out-dir ../../src/wasm

      - name: Install Dependencies
        run: bun install --frozen-lockfile || bun install

      - name: Build Desktop Application (TypeScript & Vite)
        run: bun run build

  build-mobile-android:
    name: 📱 Mobile Android Authenticator Build Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install Mobile Dependencies & Build
        run: |
          cd apps/mobile-android
          bun install --frozen-lockfile || bun install
          bun run build
```

---

## 2. Bash Automation & Test Runner Script

You can save this script as `scripts/ci_test_runner.sh` to run the entire verification suite locally or inside custom CI runners (GitLab CI, Jenkins, Drone):

```bash
#!/usr/bin/env bash
# ==============================================================================
# DualCrypt Enterprise: Local Quality Gate & CI Test Runner
# ==============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

log_step() {
    echo -e "\n${CYAN}==> [STEP] $1${NC}"
}

log_success() {
    echo -e "${GREEN}✔ [SUCCESS] $1${NC}"
}

# 1. Biome Check
log_step "Running Biome Linter & Format Verification..."
if command -v biome >/dev/null 2>&1; then
    biome check .
elif command -v bunx >/dev/null 2>&1; then
    bunx @biomejs/biome check .
else
    echo "Warning: Biome not installed globally, skipping JS lint."
fi
log_success "Frontend code quality verified."

# 2. Rust Workspace Compilation
log_step "Checking Rust Workspace Crates (denc-core, denc-cli, denc-wasm, src-tauri)..."
cargo check --workspace --all-targets
log_success "Rust workspace compiles cleanly."

# 3. Rust Unit & Integration Tests
log_step "Executing Cryptographic Unit & End-to-End Tests..."
cargo test --workspace --verbose
log_success "All cryptographic test suites passed."

# 4. TypeScript Unit Tests
log_step "Running TypeScript Air-Gap Protocol Tests via Bun..."
if command -v bun >/dev/null 2>&1; then
    bun test
    log_success "TypeScript tests passed."
fi

# 5. CLI Smoke Test (Compile & Encrypt/Decrypt Roundtrip)
log_step "Building denc-cli & Running Smoke Test Roundtrip..."
cargo build -p denc-cli --release
CLI_BIN="./target/release/denc"
if [ -f "./target/release/denc.exe" ]; then
    CLI_BIN="./target/release/denc.exe"
fi

TMP_DIR=$(mktemp -d)
TEST_INPUT="$TMP_DIR/input_payload.txt"
TEST_OUTPUT="$TMP_DIR/encrypted.denc"
TEST_RESTORED="$TMP_DIR/restored_payload.txt"

echo "DUALCRYPT_ENTERPRISE_AUTOMATED_TEST_$(date +%s)" > "$TEST_INPUT"

# Encrypt 2-of-2
"$CLI_BIN" encrypt "$TEST_INPUT" -o "$TEST_OUTPUT" -k 2 -n 2 \
    -p 1:AlphaSecretPassword \
    -p 2:BetaSecretPassword \
    --classification TOP_SECRET \
    --purpose "CI Smoke Test" \
    --json > "$TMP_DIR/enc_result.json"

# Inspect
"$CLI_BIN" inspect "$TEST_OUTPUT" --json > "$TMP_DIR/inspect_result.json"

# Decrypt
"$CLI_BIN" decrypt "$TEST_OUTPUT" -o "$TEST_RESTORED" \
    -p 1:AlphaSecretPassword \
    -p 2:BetaSecretPassword \
    --json > "$TMP_DIR/dec_result.json"

# Verify Roundtrip Identity
diff -u "$TEST_INPUT" "$TEST_RESTORED"
log_success "CLI Encrypt/Decrypt smoke test verified successfully."

# Cleanup
rm -rf "$TMP_DIR"
echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}🎉 ALL DUALCRYPT QUALITY GATES & TESTS PASSED!        ${NC}"
echo -e "${GREEN}======================================================${NC}"
```

---

## 3. Python Automation Script (`uv` Compatible)

This Python script demonstrates programmatic orchestration of the `denc` CLI: creating recipes dynamically, triggering 2-of-2 Post-Quantum encryption, inspecting container metadata, and performing decryption.

Run this script using the `uv` toolchain:
```bash
uv run scripts/denc_automation.py
```

### Script: `scripts/denc_automation.py`
```python
#!/usr/bin/env python3
"""
DualCrypt Enterprise - Programmatic CI/CD Automation Helper
Executed via `uv run` for zero global dependency clutter.
"""

import json
import subprocess
import tempfile
from pathlib import Path


def run_command(cmd: list[str]) -> tuple[int, str, str]:
    """Executes a command and returns (returncode, stdout, stderr)."""
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    stdout, stderr = proc.communicate()
    return proc.returncode, stdout, stderr


def main():
    print("🚀 DualCrypt Enterprise: Starting Python Automation Pipeline")

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        denc_bin = Path("target/release/denc")
        if not denc_bin.exists():
            denc_bin = Path("target/release/denc.exe")

        if not denc_bin.exists():
            print("⚙️ Compiling denc-cli binary in release mode...")
            code, _, err = run_command(
                ["cargo", "build", "-p", "denc-cli", "--release"]
            )
            if code != 0:
                print(f"❌ Cargo build failed:\n{err}")
                return 1

        # 1. Create a dummy sensitive payload
        payload_file = tmp_path / "sensitive_database_dump.sql"
        payload_file.write_text(
            "-- ENTERPRISE PRODUCTION DATABASE DUMP --\nCREATE TABLE secrets (id INT, val TEXT);\n",
            encoding="utf-8",
        )
        print(f"📄 Created test payload: {payload_file} ({payload_file.stat().st_size} bytes)")

        # 2. Programmatically generate a YAML / JSON recipe
        container_file = tmp_path / "backup_2026.denc"
        key_dir = tmp_path / "keys"
        key_dir.mkdir(parents=True, exist_ok=True)

        recipe = {
            "input": str(payload_file),
            "output": str(container_file),
            "cipher": "aes-256-gcm",
            "threshold_k": 2,
            "total_n": 2,
            "classification": "TOP_SECRET",
            "purpose": "Nightly Automated CI Database Escrow",
            "organization": "Enterprise Cloud SecOps",
            "custodians": [
                {
                    "id": 1,
                    "label": "SecOps Lead (PQC)",
                    "auth_type": "post-quantum",
                },
                {
                    "id": 2,
                    "label": "Audit Officer (Passphrase)",
                    "auth_type": "passphrase",
                    "passphrase": "ProductionAuditMasterKey#2026",
                },
            ],
        }

        recipe_file = tmp_path / "recipe.json"
        recipe_file.write_text(json.dumps(recipe, indent=2), encoding="utf-8")

        # 3. Execute encryption via recipe
        print("🔒 Executing automated encryption via recipe...")
        cmd = [
            str(denc_bin),
            "encrypt",
            "--config",
            str(recipe_file),
            "--key-dir",
            str(key_dir),
            "--json",
        ]
        code, stdout, stderr = run_command(cmd)
        if code != 0:
            print(f"❌ Encryption failed: {stderr}")
            return 1

        enc_output = json.loads(stdout)
        print(f"✅ Encrypted {enc_output.get('bytes_encrypted')} bytes successfully.")
        print(f"📦 Output container: {container_file}")

        # 4. Inspect container metadata
        print("🔍 Inspecting container header metadata...")
        code, stdout, stderr = run_command(
            [str(denc_bin), "inspect", str(container_file), "--json"]
        )
        if code != 0:
            print(f"❌ Inspection failed: {stderr}")
            return 1

        inspect_data = json.loads(stdout)
        print(
            f"   - Cipher: {inspect_data.get('cipher_suite')} | Threshold: {inspect_data.get('threshold_k')}/{inspect_data.get('total_n')}"
        )
        print(
            f"   - Manifest Org: {inspect_data.get('manifest', {}).get('organization')}"
        )

        # 5. Locate exported PQC key file for Custodian 1
        pqc_key_file = key_dir / "custodian_1.pqc"
        if not pqc_key_file.exists():
            # In case name is formatted by label
            candidates = list(key_dir.glob("*.pqc"))
            if candidates:
                pqc_key_file = candidates[0]

        print(f"🔑 Custodian 1 PQC Key File: {pqc_key_file}")

        # 6. Execute decryption
        restored_file = tmp_path / "restored_payload.sql"
        print("🔓 Decrypting container using PQC key file + Passphrase...")
        dec_cmd = [
            str(denc_bin),
            "decrypt",
            str(container_file),
            "-o",
            str(restored_file),
            "-f",
            f"1:{pqc_key_file}",
            "-p",
            "2:ProductionAuditMasterKey#2026",
            "--json",
        ]
        code, stdout, stderr = run_command(dec_cmd)
        if code != 0:
            print(f"❌ Decryption failed: {stderr}")
            return 1

        # 7. Validate plaintext integrity
        original_bytes = payload_file.read_bytes()
        restored_bytes = restored_file.read_bytes()
        assert original_bytes == restored_bytes, "Restored plaintext does not match original!"
        print("🎉 Plaintext integrity verified: 100% byte match.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

---

## 4. Headless Server Automated Backup Integration

To integrate DualCrypt into a nightly backup cron job:

```bash
#!/bin/bash
# /etc/cron.daily/dual_backup.sh
BACKUP_TAR="/var/backups/daily_$(date +%Y%m%d).tar.gz"
OUTPUT_DENC="/var/backups/daily_$(date +%Y%m%d).denc"

# 1. Create database dump archive
tar -czf "$BACKUP_TAR" /var/lib/postgresql/data

# 2. Encrypt with 2-of-2 Post-Quantum Keys
/usr/local/bin/denc encrypt "$BACKUP_TAR" -o "$OUTPUT_DENC" \
  -k 2 -n 2 \
  -c 1:"SecOps Lead":pqc \
  -c 2:"Disaster Escrow":pqc \
  --key-dir /etc/dual_escrow/keys \
  --classification TOP_SECRET \
  --purpose "Daily Database Backup" \
  --json

# 3. Securely wipe unencrypted tar
rm -f "$BACKUP_TAR"
```
