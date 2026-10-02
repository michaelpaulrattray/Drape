import { TRPCError, type TRPC_ERROR_CODE_KEY } from "@trpc/server";
import {
  acquireCastingCandidateOperationLock,
  acquireGenerationOperationLock,
  claimGenerationOperation,
  finalizeClaimedGenerationOperationSuccess,
  finalizeClaimedGenerationOperationFailure,
  finalizeGenerationOperationFailure,
  finalizeGenerationOperationSuccess,
  getGenerationOperationOutcome,
  markClaimedGenerationOperationRecoveryRequired,
  markGenerationOperationRecoveryRequired,
} from "../db";
import type {
  GenerationOperationKind,
  GenerationOperationLandingStatus,
  PublicOperationResult,
} from "./operationContract";
import { createModuleLogger } from "../logging/logger";
import { spokenError } from "../_core/spokenError";
import { captureProductEvent } from "../monitoring/productEvents";
import { productErrorCode, productNoun, UNNAMED_ACTION } from "../../shared/productEventCatalogue";

const log = createModuleLogger("casting/directOperation");

/* ────────────────────────────────────────────────────────────────────────────
   THE PRODUCT EVENT STREAM'S ONE SEAM (#509 part 2).

   The founder's card names its events one by one — *"roll started / delivered /
   refused, refine, sign …"* — and every one of them is this file's lifecycle
   with a different `kind`. So the stream is DERIVED here rather than mirrored by
   a `capture()` hand-placed in each service, which is working law 4: a second
   list beside the operations table would drift from it, and an event somebody
   forgot to add would look exactly like an action nobody performed.

   ⚠ NOTHING BELOW MAY CHANGE WHAT THIS FILE DOES. Every capture is
   fire-and-forget, cannot throw (the transport swallows its own faults), and
   sits AFTER the receipt it describes — so an analytics fault can never cost a
   customer a refund, and an event is never sent for a receipt that failed to
   write. Read the order at each call site: the finalizer first, the capture
   after it returned.

   # WHY THE ACTION IS REMEMBERED HERE, AND WHAT THAT COSTS

   The completion functions take `operationId` and money and no `kind` — 99 call
   sites across the four of them, so threading the kind down would be a 99-file
   diff through the money path for one string. The kind IS known at the claim,
   a few lines up, so it is remembered here and taken at the terminal.

   ⚠ **ITS LIMIT, STATED RATHER THAN DISCOVERED LATER: this memory is in this
   PROCESS.** An operation claimed before a deploy and finalized after it, or
   finalized by the recovery sweep in another process, has no entry — and its
   terminal event reports `action: "unnamed action"`, which is a NAMED unknown
   and never a wrong noun. That is the same tradeoff the login-attack detector's
   counter carries and is written down for the same reason. The map is capped so
   an operation that never terminates cannot grow it without bound; the oldest
   entry goes first, which on this product's volumes is an entry from an
   operation that has already been abandoned.
   ──────────────────────────────────────────────────────────────────────────── */

/** Enough for every operation in flight many times over; one entry is ~40 bytes. */
const MAX_REMEMBERED_ACTIONS = 512;
const actionByOperation = new Map<string, string>();

function rememberAction(operationId: string, kind: GenerationOperationKind): void {
  if (actionByOperation.size >= MAX_REMEMBERED_ACTIONS) {
    /* A `Map` iterates in insertion order, so this is the oldest. */
    const oldest = actionByOperation.keys().next().value;
    if (oldest !== undefined) actionByOperation.delete(oldest);
  }
  actionByOperation.set(operationId, productNoun(kind));
}

function takeAction(operationId: string): string {
  const action = actionByOperation.get(operationId);
  actionByOperation.delete(operationId);
  return action ?? UNNAMED_ACTION;
}

/** Test seam only: forget the remembered actions between arms. */
export function resetDirectOperationActionsForTests(): void {
  actionByOperation.clear();
}

const PUBLIC_TRPC_CODES = new Set<TRPC_ERROR_CODE_KEY>([
  "BAD_REQUEST", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND",
  "METHOD_NOT_SUPPORTED", "TIMEOUT", "CONFLICT", "PRECONDITION_FAILED",
  "PAYLOAD_TOO_LARGE", "UNPROCESSABLE_CONTENT", "TOO_MANY_REQUESTS",
  "CLIENT_CLOSED_REQUEST", "INTERNAL_SERVER_ERROR", "NOT_IMPLEMENTED",
]);

function trpcCode(value: string): TRPC_ERROR_CODE_KEY {
  return PUBLIC_TRPC_CODES.has(value as TRPC_ERROR_CODE_KEY)
    ? value as TRPC_ERROR_CODE_KEY
    : "INTERNAL_SERVER_ERROR";
}

export type DirectOperationGate =
  | { type: "execute"; operationId: string }
  | { type: "replay"; operationId: string; result: unknown };

export async function beginDirectOperation(input: {
  userId: number;
  clientRequestId: string;
  kind: GenerationOperationKind;
  modelId?: number | null;
  originBoardId?: number | null;
  originItemId?: number | null;
  payload: unknown;
  lockKey?: string;
  /**
   * THE SENTENCE A BUSY LOCK SAYS, when the generic one is wrong (#1257).
   *
   * The default below is written for whoever reads a log — "another operation",
   * "this Cast" — and it is right for the five roads that take a `model:` or
   * `board-item:` lock, where a customer meeting it has asked for something
   * about the whole Cast.
   *
   * A per-slot lock is different: the road that takes one ALREADY refuses the
   * common case in its own words, from the slot's state, a few hundred
   * milliseconds earlier. Two customers who pressed the same button at slightly
   * different moments must not be told two different things about one fact, so
   * the caller hands its own sentence down rather than keeping a second one up
   * here. It is copy, not request input — never composed from anything a
   * request carries.
   */
  lockBusyMessage?: string;
  /**
   * ONE FACE, ONE RENDER (Landing C, ruled fable-974).
   *
   * The candidate this ask is about, locked for the life of the operation. A
   * held request used to be the guard: a customer who tapped twice was watching
   * a spinner for two hundred seconds, so a second tap was rare and expensive to
   * make. A receipt that comes back in milliseconds invites one — and the client
   * mints a fresh request id per submit, so idempotency is structurally blind to
   * it. Proven rather than assumed: two taps, two ids, concurrent, bought twice
   * (`scripts/prove-refine-idempotency-disposable.mts` arm 3).
   *
   * Not a disabled button. The contract is at the wire, because a second tab, a
   * retried request and a slow network all get past a client debounce.
   */
  candidateLockPublicId?: string;
  resumeClaimedEvidence?: boolean;
}): Promise<DirectOperationGate> {
  const claim = await claimGenerationOperation(input);
  switch (claim.type) {
    case "deleted_subject":
      throw new TRPCError({ code: "NOT_FOUND", message: "Cast not found" });
    case "replay_success":
      return { type: "replay", operationId: claim.operationId, result: claim.result };
    case "replay_failure":
      throw new TRPCError({ code: trpcCode(claim.errorCode), message: claim.publicMessage });
    case "payload_conflict":
      throw new TRPCError({
        code: "CONFLICT",
        message: "That request id was already used for a different action. Nothing was run.",
      });
    case "in_progress":
      throw new TRPCError({
        code: "CONFLICT",
        message: `This action is already in progress. Operation ${claim.operationId}.`,
      });
    case "recovery_required":
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: claim.publicMessage });
    case "resource_busy":
      throw new TRPCError({ code: "CONFLICT", message: "Another operation is already changing this Cast." });
    case "claimed":
      break;
  }

  if (input.lockKey) {
    const lock = await acquireGenerationOperationLock({
      userId: input.userId,
      operationId: claim.operationId,
      kind: input.kind,
      lockKey: input.lockKey,
    });
    if (lock.type === "resource_busy") {
      throw new TRPCError({
        code: "CONFLICT",
        message: input.lockBusyMessage
          ?? "Another operation is already changing this Cast. Wait for it to finish before retrying.",
      });
    }
  }
  if (input.candidateLockPublicId) {
    const lock = await acquireCastingCandidateOperationLock({
      userId: input.userId,
      operationId: claim.operationId,
      kind: input.kind,
      candidatePublicId: input.candidateLockPublicId,
    });
    if (lock.type === "resource_busy") {
      /*
        HER SENTENCE, NOT THE STAFF ONE (bound, fable-973 §2).
    
        The line above is written for whoever is reading a log: "another
        operation", "this Cast", "before retrying". The person who meets THIS
        one tapped a button twice and is looking at her own face, with the edit
        she asked for already running on the panel in front of her. It is marked
        `spoken` so the surface shows our words rather than deciding by code
        which sentence it may trust.
      */
      throw spokenError({
        code: "CONFLICT",
        message: "That edit is already being made — it finishes before the next one starts. Nothing extra was charged.",
      });
    }
  }
  /* The operation is claimed, locked and about to run: this is the moment the
     customer's action began. A REPLAY returns above and never reaches here, so
     a retried request id does not count twice — which is the whole reason this
     sits at the bottom of the function rather than at the top. */
  rememberAction(claim.operationId, input.kind);
  captureProductEvent("generation started", input.userId, {
    action: productNoun(input.kind),
  });
  return { type: "execute", operationId: claim.operationId };
}

export async function failClaimedDirectOperation(input: {
  userId: number;
  operationId: string;
  error: unknown;
}): Promise<never> {
  const error = input.error instanceof TRPCError
    ? input.error
    : new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The operation could not start." });
  try {
    await finalizeClaimedGenerationOperationFailure({
      userId: input.userId,
      operationId: input.operationId,
      errorCode: error.code,
      publicMessage: error.message,
    });
  } catch (receiptError) {
    const existing = await terminalOutcomeAfterWriteError(input.userId, input.operationId);
    if (existing?.type === "replay_failure") throw error;
    const publicMessage = `The result needs support review before this action can be retried. Operation ${input.operationId}.`;
    try {
      await markClaimedGenerationOperationRecoveryRequired({
        userId: input.userId,
        operationId: input.operationId,
        publicMessage,
      });
    } catch (recoveryError) {
      log.fatal(
        { operationId: input.operationId, receiptError, err: recoveryError },
        "[DirectOperation] claimed receipt and recovery mark both failed",
      );
    }
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: publicMessage });
  }
  /*
    AFTER the receipt, and OUTSIDE the block that guards it. The first draft of
    this put the capture inside the `try`: had it ever thrown, the catch would
    have read a SUCCESSFUL receipt as a failed one and marked the operation
    `recovery_required` — an analytics line costing a customer their retry. The
    transport cannot throw, and the structure does not depend on that being true.

    It failed before it started spending, so the money is zero rather than
    absent: "failed with nothing charged" is the truth, where an absent number
    would read as unknown. `error.message` is deliberately NOT sent — it is the
    one property on this path that can quote a provider quoting her brief, and
    the catalogue's header names it as the specimen.
  */
  captureProductEvent("generation failed", input.userId, {
    action: takeAction(input.operationId),
    errorCode: productErrorCode(error.code),
    creditsCharged: 0,
    creditsRefunded: 0,
  });
  throw error;
}

/** Persist a free pre-start answer (such as a clarification question) as a
 * successful receipt. This keeps classification replay-safe without claiming
 * that an image was generated or any credits moved. */
export async function completeClaimedDirectOperationSuccess(input: {
  userId: number;
  operationId: string;
  result: PublicOperationResult;
}): Promise<void> {
  try {
    await finalizeClaimedGenerationOperationSuccess(input);
  } catch (receiptError) {
    const existing = await terminalOutcomeAfterWriteError(input.userId, input.operationId);
    if (existing?.type === "replay_success") return;
    const publicMessage = `The result needs support review before this action can be retried. Operation ${input.operationId}.`;
    try {
      await markClaimedGenerationOperationRecoveryRequired({
        userId: input.userId,
        operationId: input.operationId,
        publicMessage,
      });
    } catch (recoveryError) {
      log.fatal(
        { operationId: input.operationId, receiptError, err: recoveryError },
        "[DirectOperation] claimed success receipt and recovery mark both failed",
      );
    }
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: publicMessage });
  }
  /*
    A FREE PRE-START ANSWER IS STILL A DELIVERY, AND IT IS RECORDED AS ONE WITH
    ZERO ON IT.

    This function's own docblock says what it is: a clarification question
    answered *"without claiming that an image was generated or any credits
    moved."* The temptation is to send nothing at all — and that would leave a
    `generation started` with no terminal, so starts would permanently exceed
    deliveries plus failures and nobody reading the dashboard would know why.
    `creditsCharged: 0` is what separates a free answer from a paid picture, in
    one filter, on a number that cannot be misread.
  */
  captureProductEvent("generation delivered", input.userId, {
    action: takeAction(input.operationId),
    outcome: "complete",
    creditsCharged: 0,
    creditsRefunded: 0,
  });
}

async function markRecoveryAfterReceiptFailure(input: {
  userId: number;
  operationId: string;
  chargedCredits: number;
  refundedCredits: number;
  cause: unknown;
}): Promise<never> {
  const publicMessage = `The result needs support review before this action can be retried. Operation ${input.operationId}.`;
  try {
    await markGenerationOperationRecoveryRequired({
      userId: input.userId,
      operationId: input.operationId,
      publicMessage,
      chargedCredits: input.chargedCredits,
      refundedCredits: input.refundedCredits,
    });
  } catch (recoveryError) {
    log.fatal(
      { operationId: input.operationId, err: recoveryError },
      "[DirectOperation] terminal receipt and recovery mark both failed",
    );
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: publicMessage });
}

async function terminalOutcomeAfterWriteError(userId: number, operationId: string) {
  return getGenerationOperationOutcome(userId, operationId).catch(() => null);
}

export async function requireDirectOperationRecovery(input: {
  userId: number;
  operationId: string;
  chargedCredits: number;
  refundedCredits: number;
  cause: unknown;
}): Promise<never> {
  return markRecoveryAfterReceiptFailure(input);
}

export async function completeDirectOperationSuccess(input: {
  userId: number;
  operationId: string;
  result: PublicOperationResult;
  chargedCredits: number;
  refundedCredits: number;
  /** A roll that delivered some of its eight is a `partial`, not a success
   *  with a footnote — the receipt says which, and refunds prove it. */
  terminalStatus?: "partial" | "succeeded";
  landing?: {
    status: GenerationOperationLandingStatus;
    landedItemId?: number | null;
    acknowledgedAt?: Date | null;
  };
}): Promise<void> {
  try {
    await finalizeGenerationOperationSuccess(input);
  } catch (error) {
    const existing = await terminalOutcomeAfterWriteError(input.userId, input.operationId);
    /* A receipt that already existed is a REPLAY — the delivery was recorded
       when it first happened, and counting it again would inflate exactly the
       number the founder would read first. */
    if (existing?.type === "replay_success") return;
    await markRecoveryAfterReceiptFailure({ ...input, cause: error });
  }
  /*
    THE DELIVERY, AND THE ONE PROPERTY THAT MAKES IT WORTH READING.

    `partial` is this file's own vocabulary — *"a roll that delivered some of its
    eight is a `partial`, not a success with a footnote"* — and carrying it
    through is the difference between a dashboard that can see an engine getting
    worse and one that reports eight-for-eight and six-for-eight identically.
    `creditsRefunded` says HOW much did not arrive, in the only unit that is
    reconciled against the ledger.
  */
  captureProductEvent("generation delivered", input.userId, {
    action: takeAction(input.operationId),
    outcome: input.terminalStatus === "partial" ? "partial" : "complete",
    creditsCharged: input.chargedCredits,
    creditsRefunded: input.refundedCredits,
  });
}

export async function completeDirectOperationFailure(input: {
  userId: number;
  operationId: string;
  error: unknown;
  chargedCredits: number;
  refundedCredits: number;
}): Promise<never> {
  const error = input.error instanceof TRPCError
    ? input.error
    : new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The operation failed." });
  try {
    await finalizeGenerationOperationFailure({
      userId: input.userId,
      operationId: input.operationId,
      errorCode: error.code,
      publicMessage: error.message,
      chargedCredits: input.chargedCredits,
      refundedCredits: input.refundedCredits,
    });
  } catch (receiptError) {
    const existing = await terminalOutcomeAfterWriteError(input.userId, input.operationId);
    /* Already recorded when it first failed — see the replay note above. */
    if (existing?.type === "replay_failure") throw error;
    await markRecoveryAfterReceiptFailure({
      userId: input.userId,
      operationId: input.operationId,
      chargedCredits: input.chargedCredits,
      refundedCredits: input.refundedCredits,
      cause: receiptError,
    });
  }
  /* The money BOTH ways, because a failure that refunded everything and one
     that refunded nothing are different facts about the product and the second
     is the one worth a card. `error.message` stays behind — the catalogue's
     header says why, and this is the path it was written about. */
  captureProductEvent("generation failed", input.userId, {
    action: takeAction(input.operationId),
    errorCode: productErrorCode(error.code),
    creditsCharged: input.chargedCredits,
    creditsRefunded: input.refundedCredits,
  });
  throw error;
}

/* ════════════════════════════════════════════════════════════════════════════
   THE TERMINAL EVENT FOR A SETTLEMENT MADE SOMEWHERE ELSE (#1429)

   The four completers above are the road most operations take, and each sends
   its terminal event. **They are not the only road.** Some operations settle
   terminally by calling a finalizer directly — because the settlement is
   detached from the request (Sign's package), or because it must be
   transaction-scoped so the receipt becomes visible with the product mutation
   it describes (`finalizeClaimedGenerationOperationSuccessIn`,
   `finalizeRunningGenerationOperationSuccessIn`), or because the receipt is
   written inline as part of a larger authority (the Cast deletion ceremony).
   Every one of those emitted `generation started` at the claim and then nothing.

   **So the reading on the dashboard was: a successful Sign is a generation that
   started and never ended** — on the most expensive operation in the product,
   8,500 credits — while Sign's two FAILURE paths recorded correctly. Starts
   permanently exceed deliveries plus failures, and the failure rate reads as
   100% of everything recorded for that action. Same shape on the live road as
   #1425 fixed for the recovery sweep, on the ordinary every-time path rather
   than the mid-deploy one.

   # WHY THESE TWO ARE RECORDERS AND NOT COMPLETERS

   A completer OWNS the settlement: it finalizes, handles a receipt write that
   threw, and marks recovery. These sites already do all of that themselves,
   correctly, in ways a completer cannot express — inside a transaction, or
   after a detached build whose failure hands the operation to the sweep. So
   what is missing is only the RECORD, and a recorder is what fits: it makes no
   database call, decides nothing, and returns nothing.

   # WHY THE EVENT IS READ OFF THE SETTLEMENT AND NOT RE-READ FROM THE ROW

   #1425 read the receipt back, and the reason it gave was specific:
   `StaleOperationDecision` folds a partial delivery into `durable_success`, so
   the sweep's own verdict genuinely could not tell six-of-eight from
   eight-of-eight. **No information is lost here, and that is provable at the
   finalizers rather than assumed:**

     · `finalizeGenerationOperationSuccess` updates `WHERE status = 'running'`
       and THROWS when it did not affect exactly one row. So if it returned, the
       row now holds exactly the `terminalStatus`, `chargedCredits` and
       `refundedCredits` it was handed. The caller's values are not a claim
       about the row — they ARE the row.
     · `finalizeClaimedGenerationOperationSuccessIn` and
       `finalizeRunningGenerationOperationSuccessIn` write
       `chargedCredits: 0, refundedCredits: 0` LITERALLY, and the second refuses
       a paid operation outright (`plannedCredits !== 0` throws). Zero on those
       roads is a structural fact, not an optimistic default.
     · The deletion ceremony's inline receipt sets both to `0` in the same
       statement.

   A read-back would add a query that can fail on a detached path, and a window
   in which another writer could move the row — making the event LESS faithful
   to the settlement it describes, not more.

   # WHY PLACEMENT IS SAFE WHEREVER THE CALL SITE READS BEST

   `directOperation.ts`'s own rule is that a capture sits after the receipt and
   outside the block that guards it, because a capture inside a `try` lets an
   analytics fault be read as a settlement fault — marking an operation
   `recovery_required` and costing a customer their retry. **Both functions
   below are SYNCHRONOUS and cannot throw**: `captureProductEvent` swallows its
   own faults, and these add no statement that can. The hazard is removed by
   construction rather than by where the line is written, so each call site puts
   it where the settlement is unambiguously done — which on an in-transaction
   settlement means after the transaction COMMITTED, since a rolled-back
   transaction settled nothing.

   # EXACTLY ONCE, AND IT IS STRUCTURAL

   Every finalizer these sites call is gated on the pre-terminal status and
   throws when it affects no row, so two settlements of one operation are
   impossible and the loser never reaches its recorder. And the sweep cannot
   double-count what the live road recorded: the adjudicator's door admits
   `claimed`, `running` and a fenced Sign only (`operationRecovery.ts`), so a
   row this road settled to `succeeded` / `partial` / `failed` returns
   `"skipped"` above every settlement site. **A fenced Sign is the one exception
   that door makes and it is not a counterexample** — a fence is written instead
   of a success receipt, so the live road never recorded that operation at all
   and the sweep's event is its only one.
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Record the terminal delivery of an operation this process just settled
 * successfully through a finalizer rather than through
 * `completeDirectOperationSuccess`.
 *
 * Call it AFTER the settlement has definitely landed — after the finalizer
 * returned, and for a transaction-scoped finalizer after the transaction
 * committed. Synchronous, and it cannot throw.
 *
 * `chargedCredits` / `refundedCredits` are what the settlement wrote to the
 * receipt; a free road passes zeros because its finalizer writes zeros.
 */
export function recordDirectOperationDelivered(input: {
  userId: number;
  operationId: string;
  chargedCredits: number;
  refundedCredits: number;
  /** `partial` when some of what was asked for did not arrive — the roll's and
   *  Sign's own vocabulary, and the distinction a degrading engine shows up in. */
  terminalStatus?: "partial" | "succeeded";
}): void {
  captureProductEvent("generation delivered", input.userId, {
    action: takeAction(input.operationId),
    outcome: input.terminalStatus === "partial" ? "partial" : "complete",
    creditsCharged: input.chargedCredits,
    creditsRefunded: input.refundedCredits,
  });
}

/**
 * Record the terminal failure of an operation this process just settled as
 * failed through a finalizer rather than through `completeDirectOperationFailure`
 * or `failClaimedDirectOperation`.
 *
 * The same placement rule and the same guarantees as its delivery twin. The
 * error's MESSAGE is deliberately not a parameter: it is the one property on
 * this path that can quote a provider quoting a customer's brief, and the
 * catalogue's header names it as the specimen.
 */
export function recordDirectOperationFailed(input: {
  userId: number;
  operationId: string;
  errorCode: string;
  chargedCredits: number;
  refundedCredits: number;
}): void {
  captureProductEvent("generation failed", input.userId, {
    action: takeAction(input.operationId),
    errorCode: productErrorCode(input.errorCode),
    creditsCharged: input.chargedCredits,
    creditsRefunded: input.refundedCredits,
  });
}
