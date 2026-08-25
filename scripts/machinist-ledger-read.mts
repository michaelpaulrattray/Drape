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
 *   railway.cmd run --service MySQL -- npx tsx scripts/machinist-ledger-read.mts [--days 14]
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
 *                               and failed refines by their customer-facing
 *                               sentence — because errorCode collapses every
 *                               refine failure to INTERNAL_SERVER_ERROR and the
 *                               class survives only in publicMessage prose once
 *                               the variant row is purged.
 *   D. candidates               casting_candidates by status + failureClass.
 *   E. face scans               casting_face_scans, split by geometry.scanned —
 *                               true is a PAID look (20 segmenter calls, $0.10);
 *                               false is a render-written carried-feature row.
 *   F. provider books           OpenRouter's own per-day activity (account-wide,
 *                               NOT per key — house courts and product traffic
 *                               share it) and fal traffic priced off our rows
 *                               through the rite's own readers (falSpend.mts).
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

import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";
import { priceFalCalls, readFalPrices, readFalTraffic } from "./lib/falSpend.mts";
import { activityByDay, readOpenRouterActivity } from "./lib/openrouterBalance.mts";

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};
const days = Number(arg("days") ?? 14);
if (!Number.isFinite(days) || days <= 0) {
  console.error(`--days is not a positive number: ${arg("days")}`);
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
console.log(`   failed refines by customer-facing sentence (the only durable record of the class):`);
const refineFailures = await q(
  `SELECT LEFT(publicMessage, 72) AS msg, COUNT(*) AS n, SUM(refundedCredits) AS refunded
     FROM generation_operations
    WHERE createdAt >= ? AND kind = 'castingV2.refine' AND status = 'failed'
    GROUP BY msg ORDER BY n DESC`,
  [since],
);
for (const row of refineFailures) console.log(`   ${String(row.n).padStart(4)}  refunded ${String(row.refunded).padStart(4)}  ${row.msg}`);
if (refineFailures.length === 0) console.log("   (none)");

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

await db.end();
