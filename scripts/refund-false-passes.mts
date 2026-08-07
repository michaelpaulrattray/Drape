/**
 * D-113 CORRECTIONS — every charged render the product itself knew was
 * non-compliant.
 *
 * # What it refunds, and what it deliberately does not
 *
 * A **false pass** is a delivery the verification net READ and found wanting: a
 * check with `read: true` and `verified: false`, delivered anyway, charged
 * anyway. D-236 calls this worse than a refusal, because a refusal at least
 * gives the money back. Those are refunded here.
 *
 * It does **not** refund `delivered_unverified`. Rows written before D-235 have
 * evidence-free affirmatives — the reader may have looked and said yes with
 * nothing behind it, or may not have looked at all, and the instrument cannot
 * tell. Refunding on suspicion would be guessing with the ledger, and the ledger
 * is the one place in this product that has never been wrong. A row proven
 * non-compliant by EYE rather than by the net is a founder decision, named
 * individually, not swept up by a query.
 *
 * # It cannot pay twice
 *
 * Every correction carries `refund:correction:<variantPublicId>` as its ledger
 * reference, and `addCredits` arbitrates on the unique reference index rather
 * than on a prior SELECT. Re-running this is a no-op by construction, which is
 * the property that makes it safe to run again after a partial failure.
 *
 * # Moving money in production is a founder-authorized act
 *
 * `--execute` is required. Without it this reconciles and prints, and nothing
 * moves. Authorized for this batch by the founder, 2026-08-07, on the condition
 * that the whole campaign be reconciled first rather than the three rows already
 * known — including renders made on the wrong face, because a charge for a
 * render that dropped a filed fact is wrong whoever was in the frame.
 *
 *   DATABASE_URL=… npx tsx scripts/refund-false-passes.mts --user 1 --since 2026-08-06
 *   DATABASE_URL=… npx tsx scripts/refund-false-passes.mts --user 1 --since 2026-08-06 --execute
 */
import "dotenv/config";

import { classifyAttempt } from "../server/castingV2/reliabilityReport.js";
import { openDatabase, utc } from "./lib/dbConnection.mjs";
import { verdictOf } from "./lib/attemptRows.mjs";

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

const userId = Number(arg("user") ?? 1);
const since = arg("since") ?? "2026-08-06";
const EXECUTE = process.argv.includes("--execute");
const url = process.env.DATABASE_URL ?? process.env.MYSQL_PUBLIC_URL;
if (!url) throw new Error("no DATABASE_URL — this reads and writes real money, so it must be given one");

const conn = await openDatabase(url);
const [rows] = await conn.query<any[]>(
  `SELECT v.publicId, v.candidateId, v.createdAt, v.status, v.failureClass, v.pointsCost,
          v.requestText, v.internalPrompt, v.operationId, o.refundedCredits
     FROM casting_candidate_variants v
     LEFT JOIN generation_operations o ON o.id = v.operationId
    WHERE v.userId = ? AND v.pointsCost > 0 AND v.createdAt >= ?
    ORDER BY v.createdAt ASC`,
  [userId, since],
);
await conn.end();

type Owed = {
  variant: string;
  candidateId: number;
  at: string;
  amount: number;
  asked: string;
  misses: string[];
  /** Whether the step's OWN ask failed, or an inherited fact from earlier in
   *  the chain. Both are charged renders that dropped a filed fact; the
   *  distinction is reported because it is materially different to read. */
  ownAsk: boolean;
};

const owed: Owed[] = [];
let charged = 0;
let alreadyRefunded = 0;
const tally: Record<string, number> = {};

for (const raw of rows) {
  const row = {
    operationId: String(raw.operationId ?? ""),
    createdAt: new Date(raw.createdAt),
    status: String(raw.status),
    failureClass: raw.failureClass ?? null,
    pointsCost: raw.pointsCost ?? 0,
    refundedCredits: raw.refundedCredits ?? 0,
    verification: verdictOf(raw.internalPrompt),
    requestText: raw.requestText ?? null,
  };
  const kind = classifyAttempt(row);
  tally[kind] = (tally[kind] ?? 0) + 1;
  charged += row.pointsCost;
  alreadyRefunded += row.refundedCredits;

  const net = row.pointsCost - row.refundedCredits;
  if (kind !== "delivered_noncompliant" || net <= 0) continue;

  const misses = (row.verification?.checks ?? [])
    .filter((check) => check.read === true && !check.verified)
    .map((check) => `${check.facet}="${check.asked}" saw="${check.saw ?? "?"}"`);
  const asked = String(row.requestText ?? "");
  owed.push({
    variant: String(raw.publicId),
    candidateId: raw.candidateId,
    at: utc(row.createdAt),
    amount: net,
    asked,
    misses,
    /* A crude but honest test: did this sentence name the facet that missed? */
    ownAsk: misses.some((miss) => {
      const facet = miss.slice(0, miss.indexOf("="));
      return asked.toLowerCase().includes(facet.toLowerCase().replace(/^.*\./, ""))
        || (facet === "marks" && /freckle|mole|beauty mark|scar/i.test(asked));
    }),
  });
}

console.log(`CAMPAIGN RECONCILIATION — user ${userId}, since ${since}`);
console.log(`${rows.length} charged attempts · ${charged} credits charged · ${alreadyRefunded} already refunded\n`);
console.log("classification:", JSON.stringify(tally), "\n");

console.log("FALSE PASSES — delivered, charged, and READ as non-compliant");
for (const row of owed) {
  console.log(`  ${row.at} cand=${row.candidateId} ${row.amount}cr  "${row.asked.slice(0, 30)}"`
    + `${row.ownAsk ? "  ← its own ask" : "  (inherited fact)"}`);
  for (const miss of row.misses) console.log(`      ${miss}`);
}

const total = owed.reduce((sum, row) => sum + row.amount, 0);
const ownAsk = owed.filter((row) => row.ownAsk);
console.log(`\nRECONCILED TOTAL: ${total} credits across ${owed.length} rows`);
console.log(`  ${ownAsk.length} where the step's OWN ask was dropped (${ownAsk.reduce((s, r) => s + r.amount, 0)}cr)`);
console.log(`  ${owed.length - ownAsk.length} where an EARLIER fact in the chain was dropped and every`);
console.log("     subsequent render inherited the miss");

if (!EXECUTE) {
  console.log("\nDRY RUN — nothing moved. Pass --execute to issue the corrections.");
  process.exit(0);
}

/* Imported lazily: loading the app's db module opens a pool, and a dry run
   should not connect as the application at all. */
const { addCredits } = await import("../server/db/credits.js");

let paid = 0;
let skipped = 0;
for (const row of owed) {
  const reference = `refund:correction:${row.variant}`;
  const result = await addCredits(
    userId,
    row.amount,
    "refund",
    `D-113 correction — delivered and charged with a filed fact the reader found absent `
    + `(${row.misses[0] ?? "non-compliant"})`,
    reference,
  );
  if (!result.success) {
    console.log(`  FAILED ${row.variant} — ${result.error}`);
    continue;
  }
  /* A duplicate reference resolves to success without a second row, which is
     what makes a re-run safe; it is reported as skipped rather than as paid so
     the printed total is never larger than the money that actually moved. */
  const already = (result as { duplicate?: boolean }).duplicate === true;
  if (already) skipped += 1;
  else paid += row.amount;
  console.log(`  ${already ? "already done" : "refunded"} ${row.amount}cr  ${row.variant}`);
}

console.log(`\n${paid} credits issued · ${skipped} already present · reference refund:correction:<variant>`);

/*
  AND STOP, because `addCredits` opens the application's connection pool and a
  pool with `enableKeepAlive` never lets node exit on its own. The first run of
  this wrote all ten corrections correctly and then hung until it was killed,
  which is the most alarming possible way for a money script to end: every row
  was already committed and the operator could not tell from the console.
*/
process.exit(0);
