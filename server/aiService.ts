import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";

/**
 * FormaStudio AI Service
 * Handles all AI-powered model generation using Gemini API
 * Based on reference casting studio implementation
 */

// ============ Types ============

export interface ModelPreferences {
  // Demographics
  gender: string;
  age?: number;
  ageRange?: string;
  ethnicity: string;
  
  // Physical Features
  bodyType: string;
  height?: string;
  
  // Face Structure
  faceShape?: string;
  eyebrowStyle?: string;
  jawline?: string;
  cheekbones?: string;
  cheeks?: string;
  eyeShape?: string;
  noseShape?: string;
  lipShape?: string;
  
  // Hair
  hairColor: string;
  hairLength?: string;
  hairStyle: string;
  hairTexture?: string;
  hairFringe?: string;
  hairParting?: string;
  hairVolume?: string;
  hairFlyaways?: string;
  hairHairline?: string;
  hairTuck?: string;
  hairFade?: string;
  facialHair?: string;
  facialFeatures?: string;
  
  // Skin & Features
  skinTone: string;
  skinTexture?: string;
  skinFinish?: string;
  eyeColor: string;
  features?: string;
  
  // Brand & Aesthetic
  castingBrand?: string;
  brandTone?: string;
  mood?: string;
  castingVibe?: {
    editorial: number;
    commercial: number;
    runway: number;
  };
  
  // Optional references
  referenceImage?: string;
  referenceDescription?: string;
  previousMasterPrompt?: string;
  userPrompt?: string;
}

export interface MasterPrompt {
  naturalDescription: string;
  technicalSchema: {
    subject: {
      sex: string;
      age: string;
      ethnicity: string;
      skin_tone: string;
      hair_style: string;
      hair_color: string;
      eye_color: string;
    };
    facial_features: {
      eye_shape: string;
      face_shape: string;
      jawline: string;
      cheekbones: string;
      cheeks_shape: string;
      nose_shape: string;
      lips_shape: string;
      eyebrows: string;
      freckles: string;
    };
    context: {
      tone: string;
      casting_for: string;
      wardrobe: string;
    };
  };
  agencyId: string;
}

export interface GenerationResult {
  success: boolean;
  imageUrl?: string;
  engineUsed?: string;
  error?: string;
  pointsCost: number;
}

export type ImageResolution = "STD" | "HD" | "ULTRA";
export type GenerationMode = "NEW" | "ITERATE" | "REFERENCE";

// ============ Point Costs ============

export const POINT_COSTS = {
  masterPrompt: 2,
  castingImage: 12,
  fullBody: 8,
  multiView: 15,
  upscale2K: 3,
  upscale4K: 5,
  iteration: 5,
} as const;

// ============ Constants ============

const MASTER_PROMPT_SYSTEM_INSTRUCTION = `
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
       eye_shape: string,
       face_shape: string,
       jawline: string,
       cheekbones: string,
       cheeks_shape: string,
       nose_shape: string,
       lips_shape: string,
       eyebrows: string,
       freckles: string
     }
   - context: {
       tone: string,
       casting_for: string,
       wardrobe: string
     }

   INSTRUCTIONS FOR SCHEMA:
   - Ensure "facial_features" are filled with HIGH FASHION, DISTINCTIVE descriptors derived from the demographics and description.
   - If the user provides specific bone structure overrides, they must appear in "facial_features".
   - The face MUST be interesting and unique, not generic or average.
`;

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

// ============ Helper Functions ============

function generateAgencyId(): string {
  const prefix = "MOD";
  const year = new Date().getFullYear().toString().slice(-2);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${year}-${suffix}`;
}

function hasBodyArt(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes('tattoo') || t.includes(' ink ') || t.includes('body art') || 
         t.includes('seal') || t.includes('branding') || t.includes('calligraphy');
}

function getStudioSettings(context: string): string {
  return `${BASE_STUDIO_SETTINGS}\n${hasBodyArt(context) ? TATTOO_PERSISTENCE_RULE : CLEAN_SKIN_RULE}`;
}

function getSkinDescription(texture?: string, finish?: string): string {
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
}

function getBrandDescriptor(brand: string): string {
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
}

function getBrandDirectives(brand: string): string {
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
}

function getNegativeConstraints(brand: string, context: string): string {
  const base = "NEGATIVE PROMPT / AVOID: CGI, PAINTING, DRAWING, DISTORTION, SMILING, OPEN MOUTH, SHOWING TEETH, LAUGHING, GRINNING, EXCESSIVE EMOTION, PERFECT SYMMETRY, CARTOON, ANIME, 3D RENDER, PLASTIC SKIN, DOLL LIKE";
  if (hasBodyArt(context)) {
    return base + ".";
  }
  return base + ", TATTOOS, INK, BODY ART, PIERCINGS.";
}

function getVibeBlendDescription(vibe?: { editorial: number; commercial: number; runway: number }): string {
  if (!vibe) {
    return "AESTHETIC MIX: 100% High Fashion Editorial. Severe and architectural.";
  }
  
  const { editorial, commercial, runway } = vibe;
  const eP = Math.round(editorial * 100);
  const cP = Math.round(commercial * 100);
  const rP = Math.round(runway * 100);

  let description = `
    AESTHETIC MIX:
    - ${eP}% EDITORIAL (Avant-garde, sharp, strange, severe, expensive, architectural).
    - ${cP}% COMMERCIAL (Approachable, warm, soft, relatable, healthy, smiling eyes).
    - ${rP}% RUNWAY (Fierce, imposing, powerful, confident, statuesque, classic supermodel).
    
    INSTRUCTION: Blend these traits proportionally.
  `;
  
  if (editorial > 0.6) description += " Features should be striking and unconventional.";
  if (commercial > 0.6) description += " Expression should be slightly softer and more engaging.";
  if (runway > 0.6) description += " Pose and gaze must be intense and commanding.";
  
  return description;
}

function formatGeminiError(e: any): string {
  const msg = e.message || e.toString();
  
  if (msg.includes('429')) return "Agency Quota Exceeded. The casting engine is momentarily overloaded. Please wait 10 seconds.";
  if (msg.includes('403') || msg.includes('API key')) return "Authentication Failed. Please verify your API Key billing status.";
  if (msg.includes('400')) return "Invalid Request. The casting parameters are contradictory or invalid.";
  if (msg.includes('500') || msg.includes('503')) return "Engine Offline. The servers are experiencing downtime.";
  if (msg.includes('SAFETY') || msg.includes('blocked')) return "Safety Protocols Triggered. The request was flagged by global filters.";
  
  return msg;
}

// ============ AI Service Functions ============

/**
 * Generate a master prompt from model preferences
 * This creates a detailed specification for the AI model
 */
export async function generateMasterPrompt(
  prefs: ModelPreferences,
  mode: GenerationMode = "NEW"
): Promise<MasterPrompt> {
  const skinInstruction = getSkinDescription(prefs.skinTexture, prefs.skinFinish);
  const isMale = prefs.gender?.toLowerCase().includes('male');
  const brandVibe = getBrandDescriptor(prefs.castingBrand || prefs.brandTone || 'Gucci');
  const vibeBlendDescription = getVibeBlendDescription(prefs.castingVibe);
  
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

  // Build feature list
  const featureList: string[] = [];
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

  // Build hair details
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

  let userContent = "";
  
  if (mode === 'NEW' || mode === 'REFERENCE') {
    userContent = `
    Create a CASTING SPECIFICATION (JSON) based on these requirements:
    - Gender: ${prefs.gender || "Female"}
    - Age: ${prefs.age || 23}
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
    userContent = `
    Update the CASTING SPECIFICATION based on the user's iteration request.

    ORIGINAL DESCRIPTION:
    ${prefs.previousMasterPrompt}

    USER REQUEST:
    ${prefs.userPrompt}

    RULES:
    1. Preserve all identity attributes from the original description unless the user explicitly asks to change them.
    2. Only modify the specific elements requested.
    3. If the user asks for a visual change, describe it based on their text.
    4. BIOLOGICAL REALISM: Handle eye color changes as pigment shifts, not lens swaps.
    5. GEOMETRIC LOCKING: If adding tattoos, scars, birthmarks, or moles, you MUST define their EXACT location relative to bone structure.
    6. Output the full updated JSON with minimal changes.
    `;
  }

  const response = await invokeLLM({
    messages: [
      { role: "system", content: MASTER_PROMPT_SYSTEM_INSTRUCTION },
      { role: "user", content: userContent },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "casting_specification",
        strict: true,
        schema: {
          type: "object",
          properties: {
            natural_description: { 
              type: "string", 
              description: "Complete master prompt for image generation" 
            },
            technical_schema: {
              type: "object",
              properties: {
                subject: {
                  type: "object",
                  properties: {
                    sex: { type: "string" },
                    age: { type: "string" },
                    ethnicity: { type: "string" },
                    skin_tone: { type: "string" },
                    hair_style: { type: "string" },
                    hair_color: { type: "string" },
                    eye_color: { type: "string" },
                  },
                  required: ["sex", "age", "ethnicity", "skin_tone", "hair_style", "hair_color", "eye_color"],
                  additionalProperties: false,
                },
                facial_features: {
                  type: "object",
                  properties: {
                    eye_shape: { type: "string" },
                    face_shape: { type: "string" },
                    jawline: { type: "string" },
                    cheekbones: { type: "string" },
                    cheeks_shape: { type: "string" },
                    nose_shape: { type: "string" },
                    lips_shape: { type: "string" },
                    eyebrows: { type: "string" },
                    freckles: { type: "string" },
                  },
                  required: ["eye_shape", "face_shape", "jawline", "cheekbones", "cheeks_shape", "nose_shape", "lips_shape", "eyebrows", "freckles"],
                  additionalProperties: false,
                },
                context: {
                  type: "object",
                  properties: {
                    tone: { type: "string" },
                    casting_for: { type: "string" },
                    wardrobe: { type: "string" },
                  },
                  required: ["tone", "casting_for", "wardrobe"],
                  additionalProperties: false,
                },
              },
              required: ["subject", "facial_features", "context"],
              additionalProperties: false,
            },
          },
          required: ["natural_description", "technical_schema"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Failed to generate master prompt");
  }

  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  const parsed = JSON.parse(contentStr);
  
  return {
    naturalDescription: parsed.natural_description || "",
    technicalSchema: parsed.technical_schema || {},
    agencyId: generateAgencyId(),
  };
}

/**
 * Enhance user's iteration prompt for better AI understanding
 */
export async function enhanceUserPrompt(originalPrompt: string): Promise<string> {
  if (!originalPrompt.trim()) return "";
  
  const prompt = `
  You are an expert AI Prompt Engineer.
  Your task is to REWRITE the user's raw input into a clear, direct instruction for an image editing AI.
  
  CRITICAL RULE: The image generator already has a master style prompt. DO NOT add stylistic directives.
  GOAL: Clarify the INTENT (Action + Target + Constraints).
  
  USER INPUT: "${originalPrompt}"
  REFINED OUTPUT:
  `;

  try {
    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
    });
    
    const content = response.choices[0]?.message?.content;
    if (content) {
      return typeof content === 'string' ? content.trim() : originalPrompt;
    }
    return originalPrompt;
  } catch (e) {
    return originalPrompt;
  }
}

/**
 * Generate a casting image (headshot/portrait) from a master prompt
 */
export async function generateCastingImage(
  masterPrompt: MasterPrompt,
  referenceImageUrl?: string,
  resolution: ImageResolution = "STD",
  mode: GenerationMode = "NEW",
  iterationRequest?: string,
  castingBrand: string = "Generic",
  maskImageBase64?: string
): Promise<GenerationResult> {
  try {
    const contextForConfig = masterPrompt.naturalDescription + (iterationRequest || "");
    const dynamicStudioSettings = getStudioSettings(contextForConfig);
    const brandDirective = getBrandDirectives(castingBrand);
    const negativeConstraints = getNegativeConstraints(castingBrand, contextForConfig);
    const prefix = `${brandDirective} STRAIGHT-ON HEADSHOT. BARE SHOULDERS. `;

    let textPrompt = "";

    if (mode === "ITERATE" && iterationRequest) {
      const frameDirective = "STRAIGHT-ON HEADSHOT. CLOSE UP FACIAL PORTRAIT. MAINTAIN EXACT CAMERA DISTANCE.";
      const framingLock = `
        CRITICAL GEOMETRY ENFORCEMENT:
        1. DO NOT ZOOM OUT. DO NOT REFRAME. The head size and position must remain IDENTICAL to the Source Image.
        2. CROP RULE: If the user adds a feature on the body that is below the bottom edge of the current frame, RENDER ONLY THE TOP SLIVER that is visible.
        3. NEVER change the aspect ratio or field of view to fit a requested item.
      `;

      let surgicalInstructions = "";
      if (maskImageBase64) {
        surgicalInstructions = `
          Use the guide image with the red highlighted region as the target area.
          TASK: SEMANTIC INPAINTING. Modify the content inside the red masked area based strictly on the USER INSTRUCTION.
          STRICT VISUAL STANDARDS: ${dynamicStudioSettings}
          MODES: REMOVAL or MODIFICATION.
        `;
      }

      textPrompt = `
        STRICT PHOTOREALISTIC INPAINTING TASK.
        
        USER INSTRUCTION: "${iterationRequest}"
        
        VISUAL RULES:
        ${frameDirective}
        ${framingLock}
        
        ${surgicalInstructions}
        
        CRITICAL GLOBAL CONSTRAINTS: FREEZE lighting/identity/camera. MODIFY ONLY what is requested within the EXISTING BOUNDARIES.
        FULL TARGET CONTEXT: ${masterPrompt.naturalDescription}
      `;
    } else {
      textPrompt = `
        ${prefix}
        STRICT VISUAL ENFORCEMENT:
        1. WARDROBE: STRICTLY BARE SKIN ONLY. NO CLOTHING, NO STRAPS, NO UNDERWEAR VISIBLE IN FRAME.
        2. EXPRESSION: ${negativeConstraints}
        ${dynamicStudioSettings}
        CASTING SPEC: ${masterPrompt.naturalDescription}
      `;
    }

    const result = await generateImage({
      prompt: textPrompt,
      ...(referenceImageUrl && {
        originalImages: [{
          url: referenceImageUrl,
          mimeType: "image/jpeg" as const,
        }],
      }),
    });

    return {
      success: true,
      imageUrl: result.url,
      engineUsed: "gemini-image",
      pointsCost: POINT_COSTS.castingImage,
    };
  } catch (error) {
    console.error("[AI Service] Failed to generate casting image:", error);
    return {
      success: false,
      error: formatGeminiError(error),
      pointsCost: 0,
    };
  }
}

/**
 * Generate a full body image from an existing headshot
 */
export async function generateFullBody(
  masterPrompt: MasterPrompt,
  headshotUrl: string,
  gender: string
): Promise<GenerationResult> {
  try {
    const dynamicStudioSettings = getStudioSettings(masterPrompt.naturalDescription);
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
      ORIGINAL SPEC: ${masterPrompt.naturalDescription}
    `;

    const result = await generateImage({
      prompt: promptText,
      originalImages: [{
        url: headshotUrl,
        mimeType: "image/jpeg" as const,
      }],
    });

    return {
      success: true,
      imageUrl: result.url,
      engineUsed: "gemini-image",
      pointsCost: POINT_COSTS.fullBody,
    };
  } catch (error) {
    console.error("[AI Service] Failed to generate full body:", error);
    return {
      success: false,
      error: formatGeminiError(error),
      pointsCost: 0,
    };
  }
}

/**
 * Generate a specific view (side or back) for a model
 */
export async function generateRemainingViews(
  masterPrompt: MasterPrompt,
  viewType: "side" | "back",
  sourceImageUrl?: string
): Promise<GenerationResult> {
  try {
    const dynamicStudioSettings = getStudioSettings(masterPrompt.naturalDescription);
    const gender = masterPrompt.technicalSchema?.subject?.sex || 'female';
    const normalizedGender = gender.trim().toLowerCase();
    
    const wardrobeConstraint = normalizedGender === 'male' 
      ? "Attire: Simple black boxer briefs. BARE CHEST." 
      : "Attire: Minimalist black activewear.";

    const viewPrompts: Record<string, string> = {
      side: `SIDE PROFILE PORTRAIT. Head and shoulders only. Facing Right. ${wardrobeConstraint} Same subject.`,
      back: `FULL BODY FROM BEHIND. Walking away. ${wardrobeConstraint} Same subject. No new back tattoos.`
    };

    const promptText = `STRICT CHARACTER CONSISTENCY REQUIRED.\nReference image provided.\nTASK: ${viewPrompts[viewType]}\n${dynamicStudioSettings}\nOriginal Spec: ${masterPrompt.naturalDescription}`;

    const result = await generateImage({
      prompt: promptText,
      ...(sourceImageUrl && {
        originalImages: [{
          url: sourceImageUrl,
          mimeType: "image/jpeg" as const,
        }],
      }),
    });

    return {
      success: true,
      imageUrl: result.url,
      engineUsed: "gemini-image",
      pointsCost: POINT_COSTS.multiView,
    };
  } catch (error) {
    console.error(`[AI Service] Failed to generate ${viewType} view:`, error);
    return {
      success: false,
      error: formatGeminiError(error),
      pointsCost: 0,
    };
  }
}

/**
 * Iterate/refine an existing model image with feedback
 */
export async function iterateModel(
  masterPrompt: MasterPrompt,
  currentImageUrl: string,
  feedback: string,
  frame: 'HEADSHOT' | 'FULL_BODY' = 'HEADSHOT',
  maskImageBase64?: string
): Promise<GenerationResult> {
  try {
    const dynamicStudioSettings = getStudioSettings(masterPrompt.naturalDescription + feedback);
    
    const frameDirective = frame === 'FULL_BODY' 
      ? "FULL BODY FASHION SHOT. HEAD TO TOE VISIBLE." 
      : "STRAIGHT-ON HEADSHOT. CLOSE UP FACIAL PORTRAIT. MAINTAIN EXACT CAMERA DISTANCE.";
    
    const framingLock = frame === 'HEADSHOT' 
      ? `
        CRITICAL GEOMETRY ENFORCEMENT:
        1. DO NOT ZOOM OUT. DO NOT REFRAME. The head size and position must remain IDENTICAL to the Source Image.
        2. CROP RULE: If the user adds a feature on the body that is below the bottom edge of the current frame, RENDER ONLY THE TOP SLIVER that is visible.
        3. NEVER change the aspect ratio or field of view to fit a requested item.
      ` 
      : "";

    let surgicalInstructions = "";
    if (maskImageBase64) {
      const req = feedback.toLowerCase();
      const isSkinFeature = req.includes('scar') || req.includes('mark') || req.includes('mole') || 
                          req.includes('spot') || req.includes('freckle') || req.includes('acne') || 
                          req.includes('blemish') || req.includes('pimple') || req.includes('pore') ||
                          req.includes('texture');

      let skinProtocol = "";
      if (isSkinFeature) {
        skinProtocol = `
          CRITICAL SKIN FEATURE PROTOCOL (SCARS/BIRTHMARKS/SPOTS):
          1. BIOLOGY: Features must originate from the dermis. No "painted on" look.
          2. TEXTURE: Skin texture (pores) must continue OVER the feature, but may be disrupted.
          3. EDGES: Natural, organic edges. No sharp vector cutouts.
          4. LIGHTING: Specular highlights must interact with the feature's texture.
          5. LIMITS: CONFINE STRICTLY to the requested area/mask.
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

    const textPrompt = `
      STRICT PHOTOREALISTIC INPAINTING TASK.
      
      USER INSTRUCTION: "${feedback}"
      
      VISUAL RULES:
      ${frameDirective}
      ${framingLock}
      
      ${surgicalInstructions}
      
      CRITICAL GLOBAL CONSTRAINTS: FREEZE lighting/identity/camera. MODIFY ONLY what is requested within the EXISTING BOUNDARIES.
      FULL TARGET CONTEXT: ${masterPrompt.naturalDescription}
    `;

    const result = await generateImage({
      prompt: textPrompt,
      originalImages: [{
        url: currentImageUrl,
        mimeType: "image/jpeg" as const,
      }],
    });

    return {
      success: true,
      imageUrl: result.url,
      engineUsed: "gemini-image",
      pointsCost: POINT_COSTS.iteration,
    };
  } catch (error) {
    console.error("[AI Service] Failed to iterate model:", error);
    return {
      success: false,
      error: formatGeminiError(error),
      pointsCost: 0,
    };
  }
}

/**
 * Upscale an existing image to higher resolution
 */
export async function upscaleImage(
  imageUrl: string,
  targetResolution: "2K" | "4K"
): Promise<GenerationResult> {
  try {
    const upscalePrompt = `
      Enhance extreme photorealism across all visible elements, especially skin, tattoos, hair, and eyes, 
      sharpening micro detail, pores and texture, cleaning specular highlights, reflections and shadow falloff, 
      and upgrading overall clarity to a high-resolution output while strictly preserving the original design, 
      framing, pose, lighting style, color grade, mood and composition.
      
      No creative changes are permitted during upscaling.
    `;

    const result = await generateImage({
      prompt: upscalePrompt,
      originalImages: [{
        url: imageUrl,
        mimeType: "image/jpeg" as const,
      }],
    });

    return {
      success: true,
      imageUrl: result.url,
      engineUsed: "gemini-image",
      pointsCost: targetResolution === "4K" ? POINT_COSTS.upscale4K : POINT_COSTS.upscale2K,
    };
  } catch (error) {
    console.error("[AI Service] Failed to upscale image:", error);
    return {
      success: false,
      error: formatGeminiError(error),
      pointsCost: 0,
    };
  }
}
