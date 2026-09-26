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
  generationOperations,
  modelAssets,
  models,
} from "../../drizzle/schema";
import { CAST_VIEW_ANGLES, type CastViewAngle } from "../../shared/boardTypes";
import { identityStampFor } from "../casting/identity/anchorSelector";
import { castViewRetrySubjectHash } from "../casting/operationContract";
import { ANCHOR_RESOLUTION, SIGNED_VIEW_RESOLUTION } from "../castingV2/castViewPackage";
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
      eq(modelAssets.resolution, ANCHOR_RESOLUTION),
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
 * Land a retried view on a LIVE Cast.
 *
 * Returns the new asset's id, or `null` when the fence refused — this Try
 * again is no longer `running`, so a sweep owns its money and these bytes will
 * never be referenced. The caller drops them; it never writes a receipt.
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
}): Promise<number | null> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  try {
    return await withTransaction(async (tx) => {
      const [operation] = await tx
        .select({ id: generationOperations.id })
        .from(generationOperations)
        .where(and(
          eq(generationOperations.id, input.operationId),
          eq(generationOperations.userId, input.userId),
          eq(generationOperations.kind, "castingV2.viewRetry"),
          eq(generationOperations.status, "running"),
        ))
        .limit(1)
        .for("update");
      if (!operation) return null;

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
      if (!model) return null;

      const [inserted] = await tx
        .insert(modelAssets)
        .values({
          modelId: input.modelId,
          viewType: input.angle,
          // The same tier a Sign's own views ask for, whoever asked (#1373).
          resolution: SIGNED_VIEW_RESOLUTION,
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
      return inserted?.id ?? null;
    });
  } catch {
    return null;
  }
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
    eq(generationOperations.kind, "castingV2.viewRetry"),
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
  return CAST_VIEW_ANGLES.filter((angle) => running.has(castViewRetrySubjectHash({
    modelId: input.modelId,
    castId: input.castId,
    angle,
  })));
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
