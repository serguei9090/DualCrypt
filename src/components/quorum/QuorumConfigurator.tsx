import { Shield, Sliders, Zap } from "lucide-react";
import type React from "react";
import { cn } from "../../lib/utils";

interface QuorumConfiguratorProps {
  thresholdK: number;
  totalN: number;
  cipher: string;
  onThresholdChange: (k: number, n: number) => void;
  onCipherChange: (cipher: string) => void;
}

export const QuorumConfigurator: React.FC<QuorumConfiguratorProps> = ({
  thresholdK,
  totalN,
  cipher,
  onThresholdChange,
  onCipherChange,
}) => {
  const presets = [
    { name: "Strict Dual-Control (2-of-2)", k: 2, n: 2, desc: "Both parties must co-sign" },
    {
      name: "Dual-Control + Escrow (2-of-3)",
      k: 2,
      n: 3,
      desc: "Any 2 of 3 custodians can unlock",
    },
    { name: "Executive Committee (3-of-5)", k: 3, n: 5, desc: "Any 3 of 5 trustees can unlock" },
  ];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm">
          <Sliders className="h-4 w-4 text-cyan-400" />
          <span>Quorum Policy & AEAD Cipher Configuration</span>
        </div>
      </div>

      {/* Preset Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {presets.map((p) => {
          const isSelected = thresholdK === p.k && totalN === p.n;
          return (
            <button
              type="button"
              key={p.name}
              onClick={() => onThresholdChange(p.k, p.n)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all",
                isSelected
                  ? "border-cyan-500/50 bg-cyan-500/10 text-zinc-100 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                  : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-zinc-200">{p.name}</span>
                <span className="font-mono text-[11px] text-cyan-400 font-bold">
                  {p.k}/{p.n}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">{p.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Cipher Selector & Custom Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-800/60">
        <div>
          <div className="text-xs font-medium text-zinc-300 mb-1.5">
            Symmetric AEAD Cipher Engine
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onCipherChange("aes-256-gcm")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-mono transition-all",
                cipher === "aes-256-gcm"
                  ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300 font-bold"
                  : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200",
              )}
            >
              <Zap className="h-3.5 w-3.5" /> AES-256-GCM
            </button>
            <button
              type="button"
              onClick={() => onCipherChange("xchacha20-poly1305")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-mono transition-all",
                cipher === "xchacha20-poly1305"
                  ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300 font-bold"
                  : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200",
              )}
            >
              <Shield className="h-3.5 w-3.5" /> XChaCha20-Poly
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between bg-zinc-950/70 border border-zinc-800/80 rounded-xl px-4 py-2">
          <div>
            <div className="text-xs text-zinc-300 font-medium">Active Policy Summary</div>
            <div className="text-[11px] text-zinc-500">
              GF(256) Shamir Secret Sharing over {totalN} polynomial evaluations
            </div>
          </div>
          <div className="font-mono text-sm font-bold text-cyan-400 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-lg">
            k={thresholdK} / n={totalN}
          </div>
        </div>
      </div>
    </div>
  );
};
