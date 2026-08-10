/**
 * THE OTHER VERB — one crop the guard would KEEP, for the founder's pack.
 *
 * The refusals come from the dev world (that is where the library flag has ever
 * been on). The only artifact this program has ever measured and called COMPLETE
 * is the delivered-anchored cut of the founder's own v#163 hair — 94.6%, the one
 * adopted bar in `COMPLETENESS_SPECIMENS` — and it lives in PRODUCTION's segment
 * store. So this pulls it read-only from there.
 *
 * **Declared:** it is a `casting_segments` row rather than a library row. The
 * library has never stored a kept crop, because the flag has never been on for a
 * render of a kind with a specimen. The pixels are the same cut the library
 * would mint (`applied ∩ (region(delivered) ∪ region(master))`) — that is why
 * the bar was measured on it — and the pack says so rather than implying a
 * library row exists.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/pull-kept-exhibit-disposable.mts \
 *     --bucket https://pub-990e39d8… --out output/founder-pack-2026-08-11
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import sharp from "sharp";

import { fetchImageBytes } from "./lib/imageBytes.mjs";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const bucket = (flag("bucket") ?? "").replace(/\/+$/, "");
if (!bucket) throw new Error("--bucket is required — these are production frames");
const outDir = flag("out") ?? "output/founder-pack";
const url = process.env.MYSQL_PUBLIC_URL;
if (!url) throw new Error("run under `railway.cmd run --service MySQL` — this reads production");

const connection = await mysql.createConnection({ uri: url, timezone: "Z" } as mysql.ConnectionOptions);
try {
  await mkdir(outDir, { recursive: true });
  const [rows] = await connection.query<any[]>(`
    SELECT id, facet, region, contentKey, maskKey, bboxX, bboxY, bboxW, bboxH,
           frameWidth, frameHeight, variantId, createdAt
      FROM casting_segments
     WHERE region = 'hair' AND contentKey IS NOT NULL AND maskKey IS NOT NULL
     ORDER BY id DESC
  `);
  console.log(`hair segments in production: ${rows.length}`);
  for (const row of rows) {
    console.log(`  #${row.id} ${row.facet}@${row.region} ${row.bboxW}x${row.bboxH} var ${row.variantId}`);
  }
  /*
    NAMED BY THEIR VERDICTS, never by their position in the list. The first
    version of this took `rows[rows.length - 1]` and pulled the FRINGE — the
    12.5% NEGATIVE specimen — under the name "kept". Each exhibit is identified
    by the variant a human actually looked at
    (`COMPLETENESS_SPECIMENS.hair.source`).
  */
  const kept = rows.find((row) => Number(row.variantId) === 163);
  const turnedAway = rows.find((row) => Number(row.variantId) === 153);
  if (!kept) throw new Error("v#163's hair segment — the 94.6% positive — is not in production any more");

  const crop = await fetchImageBytes(`${bucket}/${kept.contentKey}`);
  const mask = await fetchImageBytes(`${bucket}/${kept.maskKey}`);
  const cropRaw = await sharp(crop.bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const maskRaw = await sharp(mask.bytes).greyscale().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(cropRaw.info.width * cropRaw.info.height * 4);
  let lit = 0;
  for (let pixel = 0; pixel < cropRaw.info.width * cropRaw.info.height; pixel += 1) {
    rgba[pixel * 4] = cropRaw.data[pixel * cropRaw.info.channels]!;
    rgba[pixel * 4 + 1] = cropRaw.data[pixel * cropRaw.info.channels + 1]!;
    rgba[pixel * 4 + 2] = cropRaw.data[pixel * cropRaw.info.channels + 2]!;
    rgba[pixel * 4 + 3] = maskRaw.data[pixel]!;
    if (maskRaw.data[pixel]! > 0) lit += 1;
  }
  await writeFile(path.join(outDir, "03-kept-hair-crop.png"), crop.bytes);
  await sharp(rgba, { raw: { width: cropRaw.info.width, height: cropRaw.info.height, channels: 4 } })
    .png().toFile(path.join(outDir, "03-kept-hair-cutout.png"));

  const fill = (lit / (kept.bboxW * kept.bboxH)) * 100;
  console.log(
    `\nKEPT exhibit (v#163, the 94.6% positive): segment #${kept.id}, `
    + `${kept.bboxW}x${kept.bboxH} at ${kept.bboxX},${kept.bboxY} `
    + `in ${kept.frameWidth}x${kept.frameHeight}; fill ${fill.toFixed(1)}% of its box`,
  );

  /* AND THE FRINGE — the negative the whole guard was built for: the crop that
     claimed to be her hairstyle and held an eighth of it. */
  if (turnedAway) {
    const fringe = await fetchImageBytes(`${bucket}/${turnedAway.contentKey}`);
    await writeFile(path.join(outDir, "04-the-fringe-crop.png"), fringe.bytes);
    console.log(
      `TURNED AWAY exhibit (v#153, the 12.5% negative — his fringe): segment #${turnedAway.id}, `
      + `${turnedAway.bboxW}x${turnedAway.bboxH}`,
    );
  } else {
    console.log("the fringe negative (v#153) is no longer in production — exhibit 04 omitted");
  }
} finally {
  await connection.end();
}
