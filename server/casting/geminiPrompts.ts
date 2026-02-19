/**
 * Gemini Prompts - All prompt constants, brand profiles, skin/iris helpers,
 * and studio settings for the casting engine.
 *
 * Migration Phase 1a: Updated from new Casting Studio design.
 * - MASTER_PROMPT_SYSTEM_INSTRUCTION: rewritten with signal priority hierarchy
 * - BRAND_PROFILES: unified record replacing getBrandDescriptors + getBrandDirectives
 * - getSkinDescription: enhanced with more specific finish descriptions
 * - hasBodyArt: improved word-boundary matching
 * - irisDescriptions: new detailed iris color map
 * - Deprecated aliases preserved until Phase 1b removes callers
 */

// ============================================================================
// BRAND NAME
// ============================================================================

export const BRAND_NAME = 'DRAPE';

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

export const MASTER_PROMPT_SYSTEM_INSTRUCTION = `
You are a world-class casting director for high-end fashion agencies.
Your task is to generate a casting specification with SPECIFIC, BOLD physical features.

OUTPUT FORMAT:
You must output a SINGLE JSON object containing exactly two keys: "natural_description" and "technical_schema".

1. "natural_description" (String):
   This is the MASTER PROMPT sent directly to an image generation model.
   The image model is LITERAL — it renders exactly what you describe. It does NOT
   interpret mood, vibe, or abstract concepts. If you write "editorially magnetic"
   it produces nothing. If you write "wide-set almond eyes with monolids" it produces
   exactly that.

   YOUR JOB: Be the creative casting director. Pick SPECIFIC, INTERESTING features
   that serve the brand. Then describe them as CONCRETE PHYSICAL SPECS.
   
   STRUCTURE YOUR OUTPUT LIKE THIS (as flowing prose, not bullet points):
   
   a) Opening: "Ultra realistic agency model caliber casting headshot of a [age]-year-old
      [gender] of [ethnicity] heritage."
   
   b) FACE — Pick specific values for EVERY feature. Be bold and distinctive:
      - Face shape (diamond, oval, heart, square, elongated, round)
      - Jawline (defined, angular, soft, sharp, tapered, square, narrow)
      - Cheekbones (high, prominent, forward-set, flat, wide, sculpted)
      - Cheek volume (slightly hollow, full, gaunt, balanced, fleshy)
      - Eye shape + set (wide-set, close-set, almond, round, hooded, monolid, upturned)
      - Nose (thin bridge, wide bridge, button, aquiline, low bridge, prominent, refined tip)
      - Lips (full, thin, wide, cupid's bow, pouty, pillowy, subtle)
      - Brows (thick natural, thin arched, straight, brushed up, sparse)
      - Any distinctive marks (freckles, beauty marks, asymmetry)
   
   c) EXPRESSION — Specific and physical, not abstract:
      - Eye gaze direction and intensity
      - Mouth position (closed, slightly parted, relaxed, pursed)
      - Overall bearing
   
   d) SKIN — Texture and finish in photographic terms:
      - Pore visibility, texture quality
      - Finish (matte, dewy, oily, natural)
      - Skin-level vellus fuzz: translucent, near-invisible, catches light only at extreme angles — NOT terminal hair, NOT stubble, NOT dark, NOT pigmented
   
   e) HAIR — Specific styling:
      - Cut, length, texture, color, styling details
   
   f) POSE & FRAMING (always the same):
      - Straight-on, square to camera, head straight with no tilt or turn
      - Shoulders level, spine straight, neck relaxed and elongated
      - Eyes looking directly into the camera lens
      - Light grey seamless background fills the entire frame — no black borders

   g) LIGHTING & CAMERA (always the same):
      - Bright direct on-camera flash, light grey seamless paper background
      - Sharp honest shadows, specular highlights on forehead/nose/cheekbones
      - Medium format sensor, 85mm equivalent, f/5.6-f/8
      - Bare skin, no clothing or straps

   CRITICAL RULES:
   - EVERY facial feature must have a SPECIFIC value — never leave anything vague
   - NO mood words as physical descriptions. "Editorially magnetic" is NOT a feature.
     "Wide-set almond eyes with subtle monolids" IS a feature.
   - NO "the face should feel like..." — describe what it LOOKS like
   - The description must be EXECUTABLE — an image model reading it should know
     exactly what to render for every part of the face
   - Be BOLD with feature choices. Fashion models have distinctive, memorable faces.
     At least 2-3 features should be pushed beyond average.
   - NO marketing fluff. NO "stunning", "beautiful", "gorgeous". Stay specific.
   - VARIETY: Each cast should feel like a DIFFERENT PERSON. Vary which features
     you push bold — don't always default to the same combinations. Two casts
     with the same brand + ethnicity should NOT produce similar feature sets.
   - EYE & HAIR COLOR: If the user specifies an unusual color (e.g. mint eyes on 
     East Asian, platinum hair on dark skin), describe it as NATURAL. Never write 
     "artificial", "colored contacts", "dyed-looking", or "unnatural." Treat every 
     user color choice as if the person was born with it. Write "mint green irises" 
     not "artificial mint green irises."
   
   LOCATION BOUNDARIES & GEOMETRY (CRITICAL):
   - When describing tattoos, scars, or birthmarks, specify precise limits AND
     geometric orientation relative to bone structure.

2. "technical_schema" (Object):
   A structured JSON object containing specific casting details.
   It MUST include these keys with values matching your description:
   
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

   SCHEMA RULES:
   - Every facial_features field MUST have a specific, descriptive value
   - Values must match what you wrote in the natural_description
   - No vague values like "natural" or "normal" — be specific

   SIGNAL PRIORITY HIERARCHY (CRITICAL):
   When multiple inputs describe the same physical feature, resolve conflicts:
   
   PRIORITY 1 — USER EXPLICIT FEATURES (ABSOLUTE):
   If the user set a specific value for any feature, that value is FINAL.
   Do NOT override it with brand archetype, ethnicity, or vibe.
   Example: "Porcelain / Pale" skin on a West African heritage subject means
   pale-skinned with West African bone structure.
   
   PRIORITY 2 — BRAND DIRECTION + ETHNICITY HERITAGE:
   For any feature NOT explicitly set by the user, use the brand direction
   to guide your creative choices. Use ethnicity to inform HOW those features
   manifest (e.g., "high cheekbones" on East Asian vs Nordic look different).
   
   PRIORITY 3 — VIBE / TONE (INTENSITY DIAL):
   Vibe descriptors control HOW EXTREME the features are.
   - High RUNWAY = push features to dramatic extremes
   - High COMMERCIAL = keep features attractive and approachable
   - High EDITORIAL = make unconventional, cerebral choices
   
   HARD RULE: Vibe NEVER overrides P1 user explicit features.
   
   CRITICAL: The natural_description must NEVER contain raw numbers,
   percentages, or control signal language. Physical features only.
`;

export const UPSCALE_PROMPT = `
Enhance extreme photorealism across all visible elements, especially skin, tattoos, hair, and eyes, sharpening micro detail, pores and texture, cleaning specular highlights, reflections and shadow falloff, and upgrading overall clarity to a high-resolution output while strictly preserving the original design, framing, pose, lighting style, color grade, mood and composition.

No creative changes are permitted during upscaling.
`;

// ============================================================================
// BRAND PROFILES
// ============================================================================

/**
 * Unified brand profiles used by both the prompt generator (detailed descriptors)
 * and the casting generator (short directive prefixes / expression direction).
 */
export const BRAND_PROFILES: Record<string, { descriptor: string }> = {
  'Gucci': {
    descriptor: `Gucci — Eclectic, quirky, unconventional beauty with retro-chic character. Favor interesting asymmetry, unusual proportions, faces with personality over perfection. Think: the charming oddness of a Wes Anderson cast. Not conventionally perfect, not severe. EXPRESSION: Knowing, slightly amused, detached — like they have an inside joke with the camera.`,
  },
  'Prada': {
    descriptor: `Prada — Intellectual, severe, cerebral minimalism. Sharp, precise, expensive-looking faces. The severity should feel refined, not brutal. EXPRESSION: Cold intellectual focus — flat, unreadable gaze. No warmth. The eyes of someone who finds you mildly uninteresting.`,
  },
  'Saint Laurent': {
    descriptor: `Saint Laurent — Rock n roll, heroin chic, effortless cool. Gaunt, angular faces that look sharp and slightly wasted. The bones should suggest late nights and no sleep. EXPRESSION: Bored, sleepy-eyed, heavy lids, slightly parted lips. Zero effort. Post-party cool.`,
  },
  'Balenciaga': {
    descriptor: `Balenciaga — Dystopian, brutalist, raw, street-cast. Push bone structure to extreme, almost alien proportions. The face should feel brutally honest and unconventional. EXPRESSION: Blank, confrontational, thousand-yard stare. No emotion, no performance. Like a passport photo from a dystopian state.`,
  },
  'Miu Miu': {
    descriptor: `Miu Miu — Subversive preppy, youthful, intellectual girlhood. No single archetype — casts eclectically. Do NOT default to severe or angular. The face must be memorably interesting — pick 2-3 features and make them bold and specific, let the rest be natural. Every Miu Miu model has something that makes you look twice. Lips tend toward full and soft. EXPRESSION: Deadpan, quietly observing, unbothered. Calm and still with intelligent eyes. Quiet bookish composure.`,
  },
  'Versace': {
    descriptor: `Versace — High octane glamour, bombshell, powerful beauty. Classically gorgeous, symmetrical, unapologetic supermodel beauty. Strong but feminine features. EXPRESSION: Direct, commanding, seductive — eyes locked on camera with full confidence. Chin slightly lifted.`,
  },
  'Zara': {
    descriptor: `Zara — Commercial, trendy, clean, universally appealing. Attractive and balanced without extremes. Should feel approachable and versatile. EXPRESSION: Approachable, pleasant, relaxed natural gaze. Friendly without being eager.`,
  },
  'Social Media': {
    descriptor: `Social Media — Authentic content creator, relatable beauty. Natural and unmanufactured. Attractive but trustworthy, not extreme. Real skin texture and character welcome. EXPRESSION: Warm, genuine, engaging. Eyes that connect directly. Slightly animated, like a still from a candid video.`,
  },
};

export const DEFAULT_BRAND_DESCRIPTOR =
  'High fashion editorial. Pick bold, specific, distinctive features for every part of the face.';

// ============================================================================
// STUDIO SETTINGS
// ============================================================================

const BASE_STUDIO_SETTINGS = `
VISUAL DIRECTIVES (NON-NEGOTIABLE):
1. BACKGROUND: Bright light grey seamless paper wall. No texture, no pattern, no vignettes, no corners.
2. LIGHTING: Direct on-camera flash or slightly off-axis front flash. Sharp honest light. Shadows fall directly behind. The light is bright and even with no colored gels or diffusion. How the skin RESPONDS to this light (specular, matte, dewy) is defined by the casting spec's skin finish — defer to that.
3. CAMERA: Medium format sensor (Hasselblad class). 85mm equivalent, f/5.6–f/8. Sensor ratio 3:4. Fine luminance-dominant noise — barely visible, like fine sand. No color noise.
4. COLOR/GRADE: Neutral daylight (5500K-5800K). Skin tones warm and dimensional with visible subsurface scattering. No stylized grading.
5. QUALITY: RAW REALISM with high micro-contrast — skin pores, vellus hair, and fine textures must have tactile, three-dimensional local contrast that makes surfaces feel physical. No CGI smoothness, no painterly softness, no excessive symmetry.
6. FACIAL FEATURES — MACRO-LEVEL RENDERING (these are what casting directors scrutinize):
   EYES:
   - IRIS TEXTURE: Render visible radial striations, fiber-like collagen structures, and color gradients within the iris. The iris is NOT a flat color disc — it has depth, with lighter tones near the pupil transitioning to richer saturation at the outer edge.
   - LIMBAL RING: A distinct dark ring where the iris meets the sclera. This is what makes eyes "pop" — it must be clearly rendered.
   - CATCHLIGHTS: One or two sharp, bright specular reflections from the studio flash must be visible on the cornea. These are small, crisp, and positioned naturally (typically upper portion of the iris). Without catchlights, eyes look dead.
   - CORNEAL GLOSS: The eye surface is wet. Render a subtle gloss/sheen across the cornea — visible but not overdone.
   - PUPIL: Natural size relative to lighting conditions (studio flash = moderately constricted). Sharp clean edge where pupil meets iris. Never oversized or dilated.
   - SCLERA: Not pure white — render with faint warm undertone, subtle vascularity near the corners. A perfectly white sclera looks synthetic.
   EYELASHES:
   - Render individual lash strands — not a solid dark mass. Natural lashes clump in irregular groups with varying length and slight curl variation.
   - Lashes should catch light individually and cast micro-shadows on the skin below the eye.
   - No mascara-heavy uniformity unless the spec explicitly requests it. Default is bare, natural lashes.
   LIPS:
   - Render vertical lip lines (plicae) and natural moisture gradients — wetter and glossier at the center, drier and more matte toward the edges.
   - Natural color variation from the vermillion border inward. Lips have topography, not a flat matte fill.
   - The lip border itself should be organic — slightly irregular, not a vector-sharp line.
   EYEBROWS:
   - Render individual hair strands with visible growth direction and varying thickness. Brow hairs are not a uniform block.
   - Natural gaps, overlapping strands, and subtle color variation from root to tip.
   - Hair direction should follow natural brow architecture: upward near the nose, arching laterally, tapering at the tail.
`;

const CLEAN_SKIN_RULE = `6. TATTOOS: STRICTLY CLEAN SKIN. NO TATTOOS, NO INK, NO BODY ART unless explicitly mandated by the specific casting features.`;

const TATTOO_PERSISTENCE_RULE = `6. TATTOO PERSISTENCE: Subject features permanent body art. RENDER WITH HIGH FIDELITY. DO NOT REMOVE. INK MUST SIT IN DERMIS AND BE VISIBLE.`;

export const hasBodyArt = (text: string): boolean => {
  const t = ` ${text.toLowerCase()} `; // pad for word-boundary matching
  return t.includes('tattoo') || t.includes(' ink ') || t.includes('body art') ||
    /\bwax seal\b/.test(t) || /\bbody branding\b/.test(t) ||
    /\bcalligraphy tattoo\b/.test(t);
};

export const getStudioSettings = (context: string) => {
  return `${BASE_STUDIO_SETTINGS}\n${hasBodyArt(context) ? TATTOO_PERSISTENCE_RULE : CLEAN_SKIN_RULE}`;
};

// ============================================================================
// BRAND EXPRESSION (for casting image generation)
// ============================================================================

/**
 * Brand-specific expression direction for casting photos.
 * These are CASTING PHOTO expressions — subtle, face-readable, never performative.
 * The face must remain neutral enough to evaluate bone structure and features.
 * Brand flavor is a whisper, not a pose.
 */
export const getBrandExpression = (brand: string): string => {
  const expressions: Record<string, string> = {
    'Gucci': 'EXPRESSION: Mouth closed, lips together and relaxed. Eyes direct into lens, steady and self-assured. No smile, no smirk.',
    'Prada': 'EXPRESSION: Mouth closed, flat. Eyes direct into lens, cool and measured. No warmth, no intensity.',
    'Saint Laurent': 'EXPRESSION: Mouth closed, relaxed. Eyes slightly heavy-lidded, effortless calm. No tension.',
    'Balenciaga': 'EXPRESSION: Mouth closed, neutral. Eyes direct into lens, completely blank. No emotion.',
    'Miu Miu': 'EXPRESSION: Mouth closed, soft. Eyes direct into lens, quietly alert and observant.',
    'Versace': 'EXPRESSION: Mouth closed, composed. Eyes direct into lens with quiet confidence. Face straight, no tilt.',
    'Zara': 'EXPRESSION: Mouth closed, relaxed. Eyes direct into lens, natural and approachable.',
    'Social Media': 'EXPRESSION: Mouth closed, soft. Eyes direct into lens, warm and genuine.',
  };
  return expressions[brand] || 'EXPRESSION: Mouth closed, neutral. Eyes direct into lens. Composed.';
};

// ============================================================================
// SKIN HELPERS
// ============================================================================

export const getSkinDescription = (texture?: string, finish?: string): string => {
  let textureDesc = "true photographic texture: visible pores, translucent vellus fuzz, natural subsurface scattering";
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
      textureDesc = "raw unretouched pores, translucent vellus fuzz, micro-imperfections, natural asymmetry";
      break;
  }

  switch (finish) {
    case 'Matte / Powdered':
      finishDesc = "velvet matte finish — skin absorbs light rather than reflecting it. NO specular hotspots, NO oil sheen, NO wet or dewy appearance anywhere on the face. Speculars are soft, diffused, and barely visible even on the forehead and nose tip. The skin looks powdered and dry";
      break;
    case 'Dewy / Sweat':
      finishDesc = "hyper-hydrated glaze — skin reflects light aggressively. Bright specular hotspots on forehead, nose tip, cheekbones, and upper lip. Visible moisture on the skin surface. The look is fresh, post-facial, almost wet";
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

// ============================================================================
// IRIS COLOR DESCRIPTIONS
// ============================================================================

/**
 * Detailed iris descriptions for each eye color option.
 * Used by prompt assembly to give the image model precise rendering instructions.
 */
export const irisDescriptions: Record<string, string> = {
  'Ice': 'pale icy blue with near-white inner ring, high translucency, cool silver undertone',
  'Sky': 'clear medium blue with subtle teal shifts, visible radial striations, bright and open',
  'Azure': 'deep saturated blue with navy outer ring, vivid cobalt mid-zone, striking contrast',
  'Navy': 'very dark blue, almost indigo — reads as dark with blue undertone only visible in direct light',
  'Grey': 'cool neutral grey with blue-silver undertone, visible darker grey striations through the iris',
  'Steel': 'dark gunmetal grey with metallic blue-silver flecks, cool and dense, low warmth',
  'Mint': 'pale green-grey with cool aqua undertone, unusual and striking, desaturated green',
  'Green': 'true forest green with golden-brown flecks near the pupil, warm-cool split',
  'Olive': 'muted green-brown with gold undertone, earthy and warm, chameleon quality',
  'Hazel': 'multi-tonal: amber-brown near pupil blending to green-grey at the outer iris, warm center cool edge',
  'Amber': 'warm golden-brown with honey translucency, catches light like amber resin, vivid and warm',
  'Honey': 'light warm brown with golden highlights, lighter than standard brown, sun-lit quality',
  'Brown': 'rich chocolate brown with visible depth variation, warmer at center, darker at limbal ring',
  'Dark': 'very deep brown, nearly black — iris detail only visible under direct light, subtle warm undertone',
  'Black': 'iris and pupil nearly indistinguishable, extremely dark with faint brown micro-texture only visible at macro distance',
};

