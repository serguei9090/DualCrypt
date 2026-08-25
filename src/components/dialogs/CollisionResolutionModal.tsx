import {
  AlertTriangle,
  CornerDownRight,
  FolderCheck,
  FolderPlus,
  FolderSearch,
  X,
} from "lucide-react";
import type React from "react";

export type CollisionAction = "overwrite" | "auto_version" | "choose_different" | "cancel";

interface CollisionResolutionModalProps {
  isOpen: boolean;
  targetPath: string;
  suggestedPath: string;
  isDirectory: boolean;
  onSelectAction: (action: CollisionAction) => void;
}

export const CollisionResolutionModal: React.FC<CollisionResolutionModalProps> = ({
  isOpen,
  targetPath,
  suggestedPath,
  isDirectory,
  onSelectAction,
}) => {
  if (!isOpen) return null;

  const targetName = targetPath.split(/[\\/]/).pop() || targetPath;
  const suggestedName = suggestedPath.split(/[\\/]/).pop() || suggestedPath;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="collision-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-amber-500/40 bg-slate-950 p-6 shadow-[0_0_50px_rgba(245,158,11,0.15)] flex flex-col gap-5 text-slate-100">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 id="collision-title" className="text-base font-bold text-slate-100">
                Destination {isDirectory ? "Directory" : "File"} Already Exists
              </h3>
              <p className="text-xs text-slate-400">
                A {isDirectory ? "folder" : "file"} named{" "}
                <span className="font-mono text-amber-300 font-semibold">{targetName}</span> already
                exists in this location.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectAction("cancel")}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Existing Path Display */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex flex-col gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            Target Destination
          </span>
          <div className="font-mono text-xs text-slate-200 break-all select-all bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
            {targetPath}
          </div>
        </div>

        {/* Action Choice Grid */}
        <div className="flex flex-col gap-2.5">
          {/* Option 1: Safe Auto-Version */}
          <button
            type="button"
            onClick={() => onSelectAction("auto_version")}
            className="group flex items-center justify-between gap-3 p-3.5 rounded-xl border border-cyan-500/40 bg-cyan-950/20 hover:bg-cyan-950/40 hover:border-cyan-400 text-left transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shrink-0">
                <FolderPlus className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-cyan-300 flex items-center gap-2">
                  <span>Create "{suggestedName}" (Recommended)</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-900/60 text-cyan-200 border border-cyan-700/50">
                    SAFE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Extracts safely into a new non-conflicting folder without modifying existing
                  files.
                </p>
              </div>
            </div>
            <CornerDownRight className="h-4 w-4 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>

          {/* Option 2: Overwrite & Merge */}
          <button
            type="button"
            onClick={() => onSelectAction("overwrite")}
            className="group flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-amber-500/40 text-left transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0">
                <FolderCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200 group-hover:text-amber-300 transition-colors">
                  Overwrite & Merge In-Place
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Extracts into <span className="font-mono text-slate-300">{targetName}</span>,
                  replacing any existing files with identical names.
                </p>
              </div>
            </div>
            <CornerDownRight className="h-4 w-4 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>

          {/* Option 3: Choose Different Location */}
          <button
            type="button"
            onClick={() => onSelectAction("choose_different")}
            className="group flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-700 text-left transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:outline-none"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                <FolderSearch className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">
                  Select Another Destination Directory
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Re-opens the system folder picker to select a completely different directory.
                </p>
              </div>
            </div>
            <CornerDownRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-slate-800/60">
          <button
            type="button"
            onClick={() => onSelectAction("cancel")}
            className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
