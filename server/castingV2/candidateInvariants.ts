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
 *
 * # The two rows, diagnosed and cleared — 2026-08-05
 *
 * Candidates 236 and 237 (one roll, one session, one batch), signed to living
 * Casts 247 and 246, `expired` with reason `retention`. **Legacy, not a live
 * defect**, and the evidence is a demonstration rather than archaeology:
 *
 *   - **Both writers refuse, run against the real schema.** The sweep's own
 *     UPDATE, predicates and all, touched **0 rows**; the Sign claim's UPDATE
 *     claimed **0 rows**. Neither order is producible today.
 *   - **The guard that was missing is the Sign claim's `status = 'ready'`
 *     fence**, added 2026-08-02 15:22 (`dbac7383`) — inside the window these
 *     rows come from. The sweep's `signedCastId IS NULL` exemption is older
 *     than both rows (2026-07-31, `37eed80b`) and was already present in the
 *     revision that introduced `expiredReason`.
 *   - **Their timestamps cannot order the two writes.** Every one predates the
 *     D-112 skew fix (2026-08-03), so a story built from them would be a story.
 *   - **Production has never held the state**, checked the same day.
 *   - **Blast radius nil.** Both objects were still live in the bucket and the
 *     cleanup queue had never named them — `expired` never got as far as
 *     costing anything.
 *
 * The rows were corrected to `signed` with no expiry reason, which is what they
 * actually are. The tripwire reads 0 on both databases.
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
