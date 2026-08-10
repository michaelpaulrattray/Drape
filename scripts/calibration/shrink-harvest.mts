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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

/*
  THE PAINTED FRAME IS THE FIXTURE, AND IT IS KEPT.

  This started as a one-render diagnosis and is now the regression test for the
  fix it proved the need for. Re-painting to check a COMPOSITING change would
  vary the one thing that must be held still: the painter is stochastic, so a
  fresh render would leave "did the fix work" and "did the painter do the job
  this time" inseparable — which is precisely the ambiguity that made the
  original specimen undiagnosable and the reason the painted frame is saved at
  all. So by default this re-composites the STORED paint, for free.

  `--repaint` takes a fresh one, for when the question really is about the paint.
*/
const repaint = process.argv.includes("--repaint");
let painted: { bytes: Buffer; contentType: string };
if (repaint || !existsSync(`${OUT}/painted.png`)) {
  const began = Date.now();
  const fresh = await engine.edit({
    prompt: PROMPT,
    references: [{ bytes: master, contentType: "image/png" }],
    width: meta.width!, height: meta.height!,
  });
  writeFileSync(`${OUT}/painted.png`, fresh.bytes);
  painted = { bytes: fresh.bytes, contentType: fresh.contentType };
  console.log(`painted in ${((Date.now() - began) / 1000).toFixed(1)}s`);
} else {
  painted = { bytes: readFileSync(`${OUT}/painted.png`), contentType: "image/png" };
  console.log("re-composited the STORED paint — the painter is held still (--repaint to take a fresh one)");
}

const composed = await harvestRefinement({
  master: { bytes: master, contentType: "image/png" },
  painted: { bytes: painted.bytes, contentType: painted.contentType },
  facets: [facetOfSubject("hairWorn")],
  reader,
  userId: 1,
  described: "gathered up and fastened at the back of the head",
  /* Return the working. A fixture that inspects the adapter's OWN masks cannot
     drift from the adapter, which is exactly what a rebuilt harness does. */
  explain: true,
});
writeFileSync(`${OUT}/composed.png`, composed.bytes);
console.log("composed through the product's own adapter\n");

/* Every term as its own picture. `applied` is canonical — the only boundary
   source that cannot disagree with the composite. */
for (const [name, mask] of Object.entries(composed.explain ?? {})) {
  writeFileSync(`${OUT}/mask-${name}.png`, await sharp(mask.data, {
    raw: { width: mask.width, height: mask.height, channels: 1 },
  }).png().toBuffer());
  let sum = 0;
  for (let i = 0; i < mask.data.length; i += 1) sum += mask.data[i];
  console.log(`  ${name.padEnd(10)} ${((sum / (mask.data.length * 255)) * 100).toFixed(2)}% of frame, alpha-weighted`);
}
console.log();

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

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
