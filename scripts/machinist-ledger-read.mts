/**
 * THE MACHINIST'S READING — what production already records about how long
 * paid work takes and what it costs the house. READ ONLY; spends nothing.
 *
 * The Machinist seat (PROGRAM.md, "THE CLOCKS"; charter #58, founder-ruled)
 * keeps `docs/MACHINIST_LEDGER.md`. Every run of that patrol BEGINS by reading
 * the ledger and ENDS by appending this script's output to it, so a figure
 * quoted week after week comes from one reader and never from a memory
 * (INSTRUMENT_DOCTRINE entry 5). Built on patrol #1 (card #98, 2026-08-26).
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/machinist-ledger-read.mts [--days 14] [--pr-limit N]
 *
 * What it prints, and where each figure comes from:
 *
 *   A. operations by kind      generation_operations — count, terminal statuses,
 *                               wall-clock createdAt→completedAt (median/p95/max),
 *                               credits charged and refunded. The wall is the
 *                               OPERATION's, which for a refine is the customer's
 *                               wait when dispatch is off and the render's life
 *                               when it is on.
 *   B. per day                  the same rows, by UTC day.
 *   C. failure classes          failed/partial operations by kind + errorCode,
 *                               failed refines by their customer-facing
 *                               sentence, and — since #111 — by their CLASS,
 *                               read off the refund row on `point_transactions`
 *                               through `refineRefundLedger.ts`. errorCode
 *                               collapses every refine failure to
 *                               INTERNAL_SERVER_ERROR and the variant row that
 *                               carries the class is swept with its candidate
 *                               (zero survive on production, all time) — but
 *                               the refund's own sentence sits on a money
 *                               ledger nothing purges. Seven classes share one
 *                               sentence, so that row reads as a named FAMILY
 *                               rather than as a guess between them.
 *                               Since patrol #2 it also reads the ROLL at SLICE
 *                               grain — one `generations` row per slice, its
 *                               class off `errorMessage`, cross-checked against
 *                               the refund ledger — and it NAMES the failures
 *                               whose errorCode a later Cast deletion erased,
 *                               so an erased reason is never read as an absent
 *                               one.
 *   D. candidates               casting_candidates by status + failureClass.
 *   E. face scans               casting_face_scans, split by geometry.scanned —
 *                               true is a PAID look (20 segmenter calls, $0.10);
 *                               false is a render-written carried-feature row.
 *   F. provider books           OpenRouter's own per-day activity (account-wide,
 *                               NOT per key — house courts and product traffic
 *                               share it) and fal traffic priced off our rows
 *                               through the rite's own readers (falSpend.mts).
 *   G. the shift process        cards landed per session and gate minutes per
 *                               card (#543 item 4) — `crew_shift_runs` joined
 *                               to GitHub's own PR and gate-run timestamps.
 *                               The ONLY section that needs the network beyond
 *                               a provider's books, so it prints UNREAD rather
 *                               than zeros when `gh` cannot answer.
 *
 * Every table carries its denominator. A window with no rows prints as such
 * rather than as zero. The census decomposition (per-stage seconds inside a
 * refine) is `scripts/call-census-report.mts` and is not repeated here.
 *
 * Two readings this script deliberately does NOT take, stated so the absence is
 * not read as a zero (doctrine entry 1): the roll's per-slice wall-clock (rolls
 * log their census rather than persist it — `readFalTraffic`'s own note), and
 * anything about the CLIENT — page load, interaction latency, the "laggy in
 * general" half of the charter. No instrument records the client today; the
 * ledger says so in words.
 */
import "dotenv/config";

import {
  classifyRefineRefundDescription,
  refineRefundReadingLabel,
} from "../server/castingV2/refineRefundLedger";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";
import { priceFalCalls, readFalPrices, readFalTraffic } from "./lib/falSpend.mts";
import { activityByDay, readOpenRouterActivity } from "./lib/openrouterBalance.mts";
import { readMergedPrs } from "./lib/mergedPrGateTime.mts";
import {
  type ShiftRunReading,
  attributePrsToSessions,
  renderLedgerBlock,
} from "./lib/shiftLedger.mts";
import { parseStrictArgsOrRefuse } from "./lib/strictArgs.mts";

/**
 * THIS FILE'S WHOLE VOCABULARY, DECLARED SO A WORD OUTSIDE IT REFUSES (#345).
 *
 * The reader here was `process.argv.indexOf("--" + name)`, which cannot fail on
 * a word it was never asked about. Nothing here spends and nothing here writes,
 * so the cost of a silently-discarded flag is a WRONG READING rather than a
 * charge — and this is the ledger the founder judges the team's own numbers on,
 * where a `--days 30` that was typed `--day 30` prints a confident fortnight
 * and says nothing.
 */
const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: ["days", "pr-limit"],
  boolean: [],
});
const arg = (name: string): string | undefined => ARGS.value(name) ?? undefined;
const days = Number(arg("days") ?? 14);
if (!Number.isFinite(days) || days <= 0) {
  console.error(`--days is not a positive number: ${arg("days")}`);
  process.exit(1);
}
// Section G's page bound. Sized from the window rather than fixed, because
// hitting it is a REFUSAL: at the team's measured ~13 merged PRs a day, a
// fixed 100 would have made the DEFAULT `--days 14` run refuse every time and
// then name a flag that did not exist (#559 review, finding 2). 50/day is ~4x
// headroom on the fastest week on record, and the flag is real.
const prLimit = Number(arg("pr-limit") ?? Math.max(100, Math.ceil(days * 50)));
if (!Number.isFinite(prLimit) || prLimit <= 0) {
  console.error(`--pr-limit is not a positive number: ${arg("pr-limit")}`);
  process.exit(1);
}
const since = new Date(Date.now() - days * 86_400_000);
const sinceIso = since.toISOString();

const url = resolveDatabaseUrl();
console.log(`MACHINIST READING — ${new Date().toISOString()}`);
console.log(`  world: ${worldOf(url)}   window: last ${days}d (since ${sinceIso})\n`);
const db = await openDatabase(url);
const q = async (sql: string, params: unknown[] = []) => (await db.query(sql, params))[0] as any[];

const quantile = (xs: number[], p: number): number => {
  if (xs.length === 0) return Number.NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
};
const secs = (ms: number) => (Number.isNaN(ms) ? "  n/a" : `${(ms / 1000).toFixed(0).padStart(5)}s`);
const day = (value: unknown) => new Date(value as string).toISOString().slice(0, 10);
const wallOf = (row: any) => new Date(row.completedAt).getTime() - new Date(row.createdAt).getTime();

// ── A. operations by kind ─────────────────────────────────────────────
const ops = await q(
  `SELECT kind, status, createdAt, completedAt, chargedCredits, refundedCredits
     FROM generation_operations WHERE createdAt >= ? ORDER BY createdAt`,
  [since],
);
console.log(`A. generation_operations — ${ops.length} rows in window`);
const byKind = new Map<string, any[]>();
for (const op of ops) (byKind.get(op.kind) ?? byKind.set(op.kind, []).get(op.kind)!).push(op);
console.log(
  "   kind".padEnd(31) + "n".padStart(4) + "  statuses".padEnd(44) + "timed".padStart(6)
  + " median    p95    max" + "  charged refunded",
);
for (const [kind, rows] of [...byKind.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const statuses = new Map<string, number>();
  for (const row of rows) statuses.set(row.status, (statuses.get(row.status) ?? 0) + 1);
  const timed = rows.filter((row) => row.completedAt && row.createdAt).map(wallOf).filter((ms) => ms >= 0);
  const charged = rows.reduce((total, row) => total + Number(row.chargedCredits ?? 0), 0);
  const refunded = rows.reduce((total, row) => total + Number(row.refundedCredits ?? 0), 0);
  const statusText = [...statuses.entries()].map(([k, v]) => `${k}:${v}`).join(" ");
  console.log(
    `   ${kind}`.padEnd(31) + String(rows.length).padStart(4) + "  " + statusText.padEnd(42)
    + String(timed.length).padStart(6) + secs(quantile(timed, 0.5)) + " " + secs(quantile(timed, 0.95))
    + " " + secs(quantile(timed, 1)) + "  " + String(charged).padStart(7) + " " + String(refunded).padStart(8),
  );
}
if (ops.length === 0) console.log("   (no operations in the window)");

// ── B. per day ────────────────────────────────────────────────────────
console.log(`\nB. per UTC day — operations, credits charged, credits refunded`);
const byDay = new Map<string, { n: number; charged: number; refunded: number }>();
for (const op of ops) {
  const bucket = byDay.get(day(op.createdAt)) ?? { n: 0, charged: 0, refunded: 0 };
  bucket.n += 1;
  bucket.charged += Number(op.chargedCredits ?? 0);
  bucket.refunded += Number(op.refundedCredits ?? 0);
  byDay.set(day(op.createdAt), bucket);
}
for (const [d, b] of [...byDay.entries()].sort()) {
  console.log(`   ${d}  ops ${String(b.n).padStart(4)}  charged ${String(b.charged).padStart(6)}  refunded ${String(b.refunded).padStart(5)}`);
}
const refines = (byKind.get("castingV2.refine") ?? []).filter((row) => row.completedAt);
const over305 = refines.filter((row) => wallOf(row) > 305_000).length;
console.log(`   castingV2.refine completed past the ~305s gateway wall: ${over305} of ${refines.length}`);

// ── C. failure classes ────────────────────────────────────────────────
console.log(`\nC. failed / partial operations by kind + errorCode`);
const failures = await q(
  `SELECT kind, status, errorCode, COUNT(*) AS n, SUM(refundedCredits) AS refunded
     FROM generation_operations
    WHERE createdAt >= ? AND status IN ('failed','partial')
    GROUP BY kind, status, errorCode ORDER BY n DESC`,
  [since],
);
for (const row of failures) console.log(`   ${String(row.n).padStart(4)}  ${row.kind}/${row.status}  ${row.errorCode ?? "-"}  refunded ${row.refunded}`);
if (failures.length === 0) console.log("   (none)");
console.log(`   failed refines by customer-facing sentence (lossy — the generic line covers several classes):`);
const refineFailures = await q(
  `SELECT LEFT(publicMessage, 72) AS msg, COUNT(*) AS n, SUM(refundedCredits) AS refunded
     FROM generation_operations
    WHERE createdAt >= ? AND kind = 'castingV2.refine' AND status = 'failed'
    GROUP BY msg ORDER BY n DESC`,
  [since],
);
for (const row of refineFailures) console.log(`   ${String(row.n).padStart(4)}  refunded ${String(row.refunded).padStart(4)}  ${row.msg}`);
if (refineFailures.length === 0) console.log("   (none)");

/*
  THE CLASS, OFF THE MONEY LEDGER (#111 item 1, 2026-08-29).

  Patrol #1 recorded that the failure class survives only in `publicMessage`
  prose once the variant row is purged. The variant half is worse than that —
  `casting_candidate_variants.failureClass` is non-null on ZERO production rows,
  all time — but the conclusion was wrong, because the REFUND already writes the
  class down on `point_transactions`, which nothing purges. So this is the
  reading the card asked for, and it is derived rather than parsed: the sentence
  is composed and classified by one vocabulary (`refineRefundLedger.ts`).

  Three answers, and the middle one is why this is not a tally of classes: seven
  classes share the fallback sentence, so `family` says the record cannot tell
  them apart. Folding that into `unknown` would be a precision the ledger does
  not have — and `unknown` is one of the seven, so the lie would look right.
*/
console.log(`   failed refines by CLASS, read off the refund on the money ledger:`);
const refunds = await q(
  `SELECT t.description AS description, COUNT(*) AS n, SUM(t.amount) AS credits
     FROM generation_operations o
     JOIN point_transactions t
       ON t.referenceId = CONCAT('refund:op:', o.id, ':charge') AND t.type = 'refund'
    WHERE o.createdAt >= ? AND o.kind = 'castingV2.refine' AND o.status = 'failed'
    GROUP BY description ORDER BY n DESC`,
  [since],
);
const byClass = new Map<string, { n: number; credits: number }>();
for (const row of refunds) {
  const label = refineRefundReadingLabel(classifyRefineRefundDescription(String(row.description ?? "")));
  const seen = byClass.get(label) ?? { n: 0, credits: 0 };
  byClass.set(label, { n: seen.n + Number(row.n), credits: seen.credits + Number(row.credits) });
}
const classified = [...byClass.entries()].sort((a, b) => b[1].n - a[1].n);
for (const [label, totals] of classified) {
  console.log(`   ${String(totals.n).padStart(4)}  refunded ${String(totals.credits).padStart(4)}  ${label}`);
}
if (classified.length === 0) console.log("   (none)");
/* The denominator, said out loud: a failed refine with no refund row is not a
   gap in this reader, it is a refine that refunded nothing (a CONFLICT costs
   the customer nothing and correctly has no ledger row). */
const refundedFailures = refunds.reduce((total, row) => total + Number(row.n), 0);
const failedRefines = refineFailures.reduce((total, row) => total + Number(row.n), 0);
console.log(`   denominator: ${refundedFailures} of ${failedRefines} failed refines carry a refund row`);

/*
  THE ROLL'S LOST SLICES — and the class was already written down (patrol #2).

  Patrol #1 read the roll only at the OPERATION, where a roll that lost one
  slice of eight and a roll that lost seven both read as the single word
  `partial`. That is the wrong grain for the only question worth asking about a
  roll: how many of the pictures the customer paid for actually arrived.

  It is also why the roll's failures looked unclassifiable. They are not. Every
  slice writes a `generations` row bound to its operation, `rollService.ts`
  writes the computed `failureClass` into that row's `errorMessage` on the
  failure path — and `generations` is purged only by account or Cast deletion,
  so unlike `casting_candidates` (swept) and `casting_candidate_variants`
  (failureClass non-null on zero rows, all time) it is still there weeks later.
  The ledger had been buying that signal and throwing it away, which is the
  disappearing-technology law's clause 4 pointed at our own instrument.

  Two things this deliberately does NOT do:

  - It does not divide `chargedCredits` by a per-slice price to get a
    denominator. The row count IS the denominator, and it needs no constant that
    could drift. (Measured the day it was written: 248 rows against 31 rolls in
    the window, and 1,896 against 237 over 60 days — exactly eight per roll,
    with nothing assumed.)
  - It does not fold `processing` into `failed`. A slice stranded mid-flight on
    an operation that died is a different event from a slice the engine refused,
    it is refunded by a different road (the recovery sweep, not `failCandidate`),
    and collapsing them would hide whichever one grew.

  ⚠ AND THE ROW COUNT SURVIVES A CAST DELETION ONLY BY AN ACCIDENT WORTH
  NAMING. `finalCastDeletion.ts` scrubs `generations` too — it NULLs
  `errorMessage` AND `operationId` on every row carrying the deleted `modelId`,
  which would erase the class and break the very JOIN below. Roll slices escape
  because `createGeneration` writes them with NO `modelId` (`rollService.ts`, the
  `variation:` step), so the `where(eq(generations.modelId, …))` never matches
  them. That is a property of the writer, not a guarantee of the reader: a slice
  that ever starts carrying a `modelId` disappears from this reading silently and
  the totals below simply get smaller. Section C's fence line names the same
  scrub on the OPERATION side; this is its other half.

  ⚠ THE POPULATION IS BOTH PAID SLICE ROADS, NOT JUST THE ROLL. A RETRY IS A
  SEPARATELY PAID PICTURE and it settles through the SAME writer: `retryService`
  calls `dispatchCandidate` with the retry's own `operationId`, so a retried tile
  writes its own `generations` row and, when it fails, refunds under the very
  sentences counted below. Reading `castingV2.roll` alone would drop a paid
  picture that arrived nowhere out of the headline and a delivered one out of
  "arrived" — while still counting its refund on the ledger side, which
  manufactures a disagreement out of a healthy window. Both kinds are read, each
  on its own line, so the two sides describe the same population.

  The money ledger is printed beside it as a SECOND READER that shares no
  resolver with the first. ⚠ BUT A DIFFERENCE IS NOT AUTOMATICALLY A DEFECT, and
  saying so was this block's own first mistake — the same over-claim shape the
  run above was written to catch. THREE benign populations still make the two
  counts differ on a perfectly healthy window:

    1. a slice with `pointsCost <= 0`, or one whose refund failed to record
       (`refundUnrecorded`), is a real loss with no refund row at all;
    2. a roll or retry IN FLIGHT at read time has unfinished slices that nothing
       has had a chance to refund yet — so slices whose OPERATION is still live
       (`claimed`/`running`) are reported as in flight and kept OUT of the "did
       not arrive" figure;
    3. the two tables are windowed on their own `createdAt`, so a slice near the
       boundary can fall inside while its refund falls outside.

  So the line says AGREES or reports the difference and names what can cause it.
  Only (1) is a finding, and only after (2) and (3) are ruled out by hand.

  ⚠ TWO EARLIER SHORTFALLS IN THIS SAME LIST ARE KEPT AS THE REASON IT IS
  DERIVED FROM THE WRITERS RATHER THAN REMEMBERED. The first draft counted ONE
  refund sentence and missed the `render_fault` line; the second counted two and
  missed the RETRY ROAD, which flows through the shared writer under the same
  sentence. Both survived a driven control for the same reason — neither
  population had occurred in the measured windows — and both were found by
  enumerating the call sites of `recordRefund` on the slice path instead. **Every
  sentence below is quoted from its writer, and a new refund sentence on that
  path belongs in this list in the same commit.**
*/
/*
  ⚠ IN FLIGHT IS THE OPERATION'S OWN STATE, NOT THE SLICE ROW'S AGE.

  The first shape of this asked whether the slice row was younger than a
  six-minute constant — lease (5 min) plus one sweep pass (60s), the window
  before a DEAD operation's slices become eligible for refund at all. That
  constant answers the wrong question. A LIVE operation renews its lease every 30
  seconds indefinitely and so never becomes eligible however long it runs:
  CLAUDE.md's own sentence is that the lease "only ever governed how long a DEAD
  one kept its rows non-terminal". §A of this run measures roll p95 at 343s and a
  60-day max of 1,495s — so a reading taken beside a live long roll would have
  folded up to eight of its slices into "did NOT arrive" and printed a false
  disagreement beside them.

  `generation_operations.status` records the answer directly, and this query
  already joins that row. `claimed`/`running` is a settlement that has not
  happened yet. (`recovery_required` is deliberately NOT in flight: it is a
  parked failure waiting on support, which is a loss the customer is still
  carrying.) Clause 4 of the disappearing-technology law pointed at this
  instrument a third time in one sitting — a constant standing in for a signal
  the engine already writes down.
*/
console.log(`   PAID SLICES (roll + retry) — one generations row per slice, bound to its operation:`);
const slices = await q(
  `SELECT o.kind AS kind, g.status AS status, g.errorMessage AS errorMessage,
          COUNT(*) AS n,
          SUM(o.status IN ('claimed', 'running')) AS live
     FROM generations g
     JOIN generation_operations o ON o.id = g.operationId
    WHERE g.createdAt >= ? AND o.kind IN ('castingV2.roll', 'castingV2.retry')
    GROUP BY o.kind, g.status, g.errorMessage ORDER BY n DESC`,
  [since],
);
const sliceTotal = slices.reduce((total, row) => total + Number(row.n), 0);
const sum = (rows: any[], field: "n" | "live" = "n") =>
  rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
/*
  ⚠ THE EMPTY CASE STILL RUNS THE CROSS-CHECK, and that is the whole point of
  having one. An earlier shape printed "(none in window)" and returned — so a
  reading whose slice population had collapsed to zero while the money ledger
  held refunds said NOTHING, which is the exact failure the cross-check exists to
  catch and the loudest form of it. Found by driving the kind-filter control on
  PR #533: dropping `castingV2.roll` emptied the population and the reader went
  quiet with 28 unexplained refunds sitting beside it.
*/
const arrived = sum(slices.filter((row) => row.status === "completed"));
const refused = sum(slices.filter((row) => row.status === "failed"));
/* Neither `completed` nor `failed` — a slice still `pending`/`processing`.
   `failed` is terminal and is never "in flight" however fresh the row is. */
const unfinished = slices.filter((row) => row.status !== "completed" && row.status !== "failed");
/* (2) above: a slice whose OPERATION is still live has not failed to be
   refunded, it has not settled yet. It is reported, never counted. */
const inFlight = sum(unfinished, "live");
const stranded = sum(unfinished) - inFlight;
if (sliceTotal === 0) {
  console.log("   (no paid slices in window — the cross-check below still runs)");
} else {
  const pct = (n: number) => `${((n / sliceTotal) * 100).toFixed(1)}%`;
  console.log(
    `   ${sliceTotal} slices paid for · ${arrived} arrived · ${refused} failed (${pct(refused)}) · ` +
      `${stranded} stranded mid-flight (${pct(stranded)}) — did NOT arrive: ${refused + stranded} (${pct(refused + stranded)})` +
      (inFlight > 0 ? ` · ${inFlight} still in flight (their operation is live, not counted)` : ""),
  );
  for (const row of slices.filter((r) => r.status !== "completed")) {
    /* The in-flight annotation belongs only to UNFINISHED rows. A `failed` slice
       is terminal even while its operation is still finishing the other seven,
       and labelling it "still in flight" would be the reader lying about a
       settled outcome — a defect this row shape actually produced under its own
       control run before the filter was added. */
    const live = row.status === "failed" ? 0 : Number(row.live ?? 0);
    console.log(
      `     ${String(row.n).padStart(4)}  ${row.kind.replace("castingV2.", "")}  ${row.status}  ` +
        `class ${row.errorMessage ?? "(none recorded)"}` +
        (live > 0 ? `  (${live} of them still in flight)` : ""),
    );
  }
}
{
  /*
    The second reader. Same event, different table, no shared resolver — and
    EVERY refund sentence on the slice path, each quoted from its writer:

      "Casting candidate did not arrive"      rollService (roll AND retry, the
                                              shared dispatch) + rollRecovery
      "This tile came back as a contact …"    rollService, the render_fault exit
      "Casting retry landed nowhere"          retryService, the landed-nowhere exit
      "Casting retry did not arrive (recov…)" retryRecovery

    Counting a subset of these is not a smaller reading, it is a WRONG one: it
    manufactures a disagreement out of a healthy window. Two drafts of this list
    did exactly that (PR #533's two review rounds).
  */
  const arrivalRefunds = await q(
    `SELECT description, COUNT(*) AS n, SUM(amount) AS credits FROM point_transactions
      WHERE createdAt >= ? AND type = 'refund'
        AND description IN ('Casting candidate did not arrive',
                            'This tile came back as a contact sheet rather than a portrait',
                            'Casting retry landed nowhere',
                            'Casting retry did not arrive (recovered)')
      GROUP BY description ORDER BY n DESC`,
    [since],
  );
  const ledgerSays = sum(arrivalRefunds);
  const ledgerCredits = arrivalRefunds.reduce((total, row) => total + Number(row.credits ?? 0), 0);
  const difference = ledgerSays - (refused + stranded);
  console.log(
    `     cross-check on the money ledger (every slice-refund sentence, roll and retry): ${ledgerSays} refunds ` +
      `for ${ledgerCredits} credits — ` +
      (difference === 0
        ? "AGREES"
        : `DIFFERS BY ${difference > 0 ? "+" : ""}${difference}. Benign causes first: a zero-cost or ` +
          "unrecorded refund, a slice still in flight at read time, or one whose refund fell the " +
          "other side of the window boundary. A difference is a finding only once those are ruled " +
          "out by hand."),
  );
  for (const row of arrivalRefunds) {
    console.log(`       ${String(row.n).padStart(4)}  ${row.credits} cr  "${row.description}"`);
  }
}

/*
  THE FENCE, NAMED SO IT IS NEVER READ AS AN UNEXPLAINED FAILURE (patrol #2).

  A permanent Cast deletion scrubs every PRIOR operation on that Cast — modelId,
  result, errorCode, publicMessage all to NULL, `subjectDeletedAt` stamped
  (`finalCastDeletion.ts`, the R7-5 replay fence). It does not touch `status`.
  So a delete that failed and was then retried successfully leaves a `failed`
  row with no code and no message, and section C above prints it as a failure
  nobody can explain — which is exactly how 14 of 60 `model.delete` rows read on
  production, every one of them fenced, none of the 46 successes fenced.

  The reason is not lost knowledge, it is erased knowledge, and the difference
  matters: nothing here can be recovered by reading harder.
*/
const fenced = await q(
  `SELECT kind, COUNT(*) AS n FROM generation_operations
    WHERE createdAt >= ? AND status IN ('failed','partial') AND subjectDeletedAt IS NOT NULL
    GROUP BY kind ORDER BY n DESC`,
  [since],
);
if (fenced.length > 0) {
  const fencedTotal = fenced.reduce((total, row) => total + Number(row.n), 0);
  console.log(
    `   of the failures above, ${fencedTotal} carry the deletion replay fence (subjectDeletedAt) — ` +
      `their errorCode was ERASED by a later successful deletion of the same Cast, not never written:`,
  );
  for (const row of fenced) console.log(`     ${String(row.n).padStart(4)}  ${row.kind}`);
}

// ── D. candidates ─────────────────────────────────────────────────────
const candidates = await q(
  `SELECT status, failureClass, COUNT(*) AS n FROM casting_candidates
    WHERE createdAt >= ? GROUP BY status, failureClass ORDER BY n DESC`,
  [since],
);
const candidateTotal = candidates.reduce((total, row) => total + Number(row.n), 0);
console.log(`\nD. casting_candidates in window: ${candidateTotal} (rows are written at claim; expired rows are purged, so this is what SURVIVES)`);
for (const row of candidates) console.log(`   ${String(row.n).padStart(5)}  ${row.status}  ${row.failureClass ?? "-"}`);

// ── E. face scans ─────────────────────────────────────────────────────
const scans = await q(
  `SELECT createdAt, JSON_EXTRACT(geometry, '$.scanned') AS scanned
     FROM casting_face_scans WHERE createdAt >= ?`,
  [since],
);
// Three shapes of row, read at the key rather than by subtraction (gate review of
// PR #112, finding 3 — and the subtraction was wrong on the first run: 27 rows it
// filed as render-written held no `scanned` key at all). `scanned: true` is a scan
// written or rewritten since a010923d (2026-08-23); NO key is a scan written before
// that commit and never rewritten — "absent means true", the rule the only reader
// applies (`keptFaceScan.ts`, the `scanned === false` door); `scanned: false` is the
// render's carried-geometry row, which nothing has ever served as a reading.
const scannedOf = (row: any) => (row.scanned === null || row.scanned === undefined ? "absent" : String(row.scanned));
const paidScans = scans.filter((row) => scannedOf(row) === "true").length;
const legacyScans = scans.filter((row) => scannedOf(row) === "absent").length;
const renderWritten = scans.filter((row) => scannedOf(row) === "false").length;
const unlabelledScans = scans.length - paidScans - legacyScans - renderWritten;
const paidLooks = paidScans + legacyScans;
const allTime = await q(`SELECT COUNT(*) AS n, COUNT(DISTINCT candidateId) AS faces, SUM(JSON_CONTAINS_PATH(geometry, 'one', '$.carried')) AS withCarried FROM casting_face_scans`);
console.log(`
E. casting_face_scans in window: ${scans.length} rows — ${paidLooks} paid looks (20 reads / $0.10 each = $${(paidLooks * 0.1).toFixed(2)}; ${paidScans} scanned:true + ${legacyScans} written before the key existed), ${renderWritten} render-written (scanned:false)${unlabelledScans > 0 ? `, ${unlabelledScans} UNLABELLED (a value this reader does not know)` : ""}`);
console.log(`   all time: ${allTime[0].n} rows over ${allTime[0].faces} faces; rows holding carried geometry (the render's writer, a010923d): ${allTime[0].withCarried}`);
const scanDays = new Map<string, number>();
for (const row of scans) scanDays.set(day(row.createdAt), (scanDays.get(day(row.createdAt)) ?? 0) + 1);
for (const [d, n] of [...scanDays.entries()].sort()) console.log(`   ${d}  ${n}`);

// ── F. provider books ─────────────────────────────────────────────────
console.log(`\nF. provider books`);
const activity = await readOpenRouterActivity();
if (!activity.ok) {
  console.log(`   openrouter activity UNREAD — ${activity.why}`);
} else {
  const sinceDay = sinceIso.slice(0, 10);
  const perDay = activityByDay(activity.rows).filter((row) => row.date >= sinceDay).sort((a, b) => a.date.localeCompare(b.date));
  let total = 0;
  console.log(`   OpenRouter, the provider's own books by UTC day — ACCOUNT-WIDE (house courts and product traffic share one account; a spike is usually a court):`);
  for (const row of perDay) {
    total += row.usd;
    console.log(`   ${row.date}  $${row.usd.toFixed(2).padStart(7)}  ${String(row.requests).padStart(6)} req  ${row.models.join(", ")}`);
  }
  console.log(`   TOTAL $${total.toFixed(2)} over ${perDay.length} day(s) with activity`);
}
const traffic = await readFalTraffic(db, sinceIso);
const prices = await readFalPrices(traffic.models.map((model) => model.model));
const priced = priceFalCalls(traffic.models, prices);
console.log(`   fal, off OUR rows ${traffic.from.slice(0, 10)} → ${traffic.to.slice(0, 10)}: refine rows ${traffic.refineRows} (${traffic.refineRowsWithCensus} with census) · roll renders ${traffic.rollRenders}`);
for (const model of priced.models) {
  const usd = model.usd === null ? "UNPRICED" : `$${model.usd.toFixed(2)}`;
  console.log(`   ${usd.padStart(9)}  ${String(model.calls).padStart(5)} calls  ${model.model}  [${model.basis}] ${model.note}`);
}
console.log(`   fal priced total $${priced.usd.toFixed(2)} (unpriced models: ${priced.unpriced.length}) — refine rows are the SURVIVING ones, so this is a floor`);

// ── G. the shift process ──────────────────────────────────────────────
// #543 item 4, founder-ordered. Two numbers, derived at every ledger run from
// `crew_shift_runs` joined to GitHub's own PR timestamps: CARDS LANDED PER
// SESSION and GATE MINUTES PER CARD. They are the verdict on the overlap +
// preflight design this card built, and the card's own words are that they
// belong in a tracked reader rather than the investigation's disposable.
//
// ⚠ IT IS UNREAD, NEVER ZERO, WHEN `gh` CANNOT ANSWER. The rest of this ledger
// reads production's own rows; this section needs GitHub, so an unauthenticated
// or absent `gh` must print as an absence and never as a clean set of figures
// (doctrine entry 1).
console.log("");
// ⚠ Runs OVERLAPPING the window, not runs STARTING inside it (#559 review,
// finding 3). A shift that began just before `since` and merged a PR just
// after it would otherwise be absent from the sessions while its PR sat in
// the merged-PR window — filed as unattributed under a printed explanation
// that is wrong for that case, so a boundary artifact would read as a
// recurring anomaly.
const shiftRuns = (await q(
  `SELECT id, shift, seat, startedAt, endedAt, outcome
     FROM crew_shift_runs WHERE endedAt >= ? OR endedAt IS NULL ORDER BY startedAt`,
  [since],
)).map<ShiftRunReading>((row) => ({
  id: Number(row.id),
  shift: String(row.shift),
  seat: String(row.seat),
  startedAt: new Date(row.startedAt).toISOString(),
  endedAt: row.endedAt ? new Date(row.endedAt).toISOString() : null,
  outcome: row.outcome === null || row.outcome === undefined ? null : String(row.outcome),
}));

const mergedPrs = readMergedPrs(sinceIso, { limit: prLimit });
if (!mergedPrs.ok) {
  console.log(`G. THE SHIFT PROCESS — UNREAD: ${mergedPrs.why}`);
  console.log(`   (${shiftRuns.length} shift run(s) in the window were read; the GitHub half is what failed.)`);
} else {
  console.log(
    renderLedgerBlock(
      attributePrsToSessions(shiftRuns, mergedPrs.prs),
      `last ${days}d, since ${sinceIso.slice(0, 10)}`,
    ),
  );
}

await db.end();

/* Both script guards want the process ended here, not left to the loop. */
process.exit(0);
