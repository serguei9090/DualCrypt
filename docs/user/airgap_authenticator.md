# 📲 Air-Gapped Optical Mobile Authenticator Guide

The **DualCrypt Mobile Authenticator** is a 100% offline, zero-network companion application for Android designed to provide hardware-isolated cryptographic sign-offs using animated optical QR fountain streams.

---

## 📑 Contents
1. [Air-Gap Architecture & Threat Model](#1-air-gap-architecture--threat-model)
2. [Mobile Application Installation & Biometric Setup](#2-mobile-application-installation--biometric-setup)
3. [Custodian Enrollment Workflow](#3-custodian-enrollment-workflow)
4. [Optical Sign-Off & Decryption Workflow](#4-optical-sign-off--decryption-workflow)
5. [Fountain Coding & CRC32 Framing](#5-fountain-coding--crc32-framing)

---

## 1. Air-Gap Architecture & Threat Model

In high-assurance environments, the machine performing file decryption may be connected to an untrusted local network or internet. To prevent key exfiltration:
* Custodian keys are stored exclusively in the secure hardware-backed storage of an **offline mobile device**.
* The mobile device operates with **Airplane Mode enabled** (no Wi-Fi, Bluetooth, NFC, or cellular radio).
* Communication between the desktop workstation and mobile phone occurs purely through **optical line-of-sight** (cameras scanning computer screens).

```
+-------------------------------------------------------------+
|                     DESKTOP WORKSTATION                     |
|                                                             |
|   [ Animated QR Stream ]           [ Webcam / Scanner ]     |
|   Fountain frames 1..N              Reads Phone's QR        |
+-------------------------------------------------------------+
               |                                ^
     (Optical Screen Scan)            (Optical Screen Scan)
               v                                |
+-------------------------------------------------------------+
|                   OFFLINE ANDROID PHONE                     |
|                                                             |
|   [ Phone Camera ]                 [ Animated Response QR ] |
|   Captures Challenge                Returns Signed Share    |
|                                                             |
|   [ Hardware Biometric Gate / 6-Digit Master PIN ]          |
+-------------------------------------------------------------+
```

---

## 2. Mobile Application Installation & Biometric Setup

1. Install `DualCrypt-Authenticator.apk` onto your Android phone.
2. Launch the app for the first time.
3. Configure your **6-Digit Master PIN** and enable **Biometric Authentication** (Fingerprint / Face Recognition).
4. Note that the application has zero internet permissions (`android.permission.INTERNET` is omitted from `AndroidManifest.xml`).

---

## 3. Custodian Enrollment Workflow

To store an external custodian share on your phone:
1. In the desktop application, when generating a key share, click **`📲 Enroll on Mobile Authenticator`**.
2. The desktop displays an animated QR stream containing the encrypted custodian enrollment payload.
3. Open the **DualCrypt Authenticator** app on your phone and tap **`[ 📥 Scan & Store Share ]`**.
4. Authenticate with your fingerprint.
5. Point the phone camera at the desktop screen until all frames are captured.
6. The share is securely stored inside the phone's encrypted vault.

---

## 4. Optical Sign-Off & Decryption Workflow

When a `.denc` container requires sign-off from the air-gapped custodian:

1. **Initiate on Desktop**:
   * In the Decrypt view, click **`📲 100% Air-Gapped Optical Sign-Off`** on the custodian's card.
   * The desktop displays an animated challenge QR code stream.
2. **Scan Challenge on Phone**:
   * Open the DualCrypt Authenticator app and tap **`[ 🔓 Authorize Sign-Off ]`**.
   * Authenticate with your fingerprint.
   * Point your phone camera at the desktop screen. The app displays a progress circle as fountain frames are assembled.
3. **Display Response on Phone**:
   * Once validated, the phone generates an animated QR response containing the decrypted Shamir share.
4. **Capture Response on Desktop**:
   * Point your desktop webcam (or USB scanner) at your phone screen.
   * DualCrypt verifies the CRC32 checksum, validates the share, and marks the custodian slot as **`🟢 VERIFIED`**.

---

## 5. Fountain Coding & CRC32 Framing

Because camera frames can experience glare, motion blur, or dropped frames, DualCrypt implements **Optical Fountain Framing**:
* Payloads are sliced into small chunks ($120\text{ bytes}$ each).
* Each frame includes: `[Magic: DENC_AIRGAP] [Frame Index] [Total Frames] [CRC32 Checksum] [Payload Chunk]`.
* The sender continuously loops the frame sequence at 10–15 FPS.
* The receiver can start scanning at any arbitrary frame and assemble the payload in any order without synchronization loss.
