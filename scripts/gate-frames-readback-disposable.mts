/**
 * THE FRAMES GATE'S READ-BACK — the three artifacts and the counts that go
 * beside them (fable-1243 §2b: *"his eyes judge all three side by side with the
 * face-exclusion pixel counts printed"*).
 *
 *   npx tsx scripts/gate-frames-readback-disposable.mts
 *
 * Separate from the walk on purpose: the walk SPENDS and this does not, so the
 * counts may be re-derived, corrected and re-printed without re-buying a render.
 *
 * # THE OBJECT IS READ FROM THE BUCKET AND PROVEN AGAINST THE ROW
 *
 * `sha256(bytes) === row.digest` before anything is counted. A read-back that
 * measures whatever the URL happens to serve is measuring the URL, not the
 * design the product filed — and this whole gate is a claim about one specific
 * stored object.
 *
 * # WHAT IT ASKS THE READER, AND WHY IT ASKS AT ALL
 *
 * ONE call: `face` on the specimen. The server already asked it during the cut
 * and logged the COUNT (`face: 16217`) — but a count is not geometry, and the
 * arm here is *how many face pixels are LIT inside the crop the product
 * actually produced, in the crop's own coordinates*. That needs the mask. It is
 * the one segmenter call in fable-1243 §2b's ~6 that belongs to the arm rather
 * than to the cut.
 *
 * # THE BOX COMES FROM THE SERVER'S OWN LINE, QUOTED
 *
 * `casting_ink_designs` stores the cut's SIZE and not where in her picture it
 * was taken from, so the origin is read off the cutter's own log line rather
 * than re-derived — re-deriving it would mean re-running the cut, which would
 * be a second cut and therefore a different fact. The line is quoted in full
 * below so a later reader can check the numbers against the run that made them.
 *
 *   [inkReferenceCutter] cut the design out of her picture — the person is not
 *   in the crop
 *   size 399x287 · cutFrom 399x287 · enlargedTo null · at 166,162 ·
 *   ink 10780 · ofWholeMask 10780 · person 464859 · carried surface ·
 *   surfacePixels 85371 · bytes 204398
 *
 * `enlargedTo: null` matters to this script: the stored bytes ARE the cut at
 * its native size, so the crop's coordinates and her picture's differ by the
 * origin alone. If a later run enlarges, this script refuses rather than
 * scaling a mask to fit — the cutter's own house rule.
 */
import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { FACE_REGION } from "../server/castingV2/inkReferenceCrop";
import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const REPO = resolve(import.meta.dirname, "..");
const OUT = resolve(REPO, "output/frames-gate");
const SPECIMEN = "docs/specs/references/build-two-founder-specimens/tattoo-patchwork-man-selective-take.png";
const DESIGN = "be0cfbe7-bb33-4993-8b98-fabc66aa7376";
const VARIANT = "68a364e5-960a-41a7-8afe-0f47103b9702";
/** Where in her picture the cut was taken from — the cutter's own `at`. */
const BOX = { left: 166, top: 162, width: 399, height: 287 };

const lines: string[] = [];
const say = (line: string) => { console.log(line); lines.push(line); };

const apiKey = process.env.FAL_KEY;
if (!apiKey) {
  console.error("REFUSING: FAL_KEY is not set — the arm asks the REAL reader and will not pretend to.");
  process.exit(1);
}
const base = process.env.R2_PUBLIC_URL;
if (!base) throw new Error("R2_PUBLIC_URL is not set");

assertOneWorld(["DATABASE_URL"]);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("no DATABASE_URL");

await mkdir(OUT, { recursive: true });
const db = await openDatabase(databaseUrl);

const fetchKey = async (key: string): Promise<Buffer> => {
  const url = `${base.replace(/\/$/, "")}/${key}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
};

/* ── 1. the stored cut, proven against its own row ───────────────────────── */

const [[design]] = await db.query<any[]>(
  `SELECT id, publicId, placement, storageKey, digest, byteSize, width, height
     FROM casting_ink_designs WHERE publicId = ?`,
  [DESIGN],
) as any;
if (!design) throw new Error(`no design row for ${DESIGN}`);

const cutBytes = await fetchKey(design.storageKey);
const digest = createHash("sha256").update(cutBytes).digest("hex");
say(`design   ${design.publicId}  ${design.placement}  ${design.width}x${design.height}  ${design.byteSize} B`);
say(`         ${design.storageKey}`);
say(`digest   row ${design.digest}`);
say(`         got ${digest}   ${digest === design.digest ? "IDENTICAL — this is the object the row names" : "*** DIFFERENT — refusing to measure it ***"}`);
if (digest !== design.digest) process.exit(1);
if (design.width !== BOX.width || design.height !== BOX.height) {
  say(`REFUSING: the stored cut is ${design.width}x${design.height} but the box is ${BOX.width}x${BOX.height}`);
  say("          — the cut was enlarged, and a mask scaled to fit is the resample this road forbids.");
  process.exit(1);
}
await writeFile(resolve(OUT, "1-cut.png"), cutBytes);
say(`wrote    ${resolve(OUT, "1-cut.png")}`);

/* ── 2. the same bytes with the transparency taken off ───────────────────── */

/*
  THE GATE'S CENTRAL FRAME. `removeAlpha` is exactly what a consumer that
  ignores the fourth channel receives — and one such consumer is on this road,
  since `aura-sr` answered `channels=3, hasAlpha=false` when handed a real cut.
  Before `7b03bdd6` this picture was the customer's photograph with a mask laid
  over it; 41.1% of the sibling cut was fully transparent pixels still holding a
  man's arm.
*/
const flat = await sharp(cutBytes).removeAlpha().png().toBuffer();
await writeFile(resolve(OUT, "2-cut-flattened.png"), flat);
say(`wrote    ${resolve(OUT, "2-cut-flattened.png")}  (${flat.byteLength} B)`);

const { data: cut, info } = await sharp(cutBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
if (info.channels !== 4) throw new Error(`the cut decoded to ${info.channels} channels`);
let lit = 0;
let cleared = 0;
let partial = 0;
let hidden = 0;
for (let at = 0; at < info.width * info.height; at += 1) {
  const alpha = cut[at * 4 + 3]!;
  if (alpha > 127) lit += 1; else cleared += 1;
  if (alpha !== 0 && alpha !== 255) partial += 1;
  /* THE PERSON UNDER THE ALPHA — a fully cleared pixel whose colour is not
     zero is the customer's photograph still in the bytes. */
  if (alpha === 0 && (cut[at * 4] !== 0 || cut[at * 4 + 1] !== 0 || cut[at * 4 + 2] !== 0)) hidden += 1;
}
const total = info.width * info.height;
say("");
say(`cut      ${info.width}x${info.height} = ${total.toLocaleString()} px`);
say(`         lit (alpha>127)      ${lit.toLocaleString()}  ${(lit / total * 100).toFixed(1)}%`);
say(`         cleared              ${cleared.toLocaleString()}  ${(cleared / total * 100).toFixed(1)}%`);
say(`         partial alpha        ${partial.toLocaleString()}   (the mask is binary — expect 0)`);
say(`         PERSON UNDER ALPHA   ${hidden.toLocaleString()}   <- must be 0`);

/* ── 3. the face-exclusion arm, counted in the crop's own coordinates ────── */

const specimen = await readFile(resolve(REPO, SPECIMEN));
const source = await sharp(specimen).metadata();
const reader = createFalRegionReader({ apiKey });
const face = await reader.region({ image: specimen, name: FACE_REGION, absentIsAnswer: true });
say("");
if (face === null) {
  say(`face     the reader did not answer — the arm cannot be counted this run`);
} else if (face.width !== source.width || face.height !== source.height) {
  say(`face     mask is ${face.width}x${face.height} but her picture is ${source.width}x${source.height} — refusing rather than resampling`);
} else {
  let inFrame = 0;
  let inBox = 0;
  let litInCut = 0;
  for (let y = 0; y < face.height; y += 1) {
    for (let x = 0; x < face.width; x += 1) {
      if (!(face.data[y * face.width + x]! > 127)) continue;
      inFrame += 1;
      const cx = x - BOX.left;
      const cy = y - BOX.top;
      if (cx < 0 || cy < 0 || cx >= BOX.width || cy >= BOX.height) continue;
      inBox += 1;
      if (cut[(cy * BOX.width + cx) * 4 + 3]! > 127) litInCut += 1;
    }
  }
  say(`face     in her picture              ${inFrame.toLocaleString()} px   (the server's own cut line read 16,217)`);
  say(`         inside the crop's box       ${inBox.toLocaleString()} px`);
  say(`         LIT IN THE CUT             ${litInCut.toLocaleString()} px   <- the arm; must be 0`);

  /*
    ⚠ AND WHETHER THAT ZERO WAS EVER IN DANGER — one read beyond fable-1243
    §2b's stated ~6, declared rather than slipped in.

    A zero proves the fence held only if the fence was LOAD-BEARING on this
    specimen. Without this, "no face pixels in the crop" is the same printed
    line whether `subtractMask` removed a jaw or removed nothing at all, and a
    control that cannot tell those apart is the negative arm that cannot find a
    YES defect. So the surface is asked for a SECOND time, un-subtracted, and
    the two are differenced: `face ∩ upper chest` is exactly the work the
    exclusion did.

    It is asked of the SAME word the cutter asked (`region: "upper chest"` on
    its own log line), so this is the same question and not a near neighbour.
  */
  const surfaceWord = "upper chest";
  const surface = await reader.region({ image: specimen, name: surfaceWord, absentIsAnswer: true });
  if (surface === null || surface.width !== face.width || surface.height !== face.height) {
    say(`         the un-subtracted surface did not come back in her space — the fence's own work is unmeasured this run`);
  } else {
    let surfacePixels = 0;
    let removed = 0;
    let minX = Number.POSITIVE_INFINITY; let minY = Number.POSITIVE_INFINITY;
    let maxX = -1; let maxY = -1;
    for (let y = 0; y < surface.height; y += 1) {
      for (let x = 0; x < surface.width; x += 1) {
        if (!(surface.data[y * surface.width + x]! > 127)) continue;
        surfacePixels += 1;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (face.data[y * face.width + x]! > 127) removed += 1;
      }
    }
    say("");
    say(`fence    "${surfaceWord}" un-subtracted    ${surfacePixels.toLocaleString()} px`);
    say(`         box it would have cut       ${maxX - minX + 1}x${maxY - minY + 1} at ${minX},${minY}`);
    say(`         box actually cut            ${BOX.width}x${BOX.height} at ${BOX.left},${BOX.top}`);
    say(`         FACE PIXELS IT REMOVED      ${removed.toLocaleString()} px   <- if 0, the fence did no work on this specimen`);
  }
}

/* ── 4. the delivered frame ──────────────────────────────────────────────── */

const [[variant]] = await db.query<any[]>(
  `SELECT id, publicId, status, imageKey, instructions FROM casting_candidate_variants WHERE publicId = ?`,
  [VARIANT],
) as any;
say("");
if (!variant?.imageKey) {
  say(`render   no image on ${VARIANT}`);
} else {
  const frame = await fetchKey(variant.imageKey);
  await writeFile(resolve(OUT, "3-render-carrying-the-cut.png"), frame);
  const meta = await sharp(frame).metadata();
  say(`render   v${variant.id} ${variant.publicId}  ${variant.status}  ${meta.width}x${meta.height}`);
  say(`         "${JSON.stringify(variant.instructions ?? "").slice(0, 200).slice(0, 90)}"`);
  say(`wrote    ${resolve(OUT, "3-render-carrying-the-cut.png")}  (${frame.byteLength} B)`);
}

/* ── 5. her picture, copied in beside them ───────────────────────────────── */

/* The gate is a COMPARISON and the source belongs in the same folder as the
   things made from it — a founder opening four absolute paths should not have
   to go and find the fifth. */
await writeFile(resolve(OUT, "0-source-specimen-S1.png"), specimen);
say(`wrote    ${resolve(OUT, "0-source-specimen-S1.png")}  (the specimen itself, ${source.width}x${source.height})`);

await writeFile(resolve(OUT, "counts.log"), `${lines.join("\n")}\n`);
await db.end();
process.exit(0);
