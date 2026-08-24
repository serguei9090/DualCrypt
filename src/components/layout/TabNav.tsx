import { History, KeyRound, Lock, Unlock } from "lucide-react";
import type React from "react";
import { isAuditHistoryEnabled } from "../../lib/historyStore";
import { cn } from "../../lib/utils";

export type ActiveTab = "encrypt" | "decrypt" | "keytools" | "history" | "settings";

interface TabNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const TabNav: React.FC<TabNavProps> = ({ activeTab, onTabChange }) => {
  const showHistoryTab = isAuditHistoryEnabled();

  return (
    <div className="flex border-b border-zinc-800 bg-zinc-950/40 px-6">
      <button
        type="button"
        onClick={() => onTabChange("encrypt")}
        className={cn(
          "flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-all",
          activeTab === "encrypt"
            ? "border-cyan-400 text-cyan-300 bg-cyan-500/5 shadow-[0_2px_10px_rgba(6,182,212,0.15)]"
            : "border-transparent text-zinc-400 hover:text-zinc-200",
        )}
      >
        <Lock className="h-4 w-4" />
        <span>Encrypt & Split</span>
      </button>

      <button
        type="button"
        onClick={() => onTabChange("decrypt")}
        className={cn(
          "flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-all",
          activeTab === "decrypt"
            ? "border-emerald-400 text-emerald-300 bg-emerald-500/5 shadow-[0_2px_10px_rgba(16,185,129,0.15)]"
            : "border-transparent text-zinc-400 hover:text-zinc-200",
        )}
      >
        <Unlock className="h-4 w-4" />
        <span>Quorum Unlock & Decrypt</span>
      </button>

      <button
        type="button"
        onClick={() => onTabChange("keytools")}
        className={cn(
          "flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-all",
          activeTab === "keytools"
            ? "border-amber-400 text-amber-300 bg-amber-500/5"
            : "border-transparent text-zinc-400 hover:text-zinc-200",
        )}
      >
        <KeyRound className="h-4 w-4" />
        <span>Key Escrow & Shares</span>
      </button>

      {showHistoryTab && (
        <button
          type="button"
          onClick={() => onTabChange("history")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-all",
            activeTab === "history"
              ? "border-orange-400 text-orange-300 bg-orange-500/5 shadow-[0_2px_10px_rgba(249,115,22,0.15)]"
              : "border-transparent text-zinc-400 hover:text-zinc-200",
          )}
        >
          <History className="h-4 w-4" />
          <span>Activity & Audit History</span>
        </button>
      )}
    </div>
  );
};
