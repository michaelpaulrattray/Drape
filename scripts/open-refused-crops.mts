/**
 * OPEN A REFUSED CROP FROM ITS ROW — the adoption sitting's instrument
 * (migration 0029, fable-214 option (ii)).
 *
 * The library's guard refuses a crop of a kind nobody has ever measured, and
 * that refusal exists **in order to produce the measurement**: a human has to
 * look at the pixels and say whether that is a complete earring. Until 0029 the
 * pixels were thrown away and the only way to see them again was to buy the
 * render again. Now the row carries them, and this is the thing that opens them.
 *
 * For each refusal it writes three pictures and one row of a table:
 *
 *   -crop.png      the rectangle as it was cut
 *   -cutout.png    the same rectangle with its own mask as alpha — the SHAPE,
 *                  which is what decides whether a hoop is metal or a lobe
 *   -on-frame.png  her whole frame, dimmed, with the kept pixels at full
 *                  brightness in their own box — *the hoop ON her*, which is
 *                  what the founder asked to see
 *
 * # What it refuses to do
 *
 * **It never resizes anything to make a picture come out.** If the frame it
 * fetches is not the size the row says the crop was cut from, it says so and
 * skips the placement — a crop drawn at a box measured against a different
 * picture is the wrong-boundary class rendered in colour, and it would be
 * convincing.
 *
 * **It computes no coverage.** The number on the row is the guard's own reading,
 * taken against a full-frame region read that is not stored; re-deriving it here
 * from the mask alone would produce a different number wearing the same name.
 * The fill percentage it does print is labelled as what it is — mask pixels over
 * box area, the ratio that told a crescent from a disc last shift.
 *
 *   npx tsx scripts/open-refused-crops.mts --user 1 [--candidate <publicId>]
 *                                          [--bucket <base url>] [--out <dir>]
 */
import "dotenv/config";
import { config as readDotenv } from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { openDatabase, resolveDatabaseUrl, utc, worldOf } from "./lib/dbConnection.mjs";
import { fetchImageBytes } from "./lib/imageBytes.mjs";
import { boxOutlineSvg } from "./lib/termsPalette.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const userId = Number(flag("user") ?? 1);
if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("--user must be a positive integer");
const candidatePublicId = flag("candidate") ?? null;
const bucketFlag = flag("bucket");
const bucket = (bucketFlag ?? process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
if (!bucket) throw new Error("no bucket — pass --bucket or set R2_PUBLIC_URL");
const outDir = flag("out") ?? "output/refusals";

/*
  THIS INSTRUMENT READS TWO WORLDS AND THEY ARE SET BY DIFFERENT VARIABLES.

  The rows come from a database and the pixels come from a bucket, and nothing
  ties one to the other. `railway run --service MySQL` injects that service's
  variables and no `R2_PUBLIC_URL`, so `.env`'s DEV bucket fills the gap — which
  is how ten production keys were once fetched from the dev bucket, 404'd, and
  came within one `console.log` of being reported as objects that had gone
  missing (shift 65). A 404 here arrives as a claim about the OBJECT when it is
  a claim about the BASE.

  `assertOneWorld` is that control and it already exists, so this declares its
  DEPENDENCIES to it rather than growing a second copy beside it (working law
  4). The declaration is exact in both directions: the database leg is whichever
  variable `resolveDatabaseUrl` will actually read, and the bucket leg is
  declared only when this run is relying on the ambient one — a `--bucket` names
  the base itself, so `R2_PUBLIC_URL` is then not a thing the answer rests on
  and refusing over it would be the false refusal that teaches people to stop
  declaring.
*/
const databaseUrl = resolveDatabaseUrl();
console.log(`WORLD: rows ${worldOf(databaseUrl)}  ·  pixels ${bucket}`);
assertOneWorld([
  process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL",
  ...(bucketFlag === undefined ? ["R2_PUBLIC_URL"] : []),
]);
/*
  AND THE ONE CASE THE SHARED GUARD CANNOT SEE, because it is inert outside a
  Railway run: a `DATABASE_URL=<production> npx tsx …` prefix moves the rows and
  leaves the bucket on `.env`. The complement, not a copy — the file is the same
  fact from a direction the wrapper's absence cannot hide.
*/
const fileEnv = readDotenv().parsed ?? {};
if (bucketFlag === undefined && databaseUrl !== undefined && databaseUrl !== fileEnv.DATABASE_URL) {
  throw new Error(
    "REFUSING: the rows are not coming from the world `.env` names, and the bucket was taken from "
    + "the ambient environment anyway. Name it with --bucket so the two legs are one world.",
  );
}

const connection = await openDatabase(databaseUrl);
let written = 0;
let skipped = 0;
try {
  await mkdir(outDir, { recursive: true });

  /*
    OWNER-SCOPED IN THE STATEMENT THAT READS, like every other path into this
    table. The frame comes from the render that minted the row, or — for a row
    minted from the master — from the candidate itself, which is the same rule
    `variantId IS NULL` means everywhere else in the library.
  */
  const [rows] = await connection.query<any[]>(
    `
    SELECT l.id, l.publicId, l.candidateId, l.variantId, l.slot, l.tier, l.noun,
           l.refusedContentKey, l.refusedMaskKey, l.refusedReason, l.refusedKind,
           l.refusedCoverage, l.refusedBboxX, l.refusedBboxY, l.refusedBboxW,
           l.refusedBboxH, l.refusedFrameWidth, l.refusedFrameHeight,
           l.version, l.createdAt,
           c.publicId AS candidatePublicId,
           COALESCE(v.imageKey, c.imageKey) AS frameKey
      FROM casting_reference_library l
      JOIN casting_candidates c ON c.id = l.candidateId AND c.userId = l.userId
      LEFT JOIN casting_candidate_variants v ON v.id = l.variantId AND v.userId = l.userId
     WHERE l.userId = ?
       AND l.refusedContentKey IS NOT NULL
       AND (? IS NULL OR c.publicId = ?)
     ORDER BY l.createdAt ASC, l.id ASC
  `,
    [userId, candidatePublicId, candidatePublicId],
  );

  if (rows.length === 0) {
    console.log(
      "No kept refusals for this account yet."
      + (candidatePublicId ? ` (candidate ${candidatePublicId})` : "")
      + "\nA refusal keeps its pixels for two reasons only — `noSpecimen` and"
      + "\n`disputedDelivery` — and only on renders made after migration 0029 and the"
      + "\nlibrary flag were both live.",
    );
  }

  /*
    THE REASON COLUMN IS THE SITTING'S FIRST QUESTION, not a footnote.

      noSpecimen        "is this crop a COMPLETE <kind>?" — an answer sets the
                        kind's bar, so a crop nobody calls complete sets nothing.
      disputedDelivery  "did the ask LAND?" — the reader said no; the picture
                        says whether the reader or the painter was wrong. It
                        adjudicates, and it never sets a bar.

    Two different questions about superficially identical rows, so the column is
    wide enough for the longer word rather than truncating it into the shorter.
  */
  console.log(
    `slot                 kind        reason            guard%   box                fill%   frame`,
  );
  for (const [index, row] of rows.entries()) {
    const stem = path.join(
      outDir,
      `${String(index + 1).padStart(2, "0")}-${row.slot.replace(/[^a-z0-9]+/gi, "-")}-v${row.version}`,
    );

    const crop = await fetchImageBytes(`${bucket}/${row.refusedContentKey}`);
    const mask = await fetchImageBytes(`${bucket}/${row.refusedMaskKey}`);
    await writeFile(`${stem}-crop.png`, crop.bytes);

    /* THE SHAPE, not the rectangle. A hoop's rectangle is mostly her ear; its
       cutout is the arc of metal, and the difference between those two readings
       is the whole of last shift's glasses/earring argument. */
    const maskRaw = await sharp(mask.bytes).greyscale().raw().toBuffer({ resolveWithObject: true });
    const cropRaw = await sharp(crop.bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (cropRaw.info.width !== maskRaw.info.width || cropRaw.info.height !== maskRaw.info.height) {
      throw new Error(
        `${row.slot}: the crop is ${cropRaw.info.width}x${cropRaw.info.height} and its mask is `
        + `${maskRaw.info.width}x${maskRaw.info.height} — they are not a pair`,
      );
    }
    /*
      THE ALPHA IS WRITTEN BYTE BY BYTE, and that is not fussiness.

      The obvious `sharp(crop).removeAlpha().joinChannel(mask).png()` silently
      produces a THREE-channel PNG: the joined channel is dropped on the way out,
      so the "cutout" is the rectangle again, wearing the name of a shape. It was
      caught by looking at the artifact — the cutout and the crop were the same
      picture — and not by any assertion, which is why the rehearsal now measures
      the alpha rather than the file's existence.
    */
    const rgba = Buffer.alloc(cropRaw.info.width * cropRaw.info.height * 4);
    for (let pixel = 0; pixel < cropRaw.info.width * cropRaw.info.height; pixel += 1) {
      rgba[pixel * 4] = cropRaw.data[pixel * cropRaw.info.channels]!;
      rgba[pixel * 4 + 1] = cropRaw.data[pixel * cropRaw.info.channels + 1]!;
      rgba[pixel * 4 + 2] = cropRaw.data[pixel * cropRaw.info.channels + 2]!;
      rgba[pixel * 4 + 3] = maskRaw.data[pixel]!;
    }
    const cutout = await sharp(rgba, {
      raw: { width: cropRaw.info.width, height: cropRaw.info.height, channels: 4 },
    }).png().toBuffer();
    await writeFile(`${stem}-cutout.png`, cutout);

    let lit = 0;
    for (const byte of maskRaw.data) if (byte > 0) lit += 1;
    const boxArea = Number(row.refusedBboxW) * Number(row.refusedBboxH);
    const fill = boxArea > 0 ? (lit / boxArea) * 100 : 0;

    /* ------------------------------------------------ the hoop ON her */
    let framed = "—";
    if (!row.frameKey) {
      framed = "no frame key";
    } else {
      const frame = await fetchImageBytes(`${bucket}/${row.frameKey}`);
      const meta = await sharp(frame.bytes).metadata();
      if (meta.width !== row.refusedFrameWidth || meta.height !== row.refusedFrameHeight) {
        /* NOT rescaled to fit. A box measured against a different picture is the
           wrong-boundary class, and drawing it anyway would produce a confident
           picture of the wrong place. */
        framed = `MISMATCH ${meta.width}x${meta.height} vs row ${row.refusedFrameWidth}x${row.refusedFrameHeight}`;
        skipped += 1;
      } else {
        /* THIN WHITE, never red — founder ruling, 2026-08-11 (fable-230),
           standing and product-wide for any on-image geometry. This drew #ff2d55
           at 3px: the same line the pack builder was corrected away from in
           `ebcea900`, still here because that fix went to the instance and not
           to the class. It is a box that says "here", not "wrong". */
        const outline = Buffer.from(boxOutlineSvg(meta.width!, meta.height!, [{
          x: Number(row.refusedBboxX), y: Number(row.refusedBboxY),
          width: Number(row.refusedBboxW), height: Number(row.refusedBboxH),
        }]));
        const onFrame = await sharp(frame.bytes)
          .modulate({ brightness: 0.35 })
          .composite([
            { input: cutout, left: Number(row.refusedBboxX), top: Number(row.refusedBboxY) },
            { input: outline },
          ])
          .png()
          .toBuffer();
        await writeFile(`${stem}-on-frame.png`, onFrame);
        framed = "drawn";
      }
    }

    written += 1;
    console.log(
      `${String(row.slot).padEnd(20)} ${String(row.refusedKind ?? "—").padEnd(11)} `
      + `${String(row.refusedReason).padEnd(17)} `
      + `${row.refusedCoverage === null ? "  —   " : `${(row.refusedCoverage / 100).toFixed(1)}%`.padStart(6)} `
      + `${`${row.refusedBboxX},${row.refusedBboxY} ${row.refusedBboxW}x${row.refusedBboxH}`.padEnd(18)} `
      + `${fill.toFixed(1).padStart(5)}   ${framed}`,
    );
    /* Only the files that were actually written — a line naming a picture that
       does not exist is a claim, and this whole instrument is here so a person
       can open the artifact rather than read a report of it. */
    const parts = ["crop", "cutout", ...(framed === "drawn" ? ["on-frame"] : [])].join(",");
    console.log(`   ${stem}-{${parts}}.png   filed ${utc(row.createdAt)}`);
  }

  console.log(
    `\n${written} refusal(s) opened into ${outDir}`
    + (skipped > 0 ? `; ${skipped} could not be placed on a frame — see MISMATCH above` : ""),
  );
  console.log(
    "guard% is the guard's own reading against a full-frame region read (not re-derived here).\n"
    + "fill% is mask pixels over box area — a thin ring sits near 40%, a filled shape near 100%.",
  );
} finally {
  await connection.end();
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
