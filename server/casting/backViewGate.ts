/**
 * backViewGate — the D-39 identity gate on back views (founder-ratified).
 *
 * The angles research showed person-rotation hallucinating past ~120°: a
 * back view can silently invent a different build, hair mass, or marks. The
 * old protection was a text plea in the prompt ("No new back tattoos");
 * this is the gate that replaces it: compare the generated back view
 * against the canonical face+body references on the dimensions a back view
 * can actually express — silhouette, build, hair (mass/length/color), skin
 * tone, visible marks. NOT the face (it isn't visible).
 *
 * Contract (D-39): one auto-retry on failure, then fail named-and-refunded —
 * enforced by the caller (mintPackage). Infra failures fail OPEN (house
 * style, matching wardrobe/identityCheck): a broken checker must never
 * block a paid mint.
 */
import { TEXT_ECONOMY } from "@shared/modelRegistry";
import { getAiClient, withTextQueue, toInlinePart } from "../wardrobe/utils";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("casting/backViewGate");

const BACK_VIEW_PROMPT = `You are verifying character consistency for a fashion model's reference package.
Image 1 is the person's headshot (front). Image 2 is a generated BACK view that must be the SAME person from behind.
The face is not visible from behind — judge ONLY what a back view can show:
- body silhouette and build (shoulder width, waist, overall proportions)
- hair: mass, length, texture, and color
- skin tone
- any visible tattoos or marks (the back view must not INVENT new ones)
Small pose/lighting differences are fine.
Answer strictly "YES" if this back view is plausibly the same person, or "NO" if the build, hair, skin tone, or markings clearly do not match.`;

export interface BackViewVerdict {
  ok: boolean;
  /** False when the checker itself failed (verdict defaulted open). */
  checked: boolean;
}

export async function verifyBackView(
  headshotUrl: string,
  backViewUrl: string,
): Promise<BackViewVerdict> {
  const ai = getAiClient();
  try {
    const [headshotPart, backPart] = await Promise.all([
      toInlinePart(headshotUrl),
      toInlinePart(backViewUrl),
    ]);

    const response = await withTextQueue(() =>
      ai.models.generateContent({
        model: TEXT_ECONOMY,
        contents: [{ parts: [{ text: BACK_VIEW_PROMPT }, headshotPart, backPart] }],
      }),
    );

    const text = (response.text ?? "YES").trim().toUpperCase();
    const ok = text.includes("YES");
    log.info({ ok }, "[BackViewGate] verdict");
    return { ok, checked: true };
  } catch (error) {
    log.warn({ err: error }, "[BackViewGate] checker failed — failing open");
    return { ok: true, checked: false };
  }
}
