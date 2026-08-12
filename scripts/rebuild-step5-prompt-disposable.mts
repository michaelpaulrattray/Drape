/**
 * WHAT THE PAINTER WAS TOLD WHEN IT WAS ASKED TO TAKE HER GLASSES OFF —
 * rebuilt, not guessed (shift 62, v#172).
 *
 * The refusal kept no frame (`imageKey` NULL, `failureClass
 * removal_not_delivered`) and the dispatch record stores the references and the
 * slot lists but not the prompt text. The prompt is not lost, though: on this
 * road it is `assembleRecipe`'s own output, a pure function of the library rows
 * and the asks. Both are on the row. So the sentence the engine actually read
 * can be rebuilt exactly, here, with no provider call and no credits.
 *
 * Read-only: SELECTs plus two pure functions. Nothing is written, nothing is
 * painted, nothing is charged.
 *
 * CONTROLLED: the same rebuild is run for STEP 4, which delivered. If the
 * rebuild is wrong it will be wrong about both, and step 4's recipe has an
 * independent witness — the dispatch record's own `edited`/`carried`/`vacated`
 * lists, which are compared against the rebuild for both steps.
 *
 *   npx tsx scripts/rebuild-step5-prompt-disposable.mts
 */
import "dotenv/config";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { repaintAsksFor } from "../server/castingV2/repaintAsks";
import { assembleRecipe } from "../server/castingV2/recipeAssembler";
import {
  deriveLibrary, libraryWithoutEditedCrops, supersededCarrySlots,
  type StoredReference,
} from "../server/castingV2/referenceLibrary";
import { EDIT_PROSE } from "../server/castingV2/refineService";
import { accessoryKindOf } from "../server/castingV2/accessoryKinds";

const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const connection = await openDatabase(process.env[key]!);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};

const CANDIDATE = "cec09129-b263-43ed-ac20-8c7fed24bcdc";
/*
  THE STEP'S OWN EDIT DELTA, STATED — and the dispatch record is what says
  whether the statement is right.

  Neither `deltas` (the branch's whole state) nor `stepDeltas` (its per-step
  history, composed) is the object the service hands to `repaintAsksFor`. That
  object is `editDelta`: the interpreter's output for an ordinary edit, and for
  a base-worn departure a fact the CODE authors — `{absent: {statedAccessories:
  ["glasses"]}}`, written at `refineService.ts:1229` and nowhere else. Both are
  named here and both are checked against the dispatch record below, so a wrong
  guess cannot quietly become "what the painter was told".
*/
const STEPS = [
  {
    id: 171,
    label: "STEP 4 — \"wear her hair down\" (DELIVERED, the control)",
    editDelta: { free: { hairWorn: "hair down" } } as any,
  },
  {
    id: 172,
    label: "STEP 5 — \"remove her glasses\" (REFUSED, the subject)",
    editDelta: { absent: { statedAccessories: ["glasses"] } } as any,
  },
];

const candidate = (await query(
  "SELECT id, imageKey FROM casting_candidates WHERE publicId = ?", [CANDIDATE],
))[0];
if (!candidate) throw new Error("the walked face is not in this world");

for (const step of STEPS) {
  const row = (await query(
    "SELECT id, requestText, deltas, internalPrompt, parentVariantId FROM casting_candidate_variants WHERE id = ?",
    [step.id],
  ))[0];
  const deltas = typeof row.deltas === "string" ? JSON.parse(row.deltas) : row.deltas;
  let stored = row.internalPrompt;
  if (typeof stored === "string") { try { stored = JSON.parse(stored); } catch { stored = null; } }

  /* The library as THIS render found it: every row written before it. */
  const rows = (await query(
    `SELECT id, publicId, candidateId, variantId, role, slot, tier, noun, words,
            storageKey, maskKey, digest, refusedReason, version, retiredAt, createdAt
       FROM casting_reference_library
      WHERE candidateId = ? AND id < (SELECT COALESCE(MIN(id), 999999) FROM casting_reference_library WHERE variantId = ?)
      ORDER BY id`,
    [candidate.id, step.id],
  )).map((entry): StoredReference => ({
    id: entry.id,
    publicId: entry.publicId,
    candidateId: entry.candidateId,
    variantId: entry.variantId,
    role: entry.role,
    slot: entry.slot,
    tier: entry.tier,
    noun: entry.noun,
    words: typeof entry.words === "string" ? JSON.parse(entry.words) : (entry.words ?? []),
    storageKey: entry.storageKey,
    maskKey: entry.maskKey,
    digest: entry.digest,
    geometry: null,
    guard: null,
    refusal: entry.refusedReason ? { reason: entry.refusedReason, kind: "", coverage: null, contentKey: null, maskKey: null, geometry: null } : null,
    version: entry.version,
    retiredAt: entry.retiredAt,
    createdAt: new Date(entry.createdAt),
  }));

  /*
    THE STEP'S OWN EDIT, NOT THE COMPOSED RECIPE — the control caught this.

    The first cut passed `deltas`, which is the branch's whole state, so every
    facet in it read as written BY THIS STEP: the rebuild claimed step 5 edited
    her hair and both earrings, where the dispatch record says it edited exactly
    `glasses` and CARRIED the rest. `stepDeltas` holds each step's own change,
    and its last entry is this step's. The service builds asks from that.
  */
  const editDelta = step.editDelta;
  const accessory = deltas?.free?.statedAccessories;
  const asks = repaintAsksFor({
    delta: editDelta,
    prose: EDIT_PROSE,
    accessoryKind: accessoryKindOf(Array.isArray(accessory) ? accessory.join(", ") : String(accessory ?? "")),
    restore: { state: deltas, slots: supersededCarrySlots(rows) },
  });

  console.log("\n" + "=".repeat(96));
  console.log(step.label);
  console.log("=".repeat(96));
  if (!asks.ok) {
    console.log(`the asks REFUSED: ${asks.reason} — ${asks.detail}`);
    continue;
  }
  console.log(`this step’s own delta: ${JSON.stringify(editDelta)}`);
  console.log(`asks: ${JSON.stringify(asks.asks)}`);
  const recipe = assembleRecipe({
    master: { key: candidate.imageKey },
    pronouns: { subject: "she", object: "her", possessive: "her", plural: false },
    library: libraryWithoutEditedCrops(deriveLibrary(rows), new Set(asks.asks.map((a) => a.slot))),
    asks: asks.asks,
  });
  if (!recipe.ok) {
    console.log(`the recipe REFUSED: ${recipe.reason} — ${recipe.detail}`);
    continue;
  }
  const record = (stored as any)?.repaint;
  console.log(`\nrebuilt   edited ${JSON.stringify(recipe.edited)} · carried ${JSON.stringify(recipe.carried)} · vacated ${JSON.stringify(recipe.vacated)}`);
  console.log(`dispatched edited ${JSON.stringify(record?.edited)} · carried ${JSON.stringify(record?.carried)} · vacated ${JSON.stringify(record?.vacated)}`);
  const agrees = JSON.stringify(record?.edited) === JSON.stringify(recipe.edited)
    && JSON.stringify(record?.carried) === JSON.stringify(recipe.carried)
    && JSON.stringify(record?.vacated) === JSON.stringify(recipe.vacated);
  console.log(`CONTROL   the rebuild ${agrees ? "AGREES with" : "DISAGREES with"} the dispatch record`);
  console.log(`\nTHE PROMPT AS SENT:\n${recipe.prompt}`);
}

await connection.end();
process.exit(0);
