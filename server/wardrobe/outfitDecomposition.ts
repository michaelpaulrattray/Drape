/**
 * Outfit Decomposition — Service 4: "The Decomposer"
 *
 * Takes a full outfit photo and decomposes it into individual garment
 * crops with bounding boxes. Each detected garment is cropped server-side
 * using sharp, uploaded to S3, and returned with a real cropUrl.
 *
 * Queue lane: TEXT (detection) + IMAGE (cropping via sharp)
 * Credit cost: 2 points
 */
import sharp from "sharp";
import { detectGarmentsInImage, type DetectedItem } from "./garmentDetection";
import { uploadBase64ToS3 } from "./utils";
import { storagePut } from "../storage";
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
 * Fetch an image URL and return its raw buffer.
 */
async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Crop a garment from the source image using box_2d normalized coordinates.
 *
 * box_2d format: [ymin, xmin, ymax, xmax] — all values normalized 0-1.
 * Matches the SOT cropGarmentFromImage logic adapted for server-side sharp.
 */
async function cropGarment(
  sourceBuffer: Buffer,
  box_2d: [number, number, number, number],
): Promise<Buffer> {
  const [ymin, xmin, ymax, xmax] = box_2d;

  const metadata = await sharp(sourceBuffer).metadata();
  const w = metadata.width ?? 0;
  const h = metadata.height ?? 0;

  if (w === 0 || h === 0) {
    throw new Error("Could not read image dimensions");
  }

  const left = Math.max(0, Math.round(xmin * w));
  const top = Math.max(0, Math.round(ymin * h));
  const width = Math.min(w - left, Math.round((xmax - xmin) * w));
  const height = Math.min(h - top, Math.round((ymax - ymin) * h));

  if (width <= 0 || height <= 0) {
    throw new Error(
      `Invalid crop dimensions: left=${left} top=${top} width=${width} height=${height}`,
    );
  }

  return sharp(sourceBuffer)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();
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

  // Step 2: Fetch the source image once
  const sourceBuffer = await fetchImageBuffer(imageUrl);

  // Step 3: Crop each garment and upload to S3
  const garments: DecomposedGarment[] = [];

  for (const item of detected) {
    try {
      const croppedBuffer = await cropGarment(sourceBuffer, item.box_2d);

      const suffix = Math.random().toString(36).slice(2, 8);
      const key = `${userId}-wardrobe/decomposed/${item.id}-${suffix}.png`;
      const { url: cropUrl } = await storagePut(key, croppedBuffer, "image/png");

      garments.push({
        id: item.id,
        category: item.category,
        label: item.label,
        confidence: item.confidence,
        box_2d: item.box_2d,
        cropUrl,
      });
    } catch (err) {
      log.error(
        `Failed to crop garment "${item.label}" (${item.id}): ${err instanceof Error ? err.message : err}`,
      );
      // Skip this garment rather than failing the whole decomposition
    }
  }

  log.info(
    `Decomposed outfit into ${garments.length} garments: ${garments.map((g) => g.label).join(", ")}`,
  );

  return { garments, sourceImageUrl: imageUrl };
}
