import {
  AlertTriangle,
  ExternalLink,
  Globe,
  Lock,
  Play,
  Radio,
  RefreshCw,
  Square,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import {
  getLocalWebServerStatus,
  isTauriEnvironment,
  startLocalWebServer,
  stopLocalWebServer,
  type WebServerStatus,
} from "../../../lib/tauri";

export const WebServerPanel: React.FC = () => {
  const [networkMode, setNetworkMode] = useState<"localhost" | "public">("localhost");
  const [port, setPort] = useState<number>(8080);
  const [customHost, setCustomHost] = useState<string>("127.0.0.1");
  const [status, setStatus] = useState<WebServerStatus>({
    is_running: false,
    host: "127.0.0.1",
    port: 8080,
    url: "http://127.0.0.1:8080",
    is_public: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await getLocalWebServerStatus();
      setStatus(s);
      setNetworkMode(s.is_public ? "public" : "localhost");
      setPort(s.port);
      setCustomHost(s.host);
    } catch (err) {
      console.error("Failed to query web server status:", err);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleStartServer = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const host = networkMode === "public" ? "0.0.0.0" : customHost || "127.0.0.1";
      const s = await startLocalWebServer(host, port);
      setStatus(s);
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopServer = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await stopLocalWebServer();
      setStatus((prev) => ({ ...prev, is_running: false }));
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenBrowser = async () => {
    const url = status.url || `http://localhost:${port}`;
    if (isTauriEnvironment()) {
      try {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(url);
      } catch {
        window.open(url, "_blank");
      }
    } else {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Globe className="h-5 w-5 text-cyan-400" />
            <span>Embedded Local Web Server</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Serve the zero-knowledge DualCrypt web application across localhost or your local LAN.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshStatus}
          className="p-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white cursor-pointer focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none"
          title="Refresh server status"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Live Status Banner */}
      <div
        className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
          status.is_running
            ? "bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.15)]"
            : "bg-slate-950/60 border-slate-800"
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold ${
              status.is_running
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse"
                : "bg-slate-800 text-slate-500 border border-slate-700"
            }`}
          >
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-100">
                {status.is_running ? "Local Web Server Online" : "Web Server Offline"}
              </h4>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                  status.is_running
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}
              >
                {status.is_running ? "ACTIVE" : "STOPPED"}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {status.is_running ? status.url : "Ready to launch on local port"}
            </p>
          </div>
        </div>

        {status.is_running && (
          <button
            type="button"
            onClick={handleOpenBrowser}
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600/90 hover:bg-cyan-500 px-4 py-2 text-xs font-bold text-white transition-all shadow-md shadow-cyan-500/20 cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
          >
            <span>Open Web UI</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Network Interface Mode Selector */}
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Network Binding & Access Mode
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setNetworkMode("localhost");
              setCustomHost("127.0.0.1");
            }}
            disabled={status.is_running}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none ${
              networkMode === "localhost"
                ? "bg-slate-800/90 border-cyan-500 text-slate-100 shadow-md shadow-cyan-500/10"
                : "bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold flex items-center gap-1.5 text-cyan-400">
                <Lock className="h-3.5 w-3.5" /> Localhost Only
              </span>
              <span className="text-[10px] font-mono text-slate-400">127.0.0.1</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Only accessible from this local computer. Safest zero-trust configuration.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setNetworkMode("public");
              setCustomHost("0.0.0.0");
            }}
            disabled={status.is_running}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none ${
              networkMode === "public"
                ? "bg-slate-800/90 border-amber-500 text-slate-100 shadow-md shadow-amber-500/10"
                : "bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold flex items-center gap-1.5 text-amber-400">
                <Globe className="h-3.5 w-3.5" /> LAN / Public Network
              </span>
              <span className="text-[10px] font-mono text-slate-400">0.0.0.0</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Exposes server to other devices on your local Wi-Fi or LAN subnet.
            </p>
          </button>
        </div>

        {/* Port & Host Configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="sm:col-span-2 space-y-1.5">
            <label htmlFor="server-host-input" className="text-xs font-semibold text-slate-300">
              Bound Host Interface
            </label>
            <input
              id="server-host-input"
              type="text"
              disabled={status.is_running}
              value={networkMode === "public" ? "0.0.0.0" : customHost}
              onChange={(e) => setCustomHost(e.target.value)}
              className="w-full rounded-xl border border-slate-700/80 bg-slate-900 px-3.5 py-2 text-xs text-slate-200 focus:border-cyan-500 focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none font-mono disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="server-port-input" className="text-xs font-semibold text-slate-300">
              Port
            </label>
            <input
              id="server-port-input"
              type="number"
              disabled={status.is_running}
              value={port}
              onChange={(e) => setPort(Number.parseInt(e.target.value, 10) || 8080)}
              className="w-full rounded-xl border border-slate-700/80 bg-slate-900 px-3.5 py-2 text-xs text-slate-200 focus:border-cyan-500 focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none font-mono disabled:opacity-50"
            />
          </div>
        </div>

        {networkMode === "public" && (
          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <span className="font-semibold">Local LAN Access Warning: </span>
              Anyone on your local network will be able to access the web decryptor interface at{" "}
              <code className="text-amber-200 font-mono">http://&lt;your-local-ip&gt;:{port}</code>.
            </div>
          </div>
        )}

        {/* Server Start / Stop Controls */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-800">
          <div className="text-[11px] text-slate-500 font-mono">
            CLI Alternative:{" "}
            <span className="text-cyan-400">
              denc serve --host {customHost} --port {port}
            </span>
          </div>

          {!status.is_running ? (
            <button
              type="button"
              onClick={handleStartServer}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
            >
              <Play className="h-4 w-4" />
              <span>{isLoading ? "Starting..." : "Start Local Web Server"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopServer}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-600/20 transition-all disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
            >
              <Square className="h-4 w-4" />
              <span>{isLoading ? "Stopping..." : "Stop Web Server"}</span>
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300 font-mono">
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
};
