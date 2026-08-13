/**
 * CAN THE FOUNDER MAKE A MODEL BALD TODAY? — fable-399 step 2, on the real
 * pipeline, with the answer to step 1 already in hand.
 *
 * His words: *"'remove her hair' and 'make her bald' are essentially the same
 * asks — are you saying today i cannot make a model bald?"*
 *
 * # What the free probe already settled (probe-bald-and-smile, n=3 each)
 *
 * ```
 * "make her bald"    3/3 FILED  {"hairStyle":"shaved head"}
 * "shave her head"   3/3 FILED  {"hairStyle":"shaved head"}
 * "remove her hair"  1 refused (wall_content) · 2 routed intent=remove
 * controls           12/12 still refused — the instrument is not a hole
 * ```
 *
 * So fable-399's hypothesis holds at the interpreter: **bald is a haircut**,
 * and two of his three phrasings already file as one. That is a claim about a
 * DELTA, not about a picture, and the difference between those two things is
 * most of this program's history. This buys the picture.
 *
 * # PRE-REGISTERED, before a credit is spent
 *
 * ```
 * B1  the ask renders            step 1 comes back `ready`, no refusal, charged once
 * B2  she is BALD                my own eye on the delivered frame — not a reader's
 * B3  she is STILL HER           my own eye, against the master beside it
 * B4  bald SURVIVES one edit     step 2 is an unrelated ask ("give her green
 *                                eyes"); my eye on that frame says whether the
 *                                scalp came back — the one-frame-removal
 *                                question in its scalp form (fable-399)
 * ```
 *
 * B2–B4 are answered by looking at the frames, which this script writes to
 * disk; it does not grade them itself. A vision reader has now failed twice on
 * a body edit it was asked to confirm, and a bald head is not a subtle thing.
 *
 * Dev only, user 1's own face, 50 dev credits — exactly fable-399's
 * authorization.
 *
 *   CASTING_REFERENCE_LIBRARY_SCOPE=users:1 CASTING_REPAINT_SCOPE=users:1 \
 *     npx tsx scripts/drive-bald-walk-disposable.mts
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { refineCandidate } from "../server/castingV2/refineService";
import { storageReadBytes } from "../server/storage";

const OUT = "output/bald-walk";
/* #366 — blonde, long, straight, worn down: no variants, no library rows, and
   the most hair to lose of the clean faces. A face with an edit history would
   make "did it survive?" a question about somebody else's edits. */
const FACE = process.env.FACE ?? "18767549-3c69-42c1-9b16-ae47a5614cf9";
const USER = Number(process.env.USER_ID ?? 1);
const COST = 25;

const STEPS = [
  { instruction: "make her bald", isTheBaldAsk: true },
  { instruction: "give her green eyes", isTheBaldAsk: false },
];

if (process.env.MYSQL_PUBLIC_URL) {
  throw new Error("this spends credits and is a DEV drive — it refuses to run against production");
}
assertOneWorld(["DATABASE_URL"]);
const where = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:"));
const library = process.env.CASTING_REFERENCE_LIBRARY_SCOPE ?? "(unset)";
const repaint = process.env.CASTING_REPAINT_SCOPE ?? "(unset)";
console.log(`WORLD: DATABASE_URL → ${where.hostname}:${where.port}`);
console.log(`FLAGS: library ${library} · repaint ${repaint}`);
console.log(`PLAN:  ${STEPS.length} paid steps × ${COST} credits = ${STEPS.length * COST} on dev user ${USER}\n`);

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
if (Number(candidate.userId) !== USER) throw new Error(`candidate belongs to user ${candidate.userId}, not ${USER}`);

const priorVariants = (await query(
  "SELECT COUNT(*) AS n FROM casting_candidate_variants WHERE candidateId = ?", [candidate.id],
))[0].n;
console.log(`FACE: #${candidate.id} ${candidate.publicId} · ${priorVariants} prior variant(s)`);

/* The master, on disk, so "still her" is judged against a picture rather than
   against a memory of one. */
const master = await storageReadBytes(candidate.imageKey);
await writeFile(`${OUT}/0-master.png`, master.bytes);
console.log(`BEFORE: master written to ${OUT}/0-master.png\n`);

const startedAt = new Date();
const walked: any[] = [];

for (const [at, step] of STEPS.entries()) {
  console.log(`── step ${at + 1}: "${step.instruction}"`);
  const began = Date.now();
  let outcome: any = null;
  let threw: string | null = null;
  try {
    outcome = await refineCandidate({}, {
      userId: USER,
      clientRequestId: randomUUID(),
      candidatePublicId: candidate.publicId,
      instruction: step.instruction,
    });
  } catch (error) {
    threw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
  console.log(`  ${threw ?? outcome?.kind}  (${Math.round((Date.now() - began) / 1000)}s)`);

  const row = (await query(
    `SELECT v.id, v.publicId, v.status, v.requestText, v.imageKey, v.failureClass, v.internalPrompt,
            v.deltas, v.instructions, o.chargedCredits, o.refundedCredits, o.publicMessage
       FROM casting_candidate_variants v
       LEFT JOIN generation_operations o ON o.id = v.operationId
      WHERE v.candidateId = ? AND v.requestText = ? AND v.createdAt >= ?
      ORDER BY v.id DESC LIMIT 1`,
    [candidate.id, step.instruction, startedAt],
  ))[0] ?? null;

  if (!row) {
    console.log("  [row] NO VARIANT ROW — nothing was delivered for this step");
    walked.push({ step: step.instruction, threw, row: null });
    continue;
  }
  console.log(`  [row] #${row.id} ${row.status}${row.failureClass ? ` · ${row.failureClass}` : ""}`
    + ` · charged ${row.chargedCredits ?? "—"} refunded ${row.refundedCredits ?? "—"}`);
  console.log(`  [delta] ${JSON.stringify(parse(row.deltas))}`);
  console.log(`  [instructions] ${JSON.stringify(parse(row.instructions))}`);

  const record = parse(row.internalPrompt)?.repaint ?? null;
  if (record) {
    console.log(`  [wire] edited ${JSON.stringify(record.edited)} · carried ${JSON.stringify(record.carried)}`
      + ` · standing ${JSON.stringify(record.standing)}`);
    if (Array.isArray(record.references)) {
      console.log(`  [wire] references ${JSON.stringify(record.references.map((r: any) => r.slot))}`);
    }
  } else {
    console.log("  [wire] no repaint record — this render came down the old road");
  }

  /* What the library made of her hair — the row that decides whether a bald
     head is a fact about her or one frame's accident. */
  const hairRows = await query(
    `SELECT id, role, slot, version, words, storageKey, retiredAt, variantId,
            refusedReason, refusedKind, refusedCoverage
       FROM casting_reference_library
      WHERE candidateId = ? AND slot LIKE 'hair%' ORDER BY id`, [candidate.id],
  );
  console.log(`  [library] ${hairRows.length} hair row(s)`);
  for (const hair of hairRows) {
    console.log(`      #${hair.id} ${hair.role} ${hair.slot} v${hair.version}`
      + `${hair.retiredAt ? " RETIRED" : ""} ${hair.storageKey ? "crop" : "words-only"}`
      + ` from variant ${hair.variantId ?? "—"}`
      + `${hair.refusedReason ? ` · refused ${hair.refusedReason}` : ""}`);
    console.log(`         words: ${JSON.stringify(parse(hair.words))}`);
  }

  if (row.imageKey) {
    const { bytes } = await storageReadBytes(row.imageKey);
    const name = step.isTheBaldAsk ? "1-bald" : "2-after";
    await writeFile(`${OUT}/${name}.png`, bytes);
    console.log(`  [frame] ${OUT}/${name}.png — look at it`);
  }

  walked.push({ step: step.instruction, threw, row, record, hairRows });
  console.log("");
}

const ledger = await query(
  `SELECT id, amount, type, description, createdAt FROM point_transactions
    WHERE userId = ? AND createdAt >= ? ORDER BY id`, [USER, startedAt],
);
console.log("── LEDGER for this walk");
let gross = 0;
let refunded = 0;
for (const entry of ledger) {
  const amount = Number(entry.amount);
  if (amount < 0) gross += -amount;
  if (amount > 0 && entry.type === "refund") refunded += amount;
  console.log(`  ${entry.id}  ${String(amount).padStart(5)}  ${entry.type}  ${entry.description}`);
}
console.log(`  gross ${gross} · refunded ${refunded} · net ${gross - refunded} dev credits`);

console.log("\nB2, B3 and B4 are answered by LOOKING at the three frames in "
  + `${OUT}/ — this script does not grade them.`);

await writeFile(`${OUT}/walk.json`, JSON.stringify({ walked, ledger }, null, 2));
await connection.end();
process.exit(0);
