/**
 * THE CEILING INSTRUMENT'S WINDOW, NOT WHAT IS INSIDE IT (shift 46).
 *
 * `campaign-ledger-rows-disposable.mts` is the authority on the 5,000-credit
 * gross ceiling, and every park since has driven the number it prints. Shift 45
 * gave that headline a second reader by summing the 102 rows it printed — which
 * proves the accumulator has not drifted from its own rows, and proves nothing
 * at all about whether those are the RIGHT rows.
 *
 * The ceiling reads `WHERE userId = 1 AND createdAt >= '2026-08-07 00:00:00'`.
 * Two assumptions live in that line and no park has ever driven either:
 *
 *   1. **The lower boundary.** The founder's limit counts "the ~350 already
 *      charged" toward the 5,000. If any of those charges landed before
 *      2026-08-07 00:00:00 they are outside the window, and the gross under-
 *      states the figure that governs a hard stop. This is the wrong-boundary
 *      class the program has already named four times.
 *   2. **The userId filter.** `CASTING_V2_SCOPE=all` in production, so a user
 *      who is not the founder CAN spend on the V2 surface. "Campaign gross" and
 *      "user 1's gross" are the same number only while that set is empty, and
 *      nobody has looked.
 *
 * Read-only: three SELECTs, no writes, no credits. Both readings are controlled
 * — the same code path that reports an absence is first shown able to report a
 * presence, because an absence is only evidence once the reader can produce one.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/campaign-ledger-window-disposable.mts
 */
import "dotenv/config";

import { openDatabase, utc } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL — run under `railway run --service MySQL`");

/* The ceiling instrument's own two constants, copied deliberately so this probe
   is asking about THEM rather than about a window of its own invention. */
const WINDOW_FROM = "2026-08-07 00:00:00";
const CAMPAIGN_USER = 1;

/* How far below the boundary to look. The campaign's first paid work is early
   August; a fortnight back is far enough to contain the "~350 already charged"
   wherever it sits, and short enough to print in full and be read by eye. */
const LOOKBACK_FROM = "2026-07-24 00:00:00";

const connection = await openDatabase(databaseUrl);

const rows = async (sql: string, params: unknown[]): Promise<any[]> => {
  const [result] = await connection.query<any[]>(sql, params);
  return result;
};

const signedTotals = (found: any[]) => {
  let gross = 0;
  let credited = 0;
  for (const row of found) {
    const amount = Number(row.amount);
    if (amount < 0) gross += -amount;
    if (amount > 0) credited += amount;
  }
  return { gross, credited, count: found.length };
};

console.log("=".repeat(78));
console.log("THE WINDOW — is the ceiling reading the right rows?");
console.log("=".repeat(78));

/* ─────────────────────────────────────────────────────────────────────────────
   0. THE READER, PROVED BOTH WAYS, before either absence is believed.
   ──────────────────────────────────────────────────────────────────────────── */
const positiveControl = await rows(
  `SELECT id, amount, createdAt FROM point_transactions
    WHERE userId = ? AND createdAt >= ? ORDER BY id ASC`,
  [CAMPAIGN_USER, WINDOW_FROM],
);
const impossibleControl = await rows(
  `SELECT id, amount, createdAt FROM point_transactions
    WHERE userId = ? AND createdAt >= ? AND createdAt < ? ORDER BY id ASC`,
  [CAMPAIGN_USER, "1990-01-01 00:00:00", "1990-01-02 00:00:00"],
);
const positive = signedTotals(positiveControl);
console.log(`\nCONTROL  POSITIVE — the ceiling's own window returns rows: ${positive.count} rows, gross ${positive.gross}, credited ${positive.credited}`);
console.log(`CONTROL  NEGATIVE — a day in 1990 returns nothing:        ${impossibleControl.length} rows`);
console.log("  (the first proves this reader is not blank; the second proves it can decline)");

/* ─────────────────────────────────────────────────────────────────────────────
   1. BELOW THE BOUNDARY — every user-1 row in the fortnight before the cut.
   ──────────────────────────────────────────────────────────────────────────── */
const below = await rows(
  `SELECT id, amount, type, description, referenceId, createdAt
     FROM point_transactions
    WHERE userId = ? AND createdAt >= ? AND createdAt < ?
    ORDER BY id ASC`,
  [CAMPAIGN_USER, LOOKBACK_FROM, WINDOW_FROM],
);
const belowTotals = signedTotals(below);
console.log(`\n${"-".repeat(78)}`);
console.log(`1. BELOW THE BOUNDARY — user ${CAMPAIGN_USER}, ${LOOKBACK_FROM}Z → ${WINDOW_FROM}Z (EXCLUDED by the ceiling)`);
console.log("-".repeat(78));
console.log(`   ${belowTotals.count} rows · gross ${belowTotals.gross} · credited ${belowTotals.credited}`);
for (const row of below) {
  console.log(
    `${String(row.id).padStart(6)}  ${utc(row.createdAt)}  ${String(Number(row.amount)).padStart(5)}  `
    + `${String(row.type).padEnd(10)}  ${String(row.description ?? "").slice(0, 44).padEnd(44)}  `
    + `${String(row.referenceId ?? "").slice(0, 40)}`,
  );
}
if (below.length === 0) {
  console.log("   (none — and the POSITIVE control above proves that is a reading, not a blank)");
}

/* ─────────────────────────────────────────────────────────────────────────────
   2. OUTSIDE THE USER FILTER — anyone else spending inside the campaign window.
      CASTING_V2_SCOPE=all, so this set is not structurally empty.
   ──────────────────────────────────────────────────────────────────────────── */
const others = await rows(
  `SELECT userId, COUNT(*) AS rowCount,
          SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS gross,
          MIN(createdAt) AS firstAt, MAX(createdAt) AS lastAt
     FROM point_transactions
    WHERE userId <> ? AND createdAt >= ?
    GROUP BY userId
    ORDER BY gross DESC`,
  [CAMPAIGN_USER, WINDOW_FROM],
);
console.log(`\n${"-".repeat(78)}`);
console.log(`2. OUTSIDE THE USER FILTER — every OTHER user, ${WINDOW_FROM}Z → now`);
console.log("-".repeat(78));
if (others.length === 0) {
  console.log("   (no other user has a transaction in the campaign window)");
} else {
  let otherGross = 0;
  for (const row of others) {
    const gross = Number(row.gross ?? 0);
    otherGross += gross;
    console.log(
      `   user ${String(row.userId).padStart(5)}  ${String(row.rowCount).padStart(4)} rows  gross ${String(gross).padStart(6)}  `
      + `${utc(row.firstAt)} → ${utc(row.lastAt)}`,
    );
  }
  console.log(`   OTHER-USER GROSS IN THE WINDOW: ${otherGross}`);
}

/* ─────────────────────────────────────────────────────────────────────────────
   3. THE SAME HEADLINE, AGGREGATED BY THE DATABASE RATHER THAN BY A JS LOOP.
      Not a new window — a different instrument over the same one.
   ──────────────────────────────────────────────────────────────────────────── */
const [aggregate] = await rows(
  `SELECT COUNT(*) AS rowCount,
          SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS gross,
          SUM(CASE WHEN amount > 0 AND type = 'refund' THEN amount ELSE 0 END) AS refunded
     FROM point_transactions
    WHERE userId = ? AND createdAt >= ?`,
  [CAMPAIGN_USER, WINDOW_FROM],
);
const aggGross = Number(aggregate.gross ?? 0);
const aggRefunded = Number(aggregate.refunded ?? 0);
console.log(`\n${"-".repeat(78)}`);
console.log("3. THE HEADLINE, AGGREGATED SERVER-SIDE (a second instrument, not a second parse)");
console.log("-".repeat(78));
console.log(`   rows ${Number(aggregate.rowCount)}   gross ${aggGross}   refunded ${aggRefunded}   net ${aggGross - aggRefunded}`);

/* ─────────────────────────────────────────────────────────────────────────────
   4. PAIRS CUT BY THE BOUNDARY — a refund inside the window whose charge is
      outside it. A window that splits a matched pair reports a repayment it
      never counted the cost of, so `refunded` (and therefore `net`) drifts
      while `gross` stays honest. Done over ALL refunds by op id, not by eye.
   ──────────────────────────────────────────────────────────────────────────── */
const opOf = (reference: string | null | undefined): string | null => {
  const found = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(String(reference ?? ""));
  return found ? found[1].toLowerCase() : null;
};

const inWindow = await rows(
  `SELECT id, amount, type, referenceId, createdAt FROM point_transactions
    WHERE userId = ? AND createdAt >= ? ORDER BY id ASC`,
  [CAMPAIGN_USER, WINDOW_FROM],
);
const chargeOps = new Set(
  inWindow.filter((row) => Number(row.amount) < 0).map((row) => opOf(row.referenceId)).filter(Boolean),
);
const windowRefunds = inWindow.filter((row) => Number(row.amount) > 0 && row.type === "refund");

console.log(`\n${"-".repeat(78)}`);
console.log("4. PAIRS CUT BY THE BOUNDARY — in-window refunds whose CHARGE is outside the window");
console.log("-".repeat(78));
console.log(`   in-window charges: ${chargeOps.size} distinct ops · in-window refunds: ${windowRefunds.length}`);

/* The reader, controlled: a refund whose op IS in the window must be seen as
   matched, or "unmatched" below means nothing. */
const matched = windowRefunds.filter((row) => {
  const op = opOf(row.referenceId);
  return op !== null && chargeOps.has(op);
});
const orphans = windowRefunds.filter((row) => {
  const op = opOf(row.referenceId);
  return op === null || !chargeOps.has(op);
});
console.log(`   CONTROL POSITIVE — refunds matched to an in-window charge: ${matched.length} (must be > 0)`);
console.log(`   ORPHANS — refunds with no in-window charge:               ${orphans.length}`);

let orphanCredits = 0;
let belowPairCredits = 0;
let insidePairCredits = 0;
let unresolved = 0;
for (const row of orphans) {
  const op = opOf(row.referenceId);
  orphanCredits += Number(row.amount);
  /* Where the missing charge actually is, so the orphan is NAMED, not inferred. */
  let source = op
    ? await rows(
      `SELECT id, amount, createdAt FROM point_transactions
        WHERE userId = ? AND amount < 0 AND referenceId LIKE ? ORDER BY id ASC`,
      [CAMPAIGN_USER, `%${op}%`],
    )
    : [];
  /*
    SECOND KEY SHAPE. `refund:correction:<uuid>` keys on a casting VARIANT's
    publicId, not on an operation (scripts/refund-false-passes.mts:154), so
    looking that uuid up among charge references finds nothing and the refund
    reads as unpaired. It is not — the charge is keyed by the variant's
    OPERATION. Resolve through the variant before calling anything an orphan.
  */
  let via = "op reference";
  if (source.length === 0 && op) {
    const variant = await rows(
      "SELECT publicId, operationId, createdAt FROM casting_candidate_variants WHERE publicId = ?",
      [op],
    );
    if (variant.length > 0 && variant[0].operationId) {
      via = `variant → operation ${variant[0].operationId}`;
      source = await rows(
        `SELECT id, amount, createdAt FROM point_transactions
          WHERE userId = ? AND amount < 0 AND referenceId LIKE ? ORDER BY id ASC`,
        [CAMPAIGN_USER, `%${variant[0].operationId}%`],
      );
    }
  }
  console.log(
    `${String(row.id).padStart(6)}  ${utc(row.createdAt)}  +${Number(row.amount)}  op ${op ?? "(none in reference)"}`,
  );
  if (source.length === 0) {
    console.log("          charge: NONE FOUND by either key shape");
    unresolved += 1;
  } else {
    for (const charge of source) {
      const outside = utc(charge.createdAt) < `${WINDOW_FROM}Z`;
      if (outside) belowPairCredits += Number(row.amount);
      else insidePairCredits += Number(row.amount);
      console.log(
        `          charge: id ${charge.id}  ${utc(charge.createdAt)}  ${Number(charge.amount)}  `
        + `→ ${outside ? "BELOW the boundary" : "inside the window"}   (via ${via})`,
      );
    }
  }
}
if (orphans.length > 0) {
  console.log(`\n   OF THE ${orphans.length} not matched by op reference:`);
  console.log(`     resolved to a charge INSIDE the window (correctly counted): ${insidePairCredits} credits`);
  console.log(`     resolved to a charge BELOW the boundary (pair cut):         ${belowPairCredits} credits`);
  console.log(`     unresolved by either key shape:                             ${unresolved} rows`);
  console.log(`\n   → gross ${aggGross} is UNAFFECTED either way (refunds are positive; the CEILING IS SAFE)`);
  console.log(`   → refunded ${aggRefunded} includes ${belowPairCredits} repaying charges the window never counted`);
  console.log(`   → net of the window's OWN charges: ${aggGross} - ${aggRefunded - belowPairCredits} = ${aggGross - (aggRefunded - belowPairCredits)}`);
}

console.log(`\n${"=".repeat(78)}`);
console.log(`VERDICT INPUTS: excluded-below gross ${belowTotals.gross} · other-user gross in window `
  + `${others.reduce((sum, row) => sum + Number(row.gross ?? 0), 0)} · in-window gross ${aggGross}`
  + ` · refund credits whose charge is BELOW the boundary ${belowPairCredits}`
  + ` (of ${orphanCredits} not matched by op reference; ${unresolved} rows unresolved)`);
console.log("=".repeat(78));

await connection.end();
process.exit(0);
