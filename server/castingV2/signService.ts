/**
 * The Sign ceremony — the only transition that creates Cast authority (§F, D-92).
 *
 * THE SEQUENCE, and its ordering is the whole design:
 *
 *   read → claim → running → PINNED DEDUCT → manifest → copy →
 *   [one transaction: Cast + anchor + identity + candidate CAS] →
 *   package → activate → receipt
 *
 * **The charge comes before the durable boundary, and that inverts the roll's
 * order on purpose.** A roll commits its rows first because rows are not
 * authority — they are cheap to fail, and "rows but no ledger charge" honestly
 * means nothing was taken. Sign's transaction *creates* authority: a Cast, and
 * a spent candidate. An unpaid Cast is unacceptable and undoing one means
 * un-signing, so the money moves first and everything between the charge and
 * the boundary is fully compensable — the credits by refund, the storage copy
 * by a cleanup manifest registered before the copy is made.
 *
 * Both orderings serve one invariant, and it is the sentence to keep:
 * **authority exists ⟹ money was taken.**
 *
 * What each crash point resolves to (D-92's table, as code):
 *
 *   after claim              free failure — no charge exists
 *   after running            free failure — the late-deduct recheck sees nothing
 *   after deduct / copy      PAID failure — full refund, candidate stays `ready`
 *   mid-transaction          the same; the transaction is atomic
 *   after the transaction    the Cast stands; only slices refund from here
 *   mid-package              committed views stand, uncommitted slices refund
 *   after package            activate, bind, seal — idempotently
 *
 * The promotion portion is never refunded once the candidate CAS is set,
 * because at that moment the customer has what it bought: a locked face with an
 * anchor and an id. Only views refund after that, and only their own slice.
 */
import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";

import { recordRefund } from "../casting/atomicCredits";
import { CASTING_V2_SIGN_COSTS } from "../casting/castingCreditCosts";
import { withUniqueCastPublicId } from "../casting/castPublicId";
import {
  beginDirectOperation,
  completeDirectOperationFailure,
  failClaimedDirectOperation,
} from "../casting/directOperation";
import { operationChargeReference } from "../casting/operationContract";
import { mintRevisionId } from "../casting/identity/anchorSelector";
import { deductCredits } from "../db/credits";
import { withTransaction } from "../db/connection";
import { createStorageCleanupManifestIn } from "../db/storageCleanup";
import {
  bindGenerationOperationModel,
  finalizeGenerationOperationSuccess,
  markGenerationOperationRecoveryRequired,
  markGenerationOperationRunning,
} from "../db/generationOperations";
import {
  SignPersistenceError,
  getSignableCandidate,
  signCandidateIntoCast,
  type SignableCandidate,
} from "../db/castingV2Sign";
import { createModuleLogger } from "../logging/logger";
import { storageCopyExact, storageReadBytes } from "../storage";
import { CASTING_V2_SIGN_PRICE_CREDITS } from "./castViewPackage";
import { buildCastPackage, type PackageOrchestratorDependencies } from "./packageOrchestrator";
import { assertNotFrozen } from "./spendGuards";

const log = createModuleLogger("castingV2/signService");

/** Cast-owned objects live under one namespace so cleanup and audit find them. */
const CAST_KEY_PREFIX = "casting-v2/casts";

export type SignServiceDependencies = PackageOrchestratorDependencies & {
  begin?: typeof beginDirectOperation;
  markRunning?: typeof markGenerationOperationRunning;
  deduct?: typeof deductCredits;
  copyImage?: typeof storageCopyExact;
  readBytes?: typeof storageReadBytes;
  buildPackage?: typeof buildCastPackage;
  /**
   * How the package work is scheduled after the Cast exists.
   *
   * Production hands it to the event loop and returns, because §F's room "opens
   * immediately on the signed master" and views stream in — making the customer
   * stare at a spinner for six 2K generations would be a different product.
   * That detachment is not fire-and-forget: the operation is still `running`
   * under its heartbeat and lease, so a process that dies here is exactly the
   * case the Sign adjudicator exists for.
   *
   * Tests return the promise, which makes `signCandidate` await the whole
   * ceremony — the package's money must be assertable, and an assertion that
   * races a detached promise is an assertion that passes by luck.
   */
  schedulePackage?: (run: () => Promise<void>) => void | Promise<void>;
};

export type SignInput = {
  userId: number;
  clientRequestId: string;
  /** The candidate to spend. Re-proved owner-scoped inside the CAS. */
  candidatePublicId: string;
  /** Optional. A Cast with no name shows its KI id until its owner gives it one. */
  name?: string | null;
};

export type SignResult = {
  castPublicId: string;
  chargedCredits: number;
};

/**
 * The identity documents a Cast carries, derived from what the candidate
 * persisted (§F: immutable at Sign).
 *
 * Deliberately built here rather than through the legacy `buildIdentityAnchor`:
 * that helper reads a legacy `technicalSchema` shape (`facial_features`,
 * `skin_tone`) that V2 does not produce, and importing it would tie the newest
 * paid path in the product to the module the retirement program exists to
 * delete. The only contract this text has to honour is that it is deterministic
 * and stable — it is a fingerprint, hashed onto the identity snapshot and
 * stamped on every asset written under this revision.
 *
 * These three fields together are the complete recipe for reproducing a Cast.
 * They are the single most sensitive field group in the product and they never
 * cross a projection boundary (founder ruling, 2026-07-25).
 */
function identityDocumentsFor(source: SignableCandidate): {
  masterPrompt: string;
  technicalSchema: unknown;
  preferences: unknown;
  identityText: string;
} {
  const internal = source.candidate.internalPrompt as
    | { prompt?: unknown; resolved?: unknown }
    | null;
  const masterPrompt = typeof internal?.prompt === "string" && internal.prompt.trim()
    ? internal.prompt
    : source.roll.briefText;
  const resolved = internal?.resolved && typeof internal.resolved === "object"
    ? (internal.resolved as Record<string, unknown>)
    : {};
  const technicalSchema = {
    subject: resolved,
    cohortKey: source.roll.cohortKey,
    styleKey: source.roll.styleKey,
    styleProfile: source.roll.styleProfile ?? null,
  };
  const preferences = {
    briefText: source.roll.briefText,
    personaLine: source.candidate.personaLine,
    position: source.candidate.position,
    sourceRollPublicId: source.roll.publicId,
    sourceCandidatePublicId: source.candidate.publicId,
  };
  const identityText = [
    "IDENTITY — THIS PERSON MUST MATCH THE REFERENCE IMAGE EXACTLY:",
    JSON.stringify(resolved),
    `Full casting spec: ${masterPrompt}`,
  ].join("\n");
  return { masterPrompt, technicalSchema, preferences, identityText };
}

/**
 * The candidate's SELECTED image key.
 *
 * One accessor, on purpose. Today a candidate has exactly one image and this is
 * a field read; at M8 a refined candidate has a stack of variants and the
 * selected one is its face — what Sign signs. Reading `imageKey` inline at the
 * copy site would make that a change to the money ceremony instead of a change
 * to this function (D-86).
 */
export function selectedCandidateImageKey(candidate: { imageKey: string | null }): string | null {
  return candidate.imageKey;
}

export async function signCandidate(
  dependencies: SignServiceDependencies,
  input: SignInput,
): Promise<SignResult> {
  const price = CASTING_V2_SIGN_PRICE_CREDITS;
  await assertNotFrozen(input.userId);

  // ---- free refusals: nothing claimed, nothing charged ----
  const source = await getSignableCandidate(input.userId, input.candidatePublicId);
  if (!source) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "That candidate can't be signed — it may have been discarded, expired, or already signed.",
    });
  }
  const imageKey = selectedCandidateImageKey(source.candidate);
  if (!imageKey) {
    // A `ready` row without bytes is a torn write. Refusing here costs the user
    // nothing; charging and then discovering it would cost them a refund.
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "That candidate's image isn't available. Nothing was charged.",
    });
  }

  const gate = await (dependencies.begin ?? beginDirectOperation)({
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    kind: "castingV2.sign",
    payload: {
      candidatePublicId: input.candidatePublicId,
      name: input.name ?? null,
    },
  });
  if (gate.type === "replay") {
    // Idempotency, not an error: the same request id returns the Cast it
    // already signed rather than spending a second candidate.
    return gate.result as SignResult;
  }
  const operationId = gate.operationId;

  try {
    await (dependencies.markRunning ?? markGenerationOperationRunning)({
      userId: input.userId,
      operationId,
      plannedCredits: price,
      phase: "minting",
      heartbeat: true,
    });
  } catch (error) {
    return failClaimedDirectOperation({ userId: input.userId, operationId, error });
  }

  // ---- the pinned deduct (§H.2) ----
  const chargeResult = await (dependencies.deduct ?? deductCredits)(
    input.userId,
    price,
    "generation",
    "Sign a Cast (pending)",
    operationChargeReference(operationId),
    "castingV2",
  );
  if (!chargeResult.success) {
    return completeDirectOperationFailure({
      userId: input.userId,
      operationId,
      error: new TRPCError({
        code: "BAD_REQUEST",
        message: chargeResult.error || `Not enough credits. Signing a Cast costs ${price} credits.`,
      }),
      chargedCredits: 0,
      refundedCredits: 0,
    });
  }

  // ---- everything from here is compensable, and compensated on any throw ----
  let cast: Awaited<ReturnType<typeof signCandidateIntoCast>>;
  let documents: ReturnType<typeof identityDocumentsFor>;
  let anchorStorageKey = "";
  try {
    documents = identityDocumentsFor(source);
    const identityRevisionId = mintRevisionId();
    const extension = imageKey.toLowerCase().endsWith(".jpg") ? "jpg" : "png";
    const destinationKey = `${CAST_KEY_PREFIX}/${operationId}/anchor/${randomUUID()}.${extension}`;

    /*
      MANIFEST BEFORE COPY (D-92's orphaned-storage-copy defence).

      The copy can succeed and the process die before anything references the
      key, and the cleanup worker only ever deletes keys a row handed it. So the
      key is handed over BEFORE it exists: its own transaction, committed first,
      so the manifest cannot be rolled back by the failure it exists to clean up
      after. The Sign transaction deletes the manifest as its last act, which is
      what stops the worker deleting a live Cast's anchor.
    */
    const manifest = await withTransaction((tx) => createStorageCleanupManifestIn(tx, {
      id: randomUUID(),
      userId: input.userId,
      operationId,
      // The domain's own cleanup kind (0017). This object began life as a
      // casting-v2 candidate image and is a casting-v2 object still; the worker
      // deletes exact keys and does not read the kind.
      kind: "casting_candidate_cleanup",
      storageItems: [{ storageKey: destinationKey, storageBackend: "public_r2" }],
    }));

    const copied = await (dependencies.copyImage ?? storageCopyExact)({
      sourceKey: imageKey,
      destinationKey,
    });
    if (copied.key !== destinationKey) throw new SignPersistenceError("commit_conflict");
    anchorStorageKey = copied.key;

    /*
      A CAST OWNS ITS OWN COPY of the image, never the candidate's object. The
      candidate's row and object delete together at retention (§G.6), and a Cast
      pointing at a purged key would be a Cast whose face disappeared a week
      after it was signed.
    */
    cast = await withUniqueCastPublicId((agencyId) => signCandidateIntoCast({
      userId: input.userId,
      operationId,
      candidateId: source.candidate.id,
      rollId: source.roll.id,
      sessionId: source.session.id,
      name: input.name?.trim() || null,
      cohortKey: source.roll.cohortKey,
      styleKey: source.roll.styleKey,
      masterPrompt: documents.masterPrompt,
      technicalSchema: documents.technicalSchema,
      preferences: documents.preferences,
      identityText: documents.identityText,
      identityRevisionId,
      agencyId,
      anchor: {
        storageKey: copied.key,
        storageUrl: copied.url,
        provenance: {
          sourceCandidatePublicId: source.candidate.publicId,
          sourceRollPublicId: source.roll.publicId,
        },
      },
      cleanupBatchId: manifest.id,
    }));
  } catch (error) {
    /*
      PAID FAILURE. The Cast does not exist, the candidate is untouched and
      still `ready`, and the whole price goes back under the derived refund
      reference. The copied object — if the copy is what got that far — is owned
      by the cleanup manifest and the worker deletes it once this operation is
      terminal.
    */
    const refund = await recordRefund(
      input.userId,
      price,
      "Sign didn't complete",
      operationChargeReference(operationId),
    );
    if (!refund.recorded) {
      log.error(
        { operationId, userId: input.userId, reference: refund.reference },
        "[signService] the Sign refund did not record — the owner remains charged",
      );
    }
    log.warn({ operationId, err: error }, "[signService] Sign failed before the durable boundary");
    return completeDirectOperationFailure({
      userId: input.userId,
      operationId,
      error: signRefusal(error, refund.recorded, operationId),
      chargedCredits: price,
      refundedCredits: refund.recorded ? refund.amount : 0,
    });
  }

  log.info(
    { operationId, modelId: cast.modelId, castPublicId: cast.agencyId },
    "[signService] Cast signed — building the package",
  );

  const schedule = dependencies.schedulePackage ?? detach;
  await schedule(() => completeSignPackage(dependencies, {
    userId: input.userId,
    operationId,
    modelId: cast.modelId,
    agencyId: cast.agencyId,
    /*
      The package references the CAST'S OWN copy, never the candidate's object.
      The candidate's row and its object delete together at retention (§G.6),
      and a package generated from a key that is about to be purged would be a
      package whose reference disappeared underneath it.
    */
    anchorStorageKey,
    identityRevisionId: cast.identityRevisionId,
    identityText: documents.identityText,
    chargedCredits: price,
  }));

  return { castPublicId: cast.agencyId, chargedCredits: price };
}

/** Production scheduling: hand it to the event loop, never lose the error. */
function detach(run: () => Promise<void>): void {
  void run().catch((error) => {
    log.error({ err: error }, "[signService] the detached package continuation threw");
  });
}

/**
 * Everything after the durable boundary: build, activate, seal.
 *
 * Contained on purpose — a throw in here must never look like a Sign failure to
 * the customer, because the Cast already exists. The worst case is that this
 * function does nothing at all, and then the operation's lease lapses and the
 * Sign adjudicator finishes exactly this work from the durable rows.
 */
async function completeSignPackage(
  dependencies: SignServiceDependencies,
  input: {
    userId: number;
    operationId: string;
    modelId: number;
    agencyId: string;
    anchorStorageKey: string;
    identityRevisionId: string;
    identityText: string;
    chargedCredits: number;
  },
): Promise<void> {
  try {
    const anchorBytes = await (dependencies.readBytes ?? storageReadBytes)(input.anchorStorageKey);
    const result = await (dependencies.buildPackage ?? buildCastPackage)(dependencies, {
      userId: input.userId,
      operationId: input.operationId,
      modelId: input.modelId,
      identityRevisionId: input.identityRevisionId,
      identityText: input.identityText,
      anchor: anchorBytes,
    });

    if (result.refundUnrecorded) {
      /*
        A refund that did not record is never sealed as a clean receipt. The
        Cast stands and its views stand; what needs a human is the money.
      */
      await markGenerationOperationRecoveryRequired({
        userId: input.userId,
        operationId: input.operationId,
        publicMessage:
          `Part of this Cast's refund could not be recorded — quote operation ${input.operationId} and support will restore the balance.`,
        chargedCredits: input.chargedCredits,
        refundedCredits: result.refundedCredits,
      }).catch((error) => {
        log.fatal(
          { operationId: input.operationId, err: error },
          "[signService] could not mark an unrecorded refund for recovery",
        );
      });
      return;
    }

    // Bind BEFORE the receipt: the helper is gated on `running`, and the
    // operation stops being running the moment it is finalized.
    await bindGenerationOperationModel({
      userId: input.userId,
      operationId: input.operationId,
      modelId: input.modelId,
    }).catch((error) => {
      log.warn(
        { operationId: input.operationId, modelId: input.modelId, err: error },
        "[signService] the operation could not be bound to its Cast",
      );
    });

    await finalizeGenerationOperationSuccess({
      userId: input.userId,
      operationId: input.operationId,
      result: {
        castPublicId: input.agencyId,
        views: result.committed.length,
        failedViews: result.failed.length,
      },
      chargedCredits: input.chargedCredits,
      refundedCredits: result.refundedCredits,
      terminalStatus: result.failed.length > 0 ? "partial" : "succeeded",
    });
  } catch (error) {
    /*
      The sweep owns it from here. Sealing is the only thing that can have
      failed by this point — the money was settled slice by slice as the views
      resolved — and the adjudicator recomputes the totals from the ledger
      rather than trusting anything this process believed.
    */
    log.error(
      { operationId: input.operationId, modelId: input.modelId, err: error },
      "[signService] the package could not be sealed — leaving it for the recovery sweep",
    );
  }
}

function signRefusal(error: unknown, refunded: boolean, operationId: string): TRPCError {
  const tail = refunded
    ? "You were not charged."
    : `Part of the refund could not be recorded — quote operation ${operationId} and support will restore the balance.`;
  if (error instanceof TRPCError) return error;
  if (error instanceof SignPersistenceError) {
    switch (error.code) {
      case "candidate_unavailable":
        return new TRPCError({
          code: "CONFLICT",
          message: `That candidate was already signed or discarded. ${tail}`,
        });
      case "session_unavailable":
        return new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `That sheet is no longer open. ${tail}`,
        });
      case "operation_unavailable":
        return new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `This Sign was already settled. ${tail}`,
        });
      default:
        return new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `The Cast couldn't be signed. ${tail}`,
        });
    }
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `The Cast couldn't be signed. ${tail}`,
  });
}

export { CASTING_V2_SIGN_PRICE_CREDITS, CASTING_V2_SIGN_COSTS };
