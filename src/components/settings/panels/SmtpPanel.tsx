import { CheckCircle2, Lock, Mail, Send, Server, Shield } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import {
  loadSmtpConfig,
  type SmtpConfig,
  saveSmtpConfig,
  testSmtpConnection,
} from "../../../lib/tauri";

export const SmtpPanel: React.FC = () => {
  const [smtp, setSmtp] = useState<SmtpConfig>({
    host: "smtp.example.com",
    port: 587,
    security: "starttls",
    username: "",
    password: "",
    from_name: "DualCrypt Enterprise Security",
    from_email: "security-keys@company.com",
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testLog, setTestLog] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const existing = await loadSmtpConfig();
        if (existing) setSmtp(existing);
      } catch (err) {
        console.error("Failed to load SMTP config:", err);
      }
    }
    load();
  }, []);

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveSmtpConfig(smtp);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save SMTP config:", err);
    }
  };

  const handleTestConnection = async () => {
    if (!testRecipient) return;
    setIsTesting(true);
    setTestLog(null);
    try {
      const res = await testSmtpConnection(smtp, testRecipient);
      setTestLog({ success: true, message: res });
    } catch (err) {
      setTestLog({ success: false, message: String(err) });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Mail className="h-5 w-5 text-cyan-400" />
          <span>Email & SMTP Relay Service</span>
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Configure an enterprise mail server to directly dispatch encrypted .dkey shares and
          custodian credentials.
        </p>
      </div>

      <form onSubmit={handleSaveSmtp} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <label htmlFor="smtp-host-input" className="text-xs font-semibold text-slate-300">
              SMTP Relay Host
            </label>
            <input
              id="smtp-host-input"
              type="text"
              required
              value={smtp.host}
              onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
              placeholder="e.g. smtp.office365.com or mail.org.com"
              className="w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-3.5 py-2.5 text-xs text-slate-200 focus:border-cyan-500 focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="smtp-port-input" className="text-xs font-semibold text-slate-300">
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
              className="w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-3.5 py-2.5 text-xs text-slate-200 focus:border-cyan-500 focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="smtp-security-select" className="text-xs font-semibold text-slate-300">
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
              className="w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-3.5 py-2.5 text-xs text-slate-200 focus:border-cyan-500 focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none"
            >
              <option value="starttls">STARTTLS (Recommended / Port 587)</option>
              <option value="tls">Direct TLS / SSL (Port 465)</option>
              <option value="none">Plain / Internal Relay (Insecure)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="smtp-fromname-input" className="text-xs font-semibold text-slate-300">
              Sender Name
            </label>
            <input
              id="smtp-fromname-input"
              type="text"
              required
              value={smtp.from_name}
              onChange={(e) => setSmtp({ ...smtp, from_name: e.target.value })}
              placeholder="DualCrypt Enterprise Security"
              className="w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-3.5 py-2.5 text-xs text-slate-200 focus:border-cyan-500 focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="smtp-fromemail-input" className="text-xs font-semibold text-slate-300">
              From Email Address
            </label>
            <input
              id="smtp-fromemail-input"
              type="email"
              required
              value={smtp.from_email}
              onChange={(e) => setSmtp({ ...smtp, from_email: e.target.value })}
              placeholder="security-keys@company.com"
              className="w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-3.5 py-2.5 text-xs text-slate-200 focus:border-cyan-500 focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="smtp-username-input" className="text-xs font-semibold text-slate-300">
              SMTP Username / Login
            </label>
            <input
              id="smtp-username-input"
              type="text"
              value={smtp.username}
              onChange={(e) => setSmtp({ ...smtp, username: e.target.value })}
              placeholder="relay-user or API key"
              className="w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-3.5 py-2.5 text-xs text-slate-200 focus:border-cyan-500 focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none font-mono"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="smtp-password-input" className="text-xs font-semibold text-slate-300">
            SMTP Password / API Token
          </label>
          <input
            id="smtp-password-input"
            type="password"
            value={smtp.password || ""}
            onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
            placeholder="••••••••••••••••••••••••"
            className="w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-3.5 py-2.5 text-xs text-slate-200 focus:border-cyan-500 focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none font-mono"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Lock className="h-3.5 w-3.5 text-cyan-400" />
            <span>Credentials stored locally in workstation configuration vault</span>
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-600/20 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
          >
            <Server className="h-4 w-4" />
            <span>Save SMTP Settings</span>
          </button>
        </div>

        {savedSuccess && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>SMTP Server configuration saved successfully.</span>
          </div>
        )}
      </form>

      {/* Test Connection Box */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Mail className="h-4 w-4 text-teal-400" />
          <span>Verify SMTP Dispatch Pipeline</span>
        </div>
        <div className="flex gap-2">
          <input
            type="email"
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
            placeholder="recipient@enterprise.com"
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs text-slate-200 focus:border-teal-500 focus-visible:ring-1 focus-visible:ring-teal-500 focus-visible:outline-none font-mono"
          />
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 px-4 py-2 text-xs font-bold text-white transition-all disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{isTesting ? "Sending..." : "Test Send"}</span>
          </button>
        </div>

        {testLog && (
          <div
            className={`p-3 rounded-xl border text-xs font-mono break-all flex items-start gap-2 ${
              testLog.success
                ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                : "bg-rose-950/40 border-rose-500/30 text-rose-300"
            }`}
          >
            {testLog.success ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <Shield className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <div>{testLog.message}</div>
          </div>
        )}
      </div>
    </div>
  );
};
