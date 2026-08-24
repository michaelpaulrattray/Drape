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
 * Read the reader's verdict out of its reply. **This IS the two lines that used
 * to sit inline in `checkIdentityMatch`, byte for byte** — lifted so the arms
 * that describe this behaviour can drive the product's own parse instead of a
 * transcription of it (ruled fable-1621 §2; the lift is behaviour-preserving
 * and nothing about the verdict moved).
 *
 * ⚠ **THE EMPTY-RESPONSE CASE IS DOCUMENTED HERE, NOT DECIDED HERE.** `??`
 * substitutes for `null`/`undefined` and NOT for `""`, so an empty reply is
 * `""`, holds no "YES", and reports a DRIFT. Three arms in `wardrobe.test.ts`
 * used to re-type this parse three different ways, and the one named *"defaults
 * to true for empty responses"* wrote `||` where the product has `??` — so it
 * asserted the OPPOSITE of what the product does, and was the only description
 * of the behaviour anywhere. Whether empty-means-drift is the RIGHT product
 * behaviour is undecided: conservative-toward-drift is the defensible default
 * for an identity check, and nobody moves it on a test's opinion. If production
 * logs ever show empty-response drift reports, that is the trigger and the call
 * is the founder's.
 */
export function readIdentityVerdict(replyText: string | undefined): boolean {
  const text = (replyText ?? "YES").trim().toUpperCase();
  return text.includes("YES");
}

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

    return readIdentityVerdict(response.text);
  } catch (error) {
    log.warn({ err: error }, "[IdentityCheck] Failed, assuming YES");
    return true;
  }
}
