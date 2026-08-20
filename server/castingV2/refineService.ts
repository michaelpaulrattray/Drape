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
import {
  nameWhatIsMissing,
  outOfFrameMessage,
  partlyOutOfFrameNote,
  withoutWhatIsOutOfFrame,
} from "./castingFrame";
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
import {
  ProviderError,
  refusesAfterRender,
  type ProviderFailureClass,
} from "../providers/types";
import { storagePublicUrl, storagePut, storageReadBytes } from "../storage";
import { thumbnailOf } from "./thumbnails";
import { withTransaction } from "../db/connection";
import { createStorageCleanupManifestIn } from "../db/storageCleanup";
import {
  EYE_SHAPE_RENDER,
  HAIR_COLOUR_RENDER,
  HAIR_TEXTURE_RENDER,
  IRIS_RENDER,
} from "./realizedAxes";
import { accessoryKindOf, EYEWEAR_REGION, pairClauseFor } from "./accessoryKinds";
import { vacantPhraseFor } from "./vacancyPhrases";
import { slotWordsRefusal } from "./slotWordShape";
import { hairStyleByName } from "./hairStyles";
import {
  FREE_SUBJECT_KEYS,
  FREE_SUBJECTS,
  REPAINT_ONLY_SUBJECTS,
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
  filedSubjectsOf,
  itemsOf,
  missingFromPrompt,
  presenceItemsOfFacet,
  withoutFacets,
  presentationOf,
  presentationWordsOfFacet,
  /* `readDelta` is deliberately NOT imported here any more. This module reads
     its own persisted rows, and the strict reader — which guards the boundary
     where a MODEL'S REPLY enters the record — is the wrong instrument for that
     boundary; using it at wall (d) cost the open lane its headline ask
     (fable-881 §3). If a future line here wants it, that is the question to
     answer first. */
  REFINABLE_AXES,
  type RefineDelta,
} from "./refineDelta";
import { sameStep } from "./railTakes";
import { skippedOnReplay } from "./replayDoors";
import { interpretRefinement, refusalMessage } from "./refineInterpreter";
import { readStoredDelta } from "./refineLegacy";
import { removalEvidence } from "./removalWords";
import {
  recordReferenceRead,
  type ReferenceReadOutcome,
} from "../db/castingV2ReferenceReads";
import { issueReadToken, type ReferenceReadIntent } from "./referenceProvenance";
import { resolveAskReference } from "./askReference";
import {
  readWordsTake,
  refusalIsAnswerableByAReader,
  wordsTakeIntentFor,
} from "./referenceWordsLane";
import { cutHairCarrier, mintHairCarrier, SECOND_VIEW_UNUSED_NOTE } from "./hairReferenceCutter";
import { hairTakeEntry, hairTakeSentence, resolveHairTake } from "./hairReferenceTake";
import {
  inkAskAddressOf,
  inkAskIntents,
  inkReferenceNote,
  inkTakeSentence,
  namesInkFromReference,
  resolveInkReferenceTake,
} from "./inkReferenceTake";
import {
  cropTakeAllowedOn, readReferenceMedium, DRAWN_NARROWED_NOTE,
} from "./referenceMediumDoor";
import {
  DISCARD_THE_DESIGN,
  LEAVE_AS_SHE_IS,
  alreadyUpsweptReask,
  glassesHideEyesReask,
  colourFacetLabel,
  colourFacetOf,
  didYouMeanReask,
  nearMiss,
  sameAgainReask,
  needsColourReferent,
  pendingReaskFor,
  redirectColourTo,
  resolveAnswer,
  whichFacetReask,
  whichSideReask,
  designNamedIn,
  residentNamedIn,
  replaceDesignReask,
  thisDesignReask,
  type Reask,
} from "./refineReask";
import {
  chainAfterRemoval,
  composeChain,
  facetOf,
  matchSteps,
  readChain,
  readRemovalSubject,
  reReadNamesAThingToHave,
  sameChain,
  textMentions,
  type ChainStep,
} from "./refineRemoval";
import { readStepProvenance, verifyReadToken, type StepProvenance } from "./referenceProvenance";
import { ENV } from "../_core/env";
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
import type { DeliveryAdjudication } from "./deliveryCourt";
import { mintedSlotsForRender } from "./mintedSlots";
import {
  deriveLibrary, instanceLastWritten, libraryWithoutEditedCrops, liveReferences,
  supersededCarrySlots,
} from "./referenceLibrary";
import { listLineageReferences, recordReferenceRows, retireReferenceSlot } from "../db/castingV2ReferenceLibrary";
import type { RegionReader as MintRegionReader } from "./referenceCompleteness";
import { readAppliedInk, withAppliedInk } from "./inkApplied";
import type { InkCutFocus } from "./inkReferenceCutter";
import { assembleRecipe, type CarriedInkDesign, type FeatureSlot } from "./recipeAssembler";
import {
  facetsOfSlot, slotDefinition, slotsForFacet, slotsForFeature, type SlotDefinition,
} from "./referenceSlotCatalogue";
import { isInkSlot, isOpenSlot, openKindCarriedByCrops, openSlotKey } from "./referenceSlots";
import { inkDesignForAsk, slotPlacementOf, type InkAskAddress } from "./inkDesignForAsk";
import { sidesForInkPlacement } from "../../shared/inkReleasedPlacements";
import { INK_PLACEMENTS } from "../../shared/inkPlacementVocabulary";
import { mintInkDesignFromReference } from "./inkReferenceMint";
import { listInkDesigns } from "../db/castingV2InkDesigns";
import { listInkDeliveryCrops } from "../db/castingV2InkDeliveryCrops";
import { mintInkDeliveryCrop } from "./inkDeliveryMint";
import { removeInkDesign } from "../db/castingV2InkDesignRemoval";
import { inkDesignImagePath } from "../../shared/inkDesignDelivery";
import type { InkCutRoute } from "../../shared/inkCutRoute";
import { openLaneOutcomeOf } from "./openLaneAccept";
import { openKindPresenceBindsToday } from "./openKindPolicy";
import { readOpenKinds } from "./openLaneKind";
import { recordOpenLaneDemand } from "../db/castingV2OpenLaneDemand";
import { readOpenKindProperties } from "../db/castingV2OpenKindProperties";
import { repaint, type ReferenceFitter, type RepaintEngine, type SentRequest } from "./repaintRender";
import {
  RepaintCannotSayError, repaintAsksFor, repaintCannotRemove, scopedAskIsUnsayable,
} from "./repaintAsks";
import { attachedPictureUnusedNote, cannotSaySentence, likenessSetAsideNote } from "./cannotSayCopy";
import { censusOfAttempt, censusSoFar, type CallCensus } from "./callCensus";
import { carriesAfterPruning } from "./prunedCarries";
import { countRefusal } from "./refusalCounter";
import { refusal, refusalOf } from "./refusalTag";
import { padToFrame, studioBackgroundOf, type StudioBackground } from "./referenceFit";
import { pronounsForSex } from "./castPronouns";
import {
  captureCastingReferenceLibraryEnabled,
  captureCastingOpenLaneEnabled,
  captureCastingRefineDispatchEnabled,
  captureCastingRepaintEnabled,
  captureCastingSidePhrasingEnabled,
  captureCastingHairReferenceEnabled,
  captureCastingInkReferenceEnabled,
} from "./castingV2Scope";
import { isUpsweptAsk, readCanthalTilt } from "./eyeShapeRouting";
import { alreadyUpswept, wearsGlassesByPixels } from "./canthalTilt";
import { INVISIBLE_AT, binaryCoverage, coverage } from "./maskGeometry";
import { boundsOf } from "./segmentCuts";
import { invisibleRemovalNote, readSiteVisibility } from "./invisibleRemoval";
import { departureFloorFor } from "./bornWornDetector";
import { createFalRegionReader } from "./falRegionReader";
import { createFalMaskedEditEngine } from "../providers/falImages";
import { ProviderQueue } from "../providers/providerQueue";
import { falAllowanceOf } from "./falBudget";
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
  aboutFacet,
  aboutOpenKind,
  advisoryMisses,
  confirmVerdict,
  facetIn,
  joinClauses,
  missingFacts,
  settleCarriedChecks,
  shortfalls,
  scopedToInstance,
  verifyRender,
  type FacetCheck,
  type RenderVerdict,
  type VerifiableFact,
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
  /**
   * THE RECTANGLE SHE POINTED AT (fable-444, ruling C).
   *
   * A slot key — `eye@left` — meaning *this ask is about that one instance*.
   * The panel already draws a rectangle per instance and the library already
   * stores one row per instance; this is the third piece, and it is the only
   * new one: the ask narrows to the clicked slot, so `eye@right` is not
   * mentioned in the recipe at all.
   *
   * Validated at the door rather than trusted: a scope that names nothing this
   * instruction writes is REFUSED, free, because a scope that silently reverts
   * to a whole-face render is how a per-eye edit becomes a both-eyes charge.
   *
   * Absent is the whole-face ask, which is every render before this one.
   */
  scope?: string;
  /**
   * THE STEP SHE POINTED AT — a chip's own remove (V3(c), the chip surface).
   *
   * A typed removal is ambiguous, so the service reads the sentence, matches it
   * against the chain and asks the picture whether the chain put the thing
   * there. **A click is not ambiguous**: she pointed at a step, the step is in
   * the chain, and re-deriving either fact by guesswork is how a removal takes
   * the wrong one when two steps share words.
   *
   * `at` is the step's index in the chain and `instruction` is the sentence the
   * client drew that index FROM. They are checked against each other, because a
   * client can be stale — she clicked while another edit landed — and a stale
   * index prunes a step nobody chose. A mismatch refuses, free.
   *
   * Absent on every typed refinement, which is all of them until the chip
   * affordance ships.
   */
  removeStep?: { at: number; instruction: string };
  /**
   * THE VERSION THIS IS A FRESH TAKE OF — the replay marker (fable-733 §2).
   *
   * Regenerate means *"the same ask again, landed differently"*, so every door
   * that refuses because her CURRENT state already satisfies the ask is
   * refusing on the replay's own premise: she has it BECAUSE of the version
   * being regenerated. Three of those doors have caught the founder in
   * sequence — the per-side gate, the confirm-chip rectangle, and the
   * already-has door — which is why this is a marker rather than a fourth
   * patch. `replayDoors.ts` holds the classification and pins it.
   *
   * **Named, not asserted.** This is the version's public id, and the server
   * checks it rather than believing it: it must be the predecessor this render
   * is built on, and that row's own `requestText` must be the sentence being
   * sent. Two strings this server wrote, compared — the same shape
   * `offeredAgain` already uses one field up.
   *
   * A bare `replay: true` would have been shorter and wrong. The doors it
   * turns off exist to stop somebody being charged 25 credits for a render
   * that changes nothing, so a client that could assert its way past them
   * could spend a user's money on a no-op.
   *
   * Absent on every typed ask, and on the reask path, which sets the same
   * marker through `answering` instead.
   */
  replayOf?: string;
  /**
   * THE READ SHE ADOPTED THESE WORDS FROM, if any — opaque, and proved rather
   * than believed (ruled fable-968 §3c).
   *
   * `readMakeup` hands this back with its sentence; the client may carry it
   * into the refine that spends the sentence. The server verifies the
   * signature, the account, the Cast and the freshness, then compares her
   * instruction's hash to the one it sealed — so what lands in the row is a
   * fact this server derived, never a flag the client set.
   *
   * A DECORATION ON A PAID OPERATION, and it behaves like one: absent, stale,
   * or wrong, the refine proceeds exactly as an ordinary typed one and the step
   * simply carries no provenance.
   */
  provenanceToken?: string;
  /**
   * THE PICTURE SHE ATTACHED TO THIS ASK — the reference lane
   * (`UNIVERSAL_REFERENCE_ROAD_DESIGN.md` §2, hair first per fable-1071 §1).
   *
   * The attach is its own door and its own upload; what travels here is the
   * HANDLE it minted. A refine is spendable and rate-limited, and hanging a
   * multi-megabyte base64 on it would make every paid ask carry a photograph.
   *
   * **Named, not trusted, and re-anchored to this Cast.** The handle is
   * resolved in a statement that carries the owner (invariant 1) and the row it
   * returns must belong to the candidate being refined (invariant 2) — an
   * attachment of hers on a different Cast is not this ask's reference, and
   * verifying the handle would not have caught that.
   *
   * Absent on every ask before this lane, which is all of them today: the flag
   * that arms it is off everywhere.
   */
  referenceId?: string;
};

export type RefineResult = {
  /**
   * Whether this cost anything (D-163 rule 4).
   *
   * `"selected"` means the recipe they described already existed as a picture,
   * so they were given it and charged nothing. Absent on the rows replayed from
   * operations written before typed removal, which were all renders.
   */
  kind?: "rendered" | "selected" | "asked" | "dispatched";
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
  /**
   * What happened, for the panel to say.
   *
   * Two kinds of outcome need one: a FREE one, where silence would leave
   * someone assuming they had just spent 25 credits (D-163 rule 4); and a PAID
   * one that could only be served in part, where silence is the product
   * deciding something on the customer's behalf without telling them (D-181,
   * fable-386 §2). The panel says it whenever it is here — a reader that only
   * looks at one kind of outcome makes the other kind's confession inert, which
   * is what had happened to the dropped reference for its whole life.
   */
  note?: string;
  /**
   * The operation this ask is being rendered under — only on a RECEIPT.
   *
   * Landing C's dispatched answer names it for the same reason the failure
   * sentences do: it is the one string support can act on, and the panel that
   * shows a render running should be able to quote what is running.
   */
  operationId?: string;
  /**
   * A SENTENCE TO ADOPT, read off the picture she attached — free, and nothing
   * has happened yet (the words lane, ruled fable-1103 §1).
   *
   * It is not a `note` because it is not a statement about an outcome: it is an
   * offer she picks up, edits or ignores, and the surface has to draw it as one
   * — the sentence, and a control that fills her box and STOPS. That shape is
   * the road's licence as much as its manners: `refineDelta` requires the value
   * to appear in the customer's own instruction, so a sentence routed around
   * her is refused by a guard that has stood since D-171.
   *
   * `dropped` is what the reading could not fit, NAMED — the only useful thing
   * she can do with it is type it herself, and a count would tell her nothing.
   */
  /**
   * THE DESIGN THIS ANSWER IS ABOUT, at the address its owner may look at it
   * (ruled fable-1156 §2e).
   *
   * On the OFFER it is the whole point: the question asks *"use it?"* about a
   * picture, and a question about a picture nobody can see is not a question.
   * On a RENDERED answer it is the other half of "see or reject" — until this
   * existed, a design minted inside an ask was a row its owner could never
   * name, and `castingV2.ink.remove` takes a name.
   *
   * The path is built by `inkDesignImagePath` and by nothing else, so the
   * product has one spelling of this address (`shared/inkDesignDelivery.ts`).
   * It is an authenticated app route, never a storage URL: the bytes sit at a
   * permanently public key and what keeps them private is that the key is not
   * handed out.
   */
  design?: {
    designId: string;
    imagePath: string;
  };
  offer?: {
    sentence: string;
    intent: "makeup" | "hair";
    dropped: string[];
    /** Carried back on the ask she sends, so `verbatim` or `edited` is a fact
     *  the service derives rather than a claim anybody makes. */
    provenanceToken?: string;
  };
};

/**
 * THE WORDS LANE'S ONE READ, with everything around it that is not the reading.
 *
 * Hoisted out of `refineCandidate` so the paid path's own function does not
 * grow a second story: what is here is the bytes, the token, the tally and the
 * sentence, and every one of them is free.
 *
 * **The bytes are fetched by the SERVER from the key it holds.** The key never
 * leaves this process — it is a permanently public address for a photograph of
 * a person, and handing one out before something needs it is a URL that
 * outlives every reason it was minted for.
 *
 * **The token is what makes her adoption provable.** She is shown a sentence,
 * she edits it or does not, and the ask she sends carries this back: the
 * service verifies the signature, this account, this Cast and the freshness,
 * and derives `verbatim` or `edited` from the signed digest itself. Minting cannot
 * fail an answer she is owed, so a failure to sign is silence rather than a
 * refusal.
 *
 * **And the tally records THAT a read happened and how it ended** — never the
 * sentence, never the account, never the Cast. Fire-and-forget: telemetry may
 * not take an answer away from somebody who asked for one.
 */
async function readTheWordsTake(input: {
  intent: ReferenceReadIntent;
  reference: { storageKey: string; mime: string };
  userId: number;
  candidateId: number;
  dependencies: RefineServiceDependencies;
}): Promise<
  | { kind: "offer"; offer: NonNullable<RefineResult["offer"]> }
  | { kind: "refusal"; message: string }
> {
  const stored = await (input.dependencies.readBytes ?? storageReadBytes)(input.reference.storageKey);
  const reading = await (input.dependencies.readWords ?? readWordsTake)({
    intent: input.intent,
    bytes: stored.bytes,
    contentType: input.reference.mime,
  });
  void recordReferenceRead(input.intent, reading.outcome as ReferenceReadOutcome);
  if (!reading.ok) return { kind: "refusal", message: reading.message };

  const provenanceToken = (() => {
    try {
      return issueReadToken({
        secret: ENV.cookieSecret,
        userId: input.userId,
        candidateId: input.candidateId,
        intent: input.intent,
        sentence: reading.sentence,
        issuedAt: Date.now(),
      });
    } catch {
      /* Minting cannot fail an answer she is owed. */
      return undefined;
    }
  })();

  return {
    kind: "offer",
    offer: {
      sentence: reading.sentence,
      intent: input.intent,
      dropped: [...reading.dropped],
      ...(provenanceToken ? { provenanceToken } : {}),
    },
  };
}

export type RefineServiceDependencies = {
  begin?: typeof beginDirectOperation;
  markRunning?: typeof markGenerationOperationRunning;
  deduct?: typeof deductCredits;
  refund?: typeof recordRefund;
  engine?: () => ReturnType<typeof castingIdentityEngine>;
  interpret?: typeof interpretRefinement;
  /**
   * WHAT SHE IS TAKING FROM THE PICTURE SHE ATTACHED, and WHERE IT IS PUT.
   *
   * Two seams rather than one, because the two failures are different: the take
   * is a reading of her sentence that can escalate to a text engine, and the
   * mint writes bytes to a bucket. A suite driving the reference lane must be
   * able to do both without a provider and without R2 — the reader itself
   * already arrives through `regions`.
   */
  hairTake?: typeof resolveHairTake;
  mintCarrier?: typeof mintHairCarrier;
  /** Whether her picture is a photograph or a drawing — the class door's
   *  reader, injected so the suite drives the routing without a vision call. */
  readMedium?: typeof readReferenceMedium;
  /** The reader that checks the picture against the record (D-185). */
  verifier?: Parameters<typeof verifyRender>[0]["engine"];
  admit?: () => boolean;
  /** The brief that knows what she was drawn wearing (D-206). */
  readBaseWorn?: typeof getBriefForOwnedCandidate;
  readBytes?: typeof storageReadBytes;
  /** The words lane's reader — so the lane can answer, refuse and throw in a
   *  suite with no transport and no bucket. */
  readWords?: typeof readWordsTake;
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
  /**
   * Whether the recipe also says WHERE a named side is.
   *
   * The third scope flag this service branches on, and the only one that had no
   * seam — so the clause could be proven inside the assembler (which takes
   * `placeSides` as an input) and inside the boot guard, and NOWHERE at the
   * wire between them. That gap is how a suite ends up asserting one road while
   * the founder is on another: the wiring is exactly the part a per-user flag
   * hides (opus-469, on fable-625 §3's enumeration).
   */
  sidePhrasingEnabled?: (userId: number) => boolean;
  /**
   * Whether an out-of-vocabulary ask may name its own kind — the open lane.
   *
   * A predicate for the same reason as its three siblings, and it reaches the
   * interpreter rather than the painter: it decides the SYSTEM PROMPT the
   * customer's sentence is read with, and whether the acceptance door is
   * consulted at all.
   */
  openLaneEnabled?: (userId: number) => boolean;
  /**
   * THE TATTOO TAKE, injectable so its court runs without a transport.
   *
   * Its own seam rather than a reuse of `hairTake`: the two answer different
   * questions about the same sentence, and a suite that could only stub both at
   * once could not drive one road with the other left real.
   */
  inkTake?: typeof resolveInkReferenceTake;
  /** Test seam. The shipped read is owner-scoped on both sides of its join,
   *  so a double that ignored the owner would be testing a different door. */
  listInkDesigns?: typeof listInkDesigns;
  /** Test seam, same terms as its sibling above — owner-scoped on both sides of
   *  its own join, so a double that ignored the owner tests a different door. */
  listInkDeliveryCrops?: typeof listInkDeliveryCrops;
  /**
   * KEEPING THE TATTOO AS IT LANDED — clause (a)'s mint, injected for the same
   * reason the design mint is: it decodes a frame, calls a segmenter, writes an
   * object and files a row, and a suite must be able to drive the ORDER around
   * it without any of the four.
   */
  mintInkDeliveryCrop?: typeof mintInkDeliveryCrop;
  /**
   * FILING THE DESIGN IN HER PICTURE — the attach-pointed mint, injected for
   * the same reason its siblings are: it fetches bytes, calls a segmenter and
   * writes a row, and a suite must be able to drive the ORDER around it
   * without any of the three.
   */
  mintInkDesign?: typeof mintInkDesignFromReference;
  /**
   * THROWING ONE AWAY when she says the cut is not her design (fable-1156 §2a).
   *
   * The shipped removal carries the authenticated owner inside its own
   * statement and hands the design's objects to the cleanup manifest in the
   * same transaction, so a double here is a seam for the ORDER around it and
   * never a way to delete something this service picked.
   */
  removeInkDesign?: typeof removeInkDesign;
  /**
   * MAY THIS ACCOUNT TAKE HAIR FROM A PICTURE — the hair road's own question,
   * asked at the hair road (ruled fable-1163 §2).
   *
   * It used to be answered by the reference resolver's gate, which was the hair
   * flag; the day that gate became the OR of every road that can act on a
   * picture, an ink-only account would have inherited the hair crop lane for
   * free. So the lane asks for itself, and both halves landed together.
   */
  hairReferenceEnabled?: (userId: number) => boolean;
  /** `CASTING_INK_REFERENCE_SCOPE`, injectable for the same reason as its siblings. */
  inkReferenceEnabled?: (userId: number) => boolean;
  /** Writes the sent recipe onto the variant at dispatch — see `recordVariantDispatch`. */
  recordDispatch?: typeof recordVariantDispatch;
  /**
   * Brings each reference to the master's geometry before dispatch.
   *
   * Injectable so a suite can drive the padding decision directly — the default
   * reads real image bytes, and a test that had to mint a valid PNG per case to
   * exercise one branch would be testing sharp.
   */
  fitReference?: ReferenceFitter;
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
/**
 * ONE QUEUE FOR EVERY PAID EDIT, not one per edit (fable-511).
 *
 * This factory ran per refine, and `createFalMaskedEditEngine` builds its own
 * `ProviderQueue` when it is handed none — so N concurrent edits meant N queues
 * of four, which is a limit that rises with load and therefore is not one. The
 * account's ceiling is spent by five paths (`falBudget.ts`) and this is one of
 * them, so its allowance lives in the table and its queue lives here, once.
 */
let maskedEditQueue: ProviderQueue | null = null;

function refineEditQueue(): ProviderQueue {
  if (!maskedEditQueue) {
    maskedEditQueue = new ProviderQueue({
      name: "fal-refine-edits",
      concurrency: falAllowanceOf("REFINE_EDIT_CONCURRENCY"),
      maxQueueDepth: 32,
    });
  }
  return maskedEditQueue;
}

function defaultMaskedEditEngine() {
  return createFalMaskedEditEngine({
    apiKey: process.env.FAL_KEY ?? "",
    queue: refineEditQueue(),
  });
}

function defaultRegionReader(): RegionReader {
  const apiKey = process.env.FAL_KEY;
  return apiKey ? createFalRegionReader({ apiKey }) : refusingRegionReader;
}

/**
 * AN UNCATALOGUED SLOT NEVER DEPARTS THROUGH THE VACATE PATH (fable-775 §2).
 *
 * `openKindDeparture()` is `dropTheCarry` — an open kind is absent from the
 * master, so ceasing to carry it is ceasing to paint it. No vacancy row, no
 * absence phrase about a thing her master never had. The vacate loop is the
 * closed lane's machinery, and such a key reaching it is a defect rather than
 * a path, which is why this is loud rather than a refusal: nothing a customer
 * can type should be able to produce it.
 *
 * **It needs its own door because the guard beside it cannot see this shape.**
 * That one fires on a slot with no `question`, and an open kind's question is
 * its own noun — non-null by construction (`OPEN_LANE_CARRY_DESIGN.md` §2), so
 * the guard the design read as this backstop is silent on exactly the key it
 * was read as catching. Past it, `departureFloorFor` is handed the open kind's
 * `guardKind: null` and returns a floor of ZERO, at which any non-empty mask
 * reads as *still there* and the removal is disputed on a floor nobody
 * measured — the unowned-axis class one layer below where it was looked for.
 *
 * # AND IT IS TWO NAMESPACES NOW, WHICH IS WHY IT IS NAMED FOR THE CLASS
 *
 * `ink:` arrived with the same two properties and neither of them by
 * coincidence: a design is an ADDITION the master never held, and its slot
 * carries `guardKind: null` because ink is never cut for the library
 * (fable-1137 §3). So the zero-floor sentence above is true of it word for
 * word. Written into this guard on the commit that MINTED the namespace rather
 * than left for the sitting that first reaches the vacate path — working law 7,
 * whose second half is that a control keeps its reach only if somebody asks
 * what was bolted to a road when the road moves.
 *
 * Exported so it can be driven DIRECTLY rather than through a paid render
 * (working law 3). A guard whose only test runs the whole repaint path is a
 * guard proved by a path that usually behaves, and this is precisely the
 * refusal a suite would otherwise "prove" by never triggering it.
 */
export function assertNotAnUncataloguedDeparture(slot: FeatureSlot): void {
  if (isOpenSlot(slot)) {
    throw new Error(
      `${slot} is an open kind and departs by dropping its carry — it must never reach the vacate path`,
    );
  }
  if (isInkSlot(slot)) {
    throw new Error(
      `${slot} is an ink design and departs by dropping its carry — it must never reach the vacate path`,
    );
  }
}

/**
 * ONE PAID EDIT, WITH A STOPWATCH RUNNING ON IT (the latency-and-cost program).
 *
 * The founder's two sentences — *"5 minutes for 1 generation is absurd"* and
 * *"costs are getting ridiculous"* — are answered in the roadmap by the same
 * instruction: **stopwatch every stage before optimising**. This is the
 * stopwatch. It counts every outbound model call made anywhere inside one
 * request, at the transports themselves, so the total is the TOTAL rather than
 * the calls somebody remembered to instrument.
 *
 * It costs nothing: an async store entered once per request, a few dozen small
 * objects, and no extra work of any kind. A refusal is measured too — a slow NO
 * is a customer waiting, and it is the case with no artifact to inspect
 * afterwards.
 */
export async function refineCandidate(
  dependencies: RefineServiceDependencies,
  input: RefineInput,
): Promise<RefineResult> {
  /*
    WHETHER THE MONEY WAS EVER AT RISK, carried out of the attempt rather than
    inferred at the seam. Everything before the claim is a free refusal with no
    other artifact — the case the counter exists for. After it there is a
    variant row, a charge and a refund pair, so a failure there is already
    readable and putting it in this tally would mix two questions.
  */
  const attempt: RefineAttempt = { claimed: false };
  /*
    LANDING C — WHO IS STILL WAITING WHEN THE RENDER STARTS.

    Off (everywhere, at landing), `dispatched` is never set, nothing announces
    anything, and the two lines below are the two lines that shipped: one
    attempt, awaited whole, priced and answered on the request.

    On, the attempt announces its receipt the moment the row is dispatched, and
    this function races that announcement against the settled render. Whichever
    arrives first is what the customer is handed; the census and the pricing
    below run at SETTLEMENT either way, which is the bound the cost lane needs —
    a dispatched refine must never be read as a 200 ms render.
  */
  let announce: ((receipt: DispatchedReceipt) => void) | null = null;
  const receipt = new Promise<DispatchedReceipt>((resolve) => { announce = resolve; });
  /* Nothing is ever awaited on this promise when the flag is off, so it is
     never settled and never observed — an ordinary unresolved promise, not a
     leak. */
  if (captureCastingRefineDispatchEnabled(input.userId)) {
    attempt.dispatched = (given) => announce?.(given);
  }

  const settled = censusOfAttempt(
    () => refineCandidateCounted(dependencies, input, attempt),
  ).then(async (outcome) => {
    await priceTheAttempt(input, attempt, outcome);
    return outcome;
  });

  if (attempt.dispatched) {
    const first = await Promise.race([
      settled.then((outcome) => ({ arrived: "render" as const, outcome })),
      receipt.then((given) => ({ arrived: "receipt" as const, given })),
    ]);
    if (first.arrived === "receipt") {
      /*
        THE CATCH AT THE TOP OF DETACHED WORK.

        `censusOfAttempt` already returns a failure rather than throwing one, so
        this guards the pricing and the impossible rest — and it exists because
        "impossible" is how an unhandled rejection takes a process down with a
        paid render inside it. The OUTCOME is not swallowed here: every terminal
        path has already written its own sentence to `publicMessage`, which is
        the surface's source and the reason Landing A came first.
      */
      void settled.catch((fault) => {
        log.error(
          { userId: input.userId, candidate: input.candidatePublicId, err: fault },
          "[refineService] a dispatched refine failed outside its own compensation — the row is the record",
        );
      });
      return {
        kind: "dispatched",
        variantId: first.given.variantId,
        candidateId: input.candidatePublicId,
        imageUrl: first.given.imageUrl,
        instructions: first.given.instructions,
        operationId: first.given.operationId,
        /* The design this render is carrying, named on the receipt as it is on
           a delivered answer: a customer who stopped waiting must not be the
           one customer who cannot say which design rode (fable-1156 §2e). */
        ...(first.given.design ? { design: first.given.design } : {}),
      };
    }
    return answerOnTheRequest(first.outcome);
  }

  return answerOnTheRequest(await settled);
}

/** What the receipt carries out of the attempt (Landing C). */
type DispatchedReceipt = {
  variantId: string;
  operationId: string;
  imageUrl: string;
  instructions: string[];
  design?: RefineResult["design"];
};

/**
 * HOW AN ANSWER NAMES THE DESIGN IT IS CARRYING — one spelling, three roads.
 *
 * The offer, the rendered answer and the dispatch receipt all say the same
 * thing, and the path inside it is built by `inkDesignImagePath` and nothing
 * else. Three literals here would be three chances for one road to hand out a
 * storage URL while the other two did not (law 4).
 */
function designAnswerFor(
  source: { designId: string } | null,
): RefineResult["design"] | undefined {
  if (!source) return undefined;
  return { designId: source.designId, imagePath: inkDesignImagePath(source.designId) };
}

/**
 * THE PRICE OF ONE ATTEMPT, WRITTEN WHEREVER IT ENDED.
 *
 * Lifted out of the entry point unchanged when the dispatch swap landed: with a
 * receipt the request is long gone by the time the render settles, and a cost
 * line that only fires while someone is waiting would have priced exactly the
 * refines nobody was waiting on at zero.
 */
async function priceTheAttempt(
  input: RefineInput,
  attempt: RefineAttempt,
  outcome: { value?: RefineResult; error?: unknown; census: CallCensus },
): Promise<void> {
  const { error, census } = outcome;
  log.info(
    {
      userId: input.userId,
      candidate: input.candidatePublicId,
      delivered: error === undefined,
      calls: census.total.calls,
      failedCalls: census.total.failed,
      callMs: census.total.ms,
      wallMs: census.wallMs,
      byStage: census.byStage,
      byModel: census.byModel,
      /* WHICH QUESTIONS the minutes went on — the closed vocabulary only, a
         region name or a read purpose, never anybody's sentence. The latency
         and cost program's first question is "what are the nine calls", and
         this is the line that answers it without a special run.

         `labelledCalls` RIDES BESIDE IT and is not optional dressing. The two
         fields above count every call; this one counts only the labelled ones,
         so without the denominator a consumer reads a subset as the whole —
         the same trap as an absent token column reading as a free call. */
      labelledCalls: census.total.labelledCalls,
      byAbout: census.byAbout,
    },
    "[refineService] what this edit cost in calls and seconds",
  );
  /*
    THE ONE PLACE A REFUSAL IS COUNTED (opus-465, the class behind fable-498 §5).

    The counter was wired door by door and reached two of about twenty, so
    production had counted ZERO refusals on a morning the founder was refused in
    it. Counting here instead means a door that does not exist yet is counted
    the day it is written, and an untagged one is counted as a GAP rather than
    dropped. It cannot double-count: no free refusal counts itself any more.
  */
  if (error !== undefined && !attempt.claimed) {
    const named = refusalOf(error);
    if (named) {
      await countRefusal({
        userId: input.userId,
        candidateId: input.candidatePublicId,
        reason: named.reason,
        facet: named.facet,
        outcome: named.outcome,
      });
    }
  }
}

/**
 * The answer for whoever is still holding the request.
 *
 * Only reached when someone IS: a dispatched refine has already answered, and
 * its failure is a durable sentence on the operation row rather than a throw
 * into a socket that closed minutes ago.
 */
function answerOnTheRequest(
  outcome: { value?: RefineResult; error?: unknown },
): RefineResult {
  if (outcome.error !== undefined) throw outcome.error;
  return outcome.value as RefineResult;
}

/**
 * What the attempt tells the seam about itself.
 *
 * `claimed` answers whether the money was ever at risk. `dispatched` is Landing
 * C's seam, and it is a signal OUTWARD rather than a cut: the paid block is
 * three thousand lines of one `try`, and lifting it into a function to defer it
 * would have re-indented all of them for a change that is really one sentence —
 * *answer now, finish afterwards*. So the attempt announces the receipt at the
 * first moment it is TRUE, and the entry point decides whether anyone is still
 * waiting on the request. Absent when the flag is off, which is when nothing
 * about this path differs from the one that shipped.
 */
type RefineAttempt = {
  claimed: boolean;
  dispatched?: (receipt: DispatchedReceipt) => void;
};

async function refineCandidateCounted(
  dependencies: RefineServiceDependencies,
  input: RefineInput,
  attempt: RefineAttempt = { claimed: false },
): Promise<RefineResult> {
  const price = CASTING_V2_REFINE_PRICE_CREDITS;
  await assertNotFrozen(input.userId);

  /* ---- free refusals: nothing claimed, nothing charged ---- */

  const source = await getOwnedCandidateWithSelectedFace(input.userId, input.candidatePublicId);
  if (!source) {
    throw refusal("candidate_missing", {
      code: "NOT_FOUND",
      message: "That candidate is no longer available.",
    });
  }
  if (!source.candidate.imageKey) {
    throw refusal("master_missing", {
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
    throw refusal("already_signed", {
      code: "PRECONDITION_FAILED",
      message: "That face has already been signed. Nothing was charged.",
    });
  }

  /*
    A SCOPE THAT NAMES NOTHING IS REFUSED AT THE DOOR — free (fable-444 §3).

    `scope` says *this ask is about one instance*, and the whole value of it is
    that `eye@right` is never mentioned. A scope the catalogue does not know, or
    one naming a slot that is not an instance of anything, must therefore not
    fall through to a whole-face render: she would be charged for both eyes
    having asked for one, and the picture would look like a correct render of a
    different question. That is the shape this program keeps paying for, so the
    unknown scope stops here, before the claim, before the charge.

    The narrower half — a scope naming a slot THIS INSTRUCTION does not write —
    cannot be judged yet, because nothing has been interpreted at this point. It
    is caught downstream by `repaintAsksFor`, whose fan-out narrows to nothing
    and refuses with `notASlot` rather than painting.
  */
  /*
    AND THE OPEN LANE DOES NOT INHERIT SCOPABILITY BY RESOLVING ITS KEY
    (`OPEN_LANE_CARRY_DESIGN.md` §4, finding 1).

    This door was written as *the catalogue cannot name it*, and for an open
    kind that was true only for as long as nothing could. `slotDefinition` now
    resolves `open:<noun>` so the crop can carry — and the moment it does, an
    uncatalogued kind silently becomes scopable through this line: *her left
    one, longer*.

    Three separate rulings withhold exactly that, and none of them is written
    here: `ZONE_SCOPE` is `fullFrame`, `bilateralPair` is forbidden until
    promotion, and §5 rules that the one-of-a-pair ask refuses into the refund
    rather than guessing — the earring history not repeated. So the refusal is
    restated in its own terms rather than left resting on a resolver that has
    stopped answering the question it was being asked.

    This is the unowned-axis class arriving through the back door: nobody would
    DECIDE that open kinds are scopable, and without this branch nobody would
    have decided they are not, either.
  */
  if (input.scope !== undefined && isOpenSlot(input.scope)) {
    throw refusal("scope_unknown", {
      code: "BAD_REQUEST",
      message: "I don't know which part of her that is. Nothing was charged.",
    });
  }
  /*
    AND THE INK LANE DOES NOT EITHER — the same finding, the same sentence, one
    namespace later (fable-1137 §2a).

    `slotDefinition` resolves `ink:neck` since the catalogue chunk, for the same
    reason it resolves an open key: so a design can be CARRIED. Scopability is a
    different question and nobody has answered it — a scope is *this ask is
    about one instance of a thing on the panel*, and a design has no panel row
    to point at until the ink studio exists (fable-1138 §3). Without this line
    the answer would be yes, arrived at by nobody, which is the unowned-axis
    class coming through the back door a second time.

    Restated in its own terms rather than left resting on the resolver below,
    which has stopped answering the question it is being asked here — exactly
    what the open branch above had to do when its key started resolving.
  */
  if (input.scope !== undefined && isInkSlot(input.scope)) {
    throw refusal("scope_unknown", {
      code: "BAD_REQUEST",
      message: "I don't know which part of her that is. Nothing was charged.",
    });
  }
  if (input.scope !== undefined && slotDefinition(input.scope) === null) {
    throw refusal("scope_unknown", {
      code: "BAD_REQUEST",
      message: "I don't know which part of her that is. Nothing was charged.",
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
  /*
    AND ONE OUTSTANDING QUESTION THAT CANNOT BE RE-DERIVED FROM THE SENTENCE.

    `pendingReaskFor` re-reads the words alone, which is right for a typo or a
    colour with no referent. The same-again OFFER is not about the words — it is
    about what her current frame already is — so it is re-derived from the row:
    if the sentence being answered is the one that MADE this version
    (`requestText`, stored when it was rendered), the question in front of her
    was the offer. Two strings this server wrote, compared; never a guess at
    what she meant.
  */
  /*
    THE PICTURE SHE ATTACHED — resolved here, before any question is composed
    and long before anything is charged.

    Three refusals and all three are free. The flag is checked first, so a
    handle sent to an account outside the road is refused without a database
    read at all; then the row is read in a statement carrying HER user id
    (invariant 1); then the row's candidate is compared to the one being
    refined (invariant 2), because a reference of hers attached to a DIFFERENT
    Cast is not this ask's reference and no amount of verifying the handle
    catches that.

    It is `null` rather than a throw on refusal because the refusals below are
    hers to read, not exceptions to swallow — and `referenceAttached` must be a
    fact, not an assumption: the question is re-derived from it on the answer
    path, so a resolution that quietly succeeded once and failed the next time
    would produce a question nobody could answer.
  */
  const reference = input.referenceId
    ? await resolveAskReference({
      userId: input.userId,
      referencePublicId: input.referenceId,
      candidateId: source.candidate.id,
    })
    : null;
  if (input.referenceId && !reference) {
    return {
      kind: "selected",
      note: "That picture isn't attached to this Cast any more — attach it again and I'll take a look. Nothing was charged.",
      variantId: source.variantPublicId,
      candidateId: input.candidatePublicId,
      imageUrl: storagePublicUrl(source.imageKey ?? source.candidate.imageKey),
      instructions: readInstructions(predecessorForParse?.instructions),
    };
  }

  const answeringText = (input.answering ?? "").trim().toLowerCase();
  const madeThisVersion = (predecessorForParse?.requestText ?? "").trim().toLowerCase();
  const offeredAgain = answeringText.length > 0 && answeringText === madeThisVersion;
  const outstanding = input.answering
    ? (offeredAgain
      ? sameAgainReask({ asked: input.answering.trim(), priceCredits: CASTING_V2_REFINE_PRICE_CREDITS })
      : pendingReaskFor(input.answering, lastColourFacet != null))
    : null;
  const answered = outstanding ? resolveAnswer(outstanding, input.instruction) : null;
  const instruction = answered ?? input.instruction;
  /*
    SHE SAID YES TO THE OFFER. The already-true door must not refuse the very
    thing it just offered, and the re-roll rides the version's own chain rather
    than adding one.
  */
  const answeredTheOffer = outstanding?.kind === "same-again"
    && answered !== null
    && answered !== LEAVE_AS_SHE_IS;
  /*
    SHE TAPPED "REPLACE IT" — and this is the ONLY thing that authorises a
    resident design's deletion (ruled fable-1158 §1, shape countersigned
    fable-1163 §4).

    Read here, beside its sibling, because this is where an answer is turned
    back into an instruction and it must never be inferred anywhere else. Three
    conditions and each removes a way a row could die unasked:

      the outstanding question was the REPLACE OFFER — rebuilt by handle from
      what the client echoed, not guessed from her words;

      an answer was RECOGNISED. A reply that resolves to nothing is not a "no",
      it is her moving on, and it runs as a fresh instruction with both designs
      still standing;

      and the answer was not the DISCARD sentinel, which destroys the new row
      and leaves the resident exactly where it was.

    The two ids come from the handle rather than from a re-read of the address,
    because re-deriving the resident on the answer path is a second look at an
    unstable thing immediately before a deletion — and the deletion is spent
    down at the ride, where the row that replaces it is certain (see there).
  */
  const adoptedReplacement = outstanding?.kind === "replace-design"
    && answered !== null
    && answered !== DISCARD_THE_DESIGN
    ? {
      adopted: designNamedIn(input.answering),
      resident: residentNamedIn(input.answering),
    }
    : null;
  /*
    AND THE OTHER DOOR INTO THE SAME ROOM — the Regenerate BUTTON (fable-733).

    The marker above can only be set by answering the offer, and the button
    never answers anything: it calls `onRefine(instruction, scope)` and sends no
    `answering` at all. So `confirmedRegenerate` was false on every press, the
    already-true door fired, and the founder was told *"She already has her
    right eye fiery red — this would have changed nothing"* about the one
    control whose entire meaning is the same ask again.

    PROVED RATHER THAN TRUSTED, and the shape is deliberately the one directly
    above: the client names WHICH version it is replaying and the server checks
    the claim against its own rows. The named version must be the predecessor
    this render is built on, and that row's `requestText` must be the sentence
    being sent. A bare `replay: true` would have let a client turn off the doors
    that stop somebody paying 25 credits for a render that changes nothing.

    `requestText` is null on every row landed before that column existed; those
    versions replay exactly as they always have, through the sentence alone.
  */
  const replayNames = (input.replayOf ?? "").trim();
  const replayedByButton = replayNames.length > 0
    && predecessorForParse !== null
    && predecessorForParse.publicId === replayNames
    && madeThisVersion.length > 0
    && madeThisVersion === input.instruction.trim().toLowerCase();
  if (replayNames.length > 0 && !replayedByButton) {
    /* Not a refusal — a replay claim that does not check out simply is not one,
       and the ask carries on as an ordinary sentence through every door. Logged
       because a client sending a stale version id is a real bug on the other
       side of the wire, and silence would hide it. */
    log.warn(
      {
        userId: input.userId,
        candidate: input.candidatePublicId,
        replayOf: replayNames,
        predecessor: predecessorForParse?.publicId ?? null,
      },
      "[refineService] a replay named a version this render is not built on — treating it as an ordinary ask",
    );
  }
  const confirmedRegenerate = answeredTheOffer || replayedByButton;

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
    SHE LOOKED AT THE CUT AND IT IS NOT HER DESIGN (the shown cut's decline,
    ruled fable-1156 §2a).

    Answered HERE, beside its sibling above and long before the parse, for the
    reason that sibling exists: there is no sentence meaning "throw that away",
    so it arrives as a sentinel and must never reach the interpreter. A decline
    that fell through would be read as an ordinary ask and RENDERED — the exact
    charge this whole question exists to stand in front of.

    **The design is named by the handle, not found by a guess.** Two designs cut
    from one picture at different placements are the same sentence, so a lookup
    from the words would be the unowned-axis default wearing a timestamp. The
    removal carries the AUTHENTICATED owner into its own statement (invariant
    3), which is what makes a forged handle worth nothing.

    It answers the same way whether a row was deleted or there was nothing to
    delete: from her side those are one state, and a response that told them
    apart would let a stranger's id be tested against ours.
  */
  if (answered === DISCARD_THE_DESIGN) {
    const named = designNamedIn(input.answering);
    if (named) {
      const removal = await (dependencies.removeInkDesign ?? removeInkDesign)({
        userId: input.userId,
        designPublicId: named,
      });
      log.info(
        {
          userId: input.userId,
          candidate: input.candidatePublicId,
          removed: removal !== null,
          objectsQueued: removal?.objectsQueued ?? 0,
        },
        "[refineService] the cut was declined — the design was thrown away, nothing was charged",
      );
    }
    return {
      kind: "selected",
      note: "Discarded — that design is not kept, and nothing was charged.",
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
  /* Her current picture, read once in the narrowed scope: a closure loses the
     narrowing and the offer below is raised from inside one. */
  const currentImageUrl = storagePublicUrl(source.imageKey ?? source.candidate.imageKey);
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
  /*
    NO HAIR QUESTION — founder ruling 2026-08-19 (relayed fable-1087),
    superseding his own earlier one.

    A door stood here that asked *"the colour, the style, or the whole look?"*
    whenever a picture was attached and the words named no take. His newer word
    is that a vague ask is not vague: *"if they are vague and say copy this hair
    it just means the whole lot unless they specify."*

    So the take is now READ rather than asked (`hairTakeFor`), and the reference
    lane reaches the recipe with an answer already in hand. The ordering note
    that lived here is gone with the door, and `pendingReaskFor` lost the
    reference argument it only ever had for this.
  */
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

  /*
    ONE READING, ASKED THREE WAYS — the same face, the same sentence, the same
    prior. Named here because there are three call sites (the first reading, the
    removal re-read, and the restatement pass) and a fourth copy of this block
    would be the drift law's own failure mode on the step that decides what gets
    painted.
  */
  const readInstruction = (extra: { mode?: "edit"; restated?: boolean } = {}) =>
    (dependencies.interpret ?? interpretRefinement)({
      instruction,
      /*
        WHETHER AN ASK NOBODY CATALOGUED MAY NAME ITS OWN KIND —
        `CASTING_OPEN_LANE_SCOPE`, read here rather than inside the interpreter
        so the decision is made once, from `input.userId`, in the same place the
        repaint road's admission is decided.
      */
      openLane: (dependencies.openLaneEnabled ?? captureCastingOpenLaneEnabled)(input.userId),
      /*
        A PICTURE RIDES THIS ASK — the entrance to the reference road
        (fable-1104 §2).

        From the RESOLVED row rather than from `input.referenceId`: her account,
        her Cast, this Cast, all proved above, so a handle that failed any of
        those three never reaches the prompt. Without this the interpreter has
        never heard of an attachment, *"this photo"* reads as a real person, and
        every sentence the crop road exists for refuses at the likeness wall
        1,860 lines before the road — measured, four for four.
      */
      referenceAttached: reference !== null,
      /*
        AND WHETHER A TATTOO MAY BE DOCUMENTED BY IT. Read from the account
        rather than from the presence of a picture: the ink document gate fires
        for every user on `CASTING_V2_SCOPE=all`, so this is the switch that
        keeps his ruling off a live road until it is flipped.
      */
      inkReferenceEnabled: (dependencies.inkReferenceEnabled ?? captureCastingInkReferenceEnabled)(input.userId),
      prior: priorItems,
      lastColourFacet: lastColourFacet ? colourFacetLabel(lastColourFacet) : null,
      currentEyeColour: currentValueOfFacet(currentIdentity, "eye.colour"),
      currentEyeShape: currentValueOfFacet(currentIdentity, "eye.shape"),
      currentHairStyle: currentValueOfFacet(currentIdentity, "hair.cut"),
      currentHairColour: currentValueOfFacet(currentIdentity, "hair.colour"),
      currentHairTexture: currentValueOfFacet(currentIdentity, "hair.texture"),
      currentMakeup: currentValueOfFacet(currentIdentity, "makeup"),
      ...extra,
    });
  /*
    A CLICK ANSWERS BOTH QUESTIONS THE INTERPRETER IS FOR, so it is not asked.

    The pointed prune (`removeStep`) names the step; the chain holds it; there
    is nothing to read and nothing to match. Skipping the interpreter here is
    not an optimisation — it is the difference between pruning the step she
    chose and pruning a step that happens to share her words.

    The index is checked against the sentence the client drew it from. A stale
    client (she clicked while another edit landed) refuses rather than pruning
    somebody else's step, which is the same door every other stale-state check
    in this service uses.
  */
  const pointed = input.removeStep;

  /*
    HER HAIR GOING IS A HAIRCUT, AND THE CODE DECIDES IT FROM HER SENTENCE
    (founder ruling 2026-08-14: *"'remove her hair' and 'make her bald' are
    essentially the same asks"*; fable-606 §1, fable-608 §2).

    He typed *"remove her hair"* and was told *"That one can't be rendered"* — a
    content objection about an ask this product serves happily under other
    words — then typed the identical sentence again and it rendered her bald.
    Driven on the real service, six attempts on that one sentence with the claim
    door shut, the reading came back FOUR different ways: the paint three times,
    a content wall, a "didn't come through clearly", and a "not one of the things
    this can name". The neighbouring phrasings are stable because they never
    reach the removal road at all — *"take her hair off"* and *"make her bald"*
    parse straight to `hairStyle: "shaved head"`.

    A first attempt fixed the removal road and moved the coin flip UPSTREAM into
    the parse itself, which is the lesson: **the model's read is the unstable
    thing, so the code cannot wait for it.** This is the lexicon-split pattern
    the ruling names — the sentence is read here, by a rule, and the model is
    not consulted about a class it keeps answering differently.

    The rule is deliberately narrow: after fillers, the sentence must be a
    removal word and the word "hair" and nothing else. *"Remove her hair clips"*
    keeps a word the rule does not allow and goes to the model, and so does
    *"get her hair off her face"* — which means tie it back, and is exactly the
    over-capture this door has to refuse.
  */
  const baldFromHerWords = pointed === undefined && asksToRemoveHerHair(instruction);
  if (baldFromHerWords) {
    log.info(
      { userId: input.userId, candidate: input.candidatePublicId, instruction },
      "[refineService] her hair going is a haircut — the bald edit is read from her sentence, not asked for",
    );
  }

  /* `let` because a wordless removal is re-read as an edit below (D-189). */
  let parsed = pointed !== undefined
    ? {
      ok: true as const,
      intent: "remove" as const,
      /* Her own sentence for the step she pointed at. Checked against the chain
         below, where the chain is in hand — it is a claim until then. */
      match: pointed.instruction,
      subject: null,
    }
    : baldFromHerWords
      ? { ok: true as const, delta: { hairStyle: BALD_HAIR_STYLE } }
      : await readInstruction();
  /*
    AND DID HER SENTENCE SURVIVE THE READING? — before anything is claimed.

    A delta that only repeats what she already is renders a face identical to
    the one she started with, charges for it, and leaves the verification net
    with no row for the thing she asked about — a false pass built at the parse,
    invisible to the zero-false-pass bar because the check that would have
    failed was never written. Measured at three of nineteen readings on the
    plural shape. Refused here, in the step that was already free.
  */
  /*
    AND IT ASKS AGAIN BEFORE IT REFUSES (fable-460).

    The founder's cast held "left eye icey blue". He typed "her eyes meadow
    green" and this door told him *"She already has left eye icey blue"* —
    because the reading had come back holding only the restatement. The door was
    right that the delta said nothing new; it was wrong about what that MEANT.
    Measured on his state before anything changed
    (`scripts/bench-noop-door-disposable.mts`): 1 of 3 readings lost the ask,
    2 of 3 filed meadow green. A third of a legitimate paid edit, refused with a
    sentence that reads as the product not knowing colours.

    So a first restatement buys one more reading, with a constraint that names
    what went wrong and nothing else, and the SECOND reading faces this same
    door. A sentence that genuinely asks for what she already has restates
    twice and is refused exactly as before — the bench's control arm, which
    must keep refusing free or this fix has simply deleted the guard.

    Never more than once: the retry itself is `restated`, and its own verdict is
    final.
  */
  /*
    WHAT HAS ALREADY LEFT — the other half of "she already has that"
    (fable-480 §2). Read from the composed recipe she is standing on, the same
    place `priorItems` comes from, so both halves of the door are asking the
    same predecessor.
  */
  const priorAbsent: Partial<Record<FreeSubject, string[]>> = {};
  for (const [subject, value] of Object.entries(
    readStoredDelta(predecessorForParse?.deltas)?.absent ?? {},
  )) {
    priorAbsent[subject as FreeSubject] = itemsOf(value);
  }
  /*
    AND WHICH DESIGN THE ASK POINTS AT — the third half of the same door
    (ruled fable-1173 §1, shape (C) countersigned fable-1174 §1).

    The door above compares WORDS, and for every subject but this one the words
    discriminate. An ask pointing at an attached picture spells the same
    sentence for every design she could ever attach — the place and the picture
    are in it, the artwork never is — so a SECOND design at an occupied address
    read as an echo of the first and was refused free, one door before the
    replace offer built for exactly her. `saysNothingNew`'s own docblock carries
    the reasoning; here is where the two digests are fetched.

    **It is READ LAZILY AND AT MOST ONCE, and the gate is the ordinary ask's
    protection**: nothing happens at all unless she attached a picture, the
    chain already records applied ink, AND the delta in hand names ink from that
    picture. An ask with no reference, or on a Cast with no tattoo, pays not one
    statement for this. The population that does pay pays a single owner-scoped
    read — no engine, no money.

    `namesInkFromReference` rather than a subject list written out here: it is
    the same predicate that decides whether the tattoo branch is entered at all
    (`ink` words, and `marks` naming a design), so the door cannot come to
    disagree with the road about what an ink ask is.

    **AND THAT GATE IS A CORRECTNESS CONTROL, NOT ONLY A COST ONE** — measured
    by removing it, which reddened two arms rather than the one it was written
    for. Without it, a picture riding along on an ask about HER HAIR builds a
    pointer, the pointer says *not one of the designs she is wearing*, and an
    ask that genuinely repeated her current hair would stand aside and be
    charged. A digest may only speak for the subject whose identity it is.
  */
  const appliedInkOnChain = readAppliedInk(readStoredDelta(predecessorForParse?.deltas));
  let inkPointerRead: Promise<{ askDigest: string | null; appliedDigests: readonly string[] }> | null
    = null;
  const inkPointerFor = async (
    delta: RefineDelta,
  ): Promise<{ askDigest: string | null; appliedDigests: readonly string[] } | undefined> => {
    if (reference === null || appliedInkOnChain === null) return undefined;
    if (!namesInkFromReference(delta)) return undefined;
    inkPointerRead ??= (async () => {
      const recorded = new Set(Object.values(appliedInkOnChain));
      const designs = await (dependencies.listInkDesigns ?? listInkDesigns)({
        userId: input.userId,
        candidatePublicId: input.candidatePublicId,
      });
      return {
        askDigest: reference.digest,
        /*
          THE DESIGNS THE CHAIN SAYS ARE ON HER, and only those. A design row
          she owns that no step ever applied is not something this ask could be
          restating — it is a picture in a drawer.

          A hand-uploaded design's `sourceDigest` is null and is dropped here
          rather than compared: it came out of no picture, so no picture's
          digest can equal it, and the drop makes that the shape of the list
          instead of a null slipping into a comparison.
        */
        appliedDigests: designs
          .filter((design) => recorded.has(design.publicId))
          .map((design) => design.sourceDigest)
          .filter((digest): digest is string => digest !== null),
      };
    })();
    return await inkPointerRead;
  };
  const throughTheAlreadyTrueDoor = async (
    parse: Extract<Awaited<ReturnType<typeof readInstruction>>, { ok: true }>,
    mode?: "edit",
  ): Promise<typeof parse> => {
    if (!("delta" in parse)) return parse;
    /*
      A CONFIRMED RE-ROLL WALKS STRAIGHT THROUGH.

      She was shown this door's own sentence as an offer, with the price on it,
      and said yes. Refusing her here for the reason she has just answered would
      be the product arguing with itself — and it is the whole failure this
      branch exists to prevent: the first driven attempt refused the very thing
      it had offered a moment earlier.
    */
    if (confirmedRegenerate) return parse;
    const inkPointer = await inkPointerFor(parse.delta);
    const verdict = saysNothingNew({
      delta: parse.delta, prior: priorItems, priorAbsent, identity: currentIdentity,
      ...(inkPointer ? { inkPointer } : {}),
    });
    if (!verdict.absorbed) return parse;
    log.warn(
      { candidateId: input.candidatePublicId, instruction, alreadyTrue: verdict.alreadyTrue },
      "[refineService] the reading kept only what she already is — asking once more before refusing",
    );
    const again = await readInstruction({ ...(mode ? { mode } : {}), restated: true });
    if (again.ok && "delta" in again) {
      /* The retry is a SECOND READING OF THE SAME SENTENCE, so it points at
         the same picture — but the pointer is re-derived from the delta in
         hand rather than reused, because the reading is what decides whether
         this is an ink ask at all, and the memo means the re-derivation costs
         no second statement. */
      const againPointer = await inkPointerFor(again.delta);
      const second = saysNothingNew({
        delta: again.delta, prior: priorItems, priorAbsent, identity: currentIdentity,
        ...(againPointer ? { inkPointer: againPointer } : {}),
      });
      if (!second.absorbed) {
        log.info(
          { candidateId: input.candidatePublicId, instruction },
          "[refineService] the second reading kept her sentence — carrying on",
        );
        return again as typeof parse;
      }
    }
    log.warn(
      { candidateId: input.candidatePublicId, instruction, alreadyTrue: verdict.alreadyTrue },
      "[refineService] the ask was absorbed into a restatement of what she already is — refusing, free",
    );
    const absorbedReason = verdict.departed ? "absorbed_departure" : "absorbed";
    throw refusal(absorbedReason, {
      code: "BAD_REQUEST",
      message: refusalMessage({
        ok: false,
        refusal: {
          /* The departure gets its own sentence: "she already has no glasses"
             is not English, and what she can see is that they are already off. */
          reason: absorbedReason,
          asked: verdict.alreadyTrue,
        },
      }),
      /*
        NO FACET HERE, deliberately. `alreadyTrue` is a phrase built out of what
        she asked for — "icey blue eyes" — and the count may carry the reason
        and never her sentence. The reason alone answers the question this door
        is counted for.
      */
      facet: null,
    });
  };
  if (parsed.ok && "delta" in parsed) parsed = await throughTheAlreadyTrueDoor(parsed);
  /*
    A RESCUE IS COUNTED TOO, and it is the half that makes the ratio mean
    something: `upheld` alone would say how often the door refuses and nothing
    about how often containment was wrong (fable-498 §4).
  */
  if (parsed.ok && "door" in parsed && parsed.door === "rescued") {
    await countRefusal({
      userId: input.userId,
      candidateId: input.candidatePublicId,
      /*
        THE DOOR SAYS WHICH WALL IT STOOD AT (fable-635 §2c).

        This reason was hard-coded on the day the invention door was the only
        door, and it was right then. The colour-context door also rescues, at
        `wall_content`, and filing its rescues under `wall_unfileable` would sum
        two different populations into one rate that describes neither. The
        fallback keeps every parse written before the field existed reading the
        way it always did.
      */
      reason: parsed.doorAt ?? "wall_unfileable",
      facet: null,
      outcome: "rescued",
    });
  }
  /*
    THE WORDS LANE — a property she pointed at a picture for, read and handed
    back as a sentence she adopts (ruled fable-1103 §1, sited fable-1104 §4).

    HERE, above the refusal and below the parse, because this is the one place
    both of its doors are in hand. Measured with the entrance clause live: a
    colour ask FILES an unusable value (`hairShade: "the hair colour in the
    attached picture"`) and a makeup ask REFUSES at containment
    (`wall_unfileable`) — the same fact, that only a reader can supply the
    value, arriving at two different outcomes one line apart.

    Everything below is free, and every exit takes nothing: no claim is opened,
    no credit moves, no row is written, and the picture is never sent to a
    render. What she gets back is words, and they are not even in her box until
    she says so.
  */
  /*
    THE WORDS LANE IS THE HAIR ROAD TOO — colour as words is one of its two
    forms (D-142's split), and the makeup read has ridden the same gate since it
    landed. So it asks the hair flag for itself, for the reason the crop lane
    below does: this used to be answered by the resolver's gate, and that gate
    is now the OR of every road that can act on a picture (fable-1163 §2).
  */
  const wordsTakeIntent = reference
    && (dependencies.hairReferenceEnabled ?? captureCastingHairReferenceEnabled)(input.userId)
    ? wordsTakeIntentFor(instruction)
    : null;
  const pointedAtThePicture = parsed.ok && "fromReference" in parsed && parsed.fromReference === true;
  if (
    reference
    && wordsTakeIntent
    && (pointedAtThePicture
      || (!parsed.ok && refusalIsAnswerableByAReader(parsed.refusal.reason)))
  ) {
    const offer = await readTheWordsTake({
      intent: wordsTakeIntent,
      reference,
      userId: input.userId,
      candidateId: source.candidate.id,
      dependencies,
    });
    return {
      kind: "selected",
      ...(offer.kind === "refusal" ? { note: offer.message } : { offer: offer.offer }),
      variantId: source.variantPublicId,
      candidateId: input.candidatePublicId,
      imageUrl: storagePublicUrl(source.imageKey ?? source.candidate.imageKey),
      instructions: readInstructions(predecessorForParse?.instructions),
    };
  }

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
    /*
      AND IT IS COUNTED, because a log line is not an artifact (fable-498 §5) —
      by the SEAM now rather than here (opus-465). The reason and the facet ride
      on the refusal itself; the door's own verdict rides with them so the
      rescued-vs-upheld ratio stays readable. Never her sentence: staff read
      audit rows.
    */
    // An honest boundary, not a fault — and free, which is the point of §10.
    throw refusal(parsed.refusal.reason, {
      code: "BAD_REQUEST",
      message: refusalMessage(parsed),
      facet: "asked" in parsed.refusal ? parsed.refusal.asked : null,
      outcome: parsed.door === "upheld" ? "upheld" : "refused",
    });
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
      throw refusal("version_missing", {
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
      throw refusal("already_original", {
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
    ? readChain(
      readInstructions(predecessor.instructions),
      readStepDeltas(predecessor.stepDeltas),
      /* The third array of the family, so a REMOVAL reindexes it for free
         through the pairing rather than through a second walk. */
      readStepProvenance(
        predecessor.stepProvenance,
        readInstructions(predecessor.instructions).length,
      ),
    )
    : [];

  /*
    THE POINTED STEP IS PROVED AGAINST THE CHAIN, here where the chain is in
    hand and before anything is claimed.

    A client can be stale — she clicked a chip while another edit landed — and a
    stale index prunes a step nobody chose. The index alone cannot say; the
    sentence it was drawn from can, and the two are checked against each other.
  */
  if (pointed !== undefined) {
    const step = predecessorChain?.[pointed.at];
    if (!step || step.instruction !== pointed.instruction) {
      log.info(
        {
          userId: input.userId, candidate: input.candidatePublicId,
          at: pointed.at, expected: pointed.instruction, found: step?.instruction ?? null,
        },
        "[refineService] the step she pointed at has moved — refusing rather than pruning another one",
      );
      throw refusal("step_moved", {
        code: "CONFLICT",
        message: "That step has moved since this page was loaded — open the face again "
          + "and take it off from there. Nothing was charged.",
      });
    }
  }

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
  /*
    A KIND THE OLD ROAD HAS NEVER BEEN MEASURED ON REFUSES HERE — free, before
    the claim and before the charge (fable-525 §3c).

    Horns is the first subject promoted off measurement courts rather than off a
    plan, and every one of those courts was run on the REPAINT road, because
    that is the road that assembles a declarative recipe. Admitting it on the
    old paste road would charge somebody for a kind nobody has ever measured
    there — and the promotion's whole point was that a card's claims are backed.

    Asserted at the door rather than assumed, because "the old road cannot do it
    anyway" is exactly the reasoning that has been wrong before: the interpreter
    now KNOWS the word, so without this the ask would sail past the vocabulary
    check that used to refuse it and land in a paste render that has never
    grown a horn.

    The list is derived from the cards (`admittedOn`), so when repaint widens,
    the promoted kinds widen with it — one gate, not two lists that drift.
  */
  const repaintServesThisUser = (dependencies.repaintEnabled ?? captureCastingRepaintEnabled)(
    input.userId,
  );
  if (!repaintServesThisUser && editDelta?.free) {
    const unserved = REPAINT_ONLY_SUBJECTS.filter((subject) => editDelta?.free?.[subject]);
    if (unserved.length > 0) {
      log.info(
        { userId: input.userId, candidate: input.candidatePublicId, instruction, unserved },
        "[refineService] the ask names a kind only the repaint road serves — refusing before the charge",
      );
      throw refusal("kind_unserved", {
        code: "BAD_REQUEST",
        message: "I can't do that to her yet. Nothing was charged.",
      });
    }
  }

  /* A likeness comparison rode this ask and was set aside (D-181). */
  const droppedReference = "droppedReference" in parsed && parsed.droppedReference === true;
  /*
    And its sibling: part of this ask is not in the photograph, so it was left
    out (fable-386 §2). Declared beside `droppedReference` because they are ONE
    CLASS — every way a paid ask can be served in part — and the delivery says
    all of them or it is deciding on the customer's behalf in silence.
  */
  let outOfFrameNote: string | null = null;
  let chain: ChainStep[] = predecessorChain ?? [];
  let removedFacets = new Set<Facet>();
  /** What a prune took back, in the user's own words — see the prune branch. */
  let takenBack: string | null = null;
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
  /*
    AND A WORD THAT ALSO DESCRIBES A LOOK DOES NOT SAY IT (fable-473/481).

    "Her glasses — gentle monster style CLEAR rims" turned this backstop off,
    because "clear" was in the removal lexicon. The mis-parse then ran all the
    way to a paid render that took her glasses off — the only wrong charge in
    the campaign's history.

    So the evidence has three strengths now, and only the strongest skips the
    re-read. On an AMBIGUOUS word the model proposes both readings and the CODE
    decides between them (the D-181 shape, third door): if the edit reading
    answers the facet the removal named, the sentence named a thing to HAVE —
    "glasses clear rims", "drop earrings". If it answers nothing there, the
    removal stands, so "no glasses" and "hair back" are untouched.

    Its cost is one text call, and only on a parse that was about to remove
    something on an adjective's word.
  */
  const evidence = removalEvidence(instruction);
  /*
    THE AMBIGUITY MACHINERY IS FOR SENTENCES, and a click is not one.

    `removalEvidence` weighs how plainly her words said subtraction, because a
    word like "clear rims" describes a look as well as an absence. A pointed
    prune has no words to weigh: she clicked the step. Running this door on an
    empty instruction reads as "she said nothing about removing", re-reads the
    ask as an edit, and quietly turns her click into a render of nothing.
  */
  if (pointed === undefined && parsed.intent === "remove" && evidence !== "stated") {
    /* The noun the removal claimed, read before `parsed` can be replaced. */
    const removalMatch = ("match" in parsed && typeof parsed.match === "string") ? parsed.match : "";
    log.warn(
      { instruction, evidence },
      "[refineService] a removal with no plain removal word — re-reading as an edit",
    );
    const asEdit = await readInstruction({ mode: "edit" });
    if (asEdit.ok && "delta" in asEdit) {
      /* The SECOND reading gets the same door as the first — including its one
         re-ask. A re-read is a parse, and a parse that loses her sentence loses
         it either time. */
      const kept = await throughTheAlreadyTrueDoor(asEdit, "edit");
      /*
        DERIVED FROM THE COMPOSITION TABLE, never from a second list of what a
        subject owns: `facetsAnsweredBy` is the same reader supersession uses,
        so "did this reading fill the thing the removal was about" cannot drift
        from what filling it means everywhere else.
      */
      const removalSubject = readRemovalSubject(parsed.subject);
      /*
        ONE PLACE, because the corpus bench decides with the same function: a
        second copy of this rule would let the measurement and the product drift
        apart, and the measurement is the only reason to believe the rule.
      */
      const namesAThingToHave = "delta" in kept && reReadNamesAThingToHave({
        delta: kept.delta,
        subject: removalSubject,
        match: removalMatch,
      });
      if (evidence === "none" || namesAThingToHave) {
        /*
          BOTH OUTCOMES SAY SO, and the corpus is why: the bench read the
          decision off this log and could see only one of the two branches, so
          a removal that survived because the re-read returned nothing at all
          was recorded as an edit winning. A decision with one audible outcome
          is a decision nobody can measure.
        */
        log.info(
          { instruction, evidence, subject: readRemovalSubject(parsed.subject) },
          "[refineService] the re-read named a thing to have — the removal is dropped",
        );
        parsed = kept;
        if ("delta" in kept) editDelta = kept.delta;
      } else {
        log.info(
          { instruction, evidence, subject: removalSubject },
          "[refineService] the re-read named nothing for that subject — the removal stands",
        );
      }
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
      throw refusal("history_predates_undo", {
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
      throw refusal("removal_unnamed", {
        code: "BAD_REQUEST",
        message: "I didn't catch what should come off. Tell me the thing itself — "
          + "\"the earrings\", \"her glasses\", \"the fringe\" — and I'll take it off. "
          + "Nothing was charged.",
      });
    }

    /*
      A CLICK NEEDS NO MATCHER. She pointed at the step; the check above proved
      it is the one she pointed at. Running the word matcher here would be
      re-deriving by guesswork the fact the click already carried, and it is
      exactly where a removal takes the wrong step when two share words.

      `keep: null` — the whole step goes, because a chip IS a whole step.
    */
    const matched = pointed !== undefined
      ? [{ index: pointed.at, keep: null }]
      : matchSteps(predecessorChain, {
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
    /*
      A CLICK HAS ALREADY ANSWERED THIS QUESTION, so the picture is not asked.

      The arbitration exists because a SENTENCE cannot say which step it means:
      it asks the master whether the chain put the thing there, because a prune
      may only remove what the chain added. A chip names the step — the chain
      demonstrably holds it, and the check above proved it is the one she
      pointed at.

      What the arbitration would still have told us is a different question:
      whether her FACE will change. If the pruned step asked for something the
      master already had, the step goes and the thing stays, because the master
      is reference 1. That is the truth of a pointed prune and the copy must not
      promise otherwise — it is not a reason to refuse her click, and it is not
      a reason to spend a segmenter call she did not ask for.
    */
    if (matched.length > 0 && pointed === undefined) {
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
          throw refusal("removal_uncheckable", {
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
        throw refusal("removal_uncheckable", {
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
          throw refusal("removal_not_in_brief", {
            code: "BAD_REQUEST",
            facet: subject,
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
        throw refusal("removal_absent", {
          code: "BAD_REQUEST",
          facet: subject ?? null,
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
      /*
        THE FOUNDER'S OWN DOOR (opus-465). "Remove her hair" came through here,
        was re-read as an edit, hit the content wall, and the refusal reached him
        with nothing written down anywhere — this line threw straight past the
        counter. It is why the count now happens at the seam and why every
        refusal on this road carries its name.
      */
      if (!asEdit.ok) {
        throw refusal(asEdit.refusal.reason, {
          code: "BAD_REQUEST",
          message: refusalMessage(asEdit),
          facet: subject ?? null,
        });
      }
      if (!("delta" in asEdit)) {
        throw refusal("removal_reread_unmatched", {
          code: "BAD_REQUEST",
          facet: subject ?? null,
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
        AND WHAT THE PRUNE TAKES BACK, IN WORDS — the restate ask's subject
        (V3(c), fable-536 §2).

        The user's own sentence named it and `matchSteps` already found the step
        it names, so this is a record rather than a reading. It exists because
        the verification needs a question at the wire: without it a prune ships
        unverified on precisely the fact it exists to change.
      */
      takenBack = parsed.match?.trim() || predecessorChain[matched[0]!.index]?.instruction.trim() || null;
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
  /*
    THE OUT-OF-FRAME DOOR — the fifth refuse-before-dispatch door, and its CALL
    SITE (fable-381 §A.1, on the body-row note's §0).

    *"Make her waist smaller"* on a casting portrait is not an edit at all: the
    photograph is framed from the mid-torso up and her waist is not in the file.
    `occluded` is the near neighbour and is NOT the same door — a waist under a
    t-shirt could be answered by a different garment; a waist below the crop line
    can only be answered by a different photograph.

    Two things make it safe to be strict here. It fires only on what THIS
    sentence wrote (`editDelta`, never the composed recipe — the already-true
    gate's own scar, where a delivered eye edit intercepted every later ask), and
    it REFUSES only when the whole ask is out of frame: *"a smaller waist and
    bigger arms"* is served for the arms rather than refused for the waist,
    because refusing a sentence with a renderable half would take something away
    from her to be tidy.

    **ONE READING DECIDES BOTH HALVES (working law 4).** The refusal and the
    strip used to be two readings of the same table — one counting facets, one
    deleting them — which is a second list of what the camera contains, and it
    would have drifted the first time a facet was added to it. So the frame is
    consulted ONCE: what survives the strip is the ask, and an ask with nothing
    left in it is the whole-sentence refusal, by derivation rather than by count.

    And the half that cannot be served LEAVES (fable-386 §2). It used to ride
    along into the prompt, the caption, the verification and the stored recipe —
    which is base-anchored, so one mixed sentence pinned a phantom waist
    instruction to her for every later render on the branch. What it costs
    instead is one sentence in the delivery, below.

    It sits before `admit`, so nothing has been claimed and nothing is charged.
  */
  if (editDelta) {
    const { delta: inFrame, dropped: notInShot } = withoutWhatIsOutOfFrame(editDelta);
    if (notInShot.length > 0) {
      /*
        AND AN OPEN KIND SURVIVES ON ITS OWN — the sweep's second find
        (fable-900 §2b, law 7: fix the class, not the instance).

        `facetsWrittenBy` counts FACETS and an open kind has none, so an ask
        naming *"give her a halo"* beside a closed facet that is out of shot
        counted as nothing surviving and the WHOLE ask was refused — including
        the half this product could have served. Same blindness as the carry
        drop, one door along, and it is why the sweep was part of the fix rather
        than a follow-up.
      */
      const survives = facetsWrittenBy(inFrame).size > 0
        || Object.keys(inFrame.open ?? {}).length > 0;
      if (!survives) {
        log.info({ notInShot }, "[refineService] the ask is outside the frame — refusing before dispatch");
        /*
          AND AN OPEN KIND RIDING THAT REFUSAL FILES ITS OWN ROW (5b Stage D).

          This exit is BEFORE `admit`, so nothing is charged and nothing reaches
          the refund catch — which is where every other terminal outcome writes
          its demand row. Without this line an accepted open kind that arrived
          beside closed facets all out of shot would end here having filed
          nothing, and the tally would be short by a whole class of ask rather
          than by the occasional process death.

          `refused` is the honest word: the table's own definition is *a door
          turned it away for free*, and this is that door.
        */
        recordOpenLaneOutcomes(editDelta, { settled: false, cropsStored: new Set(), refusedFree: true });
        throw spokenError({
          code: "PRECONDITION_FAILED",
          message: outOfFrameMessage(nameWhatIsMissing(notInShot)),
        });
      }
      log.info(
        { notInShot, serving: Array.from(facetsWrittenBy(inFrame)) },
        "[refineService] part of the ask is outside the frame — serving the rest and saying so",
      );
      editDelta = inFrame;
      outOfFrameNote = partlyOutOfFrameNote(nameWhatIsMissing(notInShot));
    }
  }

  const priorInstructions = readInstructions(predecessor?.instructions);
  const priorSteps = readStepDeltas(predecessor?.stepDeltas);
  /*
    A REPEAT OF THE SAME ASK RE-ROLLS THIS VERSION IN PLACE (founder,
    2026-08-15): *"just allow a refresh or regeneration of the same edit which
    essentially produces no extra version and just regenerates the same
    thumbnail"*, and on the trade — *"if you don't like how the generation
    landed you can regenerate it without causing extra clutter"*.

    So when the ask names the same change as the step that MADE the frame she is
    looking at, this render is a second take of that version rather than a new
    one after it: the chain is the predecessor's own chain, unchanged, and the
    rail derives one chip per distinct chain with the newest take winning
    (`railTakes.ts`). Nothing is deleted and no column is written — the older
    take becomes invisible rather than absent, which is what keeps a fork made
    from it resolving (fable-091).

    It is still a paid render. Only the version COUNT stops growing.

    `sameStep` compares the PARSED deltas, never the sentences, and it errs
    toward treating two asks as different — a false split costs one chip, a
    false merge would take a picture she paid for off the rail.
  */
  const repeatsThisVersion = Boolean(editDelta)
    && priorSteps.length > 0
    && (confirmedRegenerate || sameStep(priorSteps[priorSteps.length - 1]!, editDelta!));
  const instructions = editDelta
    ? (repeatsThisVersion ? priorInstructions : [...priorInstructions, instruction.trim()])
    : chain.map((step) => step.instruction);
  const stepDeltas = editDelta
    ? (repeatsThisVersion ? priorSteps : [...priorSteps, editDelta])
    : chain.map((step) => step.delta);
  /*
    WHERE THIS STEP'S WORDS CAME FROM — composed exactly parallel to the two
    lists above, so index i keeps meaning the same thing in all three.

    A re-take of the same version writes the predecessor's array unchanged, for
    the same reason it writes the predecessor's chain: nothing new was said. A
    removal takes it from the pruned chain, which is where the reindexing
    happens. And a step with no token carries `null` — most steps are typed, and
    an absent provenance is the honest answer rather than a missing one.
  */
  const priorChainProvenance = readStepProvenance(predecessor?.stepProvenance, priorInstructions.length);
  /*
    THE TOKEN IS VERIFIED HERE, where the instruction it is a claim about is in
    hand — and it can only ever ADD a fact. `verifyReadToken` never throws, and
    every refusal it can return lands as `null`, because a decoration must not
    be able to fail an operation somebody is paying for.
  */
  const thisStepProvenance: StepProvenance | null = (() => {
    const token = input.provenanceToken?.trim();
    if (!token) return null;
    const verified = verifyReadToken({
      secret: ENV.cookieSecret,
      token,
      userId: input.userId,
      /* The Cast's ROW id, which is what the read sealed into the token — the
         public id is what a client says, and a token bound to what a client
         says is bound to nothing. */
      candidateId: source.candidate.id,
      instruction,
      now: Date.now(),
    });
    return verified.ok ? verified.provenance : null;
  })();
  const priorProvenance = priorInstructions.map((_, index) =>
    priorChainProvenance?.[index] ?? null);
  const stepProvenance = editDelta
    ? (repeatsThisVersion ? priorProvenance : [...priorProvenance, thisStepProvenance])
    : chain.map((step) => step.provenance);
  /*
    THE OFFER LIVES HERE, WHERE THE REPEAT IS DETECTED — and it used to live one
    door down, which charged somebody 25 credits without asking.

    The first version raised it inside the already-true door, on the reasoning
    that a repeat is what that door catches. It is not always: "make her hair
    jet black" on a jet-black head reads as a real change to `saysNothingNew`
    (an enum axis, not a free-lane item), so the door stayed shut, the repeat
    fell through to the branch above, and the render happened — in place, as
    designed, and WITHOUT the question the founder's ruling is built around.
    Driven in the browser, which is the only place it showed.

    So the question is asked wherever a repeat is recognised, which is one place
    and this one. Nothing has been claimed yet, so it costs nothing to raise.
  */
  if (repeatsThisVersion && !confirmedRegenerate) {
    const asked = (predecessor?.requestText ?? instruction).trim();
    log.info(
      { userId: input.userId, candidate: input.candidatePublicId, asked },
      "[refineService] the same ask again — offering a fresh take before anything is claimed",
    );
    return {
      kind: "asked",
      reask: sameAgainReask({ asked, priceCredits: price }),
      variantId: source.variantPublicId,
      candidateId: input.candidatePublicId,
      imageUrl: currentImageUrl,
      instructions: priorInstructions,
    };
  }
  if (repeatsThisVersion) {
    log.info(
      { userId: input.userId, candidate: input.candidatePublicId, chain: priorSteps.length },
      "[refineService] a fresh take was bought — re-rolling this version in place rather than adding one",
    );
  }
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
    throw refusal("history_unreadable", {
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
    throw refusal("refine_limit", {
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
    /*
      AND THE ALREADY-HAS DOOR'S SIBLING, KEYED ON THE REPLAY (fable-733 §2).

      This is the same refusal as `saysNothingNew` measured off the picture
      instead of the recipe — its own log line says *"already-true — asking
      instead of spending"* — so it is state-comparing by the rule in
      `replayDoors.ts`, and on a fresh take her upswept eyes are the premise: she
      has them BECAUSE of the version being regenerated. Left alone it would
      have been the FOURTH door to stop him on the same journey, and the sweep
      is the part of the fix that finds those before he does.

      Deliberately narrow. Its neighbour below — the glasses reading — is NOT
      keyed on this, because its ground is that an instrument could not take a
      reading, which a replay does not change. Two doors, one block, two
      classes; the list says which is which.
    */
    if (reading && alreadyUpswept(reading) && !(confirmedRegenerate && skippedOnReplay("already-upswept"))) {
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
    if (!reading && faceBytes && EYEWEAR_REGION) {
      const wearingGlasses = await (async () => {
        try {
          /* The region comes from the accessory table (V1/F5) — this used to be
             the one segmenter word typed in outside every table. */
          const mask = await (dependencies.regions ?? defaultRegionReader())
            .region({ image: faceBytes.bytes, name: EYEWEAR_REGION, absentIsAnswer: true });
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

  /*
    AND A SCOPED ASK THE ROAD CANNOT PLACE IS REFUSED HERE — FREE (fable-489 §3).

    The founder tapped the panel's EARS row and asked for a cauliflower ear. The
    reading filed it as a MARK, marks have no slot inside an ear, and the
    repaint's own door refused it — correctly, and after the claim, so he was
    charged 25 credits and refunded them in the same second.

    This service's comment said the narrow half "cannot be judged yet, because
    nothing has been interpreted at this point". That premise expired when the
    parse moved ahead of the claim: the same fact is knowable while the refusal
    is still free, and a refusal that costs nothing is strictly better for her
    than one that costs a charge and a refund.

    Narrower than the door it pre-empts, on purpose (see
    `scopedAskIsUnsayable`): it fires only when EVERY answered facet is outside
    the scope, and never when the judgment would need an accessory kind this
    point does not have. The late door STAYS and keeps its own drive — an early
    exit for the money is not a replacement for the guard.
  */
  if (input.scope !== undefined && editDelta) {
    const outside = scopedAskIsUnsayable({ delta: editDelta, scope: input.scope });
    if (outside.unsayable) {
      const scoped = slotDefinition(input.scope);
      const scopeNoun = scoped
        ? `${pronounsForSex(currentIdentity?.sex).possessive} ${scoped.noun}`
        : null;
      log.info(
        { candidateId: input.candidatePublicId, instruction, scope: input.scope, facets: outside.facets },
        "[refineService] the reading landed outside the part she pointed at — refusing before the claim",
      );
      throw refusal("scope_mismatch", {
        code: "BAD_REQUEST",
        facet: outside.facets[0] ?? null,
        message: cannotSaySentence("notASlot", {
          words: null,
          facet: outside.facets[0] ?? null,
          scopeNoun,
          /* Nothing has been claimed at this line — the whole point of it. */
          moneySafe: true,
        }),
      });
    }
  }

  if (dependencies.admit && !dependencies.admit()) {
    /*
      A real TOO_MANY_REQUESTS, never a 200 carrying an error field (invariant
      6), and before the claim so nobody is charged for a queue they could not
      get into.
    */
    throw refusal("busy", {
      code: "TOO_MANY_REQUESTS",
      message: "Casting is busy right now. Try that again in a moment — nothing was charged.",
    });
  }

  /*
    HER PICTURE BECOMES A CARRIER — the crop road, on the request path
    (design §9.11; the fourth reference role approved fable-1096 §1).

    Everything here happens BEFORE the claim, and that is the whole placement
    argument: cutting a carrier asks a segmenter two or three questions, any of
    which can come back with nothing usable, and a customer must not be charged
    for a render whose reference we could not build. Every refusal below returns
    her own picture with a sentence and takes nothing.

    THE ORDER IS: what is she taking → does this ask touch hair at all → cut →
    mint. The take is read first because it is free and it is the cheapest way
    to find out that no crop is wanted at all: a colour take carries as WORDS
    (his own example) and buys no segmenter call.
  */
  /*
    AND THE SCOPE RIDES WITH IT — `scope` is the sentence saying what this crop
    may give her, composed by `hairTakeSentence` from the take read below.

    It is on this object rather than resolved again at the recipe because the
    take is knowable only here, inside the pre-claim door: carrying the KEY and
    the SHA and leaving the scope behind is exactly how style and fullLook came
    to dispatch the same request (opus-815, ruled fable-1108).
  */
  /*
    THE TATTOO ASK HER PICTURE DOCUMENTS — read here, ANSWERED here, and it never
    reaches the claim (designed opus-822, ruled fable-1116 §4 and fable-1120 §4).

    The gate's reference arm stopped walling this ask. What it opened onto had to
    be decided, and pre-cutter there is exactly one honest answer:

      - there is nowhere to FILE it. A design row needs the design's bytes, and
        the bytes that exist are her whole photograph — filing that as the design
        is the widening tripwire's own exposure with a copy taken;
      - there is nothing to RENDER it with. The crop-from-photo cutter is not
        built, so a render here would be a tattoo drawn from words, which is
        D-137's forbidden render and the one the gate exists to stop;
      - and there is nothing to ASK her. A question whose every answer leads to
        *"we can't yet"* is a dead end wearing a question (D-180), which is
        exactly the defect the handle commit just closed on the glasses door.

    So the ask is READ — the placement in her own word, the side only if she said
    one — and she is told what was understood and what cannot be done yet. That
    is not a consolation: today's wall tells somebody holding a design document
    that her ask *"needs a design document first"*, which is false to her face.

    THE QUESTION LANDS WITH THE CUTTER, when it has somewhere to lead.

    Placed ABOVE the hair lane because an ink ask is not a hair ask: it would
    fall through `asksAboutHair`, be confessed as an unused picture, and then be
    claimed and rendered from words — which is the render this whole branch
    exists to prevent.
  */
  /*
    THE DESIGN THIS RENDER IS CARRYING — the same shape of fact as
    `hairSource` below: resolved inside the pre-claim door, where the ask is
    knowable, and read at the recipe, which is the only place it can be spent.

    Declared ABOVE the branch rather than beside its sibling for the plainest of
    reasons — the branch that assigns it is the next statement.
  */
  let inkSource: {
    /** The design's own name — so the answer can say WHICH design rode
     *  (fable-1156 §2e). Without it a design minted inside an ask was a row its
     *  owner could never name, and the removal that exists takes a name. */
    designId: string;
    key: string;
    sha: string;
    cutRoute: InkCutRoute | null;
    scope: string;
    address: InkAskAddress;
  } | null = null;
  if (
    reference
    && pointedAtThePicture
    && (dependencies.inkReferenceEnabled ?? captureCastingInkReferenceEnabled)(input.userId)
    && namesInkFromReference(editDelta)
  ) {
    const take = await (dependencies.inkTake ?? resolveInkReferenceTake)({ instruction });
    /*
      AN UNREADABLE TAKE, OR ONE THAT NAMED NO PLACE, IS STILL A QUESTION.

      Unchanged from the day this branch was built, and it must stay that way:
      `null` is the resolver saying it could not tell where she meant, and the
      honest answer to that is to ask — never a guessed placement, which on this
      road is a design on the wrong part of her.

      `absent` and `tooLong` are questions for the same reason
      (`inkPlacementResolve`'s own note): there is nothing to name about a place
      nobody stated, and nothing safe to repeat back out of a sentence long
      enough to be about a person.
    */
    const address = inkAskAddressOf(take);
    if (address === null) {
      log.info(
        {
          userId: input.userId,
          candidate: input.candidatePublicId,
          placement: take?.placement.kind ?? null,
          side: take?.side ?? null,
        },
        "[refineService] a tattoo ask whose place could not be read — asked back before the claim, nothing spent",
      );
      return {
        kind: "selected",
        note: inkReferenceNote(take),
        variantId: source.variantPublicId,
        candidateId: input.candidatePublicId,
        imageUrl: currentImageUrl,
        instructions: readInstructions(predecessorForParse?.instructions),
      };
    }
    /*
      WHICH OF HER DESIGNS THIS ASK IS ABOUT (ruled fable-1145 §4, road (D)
      ruled fable-1148 §3).

      Read owner-scoped on both sides of its own join, then decided by the one
      owner of that decision. Every non-`ride` answer comes back with its own
      finished sentence and is returned FREE, before the claim — a charge
      raised and reversed for a fact knowable this early is the wrong shape
      under the founder's catastrophic-only refund ruling.

      **The `unexamined` answer is the pre-claim half of 1137 §4's control**,
      and it shares its predicate (`inkDesignWasExamined`) with the recipe
      assembler's backstop, so the two cannot come to disagree about what
      "nobody looked" means.
    */
    const designs = await (dependencies.listInkDesigns ?? listInkDesigns)({
      userId: input.userId,
      candidatePublicId: input.candidatePublicId,
    });
    const chosen = inkDesignForAsk(designs, address, { digest: reference.digest });
    const said = (outcome: string, note: string): RefineResult => {
      log.info(
        {
          userId: input.userId,
          candidate: input.candidatePublicId,
          placement: address.placement,
          side: address.side,
          outcome,
          held: designs.length,
        },
        "[refineService] a tattoo ask answered before the claim — nothing stored, nothing spent",
      );
      return {
        kind: "selected",
        note,
        variantId: source.variantPublicId,
        candidateId: input.candidatePublicId,
        imageUrl: currentImageUrl,
        instructions: readInstructions(predecessorForParse?.instructions),
      };
    };
    if (chosen.kind === "sideUnstated") {
      /*
        THE SIDE QUESTION (released fable-1120 §4, built once the mint gave it
        somewhere to lead; ordered fable-1153 §5).

        A paired surface and no word for which one. Every other non-riding
        answer on this road is a SENTENCE — this one is a QUESTION, because the
        thing missing is one word she can supply with a tap, and telling her to
        type it again is a wall wearing an explanation.

        Free and before the claim, like every outcome above it: `kind: "asked"`
        raises no operation and moves no credit. And it cannot loop — an answer
        puts the word in her own sentence, so the take reads it and the source
        containment that guards the side accepts it.
      */
      log.info(
        {
          userId: input.userId,
          candidate: input.candidatePublicId,
          placement: address.placement,
          held: designs.length,
        },
        "[refineService] a tattoo ask on a paired surface with no side — asked before the claim, nothing spent",
      );
      return {
        kind: "asked",
        reask: whichSideReask(instruction),
        variantId: source.variantPublicId,
        candidateId: input.candidatePublicId,
        imageUrl: currentImageUrl,
        instructions: readInstructions(predecessorForParse?.instructions),
      };
    }
    if (
      chosen.kind !== "ride"
      && chosen.kind !== "mint"
      && chosen.kind !== "replace"
    ) return said(chosen.kind, chosen.say);

    /*
      AND WHEN NOTHING IS THERE, THE PICTURE SHE POINTED AT BECOMES THE DESIGN
      (road (D), ruled fable-1148 §3).

      Cut ONCE, through the one owner, and filed as a row — so the wire below
      reads a row exactly as it reads one somebody uploaded, and the next ask
      about the same picture at the same address rides this row rather than
      buying a second cut.

      **It runs BEFORE THE CLAIM and every failure is free**: a mint that cannot
      cut refuses and stores nothing, in the cutter's own sentence about her
      picture. The two segmenter calls it spends are house money and are the
      only thing on this branch that costs anything at all.

      `intents` is DERIVED from the predicate that entered this branch rather
      than typed beside it (ruled fable-1151 §1): the attachment record carries
      no intents because the attach door is reached before she has typed
      anything, so there is no ask yet for an intent to authorise. Here there
      is — her own sentence, about this picture, naming a design — and an ask
      that is not a tattoo ask cannot reach this line to claim it was.
    */
    /*
      WHAT THE CUT WAS NARROWED TO, kept beside the design so the offer's
      sentence can say it (ruled fable-1172 §2a).

      A RIDE has none by construction and that is right rather than a gap: the
      row it finds is one she was already shown, once, when it was cut. Telling
      her again which half of a picture it came from — on every later render —
      is the repeated question D-180 forbids.
    */
    let cutFocus: InkCutFocus | null = null;
    const design = chosen.kind === "ride" ? chosen.design : await (async () => {
      const minted = await (dependencies.mintInkDesign ?? mintInkDesignFromReference)({
        userId: input.userId,
        candidatePublicId: input.candidatePublicId,
        reference: {
          storageKey: reference.storageKey,
          digest: reference.digest,
          provenance: reference.provenance,
          mime: reference.mime,
        },
        placement: chosen.placement,
        side: chosen.side,
        intents: inkAskIntents(editDelta),
      });
      if (minted.ok) cutFocus = minted.focus;
      return minted.ok ? minted.design : minted.refusal;
    })();
    if (!("storageKey" in design)) return said(`mint:${design.code}`, design.message);
    /*
      AND BEFORE IT RIDES, SHE LOOKS AT IT — the shown cut (ruled fable-1127 §2,
      brought to this road fable-1156 §2).

      1127 §2 was ruled when the only cutter was the studio upload door. Road
      (D) is a second one, and its ask cuts and RENDERS in a single breath — so
      the promise that the cutter's result goes in front of the customer before
      any paid render carries it was, on this road, not true. The reader that
      judges a cut cannot see fine sparse detail (dropped lettering, measured),
      which makes her eyes the only check between the cut and her money.

      **ON A FRESH MINT ONLY.** A reuse RIDE never re-asks: the row it finds is
      one she has already been shown, and a question repeated on every render
      about a decision already taken is the dead end D-180 forbids wearing a tap
      target. So the round trip costs one tap ONCE PER DESIGN, and the reuse
      rule is what makes her answer free — the second ask finds this row rather
      than buying a second cut.

      Free, before the claim, and it raises no operation: the two segmenter
      calls above are house money and are the only thing this branch has spent.
    */
    if (chosen.kind === "mint") {
      log.info(
        {
          userId: input.userId,
          candidate: input.candidatePublicId,
          placement: chosen.placement,
          side: chosen.side,
        },
        "[refineService] the cut is shown before it rides — asked before the claim, nothing spent",
      );
      return {
        kind: "asked",
        reask: thisDesignReask({
          designPublicId: design.publicId,
          asked: instruction,
          focus: cutFocus,
        }),
        design: designAnswerFor({ designId: design.publicId }),
        variantId: source.variantPublicId,
        candidateId: input.candidatePublicId,
        imageUrl: currentImageUrl,
        instructions: readInstructions(predecessorForParse?.instructions),
      };
    }
    /*
      AND WHERE SOMETHING ALREADY LIVES, SHE IS ASKED BEFORE ANYTHING DIES —
      replace-on-confirm (founder ruling relayed fable-1158 §1, atomic shape
      countersigned fable-1163 §4).

      His words: *"cant is just paint over the original rather than you hving to
      remopve it just replace the reference image provided?"*. So the refusal
      that used to stand here — remove the resident yourself and send the
      picture again — is gone, and the resident is replaced on her tap.

      **MINT-FIRST, and the Cast briefly holds both.** That is the countersigned
      order and the cost is stated rather than discovered: at the eight-design
      cap an ask that would have replaced can refuse for fullness, in the mint's
      own *"remove one first"* sentence. It is worth it because the SHOWING is
      the point — his own doubt about this surface was answered with it — and a
      preview she cannot see is not a preview.

      Nothing has been claimed here either: the two segmenter calls the mint
      spends are house money, exactly as they are on the fresh-mint road above.
    */
    if (chosen.kind === "replace") {
      log.info(
        {
          userId: input.userId,
          candidate: input.candidatePublicId,
          placement: chosen.placement,
          side: chosen.side,
          resident: chosen.resident.publicId,
        },
        "[refineService] a design already lives there — the replacement is offered before the claim, nothing spent",
      );
      return {
        kind: "asked",
        reask: replaceDesignReask({
          newDesignPublicId: design.publicId,
          residentDesignPublicId: chosen.resident.publicId,
          placement: chosen.placement,
          side: chosen.side,
          asked: instruction,
          focus: cutFocus,
        }),
        design: designAnswerFor({ designId: design.publicId }),
        variantId: source.variantPublicId,
        candidateId: input.candidatePublicId,
        imageUrl: currentImageUrl,
        instructions: readInstructions(predecessorForParse?.instructions),
      };
    }
    /*
      AND THE ADOPT SPENDS ITSELF HERE, one line before the design rides.

      This is the deletion `adoptedReplacement` authorised, and it is deliberately
      NOT taken up where the answer was read. Between there and here sit the
      take, the address and the resolver — a model call among them — and a
      resident deleted before those settle could be a resident deleted for a
      render that never happened. Here the row that replaces it is IN HAND.

      **Both halves of the handle are checked, not one.** The resident dies only
      when the design about to ride is the very row the question offered; a
      handle whose adopted id is not this design is not this question's answer,
      and the ordinary road runs with both rows standing.

      IT HAPPENS BEFORE THE CLAIM, which decides the failure modes (fable-1163
      §4). Either nothing happened, or the resident is gone and the new design
      rides. There is no order in which she pays and keeps neither — and a
      rollback resurrecting a resident she asked us to replace would be worse
      than the replacement she asked for.

      **If the render fails AFTER the charge, the adopted design REMAINS HERS.**
      Nothing here is undone, so the re-ask finds the new row at the address, and
      `inkDesignForAsk` answers `ride` — reuse, no second cut, no second mint,
      and no second question. That is a decided state rather than a leftover.
    */
    if (
      adoptedReplacement
      && adoptedReplacement.resident !== null
      && adoptedReplacement.adopted === design.publicId
    ) {
      const removal = await (dependencies.removeInkDesign ?? removeInkDesign)({
        userId: input.userId,
        designPublicId: adoptedReplacement.resident,
      });
      log.info(
        {
          userId: input.userId,
          candidate: input.candidatePublicId,
          adopted: design.publicId,
          resident: adoptedReplacement.resident,
          removed: removal !== null,
          objectsQueued: removal?.objectsQueued ?? 0,
        },
        "[refineService] the replacement was adopted — the resident is gone and the new design rides",
      );
    }
    /*
      AND IT RIDES. The bytes are the design row's own — our copy, under the
      candidate's purge path — carried by KEY and DIGEST rather than fetched
      here: `repaintRender` already re-reads every reference and refuses when
      the loaded bytes do not hash to the sha the recipe named, which is
      fable-1137 §3b's moved-bytes refusal met by machinery that exists rather
      than by a second check written beside it.

      The scope sentence is composed HERE, in front of her own face, for the
      reason the hair road paid for: carrying the key and the sha and leaving
      the scope to be resolved again at the recipe is exactly how two different
      takes came to dispatch byte-identical prompts.
    */
    inkSource = {
      designId: design.publicId,
      key: design.storageKey,
      sha: design.digest,
      cutRoute: design.cutRoute,
      scope: inkTakeSentence(pronounsForSex(currentIdentity?.sex)),
      address,
    };
  }

  /*
    ---- AND WHERE SHE SAID IT GOES WHEN THERE IS NO PICTURE AT ALL ----

    D-137's promise, kept on the repaint road at last: **words alone document
    ink where the anchor itself shows it — her face and her neck.** Until this
    landed, that promise was not kept here at all.

    # THE WALL THIS REMOVES, measured before it was written (opus-885 §1)

    `slotsForFacet("ink", …)` is `perPlacement`: it answers with NO slots unless
    the caller hands it a placement. And the ONLY thing that ever handed it one
    was `inkSource` — a design minted out of an attached picture. So a
    words-only tattoo ask reached `repaintAsksFor`, found no slot, and refused
    `unplacedInk`: charged, refunded, and answered with

        "I can put a tattoo on her, but I need to know where it goes —
         her neck, an upper arm, her upper chest. Say where and I'll do it."

    said to a customer whose own sentence was *"give him a small geometric
    dinosaur skeleton tattoo ON HIS NECK"*, and whose FILED DELTA held those
    words verbatim. The product asked her for the one thing she had already
    said. In production that is `CASTING_REPAINT_SCOPE=users:1` — his own
    account — on every tattoo ask.

    # WHY THIS IS NOT THE INFERENCE fable-1115 §3 OUTLAWED

    Ruled at fable-1192 §1, and the distinction is the whole licence for this
    block: that ruling forbade DERIVING a fact she did not state from one she
    did — *sleeve implies arm implies pick one*, whose cost is a design on the
    wrong arm. **Extraction is not inference.** *"On his neck"* is HER WORD,
    pulled out of HER SENTENCE and then put through the closed vocabulary,
    which is `resolveInkPlacement`'s existing job and not a new judgement.

    Everything downstream is the reference lane's own machinery, unchanged and
    shared rather than re-implemented: the same take reader, the same closed
    vocabulary, the same source containment on the side, and the same free
    questions before the claim. `sleeve` still comes back OPEN and still walls
    here — because a placement the vocabulary has not measured has no slot,
    which is a separate decision from this one.
  */
  let wordsInkAddress: InkAskAddress | null = null;
  /*
    ⚠ `!pointedAtThePicture` IS THE LANE, AND IT IS NOT A CONVENIENCE.

    D-137's road is words ALONE. An ask that POINTED AT A PICTURE is the other
    road whatever came of it — and what comes of it when the account is outside
    `CASTING_INK_REFERENCE_SCOPE` is that the picture cannot be read, which is
    the document wall doing its job, not an invitation to ask her where it
    goes. Without this condition an ink-reference ask from an account outside
    that flag got a placement question instead of D-137's wall — the gate being
    routed around by the fix for a different lane.

    It is `pointedAtThePicture` — the interpreter's own `fromReference` on THIS
    reading, and the SAME expression the reference branch above enters on, so
    the two lanes cannot both claim a sentence or both disclaim one.

    ⚠ AND IT IS NOT `namesInkFromReference`, WHOSE NAME SAYS OTHERWISE. That
    predicate asks only whether the delta names ink AT ALL — the "FromReference"
    in it is the gate's context, not a field it reads. Written with it, this
    condition was false for every ink ask ever made and the whole block was
    dead; the arms below caught it on the first run.
  */
  if (
    inkSource === null
    && editDelta !== null
    && !pointedAtThePicture
    && facetsWrittenBy(editDelta).has("ink")
  ) {
    const take = await (dependencies.inkTake ?? resolveInkReferenceTake)({
      instruction,
      lane: "words",
    });
    wordsInkAddress = inkAskAddressOf(take);
    /*
      CLOSED FIRST, AND EVERY OTHER ANSWER IS FREE — fable-1192 §1's condition.

      Three of the resolver's answers cannot reach a slot: she named no place,
      she said something too long to be a place name, or she named a surface the
      vocabulary has not measured (`sleeve`, `behind her ear`). All three used
      to travel INTO the claim and meet `unplacedInk` — charged, refused,
      refunded. Here they are answered before any money moves, in that door's
      OWN sentence, from that door's own owner: `cannotSayCopy` already holds
      the words and its docblock already says this branch should be the one she
      meets. A second sentence for the same gap is how a customer meets two
      products.

      `moneySafe: true` and it is arithmetic rather than kindness — this line is
      above the claim, so nothing has been charged to give back.
    */
    const named = wordsInkAddress;
    const measuredPlacement = named === null
      ? null
      : INK_PLACEMENTS.find((one) => one === named.placement) ?? null;
    if (named === null || measuredPlacement === null) {
      log.info(
        {
          userId: input.userId,
          candidate: input.candidatePublicId,
          placement: take?.placement.kind ?? null,
          named: named?.placement ?? null,
        },
        "[refineService] a words-only tattoo ask with no measured place — answered before the claim, nothing spent",
      );
      wordsInkAddress = null;
      return {
        kind: "selected",
        note: cannotSaySentence("unplacedInk", {
          words: null, facet: "ink", scopeNoun: null, moneySafe: true,
        }),
        variantId: source.variantPublicId,
        candidateId: input.candidatePublicId,
        imageUrl: currentImageUrl,
        instructions: readInstructions(predecessorForParse?.instructions),
      };
    }
    /*
      A PAIRED SURFACE AND NO WORD FOR WHICH ONE — the EXISTING side machinery,
      never a guess (fable-1192 §1's condition).

      `sidesForInkPlacement` is the one owner of which surfaces come in pairs,
      and `whichSideReask` is the question the reference lane already asks. An
      answer puts the word in her own sentence, so the take reads it and the
      containment that guards the side accepts it — which is why this cannot
      loop.

      Only for a MEASURED placement: an open phrase has no sides to be unstated
      about, and it walls one door along for a different reason.
    */
    if (
      named.side === null
      && sidesForInkPlacement(measuredPlacement).includes("left")
    ) {
      log.info(
        { userId: input.userId, candidate: input.candidatePublicId, placement: named.placement },
        "[refineService] a words-only tattoo ask on a paired surface with no side — asked before the claim, nothing spent",
      );
      return {
        kind: "asked",
        reask: whichSideReask(instruction),
        variantId: source.variantPublicId,
        candidateId: input.candidatePublicId,
        imageUrl: currentImageUrl,
        instructions: readInstructions(predecessorForParse?.instructions),
      };
    }
  }

  let hairSource: { key: string; sha: string; scope: string } | null = null;
  let attachedPictureUnused = false;
  let secondViewNote: string | null = null;
  /*
    THE HAIR ROAD'S OWN GATE (ruled fable-1163 §2).

    Until 2026-08-20 this branch had no flag of its own: it ran whenever a
    reference RESOLVED, and the resolver asked the hair question — so the hair
    flag gated the hair road by accident of siting. That stopped being safe the
    moment the resolver's gate became the OR of the roads that can act on a
    picture, because an account on the ink road alone would have walked into
    this branch and had a crop cut for it.

    An account outside it with a picture attached falls through exactly as an
    unusable take does: the picture is CONFESSED as unused rather than silently
    ignored, which is the line D-181 has required since the dropped reference
    went unmentioned for its whole life.
  */
  const hairRoadOpen = reference !== null
    && (dependencies.hairReferenceEnabled ?? captureCastingHairReferenceEnabled)(input.userId);
  /*
    AND IF THE ROAD IS SHUT, HER PICTURE IS STILL ACCOUNTED FOR. `inkSource`
    is the other thing an attachment can have been used for; with neither, the
    picture rode along and did nothing, and she is told so in the same list
    every other half-served ask is confessed in.
  */
  if (reference && !hairRoadOpen && inkSource === null) attachedPictureUnused = true;
  if (reference && hairRoadOpen) {
    const take = await (dependencies.hairTake ?? resolveHairTake)({ instruction });
    /*
      AN UNREADABLE TAKE IS NOT A GUESS. `null` is the resolver saying it could
      not tell which of two named takes she meant, and the honest answer to that
      is the same as the honest answer to any unreadable ask — not a crop cut on
      a coin flip. It falls through as an unused picture and is confessed.
    */
    const wantsCrop = take !== null && hairTakeEntry(take).form === "crop";
    /*
      AND DOES THIS ASK TOUCH HAIR AT ALL — derived from the reading through the
      same catalogue the recipe's asks come from, never a second list. A picture
      attached to a sentence about her eyes is a picture with nothing to be cut
      for, and the recipe would refuse it (`sourceNotAsked`) after the money had
      moved.
    */
    const hairSlot = slotsForFeature("hair")?.[0]?.slot ?? null;
    const asksAboutHair = hairSlot !== null && editDelta !== null && editDelta !== undefined
      && Array.from(facetsWrittenBy(editDelta))
        .some((facet) => slotsForFacet(facet).some((definition) => definition.slot === hairSlot));
    if (!wantsCrop || !asksAboutHair) {
      /* Not a failure and not free-of-charge news either: she is TOLD, in the
         same list every other half-served ask is confessed in. */
      attachedPictureUnused = true;
      log.info(
        { userId: input.userId, candidate: input.candidatePublicId, take, asksAboutHair },
        "[refineService] the attached picture was not used — nothing was cut and nothing was spent",
      );
    } else {
      const attached = await (dependencies.readBytes ?? storageReadBytes)(reference.storageKey);
      /*
        IS IT A PHOTOGRAPH, OR A DRAWING OF ONE — the class door (fable-1075 §1),
        asked HERE because this is the only lane it governs.

        A crop is carried into a repaint as a picture of the thing to be
        reproduced, so a gouache painting sent there asks an engine to reproduce
        PAINT on a photograph of a person's head. The colour is a different
        matter and that is why the words road stays open in the same sentence:
        a copper read off a drawing is an honest copper.

        **It routes and never turns her away.** A drawn answer narrows this ask
        to the words road and names the sentence she could type; an unreadable
        answer changes nothing at all, because the licence to narrow comes from
        a positive answer or from nowhere.

        It costs one vision read on house money, bought only once BOTH cheap
        doors above have said this ask wants a crop of her hair — a non-hair ask
        and a colour take buy nothing here.

        Its false-positive court passed 8/8 before this line existed, with the
        bar at ZERO rather than at a rate: a real photograph read as a drawing
        turns a customer away from the crop she asked for, and she has no way to
        argue with it. The hardest arm was a photograph of a man in metal
        prosthetics with one glowing red eye — the same bytes that fooled the
        makeup reader in the opposite direction — and it read photograph 2/2.
      */
      const medium = await (dependencies.readMedium ?? readReferenceMedium)({
        bytes: attached.bytes,
        contentType: reference.mime,
      });
      if (!cropTakeAllowedOn(medium)) {
        log.info(
          { userId: input.userId, candidate: input.candidatePublicId, medium },
          "[refineService] the picture is drawn — narrowing to the words road rather than cutting a carrier from it",
        );
        /*
          AND IT IS COUNTED (§9.14, migration 0045).

          The door's court was barred at ZERO false positives, and a court is a
          reading of a corpus somebody chose. This is the reading of live use:
          how often a real customer's real picture is turned away from the crop
          she asked for. Until this line it was a log line, which is not an
          artifact a rate can be derived from.

          Fire-and-forget on a customer's own path, like every other row this
          table takes — telemetry may never cost somebody an answer.
        */
        void recordReferenceRead("hair", "drawn_narrowed");
        return {
          kind: "selected",
          note: DRAWN_NARROWED_NOTE,
          variantId: source.variantPublicId,
          candidateId: input.candidatePublicId,
          imageUrl: currentImageUrl,
          instructions: readInstructions(predecessorForParse?.instructions),
        };
      }
      const cut = await cutHairCarrier({
        bytes: attached.bytes,
        reader: dependencies.regions ?? defaultRegionReader(),
        about: { userId: input.userId, candidatePublicId: input.candidatePublicId },
      });
      if (!cut.ok) {
        log.info(
          { userId: input.userId, candidate: input.candidatePublicId, code: cut.refusal.code },
          "[refineService] her picture could not become a carrier — refused before the claim",
        );
        return {
          kind: "selected",
          note: cut.refusal.message,
          variantId: source.variantPublicId,
          candidateId: input.candidatePublicId,
          imageUrl: currentImageUrl,
          instructions: readInstructions(predecessorForParse?.instructions),
        };
      }
      const minted = await (dependencies.mintCarrier ?? mintHairCarrier)({
        userId: input.userId, carrier: cut.carrier,
      });
      /*
        `take` is non-null here — `wantsCrop` above proved it, and this is the
        only branch that mint runs in. The narrowing is stated rather than
        asserted with a bang so a future edit that loosens `wantsCrop` fails
        here instead of shipping a crop with nobody's scope on it.
      */
      const cropTake = take;
      if (cropTake === null) throw new Error("a carrier was cut for an unreadable take");
      /* The CAST's pronouns, read the same way every other sentence in this
         render reads them — the scope is spoken in front of her own face. */
      hairSource = {
        key: minted.key,
        sha: minted.sha,
        scope: hairTakeSentence(cropTake, pronounsForSex(currentIdentity?.sex)),
      };
      /* THE SECOND VIEW'S NON-USE IS SAID (ruled fable-1093 §1) — carried to the
         same list the other confessions travel in, so one ask that loses two
         things says both. */
      if (cut.carrier.secondViewUnused) secondViewNote = SECOND_VIEW_UNUSED_NOTE;
    }
  }

  /* ---- the claim ---- */

  const gate = await (dependencies.begin ?? beginDirectOperation)({
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    kind: "castingV2.refine",
    /*
      ONE FACE, ONE RENDER (ruled fable-974).

      The lock is taken here rather than guarded on the client because the
      contract is at the wire: a second tab, a retried request and a slow
      network all walk past a disabled button. It matters most on the dispatch
      road — a receipt that returns in milliseconds is what makes a double tap
      cheap — but it is taken on BOTH roads, because a guard that only exists
      behind a flag is a guard nobody has driven when the flag turns on.
    */
    candidateLockPublicId: input.candidatePublicId,
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
  /*
    FROM HERE THE ATTEMPT HAS AN ARTIFACT OF ITS OWN — an operation row, and in
    a moment a variant and a charge. Anything that fails past this line is
    readable in the ledger and the recovery sweep, so the seam leaves it out of
    the refusal tally: that count exists for the refusal with NO other record.
  */
  attempt.claimed = true;

  /*
    WHICH DESIGN THIS STEP PUTS ON HER — written into the record, so the NEXT
    render can put it back (shape A, ruled fable-1167 §2).

    The hole this closes was read off the wire: a delivered tattoo did not
    survive the next unrelated edit, because the chain remembered her ink WORDS
    and nothing remembered WHICH DESIGN (opus-864 §1). Both lists get it — the
    step's own delta, so a prune takes it away by arithmetic, and the composed
    one, so a reader of the branch state does not have to re-compose to see it.

    Derived from `inkSource`, which is the same object the recipe carries this
    render, so the design recorded and the design painted cannot disagree. The
    slot comes through `slotsForFacet`'s own key builder rather than being
    spelled here, for the reason every ink derivation in this file gives: two
    spellings of a placement is a design on the wrong part of her.

    Absent on every render that is not an ink ask, which leaves both lists
    byte-identical to what they were before this existed.
  */
  const appliedInk = (() => {
    if (inkSource === null) return null;
    const slot = slotsForFacet("ink", { inkPlacement: slotPlacementOf(inkSource.address) })[0]?.slot;
    if (slot === undefined) {
      /* The catalogue cannot name the slot this design went on. It should not
         be reachable — the pre-claim door resolved the address through the same
         vocabulary — and it is handled rather than assumed away: the render
         still happens, and the fact that this design will not carry is LOUD
         rather than a tattoo that quietly stops existing one edit later. */
      log.error(
        { userId: input.userId, candidate: input.candidatePublicId, placement: inkSource.address.placement },
        "[refineService] a design is riding this render and the catalogue cannot name its slot — it will not carry to the next edit",
      );
      return null;
    }
    return { slot, designId: inkSource.designId };
  })();
  const claimedDeltas = appliedInk === null
    ? composed
    : withAppliedInk(composed, appliedInk.slot, appliedInk.designId);
  const claimedStepDeltas = appliedInk === null || stepDeltas.length === 0
    ? stepDeltas
    : [
      ...stepDeltas.slice(0, -1),
      withAppliedInk(stepDeltas[stepDeltas.length - 1]!, appliedInk.slot, appliedInk.designId),
    ];

  let variant: Awaited<ReturnType<typeof claimVariant>>;
  try {
    variant = await claimVariant({
      userId: input.userId,
      candidatePublicId: input.candidatePublicId,
      operationId,
      pointsCost: price,
      instructions,
      deltas: claimedDeltas,
      stepDeltas: claimedStepDeltas,
      stepProvenance,
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

        RECORDED ALWAYS, and it used to be recorded only while the segment
        store was armed. **Both halves of that gate's reason were stale, and the
        second one cost four renders to find.**

        It was never a deploy defence: Drizzle names every column in the schema
        and passes `default` for the ones a caller leaves out, so the column is
        in the INSERT whether or not this line has a value for it — proved by
        dropping the column under a real claim in
        `castingV2-segment-store-db.test.ts`. The migration-before-code ordering
        is what protects that deploy, and it still does.

        And the lineage is no longer the store's private fact. THE CARRY READS
        IT: `listLineageReferences` anchors on this variant and climbs its
        parents, so a NULL here means a render whose ancestors are invisible —
        no filed crop rides, every feature the face already had is re-issued in
        words or lost, and the completeness guard turns the render into a
        refund. Driven on a fixture inside the repaint and library scopes but
        outside the segment one: two arms, two attempts each, four renders, and
        every one came back with the earrings she had been given gone —
        `carried: []` beside two healthy library rows. The version rail's take
        grouping climbs the same column.

        Nothing in production was ever exposed (all four scopes name the founder
        alone), but `CASTING_V2_SCOPE` is already `all`, so widening the repaint
        road by itself would have detonated it for everyone at once.

        AND A RE-ROLL TAKES THE PREDECESSOR'S PARENT, not the predecessor: it is
        the same version again, so it hangs where that version hung. Recording
        the predecessor would make take 2 a CHILD of take 1 and the two would
        never group.
      */
      parentVariantPublicId: repeatsThisVersion
        ? existing.find((row) => row.id === predecessor?.parentVariantId)?.publicId ?? null
        : predecessor?.publicId ?? null,
      /*
        AND WHICH TAKE IT REPLACES, SAID NOW RATHER THAN ON ARRIVAL (fable-703).

        The same fact `landVariant` writes when the picture lands, from the same
        condition — written here as well because the four minutes in between are
        exactly when somebody is watching. An in-place re-roll adds no chip, so
        the rail had nothing to draw the wait on and the version being redrawn
        sat there in its old render: *"it just stayed the same."*
      */
      regeneratesVariantPublicId: repeatsThisVersion ? predecessor?.publicId ?? null : null,
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
    /*
      THE RECEIPT, AT THE FIRST MOMENT IT IS TRUE (Landing C).

      Not one line earlier: this is where the row the panel's pending list draws
      says `dispatched`, so a customer handed a receipt before it would be told
      her edit is running by a surface that cannot yet see it. And not one line
      later either — everything below is the render, which is the whole thing
      she has stopped waiting on.

      A no-op when the flag is off, and that is the entire difference between
      the two roads: the same claim, the same charge, the same paint, the same
      rows. What moves is who is still holding the socket while it happens.
    */
    attempt.dispatched?.({
      variantId: variant.publicId,
      operationId,
      /* The picture she is looking at — the one being redrawn — because a
         receipt is not a new frame and must never look like one. */
      imageUrl: storagePublicUrl(variant.baseImageKey),
      instructions,
      ...(designAnswerFor(inkSource) ? { design: designAnswerFor(inkSource) } : {}),
    });

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
      Her studio's own wall, sampled ONCE per render rather than once per carried
      crop: the master does not change between its own references, and
      `studioBackgroundOf` reads the whole image to run its control.
    */
    let studioBackgroundOnce: Promise<StudioBackground> | null = null;
    const studioBackground = () => (studioBackgroundOnce ??= studioBackgroundOf(base.bytes));
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
    /*
      AND THE READER IS `readStoredDelta`, NOT `readDelta` (ruled fable-881 §3).

      This line re-reads OUR OWN PERSISTED ROW, which is exactly the boundary
      `readStoredDelta` exists for — its own header draws the split: the strict
      reader guards where a MODEL'S REPLY enters the record and must stay closed
      to open kinds, this one guards where our history re-enters, "where a key
      we wrote is a fact already paid for."

      It was the strict reader, and driven rather than read that cost the open
      lane its headline ask. `readDelta` returns NULL for a row whose only
      content is an open kind — *"give her vampire fangs"* is one ask and it is
      the open one — so the throw below fired on the ordinary shape, ABOVE the
      road split, on the repaint road as well as the paste road. It settles into
      the request's catch and refunds, so the money was never at risk; the
      picture was. Sell-don't-refuse would have been sell-then-refund on 100% of
      open asks. On a face with prior edits the row survived instead and the
      open kind was dropped from the composed prompt SILENTLY, which is worse.

      What else changes, declared: this reader also migrates retired subjects.
      A legacy row naming `free.hair` threw here before and composes now —
      driven both ways in `wallDOpenKind.test.ts`, and the after-behaviour is
      the honest one, because the throw was never a decision about that row. It
      was the strict reader refusing a vocabulary that predates it.
    */
    const filed = readStoredDelta(variant.deltas);
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
    /* Read once, at the admission door above, so the road that ADMITS the ask
       and the road that PAINTS it can never be two different answers to the
       same question inside one request. */
    const repaintEnabled = repaintServesThisUser;
    /*
      THE BRANCH'S ROWS ARE READ BEFORE THE ASKS ARE BUILT (fable-318 R2).

      They used to be read after, because the asks were a function of the step
      alone. They are not: a slot whose newest crop the door refused has to be
      re-said in WORDS by this render, and only these rows know which slots
      those are. Read once and used twice — the same list derives the library
      below, so the asks and the library cannot disagree about the face.

      **And now three times**, which is why it sits out here rather than inside
      the render: the VERIFICATION reads it too, to know which one of a pair the
      last edit of it touched (fable-444 condition 1). A second read would be a
      second list of the same rows and law 4 says what happens to those — and
      this one has to agree with the recipe exactly, because it decides what the
      reader is asked about the picture the recipe produced.

      Read once per RENDER rather than per attempt. The free retry re-enters the
      paint, not this: nothing writes a library row between the two attempts —
      the mint lands after the render is kept — so a per-attempt read could only
      ever return the same rows more slowly.
    */
    const branchRows = repaintEnabled
      ? await listLineageReferences({
        userId: input.userId,
        candidateId: variant.candidateId,
        anchorVariantId: variant.id,
      })
      : [];
    /**
     * The prune's own asks, or null when this is not a prune we can name.
     *
     * Null is the honest answer in three cases and each one keeps the old
     * refusal: nothing was struck (no facets), nothing can be named (the words
     * are missing), or the struck facets file under no slot at all — a recipe
     * that named none of them would be exactly the unverified render this shape
     * exists to prevent.
     */
    const restateAsksForPrune = (): ReturnType<typeof repaintAsksFor> | null => {
      if (removedFacets.size === 0 || takenBack === null) return null;
      /*
        THE KIND COMES FROM THE WORDS THAT LEFT, not from the ask.

        `accessoryRegion` is derived from what this step FILES, and a prune files
        nothing — so it is null here and `statedAccessories` (one facet over
        several kinds) would resolve to no slot at all. The same longest-match
        table answers it from the words being taken back, which is where the
        kind actually is: "gold hoop earrings" is an earring whether it is
        arriving or leaving.
      */
      const takenKind = accessoryRegion ?? accessoryKindOf(takenBack);
      const slots = Array.from(removedFacets)
        .flatMap((facet) => slotsForFacet(facet, { accessoryKind: takenKind ?? null }))
        .map((definition) => definition.slot)
        .filter((slot, at, all) => all.indexOf(slot) === at);
      if (slots.length === 0) return null;
      return repaintAsksFor({
        /* Empty on purpose: a prune adds nothing. The asks below are the ask. */
        delta: {},
        prose: EDIT_PROSE,
        restate: slots.map((slot) => ({ slot, taken: takenBack! })),
        /*
          AND WHAT THE BRANCH IS STILL CARRYING WITH NOWHERE TO KEEP IT.

          A presentation fact has no library row anywhere — D-136 gives it no
          slot, so the composed recipe is the only place it is written down —
          and every render anchors on the pristine master. A recipe that goes
          quiet about her smile paints the master's face back.

          The ordinary road passes `composed` here and re-says it on every
          render. **This road passed nothing**, four lines below the recomposed
          chain it needed, so taking back an unrelated step also took her smile
          — silently, from a customer who paid for it. Found by the step-4 sweep
          for the same shape (opus-569 §2) and driven at the wire before it was
          fixed.

          `composed` is `composeChain(chain)` on this road: the SURVIVING steps.
          So a prune of the presentation step itself correctly says nothing —
          the fact is gone from the composition, which is what a prune is.

          No restore slots: a prune restores nothing, and this argument is here
          for the state alone.
        */
        restore: { state: composed, slots: [] },
      });
    };

    const repaintOnce = async () => {
      /*
        THE LIBRARY AS IT STANDS, READ BEFORE THE ASKS ARE BUILT.

        It used to be derived below, after the asks, because nothing above
        needed it. The open lane's carry/edit split does (D-244, fable-909 §1):
        whether a carried open kind is re-said in the change clause or carried
        by its crop depends on whether a crop EXISTS, and that is the library's
        answer, not a second one computed beside it (working law 4).

        Nothing here depends on the asks — `carriesAfterPruning` reads the rows
        and the surviving chain, `deriveLibrary` reads the rows — so hoisting it
        changes no value, only the order they are read in. The one thing that
        does depend on the asks is `libraryWithoutEditedCrops`, and it stays
        below with them.
      */
      /*
        AND A CROP WHOSE ASK HAS BEEN TAKEN BACK STOPS RIDING (V3(c) step 2).

        The chain already prunes and the library does not, so the two answer
        "what does she have" by different routes and a prune moves only one of
        them. This derives the carry list from BOTH — live rows ∩ what the
        surviving chain still names — and it deletes nothing, retires nothing
        and writes nothing: re-adding the step brings the crop back because the
        crop was never destroyed.

        On an ordinary render it changes nothing, because the chain names every
        crop the library holds; that is asserted rather than hoped in
        `prunedCarries.test.ts`, along with the two exemptions that matter more
        than the rule (a master-minted row belongs to every branch, and a slot
        re-cut every render is minted by the render rather than by an ask).

        `branchRows` itself is left whole on purpose: the geometry lookup and
        the per-instance memory below are asking a different question — what
        this face's rows SAY — and pruning an ask does not unsay it.
      */
      const carried = carriesAfterPruning({ rows: branchRows, composed });
      if (carried.dropped.length > 0) {
        log.info(
          {
            operationId,
            variant: variant.publicId,
            dropped: carried.dropped.map((one) => one.slot),
          },
          "[refineService] a crop stopped riding because the chain no longer asks for it",
        );
      }
      /*
        The library as it stood when this render started. The anchor is this
        variant — its own rows do not exist yet, so the walk climbs its parents
        — which is the same anchor the mint's duplicate check uses below, and
        for the same reason.
      */
      const libraryBeforeAsks = deriveLibrary(carried.rows);
      /** The slots that can carry themselves by crop on THIS render — the
       *  library's own answer, handed to the ask builder rather than recomputed
       *  there from a second source. */
      const croppedSlots = new Set(
        libraryBeforeAsks.filter((entry) => entry.carry !== undefined).map((entry) => entry.slot),
      );
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
            AND WHERE ON HER THE DESIGN GOES, from the take that read her own
            sentence — the ink facet's slot cannot be looked up in a table
            (`FacetAssignment`'s `perPlacement` branch says why).

            Derived ONCE, in the pre-claim door, and carried: re-deriving it
            here would be a second reading of the same sentence, and the two
            disagreeing means a design on the wrong arm. Undefined on every
            render that is not an ink ask, which is every render so far.
          */
          /*
            TWO ROADS, ONE FIELD. `inkSource` is the design minted from a
            picture; `wordsInkAddress` is D-137's words-only road, where the
            place came out of her own sentence and there is no design at all.
            Both were derived ONCE in the pre-claim door and are carried here —
            re-deriving would be a second reading of the same sentence, and the
            two disagreeing means a design on the wrong part of her.
          */
          ...(inkSource
            ? { inkPlacement: slotPlacementOf(inkSource.address) }
            : wordsInkAddress
              ? { inkPlacement: slotPlacementOf(wordsInkAddress) }
              : {}),
          /*
            AND WHAT THE LIBRARY CANNOT PICTURE, SAID IN WORDS INSTEAD.

            `composed` rather than `editDelta`: the point of a restoration is to
            say what she is currently wearing, which this step said nothing
            about. A slot only appears here when its newest version has no
            pixels, so on an ordinary face the list is empty and not one line of
            this changes the recipe.
          */
          restore: { state: composed, slots: supersededCarrySlots(branchRows) },
          /*
            ONE INSTANCE, IF SHE POINTED AT ONE. Undefined on every ask that
            does not come from a tapped row or a clicked rectangle — the panel
            sends both, and production renders carry the result (`askScope` on
            v#198/v#199). This line is load-bearing, and the docblock that used
            to call it inert outlived the fact by two shifts.
          */
          ...(input.scope ? { scope: input.scope } : {}),
          /*
            READING THE SIDE OUT OF HER SENTENCE — dark until its court has run
            (fable-604 §3b).

            Off, a sentence naming one side of a pair refuses rather than
            dispatching a contradiction; on, it narrows to that side exactly as
            a tapped box does. The flag exists so the court can drive the real
            service end to end without the behaviour reaching anybody, and it
            goes away — one default, one line — the day the court passes.
          */
          inferSideFromWords: process.env.CASTING_SIDE_INFERENCE === "on",
          /*
            AND WHICH FEATURES THE LIBRARY CAN CARRY BY CROP — the open lane's
            carry/edit split (D-244, ruled fable-909 §1).

            An open kind the customer is NOT changing this step stops being
            re-said in the change clause once a crop exists for it, because a
            re-said kind is an EDIT and D-244 line 2 is that a feature's own
            crop never rides in its own edit. Without this the mint filed a
            crop and the very next render dropped it — the sentence that
            preserved the feature before crops existed being the thing that
            throws the crop away.

            A kind with no crop is unaffected and still re-said, which is every
            open kind on every cast whose library has not minted one.
          */
          cropped: croppedSlots,
        })
        /*
          A PRUNE ASKS SOMETHING AFTER ALL — the narrow lift (fable-536 §2/§3).

          This door refused every prune outright, and its own detail said why:
          a removal strikes matching words from the library's stack, "which is
          not yet derived from the chain's own pruning". It is now
          (`prunedCarries`), so the crop stops riding by derivation and the
          master — which never had the thing — does the removing by arithmetic,
          the road the horns removal court measured at 3/3 gone and 3/3 clean.

          The ask exists for the VERIFICATION rather than for the painter: it
          names the slots taken back and what was taken, so the net has a
          question at the wire instead of shipping unverified on the one fact
          this render exists to change.

          A NARROWING, not an opening. Only a prune that actually took something
          back and can name it gets through; anything else meets the same
          refusal it met before, and the arm that proves it is driven.
        */
        : restateAsksForPrune()
          ?? repaintCannotRemove();
      if (!asks.ok) {
        log.error(
          { operationId, variant: variant.publicId, reason: asks.reason, facet: asks.facet },
          "[refineService] the repaint cannot say this ask declaratively — refusing rather than painting a recipe that never mentions it",
        );
        throw new RepaintCannotSayError(asks, {
          /*
            THE ASK'S OWN WORDS, for the sentence the settlement writes.

            Only the makeup door has ruled copy (fable-354), and `makeup` is the
            facet whose delta value IS the phrase she asked about — "lip gloss",
            "a red lip". Every other reason carries no words and falls to the
            generic line, which is the control the tests pin: a door that starts
            answering for everything is how the generic line stops being generic.
          */
          words: asks.facet === "makeup" ? editDelta?.makeup ?? null : null,
          /* The part she pointed at, said the way the product speaks about it —
             the sentence's whole difference on a scoped ask (fable-471). */
          scopeNoun: (() => {
            const scoped = input.scope ? slotDefinition(input.scope) : null;
            /* The catalogue's own noun with her pronoun in front of it — the
               same two facts the panel speaks a row with, never a third
               spelling of "her left ear". */
            return scoped ? `${pronounsForSex(currentIdentity?.sex).possessive} ${scoped.noun}` : null;
          })(),
        });
      }
      /*
        A SLOT THE RESTORE COULD NOT NAME, SAID OUT LOUD (fable-766 §3).

        `repaintAsksFor` skips a restore slot the catalogue cannot resolve — it
        has no noun to restore it with — and until now it did so in silence.
        Unreachable on today's vocabulary, and the class it belongs to is not:
        a paid feature that vanishes under a later operation without a trace is
        the build-lost shape, and this is the one line that would name it.

        `warn`, not `info`: nothing here is expected, and the day one appears it
        is a feature the customer has lost.
      */
      if (asks.unnameableRestores !== undefined) {
        log.warn(
          {
            operationId,
            variant: variant.publicId,
            slots: asks.unnameableRestores,
          },
          "[refineService] a restore names slots the catalogue cannot, so they were not restored — a carried feature is missing from this render",
        );
      }
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
      const library = libraryWithoutEditedCrops(libraryBeforeAsks, editedSlots);
      /*
        THE DESIGNS SHE ALREADY HAS — clause (a), ruled fable-1167 §2.

        Ink never enters the reference library (fable-1137 §3), so nothing in
        the machinery above puts a delivered tattoo back on the next render.
        Read off the wire before it was built: step one painted a chest piece
        and step two — "give him green eyes" — dispatched the master and a hair
        crop, no ink reference, no ink clause, tattoo gone (opus-864 §1).

        THE CHAIN SAYS WHICH DESIGNS, AND THE ROWS SAY WHAT THEY ARE. The
        composed delta carries `inkApplied` per slot, so a fork carries what its
        own steps did and a prune takes one away by arithmetic; the row supplies
        the bytes, the digest and the cut disposition, owner-scoped on both
        sides of its own join. The id POINTS and the row DECIDES — a delta
        naming a design that has since been deleted carries nothing, and one
        naming an unexamined row is refused by the assembler rather than
        painted.

        Skipped entirely when the branch has no applied design, which is every
        render this product has served: no read, no allocation, no change.
      */
      const appliedBySlot = composed.inkApplied ?? {};
      const carriedInk = Object.keys(appliedBySlot).length === 0
        ? []
        : await (async () => {
          const designs = await (dependencies.listInkDesigns ?? listInkDesigns)({
            userId: input.userId,
            candidatePublicId: input.candidatePublicId,
          });
          /*
            AND THE TATTOO AS IT LANDED ON HER, where one has been kept —
            clause (a), countersigned fable-1194 §2.

            Read beside the designs rather than instead of them: the crop is
            what RIDES, and the design row is still what says the carry is
            legal at all (its `cutRoute`, its very existence, the per-design
            delete). A crop with no design row behind it carries nothing, which
            is the same rule one line down and is what makes the per-design
            delete still work.

            An absent table is TOLERATED here and nowhere else on this path: it
            is the ordinary state of a database that has not taken 0049 yet,
            and the answer to it is the road this lane drove yesterday — the
            artwork carry — rather than a refund on a render already delivered.
          */
          const deliveredCrops = await (dependencies.listInkDeliveryCrops ?? listInkDeliveryCrops)({
            userId: input.userId,
            candidatePublicId: input.candidatePublicId,
          }).catch((error: unknown) => {
            log.warn(
              { operationId, variant: variant.publicId, err: error },
              "[refineService] the delivered-tattoo crops could not be read — every carry on this render rides the design's own artwork",
            );
            return [] as const;
          });
          /* The assembler's own type rather than a re-listing of its fields:
             a copy drifts by losing a field nothing can see, and the Atlas
             says so mechanically. */
          const carried: CarriedInkDesign[] = [];
          for (const [slot, designId] of Object.entries(appliedBySlot)) {
            /* A slot this render EDITS is handed the design as a SOURCE with
               the ask's own words; carrying it as well would send one picture
               twice with two sentences, and the assembler refuses that outright
               (`carriesItsOwnEdit`). Skipped here rather than refused because
               it is the ORDINARY state of every ink edit, not a defect. */
            if (editedSlots.has(slot)) continue;
            const design = designs.find((row) => row.publicId === designId);
            const noun = slotDefinition(slot)?.noun;
            if (design === undefined || noun === undefined) {
              /*
                LOUD, ALWAYS. A design that has been deleted stops riding, which
                is right and is what the per-design delete is for — but it is
                also indistinguishable at this line from a record that has come
                apart, and a tattoo that quietly stops existing is the exact
                shape this whole build exists to end.
              */
              log.warn(
                {
                  operationId,
                  variant: variant.publicId,
                  slot,
                  design: designId,
                  reason: design === undefined ? "noRow" : "uncataloguedSlot",
                },
                "[refineService] the branch says a design is on her and this render cannot carry it — the tattoo will not be in this frame",
              );
              continue;
            }
            /*
              THE CROP IS MATCHED ON BOTH THE DESIGN AND THE SLOT.

              Never on the design alone: the same design may in principle sit at
              two placements, and a crop of her neck sent as her upper arm's
              carry would be the wrong-boundary class with a picture attached.
              The row's own unique key is (candidate, design, slot), so matching
              on less than it here is matching on less than the thing is keyed by
              (`uniqueness-proves-the-key`).
            */
            const delivered = deliveredCrops.find(
              (crop) => crop.designPublicId === designId && crop.slot === slot,
            );
            carried.push(delivered
              ? {
                slot,
                picture: "deliveredCrop",
                /* Same posture as the artwork below — by KEY and DIGEST, and
                   `repaintRender` refuses if the bytes at that key have moved. */
                image: { key: delivered.storageKey, sha: delivered.digest },
                noun,
              }
              : {
                slot,
                picture: "designArtwork",
                /* By KEY and DIGEST, never fetched here: `repaintRender` re-reads
                   every reference and refuses when the loaded bytes do not hash to
                   the sha the recipe named, which is fable-1137 §3b's moved-bytes
                   refusal met by machinery that already exists. */
                image: { key: design.storageKey, sha: design.digest },
                cutRoute: design.cutRoute,
                noun,
              });
          }
          return carried;
        })();
      if (carriedInk.length > 0) {
        log.info(
          {
            operationId,
            variant: variant.publicId,
            /*
              WHICH PICTURE EACH ONE RODE, and it is the line that says whether
              (a) is happening at all. A carry reading `designArtwork` after 0049
              has landed is the state the court measured onto a T-shirt three
              times — indistinguishable at the frames from (a) not working, and
              visible here in one search of the log.
            */
            slots: carriedInk.map((one) => `${one.slot}:${one.picture}`),
          },
          "[refineService] her own designs ride a render that is not about them",
        );
      }
      const recipe = assembleRecipe({
        /* The master is the base this render is anchored on, by key. Every
           render is `edit(original, …)` and `claimVariant` proved that base
           inside the statement that proved the parent, so this cannot be got
           wrong here. */
        master: { key: variant.baseImageKey },
        /* Never assumed: `segmentsOnFace` shipped "hers" onto a male
           candidate's face before pronouns were passed rather than guessed. */
        pronouns: pronounsForSex(currentIdentity?.sex),
        /*
          AND WHERE A SIDE IS, when this account is inside the phrasing scope.
          Read here rather than inside the assembler for the same reason the
          pronouns are: the flag is per user and the assembler knows nothing
          about users.
        */
        placeSides: (dependencies.sidePhrasingEnabled ?? captureCastingSidePhrasingEnabled)(
          input.userId,
        ),
        library,
        asks: asks.asks,
        /*
          AND WHAT HAS NO SLOT TO FILE UNDER, SAID IN WORDS (fable-446).

          Empty on every render that never asked for one, which is every render
          before expression opened — the assembler's own default. It is passed
          beside `asks` rather than folded into them because the two are
          different kinds of thing: an ask names a slot the mint files and the
          carry crops, and this names a fact that is true of the picture and of
          nothing the library holds.
        */
        ...(asks.presentation ? { presentation: asks.presentation } : {}),
        /*
          AND THE PICTURE SHE ATTACHED, cut down to her hair (fable-1096 §1).

          The slot is taken from the ASK LIST rather than derived a second time:
          the assembler refuses a source naming a slot no ask names, and that
          refusal throws into the refund — so the one thing this line must never
          do is disagree with `asks.asks` about which slot the render is about.
          The pre-claim door has already proved this ask touches hair; this
          finds the slot it actually became.

          Absent on every render without an attachment, which is every render
          this product has served so far.
        */
        /*
          THE DESIGN, AS THE RENDER'S SECOND REFERENCE.

          The slot is taken from the ASK LIST rather than derived again, for the
          identical reason the hair carrier's is: the assembler refuses a source
          naming a slot no ask names, and that refusal throws into the refund.
          Here the agreement is structural rather than hopeful — both sides come
          from `inkSource.address` through one owner (`slotsForFacet`), so the
          only way they can disagree is if the ask list holds no ink slot at
          all, which is the case the log below names.

          `cutRoute` rides because the assembler REQUIRES it: an ink source
          cannot be constructed without stating what was done to its bytes, and
          `null` — nobody looked — is refused there as the backstop to the
          pre-claim door that already refused it free.
        */
        ...(carriedInk.length > 0 ? { carriedInk } : {}),
        ...(inkSource
          ? (() => {
            const slot = asks.asks.map((ask) => ask.slot).find((one) => isInkSlot(one));
            if (slot === undefined) {
              /* The pre-claim door resolved a design and the ask list names no
                 ink slot. Sending it anyway would put a picture in front of the
                 painter that no sentence accounts for, so it is dropped and the
                 fact is loud — a defect in two derivations agreeing, never a
                 customer's mistake. */
              log.error(
                { operationId, variant: variant.publicId, slots: asks.asks.map((ask) => ask.slot) },
                "[refineService] a design was resolved for an ask whose recipe names no ink slot — dropping it rather than sending a reference nothing says anything about",
              );
              return {};
            }
            return {
              sources: [{
                slot,
                image: { key: inkSource.key, sha: inkSource.sha },
                pictures: "inkDesignOnTransparency" as const,
                cutRoute: inkSource.cutRoute,
                scope: inkSource.scope,
              }],
            };
          })()
          : {}),
        ...(hairSource
          ? (() => {
            const slot = asks.asks
              .map((ask) => ask.slot)
              .find((candidate) => candidate === (slotsForFeature("hair")?.[0]?.slot ?? null));
            if (slot === undefined) {
              /* The pre-claim door said this ask touches hair and the ask list
                 says otherwise. Painting anyway would send a picture no sentence
                 accounts for, so the carrier is dropped and the fact is loud —
                 it is a defect in the two derivations agreeing, not a customer's
                 mistake. */
              log.error(
                { operationId, variant: variant.publicId, slots: asks.asks.map((ask) => ask.slot) },
                "[refineService] a carrier was cut for an ask whose recipe names no hair slot — dropping it rather than sending a reference nothing says anything about",
              );
              return {};
            }
            return {
              sources: [{
                slot,
                image: { key: hairSource.key, sha: hairSource.sha },
                pictures: "hairOnRedactedForm" as const,
                /* His 1048 amendment, reaching the engine — required by the
                   type, so this line cannot go missing quietly again. */
                scope: hairSource.scope,
              }],
            };
          })()
          : {}),
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
            /*
              AND HOW BIG IT WENT OUT — read off the dispatched bytes, not off
              the geometry column beside them (working law 5).

              The carried-crop drift hid for four shifts because the record said
              WHICH crop was sent and never at what size, so "two references at
              different scales" was a thing nobody could see in the database. A
              padded reference reads the master's own frame here; an unpadded one
              reads its crop's, which is how a fit that quietly did not happen
              stays visible.
            */
            sentGeometry: sent.geometry[at] ?? null,
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
        /* AND WHAT IT TOOK BACK. Not a vacancy — nothing is retired and nothing
           is said in the prompt — but a fact about the request all the same, and
           the anchor the verification reads to ask whether the pruned thing is
           actually gone. Absent on every render that pruned nothing. */
        ...(recipe.restated.length > 0 ? { restated: recipe.restated } : {}),
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
        /*
          AND EVERY CARRIED CROP GOES OUT AT THE MASTER'S OWN GEOMETRY.

          Measured, not supposed: a 484×617 crop beside a 1024×1536 master
          drifted the founder's frame +7% to +10% face height across three
          repeats, against +0.5% with no carry at all — and the same crop padded
          back to its own position holds the frame AND keeps her hair. The
          numbers and their controls are in `referenceFit.ts`.

          Keyed on the branch rows already read above for the asks, so the
          geometry used here is the geometry the library recorded when it cut the
          crop — not a second lookup that could answer about a different row.
        */
        fit: dependencies.fitReference ?? (async ({ reference, image, role, frame }) => {
          /*
            Measured for the record, and a failure to measure is UNKNOWN rather
            than fatal: `sent.geometry` is evidence about what went out, and
            evidence that cannot be gathered must not take a paid render down
            with it. Zero reads as null in the record.
          */
          const asDispatched = async (bytes: Buffer, contentType: string) => {
            try {
              const sharp = (await import("sharp")).default;
              const meta = await sharp(bytes).metadata();
              return { bytes, contentType, width: meta.width ?? 0, height: meta.height ?? 0 };
            } catch {
              return { bytes, contentType, width: 0, height: 0 };
            }
          };
          const unpadded = () => asDispatched(reference.bytes, reference.contentType);
          /* The master IS the frame; nothing to fit, but its size is still
             measured so the wire assertion covers every reference. */
          if (role.kind === "master") return unpadded();
          /*
            AND A SOURCE IS NOT IN HER FRAME AT ALL.

            The pad exists because a crop cut FROM this master drifts the frame
            when it rides at its own size — it has a position to be put back
            into. A carrier cut from somebody else's photograph has none: padding
            it into her geometry would place a stranger's head at a coordinate
            that means nothing, and the fit's own `branchRows` lookup would have
            missed it anyway. Said here rather than left to fall through, so the
            reason is a decision rather than an accident of a lookup.
          */
          if (role.kind === "source") return unpadded();
          const stored = branchRows.find((row) => row.storageKey === image.key)?.geometry ?? null;
          /*
            NO GEOMETRY MEANS NO PAD, dispatched exactly as production does
            today. Refusing here would turn a missing column into a failed paid
            render: the crop still carries its feature, it simply carries the old
            drift with it, and `sent.geometry` records the size that went out —
            so the gap is visible in the record rather than assumed away.
          */
          if (!stored) return unpadded();
          try {
            return {
              bytes: await padToFrame({
                crop: reference.bytes,
                geometry: stored,
                frame,
                background: await studioBackground(),
              }),
              contentType: "image/png",
              ...frame,
            };
          } catch (cause) {
            /*
              DECLARED, NOT SILENT. Every throw in `padToFrame` is an integrity
              complaint — a bbox from a differently-sized frame, a crop whose
              bytes disagree with its own geometry, a background that came back
              as the average of the whole photograph. None of them is a reason to
              refuse a render the old road would have delivered, so this falls
              back to today's behaviour and says so at error level, with the
              recorded geometry showing the crop's own size rather than the
              frame's.
            */
            log.error(
              { operationId, variant: variant.publicId, key: image.key, detail: (cause as Error)?.message },
              "[refineService] a carried crop could not be padded to the master's geometry — "
              + "dispatching it unpadded, which is the old drift and not a new failure",
            );
            return unpadded();
          }
        }),
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
        /*
          A PRESENTATION FACT IS READ FROM THE RECIPE, NOT FROM THE IDENTITY
          (fable-446).

          `currentValueOfFacet` reads the resolved identity, and a smile is
          deliberately never written there (D-136 — a follow must never inherit
          one). So the identity answers null, the fact drops out of this list,
          and the render is delivered with nobody having looked at the one thing
          it was asked to change. The composed recipe is the only place the fact
          is written down, and it is the same place the recipe's own clause is
          built from — one source, one wording, painter and reader agreeing.
        */
        const asked = presentationWordsOfFacet(composed, facet)
          ?? (currentIdentity
            ? currentValueOfFacet(applyDelta(currentIdentity, composed), facet)
            : null);
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
            subject: aboutFacet(facet),
            asked: `${asked}${lateralOf(asked)}`,
            binding: guaranteedFacets.has(facet) || presence,
          }];
        }
        const before = new Set(
          (priorItems[plural.subject] ?? []).map((item) => item.toLowerCase()),
        );
        const carriedEvidence = evidencesDelivery(carriedCaptions[facet]);
        return plural.items.map((item) => ({
          subject: aboutFacet(facet),
          asked: `${item}${lateralOf(item)}`,
          binding: guaranteedFacets.has(facet)
            || (facetBindsOnPresence(facet)
              && (!before.has(item.toLowerCase()) || carriedEvidence)),
        }));
      });
    /*
      AND THE KINDS NOBODY HAS CATALOGUED — the open lane entering the net
      (fable-911 §2, shape (C)).

      # The gap, and it was an ENTRY boundary rather than a missing check

      `facetsWrittenBy` keys on the closed union and an open kind has no facet,
      so the loop above cannot reach one. The consequence was that **the one
      lane whose entire money story is *is the thing there* was the one lane
      with no presence check**: a customer types *"give her a halo"*, pays 25
      credits, and if the frame comes back bare nothing disputes it and nothing
      is recorded for anyone to count later.

      # The COMPOSED state, so a carried kind is asked about too

      Both directions ask (fable-911 §2 (2)), and the reason is sharper since
      the carry/edit split landed: the defect class IS a carried feature
      vanishing, and a carried open kind is no longer even mentioned in the
      change clause. A check scoped to what this edit wrote would be blind to it
      by construction — this module's own founding sentence, one lane over.

      # RECORD, NEVER REFUND — and the deviation is declared where the policy is

      `openKindBinds()` says `presence` and that classification is not wrong.
      What is missing is the MEASUREMENT: no specimen family, no court, no
      audited reliability for a kind nobody has catalogued. An unmeasured reader
      may not spend a customer's money being wrong (law 9), so
      `openKindPresenceBindsToday()` holds it non-binding and names the
      promotion condition beside the policy it deviates from.

      # `asked` IS THE RECORD'S OWN WORDS, not the recipe's standing sentence

      A crop-carried kind is spoken for by the library's read-back — *"Keep her
      fangs exactly: long white pointed vampire fangs"* — and that sentence is
      assembled inside the render, from rows this list is built before. Deriving
      it a second time out here would be exactly the parallel copy law 4 forbids,
      drifting into a paid reader's question. So the check records what the
      RECORD promised — her own words, the same source the recipe composes from
      — and the question is put under the stored NOUN. It is also the safer
      direction for a non-binding record: the ask is broader than the mint's
      read-back, so a reader cannot miss on an adjective nobody typed.

      # ONLY ON THE ROAD THAT SAYS THEM

      `delta.open` reaches the painter through the repaint recipe and nothing
      else — the paste road composes its prompt from words the recipe never
      carries. Asking a reader about a halo the painter was never told about
      would manufacture a miss on every frame and file it against the kind. The
      control for this aim is driven beside the positive arm.
    */
    if (repaintEnabled) {
      for (const [kind, said] of Object.entries(readOpenKinds(composed) ?? {})) {
        facts.push({
          /* Through `readOpenKinds`, which is strict about the key, so a slot
             the catalogue would refuse cannot reach the constructor. */
          subject: aboutOpenKind({ slot: openSlotKey(kind), noun: said.noun }),
          asked: said.words,
          binding: openKindPresenceBindsToday(),
        });
      }
    }

    /*
      AND THE QUESTION NARROWS WITH THE ASK (fable-444 condition 2).

      A scoped render paints one instance and leaves the other exactly as the
      master had it. Ask the WHOLE-FACE question of that frame — *"are her eyes
      green"* — and the honest answer is no, because one of them is brown. On
      `eye.colour` that answer is binding, so the net would dispute a delivery
      the founder asked for and received, spend a free re-render, and then refund
      him for getting what he paid for. A checker that cannot be right about a
      correct render is worse than no checker: it spends the user's money to be
      wrong, and it would have arrived the hour the panel sent its first scope.

      THREE CONDITIONS, and the second is the one that keeps this honest:

        the scope is set                 — every render before the client half
                                           is untouched, which is all of them
        the facet is WRITTEN BY THIS STEP — a carried eye colour from an earlier
                                           whole-face edit is still a whole-face
                                           fact and is still asked as one. The
                                           scope describes THIS ask, not the
                                           recipe
        the facet lands in the SCOPED slot — read from the catalogue rather than
                                           assumed from the feature name

      A scope naming a slot there is only one of (`lips`) narrows nothing and is
      left alone: the question was already about the only one she has, and a
      side clause on it would be an instruction about a side that does not
      exist.

      # AND THE ASK ENDS BEFORE THE FACT DOES (fable-444 condition 1)

      The scope describes THIS step. `facts` is built from the COMPOSED recipe,
      so the eye colour a scoped step wrote is still in the list on every later
      render — as a whole-face question, because the composed delta says "green
      eyes" and ruling C is why it does. So the narrowing above would end with
      the ask and the next unrelated edit would put the disputed question back,
      and the one after that, for as long as the chain lives: **a per-eye edit
      would brick the chain it belongs to**, each later edit costing a wait and
      a refund and never the thing she came back for.

      Ruling C says where to ask instead: the LIBRARY is the memory of per-side,
      so the library is what says which one of a pair the last edit of it
      touched (`instanceLastWritten`). One resolver answers both moments —
      THIS ask's scope while it is being painted, the library's own rows on
      every render after — because two of them would be two answers to "which
      eye is this question about", and the second one would be discovered by a
      customer.
    */
    const scopedSide = input.scope ? slotDefinition(input.scope) : null;
    const inScope = new Set(scopedSide ? facetsOfSlot(scopedSide.slot) ?? [] : []);
    /**
     * The instance this fact is about, or null for the whole face — and WHICH
     * of the two resolvers said so, because the log below distinguishes them.
     */
    const sideOfFact = (fact: VerifiableFact): { side: SlotDefinition; from: "ask" | "library" } | null => {
      /*
        AND AN OPEN KIND HAS NO SIDE TO NARROW TO (the open-lane sweep).

        Both resolvers below are facet-keyed — the ask's scope is a slot of a
        CATALOGUED feature, and the library's answer comes from
        `slotsForFacet`. An open kind is a single slot the lane synthesized, has
        no instances, and `openKindIsPlural()` says so. Answering null here is
        the same statement as the catalogue's own: there is one of it, and a
        side clause about a side that does not exist is an instruction to a
        paid reader to look for one.
      */
      const factFacet = facetIn(fact.subject);
      if (factFacet === null) return null;
      if (scopedSide !== null && scopedSide.instance !== null
        && writtenFacets.has(factFacet) && inScope.has(factFacet)) {
        return { side: scopedSide, from: "ask" };
      }
      /* The library's answer, which needs no scope and outlives the ask.
         `accessoryKind` is this step's own object, so a carried accessory's
         slots resolve exactly as the mint resolved them. */
      const slots = slotsForFacet(factFacet, { accessoryKind: accessoryRegion });
      const written = instanceLastWritten(branchRows, slots.map((it) => it.slot));
      if (written === null) return null;
      const side = slots.find((it) => it.slot === written);
      return side === undefined ? null : { side, from: "library" };
    };
    /**
     * EVERY NARROWED QUESTION, KEPT UNTIL ITS ANSWER COMES BACK (fable-448 §1).
     *
     * The per-side question was bought with a measured trade: the whole-face
     * question refuses 1 in 4 correct one-eye renders, and the scoped one waves
     * the WRONG eye through 4 times in 16 — priced against a court where the
     * engine painted the wrong eye 0 of 32 times. The pass rides that base rate,
     * so the base rate is the thing that must not decay quietly.
     *
     * It cannot be a gate: a gate here would be the whole-face question back
     * under another name, refusing the renders this narrowing exists to
     * deliver. So it is a LOG, written whether the read disputes or not — the
     * shape the removal's visibility note already uses — and what it produces is
     * a distribution rather than a sample of failures.
     */
    const narrowedReads: Array<{ facet: Facet; slot: string; from: "ask" | "library" }> = [];
    for (let at = 0; at < facts.length; at += 1) {
      const fact = facts[at]!;
      const narrowed = sideOfFact(fact);
      if (narrowed === null || narrowed.side.instance === null) continue;
      const { side, from } = narrowed;
      const sibling = (slotsForFeature(side.feature) ?? [])
        .find((definition) => definition.slot !== side.slot);
      facts[at] = scopedToInstance(fact, {
        noun: side.noun,
        /* Named from the catalogue, never composed here: "the other one" is
           what a reader has to guess at, and a guess about which side is the
           whole failure mode this clause exists to avoid. */
        other: sibling?.noun ?? `other ${side.feature}`,
      });
      narrowedReads.push({ facet: facetIn(fact.subject)!, slot: side.slot, from });
    }
    /*
      AND THE PINNED PRESENTATION (D-186), which is the fourth symptom.

      Hair worn up drifted to worn down because no named value existed for the
      net to check. It has one now, so the net checks it — these are short
      categorical values, unlike the descriptive captions, which is exactly why
      only this class is verifiable without inviting false failures.
    */
    for (const facet of PRESENTATION_FACETS) {
      const pinned = captionWording(carriedCaptions[facet]);
      if (pinned && !facts.some((fact) => facetIn(fact.subject) === facet)) {
        /* Read from a photograph rather than chosen from a vocabulary, so it is
           watched rather than enforced — same reasoning as the free lane. */
        facts.push({ subject: aboutFacet(facet), asked: pinned, binding: false });
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
        subject: aboutFacet(facet),
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
        /* The crop answers for FACETS — it is cut from a region the harvest
           segmented for one. An open kind has no region here and is read at the
           frame's own size, which is where its question was always going to be
           answered. */
        facets: facts.flatMap((fact) => facetIn(fact.subject) ?? []),
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

    /*
      AND WHAT THE PER-SIDE QUESTIONS ANSWERED (fable-448 §1), written here so
      the line covers the refused render as well as the delivered one — a
      wrong-side paint would show up as a scoped read that DISPUTED, and a line
      that fires only on delivery could never see it.

      Written for the reads THEMSELVES rather than for the misses: a verdict
      recorded only when it is bad has no denominator, which is the lesson the
      seam verdict and the invisible-site note both already carry.
    */
    if (narrowedReads.length > 0) {
      const answered = new Map(verification.checks.flatMap((check) => {
        const facet = facetIn(check.subject);
        return facet === null ? [] : [[facet, check] as const];
      }));
      log.info(
        {
          operationId,
          variant: variant.publicId,
          askScope: input.scope ?? null,
          attempts,
          reads: narrowedReads.map((narrowed) => {
            const check = answered.get(narrowed.facet);
            return {
              ...narrowed,
              /* Null is not false: it means the reader never answered this one
                 (an unavailable reader delivers unverified), and a distribution
                 that counts a no-read as a pass is the false-pass class again. */
              read: check?.read ?? null,
              verified: check?.verified ?? null,
              absent: check?.absent ?? null,
              binding: check?.binding ?? null,
            };
          }),
        },
        "[refineService] a per-side question was put to this frame — logged whether or not it disputed, so a decaying wrong-side rate is a distribution and not an anecdote",
      );
    }

    if (!verification.ok) {
      /*
        AND WHETHER THAT DISPUTE MOVES MONEY IS NOT THIS DOOR'S OPINION
        (founder ruling, fable-721; the class list lives in `providers/types`).

        It used to be: twice is the product's problem, thrown past the charge so
        the ordinary refund path gives back the whole 25. The founder retired
        that for everything below catastrophic — *"the verification layer was
        trash… only give refunds on catastrophic failures because it couldn't
        truly detect something as subtle as freckles"* — after his own eye
        overturned the reader on two specimens in one sitting (law 9).

        So the door asks the contract instead of holding one. `facts_missing` is
        the reader's opinion of a HEALTHY frame: the damage detector passed this
        picture twice, and what is in dispute is whether a subtle thing the
        reader cannot reliably see is in it. That is the customer's judgment
        now, and the remedy is Regenerate.

        Nothing about the reading is thrown away — the checks land on the row a
        few lines below and the reliability report reads them as
        `delivered_absent` / `delivered_noncompliant`. The verdict became
        telemetry; it stopped being a cashier.
      */
      const failure: ProviderFailureClass = "facts_missing";
      if (!refusesAfterRender(failure)) {
        log.warn(
          {
            operationId,
            variant: variant.publicId,
            attempts,
            failureClass: failure,
            verification: verification.checks,
          },
          "[refineService] verification disputes this frame — DELIVERED AND CHARGED under the catastrophic-only contract; the verdict rides the row as telemetry",
        );
      } else {
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
          reason: failure,
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
          failure,
          /*
            THE CLAUSE, NOT THE READER'S PROMPT. Both consumers of this message —
            the refusal sentence and the ledger line — say "the render came back
            ___", and `shortfalls` is the only thing that fits there.
          */
          joinClauses(shortfalls(verification)),
        );
      }
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
    /*
      AND A SMALL PICTURE BESIDE IT (fable-503).

      Shrunk before the manifest is written so both keys are held by the same
      register-before-write: a thumbnail put to a public key with nothing that
      knows it exists is the same orphan as a frame, at a twentieth of the size
      and none of the excuse. A frame that cannot be shrunk lands without one.
    */
    const thumb = await thumbnailOf({ bytes: image.bytes, prefix: VARIANT_KEY_PREFIX });
    await withTransaction((tx) => createStorageCleanupManifestIn(tx, {
      id: cleanupBatchId,
      userId: input.userId,
      operationId,
      kind: "casting_candidate_cleanup",
      storageItems: [
        { storageKey: destinationKey, storageBackend: "public_r2" },
        ...(thumb ? [{ storageKey: thumb.key, storageBackend: "public_r2" as const }] : []),
      ],
    }));

    const store = dependencies.storeImage ?? defaultStoreImage;
    const stored = await store({
      key: destinationKey,
      bytes: image.bytes,
      contentType: image.contentType,
    });
    /* The thumbnail is a courtesy: a delivery she paid for never fails because
       its small copy did not store. */
    const thumbStored = thumb === null ? null : await store({
      key: thumb.key,
      bytes: thumb.bytes,
      contentType: thumb.contentType,
    }).then(() => thumb.key).catch((error) => {
      log.warn(
        { err: String(error).slice(0, 120), operationId },
        "[refineService] the thumbnail did not store — the picture stands without one",
      );
      return null;
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
    /*
      WHAT THE READ-BACK REFUSED TO CORROBORATE — kept, and written to the row
      below.

      This reader already catches misses precisely: on a dev render of *"her
      right eye — fiery red"* it said *"Both irises are vivid fiery red… left
      eye also shows the red tone, not isolated to the right"* — the exact
      failure, in a sentence — and the render was delivered and charged anyway,
      because the verdict lived in a log line and the delivery-rate report reads
      stored rows.

      Recording it does not change what the render does. It makes the miss
      COUNTABLE, which is the precondition for anybody ruling on whether it
      should refuse.
    */
    /**
     * THE SAME ASK WITH ITS SIDE WORDS GONE — because the picture IS the side.
     *
     * The court's cut arm was measured with the side word stripped, and the
     * wording matters: left in, the reader starts reasoning about a half of a
     * picture that holds one eye, which is the confusion this road exists to
     * leave behind.
     */
    const SIDE_WORDS = new Set(["left", "right"]);
    const SIDE_PRONOUNS = new Set(["her", "his", "their", "the"]);
    const withoutSideWords = (value: string): string => {
      const words = value.split(" ").filter((word) => word !== "");
      const kept: string[] = [];
      for (let at = 0; at < words.length; at += 1) {
        const word = words[at]!.toLowerCase();
        const next = (words[at + 1] ?? "").toLowerCase();
        /* "her right eye fiery red" → "eye fiery red". The pronoun goes only
           when it is standing in front of a side; elsewhere it is hers. */
        if (SIDE_WORDS.has(word)) continue;
        if (SIDE_PRONOUNS.has(word) && SIDE_WORDS.has(next)) continue;
        kept.push(words[at]!);
      }
      return kept.join(" ").trim();
    };

    /**
     * THE NAMED SIDE'S OWN PICTURE, and the ask with its side words removed.
     *
     * `null` whenever this is not a per-side facet, the side cannot be
     * resolved, the reader has no per-side capability, or the cut comes back
     * empty — every one of which falls back to the frame, which is what this
     * did before.
     *
     * The side is resolved by `sideOfFact`, the SAME resolver the verification
     * narrows with: two answers to "which one of the pair is this about" would
     * be the mirror law on a question that decides what gets pinned.
     */
    const sideViewOf = async (
      facet: Facet,
      asked: string | null,
    ): Promise<{ bytes: Buffer; asked: string | null } | null> => {
      /* The caller here holds a FACET — this is the caption road, and captions
         are keyed by facet. Wrapped rather than widened: `sideOfFact` reads a
         verification fact, and handing it a subject is what keeps one resolver
         answering "which one of the pair is this about". */
      const narrowed = sideOfFact({ subject: aboutFacet(facet), asked: asked ?? "" });
      const instance = narrowed?.side.instance ?? null;
      const question = narrowed?.side.question ?? null;
      if (instance === null || question === null) return null;
      const reader = dependencies.regions ?? defaultRegionReader();
      if (!reader.regionSides) return null;
      try {
        const sides = await reader.regionSides({
          image: image.bytes, name: question, absentIsAnswer: true,
          /* The same face, so the same axis — see the mint's own read. */
          axisKey: input.candidatePublicId,
        });
        if (sides === null) return null;
        /* The mask's own bounds, padded a little so the reader sees the eye in
           its socket rather than a floating iris — `boundsOf` is the mint's own
           box maths, borrowed rather than re-derived. */
        const box = boundsOf(sides[instance], 127);
        if (box === null) return null;
        const sharp = (await import("sharp")).default;
        const meta = await sharp(image.bytes).metadata();
        const scaleX = (meta.width ?? sides[instance].width) / sides[instance].width;
        const scaleY = (meta.height ?? sides[instance].height) / sides[instance].height;
        const pad = 12;
        const cut = await sharp(image.bytes).extract({
          left: Math.max(0, Math.round(box.x * scaleX) - pad),
          top: Math.max(0, Math.round(box.y * scaleY) - pad),
          width: Math.min(
            Math.round(box.width * scaleX) + pad * 2,
            (meta.width ?? 0) - Math.max(0, Math.round(box.x * scaleX) - pad),
          ),
          height: Math.min(
            Math.round(box.height * scaleY) + pad * 2,
            (meta.height ?? 0) - Math.max(0, Math.round(box.y * scaleY) - pad),
          ),
        }).png().toBuffer();
        return { bytes: cut, asked: asked === null ? null : withoutSideWords(asked) };
      } catch (error) {
        /* A courtesy read never costs a delivery. */
        log.warn(
          { err: String(error).slice(0, 120), facet, operationId },
          "[refineService] could not cut the named side for the read-back — reading the frame instead",
        );
        return null;
      }
    };

    const uncorroborated: Array<{ facet: string; asked: string; saw: string }> = [];
    /*
      STAGE 3a OF THE LATENCY WORK — the read-backs go out together (fable-695
      §4c, unblocked by the two-facet fixture in `refineService.test.ts`).

      These are two model calls per facet — a side cut from the segmenter and a
      caption from the text engine — and they used to run strictly one facet
      after another on the customer's paid wait. They are independent: `asked`
      is a pure function of this facet and the identity the render already had,
      `sideViewOf` reads only its own facet's region, and `captionRealization`
      is an engine call whose only reach outside itself is the
      `onUncorroborated` callback. Both transports are gated (the segmenter
      through `throughFalGate`, the text engine through its own `ProviderQueue`),
      so concurrency here asks the provider for nothing the gate has not agreed
      to.

      This was written once before and TAKEN OUT AGAIN, because it typechecked
      and the whole suite stayed green — and green was not a control: every
      caption fixture drove ONE facet, and with one facet a parallel loop and a
      serial one make the same calls in the same order. The unblocking test now
      exists and asks the only question that separates them — were two
      read-backs ever in flight at the same moment — with a single-facet arm as
      its negative control.

      **Nothing observable moves but the waiting.** The captions are assigned in
      the facets' own order after the fold, and each facet's uncorroborated
      verdicts are collected locally and concatenated in that same order, so
      both artifacts are byte-identical to the serial version whichever call
      answers first. `allSettled` is deliberate (stage 1's rule): a facet that
      throws must not leave a sibling's rejection unhandled, and the first
      failure in facet order is re-thrown so the caller sees exactly the error
      the serial loop gave it.
    */
    const captionWork = Array.from(captionFacets).map(async (facet) => {
      const asked = currentIdentity
        ? currentValueOfFacet(applyDelta(currentIdentity, composed), facet)
        : null;
      /*
        A PER-SIDE FACET IS READ FROM ITS OWN CUT — never from the frame
        (fable-611 §2, courted).

        Asked which eye a colour landed on, this reader is wrong in both
        directions: on seventeen frames whose painted side the segmenter had
        already measured, it refused three correct renders and corroborated
        three that had painted the OTHER eye — and pinning the frame of
        reference in its prompt made the prose confidently wrong without moving
        a single verdict. What passed, on the same specimens, was taking the
        side word out of the question entirely: the named side is CUT out and
        the picture is the side. Three of three wrong-eye renders were then
        refused, and the only refusals left were honest ones about colour.

        It costs one region read on a render that wrote a per-side facet, and
        nothing at all on every other render. A cut that cannot be made falls
        back to the frame, which is exactly today's behaviour — a courtesy read
        never costs a delivery.
      */
      const view = await sideViewOf(facet, asked);
      /* This facet's own verdicts, folded into the shared list in facet order
         below rather than in whichever order the engines answered. */
      const mine: Array<{ facet: string; asked: string; saw: string }> = [];
      const caption = await captionRealization({
        facet,
        bytes: view?.bytes ?? image.bytes,
        contentType: view ? "image/png" : image.contentType,
        onUncorroborated: (verdict) => mine.push(verdict),
        /* What this render was told to produce, so the read-back can be
           checked against it rather than describing whatever turned up. */
        asked: view ? view.asked : asked,
      });
      return { facet, caption, mine };
    });

    const captionResults = await Promise.allSettled(captionWork);
    /* The first failure in FACET order, which is the one the serial loop would
       have thrown — the siblings were all settled, so none is left unhandled. */
    const captionFailure = captionResults.find((result) => result.status === "rejected");
    if (captionFailure?.status === "rejected") throw captionFailure.reason;
    for (const result of captionResults) {
      if (result.status !== "fulfilled") continue;
      if (result.value.caption) capturedCaptions[result.value.facet] = result.value.caption;
      uncorroborated.push(...result.value.mine);
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
    /*
      AND WHETHER SHE WILL BE ABLE TO SEE ANY OF IT (fable-398 §3).

      One sentence at most, however many slots were vacated: two removals on one
      face are one disappointment, and a note that repeated itself per lobe would
      read as a malfunction. First hidden site wins — see `invisibleRemoval` for
      the reading, the bar, and the declaration that it may not fire yet.
    */
    let invisibleSiteNote: string | null = null;
    if (vacatedSlots.length > 0) {
      const reader = dependencies.regions ?? defaultRegionReader();
      for (const slot of vacatedSlots) {
        assertNotAnUncataloguedDeparture(slot);
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
          /*
            AND WHAT THAT COSTS HER IS THE CONTRACT'S CALL, NOT THIS DOOR'S
            (founder ruling, fable-721; split countersigned in fable-723 §3).

            This reads a delivered, healthy frame and says the thing she asked
            us to take off is still in it. That is the reader's opinion of a
            picture — the exact judgment the founder took off the money path —
            so it delivers and charges, and Regenerate is the remedy.

            **The SLOT IS NOT RETIRED when the reading disputes the removal**,
            and that half is unchanged on purpose. Retirement is not a money
            decision; it is a statement in her library about what her face now
            has. Writing *the glasses are gone* off a frame our own instrument
            says still wears them would put a false fact where every later
            repaint reads from — and a library that lies about presence is the
            defect that costs whole edits (`library holds presence, not
            absence`). The money follows the founder's ruling; the record still
            follows the reading.
          */
          const failure: ProviderFailureClass = "removal_not_delivered";
          if (!refusesAfterRender(failure)) {
            log.warn(
              {
                operationId, variant: variant.publicId, slot, question: definition.question,
                coverage: covered, floor, floorMeasured: measured, failureClass: failure,
              },
              "[refineService] the removal did not land — DELIVERED AND CHARGED under the catastrophic-only contract, and the slot keeps its reference because the frame still wears it",
            );
            continue;
          }
          log.warn(
            {
              operationId, variant: variant.publicId, slot, question: definition.question,
              coverage: covered, floor, floorMeasured: measured,
            },
            "[refineService] the removal did not land — the thing is still in the frame, so the render is refused rather than delivered",
          );
          throw new ProviderError(failure, definition.noun);
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

        /*
          IS THERE ANYTHING TO SEE — asked last, because everything above is what
          makes the second half of the sentence true.

          Wrapped whole, and the swallow is the point: a note is the least
          important thing in this block. The picture is correct, the library
          agrees with it and the money is settled; a landmark call that times out
          must cost a sentence and never the render. That is the same law the
          caption and the satisfaction label already live under, and the reason
          this is a try/catch rather than a `.catch()` is the same too — a
          synchronous throw walks past a promise handler into the outer catch,
          which refunds.
        */
        if (invisibleSiteNote === null && definition.guardKind) {
          try {
            const site = await readSiteVisibility({
              reader,
              frame: image.bytes,
              kind: definition.guardKind,
            });
            log.info(
              {
                operationId, variant: variant.publicId, slot, kind: site.kind,
                visible: site.visible, cause: site.cause, bar: INVISIBLE_AT,
                hiddenShare: site.hiddenShare === null ? null : Number(site.hiddenShare.toFixed(4)),
              },
              "[refineService] whether she can see where this came off — logged whether or not it speaks, so the bar becomes a distribution",
            );
            invisibleSiteNote = invisibleRemovalNote({
              kind: site.kind,
              pronouns: pronounsForSex(currentIdentity?.sex),
              cause: site.cause,
            });
          } catch (error) {
            log.warn(
              { operationId, variant: variant.publicId, slot, err: error },
              "[refineService] could not read whether the removal will be visible — delivering without the note",
            );
          }
        }
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
    /*
      AND AN OPEN CHECK EARNS NOTHING HERE, BY CONSTRUCTION (the open-lane
      sweep, fable-911 §2 (3)).

      `facetOfCheck` answers null for an open kind, so every filter below drops
      it before it can name a segment. That is the same sentence as the ruling's
      pinned line read from the other end: this block is the one that turns a
      reading into PIXELS the store keeps, and a verdict about an open kind is
      evidence about a frame — it may not earn a segment any more than it may
      retire a crop.
    */
    const facetOfCheck = (check: FacetCheck): Facet | null => facetIn(check.subject);
    const readChecks = verification.unavailable
      ? []
      : verification.checks.filter((check) => {
        const facet = facetOfCheck(check);
        return facet !== null
          && check.read && writtenFacets.has(facet) && !carriedFacets.has(facet);
      });
    const missedFacets = new Set(
      readChecks.filter((check) => !check.verified).flatMap((check) => facetOfCheck(check) ?? []),
    );
    const earned = Array.from(new Set(
      readChecks
        .filter((check) => check.verified && !missedFacets.has(facetOfCheck(check)!))
        .flatMap((check) => facetOfCheck(check) ?? []),
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
    /*
      WHERE A READER AND A CALIBRATED RULER DISAGREED (fable-429 §3 condition 2).

      Hoisted out of the mint's own block so it can be written onto the landed
      row below. The mint's log line carries it too, and that is deliberately not
      enough: the disagreement is a distribution this program wants to read
      WEEKS from now — a reader failing repeatedly on true geometry is a finding
      in progress — and a log retention window is not where a finding in
      progress should live.
    */
    let adjudications: DeliveryAdjudication[] | null = null;
    /*
      WHICH OPEN KINDS THIS RENDER ACTUALLY FILED A CROP FOR — the discriminator
      between `delivered` and `words_only` on the demand row (5b Stage D).

      Read off the mint's own answer rather than re-derived from the pair
      property: the property says whether a crop was ALLOWED, and this says
      whether one landed. They differ whenever a door in between refused — the
      absence control declining, a duplicate digest, a guard — and it is exactly
      those cases the promotion decision wants counted as `words_only`.

      Empty when the mint did not run at all, which reads as `words_only` and is
      correct: no crop was filed.
    */
    const openCropsStored = new Set<string>();
    if (libraryEnabled(input.userId)) {
      try {
        /* The other half of the same derivation, and the reason it is a `Set`
           computed once above: any missed item disputes its facet, so the two
           lists are complements by construction rather than by two filters
           happening to agree. */
        const disputed = Array.from(missedFacets);
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

          Taken BEFORE the slot list rather than inside it, because the list
          now needs it: a slot re-cut every render is filed on the strength of
          what the library already keeps for it, and that answer lives here.
        */
        const lineage = await listLineageReferences({
          userId: input.userId,
          candidateId: variant.candidateId,
          anchorVariantId: variant.id,
        });
        const live = liveReferences(lineage);
        /*
          AND THE SLOTS STILL WAITING FOR A CARRIER (fable-468 §2, ruling b).

          Derived from the SAME read rather than a second one: `liveReferences`
          drops a disputed row so it cannot displace a crop it has no verdict
          about, and `supersededCarrySlots` reads the other consequence of that
          rule — the slots whose newest word about the subject holds no pixels.
          One of them is the founder's build on candidate 1604.
        */
        const awaitingCarrier = new Set(supersededCarrySlots(lineage));
        const known = new Map<string, string>();
        for (const row of live) if (row.digest) known.set(row.slot, row.digest);

        /*
          THE OPEN KINDS THIS ASK WROTE, WITH THE ONE PROPERTY THAT GATES THEM
          (5b Stage C, fable-872 §2).

          `editDelta`, never the composed recipe: a composed recipe carries every
          open kind this face has ever been given, so composing from it would
          re-cut and re-buy a vision read for a kind three edits old on every
          later render — the same rule the facet passes obey through `earned`.

          The property is READ, never re-derived: the acceptance door bought it
          once for this noun and wrote it down. `null` here is *nobody answered*,
          and `mintedSlotsForRender` files that as `openKindLocalityUnread` and
          cuts nothing — the conservative side, because a gate treating unknown
          as croppable files one wing under the name of two.
        */
        const openAsks = await Promise.all(
          Object.entries(editDelta?.open ?? {}).map(async ([kind, ask]) => ({
            kind,
            words: ask.words,
            locality: (await readOpenKindProperties(kind))?.locality ?? null,
          })),
        );
        const { slots, unfiled, unfiledOpen } = mintedSlotsForRender({
          earned,
          disputed,
          captions: capturedCaptions,
          open: openAsks,
          /* What the instruction said the worn object IS — derived once above,
             beside the region override that has to name the same object. */
          accessoryKind: accessoryRegion,
          /*
            WHAT THE LIBRARY ALREADY KEEPS FOR HER, which is the only honest
            answer to *has she paid for a build?*

            A build produces no caption — measured on the live pipeline, dev
            #365: the render verifier passed the narrowing, `buildSpan` read it
            at −10.8%, and the caption reader looked at the same frame and said
            *"no visible slimming edit"* for both facets. So "does this slot
            have words" is a gate that can never open for `build`, and it was
            the gate the whole feature stood behind.
          */
          held: new Set(live.map((row) => row.slot)),
          awaitingCarrier,
          /*
            AND WHAT THIS RENDER'S OWN READER CONFIRMED WITHOUT BEING ASKED.

            Read ∧ verified ∧ NOT written by this ask: the facet was carried
            into the prompt as a fact she already has, and the reader looked at
            the delivered frame and agreed. On candidate 1604 that is v#186
            saying "slender arms and torso visible, consistent with a slim
            build" two renders after the crop was refused as disputed.

            `readChecks` above is deliberately not reused: it is filtered to
            WRITTEN facets, which is the opposite of this question.
          */
          confirmed: verification.unavailable ? [] : Array.from(new Set(
            verification.checks
              .flatMap((check) => {
                /* Facets only: this list tells the LIBRARY a fact it already
                   holds was seen again, and the library's own key is a slot the
                   catalogue owns. An open kind's crop is minted by its own
                   door, from `openAsks`, and never from a reader's affirmative. */
                const facet = facetIn(check.subject);
                if (facet === null) return [];
                return check.read && check.verified && !writtenFacets.has(facet) ? [facet] : [];
              }),
          )),
          /*
            AND THE ONE INSTANCE SHE POINTED AT, so the library records what the
            painter was actually asked for.

            This is where fable-444's ruling C is kept: the delta stays
            whole-face, and the library is the memory of per-side. A scoped
            render that filed both instances would put a row on `eye@right`
            claiming a delivery its own recipe never asked for — and every later
            render would carry it.
          */
          ...(input.scope ? { scope: input.scope } : {}),
        });
        if (unfiled.length > 0) {
          log.info(
            { operationId, variant: variant.publicId, unfiled },
            "[refineService] a facet this render wrote had no library slot to file in",
          );
        }
        /*
          AND THE OPEN KINDS THAT FILED NOTHING, with the reason NAMED.
          `openKindLocalityUnread` is a kind whose property read is failing,
          which is silently taking the conservative path on every ask forever and
          is worth chasing. `openKindDistributed` used to stand beside it and no
          longer exists: since the D1 wire (fable-987 §1, fable-1001) a
          distributed kind files one slot per side, and the refusal that remains
          is the COUNT'S, taken at the mint where the frame is.
        */
        if (unfiledOpen.length > 0) {
          log.info(
            { operationId, variant: variant.publicId, unfiledOpen },
            "[refineService] an open kind this render wrote filed no crop — the reason is the finding",
          );
        }
        if (disputed.length > 0) {
          log.info(
            { operationId, variant: variant.publicId, disputed },
            "[refineService] this render's reader disputed a facet the ask wrote — its crop is cut for a human, not for the library",
          );
        }
        if (slots.length > 0) {
          const reader = dependencies.regions ?? defaultRegionReader();
          /*
            THE GUARD'S OWN READ, and `absentIsAnswer` is true on purpose.

            Asked of the DELIVERED frame, nothing found means the frame does not
            wear the thing — which the guard turns into `subjectAbsent`, the
            honest refusal (fable-181). Refusing to answer instead would arrive
            as `readDidNotSettle` and file "we could not tell" over a picture
            that told us plainly.
          */
          const read: MintRegionReader = async ({ frame, question, side, declaredTwoSided }) => {
            /* HER AXIS IS HERS, not this frame's (fable-603 §3): the face read a
               bilateral question needs is bought once per candidate rather than
               once per frame, on a measurement of 0.3px across a whole chain. */
            const axisKey = input.candidatePublicId;
            if (side === undefined) {
              return reader.region({ image: frame, name: question, absentIsAnswer: true, axisKey });
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
            const sides = await reader.regionSides({
              image: frame, name: question, absentIsAnswer: true, axisKey,
              /* An open kind is outside the reader's own bilateral vocabulary, so
                 without the classifier's answer travelling this far every
                 distributed crop would refuse at the reader (the D1 wire). */
              ...(declaredTwoSided === undefined ? {} : { declaredTwoSided }),
            });
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
            /*
              THE FRAME THIS RENDER WAS PAINTED FROM — the ruler's other end.

              `variant.baseImageKey` is what the render was anchored on, which
              under recipe v3 is the sharp original: exactly the pair the body
              bench measured its court on (master → first body edit). Passing
              the previous DELIVERED frame instead would be a reading with no
              court behind it.

              It costs nothing unless a court is asked something it can answer:
              the mint buys its two anchor reads only for a disputed slot whose
              facets an instrument measures, on a branch with no crop for that
              slot yet. Every other render passes these bytes and spends nothing.
            */
            anchorFrame: { bytes: base.bytes },
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
                THE COMPOSER'S TWO READS, ON THE FRAME THE USER IS LOOKING AT.

                `build` has no segmentation question — no region vocabulary word
                names a body, and D-213 forbids inventing one — so its region is
                COMPOSED: her silhouette below the bottom of her head. Both terms
                are read here, on `image.bytes`, and not taken from the harvest's
                maps: those are the MASTER's regions (right question, wrong
                frame) or the PAINTED frame's (not the composite the user sees).
                A chin from one frame cutting a crop from another is the
                wrong-boundary class with her whole body in it.

                Not gated on a flag beyond the library's own, and deliberately:
                this is what the live mint WRITES. Under words alone a delivered
                build is lost ENTIRELY on the next edit — 3 faces of 3, as though
                she had never paid for it (opus-326) — and the same crop kept
                92–109% of it.

                Costed honestly: two reads per delivered render, and ONLY on a
                face that already has something to say about its build.
                `mintedSlotsForRender` files nothing where nothing has ever been
                said, so a face nobody has body-edited pays nothing at all. The
                mint's log line reports them as `derivedReads`.

                Wired HERE and asserted here — a control nothing invokes is not a
                control (invariant 7), and this program has already paid twice
                for a store that was inert while two benches passed.
              */
              derivedGround: {
                region: read,
                subject: ({ frame }) => reader.subject({ image: frame }),
              },
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
          /* Both verdicts, onto the landed row below. Null stays null when no
             court was asked, which is every render that disputed nothing a
             ruler measures — so the key's presence is itself the signal. */
          adjudications = minted.adjudications ?? null;
          for (const slot of minted.slots) {
            if (slot.outcome === "stored" && isOpenSlot(slot.slot)) openCropsStored.add(slot.slot);
          }
          log.info(
            {
              operationId,
              variant: variant.publicId,
              outcome: minted.outcome,
              slots: minted.slots,
              ...(minted.adjudications ? { adjudications: minted.adjudications } : {}),
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

    /*
      AND THE TATTOO THIS RENDER PUT ON HER, KEPT AS IT LANDED — clause (a)
      (design report opus-886 §3, countersigned fable-1193 §3 / fable-1194 §2).

      Ink is the one facet whose delivered state rode as SOURCE ARTWORK instead
      of as a crop of her own frame, and that difference is exactly where the
      defect lived: three carry renders, three shirts, with three different
      clauses on the wire. The artwork has no size in it and the master has no
      tattoo on it, so *"at the same size"* pointed at nothing measurable. This
      is the step that gives the next carry a picture that contains the answer.

      # Why it sits outside the library's mint rather than inside it

      The library's `carry` door requires a guard reading — an independent
      second read scored against a SPECIMEN FAMILY — and ink has none: the whole
      measured population is three masks. Through that door every ink crop would
      refuse `noSpecimen` and file words. Migration 0049's header carries the
      full argument, and it is the same one migration 0040 made for the
      customer-supplied crop store.

      # Why the condition is `appliedInk` and not a flag

      `appliedInk` is non-null exactly when THIS render resolved a design and
      put it on her, which already implies the ink scopes were open for this
      account. A second flag here would be a door on a corridor.

      And it is `appliedInk` rather than the whole carried set on purpose:
      fable-1193 §3b's MINTED ONCE, from the frame that FIRST delivered the
      design, never re-cut from a later carry. A carry render's `appliedInk` is
      null, so this line does not run on one at all — and the unique index says
      so again for any caller that gets it wrong.

      # An unverified delivery needs no special case

      If the ink did not actually arrive in the frame, `tattooed skin` finds
      nothing on it and the mint answers `no-cut`. The reader guards this by
      being asked of the delivered picture rather than of our intentions, which
      is the only way round it worth having.

      Wrapped in its own try/catch even though `mintInkDeliveryCrop` catches its
      own: this runs before the landing, and a throw here would refund a render
      nobody has seen because a bookkeeping step failed.
    */
    if (appliedInk !== null) {
      try {
        const kept = await (dependencies.mintInkDeliveryCrop ?? mintInkDeliveryCrop)({
          userId: input.userId,
          candidatePublicId: input.candidatePublicId,
          variantPublicId: variant.publicId,
          frame: image.bytes,
          design: { publicId: appliedInk.designId, slot: appliedInk.slot },
          operationId,
        });
        log.info(
          { operationId, variant: variant.publicId, ...kept },
          "[refineService] the delivered tattoo's own crop",
        );
      } catch (error) {
        log.warn(
          { err: error, operationId, variant: variant.publicId },
          "[refineService] the delivered tattoo's crop was not kept — the picture stands and the next carry rides her artwork",
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
      thumbKey: thumbStored,
      internalPrompt: {
        prompt,
        /* Same source as the prompt, for the same reason. */
        resolved: baseIdentity ? applyDelta(baseIdentity, filed) : null,
        /*
          WHICH TAKE THIS ONE REPLACES (founder, 2026-08-15).

          A regeneration is an ordinary row that happens to describe the same
          chain, and the rail shows the newest take of a version rather than
          both. It is recorded rather than inferred from chain equality for one
          reason: two rows CAN share a chain by accident (a step back, then the
          same ask again), and inferring would hide a picture somebody paid for
          on the strength of a coincidence. A row says what it was BORN as, and
          the rail believes the row.
        */
        ...(repeatsThisVersion && predecessor?.publicId
          ? { regeneratedFrom: predecessor.publicId }
          : {}),
        ...(presentationOf(filed) ? { presentation: presentationOf(filed) } : {}),
        /*
          THE ONE INSTANCE SHE POINTED AT, WRITTEN DOWN (fable-704).

          The founder hit Regenerate on *"her right eye — fiery red"* and got the
          per-side refusal: *"That names one side of a pair…"*. The gate was
          innocent and the input was wrong. Regenerate rebuilt the ask from the
          words on the chip and sent it down the SENTENCE lane, where a side
          named without a rectangle is refused by design — because a sentence
          cannot say which of a pair, and painting both is not what was asked.

          The words were the only record there was. A pointed ask travels as a
          sentence PLUS a scope, and the scope was never written anywhere: the
          operation payload carries the candidate and the instruction, the
          recipe holds it only for the length of one request, and the library's
          slots are a consequence of it rather than a record of it. So the ask
          could not be replayed, only re-interpreted — and re-interpretation
          loses exactly the half the sentence cannot carry.

          Written here, on the row, so a fresh take of this version can be its
          REQUEST again rather than its caption. Absent on every typed ask, so
          its presence is itself the mark of a pointed one — and it is present
          on real rows, which is how the eye-filing defect was located.
        */
        ...(input.scope ? { askScope: input.scope } : {}),
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
          WHAT THIS EDIT COST, IN CALLS AND SECONDS (the latency-and-cost
          program's stopwatch).

          Persisted on the row rather than logged alone, for the reason the
          scan-miss counter learned the same night: a container log's window
          rotates on every deploy, so a number that lives only there cannot be
          read back a day later — and this program's first task is a census
          across many renders, not a glance at one.

          `censusSoFar` is honest in its name: the row lands before the request
          finishes, so it carries what had been spent by the time the picture
          was stored. The complete figure goes to the request's own closing log
          line, and the two are meant to be read together.

          A bill, never a transcript: no prompts, no images, no replies.
        */
        ...(censusSoFar() ? { census: censusSoFar() } : {}),
        /*
          AND WHERE A READER AND A RULER DISAGREED ABOUT THIS RENDER'S DELIVERY
          (fable-429 §3 condition 2). Absent on every render where no court was
          asked, which is almost all of them.
        */
        ...(adjudications ? { adjudications } : {}),
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
            : verification.checks.map((check) => {
              /* Carried-by-PASTE, which is a facet list from the composite's own
                 arithmetic. An open kind carried by CROP rides the repaint road,
                 which pastes nothing and produces no such list. */
              const facet = facetIn(check.subject);
              return facet !== null && carriedFacets.has(facet)
                ? { ...check, carried: true }
                : check;
            }),
          ...(verification.unavailable ? { unavailable: true } : {}),
          /*
            AND WHAT THE READ-BACK COULD NOT CORROBORATE. Absent on the renders
            where every asked facet was visible, which is most of them — so its
            presence is the mark of a miss rather than one more field to
            interpret.
          */
          ...(uncorroborated.length > 0 ? { uncorroborated } : {}),
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

    /*
      WHAT SHE IS OWED ABOUT THIS TAKE, BEYOND THE PICTURE ITSELF
      (D-181, fable-386 §2, fable-398 §3).

      THE REFERENCE IS CONFESSED, not silently dropped (D-181). They asked for
      green eyes LIKE someone. The green is theirs and it files; the comparison
      cannot be served and never reaches the record. A product that quietly
      serves half an instruction and says nothing has decided something on the
      user's behalf without telling them.

      The out-of-frame half is the same sentence about a different half, so the
      two are collected rather than branched: a LIST, joined, because an ask can
      lose a reference AND a waist in one breath, and a single-slot `note` with
      a precedence would have picked one of the two truths to tell.

      **The third one is not a confession of a half-served ask, and the list is
      named for the whole rather than for its first two members because of it.**
      A removal onto a hidden site was served in FULL; what she is owed is that
      the picture cannot show it. Same law from the other direction, same field,
      same joined line — and it goes LAST because it is about what she is looking
      at rather than about what was left out of it.
    */
    const owedAboutThisTake = [
      /*
        AND IT NAMES WHAT IT ACTUALLY FILED (fable-490 §1b).

        This sentence hardcoded "the eyes" — written for the green-eyes case,
        and asserted about the founder's SKIN ask on a face whose eyes nobody
        had mentioned. A confession that names the wrong feature is worse than a
        generic one: it is specific and wrong, in his own product voice.

        The subjects come from the delta this take filed, through the same
        reader the chips are labelled from — never a second account of what was
        asked for.
      */
      droppedReference
        ? likenessSetAsideNote({ subjects: filedSubjectsOf(editDelta) })
        : null,
      /* Her attachment went unused — the same law as the line above, about the
         other kind of reference. Nothing was cut and nothing was spent, which is
         exactly when a product stays quiet and lets her assume it was used. */
      attachedPictureUnused ? attachedPictureUnusedNote() : null,
      /* And the second view of a two-panel reference, said plainly rather than
         dropped in silence (ruled fable-1093 §1). */
      secondViewNote,
      outOfFrameNote,
      invisibleSiteNote,
    ].filter((line): line is string => line !== null);

    const result: RefineResult = {
      kind: "rendered",
      ...(owedAboutThisTake.length > 0 ? { note: owedAboutThisTake.join(" ") } : {}),
      variantId: variant.publicId,
      candidateId: input.candidatePublicId,
      imageUrl: stored.url,
      instructions,
      /* WHICH DESIGN RODE — on a RIDE there was no offer to name it (the offer
         fires once per design), and a design its owner cannot name is one she
         cannot reject: `castingV2.ink.remove` takes a name. */
      ...(designAnswerFor(inkSource) ? { design: designAnswerFor(inkSource) } : {}),
    };
    /*
      THE OPEN LANE'S DEMAND ROW, WRITTEN WHERE THE ASK ENDED (5b Stage D).

      One row per open kind THIS ask wrote — `editDelta`, never the composed
      recipe, or a face given fangs three edits ago would file a fresh demand row
      on every later render and the promotion tally would count one customer's
      chain as a queue of people.

      Fire-and-forget, after the money is settled: this is telemetry riding a paid
      path and it may never take a picture back (§7). The row lost to a process
      death between here and the insert is the accepted fail-soft the writer
      already has.
    */
    recordOpenLaneOutcomes(editDelta, { settled: true, cropsStored: openCropsStored });
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
        failureClass: failureClassFor(error),
        cause: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack?.split(/\r?\n/).slice(0, 4).join(" | ") : undefined,
      },
      "[refineService] REFINEMENT FAILED — refunding; this line is the only record of why",
    );
    /* AND THE SAME ROW ON THE OTHER OUTCOME (5b Stage D). A kind whose asks are
       refunds is the loudest promotion case there is — *reached but not served* —
       so a table holding only the successes would report the lane working
       perfectly on exactly the asks it happened to manage. */
    recordOpenLaneOutcomes(editDelta, { settled: false, cropsStored: new Set() });
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
      failureClass: failureClassFor(error),
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
 * ONE DEMAND ROW PER OPEN KIND THIS ASK WROTE, at the moment the ask ended
 * (5b Stage D, ruled fable-896 §4).
 *
 * Both terminal sites call this rather than composing the outcome themselves, so
 * the delivered path and the refund path cannot come to disagree about what a
 * stored crop means — the outcome itself is decided once, in
 * {@link openLaneOutcomeOf}, beside the acceptance that named the kind.
 *
 * **`editDelta`, never the composed recipe.** A composed recipe carries every
 * open kind this face has ever been given, so a face given fangs three edits ago
 * would file a fresh demand row on every later render and the promotion tally
 * would read one customer's chain as a queue of people.
 *
 * Fire-and-forget by construction: the writer cannot reject, and a promotion
 * signal may never cost somebody their picture (design note §7).
 */
function recordOpenLaneOutcomes(
  delta: RefineDelta | null,
  render: { settled: boolean; cropsStored: ReadonlySet<string>; refusedFree?: boolean },
): void {
  for (const kind of Object.keys(delta?.open ?? {})) {
    void recordOpenLaneDemand(kind, openLaneOutcomeOf({
      settled: render.settled,
      /*
        THROUGH THE GRAMMAR'S OWN DERIVATION, never a spelling (the D1 wire's
        sweep, fable-1001 §2).

        A distributed kind stores its pixels as TWO rows — `open:wings@left` and
        `open:wings@right` — so a membership test written for the sideless key
        would file *no crop* against a kind that just got two, and the promotion
        tally would read the crop road as failing for exactly the class the road
        was extended to serve. One wing alone is correctly NOT a crop here: the
        gate refuses it, and the demand row should say so.
      */
      cropStored: openKindCarriedByCrops(kind, render.cropsStored),
      ...(render.refusedFree ? { refusedFree: true } : {}),
    }));
  }
}

/**
 * The sentence for a render that arrived healthy and short of a fact.
 *
 * Null for every other failure, so the generic line keeps its job.
 */
function failedFactsMessage(error: unknown): string | null {
  /*
    A DOOR THIS ROAD CANNOT YET WALK THROUGH — the founder's own sentence,
    ruled in chat (fable-354, "im happy with that").

    He asked for a lip gloss twice, because the refusal never said why. The
    earring door already models the fix: a door that KNOWS the reason should say
    it, in a sentence that names the gap instead of implying a malfunction.

    "Nothing was charged" is true here rather than merely kind, and the caller is
    what makes it true: this branch is only reached when `refund.recorded` is
    set, so a refund that did NOT land takes the support sentence one line down
    instead. Her balance really is where she left it.

    HONESTY CONDITION, and it is load-bearing prose rather than decoration:
    "it's coming" is a promise, and it is honest only while the makeup
    vocabulary is genuinely queued. It sits behind the auto-scan prefill today
    (fable-352). **If makeup ever leaves the roadmap, or is ruled out rather
    than ordered behind something, this sentence has to change with it** — a
    promise living inside a refusal is the easiest line in the product to leave
    rotting, because nothing fails when it goes stale.
  */
  /*
    EVERY DOOR THAT KNOWS WHY IT REFUSED SAYS SO — one registry, not one facet
    (fable-471 §1, carrying fable-486 (f)).

    The founder tapped the panel's EARS row, asked for a cauliflower ear, and
    read *"That refinement didn't come through"* — a malfunction's sentence, on
    a road that knew exactly why: the reading filed it as a MARK and marks have
    no slot inside an ear. `cannot_say` had been a class since fable-355 and its
    honest sentence existed for exactly one facet.

    The sentences live in `cannotSayCopy.ts` with the charge behaviour and the
    report class beside them, so a new reason cannot ship with a class and no
    copy. The makeup wording is unchanged — the founder ruled it — and it is now
    one entry in that table rather than the only case with a voice.
  */
  if (error instanceof RepaintCannotSayError) {
    return cannotSaySentence(error.reason, {
      words: error.words,
      facet: error.facet,
      scopeNoun: error.scopeNoun,
      /*
        HER BALANCE REALLY IS WHERE SHE LEFT IT, and the caller is what makes
        that true: this function is only consulted when `refund.recorded` is
        set — an unrecorded refund takes the support sentence one line up. The
        founder's ruled makeup copy says "Nothing was charged" for exactly this
        reason and it is unchanged by the generalization.
      */
      moneySafe: true,
    });
  }
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
/**
 * The class this failure is FILED under — the column D-236's report reads.
 *
 * Both the log line and the variant row take it from here, so the diagnosis a
 * human reads and the class a rate is computed from cannot disagree. They used
 * to be two copies of the same ternary and they drifted the moment one gained
 * a case (fable-442 ruling 2).
 *
 * `unknown` is reserved for what it says: a failure nobody classified. A door
 * that knows exactly why it refused does not file itself into that bucket.
 */
function failureClassFor(error: unknown): ProviderFailureClass {
  if (error instanceof ProviderError) return error.failureClass;
  if (error instanceof RepaintCannotSayError) return "cannot_say";
  return "unknown";
}

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
  /*
    NOT A FAILURE AT ALL, and the receipt has to stop calling it one.

    Beyond fable-355's letter and squarely inside the class the four splits above
    were made for: nothing was rendered and no provider was ever contacted — the
    road refused before the call, because the recipe has no way to state the ask.
    "The generation failed" sends support hunting an outage that never happened,
    on the one door whose whole point is that it knows exactly what went wrong.

    Class-wide rather than makeup-only on purpose: the CUSTOMER sentence is
    ruled copy and stays scoped to the door the founder ruled, but every reason
    in this taxonomy shares the fact this line states — no render was attempted.
  */
  if (error instanceof RepaintCannotSayError) {
    return "Refine refunded — we cannot yet place what this asked for, so nothing was rendered";
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
/**
 * WHICH TAKE A ROW REPLACED, off its own record — or null.
 *
 * Read here rather than in the projection because `internalPrompt` is INTERNAL
 * (§J): the field never crosses the boundary, only the answer does.
 */
export function readRegeneratedFrom(internalPrompt: unknown): string | null {
  if (!internalPrompt || typeof internalPrompt !== "object") return null;
  const value = (internalPrompt as { regeneratedFrom?: unknown }).regeneratedFrom;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * WHICH ONE INSTANCE A ROW WAS POINTED AT — off its own record, or null
 * (fable-704).
 *
 * Null means two different things and they are deliberately not told apart
 * here: an ask that pointed at nothing (every typed sentence), and a row landed
 * before this was written down. Both mean *there is no pointed request to
 * replay*, and a fresh take of either is the sentence it already was — which is
 * today's behaviour, unchanged, for every row on the record.
 *
 * Read here rather than in the projection for the same reason as the take
 * above: `internalPrompt` is INTERNAL (§J). The field never crosses the
 * boundary, only the answer does.
 */
export function readAskScope(internalPrompt: unknown): string | null {
  if (!internalPrompt || typeof internalPrompt !== "object") return null;
  const value = (internalPrompt as { askScope?: unknown }).askScope;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * THE WORDS THE STABLE PHRASINGS ALREADY FILE.
 *
 * *"Take her hair off"* and *"make her bald"* both parse straight to this
 * value, so authoring it for *"remove her hair"* makes the three one edit
 * rather than three that resemble each other. Taken from the parse rather than
 * invented: it is what the product already says about a shaved head.
 */
const BALD_HAIR_STYLE = "shaved head";

/**
 * Does this removal name her HAIR itself, rather than a style of it?
 *
 * "Her hair", "the hair", "all her hair" — yes. "Her braids", "her fringe",
 * "her ponytail" — no, and deliberately: a braid removed is not a shaved head,
 * and the founder's own fringe is the reason this product does not treat a part
 * of a haircut as a thing that can leave.
 *
 * Written as a word set rather than a pattern so that nothing here can be
 * mangled into matching more than it says.
 */
const HAIR_MATCH_FILLER = new Set([
  "her", "his", "their", "the", "all", "of", "a", "any",
  "please", "just", "can", "you", "off", "it", "now", "entirely", "completely",
]);

/** The words that mean "make it go" in this family, and nothing wider. */
const HAIR_REMOVAL_VERBS = new Set([
  "remove", "removing", "delete", "lose", "ditch", "scrap", "rid", "get", "take", "shave",
]);

/** Everything that is not a word, so punctuation cannot hide a word. */
function plainWords(sentence: string): string[] {
  let cleaned = "";
  for (const character of sentence.toLowerCase()) {
    cleaned += (character >= "a" && character <= "z") ? character : " ";
  }
  return cleaned.split(" ").filter((word) => word !== "");
}

/**
 * IS THIS SENTENCE "TAKE HER HAIR AWAY", AND NOTHING ELSE?
 *
 * Narrow on purpose, because the cost of being wide is a paid render of the
 * wrong thing. After fillers, what remains must be removal words and the word
 * "hair" — so:
 *
 * ```
 * YES   remove her hair · take her hair off · get rid of her hair ·
 *       her hair — remove it · shave her hair off
 * NO    remove her hair clips        (a word the rule does not allow)
 * NO    get her hair off her face    (that means tie it back)
 * NO    remove her braids            (a style of it, not it)
 * NO    make her hair shorter        (not a removal at all)
 * ```
 *
 * Written as word sets rather than patterns so nothing here can quietly match
 * more than it says.
 */
export function asksToRemoveHerHair(sentence: string): boolean {
  const words = plainWords(sentence).filter((word) => !HAIR_MATCH_FILLER.has(word));
  if (!words.includes("hair") && !words.includes("hairs")) return false;
  const rest = words.filter((word) => word !== "hair" && word !== "hairs");
  return rest.length > 0 && rest.every((word) => HAIR_REMOVAL_VERBS.has(word));
}

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
