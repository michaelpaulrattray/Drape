/**
 * Shared constants for CastingStudio and its extracted components
 * 
 * This file centralizes all casting-related constants to:
 * - Avoid duplication across components
 * - Ensure consistency in options/values
 * - Improve maintainability
 */

// ============ Brand & Vibe ============

export const BRAND_OPTIONS = [
  { value: "Gucci", desc: "Eclectic / Quirky" },
  { value: "Prada", desc: "Intellectual / Severe" },
  { value: "Saint Laurent", desc: "Heroin Chic / Edgy" },
  { value: "Balenciaga", desc: "Brutalist / Street" },
  { value: "Miu Miu", desc: "Subversive / Youthful" },
  { value: "Versace", desc: "Glamour / Bombshell" },
  { value: "Zara", desc: "Trendy / Polished" },
  { value: "Social Media", desc: "Creator / Authentic" },
];

export const ETHNICITIES = [
  "Slavic", "Nordic", "East Asian", "South Asian",
  "Afro-Caribbean", "West African", "Latino",
  "Middle Eastern", "Mixed", "Polynesian"
];

// ============ Skin ============

export const SKIN_TONES = [
  { label: "Porcelain", value: "Porcelain / Pale", base: "#ffe0d6", shadow: "#eac0b0" },
  { label: "Fair", value: "Fair / Light", base: "#f5cbb6", shadow: "#dcb098" },
  { label: "Medium", value: "Medium / Olive", base: "#d9ae88", shadow: "#bf926b" },
  { label: "Tan", value: "Tan / Bronze", base: "#c08a65", shadow: "#a06d48" },
  { label: "Deep", value: "Deep / Brown", base: "#8d5e42", shadow: "#6b422a" },
  { label: "Ebony", value: "Ebony / Dark", base: "#593b2b", shadow: "#3d2316" },
];

export const SKIN_TEXTURES = ["Raw / Standard", "Glass / Perfect", "Freckled", "Textured / Acneic", "Mature"];
export const SKIN_FINISHES = ["Natural", "Matte / Powdered", "Dewy / Sweat", "Oily"];

// ============ Eyes ============

export const EYE_PRESETS = [
  { label: "Ice", hex: "#c4d6e0", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/awhMLmxIrioToOtD.png" },
  { label: "Sky", hex: "#8fb6cd", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/FlseOhpRliuvMbYW.png" },
  { label: "Azure", hex: "#4e7bb5", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/jDkDZBaWyRxXoXzg.png" },
  { label: "Navy", hex: "#283655", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/hyHYQcABgigtfLTG.png" },
  { label: "Grey", hex: "#9baec2", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/IliNZctazjBbuArn.png" },
  { label: "Steel", hex: "#687684", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/zRTUErdEfWCDvpZi.png" },
  { label: "Mint", hex: "#8caea0", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/sWJWzVFBwmzmBmLc.png" },
  { label: "Green", hex: "#4f6f46", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/GXpXcfyjyKJwqBiI.png" },
  { label: "Olive", hex: "#6e7039", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/yIVGalpveKoMCBbA.png" },
  { label: "Hazel", hex: "#947846", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/lsZyCJPxdNyQUukh.png" },
  { label: "Amber", hex: "#c49647", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/xdyXDoAPMTDZsHEG.png" },
  { label: "Honey", hex: "#b89650", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/fCZhpeTDeAOFaWmt.png" },
  { label: "Brown", hex: "#634e34", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/lAEQjgHkMacXaXgt.png" },
  { label: "Dark", hex: "#3b2b22", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/UCJxxqEDBlsmVOvD.png" },
  { label: "Black", hex: "#1c1c1c", image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/ZNXIoifWUSilVbcZ.png" },
];

// ============ Face ============

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

export const FACE_SHAPES = ["Oval", "Round", "Square", "Heart", "Diamond", "Random"];

// ============ Hair ============

export const HAIR_FAMILIES_FEMALE = [
  "Buzz / Shaved", "Pixie", "Cropped Bob", "Bob", "Lob (Long Bob)",
  "Medium Layers", "Long Layers", "Shag / Wolf", "Blunt Cut",
  "Updo", "Pulled Back", "Braids"
];

export const HAIR_FAMILIES_MALE = [
  "Buzz / Shaved", "Crew / Ivy League", "French Crop", "Caesar",
  "Short Textured", "Fade", "Undercut", "Slick Back",
  "Side Part", "Quiff", "Medium Layers", "Long Layers",
  "Curly Top", "Man Bun", "Braids / Locs"
];

export const HAIR_LENGTHS = ["Very Short", "Short", "Medium", "Long", "Very Long"];
export const HAIR_TEXTURES = ["Straight", "Slight Wave", "Wavy", "Curly", "Coily / Afro"];
export const HAIR_FRINGES = ["None", "Curtain Bangs", "Wispy Bangs", "Blunt Bangs", "Side-Swept", "Micro Fringe"];
export const HAIR_PARTINGS = ["Center", "Slight Off-Center", "Side", "Deep Side", "No Part / Slicked"];
export const HAIR_VOLUMES = ["Flat / Sleek", "Natural", "Voluminous", "Lifted Crown", "Face-Framing"];
export const HAIR_TUCKS = ["None", "One Side", "Both Sides"];
export const HAIR_FADES = ["None", "Low Taper", "Mid Fade", "High Fade", "Skin Fade"];

// ============ Body ============

export const BODY_TYPES = [
  { label: "Ultra Thin", value: "Ultra Thin" },
  { label: "Slim", value: "Slim" },
  { label: "Athletic", value: "Athletic" },
  { label: "Muscular", value: "Muscular" },
  { label: "Curvy", value: "Curvy" },
  { label: "Petite", value: "Petite" },
];

// ============ Credits ============

export const CREDIT_COSTS = {
  masterPrompt: 0,      // Included with castingImage
  castingImage: 350,    // Initial headshot generation (50x multiplier)
  fullBody: 300,        // Full body from headshot
  multiView: 300,       // Single view: side/walk/back
  iteration: 350,       // Surgical edit / iteration
  eraser: 350,          // Magic eraser
  upscale: 300,         // Upscale existing image
};

// ============ Types ============

export interface CastingVibe {
  editorial: number;
  commercial: number;
  runway: number;
}

export interface ModelPreferences {
  castingBrand: string;
  castingVibe: CastingVibe;
  gender: string;
  age: string;
  ethnicity: string;
  bodyType: string;
  faceShape: string;
  skinTone: string;
  skinTexture: string;
  skinFinish: string;
  eyeColor: string;
  hairColor: string;
  hairStyle: string;
  hairLength: string;
  hairTexture: string;
  hairFringe: string;
  hairParting: string;
  hairVolume: string;
  hairFlyaways: string;
  hairHairline: string;
  hairTuck: string;
  hairFade: string;
  facialHair: string;
  jawline: string;
  cheekbones: string;
  cheeks: string;
  eyeShape: string;
  noseShape: string;
  lipShape: string;
  eyebrowStyle: string;
  features: string;
  referenceImage?: string;
  userPrompt: string;
  ethnicityBlend?: { name: string; pct: number }[];
}

export interface GeneratedAsset {
  id: number;
  viewType: string;
  storageUrl: string;
}

export interface Amendment {
  text: string;
  view: string;
  version: number;
  timestamp: number;
}

export interface GenerationState {
  isGenerating: boolean;
  currentStep: string;
  error: string | null;
  progress?: number;
  startTime?: number;
  estimatedDuration?: number;
  identityWarning?: string | null;
}

export type EditTool = 'none' | 'surgical' | 'eraser';

export enum ImageResolution {
  STD = '1K',
  HIGH = '2K',
  ULTRA = '4K',
}

export type EyePreset = typeof EYE_PRESETS[number];
export type SkinTone = typeof SKIN_TONES[number];
export type BrandOption = typeof BRAND_OPTIONS[number];
