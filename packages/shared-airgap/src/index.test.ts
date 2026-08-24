import { describe, expect, it } from "bun:test";
import {
  type AirGapChallenge,
  type AirGapEnrollmentKey,
  AirGapFrameCollector,
  calculateChecksum,
  encodePayloadToFrames,
} from "./index";

describe("Shared Air-Gap Protocol Core", () => {
  it("computes deterministic checksums", () => {
    const c1 = calculateChecksum("TestData123");
    const c2 = calculateChecksum("TestData123");
    expect(c1).toBe(c2);
  });

  it("handles key enrollment frame fragmentation and reassembly", () => {
    const key: AirGapEnrollmentKey = {
      protocol: "DENC-AIRGAP-V1",
      type: "ENROLL_KEY",
      sessionId: "enroll_001",
      fileName: "Confidential_Budget.denc",
      custodianId: 2,
      custodianLabel: "CEO - Alice",
      authType: "keyfile",
      shareDataJson: JSON.stringify({ id: 2, data: [1, 2, 3, 4, 5] }),
      createdAtUtc: 1771940000,
    };

    const frames = encodePayloadToFrames(key, 50);
    expect(frames.length).toBeGreaterThan(2);

    const collector = new AirGapFrameCollector<AirGapEnrollmentKey>();
    let result: ReturnType<typeof collector.addFrame> | null = null;
    for (const frame of frames) {
      result = collector.addFrame(frame);
    }

    expect(result?.completed).toBe(true);
    expect(result?.payload?.type).toBe("ENROLL_KEY");
    expect(result?.payload?.fileName).toBe("Confidential_Budget.denc");
    expect(result?.payload?.custodianId).toBe(2);
  });

  it("handles unlock challenge and response cycle", () => {
    const challenge: AirGapChallenge = {
      protocol: "DENC-AIRGAP-V1",
      type: "CHALLENGE",
      sessionId: "challenge_002",
      fileName: "Vault.denc",
      classification: "TOP_SECRET",
      createdAtUtc: 1771940000,
      thresholdK: 2,
      totalN: 2,
      custodianId: 1,
      custodianLabel: "Security Officer",
      authType: "pqc",
      saltBase64: "c2FsdA==",
      encryptedShareBase64: "ZW5j",
    };

    const frames = encodePayloadToFrames(challenge, 60);
    const collector = new AirGapFrameCollector<AirGapChallenge>();
    let res: ReturnType<typeof collector.addFrame> | null = null;
    for (const frame of frames) {
      res = collector.addFrame(frame);
    }

    expect(res?.completed).toBe(true);
    expect(res?.payload?.classification).toBe("TOP_SECRET");
  });
});
