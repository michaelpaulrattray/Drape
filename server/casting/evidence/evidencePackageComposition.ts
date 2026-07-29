import sharp from "sharp";
import { supportedImageMime } from "../../security/trustedImageFetch";
import {
  INK_ADD_IMAGE_ENGINE,
  INK_ADD_MAX_DESCRIPTOR_LENGTH,
  INK_ADD_MIN_DESCRIPTOR_LENGTH,
  assertInkAddSide,
  type InkAddSide,
} from "./composer/inkAddRecipe";
import {
  FRONT_UPPER_TORSO_ZONES,
  type NormalizedInkZone,
} from "./composer/inkZoneGuide";
import { normalizeInkDescriptor } from "./composer/inkAuthorization";
import type {
  ComposerImage,
  ComposerImageMime,
} from "./composer/inkComposer";
import {
  EVIDENCE_PACKAGE_GUIDE_RECIPE_VERSION,
  type EvidenceFacingDirective,
  type EvidencePackageDirective,
} from "./evidencePackageRegistry";

export const EVIDENCE_PACKAGE_COMPOSER_RECIPE_VERSION =
  "evidence.package.sync.composer.front-upper-torso.v2" as const;
export const EVIDENCE_PACKAGE_CROP_RECIPE_VERSION =
  "evidence.package.crop.front-upper-torso.v1" as const;

const MAX_PIXELS = 40_000_000;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_REFERENCE_BYTES = 50 * 1024 * 1024;
const MAX_IDENTITY_TEXT = 50_000;
const MIN_DIMENSION = 256;
const MAX_DIMENSION = 8192;

export interface EvidencePackageDerivedImage extends ComposerImage {
  width: number;
  height: number;
}

export interface EvidenceContextCrop extends EvidencePackageDerivedImage {
  sourceZone: NormalizedInkZone;
  cropRecipeVersion: typeof EVIDENCE_PACKAGE_CROP_RECIPE_VERSION;
  provenanceKey: string;
}

export interface EvidenceGuidedTarget extends EvidencePackageDerivedImage {
  guideRecipeVersion: typeof EVIDENCE_PACKAGE_GUIDE_RECIPE_VERSION;
  normalizedTargetZone: NormalizedInkZone | null;
}

function boundedDimension(value: number | undefined): value is number {
  return value !== undefined
    && Number.isSafeInteger(value)
    && value >= MIN_DIMENSION
    && value <= MAX_DIMENSION;
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

async function normalizeImage(bytes: Uint8Array): Promise<{
  bytes: Buffer;
  width: number;
  height: number;
}> {
  const normalized = await sharp(Buffer.from(bytes), {
    failOn: "error",
    limitInputPixels: MAX_PIXELS,
  }).rotate().png().toBuffer({ resolveWithObject: true });
  const { width, height } = normalized.info;
  if (
    !boundedDimension(width)
    || !boundedDimension(height)
    || width * height > MAX_PIXELS
    || normalized.data.length > MAX_IMAGE_BYTES
  ) {
    throw new TypeError("Evidence package image is not eligible");
  }
  return { bytes: normalized.data, width, height };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function evidenceCropProvenanceKey(input: {
  ontologyVersion: string;
  zone: string;
  surface: string;
  side: InkAddSide;
  sourceViewAngle: "frontFull";
}): string {
  assertInkAddSide(input.side);
  for (const value of [
    input.ontologyVersion,
    input.zone,
    input.surface,
    input.sourceViewAngle,
  ]) {
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value)) {
      throw new TypeError("Invalid evidence crop provenance");
    }
  }
  return [
    input.ontologyVersion,
    input.zone,
    input.surface,
    input.side,
    input.sourceViewAngle,
  ].join(":");
}

export async function buildEvidenceContextCrop(input: {
  acceptedPlateBytes: Uint8Array;
  side: InkAddSide;
  ontologyVersion: string;
  zone: string;
  surface: string;
  sourceViewAngle: "frontFull";
}): Promise<EvidenceContextCrop> {
  assertInkAddSide(input.side);
  const normalized = await normalizeImage(input.acceptedPlateBytes);
  const zone = FRONT_UPPER_TORSO_ZONES[input.side];
  const marginX = 0.08;
  const marginY = 0.08;
  const left = clamp(zone.x - marginX, 0, 1);
  const top = clamp(zone.y - marginY, 0, 1);
  const right = clamp(zone.x + zone.width + marginX, 0, 1);
  const bottom = clamp(zone.y + zone.height + marginY, 0, 1);
  const pixelLeft = Math.floor(left * normalized.width);
  const pixelTop = Math.floor(top * normalized.height);
  const width = Math.max(
    1,
    Math.min(
      normalized.width - pixelLeft,
      Math.ceil((right - left) * normalized.width),
    ),
  );
  const height = Math.max(
    1,
    Math.min(
      normalized.height - pixelTop,
      Math.ceil((bottom - top) * normalized.height),
    ),
  );
  const bytes = await sharp(normalized.bytes)
    .extract({ left: pixelLeft, top: pixelTop, width, height })
    .png()
    .toBuffer();
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new TypeError("Evidence package image is not eligible");
  }
  return {
    bytes,
    mime: "image/png",
    width,
    height,
    sourceZone: zone,
    cropRecipeVersion: EVIDENCE_PACKAGE_CROP_RECIPE_VERSION,
    provenanceKey: evidenceCropProvenanceKey(input),
  };
}

export async function buildEvidenceGuidedTarget(input: {
  targetBytes: Uint8Array;
  directive: EvidencePackageDirective;
  featureSide: InkAddSide;
}): Promise<EvidenceGuidedTarget> {
  assertInkAddSide(input.featureSide);
  if (input.directive.visibility === "authoring_truth") {
    throw new TypeError("Authoring truth is never composed by package sync");
  }
  if (
    input.directive.visibility === "reproduce_visible"
    && !input.directive.normalizedTargetZone
  ) {
    throw new TypeError("Visible package evidence requires a target zone");
  }
  const normalized = await normalizeImage(input.targetBytes);
  const stroke = Math.max(2, Math.round(Math.min(normalized.width, normalized.height) * 0.004));
  const fontSize = Math.max(14, Math.round(Math.min(normalized.width, normalized.height) * 0.018));
  let overlay: string;
  if (
    input.directive.visibility === "reproduce_visible"
    && input.directive.normalizedTargetZone
  ) {
    const zone = input.directive.normalizedTargetZone;
    const x = Math.round(zone.x * normalized.width);
    const y = Math.round(zone.y * normalized.height);
    const width = Math.max(1, Math.round(zone.width * normalized.width));
    const height = Math.max(1, Math.round(zone.height * normalized.height));
    const label = escapeXml(
      `${input.featureSide.toUpperCase()} ANATOMICAL CHEST - MATCH EVIDENCE HERE`,
    );
    overlay = `<svg width="${normalized.width}" height="${normalized.height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${stroke * 2}"
        fill="rgba(190,45,45,0.13)" stroke="rgba(190,45,45,0.92)" stroke-width="${stroke}"/>
      <text x="${x}" y="${Math.max(fontSize + stroke, y - fontSize * 0.4)}"
        font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700"
        fill="rgba(125,20,20,0.96)">${label}</text>
    </svg>`;
  } else {
    const label = escapeXml("PRESERVE THIS VIEW - DO NOT INVENT A CHEST MARK");
    overlay = `<svg width="${normalized.width}" height="${normalized.height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${normalized.width}" height="${fontSize * 2.3}"
        fill="rgba(30,30,30,0.72)"/>
      <text x="${fontSize}" y="${fontSize * 1.55}" font-family="Arial, sans-serif"
        font-size="${fontSize}" font-weight="700" fill="white">${label}</text>
    </svg>`;
  }
  const bytes = await sharp(normalized.bytes)
    .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
    .png()
    .toBuffer();
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new TypeError("Evidence package image is not eligible");
  }
  return {
    bytes,
    mime: "image/png",
    width: normalized.width,
    height: normalized.height,
    guideRecipeVersion: EVIDENCE_PACKAGE_GUIDE_RECIPE_VERSION,
    normalizedTargetZone: input.directive.normalizedTargetZone,
  };
}

export interface EvidencePackageComposerInlineImage {
  role: "identity_anchor" | "guided_target" | "accepted_evidence_crop";
  inlineData: { mimeType: ComposerImageMime; data: string };
}

export interface EvidencePackageComposerRequest {
  model: typeof INK_ADD_IMAGE_ENGINE;
  recipeVersion: typeof EVIDENCE_PACKAGE_COMPOSER_RECIPE_VERSION;
  attemptNumber: 1 | 2;
  responseModalities: readonly ["IMAGE"];
  prompt: string;
  images: readonly EvidencePackageComposerInlineImage[];
}

function inline(
  role: EvidencePackageComposerInlineImage["role"],
  image: ComposerImage,
): EvidencePackageComposerInlineImage {
  const bytes = Buffer.from(image.bytes);
  if (
    bytes.length === 0
    || bytes.length > MAX_IMAGE_BYTES
    || supportedImageMime(bytes) !== image.mime
  ) {
    throw new TypeError("Invalid evidence package reference");
  }
  return {
    role,
    inlineData: { mimeType: image.mime, data: bytes.toString("base64") },
  };
}

function facingInstruction(
  directive: EvidenceFacingDirective | null,
): string {
  switch (directive) {
    case "camera_sees_anatomical_left_walk_frame_left":
      return "Show a strict walking side profile travelling toward FRAME LEFT (nose and toes toward the left edge). This exposes the subject's anatomical LEFT side to the camera.";
    case "camera_sees_anatomical_right_walk_frame_right":
      return "Show a strict walking side profile travelling toward FRAME RIGHT (nose and toes toward the right edge). This exposes the subject's anatomical RIGHT side to the camera.";
    case "strict_profile_direction_flexible":
      return "Use a strict walking side profile. Preserve the target's travel direction because either direction is acceptable.";
    case null:
      return "Preserve the target's canonical framing and direction.";
  }
}

export function buildEvidencePackageComposerRequest(input: {
  identityText: string;
  normalizedDescriptor: string;
  featureSide: InkAddSide;
  directive: EvidencePackageDirective;
  attemptNumber: 1 | 2;
  identityAnchor: ComposerImage;
  guidedTarget: ComposerImage;
  acceptedEvidenceCrop: ComposerImage;
  retryDirectives?: readonly (
    | "identity"
    | "framing"
    | "visible_side"
    | "placement"
    | "feature_match"
    | "unexpected_feature"
  )[];
}): EvidencePackageComposerRequest {
  assertInkAddSide(input.featureSide);
  if (input.directive.visibility === "authoring_truth") {
    throw new TypeError("Authoring truth is never composed by package sync");
  }
  if (
    input.directive.visibility === "reproduce_visible"
    && !input.directive.normalizedTargetZone
  ) {
    throw new TypeError("Visible package evidence requires a target zone");
  }
  const identityText = input.identityText.trim();
  if (
    !identityText
    || identityText.length > MAX_IDENTITY_TEXT
    || normalizeInkDescriptor(input.normalizedDescriptor)
      !== input.normalizedDescriptor
    || input.normalizedDescriptor.length < INK_ADD_MIN_DESCRIPTOR_LENGTH
    || input.normalizedDescriptor.length > INK_ADD_MAX_DESCRIPTOR_LENGTH
    || (input.attemptNumber !== 1 && input.attemptNumber !== 2)
    || (input.attemptNumber === 1 && (input.retryDirectives?.length ?? 0) > 0)
  ) {
    throw new TypeError("Incomplete evidence package authority");
  }
  const images = [
    inline("identity_anchor", input.identityAnchor),
    inline("guided_target", input.guidedTarget),
    inline("accepted_evidence_crop", input.acceptedEvidenceCrop),
  ] as const;
  if (
    images.reduce(
      (sum, image) => sum + Buffer.byteLength(image.inlineData.data, "base64"),
      0,
    ) > MAX_TOTAL_REFERENCE_BYTES
  ) {
    throw new TypeError("Evidence package reference budget exceeded");
  }
  const reproduce = input.directive.visibility === "reproduce_visible";
  const anatomy = input.directive.requiredVisibleAnatomicalSide
    ? `The camera must visibly show the subject's anatomical ${input.directive.requiredVisibleAnatomicalSide} side.`
    : "Use a strict profile; do not claim that the centre chest is visible.";
  const featureLaw = reproduce
    ? `Reproduce exactly the accepted ${JSON.stringify(input.normalizedDescriptor)}
from Image 3 on the guided anatomical ${input.featureSide} upper chest.`
    : "The accepted centre-chest feature is hidden in this framing and must be absent. Do not invent, move, mirror, or partially show it.";
  const retry = input.attemptNumber === 2
    ? Array.from(new Set(input.retryDirectives ?? []))
    : [];
  return {
    model: INK_ADD_IMAGE_ENGINE,
    recipeVersion: EVIDENCE_PACKAGE_COMPOSER_RECIPE_VERSION,
    attemptNumber: input.attemptNumber,
    responseModalities: ["IMAGE"],
    prompt: `Create one complete flattened fashion casting image.

Image 1 is immutable identity. Image 2 is the guided target and owns crop,
clothing, lighting, background, and the character of the walking pose. Preserve
its framing except when the facing instruction below requires the Walk to
travel in the opposite direction; that direction override is authoritative.
Image 3 is accepted feature evidence only; never copy its person, pose,
clothing, or background.

${anatomy}
${featureLaw}
Facing instruction: ${facingInstruction(input.directive.facingDirective)}
The visual guide is instruction-only and must not appear in the output.
Preserve identity and every unauthorized pixel-level attribute. Add no other
tattoo, scar, mark, text, jewellery, object, or body change. Output one final
photorealistic image only.
${retry.length ? `Retry corrections: ${retry.join(", ")}.` : ""}`,
    images,
  };
}
