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
import type { EyeColour, EyeShape, HairTexture } from "../../shared/castingRealization";
import type { HairColour } from "../../shared/castingVocabularies";
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
  recordVariantDispatch,
  recordVariantOutcome,
  selectVariant,
  VariantOwnershipError,
} from "../db/castingV2Variants";
import { getBriefForOwnedCandidate, getOwnedCandidateWithSelectedFace } from "../db/castingV2";
import { readBriefFacts } from "./rollProjection";
import { createModuleLogger } from "../logging/logger";
import { ProviderError } from "../providers/types";
import { storagePublicUrl, storagePut, storageReadBytes } from "../storage";
import { withTransaction } from "../db/connection";
import { createStorageCleanupManifestIn } from "../db/storageCleanup";
import {
  EYE_SHAPE_RENDER,
  HAIR_COLOUR_RENDER,
  HAIR_TEXTURE_RENDER,
  IRIS_RENDER,
} from "./realizedAxes";
import { accessoryKindOf, pairClauseFor, vacantPhraseFor } from "./accessoryKinds";
import { slotWordsRefusal } from "./slotWordShape";
import { hairStyleByName } from "./hairStyles";
import {
  FREE_SUBJECT_KEYS,
  FREE_SUBJECTS,
  isDepartableSubject,
  type FreeSubject,
} from "./refineSubjects";
import { readResolvedIdentity } from "./rollService";
import {
  applyDelta,
  composeDeltas,
  composeRenderPrompt,
  contradictedFacets,
  currentValueOfFacet,
  saysNothingNew,
  facetsAnsweredBy,
  departedItems,
  departedClause,
  departedNoun,
  departedShortfall,
  facetsWrittenBy,
  itemsOf,
  missingFromPrompt,
  presenceItemsOfFacet,
  withoutFacets,
  presentationOf,
  readDelta,
  REFINABLE_AXES,
  type RefineDelta,
} from "./refineDelta";
import { interpretRefinement, refusalMessage } from "./refineInterpreter";
import { readStoredDelta } from "./refineLegacy";
import { namesRemoval } from "./removalWords";
import {
  LEAVE_AS_SHE_IS,
  alreadyUpsweptReask,
  glassesHideEyesReask,
  colourFacetLabel,
  colourFacetOf,
  didYouMeanReask,
  nearMiss,
  needsColourReferent,
  pendingReaskFor,
  redirectColourTo,
  resolveAnswer,
  whichFacetReask,
  type Reask,
} from "./refineReask";
import {
  chainAfterRemoval,
  composeChain,
  facetOf,
  matchSteps,
  readChain,
  readRemovalSubject,
  sameChain,
  textMentions,
  type ChainStep,
} from "./refineRemoval";
import {
  facetBindsOnPresence,
  facetHeading,
  facetOfAxis,
  facetOfSubject,
  type Facet,
} from "./refineFacets";
import { harvestRefinement, maskedEditingEnabledFor, refusingRegionReader, type RegionReader } from "./maskedRefine";
import { assembleWithCarriedSegments, listCarriedRows } from "./carriedSegments";
import { makeupRegionFor } from "./makeupPlacement";
import { keepSegmentsFromRender } from "./segmentPersistence";
import { mintReferencesForRender } from "./referenceMint";
import { mintedSlotsForRender } from "./mintedSlots";
import {
  deriveLibrary, libraryWithoutEditedCrops, liveReferences, supersededCarrySlots,
} from "./referenceLibrary";
import { listLineageReferences, recordReferenceRows, retireReferenceSlot } from "../db/castingV2ReferenceLibrary";
import type { RegionReader as MintRegionReader } from "./referenceCompleteness";
import { assembleRecipe, type FeatureSlot } from "./recipeAssembler";
import { slotDefinition } from "./referenceSlotCatalogue";
import { repaint, type RepaintEngine, type SentRequest } from "./repaintRender";
import { repaintAsksFor, repaintCannotRemove } from "./repaintAsks";
import { pronounsForSex } from "./castPronouns";
import {
  captureCastingReferenceLibraryEnabled,
  captureCastingRepaintEnabled,
  captureCastingSegmentsEnabled,
} from "./castingV2Scope";
import { isUpsweptAsk, readCanthalTilt } from "./eyeShapeRouting";
import { alreadyUpswept, wearsGlassesByPixels } from "./canthalTilt";
import { binaryCoverage, coverage } from "./maskGeometry";
import { departureFloorFor } from "./bornWornDetector";
import { createFalRegionReader } from "./falRegionReader";
import { createFalMaskedEditEngine } from "../providers/falImages";
import {
  captionClause,
  captionRealization,
  captionSlot,
  captionWording,
  dropFacets,
  evidencesDelivery,
  staleCaptions,
  type RealizationCaptions,
} from "./realizationCaption";
import { captureRefusedRender } from "./diagnosticCapture";
import { detectRenderFault } from "./renderFault";
import {
  advisoryMisses,
  confirmVerdict,
  joinClauses,
  missingFacts,
  settleCarriedChecks,
  shortfalls,
  verifyRender,
  type RenderVerdict,
} from "./renderVerification";
import { detailForVerification } from "./verificationDetail";
import { spokenError } from "../_core/spokenError";
import {
  capturePresentation,
  presentationInvalidatedBy,
  unconstrainedPresentationPins,
  PRESENTATION_FACETS,
} from "./presentationState";
import { castingIdentityEngine } from "./signEngine";
import { assertNotFrozen } from "./spendGuards";

const log = createModuleLogger("castingV2/refineService");

const VARIANT_KEY_PREFIX = "casting-v2/variants";

/**
 * The prose every render is composed with — ONE object, used by the pre-claim
 * completeness check and by the render itself.
 *
 * Two copies would let the check pass on a prompt the render never builds,
 * which is the same shape as the defect the check exists to catch.
 */
/**
 * Exported so calibration and replay tools compose with the REAL prose rather
 * than a copy of it — a second list shadowing a source of truth always drifts,
 * and a replay that drifts is a replay of something else.
 */
export const EDIT_PROSE = {
  eyeColour: (value: EyeColour) => IRIS_RENDER[value],
  eyeShape: (value: EyeShape) => EYE_SHAPE_RENDER[value],
  hairStyle: (value: string) => {
    const style = hairStyleByName(value);
    return style ? `a ${style.name} (${style.family})` : `a ${value}`;
  },
  /*
    THE DYE-JOB QUALIFIER, and it belongs on the GUARANTEED lane too (D-146).

    The palette prose is written for an ORIGINAL generation, where "copper" on a
    fresh head reads as hair. Used as an EDIT on existing dark hair, the same
    words came back saturated traffic-cone orange — the model rendered a dye job
    because that is what recolouring dark hair literally is.

    So the refine adds what the roll never needed to say: this is her hair, not
    a colour laid over it. Applied here rather than in the palette, because the
    palette is right for the sheet and only wrong for the edit.
  */
  hairColour: (value: HairColour) => `${value} — ${HAIR_COLOUR_RENDER[value]}. Rendered as `
    + "NATURAL hair rather than a dye job: dimensional rather than flat, softer and "
    + "deeper at the roots, with the tone reading as grown rather than freshly "
    + "coloured, and never poster-bright or uniformly saturated",
  hairTexture: (value: HairTexture) => `${value} hair — ${HAIR_TEXTURE_RENDER[value]}`,
};

/**
 * How many refinements one candidate may carry (D-207, founder ruling).
 *
 * **Twenty-four, and the completeness guard is the real limit.** Twelve was a
 * guess at where a recipe stops being coherent, and it turned into a wall a
 * paying user hit while grooming a face they meant to sign — at which point the
 * only advice the product had was *undo something to make room*, which is not an
 * answer to give someone who has paid for every step.
 *
 * Weighed before raising it: D-195 measured depth-softness as real but
 * imperceptible at these depths, and D-191 keeps every render anchored to the
 * sharp original rather than to its predecessor, so length costs recipe
 * coherence rather than picture quality. The masked workstream weakens the
 * argument further — a masked edit does not grow the full-frame recipe at all.
 */
const MAX_INSTRUCTIONS = 24;

export type RefineInput = {
  userId: number;
  clientRequestId: string;
  candidatePublicId: string;
  instruction: string;
  /**
   * The instruction an outstanding question was about (D-180).
   *
   * Present when the last submission came back as a question and this one may
   * be the answer. The question itself is NOT sent — it is re-derived from this
   * sentence, so the options a typed answer can resolve into are the ones the
   * user was actually shown.
   */
  answering?: string;
};

export type RefineResult = {
  /**
   * Whether this cost anything (D-163 rule 4).
   *
   * `"selected"` means the recipe they described already existed as a picture,
   * so they were given it and charged nothing. Absent on the rows replayed from
   * operations written before typed removal, which were all renders.
   */
  kind?: "rendered" | "selected" | "asked";
  /**
   * A question, not an outcome (D-178/D-179/D-180).
   *
   * Free, and it never reaches the claim: a cold-start colour ask with no
   * referent, or a typo one slip from a word the product knows. The options are
   * chips; typing the answer must work identically, because the box is the
   * interface and a question that can only be tapped is a dead end.
   */
  reask?: Reask;
  /** Null when the answer is the ORIGINAL face. */
  variantId: string | null;
  candidateId: string;
  imageUrl: string;
  instructions: string[];
  /** What happened, for the panel to say — set only on a free outcome. */
  note?: string;
};

export type RefineServiceDependencies = {
  begin?: typeof beginDirectOperation;
  markRunning?: typeof markGenerationOperationRunning;
  deduct?: typeof deductCredits;
  refund?: typeof recordRefund;
  engine?: () => ReturnType<typeof castingIdentityEngine>;
  interpret?: typeof interpretRefinement;
  /** The reader that checks the picture against the record (D-185). */
  verifier?: Parameters<typeof verifyRender>[0]["engine"];
  admit?: () => boolean;
  /** The brief that knows what she was drawn wearing (D-206). */
  readBaseWorn?: typeof getBriefForOwnedCandidate;
  readBytes?: typeof storageReadBytes;
  /**
   * The segmenter the masked path asks where a region is.
   *
   * The default is fal-backed; without a key it refuses rather than returning an
   * empty mask, because an empty mask composites to "nothing changed" and would
   * charge her for the picture she already had.
   */
  regions?: RegionReader;
  /**
   * The masked harvest itself, injectable like every other dependency here.
   *
   * Suites that are about CHARGING, RETRYING and REFUNDING pass a passthrough:
   * they are not about masking, `maskedRefine.test.ts` is, and running the real
   * composite against a flat synthetic swatch measures the fixture rather than
   * the service. The seam is a dependency for the same reason `interpret` and
   * `verifier` are.
   */
  harvest?: typeof harvestRefinement;
  /** The engine the masked path renders with — GPT Image 2, at a pinned size. */
  maskedEdit?: () => ReturnType<typeof createFalMaskedEditEngine>;
  storeImage?: (
    input: { key: string; bytes: Buffer; contentType: string },
  ) => Promise<{ key: string; url: string }>;
  /**
   * Whether this face builds a reference library — read ONCE per render.
   *
   * The predicate rather than a boolean, and the same one handed to the mint, so
   * the caller's decision to do the work and the mint's decision to accept it
   * can never be two different answers. The caller has to read it too: composing
   * the ask list is free, but the digests the duplicate check needs are a
   * database round trip, and a dark deploy must not pay for one.
   */
  referenceLibraryEnabled?: (userId: number) => boolean;
  /** The library's retirement, injectable so the removal's two arms can be
   *  driven without a database (chunk 3). */
  retireSlot?: typeof retireReferenceSlot;
  /** The vacancy write, injectable for the same reason the retirement is: a
   *  test drives the absence being recorded without a database. */
  recordRows?: typeof recordReferenceRows;
  /**
   * The engine the REPAINT dispatches its one paint to.
   *
   * The same transport and the same factory as `maskedEdit` today — GPT Image 2
   * at the master's exact pixels — and its own seam because the two are not the
   * same decision. Routing is per class (the recipe class on GPT2, anatomical
   * work on NBP), so the day the repaint routes differently is a day this is
   * configured differently, and a shared field would have to be untangled under
   * a paid path rather than named ahead of it.
   */
  repaintEngine?: () => RepaintEngine;
  /**
   * Whether this render goes through the NEW compositor — read ONCE per render.
   *
   * The predicate rather than a boolean, for `referenceLibraryEnabled`'s reason:
   * the caller's decision and the flag's answer must never be two things.
   */
  repaintEnabled?: (userId: number) => boolean;
  /** Writes the sent recipe onto the variant at dispatch — see `recordVariantDispatch`. */
  recordDispatch?: typeof recordVariantDispatch;
};

async function defaultStoreImage(input: { key: string; bytes: Buffer; contentType: string }) {
  return storagePut(input.key, input.bytes, input.contentType);
}

/**
 * The segmenter the masked path asks, in production.
 *
 * Built per call rather than at module load so an unconfigured key is a REFUSAL
 * at the moment of use rather than a boot crash — and so the dark path never
 * constructs one at all. Without a key it returns the refusing reader, because a
 * masked edit that cannot segment must fail into the refund rather than quietly
 * deliver an unmasked frame.
 */
/*
  The key check lives in the FACTORY, not here — so a test can replace the whole
  engine, and so production still refuses with one clear sentence rather than
  discovering it deep in a request.
*/
function defaultMaskedEditEngine() {
  return createFalMaskedEditEngine({ apiKey: process.env.FAL_KEY ?? "" });
}

function defaultRegionReader(): RegionReader {
  const apiKey = process.env.FAL_KEY;
  return apiKey ? createFalRegionReader({ apiKey }) : refusingRegionReader;
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

  /*
    The composed identity SO FAR — what a relative instruction resolves against.
    Read from the selected face, because "greener" means greener than the thing
    they are looking at, not greener than the sheet's original.
  */
  const currentIdentity = readResolvedIdentity(source.internalPrompt);
  /*
    READ BY FACET, NOT BY FIELD (D-159).

    These are what a relative ask resolves against — "make it lighter", "shorter"
    — so reading the wrong one buys a paid edit relative to a colour the face
    does not have. Before facet supersession the guaranteed field was always
    populated when a colour had ever been set, so `identity.hair.colour` happened
    to be right. It no longer is: once a free `hairShade` supersedes the
    guaranteed `hairColour`, that field falls back to the ORIGINAL colour while
    the face on screen is pastel pink. `currentValueOfFacet` follows the facet.
  */
  /*
    THE PREDECESSOR IS READ BEFORE THE PARSE, because source containment needs
    it (D-171). A plural subject restates its whole set, so an honest
    restatement carries words from EARLIER sentences — and without the prior
    items to measure against, the guard refuses the very shape the interpreter
    is instructed to produce.
  */
  const predecessorForParse = source.variantPublicId
    ? existing.find((variant) => variant.publicId === source.variantPublicId) ?? null
    : null;
  const priorItems: Partial<Record<FreeSubject, string[]>> = {};
  for (const [subject, value] of Object.entries(readStoredDelta(predecessorForParse?.deltas)?.free ?? {})) {
    priorItems[subject as FreeSubject] = itemsOf(value);
  }
  /*
    THE RECORD IS SHOWN TOO, not only the recipe (D-173, parent C).

    D-167's confession asks whether the face HAS the thing, and it asked with
    the same every-word comparison the chain used — so a record holding "small
    gold hoops" answered no to "hoop earrings", and the confession fired on a
    face visibly wearing them. Referent resolution has to serve this step as
    well, or fixing the chain leaves the lie intact one branch over.
  */
  for (const subject of FREE_SUBJECT_KEYS) {
    /*
      ONLY WHERE THE RECIPE IS SILENT — and getting this wrong cost a real
      removal on the founder's own walk.

      `statedDetails` stores a plural subject JOINED ("small gold hoops, thin
      wire glasses"), so adding it beside the items it was joined from offered
      the model a third, phantom option. It echoed the joined pair, that echo
      matched no single item, the identity pass found nothing, and the fall-
      through deleted the whole subject — taking the glasses after all.

      The record is here to answer for facts the recipe never held. Where the
      recipe holds items, the items ARE the answer.
    */
    if ((priorItems[subject]?.length ?? 0) > 0) continue;
    const recorded = currentValueOfFacet(readResolvedIdentity(source.internalPrompt), facetOf(subject));
    if (recorded) priorItems[subject] = [recorded];
  }

  /*
    THE TWO FREE QUESTIONS, BEFORE THE PARSE AND LONG BEFORE THE CLAIM.

    Asking is a failure mode rather than a feature, so both fire rarely by
    construction: history answers an unqualified colour silently, and only a
    genuine cold start or a genuine near-miss produces a question. Neither
    costs anything — §10's arrow, one surface further back.
  */
  /*
    HISTORY WINS SILENTLY (D-178). The facet the last colour-bearing edit
    touched is handed to the parser as context, so "pinker" after a hair edit
    means the hair and nobody is asked anything. Only a session with no colour
    edit at all reaches the question.
  */
  const lastColourFacet = colourFacetOf(readStoredDelta(predecessorForParse?.deltas));

  /*
    THE ANSWER ARRIVES THE SAME WAY THE QUESTION WAS ASKED — through the box.

    The founder's condition on shipping the sentence form: it must never dead
    end. So a reply to an outstanding question is resolved into the instruction
    it stands for, and then run as if they had typed that in the first place —
    the chips, when they land, will call exactly this. An unrecognised reply
    resolves to nothing and simply runs as a new instruction, which is the other
    half of not dead-ending.
  */
  const outstanding = input.answering
    ? pendingReaskFor(input.answering, lastColourFacet != null)
    : null;
  const answered = outstanding ? resolveAnswer(outstanding, input.instruction) : null;
  const instruction = answered ?? input.instruction;

  /*
    "NEVER MIND" — the one answer that is not an instruction.

    Every other option resolves into a sentence they could have typed unaided.
    A decline cannot, because there is no sentence meaning "render nothing", so
    it resolves into one shared constant and is answered here: her current
    picture, a note saying so, and no claim. It has to be as easy as the accept
    or the question only has one real answer, which is not a question.
  */
  if (answered === LEAVE_AS_SHE_IS) {
    return {
      kind: "selected",
      note: "Left her as she is — nothing was charged.",
      variantId: source.variantPublicId,
      candidateId: input.candidatePublicId,
      imageUrl: storagePublicUrl(source.imageKey ?? source.candidate.imageKey),
      instructions: readInstructions(predecessorForParse?.instructions),
    };
  }

  /*
    THE TWO FREE QUESTIONS, BEFORE THE PARSE AND LONG BEFORE THE CLAIM.

    Skipped once something has been answered: "no, piink is right" is still one
    slip from a known word, and asking again would be the loop a question is
    supposed to end.
  */
  const miss = answered ? null : nearMiss(instruction);
  if (miss) {
    return {
      kind: "asked",
      reask: didYouMeanReask(instruction, miss),
      variantId: source.variantPublicId,
      candidateId: input.candidatePublicId,
      imageUrl: storagePublicUrl(source.imageKey ?? source.candidate.imageKey),
      instructions: readInstructions(predecessorForParse?.instructions),
    };
  }
  if (!answered && !lastColourFacet && needsColourReferent(instruction)) {
    return {
      kind: "asked",
      reask: whichFacetReask(instruction),
      variantId: source.variantPublicId,
      candidateId: input.candidatePublicId,
      imageUrl: storagePublicUrl(source.imageKey ?? source.candidate.imageKey),
      instructions: readInstructions(predecessorForParse?.instructions),
    };
  }

  /* `let` because a wordless removal is re-read as an edit below (D-189). */
  let parsed = await (dependencies.interpret ?? interpretRefinement)({
    instruction,
    prior: priorItems,
    lastColourFacet: lastColourFacet ? colourFacetLabel(lastColourFacet) : null,
    currentEyeColour: currentValueOfFacet(currentIdentity, "eye.colour"),
    currentEyeShape: currentValueOfFacet(currentIdentity, "eye.shape"),
    currentHairStyle: currentValueOfFacet(currentIdentity, "hair.cut"),
    currentHairColour: currentValueOfFacet(currentIdentity, "hair.colour"),
    currentHairTexture: currentValueOfFacet(currentIdentity, "hair.texture"),
    currentMakeup: currentValueOfFacet(currentIdentity, "makeup"),
  });
  /*
    AND DID HER SENTENCE SURVIVE THE READING? — before anything is claimed.

    A delta that only repeats what she already is renders a face identical to
    the one she started with, charges for it, and leaves the verification net
    with no row for the thing she asked about — a false pass built at the parse,
    invisible to the zero-false-pass bar because the check that would have
    failed was never written. Measured at three of nineteen readings on the
    plural shape. Refused here, in the step that was already free.
  */
  const refuseIfAbsorbed = (delta: RefineDelta): void => {
    const verdict = saysNothingNew({ delta, prior: priorItems, identity: currentIdentity });
    if (!verdict.absorbed) return;
    log.warn(
      { candidateId: input.candidatePublicId, instruction, alreadyTrue: verdict.alreadyTrue },
      "[refineService] the ask was absorbed into a restatement of what she already is — refusing, free",
    );
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: refusalMessage({ ok: false, refusal: { reason: "absorbed", asked: verdict.alreadyTrue } }),
    });
  };
  if (parsed.ok && "delta" in parsed) refuseIfAbsorbed(parsed.delta);
  if (!parsed.ok) {
    /*
      A FREE REFUSAL SHOULD NOT ALSO BE A FREE PASS ON DIAGNOSIS.

      This path wrote nothing — no row (correctly: a zero-credit row is noise in
      the ledger and a phantom for the recovery sweep) and no log line. So when
      run-11 refused *"give her freckles"* on a plain face, the reply was gone by
      the time anyone asked why: not because logs expire — they reach back to
      container start — but because there was never a line to find. I spent a
      chunk of a shift disproving a hypothesis I could have read in a second.

      Reasons only, plus the value that failed to file. The ledger stays clean,
      the reliability report still counts paid attempts only, and the next
      occurrence is a lookup instead of an argument.
    */
    log.warn(
      {
        candidateId: input.candidatePublicId,
        instruction,
        reason: parsed.refusal.reason,
        ...("asked" in parsed.refusal ? { asked: parsed.refusal.asked } : {}),
        ...("value" in parsed.refusal && parsed.refusal.value
          ? { modelSaid: parsed.refusal.value }
          : {}),
      },
      "[refineService] refused before the charge — nothing claimed, nothing deducted",
    );
    // An honest boundary, not a fault — and free, which is the point of §10.
    throw new TRPCError({ code: "BAD_REQUEST", message: refusalMessage(parsed) });
  }

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
  const predecessor = predecessorForParse;

  /* ---- the FREE outcomes, resolved before anything is claimed (D-163) ---- */

  /*
    NO OPERATION FOR FREE WORK.

    Navigation and a free re-selection move no money and produce no artifact, so
    they open no operation: an operation row carrying zero credits and no image
    is noise in the ledger and a phantom for the recovery sweep to adjudicate.
    `selectVariant` has always been a gate-less free procedure; this is the same
    act reached by typing instead of clicking, and it costs the same nothing.
  */
  const selectAndReport = async (
    target: { publicId: string | null; imageUrl: string; instructions: string[] },
    note: string,
  ): Promise<RefineResult> => {
    /*
      A FREE ANSWER THAT MOVES HER IS NOT ALLOWED TO BE SILENT (Fable, 2026-08-08).

      Run-7: "remove her glasses", on a face plainly wearing them, answered
      "You already have that version — nothing charged" and moved her from the
      three-step earrings variant back to the two-step one. The gold hoops she
      had paid for left her selected face and nothing said so.

      Two things follow, and neither depends on knowing why the prune was wrong.

      **The sentence names what it did.** She asked about glasses; if the answer
      is "this takes off the gold hoop earrings step", the mistake is in the
      sentence she is reading, not buried in a chain. Silent corruption becomes
      an immediately contestable statement. (A step-count rule cannot do this
      job: D-173's legitimate undo moves her to FEWER steps by design — that
      move IS the delivery — and the facet cannot separate them either, since
      glasses and earrings are both `statedAccessories`.)

      **And it is written down.** Every FREE exit from this path logged nothing
      at all, which is why run-7 could not be diagnosed from production: the
      paid failure path carries "this line is the only record of why" and the
      free ones carried no record whatsoever. The next one is diagnosable.
    */
    const leaving = readInstructions(predecessor?.instructions);
    const dropped = leaving.filter((step) => !target.instructions.includes(step));
    log.info(
      {
        userId: input.userId,
        candidate: input.candidatePublicId,
        instruction,
        from: leaving,
        to: target.instructions,
        dropped,
        note,
      },
      "[refineService] a FREE answer moved her selection",
    );
    const moved = await selectVariant({
      userId: input.userId,
      candidatePublicId: input.candidatePublicId,
      variantPublicId: target.publicId,
    });
    if (!moved) {
      /* The face moved under us — expired, discarded, signed in another tab.
         Say so rather than reporting a selection that did not happen. */
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "That version isn't available any more. Nothing was charged.",
      });
    }
    return {
      kind: "selected",
      variantId: target.publicId,
      candidateId: input.candidatePublicId,
      imageUrl: target.imageUrl,
      instructions: target.instructions,
      note,
    };
  };

  const originalTarget = {
    publicId: null,
    imageUrl: storagePublicUrl(source.candidate.imageKey),
    instructions: [] as string[],
  };
  const asTarget = (variant: typeof existing[number]) => ({
    publicId: variant.publicId,
    imageUrl: variant.imageKey ? storagePublicUrl(variant.imageKey) : originalTarget.imageUrl,
    instructions: readInstructions(variant.instructions),
  });

  if (parsed.intent === "navigate") {
    if (!predecessor) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You're already looking at the original. Nothing was charged.",
      });
    }
    const back = readInstructions(predecessor.instructions).slice(0, -1);
    const target = back.length === 0
      ? originalTarget
      : asTarget(
        existing.find((variant) => sameInstructions(readInstructions(variant.instructions), back))
        ?? predecessor,
      );
    return selectAndReport(target, "Went back a step — nothing charged.");
  }

  const predecessorChain = predecessor
    ? readChain(readInstructions(predecessor.instructions), readStepDeltas(predecessor.stepDeltas))
    : [];

  /*
    THE REMOVAL, resolved against the RECIPE and not against the picture.

    `editDelta` is what the paid path ends up composing. It is `parsed.delta` for
    an ordinary edit, and for a removal it stays null — removal is subtraction,
    so there is nothing to add.
  */
  let editDelta: RefineDelta | null = "delta" in parsed ? parsed.delta : null;
  /*
    D-178 ENFORCED, not just instructed. An unqualified colour follows the last
    colour-bearing facet — and the prompt obeyed that on one run and filed
    makeup on the next, so the drawer is corrected here rather than left to the
    sampler.
  */
  if (editDelta && lastColourFacet && needsColourReferent(instruction)) {
    editDelta = redirectColourTo(editDelta, lastColourFacet);
  }
  /* A likeness comparison rode this ask and was set aside (D-181). */
  const droppedReference = "droppedReference" in parsed && parsed.droppedReference === true;
  let chain: ChainStep[] = predecessorChain ?? [];
  let removedFacets = new Set<Facet>();
  /**
   * WHAT A REMOVAL TOOK OFF HER, in her own words.
   *
   * An operation that deletes its own facet from the record must carry its
   * subject explicitly to every consumer that keys off the record (Fable,
   * 2026-08-08). The harvest asks `facetsWrittenBy(composed)` which question to
   * segment; a removal prunes its own step, so `composed` no longer names the
   * thing, the glasses are never asked about, and `outsideMaskUnchanged` then
   * guarantees the master is kept exactly where the painter removed them —
   * a paid render that hands back the face she started with.
   *
   * The pruned record definitionally cannot name what departed. The removal
   * EVENT is the only source of truth for its own subject, so it is carried
   * rather than reconstructed.
   */
  let departed: string | null = null;

  /*
    A REMOVAL HAS TO SAY SO (D-189).

    The trial asked for "small gold hoop earrings" — a plain addition — and got
    "I can't find any earrings on this face — there's nothing to take off",
    because one sampling classified an ADD as a REMOVE and D-167's confession
    then worked perfectly on a false premise. Twelve later samplings of the same
    sentence all said edit, so this is a mis-sampling rather than a rule, which
    is exactly what a backstop is for.

    Re-read with the removal vocabulary withheld — the same door the service
    already opens when a removal fails to hold up — rather than guessing at a
    delta here. The parse stays the model's; the CLASSIFICATION gets a floor.
  */
  if (parsed.intent === "remove" && !namesRemoval(instruction)) {
    log.warn(
      { instruction },
      "[refineService] a removal with no removal word — re-reading as an edit",
    );
    const asEdit = await (dependencies.interpret ?? interpretRefinement)({
      instruction,
      mode: "edit",
      prior: priorItems,
      lastColourFacet: lastColourFacet ? colourFacetLabel(lastColourFacet) : null,
      currentEyeColour: currentValueOfFacet(currentIdentity, "eye.colour"),
      currentEyeShape: currentValueOfFacet(currentIdentity, "eye.shape"),
      currentHairStyle: currentValueOfFacet(currentIdentity, "hair.cut"),
      currentHairColour: currentValueOfFacet(currentIdentity, "hair.colour"),
      currentHairTexture: currentValueOfFacet(currentIdentity, "hair.texture"),
      currentMakeup: currentValueOfFacet(currentIdentity, "makeup"),
    });
    if (asEdit.ok && "delta" in asEdit) {
      /* The SECOND reading gets the same guard as the first. A re-read is a
         parse, and a parse that loses her sentence loses it either time. */
      refuseIfAbsorbed(asEdit.delta);
      parsed = asEdit;
      editDelta = asEdit.delta;
    }
  }

  if (parsed.intent === "remove") {
    /* Carried from here, before any pruning can erase the evidence of it. */
    if (parsed.match) departed = parsed.match;
    if (predecessorChain === null) {
      /*
        A row from before the chain column, or one whose two lists disagree.
        Refuse rather than approximate: reconstructing the missing steps by
        diffing ancestors is right most of the time and silently drops an
        earlier edit the rest, which is the annihilation class by another road.
      */
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "This face was refined before undoing by name existed, so its steps can't be "
          + "taken apart. Backing up to an earlier version still works. Nothing was charged.",
      });
    }
    /*
      A REMOVAL WITH NO NOUN IN IT REFUSES, FREE, BEFORE ANYTHING IS MATCHED
      (Fable ruling, 2026-08-08, on run-7's root cause).

      The parse that reached this line on run-7 named nothing at all. Width was
      then INFERRED from the missing words — "no narrowing words" meant "take
      every step on this facet" — so the widest, most destructive branch in the
      matcher was reached by omission, and the provenance check that would have
      stopped it needs a noun to ask the picture about and so was skipped for
      want of one. Her paid earrings step went, silently, on a question about
      her glasses.

      This sits BEFORE the matcher deliberately. A parse with no noun has failed
      its own contract, and anything downstream of a known-broken read — a
      prune, a confession about her brief, an honest paid render — is a decision
      built on a read we already know we cannot trust. The first draft of this
      sent it to her face; ruled against, and rightly: a free, instant "tell me
      which one" beats a surprise 25 credits resolving an ambiguity she never
      got to see.

      A width claim does not rescue it, which is the one place this goes past
      the ruling's letter: `whole: true` with no noun still leaves the picture
      nothing to arbitrate, and asks for the widest prune there is. The
      requirement is the NOUN. Width only ever said how far.
    */
    if (!parsed.match) {
      log.warn(
        {
          userId: input.userId,
          candidate: input.candidatePublicId,
          instruction,
          subject: parsed.subject,
          whole: parsed.whole,
          items: parsed.items,
        },
        "[refineService] a removal reached the chain with no words in it — refusing rather than pruning",
      );
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "I didn't catch what should come off. Tell me the thing itself — "
          + "\"the earrings\", \"her glasses\", \"the fringe\" — and I'll take it off. "
          + "Nothing was charged.",
      });
    }

    const matched = matchSteps(predecessorChain, {
      subject: readRemovalSubject(parsed.subject),
      match: parsed.match,
      /* How wide they meant it, as the parser reported it — never inferred
         from what the parse happens to be missing (run-7). */
      whole: parsed.whole,
      /*
        Identity beats word overlap — the parser resolved the referent and the
        code already proved the echo is a stored item (D-173). Without this the
        matcher falls to the word path with no narrowing words, which deletes
        EVERY step on the facet: "remove the earrings" took the glasses too.
      */
      items: parsed.items,
    });

    /*
      DID THE CHAIN PUT IT THERE? — the picture arbitrates, in front of BOTH
      branches (Fable ruling, 2026-08-08, on the founder's `96640590`).

      `matchSteps` deletes a step when the parser's echo matches its items, and
      never checks that the echo has anything to do with what was NAMED. On the
      founder's walk "remove her glasses" was resolved against the only
      accessory the parser had been shown — her gold hoops — and it deleted the
      EARRINGS step she had paid for, landed on an older variant, and answered
      "you already have that version" to a woman wearing glasses.

      **No comparison of words can fix this**, and that is worth stating because
      it is the obvious fix. D-173's founding case is "remove the earrings"
      matching a stored "small gold hoops": the named thing is nowhere in the
      item's text and the match is CORRECT. Tonight's is "remove her glasses"
      matching "gold hoop earrings": the named thing is nowhere in the item's
      text and the match is WRONG. A relevance check strict enough to stop the
      second reintroduces the bug the first one fixed.

      What separates them is not language, it is history. A prune can only
      remove what the CHAIN added. So the question is asked of the ORIGINAL
      candidate — the face before any refinement touched it:

        absent from the base   the chain put it there, so pruning removes it
        present in the base    it predates every step, and no amount of
                               pruning will take it off her face — this is a
                               render, not an undo

      The base is the right frame here and the selected face would be the wrong
      one: the question is about provenance, not about what she is looking at.
    */
    /*
      THE GUARD'S OWN PRECONDITIONS WERE THE HOLE (run-7's root cause, and it
      was inside this branch rather than beside it).

      The condition read `matched.length > 0 && parsed.match &&
      maskedEditingEnabledFor(…)`, so the arbitration was skipped — silently,
      and with every one of its log lines skipped alongside it — whenever
      either extra precondition failed. Both were reachable:

      **No words to arbitrate with.** `matchSteps` matches on the SUBJECT ALONE
      when the parse carries no narrowing words, and a subject-only match
      deletes WHOLE STEPS on that facet. So the parse shape that destroys the
      most was the one shape the picture was never shown. That shape is not
      exotic — the interpreter's own echo example omits `match` entirely, and
      any echo that is not verbatim a filed item is dropped by the authority
      filter, so a targeted removal arrives here silently widened to a
      subject-wide one. It is the only shape that reaches run-7's harm: with a
      match present the check runs and logs, and the flag is `users:1` with
      user 1 walking, so the deduction closes on the swept single pruning site.

      **The masked-editing flag.** The reader is not a masked-path dependency —
      `defaultRegionReader()` needs only `FAL_KEY` and degrades to a refusing
      reader, which the fail-closed branch below already handles honestly. The
      flag was therefore guarding nothing except the guard itself, and its own
      documented rollback ("set it back to off") would have quietly disabled
      the control for everybody. A control that a feature flag can switch off
      without saying so is invariant 7 wearing the rollback switch as a hat.

      So: A PRUNE PROCEEDS ONLY WHERE THE PICTURE HAS ARBITRATED. Nothing named
      means nothing to ask, which means no prune — the ask falls through to the
      face below, where the record and then the face answer it honestly. The
      user's own words reaching `match` is the parser's job (its prompt now
      says so in the echo example too), and this is the backstop that does not
      depend on the model doing it — a guard the model cannot rescue.
    */
    if (matched.length > 0) {
      const began = Date.now();
      let presentInBase: boolean;
      /*
        THE SAME TWO MISTAKES AS THE FACE GATE BELOW, in the same function,
        and this one decides whether to DELETE A STEP SHE PAID FOR.

        It asked `parsed.match` — her own inflection — where the reader's
        bilateral set is keyed on the singular, and it judged the answer against
        the eyewear band. On a face wearing hoops both fail the same way: the
        reader is asked "earrings" and finds nothing, or finds them and reads
        0.056% against a 0.4% band written for glasses. Either way
        `presentInBase` comes back false, the pair is treated as something the
        chain added, and the prune below deletes a step she bought while the
        earrings stay exactly where they are.

        6a7f6251 fixed the word at the face gate and this sibling was missed —
        law 7's sweep, owed then and paid now. Declared out here rather than
        beside the read so the log below can name what was actually asked.
      */
      const asked = accessoryKindOf(parsed.match) ?? parsed.match;
      try {
        const reader = dependencies.regions ?? defaultRegionReader();
        const original = await (dependencies.readBytes ?? storageReadBytes)(source.candidate.imageKey!);
        /*
          TWO DIFFERENT FAILURES, and collapsing them was this block's first
          bug. A segmenter that finds nothing is the honest answer to "is it
          there" — not a reason to refuse. Only being unable to LOOK at all is
          the fail-closed case, which is why the image read sits outside this
          inner try and the segmentation sits inside it.

          **The split was right and the mechanism was not, for four months.**
          The reader THREW on an empty answer, so this inner `catch` was the
          only place absence could arrive — and it caught a fal 500 by exactly
          the same door. "SAM3 found nothing" and "the segmenter fell over
          mid-question" both landed on `presentInBase = false`, which prunes a
          step she paid for. The comment above described a boundary the code did
          not have.

          `absentIsAnswer` is the reader's own way of saying it: an empty answer
          comes back as an EMPTY MASK, so absence is a reading with a number
          (0.0000%) and only transport still throws. The two causes now separate
          themselves at the source, and the `catch` means what it always claimed
          to mean. The earring court is where this was learned — it is the flag
          that turned a column of "NO READ" into a measured negative population.
          (opus-284 triage, fable-341.)
        */
        try {
          const seen = await reader.region({ image: original.bytes, name: asked, absentIsAnswer: true });
          /*
            STRICTLY GREATER, like every other reader of a coverage floor in
            this codebase — `bornWornDetector:275`, `canthalTilt:403`, and the
            DELIVERED frame's own gate a couple of thousand lines below. It
            matters most exactly where it looks like a detail: an UNMEASURED
            kind gets floor 0, whose documented meaning is "the segmenter found
            nothing of it at all", and `0 >= 0` would turn an empty reading into
            a present one for every kind but glasses and earring. Four existing
            tests said so the moment `absentIsAnswer` let a real absence arrive
            here as a number instead of a throw.
          */
          presentInBase = coverage(seen) > departureFloorFor(asked).floor;
        } catch (error) {
          /*
            Transport, now that absence cannot arrive here. Fail CLOSED to the
            same refusal the outer catch makes, rather than to a verdict about
            her face that nothing read.
          */
          log.warn(
            { candidate: input.candidatePublicId, asked, why: error instanceof Error ? error.message : String(error) },
            "[refineService] the segmenter could not answer whether the chain put it there",
          );
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "I couldn't check her face just now, and I won't undo a step without "
              + "looking. Try that again in a moment — nothing was charged.",
          });
        }
      } catch (error) {
        /*
          FAIL CLOSED. A segmenter that cannot answer must not hand the decision
          back to the word match — that is precisely the path that corrupted a
          paid chain, and falling back to it when a dependency is missing is
          invariant 7's violation wearing a new hat. Free, and it says why.
        */
        log.warn(
          { candidate: input.candidatePublicId, asked: parsed.match, why: error instanceof Error ? error.message : String(error) },
          "[refineService] could not check her face before undoing — refusing rather than guessing",
        );
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "I couldn't check her face just now, and I won't undo a step without "
            + "looking. Try that again in a moment — nothing was charged.",
        });
      }
      log.info(
        {
          candidate: input.candidatePublicId, said: parsed.match, asked, presentInBase,
          floor: departureFloorFor(asked).floor,
          ms: Date.now() - began,
        },
        "[refineService] asked the ORIGINAL whether the chain put it there",
      );
      if (presentInBase) {
        /* It predates the chain. Whatever the echo matched, it is not the thing
           she asked to remove, and pruning it would delete a step she paid for
           while leaving her glasses exactly where they are. */
        matched.length = 0;
      }
    }

    if (matched.length === 0) {
      /*
        THE HONEST THIRD STEP, BEFORE THE FACE (D-167).

        Nothing in the recipe matches. Rule 3 sends that to the face as an
        ordinary content edit, which is right when the face HAS the thing — the
        feature came from the dice rather than from an instruction. It is wrong
        when the thing exists nowhere: "remove her freckles" on a face with none
        rendered a FULL-FACE SMOOTHING, the beautify prior arriving as an
        identity-adjacent over-edit nobody asked for and somebody paid for.

        So the RECORD is asked first. Freckles from the dice live at
        `realized.skinCharacter`, which `currentValueOfFacet` reads for the marks
        facet — the record is authoritative here, which is what makes the
        confession safe rather than a guess.

        Saying so costs nothing and is true. Rendering a beautify pass costs 25
        credits and changes a face nobody asked to change.
      */
      const subject = readRemovalSubject(parsed.subject);
      const recorded = subject
        ? currentValueOfFacet(currentIdentity, facetOf(subject))
        : null;
      /*
        AN ECHO IS PROOF THE THING EXISTS (D-173, parent C).

        The parser was shown the recipe AND the record, and every echo it
        returned has been verified verbatim against one of them. So an echo
        settles the question that `textMentions` used to answer badly: the face
        HAS this, and the honest branch is a content edit rather than a
        confession that the record itself contradicts.
      */
      const echoedSomething = (parsed.items?.length ?? 0) > 0;
      /*
        THE BASE-WORN INVENTORY — the third place a thing can come from (D-206).

        The record above knows two origins: the refine recipe, and the axes the
        dice wrote. It does not know the third, and the third is what the
        founder was standing on. Their brief asked for a woman in glasses; every
        face on that sheet was drawn wearing them; the recipe has never had an
        opinion about glasses, because nobody ever refined them.

        So "remove her glasses" met an empty recipe and the code said the
        glasses do not exist — to a person looking straight at them. That is the
        record-versus-pixels absurdity at its purest, and it stopped a sale.

        The roll's compiled brief is asked as well. It is the same evidence the
        echo already shows the user on the sheet, and the composer treats a
        stated accessory as a failed candidate if it does not appear, so a
        brief that names glasses is a strong claim that this face wears them.
      */
      const briefWorn = await (dependencies.readBaseWorn ?? getBriefForOwnedCandidate)(
        input.userId,
        input.candidatePublicId,
      );
      const baseWorn = briefWorn
        ? readBriefFacts(briefWorn.lockContract, briefWorn.compiledBrief, briefWorn.briefText)
          .statedAccessories
        : null;
      const briefNamesIt = baseWorn?.some((worn) => textMentions(worn, parsed.match)) ?? false;

      /*
        FOR A REMOVAL, THE RECORD GATES NOTHING — THE PICTURE DECIDES.
        (Founder ruling, 2026-08-07, and it retires an interim confession.)

        The record-gate exists to stop the system asking a segmenter where an
        absent thing is (D-213) — a question with no honest answer, which
        returns a confident blob. **A removal is not that question.** The user
        has ASSERTED the thing is there, and their assertion plus a segmenter's
        agreement are two independent signals; the record is a third, and it is
        the one that has now been wrong on a real face.

        The founder's own testimony: their brief was edited to ask for glasses
        and re-rolled, the candidate came from that re-roll, and the refusal
        told them the brief never asked. Whether that is a stale `briefText`
        against a fresh intent or the brand scrub taking "miu miu" out of one
        side of `tokensComeFromBrief`, the record lost — and the confession said
        so in a sentence that was factually false to someone looking at her
        glasses.

        So the record is consulted FIRST, as an optimization: if it names the
        thing, no call is spent. If it is silent, we LOOK. The interim sentence
        was marked interim until the masked pass could look at her face, and it
        can look now.
      */
      let faceWearsIt = false;
      if (!echoedSomething && !textMentions(recorded, parsed.match) && !briefNamesIt
        && subject === "statedAccessories" && parsed.match
        && maskedEditingEnabledFor(input.userId)) {
        try {
          const reader = dependencies.regions ?? defaultRegionReader();
          /* The face she is actually looking at — the selected variant if there
             is one, her candidate otherwise. Asking the wrong picture would be
             the record-versus-pixels mistake wearing a new hat. */
          const shown = await (dependencies.readBytes ?? storageReadBytes)(
            source.imageKey ?? source.candidate.imageKey,
          );
          /*
            ASK THE CATALOGUE'S WORD, NOT HER INFLECTION (fable-335).

            This asked the segmenter `parsed.match` — whatever the customer
            typed. Measured on a face wearing a gold hoop at each lobe: asked
            "earrings", the reader answers NOTHING AT ALL; asked "earring", the
            region name every other reader in this system uses, it finds them at
            once. Its bilateral set is keyed on the singular and nothing
            translated, so a plural word turned a face plainly wearing the thing
            into "her face does not show it" — and the removal was refused with
            a sentence saying her brief never asked.

            Same table, same derivation as the vacant phrase: the noun names a
            KIND and the kind names the question. A word the catalogue cannot
            name falls back to what she typed, which is the old behaviour and
            still the honest one for an object we have no region for.
          */
          const asked = accessoryKindOf(parsed.match) ?? parsed.match;
          const seen = await reader.region({ image: shown.bytes, name: asked });
          const area = coverage(seen);
          /*
            THE FLOOR FOR THE KIND IN FRONT OF IT, not the eyewear band.

            This compared every worn thing to `COVERAGE_BANDS.eyewearFrames.min`
            (0.4%), a band measured on GLASSES. A pair of gold hoops covers
            0.0404–0.0621% of the frame across eight measured faces, so the band
            is **6.4x the largest of them** and no face wearing earrings could
            ever be found to be wearing them. The refusal she got said her brief
            had never asked for earrings, while she wore them in the picture.

            `departureFloorFor` is the catalogue's per-kind answer and the same
            one the DELIVERED frame is already judged against a few hundred
            lines below — so this line was the last place in one gate still
            holding a second opinion about what "is it there" means. An
            unmeasured kind returns 0, which is the strictest reading there is
            and the direction that does not take her money.
          */
          const { floor, measured, provenance } = departureFloorFor(asked);
          /* Strictly greater — see the sibling gate above; a zero floor means
             "nothing of it at all", not "anything at all". */
          faceWearsIt = area > floor;
          log.info(
            {
              userId: input.userId,
              candidate: input.candidatePublicId,
              said: parsed.match,
              asked,
              coverage: Number(area.toFixed(5)),
              floor,
              /* Which court the verdict leaned on, so a log line can be argued
                 with rather than merely believed. */
              floorMeasured: measured,
              provenance: measured ? provenance.slice(0, 120) : provenance,
              faceWearsIt,
            },
            "[refineService] the record was silent on a removal, so her face was asked",
          );
        } catch (error) {
          /* A segmenter that finds nothing throws, and that is the honest
             answer to "is it there" — not a reason to fail the request. */
          log.info(
            { candidate: input.candidatePublicId, asked: parsed.match, why: error instanceof Error ? error.message : String(error) },
            "[refineService] her face does not show the thing asked to be removed",
          );
        }
      }

      if (!echoedSomething && !textMentions(recorded, parsed.match) && !briefNamesIt && !faceWearsIt) {
        const named = parsed.match
          ?? (subject ? FREE_SUBJECTS[subject as FreeSubject]?.toLowerCase() : null)
          ?? "that";
        /*
          A WORN THING GETS ITS OWN SENTENCE, because it has its own evidence.

          The confession still stands here — the composer forbids inventing an
          accessory the description never named, so a brief that is silent and a
          recipe that is silent really is the whole story. But the old sentence
          claimed to have looked at her FACE, and it had not: it had read a
          recipe. Saying "I can't find any glasses on this face" to someone
          looking at her glasses is what made tonight's refusal feel like being
          called a liar, on top of being wrong.

          So this one says what was actually consulted, and it names the way
          out. If the brief did ask for them, the branch above has already let
          the removal through and this never runs.
        */
        if (subject === "statedAccessories") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Her brief didn't ask for ${named}, and nothing since has added any, `
              + `so there's nothing on record to take off. If she's wearing ${named} `
              + "in the picture, tell me what to change instead and I'll edit it. "
              + "Nothing was charged.",
          });
        }
        /*
          "ANY" CARRIES THE ARTICLE, and the walk is what caught it.

          It read "This face doesn't have necklace" — the user typed "remove
          the necklace", the match is the bare noun, and the frame supplied no
          article. No driver could see it: they assert which BRANCH fired, and
          this is a sentence. "Any" is the one word that works for a singular
          noun, a plural one and a mass one alike, without guessing which.
        */
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `I can't find any ${named} on this face — there's nothing to take off. `
            + "Nothing was charged.",
        });
      }
      /*
        THE DEPARTURE GETS A HOME — and this is where a base-worn removal has
        always fallen through the floor (D-238).

        Everything above has just established the two facts that matter: nothing
        in the CHAIN put this here, and it is nevertheless on her — from the
        brief, from the dice, or from her own face as the segmenter saw it. That
        is the definition of base-worn, and it is the one removal subtraction
        cannot perform. There is no step to prune; the glasses are in the
        original photograph, and every render is anchored on that photograph.

        It used to be re-read as an ordinary EDIT, which handed the model a
        negative ask and asked it to file a positive answer. Whatever came back,
        the departure itself was never recorded — so the render never asked for
        it, and her next ask started again from the bespectacled original.

        So the code authors the fact rather than asking for it. It knows the
        subject and it knows their words, both already validated, and no model
        round-trip can improve on that — the same reason removal matching is
        code-owned. It becomes a chain step like any other, which is what makes
        it durable, undoable, and superseded by a later ask on the same subject.

        Only for subjects that can LEAVE (law 8, and the founder's fringe is the
        argument — see `DEPARTABLE_SUBJECTS`). Anything else keeps the road
        below, where a cut with no fringe is a haircut rather than a hole.
      */
      if (subject && isDepartableSubject(subject as FreeSubject)) {
        const noun = departedNoun(parsed.match);
        log.info(
          {
            userId: input.userId, candidate: input.candidatePublicId,
            subject, noun, recorded: Boolean(recorded), briefNamesIt, faceWearsIt,
          },
          "[refineService] a base-worn thing is departing — recording it in the recipe",
        );
        editDelta = { absent: { [subject as FreeSubject]: [noun] } };
        departed = noun;
      } else {
      /*
        RULE 3 — THE FACE SECOND. The record says it IS there, so this is an
        ordinary content edit. Re-read with the removal vocabulary withheld, or
        the same sentence classifies as a removal forever.
      */
      const asEdit = await (dependencies.interpret ?? interpretRefinement)({
        instruction,
        mode: "edit",
        prior: priorItems,
        currentEyeColour: currentValueOfFacet(currentIdentity, "eye.colour"),
        currentEyeShape: currentValueOfFacet(currentIdentity, "eye.shape"),
        currentHairStyle: currentValueOfFacet(currentIdentity, "hair.cut"),
        currentHairColour: currentValueOfFacet(currentIdentity, "hair.colour"),
        currentHairTexture: currentValueOfFacet(currentIdentity, "hair.texture"),
        currentMakeup: currentValueOfFacet(currentIdentity, "makeup"),
      });
      if (!asEdit.ok) throw new TRPCError({ code: "BAD_REQUEST", message: refusalMessage(asEdit) });
      if (!("delta" in asEdit)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "There's nothing like that in what you've asked for so far, and it isn't "
            + "something I can change directly. Nothing was charged.",
        });
      }
      editDelta = asEdit.delta;
      }
    } else {
      for (const match of matched) {
        for (const facet of Array.from(facetsWrittenBy(predecessorChain[match.index]!.delta))) {
          removedFacets.add(facet);
        }
      }
      /*
        ITEMS, NOT STEPS (D-171). A plural subject holds several facts in one
        step, so "remove the hoops" against "small gold hoops and thin wire
        glasses" prunes to the survivors — the glasses were never named, and
        deleting the step would have taken them too.
      */
      const removalSubject = readRemovalSubject(parsed.subject);
      chain = chainAfterRemoval(
        predecessorChain,
        matched,
        removalSubject && !(REFINABLE_AXES as readonly string[]).includes(removalSubject)
          ? removalSubject as FreeSubject
          : null,
      );
    }
  }

  /*
    What the face BECOMES.

    **An edit never depends on the chain being readable, and a removal does.**
    That asymmetry is the whole reason these are two branches rather than one
    tidy `nextChain`: composing an edit through the chain made an ordinary
    refinement of a PRE-COLUMN variant silently drop every earlier instruction,
    because an unreadable chain resolves to empty. That is the annihilation
    class — the exact defect this program has now closed twice — reintroduced by
    the machinery meant to allow undoing it.

    So an edit appends to the instruction list and composes over the
    predecessor's stored composed delta, exactly as it did before typed removal
    existed. The step chain rides along and simply stays short on a legacy row,
    which is honest: removal refuses there, and nothing else notices.
  */
  const priorInstructions = readInstructions(predecessor?.instructions);
  const instructions = editDelta
    ? [...priorInstructions, instruction.trim()]
    : chain.map((step) => step.instruction);
  const stepDeltas = editDelta
    ? [...readStepDeltas(predecessor?.stepDeltas), editDelta]
    : chain.map((step) => step.delta);
  /*
    AN UNREADABLE PREDECESSOR STOPS THE MONEY (D-182).

    This was `readDelta(predecessor?.deltas) ?? {}`, and that one fallback is
    how the founder's eleven-instruction chain rendered as the original plus
    pink hair: the stored recipe could not be read, `?? {}` turned that into
    "there was nothing", and the render proceeded on a recipe the code had
    already decided it could not parse. The picture was exactly what the prompt
    asked for. The prompt was missing ten facts.

    So the two cases are told apart. NOTHING STORED is legitimate — the first
    refinement of a face has no predecessor. STORED BUT UNREADABLE is a fault,
    and it refuses before the claim, for free, rather than buying a picture that
    silently drops what somebody already paid for.
  */
  const priorDelta = predecessor?.deltas != null ? readStoredDelta(predecessor.deltas) : {};
  if (priorDelta === null) {
    log.error(
      { candidate: input.candidatePublicId, variant: predecessor?.publicId },
      "[refineService] UNREADABLE PREDECESSOR — refusing rather than composing from nothing",
    );
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Something's wrong with this face's history and I won't guess at it — "
        + "the edit would have dropped what you already asked for. Nothing was charged.",
    });
  }
  const composed = editDelta
    ? composeDeltas([priorDelta, editDelta])
    : composeChain(chain);

  /*
    EVERYTHING THAT MUST NOT BE IN THIS PICTURE — standing, plus this render's own.

    Two sources, and neither one alone is enough:

    - **The recipe's standing departures.** Renders are base-anchored, so on her
      NEXT ask — lip gloss tomorrow — the base still has the glasses on and the
      removal has to be performed all over again. That is the whole reason the
      departure was given a home rather than left as one render's local.
    - **This render's own prune.** A chain-added thing leaves by having its step
      deleted, which writes nothing to `absent` and must not: the base never had
      it. But the mask and the net still need to know what left THIS time.

    Derived here, once, so every consumer below reads the same list rather than
    each reconstructing it — the shape that let four consumers disagree about
    what a removal was in the first place.
  */
  const departedFromPicture: string[] = Array.from(new Set([
    ...departedItems(composed),
    ...(departed ? [departed] : []),
  ]));

  /*
    MATERIALIZATION IS HONEST ABOUT MONEY (D-163 rule 4).

    If the recipe they just described already exists as a picture, they get that
    picture and pay nothing. "Remove the last step" is backing up wearing
    different words, and charging 25 for it would be charging for the phrasing.

    The comparison is BOTH lists — same sentences and same composed values.
    Sentences alone would hand back a variant whose relative steps ("greener
    still") resolved against a different starting point: the same words, a
    different face. Values alone would collapse two different histories whose
    ends happen to agree, which is a record that lies about how it got there.
  */
  if (!editDelta) {
    if (instructions.length === 0) {
      return selectAndReport(originalTarget, "That takes it back to the original — nothing charged.");
    }
    const already = existing
      .filter((variant) => Boolean(variant.imageKey))
      .find((variant) => sameChain(
        { instructions, delta: composed },
        {
          instructions: readInstructions(variant.instructions),
          /* Stored, so it reads through the legacy shim — otherwise an old
             variant can never match a recipe and gets re-bought (D-182). */
          delta: (readStoredDelta(variant.deltas) ?? {}),
        },
      ));
    if (already) {
      /*
        NAME THE STEPS THIS TAKES OFF. "You already have that version" is true
        and uninformative, and on run-7 it was the whole disguise: she asked
        about her glasses and was moved off the earrings she had bought.
      */
      const target = asTarget(already);
      const dropped = readInstructions(predecessor?.instructions)
        .filter((step) => !target.instructions.includes(step));
      return selectAndReport(
        target,
        dropped.length > 0
          ? `That takes off ${joinClauses(dropped.map((step) => `“${step}”`))} — `
            + "you're on the version without it, and nothing was charged."
          : "You already have that version — nothing charged.",
      );
    }
  }
  /*
    The realizations this stack has already established, IN WORDS (D-152).

    Carried from the predecessor and extended once this render lands, which is
    what lets every render start one step from the sharp original — nothing is
    re-photographed, so nothing accumulates softness.

    **Minus every facet this instruction rewrites** (D-159). A caption is stated
    to the model as ALREADY TRUE, so a copper caption riding alongside a
    pastel-pink instruction is not stale information — it is a contradiction in
    which the fact-shaped half wins. Dropped here, before anything is composed,
    so no later step can forget to.
  */
  /*
    THE CEILING GATES THE RENDER, NOT THE BOX (D-163).

    It used to fire before the instruction was even read, so a face at the
    ceiling could not be UNDONE — the one thing someone at the ceiling is most
    likely to want, refused for being a refinement it is not. Only a chain that
    grows is capped.
  */
  if (existing.length >= MAX_INSTRUCTIONS && instructions.length > priorInstructions.length) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "That face has as many refinements as it can carry. You can still undo or take "
        + "one out. Nothing was charged.",
    });
  }

  /*
    A REMOVAL REWRITES FACETS TOO — the ones it took away (D-163).

    The removed step's facets either revert to the original or fall to a
    surviving step, and either way the caption describing what they looked like
    with that step in place is no longer true. Same law as an edit's: a caption
    that outlives its facet is a contradiction stated as fact.
  */
  const writtenFacets = editDelta ? facetsWrittenBy(editDelta) : removedFacets;
  const carriedCaptions: RealizationCaptions = dropFacets(
    readCaptions(predecessor?.internalPrompt),
    writtenFacets,
  );
  /*
    THE BASE'S OWN PRESENTATION, NAMED ONCE (D-186).

    Her hair was pinned up in the base and came back worn down, because nothing
    anywhere ever said it was up — captions describe facets an INSTRUCTION
    touched, and the tail's "worn the same way" names no value for the model to
    reproduce or the net to check.

    Read from the BASE, which never changes, so this is one call for the life of
    a candidate rather than one per render. Skipped entirely once the chain has
    a pin, and skipped for a facet this instruction is about to write.
  */
  /*
    A PIN THE INSTRUCTION HAS JUST MADE FALSE GOES FIRST (D-187).

    "Change her hair to a blunt bob" was refused twice in the first live trial
    because the render was measured against "hair tied back, up" — a fact the
    cut had just retired. Superseding by the same facet is not enough.
  */
  for (const stale of presentationInvalidatedBy(writtenFacets)) delete carriedCaptions[stale];

  /*
    AND A PIN THE VOCABULARY DOES NOT RECOGNISE GOES TOO (D-238).

    Free-text pins predate the closed arrangement list, and they are the exact
    strings that cost `hairWorn` two 25% scores on hair that never moved:
    "worn natural, loose" against a tight crop is an argument, not a fact.
    Deleted rather than translated — the capture below then re-reads the value
    from the MASTER, because the picture is what knows.
  */
  /*
    …AND NEVER A FACET THIS CHAIN ITSELF DELIVERED (founder finding #4).

    `facetsWrittenBy(composed)` is every facet the accumulated recipe names —
    the facets she has paid to change on this branch. A caption for one of
    those describes a frame she is looking at, and retiring it sends the
    capture below to the MASTER, which is the one image guaranteed not to
    contain her edit. That is how "wear her hair down" came back with the hair
    up, stated to the painter as an already-true fact in the same prompt.
  */
  const deliveredByChain = facetsWrittenBy(composed);
  for (const unowned of unconstrainedPresentationPins(carriedCaptions, deliveredByChain)) {
    log.info({ facet: unowned }, "[refineService] retiring a pin from before the vocabulary");
    delete carriedCaptions[unowned];
  }

  /*
    AND IT IS NOT RE-CAPTURED EITHER (D-187, completing the fix).

    Retiring the pin was half of it. On the FIRST edit of a chain there is no
    pin to retire, so "change her hair to a blunt bob" read the base, captured
    "up, in bun", and handed the render an ALREADY TRUE clause contradicting the
    instruction in the same prompt — D-183's lying pin, arriving by a different
    door. A fact this edit is about to invalidate must not be born.
  */
  const invalidated = new Set(presentationInvalidatedBy(writtenFacets));
  /*
    THE FRAME SHE IS STANDING ON, NOT THE ONE SHE STARTED FROM (fable-118 (a3)).

    Reading the master is correct exactly ONCE — at the head of a chain, where
    it is the only picture of her there is. Mid-chain it is the wrong witness:
    every edit she has bought since is missing from it, so a pin read there
    describes a face she has already paid to change, and states it as fact.
    The anchor is the variant she was looking at when she asked.
  */
  const baseKeyForPresentation = predecessor?.imageKey ?? source.candidate.imageKey;
  if (
    baseKeyForPresentation
    && PRESENTATION_FACETS.some((facet) =>
      !carriedCaptions[facet] && !writtenFacets.has(facet) && !invalidated.has(facet))
  ) {
    try {
      const baseBytes = await (dependencies.readBytes ?? storageReadBytes)(baseKeyForPresentation);
      const captured = await capturePresentation({
        bytes: baseBytes.bytes,
        contentType: baseBytes.contentType,
        engine: dependencies.verifier,
      });
      for (const [facet, value] of Object.entries(captured)) {
        const target = facet as Facet;
        if (!writtenFacets.has(target) && !invalidated.has(target)) {
          carriedCaptions[target] = value;
        }
      }
    } catch (error) {
      /* Fails soft, like every other realization read: no pin is the state this
         shipped in for a milestone, and it costs precision rather than money. */
      log.warn({ err: error }, "[refineService] could not pin the base's presentation");
    }
  }
  /*
    WHICH FACETS THE NEW RENDER SHOULD BE READ BACK FOR.

    For an edit, the ones it wrote. For a removal, only those a SURVIVING step
    still writes — a copper that outlives a removed pink is being re-rendered
    and deserves a fresh caption, while a facet no survivor writes has reverted
    to the original and must not be captioned at all (D-152: captioning what the
    original already establishes is how the words quietly replace the reference).
  */
  const composedFacets = facetsWrittenBy(composed);
  const captionFacets = editDelta
    ? writtenFacets
    : new Set(Array.from(removedFacets).filter((facet) => composedFacets.has(facet)));

  /*
    COMPOSE-COMPLETENESS, checked BEFORE anything is claimed (D-143).

    Running it here rather than at render time means an instruction that cannot
    survive composition costs the user nothing — the roll's compile-and-admit-
    first arrow, applied to the defect that let a colour edit annihilate a cut.
  */
  /*
    ONE COMPOSITION, CHECKED AND SENT (D-166).

    The preview used to be `composeEditPrompt` alone while the render sent that
    plus the caption clause, so D-143's guard was verifying a string the model
    never saw — D-143's own failure mode, inside D-143's implementation.

    And `missingFromPrompt` is a SUBSTRING check, so now that the tail names
    facets it could "find" a filed value in the PROTECTION rather than in the
    instruction and rubber-stamp a prompt that never asked for the thing. It
    runs against the edits lane alone, which makes that impossible rather than
    unlikely.
  */
  /*
    WHAT THIS RENDER WILL PASTE INSTEAD OF ASKING FOR (segment permanence).

    # The defect this ends, found on the first production walk

    The store was armed, the rows were written, and every render still re-rolled
    every earlier facet — her freckles arrived on step 1, vanished on step 2 and
    step 3, and came back on step 4 by luck. Two independent reasons, and BOTH
    had to go:

    1. The carried set was computed against `facetsAnsweredBy(composed)` — the
       ACCUMULATED recipe — so every facet that could be carried was disqualified
       as "one this edit writes". A segment only ever exists for a facet the
       recipe names, so the exclusion was total by construction. The right notion
       was three hundred lines above it the whole time: `writtenFacets`, which
       the caption machinery has used since D-163.
    2. Even carried, the prompt still ASKED for the facet, so the painter
       repainted it and the fresh paint — applied last, by design, because the
       current ask outranks every memory — won the pixels straight back.

    So the ask narrows here, on the recipe, before a string is composed: the
    facets whose pixels are about to be pasted are removed from what the painter
    is told. §13 of the design: *"the thing to remove is not the guards, it is
    the words."*

    Read BEFORE the claim, so a store we cannot read refuses free — and read
    ONCE, with the rows handed down to the composite, so the prompt and the
    paste can never disagree about what is being carried.
  */
  const carriedRows = await listCarriedRows({
    userId: input.userId,
    candidateId: source.candidate.id,
    /* The branch she is looking at, not the newest — fable-091's fork rule. */
    anchorVariantId: predecessor?.id ?? null,
    writing: Array.from(writtenFacets),
  });
  const facetsToCarry = new Set<Facet>(carriedRows.map((row) => row.facet as Facet));
  const asked = withoutFacets(composed, facetsToCarry);

  const preview = composeRenderPrompt(asked, EDIT_PROSE, carriedCaptions);
  /*
    AND THE CLAUSE IS GONE FROM THE STRING, not just from the object (D-143's
    own discipline, pointed at the new subtraction).

    Empty by construction — `withoutFacets` cleared these lanes — and asserted
    anyway on the PRODUCED PROMPT, exactly like the contradiction check below.
    The whole finding this shift was a subtraction everyone assumed and nothing
    measured, and a carried facet still named in the prompt is that defect
    resurrected: she would be charged for a re-roll of something she already
    owns, and the paste would be overpainted.

    `missingFromPrompt` is the existing matcher, pointed at a recipe holding
    only the carried facets — every one of them must be missing.
  */
  if (facetsToCarry.size > 0) {
    /*
      MATCHED ON THE CLAUSE, NOT ON THE WORD (fable-105).

      The first form of this asked whether the carried facet's VALUE appeared
      anywhere in the produced string, and a legitimate sentence tripped it: her
      kept `marks` reads "freckles", and "a bronzer that mimics freckles" is an
      ask about her cheeks that happens to say the word. That refusal is a wall
      in front of a real request, and the specimen is pinned in the suite.

      A genuine leak has a shape: the facet's own HEADING, carrying a value, in
      the ask lane — `MARKS: freckles…`, the same `HEADING: value` form the D-87
      sweep looks for. The bronzer sentence composes no MARKS clause, because
      bronzer files as makeup. A regression that re-adds the carried clause is
      caught exactly as before.
    */
    const stillAsked = Array.from(facetsToCarry).filter((facet) => {
      const heading = facetHeading(facet).toLowerCase();
      /* The clause opens a lane: the heading, then its colon. Compared on the
         lowered string so a heading's own casing cannot decide a refusal. */
      return preview.edits.toLowerCase().includes(`${heading}:`);
    });
    if (stillAsked.length > 0) {
      log.error(
        { stillAsked, carried: Array.from(facetsToCarry) },
        "[refineService] a carried facet is still being asked for — refusing rather than paying to re-roll kept pixels",
      );
      throw spokenError({
        code: "PRECONDITION_FAILED",
        message: "That edit would have re-done something this face already keeps, so it was "
          + "refused rather than rendered. Nothing was charged.",
      });
    }
  }
  const dropped = missingFromPrompt(asked, preview.edits);
  if (dropped.length > 0) {
    log.error({ dropped }, "[refineService] composition would drop filed facts — refusing");
    throw spokenError({
      /* PRE-CLAIM, so the code says so: nothing was reserved and nothing can be.
         `INTERNAL_SERVER_ERROR` is the bucket unhandled crashes land in, and it
         is exactly why the client could not trust this sentence. */
      code: "PRECONDITION_FAILED",
      message: "That edit would have quietly dropped one of your earlier changes, so it was "
        + "refused rather than rendered. Nothing was charged.",
    });
  }
  /*
    THE SAME CHECK, POINTED THE OTHER WAY (D-159).

    D-143 proves every filed fact REACHES the prompt. This proves nothing that
    stopped being true reaches it — the founder's own framing, that a superseded
    caption is the same crime as a dropped instruction. It is a construction
    check rather than a plausible failure: `dropFacets` above already removed
    these. That is the point. The whole reason recipe v3's memory sat dead for a
    day is that nothing asserted the thing everyone assumed.
  */
  const stale = staleCaptions(carriedCaptions, writtenFacets);
  if (stale.length > 0) {
    log.error({ stale }, "[refineService] a superseded caption survived — refusing");
    throw spokenError({
      code: "PRECONDITION_FAILED",
      message: "That edit would have argued with one of your earlier changes, so it was "
        + "refused rather than rendered. Nothing was charged.",
    });
  }
  /*
    AND THE TEMPLATE MUST NOT ARGUE WITH THE INSTRUCTION (D-166).

    Empty by construction — the tail is built by subtracting the edited facets.
    Asserted anyway, because the category table is hand-authored prose and the
    entire finding this round was a hand-authored string quietly disagreeing
    with the machine for days while every driver stayed green.
  */
  const contradicted = contradictedFacets(preview, asked);
  if (contradicted.length > 0) {
    log.error({ contradicted }, "[refineService] the tail would protect an edited facet — refusing");
    throw spokenError({
      code: "PRECONDITION_FAILED",
      message: "That edit would have asked for a change and forbidden it in the same breath, "
        + "so it was refused rather than rendered. Nothing was charged.",
    });
  }

  /*
    THE ALREADY-TRUE GATE, and this is its CALL SITE (founder ruling, 2026-08-07).

    Fourth member of the refuse-before-dispatch family — absent, silhouette,
    occluded, already-true — and the only one that could be answered from a
    picture we already hold.

    She asks for eyes that sweep up and her eyes already sweep up. Rendering that
    spends 25 credits to produce the face she is looking at, and then asks a
    reader whether it complied, which is how a false pass is manufactured. The
    honest answer is a QUESTION, and asking it is free.

    **It sits before `admit` so nothing has been claimed**, alongside every other
    free refusal in this function.

    Four conditions, each load-bearing:

      THIS ASK     the gate answers the sentence in front of it, and it read
                  the COMPOSED recipe instead — which carries every earlier
                  step forever. Run-8 is the exhibit: once "fox eyes" was
                  delivered at step 2, `composed.eyeShape` stayed upswept, so
                  "add nude lip gloss" and "gold hoop earrings" were BOTH
                  intercepted with *"Her eyes already sweep up at the outer
                  corners. Push them further, or leave her as she is?"* — and
                  the chips offered were "More tilt" and "Never mind". A
                  customer who buys an eye edit could not then buy anything
                  else: every later sentence came back as a question about her
                  eyes, and the fifth step was consumed answering it.

                  Same shape as the prune defect fixed earlier the same day —
                  a decision keyed on the record rather than on the
                  instruction — and the record is exactly where past asks
                  outlive their moment.
      DIRECTION   only an upswept ask. "Downturned" wants the opposite and
                  "hooded" is about the lid, and a gate firing on those would
                  refuse the very edit a high-baseline face most needs.
      MEASURED    both rungs of the tilt ladder, master-anchored. A single rung
                  goes blind exactly on narrowed eyes, so it would under-report
                  the faces this is about.
      SILENT MEANS SPEND  a no-read never fires the gate. Refusing costs a
                  customer the picture they asked for, and that asymmetry runs
                  the same way as D-235's: silence resolves toward the outcome
                  that does not take something away from her.

    Scoped to the masked path, because that is where the eye.shape row lives and
    every other account is still on exactly the behaviour it had.
  */
  /* THIS step's own ask, never the composed recipe — `editDelta` is what this
     sentence wrote, and a removal writes none of it. */
  const asksUpsweptNow = editDelta != null && isUpsweptAsk(editDelta.eyeShape);
  if (!answered && asksUpsweptNow && maskedEditingEnabledFor(input.userId)) {
    /*
      WHY THE BYTES ARE HOISTED OUT OF THE READING.

      The tilt read and the glasses read are two questions about the SAME
      picture, and fetching it twice would be two chances to disagree about
      which face we are talking about — the record-versus-pixels mistake in its
      cheapest form. One fetch, two questions, one answer about one face.
    */
    const faceBytes = await (async () => {
      try {
        const key = source.imageKey ?? source.candidate.imageKey;
        if (!key) return null;
        return await (dependencies.readBytes ?? storageReadBytes)(key);
      } catch (error) {
        log.warn({ error: String(error).slice(0, 120) }, "[refineService] her picture is unreadable — not gating");
        return null;
      }
    })();

    const reading = await (async () => {
      try {
        /*
          THE FACE SHE IS ACTUALLY LOOKING AT, not the one she started from.

          This read `source.candidate.imageKey` — her BASE — while the removal
          path three hundred lines above reads `source.imageKey ?? …` and says
          in as many words that asking the wrong picture is "the
          record-versus-pixels mistake wearing a new hat". This gate shipped
          the same day and made it anyway: on a chain that had already changed
          her eyes, it would measure the tilt of a face nobody is looking at
          and refuse — or fail to refuse — on the strength of it.
        */
        /* No picture, no reading — and a no-read never refuses, so this falls
           through to spending exactly as an unreadable face does. Asserting the
           key non-null with `!` would be claiming something the type says is
           not true, on the one path whose whole job is to decline safely. */
        if (!faceBytes) return null;
        return await readCanthalTilt({ image: faceBytes.bytes, reader: dependencies.regions ?? defaultRegionReader() });
      } catch (error) {
        /* An instrument that cannot answer must not be able to refuse. */
        log.warn({ error: String(error).slice(0, 120) }, "[refineService] tilt unreadable — not gating");
        return null;
      }
    })();
    if (reading && alreadyUpswept(reading)) {
      log.info(
        /* The value the DECISION was made on, not the recipe's — they agree
           today only because the gate now requires this step to have written
           it, and a log that reads the other one would go quietly wrong the
           moment that stopped being true. */
        { meanDeg: Number(reading.meanDeg.toFixed(2)), asked: editDelta?.eyeShape },
        "[refineService] already-true — asking instead of spending",
      );
      /*
        A QUESTION, IN THE SHAPE THE PRODUCT ASKS QUESTIONS IN.

        This was a thrown `BAD_REQUEST` carrying the sentence, which put a
        question into the refusal channel: no chips, and — because
        `pendingReaskFor` had never heard of it — no way for an answer to come
        back. The founder's condition on shipping the sentence form is that it
        must never dead end, and that was exactly what it did.

        `kind: "asked"` is free by construction here: it returns above `admit`
        and above the claim, so nothing is reserved and nothing is charged.
      */
      return {
        kind: "asked",
        reask: alreadyUpsweptReask(instruction),
        variantId: source.variantPublicId,
        candidateId: input.candidatePublicId,
        imageUrl: storagePublicUrl(source.imageKey ?? source.candidate.imageKey),
        instructions: readInstructions(predecessorForParse?.instructions),
      };
    }

    /*
      AND WHEN THE MEASUREMENT COULD NOT BE TAKEN AT ALL.

      The gate above can only protect a face it can read. Measured 2026-08-09:
      the tilt reads on 6 of 6 bare faces and 4 of 8 bespectacled ones — so on
      a woman in glasses the protection is, about half the time, silently
      unavailable, and she is charged 25 credits for an eye edit that may be a
      no-op. A measurement that cannot be made was falling through to the
      branch that spends.

      **Two conditions, both required**, and the second is the safety one: the
      reading failed, AND the picture shows frames over her eyes. A no-read on
      a bare-eyed face keeps exactly today's behaviour, because this gate may
      only ever ADD a free question — never block someone the old path served.

      **The glasses are asked of the PIXELS, not of the record.** The record
      says what was ASKED; the picture says what EXISTS, and frames that came
      with her face were never in anybody's instruction, so `statedAccessories`
      is empty for precisely the customers this protects. A record-keyed gate
      would be inert in its own population.

      **Fail-closed to today's behaviour in every direction**: no bytes, no
      segmenter, a non-picture, a thrown reader — all of them fall through and
      spend, exactly as before. The only new outcome is a free question.

      **The glasses are a CORRELATE used as a safety condition, not a proven
      cause**, and the code says only what was measured. The citation: the same
      woman's master read 2.0° with her frames on, three times, spread 0.0° —
      while a later frame of her, also bespectacled, would not read at all. So
      frames do not block the reading. What we know is that the reading failed
      and that there are frames over her eyes; the second clause is here to keep
      this gate off bare-eyed customers, not to explain the first.
    */
    if (!reading && faceBytes) {
      const wearingGlasses = await (async () => {
        try {
          const mask = await (dependencies.regions ?? defaultRegionReader())
            .region({ image: faceBytes.bytes, name: "glasses", absentIsAnswer: true });
          return wearsGlassesByPixels(mask);
        } catch (error) {
          /* An instrument that cannot answer must not be able to ask, either. */
          log.warn({ error: String(error).slice(0, 120) }, "[refineService] glasses unreadable — not asking");
          return false;
        }
      })();
      if (wearingGlasses) {
        log.info(
          { asked: editDelta?.eyeShape },
          "[refineService] her eyes are behind frames and did not read — asking instead of spending",
        );
        /* Free by construction, like its sibling: returns above `admit` and
           above the claim, so nothing is reserved and nothing is charged. */
        return {
          kind: "asked",
          reask: glassesHideEyesReask(instruction),
          variantId: source.variantPublicId,
          candidateId: input.candidatePublicId,
          imageUrl: storagePublicUrl(source.imageKey ?? source.candidate.imageKey),
          instructions: readInstructions(predecessorForParse?.instructions),
        };
      }
    }
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

  /* ---- the claim ---- */

  const gate = await (dependencies.begin ?? beginDirectOperation)({
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    kind: "castingV2.refine",
    payload: {
      candidatePublicId: input.candidatePublicId,
      instruction: instruction.trim(),
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
      stepDeltas,
      /*
        WHAT THEY TYPED, kept apart from the recipe (D-163).

        For an edit these agree. For a REMOVAL they must not: the removal
        sentence is deliberately absent from `instructions`, because removal is
        memory surgery — so without this the in-flight ghost chip would show the
        last SURVIVING sentence while the user waited on "remove the earrings".
      */
      requestText: instruction.trim().slice(0, 220),
      /*
        THE BRANCH SHE IS ON (fable-091). The selected face, which is already
        the predecessor everything above reasons from — recorded so the segment
        store can answer "what does THIS version keep" per branch instead of
        from one global live-list. A fork from an older edit must not inherit a
        newer one's glasses.

        **Only while the store is armed**, and only then does the column get
        named at all (see `claimVariant`). The lineage exists to be read by the
        store; recording it while the store is dark would buy nothing and would
        put a brand-new column into the one INSERT every paid refinement runs.
      */
      parentVariantPublicId: captureCastingSegmentsEnabled(input.userId)
        ? predecessor?.publicId ?? null
        : null,
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
    /*
      THE MASTER'S EXACT PIXELS, read from the master itself — and read LAZILY,
      because only the masked path needs them.
    
      The masked engine is told this rather than a resolution tier, because a
      tier is what produced 848x1264 for a 1024x1536 master: the right aspect,
      an engine's own cap, and nothing the composite can use. Everyone off the
      masked path should not pay a decode for a number they never consult — and
      more to the point, should not gain a new way to fail.
    */
    const masterSize = async () => {
      const sharp = (await import("sharp")).default;
      const meta = await sharp(base.bytes).metadata();
      if (!meta.width || !meta.height) {
        throw new ProviderError("capability", "could not read the master's dimensions to pin the render size");
      }
      return { width: meta.width, height: meta.height };
    };
    /*
      RENDER RECIPE v3 (D-152) — ONE step from the sharp original, always.

      v2 carried the selected PARENT as a realization pin, which held the facets
      and quietly cost quality: conditioning on a parent inherits its softness,
      tone-crush and vignette once per generation, so six edits deep the picture
      is visibly blurred while every facet is perfectly intact. Photocopy loss.

      So realizations travel as WORDS now. The parent's pixels are not in the
      frame at all, which means there is no chain for softness to accumulate
      along — and it makes restatement idempotent, because copper is no longer
      being re-dyed onto already-copper pixels.
    */
    /*
      WALL (d), STRUCTURALLY (D-131). The prompt is composed from what was
      PERSISTED, re-validated, never from the in-memory object that happens to
      match it — so a filing failure degrades to filed-but-not-rendered, which
      the sweep can see, and never to rendered-but-not-filed, which nothing can.
    */
    const filed = readDelta(variant.deltas);
    if (!filed) throw new Error("the refinement was not recorded in a readable shape");
    const engine = (dependencies.engine ?? castingIdentityEngine)();
    /*
      Composed from the PERSISTED row — wall (d) — with the SAME builder the
      pre-claim check used, so the check and the render can no longer disagree
      about the shape of the string.

      They used to. The preview was the edits alone while the render sent edits
      plus captions, which meant D-143's completeness guard was verifying a
      prompt the model never saw — D-143's own failure mode, inside D-143's
      implementation.

      Equality with the preview is deliberately NOT asserted. Wall (d) exists
      precisely so that the ROW wins when the two differ: a filing failure must
      degrade to filed-but-not-rendered, which something can see, rather than to
      rendered-but-not-filed, which nothing can. What IS re-asserted is the
      property that matters on the string actually being sent.
    */
    /*
      THE SAME SUBTRACTION, ON THE PERSISTED ROW — wall (d) again.

      The pre-claim preview narrowed the ask against `composed`; this narrows
      the ROW, which is the thing actually sent. One list of carried facets,
      decided once above, used in both places and handed to the composite — so
      the prompt, the mask and the paste cannot hold three different opinions
      about what this face is keeping.

      When nothing is carried — a dark store, a first edit, a fork with no
      ancestry — `withoutFacets` returns the recipe unchanged and every line
      below behaves exactly as it did before segments existed.
    */
    const askedFiled = withoutFacets(filed, facetsToCarry);
    /*
      WHERE THIS ASK LIVES ON HER FACE (law 8, fable-103's table ruling).

      `makeup` is one facet over several places: a lip gloss lives on lips, a
      foundation on the whole complexion. It mapped to `face skin` whatever it
      said, so the walk's lip gloss claimed her entire face and — under the
      surrender rule, correctly — took the freckles she had paid for one render
      earlier with it.

      Derived ONCE here and handed to both the harvest and the store, because
      the crop is keyed by region name: two derivations that disagree file a
      segment against a mask that does not exist.
    */
    /*
      WHAT THE INSTRUCTION SAID THE OBJECT IS — derived once, three consumers.

      It used to be computed inline at the harvest call. That was fine while the
      harvest was the only thing that needed it; it is not, now that the corridor
      it places has to be findable again by name. The placement, the segment
      cutter's lookup and the painter's own clause all have to name the same
      kind of object, and three inline derivations of one string is how they come
      to disagree about whether an ask is about ears or eyes.
    */
    const describedAccessories = itemsOf(composed.free?.statedAccessories).join(" ") || undefined;
    /* Through the shared table's longest-match rule, never a scan of the words
       here — "a small nose stud" contains "stud", and first-match put it on her
       earlobe once already. */
    const accessoryRegion = describedAccessories ? accessoryKindOf(describedAccessories) : null;
    const regionOverrides: Partial<Record<Facet, string>> = {
      ...(askedFiled.makeup ? { makeup: makeupRegionFor(askedFiled.makeup) } : {}),
      /*
        AND WHERE AN ACCESSORY LIVES (the accessory corridor, fable-120 half 1).

        `statedAccessories` has no `REGION_OF_FACET` entry and cannot have one:
        the region depends on the described OBJECT, not on the facet — an earring
        is at the lobe and glasses are at the eyes. So the harvest builds the
        corridor from the landmark table and now files it under this same kind
        id, and this override is what points the segment cutter at it.

        Without it `regionNameOf("statedAccessories")` is null, the cutter files
        nothing, and every earring the product has ever delivered is re-rolled
        from words on the next render — which is how one gold hoop moved from her
        left ear to her right between v#156 and v#157.
      */
      ...(accessoryRegion ? { statedAccessories: accessoryRegion } : {}),
    };
    const composedPrompt = composeRenderPrompt(askedFiled, EDIT_PROSE, carriedCaptions);
    const filedContradictions = contradictedFacets(composedPrompt, askedFiled);
    if (filedContradictions.length > 0) {
      log.error(
        { operationId, variant: variant.publicId, filedContradictions },
        "[refineService] the filed row composes a self-contradicting prompt — refusing",
      );
      throw new Error("the filed refinement would forbid the change it asks for");
    }
    const prompt = composedPrompt.full;

    /*
      THE NEW COMPOSITOR (D-241), dark behind `CASTING_REPAINT_SCOPE`.

      The old road below renders, harvests a region, pastes the delivered pixels
      onto the master and blends the join. This one has no join: it assembles a
      recipe from the cast's own library — master plus a cropped reference of
      every delivered feature, each named, with its full word stack — dispatches
      ONE paint, and **the frame the engine returns is the delivered frame**.
      Nothing is composited into it, so there is no seam to measure and no
      composite fault to refuse on.

      # It REFUSES into the refund rather than painting something else

      Three doors can say no — the ask this product cannot yet say declaratively
      (`repaintAsks`), the recipe D-244 forbids (`assembleRecipe`), and a
      reference whose bytes have moved since the library minted them
      (`repaintRender`). Every one of them throws into the request's own catch,
      which refunds the whole price. A recipe we could not assemble honestly
      must not become a picture somebody paid for — and `referenceBytesChanged`
      in particular means the library and storage have diverged, which is
      exactly when painting anyway would be worst (fable-281 (b)).

      # What it deliberately does NOT produce

      No `evidence`. That is not an omission: the harvest's masks exist to scope
      a PASTE, and nothing is pasted. Two things downstream read it and both are
      already correct without it — `keepSegmentsFromRender` returns
      `nothing-to-keep` with no evidence (the old carrier retiring by
      construction rather than by anyone remembering to skip it), and the mint
      reads `applied ?? wholeFrame`, which is the honest answer when the whole
      frame was painted. The mint's REGION source is the declared shortfall: with
      no harvest map it files words rather than crops, and the fresh
      delivered-frame read that closes it lands before the flag is flipped for
      anybody (opus-227 §3, fable-281).
    */
    const repaintEnabled = (dependencies.repaintEnabled ?? captureCastingRepaintEnabled)(
      input.userId,
    );
    const repaintOnce = async () => {
      /*
        THE BRANCH'S ROWS ARE READ BEFORE THE ASKS ARE BUILT (fable-318 R2).

        They used to be read after, because the asks were a function of the step
        alone. They are not: a slot whose newest crop the door refused has to be
        re-said in WORDS by this render, and only these rows know which slots
        those are. Read once and used twice — the same list derives the library
        below, so the asks and the library cannot disagree about the face.
      */
      const branchRows = await listLineageReferences({
        userId: input.userId,
        candidateId: variant.candidateId,
        anchorVariantId: variant.id,
      });
      const asks = editDelta
        ? repaintAsksFor({
          delta: editDelta,
          /* The prose the prompt above is composed with, handed over rather
             than copied: one definition of what "copper" looks like. */
          prose: EDIT_PROSE,
          /* Derived once at the top of this block, beside the region override
             that has to name the same object. */
          accessoryKind: accessoryRegion,
          /*
            AND WHAT THE LIBRARY CANNOT PICTURE, SAID IN WORDS INSTEAD.

            `composed` rather than `editDelta`: the point of a restoration is to
            say what she is currently wearing, which this step said nothing
            about. A slot only appears here when its newest version has no
            pixels, so on an ordinary face the list is empty and not one line of
            this changes the recipe.
          */
          restore: { state: composed, slots: supersededCarrySlots(branchRows) },
        })
        : repaintCannotRemove();
      if (!asks.ok) {
        log.error(
          { operationId, variant: variant.publicId, reason: asks.reason, facet: asks.facet },
          "[refineService] the repaint cannot say this ask declaratively — refusing rather than painting a recipe that never mentions it",
        );
        throw new Error(`the repaint cannot express this ask: ${asks.detail}`);
      }
      /*
        The library as it stood when this render started. The anchor is this
        variant — its own rows do not exist yet, so the walk climbs its parents
        — which is the same anchor the mint's duplicate check uses below, and
        for the same reason.
      */
      /*
        AND THE EDITED SLOTS GIVE UP THEIR CROPS BEFORE THE RECIPE SEES THEM.

        D-244 line 2: a feature's own crop never rides in its own edit. The
        assembler REFUSES such a recipe (`carriesItsOwnEdit`) rather than
        quietly dropping the crop, and its comment calls that branch "the defect
        the law makes unreachable" — but nothing was making it unreachable. This
        line passed the derived library through whole, `deriveLibrary` sets
        `carry` for any slot whose newest live row has a crop, and every one of
        the founder's production rows is a carry row. So the SECOND edit of any
        slot refused and refunded: driven on his own library, *"wear her hair
        down"* was refused on both faces (opus-238).

        The crop goes; the WORDS and the ANCHOR stay. An edit regenerates from
        its anchor plus the feature's full word stack, and that stack is what the
        library holds — dropping the entry entirely would lose everything ever
        said about the feature, which is the same over-correction
        `deriveLibrary` warns about one layer down.
      */
      const editedSlots = new Set(asks.asks.map((ask) => ask.slot));
      const library = libraryWithoutEditedCrops(deriveLibrary(branchRows), editedSlots);
      const recipe = assembleRecipe({
        /* The master is the base this render is anchored on, by key. Every
           render is `edit(original, …)` and `claimVariant` proved that base
           inside the statement that proved the parent, so this cannot be got
           wrong here. */
        master: { key: variant.baseImageKey },
        /* Never assumed: `segmentsOnFace` shipped "hers" onto a male
           candidate's face before pronouns were passed rather than guessed. */
        pronouns: pronounsForSex(currentIdentity?.sex),
        library,
        asks: asks.asks,
      });
      if (!recipe.ok) {
        log.error(
          { operationId, variant: variant.publicId, reason: recipe.reason, slot: recipe.slot },
          "[refineService] the recipe D-244 would have to build is one it forbids — refusing",
        );
        throw new Error(`the repaint recipe was refused: ${recipe.detail}`);
      }
      /*
        ONE DEFINITION OF THE RECORD, written at two moments.

        At DISPATCH it is the only account a refused render will ever leave; at
        the LANDING it rides the row beside the verification. Building it twice
        would let the two describe different requests, which is the drift law 4
        exists for — so the shape is here, once, and both callers pass the same
        `sent` object through it.
      */
      const recordOf = (sent: SentRequest) => ({
        engineId: sent.engineId,
        /*
          THE SENTENCE, TAKEN FROM THE DISPATCH AND NOT FROM THE RECIPE BESIDE IT
          (fable-320 §4).

          The record already answered "what did we actually send" for every
          reference, by key and by digest, and it was silent about the only
          other thing in the request. Shift 62 is what that costs: a removal
          refused twice on the paid path, the same recipe removing her glasses
          eight times out of eight off it, and no way to compare the two
          because the sentence the painter read was nowhere. Getting it back
          took three attempts at a reconstruction and a control to know which
          attempt to believe.

          `sent.prompt` is the string `repaint()` hands to the transport, in the
          same object it hands over the keys and digests — so this is the wire
          value rather than a variable near it (law 5), and it is written on
          DISPATCH, which is the only moment a refused render has.
        */
        prompt: sent.prompt,
        references: sent.keys.map((key, at) => {
          const role = recipe.references[at]?.role;
          return {
            key,
            digest: sent.digests[at] ?? null,
            kind: role?.kind ?? null,
            slot: role && role.kind !== "master" ? role.slot : null,
          };
        }),
        edited: recipe.edited,
        carried: recipe.carried,
        /* WHAT THIS RENDER ASKED TO TAKE OFF. On the record because it is a
           fact about the request — and read back below, where it is the only
           licence the library has to retire a crop. */
        vacated: recipe.vacated,
        standing: recipe.standing.map((entry) => entry.slot),
      });

      const painted = await repaint({
        recipe,
        engine: (dependencies.repaintEngine ?? defaultMaskedEditEngine)(),
        /*
          BEFORE THE ENGINE IS ASKED, so a render that never comes back still
          says what it sent. `repaint()` hands over the same object it will
          return, with the digests of the bytes it has already loaded.
        */
        onDispatch: async (sent) => {
          await (dependencies.recordDispatch ?? recordVariantDispatch)({
            userId: input.userId,
            variantId: variant.id,
            repaint: recordOf(sent),
          });
        },
        /* The master's bytes are already in hand and are the bytes the rest of
           this request used; everything else is a library crop at its own key. */
        load: async (image) => (image.key === variant.baseImageKey
          ? { bytes: base.bytes, contentType: base.contentType }
          : await (dependencies.readBytes ?? storageReadBytes)(image.key)),
        /* The master's exact pixels — a repaint returns a frame of the same
           size, and a resolution TIER is what produced 848x1264 for a 1024x1536
           master once already. */
        ...(await masterSize()),
      });
      if (!painted.ok) {
        log.error(
          { operationId, variant: variant.publicId, reason: painted.reason, key: painted.key },
          "[refineService] a reference the library named is not the reference storage holds — refusing rather than repainting from it",
        );
        throw new Error(`the repaint refused its own references: ${painted.detail}`);
      }
      log.info(
        {
          operationId,
          variant: variant.publicId,
          engine: painted.sent.engineId,
          /* WHAT WENT OUT, in send order — the record answers "what did we
             actually send?" from the dispatch itself rather than from a
             reconstruction of it. */
          keys: painted.sent.keys,
          edited: recipe.edited,
          carried: recipe.carried,
          standing: recipe.standing.map((entry) => entry.slot),
        },
        "[refineService] repainted the whole frame from the master and her own references",
      );
      return {
        ...painted.frame,
        /* Named rather than omitted: a repaint pastes nothing, so there is no
           mask evidence, no carried-by-paste facet list, no assembly working
           and no seam verdict. Every consumer below already reads these with a
           default, and stating them here is what makes that deliberate. */
        evidence: undefined,
        carried: undefined,
        assembly: undefined,
        seam: undefined,
        /*
          WHICH COMPOSITOR MADE THIS PICTURE, ON THE PICTURE'S OWN ROW.

          Until this line the answer lived in one log entry on one process's
          stdout. Every other road leaves a mark a later reader can join on — a
          paste leaves `assembly`, a composite leaves `seam` — and the repaint,
          which is the road that spends the same money, left nothing at all. A
          row with no `assembly`, no `seam` and no `repaint` is indistinguishable
          from a plain full-frame render from before either existed, so "was this
          repainted, and from what?" was a question the database could not
          answer about a paid render.

          It is the SENT request that is recorded, not the recipe that was
          intended: `painted.sent.keys` and `.digests` are what `repaint()` put
          on the wire, in dispatch order, and the roles are zipped onto them from
          the recipe positionally because `repaint()` builds both lists in one
          pass over `recipe.references` (its own header makes that ordering a
          contract). The dimensions of each reference are deliberately NOT here:
          a key names an object, and an object's pixel size is read from the
          object. Recording a second copy of it would be the mirror law 4
          forbids.
        */
        repaint: recordOf(painted.sent),
      };
    };

    /* ONE definition of "render this", so a retry cannot quietly differ from
       the attempt it is retrying. */
    /*
      THE MASKED SEAM (the masked-editing workstream, shipped dark).

      The engine call does not change — full-frame context with local harvest is
      the standing rider, because the model needs the whole face to know what it
      is editing. What changes is what we KEEP from its answer: only the pixels
      inside the region that was asked about, composited into an otherwise
      untouched master.

      `MASKED_EDITING_ENABLED` is false, so today this returns the engine's own
      bytes byte-for-byte and does not even consult a segmenter. Everything below
      — the fault detector, the verification net, the retry, the refund — is
      untouched and does not know this exists.
    */
    const renderOnce = async () => {
      /*
        THE SWAP, and it is a whole road rather than a step inside this one.
        Everything below — the harvest, the carried-segment assembly, the seam —
        is the old compositor's machinery, and D-241 retires it rather than
        configuring it. Read once above, so a retry cannot cross roads.
      */
      if (repaintEnabled) return repaintOnce();
      /*
        THE ROUTING ROW THE FACE WALL ESTABLISHED, wired at last.

        Every render on the wall came from GPT Image 2 — founder's eye, seat's
        eye and the convergence arithmetic picked it independently for
        face-region edits. The product path was still calling the incumbent
        identity engine, so the wall was measuring one engine while production
        ran another. That gap is what produced an 848x1264 answer to a 1024x1536
        master: a resolution TIER instead of a size, and a cap the composite
        cannot use.

        Only the masked path routes here. Everyone else is on exactly the engine
        they were on.
      */
      const painted = maskedEditingEnabledFor(input.userId)
        ? await (dependencies.maskedEdit ?? defaultMaskedEditEngine)().edit({
          prompt,
          references: [{ bytes: base.bytes, contentType: base.contentType }],
          /* The master's exact pixels — the composite has no use for a size class. */
          ...(await masterSize()),
        })
        : await engine.editWithReferences({
          prompt,
          /* ONE reference, forever: the sharp original. */
          references: [{ bytes: base.bytes, contentType: base.contentType }],
          // 1K: a candidate's own resolution. The 2K tier belongs to signed views.
          resolution: "1K",
        });
      const harvested = await (dependencies.harvest ?? harvestRefinement)({
        master: { bytes: base.bytes, contentType: base.contentType },
        painted: { bytes: painted.bytes, contentType: painted.contentType },
        /*
          THE ANSWERED FACETS, and the distinction is load-bearing here (D-238).

          `facets` tells the mask-cutter what this render PUTS THERE: a facet
          whose zone scope is "object" takes the addition path, which anchors a
          landmark corridor from the described object. A departure has no
          described object — nothing survives on the subject to describe — so
          sending its facet here would ask for the landmark of nothing and refuse
          a render the painter could have carried out perfectly.

          A removal is not an addition of an absence. It travels in `departed`,
          which has its own territory rule: the object is ON the master, so the
          zone is its own footprint rather than a corridor. Two channels because
          they are two different questions about the picture.
        */
        /* The facets the painter was actually ASKED for — the carried ones were
           subtracted from the prompt above, and harvesting a region nobody was
           asked to change would cut a patch out of untouched master. */
        facets: Array.from(facetsAnsweredBy(askedFiled)),
        regionOverrides,
        reader: dependencies.regions ?? defaultRegionReader(),
        /* Per user, not per deploy — the first flip goes to one account. */
        userId: input.userId,
        /* What the instruction said the thing IS. An earring hangs from a lobe
           and glasses sit at the eyes, so the placement needs the words, not
           just the slot they landed in. Derived once above, beside the region
           override that has to name the same object. */
        described: describedAccessories,
        /* The thing that LEFT, which the pruned record cannot name. Without it
           an object removal asks no question at all, and with only `described`
           it asks about the SURVIVING accessory — a chain of earrings+glasses
           minus the glasses would harvest at her earlobes, which is the exact
           failure `LANDMARK_OF_ACCESSORY` was introduced to kill. */
        departed: departedFromPicture,
        operationId,
      });
      /*
        The composite's own working, carried to the verification step rather
        than re-derived there. What it proves is narrow and exact: outside
        `applied`, this picture IS the master, byte for byte — so a facet whose
        master region never meets `applied` has already been answered and does
        not need a stochastic reader rolled against it again.
      */
      /*
        AND WHAT SHE ALREADY HAS, PUT BACK (segment permanence, slice 1).

        Three sources in a fixed order — the master, then every kept segment
        whose facet this edit does not write, then the fresh paint last,
        because the current ask outranks every memory. Dark until the store is
        armed for her, and when it is dark this returns the harvest's own bytes
        unchanged, byte for byte.

        The refusal inside is deliberate and is the reason this is not
        wrapped in a `catch`: a face assembled from a list we could not finish
        reading looks exactly like a correct render, and she would simply find
        her freckles gone again on a picture she had paid for.
      */
      const assembled = await assembleWithCarriedSegments({
        userId: input.userId,
        candidateId: variant.candidateId,
        /* The branch, not the candidate: what the SELECTED face keeps. */
        anchorVariantId: variant.parentVariantId,
        /*
          WHAT THIS ASK WRITES — not what the recipe holds.

          This read `facetsAnsweredBy(composed)`, the accumulated recipe, and
          that single wrong noun made the whole architecture inert: a segment
          exists only for a facet the recipe names, so every carriable facet
          disqualified itself. `writtenFacets` is the notion the caption
          machinery has used since D-163 — an edit writes what IT says, plus
          what a removal took away.
        */
        writing: Array.from(writtenFacets),
        /* Decided before the prompt was composed, so the string and the paste
           agree by construction rather than by two queries agreeing. */
        rows: carriedRows,
        master: { bytes: base.bytes, contentType: base.contentType },
        harvested,
      });

      /*
        The composite's own working, carried to the verification step rather
        than re-derived there. What it proves is narrow and exact: outside
        `applied`, this picture IS the master, byte for byte — so a facet whose
        master region never meets `applied` has already been answered and does
        not need a stochastic reader rolled against it again.
      */
      return {
        ...painted,
        bytes: assembled.bytes,
        contentType: assembled.contentType,
        evidence: assembled.evidence,
        carried: assembled.carriedFacets,
        /*
          THE ASSEMBLY'S OWN WORKING, KEPT ON THE ROW (fable-109).

          A carried fact cannot be adjudicated by a reader — the freckles this
          architecture pastes sit at the reader's own floor, and it called them
          absent three times on a frame that provably contains 20,036 of their
          24,056 pixels. The instrument that CAN judge them is arithmetic: every
          pixel the segment owns is either byte-identical in the delivered frame
          or accounted for by a recorded intersection.

          That judgement needs the intersections, and they only existed in a log
          line — so the walk could never adjudicate itself, and a log is not an
          artifact a report can be derived from. They ride the row now, beside
          the verdict, where the reliability report already looks.
        */
        assembly: assembled.assembly && {
          segmentsApplied: assembled.assembly.segmentsApplied,
          intersections: assembled.assembly.intersections,
          superseded: assembled.assembly.supersededCandidates,
          excluded: assembled.assembly.segmentsExcluded,
        },
        /*
          AND THE SEAM VERDICT, FOR THE SAME REASON, ON EVERY RENDER (fable-119).

          The seam check has been running in SHADOW on edge-moving classes since
          it shipped, and the shadow produced a log line that fired only when it
          found something — a sample of failures with no denominator, which is
          why the flip decision has spent four shifts resting on three
          anecdotes. It rides the row now, torn or clean, enforced or shadow.

          `coherence` beside it is the statistic the tear bar cannot express:
          the founder traced a visible seam on a frame this detector scored
          `torn: false`, and in his band it is 0 pixels over the bar with a
          consistent -10 luma offset along the whole edge. Recorded and acted on
          by nothing — one specimen is not a calibration.
        */
        seam: harvested.seam,
        /*
          NAMED, NOT OMITTED — the mirror of the four `undefined`s the repaint
          branch declares above. A paste has no recipe, and saying so here is
          what lets `image.repaint` be read at the landing without the union
          type hiding one road's field from the other.
        */
        repaint: undefined,
      };
    };

    /*
      THE FACTS THIS PICTURE HAS TO CONTAIN (D-185).

      Every named facet of the COMPOSED recipe, not only the ones this edit
      wrote — the eye colour that went missing on the founder's chain had been
      written a step earlier and was merely being carried, so a check scoped to
      "what changed" could never have seen it.
    */
    /*
      BINDING vs ADVISORY (D-187), and the first live trial is why.

      A GUARANTEED value — "green", "copper", a named cut — is a word this
      program defines, so the reader can be held to it and a failure is worth a
      refusal. A FREE-LANE value is the user's own words: asking a reader
      whether greenish-hazel is *distinctly* "seafoam green" is asking it to
      arbitrate a shade nobody has defined, and it refunded six legitimate
      renders that way in eighteen attempts.

      Both are checked and both are recorded — the record is the instrument for
      exactly this kind of finding. Only the defined kind spends a refusal.
    */
    const guaranteedFacets = new Set(
      REFINABLE_AXES.filter((axis) => composed[axis] != null).map((axis) => facetOfAxis(axis)),
    );
    /* Typed from the reader's own input shape rather than inferred from the
       first element, so a fact carrying a `shortfall` is not a stranger to the
       array it lives in. */
    const facts: Parameters<typeof verifyRender>[0]["facts"][number][] =
      Array.from(facetsWrittenBy(composed)).flatMap((facet) => {
        const asked = currentIdentity
          ? currentValueOfFacet(applyDelta(currentIdentity, composed), facet)
          : null;
        if (!asked) return [];
        /*
          PRESENCE BINDS; DEGREE ADVISES (fable-118 ruling (c)) — and the scope
          is now the SUBJECT TABLE, not one hard-coded facet name.

          D-187's reasoning is sound and its evidence is real — asking a reader
          whether greenish-hazel is *distinctly* "seafoam green" refunded six
          legitimate renders in eighteen. But it was scoped by LANE, and the
          free lane holds two different arguments. "Is this green distinctly
          seafoam" is a matter of degree nobody has defined. "Are there dangly
          cross earrings on her" is not: either they are in the picture or they
          are not, which is the same test a REMOVAL is already binding on.

          This line read `facet === facetOfSubject("statedAccessories")` until
          2026-08-12, and the sentence that ended the old comment — *"Each
          widening comes with its own specimens"* — was the condition. Run 1 of
          the replay walk paid for the specimens: *"wear her hair down"*
          delivered a high bun, twice, with the reader saying so verbatim both
          times and 25 credits charged each time, on the same facet that had
          already been refunded once for the same failure on 2026-08-07.

          So the classification moved to `FREE_SUBJECT_KIND`, beside the
          vocabulary it classifies, and this call site DERIVES from it (working
          law 4 — a second list shadowing a source of truth always drifts).
          `marks` is still advisory, and now says so where anyone adding a
          subject will read it. What makes the widening safe is not the length
          of the presence list but `FacetCheck.absent`: a presence miss refuses
          only where the reader says the thing is not in the picture AT ALL.

          # AND IT BINDS ON THE STEP THAT ASKS, NOT FOREVER AFTER

          `facts` is built from the COMPOSED recipe, so every ask is re-checked
          on every later render — right for a fact the product DELIVERED and
          promised to keep, and a trap for one that never landed. Run 1 shows it
          again: step 4 asked for hair down and did not get it, and that ask is
          still in the recipe at step 5. Binding it there would have refused
          *"remove her glasses"* too — and step 6, and step 7, for as long as
          the painter kept failing that one sentence. **One undeliverable ask
          would quietly brick every later edit on the chain**, each costing her a
          wait and a refund and never the thing she came back for.

          So a CARRIED ask binds only where there is evidence it was ever
          delivered: a REALIZATION caption, which D-183 writes exclusively after
          a render corroborated the ask (`captionRealization` returns null when
          `matches !== true`). A PIN is not that evidence — `capturePresentation`
          reads it off the master, so it describes how she was before anybody
          asked for anything, which is precisely the state a failed ask leaves
          behind.

          Accessories keep exactly the behaviour they had: their captions are
          realizations, so a hoop delivered at step 1 and dropped at step 5 is
          still the store's promise failing and still refuses. Removals are
          untouched either way — they are pushed as their own facts below, with
          their own standing-departure rule and their own flag.
        */
        const presence = facetBindsOnPresence(facet)
          && (writtenFacets.has(facet) || evidencesDelivery(carriedCaptions[facet]));
        /*
          And the question carries the laterality the ask now carries, from the
          same table, so painter and reader hold one fact in one wording.

          KEYED ON THE FACET, NOT ON `presence` — and that mattered the moment
          `presence` stopped meaning "this is the accessories facet". It rode
          the binding flag while the two were the same boolean, and this change
          pulls them apart in both directions: `presence` is now true for
          `hairWorn`, `ink` and `facialHair` (which have no sides to speak of),
          and it goes FALSE for a carried accessory with no realization caption.
          The second one is the dangerous half — the pair clause is part of the
          PROMPT, not the gate, so a captioner outage would have quietly dropped
          *"one on each ear, a matching pair"* out of a paid render's
          instructions. Law 8's founding example, lost to a shared variable.

          `pairClauseFor` is already safe on non-accessory text (it resolves
          through `accessoryEntry` and returns "" when nothing matches), so this
          is about saying what the condition IS rather than about what it
          currently computes.
        */
        const lateralOf = (value: string) => (
          facet === facetOfSubject("statedAccessories") ? pairClauseFor(value) : ""
        );
        /*
          A SET IS ASKED ONE ITEM AT A TIME (fable-312 ruling 2).

          The walk's step 2 asked for dangly cross earrings on a face wearing
          hoops and the whole set went to the reader as one line — so the only
          question the gate could put was *"are there hoops and crosses on her"*,
          which a picture of plain hoops answers YES to, honestly. The verdict
          came back `present: true` with its own `saw` reading *"plain hoops, no
          dangly crosses"*: the gate had no shape in which to fail.

          Split, each item is a question a photograph can settle, and each gets
          the laterality of the thing IT names rather than of the joined string —
          which is also the pair clause finally being right about a set holding a
          nose stud beside a pair of hoops.

          # THE NEWEST ASK BINDS; WHAT LEGITIMATELY REMAINS IS A CARRIED FACT

          Under the ask-supersedes rule a replaced item is no longer in the set
          at all, so what is left beside a fresh item is a DIFFERENT thing that
          survives on purpose — her glasses while she is asking about her ears.
          Those are carried facts, and the carried rule already says what may
          bind them: evidence they were ever delivered, which is a realization
          caption. Binding them as though this sentence had asked for them again
          would let one undeliverable carried item brick every later edit — the
          same trap the facet-level rule above was written to avoid, one
          granularity down.

          **What is new to the SET is the ask**, and `priorItems` is what says
          so — the same prior source containment measures against at the parse,
          read here for the second question it can answer. The step's own delta
          cannot: a plural subject restates its whole set by instruction, so the
          glasses she is still wearing sit in this step's delta too.
        */
        const plural = presenceItemsOfFacet(composed, facet);
        if (plural === null) {
          return [{
            facet,
            asked: `${asked}${lateralOf(asked)}`,
            binding: guaranteedFacets.has(facet) || presence,
          }];
        }
        const before = new Set(
          (priorItems[plural.subject] ?? []).map((item) => item.toLowerCase()),
        );
        const carriedEvidence = evidencesDelivery(carriedCaptions[facet]);
        return plural.items.map((item) => ({
          facet,
          asked: `${item}${lateralOf(item)}`,
          binding: guaranteedFacets.has(facet)
            || (facetBindsOnPresence(facet)
              && (!before.has(item.toLowerCase()) || carriedEvidence)),
        }));
      });
    /*
      AND THE PINNED PRESENTATION (D-186), which is the fourth symptom.

      Hair worn up drifted to worn down because no named value existed for the
      net to check. It has one now, so the net checks it — these are short
      categorical values, unlike the descriptive captions, which is exactly why
      only this class is verifiable without inviting false failures.
    */
    for (const facet of PRESENTATION_FACETS) {
      const pinned = captionWording(carriedCaptions[facet]);
      if (pinned && !facts.some((fact) => fact.facet === facet)) {
        /* Read from a photograph rather than chosen from a vocabulary, so it is
           watched rather than enforced — same reasoning as the free lane. */
        facts.push({ facet, asked: pinned, binding: false });
      }
    }

    /*
      AND THE THING THAT WAS SUPPOSED TO GO (Fable consumer sweep, 2026-08-08).

      `facts` is built from `facetsWrittenBy(composed)`, and a removal deletes
      its own facet from the recipe — so a removal was verified against
      everything EXCEPT the thing that was asked for. Every other fact could
      pass while her glasses sat there untouched, and the row landed
      `delivered_unverified` forever: the same asymmetry as the harvest, one
      consumer over, and invisible for exactly the same reason.

      A removal's success criterion is an ABSENCE, so the ask is phrased as one
      and the reader is told how to judge it. Binding, because unlike a shade
      name this is not a matter of taste — either they are gone or they are
      not — and D-235's asymmetry protects a correct render from a reader that
      cannot see: an unread check spends no refusal.
    */
    /*
      AND EVERY STANDING DEPARTURE, not only this render's own.

      It was `if (departed)` — one render's local — so a recipe that says the
      glasses are off went unchecked on every render after the one that took
      them off, which is precisely where they come back. Same list as the mask
      and the prompt, so the three cannot disagree about what left.
    */
    for (const gone of departedFromPicture) {
      const facet = facetOfSubject("statedAccessories");
      facts.push({
        facet,
        asked: departedClause(gone),
        /*
          AND THE CUSTOMER'S VERSION OF THE SAME FAILURE.

          `asked` is an instruction to the reader and is an assertion; the
          refusal message and the ledger line both splice their fact into
          *"came back ___"*, and an assertion does not fit there. In production
          this exact row produced **"came back twice without no glasses — they
          have been taken off and are not in the picture"** on a real receipt.
          One string cannot be a vision prompt and a sentence.
        */
        shortfall: departedShortfall(gone),
        binding: true,
        /*
          AND ITS TEETH SURVIVE THE ABSENCE GATE.

          From 2026-08-12 a binding miss also needs the reader to call the thing
          ABSENT before it may refuse. A removal's success criterion is already
          an absence — "no glasses" is false exactly when the glasses are still
          there — so asking that question of this line has two defensible
          opposite answers and the gate would have turned on which way a model
          read it. Declared here instead, at the one site that builds removals.
        */
        absenceIsTheAsk: true,
      });
    }

    /*
      RENDER, CHECK, AND ONE FREE RETRY.

      The verdict is evidence rather than proof — the same reader misread
      pink-through-glasses irises as "deep brown" (D-183) — so a failure buys a
      re-render at the house's expense before it ever spends the user's refusal.
    */
    const attemptRender = async () => {
      const rendered = await renderOnce();
      /*
        The landing smoke alarm stays exactly where it was (D-93). Damage is a
        different question from compliance and it is not worth a retry: a seamed
        or duplicated frame is a provider failure, and the refund is the answer.
      */
      const fault = await detectRenderFault(rendered.bytes);
      if (fault.fault) {
        log.error(
          { operationId, variant: variant.publicId, detail: fault.detail },
          "[refineService] RENDER FAULT — failing the refinement and refunding",
        );
        throw new ProviderError("render_fault", fault.detail);
      }
      /*
        INHERITED VERDICTS ARE NOT WIRED HERE YET, AND THE REASON IS A DEFECT
        FOUND WHILE WIRING THEM (2026-08-08, reported to Fable in opus-020).

        The design — don't ask a stochastic reader to re-decide what arithmetic
        proves unchanged — is sound, and `inheritedVerdict.ts` implements it
        with its controls green. What is NOT sound is the source of the
        inherited verdict, and the reason is one line in `claimVariant`:

          baseImageKey: candidate.imageKey

        **Every render is anchored on the ORIGINAL CANDIDATE**, not on the
        predecessor. So "outside `applied`, identical to the master" means
        identical to HER FIRST PICTURE — and a facet an earlier step PAID to
        change, whose region this composite happens not to touch, has silently
        reverted to the candidate's version of it. Run-7 saw exactly that:
        freckles delivered at step 1 were gone from step 3's render.

        Inheriting the predecessor's "freckles are there, I saw them" onto that
        render would have converted a visible, honestly-counted delivery failure
        into a confident false pass — manufactured by the fix meant to prevent
        them, on pixels nobody looked at. That is the one outcome this campaign
        forbids outright, so it does not ship on my own judgment.

        The narrow safe rule is known and stated in opus-020: inherit only for
        facets NO step of the chain has ever written — the pinned presentation
        facts like `hairWorn`, which is the entire motivating case — and only
        from a check carrying its own `saw`. That still needs the residual
        argued (a PRIOR composite may have painted the region even where no step
        named the facet) and it changes refusal behaviour, so it waits for a
        ruling rather than being decided here.
      */
      /*
        A MAGNIFIED CROP RIDES ALONG WHEN THE RECIPE NAMES SOMETHING SMALL.

        Measured in `marks-reader-court.mts`: the reader is not unreliable — 120
        readings at temperature 0 produced zero split verdicts — it simply
        cannot see her freckles in a 1024x1536 portrait, and can see them every
        time at 2x on the face crop. Portrait 6/8 cases unanimous, enlarged 8/8.

        It costs no vision call: the box comes from a region the harvest already
        segmented for its own work. On a step whose harvest never touched the
        face there is no detail and the reading is exactly today's, which is the
        honest partial — buying a segmentation here would put ten seconds and a
        new failure mode on every paid render.
      */
      const detail = await detailForVerification({
        bytes: rendered.bytes,
        facets: facts.map((fact) => fact.facet),
        masterRegions: rendered.evidence?.masterRegions,
      });
      /*
        AND A CARRIED FACT IS SETTLED BEFORE IT COUNTS AS ANYTHING (fable-120).

        Inside `read`, not after it, so all three of D-194's readings are settled
        the same way. Applied after the reading rather than by building the fact
        non-binding up front, because the question is about the frame this
        attempt actually produced: which segments were pasted, and which of them
        this attempt's own paint then covered. A re-render answers both
        differently.
      */
      const read = async () => settleCarriedChecks(
        await verifyRender({
          bytes: rendered.bytes,
          contentType: rendered.contentType,
          ...(detail ? { detail } : {}),
          facts,
          engine: dependencies.verifier,
        }),
        { facets: rendered.carried ?? [], superseded: rendered.assembly?.superseded },
      );
      return {
        rendered,
        /*
          A BINDING MISS IS RE-READ BEFORE IT COUNTS (D-194).

          The reader disagrees with itself 21% of the time, measured on the
          trial's own data, so one reading cannot be evidence enough to spend a
          refusal. The extra calls land only on a render already headed for a
          re-render or a refund.
        */
        verification: await confirmVerdict(await read(), read),
      };
    };

    let { rendered: image, verification } = await attemptRender();
    let attempts = 1;

    if (!verification.ok) {
      log.warn(
        { operationId, variant: variant.publicId, missing: missingFacts(verification) },
        "[refineService] the render is missing filed facts — re-rendering once, free",
      );
      ({ rendered: image, verification } = await attemptRender());
      attempts = 2;
    }

    /*
      THE READER-DEFECT WATCH LIST (D-187), logged on every delivered render.

      A failure the product will not refuse over is still evidence. Repeated
      advisory misses on one facet class whose renders look right is a reading
      problem, and the founder's rider is explicit that it must be surfaced
      rather than quietly refunded.
    */
    const advisory = advisoryMisses(verification);
    if (advisory.length > 0) {
      log.warn(
        { operationId, variant: variant.publicId, advisory },
        "[refineService] delivered with advisory misses — watch this facet class",
      );
    }

    if (!verification.ok) {
      /*
        TWICE IS THE PRODUCT'S PROBLEM, NOT THE CUSTOMER'S.

        Thrown past the charge, so the ordinary refund path gives back the whole
        25 — the compliance risk moves off the customer permanently, which is
        the entire point of the ruling.
      */
      log.error(
        {
          operationId,
          variant: variant.publicId,
          attempts,
          verification: verification.checks,
        },
        "[refineService] VERIFICATION FAILED TWICE — refusing and refunding",
      );
      /*
        AND THE PICTURE THAT WAS REFUSED (founder-approved 2026-08-08).

        Run-6's "remove her glasses" was refused twice and refunded correctly,
        and nobody can say whether the glasses were actually still there —
        because the frame is gone the moment this throws. This is the one
        artifact that answers it. Dark on every account but the founder's, and
        it can never break the refusal it is documenting.
      */
      await captureRefusedRender({
        userId: input.userId,
        operationId,
        reason: "facts_missing",
        frames: [{ name: "composite", bytes: image.bytes }],
      });
      throw new ProviderError(
        /*
          ITS OWN CLASS, because the receipt is the record (D-188).

          This picture is HEALTHY — the damage detector passed it twice. Throwing
          it as `render_fault` wrote "the image came back damaged" on eight
          ledger rows for renders that were nothing of the kind, and the first
          person to read those rows reported them to the founder as provider
          damage. A refund line that misdescribes what happened is a support
          conversation nobody can resolve from the record.
        */
        "facts_missing",
        /*
          THE CLAUSE, NOT THE READER'S PROMPT. Both consumers of this message —
          the refusal sentence and the ledger line — say "the render came back
          ___", and `shortfalls` is the only thing that fits there.
        */
        joinClauses(shortfalls(verification)),
      );
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
    /*
      READ THE RENDER BACK, for the facets this instruction touched (D-152).

      Only the touched ones. A caption for a facet this edit did not change
      would be describing something the ORIGINAL already establishes, and
      restating that as a fact is how a description slowly replaces the
      reference. Fails soft — a missing caption costs later precision, never
      this render, which is already correct and already paid for.
    */
    /*
      Built from the ALREADY-DROPPED set, never from the raw inherited one.

      `captionRealization` fails soft, so spreading the inherited captions here
      would let a failed read leave the SUPERSEDED caption in place — a soft
      failure quietly becoming a stored lie, and one that then rides into every
      later render as fact. No caption for a facet is an honest state; a wrong
      one is not.
    */
    const capturedCaptions: RealizationCaptions = { ...carriedCaptions };
    for (const facet of Array.from(captionFacets)) {
      const caption = await captionRealization({
        facet,
        bytes: image.bytes,
        contentType: image.contentType,
        /* What this render was told to produce, so the read-back can be
           checked against it rather than describing whatever turned up. */
        asked: currentIdentity
          ? currentValueOfFacet(applyDelta(currentIdentity, composed), facet)
          : null,
      });
      if (caption) capturedCaptions[facet] = caption;
    }

    /*
      Taken from the render that actually LANDED, so a re-render's own
      carrying is what gets recorded rather than the first attempt's.
    */
    const carriedFacets = new Set(image.carried ?? []);

    /*
      A REMOVAL IS ADJUDICATED BEFORE THE PICTURE LANDS (chunk 3,
      `LIBRARY_REMOVAL_DESIGN.md` §4).

      Two things happen here and they are the same reading:

        the thing is GONE      retire the slot's carry, so the next recipe stops
                               fetching a crop of something she took off
        the thing is STILL ON  the removal did not land. D-246 (c) read in the
                               mirror — the asked thing is completely un-done —
                               so this refuses into the refund and the library is
                               left exactly as it was

      **Deliberately OUTSIDE the swallow-everything wrapper below, and the two
      failures are not the same size.** A mint that fails means the library did
      not learn something new; the picture is still exactly what was asked for,
      so it must not cost the render. A RETIREMENT that fails means the library
      actively contradicts the picture — it still holds a crop of the glasses
      she just paid to remove, and the next unrelated ask would fetch that crop
      and put them back on her face. Refunding a render nobody has seen is the
      cheaper of those two, and it is only available because the landing now
      comes last.

      Nothing but `vacated` may retire anything. A reader's silence about an
      untouched slot has at least three causes with no departure among them
      (the segmenter missed, the slot has no question, the crop is dark), and a
      library that retired on that signal would delete her earrings because a
      render came out shadowy.
    */
    const vacatedSlots = (image.repaint?.vacated ?? []) as readonly FeatureSlot[];
    if (vacatedSlots.length > 0) {
      const reader = dependencies.regions ?? defaultRegionReader();
      for (const slot of vacatedSlots) {
        const definition = slotDefinition(slot);
        if (definition?.question == null) {
          /* A slot with no question cannot be confirmed either way, and an
             unconfirmed retirement is the library asserting something about a
             picture nobody read. `repaintAsksFor` only builds a vacate for a
             catalogued accessory, so this is a guard rather than a path. */
          throw new Error(`the removal of ${slot} cannot be confirmed — that slot has no question to ask the frame`);
        }
        /*
          IS THE THING STILL IN THE FRAME — asked in PIXELS, because the reader
          does not answer in nulls.

          This line read `if (still !== null)` for four days, under a comment
          saying "a refusal to answer would arrive as null". It does not.
          `RegionReader.region` is declared `Promise<Mask>` and `falRegionReader`
          answers *nothing found* with `emptyLike()` — a frame-sized mask of
          zeros — so the comparison was true on every frame ever painted and
          **every removal that reached this gate was refused and refunded**,
          however perfectly the painter had done the job. The bench took her
          glasses off 24 times out of 24 while the paid path went 0 for 3; the
          difference was never the prompt (they are byte-identical) and never
          the engine (both `fal:openai/gpt-image-2/edit`) — it was this.

          Driven rather than reasoned, on 2026-08-12, through the real reader:
          the bench's removed frame returned a 1024×1536 mask at **0.0000%**
          coverage and her master returned one at **1.4095%**. Both non-null,
          both refused. The reading the gate never took is right there in the
          two numbers, and the floor between them was already measured
          (`departureFloorFor`).

          The failure direction is unchanged and deliberate: a frame that still
          wears the thing refuses into the refund rather than delivering, and an
          unreadable frame throws out of here for the same reason.
        */
        const still = await reader.region({
          image: image.bytes,
          name: definition.question,
          /* Nothing found means the thing is not there, which is the answer
             this is asking for. */
          absentIsAnswer: true,
        });
        const covered = binaryCoverage(still);
        const { floor, measured, provenance } = departureFloorFor(definition.guardKind);
        if (covered > floor) {
          log.warn(
            {
              operationId, variant: variant.publicId, slot, question: definition.question,
              coverage: covered, floor, floorMeasured: measured,
            },
            "[refineService] the removal did not land — the thing is still in the frame, so the render is refused rather than delivered",
          );
          throw new ProviderError("removal_not_delivered", definition.noun);
        }
        log.info(
          {
            operationId, variant: variant.publicId, slot, question: definition.question,
            coverage: covered, floor, floorMeasured: measured, provenance,
          },
          "[refineService] the removal landed — the site reads empty in the delivered frame",
        );
        const retired = await (dependencies.retireSlot ?? retireReferenceSlot)({
          userId: input.userId,
          candidateId: variant.candidateId,
          anchorVariantId: variant.id,
          slot,
        });
        log.info(
          { operationId, variant: variant.publicId, slot, retired },
          "[refineService] the slot is vacant and its references are retired — the library stops carrying it",
        );

        /*
          AND THE LIBRARY IS TOLD THE SLOT IS EMPTY, which retiring alone does
          not say (migration 0030, fable-326/327).

          Retiring stops the branch CARRYING her earrings. It does not stop the
          MASTER wearing her glasses, and the master is reference 1 of every
          render on this road, forever. Proved with pictures before this was
          written: remove them, then ask for copper hair, and the copper hair
          arrives with the glasses back on her face — because the second recipe
          had nothing to say about them and silence is an instruction to keep
          what the anchor shows.

          So a vacancy row is filed, with the site's own vacant phrase and no
          crop, and every later recipe re-says it until a later answer on the
          same slot supersedes it. Beside the retirement rather than in the mint
          for the reason the retirement is here: both are things the NEXT ask
          must read, and both must be written before the landing makes that ask
          possible.
        */
        /*
          THE SLOT'S OWN INSTANCE DECIDES THE WORDS (fable-332).

          A per-side slot may not file a claim about both sides, so the pair
          phrase ("both earlobes bare") could not be recorded under `earring@left`
          and an earring removal refused into the refund rather than delivering
          an absence the library could not hold. The kind now carries a
          per-instance form and the SIDE comes from the slot definition, never
          from anything authored here.

          What the row is FOR is worth saying, because the mirror bench says the
          words do not steer the painter: this is the record that the lobe is
          empty. When both lobes are empty the assembler collapses the two rows
          back into the pair sentence — the measured one — for what actually
          goes on the wire.
        */
        const phrase = vacantPhraseFor(definition.guardKind, definition.instance);
        if (phrase === null) {
          throw new Error(`the removal of ${slot} cannot be remembered — its kind has no vacant phrase to file`);
        }
        /*
          THE DOOR'S OWN RULE, ASKED BEFORE THE WRITE RATHER THAN BY IT.

          `assertReferenceRowShape` would throw anyway; asking here is what turns
          a stack trace into a named refusal, and it names a real gap: the pair
          phrase ("both earlobes bare") is a claim about BOTH sides, and a
          per-side slot may not file one — the mismatched-pair rule, which exists
          because that claim was once filed identically under each ear. Glasses
          and a nose stud are single-instance slots and pass. So an earring
          removal REFUSES into the refund rather than delivering a frame whose
          absence we cannot keep: never charge for a fact the product is about to
          forget. A per-instance phrase is authored and measured before this
          opens, never invented at this call site.
        */
        const unfilable = slotWordsRefusal(slot, [phrase]);
        if (unfilable !== null) {
          log.error(
            { operationId, variant: variant.publicId, slot, reason: unfilable.reason },
            "[refineService] the removal landed and the library cannot record it — refusing rather than delivering an absence that lasts one frame",
          );
          throw new Error(`the removal of ${slot} cannot be recorded: ${unfilable.detail}`);
        }
        await (dependencies.recordRows ?? recordReferenceRows)({
          userId: input.userId,
          variantId: variant.id,
          rows: [{
            role: "vacancy",
            slot,
            tier: definition.tier,
            noun: definition.noun,
            words: [phrase],
          }],
        });
        log.info(
          { operationId, variant: variant.publicId, slot },
          "[refineService] the vacancy is on the record — every later recipe says the absence rather than going quiet about it",
        );
      }
    }

    /*
      EVERYTHING THE NEXT ASK WILL READ IS WRITTEN BEFORE THE LANDING (fable-307).

      The landing is not bookkeeping — it is the moment the picture becomes
      VISIBLE: `landVariant` flips the row to `ready` and selects it in one
      transaction, and the next ask can be submitted the instant it does. Both
      stores below are read by that next ask through the same lineage walk, so
      anything written after the landing is written into a window where a fresh
      ask has already been assembled from the older rows.

      That window was 42 seconds wide on a live dev walk. Step 2 paid for cross
      charms; step 3 — an unrelated hair ask — was claimed 42 s before step 2's
      library rows existed, so the repaint re-fetched step 1's plain hoops and
      **took back the edit the customer had just paid for.** On the paste road
      the earlier pixels were already in the frame; on the repaint road the
      feature is carried by a CROP that has to be re-fetched, so the freshness of
      the library IS the carry promise. True by construction beats true by
      timing, which is why this is an ordering rather than a barrier: a second
      mechanism guarding the first has its own window.

      # Why the landing may safely be last

      The order that stood here until today had a reason, and it survives: a
      store is evidence of a DELIVERED render, and filing one for a picture that
      then failed to land would keep pixels she never received. What makes the
      move safe is that such rows are UNREACHABLE, not merely unlikely. Both
      stores are keyed on this variant, both are read by walking `parentVariantId`
      from a variant the user is refining, and `refineCandidate` refines the
      SELECTED face — which only a landed variant ever becomes, in `landVariant`'s
      own transaction. A variant that never lands is never selected, so it is
      never any later render's ancestor, so nothing can ever read what it filed.
      The crops are still swept with the candidate.

      Neither store may fail this render: the segment store never throws, and the
      library block below is wrapped. That property is what the old order got for
      free and this one has to state — a bookkeeping failure before the landing
      would reach the outer catch and refund a render that is about to be
      perfectly good.

      Cost, declared to the latency programme: the mint's vision calls (~40 s)
      now sit before the picture appears rather than after, on a step the user is
      already watching. The barrier shape — making the next ask's assembly wait
      for its ancestors' pending mints — is filed as the optimisation that buys
      that time back, not built.

      # The segment store, unchanged in everything but position

      Dark until `CASTING_SEGMENTS_SCOPE` names her, and silent in both
      directions — it never throws, and a failure costs this render nothing at
      all. The facet simply keeps no pixels, and the next render carries it the
      way every render does today: with words. It moved with the mint because it
      has the same exposure for the same reason (working law 7): it is read by
      the next ask through the same lineage walk, and on the paste road a missing
      newest segment carries an OLDER version of the facet — the same take-back,
      one road over, and that road is the one production is running today.
    */
    /*
      AND ONLY WHAT THIS RENDER ACTUALLY EARNED — D-235 at permanence's front
      door (fable-102 §4).

      The first production walk filed `marks@v2` and `marks@v3` from the two
      frames where the freckles had been LOST, each stamped `verified` by a
      constant, while the render's own per-facet reading said
      `verified:false` about that exact facet. The lineage walk takes the
      newest version, so the store had quietly made the loss the truth — and a
      promotion at Sign would have written it onto her Cast forever.

      Three conditions, and each one is a different failure it closes:

      - **`read && verified`, per facet.** An affirmative without a `saw` is not
        a reading, so silence keeps nothing. The previous version stays newest
        and stays good.
      - **Never a carried facet.** Those pixels were pasted, not painted; filing
        them again would buy a new version of the same crop on every render.
      - **Nothing at all when the reader was unavailable.** We have no reading,
        so we have no evidence, so we keep no pixels. Permanence fails closed.

      # AND ONLY A FACET THIS ASK WROTE (fable-143 §3a, restoring fable-102 §4)

      The rule was always **written ∩ verified**, and the built version had
      quietly become "every verified, non-carried check". Those are not the same
      set, because the net checks the WHOLE recipe: a pinned facet nobody
      mentioned gets read, passes, and banks a segment.

      Found on the founder's own face. `ee5d6988`, variant 158 — the ask was
      *"give her freckles"*, and it filed **two** segments: `marks`, which he
      asked for, and **`hairWorn`, which he did not**. The panel then showed one
      row, because the hair segment has no delivered value to be named by, so
      the store was keeping pixels for a facet the product could not tell him
      about and he could not undo. Two answers to "what does this face keep" —
      the operative one and the visible one — which is law 4's shape.

      `writtenFacets` is the same set the captions already drop and the harvest
      already asks about, reused rather than recomputed: a second derivation of
      "what did this ask write" is the parallel copy that drifts.
    */
    /*
      # AND A FACET IS DELIVERED ONLY IF EVERY ITEM ASKED OF IT WAS DELIVERED

      Since a set is asked one item at a time, one facet can carry several
      checks — *"dangly cross earrings"* beside the glasses she is still
      wearing. Read per CHECK, a facet whose crosses were missed and whose
      glasses were found would appear in this list AND in the library's disputed
      list on the same render: the same facet earning permanent pixels and being
      refused a crop, from one reading. So the facet is the unit here, and its
      verdict is the AND of its own checks.

      Derived once and consumed twice, because two filters over one array with
      opposite polarity are exactly the parallel copy that drifts (law 4).
    */
    const readChecks = verification.unavailable
      ? []
      : verification.checks.filter((check) => (
        check.read && writtenFacets.has(check.facet) && !carriedFacets.has(check.facet)
      ));
    const missedFacets = new Set(
      readChecks.filter((check) => !check.verified).map((check) => check.facet),
    );
    const earned = Array.from(new Set(
      readChecks
        .filter((check) => check.verified && !missedFacets.has(check.facet))
        .map((check) => check.facet),
    ));
    await keepSegmentsFromRender({
      userId: input.userId,
      variantId: variant.id,
      image,
      facets: earned,
      /* The harvest's own placement map — see `regionOverrides` in renderOnce. */
      regionOverrides,
      /* The reading that earned these pixels, so a paste never re-asks. Every
         facet here verified on its own reading — the string is no longer a
         constant standing in for one. */
      verdict: earned.length > 0 ? "verified" : null,
      verifiedAt: earned.length > 0 ? new Date() : null,
      operationId,
    });

    /*
      AND TELL THE LIBRARY WHAT THIS FACE NOW IS (the reference library, §2.3).

      The segment store above keeps the pixels an EDIT delivered, so the next
      render does not re-roll them; this keeps what the FEATURE is, so the next
      render knows her lips before it is asked about them. Two stores, two
      questions, and the mint deliberately consults neither the other's rows nor
      its own (fable-173): every reference is cut fresh from this frame.

      Same list, same discipline: `earned` is written ∩ verified ∩ not-carried,
      derived once above for the segments and reused here rather than recomputed.

      # AND ONE LIST THE SEGMENT STORE DELIBERATELY DOES NOT GET (fable-220 §3)

      `disputed` is written ∩ READ-BUT-NOT-VERIFIED ∩ not-carried: the ask wrote
      the facet and this render's own reader looked at the delivered frame and
      said the change is not there. `lips` — *"a fuller cupid's bow"*, read true,
      verified false — is the founding case.

      It goes to the library and NOWHERE else, and the two halves of that are
      both deliberate:

        not to the segments   permanence keeps pixels a render EARNED. Filing an
                              unverified one would make the loss the truth on the
                              next lineage walk — the `marks@v2` incident, which
                              is why the `earned` gate exists at all.
        not to billing        D-187/D-246 are untouched. The render was delivered
                              and charged before this line runs, and nothing here
                              can revisit either.

      What it buys is one row per disputed facet carrying the crop, because "the
      reader was wrong" and "the painter was wrong" are indistinguishable from
      every instrument we have and obvious to a person looking at the picture.
      Costed honestly: one vision call per disputed facet, and the mint's log
      line says how many it spent.

      Unavailable stays empty for both. No reading is no evidence, and a dispute
      is a reading that happened.

      # The whole thing is wrapped, because a bookkeeping failure must never
      # take back a picture that is about to be delivered

      `mintReferencesForRender` catches its own failures and returns `failed`,
      but everything BEFORE it — the flag read, the digest query, the slot
      composition — is this function's own code running inside the request's
      outer try, whose catch refunds. This block now runs BEFORE the landing, so
      a throw here would refund a render nobody has seen rather than take back
      one somebody is looking at — the gentler of the two failures, and still
      the wrong one: the picture in `image.bytes` is good, it is paid for, and a
      failed digest query is no reason to lose it. That is the exact shape the
      satisfaction ledger's try/catch below was written for, and it is a
      synchronous throw rather than a rejected promise that walks past a
      `.catch()`.
    */
    const libraryEnabled = dependencies.referenceLibraryEnabled
      ?? captureCastingReferenceLibraryEnabled;
    if (libraryEnabled(input.userId)) {
      try {
        /* The other half of the same derivation, and the reason it is a `Set`
           computed once above: any missed item disputes its facet, so the two
           lists are complements by construction rather than by two filters
           happening to agree. */
        const disputed = Array.from(missedFacets);
        const { slots, unfiled } = mintedSlotsForRender({
          earned,
          disputed,
          captions: capturedCaptions,
          /* What the instruction said the worn object IS — derived once above,
             beside the region override that has to name the same object. */
          accessoryKind: accessoryRegion,
        });
        if (unfiled.length > 0) {
          log.info(
            { operationId, variant: variant.publicId, unfiled },
            "[refineService] a facet this render wrote had no library slot to file in",
          );
        }
        if (disputed.length > 0) {
          log.info(
            { operationId, variant: variant.publicId, disputed },
            "[refineService] this render's reader disputed a facet the ask wrote — its crop is cut for a human, not for the library",
          );
        }
        if (slots.length > 0) {
          /*
            THE DIGESTS THIS BRANCH ALREADY HOLDS, so a byte-identical crop is
            caught whether it arrived this render or three renders ago. `marks`
            and `makeup` at `face skin` produced exactly that in production,
            three separate times — the walk, not the fold's entries, because a
            RETIRED row's bytes are still bytes at a key and a new row pointing
            at the same picture is still two rows holding one fact.

            The anchor is this variant: its own rows do not exist yet, so the
            walk climbs its parents and returns the library as it stood when
            this render started.
          */
          const known = new Map<string, string>();
          for (const row of liveReferences(await listLineageReferences({
            userId: input.userId,
            candidateId: variant.candidateId,
            anchorVariantId: variant.id,
          }))) {
            if (row.digest) known.set(row.slot, row.digest);
          }

          const reader = dependencies.regions ?? defaultRegionReader();
          /*
            THE GUARD'S OWN READ, and `absentIsAnswer` is true on purpose.

            Asked of the DELIVERED frame, nothing found means the frame does not
            wear the thing — which the guard turns into `subjectAbsent`, the
            honest refusal (fable-181). Refusing to answer instead would arrive
            as `readDidNotSettle` and file "we could not tell" over a picture
            that told us plainly.
          */
          const read: MintRegionReader = async ({ frame, question, side }) => {
            if (side === undefined) {
              return reader.region({ image: frame, name: question, absentIsAnswer: true });
            }
            /*
              A SIDE IS SCOPED BY THE READER OR IT IS NOT SCOPED AT ALL.

              Asked about one hoop, the whole-frame answer is both of them, and
              scoring a crop of one against a region of two produces a number
              around 50% that means nothing except that the question was wrong.
              A reader without the capability returns null here, which the guard
              reads as `readDidNotSettle` — the one refusal that records no
              reading, so nothing measured against the wrong boundary can ever
              become this kind's specimen.
            */
            if (!reader.regionSides) return null;
            const sides = await reader.regionSides({ image: frame, name: question, absentIsAnswer: true });
            return sides ? sides[side] : null;
          };

          const minted = await mintReferencesForRender({
            userId: input.userId,
            variantId: variant.id,
            frame: { bytes: image.bytes },
            /* The composite's own working, kept rather than re-derived — the
               same evidence the segment store cuts from, so a reference and a
               segment of one render can never disagree about where the paint
               was allowed to go. */
            applied: image.evidence?.applied ?? null,
            masterRegions: image.evidence?.masterRegions ?? new Map(),
            deliveredRegions: image.evidence?.deliveredRegions ?? null,
            /* The split the harvest already performed and used to throw away —
               without it every per-side slot files words, which is what the
               whole library did until today. */
            masterSideRegions: image.evidence?.masterSideRegions ?? null,
            deliveredSideRegions: image.evidence?.deliveredSideRegions ?? null,
            slots,
            knownDigests: known,
            operationId,
            dependencies: {
              read,
              /*
                THE GROUND, ON THE ROAD THAT BRINGS NO MAP.

                A repaint has no harvest, so `masterRegions` above is empty and
                every cuttable slot would fall to `noRegion` and file words —
                the library ceasing to acquire crops on the very road that makes
                crops the carrier. The mint asks the delivered frame instead, and
                what it gets is `region(delivered)`: the feature's whole extent
                on the frame that delivered it (§2.3).

                THE SAME ADAPTER as the guard's, deliberately — one definition of
                how this product asks a frame where something is, rather than two
                that drift. The independence the guard needs is between the two
                READS, and it is structural: the mint invokes each seam
                separately, so the mask that cut the crop is never the mask the
                crop is scored against.

                Gated on the FLAG rather than on the absence of evidence. The old
                road can also arrive here with no evidence (the masked path off),
                and inferring the need from that would start spending vision
                calls on a live path that never asked for them.
              */
              ...(repaintEnabled ? { readGround: read } : {}),
              /*
                THE LIBRARY'S OWN READ OF WHAT THIS SLOT NOW IS.

                Not gated on any flag, and that is deliberate: this is a fix to
                what the live mint WRITES, not a road behind a door. Eight
                production earring rows named her glasses because a slot's words
                were its facets' whole-frame captions, and D-244 re-says a
                slot's whole stack on every edit — so those sentences would ask
                a paid render to put them back on.

                `captionSlot` is handed the slot's own CUT wherever there is
                one, which is what makes the defect unreachable rather than
                merely avoided: a crop of her left earlobe cannot be described
                as glasses, because the glasses are not in the bytes.

                Wired HERE and asserted here — a control nothing invokes is not
                a control (invariant 7), and this program has already paid twice
                for a store that was inert while two benches passed.
              */
              readWords: ({ bytes, contentType, noun, view }) => captionSlot({
                bytes,
                contentType,
                noun,
                view,
              }),
              enabledFor: libraryEnabled,
            },
          });
          log.info(
            {
              operationId,
              variant: variant.publicId,
              outcome: minted.outcome,
              slots: minted.slots,
            },
            "[refineService] the library was told what this render made of her",
          );
        }
      } catch (error) {
        log.warn(
          { err: error, operationId, variant: variant.publicId },
          "[refineService] this render's references were not minted — the picture stands",
        );
      }
    }

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
        /* Same source as the prompt, for the same reason. */
        resolved: baseIdentity ? applyDelta(baseIdentity, filed) : null,
        ...(presentationOf(filed) ? { presentation: presentationOf(filed) } : {}),
        /*
          THE CAPTIONS, WRITTEN DOWN — and until now they never were.

          Recipe v3 shipped complete except for this key. `capturedCaptions` was
          built, paid for in vision calls, and dropped on the floor; `readCaptions`
          read a field with no writer, so `captionClause` was empty on every
          render and the whole memory half of v3 was inert from the day it landed.
          It passed its own gauntlet because the quality half is real and the
          facets were being carried by the deltas — an instrument measuring a
          genuine improvement and a dead feature at once, unable to tell them
          apart. Persisting them is the fix; keying them by facet is what stops
          the fix becoming the bug the founder described.
        */
        captions: capturedCaptions,
        /*
          WHAT THE COMPOSITE DID, so a carried fact can be adjudicated later
          (fable-109). Absent when nothing was carried — an ordinary render has
          no assembly to describe.
        */
        ...(image.assembly ? { assembly: image.assembly } : {}),
        /*
          THE SEAM VERDICT, ON EVERY LANDED RENDER (fable-119). Absent only when
          nothing was composited — a flag-off or no-region render has no
          boundary to have an opinion about.
        */
        ...(image.seam ? { seam: image.seam } : {}),
        /*
          AND THE RECIPE, ON A REPAINTED ROW ONLY — see `repaintOnce`. Absent on
          every other road, which is what makes its presence the mark of this
          one rather than one more field a reader has to interpret.
        */
        ...(image.repaint ? { repaint: image.repaint } : {}),
        /*
          THE NET'S VERDICT, RECORDED (D-185).

          Telemetry is part of the build rather than an afterthought: these rows
          are the measuring instrument for the two-reference trial, and they are
          also how a READER defect becomes visible — repeated failures on one
          facet class whose renders look correct is a reading problem, not a
          rendering one.
        */
        verification: {
          attempts,
          /* How many readings the verdict took — 1 clean, 2 confirmed, 3 split
             (D-194). The reader's own reliability, recorded per render. */
          readings: verification.readings ?? 1,
          /*
            WHICH FACTS WERE CARRIED RATHER THAN PAINTED — the two-column
            report's only writer.

            Marked here, on the row, because the report is derived from stored
            rows and nothing else knows this: by the time a reader looks at the
            frame, a pasted segment and a fresh paint are indistinguishable —
            which is the point of the store and exactly why the honesty column
            cannot be inferred later.

            The check keeps its verdict either way. A carried fact that the
            reader cannot find is still a false pass, because the product
            promised to keep it.
          */
          checks: carriedFacets.size === 0
            ? verification.checks
            : verification.checks.map((check) => (
              carriedFacets.has(check.facet) ? { ...check, carried: true } : check
            )),
          ...(verification.unavailable ? { unavailable: true } : {}),
        },
      },
      provider: image.provenance?.provider ?? null,
      providerModel: image.provenance?.model ?? null,
      providerRef: image.provenance?.providerRef ?? null,
    });

    /*
      THE LEDGER'S OTHER TWO EVENTS (D-175), written once the render has landed.

      A removal says the face it came from was CORRECTED — the user paid for
      something and then took part of it back. An edit that rewrites a facet its
      predecessor's own last step wrote says that step was REPHRASED: same
      ground, second attempt, which is the clearest signal in the product that a
      paid edit did not say what they meant.

      After the landing on purpose. Labelling a refinement that then failed
      would put a satisfaction verdict on a picture nobody ever saw.
    */
    try {
      if (predecessor) {
        const previousStep = readStepDeltas(predecessor.stepDeltas).at(-1);
        const rephrased = Boolean(
          editDelta
          && previousStep
          && Array.from(facetsWrittenBy(editDelta))
            .some((facet) => facetsWrittenBy(previousStep).has(facet)),
        );
        if (!editDelta || rephrased) {
          await recordVariantOutcome({
            userId: input.userId,
            variantId: predecessor.id,
            outcome: editDelta ? "rephrased" : "corrected",
          });
        }
      }
    } catch (error) {
      /*
        A LOST LABEL MUST NEVER COST A DELIVERED PICTURE.

        The whole try/catch, not a `.catch()` on the promise: a synchronous
        throw walks straight past that and lands in the outer handler, which
        refunds — so a bookkeeping failure would have taken back a render the
        user already has. The ledger is the least important thing in this
        function and must fail like it.
      */
      log.warn({ err: error }, "[refineService] could not record the satisfaction outcome");
    }

    const result: RefineResult = {
      kind: "rendered",
      /*
        THE REFERENCE IS CONFESSED, not silently dropped (D-181).

        They asked for green eyes LIKE someone. The green is theirs and it
        files; the comparison cannot be served and never reaches the record. A
        product that quietly serves half an instruction and says nothing has
        decided something on the user's behalf without telling them.
      */
      ...(droppedReference
        ? {
          note: "Made the eyes as you described. Refining can't copy a real "
            + "person's features, so that part of the comparison was set aside.",
        }
        : {}),
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
    /*
      SAY WHY, BEFORE THE MONEY MOVES.
      
      This block refunded correctly and recorded `failureClass: "unknown"`, and
      the founder's first three real masked edits refused with NOTHING in the
      logs but the public sentence. The money law held perfectly and the trail
      did not exist — a refusal nobody can diagnose is a refusal that will happen
      again. The cause is now written down before anything else happens to it.
    */
    log.error(
      {
        operationId,
        variant: variant.publicId,
        userId: input.userId,
        failureClass: error instanceof ProviderError ? error.failureClass : "unknown",
        cause: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack?.split(/\r?\n/).slice(0, 4).join(" | ") : undefined,
      },
      "[refineService] REFINEMENT FAILED — refunding; this line is the only record of why",
    );
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
      error: spokenError({
        /*
          THE CODE STAYS AND THE MARKER IS WHAT CHANGES. This one really did
          charge and refund, its `errorCode` is on a receipt, and rewriting that
          would rewrite history for support. What was wrong was never the code —
          it was that an authored sentence had no way to say it was authored.
        */
        code: "INTERNAL_SERVER_ERROR",
        /*
          AND THE PERSON IS TOLD THE SAME THING THE LEDGER IS.

          "Didn't come through" is right for a failure; it is wrong for a
          picture that arrived twice without the thing they asked for, and it
          would leave them retyping an instruction the product already knows it
          cannot currently render.
        */
        message: refund.recorded
          ? failedFactsMessage(error) ?? "That refinement didn't come through. Your credits have been returned."
          : "That refinement didn't come through, and the refund could not be recorded — "
            + `quote operation ${operationId} and support will restore the balance.`,
      }),
      chargedCredits: price,
      refundedCredits: refund.recorded ? price : 0,
    });
  }
}

/**
 * The sentence for a render that arrived healthy and short of a fact.
 *
 * Null for every other failure, so the generic line keeps its job.
 */
function failedFactsMessage(error: unknown): string | null {
  /*
    A REMOVAL THAT WOULD NOT TAKE, in its own words.

    The sentence below is right about a verification refusal and wrong about
    this in both halves: nothing came back "twice" (a removal is adjudicated
    once, before the landing) and nothing is missing (the thing is still there).
    Borrowing it would put a receipt on her account describing a different
    event.
  */
  if (error instanceof ProviderError && error.failureClass === "removal_not_delivered") {
    const thing = error.message.trim();
    /* One form for a plural noun and a singular one alike — "the glasses are"
       and "the nose stud are" cannot both come out of one template, so the
       template does not try (the same rule the standing sentences follow). */
    return thing
      ? `That one came back with the ${thing} still in the picture, so it wasn't delivered `
        + "and your credits have been returned. Try saying it a different way."
      : "That one came back with the thing you asked to remove still in it, so it wasn't "
        + "delivered and your credits have been returned.";
  }
  if (!(error instanceof ProviderError) || error.failureClass !== "facts_missing") return null;
  const missing = error.message.trim();
  return missing
    ? `That one came back twice ${missing}, so it wasn't delivered and your credits `
      + "have been returned. Try saying it a different way."
    : "That one came back without what you asked for, twice, so it wasn't delivered and your "
      + "credits have been returned.";
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
  /*
    OURS, AND THE RECEIPT SAYS SO. The provider's frame was fine and our
    compositor cut it; a ledger line blaming the vendor is a support
    conversation nobody can resolve, which is the whole reason this class was
    split from `render_fault`.
  */
  if (error instanceof ProviderError && error.failureClass === "composite_fault") {
    return "Refine refunded — we could not assemble the picture cleanly";
  }
  /*
    ALSO OURS, and a different ours. The picture was never attempted, because
    the record of what she already has could not be read — and delivering
    without it would have quietly taken back edits she paid for.
  */
  if (error instanceof ProviderError && error.failureClass === "segment_store") {
    return "Refine refunded — we could not read this face's kept edits, so nothing was rendered";
  }
  /*
    NAMES WHAT WAS MISSING. The throw carries the facts, so the receipt can say
    which ones rather than making support re-derive them from a log.

    "came back" rather than "was missing", because a removal's shortfall is not
    an absence — the render came back WITH the thing that was supposed to go,
    and "the render was missing with glasses still in the picture" is the same
    grammar failure one line over.
  */
  if (error instanceof ProviderError && error.failureClass === "facts_missing") {
    const missing = error.message.trim();
    return missing
      ? `Refine refunded — the render came back ${missing}`
      : "Refine refunded — the render came back without what you asked for";
  }
  /*
    AND THE REMOVAL'S OWN LINE. Without it this falls through to "the
    generation failed", which is the misdescribing receipt the four classes
    above were split out to stop — the generation did not fail at all, it came
    back with the thing she was paying to take off.
  */
  if (error instanceof ProviderError && error.failureClass === "removal_not_delivered") {
    const thing = error.message.trim();
    return thing
      ? `Refine refunded — the render still showed the ${thing}`
      : "Refine refunded — the render still showed what she asked to remove";
  }
  return "Refine refunded — the generation failed";
}

/*
  `touchedSubjects` lived here and mapped BOTH eye axes onto "eyeColourFree", so
  an eye-SHAPE edit captioned the eye COLOUR. `facetsWrittenBy` replaces it: the
  facet is derived from one table shared with composition, so the caption and the
  supersession can no longer disagree about what an instruction was about.
*/

/** The captions a predecessor variant recorded, validated like any json column. */
function readCaptions(internalPrompt: unknown): RealizationCaptions {
  if (!internalPrompt || typeof internalPrompt !== "object") return {};
  const raw = (internalPrompt as { captions?: unknown }).captions;
  if (!raw || typeof raw !== "object") return {};
  const captions: RealizationCaptions = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    /* Trimmed, not re-capped — `captionRealization` owns the length, and a
       second cap here was how the writer and reader disagreed. */
    if (typeof value === "string" && value.trim()) captions[key] = value.trim();
  }
  return captions;
}

/** Two chains are the same sentences in the same order, or they are not. */
function sameInstructions(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((line, index) => line === b[index]);
}

/** Instructions are a json column, so they are validated rather than trusted. */
function readInstructions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

/**
 * The per-step chain, validated like any json column (D-163).
 *
 * Returns `[]` for the pre-column rows, which is what makes removal REFUSE on
 * them rather than silently operate on a chain it cannot see: the caller
 * compares the length against the instruction list and declines when they
 * disagree. An honest "not on this one" beats a reconstruction that is right
 * most of the time.
 */
export function readStepDeltas(value: unknown): RefineDelta[] {
  if (!Array.isArray(value)) return [];
  const steps: RefineDelta[] = [];
  for (const entry of value) {
    const delta = readStoredDelta(entry);
    /* A step that will not re-read is a hole in the chain, and a chain with a
       hole cannot be recomposed — so the whole chain is unusable, not just
       the step. Refusing beats quietly dropping somebody's earlier edit. */
    if (!delta) return [];
    steps.push(delta);
  }
  return steps;
}
