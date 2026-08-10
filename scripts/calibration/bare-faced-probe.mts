/**
 * THE BARE-FACED PROBE — is fox eyes an OCCLUSION problem or a CAPABILITY one?
 *
 * D-237 settled what it is not. The engine does not drop the shape clause at
 * ordinary prompt strength: driven with the product's real instruction against a
 * deliberately stronger one, the two arms were indistinguishable, and pushed
 * harder the engine draws EYELINER rather than restructuring the lid. It left
 * exactly one hypothesis alive, and said out loud that it was UNTESTED:
 *
 *   **every specimen in the set is bespectacled, and a frame's upper rim crosses
 *   the outer corner where a canthal tilt reads.**
 *
 * So this holds the instruction still and varies the occlusion. Same prose —
 * `EYE_SHAPE_RENDER["fox eyes"]`, taken from the composer rather than retyped,
 * which is the correction D-237 had to make about its own first run — on a
 * bare-faced face and on a bespectacled one, matched for demographic (both young
 * Asian women from the founder's own production sheets) so the arms differ by
 * the thing under test and not by whose face it is.
 *
 * # n=3 per arm, and that is the whole reason this is not one render
 *
 * D-237's other correction: its first figures were n=1 per arm of a stochastic
 * process, read as a measurement. Three renders per arm will not settle a small
 * effect either, but it will show whether the spread swallows the difference —
 * and a probe that cannot tell those apart should not be believed.
 *
 * # What is measured, and where
 *
 * On the PAINTED frame, not the composite: the question is what the ENGINE can
 * do, and our compositing is a separate matter with its own fixtures. Scoped to
 * the segmenter's own eye region grown outward, because a canthal tilt happens
 * at the outer corner and a tight eye mask stops short of it — D-232, measure
 * where the change is rather than where an instrument says to look.
 *
 * Both the painted frame AND the composite are saved for every render. Two
 * specimens were undiagnosable after the fact for want of the painted one.
 *
 *   npx tsx scripts/calibration/bare-faced-probe.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createFalMaskedEditEngine } from "../../server/providers/falImages";
import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { harvestRefinement } from "../../server/castingV2/maskedRefine";
import { EYE_SHAPE_RENDER } from "../../server/castingV2/realizedAxes";
import { coverage, dilateMask } from "../../server/castingV2/maskGeometry";
import type { Mask } from "../../server/castingV2/maskedComposite";

const OUT = "output/masked/bare-faced-probe";
mkdirSync(OUT, { recursive: true });

const ARMS = [
  { key: "bare", file: "output/masked/probe/18c9c4fb-e6a6-4aaa-b6ba-3e689fba021f.png", note: "kpop sheet, no eyewear" },
  { key: "spectacled", file: "output/masked/probe/7c796a72-25d7-4702-b506-0d38c3d5d8b9.png", note: "miu miu glasses sheet" },
];
const RUNS = Number(process.env.PROBE_RUNS ?? 3);

/* THE PRODUCT'S OWN INSTRUCTION. Taken from the composer's table rather than
   retyped, because retyping it is exactly how D-237's first run compared a bare
   term against engineered prose and drew a conclusion about the wrong thing. */
const INSTRUCTION = "Edit this photograph of this exact person, changing ONLY what is listed below. "
  + `Change the eye shape to fox eyes — ${EYE_SHAPE_RENDER["fox eyes"]}.`;

const engine = createFalMaskedEditEngine({ apiKey: process.env.FAL_KEY! });
const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });

const raw = async (bytes: Buffer, w: number, h: number) =>
  sharp(bytes).resize(w, h, { fit: "fill" }).removeAlpha().raw().toBuffer();

type Row = { arm: string; run: number; meanDelta: number; movedShare: number; frameMoved: number };
const rows: Row[] = [];

for (const arm of ARMS) {
  const masterBytes = readFileSync(arm.file);
  const meta = await sharp(masterBytes).metadata();
  const W = meta.width!, H = meta.height!;
  console.log(`\n### ${arm.key} — ${W}x${H} (${arm.note})`);

  /* Where the eyes are, on HER, grown outward so the outer corner is inside the
     region a canthal tilt would move. */
  const eyes = await reader.region({ image: masterBytes, name: "eyes" });
  const region: Mask = await dilateMask(eyes, 40);
  console.log(`  eye region ${(coverage(eyes) * 100).toFixed(3)}% grown to ${(coverage(region) * 100).toFixed(3)}%`);

  const A = await raw(masterBytes, W, H);

  for (let run = 1; run <= RUNS; run += 1) {
    const began = Date.now();
    const painted = await engine.edit({
      prompt: INSTRUCTION,
      references: [{ bytes: masterBytes, contentType: "image/png" }],
      width: W, height: H,
    });
    writeFileSync(`${OUT}/${arm.key}-${run}-painted.png`, painted.bytes);

    /* The composite too, through the product's own adapter — so the arm is
       scored on what a user would actually receive as well as on what the
       engine drew. */
    let composedBytes: Buffer | null = null;
    try {
      const composed = await harvestRefinement({
        master: { bytes: masterBytes, contentType: "image/png" },
        painted: { bytes: painted.bytes, contentType: painted.contentType },
        facets: ["eye.shape"],
        reader,
        userId: 1,
      });
      composedBytes = composed.bytes;
      writeFileSync(`${OUT}/${arm.key}-${run}-composed.png`, composed.bytes);
    } catch (error) {
      console.log(`     composite refused: ${String(error).slice(0, 100)}`);
    }

    const B = await raw(painted.bytes, W, H);
    let sum = 0, moved = 0, n = 0, frameMoved = 0;
    for (let pixel = 0; pixel < W * H; pixel += 1) {
      const at = pixel * 3;
      const delta = (Math.abs(A[at] - B[at]) + Math.abs(A[at + 1] - B[at + 1]) + Math.abs(A[at + 2] - B[at + 2])) / 3;
      if (delta > 25) frameMoved += 1;
      if (!region.data[pixel]) continue;
      n += 1;
      sum += delta;
      if (delta > 25) moved += 1;
    }
    const row: Row = {
      arm: arm.key,
      run,
      meanDelta: sum / Math.max(n, 1),
      movedShare: (moved / Math.max(n, 1)) * 100,
      frameMoved: (frameMoved / (W * H)) * 100,
    };
    rows.push(row);
    console.log(
      `  run ${run}  eye-region mean ${row.meanDelta.toFixed(1)} levels, `
      + `${row.movedShare.toFixed(1)}% moved >25  (whole frame ${row.frameMoved.toFixed(1)}%)  `
      + `${((Date.now() - began) / 1000).toFixed(0)}s${composedBytes ? "" : "  [no composite]"}`,
    );
  }

  /* THE EYES AT 100%, which is where the answer actually is — a canthal tilt is
     a shape, and no scalar distinguishes a lifted outer corner from a repainted
     iris of the same magnitude. */
  const points = await reader.landmark({ image: masterBytes, name: "eye" }).catch(() => []);
  const cx = points.length > 0 ? points.reduce((t, p) => t + p.x, 0) / points.length : 0.5;
  const cy = points.length > 0 ? points.reduce((t, p) => t + p.y, 0) / points.length : 0.4;
  const box = {
    left: Math.max(0, Math.round(cx * W - W * 0.30)),
    top: Math.max(0, Math.round(cy * H - H * 0.07)),
    width: Math.min(W, Math.round(W * 0.60)),
    height: Math.min(H, Math.round(H * 0.14)),
  };
  const strip = [masterBytes, ...Array.from({ length: RUNS }, (_, i) =>
    readFileSync(`${OUT}/${arm.key}-${i + 1}-painted.png`))];
  const crops = await Promise.all(strip.map((b) =>
    sharp(b).resize(W, H, { fit: "fill" }).extract(box).png().toBuffer()));
  await sharp({
    create: { width: box.width, height: (box.height + 8) * crops.length, channels: 3, background: "#0A0A0A" },
  })
    .composite(crops.map((input, i) => ({ input, left: 0, top: i * (box.height + 8) })))
    .png()
    .toFile(`${OUT}/EYES-${arm.key}.png`);
  console.log(`  EYES-${arm.key}.png — master on top, then ${RUNS} renders, at 100%`);
}

console.log("\n=== summary (eye region, painted frame) ===");
for (const arm of ARMS) {
  const mine = rows.filter((row) => row.arm === arm.key);
  const mean = mine.reduce((t, r) => t + r.meanDelta, 0) / mine.length;
  const share = mine.reduce((t, r) => t + r.movedShare, 0) / mine.length;
  const spread = Math.max(...mine.map((r) => r.meanDelta)) - Math.min(...mine.map((r) => r.meanDelta));
  console.log(
    `${arm.key.padEnd(12)} mean ${mean.toFixed(1)} levels (spread ${spread.toFixed(1)}), `
    + `${share.toFixed(1)}% of eye region moved >25`,
  );
}
writeFileSync(`${OUT}/results.json`, `${JSON.stringify({ instruction: INSTRUCTION, arms: ARMS, rows }, null, 2)}\n`);
console.log(`\nThe numbers narrow it; EYES-bare.png vs EYES-spectacled.png decide it.`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
