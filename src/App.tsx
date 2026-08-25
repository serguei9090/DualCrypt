import { save } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  Building2,
  FileText,
  Lock,
  RefreshCw,
  ShieldCheck,
  Tag,
  Unlock,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { AirGapDesktopModal } from "./components/airgap/AirGapDesktopModal";
import { EnrollmentQrModal } from "./components/airgap/EnrollmentQrModal";
import { FileDropzone } from "./components/dropzone/FileDropzone";
import { FileMetadataCard } from "./components/dropzone/FileMetadataCard";
import { KeyEscrowView } from "./components/escrow/KeyEscrowView";
import { CompleteDialog } from "./components/execution/CompleteDialog";
import { LiveCryptoProgress } from "./components/execution/LiveCryptoProgress";
import { AuditHistoryView } from "./components/history/AuditHistoryView";
import { Header } from "./components/layout/Header";
import { type ActiveTab, TabNav } from "./components/layout/TabNav";
import { CustodianGrid } from "./components/quorum/CustodianGrid";
import { QuorumConfigurator } from "./components/quorum/QuorumConfigurator";
import { ThresholdMeter } from "./components/quorum/ThresholdMeter";
import { SettingsTab } from "./components/settings/SettingsTab";
import { useCryptoJob } from "./hooks/useCryptoJob";
import { useQuorumState } from "./hooks/useQuorumState";
import { logAuditEvent } from "./lib/historyStore";
import {
  executeDecryption,
  executeEncryption,
  generateMlDsaKeypair,
  getLaunchFile,
  inspectDencFile,
  isTauriEnvironment,
} from "./lib/tauri";
import { cn, formatBytes } from "./lib/utils";
import type {
  AuthType,
  ContainerHeaderInfo,
  CustodianDescriptorInfo,
  ExportedShare,
} from "./types/container";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("encrypt");

  // Source File State
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);

  // Optical Air-Gap Handshake & Enrollment State
  const [airGapModalCustodian, setAirGapModalCustodian] = useState<CustodianDescriptorInfo | null>(
    null,
  );
  const [enrollmentQrShare, setEnrollmentQrShare] = useState<ExportedShare | null>(null);

  // Author Digital Signature State (NIST FIPS 204 ML-DSA-65)
  const [enableAuthorSignature, setEnableAuthorSignature] = useState(false);
  const [authorLabel, setAuthorLabel] = useState("Chief Security Officer (CSO)");
  const [authorSigningKeyBase64, setAuthorSigningKeyBase64] = useState("");
  const [isGeneratingAuthorKey, setIsGeneratingAuthorKey] = useState(false);

  // Container Governance & Manifest State
  const [enableManifest, setEnableManifest] = useState(false);
  const [manifestClassification, setManifestClassification] = useState("CONFIDENTIAL");
  const [manifestPurpose, setManifestPurpose] = useState("");
  const [manifestOrganization, setManifestOrganization] = useState("");

  const handleGenerateAuthorKey = async () => {
    setIsGeneratingAuthorKey(true);
    try {
      const kp = await generateMlDsaKeypair();
      setAuthorSigningKeyBase64(kp.private_key_base64);
    } catch (err) {
      console.error("Failed to generate author signing key:", err);
    } finally {
      setIsGeneratingAuthorKey(false);
    }
  };

  // Inspected Header State (Decrypt mode)
  const [containerMetadata, setContainerMetadata] = useState<ContainerHeaderInfo | null>(null);

  // Raw file object for browser web mode
  const [rawFile, setRawFile] = useState<File | null>(null);

  // Completed State
  const [completionData, setCompletionData] = useState<{
    title: string;
    message: string;
    bytes: number;
    shares?: ExportedShare[];
    containerFilename?: string;
    containerBytes?: Uint8Array;
    isDecryption?: boolean;
    decryptedBytes?: Uint8Array;
    decryptedFilename?: string;
  } | null>(null);

  // Quorum State
  const quorum = useQuorumState(2, 2);

  // Job Streaming
  const job = useCryptoJob();

  // Handle File Selection in Encrypt Mode
  const handleEncryptFileSelected = (path: string, name: string, size?: number, fileObj?: File) => {
    setFilePath(path);
    setFileName(name);
    setFileSize(size || null);
    setRawFile(fileObj || null);
    setCompletionData(null);
    job.setError(null);
  };

  // Handle File Selection in Decrypt Mode
  const handleDecryptFileSelected = useCallback(
    async (path: string, name: string, size?: number, fileObj?: File) => {
      setFilePath(path);
      setFileName(name);
      setFileSize(size || null);
      setRawFile(fileObj || null);
      setCompletionData(null);
      job.setError(null);

      try {
        const meta = await inspectDencFile(path);
        setContainerMetadata(meta);
        quorum.setFromHeaderCustodians(
          meta.threshold_k,
          meta.total_n,
          meta.cipher,
          meta.custodians.map((c) => ({
            custodian_id: c.custodian_id,
            label: c.label,
            auth_type: c.auth_type as AuthType,
            timelock_not_before_utc: c.timelock_not_before_utc,
          })),
        );
      } catch (err) {
        job.setError(`Failed to parse .denc header: ${String(err)}`);
      }
    },
    [job, quorum],
  );

  // Detect CLI file double-click from Windows Explorer file associations
  useEffect(() => {
    const checkLaunchArgs = async () => {
      const launchPath = await getLaunchFile();
      if (launchPath) {
        setActiveTab("decrypt");
        const name = launchPath.split(/[\\/]/).pop() || launchPath;
        handleDecryptFileSelected(launchPath, name);
      }
    };
    checkLaunchArgs();
  }, [handleDecryptFileSelected]);

  // Execute Encryption
  const handleStartEncryption = async () => {
    if (!filePath || !fileName) return;

    let outputPath = `${filePath}.denc`;
    if (isTauriEnvironment()) {
      const selected = await save({
        defaultPath: `${fileName}.denc`,
        filters: [{ name: "DualCrypt Encrypted Container", extensions: ["denc"] }],
      });
      if (!selected) return;
      outputPath = selected;
    }

    try {
      job.startJob("encrypt-job");

      const timelocksMap: Record<number, number> = {};
      for (const c of quorum.custodians) {
        if (c.timelockNotBeforeUtc && c.timelockNotBeforeUtc > Math.floor(Date.now() / 1000)) {
          timelocksMap[c.custodianId] = c.timelockNotBeforeUtc;
        }
      }
      const hasTimelocks = Object.keys(timelocksMap).length > 0;

      let fileBytes: Uint8Array | undefined;
      if (!isTauriEnvironment() && rawFile) {
        fileBytes = new Uint8Array(await rawFile.arrayBuffer());
      }

      const res = await executeEncryption(
        {
          input_path: filePath,
          output_path: outputPath,
          cipher: quorum.cipher,
          threshold_k: quorum.thresholdK,
          total_n: quorum.totalN,
          custodians: quorum.custodians.map((c) => ({
            custodian_id: c.custodianId,
            label: c.label,
            auth_type: c.authType === "pqc" ? "postquantum" : c.authType,
            passphrase: c.passphrase,
            public_key_base64: c.publicKeyBase64,
          })),
          author_signing_key_base64:
            enableAuthorSignature && authorSigningKeyBase64.trim()
              ? authorSigningKeyBase64.trim()
              : undefined,
          author_label:
            enableAuthorSignature && authorLabel.trim() ? authorLabel.trim() : undefined,
          manifest:
            enableManifest || hasTimelocks
              ? {
                  classification: manifestClassification,
                  purpose: manifestPurpose.trim() || undefined,
                  organization: manifestOrganization.trim() || undefined,
                  created_at_utc: Math.floor(Date.now() / 1000),
                  original_filename: fileName,
                  custodian_timelocks: hasTimelocks ? timelocksMap : undefined,
                }
              : undefined,
          file_bytes: fileBytes,
        },
        job.updateProgress,
      );

      job.finishJob();

      const containerName = `${fileName}.denc`;

      // In browser mode, auto-download .denc container
      if (!isTauriEnvironment() && res.encrypted_bytes) {
        const blob = new Blob([res.encrypted_bytes as unknown as BlobPart], {
          type: "application/octet-stream",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = containerName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }

      setCompletionData({
        title: "Encryption & Quorum Split Completed",
        message: isTauriEnvironment()
          ? `Successfully encrypted to ${outputPath.split(/[\\/]/).pop()}`
          : `Successfully encrypted and downloaded ${containerName}`,
        bytes: res.bytes_encrypted,
        shares: res.exported_shares,
        containerFilename: containerName,
        containerBytes: res.encrypted_bytes,
        isDecryption: false,
      });

      logAuditEvent({
        action: "encrypt",
        filename: fileName,
        fileSizeFormatted: formatBytes(fileSize || res.bytes_encrypted),
        rawSizeBytes: res.bytes_encrypted,
        custodianCount: quorum.totalN,
        thresholdK: quorum.thresholdK,
        cipherSuite: quorum.cipher,
        classification: enableManifest ? manifestClassification : undefined,
        authorSigned: enableAuthorSignature && !!authorSigningKeyBase64.trim(),
        authorLabel: enableAuthorSignature ? authorLabel : undefined,
        status: "completed",
      });
    } catch (err) {
      job.failJob(String(err));
    }
  };

  // Execute Decryption
  const handleStartDecryption = async () => {
    if (!filePath || !fileName) return;

    let outputPath = filePath.replace(/\.denc$/i, ".decrypted");
    if (outputPath === filePath) outputPath = `${filePath}.out`;

    if (isTauriEnvironment()) {
      const defaultName = fileName.replace(/\.denc$/i, "");
      const selected = await save({
        defaultPath: defaultName,
      });
      if (!selected) return;
      outputPath = selected;
    }

    try {
      job.startJob("decrypt-job");

      let fileBytes: Uint8Array | undefined;
      if (!isTauriEnvironment() && rawFile) {
        fileBytes = new Uint8Array(await rawFile.arrayBuffer());
      }

      const res = await executeDecryption(
        {
          input_path: filePath,
          output_path: outputPath,
          credentials: quorum.custodians.map((c) => ({
            custodian_id: c.custodianId,
            passphrase: c.passphrase,
            share_data_json: c.shareDataJson,
            pqc_private_key_base64: c.pqcPrivateKeyBase64,
          })),
          file_bytes: fileBytes,
        },
        job.updateProgress,
      );

      job.finishJob();

      const restoredName = fileName.replace(/\.denc$/i, "");

      // In browser mode, auto-download restored file
      if (!isTauriEnvironment() && res.decrypted_bytes) {
        const blob = new Blob([res.decrypted_bytes as unknown as BlobPart], {
          type: "application/octet-stream",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = restoredName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }

      setCompletionData({
        title: "Quorum Attained & Decryption Succeeded",
        message: isTauriEnvironment()
          ? `Plaintext file restored safely to ${outputPath.split(/[\\/]/).pop()}`
          : `Plaintext file restored and downloaded as ${restoredName}`,
        bytes: res.bytes_decrypted,
        isDecryption: true,
        decryptedBytes: res.decrypted_bytes,
        decryptedFilename: restoredName,
      });

      logAuditEvent({
        action: "decrypt",
        filename: fileName,
        fileSizeFormatted: formatBytes(res.bytes_decrypted),
        rawSizeBytes: res.bytes_decrypted,
        custodianCount: quorum.totalN,
        thresholdK: quorum.thresholdK,
        cipherSuite: quorum.cipher,
        classification: containerMetadata?.manifest?.classification,
        authorSigned: !!containerMetadata?.signature_block,
        authorLabel: containerMetadata?.signature_block?.author_label,
        status: "completed",
      });
    } catch (err) {
      job.failJob(String(err));
    }
  };

  const handleReset = () => {
    setFilePath(null);
    setFileName(null);
    setFileSize(null);
    setContainerMetadata(null);
    setCompletionData(null);
    quorum.resetVerification();
    job.setError(null);
  };

  return (
    <div className="min-h-screen bg-[#080b13] text-slate-100 cyber-grid flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          handleReset();
        }}
      />
      <TabNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          handleReset();
        }}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        {/* Error Alert */}
        {job.error && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-xs text-rose-300 flex items-center gap-3 backdrop-blur-md">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
            <div className="flex-1 font-mono">{job.error}</div>
            <button
              type="button"
              onClick={() => job.setError(null)}
              className="text-rose-400 hover:text-rose-200 underline font-semibold cursor-pointer focus-visible:ring-1 focus-visible:ring-rose-500 focus-visible:outline-none rounded"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Live Streaming Execution */}
        {job.isRunning && job.progress && (
          <LiveCryptoProgress
            progress={job.progress}
            fileName={fileName || "Active Payload"}
            onAbort={job.abortActiveJob}
          />
        )}

        {/* Completion Modal */}
        {completionData && (
          <>
            <CompleteDialog
              title={completionData.title}
              message={completionData.message}
              bytesProcessed={completionData.bytes}
              exportedShares={completionData.shares}
              containerFilename={completionData.containerFilename}
              containerBytes={completionData.containerBytes}
              isDecryption={completionData.isDecryption}
              decryptedBytes={completionData.decryptedBytes}
              decryptedFilename={completionData.decryptedFilename}
              onDone={handleReset}
              onEnrollPhone={(share) => setEnrollmentQrShare(share)}
            />

            {enrollmentQrShare && (
              <EnrollmentQrModal
                isOpen={!!enrollmentQrShare}
                onClose={() => setEnrollmentQrShare(null)}
                share={enrollmentQrShare}
                fileName={fileName || "Vault"}
              />
            )}
          </>
        )}

        {!job.isRunning && !completionData && (
          <>
            {/* 1. ENCRYPT TAB */}
            {activeTab === "encrypt" && (
              <div className="space-y-6">
                <FileDropzone
                  onFileSelected={handleEncryptFileSelected}
                  selectedFileName={fileName}
                  selectedFileSize={fileSize}
                  acceptDencOnly={false}
                />

                {filePath && (
                  <>
                    <QuorumConfigurator
                      thresholdK={quorum.thresholdK}
                      totalN={quorum.totalN}
                      cipher={quorum.cipher}
                      onThresholdChange={quorum.handleThresholdChange}
                      onCipherChange={quorum.setCipher}
                    />

                    <ThresholdMeter
                      requiredK={quorum.thresholdK}
                      totalN={quorum.totalN}
                      providedCount={quorum.verifiedCount}
                      isUnlocked={quorum.isQuorumMet}
                    />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Custodian Credentials Configuration ({quorum.totalN} Quadrants)
                        </h3>
                        <span className="text-xs text-slate-500 font-mono">
                          Assign passphrases or key files per party
                        </span>
                      </div>

                      <CustodianGrid
                        custodians={quorum.custodians}
                        mode="encrypt_setup"
                        onCredentialSubmit={quorum.handleCredentialSubmit}
                        onUpdateSetup={quorum.handleUpdateSetup}
                      />
                    </div>

                    {/* Container Governance & Compliance Manifest */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 backdrop-blur-md">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enableManifest}
                            onChange={(e) => setEnableManifest(e.target.checked)}
                            className="h-4 w-4 rounded accent-cyan-500 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                            <Tag className="h-4 w-4 text-cyan-400" />
                            <span>Embed Governance & Compliance Manifest (Optional)</span>
                          </span>
                        </label>
                        <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded-md">
                          Provenance Passport
                        </span>
                      </div>

                      {enableManifest && (
                        <div className="space-y-3 pt-2 border-t border-slate-800 animate-in fade-in">
                          {/* Classification Selector */}
                          <div className="space-y-1.5">
                            <span className="block text-[11px] font-medium text-slate-300">
                              Security Classification Level
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                              {[
                                {
                                  id: "TOP_SECRET",
                                  label: "Top Secret 🔴",
                                  border: "hover:border-rose-500",
                                  active: "bg-rose-500/20 text-rose-400 border-rose-500/50",
                                },
                                {
                                  id: "CONFIDENTIAL",
                                  label: "Confidential 🟠",
                                  border: "hover:border-amber-500",
                                  active: "bg-amber-500/20 text-amber-400 border-amber-500/50",
                                },
                                {
                                  id: "INTERNAL",
                                  label: "Internal 🔵",
                                  border: "hover:border-blue-500",
                                  active: "bg-blue-500/20 text-blue-400 border-blue-500/50",
                                },
                                {
                                  id: "RESTRICTED",
                                  label: "Restricted 🟣",
                                  border: "hover:border-purple-500",
                                  active: "bg-purple-500/20 text-purple-400 border-purple-500/50",
                                },
                                {
                                  id: "GENERAL",
                                  label: "General 🟢",
                                  border: "hover:border-emerald-500",
                                  active:
                                    "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
                                },
                              ].map((lvl) => (
                                <button
                                  key={lvl.id}
                                  type="button"
                                  onClick={() => setManifestClassification(lvl.id)}
                                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold font-mono border transition-all cursor-pointer focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none ${
                                    manifestClassification === lvl.id
                                      ? lvl.active
                                      : `bg-slate-950 text-slate-400 border-slate-800 ${lvl.border}`
                                  }`}
                                >
                                  {lvl.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label
                                htmlFor="manifest-purpose-input"
                                className="text-[11px] font-medium text-slate-300 flex items-center gap-1"
                              >
                                <FileText className="w-3 h-3 text-slate-400" />
                                <span>Purpose / Scope Summary</span>
                              </label>
                              <input
                                id="manifest-purpose-input"
                                type="text"
                                value={manifestPurpose}
                                onChange={(e) => setManifestPurpose(e.target.value)}
                                placeholder="e.g. Q3 Financial Audit & Disaster Recovery Archive"
                                className="w-full rounded-xl border border-slate-700/80 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <label
                                htmlFor="manifest-org-input"
                                className="text-[11px] font-medium text-slate-300 flex items-center gap-1"
                              >
                                <Building2 className="w-3 h-3 text-slate-400" />
                                <span>Issuing Organization / Dept</span>
                              </label>
                              <input
                                id="manifest-org-input"
                                type="text"
                                value={manifestOrganization}
                                onChange={(e) => setManifestOrganization(e.target.value)}
                                placeholder="e.g. Tokyo Treasury & Corporate Legal"
                                className="w-full rounded-xl border border-slate-700/80 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Author Digital Signature (NIST FIPS 204 ML-DSA-65) */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 backdrop-blur-md">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enableAuthorSignature}
                            onChange={(e) => setEnableAuthorSignature(e.target.checked)}
                            className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                            <ShieldCheck className="h-4 w-4 text-indigo-400" />
                            <span>Digitally Sign Container (NIST FIPS 204 ML-DSA-65)</span>
                          </span>
                        </label>
                        <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/60 border border-indigo-800/40 px-2 py-0.5 rounded-md">
                          Anti-Tamper & Origin Proof
                        </span>
                      </div>

                      {enableAuthorSignature && (
                        <div className="space-y-3 pt-1 border-t border-slate-800 animate-in fade-in">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label
                                htmlFor="author-label-input"
                                className="text-[11px] font-medium text-slate-300"
                              >
                                Author / Officer Identity
                              </label>
                              <input
                                id="author-label-input"
                                type="text"
                                value={authorLabel}
                                onChange={(e) => setAuthorLabel(e.target.value)}
                                placeholder="e.g. Alice - Chief Security Officer"
                                className="w-full rounded-xl border border-slate-700/80 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
                              />
                            </div>

                            <div className="space-y-1 flex flex-col justify-end">
                              <button
                                type="button"
                                onClick={handleGenerateAuthorKey}
                                disabled={isGeneratingAuthorKey}
                                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-950/40 hover:bg-indigo-900/60 py-2 text-xs font-semibold text-indigo-300 transition-colors cursor-pointer disabled:opacity-40 focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
                              >
                                <RefreshCw
                                  className={cn(
                                    "h-3.5 w-3.5",
                                    isGeneratingAuthorKey && "animate-spin",
                                  )}
                                />
                                <span>
                                  {isGeneratingAuthorKey
                                    ? "Generating Key..."
                                    : "⚡ Generate 1-Click Signing Key"}
                                </span>
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                              <span>ML-DSA-65 Private Signing Key (Base64 Seed)</span>
                              {authorSigningKeyBase64 && (
                                <span className="text-emerald-400 flex items-center gap-1">
                                  <ShieldCheck className="h-3 w-3" /> Key Loaded
                                </span>
                              )}
                            </div>
                            <input
                              type="password"
                              value={authorSigningKeyBase64}
                              onChange={(e) => setAuthorSigningKeyBase64(e.target.value)}
                              placeholder="Paste 32-byte Base64 ML-DSA Seed or click generate above..."
                              className="w-full rounded-xl border border-slate-700/80 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 font-mono focus:border-indigo-500 focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleStartEncryption}
                        className="w-full inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 py-4 text-sm font-bold text-white shadow-[0_0_30px_rgba(6,182,212,0.25)] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                      >
                        <Lock className="h-4 w-4" />
                        <span>Start Zero-Trust Dual-Control Encryption</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 2. DECRYPT TAB */}
            {activeTab === "decrypt" && (
              <div className="space-y-6">
                <FileDropzone
                  onFileSelected={handleDecryptFileSelected}
                  selectedFileName={fileName}
                  selectedFileSize={fileSize}
                  acceptDencOnly={true}
                />

                {containerMetadata && (
                  <>
                    <FileMetadataCard
                      metadata={containerMetadata}
                      fileName={fileName || "Container"}
                    />

                    <ThresholdMeter
                      requiredK={quorum.thresholdK}
                      totalN={quorum.totalN}
                      providedCount={quorum.verifiedCount}
                      isUnlocked={quorum.isQuorumMet}
                    />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Custodian Quorum Authorization
                        </h3>
                        <span className="text-xs text-slate-400 font-mono">
                          Submit {quorum.thresholdK} of {quorum.totalN} credentials to unlock
                        </span>
                      </div>

                      <CustodianGrid
                        custodians={quorum.custodians}
                        mode="decrypt_unlock"
                        onCredentialSubmit={quorum.handleCredentialSubmit}
                        onAirGapClick={(id) => {
                          const c = containerMetadata?.custodians.find(
                            (x) => x.custodian_id === id,
                          );
                          if (c) setAirGapModalCustodian(c);
                        }}
                      />
                    </div>

                    {/* Air-Gap Optical Handshake Modal */}
                    {airGapModalCustodian && containerMetadata && (
                      <AirGapDesktopModal
                        isOpen={!!airGapModalCustodian}
                        onClose={() => setAirGapModalCustodian(null)}
                        custodian={airGapModalCustodian}
                        containerMetadata={containerMetadata}
                        fileName={fileName || "Container"}
                        onResponseReceived={(resp) => {
                          quorum.handleCredentialSubmit({
                            custodianId: resp.custodianId,
                            passphrase: resp.passphrase,
                            keyFileContent: resp.shareDataJson,
                            pqcPrivateKeyBase64: resp.pqcPrivateKeyBase64,
                            authType: "passphrase",
                          });
                        }}
                      />
                    )}

                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={!quorum.isQuorumMet}
                        onClick={handleStartDecryption}
                        className="w-full inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 py-4 text-sm font-bold text-white shadow-[0_0_30px_rgba(16,185,129,0.25)] transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                      >
                        <Unlock className="h-4 w-4" />
                        <span>Reconstruct Key & Decrypt File</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 3. KEY TOOLS & ESCROW TAB */}
            {activeTab === "keytools" && <KeyEscrowView />}

            {/* 4. ACTIVITY & AUDIT HISTORY TAB */}
            {activeTab === "history" && <AuditHistoryView />}

            {/* 5. SETTINGS & EMAIL DISPATCH TAB */}
            {activeTab === "settings" && <SettingsTab />}
          </>
        )}
      </main>
    </div>
  );
};
