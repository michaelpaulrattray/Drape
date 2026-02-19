/**
 * Drape AI Service
 * Wrapper around geminiService for tRPC integration
 * Uses Google Gemini API directly with exact same models as reference app
 */

import * as gemini from "./geminiService";
import { storagePut } from "../storage";

// Re-export types and utilities from geminiService
export type { ModelPreferences } from "./geminiService";
export { ImageResolution, AspectRatio, GenerationMode } from "./geminiService";
export { clearCastingSession } from "./geminiService";
export { updateSchemaForIteration, reconcileSchemaWithImage } from "./geminiService";
export { generateCastingSuggestions, analyzeReferenceForTransfer } from "./geminiService";
export { compactMasterPrompt } from "./geminiService";

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

// ============ Credit Costs ============
// 1 credit ≈ $0.01 | Pro model costs, Flash fallback = 50% cost

export const CREDIT_COSTS = {
  // Generation costs (Pro model) — 50x display multiplier applied
  castingImage: 350,   // Initial headshot generation (Text Pro + Image Pro)
  fullBody: 300,       // Full body from headshot (Image Pro)
  multiView: 300,      // Single view: side/walk/back (Image Pro)
  allViews: 900,       // All 3 views at once (Image Pro x3)
  iterate: 350,        // Surgical edit / iteration (Text Pro + Image Pro)
  eraser: 350,         // Magic eraser (Text Pro + Image Pro)
  upscale: 300,        // Upscale existing image (Image Pro)
  exportPack: 1500,    // Full export pack (Image Pro x5)
  
  // Flash fallback multiplier (50% of Pro cost)
  flashMultiplier: 0.5,
};

// Legacy alias for backward compatibility during migration
export const POINT_COSTS = CREDIT_COSTS;

/**
 * Calculate actual credit cost based on engine used
 * Flash fallback gets 50% discount
 */
export function calculateCreditCost(baseCost: number, engineUsed?: string): number {
  if (engineUsed && engineUsed.includes('flash')) {
    return Math.ceil(baseCost * CREDIT_COSTS.flashMultiplier);
  }
  return baseCost;
}

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

/**
 * Composite mask overlay with base image
 * Takes a transparent PNG with red mask strokes and composites it over the base image
 */
async function compositeMaskWithImage(baseImageBase64: string, maskBase64: string): Promise<string> {
  // Import sharp for image compositing (server-side)
  const sharp = await import('sharp');
  
  // Extract base64 data from data URLs
  const baseData = baseImageBase64.replace(/^data:.*?;base64,/, "");
  const maskData = maskBase64.replace(/^data:.*?;base64,/, "");
  
  const baseBuffer = Buffer.from(baseData, 'base64');
  const maskBuffer = Buffer.from(maskData, 'base64');
  
  // Get base image dimensions
  const baseMetadata = await sharp.default(baseBuffer).metadata();
  
  // Resize mask to match base image dimensions if needed
  const resizedMask = await sharp.default(maskBuffer)
    .resize(baseMetadata.width, baseMetadata.height, { fit: 'fill' })
    .toBuffer();
  
  // Composite mask over base image
  const composited = await sharp.default(baseBuffer)
    .composite([{ input: resizedMask, blend: 'over' }])
    .png()
    .toBuffer();
  
  // Return as base64 data URL
  return `data:image/png;base64,${composited.toString('base64')}`;
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
    ethnicityHint?: string;
  } = {}
): Promise<GenerationResult> {
  console.log('[aiService.generateCastingImage] Starting with options:', {
    castingBrand: options.castingBrand,
    frame: options.frame,
    hasReferenceImage: !!options.referenceImage,
    mode: options.mode,
  });
  
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
    options.maskImage,
    options.ethnicityHint
  );

  console.log('[aiService.generateCastingImage] Result received:', {
    hasImageUrl: !!result.imageUrl,
    engineUsed: result.engineUsed,
  });

  // Upload base64 to S3 for persistent storage
  const s3Url = await uploadBase64ToS3(result.imageUrl, "casting");

  console.log('[aiService.generateCastingImage] Uploaded to S3:', s3Url.substring(0, 80) + '...');

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
    engineUsed: 'gemini-3-pro-image-preview', // May be flash fallback but we don't track here
  };
}

/**
 * Generate a single view (side, walk, or back)
 * This generates only the requested view instead of all 3 at once
 */
export async function generateRemainingViews(
  masterPrompt: string,
  sourceImageUrl: string,
  gender: string,
  viewType: 'side' | 'back' | 'walk'
): Promise<GenerationResult> {
  // If sourceImageUrl is an S3 URL, we need to fetch it and convert to base64
  let sourceBase64 = sourceImageUrl;
  if (sourceImageUrl.startsWith('http')) {
    const response = await fetch(sourceImageUrl);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    sourceBase64 = `data:image/png;base64,${base64}`;
  }

  // Use the new single view generation function
  const result = await gemini.generateSingleView(masterPrompt, sourceBase64, gender, viewType);

  // Upload base64 to S3 for persistent storage
  const s3Url = await uploadBase64ToS3(result.imageUrl, viewType);

  return {
    imageUrl: s3Url,
    engineUsed: result.engineUsed,
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
    maskBase64?: string; // Base64 encoded mask overlay from frontend (transparent PNG with red strokes)
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

  // Composite the mask overlay with the base image if provided
  let effectiveMask: string | undefined;
  if (options.maskBase64 || options.maskImage) {
    const maskData = options.maskBase64 || options.maskImage;
    // The frontend now sends just the mask strokes on transparent background
    // We need to composite it with the base image to create the guide overlay
    effectiveMask = await compositeMaskWithImage(currentBase64, maskData!);
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
    effectiveMask // Use the composited mask overlay
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
