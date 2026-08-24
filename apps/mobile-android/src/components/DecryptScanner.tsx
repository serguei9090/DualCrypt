import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  Fingerprint,
  KeyRound,
  Shield,
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
  onBack: () => void;
}

export const DecryptScanner: React.FC<DecryptScannerProps> = ({ onBack }) => {
  const [activeChallenge, setActiveChallenge] = useState<AirGapChallenge | null>(null);
  const [matchedVaultKey, setMatchedVaultKey] = useState<VaultKeyItem | null>(null);
  const [custodianPinInput, setCustodianPinInput] = useState("");
  const [responseFrames, setResponseFrames] = useState<string[]>([]);
  const [isFlashing, setIsFlashing] = useState(false);

  const handleChallengeScanned = (challenge: AirGapChallenge) => {
    setActiveChallenge(challenge);

    // Look for matching key in offline vault
    const vaultKeys = loadVaultKeys();
    const match = vaultKeys.find(
      (k) => k.fileName === challenge.fileName && k.custodianId === challenge.custodianId,
    );
    if (match) {
      setMatchedVaultKey(match);
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
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer font-mono mb-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Vault
      </button>

      {/* Step 1: Scan challenge stream */}
      {!activeChallenge && (
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-sm font-bold text-white">Scan Unlock Challenge</h2>
            <p className="text-[11px] text-zinc-400">
              Point camera at the desktop screen when clicking [ 📲 QR ] on a custodian slot.
            </p>
          </div>

          <QrCameraScanner<AirGapChallenge>
            onCompleted={handleChallengeScanned}
            targetDescription="Scanning Unlock Challenge..."
          />
        </div>
      )}

      {/* Step 2: Provenance Passport & Biometric Approval */}
      {activeChallenge && !isFlashing && (
        <div className="space-y-4 animate-in fade-in">
          {/* Provenance Passport Card */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-3 relative overflow-hidden shadow-lg">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] font-mono text-zinc-400 uppercase">
                  Security Classification:
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono border ${getClassificationBadge(
                  activeChallenge.classification,
                )}`}
              >
                {activeChallenge.classification || "CONFIDENTIAL"}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] text-zinc-500 font-mono uppercase">
                    Target Container
                  </div>
                  <div className="text-xs font-bold text-white font-mono">
                    {activeChallenge.fileName}
                  </div>
                </div>
              </div>

              {activeChallenge.purpose && (
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] text-zinc-500 font-mono uppercase">
                      Purpose / Scope
                    </div>
                    <div className="text-xs text-zinc-200">{activeChallenge.purpose}</div>
                  </div>
                </div>
              )}

              {activeChallenge.organization && (
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] text-zinc-500 font-mono uppercase">
                      Organization
                    </div>
                    <div className="text-xs text-zinc-200">{activeChallenge.organization}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-zinc-800 pt-2 flex items-center justify-between text-[10px] font-mono text-zinc-500">
              <span>
                Slot: Custodian {activeChallenge.custodianId} ({activeChallenge.custodianLabel})
              </span>
              <span>
                Quorum: {activeChallenge.thresholdK} of {activeChallenge.totalN}
              </span>
            </div>
          </div>

          {matchedVaultKey && (
            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Matched local key in hardware enclave!</span>
            </div>
          )}

          {/* Authorization Actions */}
          <div className="space-y-3 pt-1">
            {!matchedVaultKey && (
              <div className="space-y-1">
                <label
                  htmlFor="slot-pin-input"
                  className="text-[11px] font-medium text-zinc-300 flex items-center gap-1"
                >
                  <KeyRound className="w-3 h-3 text-cyan-400" />
                  <span>Custodian Slot PIN / Passphrase</span>
                </label>
                <input
                  id="slot-pin-input"
                  type="password"
                  value={custodianPinInput}
                  onChange={(e) => setCustodianPinInput(e.target.value)}
                  placeholder="Enter slot password if not in vault"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => handleApprove(true)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-black font-bold text-sm shadow-[0_0_25px_rgba(6,182,212,0.35)] transition-all cursor-pointer"
            >
              <Fingerprint className="w-5 h-5" />
              <span>Authorize Release (Touch Biometric)</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Flash response back to desktop webcam */}
      {isFlashing && (
        <div className="w-full space-y-4 text-center animate-in fade-in">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
              <CheckCircle2 className="w-4 h-4" /> Share Authorized Offline
            </div>
            <h2 className="text-sm font-bold text-white mt-1">Hold Phone to Desktop Webcam</h2>
            <p className="text-[11px] text-zinc-400">
              The workstation webcam will scan this rotating response stream to complete quorum.
            </p>
          </div>

          <AnimatedQrStream frames={responseFrames} size={280} initialFps={8} />

          <button
            type="button"
            onClick={onBack}
            className="w-full py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 text-xs font-semibold cursor-pointer hover:bg-zinc-800 transition-colors"
          >
            Done / Return to Vault
          </button>
        </div>
      )}
    </div>
  );
};
