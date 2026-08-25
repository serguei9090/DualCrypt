# 🔮 DualCrypt Enterprise: Future Roadmap & Technical Specifications

This document outlines the detailed architecture, problem statements, cryptographic mechanics, and implementation plans for the next-generation enterprise features on the DualCrypt roadmap.

The roadmap is prioritized progressively from **low complexity (localized hardware/SDK integration)** to **higher complexity (distributed protocols and enterprise identity ecosystems)**.

---

## 🧭 Roadmap Overview & Complexity Matrix

| Phase | Milestone / Feature | Complexity | Core Focus & Tech Stack |
| :--- | :--- | :---: | :--- |
| **Phase 6** | **🔐 FIDO2 / WebAuthn & Passkey Integration** | **Low–Med** | Universal hardware key support, CTAP2/WebAuthn, biometric authenticators (Touch ID, Windows Hello). |
| **Phase 7** | **👥 Role-Based & Hierarchical Quorums** | **Medium** | Multi-tier policy trees, Boolean threshold algebra, collusion prevention. |
| **Phase 8** | **🌐 WebRTC Zero-Knowledge Quorum Relay** | **Med–High** | Ephemeral P2P multi-party unlock rooms, ML-KEM encrypted channels, zero out-of-band transfers. |
| **Phase 9** | **🏢 Enterprise SSO & Directory Sync (Okta 1st)** | **High** | OIDC/OAuth2 PKCE, SCIM 2.0 lifecycle deprovisioning, automated public-key directory binding. |

---

## 1. 🔐 Phase 6: FIDO2 / WebAuthn & Passkey Hardware Integration

### 🎯 Problem Statement
Currently, hardware token support relies on low-level USB Vendor ID polling (VID_1050 for YubiKeys). While functional on desktop systems with raw USB access, this approach:
1. Requires platform-specific USB permissions.
2. Cannot run inside standard web browsers in WebAssembly mode.
3. Excludes built-in platform authenticators like **Apple Touch ID**, **Windows Hello**, and **Android Biometric Prompts**.

### 💡 What It Solves
FIDO2 / WebAuthn standardizes hardware-backed authentication across all platforms (Desktop, Web, and Mobile) without requiring low-level driver access or proprietary USB scanning.

### ⚙️ Technical Architecture & Implementation
* **HMAC-Secret / PRF Extension (FIDO 2.1)**:
  * When a custodian selects a FIDO2 token, the client issues a 
avigator.credentials.get() / CTAP2 assertion with the hmac-secret (or prf) extension.
  * The hardware token derives a 256-bit symmetric key inside its secure element conditioned on user presence (PIN + capacitive touch or biometric scan).
  * This derived key acts as the custodian's encryption key to seal their Shamir share.
* **Universal Cross-Platform Support**:
  * **Desktop (Tauri)**: Integrated via uthenticator or ctap-hid-fido2 Rust crates.
  * **Web (Wasm)**: Native window.PublicKeyCredential API calls via web-sys.
  * **Mobile (Android)**: Native Android Credential Manager & FIDO2 APIs.

---

## 2. 👥 Phase 7: Role-Based & Hierarchical Quorums (Multi-Tier Policy Rules)

### 🎯 Problem Statement
Standard Shamir's Secret Sharing ($-of-$) treats every custodian identically. Any combination of $ shares can reconstruct the root key. In enterprise governance, this creates critical risks:
* **Custodian Collusion**: Two junior operators could combine shares to decrypt top-secret financial or trade-secret containers without executive authorization.
* **Lack of Role Separation**: Real-world quorums require multi-department sign-offs (e.g., *at least 1 Executive* **AND** *at least 1 Legal Officer*).

### 💡 What It Solves
Introduces **Hierarchical & Boolean Policy Quorums**, allowing containers to enforce strict structural formulas rather than flat numerical thresholds.

### ⚙️ Cryptographic Scheme & Implementation
Hierarchical quorums are realized by composing multiple polynomials over (256)$ in a tree hierarchy (Linear Secret Sharing Scheme - LSSS):

`
                        [ Root Master DEK ]
                                 |
              +------------------+------------------+
              | (AND Node: 2-of-2 Required)         |
              v                                     v
    [ Executive Quorum ]                   [ Compliance Quorum ]
    (Threshold: 1-of-3)                    (Threshold: 1-of-2)
     ├── CEO                                ├── Chief Legal Officer
     ├── CTO                                └── Compliance Director
     └── Board Member
`

* **Formula Specification**:
  \text{Quorum Policy} = (\text{Executive} \ge 1) \land (\text{Legal} \ge 1) \land (\text{DevOps} \ge 2)
* **Container Header Extension**:
  * The .denc header stores a policy tree descriptor encoded in a deterministic binary AST.
  * Each leaf node represents a custodian share, and interior nodes represent $-of-$ sub-quorums.
* **Tamper-Proof Enforcement**:
  * The entire policy AST is cryptographically bound into the container's AAD header digest and signed with the author's **ML-DSA-65** key.

---

## 3. 🌐 Phase 8: WebRTC & Remote Zero-Knowledge Quorum Relay

### 🎯 Problem Statement
In distributed and remote organizations, custodians reside in different physical locations. Currently, quorum unlock requires either:
1. In-person physical co-presence.
2. Manually emailing/exporting encrypted .dkey files or QR captures.
This introduces manual friction and risks sending share files over insecure communication channels.

### 💡 What It Solves
Enables **real-time, zero-knowledge multi-party unlock sessions** directly within the DualCrypt UI. Custodians join an ephemeral encrypted room and authorize their share remotely with zero file exchange.

`
+-------------------+           +-----------------------+           +-------------------+
| Custodian A (NYC) |           |  Encrypted Signaling  |           | Custodian B (LDN) |
| [ Touch ID / PIN ]|           |    (Zero-Knowledge)   |           | [ YubiKey Touch ] |
+---------+---------+           +-----------+-----------+           +---------+---------+
          |                                 |                                 |
          |       1. Join Ephemeral Room    |     1. Join Ephemeral Room      |
          +-------------------------------->+<--------------------------------+
          |                                 |                                 |
          |       2. Direct WebRTC P2P (DTLS / Post-Quantum ML-KEM)           |
          |<=================================================================>|
          |                                 |                                 |
          |       3. Encrypted Share Stream (Direct to Decryptor RAM)         |
          +------------------------------------------------------------------>|
`

### ⚙️ Technical Architecture & Implementation
* **Ephemeral Room Negotiation**:
  * The session initiator generates an ephemeral session key and room code.
  * Signaling is handled via lightweight WebSockets/STUN/TURN without storing any payload on relay servers.
* **Post-Quantum End-to-End Encryption**:
  * Once the WebRTC data channel is established, peers encapsulate an ephemeral transport key using **ML-KEM-768**.
  * Custodians inspect the container's **Immutable Governance Passport** (Classification, Filename, Purpose) on their local screen.
  * Upon entering their PIN/Biometric, their share is transmitted directly into the initiator's volatile memory and wiped upon container decryption.

---

## 4. 🏢 Phase 9: Enterprise SSO & Directory Sync (OIDC / SCIM / Active Directory — Okta 1st)

### 🎯 Problem Statement
Enterprise deployments with hundreds of custodians face administrative overhead:
1. Manually collecting and maintaining public keys (.pqc.pub) for all employees.
2. Inability to instantly revoke access when an employee leaves the company or changes departments.
3. Lack of audit correlation between enterprise employee identities and cryptographic container access.

### 💡 What It Solves
Integrates enterprise identity providers (**Okta** first, followed by Microsoft Entra ID / Google Workspace) to automate custodian discovery, role verification, and access lifecycle management.

### ⚙️ Technical Architecture & Implementation

`
+-----------------------------------------------------------------------------------+
|                               Enterprise Okta Org                                 |
|  [ Okta Universal Directory ] <-----> [ SCIM 2.0 Bridge ] <-----> [ DualCrypt PKI]|
+-----------------------------------------------------------------------------------+
                                         |
                       +-----------------+-----------------+
                       v                                   v
             [ Employee Onboarding ]             [ Custodian Offboarding ]
             Auto-registers ML-KEM              Instantly revokes shares
             public key in directory            and flags audit ledger
`

* **Okta Integration (Priority 1)**:
  * **OIDC Authentication Flow with PKCE**: Custodians authenticate against corporate Okta tenant.
  * **Key Escrow Directory in Okta User Profiles**: Custom schema attributes in Okta store the user's verified post-quantum public keys (custom.dualcrypt_pqc_pub).
  * **Author Workflow**: When encrypting, the user searches the organization directory ("Jane Doe - Legal") to instantly bind their verified public key without manual file sharing.
* **SCIM 2.0 Deprovisioning & Revocation Webhooks**:
  * When an employee is deactivated or moved to a different department in Okta, SCIM webhooks automatically update DualCrypt's directory cache.
  * Attempts to unlock historical containers with deprovisioned custodian shares trigger high-priority compliance warnings.
* **Audit Ledger Correlation**:
  * Unlock attempts log the verified Okta Identity Claims (Email, Department, Okta Actor ID) into the container's local and enterprise SIEM export streams.

---

## 📈 Summary & Migration Path

Each phase builds modularly upon the existing **denc-core** foundation:
* **Phase 6 (FIDO2)** expands local slot unlock methods.
* **Phase 7 (Hierarchical Quorums)** enhances polynomial secret sharing algorithms.
* **Phase 8 (WebRTC Relay)** adds a modern peer-to-peer transport layer.
* **Phase 9 (Enterprise SSO)** introduces organization-scale identity lifecycle management.
