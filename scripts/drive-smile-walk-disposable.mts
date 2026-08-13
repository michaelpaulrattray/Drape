/**
 * CAN A USER ASK HER TO SMILE — and if she does, does the teeth reader see it?
 *
 * The teeth bench passed all six of its pre-registered bars, and one caveat
 * survived it honestly: its POSITIVE stratum was three SYNTHETIC portraits,
 * because no frame in this world has ever shown teeth. The free probe then
 * found that an expression ask does not hit a wall — `"give her a broad smile"`
 * filed 3/3 as `{"free":{"expression":"a broad smile"}}`.
 *
 * Filing is not delivering. This buys one render to close the gap with a REAL
 * product frame, and asks the shipped-candidate reader about it.
 *
 * PRE-REGISTERED, before the credit is spent:
 *
 * ```
 * S1  the ask renders          `ready`, charged once, no refusal
 * S2  her mouth is OPEN and    my own eye on the delivered frame
 *     her teeth are visible
 * S3  the reader answers       describeWithTeeth returns a non-null teeth line
 *     on a real product frame  on it — the synthetic-only caveat closes
 * S4  and it is still null     the same reader on this face's own master,
 *     on the closed mouth      which it has already answered null once
 * ```
 *
 * If S2 fails — she smiles with her lips closed, or nothing changes — that is
 * the answer too, and it is the one that keeps the teeth row empty.
 *
 * Dev only, 25 dev credits, one step.
 *
 *   CASTING_REFERENCE_LIBRARY_SCOPE=users:1 CASTING_REPAINT_SCOPE=users:1 \
 *     npx tsx scripts/drive-smile-walk-disposable.mts
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { refineCandidate } from "../server/castingV2/refineService";
import { storageReadBytes } from "../server/storage";
import { describeWithTeeth } from "../server/castingV2/faceDescribe";

const OUT = "output/smile-walk";
/* #367 — clean: no variants, no library rows, and not the bald walk's face. */
const FACE = process.env.FACE ?? "83e10422-2f22-4bcc-b581-ef1ebd329807";
const USER = Number(process.env.USER_ID ?? 1);
const INSTRUCTION = process.env.ASK ?? "give her a broad smile";

if (process.env.MYSQL_PUBLIC_URL) {
  throw new Error("this spends credits and is a DEV drive — it refuses to run against production");
}
assertOneWorld(["DATABASE_URL"]);
const where = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:"));
console.log(`WORLD: DATABASE_URL → ${where.hostname}:${where.port}`);
console.log(`FLAGS: library ${process.env.CASTING_REFERENCE_LIBRARY_SCOPE ?? "(unset)"}`
  + ` · repaint ${process.env.CASTING_REPAINT_SCOPE ?? "(unset)"}`);
console.log(`PLAN:  1 paid step × 25 credits on dev user ${USER}\n`);

const connection = await openDatabase(process.env.DATABASE_URL!);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};
await mkdir(OUT, { recursive: true });
const parse = (value: unknown): any => (typeof value === "string"
  ? (() => { try { return JSON.parse(value); } catch { return null; } })()
  : value);

const candidate = (await query(
  "SELECT id, publicId, userId, imageKey FROM casting_candidates WHERE publicId = ?", [FACE],
))[0];
if (!candidate) throw new Error(`no candidate ${FACE} in dev`);
if (Number(candidate.userId) !== USER) throw new Error(`candidate belongs to user ${candidate.userId}`);
console.log(`FACE: #${candidate.id} ${candidate.publicId}`);

const master = await storageReadBytes(candidate.imageKey);
await writeFile(`${OUT}/0-master.png`, master.bytes);

/* S4 first, on the master — the same reader, before anything is asked of the
   engine, so the closed-mouth null is this face's own baseline rather than a
   number borrowed from the bench. */
const before = await describeWithTeeth({ bytes: master.bytes, contentType: master.contentType ?? "image/png" });
console.log(`S4 baseline — master teeth: ${before.teeth ?? "null"}`);
console.log(`             master build: ${before.build ?? "null"}`);

const startedAt = new Date();
console.log(`\n── "${INSTRUCTION}"`);
const began = Date.now();
let threw: string | null = null;
let outcome: any = null;
try {
  outcome = await refineCandidate({}, {
    userId: USER,
    clientRequestId: randomUUID(),
    candidatePublicId: candidate.publicId,
    instruction: INSTRUCTION,
  });
} catch (error) {
  threw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
console.log(`  ${threw ?? outcome?.kind}  (${Math.round((Date.now() - began) / 1000)}s)`);

const row = (await query(
  `SELECT v.id, v.publicId, v.status, v.imageKey, v.failureClass, v.deltas, v.instructions,
          v.internalPrompt, o.chargedCredits, o.refundedCredits, o.publicMessage
     FROM casting_candidate_variants v
     LEFT JOIN generation_operations o ON o.id = v.operationId
    WHERE v.candidateId = ? AND v.createdAt >= ? ORDER BY v.id DESC LIMIT 1`,
  [candidate.id, startedAt],
))[0] ?? null;

if (row) {
  console.log(`  [row] #${row.id} ${row.status}${row.failureClass ? ` · ${row.failureClass}` : ""}`
    + ` · charged ${row.chargedCredits ?? "—"} refunded ${row.refundedCredits ?? "—"}`);
  console.log(`  [delta] ${JSON.stringify(parse(row.deltas))}`);
  const record = parse(row.internalPrompt)?.repaint ?? null;
  if (record) console.log(`  [wire] edited ${JSON.stringify(record.edited)} · carried ${JSON.stringify(record.carried)}`);
  if (row.imageKey) {
    const { bytes, contentType } = await storageReadBytes(row.imageKey);
    await writeFile(`${OUT}/1-smile.png`, bytes);
    console.log(`  [frame] ${OUT}/1-smile.png — LOOK AT IT (S2 is my eye, not a reader's)`);
    const after = await describeWithTeeth({ bytes, contentType: contentType ?? "image/png" });
    console.log(`\nS3 — the candidate reader on the delivered frame:`);
    console.log(`     teeth: ${after.teeth ?? "null"}`);
    console.log(`     build: ${after.build ?? "null"}`);
    console.log(`     skin:  ${after.skin ?? "null"}`);
    await writeFile(`${OUT}/read.json`, JSON.stringify({ before, after, delta: parse(row.deltas) }, null, 2));
  }
} else {
  console.log("  [row] NO VARIANT ROW");
}

const ledger = await query(
  `SELECT id, amount, type, description FROM point_transactions
    WHERE userId = ? AND createdAt >= ? ORDER BY id`, [USER, startedAt],
);
console.log("\n── LEDGER for this step");
for (const entry of ledger) console.log(`  ${entry.id}  ${String(Number(entry.amount)).padStart(5)}  ${entry.type}  ${entry.description}`);

await connection.end();
process.exit(0);
