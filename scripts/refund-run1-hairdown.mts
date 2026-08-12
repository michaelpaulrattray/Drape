/**
 * RUN 1 STEP 4 — 25 credits back on the render that charged for an absent ask.
 *
 * The founder typed **"wear her hair down"**. The frame came back with her hair
 * in a high curly bun, and our own reader wrote it into the row verbatim —
 * *"hair pulled up into a high curly bun, not down"* — while the live reference
 * library independently refused the crop as `disputedDelivery`. Three
 * instruments agreed and 25 credits were charged, because `hairWorn` was marked
 * advisory and D-187 says an advisory miss records but does not refund.
 *
 * D-246 class (c) says the asked thing being COMPLETELY absent is a gate. The
 * gate has since been widened to say so (`ac749e26`, 2026-08-12) and run 2
 * proved it: the same sentence now delivers hair down. This pays back the one
 * render that predates the fix.
 *
 * ONE NAMED ROW, pinned by publicId, and it refuses everything else. Its
 * sibling v#170 is deliberately NOT here: that render's own ask was *"remove
 * her glasses"* and the glasses came off, so it delivered what it charged for.
 * The stale hairWorn miss it carried is the same defect and not a second
 * purchase.
 *
 * Ordered by Fable (fable-279 §5) under the founder's standing pre-authorisation
 * for ledger-reconciled, idempotency-proven corrections on his own account.
 * Same shape and same namespace as the 2026-08-07 and item-6 corrections.
 *
 * # Why it cannot pay twice, PROVED rather than claimed
 *
 * The correction carries `refund:correction:<variantPublicId>`, and `addCredits`
 * arbitrates on the unique reference index rather than on a prior SELECT. So
 * `--apply` ends by calling the SAME reference again and asserting the ledger
 * did not move — idempotency driven, not read off an index definition.
 *
 * # The world
 *
 * `addCredits` goes through the application's own `getDb()`, which reads
 * `DATABASE_URL`, so this must be handed the PRODUCTION url in that variable and
 * `assertOneWorld` refuses the local `.env` value. Money in the wrong world is
 * the one mistake here that cannot be un-run.
 *
 *   railway.cmd run --service MySQL -- sh -c \
 *     'DATABASE_URL=$MYSQL_PUBLIC_URL npx tsx scripts/refund-run1-hairdown.mts'
 *   … same command with --apply to issue it.
 */
import { assertOneWorld } from "./lib/worldGuard.mts";
import { openDatabase } from "./lib/dbConnection.mts";

/**
 * The row, pinned by the identifier the product itself uses.
 *
 * By publicId and never by `id = 169`: a row number is not a fact, and a money
 * script keyed on one pays the wrong person the day the numbering differs.
 */
const SPECIMEN = {
  label: "v#169",
  publicId: "3143a9cb-4091-4ade-abfd-e22825807b9b",
  asked: "hair down",
  facet: "hairWorn",
  saw: "hair pulled up into a high curly bun, not down",
} as const;

const APPLY = process.argv.includes("--apply");

assertOneWorld(["DATABASE_URL"]);
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("no DATABASE_URL — this moves real money, so it must be given one explicitly");
  process.exit(1);
}

const connection = await openDatabase({ uri: url, timezone: "Z" } as any);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};
const balanceOf = async (userId: number): Promise<number | null> => {
  const [row] = await query("SELECT balance FROM points WHERE userId = ? LIMIT 1", [userId]);
  return row ? Number(row.balance) : null;
};

console.log("RUN 1 STEP 4 — the ask was absent and it was charged for\n");

const [row] = await query(
  `SELECT v.id, v.publicId, v.userId, v.requestText, v.status, v.pointsCost,
          v.operationId, o.chargedCredits, o.refundedCredits
     FROM casting_candidate_variants v
     LEFT JOIN generation_operations o ON o.id = v.operationId
    WHERE v.publicId = ?`,
  [SPECIMEN.publicId],
);
if (!row) {
  console.error(`REFUSE ${SPECIMEN.label} — no such variant in this world`);
  await connection.end();
  process.exit(1);
}

const reference = `refund:correction:${row.publicId}`;
const [already] = await query(
  "SELECT id, amount, balanceAfter FROM point_transactions WHERE referenceId = ?",
  [reference],
);

const net = Number(row.pointsCost ?? 0) - Number(row.refundedCredits ?? 0);
console.log(`${SPECIMEN.label}  ${row.publicId}`);
console.log(`   asked   "${row.requestText}"`);
console.log(`   our reader saw:  ${SPECIMEN.saw}   [${SPECIMEN.facet}, advisory at the time]`);
console.log(`   status=${row.status}  charged=${row.pointsCost}  already refunded=${row.refundedCredits ?? 0}  NET ${net}`);

/* Every reason to refuse, checked before anything is owed. A correction on a row
   that was never charged, or that already came back, is an overpayment. */
if (String(row.status) !== "ready") {
  console.error("   REFUSE — status is not `ready`; this row delivered nothing");
  await connection.end();
  process.exit(1);
}
if (net <= 0) {
  console.error("   REFUSE — nothing outstanding on this charge");
  await connection.end();
  process.exit(1);
}
if (already) {
  console.log(`   ALREADY CORRECTED as ledger row #${already.id} (${already.amount}cr) — nothing owed`);
  await connection.end();
  process.exit(0);
}

const userId = Number(row.userId);
if (userId !== 1) {
  console.error(`REFUSE — this correction is authorized for user 1 only, not ${userId}`);
  await connection.end();
  process.exit(1);
}

const description =
  `Correction: delivered and charged while our own reader recorded the ask absent — `
  + `${SPECIMEN.facet} asked "${SPECIMEN.asked}", saw "${SPECIMEN.saw}". Advisory by D-187 at the `
  + `time; the presence gate now binds this facet (D-246 class (c)).`;

console.log(`\nRECONCILED: ${net} credits, one row · reference ${reference}`);
const before = await balanceOf(userId);
console.log(`user ${userId} balance BEFORE: ${before}`);

if (!APPLY) {
  console.log("\nDRY RUN — nothing moved. Re-run with --apply to issue the correction.");
  await connection.end();
  process.exit(0);
}

/* Imported here, not at the top: loading the app's credit module opens the
   application pool, and a dry run must not connect as the application at all. */
const { addCredits } = await import("../server/db/credits.js");

const result = await addCredits(userId, net, "refund", description, reference);
console.log(`\n  ${SPECIMEN.label}  success=${result.success} `
  + `duplicate=${(result as { duplicate?: boolean }).duplicate === true} ${result.error ?? ""}`);
if (!result.success) {
  console.error("  STOPPING — the correction failed");
  await connection.end();
  process.exit(1);
}

const after = await balanceOf(userId);
console.log(`user ${userId} balance AFTER: ${after}   (moved ${Number(after) - Number(before)})`);

/*
  THE IDEMPOTENCY PROOF, DRIVEN.

  The claim is "re-running this pays nothing twice", and the claim is worth
  exactly as much as an attempt to break it. So the same reference is replayed
  against the live ledger and the balance asserted unmoved. The negative control
  is the paragraph above: a fresh reference DID move it, seconds ago.
*/
console.log("\nidempotency — replaying the same reference against the live ledger:");
const replay = await addCredits(userId, net, "refund", description, reference);
console.log(`  replay success=${replay.success} duplicate=${(replay as { duplicate?: boolean }).duplicate === true}`);
const afterReplay = await balanceOf(userId);
const held = afterReplay === after;
console.log(`balance after replay: ${afterReplay}  → ${held ? "UNCHANGED — idempotent, proved" : "CHANGED — DOUBLE PAID, investigate"}`);

const ledger = await query(
  `SELECT id, type, amount, referenceId, balanceAfter, description
     FROM point_transactions WHERE referenceId = ? ORDER BY id ASC`,
  [reference],
);
console.log(`\nthe ledger's own account of this batch (${ledger.length} row — one is correct):`);
for (const entry of ledger) {
  console.log(`  #${entry.id} ${entry.type} +${entry.amount}  balance→${entry.balanceAfter}  ${entry.referenceId}`);
}

await connection.end();
process.exit(held && ledger.length === 1 ? 0 : 1);
