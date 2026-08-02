/**
 * What a deleted Cast takes with her from the sheet she came from.
 *
 * **The governing principle (founder ruling, 2026-08-02, D-107):**
 *
 * > Deletion purges what only the deleted thing owns, and preserves what
 * > anything living still owns.
 *
 * §G.6 said "purge source roll lineage", and that sentence was written for a
 * one-Cast world. Two Casts can be signed from one sheet, and they share
 * everything behind them: the session, the rolls, and each other's kept faces
 * as Siblings-card content. Deleting one of them must not quietly empty the
 * other's room.
 *
 * So the purge is scoped by OWNERSHIP rather than by lineage:
 *
 *   goes    her candidate's signed linkage, and the candidate row itself once
 *           nothing protects it — it was hers alone
 *   goes    every other candidate on that sheet that no living Cast claims
 *   stays   the session and its rolls, which are shared history
 *   stays   any candidate a surviving Cast still claims as a sibling
 *
 * **Liveness means `deletedAt IS NULL`, never `availableModelWhere()`** — a
 * sibling Cast whose package is still building is `provisioning`, which that
 * helper excludes. Counting her as dead would purge the faces her room is about
 * to show.
 *
 * **Concurrency.** The caller holds the session row `FOR UPDATE` before asking
 * anything here, which is the same serialization point `signCandidateIntoCast`
 * takes. A Sign racing this either committed first — and is then visible to the
 * liveness test — or waits behind us and finds its candidate no longer `ready`,
 * failing cleanly as `candidate_unavailable` with its money refunded.
 *
 * Nothing here deletes an object. Rows are moved to `expired` and the existing
 * purge feed hands their keys to the cleanup worker, exactly as retention does
 * — one vocabulary for "this candidate is releasable", not two.
 */
import { and, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";

import { castingCandidates, castingSessions, models } from "../../drizzle/schema";
import type { TransactionHandle } from "../db/connection";

export type CastLineagePurgeResult = {
  /** The session this Cast came from, or null when she has no V2 lineage. */
  sessionId: number | null;
  /** TRUE when another living Cast still comes from this sheet. */
  siblingCastsSurvive: boolean;
  /** Candidate rows released for the purge feed. */
  candidatesReleased: number;
};

function affected(result: unknown): number {
  const rows = (result as { affectedRows?: number } | [{ affectedRows?: number }])
    ?? {};
  if (Array.isArray(rows)) return rows[0]?.affectedRows ?? 0;
  return (rows as { affectedRows?: number }).affectedRows ?? 0;
}

/**
 * Runs inside the deletion transaction, after the model lock and before the
 * tombstone.
 *
 * Returns without touching anything when the Cast has no V2 lineage — a legacy
 * model has no candidate, and this is an extension to one authority rather than
 * a second deletion path that legacy Casts would now have to survive.
 */
export async function purgeCastLineageIn(
  tx: TransactionHandle,
  input: { userId: number; modelId: number; sourceCandidateId: number | null },
): Promise<CastLineagePurgeResult> {
  if (!input.sourceCandidateId) {
    return { sessionId: null, siblingCastsSurvive: false, candidatesReleased: 0 };
  }

  const [candidate] = await tx
    .select({ id: castingCandidates.id, sessionId: castingCandidates.sessionId })
    .from(castingCandidates)
    .where(and(
      eq(castingCandidates.id, input.sourceCandidateId),
      eq(castingCandidates.userId, input.userId),
    ))
    .limit(1);
  if (!candidate) {
    return { sessionId: null, siblingCastsSurvive: false, candidatesReleased: 0 };
  }

  /*
    THE SERIALIZATION POINT. Taken here rather than left to the caller so the
    lock and the questions that depend on it cannot drift apart — the Sign
    ceremony takes this same row, so after this line no new Cast can appear on
    this sheet until we commit.
  */
  await tx
    .select({ id: castingSessions.id })
    .from(castingSessions)
    .where(and(
      eq(castingSessions.id, candidate.sessionId),
      eq(castingSessions.userId, input.userId),
    ))
    .limit(1)
    .for("update");

  /*
    HER LINKAGE GOES FIRST, and the order matters: while `signedCastId` still
    points at this model the row reads as "signed" to every protection below,
    including the release statement's own guard. Clearing it is what turns her
    candidate back into an ordinary unprotected face.
  */
  await tx
    .update(castingCandidates)
    .set({ signedCastId: null })
    .where(and(
      eq(castingCandidates.id, candidate.id),
      eq(castingCandidates.userId, input.userId),
      eq(castingCandidates.signedCastId, input.modelId),
    ));

  /*
    DOES ANYTHING LIVING STILL COME FROM THIS SHEET?

    `deletedAt IS NULL` rather than `availableModelWhere()` — a sibling Cast
    mid-package is `provisioning`, and treating her as dead would purge the very
    faces her Siblings card is about to render.
  */
  const [survivor] = await tx
    .select({ id: castingCandidates.id })
    .from(castingCandidates)
    .innerJoin(models, and(
      eq(models.id, castingCandidates.signedCastId),
      eq(models.userId, input.userId),
      isNull(models.deletedAt),
    ))
    .where(and(
      eq(castingCandidates.sessionId, candidate.sessionId),
      eq(castingCandidates.userId, input.userId),
      isNotNull(castingCandidates.signedCastId),
      ne(castingCandidates.signedCastId, input.modelId),
    ))
    .limit(1);
  const siblingCastsSurvive = Boolean(survivor);

  /*
    THE RELEASE, in retention's own vocabulary (§G.6) — `expired` plus the
    reason that is never refunded, because these candidates were delivered and
    seen. The purge feed picks them up and hands their keys to the cleanup
    worker; nothing here touches an object.

    When a sibling Cast survives, the kept faces stay: they are her Siblings
    card. When none does, the sheet protects nothing and the whole unsigned
    remainder is releasable — the same rule `expireSessionCandidates` applies,
    asked the same way.
  */
  const released = await tx
    .update(castingCandidates)
    .set({ status: "expired", expiredReason: "retention" })
    .where(and(
      eq(castingCandidates.sessionId, candidate.sessionId),
      eq(castingCandidates.userId, input.userId),
      isNull(castingCandidates.signedCastId),
      inArray(castingCandidates.status, ["queued", "dispatched", "ready", "failed", "discarded"]),
      ...(siblingCastsSurvive
        ? [sql`${castingCandidates.id} = ${candidate.id} OR ${castingCandidates.keptAt} IS NULL`]
        : []),
    ));

  return {
    sessionId: candidate.sessionId,
    siblingCastsSurvive,
    candidatesReleased: affected(released),
  };
}
