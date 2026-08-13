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
 *   goes    her signed LINKAGE — and that is all. Her candidate returns to
 *           `ready` on a live sheet and can be signed again: the face, the row
 *           and the 20 credits that made it belong to the SHEET, bought with
 *           the roll rather than with the Sign
 *   stays   every other candidate on a sheet that is STILL OPEN; they belong to
 *           the sheet, not to her, and the sheet is a living thing
 *   stays   the session and its rolls, which are shared history
 *   stays   any candidate a surviving Cast still claims as a sibling
 *   goes    the remainder ONLY when the sheet is already dead AND no Cast
 *           survives it — the §G.6 case where her existence was the only thing
 *           keeping those faces alive
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
  const [session] = await tx
    .select({ id: castingSessions.id, status: castingSessions.status })
    .from(castingSessions)
    .where(and(
      eq(castingSessions.id, candidate.sessionId),
      eq(castingSessions.userId, input.userId),
    ))
    .limit(1)
    .for("update");
  /*
    IS THE SHEET ITSELF STILL ALIVE? This is the question the first version
    forgot to ask, and it is the whole difference between deleting a Cast and
    emptying the sheet she came from.
  */
  const sheetLive = session?.status === "open";

  /*
    SHE GOES BACK ON THE SHEET (founder ruling, 2026-08-03).

    The first version cleared her linkage and then released her with everything
    else — the candidate was consumed by the deletion. That was wrong, and the
    founder's question is the argument: *why can't it just remove her being
    signed, so you could go into the same sheet and sign her again?*

    Nothing about the candidate belonged to the Cast. Sign COPIES the chosen
    image to a new Cast-owned object (`storageCopyExact`), so deleting the Cast
    destroys the copy and leaves the sheet's own face untouched. The row, the
    image and the 20 credits that produced it are the SHEET's — bought with the
    roll, not with the Sign.

    So on a live sheet she returns to `ready`, keeps her place in the tray if
    she was kept, and can be signed again. Deleting a Cast undoes the Sign; it
    does not spend the candidate a second time.

    Order still matters: `signedCastId` must clear in the same statement that
    restores the status, or a row that is briefly `ready` while still pointing
    at a tombstoned model would be visible to anything reading in between.
  */
  /*
    AND A DEAD SHEET HAS NOWHERE TO PUT HER BACK — the founder's ghost sibling
    (fable-367 §1), read off his own rows.

    This branch used to clear `signedCastId` and leave `status` at `"signed"`,
    on the reasoning that a sheet which no longer exists cannot take her back.
    But `signed` is not a resting state; it is a claim, and the thing it claims
    had just been deleted. Three consequences, all live in production on his
    account (candidate `ea5b4811`, status `signed`, `signedCastId` NULL, no
    model row anywhere):

      1. She keeps appearing on every surviving Cast's SIBLINGS card, because
         that read is `keptAt IS NOT NULL AND status IN ('ready','signed')`.
         His words: *"it still shows up as a sibling even though the cast sheet
         is gone or deleted."*
      2. Her destination is computed from `signedCastId`, which is now null, so
         the tile falls through to the viewer — the branch written for "there is
         genuinely nowhere else to go".
      3. **She becomes immortal.** Every sweep that collects candidates lists
         `["queued","dispatched","ready","failed","discarded"]` — including the
         release ten lines below, whose own comment says *"her own candidate
         always goes"*. A row left at `signed` is in none of those lists, so the
         one row this ceremony is most certainly finished with is the only one
         it could never collect, and her objects sit in the bucket for good.

    `signed` was the only status that could be non-terminal and unswept at the
    same time, and only ever in this one situation: the Cast that justified it
    is gone. So the dead-sheet path gives her the end the retention sweep would
    have given her had she never been signed — `expired` with the reason that
    must never be refunded, because she WAS delivered and looked at.
  */
  await tx
    .update(castingCandidates)
    .set(sheetLive
      ? { signedCastId: null, status: "ready", expiredReason: null }
      : { signedCastId: null, status: "expired", expiredReason: "retention" })
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
    THE RELEASE, and its SCOPE is the thing this function got wrong first time.

    Her own candidate always goes: it was spent on her and nothing else claims
    it. What must NOT go is the rest of the sheet.

    The first version released every unsigned candidate on the session whenever
    no sibling Cast survived — borrowing `expireSessionCandidates`'s rule, which
    is written for a sheet that is EXPIRING. Applied on Cast deletion it emptied
    a sheet the user was still working on: faces they had rolled, kept and were
    about to sign, released for the purge feed because one Cast was deleted.
    The founder saw it as unsigned sheets losing their previews.

    D-107's own words are the correction — *preserve what anything living still
    owns* — and a sheet that is still open is a living thing. Its candidates
    belong to it, not to her.

    So the wider release is gated on the sheet ALSO being dead. That is the case
    §G.6 genuinely describes: an expired or abandoned session whose candidates
    survived only because a Cast was keeping them alive, and now she is gone.
  */
  /*
    NOTHING IS RELEASED WHILE THE SHEET IS ALIVE — not even her own candidate,
    which has just gone back to `ready` above.

    The release exists for one case only: a sheet that is ALREADY dead, whose
    faces survived past their expiry solely because a Cast was keeping them
    alive under §G.6. When she is deleted, that protection lapses and they
    become collectable — which is what the retention sweep would have done to
    them had she never existed.
  */
  const releaseWholeSheet = !sheetLive && !siblingCastsSurvive;
  const released = releaseWholeSheet
    ? await tx
      .update(castingCandidates)
      .set({ status: "expired", expiredReason: "retention" })
      .where(and(
        eq(castingCandidates.sessionId, candidate.sessionId),
        eq(castingCandidates.userId, input.userId),
        isNull(castingCandidates.signedCastId),
        inArray(castingCandidates.status, ["queued", "dispatched", "ready", "failed", "discarded"]),
      ))
    : null;

  return {
    sessionId: candidate.sessionId,
    siblingCastsSurvive,
    candidatesReleased: released ? affected(released) : 0,
  };
}
