/**
 * Gemini Prompt Compactor — Rewrites bloated master prompts into clean single paragraphs.
 *
 * Migration Phase 2c: Ported from new Casting Studio design (promptCompactor.ts).
 *
 * After several iterations, the master prompt accumulates "APPLIED MODIFICATION:" headers
 * and contradictory amendments. This function asks a text model to rewrite the entire
 * description as one coherent paragraph, resolving contradictions in favor of the latest
 * amendment.
 *
 * Design rationale:
 *   - Preserves ALL brand aesthetic language, vibe, expression direction, casting mood
 *   - Only resolves physical feature contradictions
 *   - Minimum 100-char guard — rejects over-aggressive compaction
 *   - Fails safe — returns bloated prompt unchanged on error
 */

import {
  getAiClient,
  SAFETY_SETTINGS,
  safeResponseText,
  withTimeout,
} from "./geminiClient";
import { withTextQueue } from "./geminiQueue";

/**
 * Compact a bloated master prompt (original + N amendments) into a single
 * clean description. Gemini rewrites the full spec incorporating all changes,
 * resolving contradictions in favor of the most recent amendment.
 *
 * Trigger after ~3-5 iterations when the prompt becomes unwieldy.
 * Fails safe: returns bloatedPrompt unchanged if all models fail.
 */
export const compactMasterPrompt = async (
  bloatedPrompt: string,
  currentSchema: any
): Promise<string> => {
  return withTextQueue(async () => {
  const ai = getAiClient();

  const promptText = `You are a casting specification editor. You have a master casting description that has accumulated multiple amendments over time. Some amendments CONTRADICT the original description.

YOUR TASK: Rewrite the ENTIRE description as a single, clean, coherent paragraph. 

RULES:
1. When there is a contradiction (e.g. original says "blue eyes" but a later amendment says "green eyes"), the LATEST amendment wins.
2. Remove all "APPLIED MODIFICATION:" headers — integrate changes naturally into the prose.
3. Preserve ALL detail from the original that wasn't overridden.
4. Keep the same editorial/clinical tone and vocabulary.
5. Output ONLY the rewritten description. No explanations, no headers, no JSON.
6. PRESERVE all brand aesthetic language, vibe descriptions, expression direction, and casting mood from the original. These are NOT redundant — they guide the image model. Do not simplify "deadpan, quietly observing, unbothered" to just "neutral expression."

CURRENT SCHEMA (for reference — use this to verify which values are current):
${JSON.stringify(currentSchema, null, 2)}

BLOATED DESCRIPTION TO COMPACT:
---
${bloatedPrompt}
---

Rewritten clean description:`;

  const MODELS = ["gemini-2.5-flash", "gemini-3-flash-preview"];

  for (let i = 0; i < MODELS.length; i++) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: MODELS[i],
          contents: { parts: [{ text: promptText }] },
          config: {
            maxOutputTokens: 4096,
            safetySettings: SAFETY_SETTINGS,
          },
        }),
        20000,
        `PromptCompact (${MODELS[i]})`
      );

      const text = safeResponseText(response).trim();
      if (!text || text.length < 100) throw new Error("Compacted prompt too short");
      return text;
    } catch (e: any) {
      console.warn(`[PromptCompact] ${MODELS[i]} failed:`, e?.message);
      if (i === MODELS.length - 1) {
        // If compaction fails, return the bloated prompt unchanged — don't crash
        console.warn("[PromptCompact] All models failed, keeping bloated prompt");
        return bloatedPrompt;
      }
    }
  }
  return bloatedPrompt;
  }, 'compactMasterPrompt');
};
