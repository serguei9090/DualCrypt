import { describe, expect, it } from "bun:test";
import {
  type AirGapChallenge,
  AirGapFrameCollector,
  type AirGapResponse,
  calculateChecksum,
  encodePayloadToFrames,
} from "./airgapProtocol";

describe("Air-Gap Optical Protocol", () => {
  it("computes deterministic checksums", () => {
    const cs1 = calculateChecksum("Hello World");
    const cs2 = calculateChecksum("Hello World");
    const cs3 = calculateChecksum("Hello World!");

    expect(cs1).toBe(cs2);
    expect(cs1).not.toBe(cs3);
  });

  it("splits and reassembles AirGapChallenge payload across multiple frames", () => {
    const challenge: AirGapChallenge = {
      protocol: "DENC-AIRGAP-V1",
      type: "CHALLENGE",
      sessionId: "ses_12345",
      fileName: "Q3_Treasury_Vault.denc",
      classification: "TOP_SECRET",
      purpose: "Disaster Recovery Liquidity Reserves",
      organization: "Global Corporate Treasury",
      createdAtUtc: 1771940000,
      thresholdK: 2,
      totalN: 3,
      custodianId: 2,
      custodianLabel: "Alice - Security Officer",
      authType: "pqc",
      saltBase64: "dGVzdF9zYWx0XzMyX2J5dGVzX2xvbmdfc2VjdXJl",
      encryptedShareBase64: "ZW5jcnlwdGVkX3NoYXJlX2NpcGhlcnRleHRfc2xpY2VfZGF0YQ==",
    };

    const frames = encodePayloadToFrames(challenge, 80);
    expect(frames.length).toBeGreaterThan(3);

    const collector = new AirGapFrameCollector<AirGapChallenge>();
    let lastProgress: ReturnType<typeof collector.addFrame> | null = null;

    // Feed frames in reverse order to test out-of-order reassembly
    const shuffled = [...frames].reverse();
    for (const frame of shuffled) {
      lastProgress = collector.addFrame(frame);
    }

    expect(lastProgress?.completed).toBe(true);
    expect(lastProgress?.percentage).toBe(100);
    expect(lastProgress?.payload?.sessionId).toBe(challenge.sessionId);
    expect(lastProgress?.payload?.fileName).toBe(challenge.fileName);
    expect(lastProgress?.payload?.classification).toBe("TOP_SECRET");
    expect(lastProgress?.payload?.custodianId).toBe(2);
  });

  it("splits and reassembles AirGapResponse payload", () => {
    const response: AirGapResponse = {
      protocol: "DENC-AIRGAP-V1",
      type: "RESPONSE",
      sessionId: "ses_12345",
      custodianId: 2,
      custodianLabel: "Alice - Security Officer",
      passphrase: "SecretPassphrase#2026",
      biometricVerified: true,
      timestamp: "2026-08-24T12:00:00.000Z",
    };

    const frames = encodePayloadToFrames(response, 60);
    const collector = new AirGapFrameCollector<AirGapResponse>();

    let lastProgress: ReturnType<typeof collector.addFrame> | null = null;
    for (const frame of frames) {
      lastProgress = collector.addFrame(frame);
    }

    expect(lastProgress?.completed).toBe(true);
    expect(lastProgress?.payload?.passphrase).toBe("SecretPassphrase#2026");
    expect(lastProgress?.payload?.biometricVerified).toBe(true);
  });

  it("detects corrupted frame checksum and rejects bad frame", () => {
    const response: AirGapResponse = {
      protocol: "DENC-AIRGAP-V1",
      type: "RESPONSE",
      sessionId: "ses_corrupt",
      custodianId: 1,
      custodianLabel: "Bob",
      biometricVerified: false,
      timestamp: "2026-08-24T12:00:00.000Z",
    };

    const frames = encodePayloadToFrames(response, 50);
    const corruptedFrame = `${frames[0]}TAMPERED`;

    const collector = new AirGapFrameCollector<AirGapResponse>();
    const progress = collector.addFrame(corruptedFrame);

    expect(progress.completed).toBe(false);
    expect(progress.error).toBeDefined();
  });
});
