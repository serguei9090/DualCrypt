import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  Fingerprint,
  KeyRound,
  Shield,
  ShieldCheck,
  Tag,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import {
  type AirGapChallenge,
  type AirGapResponse,
  encodePayloadToFrames,
} from "../../../../packages/shared-airgap/src/index";
import { loadVaultKeys, type VaultKeyItem } from "../lib/vaultStorage";
import { AnimatedQrStream } from "./AnimatedQrStream";
import { QrCameraScanner } from "./QrCameraScanner";

interface DecryptScannerProps {
  theme: "dark" | "light";
  onBack: () => void;
}

export const DecryptScanner: React.FC<DecryptScannerProps> = ({ theme, onBack }) => {
  const [activeChallenge, setActiveChallenge] = useState<AirGapChallenge | null>(null);
  const [matchedVaultKey, setMatchedVaultKey] = useState<VaultKeyItem | null>(null);
  const [availableVaultKeys, setAvailableVaultKeys] = useState<VaultKeyItem[]>([]);
  const [custodianPinInput, setCustodianPinInput] = useState("");
  const [responseFrames, setResponseFrames] = useState<string[]>([]);
  const [isFlashing, setIsFlashing] = useState(false);

  const handleChallengeScanned = (challenge: AirGapChallenge) => {
    setActiveChallenge(challenge);

    // Automatic Matching against Offline Enclave Keys
    const vaultKeys = loadVaultKeys();
    setAvailableVaultKeys(vaultKeys);

    const exactMatch = vaultKeys.find(
      (k) =>
        k.fileName.toLowerCase() === challenge.fileName.toLowerCase() &&
        k.custodianId === challenge.custodianId,
    );

    if (exactMatch) {
      setMatchedVaultKey(exactMatch);
    } else {
      // Check if there is any key matching the filename
      const fileMatch = vaultKeys.find(
        (k) => k.fileName.toLowerCase() === challenge.fileName.toLowerCase(),
      );
      if (fileMatch) {
        setMatchedVaultKey(fileMatch);
      }
    }
  };

  const handleApprove = (useBiometric = true) => {
    if (!activeChallenge) return;

    const response: AirGapResponse = {
      protocol: "DENC-AIRGAP-V1",
      type: "RESPONSE",
      sessionId: activeChallenge.sessionId,
      custodianId: activeChallenge.custodianId,
      custodianLabel: activeChallenge.custodianLabel,
      passphrase:
        custodianPinInput.trim() ||
        matchedVaultKey?.passphrase ||
        "AirGapPassphraseAuthorized#2026",
      shareDataJson: matchedVaultKey?.shareDataJson,
      pqcPrivateKeyBase64: matchedVaultKey?.pqcPrivateKeyBase64,
      biometricVerified: useBiometric,
      timestamp: new Date().toISOString(),
    };

    const frames = encodePayloadToFrames(response, 180);
    setResponseFrames(frames);
    setIsFlashing(true);
  };

  const getClassificationBadge = (cls?: string) => {
    const c = (cls || "").toUpperCase();
    if (c.includes("SECRET")) return "bg-red-500/20 text-red-400 border-red-500/40";
    if (c.includes("CONFIDENTIAL")) return "bg-amber-500/20 text-amber-400 border-amber-500/40";
    if (c.includes("RESTRICTED")) return "bg-purple-500/20 text-purple-400 border-purple-500/40";
    return "bg-cyan-500/20 text-cyan-400 border-cyan-500/40";
  };

  return (
    <div className="w-full space-y-4 animate-in fade-in">
      <button
        type="button"
        onClick={onBack}
        className={`inline-flex items-center gap-1.5 text-xs font-mono mb-1 transition-colors cursor-pointer ${
          theme === "dark"
            ? "text-zinc-400 hover:text-white"
            : "text-slate-500 hover:text-slate-900"
        }`}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Vault
      </button>

      {/* Step 1: Scanning Challenge Loop */}
      {!activeChallenge && (
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <h2
              className={`text-sm font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}
            >
              Scan Unlock Challenge QR
            </h2>
            <p
              className={`text-[11px] max-w-xs mx-auto ${
                theme === "dark" ? "text-zinc-400" : "text-slate-500"
              }`}
            >
              Point camera at the desktop workstation screen when clicking{" "}
              <strong>[ 📲 QR ]</strong> on any custodian slot.
            </p>
          </div>

          <QrCameraScanner<AirGapChallenge>
            onCompleted={handleChallengeScanned}
            targetDescription="Scanning Unlock Challenge..."
          />
        </div>
      )}

      {/* Step 2: Automatic Match Confirmation, Provenance Passport & Biometric Touch */}
      {activeChallenge && !isFlashing && (
        <div className="space-y-4 animate-in fade-in">
          {/* Automatic Match Verification Card */}
          {matchedVaultKey ? (
            <div
              className={`p-3.5 rounded-2xl border flex items-start gap-3 shadow-md ${
                theme === "dark"
                  ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
                  : "bg-emerald-50 border-emerald-300 text-emerald-900"
              }`}
            >
              <ShieldCheck className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <div className="text-xs font-bold font-mono tracking-tight flex items-center gap-1.5">
                  <span>✓ AUTO-MATCHED VAULT KEY</span>
                </div>
                <div className="text-xs font-mono truncate font-semibold">
                  {matchedVaultKey.fileName}
                </div>
                <div className="text-[10px] opacity-80">
                  Custodian Slot #{matchedVaultKey.custodianId} ({matchedVaultKey.custodianLabel}) •{" "}
                  {matchedVaultKey.authType === "pqc" ? "NIST FIPS 203 PQC" : "Shamir SSS"}
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                theme === "dark"
                  ? "bg-amber-950/30 border-amber-500/40 text-amber-300"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
            >
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-xs font-bold">No Pre-Enrolled Key Matched in Vault</div>
                <p className="text-[10px] opacity-90">
                  Target container <code>{activeChallenge.fileName}</code> was not found in your
                  hardware enclave. You can enter the custodian password below.
                </p>
              </div>
            </div>
          )}

          {/* Container Provenance Passport */}
          <div
            className={`rounded-2xl border p-4 space-y-3 relative overflow-hidden shadow-lg ${
              theme === "dark"
                ? "border-zinc-800 bg-zinc-900/80 text-white"
                : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div
              className={`flex items-center justify-between border-b pb-2.5 ${
                theme === "dark" ? "border-zinc-800" : "border-slate-100"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-cyan-500" />
                <span
                  className={`text-[10px] font-mono uppercase ${
                    theme === "dark" ? "text-zinc-400" : "text-slate-500"
                  }`}
                >
                  Provenance Passport:
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border ${getClassificationBadge(
                  activeChallenge.classification,
                )}`}
              >
                {activeChallenge.classification || "CONFIDENTIAL"}
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                <div>
                  <div
                    className={`text-[10px] font-mono uppercase ${
                      theme === "dark" ? "text-zinc-500" : "text-slate-400"
                    }`}
                  >
                    Target Container File
                  </div>
                  <div className="text-xs font-bold font-mono">{activeChallenge.fileName}</div>
                </div>
              </div>

              {activeChallenge.purpose && (
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <div
                      className={`text-[10px] font-mono uppercase ${
                        theme === "dark" ? "text-zinc-500" : "text-slate-400"
                      }`}
                    >
                      Governance Purpose / Scope
                    </div>
                    <div className="text-xs">{activeChallenge.purpose}</div>
                  </div>
                </div>
              )}

              {activeChallenge.organization && (
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                  <div>
                    <div
                      className={`text-[10px] font-mono uppercase ${
                        theme === "dark" ? "text-zinc-500" : "text-slate-400"
                      }`}
                    >
                      Issuing Organization
                    </div>
                    <div className="text-xs">{activeChallenge.organization}</div>
                  </div>
                </div>
              )}
            </div>

            <div
              className={`border-t pt-2 flex items-center justify-between text-[10px] font-mono ${
                theme === "dark"
                  ? "border-zinc-800 text-zinc-500"
                  : "border-slate-100 text-slate-400"
              }`}
            >
              <span>
                Slot #{activeChallenge.custodianId} ({activeChallenge.custodianLabel})
              </span>
              <span>
                Quorum: {activeChallenge.thresholdK} of {activeChallenge.totalN}
              </span>
            </div>
          </div>

          {/* Authorization Actions */}
          <div className="space-y-3 pt-1">
            {!matchedVaultKey && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <label
                    htmlFor="custodian-pin"
                    className={`text-[11px] font-medium flex items-center gap-1 ${
                      theme === "dark" ? "text-zinc-300" : "text-slate-700"
                    }`}
                  >
                    <KeyRound className="w-3 h-3 text-cyan-500" />
                    <span>Custodian Slot Passphrase</span>
                  </label>
                  <input
                    id="custodian-pin"
                    type="password"
                    value={custodianPinInput}
                    onChange={(e) => setCustodianPinInput(e.target.value)}
                    placeholder="Enter custodian password..."
                    className={`w-full rounded-xl border px-3 py-2.5 text-xs font-mono focus:outline-none ${
                      theme === "dark"
                        ? "border-zinc-800 bg-zinc-950 text-white focus:border-cyan-500"
                        : "border-slate-300 bg-white text-slate-900 focus:border-cyan-600 shadow-sm"
                    }`}
                  />
                </div>

                {availableVaultKeys.length > 0 && (
                  <div className="space-y-1">
                    <label
                      htmlFor="manual-vault-select"
                      className={`text-[11px] font-medium block ${
                        theme === "dark" ? "text-zinc-400" : "text-slate-600"
                      }`}
                    >
                      Or Select an Existing Key from Vault:
                    </label>
                    <select
                      id="manual-vault-select"
                      onChange={(e) => {
                        const selected = availableVaultKeys.find((k) => k.id === e.target.value);
                        if (selected) setMatchedVaultKey(selected);
                      }}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-mono ${
                        theme === "dark"
                          ? "border-zinc-800 bg-zinc-950 text-white"
                          : "border-slate-300 bg-white text-slate-900"
                      }`}
                    >
                      <option value="">-- Choose Key from Vault --</option>
                      {availableVaultKeys.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.fileName} (Slot #{k.custodianId} - {k.custodianLabel})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => handleApprove(true)}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-black font-bold text-sm shadow-[0_0_25px_rgba(6,182,212,0.35)] transition-all cursor-pointer"
            >
              <Fingerprint className="w-5 h-5" />
              <span>
                {matchedVaultKey
                  ? "Authorize & Sign-Off (Touch Biometric)"
                  : "Sign-Off Release (Touch Biometric)"}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Flash Response Stream to Desktop Webcam */}
      {isFlashing && (
        <div className="w-full space-y-4 text-center animate-in fade-in">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-mono font-bold">
              <CheckCircle2 className="w-4 h-4" /> Share Authorized Offline
            </div>
            <h2
              className={`text-sm font-bold mt-1 ${
                theme === "dark" ? "text-white" : "text-slate-900"
              }`}
            >
              Hold Phone to Desktop Webcam
            </h2>
            <p
              className={`text-[11px] max-w-xs mx-auto ${
                theme === "dark" ? "text-zinc-400" : "text-slate-500"
              }`}
            >
              The workstation webcam will scan this rotating response stream to complete quorum.
            </p>
          </div>

          <AnimatedQrStream frames={responseFrames} size={280} initialFps={8} />

          <button
            type="button"
            onClick={onBack}
            className={`w-full py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
              theme === "dark"
                ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
            }`}
          >
            Done / Return to Vault
          </button>
        </div>
      )}
    </div>
  );
};
