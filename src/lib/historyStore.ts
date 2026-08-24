export interface AuditEvent {
  id: string;
  action: "encrypt" | "decrypt";
  filename: string;
  fileSizeFormatted: string;
  rawSizeBytes?: number;
  custodianCount: number;
  thresholdK: number;
  cipherSuite: string;
  authorSigned: boolean;
  authorLabel?: string;
  status: "completed" | "failed";
  timestamp: string;
  notes?: string;
}

const STORAGE_KEY = "dualcrypt_audit_log_v1";

export const isAuditHistoryEnabled = (): boolean => {
  return import.meta.env.VITE_ENABLE_AUDIT_HISTORY !== "false";
};

export const getAuditHistory = (): AuditEvent[] => {
  if (!isAuditHistoryEnabled()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AuditEvent[];
  } catch (err) {
    console.error("Failed to load audit history:", err);
    return [];
  }
};

export const logAuditEvent = (event: Omit<AuditEvent, "id" | "timestamp">): void => {
  if (!isAuditHistoryEnabled()) return;
  try {
    const current = getAuditHistory();
    const newEntry: AuditEvent = {
      ...event,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    const updated = [newEntry, ...current].slice(0, 500); // retain last 500 records
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to save audit event:", err);
  }
};

export const clearAuditHistory = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear audit history:", err);
  }
};

export const exportAuditHistoryJson = (): void => {
  const data = getAuditHistory();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dualcrypt_audit_log_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportAuditHistoryCsv = (): void => {
  const data = getAuditHistory();
  if (data.length === 0) return;

  const headers = [
    "Timestamp",
    "Action",
    "Filename",
    "Size",
    "Custodians",
    "Threshold (k-of-n)",
    "Cipher Suite",
    "Author Signed",
    "Author Label",
    "Status",
  ];

  const rows = data.map((e) => [
    `"${e.timestamp}"`,
    `"${e.action.toUpperCase()}"`,
    `"${e.filename.replace(/"/g, '""')}"`,
    `"${e.fileSizeFormatted}"`,
    e.custodianCount,
    `"${e.thresholdK}-of-${e.custodianCount}"`,
    `"${e.cipherSuite}"`,
    e.authorSigned ? "YES" : "NO",
    `"${(e.authorLabel || "N/A").replace(/"/g, '""')}"`,
    `"${e.status.toUpperCase()}"`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dualcrypt_audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
