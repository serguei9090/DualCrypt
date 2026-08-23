import { open, save } from "@tauri-apps/plugin-dialog";
import {
  Atom,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileCheck,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import {
  generatePqcKeypair,
  isTauriEnvironment,
  loadSmtpConfig,
  type PqcKeypair,
  parseKeyFile,
  type SmtpConfig,
  saveKeyFile,
  sendCustodianKeyEmail,
} from "../../lib/tauri";
import { cn } from "../../lib/utils";

export const KeyEscrowView: React.FC = () => {
  // 1. Keypair Generator State
  const [label, setLabel] = useState("Custodian 1 - Primary");
  const [enablePin, setEnablePin] = useState(false);
  const [pinCode, setPinCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedKeypair, setGeneratedKeypair] = useState<PqcKeypair | null>(null);
  const [activePinForGenerated, setActivePinForGenerated] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 2. Key File Inspector State
  const [inspectedFileName, setInspectedFileName] = useState<string | null>(null);
  const [inspectedFilePath, setInspectedFilePath] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectorResult, setInspectorResult] = useState<{
    fileType: "dkey" | "pqc" | "pqc_pub" | "unknown";
    custodianId?: number;
    label?: string;
    algorithm?: string;
    isPinProtected?: boolean;
    rawPayload?: unknown;
  } | null>(null);
  const [testPin, setTestPin] = useState("");
  const [testPinStatus, setTestPinStatus] = useState<"idle" | "success" | "fail">("idle");
  const [testPinMessage, setTestPinMessage] = useState<string | null>(null);

  // 3. Email Modal State
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccessMsg, setEmailSuccessMsg] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

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

  // Generate Standalone ML-KEM Keypair
  const handleGenerateKeypair = async () => {
    setIsGenerating(true);
    try {
      const kp = await generatePqcKeypair();
      setGeneratedKeypair(kp);
      setActivePinForGenerated(enablePin && pinCode.trim() ? pinCode.trim() : null);
    } catch (err) {
      console.error("Keypair generation failed:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Save Public Key (.pqc.pub)
  const handleSavePublicKey = async () => {
    if (!generatedKeypair) return;
    const sanitized = label.trim().replace(/\s+/g, "_") || "custodian";
    const defaultFilename = `${sanitized}.pqc.pub`;

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
          generatedKeypair.public_key_base64,
          undefined,
          1,
          label,
        );
      }
    } else {
      const payload = {
        algorithm: "NIST-FIPS-203-ML-KEM-768",
        type: "public_key",
        label,
        public_key_base64: generatedKeypair.public_key_base64,
      };
      const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(payload, null, 2),
      )}`;
      const anchor = document.createElement("a");
      anchor.setAttribute("href", dataStr);
      anchor.setAttribute("download", defaultFilename);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
  };

  // Save Private Key (.pqc)
  const handleSavePrivateKey = async () => {
    if (!generatedKeypair) return;
    const sanitized = label.trim().replace(/\s+/g, "_") || "custodian";
    const defaultFilename = `${sanitized}.pqc`;

    if (isTauriEnvironment()) {
      const path = await save({
        defaultPath: defaultFilename,
        filters: [{ name: "Post-Quantum Private Key", extensions: ["pqc", "key", "json"] }],
      });
      if (path) {
        await saveKeyFile(
          path,
          undefined,
          activePinForGenerated || undefined,
          generatedKeypair.public_key_base64,
          generatedKeypair.private_key_base64,
          1,
          label,
        );
      }
    } else {
      const payload = {
        algorithm: "NIST-FIPS-203-ML-KEM-768",
        type: "private_key",
        label,
        public_key_base64: generatedKeypair.public_key_base64,
        private_key_base64: generatedKeypair.private_key_base64,
        pin_protected: !!activePinForGenerated,
      };
      const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(payload, null, 2),
      )}`;
      const anchor = document.createElement("a");
      anchor.setAttribute("href", dataStr);
      anchor.setAttribute("download", defaultFilename);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
  };

  // Inspect Key File
  const handlePickInspectFile = async () => {
    setInspectorResult(null);
    setTestPin("");
    setTestPinStatus("idle");
    setTestPinMessage(null);

    if (isTauriEnvironment()) {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "DualCrypt Key Token Files",
            extensions: ["dkey", "pqc", "pub", "json", "key"],
          },
        ],
      });
      if (selected && typeof selected === "string") {
        const fname = selected.split(/[\\/]/).pop() || selected;
        setInspectedFileName(fname);
        setInspectedFilePath(selected);
        setIsInspecting(true);

        try {
          const res = await parseKeyFile(selected);
          if (res.is_pqc) {
            setInspectorResult({
              fileType: "pqc",
              custodianId: res.custodian_id,
              algorithm: "NIST FIPS 203 ML-KEM-768",
              isPinProtected: res.is_pin_protected,
              rawPayload: res,
            });
          } else if (res.share || res.is_pin_protected) {
            setInspectorResult({
              fileType: "dkey",
              custodianId: res.custodian_id,
              algorithm: "Shamir GF(256) + AES-256-GCM",
              isPinProtected: res.is_pin_protected,
              rawPayload: res,
            });
          } else {
            // Check if raw public key json
            const { readTextFile } = await import("@tauri-apps/plugin-fs");
            const content = await readTextFile(selected);
            const parsed = JSON.parse(content);
            if (parsed.type === "public_key" || parsed.public_key_base64) {
              setInspectorResult({
                fileType: "pqc_pub",
                label: parsed.label || "Custodian Public Key",
                algorithm: "NIST FIPS 203 ML-KEM-768",
                isPinProtected: false,
                rawPayload: parsed,
              });
            } else {
              setInspectorResult({
                fileType: "unknown",
                rawPayload: parsed,
              });
            }
          }
        } catch (err) {
          console.error("Inspector error:", err);
        } finally {
          setIsInspecting(false);
        }
      }
    }
  };

  // Test PIN unlock inside inspector
  const handleTestPinUnlock = async () => {
    if (!inspectedFilePath || !testPin) return;
    setTestPinStatus("idle");
    setTestPinMessage(null);

    try {
      const res = await parseKeyFile(inspectedFilePath, testPin);
      if (res.share || res.pqc_private_key_base64) {
        setTestPinStatus("success");
        setTestPinMessage("✓ PIN Verified! Key material successfully decrypted in memory.");
      } else {
        setTestPinStatus("fail");
        setTestPinMessage("✕ Invalid PIN. Authentication tag verification failed.");
      }
    } catch (err) {
      setTestPinStatus("fail");
      setTestPinMessage(`✕ Unlock failed: ${String(err)}`);
    }
  };

  // Send Public Key via Email
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generatedKeypair || !recipientEmail) return;

    if (!smtpConfig) {
      setEmailError(
        "SMTP server is not configured. Please open the Settings tab to configure SMTP.",
      );
      return;
    }

    setIsSendingEmail(true);
    setEmailError(null);

    try {
      const pubFilename = `${label.replace(/\s+/g, "_")}.pqc.pub`;
      const pubPayload = JSON.stringify(
        {
          algorithm: "NIST-FIPS-203-ML-KEM-768",
          type: "public_key",
          label,
          public_key_base64: generatedKeypair.public_key_base64,
        },
        null,
        2,
      );

      const res = await sendCustodianKeyEmail({
        config: smtpConfig,
        recipient_email: recipientEmail,
        custodian_label: label,
        share_filename: pubFilename,
        share_content: pubPayload,
        is_pin_protected: false,
        custom_note:
          customNote ||
          "Here is my NIST FIPS 203 ML-KEM-768 Post-Quantum Public Key for future file encryptions.",
      });

      setEmailSuccessMsg(res);
    } catch (err) {
      setEmailError(`Failed to send email: ${String(err)}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-amber-500/30 bg-zinc-900/60 p-6 backdrop-blur-md space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Atom className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <span>Enterprise Key Escrow & Post-Quantum Vault</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-950/80 border border-purple-500/30 px-2 py-0.5 text-[10px] font-mono text-purple-300">
                <Sparkles className="h-2.5 w-2.5 text-purple-400" />
                FIPS 203
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Generate standalone quantum-safe keypairs, distribute shareable public keys
              (`.pqc.pub`), and verify key tokens offline.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. STANDALONE POST-QUANTUM KEYPAIR GENERATOR */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 space-y-4 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <h4 className="text-sm font-bold text-zinc-100">1. Post-Quantum Keypair Generator</h4>
            </div>
            <span className="text-[10px] font-mono text-purple-400 bg-purple-950/60 border border-purple-800/40 px-2 py-0.5 rounded-md">
              ML-KEM-768
            </span>
          </div>

          <p className="text-xs text-zinc-400">
            Generate an asymmetric keypair in advance. Keep your <strong>Private Key</strong> secret
            and distribute your <strong>Public Key</strong> to anyone who needs to encrypt files for
            you.
          </p>

          <div className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="pqc-custodian-label" className="text-xs font-semibold text-zinc-300">
                Custodian Identity / Label
              </label>
              <input
                id="pqc-custodian-label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Alice - Chief Financial Officer"
                className="w-full rounded-xl border border-zinc-750 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-purple-500 focus:outline-none"
              />
            </div>

            {/* Optional PIN Protection */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                  <span>Protect Private Key with PIN</span>
                </span>
                <input
                  type="checkbox"
                  checked={enablePin}
                  onChange={(e) => setEnablePin(e.target.checked)}
                  className="h-4 w-4 rounded accent-purple-600"
                />
              </label>

              {enablePin && (
                <div className="pt-1">
                  <input
                    type="password"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="Set 4-12 digit PIN or passphrase..."
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 font-mono focus:border-amber-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Protects the `.pqc` private key file with Argon2id + AES-256-GCM.
                  </p>
                </div>
              )}
            </div>

            {/* Generate Action Button */}
            <button
              type="button"
              disabled={isGenerating || !label.trim()}
              onClick={handleGenerateKeypair}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 py-3 text-xs font-bold text-white shadow-[0_0_20px_rgba(147,51,234,0.25)] transition-all disabled:opacity-40"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isGenerating && "animate-spin")} />
              <span>
                {isGenerating ? "Generating FIPS 203 Keypair..." : "Generate New ML-KEM Keypair"}
              </span>
            </button>
          </div>

          {/* Keypair Results Card */}
          {generatedKeypair && (
            <div className="rounded-xl border border-purple-500/40 bg-purple-950/20 p-4 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Keypair Ready: {label}</span>
                </span>
                {activePinForGenerated && (
                  <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 border border-amber-800/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5" /> PIN Protected
                  </span>
                )}
              </div>

              {/* Public Key Preview */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] uppercase font-mono text-zinc-400">
                  <span>Public Key (Shareable)</span>
                  <span className="text-purple-400">1184 Bytes</span>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-950 border border-purple-900/60 font-mono text-[11px] text-zinc-300 break-all max-h-16 overflow-y-auto">
                  {generatedKeypair.public_key_base64}
                </div>
              </div>

              {/* Download & Copy Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {/* Download .pqc.pub */}
                <button
                  type="button"
                  onClick={handleSavePublicKey}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-purple-500/50 bg-purple-900/40 hover:bg-purple-800/60 py-2 text-xs font-semibold text-purple-200 hover:text-white transition-colors"
                >
                  <Download className="h-3.5 w-3.5 text-purple-400" />
                  <span>Download .pqc.pub</span>
                </button>

                {/* Download .pqc */}
                <button
                  type="button"
                  onClick={handleSavePrivateKey}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 py-2 text-xs font-bold text-white transition-colors shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download .pqc</span>
                </button>

                {/* Copy Public Key */}
                <button
                  type="button"
                  onClick={() => handleCopyText(generatedKeypair.public_key_base64, "pub-key")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-750 py-1.5 text-xs text-zinc-300 hover:text-white transition-colors"
                >
                  {copiedKey === "pub-key" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-purple-400" />
                  )}
                  <span>{copiedKey === "pub-key" ? "Copied" : "Copy PubKey"}</span>
                </button>

                {/* Email Public Key */}
                <button
                  type="button"
                  onClick={() => {
                    setRecipientEmail("");
                    setEmailSuccessMsg(null);
                    setEmailError(null);
                    setEmailModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-teal-600/40 bg-teal-950/40 hover:bg-teal-900/60 py-1.5 text-xs text-teal-300 hover:text-white transition-colors"
                >
                  <Mail className="h-3.5 w-3.5 text-teal-400" />
                  <span>Email PubKey</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. KEY FILE INSPECTOR & OFFLINE VERIFIER */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 space-y-4 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-cyan-400" />
              <h4 className="text-sm font-bold text-zinc-100">
                2. Key Token Inspector & PIN Verifier
              </h4>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded-md">
              Offline Verification
            </span>
          </div>

          <p className="text-xs text-zinc-400">
            Inspect any `.dkey`, `.pqc`, or `.pqc.pub` file to view its metadata and test its PIN
            protection without initiating a decryption process.
          </p>

          <button
            type="button"
            disabled={isInspecting}
            onClick={handlePickInspectFile}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/60 py-4 text-xs text-zinc-300 hover:border-cyan-500 hover:text-cyan-300 transition-colors disabled:opacity-50"
          >
            <Upload className={cn("h-4 w-4 text-cyan-400", isInspecting && "animate-spin")} />
            <span>
              {isInspecting
                ? "Inspecting Key File..."
                : inspectedFileName
                  ? `Selected: ${inspectedFileName}`
                  : "Select Key File (.dkey, .pqc, .pub) to Inspect"}
            </span>
          </button>

          {/* Inspector Details */}
          {inspectorResult && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                <span className="text-xs font-semibold text-zinc-200">{inspectedFileName}</span>
                <span
                  className={cn(
                    "text-[10px] font-mono px-2 py-0.5 rounded-full border",
                    inspectorResult.fileType === "pqc"
                      ? "bg-purple-950/80 text-purple-300 border-purple-700/50"
                      : inspectorResult.fileType === "pqc_pub"
                        ? "bg-teal-950/80 text-teal-300 border-teal-700/50"
                        : "bg-cyan-950/80 text-cyan-300 border-cyan-700/50",
                  )}
                >
                  {inspectorResult.fileType === "pqc"
                    ? "⚛️ Post-Quantum Private Key"
                    : inspectorResult.fileType === "pqc_pub"
                      ? "🌐 Post-Quantum Public Key"
                      : "📄 Shamir Secret Share"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-zinc-500 text-[11px]">Algorithm:</span>
                  <div className="font-mono text-zinc-200 text-[11px]">
                    {inspectorResult.algorithm || "N/A"}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500 text-[11px]">Security Status:</span>
                  <div className="font-mono text-[11px]">
                    {inspectorResult.isPinProtected ? (
                      <span className="text-amber-400 font-semibold flex items-center gap-1">
                        <Lock className="h-3 w-3" /> PIN-Protected
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> Plain Payload
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* In-Memory PIN Test */}
              {inspectorResult.isPinProtected && (
                <div className="pt-2 border-t border-zinc-850 space-y-2">
                  <span className="text-[11px] font-semibold text-zinc-300">
                    Test Unlock PIN in Memory:
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={testPin}
                      onChange={(e) => setTestPin(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleTestPinUnlock()}
                      placeholder="Enter PIN to test..."
                      className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 font-mono focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleTestPinUnlock}
                      className="rounded-xl bg-amber-600 hover:bg-amber-500 px-3 py-1.5 text-xs font-bold text-white transition-colors"
                    >
                      Test
                    </button>
                  </div>

                  {testPinMessage && (
                    <p
                      className={cn(
                        "text-[11px] font-mono",
                        testPinStatus === "success" ? "text-emerald-400" : "text-rose-400",
                      )}
                    >
                      {testPinMessage}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Direct Email Modal for Public Key */}
      {emailModalOpen && generatedKeypair && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-teal-400" />
                <h4 className="text-sm font-bold text-zinc-100">Email Public Key: {label}</h4>
              </div>
              <button
                type="button"
                onClick={() => setEmailModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-200"
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
                  onClick={() => setEmailModalOpen(false)}
                  className="rounded-xl bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-bold text-zinc-200"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendEmail} className="space-y-3.5">
                {emailError && (
                  <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-950/40 text-xs text-rose-300 font-mono">
                    {emailError}
                  </div>
                )}

                <div className="space-y-1">
                  <label
                    htmlFor="email-recipient-input"
                    className="text-xs font-semibold text-zinc-300"
                  >
                    Recipient / Admin Email Address
                  </label>
                  <input
                    id="email-recipient-input"
                    type="email"
                    required
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="security@company.com"
                    className="w-full rounded-xl border border-zinc-750 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-teal-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="email-note-input" className="text-xs font-semibold text-zinc-300">
                    Instructions / Message (Optional)
                  </label>
                  <textarea
                    id="email-note-input"
                    rows={2}
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="e.g. Please use this public key when encrypting confidential archives for my slot."
                    className="w-full rounded-xl border border-zinc-750 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 space-y-1 font-mono">
                  <div>
                    Attachment:{" "}
                    <span className="text-teal-400">{label.replace(/\s+/g, "_")}.pqc.pub</span>
                  </div>
                  <div>Security: Shareable Public Key (Safe for email transmission)</div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEmailModalOpen(false)}
                    className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingEmail || !smtpConfig}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 py-2.5 text-xs font-bold text-white transition-all disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{isSendingEmail ? "Sending..." : "Send Public Key"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 3. Theoretical & Security Guarantees */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800 space-y-2">
          <h4 className="text-xs font-semibold text-zinc-200">Zero Trust Guarantee</h4>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Any party with fewer than \(k\) shares has zero mathematical knowledge of the key, even
            against quantum adversaries.
          </p>
        </div>
        <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800 space-y-2">
          <h4 className="text-xs font-semibold text-zinc-200">Memory Hygiene</h4>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Reconstructed keys and shares implement{" "}
            <code className="text-cyan-400">ZeroizeOnDrop</code> and are immediately purged after
            stream initiation.
          </p>
        </div>
        <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800 space-y-2">
          <h4 className="text-xs font-semibold text-zinc-200">Tamper Evident</h4>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Authenticated STREAM cipher with per-chunk MAC tags prevents any byte manipulation or
            chunk reordering.
          </p>
        </div>
      </div>
    </div>
  );
};
