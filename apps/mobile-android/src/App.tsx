import { Lock, Moon, Smartphone, Sun } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { BiometricGate } from "./components/BiometricGate";
import { DecryptScanner } from "./components/DecryptScanner";
import { EnrollScanner } from "./components/EnrollScanner";
import { VaultView } from "./components/VaultView";
import {
  type AuthConfig,
  loadAuthConfig,
  loadVaultKeys,
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

  useEffect(() => {
    if (isUnlocked) {
      setKeys(loadVaultKeys());
    }
  }, [isUnlocked]);

  const refreshKeys = () => {
    setKeys(loadVaultKeys());
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div
      className={`min-h-screen flex flex-col p-4 max-w-md mx-auto justify-between transition-colors duration-200 ${
        theme === "dark" ? "bg-[#07080d] text-slate-100" : "bg-slate-100 text-slate-900"
      }`}
    >
      <div className="w-full space-y-4">
        {/* Top Mobile Header */}
        <header
          className={`w-full flex items-center justify-between py-2.5 px-3 rounded-2xl border backdrop-blur-md transition-colors ${
            theme === "dark"
              ? "border-zinc-800/80 bg-zinc-950/70"
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
                  theme === "dark" ? "text-zinc-400" : "text-slate-500"
                }`}
              >
                Android Air-Gapped Enclave
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono border font-semibold ${
                theme === "dark"
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              ✈️ OFFLINE
            </span>

            {/* Theme Switcher */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                theme === "dark"
                  ? "bg-zinc-900 border-zinc-800 text-amber-400 hover:text-amber-300"
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
                onClick={() => setIsUnlocked(false)}
                className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                  theme === "dark"
                    ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                    : "bg-slate-200 border-slate-300 text-slate-600 hover:text-slate-900"
                }`}
                title="Lock Authenticator"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </header>

        {/* Content Container */}
        <main className="w-full py-1">
          {!isUnlocked ? (
            <BiometricGate
              config={authConfig}
              theme={theme}
              onConfigured={(newCfg) => setAuthConfig(newCfg)}
              onUnlocked={() => setIsUnlocked(true)}
            />
          ) : (
            <>
              {activeScreen === "vault" && (
                <VaultView
                  keys={keys}
                  theme={theme}
                  onKeysChanged={refreshKeys}
                  onOpenEnrollScanner={() => setActiveScreen("enroll_scanner")}
                  onOpenDecryptScanner={() => setActiveScreen("decrypt_scanner")}
                />
              )}

              {activeScreen === "enroll_scanner" && (
                <EnrollScanner
                  theme={theme}
                  onBack={() => setActiveScreen("vault")}
                  onEnrolledSuccess={() => {
                    refreshKeys();
                    setActiveScreen("vault");
                  }}
                />
              )}

              {activeScreen === "decrypt_scanner" && (
                <DecryptScanner theme={theme} onBack={() => setActiveScreen("vault")} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Persistent Footer */}
      <footer
        className={`w-full text-center py-3 border-t text-[10px] font-mono transition-colors ${
          theme === "dark" ? "border-zinc-800/80 text-zinc-600" : "border-slate-200 text-slate-400"
        }`}
      >
        NIST FIPS 203 & 204 • Optical Air-Gap • Hardware Protected
      </footer>
    </div>
  );
};
