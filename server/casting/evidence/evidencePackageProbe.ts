import { supportedImageMime } from "../../security/trustedImageFetch";
import {
  INK_ADD_PROBE_MODEL,
} from "./composer/inkAddRecipe";
import type {
  ComposerImage,
  ComposerImageMime,
} from "./composer/inkComposer";
import { INK_TEXT_PROVIDER_CONFIG } from "./composer/inkProviderTelemetry";
import type {
  EvidenceFacingDirective,
  EvidencePackageDirective,
} from "./evidencePackageRegistry";

export const EVIDENCE_PACKAGE_PROBE_RECIPE_VERSION =
  "evidence.package.sync.probe.front-upper-torso.v3" as const;

export const OBSERVED_ANATOMICAL_SIDES = [
  "left",
  "right",
  "none",
  "unknown",
] as const;
export type ObservedAnatomicalSide = typeof OBSERVED_ANATOMICAL_SIDES[number];

export const OBSERVED_TRAVEL_DIRECTIONS = [
  "frame_left",
  "frame_right",
  "stationary",
  "unknown",
] as const;
export type ObservedTravelDirection =
  typeof OBSERVED_TRAVEL_DIRECTIONS[number];

const EXPECTED_TRAVEL_BY_FACING = {
  camera_sees_anatomical_left_walk_frame_left: "frame_left",
  camera_sees_anatomical_right_walk_frame_right: "frame_right",
} as const satisfies Readonly<Record<
  Exclude<EvidenceFacingDirective, "strict_profile_direction_flexible">,
  ObservedTravelDirection
>>;

export const FEATURE_REGION_VISIBILITIES = [
  "visible",
  "hidden",
  "outside_frame",
  "unknown",
] as const;
export type FeatureRegionVisibility =
  typeof FEATURE_REGION_VISIBILITIES[number];

export interface EvidencePackageProbeResponse {
  samePerson: boolean;
  canonicalFraming: boolean;
  continuityPreserved: boolean;
  observedVisibleAnatomicalSide: ObservedAnatomicalSide;
  observedTravelDirection: ObservedTravelDirection;
  featureRegionVisibility: FeatureRegionVisibility;
  authorizedFeatureVisible: boolean;
  acceptedFeatureMatches: boolean;
  correctPlacement: boolean;
  noUnexpectedFeature: boolean;
  confidence: number;
}

export interface EvidencePackageProbeInlineImage {
  role:
    | "identity_anchor"
    | "original_target"
    | "accepted_evidence"
    | "candidate";
  inlineData: { mimeType: ComposerImageMime; data: string };
}

export interface EvidencePackageProbeRequest {
  model: typeof INK_ADD_PROBE_MODEL;
  recipeVersion: typeof EVIDENCE_PACKAGE_PROBE_RECIPE_VERSION;
  responseMimeType: "application/json";
  responseSchema: Readonly<Record<string, string>>;
  thinkingBudget: typeof INK_TEXT_PROVIDER_CONFIG.thinkingBudget;
  includeThoughts: typeof INK_TEXT_PROVIDER_CONFIG.includeThoughts;
  maxOutputTokens: typeof INK_TEXT_PROVIDER_CONFIG.maxOutputTokens;
  prompt: string;
  images: readonly EvidencePackageProbeInlineImage[];
}

function inline(
  role: EvidencePackageProbeInlineImage["role"],
  image: ComposerImage,
): EvidencePackageProbeInlineImage {
  const bytes = Buffer.from(image.bytes);
  if (!bytes.length || supportedImageMime(bytes) !== image.mime) {
    throw new TypeError("Invalid evidence package probe image");
  }
  return {
    role,
    inlineData: { mimeType: image.mime, data: bytes.toString("base64") },
  };
}

export function buildEvidencePackageProbeRequest(input: {
  directive: EvidencePackageDirective;
  identityAnchor: ComposerImage;
  originalTarget: ComposerImage;
  acceptedEvidence: ComposerImage;
  candidate: ComposerImage;
}): EvidencePackageProbeRequest {
  if (input.directive.visibility === "authoring_truth") {
    throw new TypeError("Authoring truth is never package-verified");
  }
  return {
    model: INK_ADD_PROBE_MODEL,
    recipeVersion: EVIDENCE_PACKAGE_PROBE_RECIPE_VERSION,
    responseMimeType: "application/json",
    responseSchema: {
      samePerson: "boolean",
      canonicalFraming: "boolean",
      continuityPreserved: "boolean",
      observedVisibleAnatomicalSide:
        "left|right|none|unknown",
      observedTravelDirection:
        "frame_left|frame_right|stationary|unknown",
      featureRegionVisibility:
        "visible|hidden|outside_frame|unknown",
      authorizedFeatureVisible: "boolean",
      acceptedFeatureMatches: "boolean",
      correctPlacement: "boolean",
      noUnexpectedFeature: "boolean",
      confidence: "integer_0_100",
    },
    ...INK_TEXT_PROVIDER_CONFIG,
    prompt: `Return strict JSON only. Compare four images:
1 identity anchor; 2 original target/body reference; 3 accepted feature
evidence; 4 candidate.

Determine whether the candidate is the same person, obeys the canonical
framing, and preserves body, hair, skin, clothing, lighting, and background.
Inspect the candidate pixels themselves to report which ANATOMICAL side faces
the camera and its frame-relative travel direction. Never infer those fields
from the prompt, slot name, filename, or expected direction.

For a strict walking side profile, visible candidate geometry has one objective
relationship: nose and toes toward frame-left expose the subject's anatomical
left side to the camera; nose and toes toward frame-right expose the anatomical
right side. Apply this only when the candidate pixels clearly prove a strict
profile and travel direction. Otherwise report unknown.

Report what the candidate pixels prove without being told which anatomical side
is expected. Visibility directive: ${input.directive.visibility}. When visible,
the feature must match Image 3 with correct physical placement,
perspective, scale, and lighting. When hidden/outside frame, it must be absent.
No other new tattoo, mark, scar, text, jewellery, object, or body change is
allowed.`,
    images: [
      inline("identity_anchor", input.identityAnchor),
      inline("original_target", input.originalTarget),
      inline("accepted_evidence", input.acceptedEvidence),
      inline("candidate", input.candidate),
    ],
  };
}

function exactObject(raw: unknown): Record<string, unknown> {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TypeError("Invalid evidence package probe response");
  }
  const value = parsed as Record<string, unknown>;
  const expected = [
    "samePerson",
    "canonicalFraming",
    "continuityPreserved",
    "observedVisibleAnatomicalSide",
    "observedTravelDirection",
    "featureRegionVisibility",
    "authorizedFeatureVisible",
    "acceptedFeatureMatches",
    "correctPlacement",
    "noUnexpectedFeature",
    "confidence",
  ].sort();
  const actual = Object.keys(value).sort();
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) {
    throw new TypeError("Invalid evidence package probe response");
  }
  return value;
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new TypeError("Invalid evidence package probe boolean");
  }
  return value;
}

function closedValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new TypeError("Invalid evidence package probe enum");
  }
  return value as T;
}

export function parseEvidencePackageProbeResponse(
  raw: unknown,
): EvidencePackageProbeResponse {
  const value = exactObject(raw);
  if (
    !Number.isSafeInteger(value.confidence)
    || (value.confidence as number) < 0
    || (value.confidence as number) > 100
  ) {
    throw new TypeError("Invalid evidence package probe confidence");
  }
  return {
    samePerson: boolean(value.samePerson),
    canonicalFraming: boolean(value.canonicalFraming),
    continuityPreserved: boolean(value.continuityPreserved),
    observedVisibleAnatomicalSide: closedValue(
      value.observedVisibleAnatomicalSide,
      OBSERVED_ANATOMICAL_SIDES,
    ),
    observedTravelDirection: closedValue(
      value.observedTravelDirection,
      OBSERVED_TRAVEL_DIRECTIONS,
    ),
    featureRegionVisibility: closedValue(
      value.featureRegionVisibility,
      FEATURE_REGION_VISIBILITIES,
    ),
    authorizedFeatureVisible: boolean(value.authorizedFeatureVisible),
    acceptedFeatureMatches: boolean(value.acceptedFeatureMatches),
    correctPlacement: boolean(value.correctPlacement),
    noUnexpectedFeature: boolean(value.noUnexpectedFeature),
    confidence: value.confidence as number,
  };
}

export const EVIDENCE_PACKAGE_PROBE_FAILURES = [
  "probe_unknown",
  "low_confidence",
  "identity_mismatch",
  "framing_mismatch",
  "continuity_mismatch",
  "visible_side_mismatch",
  "travel_direction_mismatch",
  "feature_visibility_mismatch",
  "feature_match_failed",
  "feature_placement_failed",
  "unexpected_feature",
] as const;
export type EvidencePackageProbeFailure =
  typeof EVIDENCE_PACKAGE_PROBE_FAILURES[number];

export type EvidencePackageProbeAssessment =
  | { outcome: "pass"; observedVisibleAnatomicalSide: ObservedAnatomicalSide; observedTravelDirection: ObservedTravelDirection }
  | { outcome: "fail" | "unknown"; failure: EvidencePackageProbeFailure };

function assertNever(value: never): never {
  throw new TypeError(`Unhandled evidence visibility directive: ${String(value)}`);
}

export function assessEvidencePackageProbe(input: {
  directive: EvidencePackageDirective;
  response: EvidencePackageProbeResponse;
}): EvidencePackageProbeAssessment {
  const { directive, response } = input;
  if (
    response.observedVisibleAnatomicalSide === "unknown"
    || response.observedTravelDirection === "unknown"
    || response.featureRegionVisibility === "unknown"
  ) {
    return { outcome: "unknown", failure: "probe_unknown" };
  }
  if (response.confidence < 80) {
    return { outcome: "fail", failure: "low_confidence" };
  }
  if (!response.samePerson) return { outcome: "fail", failure: "identity_mismatch" };
  if (!response.canonicalFraming) return { outcome: "fail", failure: "framing_mismatch" };
  if (!response.continuityPreserved) return { outcome: "fail", failure: "continuity_mismatch" };
  if (!response.noUnexpectedFeature) return { outcome: "fail", failure: "unexpected_feature" };
  const facing = directive.facingDirective;
  if (
    facing
    && facing !== "strict_profile_direction_flexible"
    && response.observedTravelDirection !== EXPECTED_TRAVEL_BY_FACING[facing]
  ) {
    return { outcome: "fail", failure: "travel_direction_mismatch" };
  }

  switch (directive.visibility) {
    case "reproduce_visible": {
      if (
        response.observedVisibleAnatomicalSide
          !== directive.requiredVisibleAnatomicalSide
      ) {
        return { outcome: "fail", failure: "visible_side_mismatch" };
      }
      if (
        response.featureRegionVisibility !== "visible"
        || !response.authorizedFeatureVisible
      ) {
        return { outcome: "fail", failure: "feature_visibility_mismatch" };
      }
      if (!response.acceptedFeatureMatches) {
        return { outcome: "fail", failure: "feature_match_failed" };
      }
      if (!response.correctPlacement) {
        return { outcome: "fail", failure: "feature_placement_failed" };
      }
      break;
    }
    case "hidden_omit":
      if (
        response.featureRegionVisibility !== "hidden"
        || response.authorizedFeatureVisible
      ) {
        return { outcome: "fail", failure: "feature_visibility_mismatch" };
      }
      break;
    case "outside_frame_omit":
      if (
        response.featureRegionVisibility !== "outside_frame"
        || response.authorizedFeatureVisible
      ) {
        return { outcome: "fail", failure: "feature_visibility_mismatch" };
      }
      break;
    case "authoring_truth":
      throw new TypeError("Authoring truth is never package-verified");
    default:
      return assertNever(directive.visibility);
  }

  return {
    outcome: "pass",
    observedVisibleAnatomicalSide: response.observedVisibleAnatomicalSide,
    observedTravelDirection: response.observedTravelDirection,
  };
}
