/**
 * FormaStudio AI Service
 * Wrapper around geminiService for tRPC integration
 * Uses Google Gemini API directly with exact same models as reference app
 */

import * as gemini from "./geminiService";
import { storagePut } from "./storage";

// Re-export types from geminiService
export type { ModelPreferences } from "./geminiService";
export { ImageResolution, AspectRatio, GenerationMode } from "./geminiService";

// ============ Types ============

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
}

export interface GenerationResult {
  imageUrl: string;
  engineUsed?: string;
}

// ============ Point Costs ============

export const POINT_COSTS = {
  castingImage: 12,  // Headshot generation
  fullBody: 8,       // Full body from headshot
  multiView: 15,     // Side + Back views
  iterate: 5,        // Iteration/refinement
  upscale: 3,        // Upscale existing image
};

// ============ Helper Functions ============

/**
 * Convert base64 data URL to S3 URL
 */
async function uploadBase64ToS3(base64DataUrl: string, prefix: string): Promise<string> {
  const base64Data = base64DataUrl.replace(/^data:.*?;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  const filename = `${prefix}/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
  const { url } = await storagePut(filename, buffer, "image/png");
  return url;
}

// ============ Main Functions ============

/**
 * Generate master prompt from model preferences
 */
export async function generateMasterPrompt(
  preferences: gemini.ModelPreferences,
  mode: 'NEW' | 'ITERATE' | 'REFERENCE' = 'NEW'
): Promise<MasterPrompt> {
  const result = await gemini.generateMasterPrompt(preferences, mode);
  
  return {
    naturalDescription: result.natural,
    technicalSchema: result.schema,
  };
}

/**
 * Enhance user prompt for iteration
 */
export async function enhanceUserPrompt(originalPrompt: string): Promise<string> {
  return gemini.enhanceUserPrompt(originalPrompt);
}

/**
 * Generate casting image (headshot)
 */
export async function generateCastingImage(
  masterPrompt: string,
  options: {
    referenceImage?: string;
    resolution?: gemini.ImageResolution;
    aspectRatio?: gemini.AspectRatio;
    mode?: gemini.GenerationMode;
    iterationRequest?: string;
    additionalReference?: string;
    castingBrand?: string;
    frame?: 'HEADSHOT' | 'FULL_BODY';
    castingVibe?: { editorial: number; commercial: number; runway: number };
    maskImage?: string;
  } = {}
): Promise<GenerationResult> {
  const result = await gemini.generateCastingImage(
    masterPrompt,
    options.referenceImage,
    options.resolution || gemini.ImageResolution.STANDARD,
    options.aspectRatio || gemini.AspectRatio.PORTRAIT,
    options.mode || gemini.GenerationMode.NEW,
    options.iterationRequest,
    options.additionalReference,
    options.castingBrand || 'Generic',
    options.frame || 'HEADSHOT',
    options.castingVibe,
    options.maskImage
  );

  // Upload base64 to S3 for persistent storage
  const s3Url = await uploadBase64ToS3(result.imageUrl, "casting");

  return {
    imageUrl: s3Url,
    engineUsed: result.engineUsed,
  };
}

/**
 * Generate full body shot from headshot
 */
export async function generateFullBody(
  masterPrompt: string,
  headshotUrl: string,
  gender: string
): Promise<GenerationResult> {
  // If headshotUrl is an S3 URL, we need to fetch it and convert to base64
  let headshotBase64 = headshotUrl;
  if (headshotUrl.startsWith('http')) {
    const response = await fetch(headshotUrl);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    headshotBase64 = `data:image/png;base64,${base64}`;
  }

  const base64Result = await gemini.generateFullBody(masterPrompt, headshotBase64, gender);

  // Upload base64 to S3 for persistent storage
  const s3Url = await uploadBase64ToS3(base64Result, "fullbody");

  return {
    imageUrl: s3Url,
    engineUsed: 'gemini-3-pro-image-preview',
  };
}

/**
 * Generate remaining views (side, back)
 */
export async function generateRemainingViews(
  masterPrompt: string,
  sourceImageUrl: string,
  gender: string,
  viewType: 'side' | 'back'
): Promise<GenerationResult> {
  // If sourceImageUrl is an S3 URL, we need to fetch it and convert to base64
  let sourceBase64 = sourceImageUrl;
  if (sourceImageUrl.startsWith('http')) {
    const response = await fetch(sourceImageUrl);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    sourceBase64 = `data:image/png;base64,${base64}`;
  }

  const views = await gemini.generateRemainingViews(masterPrompt, sourceBase64, gender);

  // Get the requested view
  let base64Result: string | undefined;
  if (viewType === 'side') {
    base64Result = views.sideClose || views.sideFull;
  } else {
    base64Result = views.backFull;
  }

  if (!base64Result) {
    throw new Error(`Failed to generate ${viewType} view`);
  }

  // Upload base64 to S3 for persistent storage
  const s3Url = await uploadBase64ToS3(base64Result, viewType);

  return {
    imageUrl: s3Url,
    engineUsed: 'gemini-3-pro-image-preview',
  };
}

/**
 * Iterate on existing image
 */
export async function iterateModel(
  masterPrompt: string,
  currentImageUrl: string,
  iterationRequest: string,
  options: {
    maskImage?: string;
    additionalReference?: string;
    frame?: 'HEADSHOT' | 'FULL_BODY';
    castingBrand?: string;
  } = {}
): Promise<GenerationResult> {
  // If currentImageUrl is an S3 URL, we need to fetch it and convert to base64
  let currentBase64 = currentImageUrl;
  if (currentImageUrl.startsWith('http')) {
    const response = await fetch(currentImageUrl);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    currentBase64 = `data:image/png;base64,${base64}`;
  }

  const result = await gemini.generateCastingImage(
    masterPrompt,
    currentBase64,
    gemini.ImageResolution.STANDARD,
    gemini.AspectRatio.PORTRAIT,
    gemini.GenerationMode.ITERATE,
    iterationRequest,
    options.additionalReference,
    options.castingBrand || 'Generic',
    options.frame || 'HEADSHOT',
    undefined,
    options.maskImage
  );

  // Upload base64 to S3 for persistent storage
  const s3Url = await uploadBase64ToS3(result.imageUrl, "iterate");

  return {
    imageUrl: s3Url,
    engineUsed: result.engineUsed,
  };
}

/**
 * Upscale existing image
 */
export async function upscaleImage(
  currentImageUrl: string,
  targetResolution: gemini.ImageResolution
): Promise<GenerationResult> {
  // If currentImageUrl is an S3 URL, we need to fetch it and convert to base64
  let currentBase64 = currentImageUrl;
  if (currentImageUrl.startsWith('http')) {
    const response = await fetch(currentImageUrl);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    currentBase64 = `data:image/png;base64,${base64}`;
  }

  const result = await gemini.upscaleExistingImage(currentBase64, targetResolution);

  // Upload base64 to S3 for persistent storage
  const s3Url = await uploadBase64ToS3(result.imageUrl, "upscale");

  return {
    imageUrl: s3Url,
    engineUsed: result.engineUsed,
  };
}
