import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  Fingerprint,
  KeyRound,
  Lock,
  Shield,
  Smartphone,
  Tag,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import {
  type AirGapChallenge,
  type AirGapResponse,
  encodePayloadToFrames,
} from "../../lib/airgapProtocol";
import { AnimatedQrStream } from "./AnimatedQrStream";
import { QrCameraScanner } from "./QrCameraScanner";

type MobileAppState =
  | "LOCKED"
  | "SCANNING_CHALLENGE"
  | "REVIEW_AUTHORIZATION"
  | "FLASHING_RESPONSE";

export const AirGapMobileApp: React.FC = () => {
  const [appState, setAppState] = useState<MobileAppState>("LOCKED");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState<AirGapChallenge | null>(null);
  const [responseFrames, setResponseFrames] = useState<string[]>([]);
  const [custodianSecretInput, setCustodianSecretInput] = useState("");
  const [isBiometricAuthenticating, setIsBiometricAuthenticating] = useState(false);

  // Auto-Biometric Unlock attempt on mount
  useEffect(() => {
    if (window.PublicKeyCredential && appState === "LOCKED") {
      // Simulate/trigger biometric readiness
    }
  }, [appState]);

  const handleBiometricUnlock = async () => {
    setIsBiometricAuthenticating(true);
    // Simulate Android BiometricPrompt / WebAuthn touch
    setTimeout(() => {
      setIsBiometricAuthenticating(false);
      setAppState("SCANNING_CHALLENGE");
    }, 600);
  };

  const handlePinUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.length >= 4) {
      setPinError(false);
      setAppState("SCANNING_CHALLENGE");
    } else {
      setPinError(true);
    }
  };

  const handleChallengeScanned = (challenge: AirGapChallenge) => {
    setActiveChallenge(challenge);
    setAppState("REVIEW_AUTHORIZATION");
  };

  const handleApproveAuthorization = (useBiometric = true) => {
    if (!activeChallenge) return;

    const response: AirGapResponse = {
      protocol: "DENC-AIRGAP-V1",
      type: "RESPONSE",
      sessionId: activeChallenge.sessionId,
      custodianId: activeChallenge.custodianId,
      custodianLabel: activeChallenge.custodianLabel,
      passphrase: custodianSecretInput.trim() || "AirGapPassphraseAuthorized#2026",
      biometricVerified: useBiometric,
      timestamp: new Date().toISOString(),
    };

    const frames = encodePayloadToFrames(response, 180);
    setResponseFrames(frames);
    setAppState("FLASHING_RESPONSE");
  };

  const getClassificationColor = (cls?: string) => {
    const c = (cls || "").toUpperCase();
    if (c.includes("SECRET")) return "bg-red-500/20 text-red-400 border-red-500/40";
    if (c.includes("CONFIDENTIAL")) return "bg-amber-500/20 text-amber-400 border-amber-500/40";
    if (c.includes("RESTRICTED")) return "bg-purple-500/20 text-purple-400 border-purple-500/40";
    return "bg-cyan-500/20 text-cyan-400 border-cyan-500/40";
  };

  return (
    <div className="min-h-screen bg-black text-foreground flex flex-col items-center justify-center p-4 max-w-md mx-auto">
      {/* Top Mobile Header */}
      <div className="w-full flex items-center justify-between py-3 border-b border-zinc-800/80 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Smartphone className="w-4 h-4" />
          </div>
          <span className="font-mono text-xs font-bold text-white tracking-wider">
            DUALCRYPT AIRGAP AUTHENTICATOR
          </span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
          ✈️ 100% OFFLINE
        </span>
      </div>

      {/* STAGE 1: BIOMETRIC / PIN LOCK */}
      {appState === "LOCKED" && (
        <div className="w-full space-y-6 text-center animate-in fade-in py-8">
          <div className="w-20 h-20 rounded-3xl bg-zinc-900 border-2 border-primary/30 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(6,182,212,0.15)] text-primary">
            <Lock className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-white">Air-Gapped Vault Locked</h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
              Authenticate via Biometrics or Master PIN to access custodian keys.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleBiometricUnlock}
              disabled={isBiometricAuthenticating}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-primary text-black font-bold text-sm shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:bg-primary/90 transition-all cursor-pointer"
            >
              <Fingerprint className="w-5 h-5" />
              <span>
                {isBiometricAuthenticating
                  ? "Authenticating..."
                  : "Touch Fingerprint / Face Unlock"}
              </span>
            </button>

            <div className="relative flex py-2 items-center">
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
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter 4-8 digit PIN"
                className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-center text-sm font-mono tracking-widest text-white focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold font-mono cursor-pointer border border-zinc-700"
              >
                Unlock
              </button>
            </form>
            {pinError && (
              <p className="text-[11px] text-red-400 font-mono">PIN must be at least 4 digits.</p>
            )}
          </div>
        </div>
      )}

      {/* STAGE 2: SCANNING ROTATING CHALLENGE FROM WORKSTATION */}
      {appState === "SCANNING_CHALLENGE" && (
        <div className="w-full space-y-4 animate-in fade-in">
          <div className="text-center">
            <h2 className="text-sm font-bold text-white">Scan Workstation Screen</h2>
            <p className="text-[11px] text-zinc-400">
              Align the desktop monitor's rotating QR stream inside the frame.
            </p>
          </div>

          <QrCameraScanner<AirGapChallenge>
            onCompleted={handleChallengeScanned}
            targetDescription="Scanning Challenge Stream..."
          />
        </div>
      )}

      {/* STAGE 3: REVIEW PROVENANCE PASSPORT & APPROVE WITH BIOMETRICS */}
      {appState === "REVIEW_AUTHORIZATION" && activeChallenge && (
        <div className="w-full space-y-4 animate-in fade-in">
          <button
            type="button"
            onClick={() => setAppState("SCANNING_CHALLENGE")}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer font-mono mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Scanner
          </button>

          {/* Provenance & Security Passport Card */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-mono text-zinc-400 uppercase">
                  Security Classification:
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono border ${getClassificationColor(
                  activeChallenge.classification,
                )}`}
              >
                {activeChallenge.classification || "CONFIDENTIAL"}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" />
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
                  <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
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
                  <Building2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
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
              <span>Slot: Custodian {activeChallenge.custodianId}</span>
              <span>
                Quorum: {activeChallenge.thresholdK} of {activeChallenge.totalN}
              </span>
            </div>
          </div>

          {/* Authorization Actions */}
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <label
                htmlFor="custodian-pin-input"
                className="text-[11px] font-medium text-zinc-300 flex items-center gap-1"
              >
                <KeyRound className="w-3 h-3 text-cyan-400" />
                <span>Custodian PIN / Passphrase (Optional for Slot)</span>
              </label>
              <input
                id="custodian-pin-input"
                type="password"
                value={custodianSecretInput}
                onChange={(e) => setCustodianSecretInput(e.target.value)}
                placeholder="Enter slot PIN or leave default"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white font-mono focus:border-primary focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => handleApproveAuthorization(true)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-black font-bold text-sm shadow-[0_0_25px_rgba(6,182,212,0.35)] transition-all cursor-pointer"
            >
              <Fingerprint className="w-5 h-5" />
              <span>Authorize Release (Touch Biometric)</span>
            </button>
          </div>
        </div>
      )}

      {/* STAGE 4: FLASHING RESPONSE STREAM FOR WORKSTATION TO SCAN */}
      {appState === "FLASHING_RESPONSE" && (
        <div className="w-full space-y-4 text-center animate-in fade-in">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
              <CheckCircle2 className="w-4 h-4" /> Share Authorized Offline
            </div>
            <h2 className="text-sm font-bold text-white mt-1">Hold Phone to Desktop Webcam</h2>
            <p className="text-[11px] text-zinc-400">
              The workstation will scan this rotating response stream to complete quorum.
            </p>
          </div>

          <AnimatedQrStream frames={responseFrames} size={280} initialFps={8} />

          <button
            type="button"
            onClick={() => setAppState("SCANNING_CHALLENGE")}
            className="w-full py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 text-xs font-semibold cursor-pointer hover:bg-zinc-800 transition-colors"
          >
            Done / Scan Another Challenge
          </button>
        </div>
      )}
    </div>
  );
};
