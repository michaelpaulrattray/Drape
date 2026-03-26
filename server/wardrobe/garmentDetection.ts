/**
 * Garment Detection — Service 0: "The Interceptor"
 *
 * Detects individual garments in an uploaded image and returns
 * bounding boxes with category classification.
 *
 * Used when a user uploads a photo containing clothing — either
 * a single garment or a full outfit to decompose.
 *
 * Gemini model: TEXT_PRO from modelRegistry (text-only, structured JSON)
 * Queue lane: TEXT (lightweight, ~5-10s)
 * Credit cost: 1 point
 */
import { TEXT_PRO } from "@shared/modelRegistry";
import { Type } from "@google/genai";
import {
  getAiClient,
  withTextQueue,
  toInlinePart,
} from "./utils";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("wardrobe/garmentDetection");

export type SlotType = "tops" | "bottoms" | "shoes" | "accessories" | "full_look";

export interface DetectedItem {
  id: string;
  category: SlotType;
  label: string;
  confidence: number;
  box_2d: [number, number, number, number]; // ymin, xmin, ymax, xmax (0-1)
  visibility: number; // 0-100: how much of the garment is actually visible
  visibilityNote?: string; // brief context, e.g. "mostly hidden under blazer"
}

/**
 * Detect garments in an image and return bounding boxes.
 *
 * @param imageUrl - S3 URL or base64 data URL of the image to analyze
 * @returns Array of detected garment items with bounding boxes
 */
export async function detectGarmentsInImage(
  imageUrl: string,
): Promise<DetectedItem[]> {
  return withTextQueue(async () => {
    const ai = getAiClient();
    const imagePart = await toInlinePart(imageUrl);

    const prompt = `Detect each individual garment in this image and return bounding boxes.

CATEGORIES (use exactly these strings):
- 'tops': ANY upper body garment — bralettes, sports bras, tank tops, t-shirts, shirts, blouses, sweaters, hoodies, jackets, coats, blazers, vests. Both inner layers and outer layers go in this category.
- 'bottoms': ANY lower body garment — shorts, compression shorts, pants, jeans, skirts, leggings, trousers, cargo pants, sweatpants
- 'shoes': Shoes, boots, sandals, sneakers, slippers
- 'accessories': Bags, hats, belts, jewelry, scarves, sunglasses, watches, earrings
- 'full_look': Single pieces that cover BOTH upper AND lower body — dresses, jumpsuits, rompers, bodysuits with legs

RULES:
- Return one entry per distinct garment. A jacket AND a t-shirt underneath = two entries.
- Bounding boxes should tightly frame each garment with minimal extra space.
- Label should be specific: "black leather bomber jacket" not "jacket".
- If a garment is partially hidden (e.g., t-shirt under open jacket), still detect it with the visible bounding box.
- For each garment, estimate 'visibility' (0-100): what percentage of the garment's surface area is actually visible and unobscured. A fully visible garment = 100. A t-shirt mostly hidden under a blazer with only the neckline showing = 15-25. A shirt with sleeves rolled up under a vest = 40-60.
- If visibility < 50, also provide a short 'visibilityNote' explaining what's obscuring it (e.g., "mostly hidden under blazer").
- ACCESSORIES (belts, necklaces, chains, scarves, bracelets): These overlay other garments. The bounding box must hug the accessory itself as tightly as possible — NOT the garment behind it.
- A belt bbox should be a thin horizontal strip across the waist, not a rectangle containing the full pants/skirt area. A necklace bbox should frame just the necklace, not the entire top underneath.
- Bounding box coordinates must be normalized (0-1).`;

    const response = await ai.models.generateContent({
      model: TEXT_PRO,
      contents: [{ text: prompt }, imagePart],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              label: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              visibility: { type: Type.NUMBER, description: "0-100: percentage of garment surface visible" },
              visibilityNote: { type: Type.STRING, description: "Brief note if partially hidden" },
              boundingBox: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER },
                description: "ymin, xmin, ymax, xmax",
              },
            },
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];

    const items = JSON.parse(text);

    // Normalize categories
    const normCategory = (cat: string): SlotType => {
      const c = (cat || "").toLowerCase();
      const map: Record<string, SlotType> = {
        base: "tops", top: "tops", underwear: "tops",
        bra: "tops", sports_bra: "tops", jacket: "tops", shirt: "tops",
        footwear: "shoes", sneakers: "shoes", boots: "shoes",
        full_outfit: "full_look", dress: "full_look",
        pants: "bottoms", shorts: "bottoms", skirt: "bottoms",
      };
      return map[c] || (c as SlotType);
    };

    // Map to DetectedItem with normalized bounding boxes
    const mapped: DetectedItem[] = items.map((item: any) => {
      let box = item.boundingBox as number[];
      if (box.some((c: number) => c > 2)) {
        box = box.map((c: number) => c / 1000);
      }
      box = box.map((c: number) => Math.max(0, Math.min(1, c)));

      return {
        id: `detected-${crypto.randomUUID()}`,
        category: normCategory(item.category),
        label: item.label,
        confidence: item.confidence,
        box_2d: box as [number, number, number, number],
        visibility: Math.max(0, Math.min(100, Math.round(item.visibility ?? 100))),
        ...(item.visibilityNote ? { visibilityNote: item.visibilityNote } : {}),
      };
    });

    // Deduplicate: merge items in same category with similar labels
    const deduped: DetectedItem[] = [];
    for (const item of mapped) {
      const normalizeLabel = (l: string) =>
        l
          .toLowerCase()
          .replace(/\b(left|right|l|r)\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();

      const existing = deduped.find(
        (d) =>
          d.category === item.category &&
          normalizeLabel(d.label) === normalizeLabel(item.label),
      );

      if (existing) {
        const [eymin, exmin, eymax, exmax] = existing.box_2d;
        const [iymin, ixmin, iymax, ixmax] = item.box_2d;
        existing.box_2d = [
          Math.min(eymin, iymin),
          Math.min(exmin, ixmin),
          Math.max(eymax, iymax),
          Math.max(exmax, ixmax),
        ];
        existing.confidence = Math.max(existing.confidence, item.confidence);
        existing.label = existing.label
          .replace(/\b(left|right)\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();
      } else {
        deduped.push(item);
      }
    }

    log.info(`Detected ${deduped.length} garments in image`);
    return deduped;
  }, "garment-detection");
}
