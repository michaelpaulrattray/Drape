import type {
  InkProbeInlineImage,
  InkProbeRequest,
} from "./inkProbe";

const INK_PROBE_PROVIDER_ROLE_LABELS: Readonly<
  Record<InkProbeInlineImage["role"], string>
> = Object.freeze({
  identity_anchor: "IMAGE ROLE - IDENTITY ANCHOR",
  original_target: "IMAGE ROLE - IMMUTABLE ORIGINAL TARGET",
  guided_target: "IMAGE ROLE - SERVER-ANNOTATED TARGET GUIDE",
  candidate: "IMAGE ROLE - CLEAN CANDIDATE TO AUDIT",
  placement_audit_candidate:
    "IMAGE ROLE - SERVER-ANNOTATED CANDIDATE PLACEMENT AUDIT",
  coordinate_guide: "IMAGE ROLE - SERVER-OWNED COORDINATE GUIDE",
  evidence_reference: "IMAGE ROLE - ACCEPTED TATTOO EVIDENCE WITNESS",
  evidence_mosaic: "IMAGE ROLE - ACCEPTED TATTOO EVIDENCE MOSAIC",
});

/**
 * The request DTO's role is server metadata. Bind it immediately before the
 * corresponding bytes so Gemini cannot confuse the candidate, target, guide,
 * identity anchor, or evidence witness.
 */
export function buildInkProbeProviderParts(
  request: InkProbeRequest,
): Array<
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
> {
  return [
    {
      text:
        `TATTOO EVIDENCE AUDIT (${request.kind}). Each constant role label applies only to the image immediately following it.`,
    },
    ...request.images.flatMap((image) => [
      { text: INK_PROBE_PROVIDER_ROLE_LABELS[image.role] },
      { inlineData: image.inlineData },
    ]),
    { text: `AUDIT INSTRUCTIONS:\n${request.prompt}` },
  ];
}
