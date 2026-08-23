import { KeyRound, Shield, Sliders } from "lucide-react";
import type React from "react";
import { useState } from "react";

export const CryptoDefaultsPanel: React.FC = () => {
  const [defaultCipher, setDefaultCipher] = useState<"aes" | "xchacha">("aes");
  const [defaultThreshold, setDefaultThreshold] = useState<number>(2);
  const [defaultTotal, setDefaultTotal] = useState<number>(2);
  const [autoPinProtection, setAutoPinProtection] = useState<boolean>(true);

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-800 pb-4">
        <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
          <Sliders className="h-5 w-5 text-cyan-400" />
          <span>Cryptographic Defaults & Security Policies</span>
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          Set baseline cryptographic primitives, quorum policies, and memory hygiene configurations.
        </p>
      </div>

      <div className="space-y-4">
        {/* Cipher Suite Selection */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Default Symmetric AEAD Cipher
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDefaultCipher("aes")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                defaultCipher === "aes"
                  ? "bg-zinc-800/90 border-cyan-500 text-zinc-100 shadow-md shadow-cyan-500/10"
                  : "bg-zinc-900/40 border-zinc-800 text-zinc-400"
              }`}
            >
              <div className="text-xs font-bold text-cyan-400 mb-1">
                AES-256-GCM (Hardware Accelerated)
              </div>
              <p className="text-[11px] text-zinc-400">
                AES-NI hardware accelerated on modern Intel/AMD/ARM CPUs. Highest throughput.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setDefaultCipher("xchacha")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                defaultCipher === "xchacha"
                  ? "bg-zinc-800/90 border-cyan-500 text-zinc-100 shadow-md shadow-cyan-500/10"
                  : "bg-zinc-900/40 border-zinc-800 text-zinc-400"
              }`}
            >
              <div className="text-xs font-bold text-cyan-400 mb-1">
                XChaCha20-Poly1305 (Extended Nonce)
              </div>
              <p className="text-[11px] text-zinc-400">
                192-bit extended nonce cipher. Immune to nonce collision attacks in high-volume
                pipelines.
              </p>
            </button>
          </div>
        </div>

        {/* Quorum Defaults */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Default Multi-Party Quorum Policy
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="default-threshold-input"
                className="text-xs font-semibold text-zinc-300"
              >
                Default Required Threshold (k)
              </label>
              <input
                id="default-threshold-input"
                type="number"
                min={2}
                max={5}
                value={defaultThreshold}
                onChange={(e) => setDefaultThreshold(Number.parseInt(e.target.value, 10) || 2)}
                className="w-full rounded-xl border border-zinc-700/80 bg-zinc-900 px-3.5 py-2 text-xs text-zinc-200 focus:border-cyan-500 focus:outline-none font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="default-total-input" className="text-xs font-semibold text-zinc-300">
                Default Total Custodians (n)
              </label>
              <input
                id="default-total-input"
                type="number"
                min={2}
                max={5}
                value={defaultTotal}
                onChange={(e) => setDefaultTotal(Number.parseInt(e.target.value, 10) || 2)}
                className="w-full rounded-xl border border-zinc-700/80 bg-zinc-900 px-3.5 py-2 text-xs text-zinc-200 focus:border-cyan-500 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Key Share Hygiene & Policy */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                <KeyRound className="h-4 w-4 text-cyan-400" />
                <span>Enforce PIN Protection for Key Shares</span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Prompt administrators for password/PIN encryption when generating and exporting
                .dkey files.
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoPinProtection}
              onChange={(e) => setAutoPinProtection(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-750 bg-zinc-900 text-cyan-500 focus:ring-0 cursor-pointer"
            />
          </div>
        </div>

        {/* Memory Security & Zeroization Policy */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4 flex items-start gap-3">
          <Shield className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-zinc-300">
            <span className="font-bold text-emerald-400">Zero-Trust Memory Hygiene Guarantee</span>
            <p className="text-zinc-400 leading-relaxed">
              All master keys, reconstructed secret shares, and intermediate cryptographic buffers
              implement <code className="text-emerald-300 font-mono">ZeroizeOnDrop</code> and are
              purged from physical RAM immediately upon job termination.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
