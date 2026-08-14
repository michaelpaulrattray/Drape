/**
 * A FRESH SHEET OF DEV FACES, for courts that have used up the pond.
 *
 * Every candidate on this dev sheet now carries one of tonight's courts — horns,
 * copper hair, earrings, a beard — so the next court's specimens are somebody
 * else's experiment before it starts, and the already-true door refuses half its
 * steps. Fable authorised one fresh roll for specimen supply (fable-540 §3):
 * courts contaminating their own future specimens is a cost of running them on
 * one small pond, and fresh water is cheaper than a wrong verdict.
 *
 * Dev credits only (8 × 20 = 160) and about $0.80 of house money. The ledger is
 * read at both ends and printed.
 *
 *   npx tsx scripts/fresh-dev-faces-disposable.mts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";

import { openDatabase } from "./lib/dbConnection.mts";
import { createRoll } from "../server/castingV2/rollService";

if (process.env.MYSQL_PUBLIC_URL) throw new Error("dev only");

const USER = Number(process.env.USER_ID ?? 1);
const db = await openDatabase(process.env.DATABASE_URL!);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await db.query<any[]>(sql, params);
  return rows;
};

const before = (await query(
  "SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS net FROM point_transactions WHERE userId = ?",
  [USER],
))[0];

const [session] = await query(
  "SELECT publicId FROM casting_sessions WHERE userId = ? ORDER BY id DESC LIMIT 1",
  [USER],
);
if (!session) throw new Error("no casting session on dev");

/* A brief with nothing this month's courts touch: no earrings, no beard, no
   copper. The specimens have to be able to RECEIVE the edit under test. */
const BRIEF = process.env.BRIEF
  ?? "A woman in her thirties with dark brown hair worn simply, no jewellery, "
  + "a plain grey t-shirt, photographed against a plain studio wall.";

console.log(`rolling a fresh sheet on session ${session.publicId}`);
const started = Date.now();
const result = await createRoll({}, {
  userId: USER,
  clientRequestId: randomUUID(),
  sessionPublicId: session.publicId,
  briefText: BRIEF,
});
console.log(
  `roll ${result.rollPublicId} — ready ${result.ready}, failed ${result.failed}, `
  + `charged ${result.chargedCredits}, refunded ${result.refundedCredits}, `
  + `${((Date.now() - started) / 1000).toFixed(0)}s`,
);

const after = (await query(
  "SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS net FROM point_transactions WHERE userId = ?",
  [USER],
))[0];
console.log(`LEDGER: ${before.n} rows → ${after.n} rows · net ${before.net} → ${after.net}`);

const fresh = await query(
  `SELECT publicId FROM casting_candidates
    WHERE userId = ? AND status = 'ready' AND imageKey IS NOT NULL AND selectedVariantId IS NULL
    ORDER BY id DESC LIMIT 8`,
  [USER],
);
console.log(`untouched faces now available: ${fresh.length}`);
for (const row of fresh) console.log(`  ${row.publicId}`);

await db.end();
process.exit(0);
