/**
 * THE RE-SCAN RATE, read back from rows instead of from a log window.
 *
 * The face scan is a courtesy read — around fourteen segmenter calls, roughly
 * seven cents of house money, spent so a panel can show a face nobody has
 * edited. It is cached in memory, and the design note promised the decision to
 * promote that cache to a TABLE would be "a reading rather than an anecdote".
 *
 * It could not be. The rate lived in a log line, and the log window rotates on
 * every deploy — a dozen of them on a working night. So the scan path now
 * writes one audit row per MISS (`casting.scan_miss`), carrying whether that
 * (candidate, version) pair had been read before in this process and how full
 * the cache was. A HIT writes nothing: a free answer is not worth a row, and
 * counting looks rather than reads would make the cache look worse at exactly
 * the moment it was working.
 *
 * What the number means:
 *
 *   re-scan rate   the share of paid scans that bought an answer this process
 *                  had already bought once. High = the memory cache is losing
 *                  work to deploys and evictions, and a table would pay for
 *                  itself. Near zero = the shortcut costs nothing and the
 *                  migration is not earned.
 *
 *   npx tsx scripts/scan-rate-report.mts                     # dev database
 *   railway.cmd run --service MySQL -- npx tsx scripts/…     # production
 *
 * Optional: --since 2026-08-14T12:53:00Z   (default: the last 7 days)
 *           --user 1
 *
 * NO PII. It reads the miss rows only, and those carry a candidate id and two
 * numbers — never a name, an email, or anything the scan read about her face.
 */
import "dotenv/config";

import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mjs";

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

const sinceRaw = arg("since");
const since = sinceRaw ? new Date(sinceRaw) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
if (Number.isNaN(since.getTime())) {
  console.error(`--since is not a date: ${sinceRaw}`);
  process.exit(1);
}
const userId = arg("user");

/*
  THE WORLD IS RESOLVED AND THEN NAMED, in that order and both out loud.

  `railway run --service MySQL` injects `MYSQL_PUBLIC_URL` and NO
  `DATABASE_URL`, so this script's own `dotenv` line would otherwise hand it the
  DEV database under the production command — silently, with the right heading
  over it. That is the reading it took the first time it was run tonight, and it
  is why `resolveDatabaseUrl` exists rather than an env expression here.
*/
const databaseUrl = resolveDatabaseUrl();
const db = await openDatabase(databaseUrl);

type Row = { createdAt: Date; userId: number | null; resourceId: string | null; metadata: unknown };

const [rows] = await db.query(
  `SELECT createdAt, userId, resourceId, metadata
     FROM audit_logs
    WHERE action = 'casting.scan_miss'
      AND createdAt >= ?
      ${userId ? "AND userId = ?" : ""}
    ORDER BY createdAt`,
  userId ? [since, Number(userId)] : [since],
);

/* mysql2 hands a JSON column back parsed or as a string depending on its mood
   (the same shape `verdictOf` guards against), and an unreadable one becomes NO
   reading rather than an invented `false`. */
const readMeta = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return null; }
  }
  return null;
};

const misses = rows as Row[];
let rescans = 0;
let unreadable = 0;
const perDay = new Map<string, { scans: number; rescans: number }>();
const perCandidate = new Map<string, number>();

for (const row of misses) {
  const meta = readMeta(row.metadata);
  if (meta === null) unreadable += 1;
  const rescan = meta?.rescan === true;
  if (rescan) rescans += 1;
  const day = row.createdAt.toISOString().slice(0, 10);
  const bucket = perDay.get(day) ?? { scans: 0, rescans: 0 };
  bucket.scans += 1;
  if (rescan) bucket.rescans += 1;
  perDay.set(day, bucket);
  const candidate = row.resourceId ?? "?";
  perCandidate.set(candidate, (perCandidate.get(candidate) ?? 0) + 1);
}

const rate = misses.length === 0 ? 0 : rescans / misses.length;
const SCAN_COST_USD = 0.07;

console.log(`\nTHE RE-SCAN RATE — since ${since.toISOString()}${userId ? ` · user ${userId}` : ""}`);
console.log(`  world: ${worldOf(databaseUrl)}   (dev is :52008, production is :23768)\n`);
if (misses.length === 0) {
  /*
    Zero rows is a real answer and it is stated as one. It means either that
    nobody has opened a panel in this window, or that the counter landed after
    it — and both of those are "not yet", never "the rate is zero".
  */
  console.log("  no scan-miss rows in this window — NOT a rate of zero, an unread window.");
  console.log("  (the counter shipped 2026-08-14; a window that starts before that is empty by construction)\n");
  await db.end();
  process.exit(0);
}

console.log(`  paid scans        ${misses.length}`);
console.log(`  of those, re-scans ${rescans}`);
console.log(`  RE-SCAN RATE      ${(rate * 100).toFixed(1)}%`);
console.log(`  wasted, roughly   $${(rescans * SCAN_COST_USD).toFixed(2)} of house money`);
if (unreadable > 0) console.log(`  unreadable rows   ${unreadable} (counted as scans, never as re-scans)`);

console.log("\n  BY DAY");
for (const [day, bucket] of [...perDay.entries()].sort()) {
  const share = bucket.scans === 0 ? 0 : bucket.rescans / bucket.scans;
  console.log(`    ${day}   ${String(bucket.scans).padStart(4)} scans   ${String(bucket.rescans).padStart(4)} re-scans   ${(share * 100).toFixed(1)}%`);
}

/* The faces read most often, because a rate is an average and a table would be
   paid for by the specific version somebody keeps coming back to. */
const worst = [...perCandidate.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log("\n  MOST-READ CANDIDATES");
for (const [candidate, count] of worst) console.log(`    candidate ${candidate}   ${count} scans`);

console.log(`
  WHAT DECIDES THE TABLE: a rate that stays high across a working week says the
  memory cache is losing paid work to deploys, and a \`casting_face_scans\` table
  would keep it. A rate near zero says the shortcut is fine and the migration is
  not earned. Neither verdict is taken from one day.
`);

await db.end();
/* A mysql connection keeps the event loop alive on this bench; the report is
   finished, so the process is too. */
process.exit(0);
