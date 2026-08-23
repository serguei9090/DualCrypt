import { useCallback, useState } from "react";
import { cancelJob } from "../lib/tauri";
import type { ProgressPayload } from "../types/ipc";

export function useCryptoJob() {
  const [isRunning, setIsRunning] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startJob = useCallback((jobId: string) => {
    setIsRunning(true);
    setActiveJobId(jobId);
    setError(null);
    setProgress({
      job_id: jobId,
      bytes_processed: 0,
      total_bytes: 1,
      percentage: 0,
      throughput_bytes_per_sec: 0,
      eta_seconds: 0,
      phase: "Initializing Zeroize Buffers",
    });
  }, []);

  const updateProgress = useCallback((payload: ProgressPayload) => {
    setProgress(payload);
  }, []);

  const finishJob = useCallback(() => {
    setIsRunning(false);
    setActiveJobId(null);
  }, []);

  const failJob = useCallback((err: string) => {
    setIsRunning(false);
    setActiveJobId(null);
    setError(err);
  }, []);

  const abortActiveJob = useCallback(async () => {
    if (activeJobId) {
      await cancelJob(activeJobId);
      setIsRunning(false);
      setActiveJobId(null);
      setError("Operation cancelled and memory zeroized.");
    }
  }, [activeJobId]);

  return {
    isRunning,
    progress,
    error,
    startJob,
    updateProgress,
    finishJob,
    failJob,
    abortActiveJob,
    setError,
  };
}
