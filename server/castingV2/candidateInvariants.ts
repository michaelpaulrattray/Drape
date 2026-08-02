/**
 * States the candidate laws forbid, watched for rather than assumed away.
 *
 * **Why this exists.** Two rows turned up on dev in a state no law permits: a
 * candidate both `signed` to a living Cast and `expired`. Every writer of
 * `expired` guards `signedCastId IS NULL` — in the WHERE of the statement that
 * writes, not in a check before it — so today's code provably cannot produce
 * it, and the rows were traced to an intermediate build during a day of rapid
 * iteration.
 *
 * "It cannot happen any more" without a tripwire is exactly how it happens
 * again quietly. So the invariant gets a standing check instead of a memory.
 *
 * **It is inert by design.** It reads, it counts, it alarms. It repairs
 * nothing: a row in a forbidden state is evidence, and a sweep that silently
 * tidied evidence away would destroy the only trace of whatever wrote it.
 *
 * The alarm takes the roll alarm's shape (`rollService`'s
 * PROVIDER ACCOUNT UNUSABLE) for the same reason that one does — it says *stop
 * and look at the plumbing*, not "something was wrong with this Cast".
 */
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { castingCandidates, models } from "../../drizzle/schema";
import { getDb } from "../db/connection";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/candidateInvariants");

export type CandidateInvariantReport = {
  /** Signed to a living Cast, yet released for the purge feed. Forbidden. */
  expiredWhileSigned: number;
  /** TRUE when nothing is wrong, which is the only acceptable resting state. */
  ok: boolean;
};

/**
 * One pass. Cheap enough to run beside the retention sweep.
 *
 * Scoped to candidates whose Cast is LIVING (`deletedAt IS NULL`): a tombstoned
 * Cast's candidate has had its linkage cleared by the lineage purge (D-107), so
 * a leftover pointing at a dead model is a different question and not this one.
 */
export async function checkCandidateInvariants(): Promise<CandidateInvariantReport> {
  const db = await getDb();
  if (!db) return { expiredWhileSigned: 0, ok: true };

  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(castingCandidates)
    .innerJoin(models, and(
      eq(models.id, castingCandidates.signedCastId),
      isNull(models.deletedAt),
    ))
    .where(and(
      isNotNull(castingCandidates.signedCastId),
      eq(castingCandidates.status, "expired"),
    ));

  const expiredWhileSigned = Number(row?.n ?? 0);
  if (expiredWhileSigned > 0) {
    /*
      Error, not warn. A signed candidate is the durable link between a Cast and
      the sheet she came from; `expired` is the state that hands a row to the
      purge feed. The two together mean either a writer has lost its guard or
      something wrote the column directly — both are "stop and look", and
      neither is visible from the product surface.
    */
    log.error(
      { expiredWhileSigned },
      "[candidateInvariants] FORBIDDEN STATE — candidates are signed to a living Cast AND expired; "
      + "no writer may produce this, so a guard has been lost or a row was written outside the code",
    );
  }
  return { expiredWhileSigned, ok: expiredWhileSigned === 0 };
}
