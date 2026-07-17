/**
 * Gemini Client - API client factory, safety settings, response helpers,
 * retry logic, identity anchor, and shared utilities.
 *
 * Migration Phase 1b: Added from new Casting Studio design.
 * - safeResponseText, extractImageFromResponse, diagnoseResponse
 * - withTimeout, withSingleRetry503
 * - buildIdentityAnchor, checkIdentityConsistency
 * - extractBase64Data (server-side)
 * - Updated formatGeminiError with more specific messages
 */

import { TEXT_ECONOMY } from "@shared/modelRegistry";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { ENV } from "../_core/env";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("casting/geminiClient");

// Lazy import to avoid circular dependency (geminiQueue imports from geminiClient)
let _withTextQueue: typeof import("./geminiQueue").withTextQueue | null = null;
const getTextQueue = async () => {
  if (!_withTextQueue) {
    const mod = await import("./geminiQueue");
    _withTextQueue = mod.withTextQueue;
  }
  return _withTextQueue;
};

// ============================================================================
// CLIENT FACTORY
// ============================================================================

export const getAiClient = () => {
  const apiKey = ENV.geminiApiKey;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.");
  }
  return new GoogleGenAI({ apiKey });
};

// ============================================================================
// SAFETY SETTINGS
// ============================================================================

/**
 * BLOCK_NONE is intentional for Casting Studio. Rationale:
 *
 * Fashion casting requires generating bare skin (shoulders, arms, legs),
 * clinical anatomical descriptions (jawline, cheekbones, sub-malar hollows),
 * and industry terminology that triggers overly cautious safety filters.
 *
 * When integrating into the unified system, this setting should be
 * preserved for Casting workflows and NOT unified with other apps'
 * BLOCK_ONLY_HIGH setting.
 */
export const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
];

// ============================================================================
// DATA URL UTILITIES
// ============================================================================

/** Extract MIME type from a data URL */
export const extractMimeType = (dataUrl: string): string => {
  const match = dataUrl.match(/^data:(.*?);base64,/);
  return match ? match[1] : 'image/jpeg';
};

/** Extract raw base64 data from a data URL (strips the prefix) */
export const extractBase64Data = (dataUrl: string): string => {
  return dataUrl.replace(/^data:.*?;base64,/, "");
};

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/** Safely extract text from a Gemini response without using .text accessor (which throws on empty) */
export const safeResponseText = (response: any): string => {
  try {
    return response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch {
    return '';
  }
};

/** Extract the first image data URL from a Gemini response */
export const extractImageFromResponse = (response: any): string | null => {
  for (const part of response?.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
};

/** Diagnose a Gemini response for common failure modes and return a user-friendly error */
export const diagnoseResponse = (response: any): string | null => {
  // Check prompt-level block (blocked before any generation)
  const blockReason = response?.promptFeedback?.blockReason;
  if (blockReason) {
    return `Prompt blocked by safety filter: ${blockReason}. Try rephrasing the casting specification.`;
  }

  // Check for missing candidates
  const candidates = response?.candidates;
  if (!candidates || candidates.length === 0) {
    return "No response generated. The request may have been filtered.";
  }

  // Check candidate finish reason
  const finishReason = candidates[0]?.finishReason;
  if (finishReason && ['SAFETY', 'BLOCKED', 'RECITATION', 'PROHIBITED_CONTENT'].includes(finishReason)) {
    return `Generation stopped: ${finishReason}. The casting parameters may have triggered content filters.`;
  }

  return null; // No issues found
};

// ============================================================================
// TIMEOUT & RETRY
// ============================================================================

/** Wrap a promise with a timeout. Rejects with descriptive error if exceeded. */
export const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  controller?: AbortController
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller?.abort();
      reject(new Error(`${label} timed out after ${ms / 1000}s`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
};

/**
 * Wrap an async operation with a single retry on 500/503 (server errors only).
 * Does NOT retry 429 (rate limit) — in a multi-user environment, retrying
 * rate limits amplifies the problem. 429s surface to the user with cooldown guidance.
 */
export const withSingleRetry503 = async <T>(
  fn: () => Promise<T>,
  label: string
): Promise<T> => {
  try {
    return await fn();
  } catch (e: any) {
    const msg = e?.message || e?.toString() || '';
    const isServerError = msg.includes('500') || msg.includes('503');
    if (isServerError) {
      log.warn(`[${label}] Server error, retrying once in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
      return await fn();
    }
    throw e;
  }
};

// ============================================================================
// ERROR FORMATTING
// ============================================================================

/**
 * Map a provider error to a SAFE user-facing sentence. Every branch returns
 * fixed wording — raw provider text (which can carry request payloads, URLs,
 * or key details) never passes through (final review correction: error
 * sanitization). Callers log the complete original error server-side.
 */
export const formatGeminiError = (e: any): string => {
  const msg = e.message || e.toString();

  if (msg.includes('429')) return "RATE_LIMIT:Rate limit exceeded. The engine is shared — please wait before retrying.";
  // Customers never provide or manage the server's Gemini key — an auth
  // failure is OUR outage, never something the user can fix.
  if (msg.includes('403') || msg.includes('API key')) return "The generation service is temporarily unavailable. Please try again later.";
  if (msg.includes('400')) return "The engine rejected this request. Adjust the instruction and try again.";
  if (msg.includes('500') || msg.includes('503')) return "Engine offline. The servers are experiencing downtime.";
  if (msg.includes('SAFETY') || msg.includes('blocked')) return "Safety protocols triggered. The request was flagged by content filters.";
  if (msg.includes('timed out')) return "Request timed out. Please try again.";

  return "Generation failed unexpectedly. Please try again.";
};

// ============================================================================
// IDENTITY ANCHOR
// ============================================================================

/**
 * Build a structured identity context string from master prompt + technical schema.
 * Used by view generators and body generators to maintain identity consistency.
 */
export const buildIdentityAnchor = (masterPrompt: string, schema?: any): string => {
  if (!schema) return `IDENTITY CONTEXT:\n${masterPrompt}`;

  const subject = schema.subject || {};
  const face = schema.facial_features || {};

  const fields = [
    subject.sex && `Sex: ${subject.sex}`,
    subject.age && `Age: ${subject.age}`,
    subject.ethnicity && `Ethnicity: ${subject.ethnicity}`,
    subject.skin_tone && `Skin tone: ${subject.skin_tone}`,
    subject.hair_color && `Hair: ${[subject.hair_color, subject.hair_style].filter(Boolean).join(", ")}`,
    subject.eye_color && `Eyes: ${subject.eye_color}`,
    face.face_shape && `Face shape: ${face.face_shape}`,
    face.jawline && `Jawline: ${face.jawline}`,
    face.cheekbones && `Cheekbones: ${face.cheekbones}`,
    face.nose_shape && `Nose: ${face.nose_shape}`,
    face.lips_shape && `Lips: ${face.lips_shape}`,
    face.eyebrows && `Eyebrows: ${face.eyebrows}`,
  ].filter(Boolean).join('\n');

  return `IDENTITY — THIS PERSON MUST MATCH THE REFERENCE IMAGE EXACTLY:
${fields}

Full casting spec: ${masterPrompt}`;
};

// ============================================================================
// IDENTITY CONSISTENCY CHECK
// ============================================================================

/**
 * Lightweight identity consistency check. Asks a fast text model
 * whether two images appear to be the same person.
 * Returns true if consistent, false if drift detected.
 * Fails open (returns true) if the check itself errors.
 */
export const checkIdentityConsistency = async (
  sourceImageBase64: string,
  generatedImageBase64: string,
  sourceMimeType: string = 'image/png',
  generatedMimeType: string = 'image/png'
): Promise<{ consistent: boolean; notes?: string }> => {
  const textQueue = await getTextQueue();
  return textQueue(async () => {
  try {
    const ai = getAiClient();
    const response = await withTimeout(
      ai.models.generateContent({
        model: TEXT_ECONOMY,
        contents: {
          parts: [
            { inlineData: { data: extractBase64Data(sourceImageBase64), mimeType: sourceMimeType } },
            { inlineData: { data: extractBase64Data(generatedImageBase64), mimeType: generatedMimeType } },
            { text: `Compare these two images. Are they the SAME PERSON? Check: face shape, skin tone, eye color, hair color/style, distinguishing marks (tattoos, scars, moles).

Reply with ONLY a JSON object:
{ "same_person": true/false, "confidence": "high"/"medium"/"low", "differences": "brief note or empty string" }` }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          maxOutputTokens: 256,
          safetySettings: SAFETY_SETTINGS,
        }
      }),
      10000,
      'IdentityCheck'
    );

    const text = safeResponseText(response).replace(/```json/g, '').replace(/```/g, '').trim();

    if (!text) {
      log.warn('[IdentityCheck] Empty response text, assuming consistent');
      return { consistent: true };
    }

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      log.warn({ err: text.slice(0, 100) }, '[IdentityCheck] Failed to parse response');
      return { consistent: true };
    }

    return {
      consistent: result.same_person === true,
      notes: result.differences || undefined
    };
  } catch (e: any) {
    log.warn({ err: e?.message }, '[IdentityCheck] Failed, assuming consistent:');
    return { consistent: true }; // Fail open
  }
  }, 'checkIdentityConsistency');
};
