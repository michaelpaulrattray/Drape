/**
 * Quality Check — Service 6: "The Gatekeeper"
 *
 * Checks uploaded model photos for issues that would cause poor VTO
 * results: mirror selfies, low resolution, face obscured, etc.
 *
 * Gemini model: gemini-2.5-flash (text-only, structured JSON)
 * Queue lane: TEXT (lightweight, ~5-10s)
 * Credit cost: 0 (free pre-flight check)
 */
import {
  getAiClient,
  withTextQueue,
  toInlinePart,
} from "./utils";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("wardrobe/qualityCheck");

// ── ImageQualityResult — canonical type ───────────────────────────────────

export interface ImageQualityResult {
  quality: "good" | "fair" | "poor";
  issues: string[];
}

// ── Issue severity classification ─────────────────────────────────────────

const SEVERE_ISSUES = ["MIRROR_SELFIE", "MULTIPLE_PEOPLE", "FACE_OBSCURED"];
const MODERATE_ISSUES = [
  "LOW_RESOLUTION",
  "HEAVY_ANGLE",
  "CLUTTERED_BG",
  "SCREENSHOT",
  "PARTIAL_BODY",
];

// ── Safe default (no issues detected) ─────────────────────────────────────

const PASS_RESULT: ImageQualityResult = { quality: "good", issues: [] };

/**
 * Analyze a model photo for quality issues that would degrade VTO output.
 *
 * @param imageUrl - S3 URL or base64 data URL of the model image
 * @returns ImageQualityResult with quality rating and detected issues
 */
export async function checkImageQuality(
  imageUrl: string,
): Promise<ImageQualityResult> {
  return withTextQueue(async () => {
    const ai = getAiClient();
    const imagePart = await toInlinePart(imageUrl);

    const prompt = `You are an image quality assessor for a virtual try-on system. Analyze this photo and check for issues that would make it a POOR clothing reference.

Check for these issues:
1. MIRROR_SELFIE: Person is taking a photo in a mirror (phone visible, reflected image)
2. FACE_OBSCURED: Face is hidden, covered, or cut off (phone blocking face, cropped above neck)
3. LOW_RESOLUTION: Image is blurry, pixelated, or very small
4. HEAVY_ANGLE: Photo taken from a steep side angle, not roughly front-facing
5. CLUTTERED_BG: Very busy background that blends with clothing
6. MULTIPLE_PEOPLE: More than one person prominently visible
7. SCREENSHOT: Obvious screenshot with UI elements, borders, watermarks covering the clothing
8. PARTIAL_BODY: Less than torso visible (just a sleeve, just shoes, etc.) — only flag this for images that appear to show a full outfit

Respond with ONLY a JSON object, no markdown:
{"issues": ["MIRROR_SELFIE", "FACE_OBSCURED"]}
If no issues: {"issues": []}
Only include issues you are confident about.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [imagePart, { text: prompt }],
      config: { responseMimeType: "application/json" },
    });

    const text = response.text?.trim() || '{"issues": []}';
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    const issues: string[] = parsed.issues || [];

    let quality: "good" | "fair" | "poor" = "good";
    if (issues.some((i: string) => SEVERE_ISSUES.includes(i))) {
      quality = "poor";
    } else if (issues.some((i: string) => MODERATE_ISSUES.includes(i))) {
      quality = "fair";
    }

    log.info(
      `Quality check complete: quality=${quality}, issues=[${issues.join(", ")}]`,
    );
    return { quality, issues };
  }, "quality-check").catch((err) => {
    log.warn(`Quality check failed: ${err.message}`);
    return PASS_RESULT;
  });
}
