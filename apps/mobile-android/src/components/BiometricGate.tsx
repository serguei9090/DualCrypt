import { AlertCircle, Fingerprint, Lock, Shield } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { authenticateWithBiometrics, isBiometricHardwareAvailable } from "../lib/biometricAuth";
import {
  base64ToUint8Array,
  createPinVerifier,
  deriveVaultKey,
  generateRandomBytes,
  uint8ArrayToBase64,
} from "../lib/cryptoVault";
import { type AuthConfig, saveAuthConfig } from "../lib/vaultStorage";

interface BiometricGateProps {
  config: AuthConfig;
  theme: "dark" | "light";
  onUnlocked: (sessionKey: CryptoKey, salt: Uint8Array) => void;
  onConfigured: (newConfig: AuthConfig) => void;
}

export const BiometricGate: React.FC<BiometricGateProps> = ({
  config,
  theme,
  onUnlocked,
  onConfigured,
}) => {
  // First-time setup state
  const [setupPin, setSetupPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [enableBiometrics, setEnableBiometrics] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Unlock state
  const [unlockPin, setUnlockPin] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isPrompting, setIsPrompting] = useState(false);
  const [hardwareAvailable, setHardwareAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    isBiometricHardwareAvailable().then((avail) => setHardwareAvailable(avail));
  }, []);

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setupPin.length < 4) {
      setSetupError("Master PIN must be at least 4 digits.");
      return;
    }
    if (setupPin !== confirmPin) {
      setSetupError("PIN confirmation does not match.");
      return;
    }

    setIsProcessing(true);
    setSetupError(null);

    try {
      const salt = generateRandomBytes(32);
      const vaultKey = await deriveVaultKey(setupPin, salt);
      const pinVerifier = await createPinVerifier(setupPin, salt);

      const newConfig: AuthConfig = {
        isConfigured: true,
        saltBase64: uint8ArrayToBase64(salt),
        pinVerifier,
        useBiometrics: enableBiometrics,
      };

      saveAuthConfig(newConfig);
      onConfigured(newConfig);
      onUnlocked(vaultKey, salt);
    } catch (err) {
      setSetupError(`Failed to initialize cryptographic vault: ${String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBiometricAuth = async () => {
    setIsPrompting(true);
    setUnlockError(null);

    const result = await authenticateWithBiometrics("Authenticate to unlock DualCrypt Vault");

    setIsPrompting(false);

    if (result.success) {
      // Prompt for PIN to derive AES session key if not stored in memory
      setUnlockError(null);
    } else if (result.error) {
      setUnlockError(result.error);
    }
  };

  const handlePinUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockPin.trim()) return;

    setIsProcessing(true);
    setUnlockError(null);

    try {
      const salt = base64ToUint8Array(config.saltBase64);
      const candidateVerifier = await createPinVerifier(unlockPin, salt);

      if (candidateVerifier === config.pinVerifier) {
        const vaultKey = await deriveVaultKey(unlockPin, salt);
        onUnlocked(vaultKey, salt);
      } else {
        setUnlockError("Incorrect Master PIN. Key derivation rejected.");
      }
    } catch (err) {
      setUnlockError(`Unlock error: ${String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!config.isConfigured) {
    return (
      <div className="w-full max-w-sm space-y-6 py-6 animate-in fade-in">
        <div className="text-center space-y-2">
          <div
            className={`w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto ${
              theme === "dark"
                ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.2)]"
                : "bg-cyan-50 border-cyan-300 text-cyan-600 shadow-sm"
            }`}
          >
            <Shield className="w-8 h-8" />
          </div>
          <h2 className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
            Setup Authenticator Security
          </h2>
          <p
            className={`text-xs max-w-xs mx-auto ${
              theme === "dark" ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Configure your Master PIN and biometric hardware protection to secure offline key
            shares.
          </p>
        </div>

        <form onSubmit={handleSetupSubmit} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="setup-pin"
              className={`text-xs font-semibold ${
                theme === "dark" ? "text-slate-300" : "text-slate-700"
              }`}
            >
              Create 4-8 Digit Master PIN
            </label>
            <input
              id="setup-pin"
              type="password"
              maxLength={8}
              required
              value={setupPin}
              onChange={(e) => setSetupPin(e.target.value)}
              placeholder="••••"
              className={`w-full text-center tracking-widest font-mono text-base rounded-xl border px-3 py-2.5 transition-all focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none ${
                theme === "dark"
                  ? "border-slate-800 bg-slate-950 text-white placeholder-slate-600 focus:border-cyan-500"
                  : "border-slate-300 bg-white text-slate-900 focus:border-cyan-600 shadow-sm"
              }`}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="confirm-pin"
              className={`text-xs font-semibold ${
                theme === "dark" ? "text-slate-300" : "text-slate-700"
              }`}
            >
              Confirm Master PIN
            </label>
            <input
              id="confirm-pin"
              type="password"
              maxLength={8}
              required
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="••••"
              className={`w-full text-center tracking-widest font-mono text-base rounded-xl border px-3 py-2.5 transition-all focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none ${
                theme === "dark"
                  ? "border-slate-800 bg-slate-950 text-white placeholder-slate-600 focus:border-cyan-500"
                  : "border-slate-300 bg-white text-slate-900 focus:border-cyan-600 shadow-sm"
              }`}
            />
          </div>

          <label
            className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer ${
              theme === "dark"
                ? "bg-slate-900 border-slate-800 text-slate-200"
                : "bg-white border-slate-200 text-slate-800 shadow-sm"
            }`}
          >
            <input
              type="checkbox"
              checked={enableBiometrics}
              onChange={(e) => setEnableBiometrics(e.target.checked)}
              className="h-4 w-4 rounded accent-cyan-500 cursor-pointer"
            />
            <div className="text-left">
              <span className="text-xs font-semibold block flex items-center gap-1.5">
                <Fingerprint className="w-4 h-4 text-cyan-500" />
                <span>Enable Biometrics (Fingerprint / Face)</span>
              </span>
              <span
                className={`text-[10px] block ${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {hardwareAvailable === false
                  ? "Hardware biometrics not detected on this browser — Master PIN will be used."
                  : "Unlock instantly with hardware biometrics when available."}
              </span>
            </div>
          </label>

          {setupError && (
            <p className="text-xs text-rose-400 font-mono text-center">{setupError}</p>
          )}

          <button
            type="submit"
            disabled={isProcessing}
            className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
          >
            {isProcessing
              ? "Deriving Master Key (PBKDF2)..."
              : "Save Security Profile & Enter Vault"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6 py-6 text-center animate-in fade-in">
      <div
        className={`w-20 h-20 rounded-2xl border flex items-center justify-center mx-auto ${
          theme === "dark"
            ? "bg-slate-900 border-cyan-500/30 text-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.15)]"
            : "bg-white border-cyan-300 text-cyan-600 shadow-md"
        }`}
      >
        <Lock className="w-9 h-9" />
      </div>

      <div>
        <h2 className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
          DualCrypt Authenticator Locked
        </h2>
        <p
          className={`text-xs mt-1 max-w-xs mx-auto ${
            theme === "dark" ? "text-slate-400" : "text-slate-500"
          }`}
        >
          Authenticate to access your offline custodian keys.
        </p>
      </div>

      <div className="space-y-3 pt-2">
        {config.useBiometrics && (
          <button
            type="button"
            onClick={handleBiometricAuth}
            disabled={isPrompting || isProcessing}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
          >
            <Fingerprint className="w-5 h-5" />
            <span>
              {isPrompting ? "Verifying Platform Biometric..." : "Touch Fingerprint / Face Unlock"}
            </span>
          </button>
        )}

        <div className="relative flex py-1 items-center">
          <div
            className={`flex-grow border-t ${
              theme === "dark" ? "border-slate-800" : "border-slate-300"
            }`}
          />
          <span
            className={`flex-shrink mx-3 text-[10px] uppercase font-mono ${
              theme === "dark" ? "text-slate-500" : "text-slate-400"
            }`}
          >
            Or Master PIN
          </span>
          <div
            className={`flex-grow border-t ${
              theme === "dark" ? "border-slate-800" : "border-slate-300"
            }`}
          />
        </div>

        <form onSubmit={handlePinUnlock} className="flex gap-2">
          <input
            type="password"
            maxLength={8}
            value={unlockPin}
            onChange={(e) => setUnlockPin(e.target.value)}
            placeholder="Enter Master PIN"
            className={`flex-1 rounded-xl border px-3 py-2 text-center text-sm font-mono tracking-widest transition-all focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none ${
              theme === "dark"
                ? "border-slate-800 bg-slate-950 text-white placeholder-slate-600 focus:border-cyan-500"
                : "border-slate-300 bg-white text-slate-900 focus:border-cyan-600 shadow-sm"
            }`}
          />
          <button
            type="submit"
            disabled={isProcessing}
            className={`px-4 py-2 rounded-xl text-xs font-semibold font-mono cursor-pointer border transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none ${
              theme === "dark"
                ? "bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
                : "bg-slate-800 hover:bg-slate-900 text-white border-slate-800"
            }`}
          >
            {isProcessing ? "Verifying..." : "Unlock"}
          </button>
        </form>

        {unlockError && (
          <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-400 text-xs flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="font-mono text-[11px]">{unlockError}</p>
          </div>
        )}
      </div>
    </div>
  );
};
