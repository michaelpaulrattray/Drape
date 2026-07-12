/**
 * backViewGate — the per-angle identity gate on rotation/motion views
 * (D-39 back gate, generalized to the walk per D-44/D-46).
 *
 * The angles research showed person-rotation hallucinating past ~120°: a
 * back view can silently invent a different build, hair mass, or marks — and
 * a walking side view has the most drift room of all (rotation AND motion),
 * which is exactly why D-44 made its gate mandatory. The old protection was
 * a text plea in the prompt ("No new back tattoos"); this is the gate that
 * replaces it: compare the generated view against the canonical headshot on
 * the dimensions that view can actually express.
 *
 * Contract (D-39/D-46): one auto-retry on failure, then fail
 * named-and-refunded — enforced by the caller (mintPackage/refreshSlots).
 * Infra failures fail OPEN (house style, matching wardrobe/identityCheck):
 * a broken checker must never block a paid generation.
 *
 * D-46 calibration note (logged): motion poses drift more — if the walk
 * gate over-rejects, tune its prompt below before it churns refunds on
 * every Production mint. Verdicts log with their angle for exactly that.
 */
import { TEXT_ECONOMY } from "@shared/modelRegistry";
import type { CanonicalViewAngle } from "@shared/boardTypes";
import { getAiClient, withTextQueue, toInlinePart } from "../wardrobe/utils";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("casting/backViewGate");

/** The slots whose generations must pass the identity gate (D-46: back + walk). */
export const GATED_ANGLES = ["backFull", "sideFull"] as const;
export type GatedAngle = (typeof GATED_ANGLES)[number];

export function isGatedAngle(angle: CanonicalViewAngle): angle is GatedAngle {
  return (GATED_ANGLES as readonly string[]).includes(angle);
}

/** Exported for tests — one prompt per gated angle, the single tuning point. */
export const GATE_PROMPTS: Record<GatedAngle, string> = {
  backFull: `You are verifying character consistency for a fashion model's reference package.
Image 1 is the person's headshot (front). Image 2 is a generated BACK view that must be the SAME person from behind.
The face is not visible from behind — judge ONLY what a back view can show:
- body silhouette and build (shoulder width, waist, overall proportions)
- hair: mass, length, texture, and color
- skin tone
- any visible tattoos or marks (the back view must not INVENT new ones)
Small pose/lighting differences are fine.
Answer strictly "YES" if this back view is plausibly the same person, or "NO" if the build, hair, skin tone, or markings clearly do not match.`,
  sideFull: `You are verifying character consistency for a fashion model's reference package.
Image 1 is the person's headshot (front). Image 2 is a generated full-body WALKING SIDE view that must be the SAME person mid-stride.
The face is partially visible in profile — judge what a walking side view can show:
- facial profile (nose line, jawline, brow) against the headshot
- body silhouette and build (shoulder width, waist, overall proportions)
- hair: mass, length, texture, and color
- skin tone
- any visible tattoos or marks (the walk must not INVENT new ones)
The pose is a walk — motion, stride, and camera angle differences are expected and fine.
Answer strictly "YES" if this walking view is plausibly the same person, or "NO" if the profile, build, hair, skin tone, or markings clearly do not match.`,
};

export interface BackViewVerdict {
  ok: boolean;
  /** False when the checker itself failed (verdict defaulted open). */
  checked: boolean;
}

export async function verifyViewIdentity(
  headshotUrl: string,
  viewUrl: string,
  angle: GatedAngle,
): Promise<BackViewVerdict> {
  // Founder test hook: set BACK_VIEW_GATE_FORCE_FAIL=1 (a Railway service
  // var — adding it redeploys) to watch the named-and-refunded flow live,
  // then remove it. Never ships enabled. Covers every gated angle.
  if (process.env.BACK_VIEW_GATE_FORCE_FAIL === "1") {
    log.warn({ angle }, "[ViewGate] FORCE FAIL active (BACK_VIEW_GATE_FORCE_FAIL=1) — remove after testing");
    return { ok: false, checked: true };
  }
  const ai = getAiClient();
  try {
    const [headshotPart, viewPart] = await Promise.all([
      toInlinePart(headshotUrl),
      toInlinePart(viewUrl),
    ]);

    const response = await withTextQueue(() =>
      ai.models.generateContent({
        model: TEXT_ECONOMY,
        contents: [{ parts: [{ text: GATE_PROMPTS[angle] }, headshotPart, viewPart] }],
      }),
    );

    const text = (response.text ?? "YES").trim().toUpperCase();
    const ok = text.includes("YES");
    log.info({ ok, angle }, "[ViewGate] verdict");
    return { ok, checked: true };
  } catch (error) {
    log.warn({ err: error, angle }, "[ViewGate] checker failed — failing open");
    return { ok: true, checked: false };
  }
}

/** Back-compat alias (pre-D-46 callers/tests). */
export function verifyBackView(headshotUrl: string, backViewUrl: string): Promise<BackViewVerdict> {
  return verifyViewIdentity(headshotUrl, backViewUrl, "backFull");
}
