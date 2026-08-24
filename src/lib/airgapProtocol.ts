/**
 * 📲 DualCrypt Optical Air-Gap Protocol (Multi-Frame Animated QR)
 *
 * Provides zero-network, optical-only data transfer between Workstation and
 * Air-Gapped Mobile Devices using fountain-style animated QR code streams.
 */

export interface AirGapChallenge {
  protocol: "DENC-AIRGAP-V1";
  type: "CHALLENGE";
  sessionId: string;
  fileName: string;
  classification?: string;
  purpose?: string;
  organization?: string;
  createdAtUtc: number;
  thresholdK: number;
  totalN: number;
  custodianId: number;
  custodianLabel: string;
  authType: string;
  saltBase64: string;
  encryptedShareBase64: string;
}

export interface AirGapResponse {
  protocol: "DENC-AIRGAP-V1";
  type: "RESPONSE";
  sessionId: string;
  custodianId: number;
  custodianLabel: string;
  passphrase?: string;
  shareDataJson?: string;
  pqcPrivateKeyBase64?: string;
  biometricVerified: boolean;
  timestamp: string;
}

/** Simple fast 16-bit CRC checksum for frame integrity */
export function calculateChecksum(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Splits a structured JSON payload into animated QR frames
 * Format: DENC1|<session_id>|<index>|<total>|<chunk>|<checksum>
 */
export function encodePayloadToFrames(
  payload: AirGapChallenge | AirGapResponse,
  maxChunkSize = 200,
): string[] {
  const jsonStr = JSON.stringify(payload);
  const totalChunks = Math.ceil(jsonStr.length / maxChunkSize);
  const frames: string[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const chunk = jsonStr.slice(i * maxChunkSize, (i + 1) * maxChunkSize);
    const checksum = calculateChecksum(chunk);
    const frame = `DENC1|${payload.sessionId}|${i + 1}|${totalChunks}|${chunk}|${checksum}`;
    frames.push(frame);
  }

  return frames;
}

export interface CollectorProgress<T> {
  completed: boolean;
  receivedCount: number;
  totalCount: number;
  percentage: number;
  sessionId?: string;
  payload?: T;
  error?: string;
}

/**
 * Robust stream frame collector that handles out-of-order QR scanning
 */
export class AirGapFrameCollector<T = AirGapChallenge | AirGapResponse> {
  private sessionId: string | null = null;
  private totalFrames = 0;
  private frames: Map<number, string> = new Map();

  public reset(): void {
    this.sessionId = null;
    this.totalFrames = 0;
    this.frames.clear();
  }

  public addFrame(rawText: string): CollectorProgress<T> {
    const parts = rawText.split("|");
    if (parts.length < 6 || parts[0] !== "DENC1") {
      return {
        completed: false,
        receivedCount: this.frames.size,
        totalCount: this.totalFrames,
        percentage:
          this.totalFrames > 0 ? Math.round((this.frames.size / this.totalFrames) * 100) : 0,
        error: "Unrecognized QR format",
      };
    }

    const [, frameSessionId, indexStr, totalStr, chunk, checksum] = parts;
    const frameIndex = parseInt(indexStr, 10);
    const frameTotal = parseInt(totalStr, 10);

    // Verify chunk integrity
    if (calculateChecksum(chunk) !== checksum) {
      return {
        completed: false,
        receivedCount: this.frames.size,
        totalCount: this.totalFrames,
        percentage:
          this.totalFrames > 0 ? Math.round((this.frames.size / this.totalFrames) * 100) : 0,
        error: "Corrupted QR frame checksum",
      };
    }

    // Reset if a new session is scanned
    if (this.sessionId && this.sessionId !== frameSessionId) {
      this.reset();
    }

    this.sessionId = frameSessionId;
    this.totalFrames = frameTotal;
    this.frames.set(frameIndex, chunk);

    const receivedCount = this.frames.size;
    const percentage = Math.round((receivedCount / this.totalFrames) * 100);

    if (receivedCount === this.totalFrames) {
      // Reassemble in correct sequence
      let fullJson = "";
      for (let i = 1; i <= this.totalFrames; i++) {
        const slice = this.frames.get(i);
        if (!slice) {
          return {
            completed: false,
            receivedCount,
            totalCount: this.totalFrames,
            percentage,
            sessionId: this.sessionId,
          };
        }
        fullJson += slice;
      }

      try {
        const parsed = JSON.parse(fullJson) as T;
        return {
          completed: true,
          receivedCount,
          totalCount: this.totalFrames,
          percentage: 100,
          sessionId: this.sessionId,
          payload: parsed,
        };
      } catch (err) {
        return {
          completed: false,
          receivedCount,
          totalCount: this.totalFrames,
          percentage,
          sessionId: this.sessionId,
          error: `Failed to parse reassembled JSON: ${String(err)}`,
        };
      }
    }

    return {
      completed: false,
      receivedCount,
      totalCount: this.totalFrames,
      percentage,
      sessionId: this.sessionId,
    };
  }
}
