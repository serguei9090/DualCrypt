import { ArrowLeft, CheckCircle2 } from "lucide-react";
import type React from "react";
import { useState } from "react";
import type { AirGapEnrollmentKey } from "../../../../packages/shared-airgap/src/index";
import { saveVaultKey } from "../lib/vaultStorage";
import { QrCameraScanner } from "./QrCameraScanner";

interface EnrollScannerProps {
  onBack: () => void;
  onEnrolledSuccess: () => void;
}

export const EnrollScanner: React.FC<EnrollScannerProps> = ({ onBack, onEnrolledSuccess }) => {
  const [enrolledKey, setEnrolledKey] = useState<AirGapEnrollmentKey | null>(null);

  const handleKeyScanned = (key: AirGapEnrollmentKey) => {
    saveVaultKey(key);
    setEnrolledKey(key);
    setTimeout(() => {
      onEnrolledSuccess();
    }, 1200);
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

      <div className="text-center space-y-1">
        <h2 className="text-sm font-bold text-white">Scan Key from Desktop Screen</h2>
        <p className="text-[11px] text-zinc-400">
          Point camera at the rotating QR code on the desktop Encrypt Complete dialog.
        </p>
      </div>

      {enrolledKey ? (
        <div className="w-full max-w-[320px] aspect-square rounded-2xl border-2 border-emerald-500/40 bg-emerald-950/20 p-6 flex flex-col items-center justify-center text-center space-y-3 mx-auto">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
          <div>
            <div className="text-sm font-bold text-white">Key Enrolled Successfully!</div>
            <div className="text-xs text-emerald-300 font-mono mt-1">
              {enrolledKey.fileName} — Custodian {enrolledKey.custodianId}
            </div>
          </div>
        </div>
      ) : (
        <QrCameraScanner<AirGapEnrollmentKey>
          onCompleted={handleKeyScanned}
          targetDescription="Scanning Enrollment Key Stream..."
        />
      )}
    </div>
  );
};
