/**
 * #2469 — THE DELETION HALF of the card's done-when: *deleting the cast
 * releases the slot and the clip*.
 *
 * Driven through the real ceremony (`runFinalCastDeletionCeremony`), which is
 * the entrance the product uses, so the collector-and-release split is exercised
 * exactly as it ships rather than by calling the release directly.
 *
 * Read BEFORE and AFTER, at the artifacts and not at the return value:
 *   · the `cast_voices` row                  — gone
 *   · the provider's saved-voice slot        — released, counter unrefunded
 *   · the clip's bytes                       — on the cleanup manifest, then swept
 *
 * ⚠ **It destroys a DEV fixture cast** (`verify-bot@local.test`, model 300) and
 * spends nothing: a release costs no voice operation and refunds none.
 *
 *   npx tsx scripts/_2469-drive-deletion-disposable.mts
 */
process.env.CASTING_VOICE_SCOPE = "users:823";
process.env.CASTING_V2_SCOPE = "all";
process.env.ENABLE_FINAL_MODEL_DELETE = "true";

import { randomUUID } from "node:crypto";

import "dotenv/config";
import { runFinalCastDeletionCeremony } from "../server/casting/finalCastDeletionCeremony";
import { createElevenLabsVoiceEngine } from "../server/providers/elevenlabsVoice";
import { getDb } from "../server/db/connection";
import { assertOneWorld } from "./lib/worldGuard.mts";

assertOneWorld(["DATABASE_URL", "R2_BUCKET"]);

const USER_ID = 823;
const MODEL_ID = 300;

const db = await getDb();
if (!db) throw new Error("no database");
const client = (db as unknown as {
  session: { client: { query: (sql: string) => Promise<[unknown[], unknown]> } };
}).session.client;

const engine = createElevenLabsVoiceEngine();
const say = (line: string) => console.log(line);

const readRow = async () => {
  const [rows] = await client.query(
    `select id, voiceId, clipStorageKey from cast_voices where modelId = ${MODEL_ID} and userId = ${USER_ID}`,
  );
  return (rows as Array<Record<string, unknown>>)[0] ?? null;
};

/* ── BEFORE ───────────────────────────────────────────────────────────────── */
const row = await readRow();
if (!row) {
  console.error("no kept voice on the fixture — run _2469-drive-disposable.mts first");
  process.exit(1);
}
const before = await engine.readAllowance();
say("BEFORE");
say(`  row ${row.id} · voiceId ${row.voiceId} · clip ${row.clipStorageKey}`);
say(`  slots ${before.slotsUsed}/${before.slotsTotal} · operations ${before.operationsUsed}/${before.operationsTotal}`);

/* Is the slot really resident on the provider? Asked, not assumed. */
const residentBefore = await fetch(`https://api.elevenlabs.io/v1/voices/${String(row.voiceId)}`, {
  headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
});
say(`  the provider answers ${residentBefore.status} for that voice id (200 = resident)`);

/* ── THE DELETION, through the real ceremony ───────────────────────────────── */
const result = await runFinalCastDeletionCeremony({
  userId: USER_ID,
  modelId: MODEL_ID,
  clientRequestId: randomUUID(),
});
say(`\nCEREMONY — ${JSON.stringify(result, null, 2).slice(0, 600)}`);

/* ── AFTER, read at the artifacts ──────────────────────────────────────────── */
const rowAfter = await readRow();
const after = await engine.readAllowance();
const residentAfter = await fetch(`https://api.elevenlabs.io/v1/voices/${String(row.voiceId)}`, {
  headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
});

say("\nAFTER");
say(`  the cast_voices row: ${rowAfter ? "⚠ STILL THERE" : "gone"}`);
say(`  slots ${after.slotsUsed}/${after.slotsTotal} (released ${before.slotsUsed - after.slotsUsed})`);
say(`  operations ${after.operationsUsed}/${after.operationsTotal} `
  + `(a release refunds ${before.operationsUsed - after.operationsUsed})`);
/*
  ⚠ MEASURED 400, NOT 404, for a deleted voice id — so the STATUS is not the
  proof and this line does not pretend it is. `voice_slots_used` falling is the
  reading that settles it, and it is printed above.
*/
say(`  the provider answers ${residentAfter.status} for the deleted voice id `
  + `(measured 400, not 404 — the slot count above is the proof, not this code)`);

/* The clip's bytes go by MANIFEST, not inline — so the claim is that its key is
   on one, which is what the cleanup worker then sweeps. */
const [manifest] = await client.query(
  "select b.id, b.kind, b.status, count(i.id) as items from storage_cleanup_batches b "
  + "join storage_cleanup_items i on i.batchId = b.id "
  + `where i.storageKey = '${String(row.clipStorageKey)}' group by b.id, b.kind, b.status`,
);
const batches = manifest as Array<Record<string, unknown>>;
say(`  the clip's key on a cleanup manifest: ${batches.length > 0 ? "yes" : "⚠ NO"}`);
for (const batch of batches) {
  say(`    batch ${batch.id} kind ${batch.kind} status ${batch.status} · ${batch.items} item(s)`);
}

process.exit(0);
