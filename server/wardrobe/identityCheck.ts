/**
 * identityCheck — Verifies identity consistency between model and VTO result.
 *
 * Compares the original model photo with a generated VTO result to detect
 * identity drift (different face, ethnicity, body shape). Returns true if
 * identity is preserved, false if drifted. Defaults to true on failure
 * to avoid blocking the user.
 */
import { TEXT_ECONOMY } from "@shared/modelRegistry";
import { getAiClient, withTextQueue, toInlinePart } from "./utils";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("wardrobe/identityCheck");

const IDENTITY_PROMPT = `Compare these two images. Image 1 is the original photo of a person. Image 2 is a generated edit of that same person.
Do they appear to be the same person? Focus on facial features, skin tone, body type, and hair. Small changes in lighting or pose are okay, but the IDENTITY must be preserved.
Answer strictly with "YES" if they look like the same person, or "NO" if the identity has drifted significantly (different face, different ethnicity, different body shape).`;

/**
 * Check whether the model and VTO result appear to be the same person.
 * Returns true if identity is preserved, false if drifted.
 * Defaults to true on any failure.
 */
export async function checkIdentityMatch(
  modelImageUrl: string,
  resultImageUrl: string,
): Promise<boolean> {
  const ai = getAiClient();

  try {
    const [modelPart, resultPart] = await Promise.all([
      toInlinePart(modelImageUrl),
      toInlinePart(resultImageUrl),
    ]);

    const response = await withTextQueue(() =>
      ai.models.generateContent({
        model: TEXT_ECONOMY,
        contents: [
          {
            parts: [
              { text: IDENTITY_PROMPT },
              modelPart,
              resultPart,
            ],
          },
        ],
      }),
    );

    const text = (response.text ?? "YES").trim().toUpperCase();
    return text.includes("YES");
  } catch (error) {
    log.warn({ err: error }, "[IdentityCheck] Failed, assuming YES");
    return true;
  }
}
