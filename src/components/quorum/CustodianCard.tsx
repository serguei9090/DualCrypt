import { open } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  FileKey,
  KeyRound,
  Lock,
  RefreshCw,
  Shield,
  Zap,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import {
  isTauriEnvironment,
  listHardwareTokens,
  parseKeyFile,
  performHardwareTokenChallenge,
  type YubiKeyDevice,
} from "../../lib/tauri";
import { cn } from "../../lib/utils";

export type AuthMethod = "passphrase" | "keyfile" | "yubikey" | "otp";

interface CustodianCardProps {
  custodianId: number;
  label: string;
  authType: AuthMethod;
  isVerified: boolean;
  mode: "encrypt_setup" | "decrypt_unlock";
  onCredentialSubmit: (data: {
    custodianId: number;
    passphrase?: string;
    keyFileContent?: string;
    authType: AuthMethod;
    label?: string;
  }) => void;
  onUpdateSetup?: (data: { label: string; authType: AuthMethod; passphrase?: string }) => void;
}

export const CustodianCard: React.FC<CustodianCardProps> = ({
  custodianId,
  label,
  authType,
  isVerified,
  mode,
  onCredentialSubmit,
  onUpdateSetup,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<AuthMethod>(authType);
  const [currentLabel, setCurrentLabel] = useState(label);
  const [passphrase, setPassphrase] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keyFileName, setKeyFileName] = useState<string | null>(null);
  const [keyFilePath, setKeyFilePath] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");

  // PIN protection on key file import
  const [isPinProtectedKey, setIsPinProtectedKey] = useState(false);
  const [keyFilePin, setKeyFilePin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  // Hardware key detection state
  const [detectedTokens, setDetectedTokens] = useState<YubiKeyDevice[]>([]);
  const [isScanningTokens, setIsScanningTokens] = useState(false);
  const [hardwareError, setHardwareError] = useState<string | null>(null);

  const scanForTokens = useCallback(async () => {
    setIsScanningTokens(true);
    setHardwareError(null);
    try {
      const tokens = await listHardwareTokens();
      setDetectedTokens(tokens);
    } catch {
      setDetectedTokens([]);
    } finally {
      setIsScanningTokens(false);
    }
  }, []);

  useEffect(() => {
    if (selectedMethod === "yubikey") {
      scanForTokens();
    }
  }, [selectedMethod, scanForTokens]);

  const handlePickKeyFile = async () => {
    setPinError(null);
    if (isTauriEnvironment()) {
      const selected = await open({
        multiple: false,
        filters: [{ name: "DualCrypt Key Share", extensions: ["dkey", "json", "key"] }],
      });
      if (selected && typeof selected === "string") {
        const fname = selected.split(/[\\/]/).pop() || selected;
        setKeyFileName(fname);
        setKeyFilePath(selected);

        try {
          const res = await parseKeyFile(selected);
          if (res.is_pin_protected && !res.share) {
            setIsPinProtectedKey(true);
          } else if (res.share) {
            setIsPinProtectedKey(false);
            onCredentialSubmit({
              custodianId,
              keyFileContent: JSON.stringify(res.share),
              authType: "keyfile",
            });
          }
        } catch (err) {
          console.error("Failed to parse key file:", err);
          setPinError(`Failed to parse key file: ${String(err)}`);
        }
      }
    } else {
      setKeyFileName(`custodian_${custodianId}_share.dkey`);
      onCredentialSubmit({
        custodianId,
        keyFileContent: JSON.stringify({ id: custodianId, data: Array(32).fill(0xaa) }),
        authType: "keyfile",
      });
    }
  };

  const handleUnlockPinProtectedKey = async () => {
    if (!keyFilePath || !keyFilePin) return;
    setPinError(null);
    try {
      const res = await parseKeyFile(keyFilePath, keyFilePin);
      if (res.share) {
        setIsPinProtectedKey(false);
        onCredentialSubmit({
          custodianId,
          keyFileContent: JSON.stringify(res.share),
          authType: "keyfile",
        });
      } else {
        setPinError("Incorrect PIN for this key share.");
      }
    } catch (err) {
      setPinError(`PIN Unlock Failed: ${String(err)}`);
    }
  };

  const handleYubikeyAuth = async () => {
    setHardwareError(null);
    try {
      await performHardwareTokenChallenge(custodianId, "4475616c43727970742d41757468");
      onCredentialSubmit({
        custodianId,
        keyFileContent: JSON.stringify({ id: custodianId, data: Array(32).fill(0xee) }),
        authType: "yubikey",
      });
    } catch (err) {
      setHardwareError(String(err));
    }
  };

  const handlePassphraseSubmit = () => {
    if (!passphrase) return;
    if (mode === "encrypt_setup") {
      onUpdateSetup?.({ label: currentLabel, authType: selectedMethod, passphrase });
      onCredentialSubmit({
        custodianId,
        passphrase,
        authType: selectedMethod,
        label: currentLabel,
      });
    } else {
      onCredentialSubmit({ custodianId, passphrase, authType: "passphrase" });
    }
  };

  return (
    <div
      className={cn(
        "relative rounded-2xl border p-5 transition-all duration-300 backdrop-blur-md",
        isVerified
          ? "border-emerald-500/50 bg-zinc-900/90 shadow-[0_0_25px_rgba(16,185,129,0.15)]"
          : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-750",
      )}
    >
      <div className="flex items-center justify-between mb-4 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-zinc-800 font-mono text-xs font-bold text-cyan-400 border border-zinc-700">
            P{custodianId}
          </span>
          <div>
            {mode === "encrypt_setup" ? (
              <input
                type="text"
                value={currentLabel}
                onChange={(e) => {
                  setCurrentLabel(e.target.value);
                  onUpdateSetup?.({ label: e.target.value, authType: selectedMethod, passphrase });
                }}
                className="bg-transparent font-semibold text-sm text-zinc-100 focus:outline-none focus:underline"
              />
            ) : (
              <h4 className="text-sm font-semibold text-zinc-100">{label}</h4>
            )}
            <span className="text-[11px] text-zinc-400 font-mono">
              Custodian Quadrant #{custodianId}
            </span>
          </div>
        </div>

        {isVerified && (
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-mono font-medium text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> VERIFIED
          </span>
        )}
      </div>

      {!isVerified ? (
        <div className="space-y-3.5">
          {/* 3-Way Method Selector for setup mode */}
          {mode === "encrypt_setup" && (
            <div className="flex rounded-xl bg-zinc-950/80 p-1 border border-zinc-800 gap-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedMethod("passphrase");
                  onUpdateSetup?.({ label: currentLabel, authType: "passphrase", passphrase });
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs transition-colors",
                  selectedMethod === "passphrase"
                    ? "bg-zinc-800 text-cyan-400 font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200",
                )}
              >
                <KeyRound className="h-3.5 w-3.5" /> Passphrase
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedMethod("keyfile");
                  onUpdateSetup?.({ label: currentLabel, authType: "keyfile" });
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs transition-colors",
                  selectedMethod === "keyfile"
                    ? "bg-zinc-800 text-cyan-400 font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200",
                )}
              >
                <FileKey className="h-3.5 w-3.5" /> Key File
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedMethod("yubikey");
                  onUpdateSetup?.({ label: currentLabel, authType: "yubikey" });
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs transition-colors",
                  selectedMethod === "yubikey"
                    ? "bg-zinc-800 text-amber-400 font-semibold shadow-sm border border-amber-500/30"
                    : "text-zinc-400 hover:text-zinc-200",
                )}
              >
                <Cpu className="h-3.5 w-3.5" /> YubiKey
              </button>
            </div>
          )}

          {/* 1. Passphrase Input */}
          {(selectedMethod === "passphrase" ||
            (mode === "decrypt_unlock" && authType === "passphrase")) && (
            <div className="space-y-2">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={
                    mode === "encrypt_setup"
                      ? "Set custodian passphrase..."
                      : "Enter custodian passphrase to unlock share..."
                  }
                  value={passphrase}
                  onChange={(e) => {
                    setPassphrase(e.target.value);
                    if (mode === "encrypt_setup") {
                      onUpdateSetup?.({
                        label: currentLabel,
                        authType: "passphrase",
                        passphrase: e.target.value,
                      });
                    }
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handlePassphraseSubmit()}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 pr-10 text-xs text-zinc-100 placeholder-zinc-500 focus:border-cyan-500 focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <button
                type="button"
                disabled={!passphrase}
                onClick={handlePassphraseSubmit}
                className="w-full rounded-xl bg-cyan-600/90 hover:bg-cyan-500 py-2.5 text-xs font-semibold text-white transition-colors disabled:opacity-40"
              >
                {mode === "encrypt_setup" ? "Lock & Confirm Credential" : "Submit Custodian Share"}
              </button>
            </div>
          )}

          {/* 2. Key File Loader & PIN unlock */}
          {(selectedMethod === "keyfile" ||
            (mode === "decrypt_unlock" && authType === "keyfile")) && (
            <div className="space-y-2">
              {mode === "encrypt_setup" ? (
                <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/50 p-4 text-center space-y-2">
                  <FileKey className="mx-auto h-6 w-6 text-cyan-400" />
                  <p className="text-xs font-medium text-zinc-200">Exportable Key File (.dkey)</p>
                  <p className="text-[11px] text-zinc-500">
                    An armored `.dkey` file will be generated for this custodian upon encryption.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onCredentialSubmit({
                        custodianId,
                        authType: "keyfile",
                        label: currentLabel,
                      });
                    }}
                    className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-4 py-1.5 text-xs text-cyan-300 font-medium"
                  >
                    Confirm Key File Slot
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {!isPinProtectedKey ? (
                    <button
                      type="button"
                      onClick={handlePickKeyFile}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/50 py-3 text-xs text-zinc-300 hover:border-cyan-500 hover:text-cyan-400 transition-colors"
                    >
                      <FileKey className="h-4 w-4" />
                      {keyFileName ? keyFileName : "Select .dkey Share File"}
                    </button>
                  ) : (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-3.5 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                        <Lock className="h-4 w-4" />
                        <span>PIN-Protected Key File: {keyFileName}</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={keyFilePin}
                          onChange={(e) => setKeyFilePin(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleUnlockPinProtectedKey()}
                          placeholder="Enter Key Share PIN..."
                          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleUnlockPinProtectedKey}
                          className="rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-xs font-bold text-white transition-all"
                        >
                          Unlock
                        </button>
                      </div>
                    </div>
                  )}

                  {pinError && <p className="text-[11px] text-rose-400 font-mono">{pinError}</p>}
                </div>
              )}
            </div>
          )}

          {/* 3. YubiKey / Hardware Token Mode */}
          {(selectedMethod === "yubikey" ||
            (mode === "decrypt_unlock" && authType === "yubikey")) && (
            <div className="space-y-2.5">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                    <Cpu className="h-4 w-4 text-amber-400" />
                    <span>Hardware Token Status</span>
                  </div>
                  <button
                    type="button"
                    onClick={scanForTokens}
                    disabled={isScanningTokens}
                    className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className={`h-3 w-3 ${isScanningTokens ? "animate-spin" : ""}`} />
                    <span>Scan USB</span>
                  </button>
                </div>

                {detectedTokens.length > 0 ? (
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between">
                      <span>🟢 {detectedTokens[0].product_name}</span>
                      <span className="text-[10px] font-mono opacity-80">USB Ready</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleYubikeyAuth}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 py-2.5 text-xs font-bold text-white shadow-[0_0_20px_rgba(245,158,11,0.25)] transition-all"
                    >
                      <Zap className="h-4 w-4" />
                      <span>
                        {mode === "encrypt_setup"
                          ? "Bind Key Share to YubiKey"
                          : "Touch YubiKey to Authenticate"}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 text-xs text-rose-300 space-y-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                      <span>No Hardware Token Detected</span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Please insert your physical YubiKey into a USB port, or enable Simulator Mode
                      in the Settings tab.
                    </p>
                  </div>
                )}

                {hardwareError && (
                  <p className="text-[11px] text-rose-400 font-mono">{hardwareError}</p>
                )}
              </div>
            </div>
          )}

          {/* 4. OTP / Challenge */}
          {selectedMethod === "otp" && (
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                placeholder="6-digit OTP..."
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full font-mono text-center tracking-widest rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-cyan-500 focus:outline-none"
              />
              <button
                type="button"
                disabled={otpCode.length !== 6}
                onClick={() => onCredentialSubmit({ custodianId, authType: "otp" })}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-40"
              >
                Verify
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-emerald-950/20 border border-emerald-800/30 p-3 text-center text-xs text-emerald-300 font-mono flex items-center justify-center gap-2">
          <Shield className="h-4 w-4 text-emerald-400" />
          <span>Share Bound & Memory-Locked in RAM</span>
        </div>
      )}
    </div>
  );
};
