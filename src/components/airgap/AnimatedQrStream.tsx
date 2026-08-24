import { Pause, Play, Sliders } from "lucide-react";
import QRCode from "qrcode";
import type React from "react";
import { useEffect, useRef, useState } from "react";

interface AnimatedQrStreamProps {
  frames: string[];
  initialFps?: number;
  size?: number;
  className?: string;
}

export const AnimatedQrStream: React.FC<AnimatedQrStreamProps> = ({
  frames,
  initialFps = 7,
  size = 280,
  className = "",
}) => {
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [fps, setFps] = useState(initialFps);
  const [isPlaying, setIsPlaying] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Cycle through frames
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;

    const interval = setInterval(() => {
      setCurrentFrameIndex((prev) => (prev + 1) % frames.length);
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [isPlaying, frames.length, fps]);

  // Render current frame to canvas
  useEffect(() => {
    if (!canvasRef.current || frames.length === 0) return;

    const textToRender = frames[currentFrameIndex] || "";
    QRCode.toCanvas(canvasRef.current, textToRender, {
      width: size,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    }).catch((err) => console.error("QR render error:", err));
  }, [currentFrameIndex, frames, size]);

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="relative p-2.5 bg-white rounded-2xl border-2 border-cyan-500/30 shadow-[0_0_25px_rgba(6,182,212,0.15)] flex items-center justify-center">
        <canvas ref={canvasRef} width={size} height={size} className="rounded-xl block" />
      </div>

      {/* Progress Bar & Frame Info */}
      <div className="w-full max-w-[280px] space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-zinc-400">
            Frame {currentFrameIndex + 1} of {frames.length}
          </span>
          <span className="text-cyan-400 font-semibold">{fps} FPS</span>
        </div>

        {/* Multi-Segment Visual Progress Tracker */}
        <div className="flex gap-1 h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
          {frames.map((_, idx) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: Fixed frame stream index
              key={idx}
              className={`flex-1 transition-colors ${
                idx === currentFrameIndex
                  ? "bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                  : "bg-zinc-700/60"
              }`}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1 text-[11px] font-mono text-zinc-300 hover:text-white px-2 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700 cursor-pointer"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3 h-3 text-amber-400" /> Pause
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-emerald-400" /> Play
              </>
            )}
          </button>

          <div className="flex items-center gap-1.5">
            <Sliders className="w-3 h-3 text-zinc-500" />
            <input
              type="range"
              min="3"
              max="12"
              step="1"
              value={fps}
              onChange={(e) => setFps(parseInt(e.target.value, 10))}
              className="w-20 accent-cyan-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
              title="Adjust optical transmission frame rate (FPS)"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
