import { Atom, FileKey, KeyRound, Plus, Search, Trash2, Unlock } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { deleteVaultKey, type VaultKeyItem } from "../lib/vaultStorage";

interface VaultViewProps {
  keys: VaultKeyItem[];
  onKeysChanged: () => void;
  onOpenEnrollScanner: () => void;
  onOpenDecryptScanner: () => void;
}

export const VaultView: React.FC<VaultViewProps> = ({
  keys,
  onKeysChanged,
  onOpenEnrollScanner,
  onOpenDecryptScanner,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const handleDelete = (id: string, fileName: string) => {
    if (window.confirm(`Delete key for "${fileName}" from your authenticator?`)) {
      deleteVaultKey(id);
      onKeysChanged();
    }
  };

  const filteredKeys = keys.filter(
    (k) =>
      k.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.custodianLabel.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="w-full space-y-4 animate-in fade-in">
      {/* Top Primary Actions */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onOpenEnrollScanner}
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all cursor-pointer text-center"
        >
          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 mb-1.5">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold">Scan & Add Key</span>
          <span className="text-[10px] text-zinc-400 font-mono">From Encrypt Screen</span>
        </button>

        <button
          type="button"
          onClick={onOpenDecryptScanner}
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all cursor-pointer text-center"
        >
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 mb-1.5">
            <Unlock className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold">Authorize Decrypt</span>
          <span className="text-[10px] text-zinc-400 font-mono">Scan Unlock QR</span>
        </button>
      </div>

      {/* Vault Header & Search */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-200">
            <KeyRound className="w-4 h-4 text-cyan-400" />
            <span>Stored Custodian Keys ({keys.length})</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-2 py-0.5 rounded-full">
            Hardware Enclave
          </span>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search keys by filename or role..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-xs text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Keys List */}
      <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-0.5">
        {filteredKeys.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center space-y-2">
            <FileKey className="w-8 h-8 text-zinc-600 mx-auto" />
            <div className="text-xs font-semibold text-zinc-400">No Keys in Offline Vault</div>
            <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
              When encrypting a file on the desktop, tap <strong>Scan to Phone (QR)</strong> and use
              the <strong>Scan & Add Key</strong> button above to save your key.
            </p>
          </div>
        ) : (
          filteredKeys.map((keyItem) => (
            <div
              key={keyItem.id}
              className="rounded-2xl border border-zinc-800/90 bg-zinc-900/70 p-3.5 space-y-2.5 hover:border-zinc-700 transition-all relative overflow-hidden"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0 mt-0.5">
                    {keyItem.authType === "pqc" ? (
                      <Atom className="w-4 h-4 text-purple-400" />
                    ) : (
                      <FileKey className="w-4 h-4 text-cyan-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate font-mono">
                      {keyItem.fileName}
                    </div>
                    <div className="text-[11px] text-zinc-300 font-medium truncate">
                      Custodian {keyItem.custodianId}: {keyItem.custodianLabel}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(keyItem.id, keyItem.fileName)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer shrink-0"
                  title="Delete key from vault"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-zinc-800/80 pt-2 text-[10px] font-mono text-zinc-500">
                <span
                  className={`px-2 py-0.5 rounded-md font-semibold ${
                    keyItem.authType === "pqc"
                      ? "bg-purple-950/60 text-purple-300 border border-purple-800/40"
                      : "bg-cyan-950/60 text-cyan-300 border border-cyan-800/40"
                  }`}
                >
                  {keyItem.authType === "pqc" ? "⚛️ ML-KEM-768 PQC" : "🔑 SSS Key Share"}
                </span>
                <span>Enrolled: {new Date(keyItem.enrolledAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
