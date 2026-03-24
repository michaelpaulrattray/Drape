/**
 * Gemini Service - Types & Enums
 * Shared type definitions for all Gemini modules.
 */

export interface ModelPreferences {
  gender?: string;
  age?: number | string;
  ethnicity?: string;
  ethnicityBlend?: Array<{ name: string; pct: number }>;
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
  STANDARD = "1K",
  HIGH = "2K",
  ULTRA = "4K"
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

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}
