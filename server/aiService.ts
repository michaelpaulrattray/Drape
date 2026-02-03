import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";

/**
 * FormaStudio AI Service
 * Handles all AI-powered model generation using Gemini API
 */

// ============ Types ============

export interface ModelPreferences {
  // Demographics
  gender: "male" | "female" | "non-binary";
  ageRange: "18-25" | "25-35" | "35-45" | "45-55" | "55+";
  ethnicity: string;
  
  // Physical Features
  bodyType: "slim" | "athletic" | "average" | "curvy" | "plus-size";
  height: "petite" | "average" | "tall";
  
  // Hair
  hairColor: string;
  hairLength: "bald" | "buzz" | "short" | "medium" | "long";
  hairStyle: string;
  
  // Skin & Features
  skinTone: string;
  eyeColor: string;
  facialFeatures?: string;
  
  // Brand & Aesthetic
  brandTone: "luxury" | "streetwear" | "minimalist" | "editorial" | "commercial" | "avant-garde";
  mood: "confident" | "serene" | "edgy" | "playful" | "mysterious" | "natural";
  
  // Optional reference
  referenceDescription?: string;
}

export interface MasterPrompt {
  fullPrompt: string;
  technicalSchema: {
    gender: string;
    age: string;
    ethnicity: string;
    bodyType: string;
    height: string;
    hair: {
      color: string;
      length: string;
      style: string;
    };
    skin: {
      tone: string;
      texture: string;
    };
    eyes: {
      color: string;
      shape: string;
    };
    face: {
      structure: string;
      features: string;
    };
    aesthetic: {
      brand: string;
      mood: string;
      lighting: string;
      background: string;
    };
  };
  agencyId: string;
}

export interface GenerationResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  pointsCost: number;
}

// ============ Point Costs ============

export const POINT_COSTS = {
  masterPrompt: 2,
  castingImage: 10,
  fullBody: 8,
  multiView: 15,
  upscale2K: 3,
  upscale4K: 5,
  iteration: 5,
} as const;

// ============ Helper Functions ============

function generateAgencyId(): string {
  const prefix = "MOD";
  const year = new Date().getFullYear().toString().slice(-2);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${year}-${suffix}`;
}

// ============ AI Service Functions ============

/**
 * Generate a master prompt from model preferences
 * This creates a detailed specification for the AI model
 */
export async function generateMasterPrompt(preferences: ModelPreferences): Promise<MasterPrompt> {
  const systemPrompt = `You are an expert fashion casting director and AI prompt engineer. 
Your task is to create a detailed, technical prompt for generating a photorealistic AI fashion model.
The output must be a JSON object with the exact structure specified.
Focus on creating a cohesive, believable character that would work for high-end fashion campaigns.`;

  const userPrompt = `Create a master prompt for an AI fashion model with these preferences:

Gender: ${preferences.gender}
Age Range: ${preferences.ageRange}
Ethnicity: ${preferences.ethnicity}
Body Type: ${preferences.bodyType}
Height: ${preferences.height}
Hair Color: ${preferences.hairColor}
Hair Length: ${preferences.hairLength}
Hair Style: ${preferences.hairStyle}
Skin Tone: ${preferences.skinTone}
Eye Color: ${preferences.eyeColor}
Facial Features: ${preferences.facialFeatures || "balanced, photogenic"}
Brand Tone: ${preferences.brandTone}
Mood: ${preferences.mood}
${preferences.referenceDescription ? `Reference: ${preferences.referenceDescription}` : ""}

Generate a comprehensive master prompt that includes:
1. A detailed full prompt (2-3 paragraphs) describing the model for image generation
2. A technical schema with specific attributes
3. Lighting and background recommendations for the brand tone

The full prompt should be suitable for generating a professional headshot/portrait.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "master_prompt",
        strict: true,
        schema: {
          type: "object",
          properties: {
            fullPrompt: { 
              type: "string", 
              description: "Complete prompt for image generation (2-3 paragraphs)" 
            },
            technicalSchema: {
              type: "object",
              properties: {
                gender: { type: "string" },
                age: { type: "string" },
                ethnicity: { type: "string" },
                bodyType: { type: "string" },
                height: { type: "string" },
                hair: {
                  type: "object",
                  properties: {
                    color: { type: "string" },
                    length: { type: "string" },
                    style: { type: "string" },
                  },
                  required: ["color", "length", "style"],
                  additionalProperties: false,
                },
                skin: {
                  type: "object",
                  properties: {
                    tone: { type: "string" },
                    texture: { type: "string" },
                  },
                  required: ["tone", "texture"],
                  additionalProperties: false,
                },
                eyes: {
                  type: "object",
                  properties: {
                    color: { type: "string" },
                    shape: { type: "string" },
                  },
                  required: ["color", "shape"],
                  additionalProperties: false,
                },
                face: {
                  type: "object",
                  properties: {
                    structure: { type: "string" },
                    features: { type: "string" },
                  },
                  required: ["structure", "features"],
                  additionalProperties: false,
                },
                aesthetic: {
                  type: "object",
                  properties: {
                    brand: { type: "string" },
                    mood: { type: "string" },
                    lighting: { type: "string" },
                    background: { type: "string" },
                  },
                  required: ["brand", "mood", "lighting", "background"],
                  additionalProperties: false,
                },
              },
              required: ["gender", "age", "ethnicity", "bodyType", "height", "hair", "skin", "eyes", "face", "aesthetic"],
              additionalProperties: false,
            },
          },
          required: ["fullPrompt", "technicalSchema"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Failed to generate master prompt");
  }

  // Content could be string or array, handle both cases
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  const parsed = JSON.parse(contentStr);
  
  return {
    ...parsed,
    agencyId: generateAgencyId(),
  };
}

/**
 * Generate a casting image (headshot/portrait) from a master prompt
 */
export async function generateCastingImage(masterPrompt: MasterPrompt): Promise<GenerationResult> {
  try {
    const imagePrompt = `Professional fashion model headshot portrait. ${masterPrompt.fullPrompt}
    
Style: High-end fashion photography, ${masterPrompt.technicalSchema.aesthetic.lighting}, ${masterPrompt.technicalSchema.aesthetic.background}.
Quality: Ultra high resolution, sharp focus on face, professional studio lighting, magazine cover quality.
Mood: ${masterPrompt.technicalSchema.aesthetic.mood}`;

    const result = await generateImage({
      prompt: imagePrompt,
    });

    return {
      success: true,
      imageUrl: result.url,
      pointsCost: POINT_COSTS.castingImage,
    };
  } catch (error) {
    console.error("[AI Service] Failed to generate casting image:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate image",
      pointsCost: 0,
    };
  }
}

/**
 * Generate a full body image from an existing headshot
 */
export async function generateFullBody(
  masterPrompt: MasterPrompt,
  headshotUrl?: string
): Promise<GenerationResult> {
  try {
    const imagePrompt = `Full body fashion model photograph. ${masterPrompt.fullPrompt}
    
Pose: Standing, full body visible from head to feet, professional model pose.
Style: High-end fashion photography, ${masterPrompt.technicalSchema.aesthetic.lighting}.
Body type: ${masterPrompt.technicalSchema.bodyType}, ${masterPrompt.technicalSchema.height} height.
Outfit: Simple, neutral clothing that showcases the model's physique - white t-shirt and dark pants or simple dress.
Quality: Ultra high resolution, full body in frame, professional studio lighting.`;

    const result = await generateImage({
      prompt: imagePrompt,
      ...(headshotUrl && {
        originalImages: [{
          url: headshotUrl,
          mimeType: "image/jpeg" as const,
        }],
      }),
    });

    return {
      success: true,
      imageUrl: result.url,
      pointsCost: POINT_COSTS.fullBody,
    };
  } catch (error) {
    console.error("[AI Service] Failed to generate full body:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate full body image",
      pointsCost: 0,
    };
  }
}

/**
 * Generate remaining views (side, back) for a model
 */
export async function generateRemainingViews(
  masterPrompt: MasterPrompt,
  viewType: "side" | "back",
  referenceUrl?: string
): Promise<GenerationResult> {
  try {
    const viewDescriptions = {
      side: "Side profile view, 90-degree angle, showing facial profile and body silhouette",
      back: "Back view, showing back of head, shoulders, and full back",
    };

    const imagePrompt = `Fashion model ${viewType} view photograph. ${masterPrompt.fullPrompt}
    
View: ${viewDescriptions[viewType]}
Style: High-end fashion photography, ${masterPrompt.technicalSchema.aesthetic.lighting}.
Quality: Ultra high resolution, professional studio lighting, consistent with front view.`;

    const result = await generateImage({
      prompt: imagePrompt,
      ...(referenceUrl && {
        originalImages: [{
          url: referenceUrl,
          mimeType: "image/jpeg" as const,
        }],
      }),
    });

    return {
      success: true,
      imageUrl: result.url,
      pointsCost: POINT_COSTS.multiView,
    };
  } catch (error) {
    console.error("[AI Service] Failed to generate view:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : `Failed to generate ${viewType} view`,
      pointsCost: 0,
    };
  }
}

/**
 * Iterate/refine an existing model image with feedback
 */
export async function iterateModel(
  masterPrompt: MasterPrompt,
  currentImageUrl: string,
  feedback: string
): Promise<GenerationResult> {
  try {
    const imagePrompt = `${masterPrompt.fullPrompt}

Refinement instructions: ${feedback}

Maintain the same model identity while applying the requested changes.
Style: High-end fashion photography, ${masterPrompt.technicalSchema.aesthetic.lighting}.
Quality: Ultra high resolution, professional studio lighting.`;

    const result = await generateImage({
      prompt: imagePrompt,
      originalImages: [{
        url: currentImageUrl,
        mimeType: "image/jpeg" as const,
      }],
    });

    return {
      success: true,
      imageUrl: result.url,
      pointsCost: POINT_COSTS.iteration,
    };
  } catch (error) {
    console.error("[AI Service] Failed to iterate model:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to iterate model",
      pointsCost: 0,
    };
  }
}
