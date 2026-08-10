/**
 * NAME THE ROW (fable-055).
 *
 * Shift 3 parked at 1,000; shift 4 read 1,050 and could source only 25 of the
 * difference. The ledger says gross crossed 1,000 at row 652 (11:16:19Z) and
 * row 653 landed at 11:18:51Z — so the candidate is a render that was IN FLIGHT
 * when the count was taken. This asks the operations table what 653 actually
 * was, so the pack's money section carries a named row rather than a difference.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/name-the-missing-25-disposable.mts
 */
import "dotenv/config";

import { openDatabase, utc } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL — run under `railway run --service MySQL`");

const OPERATIONS = [
  /* 653 — the unexplained 25. */
  "6bdcd493-abfa-45a2-84da-6cf564b7f478",
  /* 652 — the row shift 3's count DID include, for a boundary reading. */
  "f6aa7c75-e8cb-4b26-9650-ce5dc3bb99fc",
  /* 654 — shift 4's own paid render ("the caption governs"). */
  "121aca83-89ec-411c-a9a1-679afd140c90",
  /* 655–658 — run-13's four charges. */
  "5bb5e8c9-3ec2-4de7-ba32-ad0bff573b13",
  "c170c35c-02a9-4db6-a698-d604c95bf841",
  "358e2f5a-4ccd-414d-9aac-b7714fbb8b23",
  "8599774f-2770-41ab-8208-937d4d72a176",
];

const connection = await openDatabase(databaseUrl);
const [ops] = await connection.query<any[]>(
  `SELECT id, kind, status, createdAt, chargedCredits, refundedCredits, errorCode
     FROM generation_operations WHERE id IN (?)`,
  [OPERATIONS],
);
/* The user's OWN sentences — the only refinement text worth printing, and the
   thing that makes a row nameable rather than merely numbered. */
const [variants] = await connection.query<any[]>(
  `SELECT operationId, candidateId, publicId, status, instructions
     FROM casting_candidate_variants WHERE operationId IN (?)`,
  [OPERATIONS],
);
await connection.end();

const byId = new Map(ops.map((row) => [row.id, row]));
const variantOf = new Map(variants.map((row) => [row.operationId, row]));
for (const id of OPERATIONS) {
  const row = byId.get(id);
  if (!row) { console.log(`${id.slice(0, 8)}  — NO OPERATION ROW`); continue; }
  const variant = variantOf.get(id);
  const said = variant ? JSON.parse(JSON.stringify(variant.instructions)) : null;
  console.log(
    `${String(row.id).slice(0, 8)}  ${utc(row.createdAt)}  ${String(row.kind).padEnd(14)} `
    + `${String(row.status).padEnd(10)} charged ${String(row.chargedCredits).padStart(3)} `
    + `refunded ${String(row.refundedCredits).padStart(3)}  cand ${variant?.candidateId ?? "—"}  `
    + `${Array.isArray(said) ? JSON.stringify(said.slice(-2)) : "—"}`,
  );
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
