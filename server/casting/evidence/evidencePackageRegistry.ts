import {
  CANONICAL_VIEW_ANGLES,
  type CanonicalViewAngle,
} from "../../../shared/boardTypes";
import { INK_ADD_CAPABILITY_KEY } from "./evidenceCandidateContract";
import {
  INK_ADD_ONTOLOGY_VERSION,
  INK_ADD_SIDES,
  INK_ADD_SURFACE,
  INK_ADD_ZONE,
  type InkAddSide,
} from "./composer/inkAddRecipe";
import type { NormalizedInkZone } from "./composer/inkZoneGuide";

export const EVIDENCE_PACKAGE_GUIDE_RECIPE_VERSION =
  "evidence.package.guide.front-upper-torso.v2" as const;

export type ExistingSelectionImpact = "affected" | "unaffected";
export type MissingViewAuthority = "compose" | "not_supported";
export type EvidenceVisibilityDirective =
  | "authoring_truth"
  | "outside_frame_omit"
  | "hidden_omit"
  | "reproduce_visible";
export type EvidenceFacingDirective =
  | "camera_sees_anatomical_left_walk_frame_left"
  | "camera_sees_anatomical_right_walk_frame_right"
  | "strict_profile_direction_flexible";

export interface EvidencePackageDirective {
  existingSelectionImpact: ExistingSelectionImpact;
  missingViewAuthority: MissingViewAuthority;
  visibility: EvidenceVisibilityDirective;
  requiredVisibleAnatomicalSide: "left" | "right" | null;
  facingDirective: EvidenceFacingDirective | null;
  normalizedTargetZone: NormalizedInkZone | null;
}

const FRONT_LEFT_ZONE = Object.freeze({
  x: 0.54,
  y: 0.2,
  width: 0.27,
  height: 0.25,
}) satisfies NormalizedInkZone;
const FRONT_CENTRE_ZONE = Object.freeze({
  x: 0.365,
  y: 0.19,
  width: 0.27,
  height: 0.26,
}) satisfies NormalizedInkZone;
const FRONT_RIGHT_ZONE = Object.freeze({
  x: 0.19,
  y: 0.2,
  width: 0.27,
  height: 0.25,
}) satisfies NormalizedInkZone;

/**
 * Full-body Walk framing keeps the torso near the horizontal centre. The
 * prompt chooses which anatomical side faces camera; the strict probe, not
 * this rectangle, proves the generated anatomy.
 */
const WALK_LEFT_ZONE = Object.freeze({
  x: 0.34,
  y: 0.17,
  width: 0.3,
  height: 0.27,
}) satisfies NormalizedInkZone;
const WALK_RIGHT_ZONE = Object.freeze({
  x: 0.36,
  y: 0.17,
  width: 0.3,
  height: 0.27,
}) satisfies NormalizedInkZone;

function sameForSides(
  directive: EvidencePackageDirective,
): Readonly<Record<InkAddSide, EvidencePackageDirective>> {
  return Object.freeze({
    left: Object.freeze({ ...directive }),
    centre: Object.freeze({ ...directive }),
    right: Object.freeze({ ...directive }),
  });
}

/**
 * The first evidence-package registry is exhaustive over angle × feature
 * side. A new canonical angle or pilot side cannot compile without an
 * explicit authority decision.
 */
export const INK_ADD_PACKAGE_DIRECTIVES: Readonly<
  Record<
    CanonicalViewAngle,
    Readonly<Record<InkAddSide, EvidencePackageDirective>>
  >
> = Object.freeze({
  frontClose: sameForSides({
    existingSelectionImpact: "unaffected",
    missingViewAuthority: "not_supported",
    visibility: "outside_frame_omit",
    requiredVisibleAnatomicalSide: null,
    facingDirective: null,
    normalizedTargetZone: null,
  }),
  threeQuarter: sameForSides({
    existingSelectionImpact: "unaffected",
    missingViewAuthority: "compose",
    visibility: "outside_frame_omit",
    requiredVisibleAnatomicalSide: null,
    facingDirective: null,
    normalizedTargetZone: null,
  }),
  frontFull: Object.freeze({
    left: Object.freeze({
      existingSelectionImpact: "affected",
      missingViewAuthority: "not_supported",
      visibility: "authoring_truth",
      requiredVisibleAnatomicalSide: "left",
      facingDirective: null,
      normalizedTargetZone: FRONT_LEFT_ZONE,
    }),
    centre: Object.freeze({
      existingSelectionImpact: "affected",
      missingViewAuthority: "not_supported",
      visibility: "authoring_truth",
      requiredVisibleAnatomicalSide: null,
      facingDirective: null,
      normalizedTargetZone: FRONT_CENTRE_ZONE,
    }),
    right: Object.freeze({
      existingSelectionImpact: "affected",
      missingViewAuthority: "not_supported",
      visibility: "authoring_truth",
      requiredVisibleAnatomicalSide: "right",
      facingDirective: null,
      normalizedTargetZone: FRONT_RIGHT_ZONE,
    }),
  }),
  sideClose: sameForSides({
    existingSelectionImpact: "unaffected",
    missingViewAuthority: "compose",
    visibility: "outside_frame_omit",
    requiredVisibleAnatomicalSide: null,
    facingDirective: null,
    normalizedTargetZone: null,
  }),
  sideFull: Object.freeze({
    left: Object.freeze({
      existingSelectionImpact: "affected",
      missingViewAuthority: "compose",
      visibility: "reproduce_visible",
      requiredVisibleAnatomicalSide: "left",
      facingDirective: "camera_sees_anatomical_left_walk_frame_left",
      normalizedTargetZone: WALK_LEFT_ZONE,
    }),
    centre: Object.freeze({
      existingSelectionImpact: "unaffected",
      missingViewAuthority: "compose",
      visibility: "hidden_omit",
      requiredVisibleAnatomicalSide: null,
      facingDirective: "strict_profile_direction_flexible",
      normalizedTargetZone: null,
    }),
    right: Object.freeze({
      existingSelectionImpact: "affected",
      missingViewAuthority: "compose",
      visibility: "reproduce_visible",
      requiredVisibleAnatomicalSide: "right",
      facingDirective: "camera_sees_anatomical_right_walk_frame_right",
      normalizedTargetZone: WALK_RIGHT_ZONE,
    }),
  }),
  backFull: sameForSides({
    existingSelectionImpact: "unaffected",
    missingViewAuthority: "compose",
    visibility: "hidden_omit",
    requiredVisibleAnatomicalSide: null,
    facingDirective: null,
    normalizedTargetZone: null,
  }),
});

export function isSupportedInkPackageTuple(input: {
  capabilityKey: string;
  ontologyVersion: string;
  zone: string;
  surface: string;
  side: string;
}): input is typeof input & { side: InkAddSide } {
  return input.capabilityKey === INK_ADD_CAPABILITY_KEY
    && input.ontologyVersion === INK_ADD_ONTOLOGY_VERSION
    && input.zone === INK_ADD_ZONE
    && input.surface === INK_ADD_SURFACE
    && (INK_ADD_SIDES as readonly string[]).includes(input.side);
}

export function inkPackageDirective(input: {
  capabilityKey: string;
  ontologyVersion: string;
  zone: string;
  surface: string;
  side: string;
  angle: string;
}): EvidencePackageDirective | null {
  if (
    !isSupportedInkPackageTuple(input)
    || !(CANONICAL_VIEW_ANGLES as readonly string[]).includes(input.angle)
  ) {
    return null;
  }
  return INK_ADD_PACKAGE_DIRECTIVES[input.angle as CanonicalViewAngle][input.side];
}
