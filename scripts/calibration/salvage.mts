/**
 * EXPERIMENT (iii) — can a model restore a soft render without repainting it?
 *
 * The pre-registered shape: a strict instruction to restore sharpness and
 * change nothing about the person, the styling or the framing, scored on
 * **sharpening and sameness separately** — because a restorer that repaints is
 * worse than blur, and the two scores are the only way to tell them apart.
 *
 * D-197 made the second score load-bearing rather than a safety check: a
 * Laplacian variance rewards any sharpening filter, so "it got sharper" is
 * worth nothing on its own. And D-199 supplied the instrument — the
 * feature-by-feature identity reader that passes its positive control, rather
 * than the holistic one that called a visibly different woman the same person.
 *
 *   npx tsx scripts/calibration/salvage.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

import { castingIdentityEngine } from "../../server/castingV2/signEngine";
import { interpreterEngine } from "../../server/castingV2/interpreter";

const DIR = "output/quality-unit/specimens";
const OUT = "output/quality-unit";

async function quality(bytes: Buffer): Promise<number> {
  return sharp(bytes)
    .resize(768, null, { fit: "inside" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => {
      let sum = 0;
      let sumSq = 0;
      let n = 0;
      for (let y = 1; y < info.height - 1; y += 1) {
        for (let x = 1; x < info.width - 1; x += 1) {
          const i = y * info.width + x;
          const lap = -4 * data[i] + data[i - 1] + data[i + 1]
            + data[i - info.width] + data[i + info.width];
          sum += lap;
          sumSq += lap * lap;
          n += 1;
        }
      }
      const mean = sum / n;
      return Math.sqrt(sumSq / n - mean * mean);
    });
}

/** D-199's instrument: per feature, never holistic. */
async function sameness(left: Buffer, right: Buffer) {
  const engine = interpreterEngine();
  if (!engine) return { same: null as boolean | null, differs: [] as string[] };
  try {
    const reply = await engine.complete({
      system: [
        "You are shown two photographs — the SAME picture before and after a restoration pass",
        "that was supposed to change nothing except clarity.",
        "",
        "Compare them FEATURE BY FEATURE and report what you see in each, then judge whether",
        "each MATCHES. Judge: jaw width, face length/shape, nose shape, lip fullness, eye",
        "spacing, skin freckling, skin tone, hair shape, hair colour, jewellery, expression.",
        "",
        "Do not be charitable. Anything that reads differently does not match. A restoration",
        "that improves a feature has still changed it.",
        "",
        'Reply with JSON: {"features":[{"name":"...","first":"...","second":"...",',
        '"matches":true|false}], "identical": true|false} and nothing else.',
      ].join("\n"),
      user: "First image: before. Second image: after.",
      images: [
        { bytes: left, contentType: "image/png" },
        { bytes: right, contentType: "image/png" },
      ],
      json: true,
      temperature: 0,
      maxOutputTokens: 900,
    });
    const parsed = JSON.parse(reply.text.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, ""));
    const differs = (parsed?.features ?? [])
      .filter((feature: { matches?: unknown }) => feature?.matches === false)
      .map((feature: { name?: unknown }) => String(feature?.name));
    return { same: parsed?.identical === true, differs };
  } catch (error) {
    return { same: null as boolean | null, differs: [(error as Error).message.slice(0, 60)] };
  }
}

/**
 * The strictest restoration instruction the surface allows: clarity only.
 *
 * One reference on purpose. A second image is what let arm (e) reproduce a
 * photograph instead of repairing one.
 */
const SALVAGE_PROMPT = [
  "This photograph is slightly soft. Restore its clarity and fine detail so it reads as a",
  "sharp photograph taken with a good lens.",
  "",
  "Change NOTHING else. The same person with the same face, the same bone structure, the",
  "same skin and freckles, the same hair in the same colour and style, the same jewellery,",
  "the same expression, the same clothing, the same lighting, the same framing and the same",
  "background. Do not beautify, do not smooth skin, do not restyle anything.",
  "",
  "This is a clarity pass on one photograph, not a new photograph of a similar person.",
].join("\n");

const engine = castingIdentityEngine();
const specimens = [
  { name: "recovered-1", degraded: `${DIR}/recovered-1-degraded.png`, base: `${DIR}/recovered-1-base.png` },
  { name: "recovered-2", degraded: `${DIR}/recovered-2-degraded.png`, base: `${DIR}/recovered-2-base.png` },
  { name: "built-step4", degraded: `${DIR}/built-step4.png`, base: `${DIR}/built-base.png` },
];

const results: unknown[] = [];
for (const specimen of specimens) {
  const degraded = readFileSync(specimen.degraded);
  const base = readFileSync(specimen.base);
  const [baseSharp, degradedSharp] = await Promise.all([quality(base), quality(degraded)]);

  const salvaged = await engine.editWithReferences({
    prompt: SALVAGE_PROMPT,
    references: [{ bytes: degraded, contentType: "image/png" }],
    resolution: "1K",
  });
  writeFileSync(`${OUT}/salvage-${specimen.name}.png`, salvaged.bytes);

  const salvagedSharp = await quality(salvaged.bytes);
  const changed = await sameness(degraded, salvaged.bytes);

  const cell = {
    name: specimen.name,
    sharpnessBefore: degradedSharp / baseSharp,
    sharpnessAfter: salvagedSharp / baseSharp,
    identical: changed.same,
    differsOn: changed.differs,
  };
  results.push(cell);
  console.log(
    `  ${specimen.name}: sharp ${(cell.sharpnessBefore * 100).toFixed(0)}% → `
    + `${(cell.sharpnessAfter * 100).toFixed(0)}%   unchanged: ${cell.identical}`
    + (changed.differs.length ? `   repainted: ${changed.differs.join(", ")}` : ""),
  );

  const tiles = await Promise.all([degraded, salvaged.bytes].map((b) => sharp(b).resize(520).toBuffer()));
  const meta = await sharp(tiles[0]).metadata();
  await sharp({
    create: { width: 520 * 2, height: meta.height ?? 680, channels: 3, background: { r: 11, g: 11, b: 12 } },
  }).composite(tiles.map((input, index) => ({ input, left: 520 * index, top: 0 })))
    .png().toFile(`${OUT}/salvage-${specimen.name}-sheet.png`);
}

writeFileSync(`${OUT}/salvage.json`, JSON.stringify(results, null, 2));
console.log(`\nwritten to ${OUT}`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
