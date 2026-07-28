import {
  assertGenerationOperationKind,
  type GenerationOperationKind,
} from "../operationContract";

export const OPERATION_REPLAY_FAMILIES = [
  "refresh",
  "mint",
] as const;

export type OperationReplayFamily = typeof OPERATION_REPLAY_FAMILIES[number];

/**
 * Exhaustive replay classification. `null` is deliberate: those operation
 * kinds cannot be reached through a state-derived Refresh/Mint route.
 */
export const OPERATION_REPLAY_FAMILY_BY_KIND: Readonly<
  Record<GenerationOperationKind, OperationReplayFamily | null>
> = {
  "model.create": null,
  "casting.headshot": null,
  "casting.iterate": null,
  "casting.mint": "mint",
  "casting.add_views": "mint",
  evidence_plate_ingest: null,
  evidence_plate_discard: null,
  evidence_intent_begin: null,
  evidence_intent_reference: null,
  evidence_candidate_generate: null,
  evidence_candidate_retry: null,
  evidence_candidate_accept: null,
  evidence_candidate_cancel: null,
  evidence_fork_copy: null,
  evidence_package_sync: "refresh",
  evidence_mint: "mint",
  "casting.refresh": "refresh",
  "casting.restore": null,
  "casting.pin": null,
  "casting.compact": null,
  "model.delete": null,
  "canvas.cast": null,
  "canvas.recast": null,
  "canvas.fork": null,
  "canvas.variations": null,
};

export type ReplayKindResolution =
  | { type: "resolved"; kind: GenerationOperationKind; source: "stored" | "derived" }
  | { type: "family_conflict" };

/**
 * Pure route authority for endpoints whose operation kind is selected from
 * current model state. A stored receipt always wins within its endpoint
 * family; the route must never re-derive its kind on replay.
 */
export function resolveOperationKindForReplay(input: {
  family: OperationReplayFamily;
  derivedKind: GenerationOperationKind;
  storedKind?: unknown;
}): ReplayKindResolution {
  if (OPERATION_REPLAY_FAMILY_BY_KIND[input.derivedKind] !== input.family) {
    throw new TypeError("Derived operation kind is outside the replay family");
  }
  if (input.storedKind === undefined || input.storedKind === null) {
    return { type: "resolved", kind: input.derivedKind, source: "derived" };
  }
  try {
    assertGenerationOperationKind(input.storedKind);
  } catch {
    return { type: "family_conflict" };
  }
  if (OPERATION_REPLAY_FAMILY_BY_KIND[input.storedKind] !== input.family) {
    return { type: "family_conflict" };
  }
  return { type: "resolved", kind: input.storedKind, source: "stored" };
}
