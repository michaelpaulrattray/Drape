import { supportedImageMime } from "../../../security/trustedImageFetch";
import { normalizeInkDescriptor } from "./inkAuthorization";
import {
  EVIDENCE_CANDIDATE_MAX_ATTEMPTS,
} from "../evidenceCandidateContract";
import {
  INK_ADD_COMPOSER_RECIPE_VERSION,
  INK_ADD_MAX_DESCRIPTOR_LENGTH,
  INK_ADD_MIN_DESCRIPTOR_LENGTH,
  INK_ADD_IMAGE_ENGINE,
  INK_ADD_ZONE,
  assertInkAddSide,
  type InkAddSide,
} from "./inkAddRecipe";
import {
  INK_ANYWHERE_COMPOSER_RECIPE_VERSION,
  assertSupportedInkAnatomyTuple,
  inkAnatomicalSideAuthority,
  inkAnatomyLabel,
  type InkAnatomyTuple,
} from "../inkAnatomyRegistry";
import type { CanonicalViewAngle } from "../../../../shared/boardTypes";

export type ComposerImageMime =
  | "image/jpeg"
  | "image/png"
  | "image/webp";

export interface ComposerImage {
  bytes: Uint8Array;
  mime: ComposerImageMime;
}

export interface InkComposerInlineImage {
  role: "identity_anchor" | "guided_target" | "evidence_reference";
  inlineData: {
    mimeType: ComposerImageMime;
    data: string;
  };
}

export type InkRetryDirective =
  | "identity"
  | "placement"
  | "feature"
  | "prior_ink"
  | "pose_framing"
  | "unexpected_ink";

export interface InkComposerRequest {
  model: typeof INK_ADD_IMAGE_ENGINE;
  recipeVersion: typeof INK_ADD_COMPOSER_RECIPE_VERSION;
  attemptNumber: 1 | 2;
  responseModalities: readonly ["IMAGE"];
  prompt: string;
  images: readonly InkComposerInlineImage[];
}

export interface InkAnywhereComposerRequest {
  model: typeof INK_ADD_IMAGE_ENGINE;
  recipeVersion: typeof INK_ANYWHERE_COMPOSER_RECIPE_VERSION;
  attemptNumber: 1 | 2;
  responseModalities: readonly ["IMAGE"];
  prompt: string;
  images: readonly InkComposerInlineImage[];
}

const MAX_COMPOSER_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_COMPOSER_TOTAL_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_COMPOSER_IDENTITY_TEXT_LENGTH = 50_000;
const RETRY_DIRECTIVE_VALUES: readonly InkRetryDirective[] = [
  "identity",
  "placement",
  "feature",
  "prior_ink",
  "pose_framing",
  "unexpected_ink",
];

function assertComposerImage(image: ComposerImage): void {
  const bytes = Buffer.from(image.bytes);
  if (
    bytes.length === 0
    || bytes.length > MAX_COMPOSER_IMAGE_BYTES
    || supportedImageMime(bytes) !== image.mime
  ) {
    throw new TypeError("Invalid composer image");
  }
}

function inlineImage(
  role: InkComposerInlineImage["role"],
  image: ComposerImage,
): InkComposerInlineImage {
  assertComposerImage(image);
  return {
    role,
    inlineData: {
      mimeType: image.mime,
      data: Buffer.from(image.bytes).toString("base64"),
    },
  };
}

const RETRY_DIRECTIVES: Readonly<Record<InkRetryDirective, string>> = {
  identity: "Correct identity drift: reproduce the exact same person from the identity anchor.",
  placement: "Correct placement: confine the tattoo to the highlighted server-owned anatomical region and the subject's selected side; never mirror subject-left/right into viewer-left/right.",
  feature: "Correct design fidelity: make the requested tattoo clearly visible and recognisable.",
  prior_ink: "Restore every tattoo or permanent mark already visible in the original target exactly; do not move, mirror, resize, recolour, erase, or duplicate it.",
  pose_framing: "Restore the target's exact pose, crop, camera, and framing.",
  unexpected_ink: "Remove every newly invented mark outside the highlighted region.",
};

function validatedComposerAuthority(input: {
  identityText: string;
  normalizedDescriptor: string;
  attemptNumber: 1 | 2;
  retryDirectives?: readonly InkRetryDirective[];
}): {
  identityText: string;
  descriptor: string;
  retry: InkRetryDirective[];
} {
  if (
    input.attemptNumber < 1
    || input.attemptNumber > EVIDENCE_CANDIDATE_MAX_ATTEMPTS
    || !Number.isSafeInteger(input.attemptNumber)
  ) {
    throw new TypeError("Invalid composer attempt");
  }
  const identityText = input.identityText.trim();
  const descriptor = input.normalizedDescriptor.trim();
  if (
    !identityText
    || identityText.length > MAX_COMPOSER_IDENTITY_TEXT_LENGTH
    || normalizeInkDescriptor(input.normalizedDescriptor)
      !== input.normalizedDescriptor
    || descriptor.length < INK_ADD_MIN_DESCRIPTOR_LENGTH
    || descriptor.length > INK_ADD_MAX_DESCRIPTOR_LENGTH
  ) {
    throw new TypeError("Incomplete composer authority");
  }
  if (
    (input.retryDirectives ?? []).some(
      (value) => !RETRY_DIRECTIVE_VALUES.includes(value),
    )
  ) {
    throw new TypeError("Unknown retry directive");
  }
  const retry = input.attemptNumber === 2
    ? Array.from(new Set<InkRetryDirective>(input.retryDirectives ?? []))
    : [];
  if (input.attemptNumber === 1 && (input.retryDirectives?.length ?? 0) > 0) {
    throw new TypeError("Retry directives are not valid on attempt one");
  }
  return { identityText, descriptor, retry };
}

function composerImages(input: {
  identityAnchor: ComposerImage;
  guidedTarget: ComposerImage;
  evidenceReference?: ComposerImage;
}, guidedTargetFirst = false): InkComposerInlineImage[] {
  const identityAnchor = inlineImage("identity_anchor", input.identityAnchor);
  const guidedTarget = inlineImage("guided_target", input.guidedTarget);
  const images: InkComposerInlineImage[] = guidedTargetFirst
    ? [guidedTarget, identityAnchor]
    : [identityAnchor, guidedTarget];
  if (input.evidenceReference) {
    images.push(inlineImage("evidence_reference", input.evidenceReference));
  }
  if (images.length > 3) throw new TypeError("Composer reference budget exceeded");
  const totalBytes = images.reduce(
    (sum, image) => sum + Buffer.byteLength(image.inlineData.data, "base64"),
    0,
  );
  if (totalBytes > MAX_COMPOSER_TOTAL_IMAGE_BYTES) {
    throw new TypeError("Composer byte budget exceeded");
  }
  return images;
}

export function buildInkComposerRequest(input: {
  identityText: string;
  normalizedDescriptor: string;
  side: InkAddSide;
  attemptNumber: 1 | 2;
  identityAnchor: ComposerImage;
  guidedTarget: ComposerImage;
  evidenceReference?: ComposerImage;
  retryDirectives?: readonly InkRetryDirective[];
}): InkComposerRequest {
  assertInkAddSide(input.side);
  const { identityText, descriptor, retry } =
    validatedComposerAuthority(input);
  const images = composerImages(input);

  const prompt = `Create one complete flattened fashion casting image.

ROLE OF IMAGE 1 - IDENTITY ANCHOR:
It defines the exact person. Preserve identity, face, skin tone, hair, and body.

ROLE OF IMAGE 2 - GUIDED TARGET:
It defines the exact pose, crop, framing, lighting, clothing, and current pixels.
The translucent guide is instruction-only and must not appear in the output.

${input.evidenceReference
  ? `ROLE OF IMAGE 3 - DESIGN REFERENCE:
Use it only for the requested tattoo's visual design. Do not copy its person,
body, pose, background, clothing, or any unrelated mark.`
  : "There is no design-reference image."}

AUTHORIZED CHANGE:
Add exactly one healed tattoo described as ${JSON.stringify(descriptor)} on the
${input.side} chest, inside server zone ${INK_ADD_ZONE}. Preserve realistic
skin pores, texture, lighting, and skin highlights over the ink.

IMMUTABLE IDENTITY:
${identityText}

HARD RULES:
- preserve the exact person, pose, crop, framing, clothing, and background;
- add no other tattoo, scar, mark, jewellery, text, object, or body change;
- never move or alter an existing mark;
- output only the final photorealistic image, with no guide, mask, border,
  caption, diagram, or before/after layout.
${retry.length
  ? `\nINCLUDED RETRY CORRECTIONS:\n${retry.map((key) => `- ${RETRY_DIRECTIVES[key]}`).join("\n")}`
  : ""}`;

  return {
    model: INK_ADD_IMAGE_ENGINE,
    recipeVersion: INK_ADD_COMPOSER_RECIPE_VERSION,
    attemptNumber: input.attemptNumber,
    responseModalities: ["IMAGE"],
    prompt,
    images,
  };
}

export function buildInkAnywhereComposerRequest(input: {
  identityText: string;
  normalizedDescriptor: string;
  anatomy: InkAnatomyTuple;
  sourceAngle: CanonicalViewAngle;
  attemptNumber: 1 | 2;
  identityAnchor: ComposerImage;
  guidedTarget: ComposerImage;
  evidenceReference?: ComposerImage;
  retryDirectives?: readonly InkRetryDirective[];
}): InkAnywhereComposerRequest {
  assertSupportedInkAnatomyTuple(input.anatomy);
  const { identityText, descriptor, retry } =
    validatedComposerAuthority(input);
  const images = composerImages(input, true);
  const location = inkAnatomyLabel(input.anatomy);
  const sideAuthority = inkAnatomicalSideAuthority(
    input.anatomy,
    input.sourceAngle,
  );

  const prompt = `Create one complete flattened fashion casting image.

ROLE OF IMAGE 1 - GUIDED TARGET AND EDIT CANVAS:
It defines the exact pose, crop, framing, lighting, clothing, current pixels,
and every tattoo or permanent mark already visible. The translucent guide is
the only authorized edit region and must not appear in the output.

ROLE OF IMAGE 2 - IDENTITY ANCHOR:
It defines the exact person. Preserve identity, face, skin tone, hair, and body.

${input.evidenceReference
  ? `ROLE OF IMAGE 3 - DESIGN REFERENCE:
Use it only for the requested tattoo's visual design. Do not copy its person,
body, pose, background, clothing, or any unrelated mark.`
  : "There is no design-reference image."}

AUTHORIZED CHANGE:
Add exactly one healed tattoo described as ${JSON.stringify(descriptor)} at
${location}, inside the highlighted server-owned anatomical zone. The resolved
tuple is zone=${input.anatomy.zone}, surface=${input.anatomy.surface},
side=${input.anatomy.side}. Preserve realistic skin pores, texture, lighting,
and skin highlights over the ink.
${input.anatomy.surface === "circumferential"
  ? `Author only the portion of this circumferential tattoo visible in this
${input.sourceAngle} source image. Never transfer or mirror it onto the
opposite limb or body side.`
  : ""}

ANATOMICAL LATERALITY - SERVER AUTHORITY:
${sideAuthority.prompt}
The highlighted guide is authoritative. "Left" and "right" always mean the
subject's own anatomy, never the viewer's side of the image.

IMMUTABLE IDENTITY:
${identityText}

HARD RULES:
- preserve the exact person, body, pose, crop, framing, clothing, and background;
- preserve every existing tattoo and permanent mark exactly: do not move,
  mirror, resize, recolour, erase, obscure, or duplicate any of them;
- add no other tattoo, scar, mark, jewellery, text, object, or body change;
- output only the final photorealistic image, with no guide, mask, border,
  caption, diagram, or before/after layout.
${retry.length
  ? `\nINCLUDED RETRY CORRECTIONS:\n${retry.map((key) =>
      key === "placement"
        ? `- ${RETRY_DIRECTIVES[key]} ${sideAuthority.prompt}`
        : `- ${RETRY_DIRECTIVES[key]}`
    ).join("\n")}`
  : ""}`;

  return {
    model: INK_ADD_IMAGE_ENGINE,
    recipeVersion: INK_ANYWHERE_COMPOSER_RECIPE_VERSION,
    attemptNumber: input.attemptNumber,
    responseModalities: ["IMAGE"],
    prompt,
    images,
  };
}
