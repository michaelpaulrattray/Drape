/**
 * TWO WAITS, ONE APART FROM THE OTHER ONLY IN AGE — the fixture the moved
 * threshold is read against (fable-684 §3, fable-687 §2).
 *
 * The held commit does two things: the viewer's typical-wait line becomes
 * *"usually three to four minutes"*, and the panel's *"taking longer than
 * usual"* note moves from 2 minutes to 5. Neither can be believed off a unit
 * test — the hazard Fable named is that the NEW copy is LONGER than the line it
 * replaces, and a promise surface with longer copy is exactly where truncation,
 * wrap or overlap hides. So both are looked at, in the running app.
 *
 * The two arms differ in ONE variable, the row's age:
 *
 *   SPEAKS   a live `dispatched` row started 8 minutes ago — past the NEW
 *            threshold, so the note is honest and must appear
 *   QUIET    the same row started 3 minutes ago — **past the OLD 2-minute
 *            threshold and inside the new 5-minute one**
 *
 * The QUIET arm is the discriminating one and it is chosen on purpose. A row
 * born a moment ago would prove only that the note can be absent, which was
 * already true yesterday; a row at 3 minutes is one YESTERDAY'S BUILD WOULD
 * HAVE SPOKEN OVER. Its silence is the threshold having moved, and nothing
 * else. Both arms carry a live lease, so neither is settling and the viewer
 * narrates on both — which is how the typical-wait line gets seen twice.
 *
 * Dev only, and it spends nothing: no provider is called, no credits are
 * charged, the operations are synthetic rows with `plannedCredits = 0`.
 *
 *   npx tsx scripts/seed-wait-notice-disposable.mts          (seed)
 *   npx tsx scripts/seed-wait-notice-disposable.mts --clear  (put it back)
 *   npx tsx scripts/seed-wait-notice-disposable.mts --show   (read only)
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

if (process.env.MYSQL_PUBLIC_URL) throw new Error("dev only — this WRITES");
assertOneWorld(["DATABASE_URL"]);
const where = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:"));
console.log(`WORLD: DATABASE_URL → ${where.hostname}:${where.port}`);

/* The eight-face dev sheet, the same one the stuck-render fixture stands on:
   the sheet renders the LATEST roll, and this one has faces to spare. */
const SESSION = "0b17d084-ad91-4b4f-955c-45e21703fe05";
const clear = process.argv.includes("--clear");
const show = process.argv.includes("--show");
/** Every row this script writes carries it, so cleanup is exact. */
const MARK = "wait-notice-fixture";

/** The two thresholds this fixture is aimed between. Stated, not implied. */
const OLD_THRESHOLD_MIN = 2;
const NEW_THRESHOLD_MIN = 5;

const conn = await openDatabase(process.env.DATABASE_URL!);

const [sessions] = await conn.query<any[]>(
  "SELECT id, userId FROM casting_sessions WHERE publicId = ?", [SESSION]);
if (sessions.length === 0) throw new Error("the fixture session is not in this world");
const { id: sessionId, userId } = sessions[0];
if (userId !== 1) throw new Error("the fixture belongs to someone else — refusing");

const [candidates] = await conn.query<any[]>(
  `SELECT c.id, c.publicId, c.position
     FROM casting_candidates c
    WHERE c.rollId = (SELECT MAX(id) FROM casting_rolls WHERE sessionId = ?)
      AND c.status = 'ready'
    ORDER BY c.position`, [sessionId]);
console.log(`ready candidates in the fixture sheet: ${candidates.length}`);
for (const row of candidates) console.log(`  position ${row.position}  ${row.publicId}`);

async function currentFixture() {
  const [rows] = await conn.query<any[]>(
    `SELECT v.publicId, v.status, v.requestText, v.candidateId, v.createdAt,
            o.leaseExpiresAt, o.status AS opStatus
       FROM casting_candidate_variants v
       LEFT JOIN generation_operations o ON o.id = v.operationId
      WHERE v.userId = ? AND v.requestText LIKE ?`, [userId, `%${MARK}%`]);
  return rows;
}

if (show) {
  console.log("\nthe fixture rows now:");
  for (const row of await currentFixture()) console.log(" ", JSON.stringify(row));
  await conn.end();
  process.exit(0);
}

/* Cleanup first in both modes: seeding twice must not leave four rows. */
const existing = await currentFixture();
for (const row of existing) {
  await conn.query("DELETE FROM casting_candidate_variants WHERE publicId = ?", [row.publicId]);
}
await conn.query(
  "DELETE FROM generation_operations WHERE userId = ? AND clientRequestId LIKE ?",
  [userId, `${MARK}%`]);
console.log(`removed ${existing.length} fixture variant row(s)`);

if (clear) {
  await conn.end();
  process.exit(0);
}

if (candidates.length < 2) throw new Error("need two ready faces to drive both arms on one sheet");

const now = Date.now();
const arms = [
  {
    name: "SPEAKS",
    candidate: candidates[0],
    ageMin: 8,
    text: `make her hair copper (${MARK}: speaks)`,
  },
  {
    name: "QUIET",
    candidate: candidates[1],
    /* Between the two thresholds. The whole reading is here. */
    ageMin: 3,
    text: `make her hair copper (${MARK}: quiet)`,
  },
];

for (const arm of arms) {
  /*
    Half an hour ahead — longer than any real lease, on purpose. A lease that
    expired part-way through the drive would turn the row `settling`, and a
    settling row stands the note down for a completely different reason
    (fable-460's sibling). The arm would then pass for the wrong cause.
  */
  const lease = new Date(now + 30 * 60_000);
  const startedAt = new Date(now - arm.ageMin * 60_000);
  const operationId = randomUUID();
  await conn.query(
    `INSERT INTO generation_operations
       (id, userId, clientRequestId, kind, payloadHash, status, plannedCredits,
        chargedCredits, refundedCredits, phase, heartbeatAt, leaseExpiresAt, createdAt)
     VALUES (?, ?, ?, 'castingV2.refine', ?, 'running', 0, 0, 0, 'generating', ?, ?, NOW())`,
    [operationId, userId, `${MARK}-${arm.name}-${operationId.slice(0, 8)}`,
      randomUUID().replace(/-/g, ""), new Date(now - 20_000), lease]);
  const variantPublicId = randomUUID();
  await conn.query(
    `INSERT INTO casting_candidate_variants
       (publicId, candidateId, sessionId, userId, status, instructions, requestText,
        operationId, pointsCost, createdAt)
     VALUES (?, ?, ?, ?, 'dispatched', ?, ?, ?, 0, ?)`,
    [variantPublicId, arm.candidate.id, sessionId, userId,
      JSON.stringify([arm.text]), arm.text, operationId, startedAt]);
  console.log(
    `${arm.name}: position ${arm.candidate.position} (${arm.candidate.publicId})`
    + ` age ${arm.ageMin}m — old threshold ${OLD_THRESHOLD_MIN}m: ${arm.ageMin > OLD_THRESHOLD_MIN ? "WOULD HAVE SPOKEN" : "quiet"}`
    + ` · new threshold ${NEW_THRESHOLD_MIN}m: ${arm.ageMin > NEW_THRESHOLD_MIN ? "speaks" : "quiet"}`,
  );
}

console.log("\nthe fixture rows now:");
for (const row of await currentFixture()) console.log(" ", JSON.stringify(row));
await conn.end();
process.exit(0);
