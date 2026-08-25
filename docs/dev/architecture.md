# 🏛️ DualCrypt System Architecture & Technical Diagrams

DualCrypt Enterprise is designed as a modular, multi-target cryptographic ecosystem. The system enforces strict separation of concerns across cryptographic primitives, platform runtimes, and user interfaces.

---

## 📑 Contents
1. [High-Level System Topology](#1-high-level-system-topology)
2. [Dual-Custody Encryption Pipeline Diagram](#2-dual-custody-encryption-pipeline-diagram)
3. [Dual-Custody Decryption & Quorum Reconstruction](#3-dual-custody-decryption--quorum-reconstruction)
4. [Air-Gapped Optical Fountain State Machine](#4-air-gapped-optical-fountain-state-machine)
5. [Tauri v2 OS Desktop Bridge & IPC Protocol](#5-tauri-v2-os-desktop-bridge--ipc-protocol)
6. [WebAssembly In-Browser Worker Model](#6-webassembly-in-browser-worker-model)

---

## 1. High-Level System Topology

```mermaid
graph TD
    subgraph "Pure Rust Cryptographic Engine"
        CORE["crates/denc-core<br/>• SSS GF(256) Polynomials<br/>• Streaming AEAD (AES-GCM / XChaCha)<br/>• NIST FIPS 203 ML-KEM-768<br/>• NIST FIPS 204 ML-DSA-65<br/>• Argon2id KDF & Timelocks"]
    end

    subgraph "Platform Targets & Runtime Adapters"
        CLI["crates/denc-cli<br/>(Standalone Headless Binary)"]
        WASM["crates/denc-wasm<br/>(wasm-bindgen Web Worker)"]
        TAURI["src-tauri<br/>(Tauri v2 OS Desktop Bridge)"]
    end

    subgraph "Shared Protocol Layer"
        AIRGAP["packages/shared-airgap<br/>(TypeScript ESM)<br/>• Animated Fountain Coding<br/>• CRC32 Framing & Checksums<br/>• Frame Serialization"]
    end

    subgraph "Client Applications"
        DESKTOP_UI["src/<br/>(React 19 + Vite + Tailwind)<br/>Enterprise Desktop Client"]
        MOBILE_UI["apps/mobile-android/<br/>(Capacitor + React 19)<br/>100% Offline Authenticator"]
        WEB_UI["GitHub Pages / Web Server<br/>Zero-Knowledge Browser Client"]
    end

    CORE --> CLI
    CORE --> WASM
    CORE --> TAURI

    AIRGAP --> DESKTOP_UI
    AIRGAP --> MOBILE_UI

    TAURI --> DESKTOP_UI
    WASM --> WEB_UI
    WASM --> DESKTOP_UI
```

---

## 2. Dual-Custody Encryption Pipeline Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Creator as User / Pipeline
    participant App as DualCrypt Frontend
    participant Core as denc-core Engine
    participant CSPRNG as OS CSPRNG (getrandom)
    participant Disk as Output File (.denc)

    Creator->>App: Drops File & Configures Quorum (k=2, n=3)
    App->>Core: encrypt_file(path, params)
    Core->>CSPRNG: Generate 32-byte DEK (Data Encryption Key)
    Core->>Core: Split DEK via Shamir GF(256) -> Shares [S1, S2, S3]
    
    rect rgb(20, 30, 45)
        note right of Core: Custodian Share Wrapping
        Core->>Core: S1 -> Encrypt with Custodian 1 Passphrase (Argon2id + AES-GCM)
        Core->>Core: S2 -> Encapsulate with Custodian 2 ML-KEM-768 Public Key
        Core->>Core: S3 -> Export as .dkey File / Escrow Timelock
    end

    opt Optional Digital Signature
        Core->>Core: Compute Header Digest SHA-256
        Core->>Core: Sign Header with Author ML-DSA-65 Private Key
    end

    Core->>Disk: Write Authenticated DencHeader (Bytes 0..N)
    
    loop 64 KiB Chunks (0..M)
        Core->>Core: AEAD Encrypt Chunk(i) with DEK + AAD(HeaderDigest || i || is_final)
        Core->>Disk: Stream Chunk Ciphertext + 16B Poly1305/GCM Tag
    end

    Core->>Core: Zeroize DEK, S1, S2, S3, and Intermediate Key Buffers
    Core-->>App: Return Success + Exported Key Files
    App-->>Creator: Displays Provenance Confirmation
```

---

## 3. Dual-Custody Decryption & Quorum Reconstruction

```mermaid
sequenceDiagram
    autonumber
    actor Custodians as Custodian Quorum
    participant UI as DualCrypt UI
    participant Core as denc-core Engine
    participant Disk as Plaintext Output

    UI->>Core: inspect_container(path.denc)
    Core-->>UI: HeaderMetadata (k=2, n=3, Manifest, Custodian Roster, Signature)
    UI->>UI: Render Provenance Passport & Threshold Meter (0/2)

    Custodians->>UI: Provide Custodian 1 Passphrase
    UI->>Core: Verify & Unwrap Share S1
    UI->>UI: Update Threshold Meter (1/2 Yellow)

    Custodians->>UI: Provide Custodian 2 .pqc Private Key
    UI->>Core: ML-KEM Decapsulate & Unwrap Share S2
    UI->>UI: Update Threshold Meter (2/2 Green - Quorum Met!)

    UI->>Core: decrypt_file(path.denc, credentials)
    Core->>Core: Check Timelock Epochs (Ensure now_utc() >= timelock_utc)
    Core->>Core: Lagrange Polynomial Interpolation over GF(256) -> Recover DEK
    
    loop 64 KiB Chunks (0..M)
        Core->>Core: AEAD Decrypt Chunk(i) with DEK + Verify AAD Tag
        Core->>Disk: Stream Decrypted Plaintext
    end

    Core->>Core: Zeroize Reconstructed DEK & Recovered Shares
    Core-->>UI: Decryption Complete (Bytes Restored)
    UI-->>Custodians: File Ready
```

---

## 4. Air-Gapped Optical Fountain State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle

    state DesktopWorkstation {
        GenerateChallenge --> SlicePayload: Split challenge into 120B chunks
        SlicePayload --> LoopFountainFrames: Add CRC32 & frame sequence (1..N)
        LoopFountainFrames --> DisplayAnimatedQR: Render QR at 12 FPS
        DisplayAnimatedQR --> AwaitMobileResponse: Activate desktop camera
        AwaitMobileResponse --> ReassembleResponse: Verify response CRC32
    }

    state MobilePhone {
        PhoneCameraScan --> AssembleChallenge: Collect fountain frames
        AssembleChallenge --> HardwareAuth: Prompt Fingerprint / PIN
        HardwareAuth --> DecryptStoredShare: Unlock private key from vault
        DecryptStoredShare --> LoopResponseFountain: Generate animated response QR
    }

    DisplayAnimatedQR --> PhoneCameraScan: Optical line-of-sight
    LoopResponseFountain --> AwaitMobileResponse: Optical line-of-sight
    ReassembleResponse --> QuorumSatisfied: Share verified
    QuorumSatisfied --> [*]
```

---

## 5. Tauri v2 OS Desktop Bridge & IPC Protocol

The desktop runtime connects the React 19 frontend to the Rust OS bridge via Tauri v2 strongly-typed IPC commands:

```
[ React 19 / TypeScript Frontend ]
                |
    invoke("plugin:tauri|command", payload)
                v
+-------------------------------------------------------------+
|                     Tauri v2 IPC Router                     |
|                                                             |
|  * commands::encrypt::encrypt_file_command                  |
|  * commands::decrypt::decrypt_file_command                  |
|  * commands::inspect::inspect_container_command             |
|  * commands::yubikey::poll_yubikey_devices                  |
|  * commands::shares::generate_pqc_keypair_command           |
|  * commands::app::get_app_version                           |
+-------------------------------------------------------------+
                |
                v
[ crates/denc-core (Pure Rust Engine) ]
```

---

## 6. WebAssembly In-Browser Worker Model

In the browser client, all intensive cryptographic computations and streaming operations are offloaded to dedicated Web Workers to ensure a responsive 60 FPS UI:

```
+-------------------------------------------------------------+
|                    Browser Main Thread                      |
|           (React 19 / Tailwind / Drag-and-Drop)             |
+-------------------------------------------------------------+
             |                                  ^
     postMessage(FilePayload)          postMessage(Progress, Data)
             v                                  |
+-------------------------------------------------------------+
|                     Web Worker Thread                       |
|                                                             |
|   [ denc-wasm (Rust compiled with wasm-bindgen) ]           |
|     * Argon2id KDF Memory Expansion (64 MB)                 |
|     * GF(256) Lagrange Polynomial Reconstruction            |
|     * Chunked AES-256-GCM Decryption                        |
+-------------------------------------------------------------+
```
