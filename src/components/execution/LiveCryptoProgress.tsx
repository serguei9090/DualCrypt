import { Activity, Gauge, HardDrive, ShieldCheck, XCircle } from "lucide-react";
import type React from "react";
import { formatBytes, formatThroughput } from "../../lib/utils";
import type { ProgressPayload } from "../../types/ipc";

interface LiveCryptoProgressProps {
  progress: ProgressPayload;
  fileName: string;
  onAbort: () => void;
}

export const LiveCryptoProgress: React.FC<LiveCryptoProgressProps> = ({
  progress,
  fileName,
  onAbort,
}) => {
  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-zinc-950/90 p-6 shadow-2xl backdrop-blur-xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-400">
            <Activity className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-zinc-100">{fileName}</h4>
            <span className="font-mono text-xs text-cyan-400">Phase: {progress.phase}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onAbort}
          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/20 transition-colors"
        >
          <XCircle className="h-4 w-4" /> Cancel & Zeroize RAM
        </button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between font-mono text-xs text-zinc-400">
          <span className="font-bold text-cyan-300">{progress.percentage.toFixed(1)}%</span>
          <span>
            {formatBytes(progress.bytes_processed)} / {formatBytes(progress.total_bytes)}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-900 border border-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 transition-all duration-150"
            style={{ width: `${Math.min(100, Math.max(0, progress.percentage))}%` }}
          />
        </div>
      </div>

      {/* Telemetry Metrics */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-zinc-800/80">
        <div className="flex items-center gap-2.5 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/60">
          <Gauge className="h-4 w-4 text-cyan-400" />
          <div>
            <div className="text-[10px] text-zinc-500 uppercase font-medium">Throughput</div>
            <div className="font-mono text-xs font-bold text-zinc-200">
              {formatThroughput(progress.throughput_bytes_per_sec)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/60">
          <HardDrive className="h-4 w-4 text-emerald-400" />
          <div>
            <div className="text-[10px] text-zinc-500 uppercase font-medium">ETA Remaining</div>
            <div className="font-mono text-xs font-bold text-zinc-200">{progress.eta_seconds}s</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/60">
          <ShieldCheck className="h-4 w-4 text-purple-400" />
          <div>
            <div className="text-[10px] text-zinc-500 uppercase font-medium">Framing Security</div>
            <div className="font-mono text-xs font-bold text-zinc-200">AEAD STREAM</div>
          </div>
        </div>
      </div>
    </div>
  );
};
