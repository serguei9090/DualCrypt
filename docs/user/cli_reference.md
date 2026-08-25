# ⚡ Standalone CLI Automation Reference (`denc`)

The `denc` command-line utility provides high-performance, scriptable threshold encryption and decryption for headless servers, backup automation, and CI/CD pipelines.

---

## 📑 Contents
1. [Overview & Installation](#1-overview--installation)
2. [Global Options](#2-global-options)
3. [Command: `denc encrypt`](#3-command-denc-encrypt)
4. [Command: `denc decrypt`](#4-command-denc-decrypt)
5. [Command: `denc inspect`](#5-command-denc-inspect)
6. [Command: `denc pqc-keygen`](#6-command-denc-pqc-keygen)
7. [Command: `denc sss-keygen`](#7-command-denc-sss-keygen)
8. [Command: `denc serve`](#8-command-denc-serve)
9. [Declarative Recipe Automation (YAML / JSON / Stdin)](#9-declarative-recipe-automation-yaml--json--stdin)

---

## 1. Overview & Installation

The `denc` binary is completely standalone with zero dynamic library dependencies on Linux, Windows, and macOS.

```bash
# Verify version
denc --version
```

---

## 2. Global Options

* `-h, --help`: Display detailed help information and command examples.
* `-V, --version`: Print program version (`denc 2.0.0`).

---

## 3. Command: `denc encrypt`

Encrypt a file or whole directory into an authenticated `.denc` container.

### Syntax
```bash
denc encrypt [INPUT_PATH] -o [OUTPUT_PATH] [OPTIONS]
```

### Options
| Flag | Description | Default |
| :--- | :--- | :--- |
| `-o, --output <PATH>` | Destination path for the `.denc` container. | Required |
| `-k, --threshold <K>` | Quorum threshold $k$ (minimum custodians needed). | `2` |
| `-n, --total <N>` | Total custodian shares $n$. | `2` |
| `--cipher <CIPHER>` | Cipher suite: `aes-256-gcm` or `xchacha20-poly1305`. | `aes-256-gcm` |
| `-p, --passphrase <ID:PASS>` | Passphrase for custodian ID (e.g. `-p 1:SecretAlpha`). | None |
| `--pqc <ID[:LABEL]>` | Assign Post-Quantum KEM to custodian ID. | None |
| `--key-dir <DIR>` | Directory to write exported `.pqc` and `.dkey` files. | Current dir (`.`) |
| `--classification <LEVEL>` | Governance level: `TOP_SECRET`, `CONFIDENTIAL`, `RESTRICTED`, `UNCLASSIFIED`. | None |
| `--purpose <PURPOSE>` | Description of purpose in provenance passport. | None |
| `--organization <ORG>` | Issuing organization name. | None |
| `--timelock <ID:EPOCH>` | Enforce recovery share timelock (UTC Unix epoch seconds). | None |
| `--author-signing-key <KEY>` | NIST FIPS 204 ML-DSA-65 Private Key (Base64) to sign container. | None |
| `--author-label <LABEL>` | Signer identity label (e.g. `Release Bot`). | None |
| `--config <PATH>` | Path to JSON or YAML recipe file (use `-` for stdin). | None |
| `--json` | Output machine-readable JSON results. | `false` |
| `-q, --quiet` | Suppress interactive progress bars. | `false` |

### Examples
```bash
# 1. 2-of-2 Post-Quantum Encryption with auto-exported key files:
denc encrypt release.tar.gz -o release.denc -k 2 -n 2 --key-dir ./keys --pqc 1:"SecOps" --pqc 2:"Audit" --json

# 2. 2-of-3 Dual Custody with Time-Locked Disaster Recovery (Custodian 3 locked for 90 days):
denc encrypt database.sql -o db.denc -k 2 -n 3 \
  -p 1:CFOSecretPass \
  -p 2:CEOSecretPass \
  -p 3:EscrowPass \
  --timelock 3:1770000000

# 3. Encrypt an entire directory into an encrypted TAR stream:
denc encrypt /var/data/finance_records/ -o finance_2026.denc -k 2 -n 2 -p 1:Secret1 -p 2:Secret2
```

---

## 4. Command: `denc decrypt`

Decrypt an authenticated `.denc` container using threshold credentials.

### Syntax
```bash
denc decrypt [INPUT_PATH] -o [OUTPUT_PATH] [OPTIONS]
```

### Options
| Flag | Description |
| :--- | :--- |
| `-o, --output <PATH>` | Plaintext output destination path. |
| `-p, --passphrase <ID:PASS>` | Provide custodian passphrase (e.g. `-p 1:SecretAlpha`). |
| `-f, --keyfile <ID:PATH>` | Provide custodian `.dkey` or `.pqc` key file path. |
| `--pqc-key <ID:PATH_OR_B64>` | Provide custodian ML-KEM private key (file path or Base64). |
| `--config <PATH>` | Path to JSON or YAML recipe file (use `-` for stdin). |
| `--json` | Output machine-readable JSON status. |
| `-q, --quiet` | Suppress progress output. |

### Examples
```bash
# Decrypt with Post-Quantum key files:
denc decrypt release.denc -o restored_release.tar.gz -f 1:./keys/custodian_1.pqc -f 2:./keys/custodian_2.pqc

# Decrypt with passphrases:
denc decrypt db.denc -o restored_db.sql -p 1:CFOSecretPass -p 2:CEOSecretPass
```

---

## 5. Command: `denc inspect`

Inspect container headers, verify digital signatures, check timelocks, and view governance manifests without decrypting payload data.

```bash
# Human-readable colored output:
denc inspect release.denc

# Machine-readable JSON output for CI/CD audit logs:
denc inspect release.denc --json
```

---

## 6. Command: `denc pqc-keygen`

Generate standalone Post-Quantum keypairs.

```bash
# Generate NIST FIPS 203 ML-KEM-768 keypair:
denc pqc-keygen -a kem -o custodian_kem.json --json

# Generate NIST FIPS 204 ML-DSA-65 signing keypair:
denc pqc-keygen -a dsa -o release_signing_key.json --json
```

---

## 7. Command: `denc sss-keygen`

Split an arbitrary secret string into Shamir shares over $\text{GF}(256)$.

```bash
denc sss-keygen --secret "SUPER_CONFIDENTIAL_ROOT_TOKEN" -k 3 -n 5 --json
```

---

## 8. Command: `denc serve`

Launch the embedded zero-knowledge local web server.

```bash
# Localhost only:
denc serve --host 127.0.0.1 --port 8080

# LAN accessible:
denc serve --host 0.0.0.0 --port 9000
```

---

## 9. Declarative Recipe Automation (YAML / JSON / Stdin)

For production CI/CD pipelines, define your encryption parameters in declarative configuration files:

### Sample `ci_recipe.yaml`
```yaml
input: "/var/backups/release_v2.0.0.tar.gz"
output: "/var/backups/release_v2.0.0.denc"
cipher: "aes-256-gcm"
threshold_k: 2
total_n: 2
classification: "TOP_SECRET"
purpose: "Nightly Production Database Backup"
organization: "Enterprise SecOps"
custodians:
  - id: 1
    label: "SecOps Lead (PQC)"
    auth_type: "post-quantum"
    public_key_base64: "6q+1...YOUR_ML_KEM_PUBLIC_KEY..."
  - id: 2
    label: "Audit Lead (Passphrase)"
    auth_type: "passphrase"
    passphrase: "AuditPasscode#2026"
```

### Executing Recipes
```bash
# Run from file
denc encrypt --config ci_recipe.yaml --json

# Stream dynamically via stdin without writing recipe to disk
echo "$DYNAMIC_JSON_CONFIG" | denc encrypt --config - --json
```
