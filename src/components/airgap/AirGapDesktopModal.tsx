import { CheckCircle2, Shield, Smartphone, X } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import {
  type AirGapChallenge,
  type AirGapResponse,
  encodePayloadToFrames,
} from "../../lib/airgapProtocol";
import type { ContainerHeaderInfo, CustodianDescriptorInfo } from "../../types/container";
import { AnimatedQrStream } from "./AnimatedQrStream";
import { QrCameraScanner } from "./QrCameraScanner";

interface AirGapDesktopModalProps {
  isOpen: boolean;
  onClose: () => void;
  custodian: CustodianDescriptorInfo;
  containerMetadata: ContainerHeaderInfo;
  fileName: string;
  onResponseReceived: (response: AirGapResponse) => void;
}

export const AirGapDesktopModal: React.FC<AirGapDesktopModalProps> = ({
  isOpen,
  onClose,
  custodian,
  containerMetadata,
  fileName,
  onResponseReceived,
}) => {
  const [completedResponse, setCompletedResponse] = useState<AirGapResponse | null>(null);

  // Generate Challenge Frames
  const challengeFrames = useMemo(() => {
    const sessionId = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const challenge: AirGapChallenge = {
      protocol: "DENC-AIRGAP-V1",
      type: "CHALLENGE",
      sessionId,
      fileName,
      classification: containerMetadata.manifest?.classification || "CONFIDENTIAL",
      purpose: containerMetadata.manifest?.purpose,
      organization: containerMetadata.manifest?.organization,
      createdAtUtc: containerMetadata.manifest?.created_at_utc || Math.floor(Date.now() / 1000),
      thresholdK: containerMetadata.threshold_k,
      totalN: containerMetadata.total_n,
      custodianId: custodian.custodian_id,
      custodianLabel: custodian.label,
      authType: custodian.auth_type,
      saltBase64: "denc_salt_embedded",
      encryptedShareBase64: custodian.has_embedded_share ? "embedded" : "token",
    };

    return encodePayloadToFrames(challenge, 180);
  }, [custodian, containerMetadata, fileName]);

  const handleScanCompleted = (resp: AirGapResponse) => {
    setCompletedResponse(resp);
    setTimeout(() => {
      onResponseReceived(resp);
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl space-y-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>100% Air-Gapped Optical Handshake</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Zero Network
                </span>
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                Custodian {custodian.custodian_id}: {custodian.label}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2-Way Optical Handshake View */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Step 1: Challenge Stream (Desktop -> Phone) */}
          <div className="flex flex-col items-center bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-mono">
                1
              </span>
              <span>Scan Challenge with Offline Phone</span>
            </div>

            <AnimatedQrStream frames={challengeFrames} size={240} />

            <p className="text-[11px] text-zinc-400 text-center max-w-xs font-sans">
              Point your offline smartphone camera at this rotating QR loop to read the unlock
              request.
            </p>
          </div>

          {/* Step 2: Response Scanner (Phone -> Desktop) */}
          <div className="flex flex-col items-center bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-mono">
                2
              </span>
              <span>Scan Phone's Response QR Code</span>
            </div>

            {completedResponse ? (
              <div className="w-full max-w-[320px] aspect-square rounded-2xl border-2 border-emerald-500/40 bg-emerald-950/20 p-6 flex flex-col items-center justify-center text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
                <div>
                  <div className="text-sm font-bold text-white">Quorum Share Received!</div>
                  <div className="text-xs text-emerald-300 font-mono mt-1">
                    Biometric authorization verified
                  </div>
                </div>
              </div>
            ) : (
              <QrCameraScanner<AirGapResponse>
                onCompleted={handleScanCompleted}
                targetDescription="Align phone screen inside crosshairs"
              />
            )}

            <p className="text-[11px] text-zinc-400 text-center max-w-xs font-sans">
              Once you approve on your air-gapped phone, hold its flashing response QR screen up to
              your webcam.
            </p>
          </div>
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3 text-[11px] text-zinc-500 font-mono">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            Physical Air-Gap: No Wi-Fi, Bluetooth, or USB connection required.
          </span>
          <span>Protocol: DENC-AIRGAP-V1</span>
        </div>
      </div>
    </div>
  );
};
