/**
 * SHIFT 81 §0, part two — what the two unclaimed ops ASKED, and on whom.
 *
 * The operation rows (claim6) say both are `castingV2.refine`, succeeded, 25
 * each, and that ledger 448 carries the SAME payloadHash as ledger 446 — the
 * control row opus-333 claims as its own fourth step. That equality is the
 * thread: a repeated payload is either the same walk stepping twice or a
 * second actor asking the same thing. This reads the variants the three ops
 * produced — candidate, version, ask — so the actor is named from what was
 * asked rather than inferred from a difference.
 *
 * Read-only.
 *   npx tsx scripts/dev-ledger-claim7-disposable.mts
 */
import "dotenv/config";

import { openDatabase, utc } from "./lib/dbConnection.mts";

const connection = await openDatabase();
const rows = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [result] = await connection.query<any[]>(sql, params);
  return result;
};

const OPS = [
  { ledgerId: 446, op: "d5455c8d-4d27-4772-9604-0c2e5606f586", note: "CONTROL — opus-333 step" },
  { ledgerId: 447, op: "be13de6f-8c55-429f-822c-5721556c03c4", note: "UNCLAIMED" },
  { ledgerId: 448, op: "c5170968-0515-4948-9a83-dd517c4fb73e", note: "UNCLAIMED (payloadHash == 446)" },
];

const [columns] = await connection.query<any[]>("SHOW COLUMNS FROM casting_candidate_variants");
const names = columns.map((c: any) => c.Field);
console.log(`variant columns: ${names.join(", ")}\n`);

for (const subject of OPS) {
  console.log("=".repeat(78));
  console.log(`ledger ${subject.ledgerId} · ${subject.note}`);
  console.log("=".repeat(78));
  const variants = await rows(
    "SELECT * FROM casting_candidate_variants WHERE operationId = ? ORDER BY id ASC",
    [subject.op],
  );
  if (variants.length === 0) {
    console.log("  no variant row");
    continue;
  }
  for (const variant of variants) {
    for (const key of names) {
      const value = variant[key];
      if (value === null || value === undefined) continue;
      const printed = value instanceof Date ? utc(value)
        : typeof value === "object" ? JSON.stringify(value)
          : String(value);
      console.log(`  ${key.padEnd(24)} ${printed.slice(0, 600)}`);
    }
    const candidate = await rows(
      "SELECT id, publicId, status, createdAt FROM casting_candidates WHERE id = ?",
      [variant.candidateId],
    );
    if (candidate.length > 0) {
      console.log(`  → candidate ${candidate[0].id} · publicId ${candidate[0].publicId} · ${candidate[0].status} · minted ${utc(candidate[0].createdAt)}`);
    }
    console.log("");
  }
}

await connection.end();
process.exit(0);
