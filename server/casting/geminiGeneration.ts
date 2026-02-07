/**
 * Gemini Generation - Master prompt generation, prompt enhancement,
 * and casting image generation (headshot + iteration/inpainting).
 */

import type { ModelPreferences, GeminiPart } from "./geminiTypes";
import { ImageResolution, AspectRatio, GenerationMode } from "./geminiTypes";
import { getAiClient, SAFETY_SETTINGS, extractMimeType, formatGeminiError } from "./geminiClient";
import {
  MASTER_PROMPT_SYSTEM_INSTRUCTION,
  getSkinDescription,
  getBrandDescriptors,
  getBrandDirectives,
  getNegativeConstraints,
  getStudioSettings,
  hasBodyArt,
} from "./geminiPrompts";

// ============================================================================
// GENERATE MASTER PROMPT
// ============================================================================

/**
 * Generate master prompt from model preferences
 */
export const generateMasterPrompt = async (
  prefs: ModelPreferences,
  mode: 'NEW' | 'ITERATE' | 'REFERENCE' = 'NEW'
): Promise<{ natural: string; schema: any }> => {
  console.log('[geminiService] generateMasterPrompt called with:');
  console.log('[geminiService] - castingBrand:', prefs.castingBrand);
  console.log('[geminiService] - castingVibe:', JSON.stringify(prefs.castingVibe));
  console.log('[geminiService] - hairStyle:', prefs.hairStyle);
  console.log('[geminiService] - hairFringe:', prefs.hairFringe);
  console.log('[geminiService] - hairLength:', prefs.hairLength);
  console.log('[geminiService] - hairTexture:', prefs.hairTexture);
  console.log('[geminiService] - skinTexture:', prefs.skinTexture);
  console.log('[geminiService] - skinFinish:', prefs.skinFinish);
  console.log('[geminiService] - faceShape:', prefs.faceShape);
  console.log('[geminiService] - All prefs:', JSON.stringify(prefs, null, 2));

  const ai = getAiClient();
  const skinInstruction = getSkinDescription(prefs.skinTexture, prefs.skinFinish);
  const parts: GeminiPart[] = [];

  if (prefs.referenceImage && mode === 'ITERATE') {
    const mimeType = extractMimeType(prefs.referenceImage);
    const base64Data = prefs.referenceImage.replace(/^data:.*?;base64,/, "");
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

  try {
    try {
      const response = await generateText('gemini-3-pro-preview');
      let jsonText = response.text || "{}";
      jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonText);
      return { natural: parsed.natural_description || "", schema: parsed.technical_schema || {} };
    } catch (e: any) {
      if (e.status === 403 || e.status === 404 || e.message?.includes('403') || e.message?.includes('not found')) {
        const response = await generateText('gemini-3-flash-preview');
        let jsonText = response.text || "{}";
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonText);
        return { natural: parsed.natural_description || "", schema: parsed.technical_schema || {} };
      }
      throw e;
    }
  } catch (error) {
    throw new Error(formatGeminiError(error));
  }
};

// ============================================================================
// PROMPT CONTENT BUILDERS (private helpers)
// ============================================================================

function buildNewPromptContent(prefs: ModelPreferences, skinInstruction: string): string {
  const isMale = prefs.gender?.toLowerCase().includes('male');
  const brandVibe = getBrandDescriptors(prefs.castingBrand || 'Gucci');

  let vibeBlendDescription = "";
  if (prefs.castingVibe) {
    const { editorial, commercial, runway } = prefs.castingVibe;
    const eP = Math.round(editorial * 100);
    const cP = Math.round(commercial * 100);
    const rP = Math.round(runway * 100);

    vibeBlendDescription = `
      AESTHETIC MIX:
      - ${eP}% EDITORIAL (Avant-garde, sharp, strange, severe, expensive, architectural).
      - ${cP}% COMMERCIAL (Approachable, warm, soft, relatable, healthy, smiling eyes).
      - ${rP}% RUNWAY (Fierce, imposing, powerful, confident, statuesque, classic supermodel).
      
      INSTRUCTION: Blend these traits proportionally. 
      ${editorial > 0.6 ? "Features should be striking and unconventional." : ""}
      ${commercial > 0.6 ? "Expression should be slightly softer and more engaging." : ""}
      ${runway > 0.6 ? "Pose and gaze must be intense and commanding." : ""}
    `;
  } else {
    vibeBlendDescription = "AESTHETIC MIX: 100% High Fashion Editorial. Severe and architectural.";
  }

  const isSocialMedia = prefs.castingBrand === 'Social Media';
  const isCommercialVibe = (prefs.castingVibe?.commercial || 0) > 0.7;

  let qualityBaseline = "";
  if (isSocialMedia) {
    qualityBaseline = `The subject must possess a magnetic, authentic content creator aesthetic.
       - VIBE: ${brandVibe}
       - BLEND: ${vibeBlendDescription}
       - PRIORITIZE RELATABLE, ENGAGING, NATURAL BEAUTY.
       - Wardrobe: BARE SKIN ONLY. NO CLOTHING OR STRAPS VISIBLE.`;
  } else if (isCommercialVibe || prefs.castingBrand === 'Zara') {
    qualityBaseline = `The subject must possess a highly attractive, commercial aesthetic.
       - VIBE: ${brandVibe}
       - BLEND: ${vibeBlendDescription}
       - PRIORITIZE POLISHED, SYMMETRICAL, APPROACHABLE BEAUTY.
       - Wardrobe: BARE SKIN ONLY. NO CLOTHING OR STRAPS VISIBLE.`;
  } else {
    qualityBaseline = `The subject must possess striking, top-tier high fashion agency model features.
       - VIBE: ${brandVibe}
       - BLEND: ${vibeBlendDescription}
       - PRIORITIZE DISTINCTIVE, ARCHITECTURAL, UNIQUE BEAUTY.
       - Wardrobe: STRICTLY BARE SKIN ONLY. NO CLOTHING OR STRAPS VISIBLE.`;
  }

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
    ? `MANDATORY FACIAL FEATURES: ${featureList.join(', ')}.`
    : "Facial Features: Generate coherent features matching the Brand/Tone vibe.";

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
  - Ethnicity: ${prefs.ethnicity || "Any"}
  - Body Type: ${prefs.bodyType || "Model Standard"}
  - Face Shape: ${prefs.faceShape && prefs.faceShape !== 'Random' ? prefs.faceShape : "Any"}
  - Skin tone: ${prefs.skinTone || "Standard"}
  - Eye_color: ${prefs.eyeColor || "Any"}
  
  HAIR SPECIFICATION (STRICT):
  - Base Style: ${prefs.hairStyle || "Natural"}
  - Color: ${prefs.hairColor || "Natural"}
  - Detailed Styling: ${hairDetails}
  
  CRITICAL QUALITY BASELINE: 
  ${qualityBaseline}
  
  STYLING DIRECTIVE:
  Interpret the Hair Specification strictly through the lens of a HIGH-END SALON CASTING.
  - REALISM: Hair must look physically plausible.
  - BRAND ALIGNMENT: Match hairstyle to the requested brand archetype.

  ${featuresInstruction}

  CRITICAL SKIN DIRECTIVE: ${skinInstruction}
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

  4. BIOLOGICAL REALISM: Handle eye color changes as pigment shifts, not lens swaps.

  5. GEOMETRIC LOCKING: If adding tattoos, scars, birthmarks, or moles, you MUST define their EXACT location relative to bone structure (e.g., "left temple, 2cm from hairline"). Do not use vague terms like "on face".

  6. Output the full updated JSON with minimal changes.
  `;
}

// ============================================================================
// ENHANCE USER PROMPT
// ============================================================================

/**
 * Enhance user prompt for iteration
 */
export const enhanceUserPrompt = async (originalPrompt: string): Promise<string> => {
  const ai = getAiClient();
  if (!originalPrompt.trim()) return "";

  const prompt = `
  You are an expert AI Prompt Engineer.
  Your task is to REWRITE the user's raw input into a clear, direct instruction for an image editing AI.
  
  CRITICAL RULE: The image generator already has a master style prompt. DO NOT add stylistic directives.
  GOAL: Clarify the INTENT (Action + Target + Constraints).
  
  USER INPUT: "${originalPrompt}"
  REFINED OUTPUT:
  `;

  const executeEnhance = async (model: string) => {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [{ text: prompt }] },
      config: {
        maxOutputTokens: 1024,
        temperature: 0.2,
        safetySettings: SAFETY_SETTINGS,
      }
    });
    return response.text?.trim();
  };

  try {
    const result = await executeEnhance('gemini-3-flash-preview');
    if (result) return result;
    throw new Error("Empty response");
  } catch (e) {
    try {
      const result = await executeEnhance('gemini-flash-latest');
      return result || originalPrompt;
    } catch (e2) {
      return originalPrompt;
    }
  }
};

// ============================================================================
// GENERATE CASTING IMAGE
// ============================================================================

/**
 * Generate casting image (headshot or full body)
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
  maskImageBase64?: string
): Promise<{ imageUrl: string; engineUsed: string }> => {
  const ai = getAiClient();
  let textPrompt = "";

  const contextForConfig = masterPrompt + (iterationRequest || "");
  const dynamicStudioSettings = getStudioSettings(contextForConfig);

  const brandDirective = getBrandDirectives(castingBrand);
  const negativeConstraints = getNegativeConstraints(castingBrand, contextForConfig);
  const prefix = `${brandDirective} STRAIGHT-ON HEADSHOT. BARE SHOULDERS. `;

  const parts: GeminiPart[] = [];
  let imageIndexCounter = 1;
  let inputMapDescription = "INPUT VISUALS:\n";

  if (referenceImageBase64) {
    const mimeType = extractMimeType(referenceImageBase64);
    const base64Data = referenceImageBase64.replace(/^data:.*?;base64,/, "");
    parts.push({ inlineData: { data: base64Data, mimeType } });
    inputMapDescription += `- IMAGE ${imageIndexCounter++}: TARGET SOURCE (The base image to edit. Identity and Lighting source).\n`;
  }

  if (maskImageBase64 && mode === GenerationMode.ITERATE) {
    const base64Data = maskImageBase64.replace(/^data:.*?;base64,/, "");
    parts.push({ inlineData: { data: base64Data, mimeType: 'image/png' } });
    inputMapDescription += `- IMAGE ${imageIndexCounter++}: GUIDE OVERLAY (Red highlighted region marks target area).\n`;
  }

  if (additionalReferenceBase64 && mode === GenerationMode.ITERATE) {
    const mimeType = extractMimeType(additionalReferenceBase64);
    const base64Data = additionalReferenceBase64.replace(/^data:.*?;base64,/, "");
    parts.push({ inlineData: { data: base64Data, mimeType } });
    inputMapDescription += `- IMAGE ${imageIndexCounter++}: ATTRIBUTE REFERENCE (Use the visual content/design from this image).\n`;
  }

  if (mode === GenerationMode.ITERATE && iterationRequest) {
    textPrompt = buildIterationImagePrompt(
      iterationRequest, masterPrompt, frame, dynamicStudioSettings,
      inputMapDescription, maskImageBase64, additionalReferenceBase64, imageIndexCounter
    );
  } else {
    textPrompt = `
      ${prefix}
      STRICT VISUAL ENFORCEMENT:
      1. WARDROBE: STRICTLY BARE SKIN ONLY. NO CLOTHING, NO STRAPS, NO UNDERWEAR VISIBLE IN FRAME.
      2. EXPRESSION: ${negativeConstraints}
      ${dynamicStudioSettings}
      CASTING SPEC: ${masterPrompt}
    `;
  }

  parts.push({ text: textPrompt });

  const executeGen = async (modelName: string) => {
    const config: any = {
      imageConfig: { aspectRatio },
      safetySettings: SAFETY_SETTINGS,
    };

    if (modelName.includes('pro') && resolution === ImageResolution.HIGH) {
      config.imageConfig.imageSize = resolution;
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data in response.");
  };

  const primaryModel = 'gemini-3-pro-image-preview';
  try {
    try {
      const url = await executeGen(primaryModel);
      return { imageUrl: url, engineUsed: primaryModel };
    } catch (e: any) {
      if (primaryModel.includes('pro') && (e.status === 403 || e.status === 404 || e.message?.includes('403') || e.message?.includes('not found'))) {
        const fallbackUrl = await executeGen('gemini-2.5-flash-image');
        return { imageUrl: fallbackUrl, engineUsed: 'gemini-2.5-flash-image' };
      }
      throw e;
    }
  } catch (error) {
    throw new Error(formatGeminiError(error));
  }
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
    2. CROP RULE: If the user adds a feature on the body (e.g. "chest tattoo", "cleavage", "necklace") that is below the bottom edge of the current frame, RENDER ONLY THE TOP SLIVER that is visible. CUT THE REST OFF.
    3. NEVER change the aspect ratio or field of view to fit a requested item.
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
    featureInstructions = `TRANSFER VISUAL ATTRIBUTE from Image ${imageIndexCounter - 1} to Subject.`;
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
    FULL TARGET CONTEXT: ${masterPrompt}
  `;
}
