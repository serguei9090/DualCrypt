import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  KeyRound,
  Mail,
  RefreshCw,
  Save,
  Send,
  Server,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import {
  listHardwareTokens,
  loadSmtpConfig,
  performHardwareTokenChallenge,
  type SmtpConfig,
  saveSmtpConfig,
  testSmtpConnection,
  type YubiKeyDevice,
} from "../../lib/tauri";

export const SettingsTab: React.FC = () => {
  const [smtp, setSmtp] = useState<SmtpConfig>({
    host: "smtp.example.com",
    port: 587,
    username: "custodian-dispatch@example.com",
    password: "",
    security: "starttls",
    from_email: "dual-control@example.com",
    from_name: "DualCrypt Enterprise Security",
  });

  const [testRecipient, setTestRecipient] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // YubiKey Hardware State
  const [tokens, setTokens] = useState<YubiKeyDevice[]>([]);
  const [isRefreshingTokens, setIsRefreshingTokens] = useState(false);
  const [activeChallengeResult, setActiveChallengeResult] = useState<string | null>(null);

  useEffect(() => {
    // Load persisted settings
    const init = async () => {
      try {
        const loaded = await loadSmtpConfig();
        if (loaded) {
          setSmtp(loaded);
        }
        const detectedTokens = await listHardwareTokens();
        setTokens(detectedTokens);
      } catch {
        // Fallback to default state
      }
    };
    init();
  }, []);

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    try {
      await saveSmtpConfig(smtp);
      setStatusMessage({
        type: "success",
        text: "SMTP configuration saved securely to local workstation store.",
      });
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: `Failed to save configuration: ${String(err)}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!testRecipient) {
      setStatusMessage({
        type: "error",
        text: "Please enter a test recipient email address to send a verification payload.",
      });
      return;
    }
    setIsTesting(true);
    setStatusMessage(null);
    try {
      const res = await testSmtpConnection(smtp, testRecipient);
      setStatusMessage({
        type: "success",
        text: res,
      });
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: `SMTP Test Failed: ${String(err)}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRefreshTokens = async () => {
    setIsRefreshingTokens(true);
    try {
      const list = await listHardwareTokens();
      setTokens(list);
    } finally {
      setIsRefreshingTokens(false);
    }
  };

  const handleTestYubikeyChallenge = async (custodianId: number) => {
    try {
      const res = await performHardwareTokenChallenge(
        custodianId,
        "4475616c43727970742d456e74657270726973652d546f6b656e",
      );
      setActiveChallengeResult(`FIDO2 Signature: ${res.signature_hex.slice(0, 24)}... (Verified)`);
    } catch (err) {
      setActiveChallengeResult(`Token Error: ${String(err)}`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Alert Status */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-3 backdrop-blur-md ${
            statusMessage.type === "success"
              ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300"
              : "border-rose-500/40 bg-rose-950/30 text-rose-300"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          )}
          <div className="font-mono flex-1">{statusMessage.text}</div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 underline font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: SMTP Configuration (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-md space-y-5">
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Server className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100">
                  SMTP Dispatch Server Configuration
                </h3>
                <p className="text-xs text-zinc-400">
                  Configure mail server for automated, encrypted custodian key share distribution
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveSmtp} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="smtp-host-input" className="text-xs font-semibold text-zinc-300">
                    SMTP Relay Host
                  </label>
                  <input
                    id="smtp-host-input"
                    type="text"
                    required
                    value={smtp.host}
                    onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                    placeholder="e.g. smtp.office365.com or mail.org.com"
                    className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-3.5 py-2.5 text-xs text-zinc-200 focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="smtp-port-input" className="text-xs font-semibold text-zinc-300">
                    Port
                  </label>
                  <input
                    id="smtp-port-input"
                    type="number"
                    required
                    value={smtp.port}
                    onChange={(e) =>
                      setSmtp({ ...smtp, port: Number.parseInt(e.target.value, 10) || 587 })
                    }
                    placeholder="587"
                    className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-3.5 py-2.5 text-xs text-zinc-200 focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="smtp-security-select"
                    className="text-xs font-semibold text-zinc-300"
                  >
                    Security Protocol
                  </label>
                  <select
                    id="smtp-security-select"
                    value={smtp.security}
                    onChange={(e) =>
                      setSmtp({
                        ...smtp,
                        security: e.target.value as "tls" | "starttls" | "none",
                      })
                    }
                    className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-3.5 py-2.5 text-xs text-zinc-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="starttls">STARTTLS (Recommended / Port 587)</option>
                    <option value="tls">Direct TLS / SSL (Port 465)</option>
                    <option value="none">Plain / Internal Relay (Insecure)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="smtp-fromname-input"
                    className="text-xs font-semibold text-zinc-300"
                  >
                    Sender Name
                  </label>
                  <input
                    id="smtp-fromname-input"
                    type="text"
                    required
                    value={smtp.from_name}
                    onChange={(e) => setSmtp({ ...smtp, from_name: e.target.value })}
                    placeholder="DualCrypt Enterprise Security"
                    className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-3.5 py-2.5 text-xs text-zinc-200 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="smtp-fromemail-input"
                    className="text-xs font-semibold text-zinc-300"
                  >
                    From Email Address
                  </label>
                  <input
                    id="smtp-fromemail-input"
                    type="email"
                    required
                    value={smtp.from_email}
                    onChange={(e) => setSmtp({ ...smtp, from_email: e.target.value })}
                    placeholder="security-keys@company.com"
                    className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-3.5 py-2.5 text-xs text-zinc-200 focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="smtp-username-input"
                    className="text-xs font-semibold text-zinc-300"
                  >
                    SMTP Username / Login
                  </label>
                  <input
                    id="smtp-username-input"
                    type="text"
                    value={smtp.username}
                    onChange={(e) => setSmtp({ ...smtp, username: e.target.value })}
                    placeholder="relay-user or API key"
                    className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-3.5 py-2.5 text-xs text-zinc-200 focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="smtp-password-input"
                  className="text-xs font-semibold text-zinc-300"
                >
                  SMTP Password / API Token
                </label>
                <input
                  id="smtp-password-input"
                  type="password"
                  value={smtp.password || ""}
                  onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                  placeholder="••••••••••••••••••••••••"
                  className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-3.5 py-2.5 text-xs text-zinc-200 focus:border-cyan-500 focus:outline-none font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-zinc-800">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-5 py-2.5 text-xs font-bold text-white transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSaving ? "Saving..." : "Save SMTP Config"}</span>
                </button>

                <div className="text-[11px] text-zinc-500 font-mono">
                  Stored in local OS encrypted vault
                </div>
              </div>
            </form>

            {/* Test Connection Box */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <Mail className="h-4 w-4 text-teal-400" />
                <span>Verify SMTP Dispatch Pipeline</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="recipient@enterprise.com"
                  className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-zinc-200 focus:border-teal-500 focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 px-4 py-2 text-xs font-bold text-white transition-all disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isTesting ? "Sending..." : "Test Send"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Hardware Tokens & Security Policy (1 col) */}
        <div className="space-y-6">
          {/* YubiKey / Hardware Token Card */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Cpu className="h-5 w-5 text-amber-400" />
                <div>
                  <h4 className="text-sm font-bold text-zinc-100">Hardware Security Keys</h4>
                  <p className="text-[11px] text-zinc-400">Physical YubiKey & FIDO2 Diagnostics</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRefreshTokens}
                disabled={isRefreshingTokens}
                className="p-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white"
                title="Scan connected tokens"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingTokens ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Developer Simulator Toggle */}
            <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200">Virtual Simulator Mode</span>
                <input
                  type="checkbox"
                  checked={isSimulationEnabled()}
                  onChange={(e) => {
                    setSimulationEnabled(e.target.checked);
                    handleRefreshTokens();
                  }}
                  className="h-4 w-4 rounded border-zinc-750 bg-zinc-900 text-cyan-500 focus:ring-0"
                />
              </div>
              <p className="text-[10px] text-zinc-400">
                Allows testing YubiKey workflows without physical hardware. (Turn off for strict
                physical security).
              </p>
            </div>

            <div className="space-y-2.5">
              {tokens.length > 0 ? (
                tokens.map((t) => (
                  <div
                    key={t.device_id}
                    className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/70 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-zinc-200">{t.product_name}</div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                          t.is_simulated
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        {t.is_simulated ? "Simulated" : "Connected"}
                      </span>
                    </div>
                    {t.serial_number && (
                      <div className="text-[10px] font-mono text-zinc-500">
                        S/N: {t.serial_number}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleTestYubikeyChallenge(1)}
                      className="w-full mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 py-1.5 text-[11px] font-semibold text-amber-300 transition-all"
                    >
                      <Zap className="h-3 w-3" />
                      <span>Test Token Challenge Response</span>
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-950/10 text-xs text-rose-300 space-y-1">
                  <div className="font-semibold">No Hardware Key Detected</div>
                  <p className="text-[11px] text-zinc-400">
                    Insert a physical YubiKey into a USB port or enable Simulator Mode above to
                    test.
                  </p>
                </div>
              )}

              {activeChallengeResult && (
                <div className="p-2.5 rounded-lg bg-zinc-950 border border-amber-500/30 text-[11px] font-mono text-amber-300 break-all">
                  {activeChallengeResult}
                </div>
              )}
            </div>
          </div>

          {/* Key Export Security Policy */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-md space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
              <KeyRound className="h-4 w-4 text-cyan-400" />
              <span>Key Share Hygiene Policies</span>
            </div>
            <ul className="text-xs text-zinc-400 space-y-2 list-disc list-inside">
              <li>
                Exported <span className="text-zinc-200 font-mono">.dkey</span> files can be
                password-encrypted with Argon2id.
              </li>
              <li>Keys sent via SMTP should always utilize PIN protection.</li>
              <li>Reconstructed keys in RAM are zeroized on drop.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
