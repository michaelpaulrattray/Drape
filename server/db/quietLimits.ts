/**
 * THE TWO QUIET LIMITS' STORAGE (#1603, P1-4).
 *
 * Both counters behind a cardless free signup live here: the free-grant claims
 * and the per-account daily face-scan tally. Why each is a table rather than the
 * process-memory limiter, and why neither is derived from an existing set, is
 * argued at the declarations in `drizzle/schema.ts` and in
 * `drizzle/0071_free_signup_quiet_limits.sql` — the short version is that this
 * program deploys several times a night, so a window measured in days cannot be
 * held in a `Map`.
 *
 * ⚠ **EVERY FUNCTION HERE FAILS CLOSED WHEN THE DATABASE IS ABSENT, AND THAT IS
 * THE OPPOSITE OF THIS MODULE'S NEIGHBOURS.** The house pattern in `server/db/`
 * is to log a warning and return a benign value when `getDb()` answers nothing,
 * which is right for a read that decorates a page. These are controls, and
 * invariant 7 is explicit: a protection *"must refuse — not allow — when a
 * dependency is missing or unconfigured"*. So a signup with no database behind
 * it is refused rather than granted, and `countFreeGrantClaims` throws rather
 * than answering zero, which is the answer that would admit everybody.
 */
import { and, eq, gte, sql } from "drizzle-orm";

import { faceScanDailyUsage, freeGrantClaims } from "../../drizzle/schema";
import { getDb } from "./connection";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("db/quietLimits");

/**
 * The claims this device and this network have inside the window.
 *
 * TWO statements rather than one grouped query on purpose: they are indexed
 * differently (`idx_free_grant_claim_device` and `idx_free_grant_claim_ip`), and
 * a single query OR-ing the two predicates cannot use either index and would
 * table-scan as the table grows.
 */
export async function countFreeGrantClaims(input: {
  deviceKey: string;
  ipAddress: string;
  since: Date;
}): Promise<{ device: number; network: number }> {
  const db = await getDb();
  if (!db) {
    /* Fails closed: see the module header. The caller turns this into a plain
       refusal, so a database outage costs a signup rather than the control. */
    throw new Error("[quietLimits] database unavailable — a free grant cannot be counted");
  }

  const [device, network] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(freeGrantClaims)
      .where(and(eq(freeGrantClaims.deviceKey, input.deviceKey), gte(freeGrantClaims.createdAt, input.since))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(freeGrantClaims)
      .where(and(eq(freeGrantClaims.ipAddress, input.ipAddress), gte(freeGrantClaims.createdAt, input.since))),
  ]);

  return { device: Number(device[0]?.n ?? 0), network: Number(network[0]?.n ?? 0) };
}

/**
 * Record a grant that was MADE. Never called for a refusal — a refusal writes
 * an audit row, and counting refusals here would make the window shut harder
 * the more it was tested.
 *
 * ⚠ **A FAILURE HERE IS LOGGED AND SWALLOWED, WHICH IS THE ONE PLACE THIS
 * MODULE DOES NOT FAIL CLOSED, AND IT IS DELIBERATE.** By the time this runs
 * the account exists and the credits are granted. Throwing would hand the
 * customer an error over a bookkeeping row and leave her unable to sign in to
 * an account she now owns; the honest cost of a lost row is that one future
 * grant from that device is not counted.
 */
export async function recordFreeGrantClaim(input: {
  deviceKey: string;
  ipAddress: string;
  userId: number;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      log.warn({ userId: input.userId }, "[quietLimits] no database — free grant claim not recorded");
      return;
    }
    await db.insert(freeGrantClaims).values({
      deviceKey: input.deviceKey,
      ipAddress: input.ipAddress,
      userId: input.userId,
    });
  } catch (error) {
    log.error({ err: error, userId: input.userId }, "[quietLimits] failed to record free grant claim");
  }
}

/**
 * Count one face scan against the account's day and hand back the new total.
 *
 * ⚠ **THE INCREMENT IS ONE STATEMENT AND IT COMES BEFORE THE DECISION.** A read
 * followed by a write would lose a count whenever two scans landed together
 * (invariant 1's shape pointed at a counter: the check belongs in the statement
 * that writes), so this is a single `INSERT … ON DUPLICATE KEY UPDATE` against
 * the `uq_face_scan_day` key.
 *
 * Counting before deciding means an attempt made PAST the cap is counted too, so
 * the day stays shut rather than reopening on the next request. That is the safe
 * direction and it costs an honest account nothing, because an honest account
 * never reaches the number.
 *
 * The follow-up `SELECT` cannot under-read: this connection's own increment has
 * already committed, so the value it sees is at least the caller's own. Under
 * concurrency it may read a LARGER number than the caller caused, which refuses
 * sooner — again the safe direction.
 */
export async function countFaceScanAgainstDay(input: {
  userId: number;
  day: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("[quietLimits] database unavailable — a face scan cannot be counted");
  }

  await db
    .insert(faceScanDailyUsage)
    .values({ userId: input.userId, day: input.day, scans: 1 })
    .onDuplicateKeyUpdate({ set: { scans: sql`${faceScanDailyUsage.scans} + 1` } });

  const row = await db
    .select({ scans: faceScanDailyUsage.scans })
    .from(faceScanDailyUsage)
    .where(and(eq(faceScanDailyUsage.userId, input.userId), eq(faceScanDailyUsage.day, input.day)))
    .limit(1);

  /*
    The row was just written, so an absent one is not "no scans today" — it is a
    read that did not work. Answering 0 would be a cap that admits everybody the
    moment this read fails, so it throws and the caller refuses the scan.
  */
  const scans = row[0]?.scans;
  if (scans === undefined) {
    throw new Error("[quietLimits] the face-scan tally could not be read back after its own write");
  }
  return scans;
}
