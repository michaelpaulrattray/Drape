import sharp from "sharp";
import type { CanonicalViewAngle } from "../../../shared/boardTypes";
import { supportedImageMime } from "../../security/trustedImageFetch";
import {
  INK_ADD_IMAGE_ENGINE,
  INK_ADD_PROBE_MODEL,
} from "./composer/inkAddRecipe";
import type {
  ComposerImage,
  ComposerImageMime,
  InkRetryDirective,
} from "./composer/inkComposer";
import type {
  InkCandidateProbeTruth,
  InkPlacementAuditTruth,
  InkProbeRequest,
} from "./composer/inkProbe";
import type { InkProbeInlineImage } from "./composer/inkProbe";
import { INK_TEXT_PROVIDER_CONFIG } from "./composer/inkProviderTelemetry";
import type { NormalizedInkZone } from "./composer/inkZoneGuide";
import {
  INK_ANYWHERE_EVIDENCE_MOSAIC_RECIPE_VERSION,
  INK_ANYWHERE_COVERAGE_PROBE_RECIPE_VERSION,
  INK_ANYWHERE_PROJECTION_PLACEMENT_AUDIT_RECIPE_VERSION,
  INK_ANYWHERE_PROJECTION_PROBE_RECIPE_VERSION,
  INK_ANYWHERE_PROJECTION_RECIPE_VERSION,
  INK_ANYWHERE_PROJECTION_TARGET_GUIDE_AUDIT_RECIPE_VERSION,
} from "./inkAnatomyRegistry";

const MAX_FEATURES = 9;
const MAX_COVERAGE_SEGMENTS = 4;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const MOSAIC_SIZE = 1024;

export interface InkProjectionFeatureReference {
  featureId: string;
  featureVersionId: string;
  normalizedDescriptor: string;
  anatomyLabel: string;
  sideAuthority: string;
  targetGuideLabel: string;
  witnessSideAuthority: string;
  witnessGuideLabel: string;
  targetZone: NormalizedInkZone;
  targetZones: readonly NormalizedInkZone[];
  witnessZone: NormalizedInkZone;
  witness: ComposerImage;
  isProjectionTarget: boolean;
}

export interface InkEvidenceMosaic extends ComposerImage {
  width: typeof MOSAIC_SIZE;
  height: typeof MOSAIC_SIZE;
  recipeVersion: typeof INK_ANYWHERE_EVIDENCE_MOSAIC_RECIPE_VERSION;
  featureCount: number;
}

function assertZone(zone: NormalizedInkZone): void {
  if (
    [zone.x, zone.y, zone.width, zone.height].some(
      (value) => !Number.isFinite(value),
    )
    || zone.x < 0
    || zone.y < 0
    || zone.width <= 0
    || zone.height <= 0
    || zone.x + zone.width > 1
    || zone.y + zone.height > 1
  ) {
    throw new TypeError("Invalid projection evidence zone");
  }
}

function assertFeatures(
  features: readonly InkProjectionFeatureReference[],
  requireProjectionTarget = true,
): void {
  if (
    features.length < 1
    || features.length > MAX_FEATURES
    || new Set(features.map((feature) => feature.featureId)).size
      !== features.length
    || new Set(features.map((feature) => feature.featureVersionId)).size
      !== features.length
    || (
      requireProjectionTarget
      && !features.some((feature) => feature.isProjectionTarget)
    )
  ) {
    throw new TypeError("Projection evidence set is not eligible");
  }
  for (const feature of features) {
    assertZone(feature.targetZone);
    if (
      feature.targetZones.length < 1
      || feature.targetZones.length > MAX_COVERAGE_SEGMENTS
    ) {
      throw new TypeError("Projection evidence set is not eligible");
    }
    feature.targetZones.forEach(assertZone);
    assertZone(feature.witnessZone);
    const descriptor = feature.normalizedDescriptor.normalize("NFKC").trim();
    const label = feature.anatomyLabel.normalize("NFKC").trim();
    const sideAuthority = feature.sideAuthority.normalize("NFKC").trim();
    const targetGuideLabel =
      feature.targetGuideLabel.normalize("NFKC").trim();
    const witnessSideAuthority =
      feature.witnessSideAuthority.normalize("NFKC").trim();
    const witnessGuideLabel =
      feature.witnessGuideLabel.normalize("NFKC").trim();
    if (
      !feature.featureId
      || !feature.featureVersionId
      || descriptor.length < 3
      || descriptor.length > 512
      || label.length < 2
      || label.length > 100
      || sideAuthority.length < 10
      || sideAuthority.length > 500
      || targetGuideLabel.length < 5
      || targetGuideLabel.length > 120
      || witnessSideAuthority.length < 10
      || witnessSideAuthority.length > 500
      || witnessGuideLabel.length < 5
      || witnessGuideLabel.length > 120
    ) {
      throw new TypeError("Projection evidence set is not eligible");
    }
  }
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]!);
}

async function normalizedPng(image: ComposerImage): Promise<{
  bytes: Buffer;
  width: number;
  height: number;
}> {
  const input = Buffer.from(image.bytes);
  if (
    input.length === 0
    || input.length > MAX_IMAGE_BYTES
    || supportedImageMime(input) !== image.mime
  ) {
    throw new TypeError("Invalid projection evidence image");
  }
  const normalized = await sharp(input, {
    failOn: "error",
    limitInputPixels: MAX_PIXELS,
  }).rotate().png().toBuffer({ resolveWithObject: true });
  if (
    !normalized.info.width
    || !normalized.info.height
    || normalized.info.width * normalized.info.height > MAX_PIXELS
  ) {
    throw new TypeError("Invalid projection evidence image");
  }
  return {
    bytes: normalized.data,
    width: normalized.info.width,
    height: normalized.info.height,
  };
}

export async function buildInkEvidenceMosaic(
  features: readonly InkProjectionFeatureReference[],
  options: { requireProjectionTarget?: boolean } = {},
): Promise<InkEvidenceMosaic> {
  assertFeatures(features, options.requireProjectionTarget ?? true);
  const columns = Math.ceil(Math.sqrt(features.length));
  const rows = Math.ceil(features.length / columns);
  const cellWidth = Math.floor(MOSAIC_SIZE / columns);
  const cellHeight = Math.floor(MOSAIC_SIZE / rows);
  if (Math.min(cellWidth, cellHeight) < 256) {
    throw new TypeError("Projection evidence set cannot remain legible");
  }
  const composites: sharp.OverlayOptions[] = [];
  for (let index = 0; index < features.length; index += 1) {
    const feature = features[index];
    const normalized = await normalizedPng(feature.witness);
    const margin = 0.08;
    const left = Math.max(0, feature.witnessZone.x - margin);
    const top = Math.max(0, feature.witnessZone.y - margin);
    const right = Math.min(
      1,
      feature.witnessZone.x + feature.witnessZone.width + margin,
    );
    const bottom = Math.min(
      1,
      feature.witnessZone.y + feature.witnessZone.height + margin,
    );
    const pixelLeft = Math.floor(left * normalized.width);
    const pixelTop = Math.floor(top * normalized.height);
    const cropWidth = Math.max(
      1,
      Math.min(
        normalized.width - pixelLeft,
        Math.ceil((right - left) * normalized.width),
      ),
    );
    const cropHeight = Math.max(
      1,
      Math.min(
        normalized.height - pixelTop,
        Math.ceil((bottom - top) * normalized.height),
      ),
    );
    const labelHeight = 64;
    const imageHeight = cellHeight - labelHeight;
    const crop = await sharp(normalized.bytes)
      .extract({
        left: pixelLeft,
        top: pixelTop,
        width: cropWidth,
        height: cropHeight,
      })
      .resize(cellWidth, imageHeight, {
        fit: "contain",
        background: { r: 245, g: 245, b: 245, alpha: 1 },
      })
      .png()
      .toBuffer();
    const label = escapeXml(
      `F${index + 1} ${feature.isProjectionTarget ? "EXTEND" : "MATCH"} - ${feature.anatomyLabel}`,
    );
    const witnessLabel = escapeXml(
      `WITNESS: ${feature.witnessGuideLabel}`,
    );
    const footer = Buffer.from(
      `<svg width="${cellWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${cellWidth}" height="${labelHeight}" fill="#111"/>
        <text x="12" y="24" font-family="Arial, sans-serif" font-size="15"
          font-weight="700" fill="#fff">${label}</text>
        <text x="12" y="49" font-family="Arial, sans-serif" font-size="13"
          font-weight="600" fill="#ddd">${witnessLabel}</text>
      </svg>`,
    );
    const x = (index % columns) * cellWidth;
    const y = Math.floor(index / columns) * cellHeight;
    composites.push({ input: crop, left: x, top: y });
    composites.push({ input: footer, left: x, top: y + imageHeight });
  }
  const bytes = await sharp({
    create: {
      width: MOSAIC_SIZE,
      height: MOSAIC_SIZE,
      channels: 4,
      background: { r: 235, g: 235, b: 235, alpha: 1 },
    },
  }).composite(composites).png().toBuffer();
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new TypeError("Projection evidence mosaic is too large");
  }
  return {
    bytes,
    mime: "image/png",
    width: MOSAIC_SIZE,
    height: MOSAIC_SIZE,
    recipeVersion: INK_ANYWHERE_EVIDENCE_MOSAIC_RECIPE_VERSION,
    featureCount: features.length,
  };
}

export interface InkProjectionComposerInlineImage {
  role:
    | "original_target"
    | "guided_target"
    | "identity_anchor"
    | "evidence_mosaic";
  inlineData: { mimeType: ComposerImageMime; data: string };
}

export interface InkProjectionComposerRequest {
  model: typeof INK_ADD_IMAGE_ENGINE;
  recipeVersion: typeof INK_ANYWHERE_PROJECTION_RECIPE_VERSION;
  attemptNumber: 1 | 2;
  responseModalities: readonly ["IMAGE"];
  prompt: string;
  images: readonly InkProjectionComposerInlineImage[];
}

function inline(
  role: InkProjectionComposerInlineImage["role"],
  image: ComposerImage,
): InkProjectionComposerInlineImage {
  const bytes = Buffer.from(image.bytes);
  if (
    bytes.length === 0
    || bytes.length > MAX_IMAGE_BYTES
    || supportedImageMime(bytes) !== image.mime
  ) {
    throw new TypeError("Invalid projection composer image");
  }
  return {
    role,
    inlineData: {
      mimeType: image.mime,
      data: bytes.toString("base64"),
    },
  };
}

function probeInline(
  role: InkProbeInlineImage["role"],
  image: ComposerImage,
): InkProbeInlineImage {
  const bytes = Buffer.from(image.bytes);
  if (
    bytes.length === 0
    || bytes.length > MAX_IMAGE_BYTES
    || supportedImageMime(bytes) !== image.mime
  ) {
    throw new TypeError("Invalid projection probe image");
  }
  return {
    role,
    inlineData: {
      mimeType: image.mime,
      data: bytes.toString("base64"),
    },
  };
}

function retryText(
  directives: readonly InkRetryDirective[] | undefined,
): string {
  if (!directives?.length) return "";
  const unique = Array.from(new Set(directives));
  const corrections = unique.map((directive) => {
    switch (directive) {
      case "placement":
        return "The prior attempt failed anatomical-side or authorized-zone placement. Re-map every F-feature from its WITNESS authority to its TARGET authority; never retain frame coordinates by mirroring and never move ink to a more visible opposite limb.";
      case "feature":
        return "The prior attempt failed exact feature continuity. Preserve the witnessed design, orientation, scale, colour, and motif identity on the newly exposed physical surface.";
      case "prior_ink":
        return "The prior attempt dropped or moved accepted ink. Preserve every listed F-feature at its own target anatomy.";
      case "unexpected_ink":
        return "The prior attempt added unlisted ink. Remove every tattoo pixel that is not an authorized F-feature.";
      case "identity":
        return "The prior attempt changed identity. Restore the exact person and immutable non-tattoo pixels from images 1 and 3.";
      case "pose_framing":
        return "The prior attempt changed the canonical camera, crop, pose, lighting, or background. Restore image 1 outside authorized tattoo pixels.";
    }
  });
  return `\nINCLUDED RETRY CORRECTIONS:\n${corrections.map((line) => `- ${line}`).join("\n")}`;
}

export function buildInkProjectionComposerRequest(input: {
  purpose?: "projection" | "refresh";
  identityText: string;
  sourceAngle: CanonicalViewAngle;
  targetAngle: CanonicalViewAngle;
  features: readonly InkProjectionFeatureReference[];
  attemptNumber: 1 | 2;
  originalTarget: ComposerImage;
  identityAnchor: ComposerImage;
  guidedTarget: ComposerImage;
  evidenceMosaic: ComposerImage;
  retryDirectives?: readonly InkRetryDirective[];
}): InkProjectionComposerRequest {
  assertFeatures(input.features, input.purpose !== "refresh");
  const identityText = input.identityText.normalize("NFKC").trim();
  if (!identityText || identityText.length > 50_000) {
    throw new TypeError("Invalid projection identity authority");
  }
  if (input.sourceAngle !== input.targetAngle) {
    throw new TypeError(
      "Projection composition requires an exact target-angle canvas",
    );
  }
  const featureLines = input.features.map((feature, index) =>
    `F${index + 1} (${feature.isProjectionTarget ? "newly exposed continuation" : "already evidenced"}): ${feature.anatomyLabel}; ${feature.normalizedDescriptor}. TARGET: ${feature.sideAuthority} WITNESS: ${feature.witnessSideAuthority}`
  ).join("\n");
  const prompt = [
    "Create one complete flattened fashion casting image by editing the exact saved target canvas supplied below.",
    "ROLE OF IMAGE 1 - CLEAN ORIGINAL TARGET AND IMMUTABLE OUTPUT CANVAS:",
    `It is already the canonical ${input.targetAngle} view. Use this exact image as the output canvas. Preserve its person, camera, crop, pose, framing, clothing, lighting, background, current pixels, and existing permanent marks. Never reconstruct it from another image.`,
    "ROLE OF IMAGE 2 - PLACEMENT GUIDE ONLY:",
    "It is Image 1 with translucent red pose-projected pixels at the only authorized tattoo locations. Blue F-label text is metadata and never authorizes ink. Never reproduce either overlay and never use this annotated image as the output canvas.",
    "ROLE OF IMAGE 3 - IDENTITY CHECK ONLY:",
    "It confirms the same immutable person. It is not an output canvas and does not authorize a camera, pose, crop, clothing, lighting, background, or mark change.",
    "ROLE OF IMAGE 4 - PRIVATE TATTOO EVIDENCE ONLY:",
    "Each F-number is an immutable tattoo design witness. The mosaic is not an output canvas and its crop, scale, background, labels, person pixels, or layout must never appear in the output.",
    "AUTHORIZED CHANGE:",
    "Inside Image 2's red-authorized pixels only, reproduce each listed tattoo feature on Image 1. Outside those pixels, Image 1 is immutable.",
    "Anatomical laterality is semantic, not a matching frame coordinate. Map each tattoo from its WITNESS camera authority to its TARGET camera authority. A tattoo seen on frame-left in its witness may belong elsewhere in the target camera; never mirror or copy by viewer side.",
    "For MATCH features, reproduce only the visible portion exactly. For EXTEND features, continue the same physical tattoo coherently onto the newly exposed surface; do not redesign, mirror, recolour, duplicate, resize, or invent motifs.",
    "If an authorized body part is partly occluded, reproduce ink only on its visible red-authorized pixels. Never bridge gaps, fill background, or relocate a tattoo to the opposite or more visible limb to make it easier to see.",
    "Do not add any unlisted ink. Do not remove or move any listed ink. Do not alter face, hair, skin, body proportions, expression, clothing, accessories, camera, crop, pose, lighting, or background.",
    `Identity authority:\n${identityText}`,
    `Feature authority:\n${featureLines}`,
    `Return exactly one portrait ${input.targetAngle} image and no text.`,
  ].join("\n") + retryText(input.retryDirectives);
  return {
    model: INK_ADD_IMAGE_ENGINE,
    recipeVersion: INK_ANYWHERE_PROJECTION_RECIPE_VERSION,
    attemptNumber: input.attemptNumber,
    responseModalities: ["IMAGE"],
    prompt,
    images: [
      inline("original_target", input.originalTarget),
      inline("guided_target", input.guidedTarget),
      inline("identity_anchor", input.identityAnchor),
      inline("evidence_mosaic", input.evidenceMosaic),
    ],
  };
}

interface ProjectionProbeResponse {
  confidence: number;
  identityMatch: boolean;
  cameraAndFramingMatch: boolean;
  noUnexpectedInk: boolean;
  featurePresence: boolean[];
  featureMatch: boolean[];
}

interface ProjectionPlacementAuditResponse {
  confidence: number;
  anatomicalSideCorrect: boolean[];
  insideAuthorizedZone: boolean[];
}

export function buildInkProjectionProbeRequest(input: {
  purpose?: "projection" | "refresh";
  sourceAngle: CanonicalViewAngle;
  targetAngle: CanonicalViewAngle;
  features: readonly InkProjectionFeatureReference[];
  identityAnchor: ComposerImage;
  originalTarget: ComposerImage;
  evidenceMosaic: ComposerImage;
  candidate: ComposerImage;
}): InkProbeRequest {
  assertFeatures(input.features, input.purpose !== "refresh");
  const featureSchema = Object.fromEntries(input.features.flatMap(
    (_feature, index) => [
      [`feature${index + 1}Present`, "boolean" as const],
      [`feature${index + 1}MatchesEvidence`, "boolean" as const],
    ],
  ));
  const featureLines = input.features.map((feature, index) =>
    `F${index + 1}: ${feature.anatomyLabel}; ${feature.isProjectionTarget ? "coherent continuation on newly exposed surface" : "exact visible match"}; ${feature.normalizedDescriptor}. TARGET: ${feature.sideAuthority} WITNESS: ${feature.witnessSideAuthority}`
  ).join("\n");
  return {
    kind: "feature_projection",
    model: INK_ADD_PROBE_MODEL,
    recipeVersion: INK_ANYWHERE_PROJECTION_PROBE_RECIPE_VERSION,
    responseMimeType: "application/json",
    responseSchema: {
      confidence: "integer_0_100",
      identityMatch: "boolean",
      cameraAndFramingMatch: "boolean",
      noUnexpectedInk: "boolean",
      ...featureSchema,
    },
    thinkingBudget: INK_TEXT_PROVIDER_CONFIG.thinkingBudget,
    includeThoughts: INK_TEXT_PROVIDER_CONFIG.includeThoughts,
    maxOutputTokens: INK_TEXT_PROVIDER_CONFIG.maxOutputTokens,
    prompt: [
      "Compare four ordered images: identity anchor, original target/source, evidence mosaic, candidate.",
      `The candidate must depict canonical ${input.targetAngle}. The source image is ${input.sourceAngle}.`,
      "Return strict JSON only. confidence is 0-100.",
      "identityMatch is true only if face, hair, skin, body, clothing and accessories remain the same person.",
      "cameraAndFramingMatch is true only if the requested canonical angle, crop, pose family, lighting and background are correct; when source and target angles match, continuity must be pixel-conservative outside tattoo regions.",
      "noUnexpectedInk is true only if the candidate contains no tattoo beyond the listed F-features.",
      "For every feature, Present is true only if its predicted-visible portion appears at the exact anatomical location; MatchesEvidence is true only if design, scale, colour, orientation and continuity match its F-labelled evidence.",
      featureLines,
    ].join("\n"),
    images: [
      probeInline("identity_anchor", input.identityAnchor),
      probeInline("original_target", input.originalTarget),
      probeInline("evidence_mosaic", input.evidenceMosaic),
      probeInline("candidate", input.candidate),
    ],
  };
}

export function buildInkProjectionPlacementAuditProbeRequest(input: {
  targetAngle: CanonicalViewAngle;
  features: readonly InkProjectionFeatureReference[];
  candidate: ComposerImage;
  placementAuditCandidate: ComposerImage;
}): InkProbeRequest {
  assertFeatures(input.features, false);
  const featureSchema = Object.fromEntries(input.features.flatMap(
    (_feature, index) => [
      [`feature${index + 1}AnatomicalSideCorrect`, "boolean" as const],
      [`feature${index + 1}InsideAuthorizedZone`, "boolean" as const],
    ],
  ));
  const featureLines = input.features.map((feature, index) =>
    `F${index + 1}: ${feature.anatomyLabel}. TARGET: ${feature.sideAuthority}`
  ).join("\n");
  return {
    kind: "feature_projection_placement",
    model: INK_ADD_PROBE_MODEL,
    recipeVersion:
      INK_ANYWHERE_PROJECTION_PLACEMENT_AUDIT_RECIPE_VERSION,
    responseMimeType: "application/json",
    responseSchema: {
      confidence: "integer_0_100",
      ...featureSchema,
    },
    thinkingBudget: INK_TEXT_PROVIDER_CONFIG.thinkingBudget,
    includeThoughts: INK_TEXT_PROVIDER_CONFIG.includeThoughts,
    maxOutputTokens: INK_TEXT_PROVIDER_CONFIG.maxOutputTokens,
    prompt: [
      "Compare two ordered images: a clean tattoo candidate, then the same candidate with server-owned red pose-projected tattoo pixels and blue feature labels.",
      `Judge placement in canonical ${input.targetAngle}. Each feature's translucent red pixel mask is its only authorized region. Blue labels are metadata and never authorize tattoo pixels.`,
      "Return strict JSON only. confidence is 0-100.",
      "For every F-feature, AnatomicalSideCorrect is true only when the tattoo is on the subject's requested anatomical side, never merely the similarly named viewer side.",
      "For every F-feature, InsideAuthorizedZone is true only when its visible tattoo pixels stay inside that feature's red pixel mask and do not bridge excluded gaps, enter the opposite side, or enter another feature's region.",
      "For three-quarter or profile images, infer anatomical side from the candidate pixels, never the stored angle name: nose/toes toward frame-right expose anatomical RIGHT; nose/toes toward frame-left expose anatomical LEFT. If pixels do not prove the mapping, return false rather than guessing.",
      "Use the clean first image to judge tattoo pixels. Use the annotated second image only to judge the server-owned locations.",
      featureLines,
    ].join("\n"),
    images: [
      probeInline("candidate", input.candidate),
      probeInline("placement_audit_candidate", input.placementAuditCandidate),
    ],
  };
}

export function parseInkProjectionPlacementAuditResponse(
  raw: unknown,
  featureCount: number,
): ProjectionPlacementAuditResponse {
  if (
    !Number.isSafeInteger(featureCount)
    || featureCount < 1
    || featureCount > MAX_FEATURES
  ) {
    throw new TypeError("Invalid projection placement feature count");
  }
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TypeError("Invalid projection placement response");
  }
  const value = parsed as Record<string, unknown>;
  const expectedKeys = new Set([
    "confidence",
    ...Array.from({ length: featureCount }, (_unused, index) => [
      `feature${index + 1}AnatomicalSideCorrect`,
      `feature${index + 1}InsideAuthorizedZone`,
    ]).flat(),
  ]);
  if (
    Object.keys(value).length !== expectedKeys.size
    || Object.keys(value).some((key) => !expectedKeys.has(key))
    || !Number.isSafeInteger(value.confidence)
    || (value.confidence as number) < 0
    || (value.confidence as number) > 100
  ) {
    throw new TypeError("Invalid projection placement response");
  }
  for (const key of Array.from(expectedKeys)) {
    if (key !== "confidence" && typeof value[key] !== "boolean") {
      throw new TypeError("Invalid projection placement response");
    }
  }
  return {
    confidence: value.confidence as number,
    anatomicalSideCorrect: Array.from(
      { length: featureCount },
      (_unused, index) =>
        value[`feature${index + 1}AnatomicalSideCorrect`] as boolean,
    ),
    insideAuthorizedZone: Array.from(
      { length: featureCount },
      (_unused, index) =>
        value[`feature${index + 1}InsideAuthorizedZone`] as boolean,
    ),
  };
}

export function applyInkProjectionPlacementAudit(
  probe: InkCandidateProbeTruth,
  audit: ProjectionPlacementAuditResponse,
): InkCandidateProbeTruth {
  const confident = audit.confidence >= 85;
  const anatomicalSideCorrect =
    confident && audit.anatomicalSideCorrect.every(Boolean);
  const insideAuthorizedZone =
    confident && audit.insideAuthorizedZone.every(Boolean);
  const placementOutcome =
    probe.placementOutcome === "pass"
    && anatomicalSideCorrect
    && insideAuthorizedZone
      ? "pass" as const
      : "fail" as const;
  const priorInkOutcome =
    probe.priorInkOutcome === "pass"
    && anatomicalSideCorrect
    && insideAuthorizedZone
      ? "pass" as const
      : "fail" as const;
  const placementAudit: InkPlacementAuditTruth = {
    anatomicalSideCorrect,
    insideAuthorizedZone,
    conflictingOutsideChange: probe.unexpectedInkOutcome !== "pass",
    confidence: audit.confidence,
  };
  const result: InkCandidateProbeTruth = {
    ...probe,
    placementOutcome,
    priorInkOutcome,
    placementDetail: {
      semanticPlacement: probe.placementOutcome,
      anatomicalSide: anatomicalSideCorrect ? "pass" : "fail",
      authorizedZone: insideAuthorizedZone ? "pass" : "fail",
      noOutsideChange: probe.unexpectedInkOutcome,
    },
    placementAudit,
    overallOutcome: "fail",
  };
  return {
    ...result,
    overallOutcome: [
      result.identityOutcome,
      result.placementOutcome,
      result.featureMatchOutcome,
      result.priorInkOutcome,
      result.poseFramingOutcome,
      result.unexpectedInkOutcome,
    ].every((value) => value === "pass") ? "pass" : "fail",
  };
}

export async function runInkProjectionCandidateProbes(input: {
  purpose?: "projection" | "refresh";
  sourceAngle: CanonicalViewAngle;
  targetAngle: CanonicalViewAngle;
  features: readonly InkProjectionFeatureReference[];
  identityAnchor: ComposerImage;
  originalTarget: ComposerImage;
  evidenceMosaic: ComposerImage;
  candidate: ComposerImage;
  placementAuditCandidate: ComposerImage;
  probe: (request: InkProbeRequest) => Promise<unknown>;
}): Promise<InkCandidateProbeTruth> {
  const [rawProjection, rawPlacement] = await Promise.all([
    input.probe(buildInkProjectionProbeRequest(input)),
    input.probe(buildInkProjectionPlacementAuditProbeRequest(input)),
  ]);
  const projection = assessInkProjectionProbe(
    parseInkProjectionProbeResponse(rawProjection, input.features.length),
  );
  const placement = parseInkProjectionPlacementAuditResponse(
    rawPlacement,
    input.features.length,
  );
  return applyInkProjectionPlacementAudit(projection, placement);
}

export function parseInkProjectionProbeResponse(
  raw: unknown,
  featureCount: number,
): ProjectionProbeResponse {
  if (!Number.isSafeInteger(featureCount) || featureCount < 1 || featureCount > MAX_FEATURES) {
    throw new TypeError("Invalid projection probe feature count");
  }
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TypeError("Invalid projection probe response");
  }
  const value = parsed as Record<string, unknown>;
  const expectedKeys = new Set([
    "confidence",
    "identityMatch",
    "cameraAndFramingMatch",
    "noUnexpectedInk",
    ...Array.from({ length: featureCount }, (_unused, index) => [
      `feature${index + 1}Present`,
      `feature${index + 1}MatchesEvidence`,
    ]).flat(),
  ]);
  if (
    Object.keys(value).length !== expectedKeys.size
    || Object.keys(value).some((key) => !expectedKeys.has(key))
    || !Number.isSafeInteger(value.confidence)
    || (value.confidence as number) < 0
    || (value.confidence as number) > 100
  ) {
    throw new TypeError("Invalid projection probe response");
  }
  for (const key of Array.from(expectedKeys)) {
    if (key !== "confidence" && typeof value[key] !== "boolean") {
      throw new TypeError("Invalid projection probe response");
    }
  }
  return {
    confidence: value.confidence as number,
    identityMatch: value.identityMatch as boolean,
    cameraAndFramingMatch: value.cameraAndFramingMatch as boolean,
    noUnexpectedInk: value.noUnexpectedInk as boolean,
    featurePresence: Array.from(
      { length: featureCount },
      (_unused, index) => value[`feature${index + 1}Present`] as boolean,
    ),
    featureMatch: Array.from(
      { length: featureCount },
      (_unused, index) =>
        value[`feature${index + 1}MatchesEvidence`] as boolean,
    ),
  };
}

export function assessInkProjectionProbe(
  response: ProjectionProbeResponse,
): InkCandidateProbeTruth {
  const confident = response.confidence >= 85;
  const allPresent = response.featurePresence.every(Boolean);
  const allMatch = response.featureMatch.every(Boolean);
  const outcome = (
    value: boolean,
  ): "pass" | "fail" => value ? "pass" : "fail";
  const identityOutcome = outcome(confident && response.identityMatch);
  const placementOutcome = outcome(confident && allPresent);
  const featureMatchOutcome = outcome(confident && allMatch);
  const priorInkOutcome = outcome(confident && allPresent && allMatch);
  const poseFramingOutcome = outcome(
    confident && response.cameraAndFramingMatch,
  );
  const unexpectedInkOutcome = outcome(
    confident && response.noUnexpectedInk,
  );
  return {
    predictedVisibility: "pass",
    identityOutcome,
    placementOutcome,
    featureMatchOutcome,
    priorInkOutcome,
    poseFramingOutcome,
    unexpectedInkOutcome,
    overallOutcome: [
      identityOutcome,
      placementOutcome,
      featureMatchOutcome,
      priorInkOutcome,
      poseFramingOutcome,
      unexpectedInkOutcome,
    ].every((value) => value === "pass") ? "pass" : "fail",
  };
}

export function buildInkCoverageProbeRequest(input: {
  targetAngle: CanonicalViewAngle;
  features: readonly Pick<
    InkProjectionFeatureReference,
    | "featureVersionId"
    | "normalizedDescriptor"
    | "anatomyLabel"
    | "sideAuthority"
    | "witness"
  >[];
  target: ComposerImage;
  coordinateGuide: ComposerImage;
}): InkProbeRequest {
  if (
    input.features.length !== 1
  ) {
    throw new TypeError("Coverage localization requires one feature");
  }
  const featureSchema = Object.fromEntries(input.features.flatMap(
    (_feature, index) => [
      [`feature${index + 1}RegionVisible`, "boolean" as const],
      [`feature${index + 1}VerdictCertain`, "boolean" as const],
    ],
  ));
  return {
    kind: "coverage",
    model: INK_ADD_PROBE_MODEL,
    recipeVersion: INK_ANYWHERE_COVERAGE_PROBE_RECIPE_VERSION,
    responseMimeType: "application/json",
    responseSchema: featureSchema,
    thinkingBudget: INK_TEXT_PROVIDER_CONFIG.thinkingBudget,
    includeThoughts: INK_TEXT_PROVIDER_CONFIG.includeThoughts,
    maxOutputTokens: INK_TEXT_PROVIDER_CONFIG.maxOutputTokens,
    prompt: [
      `Inspect exactly three ordered images: Image 1 is the clean canonical ${input.targetAngle} target. Image 2 is the same target with a deterministic server-owned red pose-projected mask and blue metadata label. Image 3 is the accepted witness for the one requested tattoo feature.`,
      "Return strict JSON only. RegionVisible is true when any material portion of the physical tattoo surface identified by the red mask and witness is actually exposed and resolved at 1K. A partial upper arm or forearm counts as visible for a full sleeve; the whole limb need not be in frame. Clothing, hair, overlap, crop, a rear/hidden surface, blur, or too-small detail may make it false. VerdictCertain is true only when visibility and anatomical side can be decided without guessing.",
      "Do not return or infer coordinates. Image 2 placement was computed deterministically and is not delegated to this probe. Judge only whether that exact red-authorized physical surface is visible in Image 1.",
      `F1: ${input.features[0].anatomyLabel}; accepted description: ${input.features[0].normalizedDescriptor}; ${input.features[0].sideAuthority}`,
    ].join("\n"),
    images: [
      probeInline("original_target", input.target),
      probeInline("coordinate_guide", input.coordinateGuide),
      ...input.features.map((feature) =>
        probeInline("evidence_reference", feature.witness)
      ),
    ],
  };
}

export interface InkObservedProjectionCoverage {
  visible: boolean;
  targetZones: readonly NormalizedInkZone[] | null;
}

export interface InkCoverageProbeTelemetry {
  responseShape: "valid_object" | "invalid";
  features: readonly {
    regionVisible: boolean | null;
    verdictCertain: boolean | null;
    targetZones: readonly NormalizedInkZone[] | null;
  }[];
}

function coverageZone(
  value: Record<string, unknown>,
  index: number,
  segmentIndex: number,
): NormalizedInkZone | null {
  const prefix = `feature${index + 1}Segment${segmentIndex + 1}`;
  const x = value[`${prefix}X`];
  const y = value[`${prefix}Y`];
  const width = value[`${prefix}Width`];
  const height = value[`${prefix}Height`];
  if (
    !Number.isSafeInteger(x)
    || !Number.isSafeInteger(y)
    || !Number.isSafeInteger(width)
    || !Number.isSafeInteger(height)
    || (x as number) < 0
    || (y as number) < 0
    || (width as number) < 1
    || (height as number) < 1
    || (x as number) + (width as number) > 100
    || (y as number) + (height as number) > 100
  ) {
    return null;
  }
  return Object.freeze({
    x: (x as number) / 100,
    y: (y as number) / 100,
    width: (width as number) / 100,
    height: (height as number) / 100,
  });
}

function coverageZones(
  value: Record<string, unknown>,
  index: number,
): readonly NormalizedInkZone[] | null {
  const count = value[`feature${index + 1}SegmentCount`];
  if (
    !Number.isSafeInteger(count)
    || (count as number) < 0
    || (count as number) > MAX_COVERAGE_SEGMENTS
  ) {
    return null;
  }
  const zones: NormalizedInkZone[] = [];
  for (
    let segmentIndex = 0;
    segmentIndex < MAX_COVERAGE_SEGMENTS;
    segmentIndex += 1
  ) {
    const prefix = `feature${index + 1}Segment${segmentIndex + 1}`;
    const coordinates = [
      value[`${prefix}X`],
      value[`${prefix}Y`],
      value[`${prefix}Width`],
      value[`${prefix}Height`],
    ];
    if (segmentIndex >= (count as number)) {
      if (coordinates.some((coordinate) => coordinate !== 0)) return null;
      continue;
    }
    const zone = coverageZone(value, index, segmentIndex);
    if (!zone) return null;
    zones.push(zone);
  }
  return Object.freeze(zones);
}

/**
 * Keep coverage diagnostics closed to the declared boolean/confidence schema.
 * Provider prose and image-derived content must never enter production logs.
 */
export function summarizeInkCoverageProbeResponse(
  raw: unknown,
  featureCount: number,
): InkCoverageProbeTelemetry {
  if (
    featureCount < 1
    || featureCount > MAX_FEATURES
    || !Number.isSafeInteger(featureCount)
  ) {
    throw new TypeError("Invalid observed-coverage feature set");
  }
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  const validObject =
    parsed !== null
    && typeof parsed === "object"
    && !Array.isArray(parsed);
  const value = validObject
    ? parsed as Record<string, unknown>
    : Object.freeze({}) as Record<string, unknown>;
  return Object.freeze({
    responseShape: validObject ? "valid_object" : "invalid",
    features: Object.freeze(Array.from({ length: featureCount }, (_, index) => {
      const visible = value[`feature${index + 1}RegionVisible`];
      const certain = value[`feature${index + 1}VerdictCertain`];
      return Object.freeze({
        regionVisible: typeof visible === "boolean" ? visible : null,
        verdictCertain: typeof certain === "boolean" ? certain : null,
        targetZones: visible === true ? coverageZones(value, index) : null,
      });
    })),
  });
}

export function parseInkCoverageProbeResponse(
  raw: unknown,
  featureVersionIds: readonly string[],
): Readonly<Record<string, InkObservedProjectionCoverage>> {
  if (
    featureVersionIds.length < 1
    || featureVersionIds.length > MAX_FEATURES
    || new Set(featureVersionIds).size !== featureVersionIds.length
  ) {
    throw new TypeError("Invalid observed-coverage feature set");
  }
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TypeError("Invalid observed-coverage response");
  }
  const value = parsed as Record<string, unknown>;
  const expectedKeys = featureVersionIds.flatMap((_id, index) => [
    `feature${index + 1}RegionVisible`,
    `feature${index + 1}VerdictCertain`,
    `feature${index + 1}SegmentCount`,
    ...Array.from({ length: MAX_COVERAGE_SEGMENTS }, (_unused, segmentIndex) => [
      `feature${index + 1}Segment${segmentIndex + 1}X`,
      `feature${index + 1}Segment${segmentIndex + 1}Y`,
      `feature${index + 1}Segment${segmentIndex + 1}Width`,
      `feature${index + 1}Segment${segmentIndex + 1}Height`,
    ]).flat(),
  ]);
  if (
    Object.keys(value).length !== expectedKeys.length
    || Object.keys(value).some((key) => !expectedKeys.includes(key))
  ) {
    throw new TypeError("Invalid observed-coverage response");
  }
  return Object.freeze(Object.fromEntries(featureVersionIds.map((id, index) => {
    const visible = value[`feature${index + 1}RegionVisible`];
    const certain = value[`feature${index + 1}VerdictCertain`];
    if (
      typeof visible !== "boolean"
      || certain !== true
    ) {
      throw new TypeError("Observed coverage is unknown");
    }
    const targetZones = coverageZones(value, index);
    if (!targetZones) {
      throw new TypeError("Invalid observed-coverage segments");
    }
    if (!visible) {
      if (targetZones.length !== 0) {
        throw new TypeError("Invalid hidden observed-coverage segments");
      }
      return [id, Object.freeze({ visible: false, targetZones: null })];
    }
    if (targetZones.length < 1) {
      throw new TypeError("Invalid visible observed-coverage segments");
    }
    return [id, Object.freeze({ visible: true, targetZones })];
  })));
}

interface ProjectionTargetGuideAuditResponse {
  confidence: number;
  guideCoversVisibleSurface: boolean[];
  guideTouchesOppositeSide: boolean[];
  guideIncludesConflictingAnatomy: boolean[];
}

export function buildInkProjectionTargetGuideAuditProbeRequest(input: {
  targetAngle: CanonicalViewAngle;
  features: readonly InkProjectionFeatureReference[];
  originalTarget: ComposerImage;
  guidedTarget: ComposerImage;
}): InkProbeRequest {
  assertFeatures(input.features, false);
  const featureSchema = Object.fromEntries(input.features.flatMap(
    (_feature, index) => [
      [`feature${index + 1}GuideCoversVisibleSurface`, "boolean" as const],
      [`feature${index + 1}GuideTouchesOppositeSide`, "boolean" as const],
      [`feature${index + 1}GuideIncludesConflictingAnatomy`, "boolean" as const],
    ],
  ));
  return {
    kind: "projection_target_guide",
    model: INK_ADD_PROBE_MODEL,
    recipeVersion:
      INK_ANYWHERE_PROJECTION_TARGET_GUIDE_AUDIT_RECIPE_VERSION,
    responseMimeType: "application/json",
    responseSchema: {
      confidence: "integer_0_100",
      ...featureSchema,
    },
    thinkingBudget: INK_TEXT_PROVIDER_CONFIG.thinkingBudget,
    includeThoughts: INK_TEXT_PROVIDER_CONFIG.includeThoughts,
    maxOutputTokens: INK_TEXT_PROVIDER_CONFIG.maxOutputTokens,
    prompt: [
      "Compare ordered images: Image 1 is the clean target Cast image, Image 2 is the same image with deterministic red pose-projected pixels and blue F-label metadata, and Images 3 onward are the accepted tattoo witnesses for F1 onward in the same order. Blue labels never authorize tattoo pixels.",
      `Audit each feature's red pixel mask in canonical ${input.targetAngle} using the actual pixels; the stored angle name is not anatomical-side proof.`,
      "Return strict JSON only. confidence is 0-100.",
      "For each feature, GuideCoversVisibleSurface is true only when its red mask covers the visible, resolved portion of the same physical tattoo sublocation shown in that feature's accepted witness. A mask around an entire broader anatomy zone fails when the witness establishes a smaller placement such as forehead, shoulder, wrist, or ankle.",
      "GuideTouchesOppositeSide is true if any red pixel reaches the opposite anatomical side or limb. GuideIncludesConflictingAnatomy is true if any red pixel materially includes clothing, another body zone, background, or a different feature's authorized surface, or if excluded gaps are treated as authorized.",
      "A partial visible upper arm or forearm is legitimate surface for a full sleeve. The mask must follow the limb rather than expanding into background, torso, or the opposite limb because another sleeve portion is cropped or occluded.",
      ...input.features.map((feature, index) =>
        `F${index + 1}: ${feature.anatomyLabel}; accepted description: ${feature.normalizedDescriptor}. ${feature.sideAuthority} Compare its red pixel mask with witness Image ${index + 3}.`
      ),
    ].join("\n"),
    images: [
      probeInline("original_target", input.originalTarget),
      probeInline("guided_target", input.guidedTarget),
      ...input.features.map((feature) =>
        probeInline("evidence_reference", feature.witness)
      ),
    ],
  };
}

export function parseInkProjectionTargetGuideAuditResponse(
  raw: unknown,
  featureCount: number,
): ProjectionTargetGuideAuditResponse {
  if (
    !Number.isSafeInteger(featureCount)
    || featureCount < 1
    || featureCount > MAX_FEATURES
  ) {
    throw new TypeError("Invalid projection target-guide feature count");
  }
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TypeError("Invalid projection target-guide response");
  }
  const value = parsed as Record<string, unknown>;
  const expectedKeys = new Set([
    "confidence",
    ...Array.from({ length: featureCount }, (_unused, index) => [
      `feature${index + 1}GuideCoversVisibleSurface`,
      `feature${index + 1}GuideTouchesOppositeSide`,
      `feature${index + 1}GuideIncludesConflictingAnatomy`,
    ]).flat(),
  ]);
  if (
    Object.keys(value).length !== expectedKeys.size
    || Object.keys(value).some((key) => !expectedKeys.has(key))
    || !Number.isSafeInteger(value.confidence)
    || (value.confidence as number) < 0
    || (value.confidence as number) > 100
  ) {
    throw new TypeError("Invalid projection target-guide response");
  }
  for (const key of Array.from(expectedKeys)) {
    if (key !== "confidence" && typeof value[key] !== "boolean") {
      throw new TypeError("Invalid projection target-guide response");
    }
  }
  return {
    confidence: value.confidence as number,
    guideCoversVisibleSurface: Array.from(
      { length: featureCount },
      (_unused, index) =>
        value[`feature${index + 1}GuideCoversVisibleSurface`] as boolean,
    ),
    guideTouchesOppositeSide: Array.from(
      { length: featureCount },
      (_unused, index) =>
        value[`feature${index + 1}GuideTouchesOppositeSide`] as boolean,
    ),
    guideIncludesConflictingAnatomy: Array.from(
      { length: featureCount },
      (_unused, index) =>
        value[`feature${index + 1}GuideIncludesConflictingAnatomy`] as boolean,
    ),
  };
}

export function projectionTargetGuideAuditPasses(
  value: ProjectionTargetGuideAuditResponse,
): boolean {
  return value.confidence >= 85
    && value.guideCoversVisibleSurface.every(Boolean)
    && value.guideTouchesOppositeSide.every((flag) => !flag)
    && value.guideIncludesConflictingAnatomy.every((flag) => !flag);
}
