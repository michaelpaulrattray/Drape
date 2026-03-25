/**
 * editClassifier — Classifies refinement instructions as 'small' or 'large'.
 *
 * Small edits (localized, <30% image change) proceed with refinement.
 * Large edits (structural, >30% image change) trigger full regeneration.
 * Defaults to 'small' on failure — identity check downstream catches bad results.
 */
import { TEXT_ECONOMY } from "@shared/modelRegistry";
import { getAiClient, withTextQueue } from "./utils";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("wardrobe/editClassifier");

export type EditSize = "small" | "large";

const CLASSIFIER_PROMPT = (instruction: string) =>
  `You are classifying a clothing edit instruction for a virtual try-on system.
INSTRUCTION: "${instruction}"
Classify this as SMALL or LARGE based on how much of the image would change:
SMALL edits (localized, <30% of image changes):
- Adjusting how a garment sits (tuck in, roll sleeves, cuff hem)
- Partial changes (half unzip, unbutton top button, loosen tie)
- Texture/color tweaks (make darker, add wrinkles)
- Minor pose adjustments (relax shoulders, tilt head)
- Slight modifications (lower neckline, push sleeves up)
LARGE edits (structural, >30% of image changes):
- Fully opening or closing a garment (zip up jacket, button entire coat)
- Adding or removing entire garments (take off jacket, add scarf)
- Major state changes (fully unzip, close coat completely)
- Wrapping/draping changes that affect the whole garment silhouette
Respond with ONLY "SMALL" or "LARGE", nothing else.`;

/**
 * Classify a refinement instruction as small (localized) or large (structural).
 * Defaults to 'small' on any failure.
 */
export async function classifyEditSize(
  instruction: string,
): Promise<EditSize> {
  const ai = getAiClient();

  try {
    const response = await withTextQueue(() =>
      ai.models.generateContent({
        model: TEXT_ECONOMY,
        contents: [{ text: CLASSIFIER_PROMPT(instruction) }],
      }),
    );

    const text = (response.text ?? "").trim().toUpperCase();
    return text.includes("LARGE") ? "large" : "small";
  } catch (error) {
    log.warn({ err: error }, "[EditClassifier] Failed, defaulting to small");
    return "small";
  }
}
