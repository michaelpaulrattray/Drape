/**
 * Garment Refinement — Service 3: "The Refiner"
 *
 * Refines a specific garment in an existing VTO result — applies
 * targeted edits like "unbutton jacket", "roll sleeves", "tuck shirt".
 *
 * Gemini model: gemini-3-pro-image-preview (image generation)
 * Queue lane: IMAGE (heavy, ~15-30s)
 * Credit cost: 3 points
 */
import {
  getAiClient,
  SAFETY_SETTINGS,
  withImageQueue,
  toInlinePart,
  diagnoseResponse,
  uploadBase64ToS3,
  sanitizeDescription,
  getImageAspectBucket,
} from "./utils";
import { getSession } from "./vtoSession";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("wardrobe/garmentRefinement");

export interface RefinementParams {
  resultImageUrl: string;    // Current VTO result to edit
  modelImageUrl: string;     // Original model for identity reference
  garmentLabel: string;      // e.g., "Black Leather Bomber Jacket"
  category: string;          // e.g., "tops"
  instruction: string;       // e.g., "Unbutton the jacket and roll the sleeves"
  outfitContext?: string;    // Full outfit description for context
  garmentReferenceUrls?: { label: string; url: string }[];
  tattooPromptFragment?: string;
  userId: string;
  sessionId: string;
}

export interface RefinementResult {
  resultUrl: string;
}

/**
 * Refine a specific garment in the VTO result.
 */
export async function refineGarment(
  params: RefinementParams,
): Promise<RefinementResult> {
  return withImageQueue(async () => {
    const ai = getAiClient();

    const resultPart = await toInlinePart(params.resultImageUrl);
    const modelPart = await toInlinePart(params.modelImageUrl);

    // Build garment reference parts
    const refParts: any[] = [];
    const refDescriptions: string[] = [];
    if (params.garmentReferenceUrls) {
      for (let i = 0; i < params.garmentReferenceUrls.length; i++) {
        const ref = params.garmentReferenceUrls[i];
        refParts.push(await toInlinePart(ref.url));
        refDescriptions.push(`Image ${3 + i}: ${ref.label}`);
      }
    }

    const sanitizedLabel = sanitizeDescription(params.garmentLabel);
    const sanitizedInstruction = sanitizeDescription(params.instruction);

    const prompt = `You are refining a virtual try-on result.

Image 1: The original model (IDENTITY REFERENCE - do not change face/body/pose).
Image 2: The current try-on result to be edited.
${refParts.length > 0 ? `Images 3+: Garment details for reference.\n${refDescriptions.join("\n")}` : ""}

INSTRUCTION: Apply this specific change to the "${sanitizedLabel}" (${params.category}):
"${sanitizedInstruction}"

${params.outfitContext ? `CONTEXT: The full outfit is: ${sanitizeDescription(params.outfitContext)}.` : ""}

RULES:
1. ONLY apply the requested change. Do not change other garments.
2. PRESERVE the model's identity, face, and pose from Image 1 exactly.
3. PRESERVE the background from Image 2.
4. If the instruction implies revealing skin, ensure it matches the model's skin tone in Image 1.
5. PRESERVE the framing and crop of Image 2. Do not zoom in, zoom out, or change the camera distance.
${params.tattooPromptFragment || ""}

Return the edited image.`;

    const contents = [
      { text: prompt },
      modelPart,
      resultPart,
      ...refParts,
    ];

    // Try to reuse existing session chat for context continuity
    const existingSession = getSession(
      Number(params.userId),
      params.sessionId,
    );

    let chat: any;
    if (existingSession) {
      log.info(
        `Reusing existing session chat for user ${params.userId}, session ${params.sessionId}`,
      );
      chat = existingSession.chat;
    } else {
      const aspectRatio = await getImageAspectBucket(params.modelImageUrl);
      chat = ai.chats.create({
        model: "gemini-3-pro-image-preview",
        config: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { aspectRatio: aspectRatio as any, imageSize: "1K" },
          safetySettings: SAFETY_SETTINGS,
        },
      });
    }

    const response = await chat.sendMessage({ message: contents });
    const diagnosis = diagnoseResponse(response);

    if (!diagnosis.imageBase64) {
      if (diagnosis.isSafetyBlock) {
        throw new Error(
          `SAFETY_BLOCK:${diagnosis.finishReason || diagnosis.blockReason || "unknown"}`,
        );
      }
      throw new Error(
        `Refinement failed. Reason: ${diagnosis.finishReason || "no image returned"}`,
      );
    }

    const resultUrl = await uploadBase64ToS3(
      diagnosis.imageBase64,
      `wardrobe/${params.userId}/vto-results`,
    );

    log.info(
      `Refined "${params.garmentLabel}" in session ${params.sessionId}: "${params.instruction}"`,
    );
    return { resultUrl };
  }, "garment-refinement");
}
