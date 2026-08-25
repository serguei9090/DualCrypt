import { save } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  ArrowRight,
  Atom,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileKey,
  FolderArchive,
  KeyRound,
  Mail,
  Send,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import {
  isTauriEnvironment,
  loadSmtpConfig,
  type SmtpConfig,
  saveAllKeyFilesZip,
  saveKeyFile,
  sendCustodianKeyEmail,
} from "../../lib/tauri";
import { cn, formatBytes } from "../../lib/utils";
import type { ExportedShare } from "../../types/container";

interface CompleteDialogProps {
  title: string;
  message: string;
  bytesProcessed: number;
  exportedShares?: ExportedShare[];
  containerFilename?: string;
  containerBytes?: Uint8Array;
  isDecryption?: boolean;
  decryptedBytes?: Uint8Array;
  decryptedFilename?: string;
  onDone: () => void;
  onEnrollPhone?: (share: ExportedShare) => void;
}

export const CompleteDialog: React.FC<CompleteDialogProps> = ({
  title,
  message,
  bytesProcessed,
  exportedShares = [],
  containerFilename,
  containerBytes,
  isDecryption = false,
  decryptedBytes,
  decryptedFilename,
  onDone,
  onEnrollPhone,
}) => {
  const [savedStatus, setSavedStatus] = useState<Record<number, string>>({});
  const [zipSavedPath, setZipSavedPath] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [containerDownloaded, setContainerDownloaded] = useState(false);

  // PIN protection per share
  const [sharePins, setSharePins] = useState<Record<number, string>>({});

  // Email modal state
  const [emailModalShare, setEmailModalShare] = useState<ExportedShare | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccessMsg, setEmailSuccessMsg] = useState<string | null>(null);

  const handleDownloadContainer = () => {
    if (!containerBytes) return;
    const blob = new Blob([containerBytes as unknown as BlobPart], {
      type: "application/octet-stream",
    });
    const fname = containerFilename || "encrypted_file.denc";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setContainerDownloaded(true);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const handleDownloadDecrypted = () => {
    if (!decryptedBytes) return;
    const blob = new Blob([decryptedBytes as unknown as BlobPart], {
      type: "application/octet-stream",
    });
    const fname = decryptedFilename || "restored_file.bin";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setContainerDownloaded(true);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  useEffect(() => {
    loadSmtpConfig().then((cfg) => {
      if (cfg) setSmtpConfig(cfg);
    });
  }, []);

  const handleCopyText = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveShare = async (share: ExportedShare) => {
    setSaveError(null);
    try {
      const pin = sharePins[share.custodian_id]?.trim() || undefined;
      const sanitizedLabel = share.label.replace(/\s+/g, "_");
      const isPqc = share.auth_type === "pqc" || !!share.pqc_private_key_base64;

      if (isTauriEnvironment()) {
        const defaultFilename = isPqc
          ? `custodian_${share.custodian_id}_${sanitizedLabel}.pqc`
          : `custodian_${share.custodian_id}_${sanitizedLabel}.dkey`;

        const filterName = isPqc ? "Post-Quantum Key File" : "DualCrypt Key Share";
        const extensions = isPqc ? ["pqc", "json"] : ["dkey", "json"];

        const path = await save({
          defaultPath: defaultFilename,
          filters: [{ name: filterName, extensions }],
        });

        if (path) {
          if (isPqc) {
            await saveKeyFile(
              path,
              undefined,
              pin,
              share.pqc_public_key_base64,
              share.pqc_private_key_base64,
              share.custodian_id,
              share.label,
            );
          } else {
            await saveKeyFile(path, share.share, pin);
          }

          const fname = path.split(/[\\/]/).pop() || path;
          setSavedStatus((prev) => ({
            ...prev,
            [share.custodian_id]: `${fname}${pin ? " (PIN Protected)" : ""}`,
          }));
        }
      } else {
        const defaultFilename = isPqc
          ? `custodian_${share.custodian_id}.pqc`
          : `custodian_${share.custodian_id}.dkey`;

        const payloadObj = isPqc
          ? {
              algorithm: "NIST-FIPS-203-ML-KEM-768",
              custodian_id: share.custodian_id,
              label: share.label,
              public_key_base64: share.pqc_public_key_base64,
              private_key_base64: share.pqc_private_key_base64,
              pin_protected: !!pin,
            }
          : share.share;

        const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(
          JSON.stringify(payloadObj, null, 2),
        )}`;
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", defaultFilename);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        setSavedStatus((prev) => ({
          ...prev,
          [share.custodian_id]: defaultFilename,
        }));
      }
    } catch (err) {
      console.error("Save error:", err);
      setSaveError(`Failed to save key file: ${String(err)}`);
    }
  };

  const handleSavePublicKey = async (share: ExportedShare) => {
    if (!share.pqc_public_key_base64) return;
    setSaveError(null);
    try {
      const sanitizedLabel = share.label.replace(/\s+/g, "_");
      const defaultFilename = `custodian_${share.custodian_id}_${sanitizedLabel}.pqc.pub`;

      if (isTauriEnvironment()) {
        const path = await save({
          defaultPath: defaultFilename,
          filters: [{ name: "Post-Quantum Public Key", extensions: ["pqc.pub", "pub", "json"] }],
        });
        if (path) {
          await saveKeyFile(
            path,
            undefined,
            undefined,
            share.pqc_public_key_base64,
            undefined,
            share.custodian_id,
            share.label,
          );
        }
      } else {
        const payloadObj = {
          algorithm: "NIST-FIPS-203-ML-KEM-768",
          type: "public_key",
          custodian_id: share.custodian_id,
          label: share.label,
          public_key_base64: share.pqc_public_key_base64,
        };
        const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(
          JSON.stringify(payloadObj, null, 2),
        )}`;
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", defaultFilename);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      }
    } catch (err) {
      console.error("Save public key error:", err);
      setSaveError(`Failed to save public key: ${String(err)}`);
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
          await saveAllKeyFilesZip(path, exportedShares, sharePins);
          const fname = path.split(/[\\/]/).pop() || path;
          setZipSavedPath(fname);
        }
      } else {
        const bundle = {
          description: "DualCrypt Enterprise Key Shares & Post-Quantum Tokens",
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

  const handleOpenEmailModal = (share: ExportedShare) => {
    setEmailModalShare(share);
    setRecipientEmail("");
    setCustomNote("");
    setEmailSuccessMsg(null);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailModalShare || !recipientEmail) return;

    if (!smtpConfig) {
      setSaveError("SMTP server is not configured. Please configure SMTP in the Settings tab.");
      return;
    }

    setIsSendingEmail(true);
    setSaveError(null);

    try {
      const pin = sharePins[emailModalShare.custodian_id]?.trim() || undefined;
      const isPqc = emailModalShare.auth_type === "pqc" || !!emailModalShare.pqc_private_key_base64;
      const ext = isPqc ? "pqc" : "dkey";
      const shareFilename = `custodian_${emailModalShare.custodian_id}_${emailModalShare.label.replace(/\s+/g, "_")}.${ext}`;

      const shareContent = isPqc
        ? JSON.stringify(
            {
              algorithm: "NIST-FIPS-203-ML-KEM-768",
              custodian_id: emailModalShare.custodian_id,
              label: emailModalShare.label,
              public_key_base64: emailModalShare.pqc_public_key_base64,
              private_key_base64: emailModalShare.pqc_private_key_base64,
            },
            null,
            2,
          )
        : JSON.stringify(emailModalShare.share, null, 2);

      const res = await sendCustodianKeyEmail({
        config: smtpConfig,
        recipient_email: recipientEmail,
        custodian_label: emailModalShare.label,
        share_filename: shareFilename,
        share_content: shareContent,
        is_pin_protected: !!pin,
        pin_code: pin,
        custom_note: customNote,
      });

      setEmailSuccessMsg(res);
      setSavedStatus((prev) => ({
        ...prev,
        [emailModalShare.custodian_id]: `Emailed to ${recipientEmail}`,
      }));
    } catch (err) {
      setSaveError(`Failed to send email: ${String(err)}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-500/40 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-100">{title}</h3>
          <p className="text-xs text-slate-400">{message}</p>
        </div>
      </div>

      {saveError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300 font-mono">
          {saveError}
        </div>
      )}

      {/* Primary Encrypted Container / Decrypted File Action Card */}
      {!isDecryption && (
        <div className="rounded-xl border border-cyan-500/50 bg-gradient-to-r from-cyan-950/60 to-slate-900/80 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[0_0_25px_rgba(6,182,212,0.15)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shrink-0">
              <Download className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-100 font-mono flex items-center gap-2">
                <span>{containerFilename || "encrypted_payload.denc"}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                  .DENC CONTAINER
                </span>
              </div>
              <p className="text-[11px] text-cyan-200/80 mt-0.5">
                {isTauriEnvironment()
                  ? "Encrypted container file written to disk."
                  : containerDownloaded
                    ? "✓ Encrypted container downloaded to your browser."
                    : "Encrypted container generated and ready for download."}
              </p>
            </div>
          </div>
          {(!isTauriEnvironment() || containerBytes) && (
            <button
              type="button"
              onClick={handleDownloadContainer}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold text-xs px-4 py-2.5 shadow-lg shadow-cyan-900/40 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none shrink-0"
            >
              <Download className="h-4 w-4" />
              <span>Download Encrypted .denc File</span>
            </button>
          )}
        </div>
      )}

      {isDecryption &&
        (() => {
          const isFolderArchive =
            decryptedFilename?.toLowerCase().endsWith(".tar") ||
            message.toLowerCase().includes("folder") ||
            message.toLowerCase().includes("directory");
          return (
            <div className="rounded-xl border border-emerald-500/50 bg-gradient-to-r from-emerald-950/60 to-slate-900/80 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[0_0_25px_rgba(16,185,129,0.15)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0">
                  {isFolderArchive ? (
                    <FolderArchive className="h-6 w-6" />
                  ) : (
                    <Download className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-100 font-mono flex items-center gap-2">
                    <span>{decryptedFilename || "restored_file"}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300">
                      {isFolderArchive ? "📁 RESTORED DIRECTORY" : "AUTHENTICATED PLAINTEXT"}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-200/80 mt-0.5">
                    {isTauriEnvironment()
                      ? isFolderArchive
                        ? message.replace(
                            /^Directory hierarchy and nested files restored safely to /i,
                            "Extracted to: ",
                          )
                        : "Restored plaintext file written to disk."
                      : containerDownloaded
                        ? isFolderArchive
                          ? "✓ Restored folder archive downloaded to your browser."
                          : "✓ Restored plaintext downloaded to your browser."
                        : isFolderArchive
                          ? "Folder archive payload restored and ready for download."
                          : "Plaintext payload restored and ready for download."}
                  </p>
                </div>
              </div>
              {!isTauriEnvironment() && (
                <button
                  type="button"
                  onClick={handleDownloadDecrypted}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs px-4 py-2.5 shadow-lg shadow-emerald-900/40 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none shrink-0"
                >
                  <Download className="h-4 w-4" />
                  <span>
                    {isFolderArchive
                      ? "Download Restored Directory Archive (.tar)"
                      : "Download Restored File"}
                  </span>
                </button>
              )}
            </div>
          );
        })()}

      {/* Verified Payload Size Card */}
      <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <span className="text-xs text-slate-300 font-medium">Verified Payload Size:</span>
        </div>
        <span className="font-mono text-sm font-bold text-emerald-400">
          {formatBytes(bytesProcessed)}
        </span>
      </div>

      {/* Exported Shares Section */}
      {exportedShares.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Exported Custodian Key Shares & Tokens ({exportedShares.length} Slots)
              </h4>
              <p className="text-[11px] text-slate-400">
                Download key files, copy public/private keys, or email directly. Optional PIN
                protection encrypts key material.
              </p>
            </div>

            {/* Bulk Save Zip Button */}
            <button
              type="button"
              onClick={handleBulkSaveZip}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all shadow-lg cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none",
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
                  <span>Save All in ZIP (.zip)</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-2 pt-1">
            {exportedShares.map((s) => {
              const isSaved = !!savedStatus[s.custodian_id];
              const savedName = savedStatus[s.custodian_id];
              const currentPin = sharePins[s.custodian_id] || "";
              const isPqc = s.auth_type === "pqc" || !!s.pqc_private_key_base64;

              return (
                <div
                  key={s.custodian_id}
                  className="flex flex-col lg:flex-row lg:items-center justify-between bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl hover:border-slate-700 transition-colors gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "font-mono text-xs px-2.5 py-1 rounded-lg border font-bold",
                        isPqc
                          ? "bg-purple-950/60 text-purple-400 border-purple-800/60"
                          : "bg-slate-800 text-cyan-400 border-slate-700",
                      )}
                    >
                      P{s.custodian_id}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-100 font-medium">{s.label}</span>
                        {isPqc ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-950/80 border border-purple-500/30 px-2 py-0.5 text-[9px] font-mono text-purple-300">
                            <Atom className="h-2.5 w-2.5 text-purple-400" />
                            ML-KEM-768
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.5 text-[9px] font-mono text-cyan-300">
                            <FileKey className="h-2.5 w-2.5 text-cyan-400" />
                            SSS Share
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {isSaved
                          ? `✓ ${savedName}`
                          : isPqc
                            ? "Quantum-safe keypair generated & share encapsulated"
                            : "Secret share ready for export"}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Optional PIN Input */}
                    <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 px-2 py-1 rounded-lg">
                      <KeyRound className="h-3 w-3 text-amber-400" />
                      <input
                        type="text"
                        value={currentPin}
                        onChange={(e) =>
                          setSharePins({ ...sharePins, [s.custodian_id]: e.target.value })
                        }
                        placeholder="PIN (Optional)"
                        className="w-24 bg-transparent text-[11px] text-slate-200 focus:outline-none font-mono"
                      />
                    </div>

                    {/* Copy Public Key for PQC */}
                    {isPqc && s.pqc_public_key_base64 && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(s.pqc_public_key_base64 || "", `pub-${s.custodian_id}`)
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-purple-700 text-slate-300 hover:text-white px-2 py-1.5 text-xs font-semibold border border-slate-700 hover:border-purple-500 transition-all cursor-pointer focus-visible:ring-1 focus-visible:ring-purple-500 focus-visible:outline-none"
                        title="Copy NIST FIPS 203 ML-KEM-768 Public Key Base64"
                      >
                        {copiedKey === `pub-${s.custodian_id}` ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-purple-400" />
                        )}
                        <span>
                          {copiedKey === `pub-${s.custodian_id}` ? "Copied" : "Copy Public Key"}
                        </span>
                      </button>
                    )}

                    {/* Copy Private Key for PQC */}
                    {isPqc && s.pqc_private_key_base64 && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(s.pqc_private_key_base64 || "", `priv-${s.custodian_id}`)
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-purple-700 text-slate-300 hover:text-white px-2 py-1.5 text-xs font-semibold border border-slate-700 hover:border-purple-500 transition-all cursor-pointer focus-visible:ring-1 focus-visible:ring-purple-500 focus-visible:outline-none"
                        title="Copy NIST FIPS 203 ML-KEM-768 Private Key Base64"
                      >
                        {copiedKey === `priv-${s.custodian_id}` ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-purple-300" />
                        )}
                        <span>
                          {copiedKey === `priv-${s.custodian_id}` ? "Copied" : "Copy Private Key"}
                        </span>
                      </button>
                    )}

                    {/* Save .pqc.pub Public Key Button */}
                    {isPqc && s.pqc_public_key_base64 && (
                      <button
                        type="button"
                        onClick={() => handleSavePublicKey(s)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-purple-900/80 text-purple-300 hover:text-white px-2.5 py-1.5 text-xs font-semibold border border-purple-900/60 hover:border-purple-500 transition-all cursor-pointer focus-visible:ring-1 focus-visible:ring-purple-500 focus-visible:outline-none"
                        title="Download shareable .pqc.pub public key"
                      >
                        <Download className="h-3.5 w-3.5 text-purple-400" />
                        <span>Public Key (.pqc.pub)</span>
                      </button>
                    )}

                    {/* Email Share Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEmailModal(s)}
                      className="relative inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-teal-600 text-slate-300 hover:text-white px-2.5 py-1.5 text-xs font-semibold border border-slate-700 hover:border-teal-500 transition-all cursor-pointer focus-visible:ring-1 focus-visible:ring-teal-500 focus-visible:outline-none"
                      title={
                        !smtpConfig
                          ? "SMTP server is not configured in Settings"
                          : "Send directly to custodian via email"
                      }
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>Email</span>
                      {!smtpConfig && (
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border border-slate-900" />
                        </span>
                      )}
                    </button>

                    {/* Save Key File / Private Key Button */}
                    <button
                      type="button"
                      onClick={() => handleSaveShare(s)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none",
                        isSaved
                          ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                          : isPqc
                            ? "bg-purple-900/80 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-700 hover:border-purple-400"
                            : "bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white border border-slate-700 hover:border-cyan-500",
                      )}
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>
                        {isSaved ? "Saved" : isPqc ? "Private Key (.pqc)" : "Key Share (.dkey)"}
                      </span>
                    </button>

                    {/* Scan to Phone (Android Authenticator) Button */}
                    {onEnrollPhone && (
                      <button
                        type="button"
                        onClick={() => onEnrollPhone(s)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 hover:text-cyan-200 border border-cyan-500/30 hover:border-cyan-400 transition-all cursor-pointer focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none"
                        title="Display QR code for the Android Authenticator App to scan and store"
                      >
                        <Smartphone className="h-3.5 w-3.5 text-cyan-400" />
                        <span>📲 Scan to Phone (QR)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Direct Email Modal */}
      {emailModalShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-teal-400" />
                <h4 className="text-sm font-bold text-slate-100">
                  Email Key Token: {emailModalShare.label}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setEmailModalShare(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {emailSuccessMsg ? (
              <div className="space-y-4 text-center py-4">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
                <p className="text-xs text-emerald-300 font-mono">{emailSuccessMsg}</p>
                <button
                  type="button"
                  onClick={() => setEmailModalShare(null)}
                  className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendEmail} className="space-y-3.5">
                {!smtpConfig && (
                  <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-950/30 text-xs text-rose-200 flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-rose-300">
                        SMTP Email Server Not Configured
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        The outbound SMTP email server has not been configured yet. Please configure
                        your email server credentials in the Settings tab before sending keys.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label
                    htmlFor="custodian-email-input"
                    className="text-xs font-semibold text-slate-300"
                  >
                    Custodian Email Address
                  </label>
                  <input
                    id="custodian-email-input"
                    type="email"
                    required
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="custodian@company.com"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-teal-500 focus-visible:ring-1 focus-visible:ring-teal-500 focus-visible:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="admin-note-input"
                    className="text-xs font-semibold text-slate-300"
                  >
                    Admin Instructions / Custom Note (Optional)
                  </label>
                  <textarea
                    id="admin-note-input"
                    rows={2}
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="e.g. Please save this key file to your secure encrypted USB drive."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-teal-500 focus-visible:ring-1 focus-visible:ring-teal-500 focus-visible:outline-none"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1 font-mono">
                  <div>
                    Attachment:{" "}
                    <span className="text-teal-400">
                      custodian_{emailModalShare.custodian_id}.
                      {emailModalShare.auth_type === "pqc" || emailModalShare.pqc_private_key_base64
                        ? "pqc"
                        : "dkey"}
                    </span>
                  </div>
                  <div>
                    PIN Security:{" "}
                    <span
                      className={
                        sharePins[emailModalShare.custodian_id]
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }
                    >
                      {sharePins[emailModalShare.custodian_id]
                        ? `Active (PIN: ${sharePins[emailModalShare.custodian_id]})`
                        : "Unencrypted"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEmailModalShare(null)}
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingEmail || !smtpConfig}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 py-2.5 text-xs font-bold text-white transition-all disabled:opacity-40 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{isSendingEmail ? "Sending..." : "Send Email"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Done Button */}
      <div className="pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={onDone}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3.5 text-xs font-bold text-white transition-colors shadow-lg cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
        >
          <span>Return to Workspace</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
