/**
 * The roll service — the only writer of roll state (plan §E).
 *
 * THE SEQUENCE, which is the whole design:
 *
 *   compile → admit → claim → locked transaction → rows → running →
 *   pinned deduct → dispatch → per-slice settlement → receipt
 *
 * Each arrow is load-bearing:
 *
 * - **compile and admit first**, because both can refuse, and a refusal before
 *   the claim costs the user nothing and leaves no operation to explain.
 * - **claim before rows**, so a replayed `clientRequestId` returns the roll
 *   that already exists instead of creating a second one for the same money
 *   (§H.7). Rolls take no exclusive lock — the lock grammar is model-scoped
 *   and a roll has no model; concurrent rolls in one session are legal
 *   immutable versions (§E).
 * - **rows before the charge**, so the recovery adjudicator's rule holds: rows
 *   without a ledger charge mean a crash before the money moved, and nothing
 *   is owed back. Reversing these two would make every crash in the window
 *   either a silent overcharge or an invented refund.
 * - **dispatch after the charge**, so nothing can be delivered unpaid.
 * - **per-slice settlement**, because a roll is eight independently refundable
 *   units. The whole-charge refund that `withAtomicCredits` performs on throw
 *   is wrong here — it would refund a candidate the user actually received —
 *   so this path charges directly with the pinned reference and compensates
 *   slice by slice, exactly as `mintPackage` does for view slots.
 *
 * Dispatch is awaited in-request under a heartbeated lease, matching every
 * other long operation in this repo — the mint package executor and the
 * evidence package sync executor both run this way. (Named by description
 * rather than by symbol: those symbols carry caller-inventory pins, and a
 * comment must not make this file look like a call site.) The client does not
 * wait on dispatch: rows commit
 * before dispatch, so the 2.5s roll poll shows eight skeletons within one tick
 * and each tile swaps on its own candidate's terminal event.
 */
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";

import { CASTING_V2_COSTS } from "../casting/castingCreditCosts";
import { censusOfAttempt, censusSoFar } from "./callCensus";
import { recordRefund, refundTruth } from "../casting/atomicCredits";
import {
  beginDirectOperation,
  completeDirectOperationFailure,
  completeDirectOperationSuccess,
  failClaimedDirectOperation,
} from "../casting/directOperation";
import { operationChargeReference } from "../casting/operationContract";
import { deductCredits } from "../db/credits";
import { assertNotFrozen } from "./spendGuards";
import { createGeneration, updateGeneration } from "../db/generations";
import { markGenerationOperationRunning } from "../db/generationOperations";
import {
  CastingV2OwnershipError,
  cancelQueuedCandidate,
  createRollWithCandidates,
  failCandidate,
  getOwnedCandidateWithSelectedFace,
  getOwnedRoll,
  getRollByOperation,
  landCandidate,
  listRollCandidates,
  markCandidateDispatched,
  setRollStatus,
  touchCastingSession,
} from "../db/castingV2";
import { storageDelete, storagePut } from "../storage";
import { thumbnailOf } from "./thumbnails";
import { createModuleLogger } from "../logging/logger";
import { detectRenderFault } from "./renderFault";
import { ProviderError } from "../providers/types";
import type { CreativeEngine } from "../providers/types";
import {
  BriefRefusal,
  castingBriefCompiler,
  type BriefCompiler,
  type CompiledRollBrief,
  type LockOverrides,
  type UnlockableField,
} from "./briefCompiler";
import type { ResolvedIdentity } from "./castingIntent";
import { admitRoll, castingCreativeEngine, type AdmissionDecision } from "./rollEngine";
import { candidateChargeReference, candidateUnseenChargeReference } from "./rollRecovery";

const log = createModuleLogger("castingV2/rollService");

/**
 * The parent's resolved identity, read back out of its stored internal prompt.
 *
 * Validated rather than trusted, like every other read of a json column: the
 * shape is written by this service today, but a column that is parsed as
 * whatever it happens to contain is one migration away from being an injection
 * path into the next roll's prompt.
 */
export function readResolvedIdentity(internalPrompt: unknown): ResolvedIdentity | null {
  if (!internalPrompt || typeof internalPrompt !== "object") return null;
  const resolved = (internalPrompt as { resolved?: unknown }).resolved;
  if (!resolved || typeof resolved !== "object") return null;
  const candidate = resolved as Record<string, unknown>;
  /*
    ONLY the fields that are genuinely always present (founder gate 16).

    This used to require `build` to be a string, and `build` is deliberately
    null whenever the brief names a casting category — which is most briefs,
    because the category owns physique (gate B5). So the check rejected almost
    every parent, `followFrom` received null, the next roll re-interpreted the
    brief with nothing inherited, and `varySex` alternated: the founder
    followed a blonde woman and got four men back.

    Nothing refused and nothing logged. The identity was simply thrown away for
    being correctly shaped. Exactly the defect we fixed a day earlier, where a
    bare `.optional()` rejected an explicit null and discarded a correct
    interpreter reply — a validator treating a legitimate absence as garbage.

    So: required fields are checked, optional ones are read if present and
    ignored if not. Rows written before a field existed — `agePhase`, `look`,
    now `hair` — degrade to null rather than to a discarded parent, which also
    means adding the next trait cannot silently break follow for every
    candidate already on disk.
  */
  if (
    typeof candidate.sex !== "string"
    || typeof candidate.ageBand !== "string"
    || typeof candidate.energy !== "string"
    || !Array.isArray(candidate.heritage)
  ) {
    return null;
  }
  return resolved as ResolvedIdentity;
}

/** Objects live under one namespace so cleanup and audit can find them. */
const CANDIDATE_KEY_PREFIX = "casting-v2/candidates";

/**
 * The render-fault verdict, in the shape the audit row carries it.
 *
 * One helper because it is written from TWO places — the candidate that landed
 * and the candidate this detector just failed — and a verdict recorded in two
 * shapes is a history nobody can query. **Every verdict is written, not only
 * the fires:** a record that only holds faults cannot tell "no faults today"
 * from "the detector stopped running", which is the inert-control failure this
 * program keeps meeting. D-115's evidence stream is the whole series.
 */
function renderFaultMetadata(
  verdict: Awaited<ReturnType<typeof detectRenderFault>> | null,
): Record<string, unknown> | undefined {
  /*
    AND WHAT THE TILE COST, on the same row and for the same reason the verdict
    is here: it needs no migration, and it is genuinely audit rather than
    product. A log line rotates on the next deploy; this row is still there
    next week, when somebody asks whether the roll got slower.

    Delivered or failed, both paths write it — a census that recorded only the
    tiles that worked would price the good days, and a failed tile is money out
    with nothing delivered.
  */
  const spent = censusSoFar();
  const cost = spent === null ? undefined : {
    calls: spent.total.calls,
    callMs: spent.total.ms,
    failedCalls: spent.total.failed,
    wallMs: spent.wallMs,
    byModel: spent.byModel,
  };
  if (!verdict && !cost) return undefined;
  return {
    ...(cost ? { cost } : {}),
    ...(verdict ? {
      renderFault: verdict.fault,
      renderFaultReason: verdict.reason,
      ...(verdict.detail ? { renderFaultDetail: verdict.detail } : {}),
    } : {}),
  };
}

export type RollServiceDependencies = {
  compileBrief?: BriefCompiler;
  engine?: () => CreativeEngine;
  admit?: (candidateCount: number) => AdmissionDecision;
  begin?: typeof beginDirectOperation;
  markRunning?: typeof markGenerationOperationRunning;
  deduct?: typeof deductCredits;
  /**
   * Writes a delivered picture and answers where it went.
   *
   * `key` is optional and the difference is the thumbnail's: a frame's key is
   * minted by the writer, while a thumbnail's is minted BEFORE the write so the
   * same key can be registered, held and discharged with its frame's.
   */
  storeImage?: (
    input: { bytes: Buffer; contentType: string; key?: string },
  ) => Promise<{ key: string }>;
};

export type CreateRollInput = {
  userId: number;
  clientRequestId: string;
  sessionPublicId: string;
  briefText: string;
  /**
   * Facts the user unpinned by removing a chip. Rolls are immutable, so this
   * can only ever affect the roll being created — never the one the chip was
   * shown on.
   */
  unlock?: readonly UnlockableField[];
  /**
   * Facts the user set by hand from the brief echo.
   *
   * Unlike `unlock`, these are re-sent on every roll for as long as they stand:
   * a roll re-reads the brief each time, so an adjustment that was not re-sent
   * would be silently re-derived away by the interpreter. See `applyOverrides`.
   */
  overrides?: LockOverrides;
  /** Follow lineage: a `ready` candidate of this user, in this session. */
  followCandidatePublicId?: string | null;
};

export type RollResult = {
  rollId: number;
  rollPublicId: string;
  chargedCredits: number;
  refundedCredits: number;
  ready: number;
  failed: number;
};

async function defaultStoreImage(input: { bytes: Buffer; contentType: string; key?: string }) {
  const extension = input.contentType === "image/jpeg" ? "jpg" : "png";
  if (input.key) {
    const written = await storagePut(input.key, input.bytes, input.contentType);
    return { key: written.key };
  }
  // Cryptographic UUID keys, never a pseudo-random source: a guessable key is
  // the only thing standing between a public-bucket candidate image and
  // anyone who guesses it. (The repo-wide guard rejects the weak API by name
  // in any storage writer, so this comment names it by description.)
  const { key } = await storagePut(
    `${CANDIDATE_KEY_PREFIX}/${randomUUID()}.${extension}`,
    input.bytes,
    input.contentType,
  );
  return { key };
}

export async function createRoll(
  dependencies: RollServiceDependencies,
  input: CreateRollInput,
): Promise<RollResult> {
  const compile = dependencies.compileBrief ?? castingBriefCompiler;
  const admit = dependencies.admit ?? admitRoll;
  const candidateCount = CASTING_V2_COSTS.rollCandidateCount;
  const price = CASTING_V2_COSTS.rollCandidate * candidateCount;

  await assertNotFrozen(input.userId);

  // §H.8: an honest refusal at the door, with nothing claimed and nothing
  // charged. Never a silent queue of paid work.
  const admission = admit(candidateCount);
  if (!admission.admitted) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message:
        admission.reason === "busy"
          ? "The studio is busy right now. Try that roll again in a moment — you were not charged."
          : "Casting is temporarily unavailable. Nothing was charged.",
    });
  }

  /*
    A follow roll is "more faces like this one", so the parent has to be in
    hand before compilation — otherwise following a candidate produces eight
    strangers and the lineage pill is a label on nothing. Read owner-scoped;
    the authoritative lineage link is still re-resolved inside the roll
    transaction (invariant 2), so this read cannot launder a foreign id.
  */
  let followPersonaLine: string | null = null;
  let followIdentity: ResolvedIdentity | null = null;
  if (input.followCandidatePublicId) {
    /*
      Read through SELECTION — §11's second landmine (D-123).

      "More faces like this one" has to mean the face they are looking at. If
      she has been refined, her family descends from the refinement: reading the
      candidate row directly is how you refine her eyes green, follow her, and
      get eight brown-eyed cousins. The helper resolves the variant through the
      owned parent in one statement, so a face cannot be borrowed across
      accounts.
    */
    const parent = await getOwnedCandidateWithSelectedFace(
      input.userId,
      input.followCandidatePublicId,
    );
    if (!parent) {
      throw new TRPCError({ code: "NOT_FOUND", message: "That candidate is no longer available." });
    }
    /*
      The candidate's INDEX, not its caption (founder gate 16). The ruling is
      that the sentence and the lineage pill say "following 08" and "FROM 08" —
      the face the user pointed at — rather than a persona label that could sit
      under any of the eight.
    */
    followPersonaLine = String(parent.candidate.position + 1).padStart(2, "0");
    followIdentity = readResolvedIdentity(parent.internalPrompt);
  }

  let compiled: CompiledRollBrief;
  try {
    compiled = await compile({
      briefText: input.briefText,
      candidateCount,
      // The client request id: a replay recompiles to the identical sheet,
      // while a genuine second roll of the same sentence casts eight new
      // people. Idempotency and variety from one value.
      rollSeed: input.clientRequestId,
      unlock: input.unlock ?? [],
      overrides: input.overrides,
      followPersonaLine,
      followIdentity,
    });
  } catch (error) {
    if (error instanceof BriefRefusal) {
      // A free refusal: no claim, no charge, no operation to reconcile.
      throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    }
    throw error;
  }

  const begin = dependencies.begin ?? beginDirectOperation;
  const gate = await begin({
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    kind: "castingV2.roll",
    payload: {
      sessionPublicId: input.sessionPublicId,
      briefText: input.briefText,
      followCandidatePublicId: input.followCandidatePublicId ?? null,
    },
  });

  if (gate.type === "replay") {
    // Idempotency, not an error (§F): the same request id returns the roll it
    // already created rather than rolling — and charging — a second time.
    const existing = await getRollByOperation(input.userId, gate.operationId);
    if (!existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "That roll has already been used for a different request.",
      });
    }
    const candidates = await listRollCandidates(input.userId, existing.id);
    return {
      rollId: existing.id,
      rollPublicId: existing.publicId,
      chargedCredits: existing.priceCredits,
      refundedCredits: 0,
      ready: candidates.filter((candidate) => candidate.status === "ready").length,
      failed: candidates.filter((candidate) => candidate.status === "failed").length,
    };
  }

  // ---- the locked transaction. Nothing here spends money. ----
  let created;
  try {
    created = await createRollWithCandidates({
      userId: input.userId,
      sessionPublicId: input.sessionPublicId,
      operationId: gate.operationId,
      briefText: input.briefText,
      /*
        The variance plan rides with the compiled brief so the sheet can say,
        after the fact, why eight faces differ mainly in expression. It is
        internal like the rest of `compiledBrief`; only the confession flag is
        projected.
      */
      compiledBrief: { ...(compiled.compiledBrief as object), variance: compiled.variance },
      lockContract: compiled.lockContract,
      cohortKey: compiled.cohortKey,
      styleKey: compiled.styleKey,
      styleProfile: compiled.styleProfile,
      parentCandidatePublicId: input.followCandidatePublicId ?? null,
      candidates: compiled.candidates.map((spec) => ({
        publicId: randomUUID(),
        position: spec.position,
        personaLine: spec.personaLine,
        // The resolved identity rides along with the prompt: it is what a
        // follow roll conditions on, and what a later validator compares
        // against. Internal, like everything in this column (§J).
        internalPrompt: { prompt: spec.prompt, resolved: spec.resolvedIdentity },
      })),
    });
  } catch (error) {
    // The claim is still `claimed` and no credits moved, so this closes as a
    // free failure — the claimed finalizer, not the running one.
    return failClaimedDirectOperation({
      userId: input.userId,
      operationId: gate.operationId,
      error: error instanceof CastingV2OwnershipError
        ? new TRPCError({ code: "NOT_FOUND", message: error.message })
        : error,
    });
  }

  const { roll, candidates } = created;
  let chargedCredits = 0;
  let refundedCredits = 0;

  try {
    await (dependencies.markRunning ?? markGenerationOperationRunning)({
      userId: input.userId,
      operationId: gate.operationId,
      plannedCredits: price,
      phase: "generating",
      heartbeat: true,
    });
  } catch (error) {
    await setRollStatus({ userId: input.userId, rollId: roll.id, status: "failed" });
    return completeDirectOperationFailure({
      userId: input.userId,
      operationId: gate.operationId,
      error,
      chargedCredits: 0,
      refundedCredits: 0,
    });
  }

  // ---- the pinned deduct ----
  // The reference is pinned to the operation, never generated per invocation:
  // the bare fallback would mint a fresh reference on a crash-retry and charge
  // twice (§H.2). This is the mechanism, not a convention.
  const deduct = dependencies.deduct ?? deductCredits;
  const chargeResult = await deduct(
    input.userId,
    price,
    "generation",
    "Casting roll (pending)",
    operationChargeReference(gate.operationId),
    "castingV2",
  );
  if (!chargeResult.success) {
    // Nothing was dispatched, so nothing is owed back. The rows are driven
    // terminal here rather than left for the sweep — the user is looking at
    // this sheet right now.
    for (const candidate of candidates) {
      await failCandidate({
        userId: input.userId,
        candidateId: candidate.id,
        failureClass: "unpaid",
      });
    }
    await setRollStatus({ userId: input.userId, rollId: roll.id, status: "failed" });
    return completeDirectOperationFailure({
      userId: input.userId,
      operationId: gate.operationId,
      error: new TRPCError({
        code: "BAD_REQUEST",
        message: chargeResult.error || `Not enough credits. A roll costs ${price} credits.`,
      }),
      chargedCredits: 0,
      refundedCredits: 0,
    });
  }
  chargedCredits = price;
  await setRollStatus({ userId: input.userId, rollId: roll.id, status: "generating", from: ["pending"] });

  // ---- dispatch: eight independent jobs, one operation ----
  const engine = (dependencies.engine ?? castingCreativeEngine)();
  const promptByPosition = new Map(compiled.candidates.map((spec) => [spec.position, spec.prompt]));

  /* Shared across the eight; see  on dispatchCandidate. */
  const accountDown = { tripped: false };
  /*
    EACH TILE ON ITS OWN STOPWATCH (the latency-and-cost program).

    A roll is eight independently billed renders, and the census is opened PER
    CANDIDATE rather than around the eight: one census over the whole roll would
    add up to "eight paints in the time of one" and say nothing about what a
    tile costs, which is the number the price is set against. Per tile the
    reading is what a customer actually waits for.
  */
  const settlements = await Promise.all(
    candidates.map((candidate) =>
      censusOfAttempt(() => dispatchCandidate({
        accountDown,
        dependencies,
        engine,
        userId: input.userId,
        operationId: gate.operationId,
        candidate,
        prompt: promptByPosition.get(candidate.position) ?? "",
        size: compiled.size,
        quality: compiled.quality,
      })).then(({ value, error, census }) => {
        log.info(
          {
            operationId: gate.operationId,
            candidate: candidate.publicId,
            delivered: error === undefined,
            calls: census.total.calls,
            failedCalls: census.total.failed,
            callMs: census.total.ms,
            wallMs: census.wallMs,
            byModel: census.byModel,
          },
          "[rollService] what this tile cost in calls and seconds",
        );
        if (error !== undefined) throw error;
        return value as Settlement;
      }),
    ),
  );

  const ready = settlements.filter((settlement) => settlement.outcome === "ready").length;
  const failed = settlements.filter((settlement) => settlement.outcome === "failed").length;
  const unrecordedRefunds = settlements.filter((settlement) => settlement.refundUnrecorded);

  /*
    Slices this call refunded, plus slices a concurrent cancel refunded under
    the same charge. Both belong on this operation's receipt: the receipt is
    the operation's account of one charge, and a reader comparing charged
    against refunded must not see a cancel's compensation go missing simply
    because a different request performed it.
  */
  const settled = await listRollCandidates(input.userId, roll.id);
  const cancelledCredits = settled
    .filter((candidate) => candidate.status === "cancelled")
    .reduce((sum, candidate) => sum + candidate.pointsCost, 0);
  refundedCredits =
    settlements.reduce((sum, settlement) => sum + settlement.refundedCredits, 0) + cancelledCredits;

  await touchCastingSession(input.userId, roll.sessionId).catch(() => undefined);

  if (unrecordedRefunds.length > 0) {
    // A refund that did not record is never reported as "you weren't charged".
    log.error(
      { operationId: gate.operationId, slices: unrecordedRefunds.length },
      "[rollService] refund slices failed to record — sealing for support",
    );
  }

  /*
    Was this roll cancelled while it ran? A candidate whose dispatch CAS was
    lost, or which landed into a cancelled roll, both say yes. It matters for
    the receipt's honesty: "none of the sheet arrived" is a confession of
    failure, and saying it to a user who cancelled two seconds ago blames us
    for their own decision.
  */
  const cancelled = settlements.filter(
    (settlement) => settlement.outcome === "skipped" || settlement.outcome === "expired",
  ).length;

  if (ready === 0) {
    // The CAS refuses if cancel already moved the roll to its terminal state.
    await setRollStatus({ userId: input.userId, rollId: roll.id, status: "failed" });
    const refundSentence = unrecordedRefunds.length === 0
      ? `${refundedCredits} credits were refunded.`
      // Never "you weren't charged" when the ledger says otherwise: quote the
      // operation so support can reconcile it by hand.
      : `Part of the refund could not be recorded — quote operation ${gate.operationId} and support will restore the balance.`;
    return completeDirectOperationFailure({
      userId: input.userId,
      operationId: gate.operationId,
      error: new TRPCError({
        code: "PRECONDITION_FAILED",
        message: cancelled > 0
          ? `That roll was cancelled. ${refundSentence}`
          : `None of the sheet arrived. ${refundSentence}`,
      }),
      chargedCredits,
      refundedCredits,
    });
  }

  await setRollStatus({
    userId: input.userId,
    rollId: roll.id,
    status: failed > 0 || cancelled > 0 ? "partial" : "complete",
  });

  /*
    A roll that mostly failed says so, loudly (founder gate 21).

    Five of eight candidates failed on one roll and the only trace was eight
    separate warn lines, each about one candidate, none of them saying "this
    roll lost 62% of what it was paid for". The refunds were correct, so
    nothing was owed — which is exactly why it stayed invisible. Money being
    right is not the same as the product working.

    Two or fewer is ordinary provider weather. Three or more is a roll the user
    experienced as broken, and it belongs in the log as one event with its class
    breakdown, so the next occurrence is diagnosable from one line rather than
    from a reconstruction.
  */
  /*
    Our account with the provider is broken — say so, loudly and separately.

    This is not roll telemetry, it is an outage. An exhausted fal balance
    returned 403 on candidate after candidate: each one charged, failed and
    refunded, while the sheet told the founder "didn't arrive · refunded" as
    though it were weather. Nothing about the request was wrong, no user action
    could fix it, and it took three rounds of the gate to find because the class
    was `capability` and the message was our own string.

    Separate from the mostly-failed alarm below because the fix is different:
    that one asks "what was wrong with this roll", this one says "stop, top up
    the account".
  */
  const accountFailures = settlements.filter(
    (settlement) => settlement.failureClass === "provider_account",
  ).length;
  if (accountFailures > 0) {
    log.error(
      {
        operationId: gate.operationId,
        rollId: roll.publicId,
        accountFailures,
        total: candidateCount,
      },
      "[rollService] PROVIDER ACCOUNT UNUSABLE — our key or balance is refusing work, not the user's brief",
    );
  }

  if (failed >= 3) {
    const byClass: Record<string, number> = {};
    for (const settlement of settlements) {
      if (settlement.outcome !== "failed") continue;
      const key = settlement.failureClass ?? "unrecorded";
      byClass[key] = (byClass[key] ?? 0) + 1;
    }
    log.error(
      {
        operationId: gate.operationId,
        rollId: roll.publicId,
        failed,
        ready,
        total: candidateCount,
        failureRate: Math.round((failed / candidateCount) * 100),
        byClass,
      },
      "[rollService] ROLL MOSTLY FAILED — most of this roll did not deliver",
    );
  }

  await completeDirectOperationSuccess({
    userId: input.userId,
    operationId: gate.operationId,
    result: { ready, failed, cancelled },
    chargedCredits,
    refundedCredits,
    terminalStatus: failed > 0 || cancelled > 0 ? "partial" : "succeeded",
  });

  return {
    rollId: roll.id,
    rollPublicId: roll.publicId,
    chargedCredits,
    refundedCredits,
    ready,
    failed,
  };
}

type Settlement = {
  outcome: "ready" | "expired" | "failed" | "skipped";
  refundedCredits: number;
  refundUnrecorded?: boolean;
  /** Set on a failure, so the roll can report a class breakdown. */
  failureClass?: string;
};

/**
 * One candidate, start to finish.
 *
 * Every exit is either delivered or refunded, never both and never neither —
 * which is the property the whole billing design rests on.
 */
async function dispatchCandidate(input: {
  dependencies: RollServiceDependencies;
  engine: CreativeEngine;
  userId: number;
  operationId: string;
  candidate: { id: number; publicId: string; position: number; pointsCost: number };
  prompt: string;
  size: `${number}x${number}`;
  quality: "low" | "medium" | "high";
  /**
   * Trips the moment our provider ACCOUNT refuses (401/403).
   *
   * Not an abort of work in flight — it stops candidates that have not yet
   * called out. An exhausted balance fails identically for all eight, so
   * carrying on charges, fails and refunds seven more times to learn what the
   * first one already said.
   */
  accountDown: { tripped: boolean };
}): Promise<Settlement> {
  const { candidate, userId, operationId } = input;
  const engineId = input.engine.id;

  const claimed = await markCandidateDispatched({
    userId,
    candidateId: candidate.id,
    provider: "fal",
    providerModel: engineId,
  });
  if (!claimed) {
    /*
      Someone cancelled this roll between the charge and this statement. The
      cancel path already refunded exactly the slices its CAS won, including
      this one — refunding again here is how a "never both refunded and
      delivered" system quietly becomes a "sometimes refunded twice" one.
    */
    return { outcome: "skipped", refundedCredits: 0 };
  }

  const audit = await createGeneration({
    userId,
    operationId,
    stepKey: `variation:${candidate.position}`,
    type: "castingImage",
    status: "processing",
    pointsCost: candidate.pointsCost,
  });
  const auditId = audit.generationId;

  /*
    Declared out here so the catch can persist it too. D-115: the judge
    self-measures and never self-modifies, and a verdict recorded only when the
    candidate survives would be an evidence stream missing every case anyone
    would want to review.
  */
  let renderFaultVerdict: Awaited<ReturnType<typeof detectRenderFault>> | null = null;

  try {
    if (input.accountDown.tripped) {
      // Refuse before spending: our account is already known bad this roll.
      throw new ProviderError("provider_account", "skipped — the provider account already refused this roll");
    }
    const image = await input.engine.generateCandidate({
      prompt: input.prompt,
      size: input.size,
      quality: input.quality,
    });

    /*
      D-93's smoke alarm, ENFORCING (founder ruling, 2026-08-03).

      It shipped in shadow mode and was flipped on the number the gate asked
      for: a sweep of **1,017 real production candidates — the founder's whole
      cast history — fired exactly once, on D-93's own incident, with zero false
      positives.** The founder ruled the flip happens now rather than at
      invites: he is the only affectable user today, so a misfire costs one
      20-credit self-refund and produces exactly the evidence needed to fix it,
      while waiting would only guarantee that the first stranger's garbage tile
      arrives before the alarm is armed.

      It throws BEFORE the bytes are stored, so a contact sheet never becomes an
      object anybody has to clean up, and the throw lands in the ordinary
      failure catch below — `failCandidate` plus the per-slice refund, under the
      derived charge reference. **No new money path**, exactly as D-93 designed.

      Retention of the rejected frame for judge review is D-111's, and arrives
      with the (0g) batch. Until then the verdict on the audit row is the
      evidence stream — which is why it is written on BOTH paths, fault or not.
    */
    renderFaultVerdict = await detectRenderFault(image.bytes);
    if (renderFaultVerdict.fault) {
      log.error(
        { operationId, candidate: candidate.publicId, detail: renderFaultVerdict.detail },
        "[rollService] RENDER FAULT — failing the candidate and refunding its slice",
      );
      throw new ProviderError("render_fault", renderFaultVerdict.detail);
    }

    // Bytes land in OUR storage before anything references them. A provider
    // URL is never persisted and never projected (§E, §J).
    const store = input.dependencies.storeImage ?? defaultStoreImage;
    const stored = await store({ bytes: image.bytes, contentType: image.contentType });

    /*
      AND A SMALL PICTURE BESIDE IT (fable-503).

      `thumbKey` has been on this row since the roll domain landed and nothing
      has ever written one, so every sheet draws eight 90-pixel tiles by
      downloading eight full frames. A courtesy, never a condition: a face she
      paid for does not fail because its small copy did not encode or store, so
      both failures land as `null` and the row is exactly what it was.
    */
    const thumb = await thumbnailOf({ bytes: image.bytes, prefix: CANDIDATE_KEY_PREFIX });
    const thumbKey = thumb === null ? null : await store({
      key: thumb.key,
      bytes: thumb.bytes,
      contentType: thumb.contentType,
    }).then((written) => written.key).catch((error) => {
      log.warn(
        { err: String(error).slice(0, 120), candidate: candidate.publicId },
        "[rollService] the thumbnail did not store — the face stands without one",
      );
      return null;
    });

    const landing = await landCandidate({
      userId,
      candidateId: candidate.id,
      imageKey: stored.key,
      thumbKey,
      provider: image.provenance.provider,
      providerModel: image.provenance.model,
      providerRef: image.provenance.providerRef ?? null,
    });

    if (auditId) {
      await updateGeneration(auditId, {
        status: "completed",
        completedAt: new Date(),
        /*
          The verdict rides on the audit row rather than on the candidate.

          Two reasons. It needs no migration, so shadow mode can reach
          production — which is the only place the rate that matters can be
          measured — without a schema ceremony. And it is genuinely audit
          rather than product: the candidate row describes what the customer
          got, and in shadow mode they got the image either way.

          Every verdict is written, not only the faults. A file that records
          only fires cannot tell "no faults today" from "the detector stopped
          running", which is the inert-control failure this program keeps
          meeting.
        */
        metadata: renderFaultMetadata(renderFaultVerdict),
      });
    }

    if (landing === "expired") {
      /*
        The roll was cancelled while this was in flight. It ran to completion
        because an in-flight candidate always does, and it landed into a
        cancelled roll — so it will never be projected, and nobody will ever
        see it.

        The late-landing generosity ruling (founder, 2026-07-31) says we give
        the credits back anyway. The provider cost is real and we absorb it;
        what the user is owed is decided by what reached them, and the promise
        is *cancel refunds everything you haven't seen*. The refund carries its
        own reference so the ledger can separate absorbed COGS from failures.

        No abuse vector: `projectCandidate` returns null for `expired`, so
        cancelling cannot buy anyone a free image.

        The window between the landing CAS and this refund is the same one the
        failure path below lives with — a crash inside it leaves the slice
        unrefunded, and the recovery sweep cannot pick it up because `expired`
        is also written by the 7-day retention sweep over work the user did
        receive.

        SCHEDULED: migration 0018 (M7) adds the column that separates those two
        meanings, at which point this refund becomes idempotent and recovery
        can adjudicate `expired` safely. Until then the window is real and
        documented — see the migration slices in the plan.
      */
      if (candidate.pointsCost <= 0) return { outcome: "expired", refundedCredits: 0 };
      const refund = await recordRefund(
        userId,
        candidate.pointsCost,
        "Cancelled before you saw it",
        candidateUnseenChargeReference(operationId, candidate.publicId),
      );
      log.info(
        { operationId, candidate: candidate.publicId, recorded: refund.recorded },
        "[rollService] candidate landed unseen after cancel — refunded under the generosity rule",
      );
      return {
        outcome: "expired",
        refundedCredits: refund.recorded ? refund.amount : 0,
        refundUnrecorded: !refund.recorded,
      };
    }
    if (landing === "lost") {
      /*
        Nobody will ever reference this object: the landing CAS lost, so no row
        points at the key, and the cleanup worker only ever deletes keys a row
        handed it. Best-effort delete now, or it is an orphan in the bucket
        forever — invisible, unbilled to anyone, and impossible to find later.
      */
      await storageDelete(stored.key).catch((error) => {
        log.warn(
          { operationId, candidate: candidate.publicId, err: error },
          "[rollService] could not delete an orphaned candidate object",
        );
      });
      return { outcome: "skipped", refundedCredits: 0 };
    }
    return { outcome: "ready", refundedCredits: 0 };
  } catch (error) {
    const failureClass = error instanceof ProviderError ? error.failureClass : "unknown";
    // One account refusal condemns the rest of the roll.
    if (failureClass === "provider_account") input.accountDown.tripped = true;
    /*
      The provider message is kept, not just the class. "capability" is where
      every 4xx we did not recognise lands, so on its own it says "something
      about the request was wrong" and nothing more — which is exactly what we
      had when a roll lost five of eight and could not be diagnosed afterwards.
      Truncated, because a provider body can be enormous.
    */
    const providerMessage = error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300);
    log.warn(
      { operationId, candidate: candidate.publicId, failureClass, providerMessage },
      "[rollService] candidate failed — refunding its slice",
    );

    await failCandidate({ userId, candidateId: candidate.id, failureClass });
    if (auditId) {
      await updateGeneration(auditId, {
        status: "failed",
        errorMessage: failureClass,
        completedAt: new Date(),
        // Written on the failure path too — see the declaration above.
        metadata: renderFaultMetadata(renderFaultVerdict),
      });
    }

    if (candidate.pointsCost <= 0) return { outcome: "failed", refundedCredits: 0, failureClass };
    const refund = await recordRefund(
      userId,
      candidate.pointsCost,
      /*
        A render fault DID arrive — that is the whole point of it. Telling the
        customer their candidate "did not arrive" would be the ledger describing
        the wrong event, on the one line they read when they wonder where their
        credits went.
      */
      failureClass === "render_fault"
        ? "This tile came back as a contact sheet rather than a portrait"
        : "Casting candidate did not arrive",
      // The same derivation the recovery adjudicator uses. Two call sites, one
      // helper — byte-identical references are what make a retry idempotent
      // rather than a second refund.
      candidateChargeReference(operationId, candidate.publicId),
    );
    return {
      outcome: "failed",
      failureClass,
      refundedCredits: refund.recorded ? refund.amount : 0,
      refundUnrecorded: !refund.recorded,
    };
  }
}

export type CancelRollResult = {
  cancelled: number;
  refundedCredits: number;
  refundUnrecorded: boolean;
  /**
   * How many candidates were already with the provider when the cancel landed.
   *
   * A COUNT, not a billing figure — nothing here decides what is refunded. It
   * exists so the sheet can tell the truth in one sentence instead of two
   * misleading ones: a cancel that catches nothing queued honestly refunds
   * zero, and "0 credits back" reads as a failure rather than as "the work you
   * are about to see is work you already paid for". These land under the
   * generosity rule and refund as they arrive.
   *
   * Counted server-side rather than from the client's poll snapshot, which can
   * be up to 2.5s stale — the number would be wrong exactly when the user is
   * watching it most closely.
   */
  stillFinishing: number;
  /**
   * The candidates this cancel actually stopped.
   *
   * The sheet cannot work these out for itself: §J's projection collapses
   * `queued` and `dispatched` into one `casting` status on purpose, so the
   * client can see that eight are in flight but not which of them are still
   * cancellable. Guessing would paint "cancelled" over work that is about to
   * arrive — the screen claiming something the server did not do.
   */
  cancelledCandidateIds: string[];
};

/**
 * Cancel (§F cancellation).
 *
 * Refunds **only** the candidates whose `queued → cancelled` CAS this call
 * won. Anything already dispatched is left alone: it runs to completion
 * server-side and lands as `expired`, delivered but unshown. That is the law
 * (§H.6 "never refund delivered work"), and it is also what makes double
 * settlement structurally impossible — a candidate is either won by this CAS
 * or by dispatch, never by both.
 */
export async function cancelRoll(input: {
  userId: number;
  rollPublicId: string;
}): Promise<CancelRollResult> {
  const roll = await getOwnedRoll(input.userId, input.rollPublicId);
  if (!roll) throw new TRPCError({ code: "NOT_FOUND", message: "Roll not found" });
  if (!["pending", "generating"].includes(roll.status)) {
    // Terminal rolls are immutable versions. Cancelling one is not an error
    // worth a refusal banner — there is simply nothing left to cancel.
    return {
      cancelled: 0,
      refundedCredits: 0,
      refundUnrecorded: false,
      stillFinishing: 0,
      cancelledCandidateIds: [],
    };
  }

  const candidates = await listRollCandidates(input.userId, roll.id);
  /*
    Counted from the same snapshot the CAS loop walks, BEFORE the loop runs.
    A candidate is either won by this cancel or already with the provider; the
    ones that were `dispatched` when we looked are exactly the ones the user is
    about to watch land.
  */
  const stillFinishing = candidates.filter((candidate) => candidate.status === "dispatched").length;
  const cancelledCandidateIds: string[] = [];
  let cancelled = 0;
  let refundedCredits = 0;
  let refundUnrecorded = false;

  for (const candidate of candidates) {
    if (candidate.status !== "queued") continue;
    const won = await cancelQueuedCandidate({ userId: input.userId, candidateId: candidate.id });
    if (!won) continue;
    cancelled += 1;
    cancelledCandidateIds.push(candidate.publicId);
    if (candidate.pointsCost <= 0) continue;
    const refund = await recordRefund(
      input.userId,
      candidate.pointsCost,
      "Casting roll cancelled before this candidate started",
      candidateChargeReference(roll.operationId, candidate.publicId),
    );
    if (refund.recorded) refundedCredits += refund.amount;
    else refundUnrecorded = true;
  }

  await setRollStatus({ userId: input.userId, rollId: roll.id, status: "cancelled" });

  if (refundUnrecorded) {
    log.error(
      { rollId: roll.publicId, userId: input.userId },
      "[rollService] cancel refund did not record — user remains charged",
    );
  }
  return { cancelled, refundedCredits, refundUnrecorded, stillFinishing, cancelledCandidateIds };
}
