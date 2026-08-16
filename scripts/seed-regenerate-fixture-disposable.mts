/**
 * A POINTED VERSION TO REGENERATE — the fixture the founder's own bug is read
 * against (fable-703, fable-704).
 *
 * Two arms, one row apart:
 *
 *   WIRE   a landed version whose record says it was pointed at her right eye.
 *          The panel offers Regenerate on it; the drive clicks and reads the
 *          OUTGOING request. Before this change that request carried her words
 *          alone and the sentence lane refused them — *"That names one side of
 *          a pair…"* — which is exactly what he hit.
 *   RING   the same version with a fresh take in flight against it. The rail
 *          must draw the wait on THAT chip and add no ghost beside it.
 *
 * # Why a fixture rather than a paid render
 *
 * The record this reads did not exist until tonight, so no version on any sheet
 * carries one — a real pointed ask would have to be bought first, and then a
 * confirmed re-roll bought on top of it. The fixture buys the same reading for
 * nothing. What it does NOT prove is that the service writes the record; that
 * is proven where it belongs, on the service, with its own sabotage control
 * (`refineService.test.ts`, "writes the rectangle she pointed at onto the row").
 * This proves the other half: the row reaches the button and the button sends
 * it.
 *
 * Dev only, and it spends nothing: no provider is called, no credits are
 * charged, the operation rows are synthetic with `plannedCredits = 0`.
 *
 *   npx tsx scripts/seed-regenerate-fixture-disposable.mts            (wire arm)
 *   npx tsx scripts/seed-regenerate-fixture-disposable.mts --pending  (ring arm)
 *   npx tsx scripts/seed-regenerate-fixture-disposable.mts --clear    (put it back)
 *   npx tsx scripts/seed-regenerate-fixture-disposable.mts --show     (read only)
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

if (process.env.MYSQL_PUBLIC_URL) throw new Error("dev only — this WRITES");
assertOneWorld(["DATABASE_URL"]);
const where = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:"));
console.log(`WORLD: DATABASE_URL → ${where.hostname}:${where.port}`);

/* The eight-face dev sheet the other fixtures stand on. Position 3 is used
   because it has no versions of its own — nothing real is displaced. */
const SESSION = "0b17d084-ad91-4b4f-955c-45e21703fe05";
const POSITION = 3;
const withPending = process.argv.includes("--pending");
const clear = process.argv.includes("--clear");
const show = process.argv.includes("--show");
/** Every row this script writes carries it, so cleanup is exact. */
const MARK = "regenerate-fixture";

/** The ask, as a pointed one arrives: a sentence naming a side, plus a slot. */
const ASK = `her right eye — fiery red (${MARK})`;
const SCOPE = "eye@right";

const conn = await openDatabase(process.env.DATABASE_URL!);

const [sessions] = await conn.query<any[]>(
  "SELECT id, userId FROM casting_sessions WHERE publicId = ?", [SESSION]);
if (sessions.length === 0) throw new Error("the fixture session is not in this world");
const { id: sessionId, userId } = sessions[0];
if (userId !== 1) throw new Error("the fixture belongs to someone else — refusing");

const [candidates] = await conn.query<any[]>(
  `SELECT id, publicId, position, imageKey, thumbKey, selectedVariantId
     FROM casting_candidates
    WHERE rollId = (SELECT MAX(id) FROM casting_rolls WHERE sessionId = ?)
      AND status = 'ready' AND position = ?`, [sessionId, POSITION]);
const face = candidates[0];
if (!face) throw new Error(`no ready candidate at position ${POSITION}`);

async function currentFixture() {
  const [rows] = await conn.query<any[]>(
    `SELECT publicId, status, requestText, internalPrompt
       FROM casting_candidate_variants
      WHERE userId = ? AND requestText LIKE ?
      ORDER BY id`, [userId, `%${MARK}%`]);
  return rows;
}

if (show) {
  console.log("\nthe fixture rows now:");
  for (const row of await currentFixture()) console.log(" ", JSON.stringify(row));
  await conn.end();
  process.exit(0);
}

/*
  CLEANUP FIRST IN BOTH MODES, and the selection goes back with it — a candidate
  left pointing at a deleted variant is a sheet that cannot open.
*/
await conn.query(
  "UPDATE casting_candidates SET selectedVariantId = NULL WHERE id = ?", [face.id]);
const existing = await currentFixture();
for (const row of existing) {
  await conn.query("DELETE FROM casting_candidate_variants WHERE publicId = ?", [row.publicId]);
}
await conn.query(
  "DELETE FROM generation_operations WHERE userId = ? AND clientRequestId LIKE ?",
  [userId, `${MARK}%`]);
console.log(`removed ${existing.length} fixture variant row(s), selection cleared`);

if (clear) {
  await conn.end();
  process.exit(0);
}

async function operation(kind: "succeeded" | "running"): Promise<string> {
  const id = randomUUID();
  const lease = kind === "running" ? new Date(Date.now() + 30 * 60_000) : null;
  await conn.query(
    `INSERT INTO generation_operations
       (id, userId, clientRequestId, kind, payloadHash, status, plannedCredits,
        chargedCredits, refundedCredits, phase, heartbeatAt, leaseExpiresAt, createdAt)
     VALUES (?, ?, ?, 'castingV2.refine', ?, ?, 0, 0, 0, 'generating', NOW(), ?, NOW())`,
    [id, userId, `${MARK}-${id.slice(0, 8)}`, randomUUID().replace(/-/g, ""), kind, lease]);
  return id;
}

/* ---- the landed pointed version ---- */

const delta = { free: { eyeColourFree: "her right eye fiery red" } };
const landedPublicId = randomUUID();
const [landed] = await conn.query<any>(
  `INSERT INTO casting_candidate_variants
     (publicId, candidateId, sessionId, userId, status, instructions, stepDeltas, deltas,
      requestText, internalPrompt, imageKey, thumbKey, operationId, pointsCost, createdAt)
   VALUES (?, ?, ?, ?, 'ready', ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
  [landedPublicId, face.id, sessionId, userId,
    JSON.stringify([ASK]), JSON.stringify([delta]), JSON.stringify(delta), ASK,
    /* THE RECORD UNDER TEST: what the ask was pointed at, written the way the
       service writes it (`refineService`'s `askScope`). */
    JSON.stringify({ prompt: `${MARK}`, askScope: SCOPE }),
    face.imageKey, face.thumbKey, await operation("succeeded")]);
await conn.query(
  "UPDATE casting_candidates SET selectedVariantId = ? WHERE id = ?", [landed.insertId, face.id]);
console.log(`WIRE arm: version ${landedPublicId} on ${face.publicId} · askScope ${SCOPE} · selected`);

/* ---- and, on request, a fresh take of it in flight ---- */

if (withPending) {
  const pendingPublicId = randomUUID();
  await conn.query(
    `INSERT INTO casting_candidate_variants
       (publicId, candidateId, sessionId, userId, status, instructions, stepDeltas, deltas,
        requestText, internalPrompt, operationId, pointsCost, createdAt)
     VALUES (?, ?, ?, ?, 'dispatched', ?, ?, ?, ?, ?, ?, 0, NOW())`,
    [pendingPublicId, face.id, sessionId, userId,
      JSON.stringify([ASK]), JSON.stringify([delta]), JSON.stringify(delta), ASK,
      /* WHAT IT IS A FRESH TAKE OF — the key the claim now seeds and the rail
         reads. Without it this row is an ordinary pending edit and draws a
         ghost, which is the control the drive checks. */
      JSON.stringify({ regeneratedFrom: landedPublicId }),
      await operation("running")]);
  console.log(`RING arm: ${pendingPublicId} regenerating ${landedPublicId}`);
}

console.log("\nthe fixture rows now:");
for (const row of await currentFixture()) console.log(" ", JSON.stringify(row));
await conn.end();
process.exit(0);
