/**
 * THE DEMONSTRATION PACK — what the library keeps, and what it turns away.
 *
 * Built for the founder's one ceremony sitting (founder-queue item 6): before he
 * sets the flag he was promised a look at the crops themselves, and this
 * assembles them from the ROWS rather than from anybody's console output.
 *
 * It makes one picture the other artifacts cannot: **her whole frame with every
 * refused box on it at once**, so "two earrings, both turned away" is one image
 * rather than two. Per-slot crops, cutouts and ×10 magnifications come beside it.
 *
 * It refuses the same thing the viewer refuses: a frame whose size disagrees with
 * the row's is not drawn on, because a box measured against a different picture
 * would place her jewellery somewhere she never wore it.
 *
 *   npx tsx scripts/build-library-demo-pack.mts --user 1 [--candidate <publicId>]
 *                                               [--out output/founder-pack]
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { openDatabase, utc } from "./lib/dbConnection.mjs";
import { fetchImageBytes } from "./lib/imageBytes.mjs";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const userId = Number(flag("user") ?? 1);
const candidatePublicId = flag("candidate") ?? null;
const bucket = (flag("bucket") ?? process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
if (!bucket) throw new Error("no bucket — pass --bucket or set R2_PUBLIC_URL");
const outDir = flag("out") ?? "output/founder-pack";

type Refusal = {
  slot: string;
  noun: string;
  refusedContentKey: string;
  refusedMaskKey: string;
  refusedReason: string;
  refusedKind: string;
  refusedCoverage: number | null;
  refusedBboxX: number;
  refusedBboxY: number;
  refusedBboxW: number;
  refusedBboxH: number;
  refusedFrameWidth: number;
  refusedFrameHeight: number;
  frameKey: string;
  createdAt: Date;
  version: number;
};

const connection = await openDatabase();
try {
  await mkdir(outDir, { recursive: true });
  const [rows] = await connection.query<any[]>(
    `
    SELECT l.slot, l.noun, l.version, l.createdAt,
           l.refusedContentKey, l.refusedMaskKey, l.refusedReason, l.refusedKind,
           l.refusedCoverage, l.refusedBboxX, l.refusedBboxY, l.refusedBboxW,
           l.refusedBboxH, l.refusedFrameWidth, l.refusedFrameHeight,
           COALESCE(v.imageKey, c.imageKey) AS frameKey
      FROM casting_reference_library l
      JOIN casting_candidates c ON c.id = l.candidateId AND c.userId = l.userId
      LEFT JOIN casting_candidate_variants v ON v.id = l.variantId AND v.userId = l.userId
     WHERE l.userId = ? AND l.refusedContentKey IS NOT NULL
       AND (? IS NULL OR c.publicId = ?)
     ORDER BY l.createdAt DESC, l.id ASC
  `,
    [userId, candidatePublicId, candidatePublicId],
  );
  const refusals = rows as Refusal[];
  if (refusals.length === 0) throw new Error("no kept refusals to build a pack from");

  /*
    THE NEWEST RENDER'S refusals, together — a pack that mixed two renders'
    boxes onto one frame would be a picture of a face that never existed.

    `--frame <key suffix>` PINS it instead, and it exists because "newest" is a
    moving target: re-running this to correct one thing about a delivered pack
    would silently rebuild it around whatever render landed since, and the prose
    beside the pictures would go on quoting the old numbers. A pack somebody has
    read is an artifact with a frame, not a query.
  */
  const pinned = flag("frame");
  const newest = pinned
    ? String(refusals.find((row) => String(row.frameKey).endsWith(pinned))?.frameKey
      ?? (() => { throw new Error(`no refusal on a frame ending "${pinned}"`); })())
    : String(refusals[0]!.frameKey);
  const together = refusals.filter((row) => String(row.frameKey) === newest);
  const frame = await fetchImageBytes(`${bucket}/${newest}`);
  const meta = await sharp(frame.bytes).metadata();

  const layers: sharp.OverlayOptions[] = [];
  const lines: string[] = [];
  for (const [index, row] of together.entries()) {
    if (meta.width !== row.refusedFrameWidth || meta.height !== row.refusedFrameHeight) {
      throw new Error(
        `${row.slot}: the frame is ${meta.width}x${meta.height} and the row says `
        + `${row.refusedFrameWidth}x${row.refusedFrameHeight} — nothing is drawn against a frame it cannot verify`,
      );
    }
    const crop = await fetchImageBytes(`${bucket}/${row.refusedContentKey}`);
    const mask = await fetchImageBytes(`${bucket}/${row.refusedMaskKey}`);
    const cropRaw = await sharp(crop.bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const maskRaw = await sharp(mask.bytes).greyscale().raw().toBuffer({ resolveWithObject: true });
    /* The alpha written byte by byte — `joinChannel` drops it on the way out,
       and a cutout that keeps everything is the rectangle wearing the name of a
       shape (9cc014b6). */
    const rgba = Buffer.alloc(cropRaw.info.width * cropRaw.info.height * 4);
    let lit = 0;
    for (let pixel = 0; pixel < cropRaw.info.width * cropRaw.info.height; pixel += 1) {
      rgba[pixel * 4] = cropRaw.data[pixel * cropRaw.info.channels]!;
      rgba[pixel * 4 + 1] = cropRaw.data[pixel * cropRaw.info.channels + 1]!;
      rgba[pixel * 4 + 2] = cropRaw.data[pixel * cropRaw.info.channels + 2]!;
      rgba[pixel * 4 + 3] = maskRaw.data[pixel]!;
      if (maskRaw.data[pixel]! > 0) lit += 1;
    }
    const cutout = await sharp(rgba, {
      raw: { width: cropRaw.info.width, height: cropRaw.info.height, channels: 4 },
    }).png().toBuffer();

    const stem = path.join(outDir, `${String(index + 1).padStart(2, "0")}-${row.slot.replace(/[^a-z0-9]+/gi, "-")}`);
    await writeFile(`${stem}-crop.png`, crop.bytes);
    await writeFile(`${stem}-cutout.png`, cutout);
    await sharp(cutout)
      .resize({ width: cropRaw.info.width * 10, kernel: "nearest" })
      .png()
      .toFile(`${stem}-cutout-x10.png`);

    layers.push({ input: cutout, left: row.refusedBboxX, top: row.refusedBboxY });
    /* THIN WHITE, never red — founder ruling, 2026-08-11 (fable-230), standing
       and product-wide for any on-image geometry. The palette is monochrome and
       a red box is an alarm the picture is not sounding: these boxes say "here",
       not "wrong". Same rule governs the panel's boxes in `FaceRegions.tsx`. */
    layers.push({
      input: Buffer.from(
        `<svg width="${meta.width}" height="${meta.height}">`
        + `<rect x="${row.refusedBboxX}" y="${row.refusedBboxY}" width="${row.refusedBboxW}"`
        + ` height="${row.refusedBboxH}" fill="none" stroke="#ffffff" stroke-width="1"/></svg>`,
      ),
    });
    const fill = (lit / (row.refusedBboxW * row.refusedBboxH)) * 100;
    lines.push(
      `| ${row.noun} | ${row.refusedKind} | ${row.refusedReason} | `
      + `${row.refusedCoverage === null ? "—" : `${(row.refusedCoverage / 100).toFixed(1)}%`} | `
      + `${fill.toFixed(1)}% | ${row.refusedBboxW}×${row.refusedBboxH} at ${row.refusedBboxX},${row.refusedBboxY} |`,
    );
  }

  await sharp(frame.bytes).modulate({ brightness: 0.35 }).composite(layers).png()
    .toFile(path.join(outDir, "00-her-frame-with-every-box.png"));
  await writeFile(path.join(outDir, "00-delivered.png"), frame.bytes);

  await writeFile(
    path.join(outDir, "REFUSALS.md"),
    `# What the library turned away on this render\n\n`
    + `Frame: \`${newest}\`, filed ${utc(together[0]!.createdAt)}.\n\n`
    + `| thing | kind | why | the guard read | fill of its box | box |\n`
    + `|---|---|---|---|---|---|\n${lines.join("\n")}\n\n`
    + `**the guard read** is coverage: how much of what the reader found this render's\n`
    + `own second look found, the crop actually contains.\n\n`
    + `**fill of its box** is how much of the little rectangle the shape occupies —\n`
    + `a thin ring is a low number by nature, a solid shape is near 100%.\n`,
    "utf8",
  );

  console.log(`pack written to ${outDir}`);
  console.log(`  00-delivered.png                  the render, as delivered`);
  console.log(`  00-her-frame-with-every-box.png   every refused box on one frame`);
  for (const [index, row] of together.entries()) {
    console.log(`  ${String(index + 1).padStart(2, "0")}-${row.slot} — crop, cutout, cutout ×10`);
  }
} finally {
  await connection.end();
}
