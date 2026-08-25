# 🏛️ Key Escrow & Post-Quantum Vault Guide

The **Key Escrow Vault** tab in DualCrypt Enterprise provides comprehensive management for asymmetric Post-Quantum keypairs, digital signature certificates, and disaster recovery keys.

---

## 📑 Contents
1. [Vault Overview & Capabilities](#1-vault-overview--capabilities)
2. [Generating Post-Quantum Key Encapsulation Keys (ML-KEM-768)](#2-generating-post-quantum-key-encapsulation-keys-ml-kem-768)
3. [Generating Post-Quantum Digital Signing Keys (ML-DSA-65)](#3-generating-post-quantum-digital-signing-keys-ml-dsa-65)
4. [Testing & Inspecting Credentials in Memory](#4-testing--inspecting-credentials-in-memory)
5. [Exporting & Distributing Public Keys](#5-exporting--distributing-public-keys)

---

## 1. Vault Overview & Capabilities

The **Key Escrow Vault** serves as the security control room for your cryptographic credentials:
* Generates standardized NIST FIPS 203 & 204 keypairs.
* Allows custodians to inspect the validity and parameters of key files (`.pqc`, `.dsa`, `.dkey`) without exposing raw private secrets to disk.
* Facilitates secure public certificate sharing with colleagues and automated CI/CD bots.

---

## 2. Generating Post-Quantum Key Encapsulation Keys (ML-KEM-768)

To generate an ML-KEM keypair for receiving encrypted container shares:
1. Navigate to the **Key Escrow Vault** tab in DualCrypt.
2. Under **⚛️ Post-Quantum Keypair Generator**, select **`NIST FIPS 203 ML-KEM-768 (Kyber)`**.
3. Enter a descriptive key label (e.g. `Alice - CFO Workstation`).
4. (Optional) Set a passphrase to encrypt the generated private key file.
5. Click **`[ ⚡ Generate ML-KEM Keypair ]`**.
6. DualCrypt generates:
   * **Public Key File (`.pqc.pub`)**: Safe to share via email, Slack, or public directories.
   * **Private Key File (`.pqc`)**: Store securely in your private keystore or hardware vault.

---

## 3. Generating Post-Quantum Digital Signing Keys (ML-DSA-65)

To generate an ML-DSA keypair for signing containers and creating Provenance Passports:
1. In the **Key Escrow Vault**, select **`NIST FIPS 204 ML-DSA-65 (Dilithium)`**.
2. Enter your Author Identity (e.g. `SecOps Automated Release Bot`).
3. Click **`[ ⚡ Generate ML-DSA Keypair ]`**.
4. DualCrypt outputs:
   * **Public Verification Key (`.dsa.pub`)**: Used by auditors and recipients to verify container origin.
   * **Private Signing Key (`.dsa`)**: Kept strictly private by the container author or CI/CD signing runner.

---

## 4. Testing & Inspecting Credentials in Memory

Before distributing or using a key file, you can verify it inside the **Credential Inspector**:
1. Drag any `.pqc`, `.dsa`, or `.dkey` file into the **Test & Inspect** dropzone.
2. If protected by a PIN/passphrase, enter the password.
3. DualCrypt parses the key structure in memory, checks cryptographic headers, and verifies that the private key matches its public derivative.
4. All test variables are zeroized immediately after evaluation.

---

## 5. Exporting & Distributing Public Keys

* Click the **📋 Copy Public Key (Base64)** button on any generated or loaded key card.
* Send the public key string or `.pqc.pub` file to the container creator.
* When they encrypt a container, they will specify your public key for your custodian slot.
