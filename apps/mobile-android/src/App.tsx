import { HelpCircle, Lock, Moon, Shield, Smartphone, Sun, X } from "lucide-react";
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

        {/* Air-Gap Security Assurance Modal */}
        {showAirGapInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div
              className={`w-full max-w-sm rounded-2xl border p-5 space-y-4 shadow-2xl relative ${
                theme === "dark"
                  ? "bg-slate-950 border-slate-800 text-white"
                  : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex items-center justify-between border-b pb-3 border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold font-mono">100% Air-Gapped Security</div>
                    <div className="text-[10px] text-slate-400">Zero Network Attack Surface</div>
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

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <span>📡 Zero Network Permissions</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    This mobile authenticator requires no Wi-Fi, Bluetooth, or cellular connection.
                    No telemetry or network sockets exist.
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
                    Keys are encrypted at rest with AES-256-GCM derived via PBKDF2 (100,000 rounds)
                    from your Master PIN.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAirGapInfo(false)}
                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs cursor-pointer shadow-lg transition-all focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
              >
                Close Security Passport
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
