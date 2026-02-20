/**
 * Gemini Schema Updater — Schema reconciliation and iteration-aware schema updates.
 *
 * Migration Phase 2a: Ported from new Casting Studio design (schemaUpdater.ts).
 *
 * Two functions:
 *   - updateSchemaForIteration: text-only schema field update based on iteration request
 *   - reconcileSchemaWithImage: visual ground-truth reconciliation (image → schema correction)
 *
 * Design rationale:
 *   DR-15: Both functions fail safe — return current schema unchanged on error.
 *   DR-16: reconcileSchemaWithImage treats the IMAGE as truth, not the schema.
 */

import {
  getAiClient,
  SAFETY_SETTINGS,
  safeResponseText,
  withTimeout,
  extractMimeType,
  extractBase64Data,
} from "./geminiClient";
import { withTextQueue } from "./geminiQueue";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("casting/geminiSchemaUpdater");

// ============================================================================
// JSON PARSING HELPERS
// ============================================================================

/**
 * Resilient JSON object parser for schema/reconciliation responses.
 * Handles markdown fences, trailing text, and malformed JSON.
 */
const safeParseJsonObject = (text: string): any | null => {
  // 1. Try clean parse
  try {
    return JSON.parse(text);
  } catch {}

  // 2. Strip markdown fences
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 3. Try to find the outermost {} and parse that
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    } catch {}
  }

  return null;
};

// ============================================================================
// SCHEMA UPDATE (text-only, fast)
// ============================================================================

/**
 * Update a casting schema based on an iteration request.
 * Only modifies the fields directly affected by the change request.
 * All other fields are preserved exactly as-is.
 *
 * Fails safe: returns currentSchema unchanged if all models fail.
 */
export const updateSchemaForIteration = async (
  currentSchema: any,
  iterationRequest: string
): Promise<any> => {
  return withTextQueue(async () => {
  const ai = getAiClient();

  const promptText = `You are updating a casting specification schema based on a specific change request.

CURRENT SCHEMA:
${JSON.stringify(currentSchema, null, 2)}

CHANGE REQUEST: "${iterationRequest}"

RULES:
1. ONLY modify the field(s) directly affected by the change request.
2. Copy ALL other fields exactly as they are — do not rephrase, do not reinterpret.
3. If the change doesn't map to any schema field (e.g. "add a scar"), return the schema unchanged.
4. Return ONLY the complete updated JSON object. No explanation.

OUTPUT: The updated schema JSON object.`;

  const MODELS = ["gemini-2.5-flash", "gemini-3-flash-preview"];

  for (let i = 0; i < MODELS.length; i++) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: MODELS[i],
          contents: { parts: [{ text: promptText }] },
          config: {
            responseMimeType: "application/json",
            maxOutputTokens: 8192,
            safetySettings: SAFETY_SETTINGS,
          },
        }),
        30000,
        `SchemaUpdate (${MODELS[i]})`
      );

      const jsonText = safeResponseText(response);
      if (!jsonText.trim()) throw new Error("Empty response");
      const parsed = safeParseJsonObject(jsonText);
      if (!parsed) throw new Error("Failed to parse schema update JSON");
      return parsed;
    } catch (e: any) {
      log.warn({ err: e?.message }, `[SchemaUpdate] ${MODELS[i]} failed:`);
      if (i === MODELS.length - 1) {
        // If all models fail, return current schema unchanged — don't crash the iteration
        log.warn("[SchemaUpdate] All models failed, keeping current schema");
        return currentSchema;
      }
    }
  }
  return currentSchema;
  }, 'updateSchemaForIteration');
};

// ============================================================================
// VISUAL RECONCILIATION (image + text, slower)
// ============================================================================

/**
 * Visual reconciliation — look at the actual image and correct the schema
 * and description to match reality. Runs after each iteration.
 *
 * The IMAGE is ground truth. If schema says "thin lips" but image shows
 * full lips, the schema gets corrected.
 *
 * Fails safe: returns current spec unchanged if all models fail or
 * the image can't be parsed.
 */
export const reconcileSchemaWithImage = async (
  currentSchema: any,
  imageBase64: string,
  masterPrompt: string
): Promise<{ schema: any; description: string }> => {
  return withTextQueue(async () => {
  const ai = getAiClient();

  // Build image part — bail early if malformed
  let imagePart: any = null;
  try {
    const mimeType = extractMimeType(imageBase64);
    const cleanBase64 = extractBase64Data(imageBase64);
    if (!cleanBase64) throw new Error("Malformed");
    imagePart = { inlineData: { mimeType, data: cleanBase64 } };
  } catch {
    return { schema: currentSchema, description: masterPrompt };
  }

  const promptText = `You are verifying a casting specification against the actual photograph.

IMAGE: The final model photograph (ground truth).

CURRENT SCHEMA:
${JSON.stringify(currentSchema, null, 2)}

SCHEMA STRUCTURE: You MUST return the exact same JSON structure and field names as 
the current schema. Only change the VALUES. Do not add, remove, or rename any keys.
The structure is:
- subject: { sex, age, ethnicity, skin_tone, hair_style, hair_color, eye_color }
- facial_features: { eye_shape, face_shape, jawline, cheekbones, cheeks_shape, nose_shape, lips_shape, eyebrows, freckles }
- context: { tone, casting_for, wardrobe }

CURRENT DESCRIPTION:
"${masterPrompt}"

TASK: Compare the image to the schema and description. Correct ANY discrepancies so 
the spec matches what is VISIBLE in the photograph.

RULES:
1. The IMAGE is truth. If schema says "thin lips" but image shows full lips, correct it.
2. Update ALL mismatched fields: hair_style, hair_color, eye_color, lips_shape, 
   eyebrows, face_shape, jawline, cheekbones, nose_shape, skin_tone, etc.
3. For the description: correct ONLY the physical feature descriptions that don't 
   match the image. Remove any "APPLIED MODIFICATION:" lines and incorporate those 
   changes naturally. Remove any "[CASTING OVERRIDES...]" prefixes.
4. Keep fields that already match the image unchanged — don't rephrase for no reason.
5. Maintain the editorial style: objective, anatomically precise, no marketing fluff.
6. PRESERVE all brand, vibe, and casting direction language from the current description.
   You are correcting PHYSICAL FEATURE descriptions only (hair, lips, brows, eyes, etc.)
   Do NOT rewrite mood, lighting, camera, brand aesthetic, or casting tone language.
   Only change the specific feature descriptions that don't match the image.

OUTPUT: JSON with exactly two keys:
{
  "schema": { <corrected technical_schema — same structure, corrected values> },
  "description": "<surgically corrected description — brand/mood/lighting preserved>"
}`;

  const MODELS = ["gemini-3-flash-preview", "gemini-2.5-flash"];

  for (let i = 0; i < MODELS.length; i++) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: MODELS[i],
          contents: { parts: [imagePart, { text: promptText }] },
          config: {
            responseMimeType: "application/json",
            maxOutputTokens: 4096,
            safetySettings: SAFETY_SETTINGS,
          },
        }),
        45000,
        `Reconcile (${MODELS[i]})`
      );

      const jsonText = safeResponseText(response);
      if (!jsonText.trim()) throw new Error("Empty response");
      const parsed = safeParseJsonObject(jsonText);
      if (!parsed) throw new Error("Failed to parse reconciliation JSON");

      return {
        schema: parsed.schema || currentSchema,
        description: parsed.description || masterPrompt,
      };
    } catch (e: any) {
      log.warn({ err: e?.message }, `[Reconcile] ${MODELS[i]} failed:`);
      if (i === MODELS.length - 1) {
        log.warn("[Reconcile] All models failed, keeping current spec");
        return { schema: currentSchema, description: masterPrompt };
      }
    }
  }

  return { schema: currentSchema, description: masterPrompt };
  }, 'reconcileSchemaWithImage');
};
