/**
 * WHICH WORLD ARE WE IN? Is the speckled forehead inside the placed zone at all?
 *
 * If it is OUTSIDE, those pixels are the master's own, no grain code can have
 * touched them, and three rounds of grain craft were treating a render artefact
 * inside the generated patch as a compositing seam. That reclassification is
 * worth five minutes before any further tuning.
 *
 * Also draws the zone boundary on the picture, because "placement is primary"
 * has never been visually confirmed to put the boundary at the hairline.
 */
import "dotenv/config";
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { coverage, placeDestinationZone, unionMasks } from "../../server/castingV2/maskGeometry";
import type { Mask } from "../../server/castingV2/maskedComposite";

const apiKey = process.env.FAL_KEY!;
const OUT = "output/masked/finish-pass";
const MASTER = "output/masked/specimens/wire-08.png";

async function toMask(bytes: Buffer): Promise<Mask> {
  const meta = await sharp(bytes).metadata();
  const p = meta.hasAlpha ? sharp(bytes).extractChannel(3) : sharp(bytes).toColourspace("b-w");
  const { data, info } = await p.raw().toBuffer({ resolveWithObject: true });
  if (data.length !== info.width * info.height) throw new Error("not 1ch");
  return { data, width: info.width, height: info.height };
}
async function fal(endpoint: string, body: any) {
  const r = await fetch(`https://fal.run/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json",
      "X-Fal-Object-Lifecycle-Preference": JSON.stringify({ expiration_duration_seconds: 3600 }) },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as any;
}
const masterBytes = readFileSync(MASTER);
const uri = `data:image/png;base64,${masterBytes.toString("base64")}`;
const seg = async (prompt: string) => {
  const j = await fal("fal-ai/sam-3/image", { image_url: uri, prompt, include_scores: true, output_format: "png" });
  const u = j.masks[0]?.url ?? j.masks[0];
  return toMask(u.startsWith("data:") ? Buffer.from(u.split(",")[1], "base64") : Buffer.from(await (await fetch(u)).arrayBuffer()));
};
const j = await fal("fal-ai/birefnet/v2", { image_url: uri, mask_only: true, model: "Matting", output_format: "png" });
const su = j.mask_image?.url ?? j.image?.url;
const subject = await toMask(su.startsWith("data:") ? Buffer.from(su.split(",")[1], "base64") : Buffer.from(await (await fetch(su)).arrayBuffer()));

const zone = await placeDestinationZone({
  region: unionMasks(await seg("hair"), await toMask(readFileSync("output/masked/max-delta/aligned-afro-zone.png"))),
  subject, reach: 24, skinMargin: 8, exclude: await seg("face skin"),
});
console.log(`placed zone coverage ${(coverage(zone) * 100).toFixed(2)}%`);

/* The forehead crop the exhibit shows: left 330 top 300, 420x260. */
const BOX = { left: 330, top: 300, width: 420, height: 260 };
let inside = 0;
for (let y = BOX.top; y < BOX.top + BOX.height; y += 1)
  for (let x = BOX.left; x < BOX.left + BOX.width; x += 1)
    if (zone.data[y * zone.width + x] > 0) inside += 1;
const share = inside / (BOX.width * BOX.height);
console.log(`\nTHE ANSWER: ${(share * 100).toFixed(1)}% of the exhibited forehead crop is INSIDE the zone`);
console.log(share < 0.15
  ? "  -> mostly the MASTER's own pixels. The speckle is a RENDER artefact, not a seam."
  : "  -> genuinely inside. The speckle is ours and the finish pass still owns it.");

/* Draw the boundary so placement can be judged by eye. */
const edge = Buffer.alloc(zone.width * zone.height * 4);
for (let y = 1; y < zone.height - 1; y += 1) {
  for (let x = 1; x < zone.width - 1; x += 1) {
    const p = y * zone.width + x;
    if (zone.data[p] === 0) continue;
    const border = !zone.data[p - 1] || !zone.data[p + 1] || !zone.data[p - zone.width] || !zone.data[p + zone.width];
    if (border) { edge[p*4] = 0; edge[p*4+1] = 255; edge[p*4+2] = 90; edge[p*4+3] = 255; }
  }
}
await sharp(masterBytes).composite([{ input: edge, raw: { width: zone.width, height: zone.height, channels: 4 } }])
  .jpeg({ quality: 95 }).toFile(`${OUT}/ZONE-boundary.jpg`);
console.log(`\nwrote ZONE-boundary.jpg — the boundary drawn on the master`);
process.exit(0);
