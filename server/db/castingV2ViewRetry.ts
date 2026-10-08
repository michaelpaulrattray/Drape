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
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import {
  castingCandidateVariants,
  castingCandidates,
  castingRolls,
  generationOperations,
  modelAssets,
  models,
} from "../../drizzle/schema";
import { CAST_VIEW_ANGLES, type CastViewAngle } from "../../shared/boardTypes";
import { identityStampFor } from "../casting/identity/anchorSelector";
import {
  castViewRetrySubjectHash,
  castViewSubjectHash,
  VIEW_REPLACING_OPERATION_KINDS,
} from "../casting/operationContract";
import { getDb, withTransaction } from "./connection";

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

      The Try again road passes no `pressOperationId` and is untouched: its
      money row IS its fence, which is why it was immune to this.
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
 * THE ONE FREE TRY AGAIN, SPENT OR NOT — read at the operation rows (#1601 item 4).
 *
 * His rule, from the card: an unchecked view's first Try again is free, **once**;
 * the second is paid. Until this read existed the free offer was a pure function
 * of the slot's state, and that state does not change when a free retry is taken
 * — a view delivered unchecked is still unchecked after a second unchecked
 * picture lands on it. So the free ask renewed itself every time the judge was
 * unavailable, and a customer could have the house render a 2K view without limit
 * for nothing.
 *
 * # Why this needs no migration, and no column
 *
 * The same reason {@link listRunningViewRetryAngles} needs none, and it is the
 * #1235 reading reused rather than re-invented: `generation_operations` carries
 * **no payload and no angle**, but it carries the HASH of the claim's subject,
 * and {@link castViewRetrySubjectHash} recomputes that hash per angle from the
 * same payload builder the entrance claims with. A closed vocabulary of five
 * angles makes the recomputation exhaustive. Nothing is mirrored, and a changed
 * payload shape reddens a test rather than silently handing out free renders.
 *
 * # Why `plannedCredits = 0` is the free/paid discriminator
 *
 * `markGenerationOperationRunning` writes the price the entrance read from
 * {@link castSlotRetryOffer} into `plannedCredits`, and the two roads are 0 and
 * `CASTING_V2_VIEW_RETRY_PRICE_CREDITS`. It is the house's own way of asking this
 * question — `inkAddAcceptance` and `inkAddCancellation` both filter the same
 * column for the same reason.
 *
 * ⚠ **IT ASKS WHETHER THE ROW EVER REACHED `running`, AND IT USED TO ASK
 * `status <> 'claimed'` — THE SECOND IS A WEAKER QUESTION AND #1943 IS WHAT IT
 * COST.** The product answer has never changed and is the one below: **a claim
 * that never reached `running` dispatched no render, so the customer has had
 * nothing and keeps their free ask.** `status <> 'claimed'` was a true reading
 * of that only while a refused claim STAYED at `claimed`, and two roads now
 * settle one terminally without it ever running — each of which burned her one
 * free Try again for a picture that was never asked for:
 *
 * - **a busy slot lock.** #1932 made `beginDirectOperation` fail its own row the
 *   moment the lock is refused, so a free Try again pressed while that view is
 *   already rendering (a redo, a second tab) became a terminal `failed` row at
 *   once. Before #1932 the recovery sweep did the same thing about six minutes
 *   later, so the defect predates it and was only made prompt by it.
 * - **a `markRunning` that throws.** The entrance settles through
 *   `completeDirectOperationFailure`, whose finalizer requires `running`, so the
 *   row lands at `recovery_required` — also not `claimed`, also never run.
 *
 * `heartbeatAt` is the marker because it is written in the SAME statement that
 * writes `status = 'running'` (`markGenerationOperationRunning`), and the only
 * two writers after that — the heartbeat renewal and the recovery handoff — both
 * require `running` already. Nothing ever sets it back to NULL, and no terminal
 * finalizer clears it, so a non-null `heartbeatAt` is a durable *"this one ran"*
 * that survives whatever status the row ends at.
 *
 * It SUBSUMES the claimed exclusion rather than sitting beside it — a `claimed`
 * row has no heartbeat by construction — so the old clause is gone instead of
 * kept as a comforting duplicate. It also stops being a second spelling of a
 * schema default: the discriminator is now a COLUMN the compiler resolves, not
 * the string `"claimed"` written in two files.
 *
 * ⚠ The #1767 reason this clause ORIGINALLY carried is discharged and is kept
 * here because its half-life matters: it was written because `plannedCredits`
 * defaulted to 0 at the claim and was written one statement later, so a row
 * still at `claimed` read 0 whatever it was going to cost and every PAID Try
 * again would have consumed the free one for its angle during the milliseconds
 * between the two statements. The entrance passes the price INTO the claim now,
 * so a paid retry's row says 370 from the moment it exists.
 *
 * ✅ **THE LIMIT THIS PARAGRAPH USED TO STATE IS CLOSED (#1767).** It read: *a
 * PAID retry whose `markRunning` throws is settled as a failure with
 * `plannedCredits` still at its default 0, so it reads here as a spent free ask
 * on that angle* — the exact closure named there was `plannedCredits` written
 * at the CLAIM, *"a change to the shared claim path every road in the product
 * takes — not this slice's to make"*. It was carded as #1767 and made: see
 * `claimGenerationOperation`'s `plannedCredits` docblock, and
 * `server/plannedCreditsAtClaim.test.ts`, which drives this very sequence — a
 * paid claim whose `markRunning` throws — and reads the claim at the wire.
 *
 * ⚠ **A FREE ASK THAT DID NOT ARRIVE STILL COUNTS**, which is the card's own
 * wording and the reason there is no landed-asset arm here. The asset row would
 * have been the easier read — `pointsCost` 0 with a `castingV2.viewRetry`
 * provenance — and it is the WRONG one: a free render that failed would renew
 * the free ask, which is the loop this item exists to close.
 *
 * Unlike the busy read, an unavailable database THROWS rather than answering [].
 * The sibling may answer "nothing is running" safely because its empty direction
 * costs a tile its skeleton; the empty direction here hands out a free render.
 * `listCastPromisedAngles` takes the same refusal for the same kind of fact.
 */
export function spentFreeViewRetryFilter(input: { userId: number; modelId: number }) {
  return and(
    eq(generationOperations.userId, input.userId),
    eq(generationOperations.modelId, input.modelId),
    eq(generationOperations.kind, "castingV2.viewRetry"),
    eq(generationOperations.plannedCredits, 0),
    isNotNull(generationOperations.heartbeatAt),
    isNull(generationOperations.subjectDeletedAt),
  );
}

export async function listSpentFreeViewRetryAngles(input: {
  userId: number;
  modelId: number;
  castId: string;
}): Promise<CastViewAngle[]> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({ payloadHash: generationOperations.payloadHash })
    .from(generationOperations)
    .where(spentFreeViewRetryFilter({ userId: input.userId, modelId: input.modelId }));
  if (rows.length === 0) return [];
  const spent = new Set(rows.map((row) => row.payloadHash));
  return CAST_VIEW_ANGLES.filter((angle) => spent.has(castViewRetrySubjectHash({
    modelId: input.modelId,
    castId: input.castId,
    angle,
  })));
}
