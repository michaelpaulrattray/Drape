/**
 * WHAT THE SILHOUETTE CHANGE BUYS, ON THE FACE THE DESIGN WAS WRITTEN ABOUT.
 *
 * `measure-hairdown-revert-disposable.mts` produced the number this build
 * exists to move:
 *
 *   DELIVERED by the paid edit   232,370 px changed against the master
 *     inside the kept segment      23,231 px   10.0%
 *     OUTSIDE it                  209,139 px   90.0%
 *
 * This runs the SHIPPED cutter — `cutSegments`, imported, not re-implemented —
 * twice over the founder's own frames: once master-anchored, the way production
 * cuts today, and once with the delivered frame's own extent unioned in. The
 * difference between the two is the whole build, in pixels.
 *
 *   FAL_KEY=… npx tsx scripts/measure-delivered-anchored-cut-disposable.mts
 *
 * # What it costs
 *
 * Two R2 reads (free) and **two SAM3 region reads** — the same two calls a
 * paid render already makes for its own content gate. No render is bought and
 * no campaign credit is spent.
 *
 * # The instrument gets a positive control before its finding counts
 *
 * The master-anchored arm must land near the 23,231 px the production segment
 * mask actually covers. It will not match exactly, and the two reasons are
 * stated rather than discovered: `applied` is not stored, so the changed-pixel
 * set stands in for it, and the region read is a fresh stochastic call rather
 * than the one that ran on the day. If that arm comes back at half or double,
 * the instrument is wrong and the other arm's number means nothing.
 * (Working law 2, and the carried-crop counter that first answered 153,549
 * owned pixels against a known 24,056.)
 */
import "dotenv/config";

import { fetchImageBytes } from "./lib/imageBytes.mts";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { cutSegments } from "../server/castingV2/segmentCuts";
import type { Mask, Raster } from "../server/castingV2/maskedComposite";

const BASE = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev";

/* The same three keys the first measurement used, pulled 2026-08-09, pasted so
   this depends on no live database. */
const MASTER = "casting-v2/candidates/09c90f57-e39c-4204-8636-9c280f89000e.png";
const HAIR_DOWN = "casting-v2/variants/ac05f409-9734-4cd6-8a04-f7e360bfb5e6.png"; /* v#163 */
/** What the production segment for this render actually covers. The control. */
const KNOWN_KEPT_PIXELS = 23_231;
const KNOWN_DELIVERED_PIXELS = 232_370;

/** A re-encode's floor. Anything at or below this is not a change anyone made. */
const NOISE = 8;

const apiKey = process.env.FAL_KEY;
if (!apiKey) {
  console.error("FAL_KEY is required — this reads two regions with the production reader");
  process.exit(1);
}

const sharp = (await import("sharp")).default;

async function fetchRaster(key: string): Promise<{ bytes: Buffer; raster: Raster }> {
  const fetched = await fetchImageBytes(`${BASE}/${key}`);
  /* Three channels, because `Raster` is RGB and the cutter's crop arithmetic
     strides by three. An `ensureAlpha` here is the exact mistake that made a
     carried-crop counter read a grey mask as ownership. */
  const { data, info } = await sharp(fetched.bytes)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { bytes: fetched.bytes, raster: { data, width: info.width, height: info.height } };
}

const master = await fetchRaster(MASTER);
const down = await fetchRaster(HAIR_DOWN);

if (master.raster.width !== down.raster.width || master.raster.height !== down.raster.height) {
  console.error("the two frames are different sizes — nothing below would mean anything");
  process.exit(1);
}
const { width, height } = master.raster;
console.log(`master   ${width}x${height}`);
console.log(`v#163    ${down.raster.width}x${down.raster.height}   "she wear her hair down"\n`);

/**
 * `applied`, as the changed-pixel set.
 *
 * The composite's own mask is not persisted, and its guarantee is that outside
 * it the frame is byte-identical to the master — so every changed pixel is
 * inside it. This is therefore a SUBSET of the real `applied`, which makes both
 * arms conservative in the same direction and the comparison between them fair.
 */
const applied: Mask = { data: Buffer.alloc(width * height), width, height };
let deliveredPixels = 0;
for (let index = 0; index < width * height; index += 1) {
  const at = index * 3;
  const changed = Math.max(
    Math.abs(down.raster.data[at]! - master.raster.data[at]!),
    Math.abs(down.raster.data[at + 1]! - master.raster.data[at + 1]!),
    Math.abs(down.raster.data[at + 2]! - master.raster.data[at + 2]!),
  );
  if (changed <= NOISE) continue;
  applied.data[index] = 255;
  deliveredPixels += 1;
}
console.log(`DELIVERED by the paid edit   ${deliveredPixels.toLocaleString()} px`);
console.log(`  the first measurement read ${KNOWN_DELIVERED_PIXELS.toLocaleString()} — same frames, same rule\n`);

const reader = createFalRegionReader({ apiKey });
console.log("reading her hair on both frames…");
const [hairOnMaster, hairOnDelivered] = await Promise.all([
  reader.region({ image: master.bytes, name: "hair" }),
  reader.region({ image: down.bytes, name: "hair", absentIsAnswer: true }),
]);
const coverage = (mask: Mask) => {
  let claimed = 0;
  for (let index = 0; index < mask.data.length; index += 1) if (mask.data[index]! > 0) claimed += 1;
  return claimed;
};
console.log(`  hair on the MASTER      ${coverage(hairOnMaster).toLocaleString()} px  (her bun)`);
console.log(`  hair on the DELIVERED   ${coverage(hairOnDelivered).toLocaleString()} px  (worn down)\n`);

const facetRegions = new Map([["hairWorn", "hair"]]);
const regionMasks = new Map([["hair", hairOnMaster]]);

const [before] = cutSegments({
  composite: down.raster, applied, facetRegions, regionMasks,
});
const [after] = cutSegments({
  composite: down.raster,
  applied,
  facetRegions,
  regionMasks,
  deliveredMasks: new Map([["hair", hairOnDelivered]]),
});

const percent = (part: number, whole: number) => (whole === 0 ? "—" : `${((part / whole) * 100).toFixed(1)}%`);
const row = (label: string, cut: typeof before) => {
  if (!cut) return console.log(`${label.padEnd(22)}  NO SEGMENT — the region never met the applied mask`);
  console.log(
    `${label.padEnd(22)}  ${String(cut.pixels).padStart(9)} px  ${percent(cut.pixels, deliveredPixels).padStart(6)} of what she bought`
    + `   arrived ${cut.arrivedPixels.toLocaleString()} · departed ${cut.departedPixels.toLocaleString()}`,
  );
};

console.log("WHAT THE SEGMENT OWNS");
row("master-anchored", before);
row("delivered-anchored", after);

console.log("\nTHE CONTROL — is this instrument reading the right thing at all?");
if (before) {
  const ratio = before.pixels / KNOWN_KEPT_PIXELS;
  console.log(
    `  master-anchored ${before.pixels.toLocaleString()} against the stored segment's ${KNOWN_KEPT_PIXELS.toLocaleString()}`
    + `  —  ${ratio.toFixed(2)}x`,
  );
  console.log(
    ratio > 0.5 && ratio < 2
      ? "  WITHIN the band a fresh region read and a proxied `applied` can explain. The finding counts."
      : "  OUTSIDE that band. Something is being measured that is not the thing named. STOP.",
  );
} else {
  console.log("  the master-anchored arm produced NO segment, which contradicts the stored row. STOP.");
}

/* A script touching an app service never exits on its own. */
process.exit(0);
