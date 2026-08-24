# 📱 Android Testing & Google Play Release Guide: DualCrypt Authenticator

This document provides step-by-step instructions for:
1. **Quick 30-Second LAN Testing** (Instant browser preview on your phone without Android Studio).
2. **Native Android USB Debugging** (`tauri android dev`).
3. **Building Production Signed APK & Google Play App Bundle (`.aab`)** for Google Play Store publication.

---

## ⚡ Part 1: Quick 30-Second LAN Testing (Fastest & Zero Setup)

Test the mobile UI, Master PIN protection, keystore management, and optical QR flows on your Android phone immediately.

### Step 1: Start the Mobile Dev Server on your PC
Ensure your Android phone and PC are connected to the **same Wi-Fi network**.
Run from the repository root:
```bash
bun run mobile:dev
```
Vite will output the local and network URLs:
```
  ➜  Local:   http://localhost:1421/
  ➜  Network: http://192.168.1.xxx:1421/
```

### Step 2: Open on Android Chrome
1. Open Google Chrome on your Android phone and go to your Network IP (e.g., `http://192.168.1.105:1421`).
2. Set your **Master PIN** (e.g., `1234`).

### Step 3: Enable Camera Access for HTTP LAN IP in Chrome
Modern browsers restrict camera access on plain `http://` for non-localhost IPs. To enable camera on your phone in 10 seconds:
1. In Android Chrome, navigate to: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
2. Set the flag to **Enabled**.
3. In the text box below, enter your PC's LAN URL (e.g., `http://192.168.1.105:1421`).
4. Tap **Relaunch** at the bottom of Chrome.
5. Camera and QR scanning are now fully active!

### Step 4: Test the Complete End-to-End Flow
1. **Encrypt & Enroll**:
   * On your PC: Drop a file in the **Encrypt** tab, select quorum, and click **Encrypt**.
   * On the Complete screen: Click **`📲 Scan to Phone (QR)`** for Custodian 1.
   * On your Phone: Tap **`Scan & Add Key`**, point the camera at the PC screen.
   * Result: The key is saved into your phone's offline vault!
2. **Quorum Decrypt**:
   * On your PC: Drop the `.denc` file in the **Decrypt** tab and click **`[ 📲 QR ]`** on the Custodian 1 slot.
   * On your Phone: Tap **`Authorize Decrypt`** and point camera at the desktop challenge.
   * Phone automatically matches the key in its enclave and shows the **Provenance Passport** (`TOP SECRET 🔴`).
   * Enter PIN/Sign-off $\rightarrow$ Phone flashes the response stream.
   * Desktop webcam scans phone screen $\rightarrow$ Quorum slot unlocks automatically!

---

## 🛠️ Part 2: Native Android USB Live Debugging

Run DualCrypt Authenticator as a native Android application directly on your phone with native hardware access.

### Prerequisites
1. **Android Studio** with:
   * Android SDK (API Level 34 / Android 14+ recommended)
   * Android SDK Platform-Tools (`adb`)
   * Android NDK
2. **Environment Variables** (Set in your user or system environment):
   * `ANDROID_HOME`: Path to Android SDK (e.g. `C:\Users\<YourUser>\AppData\Local\Android\Sdk`)
   * `NDK_HOME`: Path to NDK inside SDK (e.g. `%ANDROID_HOME%\ndk\<version>`)
   * Add `%ANDROID_HOME%\platform-tools` to `PATH`.
3. **Rust Android Targets**:
   ```bash
   rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
   ```

### Step 1: Enable USB Debugging on your Phone
1. Go to **Settings $\rightarrow$ About phone** and tap **Build number** 7 times to enable Developer Options.
2. Go to **Settings $\rightarrow$ System $\rightarrow$ Developer options** and enable **USB debugging**.
3. Connect your phone to your PC via USB cable. Run `adb devices` in PowerShell to verify connection.

### Step 2: Launch Native Android Dev Server
```bash
bun --cwd apps/mobile-android tauri android dev
```
Tauri will compile the Rust core, build the debug APK, install it onto your phone, and start live hot-reloading.

---

## 🚀 Part 3: Building Production Signed APK & Google Play App Bundle (`.aab`)

To publish on the **Google Play Store**, Google mandates the **Android App Bundle (`.aab`)** format signed with a release keystore.

### Step 1: Generate a Release Signing Keystore
Run the Java `keytool` command in your terminal (included with JDK / Android Studio):
```bash
keytool -genkey -v -keystore dualcrypt-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias dualcrypt-key
```
* You will be prompted to enter a keystore password and organization details.
* **CRITICAL**: Store `dualcrypt-release-key.jks` and your password in a secure offline backup. If you lose this key, you will not be able to push updates to Google Play.

### Step 2: Configure Signing Credentials
Set the signing environment variables (or configure `apps/mobile-android/src-tauri/gen/android/keystore.properties`):

**In PowerShell / CI Pipeline:**
```powershell
$env:TAURI_ANDROID_KEYSTORE_PATH="C:\path\to\dualcrypt-release-key.jks"
$env:TAURI_ANDROID_KEYSTORE_PASSWORD="YourKeystorePassword"
$env:TAURI_ANDROID_KEY_ALIAS="dualcrypt-key"
$env:TAURI_ANDROID_KEY_PASSWORD="YourKeyPassword"
```

### Step 3: Build Google Play Store Bundle (`.aab`)
Google Play Store requires `.aab` (Android App Bundle) for new application submissions:
```bash
bun --cwd apps/mobile-android tauri android build --aab
```
* **Output Path**: `apps/mobile-android/src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`

### Step 4: Build Standalone Universal Signed APK (`.apk`)
For direct enterprise sideloading or internal distribution outside Google Play:
```bash
bun --cwd apps/mobile-android tauri android build --apk
```
* **Output Path**: `apps/mobile-android/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk`

---

## 📋 Google Play Store Listing & Compliance Checklist

When creating your listing in the **Google Play Console**:

1. **Category**: `Tools` / `Security & Productivity`
2. **App Permissions**:
   * `CAMERA` (Required for optical QR scanning of challenge and enrollment streams).
   * `USE_BIOMETRIC` (Required for hardware Fingerprint/Face Unlock).
   * `INTERNET`: **DO NOT REQUEST** (DualCrypt Authenticator is 100% offline with zero network attack surface).
3. **Data Safety Declaration**:
   * *Does your app collect or share user data?* $\rightarrow$ **No** (0 data collected, 0 analytics, 0 network transmission).
4. **Target Audience**: All enterprise and personal security users (Age 13+).
5. **App Artifact Upload**: Upload the generated `.aab` file from Step 3 into the **Production** or **Closed Testing** track in Google Play Console.
