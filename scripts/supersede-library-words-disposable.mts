/**
 * SUPERSEDE THE LIBRARY ROWS WHOSE WORDS DESCRIBE THE WRONG THING (shift 56).
 *
 * Eight production earring rows name her GLASSES in the earring's own word
 * stack; one hair row holds "reddish-copper" and "auburn-brown" at once. The
 * mint that wrote them is fixed (`LIBRARY_SLOT_WORDS_DESIGN.md`), but a fix to
 * the writer does not repair what was already written — those rows are live on
 * seven of the founder's ten selectable versions.
 *
 * So this re-mints them, by running THE REAL FIXED MINT against each row's own
 * stored delivered frame. Reads only: no render, no credit, no new frame. Using
 * the real mint rather than a words-only patch script is deliberate — it is one
 * implementation (working law 4), and the supersession doubles as the first
 * live proof the fix produces correct words on real data.
 *
 * # ORDER IS LOAD-BEARING: oldest variant first
 *
 * Versions are global per (candidate, slot, role) and `liveReferences` takes
 * the highest version along the anchor's ancestry. Re-minting v#170 before
 * v#166 would give the OLDER render's words the HIGHER version, so at the
 * newest anchor the oldest state would win — the library quietly running
 * backwards. Walking the ancestry oldest-first keeps version order and render
 * order the same direction.
 *
 * # What it costs and what it writes
 *
 * Per row: one ground read (the stored frame carries no region map), one guard
 * read, one words read. No credits, no renders, no provider image calls.
 * It WRITES: one new versioned row per superseded slot. Nothing is edited in
 * place and nothing is deleted — the old rows stay as the history they are.
 *
 * IT DECLARES ITS OWN WORLD and prints every row's words BEFORE and AFTER, so
 * the receipt is in the output rather than in a claim about it.
 *
 *   npx tsx scripts/supersede-library-words-disposable.mts            (dev)
 *   npx tsx scripts/supersede-library-words-disposable.mts --commit   (dev, writes)
 *   railway.cmd run --service MySQL -- npx tsx scripts/supersede-library-words-disposable.mts --commit
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


const COMMIT = process.argv.includes("--commit");

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL");
process.env.DATABASE_URL = databaseUrl;

const where = new URL(databaseUrl.replace(/^mysql:/, "http:"));
console.log(`WORLD: ${databaseKey} → ${where.hostname}:${where.port}`);

/*
  THIS READING HAS TWO WORLDS, AND IT MUST DECLARE BOTH.

  The first production run of this script read the production DATABASE through
  the DEV BUCKET — `railway run --service MySQL` injects the database URL and
  nothing else, so dotenv's dev `R2_BUCKET` was still in front. Every one of the
  sixteen rows came back "no frame", which reads exactly like *the frames are
  gone* and was in fact *I looked in the wrong bucket*.

  The two-worlds law generalises: a reading that spans two stores declares both
  or it is worthless. The rows live in the database; the frames live in the
  bucket; a supersession is a statement about the pair.
*/
if (!process.env.R2_BUCKET) throw new Error("no R2_BUCKET — the frames cannot be read at all");
console.log(`WORLD: R2_BUCKET → ${process.env.R2_BUCKET}`);
if (where.hostname.endsWith(".railway.internal")) {
  throw new Error(
    `the database host is ${where.hostname}, which only resolves inside Railway — `
    + "run with the public proxy URL, or this reads nothing at all",
  );
}
console.log(COMMIT ? "MODE: COMMIT — new rows will be written\n" : "MODE: DRY RUN — nothing is written\n");

const { getDb } = await import("../server/db/connection.js");
const { mintReferencesForRender } = await import("../server/castingV2/referenceMint.js");
const { slotSpecFor } = await import("../server/castingV2/referenceSlotCatalogue.js");
const { captionSlot } = await import("../server/castingV2/realizationCaption.js");
const { createFalRegionReader } = await import("../server/castingV2/falRegionReader.js");
const { storageReadBytes } = await import("../server/storage.js");
const { recordReferenceRows } = await import("../server/db/castingV2ReferenceLibrary.js");
const { listReferenceHistory } = await import("../server/db/castingV2ReferenceLibrary.js");
const { keysIntroducedBy, supersedingWordsRow, wordsAreUntrue } = await import(
  "../server/castingV2/referenceWordsSupersession.js",
);
const { withTransaction } = await import("../server/db/connection.js");
const { createStorageCleanupManifestIn } = await import("../server/db/storageCleanup.js");
const { randomUUID } = await import("node:crypto");
const { sql } = await import("drizzle-orm");

const db = await getDb();
if (!db) throw new Error("no database");

/* Every live row, with the variant that minted it and that variant's own
   delivered frame. Ordered by variant id so the ancestry walk is oldest-first
   within each candidate — see the header. */
const rows = (await db.execute(sql`
  SELECT l.id, l.candidateId, l.variantId, l.userId, l.slot, l.role, l.tier, l.noun,
         l.version, l.words,
         l.storageKey, l.maskKey, l.digest,
         l.bboxX, l.bboxY, l.bboxW, l.bboxH, l.frameWidth, l.frameHeight,
         l.guardKind, l.guardCoverage, l.guardSpill, l.guardThreshold,
         l.refusedContentKey, l.refusedMaskKey, l.refusedReason, l.refusedKind,
         l.refusedCoverage, l.refusedBboxX, l.refusedBboxY, l.refusedBboxW,
         l.refusedBboxH, l.refusedFrameWidth, l.refusedFrameHeight,
         v.imageKey, v.parentVariantId
    FROM casting_reference_library l
    JOIN casting_candidate_variants v ON v.id = l.variantId
   WHERE l.retiredAt IS NULL
   ORDER BY l.candidateId, l.variantId, l.id
`)) as unknown as any[][];
const live = (Array.isArray(rows[0]) ? rows[0] : rows) as any[];

console.log(`rows to consider: ${live.length}\n`);

/*
  THE ROWS AS THE PRODUCT READS THEM, not as this script re-parses them.

  The carrier copy is `supersedingWordsRow`, which lives in the product and is
  driven by its own tests; it takes a `StoredReference`, so the rows come from
  the product's own reader rather than from a second mapping of the same columns
  written here. Working law 4: the shape of a library row has one definition.
*/
const stored = new Map<number, any>();
for (const candidateId of new Set(live.map((row) => row.candidateId))) {
  const userId = live.find((row) => row.candidateId === candidateId)!.userId;
  for (const row of await listReferenceHistory({ userId, candidateId })) stored.set(row.id, row);
}

/* THE FRAME IS VERIFIED PRESENT BEFORE ANYTHING RUNS, not assumed. A row whose
   frame has gone is stated and skipped — a silent skip would let the report say
   "superseded" about a row nobody touched. */
const frames = new Map<number, Buffer>();
const missing: string[] = [];
for (const row of live) {
  if (frames.has(row.variantId)) continue;
  if (!row.imageKey) { missing.push(`v#${row.variantId}: no imageKey on the variant`); continue; }
  try {
    const got = await storageReadBytes(row.imageKey);
    frames.set(row.variantId, got.bytes);
  } catch (error) {
    missing.push(`v#${row.variantId}: ${row.imageKey} — ${(error as Error).message}`);
  }
}
if (missing.length > 0) {
  console.log("FRAMES MISSING (these rows cannot be superseded):");
  for (const line of missing) console.log(`  ${line}`);
  console.log("");
}

/* The same credential the live path uses (`defaultRegionReader`). Without it
   there is no reader, and a run with no reader would file words-only rows over
   good ones — a supersession that made the library worse. */
const falKey = process.env.FAL_KEY;
if (!falKey) throw new Error("FAL_KEY is not set; the ground and guard reads cannot be made");
const reader = createFalRegionReader({ apiKey: falKey });
const read = async ({ frame, question, side }: { frame: Buffer; question: string; side?: "left" | "right" }) => {
  if (side === undefined) return reader.region({ image: frame, name: question, absentIsAnswer: true });
  if (!reader.regionSides) return null;
  const sides = await reader.regionSides({ image: frame, name: question, absentIsAnswer: true });
  return sides ? sides[side] : null;
};

let superseded = 0;
let mintDeclined = 0;
let leftAlone = 0;

/** How a row's carrier reads in the receipt — the column the first receipt had
 *  no idea it was missing. */
function carrierOf(row: any): string {
  const kept = stored.get(row.id);
  if (!kept) return "UNKNOWN — the product's reader does not have this row";
  if (kept.storageKey) {
    return `CROP ${kept.geometry?.bbox.width}×${kept.geometry?.bbox.height}`;
  }
  if (kept.refusal?.contentKey) return `refused(${kept.refusal.reason}) + kept pixels`;
  if (kept.refusal) return `refused(${kept.refusal.reason}), no pixels`;
  return "none — words only";
}

/**
 * THE SUPERSEDING ROW COPIES ITS PREDECESSOR'S CARRIER AND CHANGES ONLY WORDS
 * (fable-298 ruling 1).
 *
 * The re-mint CANNOT keep a crop of its own: a supersession has no render, so
 * it passes `applied: null` and no master regions, the completeness guard reads
 * a trivial 100% and correctly declines to earn a number from it (`noSpecimen`),
 * and every row it writes is words-only. Filed at a higher version over a
 * crop-bearing row, that stops the slot carrying — which is what three rows of a
 * live commit did before it was stopped.
 *
 * So the mint is used for what it can honestly produce here — the WORDS, read
 * from the slot's own cut — and the carrier is copied from the row being
 * superseded, byte for byte. Nothing is re-guarded, because nothing about the
 * pixels changed: the crop was judged once, at its own render, with the evidence
 * that render had.
 */
function recordShim(row: any, before: readonly string[]) {
  return (async (input: any) => {
    const minted = input.rows[0];
    const said: readonly string[] = minted?.words ?? [];
    /*
      THE EMPTY-WORDS RULE, decided by the OLD row rather than the new (ruling 2).
      Dirty words are worth removing even with nothing to put in their place —
      the crop keeps every pixel and `describe()` says "the same left earring,
      unchanged". Over a CLEAN sentence an empty stack deletes a true fact for
      nothing, so the row is left exactly where it is.
    */
    const dirty = wordsAreUntrue(row.slot, before);
    if (said.length === 0 && !dirty) {
      console.log("  LEFT ALONE — the read said nothing and the old words are not untrue");
      leftAlone += 1;
      return [];
    }
    if (said.length === 0) {
      console.log(`  AFTER : carrier=${carrierOf(row)}  words=[]   (the old words were untrue)`);
    } else {
      console.log(`  AFTER : carrier=${carrierOf(row)}  words=${JSON.stringify(said)}`);
    }
    superseded += 1;
    /* The carrier copy is the PRODUCT's, driven by its own tests
       (`referenceWordsSupersession.test.ts`), not a second one written here. */
    const existing = stored.get(row.id);
    if (!existing) throw new Error(`row #${row.id} is not in the product's own reading of this candidate`);
    const carried = supersedingWordsRow(existing, said);

    if (!COMMIT) {
      console.log("          (dry run — NOT written)");
      return [{
        id: -1, publicId: "dry", candidateId: row.candidateId,
        slot: row.slot, role: row.role, version: -1,
      }];
    }
    /*
      THE MANIFEST OF WHAT THIS WRITE INTRODUCES, and it is empty.

      `recordReferenceRows` refuses a row carrying objects with no manifest to
      discharge, and it is right to: the reservation before the bytes is what
      makes a crashed mint collect its own litter. This write creates no bytes —
      it points at pixels the superseded row is already holding — so the set of
      keys it introduces is derived (`keysIntroducedBy`) rather than assumed, and
      it comes back empty. Naming the carried keys instead would schedule the
      founder's live-referenced crops for deletion if this crashed between the
      registration and the write: at a supersession the manifest's safety
      property inverts.
    */
    const introduces = keysIntroducedBy(carried, existing);
    const cleanupBatchId = randomUUID();
    await withTransaction((tx: any) => createStorageCleanupManifestIn(tx, {
      id: cleanupBatchId,
      userId: row.userId,
      operationId: randomUUID(),
      kind: "casting_candidate_cleanup",
      storageItems: introduces.map((storageKey) => ({
        storageKey,
        storageBackend: "public_r2" as const,
      })),
    }));
    console.log(`          manifest ${cleanupBatchId.slice(0, 8)} — introduces ${introduces.length} keys`);
    return await recordReferenceRows({
      userId: row.userId,
      variantId: row.variantId,
      candidateId: row.candidateId,
      rows: [carried],
      cleanupBatchId,
    });
  }) as never;
}

/*
  ONLY_ROWS=4,12 — a named few rather than every row (shift 57).

  BY ROW ID, not by position. It was positional until a partial commit landed a
  new row: the ordering is (candidate, variant, id), so the seventeenth row
  sorted THIRD and every index after it named a different row than it had an
  hour earlier. A selector that silently re-aims is worse than no selector, and
  the id is the one handle that cannot move.
*/
const only = new Set((process.env.ONLY_ROWS ?? "").split(",").map((n) => n.trim()).filter(Boolean));

for (const row of live) {
  if (only.size > 0 && !only.has(String(row.id))) continue;
  const frame = frames.get(row.variantId);
  const before = typeof row.words === "string" ? JSON.parse(row.words) : (row.words ?? []);
  const label = `#${row.id} cand=${row.candidateId} v#${row.variantId} ${row.slot} (v${row.version})`;
  if (!frame) { console.log(`SKIP  ${label} — no frame`); continue; }

  const spec = slotSpecFor(row.slot, []);
  if (spec === null) { console.log(`SKIP  ${label} — the catalogue does not know this slot`); continue; }

  console.log(`\n${label}`);
  console.log(`  BEFORE: carrier=${carrierOf(row)}  words=${JSON.stringify(before)}`);

  /*
    ONE PATH FOR BOTH MODES, and the only difference is whether `record` writes.

    The first version of this had two, and the dry one printed the WORDS alone.
    That receipt is what three shifts of rulings were made on, and it could not
    show the thing that made the commit wrong: every re-minted row landed
    words-only, because the guard cannot pass a crop here (see `recordShim`), so
    a crop-bearing row was being superseded by a crop-less one at a higher
    version — the slot stopped carrying. Both modes now print the full row shape.
  */
  const result = await mintReferencesForRender({
    userId: row.userId,
    variantId: row.variantId,
    frame: { bytes: frame },
    applied: null,
    masterRegions: new Map(),
    slots: [spec],
    dependencies: {
      read,
      readGround: read,
      readWords: captionSlot,
      enabledFor: () => true,
      record: recordShim(row, before),
      /* THE CROP THE READER WAS HANDED, written where a human can open it.
         "The reader said it could not see the earring" is a claim; the pixels
         are the fact, and this is the only thing that puts them in front of
         an eye (working law 1). */
      store: (async (input: { key: string; bytes: Buffer }) => {
        if (process.env.DUMP_CUTS && input.key.endsWith(".png") && !input.key.includes("mask")) {
          const { writeFileSync, mkdirSync } = await import("node:fs");
          /* Its own directory per run: `output/shift56` holds the founding
             specimens of the confabulating reader and they are the only
             copies there are. */
          const into = process.env.DUMP_CUTS_DIR ?? "output/shift56";
          mkdirSync(into, { recursive: true });
          writeFileSync(`${into}/${row.slot.replace("@", "-")}-v${row.variantId}.png`, input.bytes);
        }
        return { key: input.key };
      }) as never,
      manifest: (async () => undefined) as never,
    },
  });
  /* The MINT's own outcome, printed because it is the reason a row would be
     words-only, and NOT used as this run's tally — the tally belongs to the
     shim, which is what decides whether a row is written. */
  if (result.outcome !== "stored") mintDeclined += 1;
  console.log(`  mint outcome: ${result.outcome} — ${JSON.stringify(result.slots)}`);
}

console.log(
  `\nsuperseded: ${superseded} · mint declined: ${mintDeclined}`
  + ` · left alone (clean words, nothing read): ${leftAlone}`,
);

/* A script ends by ending the process (`scriptExitDiscipline`). */
process.exit(0);
