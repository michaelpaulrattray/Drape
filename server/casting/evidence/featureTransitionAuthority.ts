import type { GenerationOperationKind } from "../operationContract";

export type FeatureTransitionAuthority =
  | "evidence_blind"
  | "document_only"
  | "evidence_aware"
  | "not_applicable";

/**
 * Every durable model operation is classified explicitly. Adding a new
 * operation kind is a compile error here, so a future writer cannot inherit
 * feature authority accidentally.
 */
export const FEATURE_TRANSITION_AUTHORITY:
  Readonly<Record<GenerationOperationKind, FeatureTransitionAuthority>> = {
    "model.create": "not_applicable",
    "casting.headshot": "evidence_blind",
    "casting.iterate": "evidence_blind",
    "casting.mint": "evidence_blind",
    "casting.add_views": "evidence_blind",
    evidence_plate_ingest: "not_applicable",
    evidence_plate_discard: "not_applicable",
    evidence_intent_begin: "not_applicable",
    evidence_intent_reference: "not_applicable",
    evidence_candidate_generate: "evidence_aware",
    evidence_candidate_retry: "evidence_aware",
    evidence_candidate_accept: "evidence_aware",
    evidence_candidate_cancel: "evidence_aware",
    evidence_fork_copy: "evidence_aware",
    evidence_package_sync: "evidence_aware",
    evidence_mint: "evidence_aware",
    "casting.refresh": "evidence_blind",
    "casting.restore": "evidence_blind",
    "casting.restore_state": "evidence_aware",
    "casting.pin": "not_applicable",
    "casting.compact": "document_only",
    "model.delete": "not_applicable",
    "canvas.cast": "not_applicable",
    "canvas.recast": "evidence_blind",
    "canvas.fork": "evidence_blind",
    "canvas.variations": "evidence_blind",
    // Pre-Sign: a roll has no model, so there is no feature state to be
    // aware of or blind to.
    "castingV2.roll": "not_applicable",
    /*
      Sign CREATES the Cast, so there is no prior feature state for it to be
      aware of or blind to: a newly signed Cast has no accepted ink evidence by
      construction. Evidence-aware operations start after it exists.
    */
    "castingV2.sign": "not_applicable",
  };

export const FEATURE_BLIND_OPERATION_MESSAGE =
  "This Cast includes accepted tattoo evidence. Recast, Iterate, Variations, and Restore remain unavailable in this release.";

export const FEATURE_PACKAGE_OPERATION_MESSAGE =
  "Evidence-aware view updates are temporarily unavailable. Nothing was generated or charged.";

export const FEATURE_MINT_OPERATION_MESSAGE =
  "Evidence-aware minting is temporarily unavailable. Nothing was generated or charged.";

export function featureTransitionAuthorityFor(
  kind: GenerationOperationKind,
): FeatureTransitionAuthority {
  return FEATURE_TRANSITION_AUTHORITY[kind];
}
