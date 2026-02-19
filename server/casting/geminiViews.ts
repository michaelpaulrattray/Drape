/**
 * Gemini Views - Full body generation, multi-view generation,
 * single view generation, and image upscaling.
 *
 * Migration Phase 1c: Updated with shared response helpers.
 * - Uses extractImageFromResponse / diagnoseResponse / safeResponseText
 * - Uses withTimeout / withSingleRetry503 for resilience
 * - Uses buildIdentityAnchor for identity consistency
 */

import type { ModelViews, GeminiPart } from "./geminiTypes";
import { ImageResolution, AspectRatio } from "./geminiTypes";
import {
  getAiClient,
  SAFETY_SETTINGS,
  extractMimeType,
  extractBase64Data,
  formatGeminiError,
  extractImageFromResponse,
  diagnoseResponse,
  safeResponseText,
  withTimeout,
  withSingleRetry503,
  buildIdentityAnchor,
} from "./geminiClient";
import { withImageQueue } from "./geminiQueue";
import { validateNotPlaceholder } from "./placeholderDetection";
import { UPSCALE_PROMPT, getStudioSettings } from "./geminiPrompts";

// ============================================================================
// GENERATE FULL BODY
// ============================================================================

/**
 * Generate full body shot from headshot
 */
export const generateFullBody = async (
  masterPrompt: string,
  headshotUrl: string,
  gender: string,
  technicalSchema?: any,
  bodyType?: string
): Promise<string> => {
  return withImageQueue(async () => {
  const ai = getAiClient();
  const mimeType = extractMimeType(headshotUrl);
  const base64Data = extractBase64Data(headshotUrl);

  const dynamicStudioSettings = getStudioSettings(masterPrompt);
  const identityAnchor = buildIdentityAnchor(masterPrompt, technicalSchema);

  const normalizedGender = gender.trim().toLowerCase();
  let wardrobeConstraint = "";

  if (normalizedGender === 'male') {
    wardrobeConstraint = "Attire: Simple black boxer briefs. BARE CHEST.";
  } else if (normalizedGender === 'non-binary') {
    wardrobeConstraint = "Attire: Minimalist black tank top and fitted black shorts.";
  } else {
    wardrobeConstraint = "Attire: Minimalist form-fitting black activewear (sports bra and shorts).";
  }

  const physiqueDirective = bodyType && bodyType !== 'Slim'
    ? `PHYSIQUE: ${bodyType} build. The subject's body proportions MUST reflect this — it is a deliberate casting choice.`
    : '';

  const promptText = `
      TASK: GENERATE FULL BODY STANDING SHOT from the provided headshot reference.

      ${identityAnchor}
      ${physiqueDirective}

      THE ATTACHED IMAGE IS THE HEADSHOT OF THIS EXACT PERSON.
      The full body shot MUST show the same person — identical face, skin tone, and any visible tattoos/marks.
      If there is ANY doubt about the FACE, match the reference image over the text description.

      VIEW: FULL BODY FRONT FACING. Head to toe visible.
      ${wardrobeConstraint}
      ${dynamicStudioSettings}
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
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: AspectRatio.PORTRAIT },
        safetySettings: SAFETY_SETTINGS
      }
    });

    const diagnosis = diagnoseResponse(response);
    if (diagnosis) throw new Error(diagnosis);

    const imageUrl = extractImageFromResponse(response);
    if (!imageUrl) {
      const text = safeResponseText(response);
      if (text) throw new Error(`Refusal: ${text.slice(0, 80)}...`);
      throw new Error("No image returned.");
    }
    validateNotPlaceholder(imageUrl);
    return imageUrl;
  };

  const BODY_MODELS = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];

  for (let i = 0; i < BODY_MODELS.length; i++) {
    const model = BODY_MODELS[i];
    try {
      return await withSingleRetry503(
        () => withTimeout(executeBodyGen(model), 60000, `FullBody (${model})`),
        `FullBody (${model})`
      );
    } catch (e: any) {
      console.warn(`[FullBody] ${model} failed:`, e?.message);
      if (i === BODY_MODELS.length - 1) {
        throw new Error(formatGeminiError(e));
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  throw new Error('Full body generation failed across all models.');
  }, 'generateFullBody');
};

// ============================================================================
// GENERATE REMAINING VIEWS (BATCH)
// ============================================================================

/**
 * Generate remaining views (side, back) — all 3 in parallel
 */
export const generateRemainingViews = async (
  masterPrompt: string,
  sourceImageUrl: string,
  gender: string,
  technicalSchema?: any
): Promise<Partial<ModelViews>> => {
  return withImageQueue(async () => {
  const ai = getAiClient();
  const mimeType = extractMimeType(sourceImageUrl);
  const base64Data = extractBase64Data(sourceImageUrl);

  const dynamicStudioSettings = getStudioSettings(masterPrompt);
  const identityAnchor = buildIdentityAnchor(masterPrompt, technicalSchema);

  const normalizedGender = gender.trim().toLowerCase();
  let wardrobeConstraint: string;
  if (normalizedGender === 'male') {
    wardrobeConstraint = "Attire: Simple black boxer briefs. BARE CHEST.";
  } else if (normalizedGender === 'non-binary') {
    wardrobeConstraint = "Attire: Minimalist black tank top and fitted black shorts.";
  } else {
    wardrobeConstraint = "Attire: Minimalist black activewear.";
  }

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
            { text: `STRICT CHARACTER CONSISTENCY REQUIRED.\nReference image provided.\nTASK: ${config.prompt}\n\n${identityAnchor}\n\nTHE ATTACHED IMAGE IS THIS EXACT PERSON. Match their face, skin, and any tattoos/marks precisely.\n\n${dynamicStudioSettings}` }
          ]
        },
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: AspectRatio.PORTRAIT },
          safetySettings: SAFETY_SETTINGS
        }
      });

      const diagnosis = diagnoseResponse(response);
      if (diagnosis) throw new Error(diagnosis);

      const imageUrl = extractImageFromResponse(response);
      if (!imageUrl) throw new Error("No image");
      validateNotPlaceholder(imageUrl);
      return { key: config.key, url: imageUrl };
    };

    const VIEW_MODELS = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];

    for (let i = 0; i < VIEW_MODELS.length; i++) {
      try {
        return await withSingleRetry503(
          () => withTimeout(executeViewGen(VIEW_MODELS[i]), 60000, `View:${config.key} (${VIEW_MODELS[i]})`),
          `View:${config.key} (${VIEW_MODELS[i]})`
        );
      } catch (e: any) {
        console.warn(`[View:${config.key}] ${VIEW_MODELS[i]} failed:`, e?.message);
        if (i < VIEW_MODELS.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }
    return null;
  };

  const promises = viewConfigs.map(cfg => generateView(cfg));
  const generatedViews = await Promise.all(promises);

  generatedViews.forEach(v => {
    if (v) {
      (results as any)[v.key] = v.url;
    }
  });

  return results;
  }, 'generateRemainingViews');
};

// ============================================================================
// GENERATE SINGLE VIEW
// ============================================================================

/**
 * Generate a single view (side, walk, or back)
 */
export const generateSingleView = async (
  masterPrompt: string,
  sourceImageUrl: string,
  gender: string,
  viewType: 'side' | 'walk' | 'back',
  technicalSchema?: any
): Promise<{ imageUrl: string; engineUsed: string }> => {
  return withImageQueue(async () => {
  const ai = getAiClient();
  const mimeType = extractMimeType(sourceImageUrl);
  const base64Data = extractBase64Data(sourceImageUrl);

  const dynamicStudioSettings = getStudioSettings(masterPrompt);
  const identityAnchor = buildIdentityAnchor(masterPrompt, technicalSchema);

  const normalizedGender = gender.trim().toLowerCase();
  const wardrobeConstraint = normalizedGender === 'male'
    ? "Attire: Simple black boxer briefs. BARE CHEST."
    : "Attire: Minimalist black activewear.";

  const viewPrompts: Record<string, string> = {
    'side': `SIDE PROFILE PORTRAIT. Head and shoulders only. Facing Right. ${wardrobeConstraint} Same subject.`,
    'walk': `FULL BODY SIDE PROFILE. Walking motion. Facing Right. ${wardrobeConstraint} Same subject.`,
    'back': `FULL BODY FROM BEHIND. Walking away. ${wardrobeConstraint} Same subject. No new back tattoos.`
  };

  const prompt = viewPrompts[viewType];
  const fullPrompt = `STRICT CHARACTER CONSISTENCY REQUIRED.\nReference image provided.\nTASK: ${prompt}\n\n${identityAnchor}\n\nTHE ATTACHED IMAGE IS THIS EXACT PERSON. Match their face, skin, and any tattoos/marks precisely.\n\n${dynamicStudioSettings}`;

  const executeViewGen = async (model: string) => {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: fullPrompt }
        ]
      },
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: AspectRatio.PORTRAIT },
        safetySettings: SAFETY_SETTINGS
      }
    });

    const diagnosis = diagnoseResponse(response);
    if (diagnosis) throw new Error(diagnosis);

    const imageUrl = extractImageFromResponse(response);
    if (!imageUrl) throw new Error("No image generated");
    validateNotPlaceholder(imageUrl);

    return { imageUrl, engineUsed: model };
  };

  const VIEW_MODELS = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];

  for (let i = 0; i < VIEW_MODELS.length; i++) {
    const model = VIEW_MODELS[i];
    try {
      return await withSingleRetry503(
        () => withTimeout(executeViewGen(model), 60000, `SingleView:${viewType} (${model})`),
        `SingleView:${viewType} (${model})`
      );
    } catch (e: any) {
      console.warn(`[SingleView:${viewType}] ${model} failed:`, e?.message);
      if (i === VIEW_MODELS.length - 1) {
        throw new Error(formatGeminiError(e));
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  throw new Error(`Single view (${viewType}) generation failed across all models.`);
  }, `generateSingleView(${viewType})`);
};

// ============================================================================
// UPSCALE EXISTING IMAGE
// ============================================================================

/**
 * Upscale existing image to higher resolution
 */
export const upscaleExistingImage = async (
  currentImageUrl: string,
  targetResolution: ImageResolution
): Promise<{ imageUrl: string; engineUsed: string }> => {
  return withImageQueue(async () => {
  const ai = getAiClient();
  const mimeType = extractMimeType(currentImageUrl);
  const base64Data = extractBase64Data(currentImageUrl);

  const parts: GeminiPart[] = [
    { inlineData: { data: base64Data, mimeType } },
    { text: UPSCALE_PROMPT },
  ];

  const modelName = 'gemini-3-pro-image-preview';

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: modelName,
        contents: { parts },
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: {
            imageSize: targetResolution,
            aspectRatio: AspectRatio.PORTRAIT,
          },
          safetySettings: SAFETY_SETTINGS,
        }
      }),
      90000,
      `Upscale (${modelName})`
    );

    const diagnosis = diagnoseResponse(response);
    if (diagnosis) throw new Error(diagnosis);

    const imageUrl = extractImageFromResponse(response);
    if (!imageUrl) throw new Error("Upscale failed: No image returned.");
    validateNotPlaceholder(imageUrl);

    return { imageUrl, engineUsed: modelName };
  } catch (error) {
    throw new Error(formatGeminiError(error));
  }
  }, 'upscaleExistingImage');
};
