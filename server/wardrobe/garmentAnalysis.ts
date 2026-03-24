/**
 * Garment Analysis — Service 1B: "The Analyst"
 *
 * Analyzes a garment image and extracts structured metadata:
 * short name, description, tags, and suggested styling actions.
 *
 * Gemini model: gemini-2.5-flash (text-only, structured JSON)
 * Queue lane: TEXT (lightweight, ~5-10s)
 * Credit cost: 1 point (bundled with detection)
 */
import { Type } from "@google/genai";
import {
  getAiClient,
  withTextQueue,
  toInlinePart,
} from "./utils";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("wardrobe/garmentAnalysis");

export interface GarmentMetadata {
  shortName: string;
  description: string;
  tags: string[];
  suggestedActions: string[];
}

/**
 * Analyze a garment and return structured metadata.
 *
 * @param imageUrl - S3 URL or base64 data URL of the garment image
 * @param label - Optional label hint from detection (e.g., "black leather bomber jacket")
 * @param isFullLook - Whether this is a complete outfit (not a single garment)
 */
export async function analyzeGarmentMetadata(
  imageUrl: string,
  label?: string,
  isFullLook?: boolean,
): Promise<GarmentMetadata> {
  return withTextQueue(async () => {
    const ai = getAiClient();
    const garmentPart = await toInlinePart(imageUrl);

    const targetClause = label
      ? `TARGET ITEM: "${label}"\nThis image may show other garments in the background. Describe ONLY the "${label}" — ignore everything else in the frame.\n\n`
      : "";

    const prompt = isFullLook
      ? `Analyze this COMPLETE OUTFIT and return technical details for a wardrobe fitting system.

SHORT_NAME: A 2-3 word label for this outfit. Example: "Street Monochrome Set", "Summer Linen Look". Keep it concise and descriptive.

DESCRIPTION: Write a single sentence listing EVERY visible item in the outfit — clothing, footwear, AND accessories. Go from head to toe. For each piece include its FIT/SILHOUETTE (e.g. oversized, cropped, slim, wide-leg), then type, color, and key details. You MUST mention footwear if visible. Do not skip shoes or accessories — every visible item must be listed.

TAGS: Return 4-8 tags covering the overall outfit. Include tags for the dominant pieces:
- Fit tags: oversized, slim, relaxed, cropped, longline, fitted, tailored
- Fabric tags: denim, leather, cotton, silk, knit, mesh, nylon, wool, linen
- Construction tags: double-breasted, zip-front, button-down, pullover, wrap, drawstring
- Style tags: distressed, pleated, ribbed, quilted, raw-hem, high-waisted, low-rise
- Outfit tags: layered, monochrome, coordinated, athleisure, streetwear, formal

Do NOT include subjective tags like "trendy", "stylish", "cool", "edgy", "statement".

SUGGESTED_ACTIONS: Return 3-5 styling actions that could be applied to this outfit during a virtual try-on. These are physical adjustments a stylist would make. Examples: "Open jacket", "Tuck shirt", "Cuff pants", "Remove belt". Only suggest actions that make sense for the ACTUAL garments visible.`
      : `${targetClause}Analyze this garment and return technical details for a wardrobe fitting system.

SHORT_NAME: A 2-3 word label for this garment. Format: [Color] [Key Detail] [Type]. Examples: "White Cropped Vest", "Black Wide Trousers", "Red Bomber Jacket". Keep it concise — this is used as a display name, not a description.

DESCRIPTION: Write a single sentence describing the garment. Start with FIT/SILHOUETTE first — how does it sit on the body? Then include: garment type, primary material/fabric, color, and construction. The fit description must be specific enough that a tailor could replicate the silhouette.${label ? ` Describe the "${label}" ONLY.` : ""}

TAGS: Return 3-6 specific technical tags. Use terms a pattern maker or buyer would use:
- Fit tags: oversized, slim, relaxed, cropped, longline, fitted, tailored
- Fabric tags: denim, leather, cotton, silk, knit, mesh, nylon, wool, linen
- Construction tags: double-breasted, zip-front, button-down, pullover, wrap, drawstring
- Style tags: distressed, pleated, ribbed, quilted, raw-hem, high-waisted, low-rise

Do NOT include subjective tags like "trendy", "stylish", "cool", "edgy", "statement".

SUGGESTED_ACTIONS: Return 3-5 styling actions that could realistically be applied to THIS SPECIFIC garment during a virtual try-on. Only suggest actions for features the garment actually has:
- Has sleeves → "Roll sleeves", "Push sleeves up"
- Has buttons → "Unbutton", "Button up", "Unbutton top two"
- Has a zip → "Unzip", "Half-zip"
- Has a collar → "Pop collar", "Collar down"
- Is a top → "Tuck in", "French tuck", "Layer open", "Layer under"
- Is bottoms → "Cuff up", "Sag lower", "Tighter fit"
- Is shoes → "Untied", "No socks", "Loose laces"
NEVER suggest actions for features the garment does NOT have.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ text: prompt }, garmentPart],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shortName: { type: Type.STRING },
            description: { type: Type.STRING },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            suggestedActions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
        },
      },
    });

    const text = response.text;
    if (text) {
      const parsed = JSON.parse(text);
      log.info(`Analyzed garment: "${parsed.shortName}"`);
      return parsed as GarmentMetadata;
    }

    return {
      shortName: "Garment",
      description: "Standard garment",
      tags: [],
      suggestedActions: [],
    };
  }, "garment-analysis");
}
