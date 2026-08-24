/**
 * Genuine Platform Biometric Authentication Interface
 * Supports Android Hardware Biometric Enclave (via Tauri v2 Biometric IPC)
 * and WebAuthn / Platform Authenticator (Windows Hello, Mac Touch ID, Android Chrome).
 *
 * Strict Security Guardrail: ZERO SIMULATION / ZERO AUTO-UNLOCK MOCKS.
 */

export async function isBiometricHardwareAvailable(): Promise<boolean> {
  // 1. Check if running in Tauri v2 environment on Android
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const internals = (
        window as unknown as { __TAURI_INTERNALS__?: { invoke: (cmd: string) => Promise<unknown> } }
      ).__TAURI_INTERNALS__;
      if (internals?.invoke) {
        await internals.invoke("plugin:biometric|status");
        return true;
      }
      return true;
    } catch {
      return false;
    }
  }

  // 2. Check if running in browser with WebAuthn Platform Authenticator support
  if (
    typeof window !== "undefined" &&
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function"
  ) {
    try {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }

  return false;
}

export async function authenticateWithBiometrics(
  reason = "Authenticate to access DualCrypt Key Vault",
): Promise<{ success: boolean; error?: string }> {
  // 1. Tauri v2 Android Native Biometric Call
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const internals = (
        window as unknown as {
          __TAURI_INTERNALS__?: { invoke: (cmd: string, args: unknown) => Promise<unknown> };
        }
      ).__TAURI_INTERNALS__;
      if (internals?.invoke) {
        await internals.invoke("plugin:biometric|authenticate", { reason });
        return { success: true };
      }
      return { success: false, error: "Tauri Biometric runtime unavailable." };
    } catch (err) {
      return { success: false, error: `Android Biometric verification failed: ${String(err)}` };
    }
  }

  // 2. WebAuthn Platform Authenticator (Windows Hello / Touch ID / Android Chrome)
  if (
    typeof window !== "undefined" &&
    window.PublicKeyCredential &&
    navigator.credentials &&
    typeof navigator.credentials.get === "function"
  ) {
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Request user verification from platform authenticator
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: "required",
          rpId: window.location.hostname || "localhost",
          allowCredentials: [],
        },
      });

      if (assertion) {
        return { success: true };
      }
      return { success: false, error: "Biometric verification was cancelled by user." };
    } catch (err: unknown) {
      const e = err as Error;
      if (e.name === "NotAllowedError") {
        return { success: false, error: "Biometric authentication cancelled or timed out." };
      }
      return {
        success: false,
        error:
          "Biometric hardware not configured or registered on this browser. Please enter your Master PIN.",
      };
    }
  }

  return {
    success: false,
    error: "Biometric hardware unavailable on this platform. Please enter your Master PIN.",
  };
}
