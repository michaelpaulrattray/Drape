/**
 * Gemini Views - Full body generation, multi-view generation,
 * single view generation, and image upscaling.
 */

import type { ModelViews, GeminiPart } from "./geminiTypes";
import { ImageResolution, AspectRatio } from "./geminiTypes";
import { getAiClient, SAFETY_SETTINGS, extractMimeType, formatGeminiError } from "./geminiClient";
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
  gender: string
): Promise<string> => {
  const ai = getAiClient();
  const mimeType = extractMimeType(headshotUrl);
  const base64Data = headshotUrl.replace(/^data:.*?;base64,/, "");

  const dynamicStudioSettings = getStudioSettings(masterPrompt);

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
      ORIGINAL SPEC: ${masterPrompt}
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
        imageConfig: { aspectRatio: AspectRatio.PORTRAIT },
        safetySettings: SAFETY_SETTINGS
      }
    });

    const imgPart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (imgPart?.inlineData) {
      return `data:image/png;base64,${imgPart.inlineData.data}`;
    }

    const textPart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.text);
    if (textPart?.text) {
      throw new Error(`Refusal: ${textPart.text.slice(0, 50)}...`);
    }
    throw new Error("No image returned.");
  };

  try {
    return await executeBodyGen('gemini-3-pro-image-preview');
  } catch (e: any) {
    try {
      return await executeBodyGen('gemini-2.5-flash-image');
    } catch (e2) {
      throw new Error("Full body generation failed. Safety constraints may be too strict.");
    }
  }
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
  gender: string
): Promise<Partial<ModelViews>> => {
  const ai = getAiClient();
  const mimeType = extractMimeType(sourceImageUrl);
  const base64Data = sourceImageUrl.replace(/^data:.*?;base64,/, "");

  const dynamicStudioSettings = getStudioSettings(masterPrompt);

  const normalizedGender = gender.trim().toLowerCase();
  const wardrobeConstraint = normalizedGender === 'male'
    ? "Attire: Simple black boxer briefs. BARE CHEST."
    : "Attire: Minimalist black activewear.";

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
            { text: `STRICT CHARACTER CONSISTENCY REQUIRED.\nReference image provided.\nTASK: ${config.prompt}\n${dynamicStudioSettings}\nOriginal Spec: ${masterPrompt}` }
          ]
        },
        config: {
          imageConfig: { aspectRatio: AspectRatio.PORTRAIT },
          safetySettings: SAFETY_SETTINGS
        }
      });

      const imgPart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
      if (imgPart?.inlineData) {
        return { key: config.key, url: `data:image/png;base64,${imgPart.inlineData.data}` };
      }
      throw new Error("No image");
    };

    try {
      try {
        return await executeViewGen('gemini-3-pro-image-preview');
      } catch (e) {
        return await executeViewGen('gemini-2.5-flash-image');
      }
    } catch (e) {
      return null;
    }
  };

  const promises = viewConfigs.map(cfg => generateView(cfg));
  const generatedViews = await Promise.all(promises);

  generatedViews.forEach(v => {
    if (v) {
      (results as any)[v.key] = v.url;
    }
  });

  return results;
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
  viewType: 'side' | 'walk' | 'back'
): Promise<{ imageUrl: string; engineUsed: string }> => {
  const ai = getAiClient();
  const mimeType = extractMimeType(sourceImageUrl);
  const base64Data = sourceImageUrl.replace(/^data:.*?;base64,/, "");

  const dynamicStudioSettings = getStudioSettings(masterPrompt);

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
  const fullPrompt = `STRICT CHARACTER CONSISTENCY REQUIRED.\nReference image provided.\nTASK: ${prompt}\n${dynamicStudioSettings}\nOriginal Spec: ${masterPrompt}`;

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
        imageConfig: { aspectRatio: AspectRatio.PORTRAIT },
        safetySettings: SAFETY_SETTINGS
      }
    });

    const imgPart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (imgPart?.inlineData) {
      return {
        imageUrl: `data:image/png;base64,${imgPart.inlineData.data}`,
        engineUsed: model
      };
    }
    throw new Error("No image generated");
  };

  try {
    try {
      return await executeViewGen('gemini-3-pro-image-preview');
    } catch (e: any) {
      if (e.status === 403 || e.status === 404 || e.message?.includes('403') || e.message?.includes('not found')) {
        return await executeViewGen('gemini-2.5-flash-image');
      }
      throw e;
    }
  } catch (error) {
    throw new Error(formatGeminiError(error));
  }
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
  const ai = getAiClient();
  const mimeType = extractMimeType(currentImageUrl);
  const base64Data = currentImageUrl.replace(/^data:.*?;base64,/, "");

  const parts: GeminiPart[] = [
    {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    },
    { text: UPSCALE_PROMPT },
  ];

  const modelName = 'gemini-3-pro-image-preview';

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        imageConfig: {
          imageSize: targetResolution,
          aspectRatio: AspectRatio.PORTRAIT,
        },
        safetySettings: SAFETY_SETTINGS,
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return {
          imageUrl: `data:image/png;base64,${part.inlineData.data}`,
          engineUsed: modelName
        };
      }
    }
    throw new Error("Upscale failed: No image returned.");
  } catch (error) {
    throw new Error(formatGeminiError(error));
  }
};
