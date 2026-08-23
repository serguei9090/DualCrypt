import { CheckCircle2, Cpu, Layers, Lock, Shield } from "lucide-react";
import type React from "react";
import type { ContainerHeaderInfo } from "../../types/container";

interface FileMetadataCardProps {
  metadata: ContainerHeaderInfo;
  fileName: string;
}

export const FileMetadataCard: React.FC<FileMetadataCardProps> = ({ metadata, fileName }) => {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-400">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-zinc-100">{fileName}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Valid .denc v{metadata.version}
              </span>
            </div>
            <p className="text-xs text-zinc-400">Authenticated Container Container Specification</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1 font-mono text-xs text-cyan-400">
            {metadata.cipher}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <Lock className="h-3.5 w-3.5 text-cyan-400" />
            <span>Quorum Threshold</span>
          </div>
          <div className="font-mono text-base font-bold text-zinc-100">
            {metadata.threshold_k} of {metadata.total_n} Shares
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <Layers className="h-3.5 w-3.5 text-emerald-400" />
            <span>Chunk Stream Framing</span>
          </div>
          <div className="font-mono text-base font-bold text-zinc-100">
            {metadata.chunk_size / 1024} KiB Chunks
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <Cpu className="h-3.5 w-3.5 text-purple-400" />
            <span>KDF Engine</span>
          </div>
          <div className="font-mono text-base font-bold text-zinc-100">Argon2id (64MB)</div>
        </div>

        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <Shield className="h-3.5 w-3.5 text-amber-400" />
            <span>Secret Sharing</span>
          </div>
          <div className="font-mono text-base font-bold text-zinc-100">GF(256) Shamir</div>
        </div>
      </div>
    </div>
  );
};
