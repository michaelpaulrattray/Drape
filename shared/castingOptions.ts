/**
 * Casting option lists + the preference randomizer — single source of truth,
 * shared client/server (R2 constants dedupe; D-14 requires the randomizer to
 * be server-callable for the parser's random-intent path).
 *
 * Visual decoration (hex swatches, eye-color images, brand descriptions)
 * stays client-side in `features/casting/constants.ts`, built on these
 * values. Labels here are the canonical enum spellings the parser, the
 * engine prompts, and the chips all share — change them only in lockstep
 * with PARSER_PROMPT_V2.md.
 */

export const CASTING_BRANDS = [
  "Gucci", "Prada", "Saint Laurent", "Balenciaga",
  "Miu Miu", "Versace", "Zara", "Social Media",
] as const;

// Mediterranean added for the parser (PARSER_PROMPT_V2 §6) — Italian/Spanish/
// Greek/Portuguese prompts previously had no enum home.
export const ETHNICITIES = [
  "Slavic", "Nordic", "Mediterranean", "East Asian", "South Asian",
  "Afro-Caribbean", "West African", "Latino",
  "Middle Eastern", "Polynesian",
];

export const SKIN_TONE_VALUES = [
  "Porcelain / Pale", "Fair / Light", "Medium / Olive",
  "Tan / Bronze", "Deep / Brown", "Ebony / Dark",
];

export const SKIN_TEXTURES = ["Raw / Standard", "Glass / Perfect", "Freckled", "Textured / Acneic", "Mature"];
export const SKIN_FINISHES = ["Natural", "Matte / Powdered", "Dewy / Sweat", "Oily"];

export const EYE_COLORS = [
  "Ice", "Sky", "Azure", "Navy", "Grey", "Steel", "Mint", "Green",
  "Olive", "Hazel", "Amber", "Honey", "Brown", "Dark", "Black",
];

export const CORE_FACE_SHAPES = ["Oval", "Round", "Square", "Heart", "Diamond"];

export const CHAR_OPTIONS = {
  jawline: ["Sharp / Chiseled", "Soft / Rounded", "Strong / Pronounced", "Receding / Weak", "Snatched"],
  cheekbones: ["High", "Defined", "Soft"],
  cheeks: ["Slightly Hollow", "Full", "Balanced"],
  eyeShape: ["Thin Almond", "Monolids", "Wide-Set", "Round", "Hooded"],
  noseShape: ["Thin", "Straight Bridge", "Rounded", "Prominent", "Button"],
  lipShape: ["Full", "Subtle", "Lip Lift", "Wide", "Cupid's Bow"],
  eyebrows: ["Brushed Up", "Straight", "Arched", "Bold", "Bleached", "Random"],
  facialHair: ["Clean Shaven", "Stubble", "Short Beard", "Full Beard"],
};

export const HAIR_FAMILIES_FEMALE = [
  "Buzz / Shaved", "Pixie", "Cropped Bob", "Bob", "Lob (Long Bob)",
  "Medium Layers", "Long Layers", "Shag / Wolf", "Blunt Cut",
  "Updo", "Pulled Back", "Braids",
];

export const HAIR_FAMILIES_MALE = [
  "Buzz / Shaved", "Crew / Ivy League", "French Crop", "Caesar",
  "Short Textured", "Fade", "Undercut", "Slick Back",
  "Side Part", "Quiff", "Medium Layers", "Long Layers",
  "Curly Top", "Man Bun", "Braids / Locs",
];

export const HAIR_LENGTHS = ["Very Short", "Short", "Medium", "Long", "Very Long"];
export const HAIR_TEXTURES = ["Straight", "Slight Wave", "Wavy", "Curly", "Coily / Afro"];
export const HAIR_FRINGES = ["None", "Curtain Bangs", "Wispy Bangs", "Blunt Bangs", "Side-Swept", "Micro Fringe"];
export const HAIR_PARTINGS = ["Center", "Slight Off-Center", "Side", "Deep Side", "No Part / Slicked"];
export const HAIR_VOLUMES = ["Flat / Sleek", "Natural", "Voluminous", "Lifted Crown", "Face-Framing"];
export const HAIR_TUCKS = ["None", "One Side", "Both Sides"];
export const HAIR_FADES = ["None", "Low Taper", "Mid Fade", "High Fade", "Skin Fade"];

export const NATURAL_HAIR_COLORS = [
  "Jet Black", "Off Black", "Dark Brown", "Med. Brown", "Light Brown",
  "Auburn", "Copper", "Strawberry", "Dark Blonde", "Golden Blonde",
  "Ash Blonde", "Platinum", "White", "Silver", "Salt & Pepper", "Grey",
];

export const DYED_HAIR_COLORS = [
  "Pearl", "Pastel Pink", "Hot Pink", "Magenta", "Purple", "Violet",
  "Lilac", "Indigo", "Blue", "Teal", "Mint", "Emerald", "Lime",
  "Yellow", "Orange", "Peach", "Coral", "Red", "Burgundy",
];

export const BODY_TYPE_VALUES = ["Ultra Thin", "Slim", "Athletic", "Muscular", "Curvy", "Petite"];

/** Ethnicity blend entry — max 2 per cast (engine limit). */
export interface EthnicityBlendEntry {
  name: string;
  pct: number;
}

/**
 * Full-random preference set — ported verbatim from the client helper so the
 * server's random-intent path (D-14) and the studio's Randomize button
 * produce identical distributions. The randomizer's hair-color list is
 * intentionally its own (legacy behavior preserved — do not "fix" it to the
 * enum lists without a founder ruling on generation-behavior change).
 */
export function generateRandomPreferences(): Record<string, unknown> {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const gender = pick(["Male", "Female"]);
  const hairFamilies = gender === "Male" ? HAIR_FAMILIES_MALE : HAIR_FAMILIES_FEMALE;

  const editorial = Math.random();
  const commercial = Math.random() * (1 - editorial);
  const runway = 1 - editorial - commercial;

  // Generate ethnicity blend first, then derive legacy string from it
  const eth1 = pick(ETHNICITIES);
  const isBlend = Math.random() < 0.3;
  const eth2 = isBlend ? pick(ETHNICITIES.filter((e) => e !== eth1)) : null;
  const ethnicityBlend: EthnicityBlendEntry[] = eth2
    ? [{ name: eth1, pct: 60 }, { name: eth2, pct: 40 }]
    : [{ name: eth1, pct: 100 }];
  const ethnicity = ethnicityBlend.map((e) => e.name).join(", ");

  return {
    castingBrand: pick(CASTING_BRANDS),
    castingVibe: { editorial, commercial, runway },
    gender,
    age: String(Math.floor(Math.random() * 20) + 18),
    ethnicity,
    ethnicityBlend,
    bodyType: pick(BODY_TYPE_VALUES),
    faceShape: pick(CORE_FACE_SHAPES),
    skinTone: pick(SKIN_TONE_VALUES),
    skinTexture: pick(SKIN_TEXTURES),
    skinFinish: pick(SKIN_FINISHES),
    eyeColor: pick(EYE_COLORS),
    hairColor: pick(["Jet Black", "Dark Brown", "Chestnut", "Auburn", "Blonde", "Platinum", "Copper", "Silver"]),
    hairStyle: pick(hairFamilies),
    hairLength: pick(HAIR_LENGTHS),
    hairTexture: pick(HAIR_TEXTURES),
    hairFringe: pick(HAIR_FRINGES),
    hairParting: pick(HAIR_PARTINGS),
    hairVolume: pick(HAIR_VOLUMES),
    hairTuck: pick(HAIR_TUCKS),
    hairFade: gender === "Male" ? pick(HAIR_FADES) : "None",
    facialHair: gender === "Male" ? pick(CHAR_OPTIONS.facialHair) : "",
    jawline: pick(CHAR_OPTIONS.jawline),
    cheekbones: pick(CHAR_OPTIONS.cheekbones),
    cheeks: pick(CHAR_OPTIONS.cheeks),
    eyeShape: pick(CHAR_OPTIONS.eyeShape),
    noseShape: pick(CHAR_OPTIONS.noseShape),
    lipShape: pick(CHAR_OPTIONS.lipShape),
    eyebrowStyle: pick(CHAR_OPTIONS.eyebrows),
    features: "",
    userPrompt: "",
  };
}
