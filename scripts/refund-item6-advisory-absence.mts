/**
 * ITEM 6 — 50 credits back on the two renders our own checker said did not land.
 *
 * The founder asked for dangly cross earrings and for her hair down. On both
 * renders **our own reader looked at the delivered picture and wrote down that
 * the thing he asked for was not there** — "small stud earrings, no dangly
 * cross earrings visible", and "hair pulled back into a low bun, not down". He
 * was charged 25 credits each anyway, because those two checks are marked
 * ADVISORY and D-187 says an advisory miss records but does not refund.
 *
 * D-187 is not being changed here and this script deliberately cannot change
 * it: it refunds TWO NAMED ROWS, pinned by publicId, and refuses everything
 * else. The 800 credits of similar advisory misses across the account are NOT
 * swept up — most predate the last three days' fixes and some are the reader
 * being wrong rather than the render. A row corrected by EYE rather than by the
 * net is a decision named individually (`refund-false-passes.mts`'s own rule),
 * and this is that named decision.
 *
 * Approved by the founder ("whatever you recommend"), relayed fable-141 §4.
 *
 * # Why it cannot pay twice, and how that is PROVED rather than claimed
 *
 * Each correction carries `refund:correction:<variantPublicId>` — the namespace
 * the ten existing corrections already use — and `addCredits` arbitrates on the
 * unique reference index rather than on a prior SELECT. `--apply` therefore
 * ends by calling the SAME reference a second time and asserting the ledger did
 * not move: an idempotency claim tested by driving it, not by reading the index
 * definition. A guard whose only test is the expensive path is an untested
 * guard.
 *
 * # The world
 *
 * `addCredits` goes through the application's own `getDb()`, which reads
 * `DATABASE_URL` — so this must be given the PRODUCTION url in that variable,
 * and `assertOneWorld` refuses if the value is the one the local `.env` file
 * holds. Money in the wrong world is the one mistake here that cannot be
 * un-run.
 *
 *   railway.cmd run --service MySQL -- sh -c \
 *     'DATABASE_URL=$MYSQL_PUBLIC_URL npx tsx scripts/refund-item6-advisory-absence.mts'
 *   … same command with --apply to issue them.
 */
import mysql from "mysql2/promise";

import { assertOneWorld } from "./lib/worldGuard.mts";

/**
 * The two rows, pinned by the identifier the product itself uses.
 *
 * By publicId and never by `id IN (164,165)`: a row number is not a fact, and a
 * money script keyed on one is a money script that pays the wrong person the
 * day the numbering differs. The display index is kept only for the report.
 */
const SPECIMENS = [
  {
    label: "v#164",
    publicId: "cafa4777-f990-480b-bd42-6a44a874054d",
    asked: "dangly cross earrings",
    facet: "statedAccessories",
    saw: "small stud earrings, no dangly cross earrings visible",
  },
  {
    label: "v#165",
    publicId: "23bf4f61-1a93-4024-915f-021efac9cc2b",
    asked: "her eye colour is icy blue",
    facet: "hairWorn",
    saw: "hair pulled back into a low bun, not down",
  },
] as const;

const APPLY = process.argv.includes("--apply");

assertOneWorld(["DATABASE_URL"]);
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("no DATABASE_URL — this moves real money, so it must be given one explicitly");
  process.exit(1);
}

const connection = await mysql.createConnection({ uri: url, timezone: "Z" } as any);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};
const balanceOf = async (userId: number): Promise<number | null> => {
  const [row] = await query("SELECT balance FROM points WHERE userId = ? LIMIT 1", [userId]);
  return row ? Number(row.balance) : null;
};

console.log("ITEM 6 — advisory-absence corrections, two named rows\n");

type Owed = { label: string; publicId: string; userId: number; amount: number; reference: string; description: string };
const owed: Owed[] = [];
let refused = 0;

for (const specimen of SPECIMENS) {
  const [row] = await query(
    `SELECT v.id, v.publicId, v.userId, v.requestText, v.status, v.pointsCost,
            v.operationId, o.chargedCredits, o.refundedCredits
       FROM casting_candidate_variants v
       LEFT JOIN generation_operations o ON o.id = v.operationId
      WHERE v.publicId = ?`,
    [specimen.publicId],
  );
  if (!row) {
    console.log(`REFUSE ${specimen.label} — no such variant in this world`);
    refused += 1;
    continue;
  }

  const reference = `refund:correction:${row.publicId}`;
  const [already] = await query(
    "SELECT id, amount, balanceAfter FROM point_transactions WHERE referenceId = ?",
    [reference],
  );

  const net = Number(row.pointsCost ?? 0) - Number(row.refundedCredits ?? 0);
  console.log(`${specimen.label}  ${row.publicId}`);
  console.log(`   asked   "${row.requestText}"`);
  console.log(`   our reader saw:  ${specimen.saw}   [${specimen.facet}, advisory]`);
  console.log(`   status=${row.status}  charged=${row.pointsCost}  already refunded=${row.refundedCredits ?? 0}  NET ${net}`);

  /* Every reason to refuse, checked before anything is owed. A correction on a
     row that was never charged, or already came back, is an overpayment. */
  if (String(row.status) !== "ready") { console.log(`   REFUSE — status is not \`ready\`; this row delivered nothing\n`); refused += 1; continue; }
  if (net <= 0) { console.log(`   REFUSE — nothing outstanding on this charge\n`); refused += 1; continue; }
  if (already) { console.log(`   ALREADY CORRECTED as ledger row #${already.id} (${already.amount}cr)\n`); continue; }

  owed.push({
    label: specimen.label,
    publicId: String(row.publicId),
    userId: Number(row.userId),
    amount: net,
    reference,
    description:
      `Correction: delivered and charged while our own reader recorded the ask absent — `
      + `${specimen.facet} asked "${specimen.asked}", saw "${specimen.saw}". Advisory by D-187; `
      + `corrected by name (founder, item 6).`,
  });
  console.log(`   OWED ${net}cr   reference ${reference}\n`);
}

const total = owed.reduce((sum, row) => sum + row.amount, 0);
const users = new Set(owed.map((row) => row.userId));
console.log(`RECONCILED: ${total} credits across ${owed.length} rows · ${refused} refused`);
if (users.size > 1) { console.error("REFUSE — this batch spans more than one account"); process.exit(1); }
const userId = owed[0]?.userId ?? 1;
if (userId !== 1) { console.error(`REFUSE — this batch is authorized for user 1 only, not ${userId}`); process.exit(1); }

const before = await balanceOf(userId);
console.log(`user ${userId} balance BEFORE: ${before}`);

if (!APPLY) {
  console.log("\nDRY RUN — nothing moved. Re-run with --apply to issue the corrections.");
  await connection.end();
  process.exit(0);
}
if (owed.length === 0) {
  console.log("\nNothing owed; nothing to apply.");
  await connection.end();
  process.exit(0);
}

/* Imported here, not at the top: loading the app's credit module opens the
   application pool, and a dry run must not connect as the application at all. */
const { addCredits } = await import("../server/db/credits.js");

for (const row of owed) {
  const result = await addCredits(row.userId, row.amount, "refund", row.description, row.reference);
  console.log(`  ${row.label}  success=${result.success} duplicate=${(result as { duplicate?: boolean }).duplicate === true} ${result.error ?? ""}`);
  if (!result.success) { console.error("  STOPPING — a correction failed; the rest are not attempted"); break; }
}

const after = await balanceOf(userId);
console.log(`\nuser ${userId} balance AFTER: ${after}   (moved ${Number(after) - Number(before)})`);

/*
  THE IDEMPOTENCY PROOF, DRIVEN.

  The claim is "re-running this pays nothing twice". The claim is worth exactly
  as much as an attempt to break it, so this replays every reference and asserts
  the balance did not move. A negative control is built in: a fresh reference
  would move it, which is what the ten rows above already demonstrate.
*/
console.log("\nidempotency — replaying every reference against the live ledger:");
for (const row of owed) {
  const result = await addCredits(row.userId, row.amount, "refund", row.description, row.reference);
  const duplicate = (result as { duplicate?: boolean }).duplicate === true;
  console.log(`  ${row.label}  replay success=${result.success} duplicate=${duplicate}`);
  if (!duplicate) console.log(`  ⚠ NOT reported duplicate — the balance check below is the authority`);
}
const afterReplay = await balanceOf(userId);
const held = afterReplay === after;
console.log(`balance after replay: ${afterReplay}  → ${held ? "UNCHANGED — idempotent, proved" : "CHANGED — DOUBLE PAID, investigate"}`);

const rows = await query(
  `SELECT id, type, amount, referenceId, balanceAfter, description
     FROM point_transactions WHERE referenceId IN (?, ?) ORDER BY id ASC`,
  [SPECIMENS[0] && `refund:correction:${SPECIMENS[0].publicId}`, `refund:correction:${SPECIMENS[1].publicId}`],
);
console.log(`\nthe ledger's own account of this batch (${rows.length} rows — two is correct):`);
for (const row of rows) {
  console.log(`  #${row.id} ${row.type} +${row.amount}  balance→${row.balanceAfter}  ${row.referenceId}`);
}

await connection.end();
process.exit(held && rows.length === owed.length ? 0 : 1);
