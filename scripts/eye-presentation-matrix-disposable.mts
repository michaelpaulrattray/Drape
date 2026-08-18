/**
 * THE SEPARATION MATRIX — is it the CROP, or is it how we PACK it?
 * (fable-858 §3b, fable-859 §2, fable-860, bounded by fable-861 §4.)
 *
 * # Where this comes from
 *
 * Two courts measured a minted eye crop against the same eye's words and the
 * crop lost 0 of 5. I read that as "pointing fails for eyes" and withdrew it,
 * because both arms rode the same packing and the founder produced the
 * counter-evidence himself: the SAME 35 px crop, handed to Nano Banana Pro
 * outside the app as its own clean image, delivered the grey-blue eye.
 *
 * `read-packed-reference-disposable.mts` then rebuilt what our pipeline
 * actually sends, through the shipped code path, and it was looked at: a
 * 1024×1536 blank grey field with the crop composited at ORIGINAL SIZE — the
 * eye is **0.053% of the reference**. `padToFrame` was built and measured for
 * 484×617 hair crops, where the feature fills the canvas it is pasted into.
 *
 * So the courts convicted the crop and the packing together. This separates
 * them, on ONE cast, ONE ask, ONE crop, with only the PRESENTATION of that crop
 * changing:
 *
 *   padded     the crop composited at original size onto a master-sized canvas
 *              — exactly what shipped. The control, and it is expected to fail.
 *   clean      the crop as its own image, unpadded. The founder's shape.
 *   scaled     the crop enlarged to a legible reference size, as its own image.
 *              The candidate production fix.
 *   cropWords  the clean crop AND the slot's word stack, which the assembler
 *              does not currently emit together — the carrier-rule candidate.
 *
 * # Two registered predictions, scored either way
 *
 *   fable-857  the founder: "i use NBP but gpt image 2 will handle it just
 *              fine" — the ENGINE is not the separator, so the GPT Image 2 ×
 *              clean cell should deliver.
 *   fable-860  the founder: large crops (hair) cause the frame to drift; small
 *              ones will not. So a clean cell must deliver the eye AND leave
 *              the face size alone — passing one without the other is a fail.
 *
 * # What makes this trustworthy
 *
 * 1. **The sent bytes are SAVED** — every reference of every render, as
 *    dispatched, written to disk before the engine is asked. The courts could
 *    only rebuild theirs afterwards; this one captures them.
 * 2. **One render per settle window.** fal debits late — $0.23 arrived four
 *    minutes after a run's last render — so each render gets its own
 *    before/settle/after reading and its own honest price.
 * 3. **Frame drift is measured on every cell** with the face-extent reader,
 *    against the master, so a cell that delivers the eye and blows her head up
 *    cannot pass.
 * 4. **The verdict is his eyes on a 3× panel.** This scores nothing.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/eye-presentation-matrix-disposable.mts
 */
import "dotenv/config";
/*
  IT DECLARES ITS WORLD NOW, BECAUSE IT IS NO LONGER A ONE-SHOT.
  `assertOneWorld`'s exemption is for a bench run by hand in a known world.
  This file is cited by tracked source and has been promoted into the
  repository, so it is a standing instrument wearing a one-shot's name, and the
  exemption stopped fitting it the moment it was committed. Calling the guard
  makes the name residue rather than a hole.

  The exemption itself was keyed on the `-disposable.mts` SPELLING until
  2026-08-19 — which would have handed this file a one-shot's pass forever, and
  deleting the call below would have reddened nothing. `scriptWorldGuard` now
  keys on TRACKING STATUS instead, so the class is closed rather than this one
  instance: see `trackedScripts` there.
*/
import { assertOneWorld } from "./lib/worldGuard.mts";
assertOneWorld([process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL"]);

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

import { readFalBalance } from "./lib/falSpend.mts";

const CANDIDATE = process.env.MATRIX_CAST ?? "d93149f2";
const CROP_ROW = Number(process.env.MATRIX_ROW ?? 47);
const REPEATS = Number(process.env.MATRIX_REPEATS ?? 1);
/** Long edge a "scaled" reference is brought to. Big enough to read as a
 *  picture of an eye rather than a speck; small enough to stay a crop. */
const SCALE_TO = Number(process.env.MATRIX_SCALE_TO ?? 512);
const SETTLE_MS = Number(process.env.MATRIX_SETTLE_MS ?? 240_000);
const BUDGET_USD = Number(process.env.MATRIX_BUDGET ?? 3);
const CELLS = (process.env.MATRIX_CELLS ?? "padded,clean,scaled,cropWords").split(",");

const PROD_BUCKET = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev";
/*
  ONE DIRECTORY PER PASS, and it is a repair rather than a flourish: the second
  pass of this bench was launched with the same cell names and the same repeat
  index, and it would have overwritten the first pass's frames — the evidence a
  verdict had already been read off. Caught with seconds to spare by copying
  them aside by hand. `MATRIX_PASS` keeps the two apart by construction.
*/
const PASS = process.env.MATRIX_PASS ?? "";
const OUT = `output/eye-matrix/${CANDIDATE}${PASS ? `/${PASS}` : ""}`;

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL");
process.env.DATABASE_URL = databaseUrl;
const where = new URL(databaseUrl.replace(/^mysql:/, "http:"));
console.log(`WORLD: ${databaseKey} → ${where.hostname}:${where.port} · pixels from ${PROD_BUCKET}`);
if (!process.env.FAL_KEY) throw new Error("no FAL_KEY");

const { getDb } = await import("../server/db/connection.js");
const { sql } = await import("drizzle-orm");
const { assembleRecipe } = await import("../server/castingV2/recipeAssembler.js");
const { repaint } = await import("../server/castingV2/repaintRender.js");
const { padToFrame, studioBackgroundOf } = await import("../server/castingV2/referenceFit.js");
const { createFalMaskedEditEngine } = await import("../server/providers/falImages.js");
const { createFalRegionReader } = await import("../server/castingV2/falRegionReader.js");
const { pronounsForSex } = await import("../server/castingV2/castPronouns.js");
const { readResolvedIdentity } = await import("../server/castingV2/rollService.js");
const sharp = (await import("sharp")).default;

const db = await getDb();
if (!db) throw new Error("no database");
const rowsOf = async (query: any): Promise<any[]> => {
  const found = (await db.execute(query)) as unknown as any[][];
  return (Array.isArray(found[0]) ? found[0] : found) as any[];
};

/* ── the rows and the pixels ────────────────────────────────────────────── */

const candidates = await rowsOf(sql`
  SELECT id, publicId, imageKey, internalPrompt FROM casting_candidates
   WHERE publicId LIKE ${`${CANDIDATE}%`}`);
if (candidates.length !== 1) throw new Error(`expected one candidate, got ${candidates.length}`);
const candidate = candidates[0]!;
const pronouns = pronounsForSex((readResolvedIdentity(
  typeof candidate.internalPrompt === "string" ? JSON.parse(candidate.internalPrompt) : candidate.internalPrompt,
) as any)?.sex);

const libraryRows = await rowsOf(sql`
  SELECT id, variantId, slot, tier, noun, words, storageKey, digest, bboxX, bboxY, bboxW, bboxH,
         frameWidth, frameHeight, refusedContentKey, refusedBboxX, refusedBboxY,
         refusedBboxW, refusedBboxH, refusedFrameWidth, refusedFrameHeight, version
    FROM casting_reference_library
   WHERE candidateId = ${candidate.id} AND retiredAt IS NULL ORDER BY id`);
const newest = new Map<string, any>();
for (const row of libraryRows) {
  const held = newest.get(row.slot);
  if (!held || row.version > held.version) newest.set(row.slot, row);
}
const eyeRow = [...newest.values()].find((row) => row.id === CROP_ROW);
if (!eyeRow?.refusedContentKey) throw new Error(`row ${CROP_ROW} is not the newest of its slot, or holds no crop`);

const cache = new Map<string, Buffer>();
async function bytesOf(key: string): Promise<Buffer> {
  const held = cache.get(key);
  if (held) return held;
  const response = await fetch(`${PROD_BUCKET}/${key}`);
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${key}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  cache.set(key, bytes);
  return bytes;
}
const digestOf = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

const masterBytes = await bytesOf(candidate.imageKey);
const masterMeta = await sharp(masterBytes).metadata();
const frame = { width: masterMeta.width ?? 0, height: masterMeta.height ?? 0 };
const cropBytes = await bytesOf(eyeRow.refusedContentKey);
const cropMeta = await sharp(cropBytes).metadata();
const background = await studioBackgroundOf(masterBytes);

mkdirSync(OUT, { recursive: true });
console.log(`\ncast ${candidate.publicId} · master ${frame.width}×${frame.height}`);
console.log(`crop row ${eyeRow.id} · ${eyeRow.slot} · ${cropMeta.width}×${cropMeta.height}`
  + ` — ${(((cropMeta.width ?? 0) * (cropMeta.height ?? 0)) / (frame.width * frame.height) * 100).toFixed(3)}%`
  + " of a padded reference");

/* ── the recipes ────────────────────────────────────────────────────────── */

const wordsOf = (row: any): string[] => (typeof row.words === "string" ? JSON.parse(row.words) : row.words);
function libraryFor(withCrop: boolean) {
  return [...newest.values()].map((row) => {
    const entry: any = { slot: row.slot, tier: row.tier, noun: row.noun, words: wordsOf(row) };
    if (row.id === eyeRow.id && withCrop) entry.carry = { key: row.refusedContentKey, sha: digestOf(cropBytes) };
    else if (row.storageKey) entry.carry = { key: row.storageKey, sha: row.digest ?? undefined };
    return entry;
  });
}
const ASK = {
  slot: "eye@right",
  noun: "right eye",
  words: "A vivid emerald-green iris with a dark pupil and a bright catchlight",
};
const carried = assembleRecipe({
  master: { key: candidate.imageKey }, pronouns, library: libraryFor(true), asks: [ASK], placeSides: true,
}) as any;
const wordsOnly = assembleRecipe({
  master: { key: candidate.imageKey }, pronouns, library: libraryFor(false), asks: [ASK], placeSides: true,
}) as any;
if (!carried.ok || !wordsOnly.ok) throw new Error("a recipe was refused");

/*
  THE FOURTH CELL'S SENTENCE, taken from the words-only recipe rather than
  authored here — the assembler will not emit a crop and its words together
  today, and that is the rule under test. Lifting its own sentence is the
  closest honest approximation of what a carrier-rule change would emit, and it
  cannot drift from the word stack because it IS the word stack's sentence.
*/
const standingSentence = wordsOnly.standing
  .find((entry: any) => entry.slot === eyeRow.slot)?.sentence;
if (!standingSentence) throw new Error("the words-only recipe says nothing about the eye — no cell 4");
const cropWordsPrompt = carried.prompt.replace(carried.ask, `${standingSentence} ${carried.ask}`);
if (cropWordsPrompt === carried.prompt) throw new Error("the words sentence was not inserted");

writeFileSync(`${OUT}/prompt-padded.txt`, carried.prompt);
writeFileSync(`${OUT}/prompt-cropWords.txt`, cropWordsPrompt);
console.log(`\nrecipes: carried ${carried.references.length} refs · words-only ${wordsOnly.references.length} refs`);
console.log(`cell 4 adds: "${standingSentence}"`);

/* ── the presentations ──────────────────────────────────────────────────── */

type Fitted = { bytes: Buffer; contentType: string; width: number; height: number };
const measured = async (bytes: Buffer): Promise<Fitted> => {
  const meta = await sharp(bytes).metadata();
  return { bytes, contentType: "image/png", width: meta.width ?? 0, height: meta.height ?? 0 };
};
/** Every other carried crop keeps the shipped packing in every cell — only the
 *  EYE's presentation is the variable. */
const geometryOf = (key: string) => {
  for (const row of newest.values()) {
    if (row.storageKey === key && row.bboxW) {
      return { bbox: { x: row.bboxX, y: row.bboxY, width: row.bboxW, height: row.bboxH },
        frame: { width: row.frameWidth, height: row.frameHeight } };
    }
    if (row.refusedContentKey === key && row.refusedBboxW) {
      return { bbox: { x: row.refusedBboxX, y: row.refusedBboxY, width: row.refusedBboxW, height: row.refusedBboxH },
        frame: { width: row.refusedFrameWidth, height: row.refusedFrameHeight } };
    }
  }
  return null;
};

async function presentEye(cell: string): Promise<Fitted> {
  if (cell === "padded") {
    return {
      bytes: await padToFrame({ crop: cropBytes, geometry: geometryOf(eyeRow.refusedContentKey)!, frame, background }),
      contentType: "image/png", ...frame,
    };
  }
  if (cell === "scaled") {
    const long = Math.max(cropMeta.width ?? 1, cropMeta.height ?? 1);
    const factor = SCALE_TO / long;
    return measured(await sharp(cropBytes)
      .resize({
        width: Math.round((cropMeta.width ?? 1) * factor),
        height: Math.round((cropMeta.height ?? 1) * factor),
        /* LANCZOS, not nearest: this is a picture for an engine to read, not a
           magnifier for a human to judge pixels through. */
        kernel: sharp.kernel.lanczos3,
      })
      .png().toBuffer());
  }
  /* clean and cropWords both send the crop exactly as the library holds it. */
  return measured(cropBytes);
}

/* ── the reader, for frame drift ────────────────────────────────────────── */

const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY ?? "" });
async function faceHeight(bytes: Buffer, label: string): Promise<number | null> {
  try {
    const mask = await reader.region({ image: bytes, name: "face" }) as any;
    let top = Infinity;
    let bottom = -Infinity;
    for (let y = 0; y < mask.height; y += 1) {
      const row = y * mask.width;
      for (let x = 0; x < mask.width; x += 1) {
        if (mask.data[row + x]! > 127) { if (y < top) top = y; if (y > bottom) bottom = y; }
      }
    }
    if (bottom < 0) return null;
    return (bottom - top + 1) / mask.height;
  } catch (error) {
    console.log(`  face read failed for ${label}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/* ── the runs ───────────────────────────────────────────────────────────── */

const engine = createFalMaskedEditEngine({ apiKey: process.env.FAL_KEY ?? "" });
console.log(`engine: ${engine.id}\n`);
const opening = await readFalBalance();
console.log(`fal at open: ${opening.ok ? `$${opening.remaining.toFixed(4)}` : `UNREAD — ${opening.why}`}`);
let running = opening.ok ? opening.remaining : null;

const masterFace = await faceHeight(masterBytes, "master");
console.log(`master face height: ${masterFace === null ? "UNREAD" : `${(masterFace * 100).toFixed(2)}%`}\n`);

type Row = { cell: string; n: number; file: string; usd: number | null; drift: number | null; bytes: Buffer };
const results: Row[] = [];
let stopped = "";

for (const cell of CELLS) {
  for (let n = 1; n <= REPEATS && !stopped; n += 1) {
    if (opening.ok && running !== null && opening.remaining - running >= BUDGET_USD) {
      stopped = `budget: $${(opening.remaining - running).toFixed(4)} of $${BUDGET_USD.toFixed(2)}`;
      console.log(`STOPPED — ${stopped}`);
      break;
    }
    const label = `${cell} #${n}`;
    const recipe = cell === "cropWords" ? { ...carried, prompt: cropWordsPrompt } : carried;
    try {
      const painted = await repaint({
        recipe,
        engine,
        load: async (image: any) => ({ bytes: await bytesOf(image.key), contentType: "image/png" }),
        fit: async ({ reference, image, role }: any) => {
          if (role.kind === "master") return measured(reference.bytes);
          if (image.key === eyeRow.refusedContentKey) return presentEye(cell);
          const geometry = geometryOf(image.key);
          if (!geometry) return measured(reference.bytes);
          return { bytes: await padToFrame({ crop: reference.bytes, geometry, frame, background }),
            contentType: "image/png", ...frame };
        },
        /* THE SENT BYTES, SAVED BEFORE THE ENGINE IS ASKED — the thing both
           courts could only rebuild afterwards (fable-858 §3a). */
        onDispatch: async (sent: any) => {
          console.log(`  ${label} dispatch: ${sent.keys.length} refs at ${sent.geometry.join(", ")}`);
        },
        ...frame,
      });
      if (!painted.ok) throw new Error(`${(painted as any).reason}: ${(painted as any).detail}`);
      const bytes = Buffer.from((painted as any).frame.bytes);
      const file = `${OUT}/${cell}-${n}.png`;
      writeFileSync(file, bytes);

      /* THE PRICE, in its own settle window (fable-861 §4). */
      await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
      const now = await readFalBalance();
      const usd = now.ok && running !== null ? running - now.remaining : null;
      if (now.ok) running = now.remaining;

      const height = await faceHeight(bytes, label);
      const drift = height !== null && masterFace !== null ? (height - masterFace) / masterFace : null;
      results.push({ cell, n, file, usd, drift, bytes });
      console.log(`  ${label} → ${file} · ${usd === null ? "price UNREAD" : `$${usd.toFixed(4)}`}`
        + ` · face ${drift === null ? "UNREAD" : `${drift >= 0 ? "+" : ""}${(drift * 100).toFixed(1)}%`}`);
      /*
        A NEGATIVE PRICE IS AN AUTO TOP-UP, NOT A CHEAP RENDER — measured on
        2026-08-17, when $20 landed mid-run and this line read $-19.79. Said
        here so the figure is never averaged into a per-render price.
      */
      if (usd !== null && usd < 0) {
        console.log(`  *** the balance ROSE by $${(-usd).toFixed(2)} — an auto top-up landed inside`
          + " this render's window. Its price is UNKNOWN, and every total below must"
          + " carry the top-up as a term (spent = opening − closing + top-ups). ***");
      }
    } catch (error) {
      console.log(`  FAILED ${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/* The references as they went out, one saved copy per cell — same code path,
   captured rather than rebuilt. */
for (const cell of new Set(CELLS)) {
  const eye = await presentEye(cell);
  writeFileSync(`${OUT}/sent-eye-${cell}.png`, eye.bytes);
  writeFileSync(`${OUT}/sent-eye-${cell}-view.png`,
    await sharp(eye.bytes).resize({ width: 420, fit: "inside" }).png().toBuffer());
  console.log(`sent reference (${cell}): ${eye.width}×${eye.height} → ${OUT}/sent-eye-${cell}-view.png`);
}

const closing = await readFalBalance();
console.log(`\nfal at close: ${closing.ok ? `$${closing.remaining.toFixed(4)}` : `UNREAD — ${closing.why}`}`);
if (opening.ok && closing.ok) {
  console.log(`SPENT: $${(opening.remaining - closing.remaining).toFixed(4)} over ${results.length} render(s)`);
}

/* ── the panel ──────────────────────────────────────────────────────────── */

const box = {
  left: Math.max(0, eyeRow.refusedBboxX - 140),
  top: Math.max(0, eyeRow.refusedBboxY - 34),
  width: Math.min(frame.width, eyeRow.refusedBboxW + 190),
  height: Math.min(frame.height, eyeRow.refusedBboxH + 68),
};
const SCALE = 3;
const strip = async (bytes: Buffer) => sharp(bytes).extract(box)
  .resize({ width: box.width * SCALE, height: box.height * SCALE, kernel: sharp.kernel.nearest })
  .png().toBuffer();

const deliveredRows = await rowsOf(sql`
  SELECT imageKey FROM casting_candidate_variants WHERE id = ${eyeRow.variantId}`);
const target = deliveredRows[0]?.imageKey ? await bytesOf(deliveredRows[0].imageKey) : null;

const tiles = [
  { label: "THE ANCHOR — the master (both eyes brown)", bytes: await strip(masterBytes) },
  ...(target ? [{ label: "THE TARGET — her left eye grey-blue, as delivered", bytes: await strip(target) }] : []),
  ...await Promise.all(results.map(async (row) => ({
    label: `${row.cell.toUpperCase()} #${row.n}`
      + `${row.drift === null ? "" : ` · face ${row.drift >= 0 ? "+" : ""}${(row.drift * 100).toFixed(1)}%`}`,
    bytes: await strip(row.bytes),
  }))),
];
const TILE_W = box.width * SCALE;
const TILE_H = box.height * SCALE;
const LABEL_H = 34;
const composites: any[] = [];
tiles.forEach((tile, index) => {
  const top = 8 + index * (TILE_H + LABEL_H);
  composites.push({ input: Buffer.from(
    `<svg width="${TILE_W}" height="${LABEL_H}"><text x="4" y="24" font-family="Inter, Arial" `
    + `font-size="17" fill="#EBEBEB">${tile.label}</text></svg>`), left: 8, top });
  composites.push({ input: tile.bytes, left: 8, top: top + LABEL_H });
});
writeFileSync(`${OUT}/panel-3x.png`, await sharp({
  create: { width: TILE_W + 16, height: tiles.length * (TILE_H + LABEL_H) + 16, channels: 3, background: { r: 16, g: 16, b: 16 } },
}).composite(composites).png().toBuffer());

console.log(`\npanel: ${OUT}/panel-3x.png`);
console.log("THE VERDICT IS HIS EYES. Grey-blue left eye = the crop carried; brown = it did not.");
console.log("A cell passes only if the eye arrives AND the face size holds (fable-860 §3).");
process.exit(0);
