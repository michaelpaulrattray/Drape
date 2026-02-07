/**
 * Gemini Prompts - All prompt constants, brand descriptors, skin helpers,
 * and studio settings for the casting engine.
 */

// ============================================================================
// SYSTEM PROMPTS
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
// STUDIO SETTINGS
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

export const hasBodyArt = (text: string): boolean => {
  const t = text.toLowerCase();
  return t.includes('tattoo') || t.includes(' ink ') || t.includes('body art') || t.includes('seal') || t.includes('branding') || t.includes('calligraphy');
};

export const getStudioSettings = (context: string) => {
  return `${BASE_STUDIO_SETTINGS}\n${hasBodyArt(context) ? TATTOO_PERSISTENCE_RULE : CLEAN_SKIN_RULE}`;
};

// ============================================================================
// BRAND HELPERS
// ============================================================================

export const getBrandDescriptors = (brand: string): string => {
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

export const getBrandDirectives = (brand: string): string => {
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

export const getNegativeConstraints = (brand: string, context: string): string => {
  const base = "NEGATIVE PROMPT / AVOID: CGI, PAINTING, DRAWING, DISTORTION, SMILING, OPEN MOUTH, SHOWING TEETH, LAUGHING, GRINNING, EXCESSIVE EMOTION, PERFECT SYMMETRY, CARTOON, ANIME, 3D RENDER, PLASTIC SKIN, DOLL LIKE";
  if (hasBodyArt(context)) {
    return base + ".";
  }
  return base + ", TATTOOS, INK, BODY ART, PIERCINGS.";
};

// ============================================================================
// SKIN HELPERS
// ============================================================================

export const getSkinDescription = (texture?: string, finish?: string): string => {
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
