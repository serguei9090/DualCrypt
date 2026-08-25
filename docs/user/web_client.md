# 🌐 Zero-Knowledge Web Client & Local Server Guide

DualCrypt Enterprise includes a 100% client-side **WebAssembly (WASM)** decryptor and a standalone local HTTP server.

---

## 📑 Contents
1. [Zero-Knowledge Architecture](#1-zero-knowledge-architecture)
2. [Live Public Web Client](#2-live-public-web-client)
3. [Running Local LAN Server (`denc serve`)](#3-running-local-lan-server-denc-serve)
4. [In-Browser Decryption Workflow](#4-in-browser-decryption-workflow)
5. [Browser Security & Sandboxing](#5-browser-security--sandboxing)

---

## 1. Zero-Knowledge Architecture

The DualCrypt Web Client runs the pure Rust cryptographic engine (`denc-core`) compiled directly to WebAssembly (`denc-wasm` via `wasm-bindgen`).
* **Zero Server Transmission**: Files, passwords, and `.pqc` keys **never leave your browser**.
* All cryptographic operations (Argon2id KDF, Shamir secret reconstruction, AES-GCM decryption) execute inside the browser's JavaScript/WASM worker thread.

---

## 2. Live Public Web Client

You can access the live, zero-knowledge browser client hosted on GitHub Pages:
🔗 **[https://serguei9090.github.io/DualCrypt/](https://serguei9090.github.io/DualCrypt/)**

---

## 3. Running Local LAN Server (`denc serve`)

If you are operating in an air-gapped intranet or isolated data center, launch the embedded web server using the `denc` CLI:

```bash
# Serve on localhost
denc serve --host 127.0.0.1 --port 8080

# Serve across Local Area Network for cross-device access
denc serve --host 0.0.0.0 --port 9000
```

Once running, navigate to `http://localhost:8080` (or `http://<SERVER_IP>:9000`) in any modern browser (Chrome, Firefox, Safari, Edge).

---

## 4. In-Browser Decryption Workflow

1. Open the Web Client in your browser.
2. Drag and drop any `.denc` container onto the web dropzone.
3. The WASM module immediately parses and displays the header metadata, threshold quorum, and Provenance Passport.
4. Input custodian credentials (passphrases or uploaded `.pqc` / `.dkey` files).
5. The WASM engine verifies the shares, combines the master DEK, and streams the decrypted plaintext file directly into your browser's download manager.

---

## 5. Browser Security & Sandboxing

* **Content Security Policy (CSP)**: The web client restricts network connections so that cryptographic workers cannot initiate outbound HTTP requests or WebSockets.
* **Ephemeral Memory**: Decrypted buffers and keys are zeroized upon file download completion.
