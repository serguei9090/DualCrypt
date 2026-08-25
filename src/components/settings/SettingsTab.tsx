import { Cpu, Globe, Info, Mail, Settings, Sliders } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { AboutPanel } from "./panels/AboutPanel";
import { CryptoDefaultsPanel } from "./panels/CryptoDefaultsPanel";
import { HardwarePanel } from "./panels/HardwarePanel";
import { SmtpPanel } from "./panels/SmtpPanel";
import { WebServerPanel } from "./panels/WebServerPanel";

type SettingsSection = "smtp" | "webserver" | "hardware" | "crypto" | "about";

export const SettingsTab: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>("smtp");

  const navigationItems = [
    {
      id: "smtp" as SettingsSection,
      label: "Email & SMTP Relay",
      description: "Mail server credentials & share dispatch",
      icon: Mail,
      badge: null,
    },
    {
      id: "webserver" as SettingsSection,
      label: "Local Web Server",
      description: "Embedded browser server & LAN access",
      icon: Globe,
      badge: "8080",
    },
    {
      id: "hardware" as SettingsSection,
      label: "Hardware & YubiKey",
      description: "Physical USB tokens & FIDO2 diagnostics",
      icon: Cpu,
      badge: null,
    },
    {
      id: "crypto" as SettingsSection,
      label: "Cryptographic Defaults",
      description: "AEAD ciphers, quorum policy & zeroize",
      icon: Sliders,
      badge: null,
    },
    {
      id: "about" as SettingsSection,
      label: "About DualCrypt",
      description: "Architecture, gratitude & feedback",
      icon: Info,
      badge: "v0.5.1",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Settings Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-950/60 text-cyan-400 border border-cyan-800/50">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Enterprise Workstation Settings</h2>
            <p className="text-xs text-slate-400">
              Configure communication relays, local web server instances, hardware security tokens,
              and cryptographic hygiene.
            </p>
          </div>
        </div>
      </div>

      {/* Main Settings 2-Column Sidebar Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar Navigation (4 cols) */}
        <div className="md:col-span-4 space-y-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-2 backdrop-blur-md space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none ${
                    isActive
                      ? "bg-slate-800 border border-cyan-500/40 text-slate-100 shadow-md shadow-cyan-500/10"
                      : "hover:bg-slate-800/50 border border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        isActive
                          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                          : "bg-slate-950 text-slate-400 border border-slate-800"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200">{item.label}</div>
                      <div className="text-[10px] text-slate-400 line-clamp-1">
                        {item.description}
                      </div>
                    </div>
                  </div>

                  {item.badge && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950 text-cyan-400 border border-slate-800">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Info Box */}
          <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-950/40 space-y-2">
            <div className="text-xs font-bold text-slate-300">DualCrypt Workstation Vault</div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              All settings and tokens are isolated to this local workstation. No telemetry or
              telemetry credentials are transmitted to any external server.
            </p>
          </div>
        </div>

        {/* Right Active Panel Content (8 cols) */}
        <div className="md:col-span-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md">
          {activeSection === "smtp" && <SmtpPanel />}
          {activeSection === "webserver" && <WebServerPanel />}
          {activeSection === "hardware" && <HardwarePanel />}
          {activeSection === "crypto" && <CryptoDefaultsPanel />}
          {activeSection === "about" && <AboutPanel />}
        </div>
      </div>
    </div>
  );
};
