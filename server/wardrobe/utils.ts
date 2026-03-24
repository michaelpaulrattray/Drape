/**
 * Wardrobe Utilities — Shared helpers for all wardrobe AI services.
 *
 * Reuses casting infrastructure (geminiClient, geminiQueue, storage)
 * and provides wardrobe-specific helpers (safety term sanitization,
 * image conversion, response diagnosis).
 */
import {
  getAiClient,
  SAFETY_SETTINGS,
  extractBase64Data,
} from "../casting/geminiClient";
import { withTextQueue, withImageQueue } from "../casting/geminiQueue";
import { storagePut } from "../storage";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("wardrobe/utils");

// Re-export queue helpers for convenience
export { getAiClient, SAFETY_SETTINGS, withTextQueue, withImageQueue };

// ── Safety Term Sanitization ───────────────────────────────────────────────
const SAFETY_TERM_MAP: Record<string, string> = {
  bralette: "cropped top",
  bra: "cropped top",
  "sports bra": "athletic crop top",
  "sports-bra": "athletic crop top",
  lingerie: "delicate",
  negligee: "slip dress",
  corset: "structured bodice top",
  bustier: "structured strapless top",
  garter: "leg strap",
  thong: "minimal brief",
  "g-string": "minimal brief",
  "bikini top": "halter crop top",
  "bikini bottom": "swim brief",
  bikini: "two-piece swim set",
  underwear: "base layer",
  panties: "brief",
  boxers: "loose shorts",
  briefs: "fitted shorts",
  camisole: "thin strap top",
};

export function sanitizeDescription(desc: string): string {
  let sanitized = desc;
  const sortedTerms = Object.entries(SAFETY_TERM_MAP).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [term, replacement] of sortedTerms) {
    const regex = new RegExp(term, "gi");
    sanitized = sanitized.replace(regex, replacement);
  }
  return sanitized;
}

// ── Image Conversion Helpers ───────────────────────────────────────────────

/** Convert a URL or base64 data URL to a raw base64 string + mimeType */
export async function urlToBase64(
  url: string,
): Promise<{ data: string; mimeType: string }> {
  if (url.startsWith("data:")) {
    const mimeMatch = url.match(/^data:(.+?);base64,/);
    const mimeType = mimeMatch?.[1] || "image/png";
    const data = extractBase64Data(url);
    return { data, mimeType };
  }
  const response = await fetch(url);
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "image/png";
  return { data: buffer.toString("base64"), mimeType: contentType };
}

/** Build a Gemini inlineData part from a URL or base64 data URL */
export async function toInlinePart(
  url: string,
): Promise<{ inlineData: { data: string; mimeType: string } }> {
  const { data, mimeType } = await urlToBase64(url);
  return { inlineData: { data, mimeType } };
}

/** Upload a base64 data URL to S3 and return the public URL */
export async function uploadBase64ToS3(
  base64DataUrl: string,
  prefix: string,
): Promise<string> {
  const base64Data = base64DataUrl.replace(/^data:.*?;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  const filename = `${prefix}/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
  const { url } = await storagePut(filename, buffer, "image/png");
  return url;
}

// ── Response Diagnosis ─────────────────────────────────────────────────────

export interface ResponseDiagnosis {
  imageBase64: string | null;
  finishReason: string | null;
  blockReason: string | null;
  isSafetyBlock: boolean;
  rawText: string | null;
}

export function diagnoseResponse(response: any): ResponseDiagnosis {
  const result: ResponseDiagnosis = {
    imageBase64: null,
    finishReason: null,
    blockReason: null,
    isSafetyBlock: false,
    rawText: null,
  };

  const blockReason = response?.promptFeedback?.blockReason;
  if (blockReason) {
    result.blockReason = blockReason;
    result.isSafetyBlock = true;
    return result;
  }

  const candidates = response?.candidates;
  if (!candidates || candidates.length === 0) {
    result.finishReason = "NO_CANDIDATES";
    return result;
  }

  const candidate = candidates[0];
  result.finishReason = candidate.finishReason || null;

  if (
    result.finishReason &&
    ["SAFETY", "BLOCKED", "RECITATION", "PROHIBITED_CONTENT"].includes(
      result.finishReason,
    )
  ) {
    result.isSafetyBlock = true;
  }

  for (const part of candidate.content?.parts || []) {
    if (part.inlineData?.data && !result.imageBase64) {
      result.imageBase64 = `data:image/png;base64,${part.inlineData.data}`;
    }
    if (part.text) {
      result.rawText = part.text;
    }
  }

  if (!result.imageBase64 && !result.isSafetyBlock) {
    log.error(
      `No image in response. finishReason=${result.finishReason}, text=${result.rawText?.slice(0, 200)}`,
    );
  }

  return result;
}

// ── Aspect Ratio Detection ────────────────────────────────────────────────

export type GeminiAspectRatio = "16:9" | "4:3" | "1:1" | "4:5" | "3:4" | "2:3" | "9:16";

/**
 * Fetch an image, measure its dimensions with sharp, and return
 * the closest Gemini-supported aspect ratio bucket.
 */
export async function getImageAspectBucket(
  imageUrl: string,
): Promise<GeminiAspectRatio> {
  try {
    const sharp = (await import("sharp")).default;
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(buffer).metadata();
    const w = metadata.width ?? 1;
    const h = metadata.height ?? 1;
    const ratio = w / h;

    if (ratio > 1.4) return "16:9";
    if (ratio > 1.15) return "4:3";
    if (ratio > 0.9) return "1:1";
    if (ratio > 0.72) return "4:5";
    if (ratio > 0.6) return "3:4";
    if (ratio > 0.5) return "2:3";
    return "9:16";
  } catch (e) {
    log.warn(`Failed to detect aspect ratio for ${imageUrl}, defaulting to 3:4: ${e}`);
    return "3:4";
  }
}

// ── Layer Priority Helpers ─────────────────────────────────────────────────

const INNER_LAYER_TAGS = [
  "tights", "leggings", "compression", "thermal", "stockings", "pantyhose",
  "undershirt", "camisole", "tank", "sports-bra", "bralette",
  "liner", "slip", "base-layer", "fitted", "skin-tight",
];

const OUTER_LAYER_TAGS = [
  "cargo", "jeans", "trousers", "chinos", "wide-leg", "straight-leg",
  "jacket", "coat", "blazer", "puffer", "parka", "overcoat", "bomber",
  "oversized", "baggy", "relaxed", "layering-piece",
];

export interface GarmentForVTO {
  id: string;
  type: string;
  shortName?: string;
  description?: string;
  styleNote?: string;
  tags?: string[];
  imageUrl?: string;        // S3 URL of the original crop
  isolatedPreviewUrl?: string; // S3 URL of the flat-lay
  sourceImageUrl?: string;  // S3 URL of the full source image
}

export function getIntraCategoryWeight(garment: GarmentForVTO): number {
  const tags = (garment.tags || []).map((t) => t.toLowerCase());
  const desc = (garment.description || "").toLowerCase();

  const hasInnerTag = tags.some((t) =>
    INNER_LAYER_TAGS.some((inner) => t.includes(inner)),
  );
  const hasOuterTag = tags.some((t) =>
    OUTER_LAYER_TAGS.some((outer) => t.includes(outer)),
  );
  const descHasInner = INNER_LAYER_TAGS.some((inner) => desc.includes(inner));
  const descHasOuter = OUTER_LAYER_TAGS.some((outer) => desc.includes(outer));

  if (hasInnerTag || descHasInner) return 0;
  if (hasOuterTag || descHasOuter) return 10;
  return 5;
}

/** Sort garments by layer priority (skin → out) */
export function sortByLayerPriority(garments: GarmentForVTO[]): GarmentForVTO[] {
  const layerPriority: Record<string, number> = {
    full_look: 10,
    tops: 20,
    bottoms: 20,
    shoes: 30,
    accessories: 50,
  };

  return [...garments].sort((a, b) => {
    const categoryDiff =
      (layerPriority[a.type] || 0) - (layerPriority[b.type] || 0);
    if (categoryDiff !== 0) return categoryDiff;
    return getIntraCategoryWeight(a) - getIntraCategoryWeight(b);
  });
}
