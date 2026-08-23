import { Lock, ShieldAlert, ShieldCheck, Unlock } from "lucide-react";
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
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 backdrop-blur-md">
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
            <h3 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider">
              Cryptographic Quorum Status
            </h3>
            <p className="text-xs text-zinc-400">
              {providedCount} of {requiredK} required custodian shares verified ({totalN} total
              issued)
            </p>
          </div>
        </div>

        <div>
          {isUnlocked ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-mono font-bold text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <ShieldCheck className="h-4 w-4" /> QUORUM ATTAINED
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-mono font-medium text-amber-400">
              <ShieldAlert className="h-4 w-4" /> AWAITING SHARES ({requiredK - providedCount}{" "}
              needed)
            </span>
          )}
        </div>
      </div>

      {/* Segmented Quorum Progress Track */}
      <div
        className="grid gap-2 my-3"
        style={{ gridTemplateColumns: `repeat(${totalN}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: totalN }).map((_, idx) => {
          const isVerified = idx < providedCount;
          const isRequiredSlot = idx < requiredK;
          const slotKey = `quorum-slot-${idx + 1}`;

          return (
            <div
              key={slotKey}
              className={cn(
                "h-3 rounded-full transition-all duration-500 border",
                isVerified
                  ? "bg-emerald-500 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                  : isRequiredSlot
                    ? "bg-zinc-800/80 border-zinc-700 border-dashed"
                    : "bg-zinc-900 border-zinc-800",
              )}
            />
          );
        })}
      </div>
    </div>
  );
};
