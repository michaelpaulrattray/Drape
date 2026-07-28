import {
  parseSnapshotReadScope,
  type SnapshotReadScope,
} from "../snapshotReadScope";
import {
  parseEvidenceIngestScope,
  type EvidenceIngestScope,
} from "./evidenceIngestScope";
import { INK_ADD_CAPABILITY_KEY } from "./evidenceCandidateContract";

export const EVIDENCE_COMPOSER_SCOPE_ENV = "R7_EVIDENCE_COMPOSER_SCOPE";
export const EVIDENCE_COMPOSER_RECIPE_ENV = "R7_EVIDENCE_COMPOSER_RECIPE";
export const EVIDENCE_CANDIDATE_WORKER_ENV =
  "ENABLE_EVIDENCE_CANDIDATE_WORKER";

/**
 * D7 opens the compile-time product door only after the complete workflow,
 * founder UI, evidence-aware Fork, and cleanup/recovery boundaries exist.
 * Runtime scope remains server-owned and defaults off.
 */
export const INK_ADD_PRODUCT_READY = true as const;

export type EvidenceComposerScope =
  | { kind: "off" }
  | { kind: "users"; userIds: readonly number[] }
  | { kind: "all" };

export type EvidenceComposerRecipe =
  | { kind: "off" }
  | { kind: "ink_add"; capabilityKey: typeof INK_ADD_CAPABILITY_KEY };

export class EvidenceComposerConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvidenceComposerConfigurationError";
  }
}

export function parseEvidenceComposerScope(
  raw: string | undefined,
): EvidenceComposerScope {
  if (raw === undefined || raw === "" || raw === "off") return { kind: "off" };
  if (raw === "all") return { kind: "all" };
  if (!raw.startsWith("users:") || /\s/.test(raw)) {
    throw new EvidenceComposerConfigurationError(
      `${EVIDENCE_COMPOSER_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
  }
  const members = raw.slice("users:".length).split(",");
  if (
    members.length === 0
    || members.some((member) => !/^[1-9]\d*$/.test(member))
  ) {
    throw new EvidenceComposerConfigurationError(
      `${EVIDENCE_COMPOSER_SCOPE_ENV} contains an invalid user allowlist`,
    );
  }
  const userIds = members.map(Number);
  if (
    userIds.some((userId) => !Number.isSafeInteger(userId) || userId <= 0)
    || new Set(userIds).size !== userIds.length
  ) {
    throw new EvidenceComposerConfigurationError(
      `${EVIDENCE_COMPOSER_SCOPE_ENV} contains an invalid user allowlist`,
    );
  }
  return { kind: "users", userIds: [...userIds].sort((a, b) => a - b) };
}

export function parseEvidenceComposerRecipe(
  raw: string | undefined,
): EvidenceComposerRecipe {
  if (raw === undefined || raw === "" || raw === "off") return { kind: "off" };
  if (raw === INK_ADD_CAPABILITY_KEY) {
    return { kind: "ink_add", capabilityKey: INK_ADD_CAPABILITY_KEY };
  }
  throw new EvidenceComposerConfigurationError(
    `${EVIDENCE_COMPOSER_RECIPE_ENV} must be "off" or "${INK_ADD_CAPABILITY_KEY}"`,
  );
}

function parseBooleanSwitch(raw: string | undefined, name: string): boolean {
  if (raw === undefined || raw === "" || raw === "false") return false;
  if (raw === "true") return true;
  throw new EvidenceComposerConfigurationError(
    `${name} must be exactly "true" or "false"`,
  );
}

function scopeIsSubset(
  requested: EvidenceComposerScope,
  dependency: SnapshotReadScope | EvidenceIngestScope,
): boolean {
  if (requested.kind === "off") return true;
  if (dependency.kind === "all") return true;
  if (requested.kind === "all" || dependency.kind === "off") return false;
  const dependencyIds = new Set(dependency.userIds);
  return requested.userIds.every((userId) => dependencyIds.has(userId));
}

export interface EvidenceComposerEnvironment {
  scope: EvidenceComposerScope;
  recipe: EvidenceComposerRecipe;
  candidateWorkerEnabled: boolean;
}

export function evidenceComposerEnabledForUser(
  scope: EvidenceComposerScope,
  userId: number,
): boolean {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new TypeError("Evidence composer scope requires a positive integer user id");
  }
  return INK_ADD_PRODUCT_READY
    && (
      scope.kind === "all"
      || (scope.kind === "users" && scope.userIds.includes(userId))
    );
}

export function captureEvidenceComposerEnabled(userId: number): boolean {
  return evidenceComposerEnabledForUser(
    parseEvidenceComposerScope(process.env[EVIDENCE_COMPOSER_SCOPE_ENV]),
    userId,
  );
}

/**
 * Pure boot validation. The asynchronous 0013 schema proof is deliberately
 * separate and runs before Express only when this returns a non-off scope.
 */
export function validateEvidenceComposerEnvironment(input: {
  scope: string | undefined;
  recipe: string | undefined;
  candidateWorker: string | undefined;
  cleanupWorker: string | undefined;
  snapshotScope: string | undefined;
  ingestScope: string | undefined;
  adapterConfigured: boolean;
  productReady: boolean;
}): EvidenceComposerEnvironment {
  const scope = parseEvidenceComposerScope(input.scope);
  const recipe = parseEvidenceComposerRecipe(input.recipe);
  const candidateWorkerEnabled = parseBooleanSwitch(
    input.candidateWorker,
    EVIDENCE_CANDIDATE_WORKER_ENV,
  );
  const cleanupWorkerEnabled = parseBooleanSwitch(
    input.cleanupWorker,
    "ENABLE_STORAGE_CLEANUP_WORKER",
  );
  const snapshotScope = parseSnapshotReadScope(input.snapshotScope);
  const ingestScope = parseEvidenceIngestScope(input.ingestScope);

  if (scope.kind !== "off") {
    if (recipe.kind !== "ink_add") {
      throw new EvidenceComposerConfigurationError(
        `${EVIDENCE_COMPOSER_SCOPE_ENV} cannot be enabled while ${EVIDENCE_COMPOSER_RECIPE_ENV} is off`,
      );
    }
    if (!scopeIsSubset(scope, snapshotScope)) {
      throw new EvidenceComposerConfigurationError(
        `${EVIDENCE_COMPOSER_SCOPE_ENV} must be a subset of R7_SNAPSHOT_READ_SCOPE`,
      );
    }
    if (!scopeIsSubset(scope, ingestScope)) {
      throw new EvidenceComposerConfigurationError(
        `${EVIDENCE_COMPOSER_SCOPE_ENV} must be a subset of R7_EVIDENCE_INGEST_SCOPE`,
      );
    }
    if (!input.productReady || !input.adapterConfigured) {
      throw new EvidenceComposerConfigurationError(
        `${EVIDENCE_COMPOSER_SCOPE_ENV} requires authenticated private evidence delivery`,
      );
    }
    if (!cleanupWorkerEnabled || !candidateWorkerEnabled) {
      throw new EvidenceComposerConfigurationError(
        `${EVIDENCE_COMPOSER_SCOPE_ENV} requires both cleanup and candidate workers`,
      );
    }
  }

  return { scope, recipe, candidateWorkerEnabled };
}

export function evidenceComposerSchemaRequired(): boolean {
  return parseEvidenceComposerScope(
    process.env[EVIDENCE_COMPOSER_SCOPE_ENV],
  ).kind !== "off";
}
