import { Shield, Smartphone, X } from "lucide-react";
import type React from "react";
import { useMemo } from "react";
import { type AirGapEnrollmentKey, encodePayloadToFrames } from "../../lib/airgapProtocol";
import type { ExportedShare } from "../../types/container";
import { AnimatedQrStream } from "./AnimatedQrStream";

interface EnrollmentQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  share: ExportedShare;
  fileName: string;
}

export const EnrollmentQrModal: React.FC<EnrollmentQrModalProps> = ({
  isOpen,
  onClose,
  share,
  fileName,
}) => {
  const enrollmentFrames = useMemo(() => {
    const sessionId = `enr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const payload: AirGapEnrollmentKey = {
      protocol: "DENC-AIRGAP-V1",
      type: "ENROLL_KEY",
      sessionId,
      fileName,
      custodianId: share.custodian_id,
      custodianLabel: share.label,
      authType: share.auth_type === "pqc" || share.pqc_private_key_base64 ? "pqc" : "keyfile",
      shareDataJson: share.share ? JSON.stringify(share.share) : undefined,
      pqcPrivateKeyBase64: share.pqc_private_key_base64,
      createdAtUtc: Math.floor(Date.now() / 1000),
    };

    return encodePayloadToFrames(payload, 180);
  }, [share, fileName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl space-y-4 p-6 text-center">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-left">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Save Key to Android Authenticator</h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Custodian {share.custodian_id}: {share.label}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR Stream */}
        <div className="py-2 flex flex-col items-center">
          <AnimatedQrStream frames={enrollmentFrames} size={250} />
          <p className="text-xs text-slate-400 max-w-xs mt-3 font-sans">
            Open the <strong>DualCrypt Android Authenticator</strong> on your offline smartphone,
            tap <strong>Scan & Add Key</strong>, and point camera at this screen.
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            100% Offline Vault Enrollment
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold cursor-pointer border border-slate-700 focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
