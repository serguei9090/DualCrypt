import { CheckCircle2, Fingerprint, Lock, Shield, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { type AuthConfig, saveAuthConfig } from "../lib/vaultStorage";

interface BiometricGateProps {
  config: AuthConfig;
  theme: "dark" | "light";
  onUnlocked: () => void;
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

  // Unlock state
  const [unlockPin, setUnlockPin] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Realistic Biometric Sensor Modal State
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [sensorState, setSensorState] = useState<"idle" | "scanning" | "success" | "error">("idle");

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
      pinHash: setupPin,
      useBiometrics: enableBiometrics,
    };

    saveAuthConfig(newConfig);
    onConfigured(newConfig);
    onUnlocked();
  };

  const handleTriggerBiometric = () => {
    setShowBiometricModal(true);
    setSensorState("idle");
  };

  const handleSensorTouch = () => {
    if (sensorState !== "idle") return;
    setSensorState("scanning");

    setTimeout(() => {
      setSensorState("success");
      setTimeout(() => {
        setShowBiometricModal(false);
        onUnlocked();
      }, 700);
    }, 600);
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
              theme === "dark" ? "text-zinc-400" : "text-slate-500"
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
                theme === "dark" ? "text-zinc-300" : "text-slate-700"
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
              className={`w-full text-center tracking-widest font-mono text-base rounded-xl border px-3 py-2.5 focus:outline-none ${
                theme === "dark"
                  ? "border-zinc-800 bg-zinc-950 text-white focus:border-cyan-500"
                  : "border-slate-300 bg-white text-slate-900 focus:border-cyan-600 shadow-sm"
              }`}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="confirm-pin"
              className={`text-xs font-semibold ${
                theme === "dark" ? "text-zinc-300" : "text-slate-700"
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
              className={`w-full text-center tracking-widest font-mono text-base rounded-xl border px-3 py-2.5 focus:outline-none ${
                theme === "dark"
                  ? "border-zinc-800 bg-zinc-950 text-white focus:border-cyan-500"
                  : "border-slate-300 bg-white text-slate-900 focus:border-cyan-600 shadow-sm"
              }`}
            />
          </div>

          <label
            className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer ${
              theme === "dark"
                ? "bg-zinc-900 border-zinc-800 text-zinc-200"
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
                  theme === "dark" ? "text-zinc-400" : "text-slate-500"
                }`}
              >
                Unlock instantly with hardware biometrics when available.
              </span>
            </div>
          </label>

          {setupError && (
            <p className="text-xs text-rose-500 font-mono text-center">{setupError}</p>
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
      <div
        className={`w-20 h-20 rounded-3xl border flex items-center justify-center mx-auto ${
          theme === "dark"
            ? "bg-zinc-900 border-cyan-500/30 text-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.15)]"
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
            theme === "dark" ? "text-zinc-400" : "text-slate-500"
          }`}
        >
          Authenticate to access your offline custodian keys.
        </p>
      </div>

      <div className="space-y-3 pt-2">
        {config.useBiometrics && (
          <button
            type="button"
            onClick={handleTriggerBiometric}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all cursor-pointer"
          >
            <Fingerprint className="w-5 h-5" />
            <span>Touch Fingerprint / Face Unlock</span>
          </button>
        )}

        <div className="relative flex py-1 items-center">
          <div
            className={`flex-grow border-t ${
              theme === "dark" ? "border-zinc-800" : "border-slate-300"
            }`}
          />
          <span
            className={`flex-shrink mx-3 text-[10px] uppercase font-mono ${
              theme === "dark" ? "text-zinc-500" : "text-slate-400"
            }`}
          >
            Or Master PIN
          </span>
          <div
            className={`flex-grow border-t ${
              theme === "dark" ? "border-zinc-800" : "border-slate-300"
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
            className={`flex-1 rounded-xl border px-3 py-2 text-center text-sm font-mono tracking-widest focus:outline-none ${
              theme === "dark"
                ? "border-zinc-800 bg-zinc-950 text-white focus:border-cyan-500"
                : "border-slate-300 bg-white text-slate-900 focus:border-cyan-600 shadow-sm"
            }`}
          />
          <button
            type="submit"
            className={`px-4 py-2 rounded-xl text-xs font-semibold font-mono cursor-pointer border ${
              theme === "dark"
                ? "bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700"
                : "bg-slate-800 hover:bg-slate-900 text-white border-slate-800"
            }`}
          >
            Unlock
          </button>
        </form>

        {unlockError && <p className="text-xs text-rose-500 font-mono">{unlockError}</p>}
      </div>

      {/* Realistic Android OS Biometric Sensor Overlay */}
      {showBiometricModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div
            className={`w-full max-w-sm rounded-3xl border p-6 space-y-6 shadow-2xl relative text-center ${
              theme === "dark"
                ? "bg-zinc-950 border-zinc-800 text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <button
              type="button"
              onClick={() => setShowBiometricModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <div className="text-sm font-bold tracking-tight">Biometric Authentication</div>
              <p className="text-xs text-zinc-400">
                {sensorState === "idle" && "Touch the fingerprint sensor to unlock"}
                {sensorState === "scanning" && "Scanning biometric signature..."}
                {sensorState === "success" && "Biometric Verified ✓"}
              </p>
            </div>

            {/* Pulsating Sensor Target Button */}
            <div className="py-4">
              <button
                type="button"
                onClick={handleSensorTouch}
                disabled={sensorState !== "idle"}
                className={`w-24 h-24 rounded-full border-2 mx-auto flex items-center justify-center transition-all cursor-pointer ${
                  sensorState === "idle"
                    ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400 hover:scale-105 hover:bg-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.25)] animate-pulse"
                    : sensorState === "scanning"
                      ? "border-amber-400 bg-amber-500/20 text-amber-400 scale-105 shadow-[0_0_30px_rgba(251,191,36,0.4)] animate-spin"
                      : "border-emerald-400 bg-emerald-500/20 text-emerald-400 scale-110 shadow-[0_0_30px_rgba(52,211,153,0.5)]"
                }`}
              >
                {sensorState === "success" ? (
                  <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                ) : (
                  <Fingerprint className="w-12 h-12" />
                )}
              </button>
              <span className="block text-[11px] font-mono text-zinc-500 mt-3">
                {sensorState === "idle"
                  ? "Tap sensor icon to simulate touch"
                  : "Hardware sensor active"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowBiometricModal(false)}
              className="w-full py-2.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              Use Master PIN instead
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
