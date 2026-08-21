/**
 * THE PAID REFUSAL, READ OFF THE ROW — the diff shift 63 said the next paid
 * occurrence would settle.
 *
 * The bench takes her glasses off 24 times out of 24. The paid path has now
 * refused three times in a row ("still in the picture"). Rule of three puts
 * three consecutive failures against that bench at well under 1 in 100, so the
 * honest hypothesis is a DIFFERENCE, and the only place a difference can hide
 * is the sentence that was actually dispatched.
 *
 * So this reads the refused row: its recipe at the wire, its references, its
 * money, and the same recipe the bench sends for the same ask, printed under
 * each other. Read-only, no credits, dev.
 *
 *   npx tsx scripts/read-paid-refusal-disposable.mts
 */
import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";

import { openDatabase, utc } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { repaintAsksFor } from "../server/castingV2/repaintAsks";
import { assembleRecipe } from "../server/castingV2/recipeAssembler";
import { deriveLibrary, libraryWithoutEditedCrops, supersededCarrySlots, type StoredReference } from "../server/castingV2/referenceLibrary";
import { EDIT_PROSE } from "../server/castingV2/refineService";

const OUT = "output/shift64-paid-two-step";
const FACE = process.env.FACE ?? "43ac4560-c59c-46ea-95cb-0bcd814062d3";
const SINCE = process.env.SINCE ?? "2026-08-12 19:30:00";

const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const where = new URL((process.env[key] ?? "").replace(/^mysql:/, "http:"));
console.log(`WORLD: ${key} → ${where.hostname}:${where.port}`);
const connection = await openDatabase(process.env[key]!);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};
await mkdir(OUT, { recursive: true });

const candidate = (await query("SELECT id, publicId, imageKey FROM casting_candidates WHERE publicId = ?", [FACE]))[0];

const rows = await query(
  `SELECT v.id, v.publicId, v.status, v.requestText, v.pointsCost, v.failureClass, v.outcome,
          v.operationId, v.internalPrompt, v.imageKey, v.createdAt,
          o.chargedCredits, o.refundedCredits, o.errorCode, o.publicMessage, o.phase
     FROM casting_candidate_variants v
     LEFT JOIN generation_operations o ON o.id = v.operationId
    WHERE v.candidateId = ? AND v.createdAt >= ?
    ORDER BY v.id`,
  [candidate.id, SINCE],
);

console.log(`\n${rows.length} row(s) since ${SINCE}`);
for (const row of rows) {
  const prompt = typeof row.internalPrompt === "string"
    ? (() => { try { return JSON.parse(row.internalPrompt); } catch { return null; } })()
    : row.internalPrompt;
  const record = prompt?.repaint ?? null;
  console.log(`\n#${row.id} ${row.publicId} · "${row.requestText}"`);
  console.log(`  status ${row.status} · failureClass ${row.failureClass ?? "—"} · outcome ${row.outcome ?? "—"} · ${utc(row.createdAt)}`);
  console.log(`  charged ${row.chargedCredits ?? "—"} · refunded ${row.refundedCredits ?? "—"} · errorCode ${row.errorCode ?? "—"} · phase ${row.phase ?? "—"}`);
  console.log(`  message: ${row.publicMessage ?? "—"}`);
  if (!record) {
    console.log(`  NO REPAINT RECORD — this row did not come down the repaint road`);
    console.log(`  internalPrompt keys: ${prompt ? Object.keys(prompt).join(", ") : "(unparseable)"}`);
    if (prompt?.prompt) console.log(`  prompt: "${String(prompt.prompt).replace(/\s+/g, " ")}"`);
    continue;
  }
  console.log(`  engine ${record.engineId} · edited ${JSON.stringify(record.edited)} · vacated ${JSON.stringify(record.vacated)}`);
  console.log(`  carried ${JSON.stringify(record.carried)} · standing ${JSON.stringify(record.standing)}`);
  console.log(`  references (${record.references?.length ?? 0}):`);
  for (const reference of record.references ?? []) {
    console.log(`    ${String(reference.kind ?? "?").padEnd(8)} ${String(reference.slot ?? "—").padEnd(14)} ${reference.key}`);
  }
  console.log(`  PROMPT AT THE WIRE:\n    "${String(record.prompt ?? "(not recorded)").replace(/\s+/g, " ")}"`);
}

/* ── the same ask, assembled the way the bench assembles it ────────────────── */

const libraryRows = (await query(
  `SELECT id, publicId, candidateId, variantId, role, slot, tier, noun, words,
          storageKey, maskKey, digest, refusedReason, version, retiredAt, createdAt
     FROM casting_reference_library WHERE candidateId = ? AND retiredAt IS NULL ORDER BY id`,
  [candidate.id],
)).map((entry): StoredReference => ({
  id: entry.id, publicId: entry.publicId, candidateId: entry.candidateId,
  variantId: entry.variantId, role: entry.role, slot: entry.slot, tier: entry.tier,
  noun: entry.noun,
  words: typeof entry.words === "string" ? JSON.parse(entry.words) : (entry.words ?? []),
  storageKey: entry.storageKey, maskKey: entry.maskKey, digest: entry.digest,
  geometry: null, guard: null,
  refusal: entry.refusedReason ? { reason: entry.refusedReason, kind: "", coverage: null, contentKey: null, maskKey: null, geometry: null } : null,
  version: entry.version, retiredAt: entry.retiredAt, createdAt: new Date(entry.createdAt),
}));
console.log(`\n── the library the bench would read: ${libraryRows.length} live row(s)`);
for (const row of libraryRows) {
  console.log(`  #${row.id} ${String(row.role).padEnd(7)} ${String(row.slot).padEnd(14)} ${row.storageKey ? "crop" : "    "} ${JSON.stringify(row.words).slice(0, 90)}`);
}

const delta = { absent: { statedAccessories: ["glasses"] }, free: { statedAccessories: [] } } as any;
const asks = repaintAsksFor({ pronouns: { subject: "she", object: "her", possessive: "her", plural: false }, delta, prose: EDIT_PROSE, restore: { state: delta, slots: supersededCarrySlots(libraryRows) } });
if (!asks.ok) {
  console.log(`\nthe bench's asks refuse here too: ${asks.reason} — ${asks.detail}`);
} else {
  const recipe = assembleRecipe({
    master: { key: candidate.imageKey },
    pronouns: { subject: "she", object: "her", possessive: "her", plural: false },
    library: libraryWithoutEditedCrops(deriveLibrary(libraryRows), new Set(asks.asks.map((ask) => ask.slot))),
    asks: asks.asks,
  });
  console.log(`\n── THE BENCH'S OWN RECIPE for the same ask, on the same face, right now`);
  if (!recipe.ok) console.log(`  refused: ${recipe.reason}`);
  else {
    console.log(`  references ${recipe.references.length} · vacated ${JSON.stringify(recipe.vacated)} · standing ${JSON.stringify(recipe.standing.map((entry) => entry.sentence))}`);
    console.log(`  PROMPT: "${recipe.prompt.replace(/\s+/g, " ")}"`);
    await writeFile(`${OUT}/bench-recipe.json`, JSON.stringify(recipe, null, 2));
  }
}

await writeFile(`${OUT}/paid-rows.json`, JSON.stringify(rows, null, 2));
await connection.end();
process.exit(0);
