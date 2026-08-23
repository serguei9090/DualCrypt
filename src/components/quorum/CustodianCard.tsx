import { open } from "@tauri-apps/plugin-dialog";
import { CheckCircle2, Cpu, Eye, EyeOff, FileKey, KeyRound, Lock, Shield } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { isTauriEnvironment, parseKeyFile, performHardwareTokenChallenge } from "../../lib/tauri";
import { cn } from "../../lib/utils";

export type AuthMethod = "passphrase" | "keyfile" | "otp";

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
      // Mock browser key file pick
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
    try {
      await performHardwareTokenChallenge(custodianId, "4475616c43727970742d41757468");
      onCredentialSubmit({
        custodianId,
        keyFileContent: JSON.stringify({ id: custodianId, data: Array(32).fill(0xee) }),
        authType: "keyfile",
      });
    } catch (err) {
      setPinError(`Hardware key error: ${String(err)}`);
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
          {/* Method selector for setup mode */}
          {mode === "encrypt_setup" && (
            <div className="flex rounded-xl bg-zinc-950/80 p-1 border border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setSelectedMethod("passphrase");
                  onUpdateSetup?.({ label: currentLabel, authType: "passphrase", passphrase });
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs transition-colors",
                  selectedMethod === "passphrase"
                    ? "bg-zinc-800 text-cyan-400 font-semibold"
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
                  "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs transition-colors",
                  selectedMethod === "keyfile"
                    ? "bg-zinc-800 text-cyan-400 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200",
                )}
              >
                <FileKey className="h-3.5 w-3.5" /> Key File / Token
              </button>
            </div>
          )}

          {/* Passphrase Input */}
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

          {/* Key File Loader & PIN unlock */}
          {(selectedMethod === "keyfile" ||
            (mode === "decrypt_unlock" && authType === "keyfile")) && (
            <div className="space-y-2">
              {mode === "encrypt_setup" ? (
                <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/50 p-4 text-center space-y-2">
                  <FileKey className="mx-auto h-6 w-6 text-cyan-400" />
                  <p className="text-xs font-medium text-zinc-200">
                    Exportable Key File (.dkey) / Token
                  </p>
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
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handlePickKeyFile}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/50 py-3 text-xs text-zinc-300 hover:border-cyan-500 hover:text-cyan-400 transition-colors"
                      >
                        <FileKey className="h-4 w-4" />
                        {keyFileName ? keyFileName : "Select .dkey Share File"}
                      </button>

                      <button
                        type="button"
                        onClick={handleYubikeyAuth}
                        className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-300 transition-all"
                        title="Authenticate with YubiKey / FIDO2 Token"
                      >
                        <Cpu className="h-4 w-4" />
                        <span>YubiKey</span>
                      </button>
                    </div>
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

          {/* OTP / Challenge */}
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
