/**
 * RUN-15's STORED VERDICTS, IN FULL — and the step-2 timing question.
 *
 * Two questions, one connection:
 *
 *  1. The two advisory `marks` rows (frames 04 and 05). What did the reader
 *     actually SAY it saw, and how many readings did it take? If the freckles
 *     are plainly in the frame (they are — manual double-read, opus-057 §3) and
 *     the reader answered "clear skin", the row is a reader blindness, and the
 *     suspected mechanism is the DECLARED detail gap: a step whose harvest never
 *     segmented face skin gets no magnified crop and reads at portrait scale.
 *
 *  2. Step 2's operation timing. The panel said "We lost contact while that was
 *     rendering" after 323.6s; the row says `failed / facts_missing`. If the
 *     operation SETTLED well before 323.6s, the client was told a transport
 *     story about an answer the server already had.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/read-run15-verdicts-disposable.mts
 */
import "dotenv/config";

import { openDatabase, utc } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

assertOneWorld(["MYSQL_PUBLIC_URL"]);
const url = process.env.MYSQL_PUBLIC_URL;
if (!url) throw new Error("run under `railway run --service MySQL`");

const CANDIDATE = "154fb36b-334e-4cb1-92aa-9a2c567f6d26";

const connection = await openDatabase(url);
const [rows] = await connection.query<any[]>(
  `SELECT v.publicId, v.status, v.failureClass, v.pointsCost, v.createdAt,
          v.operationId, v.instructions, v.internalPrompt,
          o.status AS opStatus, o.errorCode, o.publicMessage,
          o.createdAt AS opCreatedAt, o.completedAt AS opCompletedAt,
          o.updatedAt AS opUpdatedAt, o.chargedCredits, o.refundedCredits
     FROM casting_candidate_variants v
     JOIN casting_candidates c ON c.id = v.candidateId
     LEFT JOIN generation_operations o ON o.id = v.operationId
    WHERE c.publicId = ?
    ORDER BY v.createdAt`,
  [CANDIDATE],
);
await connection.end();

const parse = (value: unknown): any =>
  typeof value === "string" ? JSON.parse(value) : value;

for (const row of rows) {
  const instructions = parse(row.instructions) ?? [];
  const internal = parse(row.internalPrompt) ?? {};
  const verification = internal.verification ?? null;
  const asked = instructions[instructions.length - 1] ?? "—";

  console.log("");
  console.log("=".repeat(100));
  console.log(`${utc(row.createdAt)}  ${row.status}  "${asked}"  cost ${row.pointsCost}`);
  console.log(`  variant ${row.publicId}   operation ${row.operationId}`);
  console.log(`  operation: ${row.opStatus} ${row.errorCode ?? "—"} `
    + `charged ${row.chargedCredits} refunded ${row.refundedCredits}`);
  console.log(`  op created   ${utc(row.opCreatedAt)}`);
  console.log(`  op completed ${row.opCompletedAt ? utc(row.opCompletedAt) : "—"}`);
  console.log(`  op updated   ${utc(row.opUpdatedAt)}`);
  if (row.opCompletedAt) {
    const seconds = (new Date(row.opCompletedAt).getTime()
      - new Date(row.opCreatedAt).getTime()) / 1000;
    console.log(`  op lifetime  ${seconds.toFixed(1)}s`);
  }
  if (row.publicMessage) console.log(`  publicMessage: "${row.publicMessage}"`);

  if (!verification) {
    console.log("  verification: NONE STORED");
    continue;
  }
  console.log(`  verification: attempts ${verification.attempts} `
    + `readings ${verification.readings}${verification.unavailable ? " UNAVAILABLE" : ""}`);
  for (const check of verification.checks ?? []) {
    const mark = check.read
      ? (check.verified ? "PASS" : (check.binding === false ? "ADVISORY-MISS" : "BINDING-MISS"))
      : "UNREAD";
    console.log(`    ${mark.padEnd(14)} ${String(check.facet).padEnd(28)} `
      + `binding=${check.binding !== false}`);
    console.log(`        asked: ${check.asked}`);
    console.log(`        saw:   ${check.saw ?? "—"}`);
  }
}
