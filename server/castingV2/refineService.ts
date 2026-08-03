/**
 * Refine: one paid edit of one candidate's face (M8 §12).
 *
 * # The money is Sign's shape, not the roll's
 *
 * A roll is eight independently refundable slices because eight things can fail
 * separately. A refine is ONE image and one unit, so the whole charge comes
 * back on any throw and there is nothing to reconcile per-slice. Inventing
 * slice accounting for a single slice would be ceremony with no content.
 *
 * The order, and every step of it is load-bearing:
 *
 *   1. **free refusals** — scope, freeze, the candidate itself, and the
 *      instruction. §10's whole argument is that a refusal must land before the
 *      money moves: "make her older" costs nothing and says so at once.
 *   2. **admission** against the provider budget, BEFORE the claim — the roll's
 *      rule. A refine admitted into a full queue is a charge waiting to fail.
 *   3. `beginDirectOperation` with `clientRequestId` as the idempotency gate. A
 *      replay returns the variant it already made rather than buying a second.
 *   4. `markRunning` → pinned deduct via `operationChargeReference`.
 *   5. generate, land, and **select in one transaction** — a landed refinement
 *      nobody can see is a paid picture that does not exist.
 *   6. any throw past the charge refunds the whole price.
 *
 * # Base-anchoring is structural here, not a convention
 *
 * The reference image is always the CANDIDATE's own — never the currently
 * selected variant's. Every variant is `edit(original, instructions 1..N)`, so
 * there is no chain for error to compound along and the tenth refinement is
 * exactly as close to the face the user picked as the first. `claimVariant`
 * reads that base inside the statement that proves the parent, so this cannot
 * be got wrong by a later caller passing something else.
 */
import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";

import { recordRefund } from "../casting/atomicCredits";
import { CASTING_V2_REFINE_PRICE_CREDITS } from "../casting/castingCreditCosts";
import {
  beginDirectOperation,
  completeDirectOperationFailure,
  completeDirectOperationSuccess,
  failClaimedDirectOperation,
} from "../casting/directOperation";
import { operationChargeReference } from "../casting/operationContract";
import { deductCredits } from "../db/credits";
import { markGenerationOperationRunning } from "../db/generationOperations";
import {
  claimVariant,
  failVariant,
  landVariant,
  listCandidateVariants,
  markVariantDispatched,
  VariantOwnershipError,
} from "../db/castingV2Variants";
import { getOwnedCandidateWithSelectedFace } from "../db/castingV2";
import { createModuleLogger } from "../logging/logger";
import { ProviderError } from "../providers/types";
import { storagePut, storageReadBytes } from "../storage";
import { withTransaction } from "../db/connection";
import { createStorageCleanupManifestIn } from "../db/storageCleanup";
import {
  EYE_SHAPE_RENDER,
  HAIR_COLOUR_RENDER,
  HAIR_TEXTURE_RENDER,
  IRIS_RENDER,
} from "./realizedAxes";
import { hairStyleByName } from "./hairStyles";
import { readResolvedIdentity } from "./rollService";
import {
  applyDelta,
  composeDeltas,
  composeEditPrompt,
  type RefineDelta,
} from "./refineDelta";
import { interpretRefinement, refusalMessage } from "./refineInterpreter";
import { detectRenderFault } from "./renderFault";
import { castingIdentityEngine } from "./signEngine";
import { assertNotFrozen } from "./spendGuards";

const log = createModuleLogger("castingV2/refineService");

const VARIANT_KEY_PREFIX = "casting-v2/variants";

/** How many refinements one candidate may carry. */
const MAX_INSTRUCTIONS = 12;

export type RefineInput = {
  userId: number;
  clientRequestId: string;
  candidatePublicId: string;
  instruction: string;
};

export type RefineResult = {
  variantId: string;
  candidateId: string;
  imageUrl: string;
  instructions: string[];
};

export type RefineServiceDependencies = {
  begin?: typeof beginDirectOperation;
  markRunning?: typeof markGenerationOperationRunning;
  deduct?: typeof deductCredits;
  refund?: typeof recordRefund;
  engine?: () => ReturnType<typeof castingIdentityEngine>;
  interpret?: typeof interpretRefinement;
  admit?: () => boolean;
  readBytes?: typeof storageReadBytes;
  storeImage?: (
    input: { key: string; bytes: Buffer; contentType: string },
  ) => Promise<{ key: string; url: string }>;
};

async function defaultStoreImage(input: { key: string; bytes: Buffer; contentType: string }) {
  return storagePut(input.key, input.bytes, input.contentType);
}

export async function refineCandidate(
  dependencies: RefineServiceDependencies,
  input: RefineInput,
): Promise<RefineResult> {
  const price = CASTING_V2_REFINE_PRICE_CREDITS;
  await assertNotFrozen(input.userId);

  /* ---- free refusals: nothing claimed, nothing charged ---- */

  const source = await getOwnedCandidateWithSelectedFace(input.userId, input.candidatePublicId);
  if (!source) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "That candidate is no longer available.",
    });
  }
  if (!source.candidate.imageKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "That candidate's image isn't available. Nothing was charged.",
    });
  }
  if (source.candidate.signedCastId !== null) {
    /*
      Post-Sign revision is M12, not this. Refining a spent candidate would
      produce a variant that can never be selected into anything, which is a
      charge for an artifact with no home.
    */
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "That face has already been signed. Nothing was charged.",
    });
  }

  const existing = await listCandidateVariants(input.userId, input.candidatePublicId);
  if (existing.length >= MAX_INSTRUCTIONS) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "That face has as many refinements as it can carry. Nothing was charged.",
    });
  }

  /*
    The composed identity SO FAR — what a relative instruction resolves against.
    Read from the selected face, because "greener" means greener than the thing
    they are looking at, not greener than the sheet's original.
  */
  const currentIdentity = readResolvedIdentity(source.internalPrompt);
  const parsed = await (dependencies.interpret ?? interpretRefinement)({
    instruction: input.instruction,
    currentEyeColour: currentIdentity?.realized?.eyeColour ?? null,
    currentEyeShape: currentIdentity?.realized?.eyeShape ?? null,
    currentHairStyle: currentIdentity?.realized?.hairStyle?.name ?? null,
    /* Colour lives on `hair`, not `realized` — the registry's one filing
       exception, and the reason "make it lighter" needs it read from there. */
    currentHairColour: currentIdentity?.hair?.colour ?? null,
    currentHairTexture: currentIdentity?.realized?.hairTexture ?? null,
    currentMakeup: currentIdentity?.realized?.makeup ?? null,
  });
  if (!parsed.ok) {
    // An honest boundary, not a fault — and free, which is the point of §10.
    throw new TRPCError({ code: "BAD_REQUEST", message: refusalMessage(parsed) });
  }

  if (dependencies.admit && !dependencies.admit()) {
    /*
      A real TOO_MANY_REQUESTS, never a 200 carrying an error field (invariant
      6), and before the claim so nobody is charged for a queue they could not
      get into.
    */
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Casting is busy right now. Try that again in a moment — nothing was charged.",
    });
  }

  /* ---- the stack, composed mechanically ---- */

  /*
    The new refinement extends the SELECTED one, not the newest one.

    Each variant already stores its own FULL composed delta and its own FULL
    instruction list (§14 denormalizes both per row), so the stack is read from
    exactly one predecessor rather than accumulated across all of them —
    accumulating would repeat every earlier instruction once per variant.

    Reading the SELECTED predecessor is also what makes "edit from here" work:
    back up to variant 1, refine again, and the new variant branches off 1
    rather than off 3. That is the whole tree, and it needs no schema — it is
    emergent from prefix-sharing, and every row stays self-describing.
  */
  const predecessor = source.variantPublicId
    ? existing.find((variant) => variant.publicId === source.variantPublicId) ?? null
    : null;
  const priorDelta = (predecessor?.deltas as RefineDelta | null) ?? {};
  const composed = composeDeltas([priorDelta, parsed.delta]);
  const instructions = [
    ...readInstructions(predecessor?.instructions),
    input.instruction.trim(),
  ];

  /* ---- the claim ---- */

  const gate = await (dependencies.begin ?? beginDirectOperation)({
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    kind: "castingV2.refine",
    payload: {
      candidatePublicId: input.candidatePublicId,
      instruction: input.instruction.trim(),
    },
  });
  if (gate.type === "replay") {
    // Idempotency, not an error: the same request id returns the refinement it
    // already bought rather than buying a second identical one.
    return gate.result as RefineResult;
  }
  const operationId = gate.operationId;

  let variant: Awaited<ReturnType<typeof claimVariant>>;
  try {
    variant = await claimVariant({
      userId: input.userId,
      candidatePublicId: input.candidatePublicId,
      operationId,
      pointsCost: price,
      instructions,
      deltas: composed,
    });
  } catch (error) {
    if (error instanceof VariantOwnershipError) {
      return failClaimedDirectOperation({
        userId: input.userId,
        operationId,
        error: new TRPCError({
          code: "NOT_FOUND",
          message: "That candidate is no longer available. Nothing was charged.",
        }),
      });
    }
    return failClaimedDirectOperation({ userId: input.userId, operationId, error });
  }

  try {
    await (dependencies.markRunning ?? markGenerationOperationRunning)({
      userId: input.userId,
      operationId,
      plannedCredits: price,
      phase: "generating",
      heartbeat: true,
    });
  } catch (error) {
    return failClaimedDirectOperation({ userId: input.userId, operationId, error });
  }

  /* ---- the pinned deduct ---- */

  const charge = await (dependencies.deduct ?? deductCredits)(
    input.userId,
    price,
    "generation",
    "Refine a face (pending)",
    operationChargeReference(operationId),
    "castingV2",
  );
  if (!charge.success) {
    await failVariant({ userId: input.userId, variantId: variant.id, failureClass: "unpaid" });
    return completeDirectOperationFailure({
      userId: input.userId,
      operationId,
      error: new TRPCError({
        code: "BAD_REQUEST",
        message: charge.error || `Not enough credits. A refinement costs ${price} credits.`,
      }),
      chargedCredits: 0,
      refundedCredits: 0,
    });
  }

  /* ---- everything past here is compensated on any throw ---- */

  try {
    await markVariantDispatched({ userId: input.userId, variantId: variant.id });

    const base = await (dependencies.readBytes ?? storageReadBytes)(variant.baseImageKey);
    const engine = (dependencies.engine ?? castingIdentityEngine)();
    const prompt = composeEditPrompt(composed, {
      eyeColour: (value) => IRIS_RENDER[value],
      eyeShape: (value) => EYE_SHAPE_RENDER[value],
      /* The cut's own name plus the silhouette it implies, so "bob" cannot
         arrive as a length the family disagrees with. */
      hairStyle: (value) => {
        const style = hairStyleByName(value);
        return style ? `a ${style.name} (${style.family})` : `a ${value}`;
      },
      hairColour: (value) => `${value} — ${HAIR_COLOUR_RENDER[value]}`,
      hairTexture: (value) => `${value} hair — ${HAIR_TEXTURE_RENDER[value]}`,
    });
    const image = await engine.editWithReferences({
      prompt,
      references: [{ bytes: base.bytes, contentType: base.contentType }],
      // 1K: a candidate's own resolution. The 2K tier belongs to signed views.
      resolution: "1K",
    });

    /*
      The landing smoke alarm, borrowed as-is (D-93). Same landing path, same
      failure mode, and garbage refunds — a seamed or duplicated frame is not
      something the user should pay 25 credits to receive.
    */
    const verdict = await detectRenderFault(image.bytes);
    if (verdict.fault) {
      log.error(
        { operationId, variant: variant.publicId, detail: verdict.detail },
        "[refineService] RENDER FAULT — failing the refinement and refunding",
      );
      throw new ProviderError("render_fault", verdict.detail);
    }

    /*
      MANIFEST BEFORE WRITE (Sign's D-92 defence, one surface down).

      The bytes go to a permanently public key, and nothing references them
      until the landing commits. A crash in between — or either of the landing's
      own refusals — would leave a paid picture of a person at a URL with no row
      that knows it exists, so it could never be purged. The key is handed to
      the cleanup worker BEFORE it exists, in its own committed transaction so
      the failure it guards against cannot roll it back; the landing deletes the
      manifest as its last act.
    */
    const cleanupBatchId = randomUUID();
    const extension = image.contentType.includes("jpeg") ? "jpg" : "png";
    const destinationKey = `${VARIANT_KEY_PREFIX}/${randomUUID()}.${extension}`;
    await withTransaction((tx) => createStorageCleanupManifestIn(tx, {
      id: cleanupBatchId,
      userId: input.userId,
      operationId,
      kind: "casting_candidate_cleanup",
      storageItems: [{ storageKey: destinationKey, storageBackend: "public_r2" }],
    }));

    const stored = await (dependencies.storeImage ?? defaultStoreImage)({
      key: destinationKey,
      bytes: image.bytes,
      contentType: image.contentType,
    });

    /*
      The record is built from the SAME composed deltas as the prompt above —
      §10's load-bearing consequence. Two derivations would be the record-lies
      class rebuilt with extra steps.
    */
    const baseIdentity = readResolvedIdentity(variant.baseInternalPrompt);
    await landVariant({
      userId: input.userId,
      cleanupBatchId,
      // The sweep fence's subject: this landing only commits while the
      // operation it belongs to is still `running`.
      operationId,
      variantId: variant.id,
      imageKey: stored.key,
      internalPrompt: {
        prompt,
        resolved: baseIdentity ? applyDelta(baseIdentity, composed) : null,
      },
      provider: image.provenance?.provider ?? null,
      providerModel: image.provenance?.model ?? null,
      providerRef: image.provenance?.providerRef ?? null,
    });

    const result: RefineResult = {
      variantId: variant.publicId,
      candidateId: input.candidatePublicId,
      imageUrl: stored.url,
      instructions,
    };
    await completeDirectOperationSuccess({
      userId: input.userId,
      operationId,
      result: result as never,
      chargedCredits: price,
      refundedCredits: 0,
    });
    return result;
  } catch (error) {
    /* WHOLE charge back — one image, one unit, nothing partial to keep. */
    const refund = await (dependencies.refund ?? recordRefund)(
      input.userId,
      price,
      refundDescriptionFor(error),
      operationChargeReference(operationId),
    );
    await failVariant({
      userId: input.userId,
      variantId: variant.id,
      failureClass: error instanceof ProviderError ? error.failureClass : "unknown",
    });
    return completeDirectOperationFailure({
      userId: input.userId,
      operationId,
      /*
        The message must MATCH the number beside it.

        This publicMessage is persisted on the receipt and replayed to whoever
        asks about the operation later, so "your credits have been returned"
        beside `refundedCredits: 0` is a receipt claiming money moved when it
        did not — the exact thing this program keeps auditing for. Sign already
        solved it; the shape is borrowed, including quoting the operation so
        support can act on it rather than re-deriving it.
      */
      error: new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: refund.recorded
          ? "That refinement didn't come through. Your credits have been returned."
          : "That refinement didn't come through, and the refund could not be recorded — "
            + `quote operation ${operationId} and support will restore the balance.`,
      }),
      chargedCredits: price,
      refundedCredits: refund.recorded ? price : 0,
    });
  }
}

/**
 * What the ledger line says — the honest version, not a generic one.
 *
 * A render fault is OUR detector refusing a picture, not the provider failing,
 * and a receipt that calls it "generation failed" invites a support
 * conversation nobody can resolve from the record.
 */
function refundDescriptionFor(error: unknown): string {
  if (error instanceof ProviderError && error.failureClass === "render_fault") {
    return "Refine refunded — the image came back damaged";
  }
  return "Refine refunded — the generation failed";
}

/** Instructions are a json column, so they are validated rather than trusted. */
function readInstructions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}
