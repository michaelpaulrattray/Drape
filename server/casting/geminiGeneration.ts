/**
 * Gemini Generation - Master prompt generation, prompt enhancement,
 * and casting image generation (headshot + iteration/inpainting).
 *
 * Migration Phase 1b: Updated from new Casting Studio design.
 * - Chat session persistence (activeSession / clearCastingSession)
 * - 3-path generation: chat iteration → chat NEW → stateless fallback
 * - Brand expression system (replaces brand directives)
 * - Ethnicity phenotype lock
 * - Attribute transfer protocol (identity lock)
 * - diagnoseResponse / extractImageFromResponse
 * - withTimeout / withSingleRetry503
 */

import { IMAGE_PRO, IMAGE_FLASH, TEXT_PRO, TEXT_MID, TEXT_ECONOMY, TEXT_HEAVY_FALLBACK, TEXT_LIGHT_FALLBACK, IMAGE_FALLBACK } from "@shared/modelRegistry";
import type { CanonicalViewAngle } from "@shared/boardTypes";
import { ITERATION_FRAME_DIRECTIVES } from "./iterationFraming";
import type { ModelPreferences, GeminiPart } from "./geminiTypes";
import { ImageResolution, AspectRatio, GenerationMode } from "./geminiTypes";
import {
  getAiClient,
  SAFETY_SETTINGS,
  extractMimeType,
  extractBase64Data,
  formatGeminiError,
} from "./geminiClient";
import { PublicError } from "../lib/publicError";
import {
  diagnoseResponse,
  extractImageFromResponse,
  safeResponseText,
  withTimeout,
  withSingleRetry503,
  buildIdentityAnchor,
} from "./geminiClient";
import { withImageQueue, withTextQueue } from "./geminiQueue";
import { validateNotPlaceholder } from "./placeholderDetection";
import {
  MASTER_PROMPT_SYSTEM_INSTRUCTION,
  getSkinDescription,
  getBrandExpression,
  BRAND_PROFILES,
  DEFAULT_BRAND_DESCRIPTOR,
  irisDescriptions,
  getStudioSettings,
} from "./geminiPrompts";
import { markPromptStateFor } from "./identity/marksVocabulary";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("casting/geminiGeneration");

// ============================================================================
// CHAT SESSION STATE
// ============================================================================

/**
 * Persists between calls so iterations reuse the same conversation.
 * The model retains visual memory of what it generated, reducing identity drift.
 * Keyed by userId for concurrent user isolation.
 */
interface CastingSession {
  chat: any;
  model: string;
  lastUsed: number;
}

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_SESSIONS = 200;
const EVICTION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const sessionMap = new Map<string, CastingSession>();

/** Evict sessions older than TTL to prevent memory leaks */
function evictStaleSessions(): void {
  const now = Date.now();
  const entries = Array.from(sessionMap.entries());
  for (const [uid, session] of entries) {
    if (now - session.lastUsed > SESSION_TTL_MS) {
      sessionMap.delete(uid);
      log.info(`[CastingSession] Evicted stale session for user ${uid}`);
    }
  }

  // Hard cap: if still over limit, evict oldest by lastUsed
  if (sessionMap.size > MAX_SESSIONS) {
    const sorted = Array.from(sessionMap.entries())
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    const toEvict = sorted.slice(0, sessionMap.size - MAX_SESSIONS);
    for (const [uid] of toEvict) {
      sessionMap.delete(uid);
      log.info(`[CastingSession] Evicted oldest session for user ${uid} (cap: ${MAX_SESSIONS})`);
    }
  }
}

// Periodic eviction timer — runs every 5 minutes
const evictionTimer = setInterval(evictStaleSessions, EVICTION_INTERVAL_MS);
evictionTimer.unref(); // Don't prevent process exit

/** Clear the eviction timer (for graceful shutdown) */
export const stopSessionEviction = () => {
  clearInterval(evictionTimer);
};

/** Get current session count (for monitoring) */
export const getSessionCount = () => sessionMap.size;

/** Clear the chat session for a specific user (e.g. when starting a new casting) */
export const clearCastingSession = (userId: string) => {
  sessionMap.delete(userId);
  log.info(`[CastingSession] Cleared for user ${userId}`);
  evictStaleSessions();
};

// ============================================================================
// GENERATE MASTER PROMPT
// ============================================================================

/**
 * Generate master prompt from model preferences.
 * Uses the system instruction + structured user content to produce
 * { natural_description, technical_schema } JSON.
 */
export const generateMasterPrompt = async (
  prefs: ModelPreferences,
  mode: 'NEW' | 'ITERATE' | 'REFERENCE' = 'NEW'
): Promise<{ natural: string; schema: any }> => {
  return withTextQueue(async () => {
  log.info({
    brand: prefs.castingBrand,
    gender: prefs.gender,
    ethnicity: prefs.ethnicity,
    mode,
  }, '[geminiGeneration] generateMasterPrompt called');

  const ai = getAiClient();

  // Reconcile skin texture with age — "Mature" on a young subject gets softened
  let effectiveSkinTexture = prefs.skinTexture;
  const age = parseInt(String(prefs.age || "23"), 10);
  if (effectiveSkinTexture === 'Mature' && age < 35) {
    effectiveSkinTexture = 'Raw / Standard'; // Young skin can't have collagen loss and crow's feet
  }
  const skinInstruction = getSkinDescription(effectiveSkinTexture, prefs.skinFinish);

  const parts: GeminiPart[] = [];

  if (prefs.referenceImage && mode === 'ITERATE') {
    const mimeType = extractMimeType(prefs.referenceImage);
    const base64Data = extractBase64Data(prefs.referenceImage);
    parts.push({ inlineData: { data: base64Data, mimeType } });
  }

  let userContent = "";

  if (mode === 'NEW' || mode === 'REFERENCE') {
    userContent = buildNewPromptContent(prefs, skinInstruction);
  } else if (mode === 'ITERATE') {
    userContent = buildIteratePromptContent(prefs);
  }

  parts.push({ text: userContent });

  const generateText = async (model: string) => {
    return await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        systemInstruction: MASTER_PROMPT_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        maxOutputTokens: 4096,
        safetySettings: SAFETY_SETTINGS,
      }
    });
  };

  const parseResponse = (response: any): { natural: string; schema: any } => {
    let jsonText = safeResponseText(response) || response.text || "{}";
    jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonText);
    return {
      natural: parsed.natural_description || "",
      schema: parsed.technical_schema || {},
    };
  };

  const MODELS = [...TEXT_HEAVY_FALLBACK];

  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    try {
      const response = await withSingleRetry503(
        () => withTimeout(generateText(model), 30000, `MasterPrompt (${model})`),
        `MasterPrompt (${model})`
      );
      return parseResponse(response);
    } catch (e: any) {
      // Complete internal error server-side; only sanitized wording travels
      log.warn({ err: e }, `[MasterPrompt] ${model} failed:`);
      if (i === MODELS.length - 1) {
        throw new PublicError(formatGeminiError(e), { cause: e });
      }
      // Brief pause before trying next model
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  throw new Error('Master prompt generation failed across all models.');
  }, 'generateMasterPrompt');
};

// ============================================================================
// PROMPT CONTENT BUILDERS (private helpers)
// ============================================================================

/**
 * Formats ethnicity blend into a descriptive string the text model can interpret.
 * Uses dominance bands so the model treats 90/10 differently from 50/50.
 */
function formatEthnicityBlend(prefs: ModelPreferences): string {
  if (prefs.ethnicityBlend && prefs.ethnicityBlend.length > 0) {
    const sorted = [...prefs.ethnicityBlend].sort((a, b) => b.pct - a.pct);

    if (sorted.length === 1) {
      return sorted[0].name;
    }

    const [pri, sec] = sorted;

    // Dominance bands — guides how the text model interprets the mix
    if (pri.pct >= 85) {
      return `${pri.name} with a trace of ${sec.name} heritage`;
    }
    if (pri.pct >= 70) {
      return `Predominantly ${pri.name} with visible ${sec.name} influence`;
    }
    if (pri.pct >= 55) {
      return `Mixed ${pri.name}-${sec.name} heritage, leaning ${pri.name}`;
    }
    return `Equal ${pri.name}-${sec.name} biracial heritage`;
  }

  // Fallback to legacy string
  return prefs.ethnicity || "Any";
}

/**
 * Body type affects visible headshot areas (neck, shoulders, face fullness).
 */
function bodyTypeHeadshotHint(bodyType?: string): string {
  const bt = (bodyType || 'Slim').toLowerCase();
  if (bt === 'curvy') return 'BODY TYPE NOTE: Curvy build — reflect in neck width, broader shoulders, and slightly fuller face.';
  if (bt === 'athletic' || bt === 'muscular') return 'BODY TYPE NOTE: Athletic/Muscular build — reflect in thicker neck, defined traps and shoulders visible in frame.';
  if (bt === 'petite') return 'BODY TYPE NOTE: Petite build — reflect in narrower shoulders, delicate neck, finer bone structure.';
  if (bt === 'ultra thin') return 'BODY TYPE NOTE: Ultra thin build — reflect in narrow neck, visible collarbones and tendons, leaner face.';
  if (bt === 'slim') return 'BODY TYPE NOTE: Slim build — reflect in defined jawline, lean face with visible bone structure, slender neck, and narrow shoulders.';
  // 'model standard' or unknown — neutral slim-leaning default
  return 'BODY TYPE NOTE: Model-standard build — lean proportions, defined bone structure, slender neck.';
}

// Exported for the parser-override unit tests (R2) — not part of the public API
export function buildNewPromptContent(prefs: ModelPreferences, skinInstruction: string): string {
  const isMale = prefs.gender?.toLowerCase().includes('male');

  // Brand descriptor from unified BRAND_PROFILES
  const brandDescriptors: Record<string, string> = Object.fromEntries(
    Object.entries(BRAND_PROFILES).map(([key, val]) => [key, val.descriptor])
  );
  let brandVibe = brandDescriptors[prefs.castingBrand || 'Gucci'] || DEFAULT_BRAND_DESCRIPTOR;
  // Parser override (PARSER_PROMPT_V2 §4): user-described brand archetypes
  // outside the enum (Tom Ford, Margiela…) ride along as additional context
  if (prefs.castingBrandOverride) {
    brandVibe += `\nADDITIONAL BRAND CONTEXT (user-specified, treat as primary aesthetic direction): ${prefs.castingBrandOverride}`;
  }

  // Vibe blend description — qualitative intensity bands, never raw numbers
  let vibeBlendDescription = "";
  if (prefs.castingVibe) {
    const { editorial, commercial, runway } = prefs.castingVibe;

    // Convert weights to qualitative intensity bands — never send raw numbers
    const describeWeight = (w: number,
      strong: string, moderate: string, hint: string
    ): string | null => {
      if (w >= 0.6) return strong;
      if (w >= 0.3) return moderate;
      if (w >= 0.1) return hint;
      return null;
    };

    const edDesc = describeWeight(editorial,
      "DOMINANT EDITORIAL: Push the brand's OWN aesthetic to its most extreme and committed expression. Whatever makes this brand distinctive — turn it up. If the brand is brutal, go more brutal. If the brand is bookish, go more intensely bookish. If the brand is quirky, go more boldly quirky. Do NOT default to 'weird' or 'alien' — amplify what the BRAND already is.",
      "MODERATE EDITORIAL INFLUENCE: Intensify the brand's natural aesthetic — make the distinctive features more committed and specific.",
      "SUBTLE EDITORIAL TRACE: A slight intensification of whatever makes the brand's casting type distinctive."
    );
    const comDesc = describeWeight(commercial,
      "DOMINANT COMMERCIAL: Soften the brand's aesthetic toward broader appeal. Keep the brand's DNA visible but make everything more symmetrical, approachable, and conventionally attractive. The face should feel castable for a wide audience.",
      "MODERATE COMMERCIAL INFLUENCE: Soften the edges — more approachable than the brand's pure archetype while keeping its identity.",
      "SUBTLE COMMERCIAL TRACE: A touch of approachability in the overall impression."
    );
    const rwDesc = describeWeight(runway,
      "DOMINANT RUNWAY: Amplify the physical presence and bone structure within the brand's direction. Make the features more dramatic and commanding — but dramatic IN THE WAY THE BRAND DEFINES IT. A brutal brand gets more angular. A glamorous brand gets more statuesque. A youthful brand gets more striking presence in the gaze, not in the bones.",
      "MODERATE RUNWAY INFLUENCE: Increase physical intensity and presence within the brand's own casting direction.",
      "SUBTLE RUNWAY TRACE: A hint of heightened physical presence in the gaze and bearing."
    );

    const activeVibes = [edDesc, comDesc, rwDesc].filter(Boolean);
    vibeBlendDescription = activeVibes.length > 0
      ? `CASTING VIBE DIRECTION:\n${activeVibes.join('\n')}`
      : "CASTING VIBE: Balanced high fashion editorial.";
  } else {
    vibeBlendDescription = "CASTING VIBE: Balanced editorial — let the brand direction above define the physical aesthetic.";
  }

  const qualityBaseline = `
    ── BRAND CASTING BRIEF ──
    ${brandVibe}

    ── VIBE INTENSITY ──
    ${vibeBlendDescription}

    Remember: pick SPECIFIC values for every facial feature. The image model is 
    literal — it renders what you describe, it does not interpret mood or vibe.
    
    Wardrobe: BARE SKIN ONLY. NO CLOTHING OR STRAPS VISIBLE.`;

  // Filter out sub-selectors that are physically impossible for the base style
  const baseStyle = (prefs.hairStyle || "").toLowerCase();
  const isBuzzShaved = baseStyle.includes('buzz') || baseStyle.includes('shaved');

  const hairDetails = [
    (!isBuzzShaved && prefs.hairLength) ? `Length: ${prefs.hairLength}` : "",
    prefs.hairTexture ? `Texture: ${prefs.hairTexture}` : "",
    (!isBuzzShaved && prefs.hairFringe) ? `Fringe/Bangs: ${prefs.hairFringe}` : "",
    (!isBuzzShaved && prefs.hairParting) ? `Parting: ${prefs.hairParting}` : "",
    (!isBuzzShaved && prefs.hairVolume) ? `Volume/Shape: ${prefs.hairVolume}` : "",
    (!isBuzzShaved && prefs.hairFlyaways) ? `Flyaways: ${prefs.hairFlyaways}` : "",
    prefs.hairHairline ? `Hairline: ${prefs.hairHairline}` : "",
    (!isBuzzShaved && prefs.hairTuck) ? `Tuck: ${prefs.hairTuck}` : "",
    prefs.hairFade ? `Fade/Taper: ${prefs.hairFade}` : ""
  ].filter(Boolean).join(". ");

  const ethnicityDescription = formatEthnicityBlend(prefs);

  const btHint = bodyTypeHeadshotHint(prefs.bodyType);

  // Determine which face features are explicitly set (non-empty, non-Auto, non-Any)
  const isExplicit = (val?: string) => val && val !== '' && val !== 'Auto' && val !== 'Any';

  const explicitFeatures: string[] = [];
  const unsetFeatures: string[] = [];

  if (isExplicit(prefs.faceShape)) explicitFeatures.push(`Face Shape: ${prefs.faceShape}`);
  else unsetFeatures.push('Face Shape');

  if (isExplicit(prefs.jawline)) explicitFeatures.push(`Jawline: ${prefs.jawline}`);
  else unsetFeatures.push('Jawline');

  if (isExplicit(prefs.cheekbones)) explicitFeatures.push(`Cheekbones: ${prefs.cheekbones}`);
  else unsetFeatures.push('Cheekbones');

  if (isExplicit(prefs.cheeks)) explicitFeatures.push(`Cheek Shape: ${prefs.cheeks}`);
  else unsetFeatures.push('Cheek Shape');

  if (isExplicit(prefs.eyeShape)) explicitFeatures.push(`Eye Shape: ${prefs.eyeShape}`);
  else unsetFeatures.push('Eye Shape');

  if (isExplicit(prefs.noseShape)) explicitFeatures.push(`Nose Shape: ${prefs.noseShape}`);
  else unsetFeatures.push('Nose Shape');

  if (isExplicit(prefs.lipShape)) explicitFeatures.push(`Lip Shape: ${prefs.lipShape}`);
  else unsetFeatures.push('Lip Shape');

  if (prefs.eyebrowStyle && prefs.eyebrowStyle !== 'Auto') {
    let style = prefs.eyebrowStyle;
    if (style === 'Brushed Up') style = "Natural fluffy brushed up texture, individual hairs visible, not laminated";
    if (style === 'Bleached') style = "Bleached blonde (invisible), high fashion editorial look";
    explicitFeatures.push(`Eyebrows: ${style}`);
  } else {
    unsetFeatures.push('Eyebrows');
  }

  if (isMale && (prefs.facialHairOverride || prefs.facialHair)) {
    explicitFeatures.push(`Facial Hair: ${prefs.facialHairOverride || prefs.facialHair}`);
  }
  if (prefs.features) explicitFeatures.push(`Additional Traits: ${prefs.features}`);

  // Eye color, hair color, and skin tone are P1 when explicitly chosen
  if (isExplicit(prefs.skinTone)) explicitFeatures.push(`Skin Tone: ${prefs.skinTone} — this is a DELIBERATE casting choice. The model's skin must match this tone regardless of ethnicity. Do NOT default to the darkest or lightest shade for this heritage.`);
  if (prefs.skinTextureOverride) {
    explicitFeatures.push(`Skin Texture Detail: ${prefs.skinTextureOverride} — this is a DELIBERATE casting choice; render it precisely as described.`);
  }
  if (prefs.eyeColorOverride) {
    explicitFeatures.push(`Eye Color: ${prefs.eyeColorOverride} — this is a DELIBERATE casting choice, NOT a default. Do NOT substitute a different eye color.`);
  } else if (isExplicit(prefs.eyeColor)) {
    const irisDetail = irisDescriptions[prefs.eyeColor!] || prefs.eyeColor;
    explicitFeatures.push(`Eye Color: ${prefs.eyeColor} (${irisDetail}) — this is a DELIBERATE casting choice, NOT a default. Do NOT substitute a different eye color.`);
  }
  if (isExplicit(prefs.hairColor) && prefs.hairColor !== 'Natural') explicitFeatures.push(`Hair Color: ${prefs.hairColor} — this is a DELIBERATE casting choice. Do NOT substitute a different hair color.`);

  const explicitBlock = explicitFeatures.length > 0
    ? `USER EXPLICIT FEATURES (PRIORITY 1 — ABSOLUTE, DO NOT OVERRIDE):
    ${explicitFeatures.join('\n    ')}`
    : '';

  const unsetBlock = unsetFeatures.length > 0
    ? `UNSET FEATURES (derive from brand archetype + ethnicity heritage):
    ${unsetFeatures.join(', ')}`
    : '';

  return `
    Create a CASTING SPECIFICATION (JSON) based on these requirements:

    ── IDENTITY ──
    - Gender: ${prefs.gender || "ENGINE'S CHOICE — cast whoever best serves the brand direction"}
    - Age: ${prefs.age || "ENGINE'S CHOICE — pick an age that suits the brand direction and vibe"}
    - Body Type: ${prefs.bodyType || "Model Standard"}
    ${btHint}

    ── ETHNICITY HERITAGE ──
    ${ethnicityDescription}
    Use this heritage to inform bone structure and facial geometry for any UNSET features below.

    ── HAIR ──
    - Style: ${prefs.hairStyleOverride || prefs.hairStyle || "Natural"}
    - Color: ${prefs.hairColorOverride || prefs.hairColor || "Natural"}
    - Details: ${hairDetails || "Auto — choose styling that suits the brand and face shape"}
    
    STYLING DIRECTIVE:
    Sub-selectors (length, texture, bangs, etc.) are preferences — adapt freely to
    create a cohesive, physically plausible look. If a detail is missing, choose what 
    looks best for this person's face shape, ethnicity, and brand direction.

    ── FACIAL FEATURES ──
    ${explicitBlock}

    ${unsetBlock}

    ── BRAND & VIBE (shapes physical casting type and intensity) ──
    ${qualityBaseline}

    ── SKIN ──
    ${skinInstruction}
    `;
}

function buildIteratePromptContent(prefs: ModelPreferences): string {
  const hasRef = !!prefs.referenceImage;
  return `
  Update the CASTING SPECIFICATION based on the user's iteration request.

  ORIGINAL DESCRIPTION:
  ${prefs.previousMasterPrompt}

  USER REQUEST:
  ${prefs.userPrompt}

  ${hasRef ? "CONTEXT: A PHYSICAL ATTRIBUTE REFERENCE IMAGE IS ATTACHED." : ""}

  RULES:
  1. Preserve all identity attributes from the original description unless the user explicitly asks to change them.
  2. Only modify the specific elements requested.

  3. ${hasRef
    ? `VISUAL ANALYSIS REQUIRED: The user has attached an image as a guide. EXTRACT only the requested physical attribute.`
    : `If the user asks for a visual change, describe it based on their text.`}

  4. BIOLOGICAL REALISM: Handle eye color changes as pigment shifts, not lens swaps. Describe the new color as NATURAL.

  5. GEOMETRIC LOCKING: If adding tattoos, scars, birthmarks, or moles, you MUST define their EXACT location relative to bone structure (e.g., "left temple, 2cm from hairline"). Do not use vague terms like "on face".

  6. Output the full updated JSON with minimal changes.
  `;
}

// ============================================================================
// ENHANCE USER PROMPT
// ============================================================================

/**
 * Enhance user prompt for iteration — clarifies intent without adding style
 */
export const enhanceUserPrompt = async (originalPrompt: string): Promise<string> => {
  if (!originalPrompt.trim()) return "";
  return withTextQueue(async () => {
  const ai = getAiClient();

  const prompt = `
  You are an expert AI Prompt Engineer.
  Your task is to REWRITE the user's raw input into a clear, direct instruction for an image editing AI.
  
  CRITICAL RULE: The image generator already has a master style prompt. DO NOT add stylistic directives.
  GOAL: Clarify the INTENT (Action + Target + Constraints).
  
  USER INPUT: "${originalPrompt}"
  REFINED OUTPUT:
  `;

  const MODELS = [...TEXT_LIGHT_FALLBACK];

  for (let i = 0; i < MODELS.length; i++) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: MODELS[i],
          contents: { parts: [{ text: prompt }] },
          config: {
            maxOutputTokens: 1024,
            safetySettings: SAFETY_SETTINGS,
          }
        }),
        15000,
        `EnhancePrompt (${MODELS[i]})`
      );
      const result = safeResponseText(response).trim();
      if (result) return result;
      throw new Error("Empty response");
    } catch (e: any) {
      log.warn({ err: e?.message }, `[EnhancePrompt] ${MODELS[i]} failed:`);
      if (i === MODELS.length - 1) return originalPrompt;
    }
  }
  return originalPrompt;
  }, 'enhanceUserPrompt');
};

// ============================================================================
// GENERATE CASTING IMAGE
// ============================================================================

/**
 * Generate casting image (headshot or iteration).
 * 3-path architecture:
 *   PATH 1: Chat iteration (session exists) — reuses conversation for identity
 *   PATH 2: Chat NEW (create session) — starts new conversation
 *   PATH 3: Stateless fallback — single-shot generation
 */
export const generateCastingImage = async (
  masterPrompt: string,
  referenceImageBase64: string | undefined,
  resolution: ImageResolution,
  aspectRatio: AspectRatio = AspectRatio.PORTRAIT,
  mode: GenerationMode,
  iterationRequest?: string,
  additionalReferenceBase64?: string,
  castingBrand: string = 'Generic',
  frame: 'HEADSHOT' | 'FULL_BODY' = 'HEADSHOT',
  castingVibe?: { editorial: number; commercial: number; runway: number },
  maskImageBase64?: string,
  ethnicityHint?: string,
  userId: string = 'anonymous',
  // V14: canonical angle of the view being iterated — selects the per-angle
  // orientation-preservation directive; absent on non-view paths (creation),
  // which keep the legacy binary frame directive unchanged.
  viewAngle?: CanonicalViewAngle,
  // Batch C (§8.4): server-owned authorization directives from the field
  // handlers — the ONLY channel that may unlock an identity attribute in the
  // iterate/transfer prompt. Never the raw user sentence.
  policyDirectives?: string[]
): Promise<{ imageUrl: string; engineUsed: string }> => {
  return withImageQueue(async () => {
  const ai = getAiClient();
  let textPrompt = "";

  const contextForConfig = masterPrompt + (iterationRequest || "");
  const dynamicStudioSettings = getStudioSettings(contextForConfig);

  // Brand-aware expression direction
  const brandExpression = getBrandExpression(castingBrand);

  // Technical constraints — universal
  let technicalConstraints = `PHOTOREALISTIC ONLY. Real photograph from a real full-frame DSLR sensor with physical noise.
NO open mouth, NO showing teeth, NO laughing, NO grinning, NO excessive smiling.
NO: PERFECT SYMMETRY, CGI, CARTOON, ANIME, 3D RENDER, PLASTIC SKIN, DOLL LOOK`;
  // Three-state (Batch C, §13.10): only a MARK-FREE document takes the
  // tattoos/ink/piercings NO-list. A non-ink-marked document (freckles,
  // scars, piercings) must not receive the piercings prohibition that would
  // erase its own marks; an inked document keeps the persistence rule from
  // getStudioSettings.
  if (markPromptStateFor(contextForConfig) === "markFree") {
    technicalConstraints += ", TATTOOS, INK, BODY ART, PIERCINGS";
  }
  technicalConstraints += ".";

  // Standardized casting setup — same for every brand
  const prefix = `HIGH FASHION CASTING HEADSHOT. Face directly front-on, symmetrical in frame. Eyes looking straight into the camera lens. Light grey seamless background fills the entire frame — no black borders, no vignettes. BARE SHOULDERS. `;

  const parts: GeminiPart[] = [];
  let imageIndexCounter = 1;
  let inputMapDescription = "INPUT VISUALS:\n";

  if (referenceImageBase64) {
    const mimeType = extractMimeType(referenceImageBase64);
    const base64Data = extractBase64Data(referenceImageBase64);
    parts.push({ inlineData: { data: base64Data, mimeType } });
    inputMapDescription += `- IMAGE ${imageIndexCounter++}: TARGET SOURCE (The base image to edit. Identity and Lighting source).\n`;
  }

  if (maskImageBase64 && mode === GenerationMode.ITERATE) {
    const base64Data = extractBase64Data(maskImageBase64);
    parts.push({ inlineData: { data: base64Data, mimeType: 'image/png' } });
    inputMapDescription += `- IMAGE ${imageIndexCounter++}: GUIDE OVERLAY (Red highlighted region marks target area).\n`;
  }

  if (additionalReferenceBase64 && mode === GenerationMode.ITERATE) {
    const mimeType = extractMimeType(additionalReferenceBase64);
    const base64Data = extractBase64Data(additionalReferenceBase64);
    parts.push({ inlineData: { data: base64Data, mimeType } });
    inputMapDescription += `- IMAGE ${imageIndexCounter++}: ATTRIBUTE REFERENCE (Use the visual content/design from this image).\n`;
  }

  if (mode === GenerationMode.ITERATE && iterationRequest) {
    textPrompt = buildIterationImagePrompt(
      iterationRequest, masterPrompt, frame, dynamicStudioSettings,
      inputMapDescription, maskImageBase64, additionalReferenceBase64, imageIndexCounter,
      viewAngle, policyDirectives
    );
  } else {
    // Ethnicity phenotype lock — placed FIRST so image model can't override
    const ethLock = ethnicityHint
      ? `ETHNICITY PHENOTYPE LOCK — NON-NEGOTIABLE:
This subject is ${ethnicityHint}.

FACE STRUCTURE must visibly reflect this heritage in: eye shape and fold, 
nose bridge width, nose shape, cheekbone placement, jawline, and lip fullness.
These features are determined by BONE and GENETICS — they do NOT change 
regardless of hair color, skin tone, or styling choices.

For MIXED heritage: BOTH backgrounds must be SIMULTANEOUSLY VISIBLE in the face. 
A viewer should be able to identify BOTH heritages on sight. If one heritage is 
East Asian, Southeast Asian, or South Asian: the eyes MUST show ethnic markers 
(lid structure, inner fold, eye axis). If one heritage is African: nose bridge 
width and lip fullness MUST reflect it.

Hair color and style are INDEPENDENT of ethnicity — the user may choose any color. 
A platinum blonde East Asian person still has East Asian bone structure and eyes.
DO NOT let hair or skin choices erase the facial structure of the stated heritage.\n`
      : '';

    textPrompt = `
      ${prefix}
      ${ethLock}
      STRICT VISUAL ENFORCEMENT:
      1. WARDROBE: STRICTLY BARE SKIN ONLY. NO CLOTHING, NO STRAPS, NO UNDERWEAR VISIBLE IN FRAME. BARE SHOULDERS.
      2. ${brandExpression}
      3. ${technicalConstraints}
      4. OUTPUT MUST BE PORTRAIT 3:4 ASPECT RATIO. Taller than wide. Do NOT output landscape or square.
      ${dynamicStudioSettings}
      CASTING SPEC: ${masterPrompt}
    `;
  }

  parts.push({ text: textPrompt });

  // ── Shared response handler ──
  const extractImage = (response: any): string => {
    const diagnosis = diagnoseResponse(response);
    if (diagnosis) throw new Error(diagnosis);
    const imageUrl = extractImageFromResponse(response);
    if (!imageUrl) {
      const text = safeResponseText(response);
      if (text) throw new Error(`Refusal: ${text.slice(0, 80)}...`);
      throw new Error("No image data in response.");
    }
    // Detect blank/gray placeholder images from silent safety refusals
    validateNotPlaceholder(imageUrl);
    return imageUrl;
  };

  // ── PATH 1: Chat-based iteration (session exists) ──
  const userSession = sessionMap.get(userId);
  if (mode === GenerationMode.ITERATE && userSession) {
    try {
      log.info(`[CastingSession] Sending iteration through chat for user ${userId}`);
      const response = await withTimeout(
        userSession.chat.sendMessage({ message: parts }),
        60000,
        'CastingChat'
      );
      const imageUrl = extractImage(response);
      userSession.lastUsed = Date.now();
      return { imageUrl, engineUsed: userSession.model + ' (chat)' };
    } catch (e: any) {
      log.warn({ err: e?.message }, `[CastingSession] Chat iteration failed for user ${userId}, falling back to stateless:`);
      sessionMap.delete(userId);
      // Fall through to stateless
    }
  }

  // ── PATH 2: Chat-based NEW generation (create session) ──
  if (mode === GenerationMode.NEW) {
    sessionMap.delete(userId);
    const PRIMARY_MODEL = IMAGE_PRO;
    try {
      const chat = ai.chats.create({
        model: PRIMARY_MODEL,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio },
          safetySettings: SAFETY_SETTINGS,
        }
      });
      const response = await withTimeout(
        chat.sendMessage({ message: parts }),
        60000,
        `CastingChat NEW (${PRIMARY_MODEL})`
      );
      const imageUrl = extractImage(response);
      sessionMap.set(userId, { chat, model: PRIMARY_MODEL, lastUsed: Date.now() });
      log.info(`[CastingSession] Session created for user ${userId} — iterations will use chat`);
      return { imageUrl, engineUsed: PRIMARY_MODEL };
    } catch (e: any) {
      log.warn({ err: e?.message }, `[CastingSession] Chat creation failed for user ${userId}, falling back to stateless:`);
      sessionMap.delete(userId);
      // Fall through to stateless
    }
  }

  // ── PATH 3: Stateless fallback ──
  const executeGen = async (modelName: string) => {
    const config: any = {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio },
      safetySettings: SAFETY_SETTINGS,
    };

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config
    });

    return extractImage(response);
  };

  const IMAGE_MODELS = [...IMAGE_FALLBACK];

  for (let i = 0; i < IMAGE_MODELS.length; i++) {
    const model = IMAGE_MODELS[i];
    try {
      const url = await withSingleRetry503(
        () => withTimeout(executeGen(model), 60000, `CastingImage (${model})`),
        `CastingImage (${model})`
      );
      return { imageUrl: url, engineUsed: model };
    } catch (e: any) {
      // Complete internal error server-side; only sanitized wording travels
      log.warn({ err: e }, `[CastingImage] ${model} failed:`);
      if (i === IMAGE_MODELS.length - 1) {
        throw new PublicError(formatGeminiError(e), { cause: e });
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  throw new Error('All image models failed');
  }, `generateCastingImage(${mode})`);
};

// ============================================================================
// ITERATION IMAGE PROMPT BUILDER (private helper)
// ============================================================================

function buildIterationImagePrompt(
  iterationRequest: string,
  masterPrompt: string,
  frame: 'HEADSHOT' | 'FULL_BODY',
  dynamicStudioSettings: string,
  inputMapDescription: string,
  maskImageBase64?: string,
  additionalReferenceBase64?: string,
  imageIndexCounter: number = 1,
  viewAngle?: CanonicalViewAngle,
  policyDirectives?: string[]
): string {
  // V14 (Batch A-coupled): when the caller names the canonical view being
  // edited, the directive preserves THAT view's orientation — the legacy
  // binary told every close view "STRAIGHT-ON", which would rotate a
  // sideClose/threeQuarter edit toward the camera. The binary fallback
  // remains only for non-view callers (no canonical angle to preserve).
  const frameDirective = viewAngle
    ? ITERATION_FRAME_DIRECTIVES[viewAngle]
    : frame === 'FULL_BODY'
      ? "FULL BODY FASHION SHOT. HEAD TO TOE VISIBLE."
      : "STRAIGHT-ON HEADSHOT. CLOSE UP FACIAL PORTRAIT. MAINTAIN EXACT CAMERA DISTANCE.";

  const framingLock = frame === 'HEADSHOT'
    ? `
    CRITICAL GEOMETRY ENFORCEMENT:
    1. DO NOT ZOOM OUT. DO NOT REFRAME. The head size and position must remain IDENTICAL to the Source Image.
    2. CROP RULE: If the user adds a feature on the body (e.g. "chest tattoo", "necklace", "cleavage") that is below the bottom edge of the current frame, RENDER ONLY THE TOP SLIVER that is visible. CUT THE REST OFF.
    3. NEVER change the aspect ratio or field of view to fit a requested item.
    4. OUTPUT must be PORTRAIT 3:4. IGNORE the reference image dimensions — the reference is for attribute extraction only, not framing.
    `
    : "";

  let surgicalInstructions = "";
  const req = iterationRequest.toLowerCase();
  const isSkinFeature = req.includes('scar') || req.includes('mark') || req.includes('mole') ||
    req.includes('spot') || req.includes('freckle') || req.includes('acne') ||
    req.includes('blemish') || req.includes('pimple') || req.includes('pore') ||
    req.includes('texture');

  if (maskImageBase64) {
    if (additionalReferenceBase64) {
      surgicalInstructions = `
        Use the guide image with the red highlighted region as the target area.
        TASK: Apply the visual content from the Attribute Reference Image into the red-marked area as a HEALED TATTOO.
        
        CRITICAL INK REALISM PROTOCOL (ANTI-STICKER):
        1. PHYSICS: Ink must sit *in* the dermis, not on top. Reduce black density to ~85% to match healed pigment.
        2. TEXTURE: Skin pores, vellus hair, and skin grain MUST be visible ON TOP of the ink.
        3. EDGES: Simulate ink diffusion/bleeding. No sharp vector edges.
        4. NEEDLEWORK: Simulate fine-line needle texture and slight unevenness.
        5. LIGHTING: Specular highlights from the studio flash must reflect off the SKIN above the tattoo.
        
        STRICT VISUAL STANDARDS: ${dynamicStudioSettings}
      `;
    } else {
      let skinProtocol = "";
      if (isSkinFeature) {
        skinProtocol = `
          CRITICAL SKIN FEATURE PROTOCOL (SCARS/BIRTHMARKS/SPOTS):
          1. BIOLOGY: Features must originate from the dermis. No "painted on" look.
          2. TEXTURE: Skin texture (pores) must continue OVER the feature, but may be disrupted (e.g. scar tissue smoothness).
          3. EDGES: Natural, organic edges. No sharp vector cutouts.
          4. LIGHTING: Specular highlights must interact with the feature's texture (e.g. scar tissue is often shinier).
          5. LIMITS: CONFINE STRICTLY to the requested area/mask. Do not hallucinate similar features elsewhere.
        `;
      }

      surgicalInstructions = `
        Use the guide image with the red highlighted region as the target area.
        TASK: SEMANTIC INPAINTING. Modify the content inside the red masked area based strictly on the USER INSTRUCTION.
        STRICT VISUAL STANDARDS: ${dynamicStudioSettings}
        MODES: REMOVAL or MODIFICATION.
        ${skinProtocol}
      `;
    }
  }

  let featureInstructions = "";
  if (additionalReferenceBase64 && !maskImageBase64) {
    featureInstructions = `
    ATTRIBUTE TRANSFER — Image ${imageIndexCounter - 1} is a REFERENCE:

    TRANSFER FIDELITY (HIGHEST PRIORITY FOR THE REQUESTED ATTRIBUTE):
    Study the reference image carefully. Whatever attribute(s) the user requests —
    reproduce them with MAXIMUM PRECISION from the reference. Do not approximate,
    simplify, or generalize. The reference image IS the specification.
    If transferring hairstyle, match the EXACT cut, layering, length, parting,
    bang style, and texture visible in the reference. If transferring eye shape,
    match the exact lid structure and crease. Be precise — vague approximations
    are a failure.

    PARTIAL TRANSFER: If the user specifies a SUBSET of an attribute (e.g.,
    "bangs only", "just the color", "brow arch but keep thickness"), transfer
    ONLY that subset and preserve the rest from Image 1.

    IDENTITY LOCK (NON-NEGOTIABLE):
    Image 1 IS the model. Their face, bone structure, skin tone, skin texture,
    freckles, moles, eye color, and every physical feature are SACRED. The output
    MUST look like the SAME PERSON as Image 1. If the output face doesn't match
    Image 1, the generation has FAILED.

    The reference contains a COMPLETELY DIFFERENT PERSON whose identity must NOT
    bleed into the output. Transfer ONLY the attribute(s) explicitly named in
    the USER INSTRUCTION — nothing else crosses over.

    If there is ANY conflict between the requested change and preserving identity,
    IDENTITY WINS. Always.

    ALLOWED TRANSFERS (only when explicitly requested by user):
    - HAIR STYLE: Transfer cut, shape, texture, length, layers, bangs, parting,
      movement with HIGH FIDELITY. KEEP hair COLOR from Image 1 unless user
      explicitly says "hair color" or "colour". "Hairstyle" means shape, not color.
    - HAIR COLOR: Transfer color/tone only. Keep existing style.
    - EYE SHAPE: Transfer lid structure, crease depth, eye axis. KEEP iris color.
      "Eye shape" means the shape of the eye, NOT the iris color.
    - NOSE SHAPE: Transfer bridge width, tip shape, nostril shape. KEEP skin tone.
    - BROW SHAPE: Transfer arch, thickness, grooming style. KEEP brow color
      unless user explicitly says "brow color".
      "Eyebrows" means brow shape and thickness, NOT brow color.
    - BROW COLOR: Transfer pigment only. Keep shape.
    - LIP SHAPE: Transfer fullness, cupid's bow, width. KEEP lip pigment color.
    - SKIN FINISH: Transfer dewy/matte/raw finish. KEEP skin tone and texture.
    - EXPRESSION: Transfer facial expression (mouth position, eye intensity,
      brow tension, mood). KEEP all facial structure and physical features.
      Expression is FACIAL MUSCLES ONLY — do NOT transfer head angle or pose.

    BLOCKED — NEVER TRANSFER (handled by other studios):
    - Makeup (eye shadow, liner, lip color, blush, contour, foundation)
    - Jewelry, accessories, piercings, earrings
    - Pose, body position, head angle, gaze direction
    - Clothing, styling, props
    - Lighting, mood, color grade, background

    REJECT from reference — these NEVER transfer regardless of instruction:
    - Face shape, bone structure, jawline, cheekbones, chin
    - Skin tone, skin texture, freckles, moles, scars
    - Eye iris color (unless "eye color" explicitly requested)
    - Any attribute NOT explicitly named in the USER INSTRUCTION
    `;
  }

  // Batch C (§8.4): a server AUTHORIZATION may unlock exactly the authorized
  // identity leaf. These directives come from the field handlers behind the
  // shared guard — no other channel (including the user sentence and any
  // reference analysis) may override the default identity lock, and where a
  // directive conflicts with the REJECT/BLOCKED lists above, the directive
  // wins ONLY for the single attribute it names.
  const authorizationBlock =
    policyDirectives && policyDirectives.length > 0
      ? `
    SERVER AUTHORIZATION (highest priority for the named attribute ONLY — overrides any REJECT/BLOCKED entry for that one attribute, nothing else):
    ${policyDirectives.join("\n    ")}
    `
      : "";

  return `
    STRICT PHOTOREALISTIC INPAINTING TASK.
    ${inputMapDescription}

    USER INSTRUCTION: "${iterationRequest}"
    ${authorizationBlock}
    VISUAL RULES:
    ${frameDirective}
    ${framingLock}

    ${surgicalInstructions}
    ${featureInstructions}

    CRITICAL GLOBAL CONSTRAINTS: FREEZE lighting/identity/camera. MODIFY ONLY what is requested within the EXISTING BOUNDARIES.

    IDENTITY ANCHOR — The output MUST depict this exact person:
    ${buildIdentityAnchor(masterPrompt, undefined)}
  `;
}
