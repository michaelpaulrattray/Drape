/**
 * SHIFT 81 §0 — claim the +50 dev gross (fable-439 §2).
 *
 * The windowed dev ledger reads 1,645 gross at shift 80's close. opus-322's
 * baseline was 1,495 and opus-333's walk adds exactly +100 / −50 → 1,595.
 * Rows 447 (15:50:18Z) and 448 (15:53:52Z), two refine charges of 25 with no
 * refund, are claimed by no shift line. This names them: op, candidate, ask,
 * outcome, and the tells that separate a browser from a harness.
 *
 * Read-only. Controlled both ways: a row that IS claimed (446, opus-333's
 * fourth step) is read by the same code first, so an absence below means the
 * reader can produce a presence.
 *
 *   npx tsx scripts/dev-ledger-claim6-disposable.mts        (dev .env)
 */
import "dotenv/config";

import { openDatabase, utc } from "./lib/dbConnection.mts";

const connection = await openDatabase();

const rows = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [result] = await connection.query<any[]>(sql, params);
  return result;
};

const [{ port, world }] = await rows(
  "SELECT DATABASE() AS world, @@port AS port",
).then((r) => (r.length ? r : [{ port: "?", world: "?" }]));
console.log(`world: ${world} (server port ${port}) — printed, not assumed`);
console.log(`url host: ${String(process.env.DATABASE_URL ?? "").replace(/\/\/[^@]*@/, "//***@")}`);

/* The three ops in question: 446 is the CONTROL (claimed by opus-333), 447 and
   448 are the unclaimed pair. */
const SUBJECTS = [
  { ledgerId: 446, op: "d5455c8d-4d27-4772-9604-0c2e5606f586", note: "CONTROL — claimed by opus-333" },
  { ledgerId: 447, op: "be13de6f-8c55-429f-822c-5721556c03c4", note: "UNCLAIMED" },
  { ledgerId: 448, op: "c5170968-0515-4948-9a83-dd517c4fb73e", note: "UNCLAIMED" },
];

const [columns] = await connection.query<any[]>("SHOW COLUMNS FROM generation_operations");
const names = columns.map((c: any) => c.Field);
console.log(`\ngeneration_operations columns: ${names.join(", ")}\n`);

for (const subject of SUBJECTS) {
  console.log("=".repeat(78));
  console.log(`ledger row ${subject.ledgerId} · op ${subject.op} · ${subject.note}`);
  console.log("=".repeat(78));
  const found = await rows("SELECT * FROM generation_operations WHERE id = ?", [subject.op]);
  if (found.length === 0) {
    console.log("  NO OPERATION ROW (reader proved live by the control above)");
    continue;
  }
  const operation = found[0];
  for (const key of names) {
    const value = operation[key];
    if (value === null || value === undefined) continue;
    const printed = value instanceof Date ? utc(value) : String(value);
    console.log(`  ${key.padEnd(26)} ${printed.slice(0, 300)}`);
  }
}

await connection.end();
process.exit(0);
