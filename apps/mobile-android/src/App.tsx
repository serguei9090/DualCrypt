import { Lock, Smartphone } from "lucide-react";
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

export const App: React.FC = () => {
  const [authConfig, setAuthConfig] = useState<AuthConfig>(loadAuthConfig());
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [activeScreen, setActiveScreen] = useState<MobileScreen>("vault");
  const [keys, setKeys] = useState<VaultKeyItem[]>([]);

  useEffect(() => {
    if (isUnlocked) {
      setKeys(loadVaultKeys());
    }
  }, [isUnlocked]);

  const refreshKeys = () => {
    setKeys(loadVaultKeys());
  };

  return (
    <div className="min-h-screen bg-black text-foreground flex flex-col p-4 max-w-md mx-auto justify-between">
      <div className="w-full space-y-4">
        {/* Top Header */}
        <header className="w-full flex items-center justify-between py-2 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <div className="font-mono text-xs font-bold text-white tracking-wider">
                DUALCRYPT AUTHENTICATOR
              </div>
              <div className="text-[10px] text-zinc-400 font-mono">Android Air-Gapped Enclave</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
              ✈️ OFFLINE
            </span>
            {isUnlocked && (
              <button
                type="button"
                onClick={() => setIsUnlocked(false)}
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                title="Lock Authenticator"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </header>

        {/* Content Container */}
        <main className="w-full py-2">
          {!isUnlocked ? (
            <BiometricGate
              config={authConfig}
              onConfigured={(newCfg) => setAuthConfig(newCfg)}
              onUnlocked={() => setIsUnlocked(true)}
            />
          ) : (
            <>
              {activeScreen === "vault" && (
                <VaultView
                  keys={keys}
                  onKeysChanged={refreshKeys}
                  onOpenEnrollScanner={() => setActiveScreen("enroll_scanner")}
                  onOpenDecryptScanner={() => setActiveScreen("decrypt_scanner")}
                />
              )}

              {activeScreen === "enroll_scanner" && (
                <EnrollScanner
                  onBack={() => setActiveScreen("vault")}
                  onEnrolledSuccess={() => {
                    refreshKeys();
                    setActiveScreen("vault");
                  }}
                />
              )}

              {activeScreen === "decrypt_scanner" && (
                <DecryptScanner onBack={() => setActiveScreen("vault")} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Persistent Footer */}
      <footer className="w-full text-center py-3 border-t border-zinc-800/80 text-[10px] font-mono text-zinc-600">
        NIST FIPS 203 & 204 • Optical Air-Gap • Hardware Protected
      </footer>
    </div>
  );
};
