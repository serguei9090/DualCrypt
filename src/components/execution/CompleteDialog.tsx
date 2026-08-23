import { save } from "@tauri-apps/plugin-dialog";
import { ArrowRight, CheckCircle2, Download, FolderArchive, ShieldCheck } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { isTauriEnvironment, saveAllKeyFilesZip, saveKeyFile } from "../../lib/tauri";
import { cn, formatBytes } from "../../lib/utils";
import type { ExportedShare } from "../../types/container";

interface CompleteDialogProps {
  title: string;
  message: string;
  bytesProcessed: number;
  exportedShares?: ExportedShare[];
  onDone: () => void;
}

export const CompleteDialog: React.FC<CompleteDialogProps> = ({
  title,
  message,
  bytesProcessed,
  exportedShares = [],
  onDone,
}) => {
  const [savedStatus, setSavedStatus] = useState<Record<number, string>>({});
  const [zipSavedPath, setZipSavedPath] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSaveShare = async (share: ExportedShare) => {
    setSaveError(null);
    try {
      if (isTauriEnvironment()) {
        const sanitizedLabel = share.label.replace(/\s+/g, "_");
        const defaultFilename = `custodian_${share.custodian_id}_${sanitizedLabel}.dkey`;
        const path = await save({
          defaultPath: defaultFilename,
          filters: [{ name: "DualCrypt Key Share", extensions: ["dkey", "json"] }],
        });
        if (path) {
          await saveKeyFile(path, share.share);
          const fname = path.split(/[\\/]/).pop() || path;
          setSavedStatus((prev) => ({ ...prev, [share.custodian_id]: fname }));
        }
      } else {
        // Browser JSON download
        const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(
          JSON.stringify(share.share, null, 2),
        )}`;
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `custodian_${share.custodian_id}.dkey`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        setSavedStatus((prev) => ({
          ...prev,
          [share.custodian_id]: `custodian_${share.custodian_id}.dkey`,
        }));
      }
    } catch (err) {
      console.error("Save error:", err);
      setSaveError(`Failed to save key file: ${String(err)}`);
    }
  };

  const handleBulkSaveZip = async () => {
    if (exportedShares.length === 0) return;
    setSaveError(null);

    try {
      if (isTauriEnvironment()) {
        const path = await save({
          defaultPath: "all_custodian_keys.zip",
          filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
        });
        if (path) {
          await saveAllKeyFilesZip(path, exportedShares);
          const fname = path.split(/[\\/]/).pop() || path;
          setZipSavedPath(fname);
        }
      } else {
        // Browser fallback: download each or single JSON bundle
        const bundle = {
          description: "DualCrypt Enterprise Key Shares",
          timestamp: new Date().toISOString(),
          shares: exportedShares,
        };
        const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(
          JSON.stringify(bundle, null, 2),
        )}`;
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "all_custodian_keys_bundle.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        setZipSavedPath("all_custodian_keys_bundle.json");
      }
    } catch (err) {
      console.error("Bulk save error:", err);
      setSaveError(`Failed to save zip archive: ${String(err)}`);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-500/40 bg-zinc-950/95 p-6 shadow-2xl backdrop-blur-xl space-y-5">
      <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-zinc-100">{title}</h3>
          <p className="text-xs text-zinc-400">{message}</p>
        </div>
      </div>

      {saveError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300 font-mono">
          {saveError}
        </div>
      )}

      <div className="bg-zinc-900/60 rounded-xl p-4 border border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <span className="text-xs text-zinc-300 font-medium">Verified Payload Size:</span>
        </div>
        <span className="font-mono text-sm font-bold text-emerald-400">
          {formatBytes(bytesProcessed)}
        </span>
      </div>

      {exportedShares.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                Exported Custodian Key Shares ({exportedShares.length} Keys)
              </h4>
              <p className="text-[11px] text-zinc-400">
                Distribute each `.dkey` file to its authorized custodian for quorum reconstruction.
              </p>
            </div>

            {/* Bulk Save Zip Button */}
            <button
              type="button"
              onClick={handleBulkSaveZip}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all shadow-lg",
                zipSavedPath
                  ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                  : "border-cyan-500/50 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]",
              )}
            >
              {zipSavedPath ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>ZIP Saved: {zipSavedPath}</span>
                </>
              ) : (
                <>
                  <FolderArchive className="h-4 w-4" />
                  <span>Save All in ZIP Archive (.zip)</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-2 pt-1">
            {exportedShares.map((s) => {
              const isSaved = !!savedStatus[s.custodian_id];
              const savedName = savedStatus[s.custodian_id];

              return (
                <div
                  key={s.custodian_id}
                  className="flex items-center justify-between bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-xl hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs bg-zinc-800 text-cyan-400 px-2.5 py-1 rounded-lg border border-zinc-700 font-bold">
                      P{s.custodian_id}
                    </span>
                    <div>
                      <div className="text-xs text-zinc-100 font-medium">{s.label}</div>
                      <div className="text-[11px] text-zinc-500 font-mono">
                        {isSaved ? `✓ Saved: ${savedName}` : "Secret share ready for export"}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSaveShare(s)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                      isSaved
                        ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : "bg-zinc-800 hover:bg-cyan-600 text-zinc-200 hover:text-white border border-zinc-700 hover:border-cyan-500",
                    )}
                  >
                    {isSaved ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Re-save .dkey
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5" /> Save .dkey
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-zinc-850">
        <button
          type="button"
          onClick={onDone}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3.5 text-xs font-bold text-white transition-colors shadow-lg"
        >
          <span>Return to Workspace</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
