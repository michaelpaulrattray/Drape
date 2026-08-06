/**
 * DOES A DEGREE WORD STEER? — the founder's weight call, and the first real
 * observation on a soft spot the record just flagged.
 *
 * Both engines rendered heavier than "wispy". That was noted and shrugged at,
 * which is how an unverified property stays unverified forever. This runs the
 * same whole-hair instruction with the weight pushed EXPLICITLY lighter and
 * measures what changed — so "the painter drifted heavier than asked" becomes a
 * data point rather than an impression.
 *
 * The measures are chosen to mean what "wispy" means to a person:
 *
 *   COVERAGE     how much of her forehead the fringe occupies at all
 *   SEE-THROUGH  of the area the fringe claims, how much is still HER skin
 *                showing between strands. This is the one "wispy" is really
 *                about — a heavy fringe is opaque, a wispy one is a veil of
 *                separate strands you can see through.
 *   REACH        how far down the forehead it hangs
 *
 *   npx tsx scripts/calibration/fringe-weight.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { coverage, dilateMask, harvestMatteFrom, intersectMask, unionMasks, subtractMask } from "../../server/castingV2/maskGeometry";
import { adoptInteraction, compositeMasked, differenceMatte, harvestGate, outsideMaskUnchanged, readRaster, writePng, type Mask, type Raster } from "../../server/castingV2/maskedComposite";
import { runFalImageJob } from "../../server/providers/falTransport";
import { FAL_GPT_IMAGE_2_EDIT } from "../../server/providers/falImages";
import { birefnetMatte, sam3 } from "./lib/segment.mts";
import { differenceView } from "./lib/differenceView.mts";

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY required");
const OUT = "output/masked/whole-hair";
mkdirSync(OUT, { recursive: true });

const WISPY =
  "Restyle her hair as a whole: the same dark brown hair worn up in a loose, "
  + "slightly messy bun with soft tendrils falling at the temples — now cut with "
  + "a LIGHT, WISPY fringe: fine separated strands, see-through and airy, barely "
  + "veiling her forehead rather than covering it, her skin clearly visible "
  + "between the strands. The fringe belongs to the same head of hair, same "
  + "texture, density and lighting. "
  + "Keep her face, skin, identity, expression, glasses, pose, clothing and the "
  + "plain studio background exactly as they are.";

const masterBytes = readFileSync("output/masked/specimens/wire-02.png");
const master: Raster = await readRaster(masterBytes);
const hair = await sam3(masterBytes, "hair");
const faceSkin = await sam3(masterBytes, "face skin");
const eyewear = await sam3(masterBytes, "eyeglasses");
let brow = master.height;
for (let p = 0; p < eyewear.all.data.length; p++) { if (!eyewear.all.data[p]) continue; const y = Math.floor(p/master.width); if (y < brow) brow = y; }
const forehead: Mask = { data: Buffer.from(faceSkin.all.data.map((v,i)=>Math.floor(i/master.width)<brow?v:0)), width: master.width, height: master.height };
const zone = unionMasks(await dilateMask(hair.all, 48), forehead);

console.log("rendering the wispier ask on GPT Image 2…");
const job = await runFalImageJob({
  apiKey, endpoint: FAL_GPT_IMAGE_2_EDIT,
  body: { prompt: WISPY, image_urls: [`data:image/png;base64,${masterBytes.toString("base64")}`], num_images: 1, quality: "high", output_format: "png" },
  timeoutMs: 300_000, pollIntervalMs: 1_500,
});
const meta = await sharp(job.bytes).metadata();
const wispyBytes = meta.width === master.width && meta.height === master.height ? job.bytes
  : await sharp(job.bytes).resize(master.width, master.height, { fit: "fill" }).png().toBuffer();
writeFileSync(`${OUT}/gpt2-wispy-raw.png`, wispyBytes);
console.log(`  returned ${meta.width}x${meta.height}\n`);

async function measure(label: string, patchBytes: Buffer) {
  const patch: Raster = await readRaster(patchBytes);
  const patchSubject = await birefnetMatte(patchBytes);
  const patchHair = await sam3(patchBytes, "hair");
  const tapered = await harvestMatteFrom({ content: patchHair.all, matte: patchSubject, taperPx: 8 });
  const dm = differenceMatte({ master, patch, confirmed: tapered, reachPx: 40 });
  const far: number[] = [];
  for (let p = 0; p < tapered.data.length; p += 37) { if (tapered.data[p] > 0) continue; const at=p*3; far.push((Math.abs(patch.data[at]-master.data[at])+Math.abs(patch.data[at+1]-master.data[at+1])+Math.abs(patch.data[at+2]-master.data[at+2]))/3); }
  far.sort((a,b)=>a-b);
  const gated = harvestGate({ master, patch, alpha: tapered, strandColour: dm.strandColour, baselineDelta: far[Math.floor(far.length/2)] ?? 0 }).alpha;
  const ad = adoptInteraction({ master, patch, harvest: gated, bandPx: 14, mode: "shadow" });
  const c = await compositeMasked({ master, patch: ad.patch, mask: zone, edgeMatte: ad.alpha, featherRadius: 4 });
  writeFileSync(`${OUT}/weight-${label}.png`, await writePng(c.composite));

  /* On her forehead: how much does the fringe claim, and how opaque is it? */
  let claimed = 0, sumAlpha = 0, opaque = 0, seeThrough = 0, foreheadPx = 0, lowest = 0;
  for (let p = 0; p < forehead.data.length; p++) {
    if (!forehead.data[p]) continue;
    foreheadPx++;
    const a = c.applied.data[p];
    if (a === 0) continue;
    claimed++; sumAlpha += a;
    if (a >= 230) opaque++; else seeThrough++;
    const y = Math.floor(p / master.width);
    if (y > lowest) lowest = y;
  }
  const outside = outsideMaskUnchanged(master, c.composite, c.applied);
  console.log(`${label.padEnd(7)} forehead claimed ${(claimed/foreheadPx*100).toFixed(1)}%   mean alpha ${(sumAlpha/Math.max(1,claimed)).toFixed(0)}/255   `
    + `OPAQUE ${(opaque/Math.max(1,claimed)*100).toFixed(1)}%  see-through ${(seeThrough/Math.max(1,claimed)*100).toFixed(1)}%   `
    + `reaches row ${lowest}   byte-identity outside ${outside.identical}`);
  return { label, claimedShare: claimed/foreheadPx, meanAlpha: sumAlpha/Math.max(1,claimed), opaqueShare: opaque/Math.max(1,claimed), lowest };
}

const rows = [
  await measure("heavy", readFileSync(`${OUT}/gpt2-raw.png`)),
  await measure("wispy", wispyBytes),
];
console.log(`\nsteering: opaque share ${(rows[0].opaqueShare*100).toFixed(1)}% -> ${(rows[1].opaqueShare*100).toFixed(1)}%`
  + `   forehead claimed ${(rows[0].claimedShare*100).toFixed(1)}% -> ${(rows[1].claimedShare*100).toFixed(1)}%`);

const box = { left: 200, top: 60, width: 624, height: 470 };
const cells = await Promise.all([
  "output/masked/specimens/wire-02.png", `${OUT}/weight-heavy.png`, `${OUT}/weight-wispy.png`,
].map((f) => sharp(readFileSync(f)).extract(box).png().toBuffer()));
await sharp({ create: { width: box.width, height: box.height*3+16, channels: 3, background: "#0A0A0A" } })
  .composite(cells.map((input,i)=>({input,left:0,top:i*(box.height+8)}))).png().toFile(`${OUT}/WEIGHT.png`);
console.log("WEIGHT.png — master / as-asked / wispier, 100%");
writeFileSync(`${OUT}/weight.json`, `${JSON.stringify({ instruction: WISPY, rows }, null, 2)}\n`);
