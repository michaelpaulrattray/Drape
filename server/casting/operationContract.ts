import { createHash } from "node:crypto";
import { assertClientRequestId } from "../../shared/clientRequestId";

export const GENERATION_OPERATION_KINDS = [
  "model.create",
  "casting.headshot",
  "casting.iterate",
  "casting.mint",
  "casting.add_views",
  "casting.refresh",
  "casting.restore",
  "casting.pin",
  "casting.compact",
  "model.delete",
  "canvas.cast",
  "canvas.recast",
  "canvas.fork",
  "canvas.variations",
] as const;

export type GenerationOperationKind = typeof GENERATION_OPERATION_KINDS[number];

export const GENERATION_OPERATION_STATUSES = [
  "claimed",
  "running",
  "partial",
  "succeeded",
  "failed",
  "recovery_required",
] as const;

export type GenerationOperationStatus = typeof GENERATION_OPERATION_STATUSES[number];

export const GENERATION_OPERATION_PHASES = [
  "planning",
  "generating",
  "saving",
  "refreshing",
  "minting",
  "landing",
  "finalizing",
  "reconciling",
] as const;

export type GenerationOperationPhase = typeof GENERATION_OPERATION_PHASES[number];

export const GENERATION_OPERATION_LANDING_STATUSES = [
  "not_applicable",
  "pending",
  "landed",
  "relink_required",
  "dismissed",
] as const;

export type GenerationOperationLandingStatus = typeof GENERATION_OPERATION_LANDING_STATUSES[number];

export const GENERATION_OPERATION_CHILD_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;

export type GenerationOperationChildStatus = typeof GENERATION_OPERATION_CHILD_STATUSES[number];

export interface GenerationOperationProgressStep {
  stepKey: string;
  viewAngle?: string | null;
  status: GenerationOperationChildStatus;
}

export interface GenerationOperationProgress {
  total: number;
  completed: number;
  failed: number;
  steps: GenerationOperationProgressStep[];
}

export interface PublicGenerationOperationChild {
  id: number;
  stepKey: string | null;
  viewAngle: string | null;
  status: GenerationOperationChildStatus;
  pointsCost: number;
  createdAt: string;
  completedAt: string | null;
}

export interface PublicGenerationOperation {
  operationId: string;
  clientRequestId: string;
  kind: GenerationOperationKind;
  modelId: number | null;
  originBoardId: number | null;
  originItemId: number | null;
  status: GenerationOperationStatus;
  phase: GenerationOperationPhase | null;
  progress: GenerationOperationProgress | null;
  plannedCredits: number;
  chargedCredits: number;
  refundedCredits: number;
  netCredits: number;
  result: PublicOperationResult | null;
  publicMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  heartbeatAt: string | null;
  leaseExpiresAt: string | null;
  cancellable: false;
  landingStatus: GenerationOperationLandingStatus;
  landedItemId: number | null;
  landingAcknowledgedAt: string | null;
  children: PublicGenerationOperationChild[];
}

export function assertGenerationOperationKind(value: unknown): asserts value is GenerationOperationKind {
  if (!GENERATION_OPERATION_KINDS.includes(value as GenerationOperationKind)) {
    throw new TypeError("Unknown generation operation kind");
  }
}

export type PublicOperationResult = Record<string, unknown> | unknown[] | string | number | boolean | null;

export type GenerationOperationOutcome =
  | { type: "claimed"; operationId: string; payloadHash: string }
  | { type: "deleted_subject"; operationId: string }
  | { type: "in_progress"; operationId: string; status: "claimed" | "running" }
  | { type: "replay_success"; operationId: string; result: unknown }
  | { type: "replay_failure"; operationId: string; errorCode: string; publicMessage: string }
  | { type: "payload_conflict"; operationId: string }
  | { type: "resource_busy"; operationId: string; lockKey: string; ownerOperationId?: string }
  | { type: "recovery_required"; operationId: string; publicMessage: string };

export function assertGenerationOperationStatus(value: unknown): asserts value is GenerationOperationStatus {
  if (!GENERATION_OPERATION_STATUSES.includes(value as GenerationOperationStatus)) {
    throw new TypeError("Unknown generation operation status");
  }
}

export function assertGenerationOperationPhase(value: unknown): asserts value is GenerationOperationPhase {
  if (!GENERATION_OPERATION_PHASES.includes(value as GenerationOperationPhase)) {
    throw new TypeError("Unknown generation operation phase");
  }
}

export function assertGenerationOperationLandingStatus(
  value: unknown,
): asserts value is GenerationOperationLandingStatus {
  if (!GENERATION_OPERATION_LANDING_STATUSES.includes(value as GenerationOperationLandingStatus)) {
    throw new TypeError("Unknown generation operation landing status");
  }
}

function assertProgressCount(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TypeError(`${label} must be a non-negative integer`);
  }
}

export function assertGenerationOperationProgress(
  value: unknown,
): asserts value is GenerationOperationProgress {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Operation progress must be an object");
  }
  const candidate = value as Partial<GenerationOperationProgress>;
  assertProgressCount(candidate.total, "progress.total");
  assertProgressCount(candidate.completed, "progress.completed");
  assertProgressCount(candidate.failed, "progress.failed");
  if (candidate.completed + candidate.failed > candidate.total) {
    throw new TypeError("Operation progress exceeds its total");
  }
  if (!Array.isArray(candidate.steps) || candidate.steps.length !== candidate.total) {
    throw new TypeError("Operation progress steps do not match its total");
  }
  const seen = new Set<string>();
  let completedSteps = 0;
  let failedSteps = 0;
  for (const step of candidate.steps) {
    if (!step || typeof step !== "object" || Array.isArray(step)) {
      throw new TypeError("Operation progress contains an invalid step");
    }
    if (typeof step.stepKey !== "string" || !/^[a-z0-9][a-z0-9:_-]{0,63}$/i.test(step.stepKey)) {
      throw new TypeError("Operation progress contains an invalid step key");
    }
    if (seen.has(step.stepKey)) throw new TypeError("Operation progress contains duplicate step keys");
    seen.add(step.stepKey);
    if (
      step.viewAngle !== undefined &&
      step.viewAngle !== null &&
      (typeof step.viewAngle !== "string" || !/^[a-z][a-zA-Z0-9_-]{0,31}$/.test(step.viewAngle))
    ) {
      throw new TypeError("Operation progress contains an invalid view angle");
    }
    if (!GENERATION_OPERATION_CHILD_STATUSES.includes(step.status as GenerationOperationChildStatus)) {
      throw new TypeError("Operation progress contains an invalid child status");
    }
    if (step.status === "completed") completedSteps += 1;
    if (step.status === "failed") failedSteps += 1;
  }
  if (completedSteps !== candidate.completed || failedSteps !== candidate.failed) {
    throw new TypeError("Operation progress counts do not match its child states");
  }
}

const FORBIDDEN_RESULT_KEY = /(prompt|reference|mask|base64|secret|token|authorization|cookie)/i;

function canonicalize(value: unknown, seen: Set<object>): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Operation payload contains a non-finite number");
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new TypeError("Operation payload must contain only JSON values");
  }
  if (seen.has(value)) throw new TypeError("Operation payload must not be cyclic");
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const items: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) throw new TypeError("Operation payload must not contain sparse arrays");
        items.push(canonicalize(value[index], seen));
      }
      return `[${items.join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Operation payload must use plain JSON objects");
    }
    const record = value as Record<string, unknown>;
    // Optional object fields arrive through superjson either absent or
    // explicitly undefined. The server treats those forms identically, so
    // the canonical claim must too. Undefined array entries remain invalid.
    const keys = Object.keys(record).filter((key) => record[key] !== undefined).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key], seen)}`).join(",")}}`;
  } finally {
    seen.delete(value);
  }
}

export function stableCanonicalJson(value: unknown): string {
  return canonicalize(value, new Set());
}

export function hashGenerationOperationClaim(input: {
  clientRequestId: string;
  kind: GenerationOperationKind;
  modelId?: number | null;
  originBoardId?: number | null;
  originItemId?: number | null;
  payload: unknown;
}): string {
  assertClientRequestId(input.clientRequestId);
  const canonical = stableCanonicalJson({
    kind: input.kind,
    modelId: input.modelId ?? null,
    originBoardId: input.originBoardId ?? null,
    originItemId: input.originItemId ?? null,
    payload: input.payload,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function operationChargeReference(operationId: string): string {
  assertClientRequestId(operationId);
  return `op:${operationId}:charge`;
}

export function modelOperationLockKey(modelId: number): string {
  if (!Number.isSafeInteger(modelId) || modelId <= 0) throw new TypeError("modelId must be a positive integer");
  return `model:${modelId}`;
}

export function boardItemOperationLockKey(itemId: number): string {
  if (!Number.isSafeInteger(itemId) || itemId <= 0) throw new TypeError("itemId must be a positive integer");
  return `board-item:${itemId}`;
}

export function assertOperationLockKey(lockKey: string): void {
  if (!/^(model|board-item):[1-9][0-9]*$/.test(lockKey) || lockKey.length > 96) {
    throw new TypeError("Invalid operation lock key");
  }
}

export function assertPublicOperationResult(value: unknown): asserts value is PublicOperationResult {
  stableCanonicalJson(value);
  const visit = (current: unknown): void => {
    if (!current || typeof current !== "object") return;
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
      if (FORBIDDEN_RESULT_KEY.test(key)) {
        throw new TypeError(`Operation result contains forbidden field: ${key}`);
      }
      visit(child);
    }
  };
  visit(value);
}

export function assertCreditConservation(chargedCredits: number, refundedCredits: number): void {
  if (
    !Number.isSafeInteger(chargedCredits) ||
    !Number.isSafeInteger(refundedCredits) ||
    chargedCredits < 0 ||
    refundedCredits < 0 ||
    refundedCredits > chargedCredits
  ) {
    throw new TypeError("Operation credit totals are invalid");
  }
}
