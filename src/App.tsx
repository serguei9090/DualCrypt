import { save } from "@tauri-apps/plugin-dialog";
import { AlertTriangle, Lock, Unlock } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { FileDropzone } from "./components/dropzone/FileDropzone";
import { FileMetadataCard } from "./components/dropzone/FileMetadataCard";
import { CompleteDialog } from "./components/execution/CompleteDialog";
import { LiveCryptoProgress } from "./components/execution/LiveCryptoProgress";
import { Header } from "./components/layout/Header";
import { type ActiveTab, TabNav } from "./components/layout/TabNav";
import { CustodianGrid } from "./components/quorum/CustodianGrid";
import { QuorumConfigurator } from "./components/quorum/QuorumConfigurator";
import { ThresholdMeter } from "./components/quorum/ThresholdMeter";
import { SettingsTab } from "./components/settings/SettingsTab";
import { useCryptoJob } from "./hooks/useCryptoJob";
import { useQuorumState } from "./hooks/useQuorumState";
import {
  executeDecryption,
  executeEncryption,
  inspectDencFile,
  isTauriEnvironment,
} from "./lib/tauri";
import type { AuthType, ContainerHeaderInfo, ExportedShare } from "./types/container";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("encrypt");

  // Source File State
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);

  // Inspected Header State (Decrypt mode)
  const [containerMetadata, setContainerMetadata] = useState<ContainerHeaderInfo | null>(null);

  // Completed State
  const [completionData, setCompletionData] = useState<{
    title: string;
    message: string;
    bytes: number;
    shares?: ExportedShare[];
  } | null>(null);

  // Quorum State
  const quorum = useQuorumState(2, 2);

  // Job Streaming
  const job = useCryptoJob();

  // Handle File Selection in Encrypt Mode
  const handleEncryptFileSelected = (path: string, name: string, size?: number) => {
    setFilePath(path);
    setFileName(name);
    setFileSize(size || null);
    setCompletionData(null);
    job.setError(null);
  };

  // Handle File Selection in Decrypt Mode
  const handleDecryptFileSelected = async (path: string, name: string, size?: number) => {
    setFilePath(path);
    setFileName(name);
    setFileSize(size || null);
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
        })),
      );
    } catch (err) {
      job.setError(`Failed to parse .denc header: ${String(err)}`);
    }
  };

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
        },
        job.updateProgress,
      );

      job.finishJob();
      setCompletionData({
        title: "Encryption & Quorum Split Completed",
        message: `Successfully encrypted to ${outputPath.split(/[\\/]/).pop()}`,
        bytes: res.bytes_encrypted,
        shares: res.exported_shares,
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
        },
        job.updateProgress,
      );

      job.finishJob();
      setCompletionData({
        title: "Quorum Attained & Decryption Succeeded",
        message: `Plaintext file restored safely to ${outputPath.split(/[\\/]/).pop()}`,
        bytes: res.bytes_decrypted,
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
    <div className="min-h-screen bg-[#070a12] text-slate-100 cyber-grid flex flex-col">
      <Header />
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
              className="text-rose-400 hover:text-rose-200 underline font-semibold"
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
          <CompleteDialog
            title={completionData.title}
            message={completionData.message}
            bytesProcessed={completionData.bytes}
            exportedShares={completionData.shares}
            onDone={handleReset}
          />
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
                        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                          Custodian Credentials Configuration ({quorum.totalN} Quadrants)
                        </h3>
                        <span className="text-xs text-zinc-500 font-mono">
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

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleStartEncryption}
                        className="w-full inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 py-4 text-sm font-bold text-white shadow-[0_0_30px_rgba(6,182,212,0.25)] transition-all"
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
                        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                          Custodian Quorum Authorization
                        </h3>
                        <span className="text-xs text-zinc-400 font-mono">
                          Submit {quorum.thresholdK} of {quorum.totalN} credentials to unlock
                        </span>
                      </div>

                      <CustodianGrid
                        custodians={quorum.custodians}
                        mode="decrypt_unlock"
                        onCredentialSubmit={quorum.handleCredentialSubmit}
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={!quorum.isQuorumMet}
                        onClick={handleStartDecryption}
                        className="w-full inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 py-4 text-sm font-bold text-white shadow-[0_0_30px_rgba(16,185,129,0.25)] transition-all disabled:opacity-40 disabled:pointer-events-none"
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
            {activeTab === "keytools" && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-md space-y-4">
                  <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100">
                        Enterprise Key Escrow & Disaster Recovery
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Information-Theoretically Secure Shamir’s Secret Sharing over Galois Field
                        GF(256)
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800 space-y-2">
                      <div className="font-semibold text-xs text-zinc-200">
                        Zero Trust Guarantee
                      </div>
                      <p className="text-xs text-zinc-400">
                        Any party with fewer than \(k\) shares has zero mathematical knowledge of
                        the key, even against quantum computers.
                      </p>
                    </div>

                    <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800 space-y-2">
                      <div className="font-semibold text-xs text-zinc-200">Memory Hygiene</div>
                      <p className="text-xs text-zinc-400">
                        Reconstructed keys and shares are protected with `ZeroizeOnDrop` and
                        immediately purged after stream initiation.
                      </p>
                    </div>

                    <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800 space-y-2">
                      <div className="font-semibold text-xs text-zinc-200">Tamper Evident</div>
                      <p className="text-xs text-zinc-400">
                        Authenticated STREAM cipher with per-chunk MAC tags prevents any byte
                        manipulation or chunk reordering.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. SETTINGS & EMAIL DISPATCH TAB */}
            {activeTab === "settings" && <SettingsTab />}
          </>
        )}
      </main>
    </div>
  );
};
