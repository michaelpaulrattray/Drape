/**
 * The timestamp instrument (D-112).
 *
 * D-112 demanded the connection fix be proven **against real persisted rows,
 * not fixtures** — fixtures cannot carry the mixed convention that was the
 * whole worry. This is that proof, kept as a script so it can be re-run rather
 * than believed.
 *
 * It answers four questions, and the third is the one that corrected the
 * record:
 *
 *   1. Does the app's typed write land in the same frame as `defaultNow()`?
 *   2. Does the app's typed read return the instant that was written?
 *   3. Does a RAW `mysql.createConnection` agree with them?  ← it did not
 *   4. Do the real rows already on disk agree with each other?
 *
 *   npx tsx scripts/measure-timestamp-frame.mts
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import { getDb } from "../server/db/connection";
import { castingSessions, generationOperations } from "../drizzle/schema";
import { openDatabase, utc } from "./lib/dbConnection.mts";

const db = await getDb();
if (!db) throw new Error("no database");

const VERIFY_BOT = 823;
const marker = new Date();
const publicId = randomUUID();

await db.insert(castingSessions).values({
  publicId,
  userId: VERIFY_BOT,
  originType: "roster",
  status: "abandoned",
  expiresAt: marker,
});

const bare = await mysql.createConnection(process.env.DATABASE_URL!);
const fixed = await openDatabase();

const [stored] = await bare.query<any[]>(
  `SELECT CAST(createdAt AS CHAR) AS created, CAST(expiresAt AS CHAR) AS expires
     FROM casting_sessions WHERE publicId = ?`,
  [publicId],
);
const [typed] = await db.select().from(castingSessions).where(eq(castingSessions.publicId, publicId));
const [bareRead] = await bare.query<any[]>(
  `SELECT expiresAt FROM casting_sessions WHERE publicId = ?`, [publicId]);
const [fixedRead] = await fixed.query<any[]>(
  `SELECT expiresAt FROM casting_sessions WHERE publicId = ?`, [publicId]);

const near = (date: Date) => Math.abs(date.getTime() - marker.getTime()) < 2000;
const hours = (date: Date) => ((date.getTime() - marker.getTime()) / 3_600_000).toFixed(1);

console.log(`intended instant           ${utc(marker)}`);
console.log(`\n1. SQL defaultNow wrote     ${stored[0].created}`);
console.log(`   the app's typed write     ${stored[0].expires}`);
console.log(`   SAME FRAME                ${stored[0].created.slice(0, 16) === stored[0].expires.slice(0, 16)}`);
console.log(`\n2. drizzle typed read       ${utc(typed.expiresAt!)}   correct: ${near(typed.expiresAt!)}`);
console.log(`3. raw mysql2, no timezone  ${utc(bareRead[0].expiresAt)}   correct: ${near(bareRead[0].expiresAt)}  skew ${hours(bareRead[0].expiresAt)}h`);
console.log(`   raw via openDatabase()   ${utc(fixedRead[0].expiresAt)}   correct: ${near(fixedRead[0].expiresAt)}`);

/*
  4. THE REAL ROWS. A generation operation carries a `createdAt` written by SQL
  and a `leaseExpiresAt` written by the application, minutes apart by design. If
  the two writers had ever disagreed about the frame, the gap would be hours.
*/
const ops = await db.select().from(generationOperations).limit(200);
const withLease = ops.filter((op) => op.leaseExpiresAt !== null);
const gaps = withLease.map((op) =>
  (op.leaseExpiresAt!.getTime() - op.createdAt.getTime()) / 60_000);
const wild = gaps.filter((minutes) => Math.abs(minutes) > 120);
console.log(`\n4. ${withLease.length} real rows carrying both an SQL-written and an app-written timestamp`);
if (gaps.length > 0) {
  console.log(`   lease gap min/median/max: ${Math.min(...gaps).toFixed(1)} / `
    + `${gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)].toFixed(1)} / `
    + `${Math.max(...gaps).toFixed(1)} minutes`);
}
console.log(`   rows more than 2h apart: ${wild.length}  <- a nonzero count would mean mixed conventions on disk`);

await db.delete(castingSessions).where(eq(castingSessions.publicId, publicId));
await bare.end();
await fixed.end();
process.exit(0);
