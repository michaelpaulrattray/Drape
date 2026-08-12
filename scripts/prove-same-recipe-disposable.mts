/**
 * WAS IT THE SAME RECIPE? — the arithmetic behind "8 of 8 on what the product
 * sent" (fable-320 §3, the carried-facts law).
 *
 * The rebuild already agrees with the dispatch record on `edited`, `carried`
 * and `vacated` for the refused step and the delivered one before it. That is
 * the SHAPE. This is the rest of the sameness, in the only terms that settle
 * it: the reference KEYS in dispatch order, their BYTES by digest, and the
 * ENGINE the request went to. A crop that moved between the walk and tonight
 * would explain the whole discrepancy more cheaply than any schema change.
 *
 * Read-only: SELECTs, storage reads, sha256. No paints, no rows, no credits.
 *
 * CONTROLLED: the same comparison is run against the DELIVERED step (v#171),
 * whose recipe is a different length and a different slot set — so a comparator
 * that says "same" about everything is caught by the arm it must not match.
 *
 *   npx tsx scripts/prove-same-recipe-disposable.mts
 */
import "dotenv/config";
import { createHash } from "node:crypto";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { repaintAsksFor } from "../server/castingV2/repaintAsks";
import { assembleRecipe } from "../server/castingV2/recipeAssembler";
import {
  deriveLibrary, libraryWithoutEditedCrops, supersededCarrySlots,
  type StoredReference,
} from "../server/castingV2/referenceLibrary";
import { EDIT_PROSE } from "../server/castingV2/refineService";
import { createFalMaskedEditEngine } from "../server/providers/falImages";
import { storageReadBytes } from "../server/storage";

const CANDIDATE = "cec09129-b263-43ed-ac20-8c7fed24bcdc";
const STEPS = [
  {
    id: 172,
    label: "STEP 5 — the refused removal, the one the eight paints repeated",
    editDelta: { absent: { statedAccessories: ["glasses"] } } as any,
  },
  {
    id: 171,
    label: "STEP 4 — the delivered hair ask (CONTROL: a different recipe entirely)",
    editDelta: { free: { hairWorn: "hair down" } } as any,
  },
];

const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const connection = await openDatabase(process.env[key]!);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};

const candidate = (await query(
  "SELECT id, imageKey FROM casting_candidates WHERE publicId = ?", [CANDIDATE],
))[0];
const engineId = createFalMaskedEditEngine({ apiKey: process.env.FAL_KEY ?? "" }).id;
const built = new Map<number, any>();
const records = new Map<number, any>();

for (const step of STEPS) {
  const row = (await query(
    "SELECT id, internalPrompt FROM casting_candidate_variants WHERE id = ?", [step.id],
  ))[0];
  let stored = row.internalPrompt;
  if (typeof stored === "string") { try { stored = JSON.parse(stored); } catch { stored = null; } }
  const record = (stored as any)?.repaint;

  const rows = (await query(
    `SELECT id, publicId, candidateId, variantId, role, slot, tier, noun, words,
            storageKey, maskKey, digest, refusedReason, version, retiredAt, createdAt
       FROM casting_reference_library
      WHERE candidateId = ? AND id < (SELECT COALESCE(MIN(id), 999999) FROM casting_reference_library WHERE variantId = ?)
      ORDER BY id`,
    [candidate.id, step.id],
  )).map((entry): StoredReference => ({
    id: entry.id, publicId: entry.publicId, candidateId: entry.candidateId,
    variantId: entry.variantId, role: entry.role, slot: entry.slot, tier: entry.tier,
    noun: entry.noun,
    words: typeof entry.words === "string" ? JSON.parse(entry.words) : (entry.words ?? []),
    storageKey: entry.storageKey, maskKey: entry.maskKey, digest: entry.digest,
    geometry: null, guard: null,
    refusal: entry.refusedReason
      ? { reason: entry.refusedReason, kind: "", coverage: null, contentKey: null, maskKey: null, geometry: null }
      : null,
    version: entry.version, retiredAt: entry.retiredAt, createdAt: new Date(entry.createdAt),
  }));

  const asks = repaintAsksFor({
    delta: step.editDelta,
    prose: EDIT_PROSE,
    restore: { state: step.editDelta, slots: supersededCarrySlots(rows) },
  });
  if (!asks.ok) { console.log(`${step.label}: asks refused ${asks.reason}`); continue; }
  const recipe = assembleRecipe({
    master: { key: candidate.imageKey },
    pronouns: { subject: "she", object: "her", possessive: "her", plural: false },
    library: libraryWithoutEditedCrops(deriveLibrary(rows), new Set(asks.asks.map((a) => a.slot))),
    asks: asks.asks,
  });
  if (!recipe.ok) { console.log(`${step.label}: recipe refused ${recipe.reason}`); continue; }

  console.log("\n" + "=".repeat(96));
  console.log(step.label);
  console.log("=".repeat(96));
  console.log(`engine   record "${record?.engineId ?? "—"}"  ·  tonight "${engineId}"  → ${record?.engineId === engineId ? "SAME" : "DIFFERENT"}`);
  console.log(`count    record ${record?.references?.length ?? "—"}  ·  rebuilt ${recipe.references.length}`);

  let same = record?.engineId === engineId
    && (record?.references?.length ?? -1) === recipe.references.length;
  for (const [at, reference] of recipe.references.entries()) {
    const recorded = record?.references?.[at];
    const bytes = await storageReadBytes(reference.image.key);
    const digest = createHash("sha256").update(bytes.bytes).digest("hex");
    const keyMatches = recorded?.key === reference.image.key;
    /* The record stores what the dispatch measured; short forms compare by
       prefix, the same rule `repaint()` itself applies to a library digest. */
    const digestMatches = Boolean(recorded?.digest)
      && (digest.startsWith(recorded.digest) || recorded.digest.startsWith(digest));
    if (!keyMatches || !digestMatches) same = false;
    console.log(`  ${at + 1}. ${reference.role.kind}${"slot" in reference.role ? `:${reference.role.slot}` : ""}`);
    console.log(`     key    ${keyMatches ? "SAME" : `DIFFERENT — record ${recorded?.key ?? "—"}`}  ${reference.image.key}`);
    console.log(`     bytes  ${digestMatches ? "SAME" : "DIFFERENT"}  now ${digest.slice(0, 16)} · record ${String(recorded?.digest ?? "—").slice(0, 16)}`);
  }
  console.log(`\n  → ${same ? "SAME RECIPE, arithmetic" : "NOT the same recipe"}`);
  built.set(step.id, recipe);
  records.set(step.id, record);
}

/*
  THE CROSS ARM — the control that makes the two comparisons above readings.

  Each one judged a rebuild against ITS OWN record, so a comparator that
  answered "same" for any pair would have passed both. This puts step 5's
  rebuilt recipe against step 4's record, where the answer must be DIFFERENT:
  four references against three, and a vacated slot against none.
*/
const five = built.get(172);
const four = records.get(171);
if (five && four) {
  const differs = five.references.length !== four.references?.length
    || five.references.some((reference: any, at: number) => four.references?.[at]?.key !== reference.image.key);
  console.log("\n" + "=".repeat(96));
  console.log(`CONTROL  step 5's recipe against step 4's record: ${differs ? "DIFFERENT, as it must be" : "SAME — the comparator cannot tell recipes apart"}`);
  console.log(`         ${five.references.length} reference(s) against ${four.references?.length ?? "—"}`);
}

await connection.end();
process.exit(0);
