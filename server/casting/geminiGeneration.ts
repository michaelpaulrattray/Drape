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

import type { ModelPreferences, GeminiPart } from "./geminiTypes";
import { ImageResolution, AspectRatio, GenerationMode } from "./geminiTypes";
import {
  getAiClient,
  SAFETY_SETTINGS,
  extractMimeType,
  extractBase64Data,
  formatGeminiError,
  diagnoseResponse,
  extractImageFromResponse,
  safeResponseText,
  withTimeout,
  withSingleRetry503,
  buildIdentityAnchor,
} from "./geminiClient";
import { withImageQueue, withTextQueue } from "./geminiQueue";
import {
  MASTER_PROMPT_SYSTEM_INSTRUCTION,
  getSkinDescription,
  getBrandExpression,
  BRAND_PROFILES,
  DEFAULT_BRAND_DESCRIPTOR,
  irisDescriptions,
  getStudioSettings,
  hasBodyArt,
} from "./geminiPrompts";

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
      console.log(`[CastingSession] Evicted stale session for user ${uid}`);
    }
  }

  // Hard cap: if still over limit, evict oldest by lastUsed
  if (sessionMap.size > MAX_SESSIONS) {
    const sorted = Array.from(sessionMap.entries())
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    const toEvict = sorted.slice(0, sessionMap.size - MAX_SESSIONS);
    for (const [uid] of toEvict) {
      sessionMap.delete(uid);
      console.log(`[CastingSession] Evicted oldest session for user ${uid} (cap: ${MAX_SESSIONS})`);
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
  console.log(`[CastingSession] Cleared for user ${userId}`);
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
  console.log('[geminiGeneration] generateMasterPrompt called:', {
    brand: prefs.castingBrand,
    gender: prefs.gender,
    ethnicity: prefs.ethnicity,
    mode,
  });

  const ai = getAiClient();
  const skinInstruction = getSkinDescription(prefs.skinTexture, prefs.skinFinish);
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

  const MODELS = ['gemini-3-pro-preview', 'gemini-3-flash-preview'];

  for (let i = 0; i < MODELS.length; i++) {
    try {
      const response = await withTimeout(
        generateText(MODELS[i]),
        30000,
        `MasterPrompt (${MODELS[i]})`
      );
      return parseResponse(response);
    } catch (e: any) {
      console.warn(`[MasterPrompt] ${MODELS[i]} failed:`, e?.message);
      if (i === MODELS.length - 1) {
        throw new Error(formatGeminiError(e));
      }
    }
  }

  throw new Error('Master prompt generation failed across all models.');
  }, 'generateMasterPrompt');
};

// ============================================================================
// PROMPT CONTENT BUILDERS (private helpers)
// ============================================================================

function buildNewPromptContent(prefs: ModelPreferences, skinInstruction: string): string {
  const isMale = prefs.gender?.toLowerCase().includes('male');

  // Brand descriptor from unified BRAND_PROFILES
  const brandProfile = BRAND_PROFILES[prefs.castingBrand || 'Gucci'];
  const brandDescriptor = brandProfile?.descriptor || DEFAULT_BRAND_DESCRIPTOR;

  // Vibe blend description
  let vibeBlendDescription = "";
  if (prefs.castingVibe) {
    const { editorial, commercial, runway } = prefs.castingVibe;
    const eP = Math.round(editorial * 100);
    const cP = Math.round(commercial * 100);
    const rP = Math.round(runway * 100);

    // Determine dominant vibe for intensity guidance
    const dominant = editorial >= commercial && editorial >= runway ? 'editorial'
      : commercial >= runway ? 'commercial' : 'runway';

    vibeBlendDescription = `
      AESTHETIC MIX:
      - ${eP}% EDITORIAL (Avant-garde, sharp, strange, severe, expensive, architectural).
      - ${cP}% COMMERCIAL (Approachable, warm, soft, relatable, healthy, smiling eyes).
      - ${rP}% RUNWAY (Fierce, imposing, powerful, confident, statuesque, classic supermodel).
      
      INSTRUCTION: Blend these traits proportionally.
      ${dominant === 'editorial' && editorial > 0.5 ? "Push features toward striking and unconventional." : ""}
      ${dominant === 'commercial' && commercial > 0.5 ? "Keep features attractive and approachable." : ""}
      ${dominant === 'runway' && runway > 0.5 ? "Make features dramatic and commanding." : ""}
    `;
  } else {
    vibeBlendDescription = "AESTHETIC MIX: 100% High Fashion Editorial. Severe and architectural.";
  }

  // Eye color with iris description
  let eyeColorInstruction = prefs.eyeColor || "Any";
  if (prefs.eyeColor && irisDescriptions[prefs.eyeColor]) {
    eyeColorInstruction = `${prefs.eyeColor} — ${irisDescriptions[prefs.eyeColor]}`;
  }

  // Ethnicity blend formatting
  let ethnicityInstruction = prefs.ethnicity || "Any";
  if (prefs.ethnicityBlend && prefs.ethnicityBlend.length > 0) {
    ethnicityInstruction = prefs.ethnicityBlend
      .map(e => `${e.pct}% ${e.name}`)
      .join(' / ');
  }

  // Feature list
  const featureList = [];
  if (prefs.jawline) featureList.push(`Jawline: ${prefs.jawline}`);
  if (prefs.cheekbones) featureList.push(`Cheekbones: ${prefs.cheekbones}`);
  if (prefs.cheeks) featureList.push(`Cheek Shape: ${prefs.cheeks}`);
  if (prefs.eyeShape) featureList.push(`Eye Shape: ${prefs.eyeShape}`);
  if (prefs.noseShape) featureList.push(`Nose Shape: ${prefs.noseShape}`);
  if (prefs.lipShape) featureList.push(`Lip Shape: ${prefs.lipShape}`);

  if (prefs.eyebrowStyle && prefs.eyebrowStyle !== 'Random') {
    let style = prefs.eyebrowStyle;
    if (style === 'Brushed Up') style = "Natural fluffy brushed up texture, individual hairs visible, not laminated";
    if (style === 'Bleached') style = "Bleached blonde (invisible), high fashion editorial look";
    featureList.push(`Eyebrows: ${style}`);
  }

  if (isMale && prefs.facialHair) featureList.push(`Facial Hair: ${prefs.facialHair}`);
  if (prefs.features) featureList.push(`Additional Traits: ${prefs.features}`);

  const featuresInstruction = featureList.length > 0
    ? `MANDATORY FACIAL FEATURES (P1 — user set these explicitly): ${featureList.join(', ')}.`
    : "Facial Features: Generate coherent, DISTINCTIVE features matching the Brand/Tone vibe. Be bold — at least 2-3 features should be pushed beyond average.";

  // Hair details
  const hairDetails = [
    prefs.hairLength ? `Length: ${prefs.hairLength}` : "",
    prefs.hairTexture ? `Texture: ${prefs.hairTexture}` : "",
    prefs.hairFringe ? `Fringe/Bangs: ${prefs.hairFringe}` : "",
    prefs.hairParting ? `Parting: ${prefs.hairParting}` : "",
    prefs.hairVolume ? `Volume/Shape: ${prefs.hairVolume}` : "",
    prefs.hairFlyaways ? `Flyaways: ${prefs.hairFlyaways}` : "",
    prefs.hairHairline ? `Hairline: ${prefs.hairHairline}` : "",
    prefs.hairTuck ? `Tuck: ${prefs.hairTuck}` : "",
    prefs.hairFade ? `Fade/Taper: ${prefs.hairFade}` : ""
  ].filter(Boolean).join(". ");

  return `
  Create a CASTING SPECIFICATION (JSON) based on these requirements:
  - Gender: ${prefs.gender || "Female"}
  - Age: ${prefs.age || "23"}
  - Ethnicity: ${ethnicityInstruction}
  - Body Type: ${prefs.bodyType || "Model Standard"}
  - Face Shape: ${prefs.faceShape && prefs.faceShape !== 'Random' ? prefs.faceShape : "Any — pick something distinctive"}
  - Skin tone: ${prefs.skinTone || "Standard"}
  - Eye color: ${eyeColorInstruction}
  
  HAIR SPECIFICATION (STRICT):
  - Base Style: ${prefs.hairStyle || "Natural"}
  - Color: ${prefs.hairColor || "Natural"}
  - Detailed Styling: ${hairDetails}
  
  BRAND DIRECTION (P2 — guides creative choices for unset features):
  ${brandDescriptor}
  
  VIBE INTENSITY (P3 — controls how extreme features are):
  ${vibeBlendDescription}
  
  STYLING DIRECTIVE:
  Interpret the Hair Specification strictly through the lens of a HIGH-END SALON CASTING.
  - REALISM: Hair must look physically plausible.
  - BRAND ALIGNMENT: Match hairstyle to the requested brand archetype.

  ${featuresInstruction}

  CRITICAL SKIN DIRECTIVE: ${skinInstruction}
  
  Wardrobe: BARE SKIN ONLY. NO CLOTHING OR STRAPS VISIBLE.
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

  const MODELS = ['gemini-3-flash-preview', 'gemini-2.5-flash'];

  for (let i = 0; i < MODELS.length; i++) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: MODELS[i],
          contents: { parts: [{ text: prompt }] },
          config: {
            maxOutputTokens: 1024,
            temperature: 0.2,
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
      console.warn(`[EnhancePrompt] ${MODELS[i]} failed:`, e?.message);
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
  userId: string = 'anonymous'
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
  if (!hasBodyArt(contextForConfig)) {
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
      inputMapDescription, maskImageBase64, additionalReferenceBase64, imageIndexCounter
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
A viewer should be able to identify BOTH heritages on sight.

Hair color and style are INDEPENDENT of ethnicity — the user may choose any color.
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
    return imageUrl;
  };

  // ── PATH 1: Chat-based iteration (session exists) ──
  const userSession = sessionMap.get(userId);
  if (mode === GenerationMode.ITERATE && userSession) {
    try {
      console.log(`[CastingSession] Sending iteration through chat for user ${userId}`);
      const response = await withTimeout(
        userSession.chat.sendMessage({ message: parts }),
        60000,
        'CastingChat'
      );
      const imageUrl = extractImage(response);
      userSession.lastUsed = Date.now();
      return { imageUrl, engineUsed: userSession.model + ' (chat)' };
    } catch (e: any) {
      console.warn(`[CastingSession] Chat iteration failed for user ${userId}, falling back to stateless:`, e?.message);
      sessionMap.delete(userId);
      // Fall through to stateless
    }
  }

  // ── PATH 2: Chat-based NEW generation (create session) ──
  if (mode === GenerationMode.NEW) {
    sessionMap.delete(userId);
    const PRIMARY_MODEL = 'gemini-3-pro-image-preview';
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
      console.log(`[CastingSession] Session created for user ${userId} — iterations will use chat`);
      return { imageUrl, engineUsed: PRIMARY_MODEL };
    } catch (e: any) {
      console.warn(`[CastingSession] Chat creation failed for user ${userId}, falling back to stateless:`, e?.message);
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

  const IMAGE_MODELS = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];

  for (let i = 0; i < IMAGE_MODELS.length; i++) {
    const model = IMAGE_MODELS[i];
    try {
      const url = await withSingleRetry503(
        () => withTimeout(executeGen(model), 60000, `CastingImage (${model})`),
        `CastingImage (${model})`
      );
      return { imageUrl: url, engineUsed: model };
    } catch (e: any) {
      console.warn(`[CastingImage] ${model} failed:`, e?.message);
      if (i === IMAGE_MODELS.length - 1) {
        throw new Error(formatGeminiError(e));
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
  imageIndexCounter: number = 1
): string {
  const frameDirective = frame === 'FULL_BODY'
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

    IDENTITY LOCK (NON-NEGOTIABLE):
    Image 1 IS the model. Their face, bone structure, skin tone, skin texture,
    freckles, moles, eye color, and every physical feature are SACRED. The output
    MUST look like the SAME PERSON as Image 1. If the output face doesn't match
    Image 1, the generation has FAILED.

    The reference image is a MAGAZINE CLIPPING. You are extracting ONE attribute
    from it — nothing else transfers. The reference contains a COMPLETELY DIFFERENT
    PERSON whose identity must NOT bleed into the output.

    If there is ANY conflict between the requested change and preserving identity,
    IDENTITY WINS. Always.

    REJECT from reference — these NEVER transfer:
    - Face shape, bone structure, jawline, cheekbones, chin
    - Eye shape, eye color, eye spacing, brow bone
    - Nose shape, nose bridge, nostril shape
    - Lip shape, lip color, lip fullness
    - Skin tone, skin texture, freckles, moles, scars
    - Lighting, mood, color grade, background, clothing
    - Any attribute NOT explicitly named in the USER INSTRUCTION

    TRANSFER RULES BY ATTRIBUTE TYPE:
    HAIR STYLE: Transfer the cut, shape, texture, and movement ONLY.
      KEEP the subject's existing hair COLOR from Image 1 unless the user
      explicitly says "hair color" or "colour". "Hairstyle" means shape, not color.
    HAIR COLOR: Transfer the color/tone only. Keep the existing style.
    FACIAL FEATURE (lips, nose, brows, eyes, etc.): Transfer SHAPE and PROPORTION only.
      KEEP the subject's existing pigment colors: eye iris color, eyebrow color,
      lip pigment. Match the subject's skin tone, texture, and lighting from Image 1.
    `;
  }

  return `
    STRICT PHOTOREALISTIC INPAINTING TASK.
    ${inputMapDescription}
    
    USER INSTRUCTION: "${iterationRequest}"
    
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
