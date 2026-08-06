/**
 * THE TWO SEGMENTERS THE WORKSTREAM ACTUALLY USES, in one place.
 *
 * Ratified in the first two shop rounds and unchanged since:
 *
 *   SAM 3            knows WHERE. Precise on named regions (0.77–0.96), holds on
 *                    thin wire, finds eyes through lenses — and is 100% BINARY,
 *                    so it never supplies a blendable edge.
 *   BiRefNet Matting knows the EDGE. A real alpha ramp, and an opinion about
 *                    exactly one thing: the whole subject.
 *
 * Neither is a hair matte. D-216 measured that fal's catalogue has no
 * face-parsing model and no hair-matting model at all — the row is a
 * COMPOSITION, `harvestMatteFrom(SAM 3 ∩ BiRefNet)`, and this module exists so
 * the two halves are fetched the same way everywhere rather than being
 * re-implemented per fixture with a different threshold each time.
 *
 * **Every prompt sent through here must be record-gated (D-213).** Asking a
 * segmenter an open question — *"where are her eyeglasses?"* at a woman wearing
 * none — returns a confident little blob, and a confident little blob clears
 * every floor we have. The callers ask only about things the record says are
 * there.
 */
import sharp from "sharp";

import { type Mask } from "../../../server/castingV2/maskedComposite";
import { unionMasks } from "../../../server/castingV2/maskGeometry";

const apiKey = process.env.FAL_KEY;

function key(): string {
  if (!apiKey) throw new Error("FAL_KEY required");
  return apiKey;
}

/** fal's generated objects expire in an hour unless asked otherwise. */
const LIFECYCLE = JSON.stringify({ expiration_duration_seconds: 3600 });

async function post(endpoint: string, body: unknown): Promise<any> {
  const response = await fetch(`https://fal.run/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${key()}`,
      "Content-Type": "application/json",
      "X-Fal-Object-Lifecycle-Preference": LIFECYCLE,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${endpoint}: ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

async function fetchMask(url: string): Promise<Mask> {
  const raw = url.startsWith("data:")
    ? Buffer.from(url.split(",")[1], "base64")
    : Buffer.from(await (await fetch(url)).arrayBuffer());
  return toMask(raw);
}

/**
 * A returned PNG into a single-channel mask.
 *
 * **The channel count is proven, never assumed** — D-210 landed three times in
 * one session through exactly this door: sharp promotes buffers to three
 * channels behind your back, and every loop downstream walks one byte per pixel.
 * `toColourspace("b-w")` converts 4→1, so a guard placed after it could only
 * ever pass; the guard has to be on the raw fact.
 */
export async function toMask(bytes: Buffer): Promise<Mask> {
  const meta = await sharp(bytes).metadata();
  const pipeline = meta.hasAlpha ? sharp(bytes).extractChannel(3) : sharp(bytes).toColourspace("b-w");
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  if (data.length !== info.width * info.height) {
    throw new Error(`mask is ${data.length} bytes for ${info.width}x${info.height} — not single-channel`);
  }
  return { data, width: info.width, height: info.height };
}

export type Sam3Result = {
  /** The highest-scoring instance alone. */
  top: Mask;
  /** Every instance above the score floor, unioned. */
  all: Mask;
  /** Per-instance scores, in the order returned — so a caller can see what it got. */
  scores: (number | null)[];
  instances: number;
};

/**
 * One named region from SAM 3.
 *
 * Returns the top instance AND the union of all of them, because which one is
 * right is a property of the question: "hair" is one object, "t-shirt" on a
 * two-tone garment can come back as two. Reporting both, with the scores, is how
 * that stays a decision rather than a silent `masks[0]`.
 */
export async function sam3(
  image: Buffer,
  prompt: string,
  options: { scoreFloor?: number } = {},
): Promise<Sam3Result> {
  const floor = options.scoreFloor ?? 0.3;
  const json = await post("fal-ai/sam-3/image", {
    image_url: `data:image/png;base64,${image.toString("base64")}`,
    prompt,
    include_scores: true,
    output_format: "png",
  });
  const masks: any[] = Array.isArray(json.masks) ? json.masks : [];
  if (masks.length === 0) throw new Error(`"${prompt}" returned nothing`);
  const scores: (number | null)[] = masks.map((_, index) => {
    const raw = json?.scores?.[index] ?? json?.metadata?.[index]?.score ?? null;
    return raw === null ? null : Number(raw);
  });
  const resolved = await Promise.all(
    masks.map((entry) => fetchMask(typeof entry === "string" ? entry : entry.url)),
  );
  const kept = resolved.filter((_, index) => (scores[index] ?? 1) >= floor);
  return {
    top: resolved[0],
    all: unionMasks(...(kept.length > 0 ? kept : resolved)),
    scores,
    instances: masks.length,
  };
}

/**
 * The whole-subject matte, with the real edge ramp.
 *
 * **This is never a harvest matte on its own.** It is opaque across hair, skin
 * and clothing alike — that indifference is what let a painter's repainted
 * t-shirt through the wall once already. It supplies an EDGE; `harvestMatteFrom`
 * supplies the territory.
 */
export async function birefnetMatte(image: Buffer): Promise<Mask> {
  const json = await post("fal-ai/birefnet/v2", {
    image_url: `data:image/png;base64,${image.toString("base64")}`,
    mask_only: true,
    model: "Matting",
    output_format: "png",
  });
  const url = json?.mask_image?.url ?? json?.image?.url;
  if (!url) throw new Error("birefnet returned no mask");
  return fetchMask(url);
}
