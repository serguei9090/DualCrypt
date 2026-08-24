import {
  Atom,
  ChevronRight,
  FileKey,
  KeyRound,
  Plus,
  Search,
  Shield,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { deleteVaultKey, type VaultKeyItem } from "../lib/vaultStorage";

interface VaultViewProps {
  keys: VaultKeyItem[];
  theme: "dark" | "light";
  onKeysChanged: () => void;
  onOpenEnrollScanner: () => void;
  onOpenDecryptScanner: () => void;
}

export const VaultView: React.FC<VaultViewProps> = ({
  keys,
  theme,
  onKeysChanged,
  onOpenEnrollScanner,
  onOpenDecryptScanner,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedKey, setSelectedKey] = useState<VaultKeyItem | null>(null);

  const handleDelete = (id: string, fileName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (window.confirm(`Delete key for "${fileName}" from your offline authenticator?`)) {
      deleteVaultKey(id);
      if (selectedKey?.id === id) {
        setSelectedKey(null);
      }
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
      {/* Top Primary Actions (Sleek Glassmorphic Action Cards) */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onOpenEnrollScanner}
          className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all cursor-pointer text-center group focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none ${
            theme === "dark"
              ? "bg-gradient-to-b from-cyan-950/40 to-slate-950/70 hover:from-cyan-900/50 hover:to-slate-900 border-cyan-500/40 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.15)]"
              : "bg-gradient-to-b from-cyan-50 to-white hover:from-cyan-100 hover:to-white border-cyan-300 text-cyan-800 shadow-sm"
          }`}
        >
          <div
            className={`p-2.5 rounded-xl border mb-2 transition-transform group-hover:scale-110 ${
              theme === "dark"
                ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-400"
                : "bg-cyan-600/10 border-cyan-600/30 text-cyan-700"
            }`}
          >
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold tracking-tight">Scan & Add Key</span>
          <span
            className={`text-[10px] font-mono mt-0.5 ${
              theme === "dark" ? "text-slate-400" : "text-slate-500"
            }`}
          >
            From Encrypt Screen
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenDecryptScanner}
          className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all cursor-pointer text-center group focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none ${
            theme === "dark"
              ? "bg-gradient-to-b from-emerald-950/40 to-slate-950/70 hover:from-emerald-900/50 hover:to-slate-900 border-emerald-500/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
              : "bg-gradient-to-b from-emerald-50 to-white hover:from-emerald-100 hover:to-white border-emerald-300 text-emerald-800 shadow-sm"
          }`}
        >
          <div
            className={`p-2.5 rounded-xl border mb-2 transition-transform group-hover:scale-110 ${
              theme === "dark"
                ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-400"
                : "bg-emerald-600/10 border-emerald-600/30 text-emerald-700"
            }`}
          >
            <Unlock className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold tracking-tight">Authorize Decrypt</span>
          <span
            className={`text-[10px] font-mono mt-0.5 ${
              theme === "dark" ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Auto-Match & Unlock
          </span>
        </button>
      </div>

      {/* Vault Header & Search */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <div
            className={`flex items-center gap-1.5 text-xs font-bold ${
              theme === "dark" ? "text-slate-200" : "text-slate-800"
            }`}
          >
            <KeyRound className="w-4 h-4 text-cyan-400" />
            <span>Stored Custodian Keys ({keys.length})</span>
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              theme === "dark"
                ? "text-emerald-400 bg-emerald-950/50 border-emerald-800/40"
                : "text-emerald-700 bg-emerald-50 border-emerald-200"
            }`}
          >
            Hardware Enclave
          </span>
        </div>

        <div className="relative">
          <Search
            className={`absolute left-3 top-2.5 w-3.5 h-3.5 ${
              theme === "dark" ? "text-slate-500" : "text-slate-400"
            }`}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search keys by filename or role..."
            className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-xs transition-all focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none ${
              theme === "dark"
                ? "border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus:border-cyan-500"
                : "border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-cyan-600 shadow-sm"
            }`}
          />
        </div>
      </div>

      {/* Keys List */}
      <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-0.5">
        {filteredKeys.length === 0 ? (
          <div
            className={`rounded-2xl border border-dashed p-8 text-center space-y-2 ${
              theme === "dark"
                ? "border-slate-800 bg-slate-950/30 text-slate-400"
                : "border-slate-300 bg-white text-slate-600"
            }`}
          >
            <FileKey
              className={`w-8 h-8 mx-auto ${theme === "dark" ? "text-slate-600" : "text-slate-400"}`}
            />
            <div className="text-xs font-semibold">No Keys in Offline Vault</div>
            <p
              className={`text-[11px] max-w-xs mx-auto ${
                theme === "dark" ? "text-slate-500" : "text-slate-400"
              }`}
            >
              When encrypting on desktop, click <strong>📲 Scan to Phone (QR)</strong> and scan it
              with the <strong>Scan & Add Key</strong> button above.
            </p>
          </div>
        ) : (
          filteredKeys.map((keyItem) => (
            <div
              key={keyItem.id}
              className={`rounded-2xl border p-3.5 space-y-2.5 transition-all relative overflow-hidden ${
                theme === "dark"
                  ? "border-slate-800/90 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900"
                  : "border-slate-200 bg-white hover:border-cyan-300 hover:shadow-md"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedKey(keyItem)}
                  className="flex items-start gap-2.5 min-w-0 flex-1 text-left cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none rounded-xl p-1 -m-1"
                >
                  <div
                    className={`p-2 rounded-xl border shrink-0 mt-0.5 ${
                      keyItem.authType === "pqc"
                        ? theme === "dark"
                          ? "bg-purple-950/50 border-purple-500/30 text-purple-400"
                          : "bg-purple-50 border-purple-200 text-purple-700"
                        : theme === "dark"
                          ? "bg-cyan-950/50 border-cyan-500/30 text-cyan-400"
                          : "bg-cyan-50 border-cyan-200 text-cyan-700"
                    }`}
                  >
                    {keyItem.authType === "pqc" ? (
                      <Atom className="w-4 h-4" />
                    ) : (
                      <FileKey className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-xs font-bold truncate font-mono ${
                        theme === "dark" ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {keyItem.fileName}
                    </div>
                    <div
                      className={`text-[11px] font-medium truncate ${
                        theme === "dark" ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      Custodian {keyItem.custodianId}: {keyItem.custodianLabel}
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 mt-2 shrink-0 ${
                      theme === "dark" ? "text-slate-600" : "text-slate-300"
                    }`}
                  />
                </button>

                <button
                  type="button"
                  onClick={(e) => handleDelete(keyItem.id, keyItem.fileName, e)}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none ${
                    theme === "dark"
                      ? "text-slate-500 hover:text-rose-400 hover:bg-rose-950/30"
                      : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  }`}
                  title="Delete key"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div
                className={`flex items-center justify-between border-t pt-2 text-[10px] font-mono ${
                  theme === "dark"
                    ? "border-slate-800/80 text-slate-500"
                    : "border-slate-100 text-slate-400"
                }`}
              >
                <span
                  className={`px-2 py-0.5 rounded-md font-semibold border ${
                    keyItem.authType === "pqc"
                      ? theme === "dark"
                        ? "bg-purple-950/60 text-purple-300 border-purple-800/40"
                        : "bg-purple-50 text-purple-700 border-purple-200"
                      : theme === "dark"
                        ? "bg-cyan-950/60 text-cyan-300 border-cyan-800/40"
                        : "bg-cyan-50 text-cyan-700 border-cyan-200"
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

      {/* Key Detail Sheet / Modal */}
      {selectedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div
            className={`w-full max-w-sm rounded-2xl border p-5 space-y-4 shadow-2xl relative ${
              theme === "dark"
                ? "bg-slate-950 border-slate-800 text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-start justify-between border-b pb-3 border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold font-mono">Key Enclave Details</div>
                  <div className="text-[10px] text-slate-500">Offline Hardware Enclave</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedKey(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <div className="text-[10px] font-mono text-slate-500 uppercase">
                  Target Container
                </div>
                <div className="font-mono font-bold text-sm text-cyan-400">
                  {selectedKey.fileName}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-mono text-slate-500 uppercase">Custodian Role</div>
                <div className="font-semibold text-slate-200">
                  Slot #{selectedKey.custodianId} — {selectedKey.custodianLabel}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-mono text-slate-500 uppercase">
                  Cryptographic Standard
                </div>
                <div className="font-mono text-xs text-purple-400">
                  {selectedKey.authType === "pqc"
                    ? "NIST FIPS 203 ML-KEM-768 (Kyber)"
                    : "Shamir Secret Sharing GF(256)"}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-mono text-slate-500 uppercase">
                  Enrolled Timestamp
                </div>
                <div className="font-mono text-xs text-slate-400">
                  {new Date(selectedKey.enrolledAt).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setSelectedKey(null);
                  onOpenDecryptScanner();
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-lg transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
              >
                <Unlock className="w-4 h-4" />
                <span>Ready to Authorize Decryption</span>
              </button>

              <button
                type="button"
                onClick={() => handleDelete(selectedKey.id, selectedKey.fileName)}
                className="w-full py-2 text-center text-xs font-semibold text-rose-400 hover:text-rose-300 cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none rounded-lg"
              >
                Delete Key from Enclave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
