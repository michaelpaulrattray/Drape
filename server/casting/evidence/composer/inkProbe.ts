import type { EvidenceProbeOutcome } from "../evidenceCandidateContract";
import {
  INK_ADD_MAX_DESCRIPTOR_LENGTH,
  INK_ADD_MIN_DESCRIPTOR_LENGTH,
  INK_ADD_PROBE_MODEL,
  INK_ADD_PROBE_RECIPE_VERSION,
  INK_ADD_VISIBILITY_RECIPE_VERSION,
  assertInkAddSide,
  type InkAddSide,
} from "./inkAddRecipe";
import type { ComposerImage, ComposerImageMime } from "./inkComposer";
import { normalizeInkDescriptor } from "./inkAuthorization";
import { supportedImageMime } from "../../../security/trustedImageFetch";
import { INK_TEXT_PROVIDER_CONFIG } from "./inkProviderTelemetry";
import {
  INK_ANYWHERE_PROBE_RECIPE_VERSION,
  INK_ANYWHERE_COVERAGE_PROBE_RECIPE_VERSION,
  INK_ANYWHERE_PLACEMENT_AUDIT_RECIPE_VERSION,
  INK_ANYWHERE_PROJECTION_PROBE_RECIPE_VERSION,
  INK_ANYWHERE_VISIBILITY_RECIPE_VERSION,
  assertSupportedInkAnatomyTuple,
  inkAnatomicalSideAuthority,
  inkAnatomyLabel,
  type InkAnatomyTuple,
} from "../inkAnatomyRegistry";
import type { CanonicalViewAngle } from "../../../../shared/boardTypes";

export type InkProbeKind =
  | "visibility"
  | "identity_pose"
  | "feature_placement"
  | "feature_projection"
  | "coverage";

export interface InkProbeInlineImage {
  role:
    | "identity_anchor"
    | "original_target"
    | "candidate"
    | "evidence_reference"
    | "evidence_mosaic";
  inlineData: {
    mimeType: ComposerImageMime;
    data: string;
  };
}

export interface InkProbeRequest {
  kind: InkProbeKind;
  model: typeof INK_ADD_PROBE_MODEL;
  recipeVersion:
    | typeof INK_ADD_PROBE_RECIPE_VERSION
    | typeof INK_ADD_VISIBILITY_RECIPE_VERSION
    | typeof INK_ANYWHERE_PROBE_RECIPE_VERSION
    | typeof INK_ANYWHERE_COVERAGE_PROBE_RECIPE_VERSION
    | typeof INK_ANYWHERE_PLACEMENT_AUDIT_RECIPE_VERSION
    | typeof INK_ANYWHERE_PROJECTION_PROBE_RECIPE_VERSION
    | typeof INK_ANYWHERE_VISIBILITY_RECIPE_VERSION;
  responseMimeType: "application/json";
  responseSchema: Readonly<Record<string, "boolean" | "integer_0_100">>;
  thinkingBudget: typeof INK_TEXT_PROVIDER_CONFIG.thinkingBudget;
  includeThoughts: typeof INK_TEXT_PROVIDER_CONFIG.includeThoughts;
  maxOutputTokens: typeof INK_TEXT_PROVIDER_CONFIG.maxOutputTokens;
  prompt: string;
  images: readonly InkProbeInlineImage[];
}

export interface InkVisibilityProbe {
  predictedVisibility: EvidenceProbeOutcome;
  confidence: number | null;
}

export interface InkCandidateProbeTruth {
  predictedVisibility: EvidenceProbeOutcome;
  identityOutcome: EvidenceProbeOutcome;
  placementOutcome: EvidenceProbeOutcome;
  featureMatchOutcome: EvidenceProbeOutcome;
  priorInkOutcome: EvidenceProbeOutcome;
  poseFramingOutcome: EvidenceProbeOutcome;
  unexpectedInkOutcome: EvidenceProbeOutcome;
  overallOutcome: EvidenceProbeOutcome;
}

interface VisibilityResponse {
  upperTorsoVisible: boolean;
  materiallyOccluded: boolean;
  confidence: number;
}

interface IdentityPoseResponse {
  samePerson: boolean;
  poseFramingPreserved: boolean;
  confidence: number;
}

interface FeaturePlacementResponse {
  correctPlacement: boolean;
  requestedFeaturePresent: boolean;
  noUnexpectedInk: boolean;
  confidence: number;
}

interface AnywhereVisibilityResponse {
  targetRegionVisible: boolean;
  anatomicalSideReadable: boolean;
  materiallyOccluded: boolean;
  confidence: number;
}

interface AnywhereFeaturePlacementResponse {
  correctPlacement: boolean;
  requestedFeaturePresent: boolean;
  priorVisibleInkPreserved: boolean;
  noUnexpectedInk: boolean;
  confidence: number;
}

interface AnywherePlacementAuditResponse {
  anatomicalSideCorrect: boolean;
  insideAuthorizedZone: boolean;
  conflictingOutsideChange: boolean;
  confidence: number;
}

function inline(
  role: InkProbeInlineImage["role"],
  image: ComposerImage,
): InkProbeInlineImage {
  const bytes = Buffer.from(image.bytes);
  if (!bytes.length || supportedImageMime(bytes) !== image.mime) {
    throw new TypeError("Invalid probe image");
  }
  return {
    role,
    inlineData: {
      mimeType: image.mime,
      data: bytes.toString("base64"),
    },
  };
}

function exactObject(
  raw: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TypeError("Invalid evidence probe response");
  }
  const value = parsed as Record<string, unknown>;
  const expected = [...keys].sort();
  const actual = Object.keys(value).sort();
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) {
    throw new TypeError("Invalid evidence probe response");
  }
  return value;
}

function confidence(value: unknown): number {
  if (
    !Number.isInteger(value)
    || (value as number) < 0
    || (value as number) > 100
  ) {
    throw new TypeError("Invalid evidence probe confidence");
  }
  return value as number;
}

function bool(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new TypeError("Invalid evidence probe boolean");
  }
  return value;
}

export function parseInkVisibilityProbe(raw: unknown): VisibilityResponse {
  const value = exactObject(raw, [
    "upperTorsoVisible",
    "materiallyOccluded",
    "confidence",
  ]);
  return {
    upperTorsoVisible: bool(value.upperTorsoVisible),
    materiallyOccluded: bool(value.materiallyOccluded),
    confidence: confidence(value.confidence),
  };
}

export function parseInkIdentityPoseProbe(raw: unknown): IdentityPoseResponse {
  const value = exactObject(raw, [
    "samePerson",
    "poseFramingPreserved",
    "confidence",
  ]);
  return {
    samePerson: bool(value.samePerson),
    poseFramingPreserved: bool(value.poseFramingPreserved),
    confidence: confidence(value.confidence),
  };
}

export function parseInkFeaturePlacementProbe(
  raw: unknown,
): FeaturePlacementResponse {
  const value = exactObject(raw, [
    "correctPlacement",
    "requestedFeaturePresent",
    "noUnexpectedInk",
    "confidence",
  ]);
  return {
    correctPlacement: bool(value.correctPlacement),
    requestedFeaturePresent: bool(value.requestedFeaturePresent),
    noUnexpectedInk: bool(value.noUnexpectedInk),
    confidence: confidence(value.confidence),
  };
}

export function parseInkAnywhereVisibilityProbe(
  raw: unknown,
): AnywhereVisibilityResponse {
  const value = exactObject(raw, [
    "targetRegionVisible",
    "anatomicalSideReadable",
    "materiallyOccluded",
    "confidence",
  ]);
  return {
    targetRegionVisible: bool(value.targetRegionVisible),
    anatomicalSideReadable: bool(value.anatomicalSideReadable),
    materiallyOccluded: bool(value.materiallyOccluded),
    confidence: confidence(value.confidence),
  };
}

export function parseInkAnywhereFeaturePlacementProbe(
  raw: unknown,
): AnywhereFeaturePlacementResponse {
  const value = exactObject(raw, [
    "correctPlacement",
    "requestedFeaturePresent",
    "priorVisibleInkPreserved",
    "noUnexpectedInk",
    "confidence",
  ]);
  return {
    correctPlacement: bool(value.correctPlacement),
    requestedFeaturePresent: bool(value.requestedFeaturePresent),
    priorVisibleInkPreserved: bool(value.priorVisibleInkPreserved),
    noUnexpectedInk: bool(value.noUnexpectedInk),
    confidence: confidence(value.confidence),
  };
}

export function parseInkAnywherePlacementAuditProbe(
  raw: unknown,
): AnywherePlacementAuditResponse {
  const value = exactObject(raw, [
    "anatomicalSideCorrect",
    "insideAuthorizedZone",
    "conflictingOutsideChange",
    "confidence",
  ]);
  return {
    anatomicalSideCorrect: bool(value.anatomicalSideCorrect),
    insideAuthorizedZone: bool(value.insideAuthorizedZone),
    conflictingOutsideChange: bool(value.conflictingOutsideChange),
    confidence: confidence(value.confidence),
  };
}

export function buildInkVisibilityProbeRequest(input: {
  target: ComposerImage;
}): InkProbeRequest {
  return {
    kind: "visibility",
    model: INK_ADD_PROBE_MODEL,
    recipeVersion: INK_ADD_VISIBILITY_RECIPE_VERSION,
    responseMimeType: "application/json",
    responseSchema: {
      upperTorsoVisible: "boolean",
      materiallyOccluded: "boolean",
      confidence: "integer_0_100",
    },
    ...INK_TEXT_PROVIDER_CONFIG,
    prompt: `Assess only whether the front upper torso is sufficiently visible
for a bounded chest-tattoo edit. Pass requires a front-facing upper torso with
both chest placement and skin region readable at useful scale. Clothing,
hands, hair, objects, crop, or pose materially covering that region count as
occlusion. Do not infer hidden pixels. Return strict JSON only.`,
    images: [inline("original_target", input.target)],
  };
}

export function buildInkIdentityPoseProbeRequest(input: {
  identityAnchor: ComposerImage;
  originalTarget: ComposerImage;
  candidate: ComposerImage;
}): InkProbeRequest {
  return {
    kind: "identity_pose",
    model: INK_ADD_PROBE_MODEL,
    recipeVersion: INK_ADD_PROBE_RECIPE_VERSION,
    responseMimeType: "application/json",
    responseSchema: {
      samePerson: "boolean",
      poseFramingPreserved: "boolean",
      confidence: "integer_0_100",
    },
    ...INK_TEXT_PROVIDER_CONFIG,
    prompt: `Image 1 is the immutable identity anchor. Image 2 is the original
target. Image 3 is a candidate allowed to add one chest tattoo only. Determine
whether Image 3 is the exact same person and whether pose, crop, camera,
framing, body proportions, clothing, lighting, and background remain materially
the same as Image 2. The authorized tattoo must not count as drift. Return
strict JSON only.`,
    images: [
      inline("identity_anchor", input.identityAnchor),
      inline("original_target", input.originalTarget),
      inline("candidate", input.candidate),
    ],
  };
}

export function buildInkAnywhereVisibilityProbeRequest(input: {
  target: ComposerImage;
  anatomy: InkAnatomyTuple;
}): InkProbeRequest {
  assertSupportedInkAnatomyTuple(input.anatomy);
  const location = inkAnatomyLabel(input.anatomy);
  return {
    kind: "visibility",
    model: INK_ADD_PROBE_MODEL,
    recipeVersion: INK_ANYWHERE_VISIBILITY_RECIPE_VERSION,
    responseMimeType: "application/json",
    responseSchema: {
      targetRegionVisible: "boolean",
      anatomicalSideReadable: "boolean",
      materiallyOccluded: "boolean",
      confidence: "integer_0_100",
    },
    ...INK_TEXT_PROVIDER_CONFIG,
    prompt: `Assess only whether ${location} is sufficiently visible in this
image to author one tattoo at useful 1K detail. The resolved tuple is
zone=${input.anatomy.zone}, surface=${input.anatomy.surface},
side=${input.anatomy.side}. targetRegionVisible requires real observable skin
or an already visible tattoo-bearing surface at useful scale.
anatomicalSideReadable requires that the person's anatomical side and requested
surface can be identified without guessing or mirroring. Clothing, hair, hands,
objects, crop, foreshortening, or pose materially covering the requested region
count as occlusion. A circumferential request needs a useful visible portion,
not proof of the hidden circumference. Do not infer hidden pixels. Return
strict JSON only.`,
    images: [inline("original_target", input.target)],
  };
}

export function buildInkAnywhereIdentityPoseProbeRequest(input: {
  identityAnchor: ComposerImage;
  originalTarget: ComposerImage;
  candidate: ComposerImage;
  anatomy: InkAnatomyTuple;
}): InkProbeRequest {
  assertSupportedInkAnatomyTuple(input.anatomy);
  return {
    kind: "identity_pose",
    model: INK_ADD_PROBE_MODEL,
    recipeVersion: INK_ANYWHERE_PROBE_RECIPE_VERSION,
    responseMimeType: "application/json",
    responseSchema: {
      samePerson: "boolean",
      poseFramingPreserved: "boolean",
      confidence: "integer_0_100",
    },
    ...INK_TEXT_PROVIDER_CONFIG,
    prompt: `Image 1 is the immutable identity anchor. Image 2 is the original
target. Image 3 is a candidate allowed to add one tattoo at
${inkAnatomyLabel(input.anatomy)} only. Determine whether Image 3 is the exact
same person and whether body proportions, pose, crop, camera, framing,
clothing, lighting, and background remain materially the same as Image 2.
The one authorized tattoo and exact preservation of prior ink must not count
as identity drift. Return strict JSON only.`,
    images: [
      inline("identity_anchor", input.identityAnchor),
      inline("original_target", input.originalTarget),
      inline("candidate", input.candidate),
    ],
  };
}

export function buildInkAnywhereFeaturePlacementProbeRequest(input: {
  originalTarget: ComposerImage;
  candidate: ComposerImage;
  evidenceReference?: ComposerImage;
  anatomy: InkAnatomyTuple;
  normalizedDescriptor: string;
}): InkProbeRequest {
  assertSupportedInkAnatomyTuple(input.anatomy);
  if (
    normalizeInkDescriptor(input.normalizedDescriptor)
      !== input.normalizedDescriptor
    || input.normalizedDescriptor.length < INK_ADD_MIN_DESCRIPTOR_LENGTH
    || input.normalizedDescriptor.length > INK_ADD_MAX_DESCRIPTOR_LENGTH
  ) {
    throw new TypeError("Invalid ink descriptor");
  }
  const images = [
    inline("original_target", input.originalTarget),
    inline("candidate", input.candidate),
  ];
  if (input.evidenceReference) {
    images.push(inline("evidence_reference", input.evidenceReference));
  }
  if (images.length > 3) throw new TypeError("Probe reference budget exceeded");
  return {
    kind: "feature_placement",
    model: INK_ADD_PROBE_MODEL,
    recipeVersion: INK_ANYWHERE_PROBE_RECIPE_VERSION,
    responseMimeType: "application/json",
    responseSchema: {
      correctPlacement: "boolean",
      requestedFeaturePresent: "boolean",
      priorVisibleInkPreserved: "boolean",
      noUnexpectedInk: "boolean",
      confidence: "integer_0_100",
    },
    ...INK_TEXT_PROVIDER_CONFIG,
    prompt: `Image 1 is the original target. Image 2 is the candidate. ${
      input.evidenceReference
        ? "Image 3 is design evidence only."
        : "There is no design-reference image."
    }

The sole authorized change is one ${JSON.stringify(input.normalizedDescriptor)}
tattoo at ${inkAnatomyLabel(input.anatomy)}. The exact resolved tuple is
zone=${input.anatomy.zone}, surface=${input.anatomy.surface},
side=${input.anatomy.side}.

Set correctPlacement only when the new tattoo lies on that exact anatomical
tuple without mirroring or spill. Set requestedFeaturePresent only when the
requested design is visibly present and recognisable. Set
priorVisibleInkPreserved only when every tattoo and permanent mark visible in
Image 1 remains in Image 2 without moving, mirroring, resizing, recolouring,
erasure, occlusion, or duplication. Set noUnexpectedInk only when no other new
visible tattoo or mark appears anywhere. Return strict JSON only.`,
    images,
  };
}

export function buildInkAnywherePlacementAuditProbeRequest(input: {
  originalTarget: ComposerImage;
  placementAuditCandidate: ComposerImage;
  anatomy: InkAnatomyTuple;
  sourceAngle: CanonicalViewAngle;
}): InkProbeRequest {
  assertSupportedInkAnatomyTuple(input.anatomy);
  const sideAuthority = inkAnatomicalSideAuthority(
    input.anatomy,
    input.sourceAngle,
  );
  return {
    kind: "feature_placement",
    model: INK_ADD_PROBE_MODEL,
    recipeVersion: INK_ANYWHERE_PLACEMENT_AUDIT_RECIPE_VERSION,
    responseMimeType: "application/json",
    responseSchema: {
      anatomicalSideCorrect: "boolean",
      insideAuthorizedZone: "boolean",
      conflictingOutsideChange: "boolean",
      confidence: "integer_0_100",
    },
    ...INK_TEXT_PROVIDER_CONFIG,
    prompt: `This is a strict spatial placement audit, not an image-generation
request. Image 1 is the original target. Image 2 is the candidate with a
translucent red server-owned allowed-zone overlay and label. The overlay is
audit annotation only.

The only authorized new tattoo is at ${inkAnatomyLabel(input.anatomy)}.
The exact tuple is zone=${input.anatomy.zone},
surface=${input.anatomy.surface}, side=${input.anatomy.side}.
${sideAuthority.prompt}

Set anatomicalSideCorrect false if the tattoo is on the opposite anatomical
side, even if that opposite side matches the viewer's idea of left or right.
Set insideAuthorizedZone true only when the requested new tattoo is visibly
within the highlighted zone. Set conflictingOutsideChange true if the new
tattoo, a duplicate, or another new mark appears primarily outside that zone
or on the opposite side. When side or placement cannot be verified with high
confidence, return false for the positive field. Return strict JSON only.`,
    images: [
      inline("original_target", input.originalTarget),
      inline("candidate", input.placementAuditCandidate),
    ],
  };
}

export function buildInkFeaturePlacementProbeRequest(input: {
  originalTarget: ComposerImage;
  candidate: ComposerImage;
  evidenceReference?: ComposerImage;
  side: InkAddSide;
  normalizedDescriptor: string;
}): InkProbeRequest {
  assertInkAddSide(input.side);
  if (
    normalizeInkDescriptor(input.normalizedDescriptor)
      !== input.normalizedDescriptor
    || input.normalizedDescriptor.length < INK_ADD_MIN_DESCRIPTOR_LENGTH
    || input.normalizedDescriptor.length > INK_ADD_MAX_DESCRIPTOR_LENGTH
  ) {
    throw new TypeError("Invalid ink descriptor");
  }
  const images = [
    inline("original_target", input.originalTarget),
    inline("candidate", input.candidate),
  ];
  if (input.evidenceReference) {
    images.push(inline("evidence_reference", input.evidenceReference));
  }
  if (images.length > 3) throw new TypeError("Probe reference budget exceeded");
  return {
    kind: "feature_placement",
    model: INK_ADD_PROBE_MODEL,
    recipeVersion: INK_ADD_PROBE_RECIPE_VERSION,
    responseMimeType: "application/json",
    responseSchema: {
      correctPlacement: "boolean",
      requestedFeaturePresent: "boolean",
      noUnexpectedInk: "boolean",
      confidence: "integer_0_100",
    },
    ...INK_TEXT_PROVIDER_CONFIG,
    prompt: `Image 1 is the original target. Image 2 is the candidate. ${
      input.evidenceReference
        ? "Image 3 is design evidence only."
        : "There is no design-reference image."
    }

The sole authorized change is one ${JSON.stringify(input.normalizedDescriptor)}
tattoo on the anatomical ${input.side} front upper chest. Determine whether
the tattoo is visibly present and recognisable, lies only on that placement,
and no other new visible tattoo or mark appears anywhere. Existing marks in
Image 1 are allowed and must not be reported as new. Return strict JSON only.`,
    images,
  };
}

function outcome(value: boolean): EvidenceProbeOutcome {
  return value ? "pass" : "fail";
}

function overall(
  outcomes: readonly EvidenceProbeOutcome[],
): EvidenceProbeOutcome {
  if (outcomes.includes("unknown")) return "unknown";
  return outcomes.every((value) => value === "pass") ? "pass" : "fail";
}

export async function runInkVisibilityProbe(input: {
  target: ComposerImage;
  probe: (request: InkProbeRequest) => Promise<unknown>;
}): Promise<InkVisibilityProbe> {
  try {
    const result = parseInkVisibilityProbe(
      await input.probe(buildInkVisibilityProbeRequest(input)),
    );
    return {
      predictedVisibility: outcome(
        result.upperTorsoVisible && !result.materiallyOccluded,
      ),
      confidence: result.confidence,
    };
  } catch {
    return { predictedVisibility: "unknown", confidence: null };
  }
}

export async function runInkCandidateProbes(input: {
  identityAnchor: ComposerImage;
  originalTarget: ComposerImage;
  candidate: ComposerImage;
  evidenceReference?: ComposerImage;
  side: InkAddSide;
  normalizedDescriptor: string;
  predictedVisibility: EvidenceProbeOutcome;
  probe: (request: InkProbeRequest) => Promise<unknown>;
}): Promise<InkCandidateProbeTruth> {
  const requests = [
    buildInkIdentityPoseProbeRequest(input),
    buildInkFeaturePlacementProbeRequest(input),
  ] as const;
  const settled = await Promise.allSettled(
    requests.map((request) => input.probe(request)),
  );
  let identityOutcome: EvidenceProbeOutcome = "unknown";
  let poseFramingOutcome: EvidenceProbeOutcome = "unknown";
  let placementOutcome: EvidenceProbeOutcome = "unknown";
  let featureMatchOutcome: EvidenceProbeOutcome = "unknown";
  let unexpectedInkOutcome: EvidenceProbeOutcome = "unknown";
  try {
    if (settled[0].status !== "fulfilled") throw settled[0].reason;
    const identity = parseInkIdentityPoseProbe(settled[0].value);
    identityOutcome = outcome(identity.samePerson);
    poseFramingOutcome = outcome(identity.poseFramingPreserved);
  } catch {
    // Unknown is deliberately sticky and fail-closed.
  }
  try {
    if (settled[1].status !== "fulfilled") throw settled[1].reason;
    const feature = parseInkFeaturePlacementProbe(settled[1].value);
    placementOutcome = outcome(feature.correctPlacement);
    featureMatchOutcome = outcome(feature.requestedFeaturePresent);
    unexpectedInkOutcome = outcome(feature.noUnexpectedInk);
  } catch {
    // Unknown is deliberately sticky and fail-closed.
  }
  const checks = [
    input.predictedVisibility,
    identityOutcome,
    placementOutcome,
    featureMatchOutcome,
    poseFramingOutcome,
    unexpectedInkOutcome,
  ] as const;
  return {
    predictedVisibility: input.predictedVisibility,
    identityOutcome,
    placementOutcome,
    featureMatchOutcome,
    priorInkOutcome: "pass",
    poseFramingOutcome,
    unexpectedInkOutcome,
    overallOutcome: overall(checks),
  };
}

export async function runInkAnywhereVisibilityProbe(input: {
  target: ComposerImage;
  anatomy: InkAnatomyTuple;
  probe: (request: InkProbeRequest) => Promise<unknown>;
}): Promise<InkVisibilityProbe> {
  try {
    const result = parseInkAnywhereVisibilityProbe(
      await input.probe(buildInkAnywhereVisibilityProbeRequest(input)),
    );
    return {
      predictedVisibility: outcome(
        result.targetRegionVisible
        && result.anatomicalSideReadable
        && !result.materiallyOccluded,
      ),
      confidence: result.confidence,
    };
  } catch {
    return { predictedVisibility: "unknown", confidence: null };
  }
}

export async function runInkAnywhereCandidateProbes(input: {
  identityAnchor: ComposerImage;
  originalTarget: ComposerImage;
  candidate: ComposerImage;
  placementAuditCandidate: ComposerImage;
  evidenceReference?: ComposerImage;
  anatomy: InkAnatomyTuple;
  sourceAngle: CanonicalViewAngle;
  normalizedDescriptor: string;
  predictedVisibility: EvidenceProbeOutcome;
  probe: (request: InkProbeRequest) => Promise<unknown>;
}): Promise<InkCandidateProbeTruth> {
  const requests = [
    buildInkAnywhereIdentityPoseProbeRequest(input),
    buildInkAnywhereFeaturePlacementProbeRequest(input),
    buildInkAnywherePlacementAuditProbeRequest(input),
  ] as const;
  const settled = await Promise.allSettled(
    requests.map((request) => input.probe(request)),
  );
  let identityOutcome: EvidenceProbeOutcome = "unknown";
  let poseFramingOutcome: EvidenceProbeOutcome = "unknown";
  let semanticPlacementOutcome: EvidenceProbeOutcome = "unknown";
  let sidePlacementOutcome: EvidenceProbeOutcome = "unknown";
  let zonePlacementOutcome: EvidenceProbeOutcome = "unknown";
  let outsidePlacementOutcome: EvidenceProbeOutcome = "unknown";
  let featureMatchOutcome: EvidenceProbeOutcome = "unknown";
  let priorInkOutcome: EvidenceProbeOutcome = "unknown";
  let unexpectedInkOutcome: EvidenceProbeOutcome = "unknown";
  try {
    if (settled[0].status !== "fulfilled") throw settled[0].reason;
    const identity = parseInkIdentityPoseProbe(settled[0].value);
    identityOutcome = outcome(identity.samePerson);
    poseFramingOutcome = outcome(identity.poseFramingPreserved);
  } catch {
    // Unknown is deliberately sticky and fail-closed.
  }
  try {
    if (settled[1].status !== "fulfilled") throw settled[1].reason;
    const feature = parseInkAnywhereFeaturePlacementProbe(settled[1].value);
    semanticPlacementOutcome = outcome(feature.correctPlacement);
    featureMatchOutcome = outcome(feature.requestedFeaturePresent);
    priorInkOutcome = outcome(feature.priorVisibleInkPreserved);
    unexpectedInkOutcome = outcome(feature.noUnexpectedInk);
  } catch {
    // Unknown is deliberately sticky and fail-closed.
  }
  try {
    if (settled[2].status !== "fulfilled") throw settled[2].reason;
    const placement = parseInkAnywherePlacementAuditProbe(settled[2].value);
    sidePlacementOutcome = outcome(placement.anatomicalSideCorrect);
    zonePlacementOutcome = outcome(placement.insideAuthorizedZone);
    outsidePlacementOutcome = outcome(!placement.conflictingOutsideChange);
  } catch {
    // Unknown is deliberately sticky and fail-closed.
  }
  const placementOutcome = overall([
    semanticPlacementOutcome,
    sidePlacementOutcome,
    zonePlacementOutcome,
    outsidePlacementOutcome,
  ]);
  const checks = [
    input.predictedVisibility,
    identityOutcome,
    placementOutcome,
    featureMatchOutcome,
    priorInkOutcome,
    poseFramingOutcome,
    unexpectedInkOutcome,
  ] as const;
  return {
    predictedVisibility: input.predictedVisibility,
    identityOutcome,
    placementOutcome,
    featureMatchOutcome,
    priorInkOutcome,
    poseFramingOutcome,
    unexpectedInkOutcome,
    overallOutcome: overall(checks),
  };
}
