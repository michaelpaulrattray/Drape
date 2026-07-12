/**
 * editClassifier — the A1 seal, stage 1 (founder-ruled at VC-R5 follow-up).
 *
 * The per-view iterate path could rewrite a MINTED model's identity (new
 * tattoos, changed build, different face) outside the D-11 ceremony — the
 * same ungated-write class D-46's rider 2 refused to let outlive its
 * milestone. This classifier tells refinement from identity change:
 *
 *  - COSMETIC (lighting, styling, pose, quality, artifacts, expression):
 *    allowed on minted models — D-43.2 ratified refinements as same-person
 *    non-events.
 *  - IDENTITY-LEVEL (permanent marks, build, facial structure, hair
 *    identity, age, gender, ethnicity/skin): refused on minted models with
 *    fork guidance. Drafts stay freely editable (D-43).
 *
 * Fail-OPEN (house style, matching backViewGate): a broken classifier must
 * never block a paid edit — the seal degrades to pre-seal behavior and logs.
 * Stage 2 (R6, with the surface restyle): designed fork-guidance UI + the
 * stale-writer for identity-classified draft edits (B-lite).
 */
import { TEXT_ECONOMY } from "@shared/modelRegistry";
import { getAiClient, withTextQueue } from "../wardrobe/utils";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("casting/editClassifier");

/** Exported for tests — the single tuning point. */
export const IDENTITY_EDIT_PROMPT = `You are guarding the identity of a cast fashion model whose identity is LOCKED.
A user typed an edit request against one generated photo of this person. Classify the request.

IDENTITY-LEVEL (answer YES) — the edit would change who this person permanently IS:
- adding/removing tattoos, scars, birthmarks, or other permanent marks
- changing body build, height, or proportions
- changing facial structure (nose, jawline, eyes, lips, face shape)
- changing hair color, hair length, or hairstyle identity
- changing apparent age, gender, ethnicity, or skin tone

COSMETIC (answer NO) — the edit only changes this one photograph:
- lighting, color grading, background, atmosphere
- clothing, styling, accessories, makeup
- pose, framing, camera angle, expression
- image quality, artifacts, sharpness, retouching

Answer strictly "YES" if the edit is identity-level, or "NO" if it is cosmetic.

EDIT REQUEST: `;

export interface EditClassification {
  identityLevel: boolean;
  /** False when the classifier itself failed (defaulted open/cosmetic). */
  checked: boolean;
}

export async function classifyEditIdentityImpact(feedback: string): Promise<EditClassification> {
  // Founder test hook (mirrors BACK_VIEW_GATE_FORCE_FAIL): classify every
  // edit as identity-level to watch the refusal live. Never ships enabled.
  if (process.env.ITERATE_CLASSIFY_FORCE_IDENTITY === "1") {
    log.warn("[EditClassifier] FORCE IDENTITY active — remove after testing");
    return { identityLevel: true, checked: true };
  }
  const ai = getAiClient();
  try {
    const response = await withTextQueue(() =>
      ai.models.generateContent({
        model: TEXT_ECONOMY,
        contents: [{ parts: [{ text: IDENTITY_EDIT_PROMPT + feedback }] }],
      }),
    );
    const text = (response.text ?? "NO").trim().toUpperCase();
    const identityLevel = text.includes("YES");
    log.info({ identityLevel }, "[EditClassifier] verdict");
    return { identityLevel, checked: true };
  } catch (error) {
    log.warn({ err: error }, "[EditClassifier] classifier failed — failing open (cosmetic)");
    return { identityLevel: false, checked: false };
  }
}

/** Pure refusal rule — exported for tests. Minted = anything past draft
 *  (D-43's structural key); drafts are freely editable, full stop. */
export function shouldRefuseIteration(
  modelStatus: string | null | undefined,
  classification: EditClassification,
): boolean {
  return modelStatus !== "draft" && classification.identityLevel;
}
