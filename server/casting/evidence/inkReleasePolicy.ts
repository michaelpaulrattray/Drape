import type { CanonicalViewAngle } from "../../../shared/boardTypes";
import {
  assertSupportedInkAnatomyTuple,
  type InkAnatomyTuple,
} from "./inkAnatomyRegistry";

export const INK_RELEASE_POLICY_VERSION =
  "ink.add.release-policy.2026-07-30.v2" as const;

export const INK_AUTHORING_LOCATION_UNAVAILABLE =
  "Tattoo placement is not yet safely supported for that exact location in this release. Nothing was generated or charged.";

export const INK_PROJECTION_LOCATION_UNAVAILABLE =
  "Tattoo coverage is not yet safely supported for this view in this release. Nothing was generated or charged.";

function tupleKey(tuple: InkAnatomyTuple): string {
  return `${tuple.zone}:${tuple.surface}:${tuple.side}`;
}

/**
 * Founder-confirmed G8 authoring results for the current composer/provider
 * configuration. A tuple is not inferred from a neighbouring body region or
 * opposite side: every zone/surface/laterality combination earns release on
 * its own evidence.
 */
const RELEASED_AUTHORING_TUPLES = new Set<string>([
  "face:anterior:centre",
  "upper_torso:anterior:left",
  "upper_torso:anterior:centre",
  "upper_torso:anterior:right",
  "upper_torso:posterior:centre",
  "shoulder:anterior:left",
  "full_arm:circumferential:right",
  "thigh:anterior:left",
]);

export function isInkAuthoringTupleReleased(
  tuple: InkAnatomyTuple,
): boolean {
  assertSupportedInkAnatomyTuple(tuple);
  return RELEASED_AUTHORING_TUPLES.has(tupleKey(tuple));
}

/**
 * Projection v4 corrects the prior target/witness laterality ambiguity by
 * treating generated angle labels as intent rather than anatomical proof.
 * Three-quarter is opened only inside the separately configured evidence
 * composer user scope for one controlled recalibration. Side and Walk remain
 * closed until that smaller cohort earns positive production evidence.
 */
export function isInkProjectionAngleReleased(
  angle: CanonicalViewAngle,
): boolean {
  return angle === "threeQuarter";
}

export function releasedInkProjectionAngles():
  readonly CanonicalViewAngle[] {
  return Object.freeze(["threeQuarter"]);
}
