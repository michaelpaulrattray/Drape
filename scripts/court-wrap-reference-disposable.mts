/**
 * THE CORE-BET COURT — WRAP-REFERENCE EFFICACY (named fable-964 §3).
 *
 * The founder's own question, in his words: *"what im asking is whether or not
 * the reference will work at all"*. Everything the ink studio has built so far
 * proves the PLATE half — that a design can be re-drawn onto a blank form
 * without a person coming with it. This asks the half the whole concept rests
 * on:
 *
 *   **Does the engine read a three-view sheet as ONE design seen from angles,
 *   when it is handed one as a reference and asked to put it on a woman?**
 *
 * If it does, a wrap is a solved problem and the arm sheet is the right
 * artifact. If it comes back as three tattoos, or one view only, or a blur of
 * all three, the sheet is the wrong shape and the fallbacks named in the design
 * note (single-view plates per placement; per-angle references) are the road.
 *
 * # WHAT IT DRIVES — the product's own path, with ONE gate bypassed
 *
 *   1. `uploadInkDesign` — the REAL door, against the dev database and the dev
 *      bucket, which since 2026-08-18 also MINTS the plate (fable-968 §2). So
 *      the plate this court judges is made by the wiring a customer would use,
 *      on the ruled engine, rather than by a script's own call.
 *   2. `assembleRecipe` — the real assembler. The plate rides as the slot's
 *      `anchor`, which is the role the assembler's own type already names *"a
 *      tattoo's flash sheet"*.
 *   3. `repaint` — the real renderer, on the same masked-edit engine every paid
 *      refine uses, with the plate's digest carried so the bytes are proved at
 *      the wire rather than trusted.
 *
 * **The one gate bypassed, declared (approved fable-969 §3):** the released
 * placement table (`shared/inkReleasedPlacements.ts`) is EMPTY, so the customer
 * road refuses every ink ask. That gate exists to stop a customer paying for a
 * placement nothing has earned — and this court IS the drive that would earn
 * one, so a court behind it could never run. Nothing else is stubbed: the
 * database, the bucket, both engines and both digest checks are real.
 *
 * # WHAT IT SPENDS
 *
 * House money only, and NO customer credits at all: one plate mint (~$0.15) and
 * one repaint (~$0.10–0.20). It does not go through `refineCandidate`, so no
 * operation is claimed and no ledger row is written — which is also why the ~25
 * dev credits fable-964 budgeted are not spent.
 *
 * # HOW IT IS JUDGED
 *
 * By his eye, on frames, at the paths this prints (law 9). It writes the design,
 * the plate and the render side by side, because a bad render has two possible
 * causes and only the frames tell them apart: the engine misreading a good
 * sheet, or a plate that had already lost the design.
 *
 *   npx tsx scripts/court-wrap-reference-disposable.mts --design <path.png>
 *                                                      [--candidate <publicId>]
 */
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { uploadInkDesign } from "../server/castingV2/inkUploadService.js";
import { assembleRecipe, type LibraryEntry } from "../server/castingV2/recipeAssembler.js";
import { repaint, type ReferenceBytes } from "../server/castingV2/repaintRender.js";
import { createFalMaskedEditEngine } from "../server/providers/falImages.js";
import { ProviderQueue } from "../server/providers/providerQueue.js";
import { storageReadBytes } from "../server/storage.js";
import { openDatabase } from "./lib/dbConnection.mts";

const OUT = "output/wrap-court";
mkdirSync(OUT, { recursive: true });

/*
  EVERY RUN WRITES ITS OWN NAMES, and this is a repair rather than a preference.

  The first version wrote `02-plate.png` and `04-render.png` flat, so the second
  run — the one that PROVED the plate prompt fix — silently overwrote the frames
  that showed the defect. The plate survived only because its bytes were in the
  bucket and its row named them; the render before it is simply gone. A court's
  own output is evidence, and evidence a re-run destroys is evidence for exactly
  one sitting.

  The stamp comes from the design row's id rather than a clock, so a re-run on
  the same design is distinguishable and nothing here needs a wall clock.
*/
const stamp = (name: string, id: string) => path.join(OUT, `${id.slice(0, 8)}-${name}`);

function arg(flag: string, fallback?: string): string {
  const at = process.argv.indexOf(flag);
  const value = at >= 0 ? process.argv[at + 1] : undefined;
  if (!value) {
    if (fallback !== undefined) return fallback;
    throw new Error(`${flag} is required`);
  }
  return value;
}

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) throw new Error("FAL_KEY is required — this court drives the real engines");

const designPath = arg("--design");
const candidatePublicId = arg("--candidate", "7cb9c7a4-7954-4106-8b20-61f7ca4de292");
const USER = 1;

/* ---------------------------------------------------------------- the plate */

const designBytes = await readFile(designPath);
console.log(`design      ${designPath} (${designBytes.byteLength} bytes)`);
console.log("uploading through the REAL door — this mints the plate on the ruled engine…");

const uploaded = await uploadInkDesign({
  userId: USER,
  candidatePublicId,
  placement: "upperArm",
  side: "left",
  /* Invented artwork, not a photograph of anybody — the same choice the plate
     court made, for the same reason. */
  provenance: "synthetic",
  intents: ["tattoo"],
  bytes: designBytes,
});
if (!uploaded.ok) throw new Error(`the door refused — ${uploaded.refusal.message}`);
console.log(`design row  ${uploaded.design.publicId}`);
if (!uploaded.plate.minted) throw new Error(`no plate — ${uploaded.plate.note}`);
console.log(
  `plate       ${uploaded.plate.plateId} · ${uploaded.plate.engine} · `
  + `${uploaded.plate.width}x${uploaded.plate.height} · reused=${uploaded.plate.reused}`,
);

/* The row is the fact; the projection is a report about it. The key and the
   digest are read off the table so the reference below is proved rather than
   remembered. */
/* Through the one door every script uses: it says which world it opened and
   parses DATETIMEs as UTC — a private connection reads them ten hours early on
   this bench. */
const connection = await openDatabase();
const [plateRows] = await connection.query(
  `SELECT storageKey, digest, width, height FROM casting_ink_plates WHERE publicId = ?`,
  [uploaded.plate.plateId],
) as unknown as [Array<{ storageKey: string; digest: string; width: number; height: number }>];
const plate = plateRows[0];
if (!plate) throw new Error("the plate row is not there");

const plateBytes = await storageReadBytes(plate.storageKey);
await writeFile(stamp("01-design.png", uploaded.design.publicId), designBytes);
await writeFile(stamp("02-plate.png", uploaded.design.publicId), plateBytes.bytes);

/* --------------------------------------------------------------- the render */

const [candidateRows] = await connection.query(
  `SELECT imageKey FROM casting_candidates WHERE publicId = ? AND userId = ?`,
  [candidatePublicId, USER],
) as unknown as [Array<{ imageKey: string }>];
const masterKey = candidateRows[0]?.imageKey;
if (!masterKey) throw new Error("that candidate has no master frame");

const master = await storageReadBytes(masterKey);
const masterMeta = await sharp(master.bytes).metadata();
await writeFile(stamp("03-master.png", uploaded.design.publicId), master.bytes);
console.log(`master      ${masterKey} · ${masterMeta.width}x${masterMeta.height}`);

/*
  THE SLOT. A court names it by hand because the released table is empty and the
  interpreter's ink lane is not open — the one gate this drive bypasses, declared
  in the header. The SHAPE is the product's own: an item tier, whose anchor is
  the frozen introduction reference and whose crop carries later.
*/
const SLOT = "ink@upperArm/left";
const library: LibraryEntry[] = [{
  slot: SLOT,
  tier: "item",
  anchor: { key: plate.storageKey, sha: plate.digest },
  /* Nothing has ever been said about this slot: the design is being introduced
     by THIS render, so the stack is empty and the ask below carries every word.
     That is the shape a first introduction has, not an omission. */
  words: [],
  noun: "tattoo",
}];

const recipe = assembleRecipe({
  master: { key: masterKey },
  pronouns: { subject: "she", object: "her", possessive: "her", plural: false },
  library,
  asks: [{
    slot: SLOT,
    noun: "tattoo",
    /*
      THE ASK, and every word of it is doing work. It SAYS the reference is one
      design shown from several angles, because that is precisely the thing
      under test: if saying it is what makes it work, the product has learned
      something it can act on, and if it is said and the render STILL comes back
      as three tattoos, the sheet is the wrong artifact.
    */
    words: "the tattoo shown in the reference sheet, which shows one single design "
      + "from three angles, wrapped around her upper left arm",
  }],
});
if (!recipe.ok) throw new Error(`the recipe refused — ${recipe.reason}: ${recipe.detail}`);

console.log(`\nrecipe      ${recipe.references.length} references`);
recipe.references.forEach((reference, at) => {
  console.log(`  ${at + 1}. ${reference.role.kind.padEnd(7)} ${reference.image.key}`);
});
console.log(`\nprompt\n${recipe.prompt}\n`);

const engine = createFalMaskedEditEngine({
  apiKey: FAL_KEY,
  queue: new ProviderQueue({ name: "court-wrap", concurrency: 1, maxQueueDepth: 4 }),
});

const bytesFor = new Map<string, ReferenceBytes>([
  [masterKey, { bytes: master.bytes, contentType: master.contentType }],
  [plate.storageKey, { bytes: plateBytes.bytes, contentType: plateBytes.contentType }],
]);

const started = Date.now();
const painted = await repaint({
  recipe,
  engine,
  width: masterMeta.width ?? 1024,
  height: masterMeta.height ?? 1536,
  load: async (image) => {
    const found = bytesFor.get(image.key);
    if (!found) throw new Error(`no bytes for ${image.key}`);
    return found;
  },
});
if (!painted.ok) throw new Error(`the render refused — ${painted.reason}`);
await writeFile(stamp("04-render.png", uploaded.design.publicId), painted.frame.bytes);
console.log(
  `render      ${Math.round((Date.now() - started) / 1000)}s · `
  + `${painted.frame.width}x${painted.frame.height}`,
);
console.log("\nFRAMES FOR HIS EYE — in this order:");
for (const name of ["01-design.png", "02-plate.png", "03-master.png", "04-render.png"]) {
  console.log(`  ${path.resolve(OUT, name)}`);
}
process.exit(0);
