/**
 * DOES THE CAP'S RACE REPRODUCE AT ALL? — the instrument, before the finding.
 *
 * `server/castingV2-ink-design-db.test.ts` has an arm called *"refuses the
 * ninth even when the eighth and the ninth race"*. Removing `.for("update")`
 * from `recordInkDesign` left that arm GREEN, which means it was not testing
 * the lock. Before rewriting the arm, this measures whether the race is
 * reproducible in this environment at all, and it drives BOTH arms:
 *
 *   unlocked   two transactions, plain SELECT of the parent, a widened window
 *              between the count and the insert
 *   locked     the same, with SELECT ... FOR UPDATE on the parent
 *
 * If the unlocked arm produces nine rows and the locked arm eight, the race is
 * real, the lock is what stops it, and the suite's arm can be written to fail
 * without it. If BOTH produce eight, this environment serializes the two
 * transactions on its own and no test here can prove the lock — which is a
 * finding to report rather than a claim to keep.
 *
 * Run through the disposable-database driver:
 *   npx tsx scripts/drive-casting-v2-segment-store-disposable.mts \
 *     --run scripts/probe-ink-cap-race-disposable.mts
 */
import { randomUUID } from "node:crypto";
import { type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

import { openDatabase, type ScriptConnection } from "./lib/dbConnection.mts";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("no disposable database handed to this probe");

const CAP = 8;

/* The intent declaration (migration 0035) as JSON text, bound rather than
   inlined — a JSON literal inside a TS string inside SQL is three escapes deep
   and reads as noise. */
const DECLARED = JSON.stringify(["tattoo"]);

/* Through the one door: it welds `timezone: "Z"` on and refuses to open a
   world other than the one this process was wrapped for. */
async function open(): Promise<ScriptConnection> {
  return openDatabase(url!);
}

async function seed(connection: ScriptConnection, held: number): Promise<{ candidateId: number; userId: number }> {
  const [user] = await connection.execute<ResultSetHeader>(
    "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'Race Probe', 1, 1)",
    [`race-${randomUUID()}`],
  );
  const [session] = await connection.execute<ResultSetHeader>(
    "INSERT INTO casting_sessions (publicId, userId, status) VALUES (?, ?, 'open')",
    [randomUUID(), user.insertId],
  );
  const [roll] = await connection.execute<ResultSetHeader>(
    "INSERT INTO casting_rolls (publicId, sessionId, userId, rollIndex, briefText, status, operationId, priceCredits)"
      + " VALUES (?, ?, ?, 0, 'probe', 'complete', ?, 640)",
    [randomUUID(), session.insertId, user.insertId, randomUUID()],
  );
  const [candidate] = await connection.execute<ResultSetHeader>(
    "INSERT INTO casting_candidates (publicId, rollId, sessionId, userId, position, status, imageKey)"
      + " VALUES (?, ?, ?, ?, 0, 'ready', 'faces/probe.png')",
    [randomUUID(), roll.insertId, session.insertId, user.insertId],
  );
  for (let at = 0; at < held; at += 1) {
    await connection.execute(
      "INSERT INTO casting_ink_designs (publicId, userId, candidateId, placement, side, provenance, intents, storageKey, digest, mime, byteSize, width, height)"
        + " VALUES (?, ?, ?, 'upperArm', 'left', 'consented', ?, ?, ?, 'image/png', 1, 900, 1200)",
      [randomUUID(), user.insertId, candidate.insertId, DECLARED, `casting-v2/ink/${randomUUID()}.png`, randomUUID().replace(/-/g, "")],
    );
  }
  return { candidateId: candidate.insertId, userId: user.insertId };
}

/** One writer: the exact statement shape `recordInkDesign` uses, lock optional. */
async function writer(
  candidateId: number,
  userId: number,
  lock: boolean,
  windowMs: number,
): Promise<"wrote" | "refused" | string> {
  const connection = await open();
  try {
    await connection.beginTransaction();
    const [parents] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM casting_candidates WHERE id = ? AND userId = ? LIMIT 1${lock ? " FOR UPDATE" : ""}`,
      [candidateId, userId],
    );
    if (parents.length !== 1) throw new Error("parent vanished");
    const [counted] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM casting_ink_designs WHERE candidateId = ?",
      [candidateId],
    );
    /* THE WINDOW, WIDENED ON PURPOSE. The real one is a network round trip
       wide; a probe that cannot open it cannot tell a lock from a coincidence. */
    await new Promise((resolve) => setTimeout(resolve, windowMs));
    if (Number(counted[0]!.n) >= CAP) {
      await connection.rollback();
      return "refused";
    }
    await connection.execute(
      "INSERT INTO casting_ink_designs (publicId, userId, candidateId, placement, side, provenance, intents, storageKey, digest, mime, byteSize, width, height)"
        + " VALUES (?, ?, ?, 'upperArm', 'left', 'consented', ?, ?, ?, 'image/png', 1, 900, 1200)",
      [randomUUID(), userId, candidateId, DECLARED, `casting-v2/ink/${randomUUID()}.png`, randomUUID().replace(/-/g, "")],
    );
    await connection.commit();
    return "wrote";
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return `error: ${(error as Error).message}`;
  } finally {
    await connection.end();
  }
}

async function arm(lock: boolean, windowMs: number): Promise<void> {
  const setup = await open();
  const { candidateId, userId } = await seed(setup, CAP - 1);
  const outcomes = await Promise.all([
    writer(candidateId, userId, lock, windowMs),
    writer(candidateId, userId, lock, windowMs),
  ]);
  const [rows] = await setup.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM casting_ink_designs WHERE candidateId = ?",
    [candidateId],
  );
  await setup.end();
  console.log(
    `[${lock ? "locked  " : "unlocked"}] window=${windowMs}ms outcomes=${outcomes.join("/")} rows=${rows[0]!.n} (cap ${CAP})`,
  );
}

for (const windowMs of [0, 250]) {
  await arm(false, windowMs);
  await arm(true, windowMs);
}

/* A script ends by ending the process — an open pool keeps node alive. */
process.exit(0);
