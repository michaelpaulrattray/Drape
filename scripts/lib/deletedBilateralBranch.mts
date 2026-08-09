/**
 * THE DELETED BILATERAL BRANCH, KEPT AS A CONTROL — one copy, not two.
 *
 * `falRegionReader` asked SAM 3 *"left ear"* and *"right ear"*, took `masks[0]`
 * from each, and unioned what came back. D-238 replaced it, because on the
 * founder's frames `"right eye"` returned nothing and the union was one eye.
 *
 * A fix is only worth what its BEFORE is worth, and a before that is remembered
 * is not measured — so the deleted code lives on here, to the letter, as the
 * negative control every probe of this defect drives alongside the new path.
 *
 * It is in `lib/` and imported rather than pasted into each script for the
 * ordinary reason (law 4): two copies of a control drift, and a control that has
 * drifted from the thing it reproduces proves nothing about it.
 *
 * Provider reads only. Nothing here writes a row or charges an account.
 */
import sharp from "sharp";

import { MaskError } from "../../server/castingV2/maskGeometry";
import type { Mask } from "../../server/castingV2/maskedComposite";

/** The names the deleted branch treated as bilateral. */
export const DELETED_BILATERAL = new Set(["ear", "eyes", "eyebrows"]);

/** The singular it built its two adjectives from. */
export function deletedSingularOf(name: string): string {
  return name === "eyes" ? "eye" : name.replace(/s$/, "");
}

async function toMask(bytes: Buffer): Promise<Mask> {
  const meta = await sharp(bytes).metadata();
  const pipeline = meta.hasAlpha ? sharp(bytes).extractChannel(3) : sharp(bytes).toColourspace("b-w");
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  if (data.length !== info.width * info.height) {
    throw new MaskError(`mask is ${data.length} bytes for ${info.width}x${info.height} — not single-channel`);
  }
  return { data: Buffer.from(data), width: info.width, height: info.height };
}

/**
 * One SAM 3 question, `masks[0]` only — the discard that was suspected and
 * exonerated: the model returns exactly one mask, so there was never a second
 * one here to lose.
 */
async function askRegion(apiKey: string, image: Buffer, prompt: string): Promise<Mask | null> {
  const response = await fetch("https://fal.run/fal-ai/sam-3/image", {
    method: "POST",
    headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: `data:image/png;base64,${image.toString("base64")}`,
      prompt,
      include_scores: true,
      output_format: "png",
    }),
  });
  if (!response.ok) throw new MaskError(`sam-3 "${prompt}": ${response.status}`);
  const json: any = await response.json();
  const masks: any[] = Array.isArray(json.masks) ? json.masks : [];
  if (masks.length === 0) return null;
  const entry = masks[0];
  const url = typeof entry === "string" ? entry : entry?.url;
  if (!url) return null;
  return toMask(Buffer.from(await (await fetch(url)).arrayBuffer()));
}

/**
 * What the two sides answered, kept separately as well as unioned — the union is
 * what a caller saw, and the two halves are why.
 */
export async function deletedBilateralSides(input: {
  apiKey: string;
  image: Buffer;
  name: string;
}): Promise<{ left: Mask | null; right: Mask | null; union: Mask | null }> {
  const singular = deletedSingularOf(input.name);
  const [left, right] = await Promise.all([
    askRegion(input.apiKey, input.image, `left ${singular}`),
    askRegion(input.apiKey, input.image, `right ${singular}`),
  ]);
  const found = [left, right].filter((mask): mask is Mask => mask !== null);
  if (found.length === 0) return { left, right, union: null };
  if (found.length === 1) return { left, right, union: found[0] };
  const { unionMasks } = await import("../../server/castingV2/maskGeometry");
  return { left, right, union: unionMasks(...found) };
}

/**
 * The deleted branch behind the `RegionReader`-shaped door, so an instrument that
 * takes a reader can be driven on the old code without knowing it is old.
 */
export function deletedBilateralReader(apiKey: string): {
  region(input: { image: Buffer; name: string }): Promise<Mask>;
} {
  return {
    async region({ image, name }) {
      if (DELETED_BILATERAL.has(name)) {
        const { union } = await deletedBilateralSides({ apiKey, image, name });
        if (!union) throw new MaskError(`the segmenter found no ${name} to edit`);
        return union;
      }
      const mask = await askRegion(apiKey, image, name);
      if (!mask) throw new MaskError(`the segmenter found no ${name} to edit`);
      return mask;
    },
  };
}
