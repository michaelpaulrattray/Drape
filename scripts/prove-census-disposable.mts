/**
 * THE CENSUS'S POSITIVE CONTROL — one real paid edit on DEV, then read it back.
 *
 * The reader printed "no row carries a census", which is true and is exactly
 * the shape of a null result that proves nothing: a fixture that could not have
 * produced a non-null. So this buys ONE real refine on the dev database — real
 * interpreter, real segmenter, real painter — and then the report is run again.
 *
 * If a census does not appear after this, the wiring is wrong and every future
 * "the product is cheap this week" reading would have been a lie.
 *
 * Cost: 25 dev credits and about ten cents of house money. Dev only — it refuses
 * under the production wrapper.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";

import { openDatabase } from "./lib/dbConnection.mts";
import { refineCandidate } from "../server/castingV2/refineService";

if (process.env.MYSQL_PUBLIC_URL) throw new Error("dev only");

const USER = Number(process.env.USER_ID ?? 1);
const db = await openDatabase(process.env.DATABASE_URL!);
const [rows] = await db.query<any[]>(
  `SELECT publicId FROM casting_candidates
    WHERE userId = ? AND status = 'ready' AND imageKey IS NOT NULL
    ORDER BY id DESC LIMIT 1 OFFSET ${Number(process.env.FACE_OFFSET ?? "0")}`,
  [USER],
);
if (rows.length === 0) throw new Error("no ready candidate on dev");
const face = rows[0].publicId;

const before = (await db.query<any[]>(
  "SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS net FROM point_transactions WHERE userId = ?",
  [USER],
))[0][0];

console.log(`face ${face} · ledger before: ${before.n} rows, net ${before.net}`);
const startedAt = Date.now();
try {
  const result = await refineCandidate({}, {
    userId: USER,
    clientRequestId: randomUUID(),
    candidatePublicId: face,
    instruction: process.env.ASK ?? "make her lips a little fuller",
  });
  console.log(`delivered in ${((Date.now() - startedAt) / 1000).toFixed(1)}s · ${result.imageUrl.slice(0, 60)}…`);
} catch (error) {
  console.log(`refused after ${((Date.now() - startedAt) / 1000).toFixed(1)}s: ${error instanceof Error ? error.message : String(error)}`);
}

const after = (await db.query<any[]>(
  "SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS net FROM point_transactions WHERE userId = ?",
  [USER],
))[0][0];
console.log(`ledger after: ${after.n} rows, net ${after.net} (spent ${before.net - after.net})`);
await db.end();
process.exit(0);
