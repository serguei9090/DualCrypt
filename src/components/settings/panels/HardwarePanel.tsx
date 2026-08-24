import { Cpu, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import {
  isSimulationEnabled,
  listHardwareTokens,
  performHardwareTokenChallenge,
  setSimulationEnabled,
  type YubiKeyDevice,
} from "../../../lib/tauri";

export const HardwarePanel: React.FC = () => {
  const [tokens, setTokens] = useState<YubiKeyDevice[]>([]);
  const [isRefreshingTokens, setIsRefreshingTokens] = useState(false);
  const [activeChallengeResult, setActiveChallengeResult] = useState<string | null>(null);

  const handleRefreshTokens = useCallback(async () => {
    setIsRefreshingTokens(true);
    try {
      const res = await listHardwareTokens();
      setTokens(res);
    } catch (err) {
      console.error("Failed to list hardware tokens:", err);
    } finally {
      setIsRefreshingTokens(false);
    }
  }, []);

  useEffect(() => {
    handleRefreshTokens();
  }, [handleRefreshTokens]);

  const handleTestYubikeyChallenge = async (custodianId: number) => {
    setActiveChallengeResult(null);
    try {
      const res = await performHardwareTokenChallenge(
        custodianId,
        "4475616c43727970742d456e74657270726973652d4368616c6c656e6765",
      );
      setActiveChallengeResult(`✔ Challenge signed: ${res.signature_hex.substring(0, 32)}...`);
    } catch (err) {
      setActiveChallengeResult(`❌ Hardware error: ${String(err)}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Cpu className="h-5 w-5 text-amber-400" />
            <span>Hardware Security Keys & YubiKey Diagnostics</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Manage FIDO2, CTAP2, and PKCS#11 hardware roots-of-trust for multi-custodian quorum.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefreshTokens}
          disabled={isRefreshingTokens}
          className="p-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white cursor-pointer focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none"
          title="Scan connected tokens"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingTokens ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Developer Simulator Toggle */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/80 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-200">
              Virtual Key Simulator Mode (Dev Mode)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              OPTIONAL
            </span>
          </div>
          <input
            type="checkbox"
            checked={isSimulationEnabled()}
            onChange={(e) => {
              setSimulationEnabled(e.target.checked);
              handleRefreshTokens();
            }}
            className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer accent-cyan-500"
          />
        </div>
        <p className="text-xs text-slate-400">
          Enables virtual security keys for development, automated testing, and demonstrations
          without physical hardware plugged in. Turn off for strict production physical key
          enforcement.
        </p>
      </div>

      {/* Connected Hardware Device List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Connected Hardware Tokens
        </h4>

        {tokens.length > 0 ? (
          tokens.map((t) => (
            <div
              key={t.device_id}
              className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Cpu className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100">{t.product_name}</div>
                    {t.serial_number && (
                      <div className="text-[10px] font-mono text-slate-500">
                        Serial Number: {t.serial_number}
                      </div>
                    )}
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold border ${
                    t.is_simulated
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  }`}
                >
                  <ShieldCheck className="h-3 w-3" />
                  {t.is_simulated ? "Simulator" : "USB Ready"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleTestYubikeyChallenge(1)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 py-2 text-xs font-semibold text-amber-300 transition-all cursor-pointer focus-visible:ring-1 focus-visible:ring-amber-500 focus-visible:outline-none"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Test Token Challenge Response</span>
              </button>
            </div>
          ))
        ) : (
          <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-950/10 text-xs text-rose-300 space-y-1">
            <div className="font-semibold text-sm">No Hardware Key Detected</div>
            <p className="text-xs text-slate-400">
              Insert a physical YubiKey into a USB port and click &apos;Scan&apos;, or enable
              Virtual Simulator Mode above to test.
            </p>
          </div>
        )}

        {activeChallengeResult && (
          <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 text-xs font-mono text-amber-300 break-all">
            {activeChallengeResult}
          </div>
        )}
      </div>
    </div>
  );
};
