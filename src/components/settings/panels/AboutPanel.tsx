import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  GitPullRequest,
  Heart,
  Info,
  Mail,
  QrCode,
  Shield,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type React from "react";
import { useState } from "react";

export const AboutPanel: React.FC = () => {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const supportEmail = "serguei@aiopsforge.com";

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(supportEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-cyan-400" />
            <h3 className="text-base font-bold text-slate-100">About DualCrypt</h3>
          </div>
          <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
            v0.5.2 Enterprise
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Dual-Control & Threshold Encryption Platform with Post-Quantum Security & Optical Air-Gap
          Custody.
        </p>
      </div>

      {/* Thank You & Community Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 via-slate-900/60 to-slate-950/80 p-5 backdrop-blur-md shadow-lg shadow-cyan-950/20">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0">
            <Heart className="h-5 w-5 fill-cyan-400/20 text-cyan-400" />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Thank you for using DualCrypt!</span>
              <Sparkles className="h-4 w-4 text-amber-400" />
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              We appreciate your trust in DualCrypt to safeguard your mission-critical secrets,
              regulatory data, and cryptographic key material across multi-party custody workflows.
            </p>
          </div>
        </div>
      </div>

      {/* Resume / App Architecture Summary */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-cyan-400" />
          <span>Core Capabilities & Cryptographic Architecture</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-900/40 space-y-1.5">
            <div className="font-bold text-cyan-400 flex items-center gap-1.5">
              <span>🔐 Multi-Party Custody (SSS)</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Shamir&apos;s Secret Sharing over $GF(256)$ with flexible $k$-of-$n$ quorums. No
              single party can reconstruct or decrypt the data in isolation.
            </p>
          </div>

          <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-900/40 space-y-1.5">
            <div className="font-bold text-purple-400 flex items-center gap-1.5">
              <span>⚛️ Post-Quantum Cryptography</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              NIST FIPS 203 (ML-KEM-768 / Kyber) quantum-safe asymmetric transport and NIST FIPS 204
              (ML-DSA-65 / Dilithium) digital signatures.
            </p>
          </div>

          <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-900/40 space-y-1.5">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <span>🛡️ AEAD Bulk Encryption</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Hardware-accelerated AES-256-GCM and extended-nonce XChaCha20-Poly1305 container
              protection with strict authenticated <code className="font-mono">.denc</code> payload
              framing.
            </p>
          </div>

          <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-900/40 space-y-1.5">
            <div className="font-bold text-amber-400 flex items-center gap-1.5">
              <QrCode className="h-3.5 w-3.5" />
              <span>Optical Air-Gap Protocol</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Zero-network mobile companion app communicating exclusively via camera-to-screen QR
              streams for 100% offline threshold authentication.
            </p>
          </div>
        </div>
      </div>

      {/* Feature Request & Bug Report Channels */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <GitPullRequest className="h-4 w-4 text-cyan-400" />
          <span>Feature Requests, Bug Reports & Contributions</span>
        </h4>
        <p className="text-xs text-slate-400 leading-relaxed">
          DualCrypt is actively maintained and continuously evolving. Have a feature request,
          security feedback, or discovered a bug? We welcome your feedback through either channel:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* GitHub PR & Issues Box */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <Code2 className="h-4 w-4 text-cyan-400" />
                <span>GitHub Pull Requests & Issues</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Submit code contributions, pull requests, or file detailed issue reports directly on
                our GitHub repository.
              </p>
            </div>

            <a
              href="https://github.com/serguei9090/DualCrypt"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold border border-slate-700 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
            >
              <span>Open GitHub Repository</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Direct Email Support Box */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <Mail className="h-4 w-4 text-cyan-400" />
                <span>Direct Email Contact</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Send feature ideas, bug findings, or enterprise inquiries directly to our
                engineering team.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`mailto:${supportEmail}?subject=DualCrypt%20Feature%20Request%20or%20Bug%20Report`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none shadow-md shadow-cyan-500/10"
              >
                <Mail className="h-3.5 w-3.5" />
                <span>Send Email</span>
              </a>

              <button
                type="button"
                onClick={handleCopyEmail}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                title="Copy email to clipboard"
              >
                {copiedEmail ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* System Integrity & Memory Notice */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <Shield className="h-4 w-4 text-emerald-400" />
          <span>Memory Zeroization Guarantee • Local Isolation • No Telemetry</span>
        </div>
        <div className="font-mono text-[11px] text-slate-500">DualCrypt Engine v0.5.2</div>
      </div>
    </div>
  );
};
