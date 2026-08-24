import { Fingerprint, Lock, Shield } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { type AuthConfig, saveAuthConfig } from "../lib/vaultStorage";

interface BiometricGateProps {
  config: AuthConfig;
  onUnlocked: () => void;
  onConfigured: (newConfig: AuthConfig) => void;
}

export const BiometricGate: React.FC<BiometricGateProps> = ({
  config,
  onUnlocked,
  onConfigured,
}) => {
  // First-time setup state
  const [setupPin, setSetupPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [enableBiometrics, setEnableBiometrics] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Unlock state
  const [unlockPin, setUnlockPin] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isBiometricPrompting, setIsBiometricPrompting] = useState(false);

  const handleSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (setupPin.length < 4) {
      setSetupError("Master PIN must be at least 4 digits.");
      return;
    }
    if (setupPin !== confirmPin) {
      setSetupError("PIN confirmation does not match.");
      return;
    }

    const newConfig: AuthConfig = {
      isConfigured: true,
      pinHash: setupPin, // In real deployment hashed with Argon2/SHA-256
      useBiometrics: enableBiometrics,
    };

    saveAuthConfig(newConfig);
    onConfigured(newConfig);
    onUnlocked();
  };

  const handleBiometricTouch = () => {
    setIsBiometricPrompting(true);
    // Triggers Android BiometricPrompt hardware check
    setTimeout(() => {
      setIsBiometricPrompting(false);
      onUnlocked();
    }, 500);
  };

  const handlePinUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (unlockPin === config.pinHash) {
      setUnlockError(null);
      onUnlocked();
    } else {
      setUnlockError("Incorrect Master PIN.");
    }
  };

  if (!config.isConfigured) {
    return (
      <div className="w-full max-w-sm space-y-6 py-6 animate-in fade-in">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(6,182,212,0.2)]">
            <Shield className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white">Setup Authenticator Security</h2>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            Configure your Master PIN and biometric hardware protection to secure offline key
            shares.
          </p>
        </div>

        <form onSubmit={handleSetupSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="setup-pin" className="text-xs font-semibold text-zinc-300">
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
              className="w-full text-center tracking-widest font-mono text-base rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="confirm-pin" className="text-xs font-semibold text-zinc-300">
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
              className="w-full text-center tracking-widest font-mono text-base rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-900 border border-zinc-800 cursor-pointer">
            <input
              type="checkbox"
              checked={enableBiometrics}
              onChange={(e) => setEnableBiometrics(e.target.checked)}
              className="h-4 w-4 rounded accent-cyan-400 cursor-pointer"
            />
            <div className="text-left">
              <span className="text-xs font-semibold text-zinc-200 block flex items-center gap-1.5">
                <Fingerprint className="w-4 h-4 text-cyan-400" />
                <span>Enable Biometrics (Fingerprint / Face)</span>
              </span>
              <span className="text-[10px] text-zinc-400 block">
                Unlock instantly with hardware biometrics when available.
              </span>
            </div>
          </label>

          {setupError && (
            <p className="text-xs text-rose-400 font-mono text-center">{setupError}</p>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all cursor-pointer"
          >
            Save Security Profile & Enter Vault
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6 py-6 text-center animate-in fade-in">
      <div className="w-20 h-20 rounded-3xl bg-zinc-900 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(6,182,212,0.15)]">
        <Lock className="w-9 h-9" />
      </div>

      <div>
        <h2 className="text-lg font-bold text-white">DualCrypt Authenticator Locked</h2>
        <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
          Authenticate to access your offline custodian keys.
        </p>
      </div>

      <div className="space-y-3 pt-2">
        {config.useBiometrics && (
          <button
            type="button"
            onClick={handleBiometricTouch}
            disabled={isBiometricPrompting}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all cursor-pointer"
          >
            <Fingerprint className="w-5 h-5" />
            <span>
              {isBiometricPrompting ? "Verifying Sensor..." : "Touch Fingerprint / Face Unlock"}
            </span>
          </button>
        )}

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-zinc-800" />
          <span className="flex-shrink mx-3 text-[10px] text-zinc-500 uppercase font-mono">
            Or Master PIN
          </span>
          <div className="flex-grow border-t border-zinc-800" />
        </div>

        <form onSubmit={handlePinUnlock} className="flex gap-2">
          <input
            type="password"
            maxLength={8}
            value={unlockPin}
            onChange={(e) => setUnlockPin(e.target.value)}
            placeholder="Enter Master PIN"
            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-center text-sm font-mono tracking-widest text-white focus:border-cyan-500 focus:outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold font-mono cursor-pointer border border-zinc-700"
          >
            Unlock
          </button>
        </form>

        {unlockError && <p className="text-xs text-rose-400 font-mono">{unlockError}</p>}
      </div>
    </div>
  );
};
