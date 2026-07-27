import type { EvidenceProbeOutcome } from "../evidenceCandidateContract";
import {
  INK_ADD_COMPOSER_RECIPE_VERSION,
  INK_ADD_IMAGE_ENGINE,
  INK_ADD_PROBE_MODEL,
  INK_ADD_PROBE_RECIPE_VERSION,
} from "./inkAddRecipe";

export const INK_CALIBRATION_RECORD_VERSION =
  "ink.add.calibration-record.v1" as const;

export const INK_CALIBRATION_SOURCE_KINDS =
  ["synthetic", "consented"] as const;
export type InkCalibrationSourceKind =
  typeof INK_CALIBRATION_SOURCE_KINDS[number];

export const INK_CALIBRATION_TONE_COHORTS =
  ["tone_1", "tone_2", "tone_3", "tone_4", "tone_5", "tone_6"] as const;
export type InkCalibrationToneCohort =
  typeof INK_CALIBRATION_TONE_COHORTS[number];

export const INK_CALIBRATION_PRESENTATION_COHORTS =
  ["feminine", "masculine", "androgynous"] as const;
export type InkCalibrationPresentationCohort =
  typeof INK_CALIBRATION_PRESENTATION_COHORTS[number];

export const INK_CALIBRATION_BUILD_COHORTS =
  ["slender", "average", "athletic", "curvy", "plus"] as const;
export type InkCalibrationBuildCohort =
  typeof INK_CALIBRATION_BUILD_COHORTS[number];

export const INK_CALIBRATION_OCCLUSION_COHORTS =
  ["none", "partial"] as const;
export type InkCalibrationOcclusionCohort =
  typeof INK_CALIBRATION_OCCLUSION_COHORTS[number];

export interface InkCalibrationRecord {
  version: typeof INK_CALIBRATION_RECORD_VERSION;
  caseNumber: number;
  sourceKind: InkCalibrationSourceKind;
  toneCohort: InkCalibrationToneCohort;
  presentationCohort: InkCalibrationPresentationCohort;
  buildCohort: InkCalibrationBuildCohort;
  occlusionCohort: InkCalibrationOcclusionCohort;
  imageEngine: typeof INK_ADD_IMAGE_ENGINE;
  composerRecipeVersion: typeof INK_ADD_COMPOSER_RECIPE_VERSION;
  probeModel: typeof INK_ADD_PROBE_MODEL;
  probeRecipeVersion: typeof INK_ADD_PROBE_RECIPE_VERSION;
  attemptCount: 1 | 2;
  overallProbeOutcome: EvidenceProbeOutcome;
  samePersonAfterRetry: boolean;
  correctPlacementAfterRetry: boolean;
  humanDesignFidelityAccepted: boolean;
  explicitAccept: boolean;
  canonCommitted: boolean;
  hiddenSiblingBytesUnchanged: boolean;
  reconciled: boolean;
}

export type NewInkCalibrationRecord = Omit<
  InkCalibrationRecord,
  | "version"
  | "imageEngine"
  | "composerRecipeVersion"
  | "probeModel"
  | "probeRecipeVersion"
>;

function includes<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return values.includes(value as T);
}

export function createInkCalibrationRecord(
  input: NewInkCalibrationRecord,
): InkCalibrationRecord {
  const expectedKeys = [
    "caseNumber",
    "sourceKind",
    "toneCohort",
    "presentationCohort",
    "buildCohort",
    "occlusionCohort",
    "attemptCount",
    "overallProbeOutcome",
    "samePersonAfterRetry",
    "correctPlacementAfterRetry",
    "humanDesignFidelityAccepted",
    "explicitAccept",
    "canonCommitted",
    "hiddenSiblingBytesUnchanged",
    "reconciled",
  ].sort();
  const actualKeys = Object.keys(input).sort();
  if (
    actualKeys.length !== expectedKeys.length
    || actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new TypeError("Invalid ink calibration record");
  }
  if (!Number.isSafeInteger(input.caseNumber) || input.caseNumber <= 0) {
    throw new TypeError("Invalid calibration case number");
  }
  if (
    !includes(INK_CALIBRATION_SOURCE_KINDS, input.sourceKind)
    || !includes(INK_CALIBRATION_TONE_COHORTS, input.toneCohort)
    || !includes(
      INK_CALIBRATION_PRESENTATION_COHORTS,
      input.presentationCohort,
    )
    || !includes(INK_CALIBRATION_BUILD_COHORTS, input.buildCohort)
    || !includes(INK_CALIBRATION_OCCLUSION_COHORTS, input.occlusionCohort)
    || (input.attemptCount !== 1 && input.attemptCount !== 2)
    || !includes(["pass", "fail", "unknown"] as const, input.overallProbeOutcome)
  ) {
    throw new TypeError("Invalid ink calibration record");
  }
  const booleanKeys: readonly (keyof NewInkCalibrationRecord)[] = [
    "samePersonAfterRetry",
    "correctPlacementAfterRetry",
    "humanDesignFidelityAccepted",
    "explicitAccept",
    "canonCommitted",
    "hiddenSiblingBytesUnchanged",
    "reconciled",
  ];
  if (booleanKeys.some((key) => typeof input[key] !== "boolean")) {
    throw new TypeError("Invalid ink calibration record");
  }
  if (input.canonCommitted && !input.explicitAccept) {
    throw new TypeError("Calibration canon requires explicit acceptance");
  }
  if (input.canonCommitted && input.overallProbeOutcome !== "pass") {
    throw new TypeError("Calibration canon requires a passing probe");
  }
  return Object.freeze({
    version: INK_CALIBRATION_RECORD_VERSION,
    caseNumber: input.caseNumber,
    sourceKind: input.sourceKind,
    toneCohort: input.toneCohort,
    presentationCohort: input.presentationCohort,
    buildCohort: input.buildCohort,
    occlusionCohort: input.occlusionCohort,
    imageEngine: INK_ADD_IMAGE_ENGINE,
    composerRecipeVersion: INK_ADD_COMPOSER_RECIPE_VERSION,
    probeModel: INK_ADD_PROBE_MODEL,
    probeRecipeVersion: INK_ADD_PROBE_RECIPE_VERSION,
    attemptCount: input.attemptCount,
    overallProbeOutcome: input.overallProbeOutcome,
    samePersonAfterRetry: input.samePersonAfterRetry,
    correctPlacementAfterRetry: input.correctPlacementAfterRetry,
    humanDesignFidelityAccepted: input.humanDesignFidelityAccepted,
    explicitAccept: input.explicitAccept,
    canonCommitted: input.canonCommitted,
    hiddenSiblingBytesUnchanged: input.hiddenSiblingBytesUnchanged,
    reconciled: input.reconciled,
  });
}

/**
 * Local-only, dependency-free recorder. It deliberately has no filesystem,
 * database, logging, analytics, route, or storage import. A calibration
 * command may persist the returned allowlisted snapshot explicitly.
 */
export function createInkCalibrationRecorder(): {
  record(input: NewInkCalibrationRecord): InkCalibrationRecord;
  snapshot(): readonly InkCalibrationRecord[];
} {
  const records: InkCalibrationRecord[] = [];
  return {
    record(input) {
      const record = createInkCalibrationRecord(input);
      if (records.some((item) => item.caseNumber === record.caseNumber)) {
        throw new TypeError("Duplicate calibration case number");
      }
      records.push(record);
      return record;
    },
    snapshot() {
      return Object.freeze([...records]);
    },
  };
}

export interface InkCalibrationRates {
  samples: number;
  explicitAcceptForCanonRate: number;
  unknownCanonCommits: number;
  samePersonRate: number;
  correctPlacementRate: number;
  designFidelityRate: number;
  hiddenSiblingUnchangedRate: number;
  reconciliationRate: number;
}

function rate(records: readonly InkCalibrationRecord[], key: keyof Pick<
  InkCalibrationRecord,
  | "samePersonAfterRetry"
  | "correctPlacementAfterRetry"
  | "humanDesignFidelityAccepted"
  | "hiddenSiblingBytesUnchanged"
  | "reconciled"
>): number {
  if (!records.length) return 0;
  return records.filter((record) => record[key]).length / records.length;
}

export function summarizeInkCalibration(
  records: readonly InkCalibrationRecord[],
): InkCalibrationRates {
  const canon = records.filter((record) => record.canonCommitted);
  return {
    samples: records.length,
    explicitAcceptForCanonRate: canon.length
      ? canon.filter((record) => record.explicitAccept).length / canon.length
      : 1,
    unknownCanonCommits: canon.filter(
      (record) => record.overallProbeOutcome !== "pass",
    ).length,
    samePersonRate: rate(records, "samePersonAfterRetry"),
    correctPlacementRate: rate(records, "correctPlacementAfterRetry"),
    designFidelityRate: rate(records, "humanDesignFidelityAccepted"),
    hiddenSiblingUnchangedRate: rate(records, "hiddenSiblingBytesUnchanged"),
    reconciliationRate: rate(records, "reconciled"),
  };
}

export interface InkCalibrationGate {
  ready: boolean;
  overall: InkCalibrationRates;
  blockers: readonly string[];
}

function cohortGroups(
  records: readonly InkCalibrationRecord[],
): readonly {
  label: string;
  records: readonly InkCalibrationRecord[];
}[] {
  const keys = [
    "toneCohort",
    "presentationCohort",
    "buildCohort",
    "occlusionCohort",
  ] as const;
  return keys.flatMap((key) => {
    const values = Array.from(new Set(records.map((record) => record[key])));
    return values.map((value) => ({
      label: `${key}:${value}`,
      records: records.filter((record) => record[key] === value),
    }));
  });
}

function rateBlockers(
  prefix: string,
  rates: InkCalibrationRates,
): string[] {
  const blockers: string[] = [];
  if (rates.explicitAcceptForCanonRate !== 1) {
    blockers.push(`${prefix}:explicit_accept`);
  }
  if (rates.unknownCanonCommits !== 0) blockers.push(`${prefix}:unknown_canon`);
  if (rates.samePersonRate < 0.95) blockers.push(`${prefix}:same_person`);
  if (rates.correctPlacementRate < 0.95) blockers.push(`${prefix}:placement`);
  if (rates.designFidelityRate < 0.9) blockers.push(`${prefix}:fidelity`);
  if (rates.hiddenSiblingUnchangedRate !== 1) {
    blockers.push(`${prefix}:hidden_siblings`);
  }
  if (rates.reconciliationRate !== 1) blockers.push(`${prefix}:reconciliation`);
  return blockers;
}

export function evaluateInkCalibrationGate(
  records: readonly InkCalibrationRecord[],
): InkCalibrationGate {
  const overall = summarizeInkCalibration(records);
  if (!records.length) {
    return {
      ready: false,
      overall,
      blockers: ["overall:insufficient_samples"],
    };
  }
  const blockers = rateBlockers("overall", overall);
  for (const cohort of cohortGroups(records)) {
    blockers.push(...rateBlockers(
      `cohort:${cohort.label}`,
      summarizeInkCalibration(cohort.records),
    ));
  }
  return {
    ready: blockers.length === 0,
    overall,
    blockers: Object.freeze(Array.from(new Set(blockers))),
  };
}
