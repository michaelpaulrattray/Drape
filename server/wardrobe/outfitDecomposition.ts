/**
 * Outfit Decomposition — Service 4: "The Decomposer"
 *
 * Takes a full outfit photo and decomposes it into individual garment
 * crops with bounding boxes. Users can then select which garments to
 * import into their wardrobe rack.
 *
 * This combines garment detection (bounding boxes) with image cropping
 * to produce individual garment images ready for digitization.
 *
 * Queue lane: TEXT (detection) + IMAGE (cropping via canvas)
 * Credit cost: 2 points
 */
import { detectGarmentsInImage, type DetectedItem } from "./garmentDetection";
import { uploadBase64ToS3 } from "./utils";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("wardrobe/outfitDecomposition");

export interface DecomposedGarment {
  id: string;
  category: string;
  label: string;
  confidence: number;
  box_2d: [number, number, number, number];
  cropUrl: string; // S3 URL of the cropped garment image
}

export interface DecompositionResult {
  garments: DecomposedGarment[];
  sourceImageUrl: string;
}

/**
 * Decompose an outfit photo into individual garment crops.
 *
 * @param imageUrl - S3 URL of the outfit photo
 * @param userId - User ID for S3 path namespacing
 * @returns Array of decomposed garments with crop URLs
 */
export async function decomposeOutfit(
  imageUrl: string,
  userId: string,
): Promise<DecompositionResult> {
  // Step 1: Detect garments and bounding boxes
  const detected = await detectGarmentsInImage(imageUrl);

  if (detected.length === 0) {
    log.warn("No garments detected in outfit image");
    return { garments: [], sourceImageUrl: imageUrl };
  }

  // Step 2: Crop each garment from the source image
  // Server-side cropping using sharp or canvas would be ideal,
  // but for now we store the bounding box data and let the client
  // handle visual cropping. The sourceImageUrl + box_2d is sufficient
  // for the digitization step to extract the garment.
  //
  // The cropUrl is set to the source image URL — the digitization
  // service will use the bounding box to focus on the right area.
  const garments: DecomposedGarment[] = detected.map((item) => ({
    id: item.id,
    category: item.category,
    label: item.label,
    confidence: item.confidence,
    box_2d: item.box_2d,
    cropUrl: imageUrl, // Source image — digitization uses box_2d to focus
  }));

  log.info(
    `Decomposed outfit into ${garments.length} garments: ${garments.map((g) => g.label).join(", ")}`,
  );

  return { garments, sourceImageUrl: imageUrl };
}
