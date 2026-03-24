/**
 * Garment Digitization — Service 1A: "The Digitizer"
 *
 * Takes a garment image (crop or full photo) and produces a clean
 * flat-lay studio version on a warm cream background.
 *
 * Gemini model: gemini-2.5-flash-image (image generation, fast)
 * Queue lane: IMAGE (heavy, ~15-30s)
 * Credit cost: 2 points
 */
import {
  getAiClient,
  SAFETY_SETTINGS,
  withImageQueue,
  toInlinePart,
  diagnoseResponse,
  uploadBase64ToS3,
} from "./utils";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("wardrobe/garmentDigitization");

export interface DigitizationResult {
  flatLayUrl: string; // S3 URL of the flat-lay image
}

/**
 * Digitize a garment — isolate it from its background and create
 * a clean flat-lay studio product shot.
 *
 * @param imageUrl - S3 URL or base64 data URL of the garment image
 * @param slotType - Category of the garment (tops, bottoms, etc.)
 * @param label - Specific label for the garment (e.g., "black leather bomber jacket")
 * @param userId - User ID for S3 path namespacing
 */
export async function digitizeGarment(
  imageUrl: string,
  slotType: string,
  label: string,
  userId: string,
): Promise<DigitizationResult> {
  return withImageQueue(async () => {
    const ai = getAiClient();
    const garmentPart = await toInlinePart(imageUrl);

    const garmentName = label || slotType;
    const prompt = `Isolate ONLY the "${garmentName}" from this image as a clean product flat-lay.

TARGET GARMENT: "${garmentName}"
This image may contain multiple garments or layers. You MUST isolate ONLY the named garment above. Ignore all other clothing items visible in the image.

RULES:
- Show ONLY the target garment. Nothing else.
- Remove all human skin, body parts, other clothing layers, and background.
- If another garment is partially visible (e.g. a shirt peeking under a jacket), EXCLUDE it entirely. Only the target garment.
- Background: solid #f0ebe3 (warm cream).
- Lay the garment flat as if placed on a table, viewed from directly above.
- Preserve the EXACT fabric texture, color, pattern, graphics, embroidery, hardware (zippers, buttons, snaps), and construction details from the source image.
- Do NOT simplify, reinterpret, or redesign any part of the garment.
- Do NOT invent details that aren't visible in the source. If a section is hidden, fill with matching plain fabric — no new logos, graphics, or design elements.
- Center the garment in frame with even padding.
- No shadows. No reflections. No styling props. Just the garment on #f0ebe3.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ text: prompt }, garmentPart],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: "1:1" },
        safetySettings: SAFETY_SETTINGS,
      },
    });

    const diagnosis = diagnoseResponse(response);

    if (!diagnosis.imageBase64) {
      if (diagnosis.isSafetyBlock) {
        throw new Error(
          `SAFETY_BLOCK: Digitization blocked — ${diagnosis.finishReason || diagnosis.blockReason || "unknown"}`,
        );
      }
      log.warn("Digitization returned no image, using original");
      // Return original image as fallback
      return { flatLayUrl: imageUrl };
    }

    const flatLayUrl = await uploadBase64ToS3(
      diagnosis.imageBase64,
      `wardrobe/${userId}/flat-lays`,
    );

    log.info(`Digitized garment "${garmentName}" → ${flatLayUrl}`);
    return { flatLayUrl };
  }, "garment-digitization");
}
