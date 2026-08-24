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
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                Operational Audit & Activity Ledger
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 font-mono">
                  Tamper-Resistant Log
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                High-level operational timeline of cryptographic split-lock encryptions and
                multi-custodian decryptions.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportAuditHistoryCsv}
            disabled={events.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/80 hover:bg-secondary text-foreground border border-border/60 hover:border-border transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={exportAuditHistoryJson}
            disabled={events.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/80 hover:bg-secondary text-foreground border border-border/60 hover:border-border transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            disabled={events.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 hover:border-destructive/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Ledger
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card/40 border border-border/60 rounded-xl p-4 flex items-center gap-3.5 backdrop-blur-sm">
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground font-mono">{stats.total}</div>
            <div className="text-xs text-muted-foreground font-medium">Total Operations</div>
          </div>
        </div>

        <div className="bg-card/40 border border-border/60 rounded-xl p-4 flex items-center gap-3.5 backdrop-blur-sm">
          <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground font-mono">{stats.encCount}</div>
            <div className="text-xs text-muted-foreground font-medium">Encryptions</div>
          </div>
        </div>

        <div className="bg-card/40 border border-border/60 rounded-xl p-4 flex items-center gap-3.5 backdrop-blur-sm">
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Unlock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground font-mono">{stats.decCount}</div>
            <div className="text-xs text-muted-foreground font-medium">Decryptions</div>
          </div>
        </div>

        <div className="bg-card/40 border border-border/60 rounded-xl p-4 flex items-center gap-3.5 backdrop-blur-sm">
          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground font-mono">{stats.signedCount}</div>
            <div className="text-xs text-muted-foreground font-medium">FIPS 204 Signed</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card/30 border border-border/60 rounded-xl p-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search filename, author, cipher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background/80 border border-border/60 rounded-lg pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setFilterAction("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              filterAction === "all"
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-secondary/50 text-muted-foreground hover:text-foreground border border-border/40"
            }`}
          >
            All ({events.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterAction("encrypt")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
              filterAction === "encrypt"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "bg-secondary/50 text-muted-foreground hover:text-foreground border border-border/40"
            }`}
          >
            <Lock className="w-3 h-3" />
            Encrypted ({stats.encCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterAction("decrypt")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
              filterAction === "decrypt"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-secondary/50 text-muted-foreground hover:text-foreground border border-border/40"
            }`}
          >
            <Unlock className="w-3 h-3" />
            Decrypted ({stats.decCount})
          </button>
        </div>
      </div>

      {/* Events Table / List */}
      {filteredEvents.length === 0 ? (
        <div className="border border-border/60 border-dashed rounded-2xl p-12 text-center bg-card/20 flex flex-col items-center justify-center gap-3">
          <div className="p-3.5 rounded-full bg-secondary/60 border border-border/60 text-muted-foreground">
            <History className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">No Activity Records Found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {searchQuery || filterAction !== "all"
                ? "No operations match your current search and filter criteria."
                : "Complete an encryption or decryption operation to record high-level audit events here."}
            </p>
          </div>
        </div>
      ) : (
        <div className="border border-border/60 rounded-xl overflow-hidden bg-card/20 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-secondary/40 border-b border-border/60 text-muted-foreground font-semibold">
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">File Name & Size</th>
                  <th className="py-3 px-4">Custodians & Quorum</th>
                  <th className="py-3 px-4">Cipher Engine</th>
                  <th className="py-3 px-4">Author Verification</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-secondary/20 transition-colors group">
                    {/* Action */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {evt.action === "encrypt" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                          <Lock className="w-3 h-3" />
                          ENCRYPT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                          <Unlock className="w-3 h-3" />
                          DECRYPT
                        </span>
                      )}
                    </td>

                    {/* Filename & Size */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 max-w-xs md:max-w-sm">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <span
                          className="font-medium text-foreground truncate font-sans"
                          title={evt.filename}
                        >
                          {evt.filename}
                        </span>
                        <span className="text-[11px] text-muted-foreground shrink-0 font-mono">
                          ({evt.fileSizeFormatted})
                        </span>
                      </div>
                    </td>

                    {/* Custodians & Quorum */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-secondary/80 border border-border/60 text-foreground text-[11px] font-mono">
                          {evt.thresholdK}-of-{evt.custodianCount}
                        </span>
                        <span className="text-muted-foreground text-[11px] font-sans">
                          ({evt.custodianCount}{" "}
                          {evt.custodianCount === 1 ? "custodian" : "custodians"})
                        </span>
                      </div>
                    </td>

                    {/* Cipher Suite */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-xs text-muted-foreground font-mono uppercase">
                        {evt.cipherSuite}
                      </span>
                    </td>

                    {/* Author Signature */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {evt.authorSigned ? (
                        <div className="flex items-center gap-1.5 text-purple-400 font-sans text-xs">
                          <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                          <span className="truncate max-w-[160px]" title={evt.authorLabel}>
                            {evt.authorLabel || "FIPS 204 Valid"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60 text-xs font-sans italic">
                          Unsigned
                        </span>
                      )}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3 px-4 text-right whitespace-nowrap text-muted-foreground font-sans text-[11px]">
                      <div className="flex items-center justify-end gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground/70" />
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

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <div className="p-3 rounded-full bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-base">Clear Audit Ledger</h3>
                <p className="text-xs text-muted-foreground">
                  Permanent deletion of local operation records
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to permanently clear the local activity history log? This action
              cannot be undone. You can export a CSV or JSON backup before clearing.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-all cursor-pointer"
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
