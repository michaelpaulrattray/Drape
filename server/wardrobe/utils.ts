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
import { randomUUID } from "node:crypto";
import { withTextQueue, withImageQueue } from "../casting/geminiQueue";
import { putWardrobeScratchUpload } from "./scratchUpload";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("wardrobe/utils");

// Re-export queue helpers for convenience
export { getAiClient, SAFETY_SETTINGS, withTextQueue, withImageQueue };

// ── Safety Term Sanitization ───────────────────────────────────────────────
/**
 * Exported so the arm that proves this device can DERIVE its population from
 * the map itself. A test that retypes these twenty pairs is a second copy of a
 * source of truth (working law 4) — it would stay green with the map emptied,
 * which is precisely the state the old arm was in.
 */
export const SAFETY_TERM_MAP: Record<string, string> = {
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

/**
 * Rename a garment to a construction noun before it reaches an image engine.
 *
 * The map above is the device: every replacement names the same object by how
 * it is BUILT (`cropped top`, `structured bodice top`, `base layer`) rather
 * than softening a descriptor. Nothing here removes a body word, and that is
 * deliberate — it is a rename, not a euphemism.
 *
 * ⚠ **THE MATCH IS WORD-BOUNDED, AND IT WAS NOT UNTIL 2026-08-25.**
 *
 * `new RegExp(term, "gi")` matches anywhere inside a word, so the three-letter
 * entry `bra` ate every ordinary word containing those letters. Driven through
 * this function, printed output, before the fix:
 *
 *   "a silver bracelet and a linen shirt" -> "a silver cropped topcelet and a linen shirt"
 *   "an embroidered brand label"          -> "an embroidered cropped topnd label"
 *   "a warm embrace of colour"            -> "a warm emcropped topce of colour"
 *   "abrasive canvas"                     -> "acropped topsive canvas"
 *   "a libra pendant"                     -> "a licropped top pendant"
 *
 * `bracelet` is not a hypothetical word in a wardrobe product. A customer who
 * typed *"silver bracelet"* into a garment description had `cropped topcelet`
 * sent to the image engine, on a paid road, silently.
 *
 * It is the same class as the typo gate that owned the real word *"shave"* and
 * blocked the founder's own bald ask: a substitution table applied without a
 * boundary owns every word its keys are a substring of.
 *
 * **Longest key first still matters and is kept**: `sports bra` must be
 * consumed before `bra`, and `bikini top` before `bikini`, or the shorter key
 * rewrites the longer one's object into something that no longer names it.
 * The boundary and the ordering are two different guarantees and this needs
 * both.
 *
 * ⚠ **The key is escaped before it becomes a pattern.** Every current key is
 * plain letters, a space or a hyphen, so nothing is escaped today — but a key
 * is a garment name somebody will one day write with a `.` or a `+` in it, and
 * an unescaped one silently becomes a wildcard rather than an error.
 *
 * ⚠ **A REPLACEMENT'S LAST WORD ABSORBS THE SAME WORD BEHIND THE MATCH.**
 * *"a corset top"* rendered *"a structured bodice top **top**"*, because seven
 * of the replacements end in a garment noun the customer has usually just
 * typed herself — `corset top`, `bralette top`, `bra top`, `camisole top` are
 * all ordinary things to write. So the pattern optionally consumes one
 * trailing repeat of the replacement's final word.
 *
 * **The tradeoff, stated rather than slipped in:** this DROPS a word the
 * customer typed, in exactly the case where keeping it produces a stutter. It
 * is scoped as narrowly as the defect — one word, only where it duplicates the
 * replacement's own last word, only immediately behind the match — and every
 * cell of it is driven in the arm rather than argued about here.
 */
export function sanitizeDescription(desc: string): string {
  let sanitized = desc;
  const sortedTerms = Object.entries(SAFETY_TERM_MAP).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [term, replacement] of sortedTerms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tail = replacement.slice(replacement.lastIndexOf(" ") + 1);
    const tailEscaped = tail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b(?:\\s+${tailEscaped}\\b)?`, "gi");
    sanitized = sanitized.replace(regex, replacement);
  }
  return sanitized;
}

// ── Image Conversion Helpers ───────────────────────────────────────────────

/** Convert a URL or base64 data URL to a raw base64 string + mimeType */
async function urlToBase64(
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

/**
 * A wardrobe output, registered before it exists — the one writer behind
 * {@link uploadTryOnResult} and {@link uploadGarmentFlatLay}.
 *
 * It goes through {@link putWardrobeScratchUpload} — #1961's
 * register-before-write, not a second mechanism — so a held manifest names the
 * key before the bytes land, and the row that keeps the picture discharges the
 * receipt in its own transaction. Anything that never reaches that row leaves
 * the manifest standing and the worker collects the object after
 * `WARDROBE_SCRATCH_HOLD_MS`.
 *
 * The key's shape (`wardrobe/<id>/<folder>/<ms>-<uuid>.png`) and the content
 * type are exactly what the old unregistered `uploadBase64ToS3` wrote, so the
 * account-erasure sweep's prefix reading (`wardrobeOwnedKeyPrefixes`) is
 * unchanged.
 */
async function uploadRegisteredWardrobeOutput(
  base64DataUrl: string,
  userId: string,
  folder: "vto-results" | "flat-lays",
): Promise<{ url: string; key: string; cleanupBatchId: string }> {
  /* The pipeline carries the account id as a string (it is a chat-session key
     too). A manifest belongs to an account by its numeric id, and a value that
     does not round-trip is refused rather than registered under a wrong
     owner — the write then never happens, which is the safe side. */
  const ownerId = Number(userId);
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0 || String(ownerId) !== userId) {
    throw new Error(`a wardrobe picture needs a numeric account id, got "${userId}"`);
  }
  const base64Data = base64DataUrl.replace(/^data:.*?;base64,/, "");
  return putWardrobeScratchUpload({
    userId: ownerId,
    key: `wardrobe/${ownerId}/${folder}/${Date.now()}-${randomUUID()}.png`,
    bytes: Buffer.from(base64Data, "base64"),
    contentType: "image/png",
  });
}

/**
 * A TRY-ON RESULT, REGISTERED BEFORE IT EXISTS (#1980).
 *
 * `vto.generate`, `vto.incremental` (both of its exits) and `vto.refine` wrote
 * their result with no manifest and then recorded it on
 * `wardrobeSessions.history` — **only when the request carried a session that
 * was found**. With none, the URL went back to the client and nothing in the
 * product ever named the key again.
 *
 * The receipt travels back to the route, which hands it to
 * `appendSessionResult`: the session holds the key and the manifest is gone, or
 * no session holds it and the worker collects it — unless a Look or Outfit is
 * saved from it first, which adopts it by its key (#2094,
 * `adoptOwnedScratchKeyIn`).
 */
export async function uploadTryOnResult(
  base64DataUrl: string,
  userId: string,
): Promise<{ url: string; cleanupBatchId: string }> {
  const { url, cleanupBatchId } = await uploadRegisteredWardrobeOutput(base64DataUrl, userId, "vto-results");
  return { url, cleanupBatchId };
}

/**
 * A GARMENT'S FLAT-LAY, REGISTERED BEFORE IT EXISTS (#2095).
 *
 * `digitizeGarment` wrote it with the unregistered `uploadBase64ToS3`, and the
 * routes recorded it on the garment only after `analyzeGarmentMetadata` had
 * also succeeded. When analysis threw, the catch marked the garment failed and
 * the key was recorded nowhere — a permanently public object no cleanup could
 * reach. The key and receipt now travel back to the route, which hands both to
 * `updateGarment`: it writes `isolatedImageKey` and discharges the manifest in
 * one transaction, or — on the failure road — nothing discharges it.
 *
 * With this, `uploadBase64ToS3` had no caller left and is deleted: there is no
 * unregistered wardrobe writer any more.
 */
export async function uploadGarmentFlatLay(
  base64DataUrl: string,
  userId: string,
): Promise<{ url: string; key: string; cleanupBatchId: string }> {
  return uploadRegisteredWardrobeOutput(base64DataUrl, userId, "flat-lays");
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

export type GeminiAspectRatio = "21:9" | "16:9" | "4:3" | "1:1" | "4:5" | "3:4" | "2:3" | "9:16";

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

    if (ratio > 2.0) return "21:9";
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

function getIntraCategoryWeight(garment: GarmentForVTO): number {
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
