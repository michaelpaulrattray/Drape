/**
 * THE TEN UNRESOLVED REFUNDS (shift 46).
 *
 * `campaign-ledger-window-disposable.mts` §4 pairs every in-window refund to its
 * charge and finds 25 of the 675 refunded credits repaying a charge that sits
 * BELOW the ceiling's window. Ten refunds (250 credits) resist both key shapes:
 * they are the 2026-08-07 12:51Z false-pass batch, which keys on
 * `refund:correction:<variantPublicId>`, and those variant rows are no longer in
 * `casting_candidate_variants` — so the uuid resolves to nothing.
 *
 * The charge is still findable, from the other end. `refund-false-passes.mts`
 * writes `generation_operations.refundedCredits` through `addCredits`, so an
 * operation that was corrected carries the mark even though its variant is gone.
 * This walks the in-window charges, reads each one's operation, and reports
 * which charges have been refunded and by how much — pinning the ten to a side
 * of the boundary by arithmetic rather than by plausibility.
 *
 * Read-only. Controlled both ways: the reader is first shown finding a
 * refundedCredits value it must find, and declining on an id that cannot exist.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/campaign-refund-pairing-disposable.mts
 */
import "dotenv/config";

import { openDatabase, utc } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL — run under `railway run --service MySQL`");

const WINDOW_FROM = "2026-08-07 00:00:00";
const CAMPAIGN_USER = 1;
/* Far enough below the boundary to cover the false-pass batch's own `--since
   2026-08-06`, which is the reason a pair can straddle the cut at all. */
const LOOKBACK_FROM = "2026-08-06 00:00:00";

const connection = await openDatabase(databaseUrl);
const rows = async (sql: string, params: unknown[]): Promise<any[]> => {
  const [result] = await connection.query<any[]>(sql, params);
  return result;
};
const opOf = (reference: string | null | undefined): string | null => {
  const found = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(String(reference ?? ""));
  return found ? found[1].toLowerCase() : null;
};

/* Every charge from a day BEFORE the boundary to now, so both sides are in one
   table and the cut is a column rather than a separate query. */
const charges = await rows(
  `SELECT id, amount, referenceId, createdAt FROM point_transactions
    WHERE userId = ? AND amount < 0 AND createdAt >= ? ORDER BY id ASC`,
  [CAMPAIGN_USER, LOOKBACK_FROM],
);

const opIds = [...new Set(charges.map((row) => opOf(row.referenceId)).filter(Boolean))] as string[];
const operations = opIds.length === 0 ? [] : await rows(
  `SELECT id, refundedCredits, createdAt FROM generation_operations WHERE id IN (${opIds.map(() => "?").join(",")})`,
  opIds,
);
const refundedByOp = new Map(operations.map((row) => [String(row.id), Number(row.refundedCredits ?? 0)]));

console.log("=".repeat(78));
console.log("THE TEN — pinning the false-pass batch to a side of the boundary");
console.log("=".repeat(78));

/* CONTROLS FIRST. The reader must be shown able to produce a non-zero
   refundedCredits, and to decline on an operation id that cannot exist. */
const nonZero = [...refundedByOp.entries()].filter(([, credits]) => credits > 0);
const impossible = await rows(
  "SELECT id FROM generation_operations WHERE id = ?",
  ["00000000-0000-4000-8000-000000000000"],
);
console.log(`\nCONTROL POSITIVE — operations carrying refundedCredits > 0: ${nonZero.length} (must be > 0)`);
console.log(`CONTROL NEGATIVE — an operation id that cannot exist:      ${impossible.length} rows (must be 0)`);
console.log(`charges read: ${charges.length}  ·  distinct ops: ${opIds.length}  ·  operations found: ${operations.length}`);

let belowRefunded = 0;
let insideRefunded = 0;
let belowGross = 0;
let insideGross = 0;
console.log(`\n${"-".repeat(78)}`);
console.log(`   id  when                   amt   side     refundedCredits on its operation`);
console.log("-".repeat(78));
for (const charge of charges) {
  const op = opOf(charge.referenceId);
  const when = utc(charge.createdAt);
  const outside = when < `${WINDOW_FROM}Z`;
  const refunded = op ? (refundedByOp.get(op) ?? 0) : 0;
  const amount = Number(charge.amount);
  if (outside) {
    belowGross += -amount;
    belowRefunded += refunded;
  } else {
    insideGross += -amount;
    insideRefunded += refunded;
  }
  console.log(
    `${String(charge.id).padStart(6)}  ${when}  ${String(amount).padStart(5)}  `
    + `${(outside ? "BELOW" : "inside").padEnd(7)}  ${refunded > 0 ? String(refunded) : "—"}`
    + `${op ? "" : "   (no op in reference)"}`,
  );
}

console.log(`\n${"=".repeat(78)}`);
console.log(`BELOW the boundary (${LOOKBACK_FROM}Z → ${WINDOW_FROM}Z): gross ${belowGross}, of which ${belowRefunded} was refunded`);
console.log(`INSIDE the window  (${WINDOW_FROM}Z → now):              gross ${insideGross}, of which ${insideRefunded} was refunded`);
console.log("=".repeat(78));

await connection.end();
process.exit(0);
