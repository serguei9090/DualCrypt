import jsQR from "jsqr";
import { AlertCircle, Camera, CheckCircle2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AirGapFrameCollector, type CollectorProgress } from "../../lib/airgapProtocol";

interface QrCameraScannerProps<T> {
  onCompleted: (payload: T) => void;
  targetDescription?: string;
  className?: string;
}

export function QrCameraScanner<T>({
  onCompleted,
  targetDescription = "Point camera at animated QR stream",
  className = "",
}: QrCameraScannerProps<T>) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [collectorProgress, setCollectorProgress] = useState<CollectorProgress<T>>({
    completed: false,
    receivedCount: 0,
    totalCount: 0,
    percentage: 0,
  });
  const [isScanning, setIsScanning] = useState(true);
  const collectorRef = useRef<AirGapFrameCollector<T>>(new AirGapFrameCollector<T>());

  useEffect(() => {
    let mediaStream: MediaStream | null = null;
    let animFrameId: number | null = null;

    const startCamera = async () => {
      try {
        setStreamError(null);
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play();
          scanLoop();
        }
      } catch (err) {
        setStreamError(`Camera access denied or unavailable: ${String(err)}`);
      }
    };

    const scanLoop = () => {
      if (!isScanning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
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

    startCamera();

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (mediaStream) {
        for (const track of mediaStream.getTracks()) {
          track.stop();
        }
      }
    };
  }, [isScanning, onCompleted]);

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="relative w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden border-2 border-primary/40 bg-zinc-950 shadow-lg flex items-center justify-center">
        {streamError ? (
          <div className="p-4 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-xs text-red-300 font-mono">{streamError}</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline>
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
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-primary" />
            {targetDescription}
          </span>
          {collectorProgress.totalCount > 0 && (
            <span className="text-cyan-400 font-bold">
              {collectorProgress.receivedCount} / {collectorProgress.totalCount} Frames
            </span>
          )}
        </div>

        {/* Capture Progress Meter */}
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
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
