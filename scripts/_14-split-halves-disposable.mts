/**
 * WHERE THE SPLIT'S FORTY SECONDS ACTUALLY GO — #14 slice 3a-2.
 *
 * Two readings of the real road came back at 46–49 s a split against §8's
 * 4.3–6.6 s, and the court's own resolution did not explain it. Before that is
 * reported as "the provider got slower", the road's two halves are timed
 * separately, because they are not the same kind of thing:
 *
 *   1. the ONE provider call, which is what the court timed (`q.ms`);
 *   2. the mask DOWNLOADS — and `splitAtPoints` fetches them in a
 *      `for … await` loop, so a 32-mask answer is 32 sequential round trips
 *      that the court never paid for at all.
 *
 * If the second half is most of it, the gap is ours and not the provider's.
 *
 *   npx tsx scripts/_14-split-halves-disposable.mts
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import sharp from "sharp";

const FIXTURE = "C:/Users/Admin/drape-scratch/relay-14spot/fixtures/ref-worn.jpg";
const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("no FAL_KEY");

const native = readFileSync(FIXTURE);
const frame = await sharp(native)
  .resize({ height: 1024, fit: "inside", withoutEnlargement: true })
  .png()
  .toBuffer();
const meta = await sharp(frame).metadata();
const width = meta.width ?? 0;
const height = meta.height ?? 0;

const points: { x: number; y: number; label: number; object_id: number }[] = [];
const columns = width >= height ? 8 : 4;
const rows = width >= height ? 4 : 8;
for (let row = 0; row < rows; row += 1) {
  for (let column = 0; column < columns; column += 1) {
    points.push({
      x: Math.round(((column + 0.5) / columns) * width),
      y: Math.round(((row + 0.5) / rows) * height),
      label: 1,
      object_id: points.length + 1,
    });
  }
}

console.log(`=== ${width}x${height}, ${points.length} points ===`);

const postAt = Date.now();
const response = await fetch("https://fal.run/fal-ai/sam-3/image", {
  method: "POST",
  headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    image_url: `data:image/png;base64,${frame.toString("base64")}`,
    prompt: "",
    point_prompts: points,
    apply_mask: false,
    output_format: "png",
    return_multiple_masks: true,
    max_masks: 32,
  }),
});
const json: any = await response.json();
const postMs = Date.now() - postAt;

const urls: string[] = (Array.isArray(json?.masks) ? json.masks : [])
  .map((entry: any) => (typeof entry === "string" ? entry : entry?.url))
  .filter((url: unknown): url is string => typeof url === "string" && url.length > 0);

console.log(`THE ONE PROVIDER CALL : ${postMs} ms   (the court's own q.ms, 4.3–6.6 s in section 8)`);
console.log(`masks returned        : ${urls.length}`);

/* Half two, exactly as the shipped road does it: one at a time. */
const serialAt = Date.now();
for (const url of urls) {
  const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
  await sharp(bytes).greyscale().raw().toBuffer();
}
const serialMs = Date.now() - serialAt;

/* And the same work with the downloads overlapped, for the comparison. */
const parallelAt = Date.now();
await Promise.all(
  urls.map(async (url) => {
    const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
    await sharp(bytes).greyscale().raw().toBuffer();
  }),
);
const parallelMs = Date.now() - parallelAt;

console.log(`THE 32 MASK DOWNLOADS, one at a time (the shipped road) : ${serialMs} ms`);
console.log(`the same downloads overlapped                           : ${parallelMs} ms`);
console.log(`\nso the road is ${postMs + serialMs} ms, of which the provider is ${((postMs / (postMs + serialMs)) * 100).toFixed(0)}%`);
console.log(`overlapping the downloads would make it ${postMs + parallelMs} ms`);

process.exit(0);
