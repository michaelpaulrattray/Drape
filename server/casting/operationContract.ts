import { createHash } from "node:crypto";
import { assertClientRequestId } from "../../shared/clientRequestId";

export const GENERATION_OPERATION_KINDS = [
  "model.create",
  "casting.headshot",
  "casting.iterate",
  "casting.mint",
  "casting.add_views",
  "casting.refresh",
  "canvas.cast",
  "canvas.recast",
  "canvas.fork",
  "canvas.variations",
] as const;

export type GenerationOperationKind = typeof GENERATION_OPERATION_KINDS[number];
export type GenerationOperationStatus =
  | "claimed"
  | "running"
  | "succeeded"
  | "failed"
  | "recovery_required";

export function assertGenerationOperationKind(value: unknown): asserts value is GenerationOperationKind {
  if (!GENERATION_OPERATION_KINDS.includes(value as GenerationOperationKind)) {
    throw new TypeError("Unknown generation operation kind");
  }
}

export type PublicOperationResult = Record<string, unknown> | unknown[] | string | number | boolean | null;

export type GenerationOperationOutcome =
  | { type: "claimed"; operationId: string; payloadHash: string }
  | { type: "in_progress"; operationId: string; status: "claimed" | "running" }
  | { type: "replay_success"; operationId: string; result: unknown }
  | { type: "replay_failure"; operationId: string; errorCode: string; publicMessage: string }
  | { type: "payload_conflict"; operationId: string }
  | { type: "resource_busy"; operationId: string; lockKey: string; ownerOperationId?: string }
  | { type: "recovery_required"; operationId: string; publicMessage: string };

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
    const keys = Object.keys(record).sort();
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
