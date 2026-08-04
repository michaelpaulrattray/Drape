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
import { getOwnedCandidateWithSelectedFace } from "../db/castingV2";
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
import type { Facet } from "./refineFacets";
import {
  captionClause,
  captionRealization,
  dropFacets,
  staleCaptions,
  type RealizationCaptions,
} from "./realizationCaption";
import { detectRenderFault } from "./renderFault";
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

/** How many refinements one candidate may carry. */
const MAX_INSTRUCTIONS = 12;

export type RefineInput = {
  userId: number;
  clientRequestId: string;
  candidatePublicId: string;
  instruction: string;
};

export type RefineResult = {
  /**
   * Whether this cost anything (D-163 rule 4).
   *
   * `"selected"` means the recipe they described already existed as a picture,
   * so they were given it and charged nothing. Absent on the rows replayed from
   * operations written before typed removal, which were all renders.
   */
  kind?: "rendered" | "selected";
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
  for (const [subject, value] of Object.entries(readDelta(predecessorForParse?.deltas)?.free ?? {})) {
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

  const parsed = await (dependencies.interpret ?? interpretRefinement)({
    instruction: input.instruction,
    prior: priorItems,
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
  /* A likeness comparison rode this ask and was set aside (D-181). */
  const droppedReference = "droppedReference" in parsed && parsed.droppedReference === true;
  let chain: ChainStep[] = predecessorChain ?? [];
  let removedFacets = new Set<Facet>();

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
      if (!echoedSomething && !textMentions(recorded, parsed.match)) {
        const named = parsed.match
          ?? (subject ? FREE_SUBJECTS[subject as FreeSubject]?.toLowerCase() : null)
          ?? "that";
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
        instruction: input.instruction,
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
    ? [...priorInstructions, input.instruction.trim()]
    : chain.map((step) => step.instruction);
  const stepDeltas = editDelta
    ? [...readStepDeltas(predecessor?.stepDeltas), editDelta]
    : chain.map((step) => step.delta);
  const composed = editDelta
    ? composeDeltas([readDelta(predecessor?.deltas) ?? {}, editDelta])
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
          delta: (readDelta(variant.deltas) ?? {}),
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

    It used to fire before the instruction was even read, so a face carrying its
    twelfth refinement could not be UNDONE — the one thing someone at the
    ceiling is most likely to want, refused for being a refinement it is not.
    Only a chain that grows is capped.
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
      stepDeltas,
      /*
        WHAT THEY TYPED, kept apart from the recipe (D-163).

        For an edit these agree. For a REMOVAL they must not: the removal
        sentence is deliberately absent from `instructions`, because removal is
        memory surgery — so without this the in-flight ghost chip would show the
        last SURVIVING sentence while the user waited on "remove the earrings".
      */
      requestText: input.instruction.trim().slice(0, 220),
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

    const image = await engine.editWithReferences({
      prompt,
      /* ONE reference, forever: the sharp original. */
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
    const delta = readDelta(entry);
    /* A step that will not re-read is a hole in the chain, and a chain with a
       hole cannot be recomposed — so the whole chain is unusable, not just
       the step. Refusing beats quietly dropping somebody's earlier edit. */
    if (!delta) return [];
    steps.push(delta);
  }
  return steps;
}
