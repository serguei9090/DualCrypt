import { Cpu, Lock, Settings, Shield } from "lucide-react";
import type React from "react";
import { cn } from "../../lib/utils";
import type { ActiveTab } from "./TabNav";

interface HeaderProps {
  activeTab?: ActiveTab;
  onTabChange?: (tab: ActiveTab) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white">
                DualCrypt <span className="text-cyan-400">Enterprise</span>
              </h1>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-950/50 px-2 py-0.5 font-mono text-[10px] font-semibold text-cyan-300">
                v2.0.0
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Zero-Trust Dual-Custody & Threshold Cryptographic Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 font-mono text-xs text-zinc-400">
            <Cpu className="h-3.5 w-3.5 text-cyan-400" />
            <span>Rust GF(256) Core</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs text-emerald-400">
            <Lock className="h-3.5 w-3.5" />
            <span>Memory Locked</span>
          </div>

          {onTabChange && (
            <button
              type="button"
              onClick={() => onTabChange("settings")}
              className={cn(
                "flex items-center justify-center p-2 rounded-lg border transition-all cursor-pointer",
                activeTab === "settings"
                  ? "border-purple-500/50 bg-purple-500/20 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.35)]"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800",
              )}
              title="Settings, SMTP & Defaults"
            >
              <Settings
                className={cn(
                  "h-4 w-4 transition-transform duration-300 hover:rotate-45",
                  activeTab === "settings" && "text-purple-300",
                )}
              />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
