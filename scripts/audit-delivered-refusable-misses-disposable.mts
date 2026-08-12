/**
 * DELIVERED, CHARGED — AND ITS OWN READER SAID THE ASKED THING WAS MISSING.
 *
 * Shift 61's walk found one on a paid render: step 2 stored
 * `binding:true, absent:true, verified:false` with `readings:1` and was
 * delivered. `confirmVerdict` reaches `readings:1` past a read binding miss
 * through exactly one line — "no second opinion — delivering rather than
 * refusing" — so the class is "the confirming re-read was unavailable and the
 * house kept the money".
 *
 * This asks how wide the class is, in whichever world it is pointed at. It
 * reads only what is already stored on the row: `internalPrompt.verification`.
 *
 * Read-only: one SELECT. No writes, no credits, no vision calls.
 *
 * CONTROLLED, because "no rows" and "the reader cannot see rows" look the same:
 *   POSITIVE  v#166 (dev) is the known specimen and MUST be flagged when this
 *             runs against dev; against production the control is the count of
 *             rows carrying a parsed verification at all — a reader that parses
 *             nothing would report a clean world.
 *   NEGATIVE  v#165 (dev), delivered with its binding facet verified, must NOT
 *             be flagged.
 *
 *   npx tsx scripts/audit-delivered-refusable-misses-disposable.mts
 *   railway.cmd run --service MySQL -- npx tsx scripts/audit-delivered-refusable-misses-disposable.mts
 */
import "dotenv/config";

import { openDatabase, utc } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const connection = await openDatabase(process.env[key]!);
const [rows] = await connection.query<any[]>(
  `SELECT id, publicId, userId, candidateId, requestText, status, pointsCost, createdAt, internalPrompt
     FROM casting_candidate_variants
    WHERE status = 'ready' AND createdAt >= '2026-08-01 00:00:00'
    ORDER BY id`,
);

type Check = {
  facet?: string; asked?: string; saw?: string;
  read?: boolean; verified?: boolean; binding?: boolean;
  absent?: boolean; occluded?: boolean; absenceIsTheAsk?: boolean;
};

/** The product's own predicate, copied so the audit does not import the app. */
const isMiss = (c: Check): boolean => c.read === true && c.verified !== true && c.occluded !== true;
const isRefusableMiss = (c: Check): boolean => {
  if (!isMiss(c) || c.binding !== true) return false;
  if (c.absenceIsTheAsk === true) return true;
  return c.absent !== false;
};

let withVerification = 0;
const flagged: any[] = [];
for (const row of rows) {
  let prompt: any = row.internalPrompt;
  if (typeof prompt === "string") { try { prompt = JSON.parse(prompt); } catch { prompt = null; } }
  const verification = prompt?.verification;
  const checks: Check[] = Array.isArray(verification?.checks) ? verification.checks : [];
  if (!verification || checks.length === 0) continue;
  withVerification += 1;
  const misses = checks.filter(isRefusableMiss);
  if (misses.length === 0) continue;
  flagged.push({ row, readings: verification.readings ?? null, attempts: verification.attempts ?? null, misses });
}

console.log("=".repeat(96));
console.log(`DELIVERED WITH A REFUSABLE MISS — world ${key}`);
console.log("=".repeat(96));
console.log(`\nCONTROL  ${rows.length} ready row(s) since 2026-08-01; ${withVerification} carry a parsed verification`);
console.log(`         (a reader that could parse none of them would report a clean world)`);
const negative = flagged.find((f) => f.row.id === 165);
console.log(`CONTROL  NEGATIVE — v#165, delivered with its binding facet verified: ${negative ? "FLAGGED (wrong)" : "not flagged"}`);
const positive = flagged.find((f) => f.row.id === 166);
console.log(`CONTROL  POSITIVE — v#166, the known dev specimen: ${positive ? "flagged" : "not flagged (dev only)"}`);

console.log(`\n${flagged.length} delivered row(s) carry a miss that WOULD have refused:\n`);
for (const entry of flagged) {
  const { row } = entry;
  console.log("-".repeat(96));
  console.log(`v#${row.id}  ${utc(row.createdAt)}  user ${row.userId}  cand ${row.candidateId}  charged ${row.pointsCost}`);
  console.log(`   asked: ${row.requestText}`);
  console.log(`   readings ${entry.readings}  attempts ${entry.attempts}`);
  for (const miss of entry.misses) {
    console.log(`   MISS  ${miss.facet}  absent=${miss.absent ?? "—"}  binding=${miss.binding}`);
    console.log(`         asked: ${miss.asked}`);
    console.log(`         saw:   ${miss.saw ?? "— (no evidence)"}`);
  }
}

const byReadings = new Map<string, number>();
for (const entry of flagged) {
  const k = String(entry.readings);
  byReadings.set(k, (byReadings.get(k) ?? 0) + 1);
}
console.log("\n" + "=".repeat(96));
console.log(`by readings: ${Array.from(byReadings.entries()).map(([k, v]) => `${k} reading(s): ${v}`).join(" · ") || "—"}`);
console.log(`credits charged on flagged rows: ${flagged.reduce((sum, f) => sum + Number(f.row.pointsCost ?? 0), 0)}`);
await connection.end();
process.exit(0);
