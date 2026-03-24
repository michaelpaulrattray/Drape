/**
 * Tattoo Analysis — Service 5: "The Ink Scanner"
 *
 * Analyzes a model photo to detect which body areas have tattoos
 * and which are clean. The resulting TattooMap is passed to VTO
 * generation and refinement to prevent hallucinating or removing
 * tattoos.
 *
 * Gemini model: gemini-2.5-flash (text-only, structured JSON)
 * Queue lane: TEXT (lightweight, ~5-10s)
 * Credit cost: 0 (free analysis, same as SOT)
 */
import {
  getAiClient,
  withTextQueue,
  toInlinePart,
} from "./utils";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("wardrobe/tattooAnalysis");

// ── TattooMap — canonical type ────────────────────────────────────────────

export interface TattooMap {
  hasTattoos: boolean;
  tattooAreas: string[];   // e.g. ["left forearm", "right forearm", "upper right arm"]
  cleanAreas: string[];    // e.g. ["hands", "chest", "stomach", "neck", "legs", "face"]
  promptFragment: string;  // Pre-built prompt text for VTO/refinement
}

// ── Safe default (no tattoos detected) ────────────────────────────────────

const EMPTY_MAP: TattooMap = {
  hasTattoos: false,
  tattooAreas: [],
  cleanAreas: [],
  promptFragment: "",
};

/**
 * Analyze a model photo for visible tattoos and body art.
 *
 * @param imageUrl - S3 URL or base64 data URL of the model image
 * @returns TattooMap with classified body areas and a pre-built prompt fragment
 */
export async function analyzeTattoos(imageUrl: string): Promise<TattooMap> {
  return withTextQueue(async () => {
    const ai = getAiClient();
    const imagePart = await toInlinePart(imageUrl);

    const prompt = `Analyze the visible skin in this photo for tattoos and body art.

For each body area listed below, mark it as TATTOO (has visible tattoos/body art) 
or CLEAN (no tattoos, just natural skin).

Body areas to check:
- face
- neck
- chest/upper chest
- stomach/abdomen  
- left upper arm
- left forearm
- left hand
- right upper arm
- right forearm
- right hand
- left thigh
- left lower leg
- right thigh
- right lower leg

Only mark TATTOO if you can clearly see ink/body art in that area.
If a body area is not visible (covered by clothing), mark it as HIDDEN.

Respond with JSON only:
{
  "areas": {
    "face": "CLEAN",
    "neck": "CLEAN",
    "chest": "TATTOO",
    "stomach": "CLEAN",
    "left_upper_arm": "TATTOO",
    "left_forearm": "TATTOO",
    "left_hand": "CLEAN",
    "right_upper_arm": "HIDDEN",
    "right_forearm": "TATTOO",
    "right_hand": "CLEAN",
    "left_thigh": "HIDDEN",
    "left_lower_leg": "HIDDEN",
    "right_thigh": "HIDDEN",
    "right_lower_leg": "HIDDEN"
  }
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ text: prompt }, imagePart],
      config: { responseMimeType: "application/json" },
    });

    const text = response.text;
    if (!text) return EMPTY_MAP;

    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    const areas = parsed.areas || {};

    const tattooAreas: string[] = [];
    const cleanAreas: string[] = [];

    for (const [area, status] of Object.entries(areas)) {
      const readableName = area.replace(/_/g, " ");
      if (status === "TATTOO") tattooAreas.push(readableName);
      else if (status === "CLEAN") cleanAreas.push(readableName);
      // HIDDEN areas are omitted — we don't make claims about them
    }

    const hasTattoos = tattooAreas.length > 0;

    let promptFragment = "";
    if (hasTattoos) {
      promptFragment = `TATTOO MAP (from model image analysis):
Tattoos exist ONLY on: ${tattooAreas.join(", ")}.
These areas are confirmed CLEAN (no tattoos): ${cleanAreas.join(", ")}.
Areas covered by clothing are unknown — if a garment change exposes \
previously hidden skin, default to CLEAN skin unless the exposed area \
is adjacent to a confirmed tattoo area AND the tattoo visibly extends \
to the edge of the clothing line in Image 1.
Do NOT add tattoos to any CLEAN area. Do NOT extend arm tattoos to \
hands. Do NOT add chest or stomach tattoos unless they are confirmed \
in the map above.`;
    } else {
      promptFragment = `TATTOO MAP (from model image analysis):
The model has NO visible tattoos. Any exposed skin must be completely clean and free of ink. Do not hallucinate tattoos on hands, arms, chest, or neck.`;
    }

    log.info(
      `Tattoo analysis complete: hasTattoos=${hasTattoos}, areas=${tattooAreas.length} tattoo / ${cleanAreas.length} clean`,
    );
    return { hasTattoos, tattooAreas, cleanAreas, promptFragment };
  }, "tattoo-analysis").catch((err) => {
    log.warn(`Tattoo analysis failed: ${err.message}`);
    return EMPTY_MAP;
  });
}
