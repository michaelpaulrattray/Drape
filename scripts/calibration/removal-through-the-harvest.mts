/**
 * THE REMOVAL, THROUGH THE PRODUCTION COMPOSITOR — the second half of the court.
 *
 * `glasses-fixture --only c-remove-glasses` proved the half that had never
 * worked: with the departed clause in the prompt, **the painter removes** — the
 * segmenter finds 0.000% eyeglasses in the raw frame from both engines. That
 * settles "our sentence failed", which is where three previous paints died.
 *
 * It then reported the composite putting them back — but that fixture builds its
 * composite BY HAND from a tight segmentation of the object, and production does
 * not. `harvestRefinement` treats a departure as its own territory: the object is
 * on the master, so the zone is its whole footprint widened by a reach fraction,
 * because her frames run out to her temples while a landmark corridor is two
 * small discs at the eyes.
 *
 * So the hand-built answer is evidence about a pipeline nobody ships. This drives
 * the REAL one, on the frames already paid for — no engine is called again.
 *
 *   npx tsx scripts/calibration/removal-through-the-harvest.mts
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";

import { coverage } from "../../server/castingV2/maskGeometry";
import { readRaster } from "../../server/castingV2/maskedComposite";
import { harvestRefinement } from "../../server/castingV2/maskedRefine";
import { createFalRegionReader } from "../../server/castingV2/falRegionReader";

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY required");

const OUT = "output/masked/glasses-fixture";
const MASTER = "output/masked/specimens/fresh-02.png";
const BAND = 0.004;

/* The same construction production uses — built here rather than imported, so
   driving this never reaches into the service's own wiring. */
const reader = createFalRegionReader({ apiKey });

/** Ask a frame whether the thing is still on it. An empty set IS the answer. */
async function stillPresent(bytes: Buffer, name: string): Promise<number> {
  try {
    return coverage(await reader.region({ image: bytes, name }));
  } catch {
    return 0;
  }
}

const master = readFileSync(MASTER);

for (const engine of ["nbp", "gpt2"]) {
  const paintedFile = `${OUT}/c-remove-glasses-${engine}-raw.png`;
  const painted = readFileSync(paintedFile);
  console.log(`\n### ${engine} — ${paintedFile}`);

  let harvested;
  try {
    harvested = await harvestRefinement({
      master: { bytes: master, contentType: "image/png" },
      painted: { bytes: painted, contentType: "image/png" },
      /*
        WHAT THE SERVICE SENDS for a pure base-worn removal: no ANSWERED facet
        (nothing positive is being put there) and the departure in its own
        channel. Sending the departed facet here would take the addition path
        and ask for the landmark of a thing nobody described.
      */
      facets: [],
      departed: ["glasses"],
      reader,
      userId: 1,
      /* The composite's own working, so a failure names a stage instead of
         leaving "it still has glasses" to be argued about. */
      explain: true,
    });
  } catch (error) {
    console.log(`  HARVEST REFUSED — ${(error as Error).message.slice(0, 200)}`);
    continue;
  }

  const file = `${OUT}/c-remove-glasses-${engine}-harvested.png`;
  writeFileSync(file, harvested.bytes);

  /* WHICH STAGE LOST THE GLASSES' FOOTPRINT. Each of these is a mask, and the
     first one that is empty is the one to fix. */
  const explain = (harvested as { explain?: Record<string, { data: Buffer; width: number; height: number }> }).explain;
  if (explain) {
    for (const stage of ["zoneAsScoped", "zone", "harvested", "vacated", "departed", "delivered", "applied"]) {
      const mask = explain[stage];
      if (mask) console.log(`    ${stage.padEnd(13)} ${(coverage(mask) * 100).toFixed(3)}%`);
    }
    /*
      HOW STRONGLY the composite actually took the painter's answer.

      Coverage counts any non-zero alpha, so a footprint fully "claimed" at half
      strength reads identical to one taken outright — and half strength over a
      vacancy is a GHOST: the master's frames blended back through the painter's
      skin. For a removal only full alpha is a removal.
    */
    const applied = explain.applied;
    const zoneMask = explain.zoneAsScoped;
    if (applied && zoneMask) {
      const buckets = [0, 0, 0, 0, 0];
      let inZone = 0;
      for (let pixel = 0; pixel < zoneMask.data.length; pixel += 1) {
        if (zoneMask.data[pixel] === 0) continue;
        inZone += 1;
        const alpha = applied.data[pixel] ?? 0;
        buckets[alpha === 0 ? 0 : alpha < 64 ? 1 : alpha < 160 ? 2 : alpha < 255 ? 3 : 4] += 1;
      }
      const share = (n: number) => `${((n / inZone) * 100).toFixed(1)}%`;
      console.log(`    applied alpha over the frames' own footprint (${inZone} px):`);
      console.log(`      none ${share(buckets[0])}  faint ${share(buckets[1])}`
        + `  part ${share(buckets[2])}  most ${share(buckets[3])}  FULL ${share(buckets[4])}`);

      /*
        AND THE RIMS ALONE. The region is mostly LENS — skin and eyes seen
        through glass — and replacing that changes almost nothing visible. The
        glasses are the dark rims, a quarter of the area, and if the composite
        takes the lens interiors at full strength while leaving the rims to the
        master, every aggregate above reads healthy and the picture still wears
        glasses. Split by the master's own luminance: the rims are the dark part.
      */
      const masterRaster = await readRaster(readFileSync(MASTER));
      let rim = 0;
      let rimFull = 0;
      let rimNone = 0;
      for (let pixel = 0; pixel < zoneMask.data.length; pixel += 1) {
        if (zoneMask.data[pixel] === 0) continue;
        const at = pixel * 3;
        const luma = (masterRaster.data[at] + masterRaster.data[at + 1] + masterRaster.data[at + 2]) / 3;
        if (luma > 90) continue;
        rim += 1;
        const alpha = applied.data[pixel] ?? 0;
        if (alpha === 255) rimFull += 1;
        if (alpha === 0) rimNone += 1;
      }
      console.log(`    of which DARK RIM pixels (${rim} px): `
        + `FULL ${((rimFull / rim) * 100).toFixed(1)}%  none ${((rimNone / rim) * 100).toFixed(1)}%`);

      /*
        AND THE ONLY QUESTION THAT SETTLES IT: at those rim pixels, is the
        delivered picture the PAINTER'S answer or HER MASTER? Every mask above
        is a claim about what was going to happen; this is the bytes.
      */
      const out = await readRaster(harvested.bytes);
      const paintedRaster = await readRaster(painted);
      let toMaster = 0;
      let toPainted = 0;
      for (let pixel = 0; pixel < zoneMask.data.length; pixel += 1) {
        if (zoneMask.data[pixel] === 0) continue;
        const at = pixel * 3;
        const luma = (masterRaster.data[at] + masterRaster.data[at + 1] + masterRaster.data[at + 2]) / 3;
        if (luma > 90) continue;
        const dm = Math.abs(out.data[at] - masterRaster.data[at])
          + Math.abs(out.data[at + 1] - masterRaster.data[at + 1])
          + Math.abs(out.data[at + 2] - masterRaster.data[at + 2]);
        const dp = Math.abs(out.data[at] - paintedRaster.data[at])
          + Math.abs(out.data[at + 1] - paintedRaster.data[at + 1])
          + Math.abs(out.data[at + 2] - paintedRaster.data[at + 2]);
        if (dm < dp) toMaster += 1; else toPainted += 1;
      }
      console.log(`    delivered rim pixels closer to: MASTER ${((toMaster / rim) * 100).toFixed(1)}%`
        + `  PAINTER ${((toPainted / rim) * 100).toFixed(1)}%`);
    }
  }

  const inPainted = await stillPresent(painted, "eyeglasses");
  const inHarvested = await stillPresent(harvested.bytes, "eyeglasses");
  const verdict = inPainted >= BAND
    ? "PAINTER NEVER REMOVED — our sentence failed"
    : inHarvested >= BAND
      ? "COMPOSITOR PUT THEM BACK — our mask failed"
      : "REMOVED — painter and production composite both clean";
  console.log(
    `  eyeglasses: painted ${(inPainted * 100).toFixed(3)}%  `
    + `harvested ${(inHarvested * 100).toFixed(3)}%  → ${verdict}`,
  );
  console.log(`  saved ${file}`);
}
