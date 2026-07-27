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

export type InkProbeKind =
  | "visibility"
  | "identity_pose"
  | "feature_placement";

export interface InkProbeInlineImage {
  role:
    | "identity_anchor"
    | "original_target"
    | "candidate"
    | "evidence_reference";
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
    | typeof INK_ADD_VISIBILITY_RECIPE_VERSION;
  responseMimeType: "application/json";
  responseSchema: Readonly<Record<string, "boolean" | "integer_0_100">>;
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
  const settled = await Promise.allSettled(requests.map(input.probe));
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
    poseFramingOutcome,
    unexpectedInkOutcome,
    overallOutcome: overall(checks),
  };
}
