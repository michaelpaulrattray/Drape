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
 * How many times the claim insert is attempted before it is given up on (#1715).
 *
 * Three, and the number is a trade rather than a default. What a lost row costs
 * is ONE uncounted signup — the window shuts one grant later for that device —
 * so this is not worth a long schedule. What it buys is latency on the signup
 * path, paid only when an insert actually fails.
 */
const CLAIM_INSERT_ATTEMPTS = 3;

/**
 * The wait before each RETRY, so the happy path pays nothing at all and a
 * connection that has just dropped gets a moment to be replaced. An immediate
 * second attempt on the same dead connection is the shape that makes a retry
 * look present and behave like none.
 *
 * Two entries for two retries; worst case adds 125 ms, and only to a signup
 * whose bookkeeping row has already failed once.
 */
const CLAIM_RETRY_DELAY_MS: readonly number[] = [25, 100];

const waitFor = (ms: number): Promise<void> =>
  new Promise((resolve) => { setTimeout(resolve, ms); });

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
 *
 * ⚠ **AND SINCE #1715 IT IS RETRIED BEFORE IT IS GIVEN UP ON — the swallow was
 * right and the single attempt was not.** The relay's note on PR #1712: *"a
 * database blip at that instant grants without a claim row — one free retry of
 * the cap, worth a sentence or a retry."* It is the one write in the two quiet
 * limits that fails OPEN by necessity, so it is the whole of the soft edge, and
 * a transient error is exactly the thing a bounded retry is for.
 *
 * **Three things about the shape, each a decision:**
 *
 *  1. **A GIVE-UP STILL DOES NOT THROW.** The reasoning above is untouched: the
 *     account exists and the credits are granted by the time this runs. What
 *     changes is how hard it tries before accepting the loss, never who pays
 *     for it.
 *  2. ⚠ **AN ABSENT DATABASE IS NOT RETRIED, AND THAT IS NOT THE SAME CASE.**
 *     `getDb()` answering nothing is a configuration state, not a blip; waiting
 *     125 ms to ask again would add that to every signup through an outage and
 *     change no answer. It keeps its own warning and returns immediately.
 *  3. ⚠ **A RETRY CAN DOUBLE-COUNT, IN ONE CASE, AND THAT DIRECTION IS THE SAFE
 *     ONE.** `free_grant_claims` has indexes and no unique key, so an insert
 *     that COMMITTED and whose acknowledgement was lost leaves a second attempt
 *     writing a second row — and the device's window then shuts one grant
 *     sooner. Every other arm of this control already chose that direction on
 *     purpose (the face-scan cap counts an attempt made past the cap, *"the safe
 *     direction … an honest account never reaches the number"*). It is also the
 *     reason the attempt count is three rather than ten: each extra attempt buys
 *     a smaller chance of recovering a row and the same chance of duplicating
 *     one.
 *
 * `dependencies.sleep` exists so the driver does not actually wait
 * (`server/freeGrantClaimRetry.test.ts`); nothing in the product passes it.
 */
export async function recordFreeGrantClaim(
  input: {
    deviceKey: string;
    ipAddress: string;
    userId: number;
  },
  dependencies: { sleep?: (ms: number) => Promise<void> } = {},
): Promise<void> {
  const sleep = dependencies.sleep ?? waitFor;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= CLAIM_INSERT_ATTEMPTS; attempt += 1) {
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
      if (attempt > 1) {
        /* Said out loud: a row that only landed on a retry is the evidence that
           this retry is doing something, and without the line a recovered blip
           is indistinguishable from a quiet night. */
        log.info(
          { userId: input.userId, attempt },
          "[quietLimits] free grant claim recorded on a retry",
        );
      }
      return;
    } catch (error) {
      lastError = error;
      if (attempt < CLAIM_INSERT_ATTEMPTS) {
        await sleep(CLAIM_RETRY_DELAY_MS[attempt - 1] ?? CLAIM_RETRY_DELAY_MS[CLAIM_RETRY_DELAY_MS.length - 1]!);
      }
    }
  }

  log.error(
    { err: lastError, userId: input.userId, attempts: CLAIM_INSERT_ATTEMPTS },
    "[quietLimits] failed to record free grant claim — giving up; this signup is not counted "
    + "against its device or network",
  );
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
