/**
 * IS IT THE PAINTER OR THE SENTENCE? — the removal, A/B, on the walk's own face.
 *
 * Shift 62's step 5 refused: two paints, glasses still there, 25 credits back.
 * Rebuilding what the engine was told (`rebuild-step5-prompt-disposable`, whose
 * control agrees with the dispatch record on both the refused step AND the
 * delivered one before it) produced this, verbatim:
 *
 *   "… Change only no glasses — her face uncovered, no frames, no lenses and
 *    no rim shadow on her cheeks or brows."
 *
 * Read it as English. **"Change only no glasses"** is the sentence an image
 * model is asked to obey, beside a reference 1 it has just been told to
 * reproduce exactly — and that face is wearing glasses. The vacate phrase is
 * right about the SITE; the frame it lands in makes the instruction ambiguous
 * at best and self-cancelling at worst.
 *
 * That is a hypothesis about a stochastic reader, so it is measured rather than
 * argued. Two paints, identical in every byte except the removal clause's
 * frame, same references, same size, same engine:
 *
 *   A  as sent — "Change only <vacate phrase>."
 *   B  the phrase given a verb — "Change only this: her glasses are gone …"
 *
 * Off the ledger and off the product path: no refine, no credits, no rows
 * written, nothing charged to anybody. Two provider paints and two PNGs on
 * disk, which is the artifact the refusal did not keep.
 *
 *   npx tsx scripts/ab-removal-sentence-disposable.mts
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
import { storageReadBytes } from "../server/storage";

const OUT = "output/shift62-removal-ab";
const CANDIDATE = "cec09129-b263-43ed-ac20-8c7fed24bcdc";
/** The refused step's own edit delta — authored by the service, not parsed. */
const EDIT_DELTA = { absent: { statedAccessories: ["glasses"] } } as any;

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
  /* §5e: the reask questions and the vacancy phrases are a function of the
     Cast's own pronouns now — a bench supplies one Cast. */
  pronouns: { subject: "she", object: "her", possessive: "her", plural: false },
  delta: EDIT_DELTA,
  prose: EDIT_PROSE,
  restore: { state: EDIT_DELTA, slots: supersededCarrySlots(rows) },
});
if (!asks.ok) throw new Error(`the asks refused: ${asks.reason} — ${asks.detail}`);
const recipe = assembleRecipe({
  master: { key: candidate.imageKey },
  pronouns: { subject: "she", object: "her", possessive: "her", plural: false },
  library: libraryWithoutEditedCrops(deriveLibrary(rows), new Set(asks.asks.map((a) => a.slot))),
  asks: asks.asks,
});
if (!recipe.ok) throw new Error(`the recipe refused: ${recipe.reason} — ${recipe.detail}`);

/* THE ONE STRING THAT DIFFERS. Both arms carry the same phrase about the site;
   only the frame around it changes, so a difference in the frames cannot be
   about what was described. */
const AS_SENT = recipe.prompt;
const REPAIRED = recipe.prompt.replace(
  "Change only no glasses —",
  "Change only this: her glasses are GONE, taken off and not in the picture —",
);
if (REPAIRED === AS_SENT) throw new Error("the removal clause is not where this expected it — nothing would be measured");

const master = (await query("SELECT imageKey FROM casting_candidates WHERE id = ?", [candidate.id]))[0].imageKey;
const masterBytes = await storageReadBytes(master);
const sharpModule = (await import("sharp")).default;
const meta = await sharpModule(masterBytes.bytes).metadata();

const ARMS = [
  { id: "A-as-sent", prompt: AS_SENT },
  { id: "B-with-a-verb", prompt: REPAIRED },
];

console.log(`master ${meta.width}x${meta.height} · ${recipe.references.length} reference(s)\n`);
for (const arm of ARMS) {
  console.log("=".repeat(90));
  console.log(`${arm.id}\n${arm.prompt}\n`);
  const painted = await repaint({
    recipe: { ...recipe, prompt: arm.prompt },
    engine: createFalMaskedEditEngine({ apiKey: process.env.FAL_KEY ?? "" }),
    load: async (image) => await storageReadBytes(image.key),
    width: meta.width ?? 1024,
    height: meta.height ?? 1536,
  });
  if (!painted.ok) {
    console.log(`  the paint refused: ${painted.reason} — ${painted.detail}`);
    continue;
  }
  const file = path.join(OUT, `${arm.id}.png`);
  await writeFile(file, painted.frame.bytes);
  console.log(`  → ${file} (${painted.frame.bytes.byteLength} bytes)`);
}

await connection.end();
process.exit(0);
