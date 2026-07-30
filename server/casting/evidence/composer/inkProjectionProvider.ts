import type { InkProjectionComposerRequest } from "../inkProjectionComposition";

const PROJECTION_PROVIDER_ROLE_LABELS = Object.freeze({
  original_target:
    "IMAGE 1 - CLEAN ORIGINAL TARGET / IMMUTABLE OUTPUT CANVAS",
  guided_target:
    "IMAGE 2 - PLACEMENT GUIDE ONLY / NEVER AN OUTPUT CANVAS",
  identity_anchor:
    "IMAGE 3 - IDENTITY CHECK ONLY / NEVER AN OUTPUT CANVAS",
  evidence_mosaic:
    "IMAGE 4 - PRIVATE TATTOO EVIDENCE ONLY / NEVER AN OUTPUT CANVAS",
} as const);

/**
 * Bind every projection image to a constant provider-visible role immediately
 * before its bytes. The request DTO's `role` field is server metadata and is
 * otherwise discarded by the Gemini SDK.
 */
export function buildInkProjectionProviderParts(
  request: InkProjectionComposerRequest,
): Array<
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
> {
  return [
    {
      text:
        "MULTI-IMAGE EDIT INPUTS. Each constant role label applies only to the image immediately following it.",
    },
    ...request.images.flatMap((image) => [
      { text: PROJECTION_PROVIDER_ROLE_LABELS[image.role] },
      { inlineData: image.inlineData },
    ]),
    { text: `EDIT INSTRUCTIONS:\n${request.prompt}` },
  ];
}
