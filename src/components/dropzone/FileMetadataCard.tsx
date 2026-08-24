import {
  Building2,
  Calendar,
  CheckCircle2,
  Cpu,
  FileText,
  Layers,
  Lock,
  Shield,
  Tag,
} from "lucide-react";
import type React from "react";
import type { ContainerHeaderInfo } from "../../types/container";

interface FileMetadataCardProps {
  metadata: ContainerHeaderInfo;
  fileName: string;
}

export const FileMetadataCard: React.FC<FileMetadataCardProps> = ({ metadata, fileName }) => {
  const getClassificationStyle = (cls?: string) => {
    const c = (cls || "").toUpperCase();
    if (c.includes("SECRET")) {
      return "bg-red-500/15 text-red-400 border-red-500/40 shadow-red-500/10";
    }
    if (c.includes("CONFIDENTIAL")) {
      return "bg-amber-500/15 text-amber-400 border-amber-500/40 shadow-amber-500/10";
    }
    if (c.includes("RESTRICTED")) {
      return "bg-purple-500/15 text-purple-400 border-purple-500/40 shadow-purple-500/10";
    }
    if (c.includes("INTERNAL")) {
      return "bg-blue-500/15 text-blue-400 border-blue-500/40 shadow-blue-500/10";
    }
    return "bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-emerald-500/10";
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-400">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-zinc-100">{fileName}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Valid .denc v{metadata.version}
              </span>
            </div>
            <p className="text-xs text-zinc-400">Authenticated Container Specification</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1 font-mono text-xs text-cyan-400">
            {metadata.cipher}
          </span>
        </div>
      </div>

      {/* Embedded Governance & Provenance Passport */}
      {metadata.manifest && (
        <div className="rounded-xl border border-border/80 bg-zinc-950/70 p-4 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 h-full w-1 bg-gradient-to-b from-primary via-purple-500 to-cyan-500 opacity-80" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-800/60">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Tag className="w-3.5 h-3.5 text-primary" />
                Security Classification & Governance:
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-mono tracking-wider border shadow-sm ${getClassificationStyle(
                  metadata.manifest.classification,
                )}`}
              >
                {metadata.manifest.classification}
              </span>
            </div>

            {metadata.manifest.created_at_utc > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                <span>
                  {new Date(metadata.manifest.created_at_utc * 1000).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            {metadata.manifest.purpose && (
              <div className="flex items-start gap-2">
                <FileText className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] uppercase font-semibold text-zinc-500 font-mono">
                    Purpose / Scope
                  </div>
                  <div className="text-xs text-zinc-200 font-medium">
                    {metadata.manifest.purpose}
                  </div>
                </div>
              </div>
            )}

            {metadata.manifest.organization && (
              <div className="flex items-start gap-2">
                <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] uppercase font-semibold text-zinc-500 font-mono">
                    Issuing Organization
                  </div>
                  <div className="text-xs text-zinc-200 font-medium">
                    {metadata.manifest.organization}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cryptographic Container Specs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <Lock className="h-3.5 w-3.5 text-cyan-400" />
            <span>Quorum Threshold</span>
          </div>
          <div className="font-mono text-base font-bold text-zinc-100">
            {metadata.threshold_k} of {metadata.total_n} Shares
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <Layers className="h-3.5 w-3.5 text-emerald-400" />
            <span>Chunk Stream Framing</span>
          </div>
          <div className="font-mono text-base font-bold text-zinc-100">
            {metadata.chunk_size / 1024} KiB Chunks
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <Cpu className="h-3.5 w-3.5 text-purple-400" />
            <span>KDF Engine</span>
          </div>
          <div className="font-mono text-base font-bold text-zinc-100">Argon2id (64MB)</div>
        </div>

        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <Shield className="h-3.5 w-3.5 text-amber-400" />
            <span>Secret Sharing</span>
          </div>
          <div className="font-mono text-base font-bold text-zinc-100">GF(256) Shamir</div>
        </div>
      </div>

      {metadata.signature_block && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-100">
                  {metadata.signature_block.author_label}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono text-emerald-400 font-semibold">
                  <CheckCircle2 className="h-3 w-3" /> FIPS 204 Signature Valid
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-mono">
                Cryptographically signed with NIST FIPS 204 ML-DSA-65 (Anti-Tamper Verified)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
