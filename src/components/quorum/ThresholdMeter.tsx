import { Lock, Unlock } from "lucide-react";
import type React from "react";
import { cn } from "../../lib/utils";

interface ThresholdMeterProps {
  requiredK: number;
  totalN: number;
  providedCount: number;
  isUnlocked: boolean;
}

export const ThresholdMeter: React.FC<ThresholdMeterProps> = ({
  requiredK,
  totalN,
  providedCount,
  isUnlocked,
}) => {
  return (
    <section
      aria-label="Cryptographic Quorum Status"
      className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-md"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-500",
              isUnlocked
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                : "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
            )}
          >
            {isUnlocked ? (
              <Unlock className="h-6 w-6 animate-pulse" />
            ) : (
              <Lock className="h-6 w-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100">
                {isUnlocked ? "Quorum Threshold Satisfied" : "Quorum Threshold Required"}
              </h3>
              <span
                className={cn(
                  "font-mono text-xs px-2 py-0.5 rounded-full border font-semibold",
                  isUnlocked
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
                )}
              >
                {providedCount} / {requiredK} Verified
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Shamir Secret Sharing over \(GF(256)\) polynomial degree \(t = {requiredK - 1}\)
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="font-mono text-xs text-slate-500">Total Custodians: {totalN}</span>
        </div>
      </div>

      {/* Progress Bar Container with ARIA semantics */}
      <div
        role="progressbar"
        aria-valuenow={providedCount}
        aria-valuemin={0}
        aria-valuemax={requiredK}
        aria-label="Quorum unlock verification progress"
        className="relative h-3 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800 p-0.5"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            isUnlocked
              ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
              : "bg-gradient-to-r from-cyan-600 to-teal-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]",
          )}
          style={{ width: `${Math.min(100, (providedCount / requiredK) * 100)}%` }}
        />
      </div>

      {/* Threshold Pin Markers */}
      <div
        className="mt-2 flex justify-between text-[11px] font-mono text-slate-500"
        aria-live="polite"
      >
        <span>0 Custodians</span>
        <span className={cn("font-semibold", isUnlocked ? "text-emerald-400" : "text-cyan-400")}>
          {isUnlocked ? "✔ Master Key Reconstructible" : `Requires ${requiredK} Keys to Unlock`}
        </span>
        <span>{totalN} Custodians</span>
      </div>
    </section>
  );
};
