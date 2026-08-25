import {
  Check,
  Copy,
  ExternalLink,
  Heart,
  HelpCircle,
  Info,
  Lock,
  Mail,
  Moon,
  Shield,
  Smartphone,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { BiometricGate } from "./components/BiometricGate";
import { DecryptScanner } from "./components/DecryptScanner";
import { EnrollScanner } from "./components/EnrollScanner";
import { VaultView } from "./components/VaultView";
import {
  type AuthConfig,
  loadAuthConfig,
  loadEncryptedVaultKeys,
  type VaultKeyItem,
} from "./lib/vaultStorage";

type MobileScreen = "vault" | "enroll_scanner" | "decrypt_scanner";
export type MobileTheme = "dark" | "light";

export const App: React.FC = () => {
  const [theme, setTheme] = useState<MobileTheme>(() => {
    return (localStorage.getItem("dualcrypt_mobile_theme") as MobileTheme) || "dark";
  });
  const [authConfig, setAuthConfig] = useState<AuthConfig>(loadAuthConfig());
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);
  const [salt, setSalt] = useState<Uint8Array | null>(null);
  const [showAirGapInfo, setShowAirGapInfo] = useState(false);
  const [modalTab, setModalTab] = useState<"about" | "airgap">("about");
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [activeScreen, setActiveScreen] = useState<MobileScreen>("vault");
  const [keys, setKeys] = useState<VaultKeyItem[]>([]);

  useEffect(() => {
    localStorage.setItem("dualcrypt_mobile_theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const handleUnlocked = async (vaultKey: CryptoKey, saltBytes: Uint8Array) => {
    setSessionKey(vaultKey);
    setSalt(saltBytes);
    setIsUnlocked(true);
    try {
      const decryptedKeys = await loadEncryptedVaultKeys(vaultKey);
      setKeys(decryptedKeys);
    } catch (err) {
      console.error("Failed to load encrypted keys:", err);
    }
  };

  const handleLock = () => {
    setSessionKey(null);
    setSalt(null);
    setKeys([]);
    setIsUnlocked(false);
    setActiveScreen("vault");
  };

  const refreshKeys = useCallback(async () => {
    if (sessionKey) {
      try {
        const updated = await loadEncryptedVaultKeys(sessionKey);
        setKeys(updated);
      } catch (err) {
        console.error("Failed to refresh keys:", err);
      }
    }
  }, [sessionKey]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div
      className={`min-h-screen flex flex-col p-4 max-w-md mx-auto justify-between transition-colors duration-200 ${
        theme === "dark" ? "bg-[#080b13] text-slate-100" : "bg-slate-100 text-slate-900"
      }`}
    >
      <div className="w-full space-y-4">
        {/* Top Mobile Header */}
        <header
          className={`w-full flex items-center justify-between py-2.5 px-3 rounded-2xl border backdrop-blur-md transition-colors ${
            theme === "dark"
              ? "border-slate-800/80 bg-slate-950/70"
              : "border-slate-300/80 bg-white/80 shadow-sm"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl border ${
                theme === "dark"
                  ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                  : "bg-cyan-600/10 border-cyan-600/30 text-cyan-600 shadow-sm"
              }`}
            >
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <div
                className={`font-mono text-xs font-bold tracking-wider ${
                  theme === "dark" ? "text-white" : "text-slate-900"
                }`}
              >
                DUALCRYPT AUTHENTICATOR
              </div>
              <div
                className={`text-[10px] font-mono ${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Android Air-Gapped Enclave
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Help / Air-Gap Isolation Info */}
            <button
              type="button"
              onClick={() => setShowAirGapInfo(true)}
              className={`p-1.5 rounded-xl border transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                  : "bg-slate-200 border-slate-300 text-slate-600 hover:text-slate-900"
              }`}
              title="Air-Gap Security & Architecture Info"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>

            {/* Theme Switcher */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`p-1.5 rounded-xl border transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-800 text-amber-400 hover:text-amber-300"
                  : "bg-slate-200 border-slate-300 text-slate-700 hover:text-slate-950"
              }`}
              title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
            >
              {theme === "dark" ? (
                <Sun className="w-3.5 h-3.5" />
              ) : (
                <Moon className="w-3.5 h-3.5" />
              )}
            </button>

            {isUnlocked && (
              <button
                type="button"
                onClick={handleLock}
                className={`p-1.5 rounded-xl border transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none ${
                  theme === "dark"
                    ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                    : "bg-slate-200 border-slate-300 text-slate-600 hover:text-slate-900"
                }`}
                title="Lock Authenticator"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </header>

        {/* About & Air-Gap Security Modal */}
        {showAirGapInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div
              className={`w-full max-w-sm max-h-[90vh] flex flex-col rounded-2xl border p-5 shadow-2xl relative overflow-hidden ${
                theme === "dark"
                  ? "bg-slate-950 border-slate-800 text-white"
                  : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b pb-3 border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                    <Info className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold font-mono">DualCrypt Authenticator</div>
                    <div className="text-[10px] text-slate-400">v0.5.4 • Air-Gapped Enclave</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAirGapInfo(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="flex rounded-xl bg-slate-900/80 p-1 border border-slate-800 mt-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalTab("about")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    modalTab === "about"
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  About & Support
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab("airgap")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    modalTab === "airgap"
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Air-Gap Specs
                </button>
              </div>

              {/* Scrollable Tab Content */}
              <div className="my-3 space-y-3 text-xs overflow-y-auto pr-1 flex-1">
                {modalTab === "about" ? (
                  <>
                    {/* Thank you note */}
                    <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 space-y-1.5">
                      <div className="font-bold text-cyan-400 flex items-center gap-1.5 text-xs">
                        <Heart className="w-3.5 h-3.5 fill-cyan-400/20" />
                        <span>Thank you for using DualCrypt!</span>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        We appreciate your trust in our threshold encryption architecture for
                        zero-network multi-party authorization.
                      </p>
                    </div>

                    {/* App Resume / Overview */}
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                      <div className="font-bold text-slate-200 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-cyan-400" />
                        <span>About DualCrypt Enclave</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        An air-gapped Android companion providing biometric hardware key custody,
                        Shamir&apos;s Secret Sharing threshold participation, and NIST FIPS 203/204
                        quantum-safe optical signers.
                      </p>
                    </div>

                    {/* Feedback & Bug Reporting */}
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                      <div className="font-bold text-slate-200 text-xs">
                        Feature Requests & Bug Reports
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Have ideas or issues? Submit a pull request on GitHub or send an email to:
                      </p>

                      <div className="flex items-center gap-1.5 pt-1">
                        <a
                          href="mailto:serguei@aiopsforge.com?subject=DualCrypt%20Mobile%20Feedback"
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-[11px] transition-all cursor-pointer"
                        >
                          <Mail className="w-3 h-3" />
                          <span>Email Serguei</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText("serguei@aiopsforge.com");
                            setCopiedEmail(true);
                            setTimeout(() => setCopiedEmail(false), 2000);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                          title="Copy email"
                        >
                          {copiedEmail ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <a
                        href="https://github.com/serguei9090/DualCrypt"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 font-semibold text-[11px] border border-slate-700 transition-all cursor-pointer"
                      >
                        <span>GitHub Issues & PRs</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <span>📡 Zero Network Permissions</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        This mobile authenticator requires no Wi-Fi, Bluetooth, or cellular
                        connection. No telemetry or network sockets exist.
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                        <span>📷 Optical Camera-to-Screen Handshake</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        All cryptographic challenges and signed authorizations pass exclusively via
                        high-speed animated QR code streams.
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                      <div className="font-bold text-purple-400 flex items-center gap-1.5">
                        <span>🔐 Zero-Knowledge Encrypted Storage</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Keys are encrypted at rest with AES-256-GCM derived via PBKDF2 (100,000
                        rounds) from your Master PIN.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowAirGapInfo(false)}
                className="w-full py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs cursor-pointer shadow-lg transition-all focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none shrink-0"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Content Container */}
        <main className="w-full py-1">
          {!isUnlocked ? (
            <BiometricGate
              config={authConfig}
              theme={theme}
              onConfigured={(newCfg) => setAuthConfig(newCfg)}
              onUnlocked={handleUnlocked}
            />
          ) : (
            <>
              {activeScreen === "vault" && (
                <VaultView
                  keys={keys}
                  sessionKey={sessionKey}
                  salt={salt}
                  theme={theme}
                  onKeysChanged={refreshKeys}
                  onOpenEnrollScanner={() => setActiveScreen("enroll_scanner")}
                  onOpenDecryptScanner={() => setActiveScreen("decrypt_scanner")}
                />
              )}

              {activeScreen === "enroll_scanner" && (
                <EnrollScanner
                  sessionKey={sessionKey}
                  salt={salt}
                  theme={theme}
                  onBack={() => setActiveScreen("vault")}
                  onEnrolledSuccess={() => {
                    refreshKeys();
                    setActiveScreen("vault");
                  }}
                />
              )}

              {activeScreen === "decrypt_scanner" && (
                <DecryptScanner keys={keys} theme={theme} onBack={() => setActiveScreen("vault")} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Persistent Footer */}
      <footer
        className={`w-full text-center py-3 border-t text-[10px] font-mono transition-colors ${
          theme === "dark"
            ? "border-slate-800/80 text-slate-500"
            : "border-slate-200 text-slate-400"
        }`}
      >
        NIST FIPS 203 & 204 • Optical Air-Gap • Hardware Protected
      </footer>
    </div>
  );
};
