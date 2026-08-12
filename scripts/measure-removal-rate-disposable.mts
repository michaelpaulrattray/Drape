/**
 * HOW OFTEN DOES THE REMOVAL LAND? — the rate, on the walk's own refused ask.
 *
 * Shift 62's step 5 asked for her glasses off, painted twice, got them both
 * times, refused and refunded. The A/B that followed found the prompt was not
 * the problem: the sentence AS SENT took the glasses off cleanly on the first
 * paint, and so did a repaired version of it. So the capability is there and
 * the failure is variance — which is a number, not an opinion, and the product
 * already has a policy that depends on it (one free re-render, then refuse).
 *
 * Two failures in a row is a 1-in-4 event at p=0.5 and a 1-in-100 event at
 * p=0.9. Those two worlds want different work, so the rate is measured before
 * anything is built.
 *
 * Each frame is judged by the PRODUCT's own reader, with the product's own
 * removal fact — `absenceIsTheAsk`, the shape `refineService` pushes for a
 * departure — so the tally is what the product would have decided, not what I
 * think of the picture. Every frame is kept, so a human can disagree.
 *
 * Off the ledger and off the product path: no refine, no credits, no rows.
 *
 *   npx tsx scripts/measure-removal-rate-disposable.mts        # 6 paints
 *   PAINTS=3 npx tsx scripts/measure-removal-rate-disposable.mts
 */
import "dotenv/config";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { repaintAsksFor } from "../server/castingV2/repaintAsks";
import { assembleRecipe } from "../server/castingV2/recipeAssembler";
import {
  deriveLibrary, libraryWithoutEditedCrops, supersededCarrySlots,
  type StoredReference,
} from "../server/castingV2/referenceLibrary";
import { EDIT_PROSE } from "../server/castingV2/refineService";
import { repaint } from "../server/castingV2/repaintRender";
import { createFalMaskedEditEngine } from "../server/providers/falImages";
import { verifyRender } from "../server/castingV2/renderVerification";
import { facetOfSubject } from "../server/castingV2/refineFacets";
import { storageReadBytes } from "../server/storage";

const OUT = "output/shift62-removal-rate";
const PAINTS = Number(process.env.PAINTS ?? 6);
const CANDIDATE = "cec09129-b263-43ed-ac20-8c7fed24bcdc";
const EDIT_DELTA = { absent: { statedAccessories: ["glasses"] } } as any;
/** The product's own removal question, verbatim from the departure path. */
const ASKED = "no glasses — they have been taken off and are not in the picture";

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
const rows = (await query(
  `SELECT id, publicId, candidateId, variantId, role, slot, tier, noun, words,
          storageKey, maskKey, digest, refusedReason, version, retiredAt, createdAt
     FROM casting_reference_library
    WHERE candidateId = ? AND id < (SELECT COALESCE(MIN(id), 999999) FROM casting_reference_library WHERE variantId = 172)
    ORDER BY id`,
  [candidate.id],
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
  delta: EDIT_DELTA,
  prose: EDIT_PROSE,
  restore: { state: EDIT_DELTA, slots: supersededCarrySlots(rows) },
});
if (!asks.ok) throw new Error(`the asks refused: ${asks.reason}`);
const recipe = assembleRecipe({
  master: { key: candidate.imageKey },
  pronouns: { subject: "she", object: "her", possessive: "her", plural: false },
  library: libraryWithoutEditedCrops(deriveLibrary(rows), new Set(asks.asks.map((a) => a.slot))),
  asks: asks.asks,
});
if (!recipe.ok) throw new Error(`the recipe refused: ${recipe.reason}`);

const masterBytes = await storageReadBytes(candidate.imageKey);
const sharpModule = (await import("sharp")).default;
const meta = await sharpModule(masterBytes.bytes).metadata();

/*
  THE READER IS SHOWN A FRAME THAT STILL HAS THE GLASSES, FIRST.

  A tally of "landed" means nothing from a reader that says yes to everything,
  and the master is the specimen whose answer is already known — she is wearing
  them in it. If this comes back as a successful removal, the tally below is
  measuring the reader rather than the painter, and the run says so and stops.
*/
const judge = async (bytes: Buffer): Promise<{ landed: boolean; saw: string }> => {
  const verdict = await verifyRender({
    bytes,
    contentType: "image/png",
    facts: [{ facet: facetOfSubject("statedAccessories"), asked: ASKED, binding: true, absenceIsTheAsk: true }],
  });
  const check = verdict.checks[0];
  return { landed: check?.verified === true, saw: check?.saw ?? "(nothing named)" };
};

const control = await judge(masterBytes.bytes);
console.log(`CONTROL −  the master, glasses plainly ON: ${control.landed ? "READ AS REMOVED — the reader cannot be trusted here" : "read as still wearing them"} — "${control.saw}"`);
if (control.landed) { await connection.end(); process.exit(1); }

let landed = 0;
for (let at = 1; at <= PAINTS; at += 1) {
  const painted = await repaint({
    recipe,
    engine: createFalMaskedEditEngine({ apiKey: process.env.FAL_KEY ?? "" }),
    load: async (image) => await storageReadBytes(image.key),
    width: meta.width ?? 1024,
    height: meta.height ?? 1536,
  });
  if (!painted.ok) {
    console.log(`paint ${at}: REFUSED at the reference door — ${painted.reason}`);
    continue;
  }
  const verdict = await judge(painted.frame.bytes);
  if (verdict.landed) landed += 1;
  const file = path.join(OUT, `${String(at).padStart(2, "0")}-${verdict.landed ? "removed" : "still-there"}.png`);
  await writeFile(file, painted.frame.bytes);
  console.log(`paint ${at}: ${verdict.landed ? "REMOVED " : "still on"} — "${verdict.saw}" → ${file}`);
}

console.log(`\n${landed} of ${PAINTS} paints took her glasses off, on one face, one prompt, one engine.`);
console.log(`Two consecutive failures — what step 5 saw — has probability ${(((PAINTS - landed) / PAINTS) ** 2 * 100).toFixed(1)}% at this rate.`);
await connection.end();
process.exit(0);
