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

import { DEFAULT_CASTING_PATH, type CastingPath } from "../../shared/castingPaths";
import type { Imagination } from "../../shared/imagination";
import type { CastStyle } from "../../shared/castStyles";
import {
  captureCastingBornInkEnabled,
  captureCastingFramingTrimEnabled,
  captureCastingBriefFidelityEnabled,
  captureCastingCreativeRegisterEnabled,
  captureCastingTwoPathsEnabled,
} from "./castingV2Scope";
import { mintBornInkRows } from "./bornInkMint";
import type { StatedInk } from "./castingIntent";

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
  getRollWardrobeForOwnedCandidate,
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
import { createFalRegionReader } from "./falRegionReader";
import { extentOf } from "./inkReferenceCrop";
import { applyFramingTrim, FRAMING_TRIM_RENDER } from "./framingTrimStep";
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
import { briefTooLong } from "./briefLength";
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
  /**
   * Whether this account chooses the path its casts are born on.
   *
   * A seam rather than a direct `process.env` read at the call site, so the
   * flag's two sides can be driven in one test with the flag as the only
   * variable — the pair being the claim. Defaults to the real gate.
   */
  twoPathsEnabled?: (userId: number) => boolean;
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
   * THE IMAGINATION METER (#131 slice E) — how opinionated the author is on
   * this roll. Absent means LOW (the author's own default). Handed to the
   * compile and read there ONLY on the author road: for every other account
   * the compiler never calls the author, so the value is inert by
   * construction rather than by a check here.
   */
  imagination?: Imagination;
  /** The settings modal's style (#142); the meter's rule — inert off the author road by construction. */
  style?: CastStyle;
  /**
   * Facts the user unpinned by removing a chip. Rolls are immutable, so this
   * can only ever affect the roll being created — never the one the chip was
   * shown on.
   */
  unlock?: readonly UnlockableField[];
  /**
   * THE TWO PATHS — which one this sheet is cast on (design §6).
   *
   * Absent means the toggle was not sent, which is every client today and every
   * account with the flag off. It is NOT the same as `wardrobe`: an account
   * outside the flag writes NULL, and NULL means *cast before the paths
   * existed*. The `?? DEFAULT_CASTING_PATH` below applies only inside the flag.
   *
   * A FOLLOW never carries one — it inherits (§3.1), and its own procedure
   * deliberately does not offer the switch.
   */
  path?: CastingPath | null;
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
  let inheritedWardrobe: { path: CastingPath | null; wardrobeLine: string | null } | null = null;
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
    /*
      ⚠ A FACT TAKEN FROM A PICTURE IS NOT IN HERE, AND THAT GAP IS NAMED RATHER
      THAN DISCOVERED (design opus-1069 (c), countersigned fable-1432).

      `statedDetails` used to carry the crop take's placeholder — literally *"the
      hair in the attached picture"* — and this line is where it entered a
      follow: the anchor copies `realized` wholesale and `describeRealizedAxes`
      emits every entry as a prompt line, so eight new casts were told to
      reproduce a photograph that is nowhere in their request. The words lane now
      DECLINES to file it (`RefineDelta.fromPicture`), on born ink's precedent —
      a geometry-free sentence about a picture is worse than silence.

      **So a follow of a version whose hair came from a photograph inherits
      NOTHING about that hair and re-rolls the original.** That is the honest
      state and it is not the finished answer: what a follow should do — inherit
      nothing, carry the crop into the roll (a road that does not exist), or
      refuse — is a product question with the founder, and this comment is here
      so the next reader finds a known hole rather than a surprise.
    */
    followIdentity = readResolvedIdentity(parent.internalPrompt);
    /*
      WHAT THE SHEET THIS FOLLOW DESCENDS FROM IS WEARING (design §3.1).

      A follow inherits both columns, and the db layer performs that inheritance
      in the statement that writes the row — which is the authority for what is
      STORED and arrives too late for the eight PROMPTS. Read here, owner-scoped
      through the owned candidate, so the pictures and the row agree.

      Read UNCONDITIONALLY, outside the flag as well, and that is deliberate: a
      parent cast before the paths existed answers `{ null, null }`, which is
      exactly what the prompt needs to stay unpathed. Making the read
      conditional on this account's flag would resolve a fresh line for a follow
      whose row is about to be written NULL.
    */
    inheritedWardrobe = (await getRollWardrobeForOwnedCandidate(
      input.userId,
      input.followCandidatePublicId,
    )) ?? { path: null, wardrobeLine: null };
  }

  /*
    WHICH PATH THIS SHEET IS CAST ON — asked once, before anything is compiled.

    `input.path` absent is not `wardrobe`: it is *the toggle was not sent*,
    which is every client today. Only inside the flag does an unsent toggle
    become the default the control would have been showing (§6).

    ⚠ **It is read HERE, above the compile, because the PICK is a question the
    interpreter has to be asked** (§4 case (b), item 4). It used to sit just
    above the insert, which was the right place while the only thing it decided
    was two columns.
  */
  /*
    THE AUTHOR ROAD, DECIDED FIRST (#131 slice E; review of PR #138, finding 1):
    the register scope captured once, and the road predicate stated here from
    the same input the compiler reads. It used to exclude a follow and a chip
    edit; since #154 (the family clause) the flag alone decides — a follow's
    anchor and the chip edits are carried as words. Two things below hang on
    it: the brief bound and the PATH. On the author road the engine dresses the
    cast from the prompt (ruling rule 11 — the switch is retired), so no path
    is born, no wardrobe pick is asked, and no line is recorded that the
    authored prompt would only discard; a sheet that drew "WARDROBE — <line>"
    over an outfit the engine was never told about was the review's finding —
    and on a FOLLOW that means the parent's pair is NOT inherited either
    (`inheritWardrobe: false`, below), because an authored follow is dressed by
    the engine exactly as an authored first roll is.
  */
  const creativeRegister = captureCastingCreativeRegisterEnabled(input.userId);
  const authorRoad = creativeRegister;

  const twoPathsEnabled = dependencies.twoPathsEnabled ?? captureCastingTwoPathsEnabled;
  const bornPath: CastingPath | null = twoPathsEnabled(input.userId) && !authorRoad
    ? input.path ?? DEFAULT_CASTING_PATH
    : null;

  /*
    ⚠ THREE CONDITIONS, AND EACH ONE IS A ROLL WHOSE PROMPT MUST NOT MOVE.

    A prompt is live behaviour: every fact on a paid sheet comes out of that one
    reply, and context is not additive here — this campaign measured a SUBSET of
    prompt context raising the stage wall twice as often as its superset. So the
    wardrobe question is asked only where its answer is READ:

      outside the flag  the columns are NULL and nothing reads a pick;
      on BASICS         the path IS the outfit and a brief cannot negotiate it
                        (`bornWardrobeLine` ignores `named` on that path), so
                        asking would perturb the reply to fill a field the
                        resolution discards;
      on a FOLLOW       the db layer inherits the parent roll's pair inside the
                        transaction, so anything picked here is overwritten —
                        and a Follow inherits the BORN line by design (§3.1),
                        which is the one case that deliberately wants the
                        sheet's outfit rather than a fresh choice.
  */
  const pickWardrobe = bornPath === "wardrobe" && !input.followCandidatePublicId;

  /*
    MAY THIS BRIEF BE READ FOR TATTOOS — 7b(a), asked ONCE, here.

    Read at the roll rather than inside the compiler so the compiler stays a
    pure function of its input: the prompt a roll sent is reconstructible from
    what it was handed, which is what made the two-paths prompt auditable and is
    the same reason `pickWardrobe` is resolved on this line.

    Off, and absent means off, the interpreter is not asked about ink at all —
    the bytes on the wire are byte-identical to today's, `statedInk` comes back
    null, and no `bornInk:` row is ever written. `BORN_INK_BLOCK` carries the
    measurement that makes that gating the point rather than caution.
  */
  const readInk = captureCastingBornInkEnabled(input.userId);

  /*
    ⚠ THE FRAMING TRIM, CAPTURED ONCE FOR THE WHOLE ROLL.

    Read here and handed down to every slice rather than re-read per candidate:
    a flag consulted eight times in one request is a request that can disagree
    with itself, and a roll whose frames were rendered at two different sizes is
    a sheet nobody can compare — which is the exact thing this feature exists to
    fix. Every scope in this program captures at request entry for that reason.
  */
  const trimEnabled = captureCastingFramingTrimEnabled(input.userId);

  /*
    THE BRIEF FIDELITY BUILD, CAPTURED ONCE FOR THE WHOLE ROLL — same rule as
    every scope in this program and the same reason: a flag consulted twice in
    one request is a request that can disagree with itself.

    What it governs is the COMPILE — the announced cap on `characterNotes` and
    the bound the reply is held to — so it is read here and handed to `compile`
    rather than read inside it. Off, the compiler's bytes on the wire are
    byte-identical to today's.
  */
  const briefFidelity = captureCastingBriefFidelityEnabled(input.userId);

  /*
    THE BRIEF BOUND, PER ROAD (#131 slice D, `briefLength.ts`). The entrance
    admits 4,000 so an authored prompt can come back as the next brief; this
    line is what keeps every HOUSE-composed roll exactly where it was — every
    unflagged account, and a flagged account's FOLLOW or chip-edited roll, which
    compose house (`briefCompiler`'s `houseBecause`; the review of PR #137,
    finding 2). `authorRoad` is decided above the path, from the same inputs.
    Free, before the claim, on both roads.
  */
  const tooLong = briefTooLong(input.briefText, authorRoad);
  if (tooLong) throw new TRPCError({ code: "BAD_REQUEST", message: tooLong });

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
      /*
        THE LINE REACHES THE EIGHT PROMPTS FROM HERE (§3.3, item 5).

        The path is resolved before the compile because the constant carries the
        outfit now; on a FOLLOW the pair is the parent's, verbatim and including
        its nulls, because that is what the transaction is about to write.
      */
      path: bornPath,
      /* On the author road the house prompts are discarded and the row inherits nothing, so the compiler is handed no pair. */
      inheritedWardrobe: inheritedWardrobe && !authorRoad
        ? { path: inheritedWardrobe.path, line: inheritedWardrobe.wardrobeLine }
        : undefined,
      pickWardrobe,
      readInk,
      briefFidelity,
      creativeRegister,
      imagination: input.imagination,
      style: input.style,
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
      /*
        THE TWO PATHS, resolved once and stamped with the roll (design §3.1).

        Outside the flag both are NULL, which is what NULL means on these
        columns — *cast before the paths existed* — and is why the fallback to
        `DEFAULT_CASTING_PATH` lives INSIDE the branch rather than at the read
        sites. A default applied at a reader would make an account that never
        had the feature indistinguishable from one that chose Wardrobe.

        The line is stamped in the same breath as the path, so the `incoherent`
        resolution `wardrobeLine.ts` names cannot be produced from here.

        On a FOLLOW these are ignored: the db layer inherits the parent roll's
        pair inside the same transaction that re-anchors the parent candidate.
      */
      path: bornPath,
      /* An authored follow is dressed by the engine (#154): the parent's pair stays with the parent. */
      inheritWardrobe: !authorRoad,
      /*
        ⚠ WRITTEN, NOT RE-RESOLVED — and it used to be re-resolved here.

        Item 4 called `bornWardrobeLine` at this site, which was correct while
        the line only had to reach a column. Item 5 puts the same sentence into
        the eight PROMPTS, and two callers resolving one sentence is working law
        4 with a picture on one side and a database row on the other: a sheet
        painted in one outfit and recorded in another, then signed and judged
        against the record. So the compiler resolves it once, before
        composition, and this writes that answer.
      */
      wardrobeLine: compiled.wardrobeLine,
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
  /*
    ⚠ THE MARGIN CLAUSE IS GONE — and the prompt a FLAGGED roll sends is now
    byte-identical to an unflagged one (founder retarget, 2026-08-24, ruled
    fable-1648).

    It used to be swapped in here: a sentence asking the engine for more room
    below and at the sides, so a wide render could be trimmed to a common head
    size. His own eye retired it. **Painted detail follows COMPOSITION, not
    resolution** — the engine paints fine facial texture where the face fills
    the frame, and no later crop recovers what a wide composition never
    painted. So the clause was the detail thief; it was also the geometry
    breaker, since the empty feasible-`R` interval that forced `R` to float per
    frame was measured on CLAUSE cells only while every no-clause control cell
    was feasible.

    **What survives is the large render and the trim**, with `T` re-chosen at
    the no-clause population's own geometry (22.7% → 34.3%). The whole feature
    is now a crop of a bigger picture and not an ask of the engine, which is
    why nothing here composes a prompt any more.
  */
  const promptByPosition = new Map(
    compiled.candidates.map((spec) => [spec.position, spec.prompt] as const),
  );

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
        /*
          ⚠ THE TRIM RENDERS LARGER THAN IT DELIVERS, and this is the whole of
          where that decision enters the roll (`CASTING_FRAMING_TRIM_BUILD.md`
          §2). Off the flag this is `compiled.size` exactly as it has always
          been; on it, the frame is 1536×2304 and `dispatchCandidate` brings it
          back to the delivered size before a byte is stored, so nothing
          downstream sees a different frame.

          ⚠ **THAT LAST CLAUSE WAS TRUE OF THE TRIMMED PATH AND FALSE OF THE
          OTHER ONE, AND IT IS THE PATH IT WAS WRITTEN TO REASSURE ABOUT**
          (found at the bytes on his first flagged sheet, ordered fable-1592
          §1). `applyFramingTrim` used to hand a DECLINED frame back as
          rendered, so roll 209 shipped six candidates at 1024×1536 and two at
          1536×2304. It is true of both paths now — the untouched path
          downscales to the same box — and `framingTrimStep.test.ts`'s sheet arm
          is what keeps it true rather than this comment.

          The larger render is not a preference: a crop can only ever crop IN,
          so a trim on a frame rendered at the delivered size would have to
          invent pixels. Arm R measured the cost — a tighter picture, 3.9 points
          of `T_min` — and the clause is what pays it back.
        */
        size: trimEnabled ? `${FRAMING_TRIM_RENDER.width}x${FRAMING_TRIM_RENDER.height}` : compiled.size,
        trimEnabled,
        quality: compiled.quality,
        /* Handed on from the compile that produced these eight prompts, so the
           row written and the sheet compiled cannot disagree about what the
           brief said. Null outside the flag. */
        statedInk: compiled.statedInk,
        rollPublicId: created.roll.publicId,
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

export type Settlement = {
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
 *
 * EXPORTED for exactly one second caller — the RETRY (`retryService.ts`,
 * #122 shape 1), which renders one failed slice again under an operation of
 * its own. It is the same unit on purpose: the smoke alarm, the trim, the
 * store, the landing CAS, the born-ink mint and the per-slice refund are what
 * make a delivered frame a delivered frame, and a second copy of that list
 * would be the parallel copy working law 4 is about.
 */
export async function dispatchCandidate(input: {
  dependencies: RollServiceDependencies;
  engine: CreativeEngine;
  userId: number;
  operationId: string;
  candidate: { id: number; publicId: string; position: number; pointsCost: number };
  prompt: string;
  size: `${number}x${number}`;
  /**
   * Whether this roll renders large and gets trimmed to the common frame
   * (`CASTING_FRAMING_TRIM_SCOPE`). Captured ONCE per roll at the top and handed
   * down, never re-read here: a flag read twice in one request is a request that
   * can disagree with itself, which is the rule every scope in this program
   * already follows.
   */
  trimEnabled: boolean;
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
  /**
   * TATTOOS THE BRIEF ITSELF DESCRIBED — 7b(a), and `null` on every roll
   * outside `CASTING_BORN_INK_SCOPE` because the interpreter was never asked.
   *
   * Handed in from the compiled brief rather than re-read from the persisted
   * one: a second source of truth for a fact this flow already holds is the
   * parallel copy working law 4 is about, and re-reading would put the writer
   * somewhere a refine could reach — which is exactly the boundary fable-1381
   * asked to be structural (`bornInkMint`'s header).
   */
  statedInk: StatedInk | null;
  /** For the born-ink log line only — a count nobody can trace back is half a
   *  count (fable-1412 (b)). */
  rollPublicId: string;
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

    /*
      ⚠ THE FRAMING TRIM — the delivered bytes cut to the common frame before
      anything references them (`CASTING_FRAMING_TRIM_BUILD.md` §5, countersigned
      fable-1576; ordered by the founder on his own eye at the strips).

      It sits HERE and nowhere else because this is the only point where the
      bytes exist and nothing points at them yet — the same reason the smoke
      alarm above throws before the store rather than after it.

      ⚠ **It cannot fail the candidate.** `applyFramingTrim` catches everything
      and returns the bytes it was given with a reason attached: a roll is billed
      and refunded per slice, so a segmenter hiccup that threw here would cost
      her a face and buy a refund, which is a worse product than a frame that is
      merely not in the common frame. The reason is LOGGED rather than dropped —
      the rate of `share-above-target` is what moves the target, and it moves it
      on the founder's eye at strips rather than on arithmetic.
    */
    let delivered = image.bytes;
    /* Whether the trim actually cut this frame — not merely whether the flag is
       on. An untrimmed frame IS its own original, so nothing is kept for it. */
    let trimmedThisFrame = false;
    const apiKey = process.env.FAL_KEY;
    if (input.trimEnabled && apiKey) {
      const trim = await applyFramingTrim(
        {
          reader: createFalRegionReader({ apiKey }),
          extentOf: (mask) => extentOf(mask as never),
        },
        { bytes: image.bytes },
      );
      delivered = trim.bytes;
      trimmedThisFrame = trim.trimmed;
      log.info(
        {
          operationId, candidate: candidate.publicId,
          trimmed: trim.trimmed, why: trim.why ?? null,
          headroom: trim.headroom ?? null, ownHeadroom: trim.ownHeadroom ?? null,
        },
        trim.trimmed
          ? "[rollService] framing trim applied"
          : "[rollService] framing trim declined — the frame is delivered as rendered",
      );
    }

    // Bytes land in OUR storage before anything references them. A provider
    // URL is never persisted and never projected (§E, §J).
    const store = input.dependencies.storeImage ?? defaultStoreImage;
    const stored = await store({ bytes: delivered, contentType: image.contentType });

    /*
      ⚠ THE KEPT ORIGINAL — the untrimmed frame the delivered one was cut from
      (KEEP ruled fable-1576 §1; his *"run it"* on the ceremony 2026-08-24).

      A crop only ever crops IN, so the pixels outside the delivered frame are
      gone the moment this is not written. That makes discarding it irreversible
      in one direction: every later framing change becomes a RE-RENDER — paid,
      slow, and back with a DIFFERENT face — instead of a re-trim that is
      instant, free and the same person. Framing is on his candidate list as a
      customer axis, and a slider needs a master to slide on.

      **Only when the trim actually happened.** An untrimmed frame IS its own
      original; storing a second copy of identical bytes would double the
      storage to record that nothing was cut.

      A COURTESY, exactly like the thumbnail below it: a face she paid for does
      not fail because its source copy did not store, so the failure lands as
      `null` and the row is what it would have been. What it costs then is a
      re-render instead of a re-trim, one day, for one cast.
    */
    const sourceKey = trimmedThisFrame
      ? await store({ bytes: image.bytes, contentType: image.contentType })
        .then((written) => written.key)
        .catch((error) => {
          log.warn(
            { err: String(error).slice(0, 120), candidate: candidate.publicId },
            "[rollService] the untrimmed original did not store — the face stands without one, "
            + "and a later framing change on this cast is a re-render rather than a re-trim",
          );
          return null;
        })
      : null;

    /*
      AND A SMALL PICTURE BESIDE IT (fable-503).

      `thumbKey` has been on this row since the roll domain landed and nothing
      has ever written one, so every sheet draws eight 90-pixel tiles by
      downloading eight full frames. A courtesy, never a condition: a face she
      paid for does not fail because its small copy did not encode or store, so
      both failures land as `null` and the row is exactly what it was.
    */
    /* ⚠ FROM THE DELIVERED BYTES, NOT THE RENDERED ONES. A thumbnail cut from
       the untrimmed frame would be framed differently from the frame it opens —
       and nothing would fail, no test would redden, and the defect would be
       visible only to someone comparing a tile with its own picture. Named in
       the build's §5 for exactly that reason. */
    const thumb = await thumbnailOf({ bytes: delivered, prefix: CANDIDATE_KEY_PREFIX });
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
      sourceKey,
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
    /*
      AND THE TATTOOS THE BRIEF DESCRIBED, WRITTEN DOWN — 7b(a).

      After the landing and only on `ready`: an `expired` candidate is never
      projected and a `lost` one has no row to hang a record on, so a born-ink
      row on either would describe a face nobody will ever see.

      It cannot fail this candidate. She paid for a face and it landed;
      `mintBornInkRows` catches its own failure and says so countably, and the
      whole argument for that trade is in its header.
    */
    await mintBornInkRows({
      userId,
      candidateId: candidate.id,
      rollPublicId: input.rollPublicId,
      candidatePublicId: candidate.publicId,
      statedInk: input.statedInk,
    });
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
