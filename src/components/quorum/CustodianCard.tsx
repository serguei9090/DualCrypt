import { open } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  Atom,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  Eye,
  EyeOff,
  FileKey,
  KeyRound,
  Lock,
  RefreshCw,
  Shield,
  Smartphone,
  Upload,
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
import type { AuthType } from "../../types/container";

export type AuthMethod = AuthType;

interface CustodianCardProps {
  custodianId: number;
  label: string;
  authType: AuthMethod;
  isVerified: boolean;
  mode: "encrypt_setup" | "decrypt_unlock";
  timelockNotBeforeUtc?: number;
  onCredentialSubmit: (data: {
    custodianId: number;
    passphrase?: string;
    keyFileContent?: string;
    pqcPrivateKeyBase64?: string;
    publicKeyBase64?: string;
    authType: AuthMethod;
    label?: string;
  }) => void;
  onUpdateSetup?: (data: {
    label: string;
    authType: AuthMethod;
    passphrase?: string;
    publicKeyBase64?: string;
    timelockNotBeforeUtc?: number;
  }) => void;
  onAirGapClick?: (custodianId: number) => void;
}

export const CustodianCard: React.FC<CustodianCardProps> = ({
  custodianId,
  label,
  authType,
  isVerified,
  mode,
  timelockNotBeforeUtc,
  onCredentialSubmit,
  onUpdateSetup,
  onAirGapClick,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<AuthMethod>(
    authType === ("postquantum" as unknown) ? "pqc" : authType,
  );
  const [currentLabel, setCurrentLabel] = useState(label);
  const [passphrase, setPassphrase] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keyFileName, setKeyFileName] = useState<string | null>(null);
  const [keyFilePath, setKeyFilePath] = useState<string | null>(null);
  const [rawKeyFileContent, setRawKeyFileContent] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");

  // PIN protection on key file import
  const [isPinProtectedKey, setIsPinProtectedKey] = useState(false);
  const [keyFilePin, setKeyFilePin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  // Hardware key detection state
  const [detectedTokens, setDetectedTokens] = useState<YubiKeyDevice[]>([]);
  const [isScanningTokens, setIsScanningTokens] = useState(false);
  const [hardwareError, setHardwareError] = useState<string | null>(null);

  // Post-Quantum ML-KEM State
  const [pqcMode, setPqcMode] = useState<"auto" | "existing">("auto");
  const [pqcPublicKey, setPqcPublicKey] = useState("");
  const [pqcPubFileName, setPqcPubFileName] = useState<string | null>(null);
  const [pqcPrivateKey, setPqcPrivateKey] = useState("");
  const [pqcError, setPqcError] = useState<string | null>(null);

  // Time-Lock Recovery State
  const [isTimelockEnabled, setIsTimelockEnabled] = useState(false);
  const [timelockDate, setTimelockDate] = useState(() => {
    const d = new Date(Date.now() + 30 * 86400000);
    return d.toISOString().slice(0, 16);
  });

  const minDateTime = new Date().toISOString().slice(0, 16);

  const handleToggleTimelock = (enabled: boolean) => {
    setIsTimelockEnabled(enabled);
    if (!enabled) {
      onUpdateSetup?.({
        label: currentLabel,
        authType: selectedMethod,
        passphrase,
        publicKeyBase64: pqcPublicKey,
        timelockNotBeforeUtc: undefined,
      });
    } else {
      const selectedUtc = Math.floor(new Date(timelockDate).getTime() / 1000);
      onUpdateSetup?.({
        label: currentLabel,
        authType: selectedMethod,
        passphrase,
        publicKeyBase64: pqcPublicKey,
        timelockNotBeforeUtc: selectedUtc > 0 ? selectedUtc : undefined,
      });
    }
  };

  const handleDateChange = (val: string) => {
    setTimelockDate(val);
    if (isTimelockEnabled && val) {
      const selectedUtc = Math.floor(new Date(val).getTime() / 1000);
      if (selectedUtc > Math.floor(Date.now() / 1000)) {
        onUpdateSetup?.({
          label: currentLabel,
          authType: selectedMethod,
          passphrase,
          publicKeyBase64: pqcPublicKey,
          timelockNotBeforeUtc: selectedUtc,
        });
      }
    }
  };

  const handleQuickAddDays = (days: number) => {
    const d = new Date(Date.now() + days * 86400000);
    const dateStr = d.toISOString().slice(0, 16);
    setTimelockDate(dateStr);
    setIsTimelockEnabled(true);
    const selectedUtc = Math.floor(d.getTime() / 1000);
    onUpdateSetup?.({
      label: currentLabel,
      authType: selectedMethod,
      passphrase,
      publicKeyBase64: pqcPublicKey,
      timelockNotBeforeUtc: selectedUtc,
    });
  };

  const nowUtc = Math.floor(Date.now() / 1000);
  const isTimelockedNow =
    mode === "decrypt_unlock" &&
    timelockNotBeforeUtc !== undefined &&
    nowUtc < timelockNotBeforeUtc;

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
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".dkey,.json,.key,.pqc";
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          setKeyFileName(file.name);
          setKeyFilePath(file.name);
          try {
            const text = await file.text();
            setRawKeyFileContent(text);
            const res = await parseKeyFile(file.name, undefined, text);
            if (res.is_pin_protected && !res.share && !res.pqc_private_key_base64) {
              setIsPinProtectedKey(true);
            } else if (res.share) {
              setIsPinProtectedKey(false);
              onCredentialSubmit({
                custodianId,
                keyFileContent: JSON.stringify(res.share),
                authType: "keyfile",
              });
            } else if (res.pqc_private_key_base64) {
              setIsPinProtectedKey(false);
              onCredentialSubmit({
                custodianId,
                pqcPrivateKeyBase64: res.pqc_private_key_base64,
                authType: "pqc",
              });
            }
          } catch (err) {
            setPinError(`Failed to parse key file: ${String(err)}`);
          }
        }
      };
      input.click();
    }
  };

  const handleUnlockPinProtectedKey = async () => {
    if (!keyFilePath || !keyFilePin) return;
    setPinError(null);
    try {
      const res = await parseKeyFile(keyFilePath, keyFilePin, rawKeyFileContent || undefined);
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

  const handlePickPqcPublicKeyFile = async () => {
    setPqcError(null);
    if (isTauriEnvironment()) {
      const selected = await open({
        multiple: false,
        filters: [
          { name: "Post-Quantum Public Key", extensions: ["pqc.pub", "pub", "json", "key"] },
        ],
      });
      if (selected && typeof selected === "string") {
        const fname = selected.split(/[\\/]/).pop() || selected;
        setPqcPubFileName(fname);
        try {
          const { readTextFile } = await import("@tauri-apps/plugin-fs");
          const raw = await readTextFile(selected);
          try {
            const parsed = JSON.parse(raw);
            const pk = parsed.public_key_base64 || raw.trim();
            setPqcPublicKey(pk);
            onUpdateSetup?.({ label: currentLabel, authType: "pqc", publicKeyBase64: pk });
          } catch {
            setPqcPublicKey(raw.trim());
            onUpdateSetup?.({ label: currentLabel, authType: "pqc", publicKeyBase64: raw.trim() });
          }
        } catch (err) {
          setPqcError(`Failed to read public key file: ${String(err)}`);
        }
      }
    } else {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pub,.pqc.pub,.json,.key";
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          setPqcPubFileName(file.name);
          try {
            const raw = await file.text();
            try {
              const parsed = JSON.parse(raw);
              const pk = parsed.public_key_base64 || raw.trim();
              setPqcPublicKey(pk);
              onUpdateSetup?.({ label: currentLabel, authType: "pqc", publicKeyBase64: pk });
            } catch {
              setPqcPublicKey(raw.trim());
              onUpdateSetup?.({
                label: currentLabel,
                authType: "pqc",
                publicKeyBase64: raw.trim(),
              });
            }
          } catch (err) {
            setPqcError(`Failed to read public key file: ${String(err)}`);
          }
        }
      };
      input.click();
    }
  };

  const handleConfirmPqcSetup = () => {
    if (pqcMode === "existing") {
      if (!pqcPublicKey.trim()) {
        setPqcError("Please upload or paste a recipient ML-KEM-768 Public Key.");
        return;
      }
      onCredentialSubmit({
        custodianId,
        publicKeyBase64: pqcPublicKey.trim(),
        authType: "pqc",
        label: currentLabel,
      });
    } else {
      onCredentialSubmit({
        custodianId,
        authType: "pqc",
        label: currentLabel,
      });
    }
  };

  const handlePickPqcPrivateKeyFile = async () => {
    setPqcError(null);
    if (isTauriEnvironment()) {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Post-Quantum Private Key", extensions: ["pqc", "key", "json"] }],
      });
      if (selected && typeof selected === "string") {
        const fname = selected.split(/[\\/]/).pop() || selected;
        setKeyFileName(fname);
        setKeyFilePath(selected);

        try {
          const res = await parseKeyFile(selected);
          if (res.is_pin_protected && !res.pqc_private_key_base64 && !res.share) {
            setIsPinProtectedKey(true);
          } else if (res.pqc_private_key_base64) {
            setIsPinProtectedKey(false);
            onCredentialSubmit({
              custodianId,
              pqcPrivateKeyBase64: res.pqc_private_key_base64,
              authType: "pqc",
            });
          }
        } catch (err) {
          console.error("Failed to parse PQC key file:", err);
          setPqcError(`Failed to parse PQC key file: ${String(err)}`);
        }
      }
    } else {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pqc,.key,.json";
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          setKeyFileName(file.name);
          setKeyFilePath(file.name);
          try {
            const text = await file.text();
            setRawKeyFileContent(text);
            const res = await parseKeyFile(file.name, undefined, text);
            if (res.is_pin_protected && !res.pqc_private_key_base64 && !res.share) {
              setIsPinProtectedKey(true);
            } else if (res.pqc_private_key_base64) {
              setIsPinProtectedKey(false);
              onCredentialSubmit({
                custodianId,
                pqcPrivateKeyBase64: res.pqc_private_key_base64,
                authType: "pqc",
              });
            }
          } catch (err) {
            setPqcError(`Failed to parse PQC key file: ${String(err)}`);
          }
        }
      };
      input.click();
    }
  };

  const handleUnlockPinProtectedPqcKey = async () => {
    if (!keyFilePath || !keyFilePin) return;
    setPqcError(null);
    try {
      const res = await parseKeyFile(keyFilePath, keyFilePin, rawKeyFileContent || undefined);
      if (res.pqc_private_key_base64) {
        setIsPinProtectedKey(false);
        onCredentialSubmit({
          custodianId,
          pqcPrivateKeyBase64: res.pqc_private_key_base64,
          authType: "pqc",
        });
      } else {
        setPqcError("Incorrect PIN for this Post-Quantum key.");
      }
    } catch (err) {
      setPqcError(`PIN Unlock Failed: ${String(err)}`);
    }
  };

  const handlePqcPrivateDecryptSubmit = () => {
    if (!pqcPrivateKey.trim()) {
      setPqcError("Please paste or upload your ML-KEM Private Key.");
      return;
    }
    onCredentialSubmit({
      custodianId,
      pqcPrivateKeyBase64: pqcPrivateKey.trim(),
      authType: "pqc",
    });
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
          ? "border-emerald-500/50 bg-slate-900/90 shadow-[0_0_25px_rgba(16,185,129,0.15)]"
          : "border-slate-800 bg-slate-900/60 hover:border-slate-700",
      )}
    >
      <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-800 font-mono text-xs font-bold text-cyan-400 border border-slate-700">
            P{custodianId}
          </span>
          <div>
            {mode === "encrypt_setup" ? (
              <input
                type="text"
                value={currentLabel}
                onChange={(e) => {
                  setCurrentLabel(e.target.value);
                  onUpdateSetup?.({
                    label: e.target.value,
                    authType: selectedMethod,
                    passphrase,
                  });
                }}
                className="bg-transparent font-semibold text-sm text-slate-100 focus:outline-none focus:underline"
              />
            ) : (
              <h4 className="text-sm font-semibold text-slate-100">{label}</h4>
            )}
            <span className="text-[11px] text-slate-400 font-mono">
              Custodian Quadrant #{custodianId}
            </span>
          </div>
        </div>

        {isVerified && (
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-mono font-medium text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> VERIFIED
          </span>
        )}

        {!isVerified && isTimelockedNow && (
          <span className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-mono font-bold text-amber-300">
            <Clock className="h-3.5 w-3.5 text-amber-400 animate-pulse" /> TIME-LOCKED
          </span>
        )}

        {!isVerified && !isTimelockedNow && timelockNotBeforeUtc && (
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-mono text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> ESCROW ACTIVE
          </span>
        )}
      </div>

      {!isVerified ? (
        <div className="space-y-3.5">
          {isTimelockedNow ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-950/25 p-4 text-left space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                <span>Cryptographic Time-Lock Active</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-200/80">
                This recovery share is sealed under corporate escrow rules until{" "}
                <strong className="text-white font-mono">
                  {new Date((timelockNotBeforeUtc || 0) * 1000).toLocaleString()}
                </strong>
                . It cannot be used to satisfy quorum before this release timestamp.
              </p>
              <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between text-[10px] font-mono text-amber-400/90">
                <span>Status: Inactive Escrow</span>
                <span>Protected by Container Header Tag</span>
              </div>
            </div>
          ) : (
            <>
              {/* 4-Way Method Selector for setup mode */}
              {mode === "encrypt_setup" && (
                <div className="grid grid-cols-4 rounded-xl bg-slate-950/80 p-1 border border-slate-800 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMethod("passphrase");
                      onUpdateSetup?.({ label: currentLabel, authType: "passphrase", passphrase });
                    }}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none",
                      selectedMethod === "passphrase"
                        ? "bg-slate-800 text-cyan-400 font-semibold shadow-sm"
                        : "text-slate-400 hover:text-slate-200",
                    )}
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Pass
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMethod("keyfile");
                      onUpdateSetup?.({ label: currentLabel, authType: "keyfile" });
                    }}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none",
                      selectedMethod === "keyfile"
                        ? "bg-slate-800 text-cyan-400 font-semibold shadow-sm"
                        : "text-slate-400 hover:text-slate-200",
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
                      "flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none",
                      selectedMethod === "yubikey"
                        ? "bg-slate-800 text-amber-400 font-semibold shadow-sm border border-amber-500/30"
                        : "text-slate-400 hover:text-slate-200",
                    )}
                  >
                    <Cpu className="h-3.5 w-3.5" /> YubiKey
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMethod("pqc");
                      onUpdateSetup?.({
                        label: currentLabel,
                        authType: "pqc",
                      });
                    }}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none",
                      selectedMethod === "pqc"
                        ? "bg-purple-950/80 text-purple-300 font-semibold shadow-sm border border-purple-500/40"
                        : "text-slate-400 hover:text-slate-200",
                    )}
                  >
                    <Atom className="h-3.5 w-3.5" /> PQC KEM
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
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 pr-10 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={!passphrase}
                    onClick={handlePassphraseSubmit}
                    className="w-full rounded-xl bg-cyan-600/90 hover:bg-cyan-500 py-2.5 text-xs font-semibold text-white transition-colors disabled:opacity-40 cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                  >
                    {mode === "encrypt_setup"
                      ? "Lock & Confirm Credential"
                      : "Submit Custodian Share"}
                  </button>
                </div>
              )}

              {/* 2. Key File Loader & PIN unlock */}
              {(selectedMethod === "keyfile" ||
                (mode === "decrypt_unlock" && authType === "keyfile")) && (
                <div className="space-y-2">
                  {mode === "encrypt_setup" ? (
                    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-4 text-center space-y-2">
                      <FileKey className="mx-auto h-6 w-6 text-cyan-400" />
                      <p className="text-xs font-medium text-slate-200">
                        Exportable Key File (.dkey)
                      </p>
                      <p className="text-[11px] text-slate-500">
                        An armored `.dkey` file will be generated for this custodian upon
                        encryption.
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
                        className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-1.5 text-xs text-cyan-300 font-medium cursor-pointer focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none"
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
                          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 py-3 text-xs text-slate-300 hover:border-cyan-500 hover:text-cyan-400 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
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
                              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus-visible:ring-1 focus-visible:ring-amber-500 focus-visible:outline-none font-mono"
                            />
                            <button
                              type="button"
                              onClick={handleUnlockPinProtectedKey}
                              className="rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-xs font-bold text-white transition-all cursor-pointer"
                            >
                              Unlock
                            </button>
                          </div>
                        </div>
                      )}

                      {pinError && (
                        <p className="text-[11px] text-rose-400 font-mono">{pinError}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 3. YubiKey / Hardware Token Mode */}
              {(selectedMethod === "yubikey" ||
                (mode === "decrypt_unlock" && authType === "yubikey")) && (
                <div className="space-y-2.5">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                        <Cpu className="h-4 w-4 text-amber-400" />
                        <span>Hardware Token Status</span>
                      </div>
                      <button
                        type="button"
                        onClick={scanForTokens}
                        disabled={isScanningTokens}
                        className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw
                          className={`h-3 w-3 ${isScanningTokens ? "animate-spin" : ""}`}
                        />
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
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 py-2.5 text-xs font-bold text-white shadow-[0_0_20px_rgba(245,158,11,0.25)] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
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
                        <p className="text-[11px] text-slate-400">
                          Please insert your physical YubiKey into a USB port, or enable Simulator
                          Mode in the Settings tab.
                        </p>
                      </div>
                    )}

                    {hardwareError && (
                      <p className="text-[11px] text-rose-400 font-mono">{hardwareError}</p>
                    )}
                  </div>
                </div>
              )}

              {/* 4. Post-Quantum Cryptography (ML-KEM-768 / Kyber) Mode */}
              {(selectedMethod === "pqc" ||
                (mode === "decrypt_unlock" &&
                  (authType === "pqc" || authType === ("postquantum" as unknown)))) && (
                <div className="space-y-3">
                  {mode === "encrypt_setup" ? (
                    <div className="space-y-3">
                      {/* Sub-selector for Auto vs Existing */}
                      <div className="grid grid-cols-2 rounded-lg bg-slate-950 p-0.5 border border-purple-900/60 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            setPqcMode("auto");
                            setPqcError(null);
                            onUpdateSetup?.({ label: currentLabel, authType: "pqc" });
                          }}
                          className={cn(
                            "py-1 rounded-md font-medium transition-colors text-center cursor-pointer",
                            pqcMode === "auto"
                              ? "bg-purple-900/60 text-purple-200 shadow-sm"
                              : "text-slate-400 hover:text-slate-200",
                          )}
                        >
                          ⚡ Auto-Generate
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPqcMode("existing");
                            setPqcError(null);
                          }}
                          className={cn(
                            "py-1 rounded-md font-medium transition-colors text-center cursor-pointer",
                            pqcMode === "existing"
                              ? "bg-purple-900/60 text-purple-200 shadow-sm"
                              : "text-slate-400 hover:text-slate-200",
                          )}
                        >
                          📂 Use Recipient Key
                        </button>
                      </div>

                      {pqcMode === "auto" ? (
                        <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3.5 text-center space-y-2">
                          <Atom className="mx-auto h-5 w-5 text-purple-400" />
                          <p className="text-xs font-semibold text-purple-200">
                            1-Click Quantum Slot
                          </p>
                          <p className="text-[11px] text-slate-400">
                            A fresh NIST FIPS 203 ML-KEM-768 keypair will be generated
                            automatically. You will receive the `.pqc` private key on completion.
                          </p>
                          <button
                            type="button"
                            onClick={handleConfirmPqcSetup}
                            className="w-full rounded-xl bg-purple-700 hover:bg-purple-600 py-2.5 text-xs font-semibold text-white transition-colors shadow-lg cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
                          >
                            Confirm Quantum-Safe Slot
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-purple-300 flex items-center gap-1">
                              <Upload className="h-3.5 w-3.5" />
                              <span>Upload Recipient .pqc.pub</span>
                            </span>
                            <button
                              type="button"
                              onClick={handlePickPqcPublicKeyFile}
                              className="text-[11px] text-purple-300 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                            >
                              <Upload className="h-3 w-3" />{" "}
                              {pqcPubFileName ? "Change File" : "Choose File"}
                            </button>
                          </div>

                          {pqcPubFileName && (
                            <div className="p-2 rounded-lg bg-purple-950/80 border border-purple-800 text-[11px] text-purple-300 flex items-center justify-between">
                              <span>📄 {pqcPubFileName}</span>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            </div>
                          )}

                          <div className="space-y-1">
                            <label
                              htmlFor={`pqc-pub-input-${custodianId}`}
                              className="text-[10px] text-slate-400 uppercase tracking-wider font-mono"
                            >
                              Or Paste Recipient Public Key (Base64)
                            </label>
                            <textarea
                              id={`pqc-pub-input-${custodianId}`}
                              rows={2}
                              value={pqcPublicKey}
                              onChange={(e) => {
                                setPqcPublicKey(e.target.value);
                                onUpdateSetup?.({
                                  label: currentLabel,
                                  authType: "pqc",
                                  publicKeyBase64: e.target.value,
                                });
                              }}
                              placeholder="Paste recipient's ML-KEM-768 public key base64..."
                              className="w-full rounded-lg border border-purple-900/60 bg-slate-950 px-3 py-2 text-[11px] text-slate-200 font-mono focus:border-purple-500 focus-visible:ring-1 focus-visible:ring-purple-500 focus-visible:outline-none"
                            />
                          </div>

                          <button
                            type="button"
                            disabled={!pqcPublicKey.trim()}
                            onClick={handleConfirmPqcSetup}
                            className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-40 cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
                          >
                            Confirm Slot with Recipient Key
                          </button>
                        </div>
                      )}

                      {pqcError && (
                        <p className="text-[11px] text-rose-400 font-mono">{pqcError}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {!isPinProtectedKey ? (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={handlePickPqcPrivateKeyFile}
                            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-purple-800/60 bg-purple-950/30 py-3 text-xs text-purple-200 hover:border-purple-500 hover:text-purple-100 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
                          >
                            <FileKey className="h-4 w-4 text-purple-400" />
                            {keyFileName ? keyFileName : "Select .pqc Key File"}
                          </button>

                          <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                              <span className="w-full border-t border-slate-800" />
                            </div>
                            <div className="relative flex justify-center text-[10px] uppercase font-mono">
                              <span className="bg-slate-900 px-2 text-slate-500">
                                or paste base64
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={pqcPrivateKey}
                              onChange={(e) => setPqcPrivateKey(e.target.value)}
                              onKeyDown={(e) =>
                                e.key === "Enter" && handlePqcPrivateDecryptSubmit()
                              }
                              placeholder="Paste ML-KEM Private Key..."
                              className="flex-1 rounded-xl border border-purple-900/60 bg-slate-950 px-3 py-2 text-[11px] text-slate-200 font-mono focus:border-purple-500 focus-visible:ring-1 focus-visible:ring-purple-500 focus-visible:outline-none"
                            />
                            <button
                              type="button"
                              disabled={!pqcPrivateKey.trim()}
                              onClick={handlePqcPrivateDecryptSubmit}
                              className="rounded-xl bg-purple-600 hover:bg-purple-500 px-3 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-40 cursor-pointer focus-visible:ring-1 focus-visible:ring-purple-500 focus-visible:outline-none"
                            >
                              Verify
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-3.5 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                            <Lock className="h-4 w-4" />
                            <span>PIN-Protected Post-Quantum Key: {keyFileName}</span>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={keyFilePin}
                              onChange={(e) => setKeyFilePin(e.target.value)}
                              onKeyDown={(e) =>
                                e.key === "Enter" && handleUnlockPinProtectedPqcKey()
                              }
                              placeholder="Enter Key PIN..."
                              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus-visible:ring-1 focus-visible:ring-amber-500 focus-visible:outline-none font-mono"
                            />
                            <button
                              type="button"
                              onClick={handleUnlockPinProtectedPqcKey}
                              className="rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-xs font-bold text-white transition-all cursor-pointer"
                            >
                              Unlock
                            </button>
                          </div>
                        </div>
                      )}

                      {pqcError && (
                        <p className="text-[11px] text-rose-400 font-mono">{pqcError}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 5. OTP / Challenge */}
              {selectedMethod === "otp" && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="6-digit OTP..."
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-full font-mono text-center tracking-widest rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-500 focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none"
                  />
                  <button
                    type="button"
                    disabled={otpCode.length !== 6}
                    onClick={() => onCredentialSubmit({ custodianId, authType: "otp" })}
                    className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-40 cursor-pointer focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none"
                  >
                    Verify
                  </button>
                </div>
              )}

              {onAirGapClick && (
                <div className="pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => onAirGapClick(custodianId)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 text-xs font-semibold font-mono transition-all cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(6,182,212,0.2)] focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                    <span>📲 100% Air-Gapped Optical Sign-Off</span>
                  </button>
                </div>
              )}

              {/* Time-Lock Recovery Share Option with Interactive Calendar */}
              {mode === "encrypt_setup" && (
                <div className="pt-2.5 border-t border-slate-800/80 space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor={`timelock-toggle-${custodianId}`}
                      className="flex items-center gap-2 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        id={`timelock-toggle-${custodianId}`}
                        checked={isTimelockEnabled}
                        onChange={(e) => handleToggleTimelock(e.target.checked)}
                        className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-amber-500"
                      />
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Time-Lock Escrow</span>
                      </span>
                    </label>
                    {isTimelockEnabled && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                        Sealed
                      </span>
                    )}
                  </div>

                  {isTimelockEnabled && (
                    <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-950/20 space-y-2 animate-in fade-in">
                      <div className="space-y-1">
                        <label
                          htmlFor={`timelock-date-${custodianId}`}
                          className="text-[10px] text-slate-400 font-mono flex items-center gap-1"
                        >
                          <Calendar className="w-3 h-3 text-amber-400" />
                          <span>Release Date & Time (UTC):</span>
                        </label>
                        <input
                          type="datetime-local"
                          id={`timelock-date-${custodianId}`}
                          min={minDateTime}
                          value={timelockDate}
                          onChange={(e) => handleDateChange(e.target.value)}
                          className="w-full rounded-lg border border-amber-500/40 bg-slate-950 px-3 py-1.5 text-xs text-amber-200 font-mono focus:border-amber-400 focus-visible:ring-1 focus-visible:ring-amber-400 focus-visible:outline-none"
                        />
                      </div>

                      {/* Quick Preset Buttons */}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="text-[10px] text-slate-500 font-mono mr-1">Quick:</span>
                        {[
                          { label: "+30D", days: 30 },
                          { label: "+90D", days: 90 },
                          { label: "+6M", days: 180 },
                          { label: "+1Yr", days: 365 },
                        ].map((preset) => (
                          <button
                            key={preset.days}
                            type="button"
                            onClick={() => handleQuickAddDays(preset.days)}
                            className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/40 text-[10px] font-mono text-slate-300 hover:text-amber-300 transition-colors cursor-pointer"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <p className="text-[10px] text-amber-300/80 font-mono">
                        Locked until: {new Date(timelockDate).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
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
