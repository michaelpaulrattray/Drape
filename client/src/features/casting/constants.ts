/**
 * Shared constants for CastingStudio and its extracted components
 * 
 * This file centralizes all casting-related constants to:
 * - Avoid duplication across components
 * - Ensure consistency in options/values
 * - Improve maintainability
 */

import { ASSETS_BASE_URL } from "@shared/const";
import { CORE_FACE_SHAPES } from "@shared/castingOptions";

// Canonical value lists live in shared/castingOptions.ts (R2 dedupe — the
// server parser + randomizer read the same source). This file adds the
// client-only decoration: hex swatches, images, brand descriptions.
export {
  ETHNICITIES,
  SKIN_TEXTURES,
  SKIN_FINISHES,
  CHAR_OPTIONS,
  HAIR_FAMILIES_FEMALE,
  HAIR_FAMILIES_MALE,
  HAIR_LENGTHS,
  HAIR_TEXTURES,
  HAIR_FRINGES,
  HAIR_PARTINGS,
  HAIR_VOLUMES,
  HAIR_TUCKS,
  HAIR_FADES,
} from "@shared/castingOptions";

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

// ============ Skin ============

export const SKIN_TONES = [
  { label: "Porcelain", value: "Porcelain / Pale", base: "#ffe0d6", shadow: "#eac0b0" },
  { label: "Fair", value: "Fair / Light", base: "#f5cbb6", shadow: "#dcb098" },
  { label: "Medium", value: "Medium / Olive", base: "#d9ae88", shadow: "#bf926b" },
  { label: "Tan", value: "Tan / Bronze", base: "#c08a65", shadow: "#a06d48" },
  { label: "Deep", value: "Deep / Brown", base: "#8d5e42", shadow: "#6b422a" },
  { label: "Ebony", value: "Ebony / Dark", base: "#593b2b", shadow: "#3d2316" },
];

// ============ Eyes ============

export const EYE_PRESETS = [
  { label: "Ice", hex: "#c4d6e0", image: `${ASSETS_BASE_URL}/eye-colors/ice.png` },
  { label: "Sky", hex: "#8fb6cd", image: `${ASSETS_BASE_URL}/eye-colors/sky.png` },
  { label: "Azure", hex: "#4e7bb5", image: `${ASSETS_BASE_URL}/eye-colors/azure.png` },
  { label: "Navy", hex: "#283655", image: `${ASSETS_BASE_URL}/eye-colors/navy.png` },
  { label: "Grey", hex: "#9baec2", image: `${ASSETS_BASE_URL}/eye-colors/grey.png` },
  { label: "Steel", hex: "#687684", image: `${ASSETS_BASE_URL}/eye-colors/steel.png` },
  { label: "Mint", hex: "#8caea0", image: `${ASSETS_BASE_URL}/eye-colors/mint.png` },
  { label: "Green", hex: "#4f6f46", image: `${ASSETS_BASE_URL}/eye-colors/green.png` },
  { label: "Olive", hex: "#6e7039", image: `${ASSETS_BASE_URL}/eye-colors/olive.png` },
  { label: "Hazel", hex: "#947846", image: `${ASSETS_BASE_URL}/eye-colors/hazel.png` },
  { label: "Amber", hex: "#c49647", image: `${ASSETS_BASE_URL}/eye-colors/amber.png` },
  { label: "Honey", hex: "#b89650", image: `${ASSETS_BASE_URL}/eye-colors/honey.png` },
  { label: "Brown", hex: "#634e34", image: `${ASSETS_BASE_URL}/eye-colors/brown.png` },
  { label: "Dark", hex: "#3b2b22", image: `${ASSETS_BASE_URL}/eye-colors/dark.png` },
  { label: "Black", hex: "#1c1c1c", image: `${ASSETS_BASE_URL}/eye-colors/black.png` },
];

// ============ Face ============

// "Random" is a client-only affordance in the face-shape picker
export const FACE_SHAPES = [...CORE_FACE_SHAPES, "Random"];

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
  // Parser override fields (PARSER_PROMPT_V2 §4): verbatim user descriptions
  // that the engine prefers over the enum value when present
  hairStyleOverride?: string;
  hairColorOverride?: string;
  eyeColorOverride?: string;
  facialHairOverride?: string;
  skinTextureOverride?: string;
  castingBrandOverride?: string;
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

type EyePreset = typeof EYE_PRESETS[number];
type SkinTone = typeof SKIN_TONES[number];
type BrandOption = typeof BRAND_OPTIONS[number];
