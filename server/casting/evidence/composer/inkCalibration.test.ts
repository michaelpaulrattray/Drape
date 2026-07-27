import { describe, expect, it } from "vitest";
import {
  createInkCalibrationRecord,
  createInkCalibrationRecorder,
  evaluateInkCalibrationGate,
  type NewInkCalibrationRecord,
} from "./inkCalibration";

function healthy(
  caseNumber: number,
  overrides: Partial<NewInkCalibrationRecord> = {},
): NewInkCalibrationRecord {
  return {
    caseNumber,
    sourceKind: "synthetic",
    toneCohort: "tone_3",
    presentationCohort: "androgynous",
    buildCohort: "average",
    occlusionCohort: "none",
    attemptCount: 1,
    overallProbeOutcome: "pass",
    samePersonAfterRetry: true,
    correctPlacementAfterRetry: true,
    humanDesignFidelityAccepted: true,
    explicitAccept: true,
    canonCommitted: true,
    hiddenSiblingBytesUnchanged: true,
    reconciled: true,
    ...overrides,
  };
}

describe("R7-7D local calibration recorder", () => {
  it("records only a closed, non-identifying allowlist with pinned recipes", () => {
    const recorder = createInkCalibrationRecorder();
    const record = recorder.record(healthy(1));
    expect(record).toEqual({
      version: "ink.add.calibration-record.v1",
      ...healthy(1),
      imageEngine: "gemini-3-pro-image-preview",
      composerRecipeVersion: "ink.add.front_upper_torso.composer.v1",
      probeModel: "gemini-2.5-flash",
      probeRecipeVersion: "ink.add.front_upper_torso.probe.v1",
    });
    expect(Object.keys(record).sort()).toEqual([
      "attemptCount",
      "buildCohort",
      "canonCommitted",
      "caseNumber",
      "composerRecipeVersion",
      "correctPlacementAfterRetry",
      "explicitAccept",
      "hiddenSiblingBytesUnchanged",
      "humanDesignFidelityAccepted",
      "imageEngine",
      "occlusionCohort",
      "overallProbeOutcome",
      "presentationCohort",
      "probeModel",
      "probeRecipeVersion",
      "reconciled",
      "samePersonAfterRetry",
      "sourceKind",
      "toneCohort",
      "version",
    ].sort());
    expect(JSON.stringify(record)).not.toMatch(
      /userId|modelId|url|storage|description|prompt|provider|reason/i,
    );
    expect(() => recorder.record(healthy(1))).toThrow("Duplicate");
    expect(() => createInkCalibrationRecord({
      ...healthy(2),
      userId: 99,
    } as NewInkCalibrationRecord)).toThrow("Invalid ink calibration record");
  });

  it("makes an unknown or unaccepted canon structurally unrecordable", () => {
    expect(() => createInkCalibrationRecord(healthy(1, {
      overallProbeOutcome: "unknown",
      canonCommitted: true,
    }))).toThrow("passing probe");
    expect(() => createInkCalibrationRecord(healthy(2, {
      explicitAccept: false,
      canonCommitted: true,
    }))).toThrow("explicit acceptance");
  });

  it("enforces overall and subgroup release thresholds without hiding failures", () => {
    const ready = evaluateInkCalibrationGate([
      createInkCalibrationRecord(healthy(1)),
      createInkCalibrationRecord(healthy(2, {
        toneCohort: "tone_6",
        presentationCohort: "masculine",
        buildCohort: "athletic",
      })),
    ]);
    expect(ready).toMatchObject({ ready: true, blockers: [] });

    const blocked = evaluateInkCalibrationGate([
      createInkCalibrationRecord(healthy(3)),
      createInkCalibrationRecord(healthy(4, {
        toneCohort: "tone_6",
        samePersonAfterRetry: false,
        humanDesignFidelityAccepted: false,
      })),
    ]);
    expect(blocked.ready).toBe(false);
    expect(blocked.blockers).toContain("overall:same_person");
    expect(blocked.blockers.some((item) => item.startsWith("cohort:")))
      .toBe(true);
  });

  it("refuses an empty calibration cohort", () => {
    expect(evaluateInkCalibrationGate([])).toMatchObject({
      ready: false,
      blockers: ["overall:insufficient_samples"],
    });
  });
});
