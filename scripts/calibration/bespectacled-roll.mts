/**
 * THE BESPECTACLED SPECIMEN ROLL — the masked-editing workstream's own material.
 *
 * # Why a roll and not a bare calibration sheet
 *
 * `sheet.mts` produces pixels without touching the database, which is right for
 * grading a composition. It is wrong here. D-213's first guard is a RECORD GATE:
 * `requestMatte` only asks a segmenter for a region the record says exists, and
 * the model is never called otherwise. A specimen with no record cannot exercise
 * that gate — it would let the fixture ask open questions of a segmenter and call
 * the answers evidence, which is the exact thing D-213 exists to forbid.
 *
 * So the specimen is cast through the real paid path: real session, real roll,
 * real candidate rows, real resolved identity. Throwaway material by design —
 * the 7-day retention sweep cleans it up, and nothing here is meant to outlive
 * the workstream.
 *
 * # The brief is proven, deliberately
 *
 * "a woman in her 40s wearing chunky glasses" is the founder's own verification
 * brief that came back 8/8 on the stated-accessory fix. A paid multi-step flow is
 * the wrong place to debut a cleverer sentence: an unproven brief that files
 * "glasses" somewhere unexpected costs 160 credits to discover. Chunky frames are
 * also what the fixture wants — opaque enough to composite back verbatim, with
 * clear lens interiors that must regenerate inside frame-edge anchors (D-211).
 *
 *   npx tsx scripts/calibration/bespectacled-roll.mts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import { getDb } from "../../server/db/connection";
import { castingCandidates, users } from "../../drizzle/schema";
import { createCastingSession } from "../../server/db/castingV2";
import { createRoll } from "../../server/castingV2/rollService";
import { assertOneWorld } from "../lib/worldGuard.mts";

/*
  One world per process (scripts/lib/worldGuard.mts). Inert outside a Railway
  run; inside one it refuses when dotenv has filled a gap the service does not
  define, which is how a "production" read gets taken from dev.
*/
assertOneWorld(["DATABASE_URL"]);

/* Founder-verified verbatim — see the header. Do not "improve" this on a paid path. */
const BRIEF = "a woman in her 40s wearing chunky glasses";

const db = await getDb();
if (!db) throw new Error("no db");
const [bot] = await db.select().from(users).where(eq(users.openId, "verify-bot-local")).limit(1);
if (!bot) throw new Error("no verify-bot-local user");

const session = await createCastingSession({ userId: bot.id });
console.log(`brief:   ${BRIEF}`);
console.log(`session: ${session.publicId}`);

const result = await createRoll({}, {
  userId: bot.id,
  clientRequestId: randomUUID(),
  sessionPublicId: session.publicId,
  briefText: BRIEF,
});
console.log(`roll:    ${result.rollPublicId} — waiting for the eight to settle…`);

/* A roll lands its candidates independently; poll until none are still in flight. */
for (let attempt = 0; attempt < 90; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  const rows = await db
    .select({ publicId: castingCandidates.publicId, status: castingCandidates.status, imageKey: castingCandidates.imageKey })
    .from(castingCandidates)
    .where(eq(castingCandidates.sessionId, session.id));
  const ready = rows.filter((row) => row.status === "ready");
  const settled = rows.filter((row) => row.status !== "queued" && row.status !== "dispatched");
  console.log(`  ${ready.length} ready / ${settled.length} settled of ${rows.length}`);
  if (rows.length > 0 && settled.length === rows.length) {
    console.log("\nready candidates:");
    for (const row of ready) console.log(`  ${row.publicId}  ${row.imageKey}`);
    break;
  }
}
process.exit(0);
