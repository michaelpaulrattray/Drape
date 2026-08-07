/**
 * DOES THE HARVEST DISCARD THE REVEAL? (adapter finding B)
 *
 * `harvestRefinement` asks the painted frame *where the thing is* —
 * `region(painted, "hair")`. That is right for growth and self-defeating for a
 * SHRINK: when a ponytail becomes an updo, the revealed shoulder is not "hair",
 * so nothing is harvested there and the master's old ponytail survives the
 * composite even if the painter did the job perfectly. The same logic would
 * make a glasses removal keep the glasses.
 *
 * The stored hair-up specimen could not settle it. The delivered frame is
 * 99.91% identical to its master with the only change in the eye band, and no
 * harvested updo content at the crown — which is what painter NON-compliance
 * looks like, and also what an empty harvest looks like. The painted frame is
 * not stored, so the two are indistinguishable after the fact.
 *
 * This renders one and looks at both halves:
 *
 *   painted shows an updo, composed shows the old ponytail → B PROVEN.
 *   painted still shows hair down                          → the painter, not B.
 *
 * One paid render against the calibration budget, and it doubles as the fixture
 * the fix is verified against.
 *
 *   npx tsx scripts/calibration/shrink-harvest.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createFalMaskedEditEngine } from "../../server/providers/falImages";
import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { harvestRefinement } from "../../server/castingV2/maskedRefine";
import { facetOfSubject } from "../../server/castingV2/refineFacets";

const OUT = "output/masked/shrink-harvest";
mkdirSync(OUT, { recursive: true });

/* The founder's own specimen, pulled from production for the false-pass
   diagnosis — hair long, down, and plainly over one shoulder. */
const MASTER = `${OUT}/../hair-up/master.png`;
const master = readFileSync(MASTER);
const meta = await sharp(master).metadata();
console.log(`master ${meta.width}x${meta.height} — hair down over the shoulder\n`);

const engine = createFalMaskedEditEngine({ apiKey: process.env.FAL_KEY! });
const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });

const PROMPT = "Edit this photograph of this exact person, changing ONLY what is listed below. "
  + "Change how the hair is worn: gathered up and fastened at the back of the head, "
  + "off the shoulders and away from the neck entirely — the same hair, restyled upward, "
  + "not cut and not a different head of hair.";

const began = Date.now();
const painted = await engine.edit({
  prompt: PROMPT,
  references: [{ bytes: master, contentType: "image/png" }],
  width: meta.width!, height: meta.height!,
});
writeFileSync(`${OUT}/painted.png`, painted.bytes);
console.log(`painted in ${((Date.now() - began) / 1000).toFixed(1)}s`);

const composed = await harvestRefinement({
  master: { bytes: master, contentType: "image/png" },
  painted: { bytes: painted.bytes, contentType: painted.contentType },
  facets: [facetOfSubject("hairWorn")],
  reader,
  userId: 1,
  described: "gathered up and fastened at the back of the head",
});
writeFileSync(`${OUT}/composed.png`, composed.bytes);
console.log("composed through the product's own adapter\n");

/* Where did each half move, in bands? The crown and the shoulder are the two
   places that tell the story apart. */
const raw = async (bytes: Buffer) =>
  sharp(bytes).resize(meta.width!, meta.height!, { fit: "fill" }).removeAlpha().raw().toBuffer();
const A = await raw(master);
const W = meta.width!, H = meta.height!;

for (const [label, bytes] of [["painted", painted.bytes], ["composed", composed.bytes]] as const) {
  const B = await raw(bytes);
  const bands = 6, rowsPer = Math.floor(H / bands);
  const parts: string[] = [];
  for (let b = 0; b < bands; b += 1) {
    let moved = 0, n = 0;
    for (let y = b * rowsPer; y < Math.min((b + 1) * rowsPer, H); y += 1) {
      for (let x = 0; x < W; x += 1) {
        const i = (y * W + x) * 3;
        const d = (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3;
        n += 1;
        if (d > 25) moved += 1;
      }
    }
    parts.push(`${((moved / n) * 100).toFixed(1)}%`);
  }
  console.log(`${label.padEnd(9)} by band (crown→hem): ${parts.join("  ")}`);
}

/* And look at it, because a band table cannot tell an updo from a haircut. */
const cells = await Promise.all(
  [master, painted.bytes, composed.bytes].map((b) => sharp(b).resize(420).png().toBuffer()),
);
const h = (await sharp(cells[0]).metadata()).height!;
await sharp({ create: { width: 420 * 3 + 24, height: h, channels: 3, background: "#0A0A0A" } })
  .composite(cells.map((input, i) => ({ input, left: i * (420 + 12), top: 0 })))
  .png()
  .toFile(`${OUT}/TRIPTYCH.png`);
console.log(`\nTRIPTYCH.png — master | painted | composed`);
