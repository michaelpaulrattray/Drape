/**
 * THE CROSS-CAST MATRIX — one face is one face, and the eye.shape row does not
 * harden on it.
 *
 * NBP with anatomical prose won the capability probe on cand-11: +4.84deg,
 * replicated at +3.99deg, visible in the picture. That is a result on ONE face
 * of one gender and one ethnicity at one baseline, which is exactly the shape of
 * the mistake the founder had just finished correcting — every previous fox-eyes
 * verdict came from faces that all resembled each other.
 *
 * So: the same anatomical prose, two engines, across casts chosen to span
 * baseline tilt, gender and ethnicity. FLUX is absent because it is banned
 * (`BANNED_ENGINES`), 0-for-4.
 *
 * # THE DECIDING CRITERION IS NOT THE NUMBER
 *
 * Founder ruling: this row is judged on **realism for the subject** — same-
 * person-ness, natural lids, no uncanny tightening — by the founder's eye, with
 * the tilt number as support wherever the instrument can read at all. It could
 * not read 8 of 13 renders in the last round, so a matrix scored on tilt alone
 * would be a matrix scored on a coin toss. Every cast therefore gets its own
 * sheet: master, then each engine, cropped to the eyes at native resolution.
 *
 * A SPLIT VERDICT IS A LEGITIMATE ANSWER — engine A for some face classes,
 * engine B for others — and just adds a column to the routing table.
 *
 *   npx tsx scripts/calibration/eye-shape-matrix.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { runFalImageJob } from "../../server/providers/falTransport";
import { FAL_GPT_IMAGE_2_EDIT } from "../../server/providers/falImages";
import { DEFAULT_IDENTITY_EDIT_MODEL } from "../../server/providers/falQueue";
import { ANATOMICAL_UPSWEPT_EDIT } from "../../server/castingV2/eyeShapeRouting";
import { cornersFromEyeMasks, cornersFromMask, readingFrom } from "../../server/castingV2/canthalTilt";

const apiKey = process.env.FAL_KEY!;
const OUT = "output/masked/eye-shape-matrix";
mkdirSync(OUT, { recursive: true });
const RESOLUTION_DEG = 1.1;

/**
 * The casts, chosen from the pool scan by ARITHMETIC and then by demographic.
 *
 * NAMED LIMIT, because it bounds what this matrix can conclude: the production
 * pool available today is two sheets — a kpop sheet of young Asian women and a
 * skincare-founder sheet of white men in their 40s — plus a bespectacled
 * specimen roll. So this spans two genders, two broad ethnicities and -0.8 to
 * +5.7 degrees of baseline, and it does NOT span darker skin, older women, or
 * any face outside those groups. That gap is the pool's, not the design's, and
 * it is the first thing to widen if the row is ever contested.
 */
const CASTS = [
  { key: "m-flat", file: "output/masked/bare-faced/cand-11.png", note: "white man 40s, baseline -0.8" },
  { key: "m-level", file: "output/masked/bare-faced/cand-10.png", note: "white man 40s, baseline -0.3" },
  { key: "m-mid", file: "output/masked/bare-faced/cand-15.png", note: "white man 40s, baseline +2.3" },
  { key: "f-low", file: "output/masked/bare-faced/cand-06.png", note: "asian woman 20s, baseline +2.6" },
  { key: "f-mid", file: "output/masked/bare-faced/cand-01.png", note: "asian woman 20s, baseline +5.7" },
  { key: "f-specs", file: "output/masked/specimens/fresh-01.png", note: "bespectacled specimen, baseline +1.4" },
].filter((cast) => existsSync(cast.file));

const reader = createFalRegionReader({ apiKey });

/**
 * Two rungs, fixed order, applied identically to every image including each
 * master — so the ladder cannot select for a flattering answer. Which rung
 * answered is reported, and a no-read is reported as a NO-READ rather than as a
 * failure to comply.
 */
async function tilt(bytes: Buffer, W: number, H: number) {
  try {
    const [right, left] = await Promise.all([
      reader.region({ image: bytes, name: "right eye" }),
      reader.region({ image: bytes, name: "left eye" }),
    ]);
    const { outers, inners } = cornersFromEyeMasks(right, left);
    return { ...readingFrom(outers, inners, W, H), via: "per-side" };
  } catch { /* next rung */ }
  try {
    const eyes = await reader.region({ image: bytes, name: "eyes" });
    const { outers, inners } = cornersFromMask(eyes);
    return { ...readingFrom(outers, inners, W, H), via: "union-split" };
  } catch {
    return null;
  }
}

const ENGINES = {
  nbp: {
    endpoint: DEFAULT_IDENTITY_EDIT_MODEL,
    body: (prompt: string, uri: string) => ({
      prompt, image_urls: [uri], num_images: 1, resolution: "2K", aspect_ratio: "2:3", output_format: "png",
    }),
  },
  gpt2: {
    endpoint: FAL_GPT_IMAGE_2_EDIT,
    body: (prompt: string, uri: string, W: number, H: number) => ({
      prompt, image_urls: [uri], num_images: 1, quality: "high", output_format: "png",
      image_size: { width: W, height: H },
    }),
  },
} as const;

const rows: any[] = [];

for (const cast of CASTS) {
  const master = readFileSync(cast.file);
  const meta = await sharp(master).metadata();
  const W = meta.width!, H = meta.height!;
  const uri = `data:image/png;base64,${master.toString("base64")}`;
  const baseline = await tilt(master, W, H);
  console.log(`\n### ${cast.key} — ${cast.note}`);
  console.log(`    baseline ${baseline ? `${baseline.meanDeg.toFixed(2)}deg via ${baseline.via}` : "NO READ"}`);

  const produced: { label: string; bytes: Buffer }[] = [];
  for (const [engineName, engine] of Object.entries(ENGINES)) {
    const began = Date.now();
    let bytes: Buffer;
    try {
      const job = await runFalImageJob({
        apiKey,
        endpoint: engine.endpoint,
        body: (engine.body as any)(ANATOMICAL_UPSWEPT_EDIT, uri, W, H),
        timeoutMs: 300_000, pollIntervalMs: 1_500,
      });
      const m = await sharp(job.bytes).metadata();
      bytes = m.width === W && m.height === H
        ? job.bytes
        : await sharp(job.bytes).resize(W, H, { fit: "fill" }).png().toBuffer();
      writeFileSync(`${OUT}/${cast.key}-${engineName}.png`, bytes);
      produced.push({ label: engineName, bytes });
    } catch (error) {
      console.log(`    ${engineName.padEnd(5)} RENDER FAILED ${String(error).slice(0, 70)}`);
      rows.push({ cast: cast.key, engine: engineName, baseline: baseline?.meanDeg ?? null, tilt: null, delta: null });
      continue;
    }
    const reading = await tilt(bytes, W, H);
    const delta = reading && baseline ? reading.meanDeg - baseline.meanDeg : null;
    rows.push({
      cast: cast.key, note: cast.note, engine: engineName,
      baseline: baseline?.meanDeg ?? null, tilt: reading?.meanDeg ?? null, delta,
      via: reading?.via ?? null,
    });
    console.log(
      `    ${engineName.padEnd(5)} ${reading ? `${reading.meanDeg.toFixed(2)}deg` : "NO READ"}  `
      + (delta === null ? "unmeasured"
        : delta > RESOLUTION_DEG ? `RESTRUCTURED +${delta.toFixed(2)}`
          : delta < -RESOLUTION_DEG ? `WRONG WAY ${delta.toFixed(2)}`
            : `no change (${delta >= 0 ? "+" : ""}${delta.toFixed(2)})`)
      + `  ${((Date.now() - began) / 1000).toFixed(0)}s`,
    );
  }

  /* The sheet the founder actually judges: crop DERIVED from where the eyes are
     on this face, never a guessed fraction — a panel that came out showing a
     man's forehead is why that is written down. */
  try {
    const eyes = await reader.region({ image: master, name: "eyes" });
    let minY = H, maxY = -1;
    for (let i = 0; i < eyes.data.length; i += 1) {
      if (eyes.data[i] <= 127) continue;
      const y = Math.floor(i / eyes.width);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const pad = Math.round((maxY - minY) * 1.4);
    const box = {
      left: Math.round(W * 0.12), top: Math.max(0, minY - pad),
      width: Math.round(W * 0.76), height: Math.min(H - Math.max(0, minY - pad), (maxY - minY) + pad * 2),
    };
    const cells = await Promise.all([master, ...produced.map((p) => p.bytes)].map((b) =>
      sharp(b).resize(W, H, { fit: "fill" }).extract(box).png().toBuffer()));
    await sharp({ create: { width: box.width, height: (box.height + 10) * cells.length, channels: 3, background: "#0A0A0A" } })
      .composite(cells.map((input, i) => ({ input, left: 0, top: i * (box.height + 10) })))
      .png().toFile(`${OUT}/SHEET-${cast.key}.png`);
    console.log(`    SHEET-${cast.key}.png — master / ${produced.map((p) => p.label).join(" / ")}`);
  } catch (error) {
    console.log(`    (no sheet: ${String(error).slice(0, 60)})`);
  }
}

writeFileSync(`${OUT}/results.json`, `${JSON.stringify({ prose: ANATOMICAL_UPSWEPT_EDIT, casts: CASTS, rows }, null, 2)}\n`);

console.log("\n=== per engine, across casts ===");
for (const engine of ["nbp", "gpt2"]) {
  const mine = rows.filter((row) => row.engine === engine);
  const measured = mine.filter((row) => row.delta !== null);
  const landed = measured.filter((row) => row.delta > RESOLUTION_DEG);
  console.log(
    `${engine.padEnd(5)} ${landed.length}/${measured.length} restructured where readable `
    + `(${mine.length - measured.length} no-read)  `
    + `deltas ${measured.map((row) => `${row.delta >= 0 ? "+" : ""}${row.delta.toFixed(1)}`).join(", ") || "none"}`,
  );
}
console.log("\nThe number narrows it. REALISM FOR THE SUBJECT decides it, and that is the founder's eye on the sheets.");
