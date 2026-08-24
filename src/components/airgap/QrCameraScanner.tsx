import jsQR from "jsqr";
import { AlertCircle, Camera, CheckCircle2, Clipboard, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AirGapFrameCollector, type CollectorProgress } from "../../lib/airgapProtocol";

interface QrCameraScannerProps<T> {
  onCompleted: (payload: T) => void;
  targetDescription?: string;
  className?: string;
  onManualInput?: () => void;
}

export function QrCameraScanner<T>({
  onCompleted,
  targetDescription = "Point camera at animated QR stream",
  className = "",
  onManualInput,
}: QrCameraScannerProps<T>) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [collectorProgress, setCollectorProgress] = useState<CollectorProgress<T>>({
    completed: false,
    receivedCount: 0,
    totalCount: 0,
    percentage: 0,
  });
  const [isScanning, setIsScanning] = useState(true);
  const collectorRef = useRef<AirGapFrameCollector<T>>(new AirGapFrameCollector<T>());
  const isMountedRef = useRef(true);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopStream();
    setStreamError(null);
    setIsRetrying(true);

    if (!navigator?.mediaDevices?.getUserMedia) {
      setStreamError("Webcam API not supported in this environment or context is not secure.");
      setIsRetrying(false);
      return;
    }

    let stream: MediaStream | null = null;

    // Strategy 1: Try flexible video constraints (ideal resolution)
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch {
      // Strategy 2: Fallback to basic video request
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (fallbackErr: unknown) {
        if (!isMountedRef.current) return;
        const errName = fallbackErr instanceof Error ? fallbackErr.name : "Error";
        if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
          setStreamError(
            "Camera permission denied. Enable camera access in Windows Settings (Privacy & Security → Camera) or grant permission.",
          );
        } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
          setStreamError("No webcam hardware detected on this workstation.");
        } else if (errName === "NotReadableError" || errName === "TrackStartError") {
          setStreamError(
            "Camera is currently in use by another application (e.g., Zoom, Teams, or Browser).",
          );
        } else {
          setStreamError(
            `Camera unavailable: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`,
          );
        }
        setIsRetrying(false);
        return;
      }
    }

    if (!isMountedRef.current) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }

    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute("playsinline", "true");
      videoRef.current.muted = true;
      try {
        await videoRef.current.play();
      } catch (playErr: unknown) {
        // Ignore AbortError when element unmounts or switches
        if (playErr instanceof Error && playErr.name === "AbortError") {
          setIsRetrying(false);
          return;
        }
        console.warn("Video play error:", playErr);
      }
    }
    setIsRetrying(false);
  }, [stopStream]);

  useEffect(() => {
    isMountedRef.current = true;
    startCamera();

    return () => {
      isMountedRef.current = false;
      stopStream();
    };
  }, [startCamera, stopStream]);

  useEffect(() => {
    let animFrameId: number | null = null;

    const scanLoop = () => {
      if (!isScanning || !isMountedRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2 && video.videoWidth > 0) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (qrCode?.data) {
            const progress = collectorRef.current.addFrame(qrCode.data);
            setCollectorProgress(progress);

            if (progress.completed && progress.payload) {
              setIsScanning(false);
              onCompleted(progress.payload);
              return;
            }
          }
        }
      }

      animFrameId = requestAnimationFrame(scanLoop);
    };

    animFrameId = requestAnimationFrame(scanLoop);

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
    };
  }, [isScanning, onCompleted]);

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="relative w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden border-2 border-cyan-500/40 bg-slate-950 shadow-lg flex items-center justify-center">
        {streamError ? (
          <div className="p-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-bold text-rose-400">Webcam Not Accessible</div>
              <p className="text-[11px] text-slate-400 font-sans max-w-[260px] leading-relaxed">
                {streamError}
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={startCamera}
                disabled={isRetrying}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-900/60 text-xs font-semibold text-cyan-300 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin" : ""}`} />
                <span>{isRetrying ? "Connecting..." : "Retry Camera"}</span>
              </button>
              {onManualInput && (
                <button
                  type="button"
                  onClick={onManualInput}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:outline-none"
                >
                  <Clipboard className="w-3.5 h-3.5 text-slate-400" />
                  <span>Paste Response Data Manually</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay>
              <track kind="captions" />
            </video>
            <canvas ref={canvasRef} className="hidden" />

            {/* Target Alignment Reticle */}
            <div className="absolute inset-4 border-2 border-cyan-400/40 rounded-xl pointer-events-none flex flex-col justify-between p-2">
              <div className="flex justify-between">
                <div className="w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
                <div className="w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
              </div>
              {/* Scanning Laser Animation */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />
              <div className="flex justify-between">
                <div className="w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
                <div className="w-4 h-4 border-b-2 border-r-2 border-cyan-400" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Progress & Guidance Banner */}
      <div className="w-full max-w-[320px] space-y-2 text-center">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            {targetDescription}
          </span>
          {collectorProgress.totalCount > 0 && (
            <span className="text-cyan-400 font-bold">
              {collectorProgress.receivedCount} / {collectorProgress.totalCount} Frames
            </span>
          )}
        </div>

        {/* Capture Progress Meter */}
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-150"
            style={{ width: `${collectorProgress.percentage}%` }}
          />
        </div>

        {collectorProgress.completed ? (
          <div className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-mono font-semibold">
            <CheckCircle2 className="w-4 h-4" /> Stream Captured & Verified (100%)
          </div>
        ) : collectorProgress.receivedCount > 0 ? (
          <div className="inline-flex items-center gap-1.5 text-cyan-300 text-xs font-mono animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" /> Capturing Rotating Frames...
          </div>
        ) : null}
      </div>
    </div>
  );
}
