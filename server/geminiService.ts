/**
 * Gemini Service - Direct Google Gemini API Integration
 * Matches the reference casting-studio-APP exactly
 * 
 * Models used:
 * - Text: gemini-3-pro-preview (primary), gemini-3-flash-preview (fallback)
 * - Image: gemini-3-pro-image-preview (primary), gemini-2.5-flash-image (fallback)
 */

import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { ENV } from "./_core/env";

// ============================================================================
// TYPES
// ============================================================================

export interface ModelPreferences {
  gender?: string;
  age?: number | string;
  ethnicity?: string;
  bodyType?: string;
  faceShape?: string;
  skinTone?: string;
  skinTexture?: string;
  skinFinish?: string;
  eyeColor?: string;
  hairStyle?: string;
  hairColor?: string;
  hairLength?: string;
  hairTexture?: string;
  hairFringe?: string;
  hairParting?: string;
  hairVolume?: string;
  hairFlyaways?: string;
  hairHairline?: string;
  hairTuck?: string;
  hairFade?: string;
  facialHair?: string;
  castingBrand?: string;
  castingVibe?: { editorial: number; commercial: number; runway: number };
  jawline?: string;
  cheekbones?: string;
  cheeks?: string;
  eyeShape?: string;
  noseShape?: string;
  lipShape?: string;
  eyebrowStyle?: string;
  features?: string;
  referenceImage?: string;
  previousMasterPrompt?: string;
  userPrompt?: string;
}

export enum ImageResolution {
  STANDARD = "1024x1024",
  HIGH = "2048x2048",
  ULTRA = "4096x4096"
}

export enum AspectRatio {
  PORTRAIT = "3:4",
  SQUARE = "1:1",
  LANDSCAPE = "4:3"
}

export enum GenerationMode {
  NEW = "NEW",
  ITERATE = "ITERATE",
  REFERENCE = "REFERENCE"
}

export interface ModelViews {
  headshot?: string;
  fullBody?: string;
  sideClose?: string;
  sideFull?: string;
  backFull?: string;
}

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const MASTER_PROMPT_SYSTEM_INSTRUCTION = `
You are a specialized technical director for a high-end fashion casting agency.
Your task is to generate a casting specification based on user constraints.

OUTPUT FORMAT:
You must output a SINGLE JSON object containing exactly two keys: "natural_description" and "technical_schema".

1. "natural_description" (String):
   This is the MASTER PROMPT used for image generation.
   It must be a fully written, EXTENSIVE, natural-language paragraph describing the subject, lighting, camera, and vibe.
   It should flow naturally but cover all visual details.
   
   CRITICAL STYLE GUIDE:
   - Start with: "Ultra realistic agency model caliber casting headshot..."
   - Use editorial, objective, precise language (e.g. "forward-set zygomatic bones", "sub-malar hollow").
   - Describe the skin texture in extreme detail (pores, vellus hair, imperfections).
   - Describe the lighting (bright direct on-camera flash, bright light grey seamless paper background, sharp honest details).
   - NO marketing fluff. NO "stunning", "beautiful". Use "striking", "defined", "architectural".
   
   LOCATION BOUNDARIES & GEOMETRY (CRITICAL):
   - When describing tattoos, scars, or birthmarks, you MUST specify their precise limits AND geometric orientation relative to bone structure.
   - Example (Limits): Instead of "neck tattoo", write "tattoo on anterior throat only, does not wrap around to posterior neck". 
   - Example (Geometry): Instead of "wrist tattoo", write "text tattoo on inner left wrist, oriented vertically running parallel to the forearm bones toward the elbow".
   - Explicitly state that surrounding areas (back of neck, upper back) are clean skin unless the user asked for back tattoos.

2. "technical_schema" (Object):
   A structured JSON object containing specific casting details.
   It MUST include the following specific keys and their values based on the generated description:
   
   - subject: {
       sex: string,
       age: string,
       ethnicity: string,
       skin_tone: string,
       hair_style: string,
       hair_color: string,
       eye_color: string
     }
   - facial_features: {
       eye_shape: string,      // e.g. "thin almond", "hooded", "monolid", "wide-set"
       face_shape: string,     // e.g. "diamond", "oval", "square", "elongated"
       jawline: string,        // e.g. "defined", "soft", "angular", "square"
       cheekbones: string,     // e.g. "high", "prominent", "forward-set"
       cheeks_shape: string,   // e.g. "hollow", "full", "gaunt"
       nose_shape: string,     // e.g. "thin straight bridge", "button", "aquiline"
       lips_shape: string,     // e.g. "full", "cupid's bow", "wide"
       eyebrows: string,       // e.g. "brushed up", "bleached", "thick", "straight"
       freckles: string        // e.g. "none", "dusted", "heavy"
     }
   - context: {
       tone: string,           // e.g. "high fashion", "runway", "supermodel", "commercial"
       casting_for: string,    // e.g. "Prada", "Gucci", "Zara", "Vogue"
       wardrobe: string        // e.g. "none", "black tank top"
     }

   INSTRUCTIONS FOR SCHEMA:
   - Ensure "facial_features" are filled with HIGH FASHION, DISTINCTIVE descriptors derived from the demographics and description.
   - If the user provides specific bone structure overrides, they must appear in "facial_features".
   - The face MUST be interesting and unique, not generic or average.
`;

export const UPSCALE_PROMPT = `
Enhance extreme photorealism across all visible elements, especially skin, tattoos, hair, and eyes, sharpening micro detail, pores and texture, cleaning specular highlights, reflections and shadow falloff, and upgrading overall clarity to a high-resolution output while strictly preserving the original design, framing, pose, lighting style, color grade, mood and composition.

No creative changes are permitted during upscaling.
`;

// ============================================================================
// CLIENT & SAFETY SETTINGS
// ============================================================================

const getAiClient = () => {
  const apiKey = ENV.geminiApiKey;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.");
  }
  return new GoogleGenAI({ apiKey });
};

// Explicitly disable safety filters to allow "raw" agency casting traits
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
];

// ============================================================================
// DYNAMIC STUDIO SETTINGS
// ============================================================================

const BASE_STUDIO_SETTINGS = `
VISUAL DIRECTIVES (NON-NEGOTIABLE):
1. BACKGROUND: Bright light grey seamless paper wall. No texture, no pattern, no vignettes, no corners.
2. LIGHTING: Direct on-camera flash or slightly off-axis front flash. Sharp honest light. Shadows fall directly behind.
3. CAMERA: Real full frame DSLR/mirrorless. Lens 70-85mm equivalent, aperture f/8. Sensor ratio 3:4. Subtle sensor noise.
4. COLOR/GRADE: Neutral daylight color balance (5500K-5800K). Authentic skin tones. No stylized grading.
5. QUALITY: RAW REALISM. No CGI look, no painterly softness, no excessive symmetry.
`;

const CLEAN_SKIN_RULE = `6. TATTOOS: STRICTLY CLEAN SKIN. NO TATTOOS, NO INK, NO BODY ART unless explicitly mandated by the specific casting features.`;

const TATTOO_PERSISTENCE_RULE = `6. TATTOO PERSISTENCE: Subject features permanent body art. RENDER WITH HIGH FIDELITY. DO NOT REMOVE. INK MUST SIT IN DERMIS AND BE VISIBLE.`;

const hasBodyArt = (text: string): boolean => {
  const t = text.toLowerCase();
  return t.includes('tattoo') || t.includes(' ink ') || t.includes('body art') || t.includes('seal') || t.includes('branding') || t.includes('calligraphy');
};

const getStudioSettings = (context: string) => {
  return `${BASE_STUDIO_SETTINGS}\n${hasBodyArt(context) ? TATTOO_PERSISTENCE_RULE : CLEAN_SKIN_RULE}`;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const extractMimeType = (dataUrl: string): string => {
  const match = dataUrl.match(/^data:(.*?);base64,/);
  return match ? match[1] : 'image/jpeg';
};

const getSkinDescription = (texture?: string, finish?: string): string => {
  let textureDesc = "true photographic texture: visible pores, vellus hair, natural subsurface scattering";
  let finishDesc = "hydrated sheen, uneven skin tone";

  switch (texture) {
    case 'Glass / Perfect':
      textureDesc = "hyper-clean, tight pores, refined dermatological texture, almost flawless but physically real";
      break;
    case 'Freckled':
      textureDesc = "dense distribution of natural ephelides (freckles) across nose and cheeks, visible pores underneath, sun-kissed realism";
      break;
    case 'Textured / Acneic':
      textureDesc = "visible micro-comedones, slight acne scarring, active texture bumps, hyper-realistic teenage skin, redness, zero smoothing";
      break;
    case 'Mature':
      textureDesc = "visible fine lines, collagen loss, age spots, authentic mature texture, crow's feet, deep pores";
      break;
    case 'Raw / Standard':
    default:
      textureDesc = "raw unretouched pores, visible vellus hair, micro-imperfections, natural asymmetry";
      break;
  }

  switch (finish) {
    case 'Matte / Powdered':
      finishDesc = "velvet matte finish, soft diffused speculars, dry texture, no oil sheen";
      break;
    case 'Dewy / Sweat':
      finishDesc = "hyper-hydrated glaze, wet post-facial sheen, high specular reflectivity on cheekbones, moist look";
      break;
    case 'Oily':
      finishDesc = "natural sebum shine on T-zone and forehead, untreated oily skin realism";
      break;
    case 'Natural':
    default:
      finishDesc = "natural hydrated sheen, healthy circulation, balanced reflectivity";
      break;
  }

  return `Skin displays ${textureDesc}. Finish is ${finishDesc}. No beauty retouching or surface smoothing.`;
};

const formatGeminiError = (e: any): string => {
  const msg = e.message || e.toString();
  
  if (msg.includes('429')) return "Agency Quota Exceeded. The casting engine is momentarily overloaded. Please wait 10 seconds.";
  if (msg.includes('403') || msg.includes('API key')) return "Authentication Failed. Please verify your API Key billing status.";
  if (msg.includes('400')) return "Invalid Request. The casting parameters are contradictory or invalid.";
  if (msg.includes('500') || msg.includes('503')) return "Engine Offline. The servers are experiencing downtime.";
  if (msg.includes('SAFETY') || msg.includes('blocked')) return "Safety Protocols Triggered. The request was flagged by global filters.";
  
  return msg;
};

const getBrandDescriptors = (brand: string): string => {
  const descriptors: Record<string, string> = {
    'Gucci': 'Eclectic, unconventional beauty, retro-chic, distinctive features, slightly quirky, layered personality.',
    'Prada': 'Intellectual, ugly-chic, severe, minimalist, polished, structured face, expensive looking.',
    'Saint Laurent': 'Rock n roll, heroin chic, sharp, skinny, dark mood, edgy, effortless cool, cold and detached.',
    'Balenciaga': 'Dystopian, brutalist, unconventional, severe, street-cast vibe, raw.',
    'Miu Miu': 'Subversive preppy, youthful, intellectual, slightly undone, fresh-faced, whimsical, modern girlhood aesthetic.',
    'Versace': 'High octane glamour, sexy, powerful, confident, maximalist, bombshell aesthetic.',
    'Zara': 'Commercial but trendy, sharp, clean, approachable high-street fashion.',
    'Social Media': 'Authentic content creator, approachable, relatable beauty, natural skin texture, soft natural lighting, engaging but real.',
  };
  return descriptors[brand] || descriptors['Gucci'];
};

const getBrandDirectives = (brand: string): string => {
  const b = brand.toLowerCase();
  if (b.includes('saint laurent')) return "HIGH FASHION EDITORIAL CASTING. EDGY, HEROIN CHIC, ROCK N ROLL VIBE. COOL DETACHED ATTITUDE.";
  if (b.includes('prada')) return "HIGH FASHION EDITORIAL CASTING. SEVERE, INTELLECTUAL, MINIMALIST. EXPENSIVE LOOK.";
  if (b.includes('balenciaga')) return "HIGH FASHION EDITORIAL CASTING. RAW, UNCONVENTIONAL, BRUTALIST, STREET-CAST VIBE.";
  if (b.includes('gucci')) return "HIGH FASHION EDITORIAL CASTING. ECLECTIC, VINTAGE-INSPIRED, QUIRKY, DISTINCTIVE CHARACTER.";
  if (b.includes('miu miu')) return "HIGH FASHION EDITORIAL CASTING. SUBVERSIVE PREPPY, YOUTHFUL INTELLECTUAL VIBE.";
  if (b.includes('versace')) return "HIGH FASHION GLAMOUR CASTING. SULTRY, INTENSE, SEXY, POWERFUL.";
  if (b.includes('zara')) return "COMMERCIAL FASHION CASTING. TRENDY, SHARP, CLEAN, ACCESSIBLE.";
  if (b.includes('social media')) return "SOCIAL MEDIA CONTENT CREATOR CASTING. AUTHENTIC, RELATABLE, ENGAGING.";
  return "HIGH FASHION CASTING. DISTINCTIVE AGENCY MODEL, RAW REALISM.";
};

const getNegativeConstraints = (brand: string, context: string): string => {
  const base = "NEGATIVE PROMPT / AVOID: CGI, PAINTING, DRAWING, DISTORTION, SMILING, OPEN MOUTH, SHOWING TEETH, LAUGHING, GRINNING, EXCESSIVE EMOTION, PERFECT SYMMETRY, CARTOON, ANIME, 3D RENDER, PLASTIC SKIN, DOLL LIKE";
  if (hasBodyArt(context)) {
    return base + ".";
  }
  return base + ", TATTOOS, INK, BODY ART, PIERCINGS.";
};

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Generate master prompt from model preferences
 */
export const generateMasterPrompt = async (
  prefs: ModelPreferences,
  mode: 'NEW' | 'ITERATE' | 'REFERENCE' = 'NEW'
): Promise<{ natural: string; schema: any }> => {
  // Debug: Log all received preferences
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
    parts.push({
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    });
  }

  let userContent = "";

  if (mode === 'NEW' || mode === 'REFERENCE') {
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

    userContent = `
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
  } else if (mode === 'ITERATE') {
    const hasRef = !!prefs.referenceImage;
    userContent = `
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
    parts.push({
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      }
    });
    inputMapDescription += `- IMAGE ${imageIndexCounter++}: TARGET SOURCE (The base image to edit. Identity and Lighting source).\n`;
  }

  if (maskImageBase64 && mode === GenerationMode.ITERATE) {
    const mimeType = 'image/png';
    const base64Data = maskImageBase64.replace(/^data:.*?;base64,/, "");
    parts.push({
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    });
    inputMapDescription += `- IMAGE ${imageIndexCounter++}: GUIDE OVERLAY (Red highlighted region marks target area).\n`;
  }

  if (additionalReferenceBase64 && mode === GenerationMode.ITERATE) {
    const mimeType = extractMimeType(additionalReferenceBase64);
    const base64Data = additionalReferenceBase64.replace(/^data:.*?;base64,/, "");
    parts.push({
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      }
    });
    inputMapDescription += `- IMAGE ${imageIndexCounter++}: ATTRIBUTE REFERENCE (Use the visual content/design from this image).\n`;
  }

  if (mode === GenerationMode.ITERATE && iterationRequest) {
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

    textPrompt = `
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
      imageConfig: {
        aspectRatio: aspectRatio,
      },
      safetySettings: SAFETY_SETTINGS,
    };

    if (modelName.includes('pro') && resolution === ImageResolution.HIGH) {
      config.imageConfig.imageSize = resolution;
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: config
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

/**
 * Generate full body shot from headshot
 */
export const generateFullBody = async (
  masterPrompt: string,
  headshotUrl: string,
  gender: string
): Promise<string> => {
  const ai = getAiClient();
  const mimeType = extractMimeType(headshotUrl);
  const base64Data = headshotUrl.replace(/^data:.*?;base64,/, "");

  const dynamicStudioSettings = getStudioSettings(masterPrompt);

  const normalizedGender = gender.trim().toLowerCase();
  let wardrobeConstraint = "";

  if (normalizedGender === 'male') {
    wardrobeConstraint = "Attire: Simple black boxer briefs. BARE CHEST.";
  } else if (normalizedGender === 'non-binary') {
    wardrobeConstraint = "Attire: Minimalist black tank top and fitted black shorts.";
  } else {
    wardrobeConstraint = "Attire: Minimalist form-fitting black activewear (sports bra and shorts).";
  }

  const promptText = `
      STRICT CHARACTER CONSISTENCY REQUIRED.
      Reference image provided (HEADSHOT). 
      TASK: GENERATE FULL BODY STANDING SHOT.
      Maintain exact facial features, skin tone, and body type from reference.
      VIEW: FULL BODY FRONT FACING.
      ${wardrobeConstraint}
      ${dynamicStudioSettings}
      ORIGINAL SPEC: ${masterPrompt}
  `;

  const executeBodyGen = async (model: string) => {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: promptText }
        ]
      },
      config: {
        imageConfig: { aspectRatio: AspectRatio.PORTRAIT },
        safetySettings: SAFETY_SETTINGS
      }
    });

    const imgPart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (imgPart?.inlineData) {
      return `data:image/png;base64,${imgPart.inlineData.data}`;
    }

    const textPart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.text);
    if (textPart?.text) {
      throw new Error(`Refusal: ${textPart.text.slice(0, 50)}...`);
    }
    throw new Error("No image returned.");
  };

  try {
    return await executeBodyGen('gemini-3-pro-image-preview');
  } catch (e: any) {
    try {
      return await executeBodyGen('gemini-2.5-flash-image');
    } catch (e2) {
      throw new Error("Full body generation failed. Safety constraints may be too strict.");
    }
  }
};

/**
 * Generate remaining views (side, back)
 */
export const generateRemainingViews = async (
  masterPrompt: string,
  sourceImageUrl: string,
  gender: string
): Promise<Partial<ModelViews>> => {
  const ai = getAiClient();
  const mimeType = extractMimeType(sourceImageUrl);
  const base64Data = sourceImageUrl.replace(/^data:.*?;base64,/, "");

  const dynamicStudioSettings = getStudioSettings(masterPrompt);

  const normalizedGender = gender.trim().toLowerCase();
  let wardrobeConstraint = normalizedGender === 'male'
    ? "Attire: Simple black boxer briefs. BARE CHEST."
    : "Attire: Minimalist black activewear.";

  const viewConfigs = [
    { key: 'sideClose', prompt: `SIDE PROFILE PORTRAIT. Head and shoulders only. Facing Right. ${wardrobeConstraint} Same subject.` },
    { key: 'sideFull', prompt: `FULL BODY SIDE PROFILE. Walking motion. Facing Right. ${wardrobeConstraint} Same subject.` },
    { key: 'backFull', prompt: `FULL BODY FROM BEHIND. Walking away. ${wardrobeConstraint} Same subject. No new back tattoos.` }
  ];

  const results: Partial<ModelViews> = {};

  const generateView = async (config: { key: string, prompt: string }) => {
    const executeViewGen = async (model: string) => {
      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType } },
            { text: `STRICT CHARACTER CONSISTENCY REQUIRED.\nReference image provided.\nTASK: ${config.prompt}\n${dynamicStudioSettings}\nOriginal Spec: ${masterPrompt}` }
          ]
        },
        config: {
          imageConfig: { aspectRatio: AspectRatio.PORTRAIT },
          safetySettings: SAFETY_SETTINGS
        }
      });

      const imgPart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
      if (imgPart?.inlineData) {
        return { key: config.key, url: `data:image/png;base64,${imgPart.inlineData.data}` };
      }
      throw new Error("No image");
    };

    try {
      try {
        return await executeViewGen('gemini-3-pro-image-preview');
      } catch (e) {
        return await executeViewGen('gemini-2.5-flash-image');
      }
    } catch (e) {
      return null;
    }
  };

  const promises = viewConfigs.map(cfg => generateView(cfg));
  const generatedViews = await Promise.all(promises);

  generatedViews.forEach(v => {
    if (v) {
      (results as any)[v.key] = v.url;
    }
  });

  return results;
};

/**
 * Upscale existing image
 */
export const upscaleExistingImage = async (
  currentImageUrl: string,
  targetResolution: ImageResolution
): Promise<{ imageUrl: string; engineUsed: string }> => {
  const ai = getAiClient();
  const mimeType = extractMimeType(currentImageUrl);
  const base64Data = currentImageUrl.replace(/^data:.*?;base64,/, "");

  const parts: GeminiPart[] = [
    {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    },
    { text: UPSCALE_PROMPT },
  ];

  const modelName = 'gemini-3-pro-image-preview';

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        imageConfig: {
          imageSize: targetResolution,
          aspectRatio: AspectRatio.PORTRAIT,
        },
        safetySettings: SAFETY_SETTINGS,
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return {
          imageUrl: `data:image/png;base64,${part.inlineData.data}`,
          engineUsed: modelName
        };
      }
    }
    throw new Error("Upscale failed: No image returned.");
  } catch (error) {
    throw new Error(formatGeminiError(error));
  }
};
