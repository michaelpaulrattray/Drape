/**
 * THE SENTENCE A PAID REPAINT WOULD ACTUALLY SEND (shift 55).
 *
 * Every test of the new road asserts on structure — how many references, which
 * ordinal, which refusal. Not one of them has LOOKED at the prose a paying
 * render would carry, and this campaign's own history says that gap is where
 * the defects live: the caption that contradicted its own ask inside one clause
 * was invisible to every facet-keyed rule and obvious the moment somebody read
 * the produced string.
 *
 * So this prints it. The library rows are the ones the LIVE library actually
 * minted on the founder's candidate (read-only SELECT, dev database), folded
 * through the real `deriveLibrary`, and the asks come from the real
 * `repaintAsksFor` on the founder's own five. Nothing is constructed by hand
 * except the delta each step files, which is what the interpreter would file.
 *
 * Read-only: SELECT only, no writes, no DDL, no credits, no provider call.
 *
 *   npx tsx scripts/repaint-prompt-preview-disposable.mts
 */
import "dotenv/config";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { deriveLibrary, type StoredReference } from "../server/castingV2/referenceLibrary";
import { assembleRecipe } from "../server/castingV2/recipeAssembler";
import { repaintAsksFor, repaintCannotRemove } from "../server/castingV2/repaintAsks";
import { EDIT_PROSE } from "../server/castingV2/refineService";
import { pronounsForSex } from "../server/castingV2/castPronouns";
import type { RefineDelta } from "../server/castingV2/refineDelta";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL");

const connection = await openDatabase(databaseUrl);

/* Every live library row there is, newest branch first. The fold decides which
   of them count; this reader does not pre-judge. */
const [rows] = await connection.query<any[]>(
  `SELECT id, publicId, candidateId, variantId, role, slot, tier, noun, words,
          storageKey, maskKey, digest,
          bboxX, bboxY, bboxW, bboxH, frameWidth, frameHeight,
          guardKind, guardCoverage, guardSpill, guardThreshold,
          refusedReason, refusedKind, refusedCoverage,
          refusedContentKey, refusedMaskKey,
          version, retiredAt, createdAt
     FROM casting_reference_library
    ORDER BY candidateId, version, id`,
);

console.log(`library rows read: ${rows.length}`);
if (rows.length === 0) {
  console.log("NO ROWS — the preview below would be the degenerate case, which is honest but not the reading asked for.");
}

const byCandidate = new Map<number, StoredReference[]>();
for (const row of rows) {
  const parse = (value: unknown) => (typeof value === "string" ? JSON.parse(value) : value);
  const stored: StoredReference = {
    id: row.id,
    publicId: row.publicId,
    candidateId: row.candidateId,
    variantId: row.variantId,
    role: row.role,
    slot: row.slot,
    tier: row.tier,
    noun: row.noun,
    words: parse(row.words) ?? [],
    storageKey: row.storageKey,
    maskKey: row.maskKey,
    digest: row.digest,
    geometry: row.bboxX === null ? null : {
      bbox: { x: row.bboxX, y: row.bboxY, width: row.bboxW, height: row.bboxH },
      frame: { width: row.frameWidth, height: row.frameHeight },
    },
    guard: row.guardKind === null ? null : {
      kind: row.guardKind,
      coverage: row.guardCoverage,
      spill: row.guardSpill,
      threshold: row.guardThreshold,
    },
    /* The fold's rule 3 turns on `refusal.reason`, so it has to be built from
       the columns rather than left null — a disputed row counted as a version
       would silently stop the crop that had been riding. */
    refusal: row.refusedReason === null ? null : {
      reason: row.refusedReason,
      kind: row.refusedKind,
      coverage: row.refusedCoverage,
      contentKey: row.refusedContentKey,
      maskKey: row.refusedMaskKey,
      geometry: null,
    },
    version: row.version,
    retiredAt: row.retiredAt,
    createdAt: new Date(row.createdAt),
  };
  const held = byCandidate.get(stored.candidateId) ?? [];
  held.push(stored);
  byCandidate.set(stored.candidateId, held);
}

await connection.end();

/* The candidate with the most rows — the richest library there is, which is the
   one whose prompt has the most to get wrong. */
const richest = Array.from(byCandidate.entries()).sort((a, b) => b[1].length - a[1].length)[0];
const library = richest ? deriveLibrary(richest[1]) : [];

console.log(`\ncandidate ${richest?.[0] ?? "(none)"} — ${richest?.[1].length ?? 0} rows, ${library.length} live slots`);
for (const entry of library) {
  console.log(`  ${entry.slot} [${entry.tier}] "${entry.noun}" carry=${entry.carry ? "yes" : "no"} words=${JSON.stringify(entry.words)}`);
}

/* The founder's five, in fable-135's order, as deltas the interpreter would file. */
const steps: Array<{ name: string; delta: RefineDelta | null; accessoryKind?: string | null }> = [
  { name: "1  gold hoop earrings", delta: { free: { statedAccessories: ["small gold hoop earrings"] } }, accessoryKind: "earring" },
  { name: "2  dangly cross earrings", delta: { free: { statedAccessories: ["dangly cross earrings in gold"] } }, accessoryKind: "earring" },
  { name: "3  copper hair", delta: { hairColour: "copper" }, accessoryKind: null },
  { name: "4  wear her hair down", delta: { free: { hairWorn: "hair down" } }, accessoryKind: null },
  { name: "5  remove her glasses", delta: null, accessoryKind: null },
];

const pronouns = pronounsForSex("female");
const master = { key: "casting-v2/candidates/<the master>.png" };

for (const step of steps) {
  console.log(`\n${"=".repeat(72)}\n${step.name}`);
  const asks = step.delta
    ? repaintAsksFor({ delta: step.delta, prose: EDIT_PROSE, accessoryKind: step.accessoryKind })
    : repaintCannotRemove();
  if (!asks.ok) {
    console.log(`REFUSED at the ask layer: ${asks.reason}`);
    console.log(`  ${asks.detail}`);
    continue;
  }
  console.log(`asks: ${JSON.stringify(asks.asks)}`);
  const recipe = assembleRecipe({ master, pronouns, library, asks: asks.asks });
  if (!recipe.ok) {
    console.log(`REFUSED by the assembler: ${recipe.reason} on ${recipe.slot}`);
    console.log(`  ${recipe.detail}`);
    continue;
  }
  console.log(`references (${recipe.references.length}), in send order:`);
  recipe.references.forEach((reference, index) => {
    console.log(`  [${index + 1}] ${JSON.stringify(reference.role)}  ${reference.image.key}`);
  });
  console.log(`edited: ${JSON.stringify(recipe.edited)}`);
  console.log(`carried: ${JSON.stringify(recipe.carried)}`);
  console.log(`\n--- THE PROMPT AS SENT ---\n${recipe.prompt}\n`);
}

/* A script ends by ending the process (`scriptExitDiscipline`): the mysql2
   pool keeps the event loop alive otherwise. */
process.exit(0);
