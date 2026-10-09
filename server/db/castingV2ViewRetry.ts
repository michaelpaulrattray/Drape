/**
 * THE DURABLE HALF OF A TRY AGAIN — one view of a LIVE Cast, asked for again
 * (#1208 slice 2, #1220 slice 2).
 *
 * His rule, verbatim (2026-09-25): *"you pay 50 for each view you keep."*
 *
 * Three statements, and each is here rather than in the service because each
 * is an ownership proof:
 *
 * - {@link readCastViewRenderSource} re-derives what a view of this Cast is
 *   composed from, from the Cast's OWN durable rows. Nothing is carried over
 *   from the Sign in memory — the Sign finished days ago.
 * - {@link commitRetriedViewAsset} lands the new picture under a fence, and
 *   the fence is this operation being `running`, exactly as the Sign's commit
 *   is fenced on its own.
 * - {@link retriedViewLanded} answers the recovery adjudicator's only
 *   question, from the asset rows rather than from anything a dead process
 *   believed.
 *
 * ⚠ **THE SIGN'S OWN COMMIT CANNOT BE REUSED AND THE REASON IS THE POINT:**
 * `commitPackageSlotAsset` requires `models.status = 'provisioning'`, which is
 * true only while the Sign is in flight. A Try again happens on an `active`
 * Cast, so it needs its own statement — and a statement that relaxed the
 * Sign's to cover both would have relaxed a live money path to serve a new
 * one.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";

import {
  castingCandidateVariants,
  castingCandidates,
  castingRolls,
  creditTransactions,
  generationOperations,
  modelAssets,
  models,
} from "../../drizzle/schema";
import { CAST_VIEW_ANGLES, type CastViewAngle } from "../../shared/boardTypes";
import { refundReferenceFor, type RefundOutcome } from "../casting/atomicCredits";
import { refusedSheetViewRefund } from "../casting/flatPressCharge";
import { identityStampFor } from "../casting/identity/anchorSelector";
import {
  castViewSubjectHash,
  derivedClientRequestId,
  VIEW_REPLACING_OPERATION_KINDS,
} from "../casting/operationContract";
import { getDb, withTransaction } from "./connection";
import { addCreditsIn } from "./credits";

/** A positive integer id, or a throw — the same assertion `castingV2Sign` makes
 *  at every entrance, said here because this module has its own. */
function assertPositiveId(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
}

/**
 * WHAT A VIEW OF THIS CAST IS COMPOSED FROM, read at her own rows.
 *
 * `anchorDeltas` and `selectedVariantId` name THE BRANCH the Sign was quoted
 * against, and re-reading them later is safe rather than lucky: a signed
 * candidate is `status: 'signed'`, and both writers that could move the
 * selection are shut against it — `selectVariant` requires `status: 'ready'`
 * and `refineService` refuses a signed candidate outright (`already_signed`).
 * **The branch is frozen at Sign, read at the code rather than assumed** —
 * which is what lets a Try again render the same woman the other views hold.
 */
export type CastViewRenderSource = {
  modelId: number;
  /**
   * The Cast's OWN copy of the signed face — never the candidate's object,
   * which purges with its sheet.
   */
  anchorStorageKey: string;
  /**
   * Both from the anchor's identity stamp, which is where the Sign sealed
   * them. Re-deriving either from anywhere else could stamp a retried view
   * with an identity the Cast's own anchor does not carry.
   */
  identityRevisionId: string;
  identityText: string;
  /**
   * Her technical schema — the pronouns and the outfit are DERIVED from it by
   * the same two functions the Sign used, never re-resolved another way.
   */
  technicalSchema: unknown;
  /**
   * WHAT SHE WAS CAST AS — the brief text of the roll she came from (#1278
   * part 1), read through the Cast's own `sourceRollId` in the statement below.
   *
   * A retried view has to send the SAME description the original five were
   * composed from, or a Try again silently renders a different prompt from the
   * slot it replaces — the unkeyed-half class. `null` for a Cast with no source
   * roll (read at the rows 2026-09-26: 4 of 6 minted casts), whose views then
   * compose exactly what they composed before this existed.
   */
  briefText: string | null;
  /**
   * The candidate whose delivered ink crops the views carry. Null for a Cast
   * whose source row is gone; her views then compose exactly what a Cast with
   * no crops composes.
   */
  candidateId: number | null;
  candidatePublicId: string | null;
  selectedVariantId: number | null;
  /**
   * Which tattoos that branch wears — the variant's deltas, or the
   * candidate's own when it was never refined.
   */
  anchorDeltas: unknown;
};

export async function readCastViewRenderSource(
  userId: number,
  modelId: number,
): Promise<CastViewRenderSource | null> {
  assertPositiveId(userId, "userId");
  assertPositiveId(modelId, "modelId");
  const db = await getDb();
  if (!db) return null;

  /*
    The Cast, owner-scoped in the statement that reads her (invariant 1) and
    proved LIVE here rather than by a caller: a Try again on an archived or
    deleted Cast is a render nobody can be shown.
  */
  const [model] = await db
    .select({
      id: models.id,
      technicalSchema: models.technicalSchema,
      sourceCandidateId: models.sourceCandidateId,
      sourceRollId: models.sourceRollId,
    })
    .from(models)
    .where(and(
      eq(models.id, modelId),
      eq(models.userId, userId),
      eq(models.status, "active"),
      isNull(models.deletedAt),
    ))
    .limit(1);
  if (!model) return null;

  /*
    THE ANCHOR IS THE IDENTITY RECORD AS WELL AS THE PICTURE.

    `role: 'anchor'` is the Sign's own stamp on the 1K frontClose, and all
    three fields are read off it in one statement for the reason the Sign
    reads its face and its documents in one: taking the picture from one place
    and the record from another is how a view comes to be stamped with an
    identity that is not the one it holds.
  */
  const anchorRows = await db
    .select({
      id: modelAssets.id,
      storageKey: modelAssets.storageKey,
      provenance: modelAssets.provenance,
    })
    .from(modelAssets)
    .where(and(
      eq(modelAssets.modelId, model.id),
      eq(modelAssets.viewType, "frontClose"),
      eq(modelAssets.resolution, "1K"),
    ))
    .orderBy(modelAssets.id);
  const anchor = anchorRows.find((row) => {
    const provenance = row.provenance as { identityRole?: unknown } | null;
    return Boolean(row.storageKey) && provenance?.identityRole === "anchor";
  });
  const stamp = anchor?.provenance as
    | { identityRevisionId?: unknown; identityText?: unknown }
    | null
    | undefined;
  if (
    !anchor?.storageKey
    || typeof stamp?.identityRevisionId !== "string"
    || typeof stamp.identityText !== "string"
  ) {
    return null;
  }

  /*
    WHAT SHE WAS CAST AS (#1278 part 1) — her roll's brief text, owner-scoped in
    the statement that reads it AND re-anchored to this Cast's own pointer, so a
    `sourceRollId` that has been re-used resolves to nothing rather than to
    another customer's words (invariants 1 and 2, the same shape as the branch
    join below). `null` for a Cast with no source roll, which composes exactly
    what it composed before this field existed.
  */
  let briefText: string | null = null;
  if (model.sourceRollId) {
    const [roll] = await db
      .select({ briefText: castingRolls.briefText })
      .from(castingRolls)
      .where(and(
        eq(castingRolls.id, model.sourceRollId),
        eq(castingRolls.userId, userId),
      ))
      .limit(1);
    briefText = roll?.briefText ?? null;
  }

  const base: CastViewRenderSource = {
    modelId: model.id,
    anchorStorageKey: anchor.storageKey,
    identityRevisionId: stamp.identityRevisionId,
    identityText: stamp.identityText,
    technicalSchema: model.technicalSchema,
    briefText,
    candidateId: null,
    candidatePublicId: null,
    selectedVariantId: null,
    anchorDeltas: null,
  };
  if (!model.sourceCandidateId) return base;

  /*
    The branch, owner-scoped on BOTH sides of the join rather than trusted from
    the candidate's own pointer (invariant 2 — `getSignableCandidate`'s reason,
    said again because this is a second reader of the same pair). The candidate
    is additionally re-anchored to THIS Cast, so a source pointer that has been
    re-used resolves to nothing rather than to another Cast's branch.
  */
  const [source] = await db
    .select({
      candidateId: castingCandidates.id,
      candidatePublicId: castingCandidates.publicId,
      variantId: castingCandidateVariants.id,
      variantDeltas: castingCandidateVariants.deltas,
    })
    .from(castingCandidates)
    .leftJoin(castingCandidateVariants, and(
      eq(castingCandidateVariants.id, castingCandidates.selectedVariantId),
      eq(castingCandidateVariants.userId, userId),
      eq(castingCandidateVariants.candidateId, castingCandidates.id),
      eq(castingCandidateVariants.status, "ready"),
    ))
    .where(and(
      eq(castingCandidates.id, model.sourceCandidateId),
      eq(castingCandidates.userId, userId),
      eq(castingCandidates.signedCastId, model.id),
    ))
    .limit(1);
  if (!source) return base;

  return {
    ...base,
    candidateId: source.candidateId,
    candidatePublicId: source.candidatePublicId,
    selectedVariantId: source.variantId ?? null,
    /*
      The variant wins where it exists, together with the id above — never one
      from the branch and the other from the original. An unrefined candidate
      has NO deltas column to read: the pristine master wears nothing, which is
      `null` here exactly as it is in `getSignableCandidate`.
    */
    anchorDeltas: source.variantId !== null ? source.variantDeltas : null,
  };
}

/**
 * THIS COMMIT FAILED, AND IT IS NOT A FENCE.
 *
 * The distinction this class exists to carry is the whole of #1903's review
 * finding 1: a `null` from the commit below means *another process owns this
 * operation's money*, and anything else going wrong means *nobody does*. The
 * two have opposite correct answers — leave it alone, versus refund it — and
 * for as long as they shared one return value the second was answered with the
 * first's behaviour and a customer paid for a picture that never existed.
 *
 * It extends `Error` and nothing more. `renderViewAttempts` classifies a
 * non-`ProviderError` throw as `unknown`, and `mayStillArrive("unknown")` is
 * deliberately TRUE (`providers/types.ts`) — so the loop re-attempts and then
 * fails the slice, which is exactly the handling a lost commit wants. Making
 * this a `ProviderError` to be tidy would hand it a failure class it has not
 * got and could change that decision.
 */
export class RetriedViewCommitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetriedViewCommitError";
  }
}

/**
 * Land a retried view on a LIVE Cast.
 *
 * Returns the new asset's id, or `null` when A FENCE REFUSED — and that is
 * now the only thing `null` can mean.
 *
 * ⚠ **THERE ARE TWO FENCES AND BOTH ANSWER ONE QUESTION: does this process
 * still own the money?** This operation being `running` is the first. The
 * second, for a slot of a flat-priced press, is the PRESS being `running`
 * (#1903 review finding 1) — the money is on that row, so a slot whose press
 * the sweep has already refunded must not land its picture. Both are proven
 * inside the transaction that inserts, never before it.
 *
 * ⚠ **IT MEANT FOUR THINGS UNTIL #1903's REVIEW, AND THREE OF THEM LOST A
 * CUSTOMER'S MONEY.** `renderViewAttempts` reads `null` as *fenced* — "this
 * operation is no longer `running`, so a sweep owns its money" — and both
 * callers then seal a receipt WITHOUT A REFUND on that reading, because a
 * refund under a reference the sweep is about to use is how one failure
 * becomes two. That reasoning is right about a real fence and catastrophic
 * about anything else: this function also answered `null` for a model that is
 * gone, for an insert that returned no id, and — the reachable one — **for any
 * error thrown inside the transaction**, in every case while the operation was
 * still `running` and therefore owned by nobody. The service closed it
 * `succeeded`, charged, nothing refunded, and because the row was then
 * terminal the sweep never looked at it again.
 *
 * **So the fence keeps `null` and everything else THROWS.** A throw lands in
 * the attempt loop's catch, which drops the stored bytes and counts an arrival
 * failure exactly as a failed render does — and the loop's `failed` exit is the
 * one that refunds. The money follows the picture again.
 *
 * ⚠ **The reachable road is the transaction error, and THIS road makes it
 * likelier than any other.** A redo is FIVE of these transactions at once
 * (#1903), each taking `.for("update")` on the same `models` row, so a lock
 * wait or a deadlock here is a designed-in concurrency shape rather than a
 * freak. `!model` is inert today by construction and stays checked anyway:
 * `finalCastDeletion.ts` refuses to delete a Cast carrying a `claimed`,
 * `running` or `recovery_required` operation, transactionally and under a row
 * lock, so a customer pressing *Delete this cast* mid-redo meets *"This Cast
 * still has work in progress"* and never reaches here.
 *
 * ⚠ **IT INSERTS, IT NEVER UPDATES.** `slotEvidence` takes the NEWEST filled
 * asset per angle, so a new row supersedes whatever was in the slot — a
 * failure marker, or a delivered view nobody judged. The old row stays as the
 * record of what happened, which is the repo's settled selection law.
 *
 * ⚠ **The one exception is its OWN row (#2065)**: a second commit for the same
 * operation — a replay after a lost acknowledgement — never inserts again. It
 * moves that operation's existing row onto the replay's live bytes and returns
 * its id. Another operation's row is never touched.
 */
export async function commitRetriedViewAsset(input: {
  userId: number;
  operationId: string;
  modelId: number;
  angle: CastViewAngle;
  storageKey: string;
  storageUrl: string;
  identityRevisionId: string;
  identityText: string;
  pointsCost: number;
  provenance: Record<string, unknown>;
  /**
   * THE ROW THE MONEY IS ON, when this view is one slot of a flat-priced
   * press (#1903). Absent on the Try again, whose charge is its own row.
   *
   * ⚠ **IT IS A NAMED INPUT AND NOT READ OUT OF `provenance`, deliberately.**
   * The same id is written into the provenance bag below for the sweep to read
   * back, but a FENCE must not be keyed on a free-form `Record<string,
   * unknown>` a caller composes: a typo there would not fail — it would
   * silently skip the fence and read as this road being unfenced, which is the
   * defect itself wearing the repair's clothes. In the signature the type
   * system asks for it.
   */
  pressOperationId?: string;
}): Promise<number | null> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  /* NO try/catch. A thrown transaction error is this commit's loudest signal
     and swallowing it into `null` is what made a lost picture read as a
     settled one — see the header. The attempt loop above us owns it. */
  return await withTransaction(async (tx) => {
    const [operation] = await tx
      .select({ id: generationOperations.id })
      .from(generationOperations)
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
        /*
          THE FENCE ADMITS EITHER ROAD THAT MAY REPLACE A VIEW, FROM THE ONE
          DECLARED SET (#1903).

          ⚠ **It carried the retry kind as a literal, and a second kind
          arriving beside a hard-coded one fails in the worst direction
          available here.** A redo's commit would return `null`, which
          `renderViewAttempts` reads as FENCED — "this process is no longer
          the authority" — so the service would hand the slice to the sweep,
          the sweep would find no asset under the operation and refund it,
          and the picture that actually rendered would be thrown away. The
          customer would watch five renders happen and get nothing, refunded.
          The set is read rather than respelled for exactly that reason.
        */
        inArray(generationOperations.kind, [...VIEW_REPLACING_OPERATION_KINDS]),
        eq(generationOperations.status, "running"),
        /*
          ⚠ **AND THE SWEEP HAS NOT TAKEN IT (#2073).** `running` alone was not
          a fence against the sweep, because the sweep does not move a row out
          of `running` until it SEALS — and it seals after it has read *did a
          picture land* and recorded its refund. A Try again whose lease lapsed
          (its heartbeat latches on its first failure and never renews) was
          claimed, read as *nothing landed* — true, nothing had YET — refunded,
          and only then sealed; a commit in between was admitted, because the
          row was still `running`. **She kept the view AND the 50 credits.**

          The claim is the one write the sweep makes before it reads anything
          (`claimRecoveryAttempt` stamps `recoveryAttemptedAt`, and nothing on
          the live road ever writes it), so this clause turns the claim INTO the
          fence, with no migration and no second status. The row lock does the
          rest in both orders: a commit already holding this `FOR UPDATE` makes
          the claim's UPDATE wait until the picture is committed, so the sweep's
          read then sees it; a claim that got there first is read here as the
          latest committed version (a locking read), so the commit is refused.
          Either way no refund can be written for a view that landed.

          ⚠ **Refusal here means the sweep owns the money, which is exactly what
          `null` has always meant.** The Try again's fenced exit hands the lease
          over and writes no receipt; the redo's slot already did. A sweep that
          throws after claiming leaves the row `running` and stamped, so the
          live process is refused from then on and the next pass settles it —
          the direction that fails closed. It holds for a redo's slot too, which
          is its own operation; a PRESS is never this clause's subject (its
          slots land under their own ids), so its deferred pass, which also
          stamps it, cannot refuse them.
        */
        isNull(generationOperations.recoveryAttemptedAt),
      ))
      .limit(1)
      .for("update");
    if (!operation) return null;

    /*
      ⚠ **THE PRESS THAT HOLDS THE MONEY IS FENCED TOO, IN THIS SAME
      TRANSACTION (#1903 review finding 1).**

      A flat-priced press keeps its charge on ONE row and spends it on five
      slots. Each slot's own fence above proves *this slot* is still ours; it
      says nothing about whether the row the money sits on is still alive. The
      gap that leaves is a customer paid twice over:

      - the press's lease lapses (its heartbeat latches on its first failure
        and never renews again — `startOperationHeartbeat`, and the lease is
        five minutes while two sheets, a house re-make and the spaced arrival
        attempts can plausibly run past it);
      - the sweep reads `pressViewLanded` = false, because nothing has
        committed YET, refunds the whole press and finalizes it failed;
      - the slots then commit anyway, and **she keeps the new views as well as
        the credits.** Nothing claws a recorded refund back.

      ⚠ **IT IS CHECKED IN THE STATEMENT THAT WRITES, which is invariant 1 and
      not decoration.** A `SELECT` for the press followed by this insert is the
      same check-then-write race one lease-expiry wide; `.for("update")` inside
      the slot's own transaction is what makes the reading hold until the row
      lands.

      ⚠ **AND A REFUSAL HERE IS A FENCE — `null`, not a throw.** `null` means
      *another process owns this operation's money*, which is exactly true: the
      sweep has already settled the press. So the attempt loop seals without a
      refund, because the refund has happened. Throwing would take the loop's
      `failed` exit and refund a second time under a reference the sweep has
      used — one failure becoming two, which is the whole reason the two
      meanings were separated in the header above.

      The Try again road passes no `pressOperationId`: its money row is its own
      operation, fenced above. ⚠ This line said that made it *immune*, and it
      was not — `running` was no fence against a sweep that had claimed the row
      and not yet sealed it (#2073), which is what the claim clause above
      closes.
    */
    if (input.pressOperationId !== undefined) {
      const [press] = await tx
        .select({ id: generationOperations.id })
        .from(generationOperations)
        .where(and(
          eq(generationOperations.id, input.pressOperationId),
          eq(generationOperations.userId, input.userId),
          eq(generationOperations.status, "running"),
        ))
        .limit(1)
        .for("update");
      if (!press) return null;
    }

    const [model] = await tx
      .select({ id: models.id })
      .from(models)
      .where(and(
        eq(models.id, input.modelId),
        eq(models.userId, input.userId),
        eq(models.status, "active"),
        isNull(models.deletedAt),
      ))
      .limit(1)
      .for("update");
    if (!model) {
      /* NOT a fence — the operation is still `running`, so nothing else is
         coming to settle it. Throwing hands it to the attempt loop, whose
         failed exit refunds the slice and leaves the picture the customer
         already had. Inert today: deletion refuses over an unsettled
         operation (header). */
      throw new RetriedViewCommitError(
        "the Cast is no longer live, so a retried view cannot land on it",
      );
    }

    /*
      ⚠ **ONE OPERATION LANDS ONE PICTURE, AND A REPLAY IS ANSWERED BY THE ROW
      ALREADY THERE (#2065).**

      The shape this closes: a write whose durability is reported by a channel
      that can fail AFTER the write succeeded. This transaction commits, the
      acknowledgement is lost on the wire, the helper throws while the row
      exists — and `renderViewAttempts` reads the throw as "nothing landed".
      On the sheet road (a redo's slot) a throw is retried on purpose, because
      re-storing a settled panel costs no engine call, so the next attempt
      arrived here and inserted a SECOND asset for one operation.

      **The key is the typed `input.operationId`**, read back through the same
      `retryOperationId` stamp `retriedViewLanded` reads, and that stamp is
      now written by THIS statement from the typed input (below) rather than
      trusted from the caller's bag. No migration: the operation row's
      `FOR UPDATE` above already serialises every commit for one operation,
      and the `models` lock serialises every commit for one Cast, so this
      locking read sees whatever an earlier attempt committed.

      ⚠ **IT REPOINTS RATHER THAN NO-OPS, and the reason is in the loop, not
      here.** The attempt that lost its acknowledgement then ran the loop's
      catch, which DROPS that attempt's stored bytes
      (`packageOrchestrator.ts`, `if (stored) await drop(stored.key)`). So the
      row already here points at an object that has just been deleted, and
      answering its id unchanged would deliver a broken picture. The replay's
      bytes are live and are the same settled panel, so the row is moved onto
      them and its id is returned — one row, live bytes, delivered.

      It runs AFTER both fences on purpose: a replay of an operation the sweep
      has since claimed is refused as a fence, and the sweep's own landed read
      finds this row and charges for it.

      ⚠ **Two different operations on one angle still both land** — a newer
      Try again superseding an older view is behaviour the room relies on
      (`slotEvidence` takes the newest filled asset per angle), and the key is
      the operation, never the angle alone.
    */
    const sameAngle = await tx
      .select({
        id: modelAssets.id,
        storageKey: modelAssets.storageKey,
        provenance: modelAssets.provenance,
      })
      .from(modelAssets)
      .where(and(
        eq(modelAssets.modelId, input.modelId),
        eq(modelAssets.viewType, input.angle),
      ))
      .orderBy(modelAssets.id)
      .for("update");
    const already = sameAngle.find((row) => {
      const provenance = row.provenance as { retryOperationId?: unknown } | null;
      return provenance?.retryOperationId === input.operationId;
    });
    if (already) {
      if (already.storageKey !== input.storageKey) {
        await tx
          .update(modelAssets)
          .set({ storageKey: input.storageKey, storageUrl: input.storageUrl })
          .where(and(
            eq(modelAssets.id, already.id),
            eq(modelAssets.modelId, input.modelId),
          ));
      }
      return already.id;
    }

    const [inserted] = await tx
      .insert(modelAssets)
      .values({
        modelId: input.modelId,
        viewType: input.angle,
        // §H.10: signed package views are 2K, whoever asked for them.
        resolution: "2K",
        storageUrl: input.storageUrl,
        storageKey: input.storageKey,
        pointsCost: input.pointsCost,
        pinned: false,
        provenance: {
          ...input.provenance,
          /*
            `display`, never `anchor` — the signed original stays the identity
            authority, exactly as it does for a Sign's own views.
          */
          ...identityStampFor({
            role: "display",
            revisionId: input.identityRevisionId,
            identityText: input.identityText,
          }),
          /*
            THE REPLAY KEY, written from the TYPED input and last, so no bag a
            caller composes can omit or misspell it (#2065). Both callers
            already wrote this same value; it is the read above that now
            depends on it, and a fence-shaped read must not be keyed on a
            free-form field.
          */
          retryOperationId: input.operationId,
        },
      })
      .$returningId();
    /* Same reasoning as the model road: an insert that produced no id is this
       process failing, not another process winning. */
    if (!inserted?.id) {
      throw new RetriedViewCommitError("the retried view's asset insert returned no id");
    }
    return inserted.id;
  });
}

/**
 * WHICH VIEWS ARE BEING ASKED FOR RIGHT NOW — the busy read (#1235).
 *
 * His three reports, and all three are this one fact missing: the tile said
 * *"Asking…"* instead of going into the casting state every other view being
 * made uses; one Try again disabled the other tiles; and leaving the page and
 * coming back showed a button over a render that was still running — where a
 * second press **charged a second time**, because the offer is re-read off the
 * slot and the slot knew nothing about the operation.
 *
 * So busy becomes SERVER TRUTH, per slot (D-161). One statement, read by the
 * projection the room is shown AND by the entrance that spends the money, so
 * the button and the till cannot disagree.
 *
 * ⚠ **THE ANGLE IS NOT A COLUMN, AND THE CARD SAID IT WAS.** #1235 says "read
 * at the rows, the same way the Sign's own building state is" — read at the
 * code, `generation_operations` stores `payloadHash` and **no payload**, and
 * the Sign's building state is the MODEL's `provisioning` status, which is
 * cast-level and cannot say which of five slots. What the row does carry is
 * the hash of the claim's subject, which is exactly "this Cast, this view":
 * {@link castViewRetrySubjectHash} recomputes it for each angle from the same
 * payload builder the entrance claims with, so nothing is mirrored and a
 * changed payload shape reddens a test rather than silently reopening the
 * double charge.
 *
 * ⚠ **LEASE EXPIRY IS DELIBERATELY NOT A FILTER.** A dead operation's rows stay
 * non-terminal until the recovery sweep settles them (~6 minutes, and that
 * window is a documented, accepted cost). Treating an expired lease as "not
 * busy" would offer a paid Try again against a slot whose charge is still
 * unsettled and whose picture may yet be adjudicated as landed. The slot comes
 * back by itself the moment the sweep finishes, and the customer's money is
 * never the thing that pays for our impatience.
 *
 * ⚠ **`recovery_required` IS NOT BUSY, and that is the other direction of the
 * same judgement.** The sweep has already given up on those and support must
 * settle them; holding the slot as "being made" would be a lie about a render
 * that will never happen, and it would leave the customer unable to ask for
 * the view they still do not have.
 */
export const RUNNING_VIEW_RETRY_STATUSES = ["claimed", "running"] as const;

/**
 * The filter, exported so its WHERE clause can be read at the wire rather than
 * described beside it (invariant 5). Every arm of it is load-bearing: the user
 * scopes ownership, the model scopes the Cast, the kind keeps other operations
 * out, and `subjectDeletedAt` keeps a deleted Cast's receipts from making a
 * new Cast's slot look busy.
 */
export function runningViewRetryFilter(input: { userId: number; modelId: number }) {
  return and(
    eq(generationOperations.userId, input.userId),
    eq(generationOperations.modelId, input.modelId),
    /*
      EITHER ROAD THAT MAY BE REPLACING THIS VIEW RIGHT NOW (#1903) — one
      declared set, the same one the commit fence reads.

      A redo renders all five views, so while one is in flight every slot IS
      being made. Left on the retry kind alone this read answered "nothing is
      running" through the whole redo: the room would draw five ready tiles
      with a Try again under each, over five renders in flight, and a press
      would charge against a slot already being replaced — #1235's double
      charge arriving by a new door.
    */
    inArray(generationOperations.kind, [...VIEW_REPLACING_OPERATION_KINDS]),
    inArray(generationOperations.status, [...RUNNING_VIEW_RETRY_STATUSES]),
    isNull(generationOperations.subjectDeletedAt),
  );
}

/**
 * The angles of this Cast that have a Try again in flight, newest state of the
 * world, read at the operation rows.
 *
 * Returns [] when the database is unavailable, which is the same answer as "no
 * retry is running" — and that direction is stated rather than accidental: the
 * projection would then offer a Try again, and the ENTRANCE makes this same
 * read again before it claims. A database that cannot answer refuses the spend
 * elsewhere (the frozen-account read is the first statement the entrance
 * makes), so an empty answer costs a tile its skeleton, never a second charge.
 */
export async function listRunningViewRetryAngles(input: {
  userId: number;
  modelId: number;
  castId: string;
}): Promise<CastViewAngle[]> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ payloadHash: generationOperations.payloadHash })
    .from(generationOperations)
    .where(runningViewRetryFilter({ userId: input.userId, modelId: input.modelId }));
  if (rows.length === 0) return [];
  const running = new Set(rows.map((row) => row.payloadHash));
  /*
    ONE HASH PER (ROAD, ANGLE), because the kind is mixed into the hash.

    The filter above admits both kinds, so matching on the retry's hash alone
    would widen the query and narrow the answer in the same breath — a redo's
    rows would come back and then match nothing. The candidate hashes are
    DERIVED from the same declared set the filter uses, so a third road added
    to that set is seen here with no edit.
  */
  return CAST_VIEW_ANGLES.filter((angle) => VIEW_REPLACING_OPERATION_KINDS.some((kind) =>
    running.has(castViewSubjectHash({
      kind,
      modelId: input.modelId,
      castId: input.castId,
      angle,
    }),
  )));
}

/**
 * Did this Try again already land a picture?
 *
 * The recovery adjudicator's whole question, and it is answerable from the
 * asset rows because the retried asset stamps its own operation id. So a sweep
 * decides whether the credits bought something without trusting anything the
 * dead process believed — D-92's rule, applied to a smaller fork.
 */
export async function retriedViewLanded(input: {
  userId: number;
  modelId: number;
  operationId: string;
}): Promise<boolean> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ provenance: modelAssets.provenance })
    .from(modelAssets)
    .innerJoin(models, and(
      eq(models.id, modelAssets.modelId),
      eq(models.userId, input.userId),
    ))
    .where(eq(modelAssets.modelId, input.modelId));
  return rows.some((row) => {
    const provenance = row.provenance as { retryOperationId?: unknown } | null;
    return provenance?.retryOperationId === input.operationId;
  });
}

/**
 * DID ANY VIEW OF THIS PRESS LAND? — the money question a flat-priced redo
 * asks, and the only one it asks (#1903, his word of 2026-10-08).
 *
 * {@link retriedViewLanded} answers *did a picture land under this OPERATION*,
 * which is right for a road where every slot carries its own slice. Under one
 * flat charge the question moved up a level: credits come back only when
 * nothing could be delivered at all, so the sweep has to see the whole press.
 *
 * ⚠ **IT READS THE SAME ROWS AND THE SAME PROVENANCE, one key along.**
 * Every slot of a redo writes `pressOperationId` beside its own
 * `retryOperationId`, so this is the sibling reader rather than a second
 * source of truth — and a press whose slots all failed has no asset naming
 * it, which is exactly the state that owes a refund.
 */
export async function pressViewLanded(input: {
  userId: number;
  modelId: number;
  pressOperationId: string;
}): Promise<boolean> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ provenance: modelAssets.provenance })
    .from(modelAssets)
    .innerJoin(models, and(
      eq(models.id, modelAssets.modelId),
      eq(models.userId, input.userId),
    ))
    .where(eq(modelAssets.modelId, input.modelId));
  return rows.some((row) => {
    const provenance = row.provenance as { pressOperationId?: unknown } | null;
    return provenance?.pressOperationId === input.pressOperationId;
  });
}

/**
 * CAN A PICTURE STILL LAND ON THIS CAST? — the question the sweep has to ask
 * BEFORE it decides a flat-priced press owes a refund (#1903 review finding,
 * the sweep side of B1).
 *
 * {@link pressViewLanded} asks *has* a picture landed. That reading is taken
 * with a plain, unlocked select, and on its own it is a check-then-write race
 * one whole adjudication wide:
 *
 * - the press's lease lapses while its slots are alive (`startOperationHeartbeat`
 *   latches on its FIRST failure and never renews again, so this needs a
 *   transient error rather than a dead process);
 * - the sweep reads landed = false, because nothing has committed YET;
 * - it records the refund and only then seals the press failed;
 * - a slot commits inside that window — legitimately, because the press is
 *   still `running` and so the fence in {@link commitRetriedViewAsset} admits
 *   it — and **she keeps the new view as well as the 3,250.**
 *
 * ⚠ **IT NEEDS NO TIMING LUCK.** A slot transaction that already holds the
 * press row lock with an uncommitted asset is invisible to the sweep's read by
 * ordinary isolation, so "nothing landed" can be true of the snapshot and false
 * of the world at the same instant.
 *
 * ⚠ **WHAT MAKES THIS ANSWER SUFFICIENT IS THE SLOT'S OWN FENCE, not this
 * read.** A commit requires ITS OWN operation to be `running`
 * ({@link commitRetriedViewAsset}, first statement, `FOR UPDATE`), so a slot
 * that is terminal can never land a picture again — and a slot that is NOT
 * terminal holds its row lock through its whole commit, which is why a
 * terminal status in a committed snapshot proves no commit is in flight. So
 * "no view-replacing operation is open on this Cast" is exactly "nothing more
 * can arrive", and the sweep may read the ledger and settle.
 *
 * ⚠ **IT IS DERIVED FROM {@link runningViewRetryFilter}, AND THAT FILTER IS A
 * SUPERSET OF THIS PRESS'S OWN SLOTS — deliberately, and stated because
 * deriving from a set that answers a DIFFERENT question is a silent behaviour
 * change.** The filter admits both view-replacing kinds, so a Try again
 * elsewhere on the same Cast also reads as "something can still arrive". That
 * is wrong about whose picture it is and right about the only thing this
 * caller does with the answer: it defers a settlement for one sweep pass. The
 * narrower reading — derive the five slot `clientRequestId`s from the press's
 * own — is exact and fails OPEN if the derivation or the payload shape ever
 * moves, which on this road means refunding a press that delivered. A gate on
 * a money path takes the reading that fails closed.
 *
 * It excludes `recovery_required` and a deleted subject for the same reason
 * the filter does, and both are right for this question too: neither can
 * commit a picture ever again.
 *
 * ⚠ **A DATABASE THAT CANNOT ANSWER REPORTS `true`** — the opposite direction
 * from {@link pressViewLanded}'s `false`, and the opposite is correct here.
 * Unknown must mean "do not settle yet"; a press deferred costs one sweep pass
 * and settles itself on the next, while a press refunded on a silence costs a
 * customer's credits and a delivered view at once.
 */
export async function viewReplacementInFlight(input: {
  userId: number;
  modelId: number;
}): Promise<boolean> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  const db = await getDb();
  if (!db) return true;
  const rows = await db
    .select({ id: generationOperations.id })
    .from(generationOperations)
    .where(runningViewRetryFilter({ userId: input.userId, modelId: input.modelId }))
    .limit(1);
  return rows.length > 0;
}

/*
  ⚠ **THE ONE-FREE-TRY-AGAIN ACCOUNTING STOOD HERE AND IS RETIRED — #1903
  slice 3, his ruling of 2026-10-07.**

  Two declarations went: `spentFreeViewRetryFilter` (the condition — a
  `castingV2.viewRetry` row with `plannedCredits = 0` that reached `running`)
  and `listSpentFreeViewRetryAngles` (the read that turned it into angles).
  Together they answered *has this view already had its free ask?*, which was
  #1601 item 4: the first Try again on an unchecked view was free, the second
  paid.

  **There is no free ask any more, so there is nothing to ration.** His ruling
  retired the check that produced *"Unchecked"* and the free ask under it; the
  remedy for a delivered view she does not like is the paid whole-package redo.
  Every Try again that remains belongs to a REFUNDED view and is paid, so
  `plannedCredits = 0` can no longer be written on this kind at all.

  ⚠ **AN IN-FLIGHT FREE RETRY AT THE DEPLOY STILL SETTLES CORRECTLY, AND THAT
  IS CHECKED RATHER THAN HOPED.** The sweep that closes a crashed retry reads
  the LEDGER, never this filter (`viewRetryRecovery.ts`): an empty ledger
  closes `free_failure` with nothing refunded — the same road a paid retry
  takes when it dies before its deduct. So a `plannedCredits = 0` row left
  running across this deploy needs no reader here.

  Deleted in the commit that orphaned them rather than left for a later sweep:
  a money-path condition nothing invokes is the dead control this repository
  keeps rediscovering months later.
*/

/* ------------------------------------------------ a redo's refused sheets */

/**
 * WHAT A REDO SLOT'S RECEIPT SAYS WHEN ITS VIEW DID NOT ARRIVE (#2133).
 *
 * ⚠ **THE RECEIPT IS THE DURABLE RECORD OF A REFUSED SHEET, AND THAT IS ITS
 * WHOLE POINT.** #2127 gave a Regenerate one share back per view that a sheet
 * the image provider refused would have made, and decided it from what THIS
 * process saw — after every slot had settled. A press that died between the
 * second refusal and that line (a deploy lands on every merge, and the other
 * sheet can take minutes) left the sweep nothing to read: it saw a landed
 * view, owed nothing, and the customer kept no share. So the refused slot now
 * says so on its own terminal receipt, the moment it settles, and both payers
 * read that receipt rather than a belief.
 *
 * One writer and one reader of the key, both here, so the spelling cannot
 * drift between the slot that writes it and the sweep that reads it.
 */
const REFUSED_BY_PROVIDER = "refusedByProvider" as const;

export function packageRedoSlotFailedReceipt(input: {
  castId: string;
  angle: CastViewAngle;
  refusedByProvider: boolean;
}): Record<string, unknown> {
  return {
    castId: input.castId,
    angle: input.angle,
    outcome: "failed",
    ...(input.refusedByProvider ? { [REFUSED_BY_PROVIDER]: true } : {}),
  };
}

/** A redo slot's row as the refused-sheet reader needs it — status and receipt. */
export type PackageRedoSlotRow = { status: string; result: unknown };

export type PressRefusedSheets = {
  /** Every slot this press claimed — the denominator of one share. */
  promisedViews: number;
  /** Slots whose sealed receipt records a sheet the provider refused. */
  refusedViews: number;
  /** One share per refused view, derived from what the press charged. */
  owed: number;
};

/**
 * WHAT A PRESS OWES FOR REFUSED SHEETS, FROM ITS SLOT ROWS ALONE (#2133).
 *
 * Pure, and the ONE place the live press and the sweep both take the amount
 * from. That is what makes a second payment a ledger duplicate rather than a
 * collision: both writers pay under the press's own refund reference, and an
 * equal amount is the only thing the ledger's unique index absorbs quietly.
 *
 * ⚠ **ONLY A SEALED (`succeeded`) RECEIPT COUNTS.** A slot the sweep closed
 * carries the sweep's receipt, never this one, and a slot still running has
 * not said anything yet — neither is evidence of a refusal.
 */
export function refusedSheetRefundFromSlotRows(
  rows: readonly PackageRedoSlotRow[],
  chargedCredits: number,
): PressRefusedSheets {
  const promisedViews = rows.length;
  const refusedViews = rows.filter((row) => {
    if (row.status !== "succeeded") return false;
    const result = row.result as Record<string, unknown> | null;
    return result !== null
      && typeof result === "object"
      && result[REFUSED_BY_PROVIDER] === true;
  }).length;
  const share = refusedSheetViewRefund({ chargedCredits, promisedViews });
  return { promisedViews, refusedViews, owed: share * refusedViews };
}

/**
 * THE SLOT ROWS OF ONE PRESS, read by the ids the press DERIVED for them.
 *
 * A redo claims each slot under `derivedClientRequestId(press, angle)` — the
 * same function, imported, so the claim and this read cannot come to disagree
 * about which rows belong to which press. Every angle a Cast may own is asked
 * for; only the ones this press claimed exist.
 *
 * ⚠ **A DATABASE THAT CANNOT ANSWER THROWS.** Both callers settle money from
 * this, and "no rows" would read as "nothing refused" — the direction that
 * keeps a customer's shares.
 */
export async function readPressRefusedSheetRefund(input: {
  userId: number;
  modelId: number;
  pressClientRequestId: string;
  chargedCredits: number;
}): Promise<PressRefusedSheets> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  const db = await getDb();
  if (!db) throw new Error("Database not available to read a redo's refused sheets");
  const slotRequestIds = CAST_VIEW_ANGLES.map((angle) =>
    derivedClientRequestId(input.pressClientRequestId, angle));
  const rows = await db
    .select({ status: generationOperations.status, result: generationOperations.result })
    .from(generationOperations)
    .where(and(
      eq(generationOperations.userId, input.userId),
      eq(generationOperations.modelId, input.modelId),
      eq(generationOperations.kind, "castingV2.packageRedo"),
      inArray(generationOperations.clientRequestId, slotRequestIds),
    ));
  return refusedSheetRefundFromSlotRows(rows, input.chargedCredits);
}

/** Thrown inside the press refund's transaction to roll it back as a fence. */
class PressRefundFenced extends Error {}

/**
 * THE LIVE PRESS'S ONE REFUND, UNDER THE PRESS'S OWN FENCE (#2133) — the
 * pattern #2127 settled for the Sign (`recordRefusedSheetSlotFailure`).
 *
 * The press row is taken `FOR UPDATE` on `running`, the reference is read in
 * the same transaction, and the credit is written with `addCreditsIn` on THAT
 * handle. A press the sweep has already sealed is out of `running`, so this
 * writes nothing and answers `{ fenced: true }`: the sweep owns the money.
 *
 * ⚠ **IT DOES NOT REFUSE A PRESS THE SWEEP HAS ONLY STAMPED.** A deferred
 * sweep pass stamps `recoveryAttemptedAt` on a healthy press and leaves it
 * running (`commitRetriedViewAsset` says why the press is never that clause's
 * subject), so fencing on the stamp would refuse the live process its own
 * refund. What keeps the two writers from paying twice in the window before
 * the sweep seals is that they pay under ONE reference with ONE derived
 * amount, so the ledger's unique index lets exactly one of them land.
 *
 * A repeat already in the ledger is read and reported as a duplicate rather
 * than thrown, because a duplicate insert inside this transaction would roll
 * back with it.
 */
export async function recordPackageRedoPressRefund(input: {
  userId: number;
  pressOperationId: string;
  amount: number;
  description: string;
  chargeReferenceId: string;
}): Promise<{ fenced: true } | { fenced: false; refund: RefundOutcome }> {
  assertPositiveId(input.userId, "userId");
  const reference = refundReferenceFor(input.chargeReferenceId);
  try {
    return await withTransaction(async (tx) => {
      const [press] = await tx
        .select({ id: generationOperations.id })
        .from(generationOperations)
        .where(and(
          eq(generationOperations.id, input.pressOperationId),
          eq(generationOperations.userId, input.userId),
          eq(generationOperations.kind, "castingV2.packageRedoPress"),
          eq(generationOperations.status, "running"),
        ))
        .limit(1)
        .for("update");
      if (!press) throw new PressRefundFenced();

      const [existing] = await tx
        .select({ amount: creditTransactions.amount, type: creditTransactions.type })
        .from(creditTransactions)
        .where(and(
          eq(creditTransactions.userId, input.userId),
          eq(creditTransactions.referenceId, reference),
        ))
        .limit(1);
      if (existing) {
        return {
          fenced: false as const,
          refund: {
            recorded: existing.type === "refund" && existing.amount === input.amount,
            amount: input.amount,
            duplicate: true,
            reference,
          },
        };
      }
      const written = await addCreditsIn(
        tx,
        input.userId,
        input.amount,
        "refund",
        input.description,
        reference,
      );
      return {
        fenced: false as const,
        refund: { recorded: written.success, amount: input.amount, duplicate: false, reference },
      };
    });
  } catch (error) {
    if (error instanceof PressRefundFenced) return { fenced: true };
    throw error;
  }
}
