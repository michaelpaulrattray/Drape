/**
 * Gemini Suggestions — Quick variation suggestions and reference image analysis.
 *
 * Migration Phase 2b: Ported from new Casting Studio design (suggestionGenerator.ts).
 *
 * Two functions:
 *   - generateCastingSuggestions: 6 quick variation chips based on current cast + image
 *   - analyzeReferenceForTransfer: detailed attribute descriptions from a reference photo
 *
 * Design rationale:
 *   - Suggestions are NON-CRITICAL — fail silently with hardcoded fallbacks
 *   - Reference analysis requires an image — returns [] if image can't be parsed
 *   - BARE FACE rule — no makeup suggestions (blush, lipstick, eyeshadow, etc.)
 *   - View-aware — adapts suggestions to active view (headshot vs full body)
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

// ============================================================================
// JSON PARSING HELPERS
// ============================================================================

/**
 * Resilient JSON array parser — handles truncated responses, unescaped quotes,
 * and malformed JSON from vision model outputs.
 */
const safeParseJsonArray = (text: string): string[] => {
  // 1. Try clean parse first
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}

  // 2. Try stripping markdown fences
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}

  // 3. Extract strings via regex — handles truncated JSON
  const matches = cleaned.match(/"([^"]{3,80})"/g);
  if (matches && matches.length > 0) {
    return matches.map((m) => m.replace(/^"|"$/g, "")).slice(0, 6);
  }

  return [];
};

// ============================================================================
// SUGGESTION GENERATION
// ============================================================================

/**
 * Generate 6 quick variation suggestions based on the current casting spec.
 * Optionally uses the generated image for visual context.
 *
 * Suggestions are view-aware (headshot vs full body vs side profile).
 * Falls back to hardcoded suggestions on any failure — suggestions are
 * a UX enhancement, not a core feature.
 */
export const generateCastingSuggestions = async (
  masterPrompt: string,
  generatedImageBase64?: string,
  activeView?: string,
  profileSummary?: string
): Promise<string[]> => {
  return withTextQueue(async () => {
  const ai = getAiClient();

  const viewContext =
    activeView === "frontClose"
      ? "headshot"
      : activeView === "frontFull"
        ? "full body front"
        : activeView === "sideClose"
          ? "side profile"
          : "portrait";

  const profileContext = profileSummary
    ? `\nMODEL PROFILE:\n${profileSummary}\n\nSuggestions should be relevant to this specific model — consider their features, skin, hair, and aesthetic when suggesting changes.\n`
    : "";

  const prompt = `You are a casting director reviewing a ${viewContext} of a model you just generated. Suggest 6 quick variations to try next.

CURRENT CASTING SPEC (context):
"${masterPrompt.substring(0, 500)}"
${profileContext}
Generate exactly 6 suggestions. Each must be:
- 3-8 words max
- ONE specific, visible change
- Appropriate for a ${viewContext} (don't suggest full body changes for a headshot)
- Relevant to THIS model's specific features
- Plain language, no jargon

GOOD EXAMPLES:
- "Slightly fuller lower lip"
- "Add light freckles on nose"
- "Stronger jawline definition"
- "Warmer, golden skin undertone"
- "Messier windswept texture"
- "Add a subtle scar on eyebrow"

BAD EXAMPLES:
- "Transcendent ethereal beauty" (vague)
- "Change to full body shot" (wrong view type)
- "Make more editorial" (not specific)
- "Change ethnicity" (inappropriate)

NEVER SUGGEST:
- Makeup of any kind (blush, lipstick, eyeshadow, eyeliner, foundation, contour, highlight)
- Cosmetic products or beauty treatments
- This is a BARE FACE casting studio. All suggestions must be natural physical features only.

Return ONLY a JSON array of exactly 6 strings.`;

  const parts: any[] = [{ text: prompt }];

  if (generatedImageBase64) {
    try {
      const mimeType = extractMimeType(generatedImageBase64);
      const cleanBase64 = extractBase64Data(generatedImageBase64);
      if (!cleanBase64) throw new Error("Empty data");
      parts.push({ inlineData: { mimeType, data: cleanBase64 } });
    } catch (e) {
      console.warn("[Suggestions] Failed to parse image, text-only fallback");
    }
  }

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 1024,
          safetySettings: SAFETY_SETTINGS,
        },
      }),
      15000,
      "Suggestions"
    );
    const text = safeResponseText(response);
    const parsed = safeParseJsonArray(text);
    if (parsed.length > 0) return parsed.slice(0, 6);
  } catch {
    // Silent fail — suggestions are non-critical
  }

  // Fallback
  return [
    "Slightly narrower jawline",
    "Add subtle under-eye shadows",
    "Warmer skin undertone",
    "More prominent cheekbones",
    "Thicker, bushier eyebrows",
    "Add a beauty mark on cheek",
  ];
  }, 'generateCastingSuggestions');
};

// ============================================================================
// REFERENCE IMAGE ANALYSIS
// ============================================================================

/**
 * Analyze a reference image and generate descriptive transfer suggestions.
 * Each suggestion is a self-contained description of ONE transferable attribute,
 * written so it can serve directly as an iteration instruction.
 *
 * Optionally compares against the current model image to suggest only
 * attributes that would visibly change the model.
 *
 * Returns empty array if the reference image can't be parsed.
 */
export const analyzeReferenceForTransfer = async (
  referenceImageBase64: string,
  currentModelImageBase64?: string,
  masterPrompt?: string
): Promise<string[]> => {
  return withTextQueue(async () => {
  const ai = getAiClient();

  const parts: any[] = [];

  // Reference image first — it's the subject of analysis
  try {
    const mimeType = extractMimeType(referenceImageBase64);
    const cleanBase64 = extractBase64Data(referenceImageBase64);
    if (!cleanBase64) throw new Error("Empty data");
    parts.push({ inlineData: { mimeType, data: cleanBase64 } });
  } catch {
    return []; // Can't analyze without an image
  }

  // Current model image for comparison (optional but helps differentiation)
  if (currentModelImageBase64) {
    try {
      const mimeType = extractMimeType(currentModelImageBase64);
      const cleanBase64 = extractBase64Data(currentModelImageBase64);
      if (cleanBase64) {
        parts.push({ inlineData: { mimeType, data: cleanBase64 } });
      }
    } catch {
      // Continue without model comparison
    }
  }

  const hasModelImage = parts.length > 1;

  parts.push({
    text: `You are a casting director analyzing ${hasModelImage ? "two images" : "a reference image"}.

${
  hasModelImage
    ? "IMAGE 1 is a REFERENCE photo. IMAGE 2 is the CURRENT MODEL. Identify transferable attributes from the reference that would change the current model."
    : "Analyze this reference photo and identify its most distinctive transferable attributes."
}

For each attribute, write a DETAILED, PRECISE description that will be used as an image editing instruction.
The description must capture the EXACT character of the feature — its intensity, density, color, placement, and quality.
Understatement is critical: if the reference has subtle freckles, say "subtle" or "faint." If the hair is slightly wavy, say "slight wave."

FORMAT: Start with the attribute name, then describe EXACTLY what it looks like in the reference.

GOOD (detailed, captures intensity):
"Sparse, faint golden freckles — concentrated on nose bridge and upper cheeks only, barely visible"
"Thick natural brows with brushed-up feathered texture and slightly unruly shape"
"Textured wolf cut with choppy chin-length layers and wispy curtain bangs"
"Full rounded lips with soft defined cupid's bow and natural pink tone"
"Subtle under-eye hollows with faint blue-grey shadow, giving a lived-in look"
"Sleek high ponytail pulled tight from the face, baby hairs at temples"

BAD (vague, will produce exaggerated results):
"Add freckles" (no density, color, or placement — model will add too many)
"Change the eyebrows" (no description of what they look like)
"Use hairstyle from reference" (not descriptive at all)
"Nice lips" (not specific enough)
"Make skin texture match" (too vague)

Return 4-6 suggestions. Each must be:
- 8-20 words: enough detail to guide precise reproduction
- Focused on ONE transferable attribute: hair, lips, brows, eye shape, 
  nose shape, jawline, cheekbones, facial hair, or skin features
- MATCH the reference exactly — include intensity words (subtle, faint, bold, heavy, sparse, dense, slight)
${hasModelImage ? "- Only suggest attributes that would visibly CHANGE the current model" : ""}

EXCLUDE — do NOT suggest:
- Electronics, earbuds, headphones, phones, tech accessories
- Non-fashion objects (food, drinks, sports equipment)
- Background elements, scenery, furniture
- Clothing brands or specific garments
- Full "looks" or moods — each suggestion must be ONE physical attribute
- ANY makeup (blush, lipstick, eyeshadow, eyeliner, contour, highlight, foundation)
- This is a BARE FACE casting studio. All suggestions must be natural physical features only.

${masterPrompt ? `Current model context (for relevance): "${masterPrompt.substring(0, 300)}"` : ""}

Return ONLY a JSON array of strings.`,
  });

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 1024,
          safetySettings: SAFETY_SETTINGS,
        },
      }),
      30000,
      "RefAnalysis"
    );
    const text = safeResponseText(response);
    const parsed = safeParseJsonArray(text);
    if (parsed.length > 0) {
      return parsed.slice(0, 6);
    }
  } catch (e: any) {
    console.warn("[RefAnalysis] Failed:", e?.message);
  }
  return [];
  }, 'analyzeReferenceForTransfer');
};
