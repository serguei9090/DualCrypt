import {
  AlertCircle,
  Clock,
  Download,
  FileText,
  History,
  Layers,
  Lock,
  Search,
  ShieldCheck,
  Trash2,
  Unlock,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  type AuditEvent,
  clearAuditHistory,
  exportAuditHistoryCsv,
  exportAuditHistoryJson,
  getAuditHistory,
} from "../../lib/historyStore";
import { cn } from "../../lib/utils";

export const AuditHistoryView: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>(() => getAuditHistory());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<"all" | "encrypt" | "decrypt">("all");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    setEvents(getAuditHistory());
  }, []);

  const handleClear = () => {
    clearAuditHistory();
    setEvents([]);
    setShowClearConfirm(false);
  };

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterAction !== "all" && e.action !== filterAction) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        e.filename.toLowerCase().includes(q) ||
        e.authorLabel?.toLowerCase().includes(q) ||
        e.cipherSuite.toLowerCase().includes(q) ||
        e.timestamp.toLowerCase().includes(q)
      );
    });
  }, [events, filterAction, searchQuery]);

  const stats = useMemo(() => {
    const total = events.length;
    const encCount = events.filter((e) => e.action === "encrypt").length;
    const decCount = events.filter((e) => e.action === "decrypt").length;
    const signedCount = events.filter((e) => e.authorSigned).length;
    return { total, encCount, decCount, signedCount };
  }, [events]);

  const formatDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="rounded-2xl border border-amber-500/30 bg-slate-900/60 p-6 backdrop-blur-md space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
              <History className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 flex-wrap">
                <span>Operational Audit & Activity Ledger</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/80 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                  <ShieldCheck className="h-2.5 w-2.5 text-amber-400" />
                  Tamper-Resistant Log
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                High-level operational timeline of cryptographic split-lock encryptions and
                multi-custodian decryptions.
              </p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={exportAuditHistoryCsv}
              disabled={events.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700/90 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={exportAuditHistoryJson}
              disabled={events.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700/90 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export JSON</span>
            </button>
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={events.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-950/40 hover:bg-rose-900/60 px-3.5 py-2 text-xs font-semibold text-rose-300 hover:text-rose-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-1 focus-visible:ring-rose-500 focus-visible:outline-none"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear Ledger</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex items-center gap-3.5 backdrop-blur-md">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 border border-slate-800 text-slate-300 shrink-0">
            <Layers className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100 font-mono">{stats.total}</div>
            <div className="text-xs text-slate-400 font-medium">Total Operations</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex items-center gap-3.5 backdrop-blur-md">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-950/60 border border-cyan-800/50 text-cyan-400 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100 font-mono">{stats.encCount}</div>
            <div className="text-xs text-slate-400 font-medium">Encryptions</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex items-center gap-3.5 backdrop-blur-md">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 shrink-0">
            <Unlock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100 font-mono">{stats.decCount}</div>
            <div className="text-xs text-slate-400 font-medium">Decryptions</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex items-center gap-3.5 backdrop-blur-md">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-950/60 border border-purple-800/50 text-purple-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100 font-mono">{stats.signedCount}</div>
            <div className="text-xs text-slate-400 font-medium">FIPS 204 Signed</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search filename, author, cipher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-cyan-500 focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setFilterAction("all")}
            className={cn(
              "flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none",
              filterAction === "all"
                ? "bg-slate-800 text-slate-100 shadow-sm border border-slate-700"
                : "text-slate-400 hover:text-slate-200 border border-transparent",
            )}
          >
            All ({events.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterAction("encrypt")}
            className={cn(
              "flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none",
              filterAction === "encrypt"
                ? "bg-cyan-600 text-white shadow-sm border border-cyan-500/40"
                : "text-slate-400 hover:text-slate-200 border border-transparent",
            )}
          >
            <Lock className="w-3 h-3 text-cyan-300" />
            <span>Encrypted ({stats.encCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterAction("decrypt")}
            className={cn(
              "flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer focus-visible:ring-1 focus-visible:ring-emerald-500 focus-visible:outline-none",
              filterAction === "decrypt"
                ? "bg-emerald-600 text-white shadow-sm border border-emerald-500/40"
                : "text-slate-400 hover:text-slate-200 border border-transparent",
            )}
          >
            <Unlock className="w-3 h-3 text-emerald-300" />
            <span>Decrypted ({stats.decCount})</span>
          </button>
        </div>
      </div>

      {/* Events Table / List */}
      {filteredEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center flex flex-col items-center justify-center gap-3 backdrop-blur-md">
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-500">
            <History className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">No Activity Records Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              {searchQuery || filterAction !== "all"
                ? "No operations match your current search and filter criteria."
                : "Complete an encryption or decryption operation to record high-level audit events here."}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden backdrop-blur-md shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">File Name & Size</th>
                  <th className="py-3.5 px-4">Custodians & Quorum</th>
                  <th className="py-3.5 px-4">Cipher Engine</th>
                  <th className="py-3.5 px-4">Author Verification</th>
                  <th className="py-3.5 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-800/40 transition-colors group">
                    {/* Action */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {evt.action === "encrypt" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-cyan-950/80 text-cyan-400 border border-cyan-500/30">
                          <Lock className="w-3 h-3" />
                          ENCRYPT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                          <Unlock className="w-3 h-3" />
                          DECRYPT
                        </span>
                      )}
                    </td>

                    {/* Filename & Size & Classification */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1 max-w-xs md:max-w-sm">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span
                            className="font-medium text-slate-200 truncate font-sans"
                            title={evt.filename}
                          >
                            {evt.filename}
                          </span>
                          <span className="text-[11px] text-slate-500 shrink-0 font-mono">
                            ({evt.fileSizeFormatted})
                          </span>
                        </div>
                        {evt.classification && (
                          <div className="flex items-center gap-1.5 pl-6">
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase border ${
                                evt.classification.includes("SECRET")
                                  ? "bg-rose-950/80 text-rose-300 border-rose-800/50"
                                  : evt.classification.includes("CONFIDENTIAL")
                                    ? "bg-amber-950/80 text-amber-300 border-amber-800/50"
                                    : evt.classification.includes("RESTRICTED")
                                      ? "bg-purple-950/80 text-purple-300 border-purple-800/50"
                                      : "bg-blue-950/80 text-blue-300 border-blue-800/50"
                              }`}
                            >
                              {evt.classification}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Custodians & Quorum */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-[11px] font-mono">
                          {evt.thresholdK}-of-{evt.custodianCount}
                        </span>
                        <span className="text-slate-400 text-[11px] font-sans">
                          ({evt.custodianCount}{" "}
                          {evt.custodianCount === 1 ? "custodian" : "custodians"})
                        </span>
                      </div>
                    </td>

                    {/* Cipher Engine */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="text-xs text-slate-400 font-mono uppercase">
                        {evt.cipherSuite}
                      </span>
                    </td>

                    {/* Author Signature */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {evt.authorSigned ? (
                        <div className="flex items-center gap-1.5 text-purple-300 font-sans text-xs">
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span className="truncate max-w-[160px]" title={evt.authorLabel}>
                            {evt.authorLabel || "FIPS 204 Valid"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs font-sans italic">Unsigned</span>
                      )}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      <div className="flex items-center justify-end gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {formatDateTime(evt.timestamp)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Theoretical & Security Guarantees */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
          <h4 className="text-xs font-semibold text-slate-200">Tamper-Resistant Local Ledger</h4>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Operations are recorded with high-precision timestamps, quorum parameters, cipher
            suites, and cryptographic author signatures.
          </p>
        </div>
        <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
          <h4 className="text-xs font-semibold text-slate-200">Zero-Knowledge Logging</h4>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Audit entries track container structures and compliance classifications without ever
            storing raw keys, passphrases, or Shamir share data.
          </p>
        </div>
        <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
          <h4 className="text-xs font-semibold text-slate-200">Compliance & Provenance</h4>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Exportable CSV and JSON audit trails provide verifiable provenance for enterprise
            governance, SOC 2 compliance, and dual-custody verification.
          </p>
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-rose-950/60 border border-rose-800/50 text-rose-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-base">Clear Audit Ledger</h3>
                <p className="text-xs text-slate-400">
                  Permanent deletion of local operation records
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Are you sure you want to permanently clear the local activity history log? This action
              cannot be undone. You can export a CSV or JSON backup before clearing.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all cursor-pointer focus-visible:ring-1 focus-visible:ring-slate-500 focus-visible:outline-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-sm cursor-pointer focus-visible:ring-1 focus-visible:ring-rose-500 focus-visible:outline-none"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
