/**
 * THE SAME RACE, ON THE APP'S OWN PATH — `recordInkDesign`, twice, concurrently.
 *
 * The raw-statement probe beside this one proved the race is real in this
 * environment (unlocked: 9 rows; locked: 8, at two window widths). What it did
 * NOT explain is why the suite's arm stayed green with `.for("update")`
 * removed. So this drives the product function itself, and prints what actually
 * happened rather than an expectation about it.
 *
 * Run through the disposable-database driver, with the lock in whatever state
 * you are asking about:
 *   npx tsx scripts/drive-casting-v2-segment-store-disposable.mts \
 *     --run scripts/probe-ink-cap-apppath-disposable.mts
 */
import { randomUUID } from "node:crypto";
import { type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

import { openDatabase } from "./lib/dbConnection.mts";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("no disposable database handed to this probe");
process.env.DATABASE_URL = url;

const designs = await import("../server/db/castingV2InkDesigns");

const connection = await openDatabase(url);
const [user] = await connection.execute<ResultSetHeader>(
  "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'App Race Probe', 1, 1)",
  [`race-app-${randomUUID()}`],
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
const candidatePublicId = randomUUID();
const [candidate] = await connection.execute<ResultSetHeader>(
  "INSERT INTO casting_candidates (publicId, rollId, sessionId, userId, position, status, imageKey)"
    + " VALUES (?, ?, ?, ?, 0, 'ready', 'faces/probe.png')",
  [candidatePublicId, roll.insertId, session.insertId, user.insertId],
);

function ask() {
  return {
    userId: user.insertId,
    candidatePublicId,
    placement: "upperArm" as const,
    side: "left" as const,
    provenance: "consented" as const,
    storageKey: `casting-v2/ink/${randomUUID()}.png`,
    digest: randomUUID().replace(/-/g, "").repeat(2).slice(0, 64),
    mime: "image/png",
    byteSize: 40_137,
    width: 900,
    height: 1200,
  };
}

/* Seven, through the product's own writer, so the starting state is one the
   product can actually be in. */
for (let at = 0; at < 7; at += 1) await designs.recordInkDesign(ask());

const started = Date.now();
const outcomes = await Promise.allSettled([
  designs.recordInkDesign(ask()),
  designs.recordInkDesign(ask()),
]);
const elapsed = Date.now() - started;

const [rows] = await connection.query<RowDataPacket[]>(
  "SELECT COUNT(*) AS n FROM casting_ink_designs WHERE candidateId = ?",
  [candidate.insertId],
);
console.log(
  `[app path] outcomes=${outcomes.map((one) => one.status === "fulfilled" ? "wrote" : `refused(${(one.reason as Error).name})`).join("/")}`
  + ` rows=${rows[0]!.n} elapsedMs=${elapsed}`,
);
await connection.end();
process.exit(0);
