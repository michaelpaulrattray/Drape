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
import { hairStyleByName } from "./hairStyles";
import { FREE_SUBJECT_KEYS, FREE_SUBJECTS, type FreeSubject } from "./refineSubjects";
import { readResolvedIdentity } from "./rollService";
import {
  applyDelta,
  composeDeltas,
  composeRenderPrompt,
  contradictedFacets,
  currentValueOfFacet,
  facetsWrittenBy,
  itemsOf,
  missingFromPrompt,
  presentationOf,
  readDelta,
  REFINABLE_AXES,
  type RefineDelta,
} from "./refineDelta";
import { interpretRefinement, refusalMessage } from "./refineInterpreter";
import { readStoredDelta } from "./refineLegacy";
import { namesRemoval } from "./removalWords";
import {
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
import { facetOfAxis, type Facet } from "./refineFacets";
import { harvestRefinement, maskedEditingEnabledFor, refusingRegionReader, type RegionReader } from "./maskedRefine";
import { COVERAGE_BANDS, coverage } from "./maskGeometry";
import { createFalRegionReader } from "./falRegionReader";
import { createFalMaskedEditEngine } from "../providers/falImages";
import {
  captionClause,
  captionRealization,
  dropFacets,
  staleCaptions,
  type RealizationCaptions,
} from "./realizationCaption";
import { detectRenderFault } from "./renderFault";
import {
  advisoryMisses,
  confirmVerdict,
  missingFacts,
  verifyRender,
  type RenderVerdict,
} from "./renderVerification";
import {
  capturePresentation,
  presentationInvalidatedBy,
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
const EDIT_PROSE = {
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
  if (!parsed.ok) {
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
      parsed = asEdit;
      editDelta = asEdit.delta;
    }
  }

  if (parsed.intent === "remove") {
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
    const matched = matchSteps(predecessorChain, {
      subject: readRemovalSubject(parsed.subject),
      match: parsed.match,
      /*
        Identity beats word overlap — the parser resolved the referent and the
        code already proved the echo is a stored item (D-173). Without this the
        matcher falls to the word path with no narrowing words, which deletes
        EVERY step on the facet: "remove the earrings" took the glasses too.
      */
      items: parsed.items,
    });
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
          const seen = await reader.region({ image: shown.bytes, name: parsed.match });
          const area = coverage(seen);
          /* Above the class band it is really there; a confident speck is not. */
          const band = COVERAGE_BANDS.eyewearFrames;
          faceWearsIt = area >= band.min;
          log.info(
            { userId: input.userId, candidate: input.candidatePublicId, asked: parsed.match, coverage: Number(area.toFixed(5)), faceWearsIt },
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
      return selectAndReport(asTarget(already), "You already have that version — nothing charged.");
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
    AND IT IS NOT RE-CAPTURED EITHER (D-187, completing the fix).

    Retiring the pin was half of it. On the FIRST edit of a chain there is no
    pin to retire, so "change her hair to a blunt bob" read the base, captured
    "up, in bun", and handed the render an ALREADY TRUE clause contradicting the
    instruction in the same prompt — D-183's lying pin, arriving by a different
    door. A fact this edit is about to invalidate must not be born.
  */
  const invalidated = new Set(presentationInvalidatedBy(writtenFacets));
  const baseKeyForPresentation = source.candidate.imageKey;
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
  const preview = composeRenderPrompt(composed, EDIT_PROSE, captionClause(carriedCaptions));
  const dropped = missingFromPrompt(composed, preview.edits);
  if (dropped.length > 0) {
    log.error({ dropped }, "[refineService] composition would drop filed facts — refusing");
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
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
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
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
  const contradicted = contradictedFacets(preview, composed);
  if (contradicted.length > 0) {
    log.error({ contradicted }, "[refineService] the tail would protect an edited facet — refusing");
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "That edit would have asked for a change and forbidden it in the same breath, "
        + "so it was refused rather than rendered. Nothing was charged.",
    });
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
    const composedPrompt = composeRenderPrompt(filed, EDIT_PROSE, captionClause(carriedCaptions));
    const filedContradictions = contradictedFacets(composedPrompt, filed);
    if (filedContradictions.length > 0) {
      log.error(
        { operationId, variant: variant.publicId, filedContradictions },
        "[refineService] the filed row composes a self-contradicting prompt — refusing",
      );
      throw new Error("the filed refinement would forbid the change it asks for");
    }
    const prompt = composedPrompt.full;

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
        facets: Array.from(facetsWrittenBy(composed)),
        reader: dependencies.regions ?? defaultRegionReader(),
        /* Per user, not per deploy — the first flip goes to one account. */
        userId: input.userId,
        /* What the instruction said the thing IS. An earring hangs from a lobe
           and glasses sit at the eyes, so the placement needs the words, not
           just the slot they landed in. */
        described: itemsOf(composed.free?.statedAccessories).join(" ") || undefined,
        operationId,
      });
      return { ...painted, bytes: harvested.bytes, contentType: harvested.contentType };
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
    const facts = Array.from(facetsWrittenBy(composed)).flatMap((facet) => {
      const asked = currentIdentity
        ? currentValueOfFacet(applyDelta(currentIdentity, composed), facet)
        : null;
      return asked ? [{ facet, asked, binding: guaranteedFacets.has(facet) }] : [];
    });
    /*
      AND THE PINNED PRESENTATION (D-186), which is the fourth symptom.

      Hair worn up drifted to worn down because no named value existed for the
      net to check. It has one now, so the net checks it — these are short
      categorical values, unlike the descriptive captions, which is exactly why
      only this class is verifiable without inviting false failures.
    */
    for (const facet of PRESENTATION_FACETS) {
      const pinned = carriedCaptions[facet];
      if (pinned && !facts.some((fact) => fact.facet === facet)) {
        /* Read from a photograph rather than chosen from a vocabulary, so it is
           watched rather than enforced — same reasoning as the free lane. */
        facts.push({ facet, asked: pinned, binding: false });
      }
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
      const read = () => verifyRender({
        bytes: rendered.bytes,
        contentType: rendered.contentType,
        facts,
        engine: dependencies.verifier,
      });
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
        missingFacts(verification).join(", "),
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
          checks: verification.checks,
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
      error: new TRPCError({
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
  if (!(error instanceof ProviderError) || error.failureClass !== "facts_missing") return null;
  const missing = error.message.trim();
  return missing
    ? `That one came back twice without ${missing}, so it wasn't delivered and your credits `
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
    NAMES WHAT WAS MISSING. The throw carries the facts, so the receipt can say
    which ones rather than making support re-derive them from a log.
  */
  if (error instanceof ProviderError && error.failureClass === "facts_missing") {
    const missing = error.message.trim();
    return missing
      ? `Refine refunded — the render was missing ${missing}`
      : "Refine refunded — the render was missing what you asked for";
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
