/**
 * The `castingV2.*` namespace (plan §E, §J, §K M4).
 *
 * Three laws hold across every procedure here, without exception:
 *
 * 1. **Casting V2 adds zero public endpoints.** Every procedure is
 *    `protectedProcedure`; the enumerated public allowlist is unchanged.
 * 2. **The rollout scope is enforced *inside* each procedure**, not by leaving
 *    the namespace unlinked in the client. An unlinked route is not a control
 *    — anyone can call a tRPC procedure directly, and these procedures spend
 *    credits. This is the flag-forward ruling: the flag ships with the paid
 *    surface, defaulting off.
 * 3. **Every input schema is `.strict()`**, so an unknown field is refused
 *    rather than silently dropped, and `userId` always comes from
 *    `ctx.user.id` — never from input.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ENV } from "../_core/env";
import { BRIEF_TEXT_MAX_AUTHOR_ROAD } from "../castingV2/briefLength";
import { issueReadToken } from "../castingV2/referenceProvenance";
import { resolveAskReference } from "../castingV2/askReference";
import { storageReadBytes } from "../storage";

import { router, protectedProcedure } from "../_core/trpc";
import { checkRateLimit, RATE_LIMITS, rateLimitError } from "../security/rateLimit";
import { sheetPreviewKeys } from "../castingV2/sheetPreview";
import { castPronouns } from "../castingV2/castPronouns";
import { runFinalCastDeletionCeremony } from "../casting/finalCastDeletionCeremony";
import { assertFinalModelDeleteEnabled } from "./models";
import { storagePublicUrl } from "../storage";
import { assertClientRequestId } from "../../shared/clientRequestId";
import { CASTING_V2_COSTS, CASTING_V2_ROLL_PRICE_CREDITS,
  CASTING_V2_RETRY_PRICE_CREDITS,
} from "../casting/castingCreditCosts";
import {
  captureCastingHairReferenceEnabled,
  captureCastingInkStudioEnabled,
  captureCastingReferenceAttachEnabled,
  captureCastingConceptUploadEnabled,
  captureCastingRepaintEnabled,
  captureCastingCreativeRegisterEnabled,
  captureCastingTwoPathsEnabled,
  captureCastingV2Enabled,
} from "../castingV2/castingV2Scope";
import { IMAGINATIONS } from "../../shared/imagination";
import { CAST_STYLES } from "../../shared/castStyles";
import { INK_PLACEMENTS } from "../../shared/inkPlacementVocabulary";
import { INK_PROVENANCES } from "../../shared/inkProvenance";
import { REFERENCE_INTENTS } from "../../shared/referenceIntents";
import { INK_SIDES } from "../../shared/inkReleasedPlacements";
import sharp from "sharp";
import {
  INK_DESIGNS_PER_CANDIDATE_REFUSAL,
  INK_DESIGN_MAX_BYTES,
  inkDesignBytesRefusal,
  inkDesignContentType,
  isInkDesignFormat,
} from "../castingV2/inkUploadDoor";
import { readMakeupFromReference } from "../castingV2/makeupFromReference";
import { readHairColourFromReference } from "../castingV2/hairColourFromReference";
import {
  recordReferenceRead,
  referenceReadOutcomeFor,
  type ReferenceReadOutcome,
} from "../db/castingV2ReferenceReads";
import { uploadInkDesign } from "../castingV2/inkUploadService";
import { removeInkDesign } from "../db/castingV2InkDesignRemoval";
import { attachReference } from "../castingV2/referenceAttachService";
import { describeConcept } from "../castingV2/conceptDescribe";
import {
  REFERENCE_PICTURES_PER_CANDIDATE_REFUSAL,
  referenceAttachBytesRefusal,
} from "../castingV2/referenceAttachDoor";
import {
  ReferenceAttachmentCapError,
  ReferenceAttachmentOwnershipError,
} from "../db/castingV2ReferenceAttachments";
import { InkDesignCapError, InkDesignOwnershipError } from "../db/castingV2InkDesigns";
import { spokenError } from "../_core/spokenError";
import { UNLOCKABLE_FIELDS } from "../castingV2/briefCompiler";
import { listLineageSegments, resolveOwnedCandidateId } from "../db/castingV2Segments";
import { maskFetchUrl, segmentsOnFace } from "../castingV2/segmentsOnFace";
import { facePanel, type PanelBox, type PanelInkWorn, type PanelScan } from "../castingV2/facePanel";
import { readCarriedGeometry } from "../db/castingV2FaceScans";
import { listInkDeliveryPlacements } from "../db/castingV2InkDeliveryCrops";
import { createModuleLogger } from "../logging/logger";
import { readDeliveredInk } from "../castingV2/inkApplied";
import { declaredTakes, takeShownFor } from "../castingV2/railTakes";
import { listLineageReferences } from "../db/castingV2ReferenceLibrary";
import {
  captureCastingFaceScanEnabled,
  captureCastingReferenceLibraryEnabled,
} from "../castingV2/castingV2Scope";
import {
  panelScanOf,
  scanProgressOf,
  scanSettlesWithin,
  scannedFace,
  scannedFaceIfReady,
} from "../castingV2/faceScanService";
import { pronounsForSex } from "../castingV2/castPronouns";
import { currentValueOfFacet } from "../castingV2/refineDelta";
import { readResolvedIdentity } from "../castingV2/rollService";
import {
  AGE_BANDS,
  AGE_PHASES,
  ARCHETYPE_KEYS,
  BUILDS,
  ENERGY_KEYS,
  HERITAGES,
  LOOK_KEYS,
  SEXES,
  type ArchetypeKey,
  type EnergyKey,
  type LookKey,
} from "../castingV2/castingIntent";

/** `z.enum` wants a non-empty tuple; these three are derived key arrays. */
const tuple = <T extends string>(values: readonly T[]) => values as unknown as [T, ...T[]];
import { createRoll, cancelRoll } from "../castingV2/rollService";
import { retryCandidate } from "../castingV2/retryService";
import { captureCastingRetryEnabled } from "../castingV2/castingV2Scope";
import { CASTING_PATHS } from "../../shared/castingPaths";
import { signCandidate } from "../castingV2/signService";
import { REFINE_ANSWERING_MAX_LENGTH, REFINE_INSTRUCTION_MAX_LENGTH } from "../castingV2/refineLimits";
import {
  readAskReference, readAskScope, readRegeneratedFrom, referencesOf, refineCandidate,
} from "../castingV2/refineService";
import { pendingStage } from "../castingV2/pendingStage";
import {
  listCandidateVariants,
  listPendingVariants,
  listSettledRefineFailures,
  recordVariantOutcome,
  selectVariant,
} from "../db/castingV2Variants";
import { filedSubjectsOf } from "../castingV2/refineDelta";
import { CASTING_V2_SIGN_PRICE_CREDITS, CAST_PACKAGE_VIEWS } from "../castingV2/castViewPackage";
import { CASTING_V2_REFINE_PRICE_CREDITS } from "../casting/castingCreditCosts";
import { projectSignedCast } from "../castingV2/castProjection";
import {
  getCastLineage,
  getCastSessionId,
  getOwnedCastByPublicId,
  listCastAssets,
  listCastPromisedAngles,
  listCastPublicIdsForCandidates,
  listCastSiblings,
  listSessionSignedCastNames,
  listSignedCasts,
} from "../db/castingV2Sign";
import { discard, setKept, undo } from "../castingV2/candidateService";
import { updateModel } from "../db/models";
import {
  projectRoll,
  projectSession,
  projectShortlist,
  type RollProjection,
} from "../castingV2/rollProjection";
import {
  CastingV2OwnershipError,
  abandonCastingSession,
  createCastingSession,
  getOwnedCandidateRollWardrobe,
  getOwnedCandidateWithSelectedFace,
  getOwnedCastingSession,
  getOwnedRoll,
  getRollLineage,
  listKeptCandidates,
  listOpenCastingSessions,
  listRollCandidates,
  listSessionRolls,
} from "../db/castingV2";
import { readStoredDelta } from "../castingV2/refineLegacy";
import {
  currentWardrobeLine,
  editedWardrobeLine,
  type WardrobeResolution,
} from "../castingV2/wardrobeLine";
import type { CastingPath } from "../../shared/castingPaths";
import { CAST_NAME_MAX_LENGTH } from "../../shared/inputLimits";

/** Opaque public ids. Bounded so a hostile value never reaches a query. */
const publicId = z.string().uuid();

/**
 * Chips the user removed, sent with the next roll.
 *
 * A closed enum rather than free strings: this list decides which facts the
 * compiler stops pinning, so an unrecognised value must be a validation
 * failure and not a silently ignored one. Bounded by the field count, because
 * unlocking everything is a legitimate request and unlocking more than
 * everything is not.
 */
const unlockList = z.array(z.enum(UNLOCKABLE_FIELDS)).max(UNLOCKABLE_FIELDS.length).optional();

/**
 * Facts the user set by hand in the brief echo.
 *
 * Every value is a closed enum, for the same reason `unlockList` is: this
 * decides what the compiler pins, so an unrecognised value has to be a
 * validation failure rather than a silently dropped key. `.strict()` means a
 * field name outside this object is refused too (invariant 4) — there is no
 * such thing as a free-text override, because free text is what the brief box
 * is for.
 *
 * Heritage is one value rather than a blend: the popover replaces a heritage
 * or lets it vary, and percentage editing is deliberately not in v1.
 */
const overrideObject = z
  .object({
    sex: z.enum(SEXES).optional(),
    ageBand: z.enum(AGE_BANDS).optional(),
    agePhase: z.enum(AGE_PHASES).optional(),
    heritage: z.enum(HERITAGES).optional(),
    build: z.enum(BUILDS).optional(),
    energy: z.enum(tuple<EnergyKey>(ENERGY_KEYS)).optional(),
    look: z.enum(tuple<LookKey>(LOOK_KEYS)).optional(),
    archetype: z.enum(tuple<ArchetypeKey>(ARCHETYPE_KEYS)).optional(),
  })
  .strict()
  .optional();

function requireCastingV2(userId: number): void {
  if (!captureCastingV2Enabled(userId)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Casting is not available for this account yet.",
    });
  }
}

function enforceRateLimit(userId: number, config: (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS]): void {
  const check = checkRateLimit(`user:${userId}`, config);
  if (!check.allowed) {
    // A real TOO_MANY_REQUESTS, never a 200 carrying an error field the client
    // cannot tell apart from a validation failure (invariant 6).
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: rateLimitError(check.resetIn) });
  }
}

/**
 * Base64 in, bytes out — and a refusal for anything that is not base64.
 *
 * `Buffer.from(value, "base64")` is famously forgiving: it skips characters it
 * does not recognise and hands back whatever it managed to assemble, so a text
 * file arrives as a short buffer rather than as an error. That is a decision
 * about a customer's file made by a parser's shrug, so it is made here instead.
 */
function decodeUploadedImage(value: string): Buffer {
  const payload = value.replace(/^data:image\/[a-z+]+;base64,/, "");
  if (payload.length === 0 || payload.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) {
    throw spokenError({ code: "BAD_REQUEST", message: "That file isn't an image we can read." });
  }
  return Buffer.from(payload, "base64");
}

/**
 * WHAT THESE BYTES ACTUALLY ARE — sharp's own reading, or null.
 *
 * Deliberately the same shape the reference-attach service reads with, so the
 * door it feeds is answering about the same thing it always answers about.
 */
async function readImageBytes(bytes: Buffer): Promise<{ format?: string; width?: number; height?: number } | null> {
  try {
    const meta = await sharp(bytes).metadata();
    return { format: meta.format, width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

function ownershipRefusal(error: unknown): never {
  if (error instanceof CastingV2OwnershipError) {
    throw new TRPCError({ code: "NOT_FOUND", message: error.message });
  }
  throw error;
}

async function loadRollProjection(userId: number, rollPublicId: string): Promise<RollProjection> {
  const roll = await getOwnedRoll(userId, rollPublicId);
  if (!roll) throw new TRPCError({ code: "NOT_FOUND", message: "Roll not found" });
  const candidates = await listRollCandidates(userId, roll.id);
  // Without this the projection's `lineage` is always empty, and every
  // affordance built on it — the FROM pill, the "following" chip — is dead on
  // arrival. It was, until M6.
  const lineage = await getRollLineage(userId, roll);
  /*
    Signed candidates need their Cast's public id, or the tile can badge but not
    LINK — which is the half-fix that leaves a 500-credit purchase as decoration.
  */
  const castPublicIdByCandidateId = await listCastPublicIdsForCandidates(userId, candidates);
  return projectRoll({
    roll,
    candidates,
    castPublicIdByCandidateId,
    parentRollPublicId: lineage.parentRollPublicId,
    parentCandidatePublicId: lineage.parentCandidatePublicId,
    parentCandidatePosition: lineage.parentCandidatePosition,
  });
}

/**
 * ONE OWNED FACE-VERSION, read once for both panel procedures.
 *
 * `facePanel` and `faceScan` return the same payload from the same facts, and
 * the only difference between them is whether a scan is awaited. Two copies of
 * this walk would be two ownership stories about the same row (law 4), so
 * there is one — and every statement in it carries `userId` into its own WHERE
 * (invariant 1) rather than trusting a check before it.
 */
/* This router had no logger — every path either answered or threw. The ink
   read is the first thing here that SWALLOWS a failure, and a swallowed
   failure with nothing in the log is indistinguishable from an empty list. */
const log = createModuleLogger("routes/castingV2");

async function readOwnedFaceForPanel(
  userId: number,
  input: { candidateId: string; variantId: string | null },
): Promise<{
  candidateId: number;
  anchor: Awaited<ReturnType<typeof listCandidateVariants>>[number] | null;
  rows: Awaited<ReturnType<typeof listLineageReferences>>;
  identitySex: string | undefined;
  /**
   * WHAT THIS BRANCH IS WEARING (item 8's §8.1), resolved once for both panel
   * procedures — two `currentWardrobeLine` calls in one request are two answers
   * waiting to disagree (condition (v), §3.1a).
   */
  wardrobe: WardrobeResolution;
}> {
  /*
    THE ROLL'S TWO COLUMNS, FETCHED ALONGSIDE rather than after: the candidate
    resolve is a round trip this walk already makes, and the roll join has no
    dependency on its answer. A sequential read here would put a hop on the
    panel's FIRST look, which is the one measured against
    `FIRST_LOOK_PATIENCE_MS`.
  */
  const [candidateId, rollWardrobe] = await Promise.all([
    resolveOwnedCandidateId({
      userId,
      candidatePublicId: input.candidateId,
    }).catch(() => null),
    getOwnedCandidateRollWardrobe(userId, input.candidateId).catch(() => null),
  ]);
  if (candidateId === null) throw new TRPCError({ code: "NOT_FOUND", message: "Candidate not found" });

  const variants = await listCandidateVariants(userId, input.candidateId);
  const anchor = input.variantId === null
    ? null
    : variants.find((variant) => variant.publicId === input.variantId);
  if (input.variantId !== null && !anchor) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
  }

  const rows = await listLineageReferences({
    userId,
    candidateId,
    anchorVariantId: anchor?.id ?? null,
  });

  /* The pronoun is a fact about the person, so it comes from the version being
     looked at — or, with none selected, from this face's earliest record of the
     same person (`listCandidateVariants` is ascending). `castPronouns` answers
     `they` when the record cannot say, which is correct English rather than a
     guess. */
  const identity = anchor
    ? readResolvedIdentity(anchor.internalPrompt)
    : readResolvedIdentity(variants[0]?.internalPrompt);
  return {
    candidateId,
    anchor: anchor ?? null,
    rows,
    identitySex: identity?.sex,
    /*
      THE VERSION BEING LOOKED AT, and not the selected one.

      `editedWardrobeLine` reads a branch's own composed delta, so the panel
      must hand it the ANCHOR's — the face on screen. With no version selected
      the master is the face, and the master has no delta: it wears the line the
      roll was born with, which is exactly what `currentWardrobeLine` returns
      from `rollLine` alone.

      A failed roll read arrives as `undefined` on both fields rather than as an
      error, and `currentWardrobeLine` reads that as `unpathed` — silence, not a
      claim (`WardrobeBranch.rollPath`'s own rule). The panel is then exactly
      what it was, which is the correct way for a face chart to fail: losing a
      wardrobe section is not worth losing the face.
    */
    wardrobe: currentWardrobeLine({
      rollPath: rollWardrobe?.rollPath as CastingPath | null | undefined,
      rollLine: rollWardrobe?.rollWardrobeLine ?? null,
      editedLine: editedWardrobeLine(readStoredDelta(anchor?.deltas)),
    }),
  };
}

/**
 * HOW LONG THE FIRST LOOK WAITS BEFORE ANSWERING WITH WHAT IT HAS.
 *
 * A warm key resolves immediately and never spends this. A cold one takes
 * several seconds for the slowest of fourteen questions, and this is the beat
 * it waits before handing back the features that landed early — long enough
 * that a fast scan still answers in one request, short enough that nobody
 * watches a spinner for it.
 */
const FIRST_LOOK_PATIENCE_MS = 900;

function panelFor(
  face: Awaited<ReturnType<typeof readOwnedFaceForPanel>>,
  scan: PanelScan | null,
  /* True while this version's own read is still running — the panel keeps a
     place for the rows it has not answered yet (fable-521). */
  scanning = false,
  /* The tattoos this Cast is wearing — read by the caller, because this
     function is a pure projection and both procedures already do their own
     reads. Empty is both "she wears none" and "there was nothing to read". */
  ink: readonly PanelInkWorn[] = [],
  /* Where this version's CARRIED features actually are — read by the caller for
     the same reason the ink is, and empty is both "nothing was re-read" and
     "there was nothing to read". */
  carriedGeometry: ReadonlyMap<string, PanelBox> = new Map(),
) {
  return facePanel({
    scanning,
    carriedGeometry,
    /* Resolved once at the read, by the one owner — see `readOwnedFaceForPanel`.
       `unpathed` on every roll in both worlds today, which draws no section. */
    wardrobe: face.wardrobe,
    rows: face.rows,
    pronouns: pronounsForSex(face.identitySex),
    contentUrl: storagePublicUrl,
    /* A CSS mask is a CORS fetch and the public bucket sends no allow-origin —
       see `maskFetchUrl`. A scan's stencil travels as a data URL and needs
       neither. */
    maskUrl: (key) => maskFetchUrl(storagePublicUrl(key)),
    scan,
    ink,
  });
}

/**
 * WHERE THIS VERSION'S CARRIED FEATURES ACTUALLY ARE (fable-1443/1445).
 *
 * A library crop's rectangle was measured on the frame it was cut from, which
 * on every version after the mint is not the frame on screen. The render that
 * delivered this version re-read them and filed the answer per version; this
 * fetches it.
 *
 * # Three refusals, and the third is the whole reason it costs nothing
 *
 * **No selected version, no read.** The pristine master is version `master`,
 * and a render never files carried geometry against it — a render always
 * produces a variant. There is nothing to fetch.
 *
 * **No image key, no read.** The frame is the staleness guard's other end: a
 * row is served only if it was read on the bytes being looked at. Without a key
 * there is nothing to compare, and a row served unchecked is the defect.
 *
 * **It never fails the panel.** A face chart that 500s because a geometry row
 * would not load takes away every row on the surface to avoid one rectangle
 * being four versions old. A refusal is an empty map and a warning — the same
 * answer a version rendered before this landed gives, told apart by the log
 * line rather than by the caller.
 */
async function carriedGeometryFor(
  userId: number,
  face: Awaited<ReturnType<typeof readOwnedFaceForPanel>>,
): Promise<ReadonlyMap<string, PanelBox>> {
  const frameKey = face.anchor?.imageKey ?? null;
  if (face.anchor === null || frameKey === null) return new Map();
  try {
    return await readCarriedGeometry({
      userId,
      candidateId: face.candidateId,
      variantId: face.anchor.id,
      frameKey,
    });
  } catch (error) {
    log.warn(
      { err: String(error).slice(0, 200), candidateId: face.candidateId },
      "[castingV2] this version's carried geometry could not be read — the panel stands and its boxes are the ones the library minted",
    );
    return new Map();
  }
}

/**
 * THE TATTOOS THIS VERSION IS WEARING, for the panel's own row (his 1246/1248,
 * source ruled fable-1259 §2).
 *
 * # ⚠ THE CHAIN DECIDES, AND THE STORE ONLY LOOKS THINGS UP
 *
 * This read is TWO halves and the first one is what makes it correct. A Cast
 * accumulates a delivery crop per delivering frame, so the store holds every
 * tattoo it has EVER worn: the dev Cast this was built against holds four —
 * three at the neck from three different versions, one at the chest — while the
 * version on screen wears one. Handing the panel the store's rows would draw
 * four tattoo cards on a Cast with one tattoo, including ones a later edit
 * removed.
 *
 * So the version's own composed delta names which crops it wears
 * (`inkDelivered`, slot to crop id) and the store is asked only to resolve
 * them. **That is the same expression the carry reads** — which is the point of
 * fable-1259 §2's ruling: the panel shows what the next render would carry,
 * because there is no second opinion for it to disagree with.
 *
 * `readDeliveredInk` is the fence rather than a formality: these ids crossed a
 * JSON boundary, and it drops anything that is not an ink slot naming a
 * uuid-shaped id.
 *
 * # A named crop that is not there is SKIPPED, and that is this path's old law
 *
 * THE ID POINTS AND THE ROW DECIDES. A crop's name is minted at claim and its
 * row at delivery, so a render whose ink never landed leaves the chain naming a
 * row that does not exist. The carry skips it loudly; so does this.
 *
 * # ⚠ IT NEVER FAILS THE PANEL
 *
 * A face chart that 500s because a tattoo store hiccupped would take away every
 * row on the surface to avoid losing one, and the row it is protecting is the
 * one the customer least depends on. A refusal here is an empty list and a
 * warning — the same answer a Cast with no ink gives, told apart by the log
 * line rather than by the caller.
 */
async function inkWornBy(
  userId: number,
  candidatePublicId: string,
  anchor: Awaited<ReturnType<typeof readOwnedFaceForPanel>>["anchor"],
): Promise<readonly PanelInkWorn[]> {
  /* No version selected is the pristine master, which wears nothing — and it is
     an answer rather than a gap, so the store is not asked at all. */
  const delivered = readDeliveredInk(anchor?.deltas);
  if (delivered === null) return [];

  const crops = await listInkDeliveryPlacements({ userId, candidatePublicId })
    .catch((error: unknown) => {
      log.warn(
        { err: error, userId, candidatePublicId },
        "[castingV2] the delivered-tattoo read failed — the panel draws its other rows rather than none",
      );
      return [] as const;
    });
  const byId = new Map(crops.map((crop) => [crop.publicId, crop]));

  const worn: PanelInkWorn[] = [];
  for (const [slot, cropId] of Object.entries(delivered)) {
    const crop = byId.get(cropId);
    if (crop === undefined) {
      log.warn(
        { userId, candidatePublicId, slot, cropId },
        "[castingV2] the chain names a delivered crop with no row — the panel draws no card for it",
      );
      continue;
    }
    worn.push({
      slot,
      storageKey: crop.storageKey,
      bboxX: crop.bboxX,
      bboxY: crop.bboxY,
      bboxW: crop.bboxW,
      bboxH: crop.bboxH,
      frameWidth: crop.frameWidth,
      frameHeight: crop.frameHeight,
    });
  }
  return worn;
}

/**
 * THE INK STUDIO — attaching a design a customer owns to her Cast (M12 row 15).
 *
 * Dark by default: `CASTING_INK_STUDIO_SCOPE` is absent-means-off, and it opens
 * onto a room that is still being built — the mannequin plate a design is drawn
 * onto does not exist until the founder's one-time taste gate is answered, which
 * is why nothing here charges anybody anything (fable-921 §3b).
 *
 * ⚠ **AND IT IS NOT DARK IN PRODUCTION, WHICH IS WHAT THIS SAID UNTIL
 * 2026-08-24.** The flag is `users:1` — the founder's own account, his own
 * uploads — held there by the widening tripwire (fable-1052 §2): it does not
 * pass `users:1` while uploads ride uncropped to the plate mint. So this door is
 * OPEN for exactly one person, the free-of-charge sentence above is still true
 * of it, and the plate is held shut by `MANNEQUIN_ROAD_DEFERRED` rather than by
 * this flag.
 *
 * Everything this namespace decides is decided elsewhere on purpose: the
 * doors in `castingV2/inkUploadDoor.ts`, the order in `inkUploadService.ts`,
 * the statements in `db/castingV2InkDesigns.ts`. What is HERE is the wire —
 * the schema, the flag, and the sentence a customer reads.
 */
const inkRouter = router({
  upload: protectedProcedure
    .input(z.object({
      candidateId: publicId,
      /* THE CLOSED LIST IS THE CONTRACT, derived from the vocabulary rather
         than retyped (law 4). `forearm` is refused here — it is the word that
         returned upper-arm skin from the opposite side of the body on three
         frames of four, and no reader is asked its opinion. */
      placement: z.enum(INK_PLACEMENTS),
      side: z.enum(INK_SIDES),
      /* No default, ever. A guessed provenance is precisely the value the
         real-person fence cannot tolerate (`shared/inkProvenance.ts`). */
      provenance: z.enum(INK_PROVENANCES),
      /*
        WHAT IS BEING TAKEN FROM THIS PICTURE (ruled fable-937). A set, because
        "the tattoo and the hair from this one" is a legal ask, and required,
        because his catch is a reference uploaded for a feature nobody would
        have guessed. Which members are servable TODAY is the door's question
        and not the schema's: a closed feature earns a sentence naming it rather
        than an unreadable enum error.
      */
      intents: z.array(z.enum(REFERENCE_INTENTS)).min(1).max(REFERENCE_INTENTS.length),
      /*
        A COARSE WIRE BOUND, not the real one. This stops a payload too large
        to be worth decoding; whether the BYTES are acceptable is decided
        after decoding, by what they turn out to be.
      */
      imageBase64: z.string().max(Math.ceil(INK_DESIGN_MAX_BYTES * 4 / 3) + 256),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      /*
        THE FLAG FIRST, and NOT_FOUND rather than a refusal — outside the
        scope there is no such capability, and a code that says "not yet"
        advertises one. The AND of the whole chain is inside this call.
      */
      if (!captureCastingInkStudioEnabled(ctx.user.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No such thing." });
      }
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingInkUpload);

      const bytes = decodeUploadedImage(input.imageBase64);
      try {
        const outcome = await uploadInkDesign({
          /* From the session, never from input (invariant 3). */
          userId: ctx.user.id,
          candidatePublicId: input.candidateId,
          placement: input.placement,
          side: input.side,
          provenance: input.provenance,
          intents: input.intents,
          bytes,
        });
        if (!outcome.ok) {
          throw spokenError({ code: "BAD_REQUEST", message: outcome.refusal.message });
        }
        /* An explicit projection (invariant 8): what she attached and where.
           Neither object's key is in it — not the design's and not the
           plate's. A URL here would be a permanently public address handed
           out before anything renders, for no reason anybody can name. */
        return {
          /*
            WHETHER A PLATE WAS DRAWN FROM IT, and it is a second fact rather
            than a property of the design (fable-968 §2). Her picture is stored
            either way; a transport that was down for ninety seconds must not
            read as an upload that failed.

            The engine and the plate's size are here because they are what the
            court and the founder ask of a plate — which model drew it and
            whether the shape survived — and both come off the row rather than
            from what was asked for.
          */
          plate: outcome.plate,
          designId: outcome.design.publicId,
          placement: outcome.design.placement,
          side: outcome.design.side,
          provenance: outcome.design.provenance,
          intents: outcome.design.intents,
          width: outcome.design.width,
          height: outcome.design.height,
          /*
            WHAT WAS ACTUALLY STORED — the design cut out of her picture, or her
            frame whole, or `null` when nothing looked at all.

            The width and height above already describe the CUT rather than her
            upload once this account is inside `CASTING_INK_CUT_SCOPE`, and a
            surface handed smaller numbers with no reason for them would have to
            guess. Still no key and still no URL: the address of a design is not
            something to hand out before anything renders, and that is unchanged
            by the object at it being a cutout.
          */
          cut: outcome.cut,
        };
      } catch (error) {
        /* Somebody else's Cast is answered the way a missing one is. */
        if (error instanceof InkDesignOwnershipError) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Cast not found" });
        }
        /* A real TOO_MANY_REQUESTS at the cap, never a 200 carrying an error
           field the client cannot tell from a validation failure (6). */
        if (error instanceof InkDesignCapError) {
          throw spokenError({
            code: "TOO_MANY_REQUESTS",
            message: INK_DESIGNS_PER_CANDIDATE_REFUSAL,
          });
        }
        throw error;
      }
    }),

  /**
   * REMOVING A DESIGN — the other half of "see or reject" (ruled fable-1138 §3).
   *
   * Until this existed, the only deletion of a design in the whole product was
   * the sweep taking it with her entire Cast. A customer who looked at what the
   * cutter made of her design and disliked it could destroy the Cast or live
   * with it, and a studio holding its eight stayed full forever. That is half a
   * road, and the shown cut is the half that makes the other one necessary.
   *
   * **Deliberately NOT behind `CASTING_INK_STUDIO_SCOPE`, unlike `upload`
   * above.** The namespace's law puts the scope inside each procedure because
   * these procedures spend credits; this one spends nothing and destroys only
   * the caller's own row. Gating it would mean that the day the flag moved
   * under her, a customer could no longer delete a picture of her own that we
   * are still holding — a refusal about our configuration wearing the shape of
   * a refusal about her design. It leaks nothing either: an account outside the
   * scope owns no design rows, so it gets the same NOT_FOUND it would get from
   * a procedure that did not exist.
   */
  remove: protectedProcedure
    .input(z.object({ designId: publicId }).strict())
    .mutation(async ({ ctx, input }) => {
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingInkRemove);
      /* From the session, never from input (invariant 3). The owner is inside
         the statement that selects the row to delete, on both sides of the
         join, and the delete carries it again. */
      const removal = await removeInkDesign({
        userId: ctx.user.id,
        designPublicId: input.designId,
      });
      /* Somebody else's design is answered the way a missing one is. */
      if (!removal) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Design not found" });
      }
      /* An explicit projection (invariant 8). `remaining` is here so a surface
         showing "7 of 8" never has to recount — and never has to guess whether
         its own count is stale. */
      return { designId: removal.designPublicId, remaining: removal.remaining };
    }),
});

/**
 * TAKING A FEATURE FROM A REFERENCE THAT KEEPS NOTHING — M12 row 15's WORDS
 * form (founder ruling relayed fable-933; shape ruled fable-941).
 *
 * Separate from `inkRouter` because it makes a different promise. That door
 * exists to KEEP bytes: it files a row with a placement and our own copy of the
 * picture, because a plate has to be minted from it and carried into later
 * renders. This one reads a photograph once and drops it.
 *
 * Behind the same flag, deliberately (fable-940 §4): the class stays dark until
 * the founder has looked at the first sentence read off a real person.
 */
/**
 * UPLOAD A CONCEPT — a picture in, a description of the PERSON out (#185).
 *
 * The founder's own order, 2026-08-28: *"if you have a model already or concept
 * or image you can upload it the image analyzer will analyze and describe it to
 * the authour and cast it with the description ... that way its easy for someone
 * to upload an image and get a prompt to create someone similar without having
 * to type it all out."*
 *
 * **Nothing is kept.** The bytes ride one describer call inline and are dropped;
 * what comes back is WORDS, which land in her own brief box where she reads and
 * edits them before she spends anything. So there is no row, no table, no
 * migration, no storage write and no purge path — and no stranger's photograph
 * at a permanently public URL, which is what makes this road smaller than the
 * attach door beside it rather than a variant of it.
 *
 * It is NOT on the reference router: that one mints a handle scoped to a
 * candidate, and this door is reached from the start page, before any cast
 * exists to hang a handle from.
 */
const conceptRouter = router({
  describe: protectedProcedure
    .input(z.object({
      /* The same coarse wire bound the attach door uses, and for the same
         reason: this stops a payload too large to be worth decoding, while
         whether the BYTES are usable is decided after decoding. */
      imageBase64: z.string().max(Math.ceil(INK_DESIGN_MAX_BYTES * 4 / 3) + 256),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      /*
        THE FLAG FIRST, and NOT_FOUND rather than a refusal — outside the scope
        there is no such capability, and a code that says "not yet" advertises
        one. The AND of the chain (register, then casting) is inside this call.
      */
      if (!captureCastingConceptUploadEnabled(ctx.user.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No such thing." });
      }
      /* HOUSE MONEY on every call, so the limit is checked before the decode. */
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingConceptDescribe);

      const bytes = decodeUploadedImage(input.imageBase64);
      /*
        THE FORMAT IS WHAT THE BYTES ARE, never what the payload claimed — the
        ink door's rule, reused rather than restated. It matters here for a
        second reason the keeping doors do not have: the picture rides to the
        describer as a `data:<mime>;base64,` URI, so a JPEG announced as a PNG
        is a malformed request to the vendor rather than a bad row in our
        database. The same door also refuses a file too large, too small, or
        not an image at all, with the sentences that door already writes.
      */
      const decoded = await readImageBytes(bytes);
      const refusal = referenceAttachBytesRefusal({ byteSize: bytes.byteLength, decoded });
      if (refusal) throw spokenError({ code: "BAD_REQUEST", message: refusal.message });

      /*
        THROUGH THE OWNER OF THE MAPPING, never composed here (law 4, review of
        #187 finding 3): `inkDesignContentType` already knows what `image/x` a
        format is, and a second author of that mapping is free to drift from it.
        The narrowing also retires a non-null assertion — the door above admits
        only a decoded image whose format is one of the three, and this asks
        rather than asserts it.
      */
      const format = decoded?.format;
      if (!isInkDesignFormat(format)) {
        throw spokenError({ code: "BAD_REQUEST", message: "That file isn't an image we can read." });
      }
      const outcome = await describeConcept({
        bytes,
        contentType: inkDesignContentType(format),
      });
      if (outcome.ok) return { description: outcome.description };

      /*
        EVERY REFUSAL IS A SENTENCE SHE CAN ACT ON, and they are different
        sentences on purpose: "there is nobody in this picture" and "the reader
        did not answer" ask her to do different things, and telling her the
        wrong one sends her looking for a better photograph of a problem that
        was ours.
      */
      throw spokenError({
        code: "BAD_REQUEST",
        message: {
          no_person: "I couldn't find a person in that picture — try one with someone in it.",
          not_about_the_person:
            "I could only describe the picture, not the person in it. Try a clearer shot of them.",
          unreadable: "I couldn't read that picture just now. Try again in a moment.",
          no_transport: "I couldn't read that picture just now. Try again in a moment.",
        }[outcome.reason],
      });
    }),
});

const referenceRouter = router({
  /**
   * ATTACHING A PICTURE — build two's door (design §2, countersigned fable-1063
   * §1). The founder's complaint is the whole reason it exists:
   *
   * > *"you put a small link take makeup from a photo???? this is stupid, you
   * > should be able to upload any image like grok and use it as a reference for
   * > anything"*
   *
   * She attaches, our copy lands under the candidate's own purge path, and she
   * gets a handle back. **Nothing is read, cut, rendered or charged here** — the
   * ask comes afterwards, in her own sentence, and that is what the separate
   * door buys: `refine` is a spendable, rate-limited procedure and hanging a
   * multi-megabyte upload on it would make every paid ask carry one.
   *
   * Behind its OWN flag, off by default and off everywhere today. Not the ink
   * studio's, which is already `users:1` in production — landing this there
   * would open a new store keeping full photographs on a live account, on the
   * deploy that shipped it.
   */
  attach: protectedProcedure
    .input(z.object({
      candidateId: publicId,
      /* No default, ever. A guessed provenance is precisely the value the
         real-person fence cannot tolerate (`shared/inkProvenance.ts`), and it
         is the one claim this door does hold. */
      provenance: z.enum(INK_PROVENANCES),
      /*
        A COARSE WIRE BOUND, not the real one. This stops a payload too large to
        be worth decoding; whether the BYTES are acceptable is decided after
        decoding, by what they turn out to be.
      */
      imageBase64: z.string().max(Math.ceil(INK_DESIGN_MAX_BYTES * 4 / 3) + 256),
      /* No `intents` field, and its absence is the design — see the migration.
         This door is reached before she has typed anything, so there is no ask
         yet for an intent to authorise, and a NOT NULL guess about one is what
         the fence cannot carry. */
    }).strict())
    .mutation(async ({ ctx, input }) => {
      /*
        THE FLAG FIRST, and NOT_FOUND rather than a refusal — outside the scope
        there is no such capability, and a code that says "not yet" advertises
        one. The AND of the whole chain is inside this call.
      */
      if (!captureCastingReferenceAttachEnabled(ctx.user.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No such thing." });
      }
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingReferenceAttach);

      const bytes = decodeUploadedImage(input.imageBase64);
      try {
        const outcome = await attachReference({
          /* From the session, never from input (invariant 3). */
          userId: ctx.user.id,
          candidatePublicId: input.candidateId,
          provenance: input.provenance,
          bytes,
        });
        if (!outcome.ok) {
          throw spokenError({ code: "BAD_REQUEST", message: outcome.refusal.message });
        }
        /*
          AN EXPLICIT PROJECTION (invariant 8), and the storage key is not in it.
          A URL here would be a permanently public address for a photograph of a
          person, handed out before anything needs it — the handle is what the
          next ask travels with, and the server resolves it to bytes itself.
        */
        return {
          referenceId: outcome.attachment.publicId,
          provenance: outcome.attachment.provenance,
          width: outcome.attachment.width,
          height: outcome.attachment.height,
        };
      } catch (error) {
        /* Somebody else's Cast is answered the way a missing one is. */
        if (error instanceof ReferenceAttachmentOwnershipError) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Cast not found" });
        }
        /* A real TOO_MANY_REQUESTS at the cap, never a 200 carrying an error
           field the client cannot tell from a validation failure (6). */
        if (error instanceof ReferenceAttachmentCapError) {
          throw spokenError({
            code: "TOO_MANY_REQUESTS",
            message: REFERENCE_PICTURES_PER_CANDIDATE_REFUSAL,
          });
        }
        throw error;
      }
    }),

  /*
    THE TWO READ DOORS ARE DELETED, and their READERS are alive and busier than
    they have ever been (ruled fable-1103 §2).

    `reference.readMakeup` and `reference.readHairColour` each existed to hand a
    customer a sentence read off a picture. Both are now reached from inside the
    refine road — the words lane (`referenceWordsLane.ts`) — because the founder
    deleted the per-feature affordance that was their only caller:

    > *"you put a small link take makeup from a photo???? this is stupid, you
    > should be able to upload any image like grok and use it as a reference for
    > anything"*

    With the link gone, no surface can honestly call either one: a control that
    said WHICH reader to run would be the per-feature entry point wearing a new
    coat. **An export nobody calls is a claim** — and the second door had never
    been called by anything at all, in any road, since the day it was written.

    Neither the readers, nor the provenance token, nor the demand tally moved.
    If a surface ever earns an explicit read-this-picture affordance, it re-earns
    a door with it.
  */
});

export const castingV2Router = router({
  /**
   * What this account may do. The client asks; it never decides — the scope is
   * server-owned and the client cannot influence it (§J).
   */
  config: protectedProcedure.input(z.object({}).strict()).query(({ ctx }) => ({
    enabled: captureCastingV2Enabled(ctx.user.id),
    rollPriceCredits: CASTING_V2_ROLL_PRICE_CREDITS,
    candidatesPerRoll: CASTING_V2_COSTS.rollCandidateCount,
    // H.1: the price is on the paid affordance before it fires, and it is
    // server-derived — the Sign confirm never carries a literal.
    signPriceCredits: CASTING_V2_SIGN_PRICE_CREDITS,
    // Same law, one surface down: the refine box states its price before the
    // button fires, from here rather than from a literal in the client.
    refinePriceCredits: CASTING_V2_REFINE_PRICE_CREDITS,
    /*
      THE RETRY BUTTON (#122 shape 1). Same law as the three above: the price
      is on the paid affordance before it fires, server-derived; and the gate
      is server-owned — a tile draws the button only where the door would
      admit the tap, so the client never learns of a control that refuses.
    */
    retryEnabled: captureCastingRetryEnabled(ctx.user.id),
    retryPriceCredits: CASTING_V2_RETRY_PRICE_CREDITS,
    packageViewCount: CAST_PACKAGE_VIEWS.length,
    /*
      WHETHER THE REPAINT ROAD SERVES THIS ACCOUNT — and therefore whether the
      surfaces that only IT can perform may be drawn (fable-542 §3).

      "Take this step back" on a version chip is the first of those: the prune
      it performs is measured on the repaint road and nowhere else, so a menu
      item anywhere else would be a control that refuses. The client asks; it
      never decides — the scope is server-owned, exactly like `enabled` above.

      One gate, not two lists: when the road widens, the affordance widens with
      it, which is fable-525's doctrine applied to a surface.
    */
    stepBackEnabled: captureCastingRepaintEnabled(ctx.user.id),
    /*
      THE TWO READ GATES ARE GONE WITH THEIR DOORS (fable-1103 §2).

      `makeupFromReferenceEnabled` and `hairColourFromReferenceEnabled` each
      told the client whether to draw a per-feature read control. There are no
      per-feature read controls any more — the reading happens inside the refine
      road and arrives on its answer — so a gate for one would be a flag about a
      control nobody draws. What replaced them is the gate below: whether she
      may attach a picture at all.
    */
    /*
      AND WHETHER SHE MAY ATTACH A PICTURE TO AN ASK AT ALL — the one universal
      door (founder ruling, fable-1051; the surface is design §10).

      A FOURTH gate, for the fourth flag, and the reason is the same one written
      three times above: `reference.attach` answers NOT_FOUND outside
      `CASTING_REFERENCE_ATTACH_SCOPE`, so a `+` drawn from any other flag is a
      control that refuses. These four move independently — the attach scope is
      deliberately not the ink studio's, because landing it there would have
      opened a store of full photographs on a live account on the deploy that
      shipped it.

      Named for the CAPABILITY rather than for the flag: a client has no
      business knowing which environment variable governs it.
    */
    attachReferenceEnabled: captureCastingReferenceAttachEnabled(ctx.user.id),
    /*
      AND WHETHER SHE MAY UPLOAD A CONCEPT (#185). Same law as every gate above
      it: the scope is server-owned and the client asks rather than decides, so
      the start page draws a live upload only where the door would admit it —
      and outside the flag the tile stays the honest inert placeholder it has
      been since F5, which is a labelled coming-state rather than a control that
      looks functional and does nothing.

      Named for the capability rather than for the flag.
    */
    conceptUploadEnabled: captureCastingConceptUploadEnabled(ctx.user.id),
    /*
      AND WHETHER THIS ACCOUNT CHOOSES THE PATH ITS CASTS ARE BORN ON — the
      two paths' toggle (design §6, item 5's last slice).

      A FIFTH gate, on the pattern the four above are written on, and §6 is
      unusually explicit about what it decides: *"it does not appear when
      `CASTING_TWO_PATHS_SCOPE` is off. No disabled control, no coming-soon — a
      disabled toggle is a question with no answer, which is D-180's dead end
      wearing a tap target."*

      ⚠ **It decides whether a control is DRAWN and nothing else.** The server
      is already safe without it: `rollService` resolves `bornPath` as
      `twoPathsEnabled(userId) ? input.path ?? DEFAULT_CASTING_PATH : null`, so
      a `path` sent by an account outside the flag is IGNORED rather than
      refused — read at that site, not assumed. Which is exactly the shape
      `stepBackEnabled` has: the client asks so it does not offer a control
      that would do nothing.

      Named for the capability rather than for the flag, like the four above.
    */
    twoPathsEnabled: captureCastingTwoPathsEnabled(ctx.user.id),
    /*
      WHETHER THIS ACCOUNT IS ON THE AUTHOR ROAD (#131 slice E) — and therefore
      whether the IMAGINATION meter is drawn and the wardrobe/basics switch is
      NOT (ruling rules 10 and 11: the engine dresses the cast on this road).
      Same shape as the two above: the client asks so it does not offer a
      control nobody's roll would read; `rollService` ignores an `imagination`
      from an account the author does not serve, read at the compile site.
    */
    authorRoadEnabled: captureCastingCreativeRegisterEnabled(ctx.user.id),
    /*
      AND WHETHER A GARMENT ASK IS ADMITTED FOR THIS ACCOUNT — the sixth gate,
      and the reason it exists is a sentence that becomes false on day one
      (design §10's FIFTH flip precondition; ruled fable-1490).

      `RefinePanel`'s meta line says *"Anything about them — not their clothes or
      the room"*, and it sits four lines under the panel's WARDROBE section
      inviting a tap on a garment. It is TRUE today — read at the code before it
      was believed (law 7b): the wardrobe subject is `admittedOn: "repaintOnly"`
      (`subjectCards.ts`), so a garment ask needs an account on the repaint road
      AND a cast on the Wardrobe path, and that population is empty in both
      worlds. **The flip is what creates it**, for the first customer who opens
      a pathed cast.

      ⚠ **IT IS A SEPARATE FIELD FROM `stepBackEnabled` THOUGH BOTH READ THE
      SAME CAPTURE TODAY, and that is the whole point of adding it** (fable-1483
      ASK 2, ruled fable-1490). `stepBackEnabled`'s name is about the version
      chip's *take this step back*; reusing it here would be one gate answering
      two questions under one of their names, which is how the two drift the day
      the wardrobe subject is promoted off `repaintOnly`. Named for what it
      decides, exactly like the five above it.

      ⚠ **AND IT IS ONLY HALF THE CONDITION.** A garment ask also needs the CAST
      to be on the Wardrobe path, which is a property of the roll rather than of
      the account — the client already holds it as `RollProjection.wardrobe.path`
      and reads both. A gate that answered alone would tell a Basics customer she
      may edit an outfit her path refuses in its own words (`wall_basics_wardrobe`).
    */
    wardrobeEditsEnabled: captureCastingRepaintEnabled(ctx.user.id),
  })),

  createSession: protectedProcedure
    .input(
      z
        .object({
          originType: z.enum(["roster", "canvas", "wardrobe"]).optional(),
          // Verified against this user's boards inside the creating
          // transaction — never trusted as a destination (§G).
          originBoardId: z.number().int().positive().optional(),
          originItemId: z.number().int().positive().optional(),
          parentCastId: z.number().int().positive().optional(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.modelCreate);
      try {
        const session = await createCastingSession({
          userId: ctx.user.id,
          originType: input.originType,
          originBoardId: input.originBoardId ?? null,
          originItemId: input.originItemId ?? null,
          parentCastId: input.parentCastId ?? null,
        });
        return projectSession(session);
      } catch (error) {
        return ownershipRefusal(error);
      }
    }),

  /**
   * Sheets this account can go back to. The roster's "resume" affordance.
   *
   * Counts only — a summary, not a preview. Showing candidate images here
   * would put the sheet on a page that is not the sheet, and the retention and
   * cancellation rules are all written about one place where candidates live.
   */
  openSessions: protectedProcedure
    .input(z.object({}).strict())
    .query(async ({ ctx }) => {
      requireCastingV2(ctx.user.id);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingRead);
      const sessions = await listOpenCastingSessions(ctx.user.id);
      return Promise.all(
        sessions.map(async (session) => {
          const rolls = await listSessionRolls(ctx.user.id, session.id);
          const kept = await listKeptCandidates(ctx.user.id, session.id);
          const latest = rolls[rolls.length - 1] ?? null;

          /*
            A few faces, so the card looks like the sheet it opens.

            This procedure used to say "counts only — a summary, not a preview",
            on the reasoning that candidate images belong on the one page whose
            retention and cancellation rules are written about them. The founder
            has reversed that, and the original worry does not survive contact:
            these are the owner's own faces, on an owner-scoped projection,
            read-only, and nothing on this card can keep, discard or cancel
            anything.

            Kept candidates first — a sheet you have shortlisted should show
            what you shortlisted — and the newest roll otherwise. Four, because
            that is what the strip holds.
          */
          /*
            A SHEET CARD ALWAYS PREVIEWS (founder bug, 2026-08-02).

            After a Sign from this sheet the card went blank — "3 rolls · 1
            kept" above an empty strip. Two causes, and both are fixed: the
            signed candidate no longer counts as kept (§F, above), and the
            fallback is now applied to the RESULT rather than to the source. A
            kept list that yields no projectable face falls through to the
            latest roll instead of leaving a hole where the sheet should be.
          */
          const rollCandidates = latest
            ? await listRollCandidates(ctx.user.id, latest.id)
            : [];
          const projectable = (rows: typeof rollCandidates) =>
            rows.filter((candidate) =>
              candidate.status === "ready" && (candidate.thumbKey || candidate.imageKey));
          /*
            Kept faces lead, the latest roll backfills, deduplicated and capped
            at the strip. The rule and its two past failures live in
            `castingV2/sheetPreview.ts`, where they are pinned by test — it had
            been wrong twice in ways that looked right on the card.
          */
          const previewUrls = sheetPreviewKeys(kept, rollCandidates)
            .map((key) => storagePublicUrl(key));

          return {
            sessionId: session.publicId,
            briefText: latest?.briefText ?? null,
            previewUrls,
            rollCount: rolls.length,
            keptCount: kept.length,
            /*
              Who SURVIVES this sheet's deletion (D-107). Names rather than a
              count, because the confirm copy promises the user something about
              their own work and a bare number is a claim they cannot check.
            */
            signedCastNames: await listSessionSignedCastNames(ctx.user.id, session.id),
            lastActivityAt: session.lastActivityAt.toISOString(),
            expiresAt: session.expiresAt ? session.expiresAt.toISOString() : null,
          };
        }),
      );
    }),

  /** The resumable unsigned sheet: its rolls, and the cross-roll tray. */
  getSession: protectedProcedure
    .input(z.object({ sessionId: publicId }).strict())
    .query(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingPoll);
      const session = await getOwnedCastingSession(ctx.user.id, input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });

      const rolls = await listSessionRolls(ctx.user.id, session.id);
      const rollIndexById = new Map(rolls.map((roll) => [roll.id, roll.rollIndex]));
      const kept = await listKeptCandidates(ctx.user.id, session.id);
      const activeRoll = rolls.find((roll) => roll.id === session.activeRollId) ?? null;

      return {
        ...projectSession(session),
        activeRollId: activeRoll?.publicId ?? null,
        rolls: rolls.map((roll) => ({ rollId: roll.publicId, rollIndex: roll.rollIndex, status: roll.status })),
        shortlist: projectShortlist(
          kept.map((candidate) => ({
            candidate,
            rollIndex: rollIndexById.get(candidate.rollId) ?? 0,
          })),
        ),
      };
    }),

  /**
   * Roll the sheet. The priced action.
   *
   * `clientRequestId` is the idempotency key: a replay returns the roll that
   * already exists rather than charging a second time (§H.7).
   */
  createRoll: protectedProcedure
    .input(
      z
        .object({
          clientRequestId: z.string(),
          sessionId: publicId,
          briefText: z.string().min(1).max(BRIEF_TEXT_MAX_AUTHOR_ROAD),
          unlock: unlockList,
          overrides: overrideObject,
          /*
            THE TWO PATHS' TOGGLE (design §6). Optional, because every client
            today sends nothing and an account outside the flag has no control
            to send from — and absent is NOT `wardrobe`: the service turns an
            unsent toggle into the default only INSIDE the flag, so a roll cast
            without the feature stays honestly NULL.

            A closed enum of his two words, so a third path is a migration and
            a decision rather than a string that reaches the column and errors
            at the insert. `follow` deliberately does not take one: a Follow
            inherits the sheet's path (§3.1) and is not offered the switch.
          */
          path: z.enum(CASTING_PATHS).optional(),
          /*
            THE IMAGINATION METER (#131 slice E). Optional for the path's
            reason: the control is drawn only on the author road, absent means
            the author's own default (LOW), and an account off the road has
            nothing that reads it. `follow` takes one too since #154 — the
            author carries a follow as the family clause, so the gear is drawn
            on a standing follow and what it says must reach the roll.
          */
          imagination: z.enum(IMAGINATIONS).optional(),
          /* The settings modal's style (#142) — the meter's rule, one control over: optional, absent means photoreal. */
          style: z.enum(CAST_STYLES).optional(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      assertClientRequestId(input.clientRequestId);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.generation);
      const result = await createRoll({}, {
        userId: ctx.user.id,
        clientRequestId: input.clientRequestId,
        sessionPublicId: input.sessionId,
        briefText: input.briefText,
        unlock: input.unlock,
        overrides: input.overrides,
        path: input.path,
        imagination: input.imagination,
        style: input.style,
      });
      return loadRollProjection(ctx.user.id, result.rollPublicId);
    }),

  /**
   * Follow a candidate: a NEW roll with lineage, same price, same work.
   *
   * It never mutates the source roll — rolls are immutable versions, so
   * "following" is a fresh eight conditioned on the parent, not an edit.
   */
  follow: protectedProcedure
    .input(
      z
        .object({
          clientRequestId: z.string(),
          sessionId: publicId,
          candidateId: publicId,
          briefText: z.string().min(1).max(BRIEF_TEXT_MAX_AUTHOR_ROAD),
          unlock: unlockList,
          overrides: overrideObject,
          /*
            THE SETTINGS ON A FOLLOW, since Row A (#177): only `style` is
            read — it picks the locked block — because an anchored roll never
            calls the author, so the client stops sending `imagination` with a
            follow and the compile forces the no-call road regardless. The
            field STAYS in the schema: this input is `.strict()`, and deleting
            it in the commit that stops sending it would BAD_REQUEST every
            in-flight bundle mid-deploy (the removal contract). No `path`: a
            follow is dressed by the engine on the author road and inherits
            the sheet's path off it.
          */
          imagination: z.enum(IMAGINATIONS).optional(),
          style: z.enum(CAST_STYLES).optional(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      assertClientRequestId(input.clientRequestId);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.generation);
      const result = await createRoll({}, {
        userId: ctx.user.id,
        clientRequestId: input.clientRequestId,
        sessionPublicId: input.sessionId,
        briefText: input.briefText,
        unlock: input.unlock,
        overrides: input.overrides,
        // Re-anchored to this user's own candidates inside the roll
        // transaction; a foreign id can only fail to resolve.
        followCandidatePublicId: input.candidateId,
        imagination: input.imagination,
        style: input.style,
      });
      return loadRollProjection(ctx.user.id, result.rollPublicId);
    }),

  /** The 2.5s poll. Per-candidate states, nothing provider-shaped (§J). */
  getRoll: protectedProcedure
    .input(z.object({ rollId: publicId }).strict())
    .query(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingPoll);
      return loadRollProjection(ctx.user.id, input.rollId);
    }),

  keep: protectedProcedure
    .input(z.object({ candidateId: publicId, kept: z.boolean() }).strict())
    .mutation(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingSheet);
      return setKept({
        userId: ctx.user.id,
        candidatePublicId: input.candidateId,
        kept: input.kept,
      });
    }),

  discard: protectedProcedure
    .input(z.object({ candidateId: publicId }).strict())
    .mutation(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingSheet);
      return discard({ userId: ctx.user.id, candidatePublicId: input.candidateId });
    }),

  undo: protectedProcedure
    .input(z.object({ candidateId: publicId }).strict())
    .mutation(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingSheet);
      return undo({ userId: ctx.user.id, candidatePublicId: input.candidateId });
    }),

  /**
   * Throw a sheet away on purpose.
   *
   * A pure delete of exploratory work — no refund implications, because every
   * roll on it was delivered.
   *
   * It marks the sheet `abandoned` AND releases its candidates in the same
   * transaction, under the §G.6 carve-outs: a signed candidate survives, and so
   * do the kept siblings of any Cast this sheet produced. The claim this
   * comment used to make — that the 7-day sweep's machinery took it from here —
   * was false for two milestones: the sweep only ever selected `open` sessions,
   * so nothing downstream of an abandon ever ran.
   */
  abandonSession: protectedProcedure
    .input(z.object({ sessionId: publicId }).strict())
    .mutation(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingSheet);
      const abandoned = await abandonCastingSession({
        userId: ctx.user.id,
        sessionPublicId: input.sessionId,
      });
      if (!abandoned) throw new TRPCError({ code: "NOT_FOUND", message: "Sheet not found" });
      return { abandoned: true as const };
    }),

  /**
   * Sign a candidate into a Cast. The other priced action, and the only one
   * that creates something permanent.
   *
   * `clientRequestId` is the idempotency key: a replay returns the Cast that was
   * already signed rather than spending a second candidate (§H.7). The mutation
   * resolves once the Cast exists — its package streams in afterwards, which is
   * what lets the room open on the signed master (§F).
   */
  sign: protectedProcedure
    .input(
      z
        .object({
          clientRequestId: z.string(),
          candidateId: publicId,
          /*
            REQUIRED (founder ruling, 2026-08-02). Naming is part of the
            ceremony: no Cast is ever born "Unnamed", because a name is how she
            is found and referred to afterwards. Enforced here as well as in the
            dialog — a control the client happens to render is not a rule.
          */
          name: z.string().trim().min(1).max(CAST_NAME_MAX_LENGTH),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      assertClientRequestId(input.clientRequestId);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.generation);
      return signCandidate({}, {
        userId: ctx.user.id,
        clientRequestId: input.clientRequestId,
        candidatePublicId: input.candidateId,
        name: input.name,
      });
    }),

  /**
   * Refine one face — one paid edit, 25 credits (M8, D-121).
   *
   * Rate-limited on the generation bucket like every other paid surface. The
   * instruction is capped at 200 characters because it is ONE adjustment, not a
   * brief: the brief box is where a paragraph belongs, and a long instruction
   * here is a sign somebody is trying to re-cast rather than refine.
   */
  refine: protectedProcedure
    .input(
      z
        .object({
          clientRequestId: z.string(),
          candidateId: publicId,
          instruction: z.string().trim().min(1).max(REFINE_INSTRUCTION_MAX_LENGTH),
          /*
            The outstanding question's SENTENCE, not the question (D-180). The
            server re-derives what was asked from it, so a client cannot invent
            an option and have a typed "yes" resolve into an edit nobody offered.
          */
          answering: z.string().trim().min(1).max(REFINE_ANSWERING_MAX_LENGTH).optional(),
          /*
            THE RECTANGLE SHE POINTED AT (fable-444, ruling C) — a slot key like
            `eye@left`, meaning this ask is about that one instance.

            Capped and shaped here so a malformed key never reaches the
            catalogue; whether the key names anything real is the service's
            door, which refuses free. Absent on every ask the panel does not
            scope — it scopes a tapped row (`FacePanel`) and a clicked
            rectangle (`FaceRegions`), and production renders record the result.
          */
          scope: z.string().trim().min(1).max(40).optional(),
          /*
            THE STEP SHE POINTED AT — a chip's own remove (V3(c)).

            `at` is the step's index in the chain and `instruction` is the
            sentence the client drew that index FROM. Both travel because an
            index alone cannot tell a stale click from a live one: she may have
            clicked while another edit landed, and a stale index prunes a step
            nobody chose. The service checks them against each other and refuses
            free on a mismatch.

            Absent on every typed refinement. The `instruction` field above is
            still required by this schema and carries her own sentence for the
            step, which is what the receipt and the operation payload read.
          */
          removeStep: z
            .object({ at: z.number().int().min(0).max(200), instruction: z.string().trim().min(1).max(200) })
            .strict()
            .optional(),
          /*
            THE VERSION A FRESH TAKE REPLAYS (fable-733 §2) — the replay marker.

            Regenerate is "the same ask again, landed differently", and three
            separate doors that judge an ask against her CURRENT state have now
            refused it in turn. This is what lets those doors know, and it is a
            version id rather than a boolean on purpose: the service checks it
            against its own rows, so a client cannot assert its way past a door
            that exists to stop a charge for a render changing nothing.

            Shaped here, proved there — the same division as `scope` above.
          */
          replayOf: publicId.optional(),
          /*
            THE READ THESE WORDS CAME FROM (fable-968 §3c) — opaque here, and
            NOT trusted here: the service verifies the signature, this account,
            this Cast and the freshness before anything is written, and derives
            `verbatim` or `edited` by comparing hashes itself.

            Shaped rather than judged at this door, like `scope` and `replayOf`
            above. The cap is generous because the token is four dot-separated
            fields and one of them is a base64url HMAC; a longer string is not
            one of ours and refuses in the service for free.
          */
          provenanceToken: z.string().trim().min(1).max(400).optional(),
          /*
            THE PICTURE SHE ATTACHED TO THIS ASK — the handle, never the bytes
            (`UNIVERSAL_REFERENCE_ROAD_DESIGN.md` §2).

            The attach is its own door precisely so this one does not carry a
            multi-megabyte upload on every paid, rate-limited refine. What
            travels is the id that door minted.

            Shaped here, PROVED in the service — the same division as `scope`,
            `replayOf` and `provenanceToken` above. The service resolves it in a
            statement carrying this account, re-anchors it to this Cast, and
            refuses free if either fails; and the road's own flag is checked
            before the database is touched at all.
          */
          referenceId: publicId.optional(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      assertClientRequestId(input.clientRequestId);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.generation);
      return refineCandidate({}, {
        userId: ctx.user.id,
        clientRequestId: input.clientRequestId,
        candidatePublicId: input.candidateId,
        instruction: input.instruction,
        answering: input.answering,
        scope: input.scope,
        removeStep: input.removeStep,
        replayOf: input.replayOf,
        provenanceToken: input.provenanceToken,
        referenceId: input.referenceId,
      });
    }),

  /**
   * Choose which refinement of a face is THE face — free, and not a generation.
   *
   * `variantId: null` means the original. D-121 draws the line this procedure
   * sits on: backing up to a variant that already exists is free selection,
   * while removing a mid-stack instruction is a new combination and therefore a
   * paid re-render. This one never spends, which is exactly why it must never
   * be made to look like the paid one on the surface above it.
   */
  selectVariant: protectedProcedure
    .input(
      z
        .object({
          candidateId: publicId,
          variantId: publicId.nullable(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      /* THE ROW THAT WAS REFUSED. This is a one-tap card action like keep and
         discard, and it sat in the POLLING bucket until 2026-08-10, when the
         sheet's own session poll spent the budget and this click came back
         "Too many requests. Please try again in 14 seconds." A mutation a
         person performs belongs with the other mutations a person performs. */
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingSheet);
      /*
        THE SATISFACTION LEDGER'S TWO LIVE EVENTS (D-175).

        Which variant was selected at a given moment is the one thing that is
        genuinely unrecoverable after the fact — everything else about a
        refinement can be derived from the rows. So it is written as the user
        acts: the face they moved TO is `selected`, and the face they moved AWAY
        from is `backed_up`, which is the signal that a paid edit did not land.

        Read BEFORE the pointer moves, or the previous selection is already gone.
      */
      const before = await getOwnedCandidateWithSelectedFace(ctx.user.id, input.candidateId);
      const selected = await selectVariant({
        userId: ctx.user.id,
        candidatePublicId: input.candidateId,
        variantPublicId: input.variantId,
      });
      if (selected) {
        if (before?.variantId && before.variantPublicId !== input.variantId) {
          await recordVariantOutcome({
            userId: ctx.user.id,
            variantId: before.variantId,
            outcome: "backed_up",
          });
        }
        const landed = input.variantId
          ? (await listCandidateVariants(ctx.user.id, input.candidateId))
            .find((variant) => variant.publicId === input.variantId)
          : null;
        if (landed) {
          await recordVariantOutcome({
            userId: ctx.user.id,
            variantId: landed.id,
            outcome: "selected",
          });
        }
      }
      if (!selected) {
        /*
          Refusal rather than a silent no-op. The statement declines when the
          candidate is not this user's, is not ready, or the variant does not
          belong to it — and a 200 that changed nothing would leave the client
          showing a face the server never selected.
        */
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That version is no longer available.",
        });
      }
      return { selectedVariantId: input.variantId };
    }),

  /**
   * The refinement stack of one face, oldest first.
   *
   * An explicit projection (invariant 8), and the field list is the whole point:
   * the user's OWN instruction text and an image URL. Never `deltas`, never
   * `internalPrompt`, never provider identity — those are the recipe, and the
   * recipe never leaves the account that owns it, let alone through a read a
   * viewer polls.
   */
  variants: protectedProcedure
    .input(z.object({ candidateId: publicId }).strict())
    .query(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingRead);
      const [face, variants, pending, settled] = await Promise.all([
        getOwnedCandidateWithSelectedFace(ctx.user.id, input.candidateId),
        listCandidateVariants(ctx.user.id, input.candidateId),
        listPendingVariants(ctx.user.id, input.candidateId),
        /*
          AND THE OUTCOMES THE REQUEST COULD NOT DELIVER — Landing A
          (`CASTING_V2_REFINE_DISPATCH_DESIGN.md`, ruled fable-836 §3).

          A refine awaits its whole render, and 1.7% of them answer past the
          observed gateway wall — the money is safe and the REASON is lost,
          because a terminal failure is in neither of the two lists above.
          This is that third list: the sentence the server already wrote, on
          the surface that owns the face, so it survives the socket and the
          reload that today erase it.
        */
        listSettledRefineFailures(ctx.user.id, input.candidateId),
      ]);
      if (!face) throw new TRPCError({ code: "NOT_FOUND", message: "That candidate is no longer available." });
      /*
        ONE READING, for every clock question this payload answers.

        Two of the pending fields are about time — how long the row has waited,
        and whether its lease has passed — and taking `new Date()` twice would
        answer them off two moments a few milliseconds apart. Harmless at this
        size and exactly the shape entry 13 is about, so it is taken once.
      */
      const now = new Date();
      /*
        ONE CHIP PER EDIT, NEWEST WINS (founder, 2026-08-15; `railTakes.ts`).

        A regeneration of the same ask is an ordinary row that describes the
        same chain, so the rail shows the newest take of it and the older one
        becomes invisible — not deleted, not rewritten, so a fork made from it
        still resolves its own chain.

        **A ROW SAYS WHAT IT REPLACED; THE RAIL BELIEVES THE ROW** — forward
        only, per fable-575 §3, executed here on fable-717 §4. This read
        `liveTakes`, which INFERS supersession from chain equality, and the
        inference is the same shape carrying a risk its own module calls
        "severe, silent, and unrecoverable from the UI": two rows can describe
        one chain by accident — a step back, then the same ask again — and each
        is a picture somebody paid for. Inferring would take one off the rail on
        the strength of a coincidence, with no way for her to get it back.

        The compatibility case needs no branch, which is what makes forward-only
        honest here: a row written before regenerations declared anything
        declares nothing, supersedes nothing, and keeps its own chip. Nothing on
        the record moves; only rows born saying so group.

        The SELECTION is remapped through the same map. Without it, stepping
        back onto a take that has since been re-rolled would show a picture with
        no chip lit — the exact mismatch the rail's highlight work closed.
      */
      const { live, supersededBy } = declaredTakes(variants.map((variant) => ({
        publicId: variant.publicId,
        regeneratedFrom: readRegeneratedFrom(variant.internalPrompt),
        variant,
      })));
      /*
        WHICH VERSION EACH EDIT WAS ACTUALLY APPLIED TO, by its public id.

        `parentVariantId` is an internal numeric id and the wire speaks public
        ids, so it is resolved through the WHOLE variant list rather than
        through `live` — a parent that has since been superseded is still the
        frame this edit was made from, and the caller needs to be able to tell
        "superseded" from "never had one".

        It exists because the hold-to-compare was reading RAIL ADJACENCY, and
        rail adjacency is a display accident: fork from two versions back and
        the compare showed a frame that was never this edit's before, silently
        mis-answering *what did this edit change* (his own words, fable-1437).
      */
      const publicIdOfVariant = new Map(variants.map((variant) => [variant.id, variant.publicId]));
      return {
        selectedVariantId: takeShownFor(face.variantPublicId, supersededBy),
        originalImageUrl: face.candidate.imageKey ? storagePublicUrl(face.candidate.imageKey) : null,
        /*
          THE SMALL COPY, WHERE ONE EXISTS (fable-503).

          `thumbKey ?? imageKey` is the caller's rule, not this projection's:
          rows delivered before thumbnails existed have none, and a rail that
          assumed one would draw nothing at all for every face already on the
          record. So this says only what is true and the client falls back.
        */
        originalThumbUrl: face.candidate.thumbKey
          ? storagePublicUrl(face.candidate.thumbKey)
          : null,
        /*
          WHAT IS STILL RUNNING, from the database rather than from the client's
          own mutation state (D-161).

          A refine that outlives the panel used to become invisible: the founder
          closed the sheet on a slow "copper hair", reopened it, saw nothing in
          flight and bought the edit again. In-flight state has to come from the
          place that actually knows, or "I can't see it" and "it isn't happening"
          look identical.
        */
        pending: pending.map((variant) => ({
          variantId: variant.publicId,
          /*
            WHAT THEY TYPED, not the last thing in the recipe (D-163).

            For an edit these agree. For a REMOVAL they do not: the removal
            sentence is deliberately absent from the instruction list, because
            removal deletes steps rather than appending one — so reading
            `instructions.at(-1)` would show the user the last SURVIVING
            sentence while they waited on "remove the earrings". Falls back to
            the list for rows written before the column, every one of which was
            an edit.
          */
          instruction: variant.requestText
            ?? (Array.isArray(variant.instructions)
              ? variant.instructions.filter((entry): entry is string => typeof entry === "string")
              : []).at(-1)
            ?? "",
          /*
            AND WHICH VERSION IT IS REDRAWING, when it is redrawing one
            (fable-703).

            A refine usually ADDS a version, and the rail draws a ghost chip for
            it. A fresh take REPLACES one — same chain, same place — so there is
            no new chip for a ghost to stand in for, and the founder watched the
            version being redrawn sit there wearing its old render with nothing
            to say it was busy: *"it just stayed the same."*

            The public id alone, off the row's own record. What the rail does
            with it is the rail's business; what matters here is that the fact
            comes from the server, like every other thing about a run in flight
            (D-161), rather than being guessed at from matching sentences.
          */
          regenerating: readRegeneratedFrom(variant.internalPrompt),
          startedAt: variant.createdAt,
          /*
            AND HOW LONG IT HAS BEEN WAITING — subtracted here, off ONE clock
            (entry 13 of the instrument doctrine; fable-670).

            The panel says "this is taking longer than usual… your credits come
            back on their own" past a threshold it owns (`LONG_WAIT_MS` in
            `RefinePanel.tsx` — five minutes since 2026-08-16, two before that,
            and this sentence quoted the old figure for a day afterwards). The
            threshold is the client's to name; what is owed from here is the
            DURATION, and it used to be reached by subtracting `startedAt` from
            the BROWSER's clock. Two moments, two clocks: a laptop two minutes
            fast said it on every edit a second in, a laptop two minutes slow
            never said it, and the second failure is silent. `now` is the SAME
            reading `stage` takes below — one clock question, one answer, taken
            once.
          */
          waitedMs: Math.max(0, now.getTime() - variant.createdAt.getTime()),
          /*
            THE ONLY PROGRESS THERE IS (D-169) — AND WHO HOLDS THE ROW.

            Two real states, so the wait can say "in line" and then "being
            drawn" and be telling the truth. Everything after dispatch is
            silence until the picture lands, which is why there is no
            percentage and never will be.

            `settling` is not a third point on that line, it is a different
            question answered: the owning operation's lease has passed, so no
            worker is on this row and the recovery sweep is refunding it
            (fable-467). Said here rather than left to the client, because the
            lease is server truth and a browser guessing at it from
            `startedAt` would be a second implementation of the sweep's rule.
          */
          stage: pendingStage({
            status: variant.status,
            leaseExpiresAt: variant.leaseExpiresAt,
            now,
          }),
        })),
        /*
          THE OUTCOMES THAT REACHED NOBODY — explicit projection, three fields
          (invariant 8). The customer's own sentence, the server's own sentence,
          and when it settled. The `failureClass` is deliberately NOT here: it is
          ours, for diagnosis, and it is the 24-character category the
          `publicMessage` beside it exists to be richer than.
        */
        settled: settled.map((row) => ({
          variantId: row.publicId,
          requestText: row.requestText ?? null,
          /* Never null in practice — every terminal refine failure carries one,
             read at the artifact: 31 of 31 in production. Typed nullable because
             the column is, and a surface that rendered `null` at a customer
             would be worse than one that renders nothing. */
          message: row.publicMessage,
          settledAt: row.completedAt,
          /* So the panel can tell the bridge it has been said — see the column's
             own note. The client's own id, back to the account that sent it. */
          clientRequestId: row.clientRequestId,
        })),
        variants: live.map(({ variant }) => ({
          variantId: variant.publicId,
          /*
            THE VERSION THIS EDIT WAS APPLIED TO — the compare's whole meaning
            (fable-1437). Null means the master, which is the honest before for
            a first edit; a public id that is not on the rail means the frame
            exists and is not shown, and the caller must not substitute a
            neighbour for it.
          */
          parentVariantId: variant.parentVariantId === null
            ? null
            : publicIdOfVariant.get(variant.parentVariantId) ?? null,
          imageUrl: variant.imageKey ? storagePublicUrl(variant.imageKey) : null,
          /* The rail draws this and the viewer shows it while the full frame
             decodes; null on every version delivered before fable-503. */
          thumbUrl: variant.thumbKey ? storagePublicUrl(variant.thumbKey) : null,
          /* Their own words, returned to them — the only refinement text that
             crosses this boundary. */
          instructions: Array.isArray(variant.instructions)
            ? variant.instructions.filter((entry): entry is string => typeof entry === "string")
            : [],
          /*
            AND WHAT THIS VERSION WAS ASKED FOR, in her own words — the founder's
            own ruling on the rail (2026-08-15): *"when you undo a step it should
            call itself whatever your prompt was e.g. remove hair."*

            For an edit this is the last thing in the list and nothing changes.
            For a REMOVAL they differ, and the difference is the whole point:
            removal deletes steps rather than appending one, so the list ends
            with the last SURVIVING sentence and the chip read as a duplicate of
            the version before it. The pending chip beside this has answered the
            same question this way since D-163; the landed one now agrees.
          */
          requestText: variant.requestText ?? null,
          /*
            AND THE RECTANGLE IT WAS POINTED AT, when it was pointed at one
            (fable-704).

            A pointed ask is a sentence plus one instance, and the sentence
            alone is not the request: sent again without this, *"her right eye —
            fiery red"* is a side named with nothing pointed at, which the
            sentence lane refuses by design. So a fresh take replays the request
            rather than re-reading the caption.

            The slot key and nothing else. It is her own ask coming back to her,
            the same as `requestText` beside it — the recipe, the deltas and the
            prompt stay on the inside where §J puts them.

            Null on every typed ask and on every row landed before the record
            existed, and the client sends nothing in that case — which is exactly
            what it did before this field, so those rows regenerate as they
            always have.
          */
          requestScope: readAskScope(variant.internalPrompt),
          /*
            WHERE each instruction was FILED (D-149) — subject headings only,
            never the deltas themselves.

            Filing decides Follow inheritance, so a misfile corrupts the record
            and not merely one render. That makes it a thing the user has to be
            able to see; showing it is what turns a silent misfile into a
            correctable one. Headings are labels, not the recipe: the values
            stay internal.
          */
          filedAs: filedSubjectsOf(variant.deltas),
          /*
            AND THE PICTURES THIS VERSION WAS MADE FROM (his own ask, 1264 §1).

            Derived from the recipe the render was actually sent — never a note
            beside it — and three fields only: the url, what the picture was
            FOR, and which feature it belongs to. The prompt, the digest and the
            geometry stay inside with the rest of `internalPrompt` (§J); see
            `referencesOf`, and `referenceProjection.test.ts` pins the three so a
            fourth cannot arrive by accident.

            Empty on every paste-road row and every row landed before the recipe
            was stored, which reads as nothing to show.
          */
          references: referencesOf(variant.internalPrompt),
          /*
            AND THE HANDLE THAT BRINGS THE PICTURE BACK (fable-1421 §2).

            The thumbnails above say what she gave this render; this is what
            lets *Use* give it again. One per ask, because an ask carries one
            attachment — and a HANDLE rather than a url, because the address of
            a customer's photograph stays server-side and the id is the currency
            `castingV2.refine` already takes.

            Null on every ask with no picture, which the client reads as
            *nothing to bring back*.
          */
          askReferenceId: readAskReference(variant.internalPrompt),
        })),
      };
    }),

  /**
   * The roster: every Cast this account has signed.
   *
   * It exists because it was missing, and the absence cost the founder a Cast
   * he had paid 500 credits for — signed, permanent, and reachable from
   * nowhere. A purchase this size must be findable from every place it
   * logically lives.
   *
   * Counts and faces only; the room owns the detail.
   */
  roster: protectedProcedure
    .input(z.object({}).strict())
    .query(async ({ ctx }) => {
      requireCastingV2(ctx.user.id);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingRead);
      const casts = await listSignedCasts(ctx.user.id);
      return casts.map(({ model, anchorUrl, personaLine }) => ({
        castId: model.agencyId ?? "",
        name: model.name,
        personaLine,
        imageUrl: anchorUrl,
        // Derived words, never the schema they came from — the delete ceremony
        // talks about a specific person and must not call Jericho "she".
        pronouns: castPronouns(model.technicalSchema),
        // A Cast whose package is still building says so rather than looking
        // finished; it is reachable either way.
        status: model.status === "provisioning" ? ("building" as const) : ("ready" as const),
        signedAt: model.mintedAt ? model.mintedAt.toISOString() : null,
      }));
    }),

  /**
   * Rename a Cast from her room.
   *
   * A V2-shaped door onto the existing model-update path: the room only ever
   * holds her public KI id (§J — internal ids never leave the server), so the
   * numeric model is resolved here, owner-scoped, and the write itself is the
   * one the rest of the product already uses. Renaming is display metadata
   * (FR-3B): it never touches identity, and `agencyId` remains the stable key.
   */
  renameCast: protectedProcedure
    .input(z.object({ castId: z.string().min(1).max(32), name: z.string().trim().min(1).max(CAST_NAME_MAX_LENGTH) }).strict())
    .mutation(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingSheet);
      const model = await getOwnedCastByPublicId(ctx.user.id, input.castId);
      if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Cast not found" });
      const renamed = await updateModel(model.id, { name: input.name });
      if (!renamed.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save the name" });
      }
      return { castId: input.castId, name: input.name };
    }),

  /**
   * Delete a Cast, permanently.
   *
   * The V2 door onto the D-64 ceremony — one authority, two doors
   * (`finalCastDeletionCeremony`). The roster knows her by her public `KI-…`
   * id and must never be handed a numeric model id to pass back; resolving it
   * here, owner-scoped, is what keeps that true.
   *
   * `deleteAvailability` on the models router is the flag the client reads, and
   * the ceremony asserts the same flag itself — a control that is not invoked
   * does not exist, and one enforced only in the UI is worse (invariant 7).
   */
  deleteCast: protectedProcedure
    .input(z.object({
      clientRequestId: z.string().uuid(),
      castId: z.string().min(1).max(32),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingSheet);
      assertFinalModelDeleteEnabled();
      const model = await getOwnedCastByPublicId(ctx.user.id, input.castId);
      if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Cast not found" });
      /*
        A Cast still building refuses, and says why. The deletion authority
        excludes `provisioning` models by design — her package is mid-flight and
        a tombstone underneath it would race the slot commits. The roster hides
        the control while she builds; this is the server saying the same thing
        to anyone who did not read the UI.
      */
      if (model.status === "provisioning") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "She's still building — you can delete her once her package finishes.",
        });
      }
      return runFinalCastDeletionCeremony({
        userId: ctx.user.id,
        modelId: model.id,
        clientRequestId: input.clientRequestId,
        audit: {
          ipAddress: ctx.req.ip ?? null,
          userAgent: ctx.req.headers["user-agent"] ?? null,
        },
      });
    }),

  /**
   * The room's read: one signed Cast, its package, and what each slot is doing.
   *
   * Polled while the package builds, on the same cadence as the sheet. Every
   * field is an explicit allowlist (§J) — the identity documents that would let
   * someone reproduce this Cast are not in the projection at all.
   */
  getCast: protectedProcedure
    .input(z.object({ castId: z.string().min(1).max(32) }).strict())
    .query(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingRead);
      const model = await getOwnedCastByPublicId(ctx.user.id, input.castId);
      if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Cast not found" });
      const [assets, lineage, promisedAngles, sessionId] = await Promise.all([
        listCastAssets(ctx.user.id, model.id),
        getCastLineage(ctx.user.id, model),
        listCastPromisedAngles(ctx.user.id, model.id),
        model.sourceCandidateId
          ? getCastSessionId(ctx.user.id, model.sourceCandidateId)
          : Promise.resolve(null),
      ]);
      const siblingRows = sessionId && model.sourceCandidateId
        ? await listCastSiblings({
            userId: ctx.user.id,
            sessionId: sessionId.id,
            excludeCandidateId: model.sourceCandidateId,
          })
        : [];
      /*
        A sibling's DESTINATION, resolved here rather than guessed on the
        client: a signed sibling has a room of her own, and the owner-scoped
        resolver is the only thing that can turn her `signedCastId` into the
        public KI id that addresses it.
      */
      const siblingCastIds = await listCastPublicIdsForCandidates(ctx.user.id, siblingRows);
      const siblings = siblingRows.map((sibling) => ({
        ...sibling,
        castId: siblingCastIds.get(sibling.id) ?? null,
      }));
      return projectSignedCast({
        model,
        assets,
        lineage,
        promisedAngles,
        siblings,
        // Whether her sheet is still a place you can go (§G.6 protects the
        // candidates, not the session).
        sheetLive: sessionId?.live ?? false,
      });
    }),

  /**
   * WHAT THIS VERSION IS KEEPING — the segments panel's only read (fable-113,
   * founder-cleared in fable-122).
   *
   * Read-only by design, and that is a product decision rather than a slice
   * boundary: the panel tells her what her face is holding and PREFILLS a
   * sentence when she taps a row. Nothing changes until she finishes it and
   * asks, so there is no delete here, no restyle, and no reorder.
   *
   * It is derived from `listLineageSegments` — the compositor's OWN source —
   * rather than from a second query shaped for the screen. A panel with its own
   * notion of what is kept would eventually disagree with the picture, and the
   * disagreement would be invisible until she noticed her freckles were listed
   * and absent (law 4).
   *
   * `variantId: null` is the original, and the original keeps nothing: the first
   * edit of a face carries nothing by definition (fable-091).
   */
  segmentsOnFace: protectedProcedure
    .input(z.object({ candidateId: publicId, variantId: publicId.nullable() }).strict())
    .query(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingRead);
      /* No version selected means the original, which keeps nothing — and an
         empty list renders no panel at all, so the pronoun is never used. */
      if (input.variantId === null) return { possessive: "their", rows: [] };

      /* Owner proved inside the statements that read, never in a check before
         them (invariant 1) — `resolveOwnedCandidateId` and
         `listCandidateVariants` each carry `userId` into their own WHERE. */
      const candidateId = await resolveOwnedCandidateId({
        userId: ctx.user.id,
        candidatePublicId: input.candidateId,
      }).catch(() => null);
      if (candidateId === null) throw new TRPCError({ code: "NOT_FOUND", message: "Candidate not found" });

      const variants = await listCandidateVariants(ctx.user.id, input.candidateId);
      const anchor = variants.find((variant) => variant.publicId === input.variantId);
      if (!anchor) throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });

      const segments = await listLineageSegments({
        userId: ctx.user.id,
        candidateId,
        anchorVariantId: anchor.id,
      });

      /*
        HER OWN WORDS FOR THE THING, taken from the variant that DELIVERED it —
        the same string the painter was handed and the reader was asked about.
        A row whose value cannot be found is dropped rather than shown as a
        facet id, which is the projection's rule, not this route's.
      */
      const byId = new Map(variants.map((variant) => [variant.id, variant]));

      /*
        THIS FACE'S OWN PRONOUN, from the version she is looking at.

        Taken from the ANCHOR rather than per segment, because a pronoun is a
        fact about the person and not about the edit — and because the heading
        above the rows has to agree with them. Derived from the resolved
        identity's sex through the same helper the room uses; `they` when the
        record cannot say, which is correct English rather than a guess.
      */
      const pronouns = pronounsForSex(readResolvedIdentity(anchor.internalPrompt)?.sex);
      return {
        /* The heading is "On {possessive} face" — his ruling's structure, with
           the one word the product is able to know. */
        possessive: pronouns.possessive,
        rows: segmentsOnFace({
          segments,
          deliveredValue: (segment) => {
            const source = segment.variantId === null ? null : byId.get(segment.variantId);
            if (!source) return null;
            return currentValueOfFacet(readResolvedIdentity(source.internalPrompt), segment.facet);
          },
          urlOf: storagePublicUrl,
          pronouns,
        }),
      };
    }),

  /**
   * THE FACE PANEL — panel v2's only read, and it is dark until the library is.
   *
   * v1 (`segmentsOnFace`) lists what a version is KEEPING and stays live for
   * everyone. This one lists what is EDITABLE, which by the founder's ruling is
   * everything — so the rows come from the slot catalogue and the library says
   * what each one currently is.
   *
   * **Gated on `CASTING_REFERENCE_LIBRARY_SCOPE`.** The flag governs whether
   * rows are written; a panel over an empty library would be a list of every
   * feature with nothing said about any of them, which is true and useless. Off,
   * this returns an empty panel and the client renders v1 exactly as today.
   *
   * ⚠ **The clause above read *"which is unset everywhere"* until 2026-08-24
   * and the flag is `all` in production** — it rode with the repaint road, which
   * carries features by crop and cannot work without it. So this panel is live
   * for every account, and the empty-panel branch describes a configuration
   * production does not have.
   *
   * Ownership is proved inside the statements that read (invariant 1):
   * `resolveOwnedCandidateId`, `listCandidateVariants` and
   * `listLineageReferences` each carry `userId` into their own WHERE.
   */
  facePanel: protectedProcedure
    .input(z.object({ candidateId: publicId, variantId: publicId.nullable() }).strict())
    .query(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingRead);
      if (!captureCastingReferenceLibraryEnabled(ctx.user.id)) {
        return { enabled: false as const, scanning: false, possessive: "their", groups: [] };
      }

      const face = await readOwnedFaceForPanel(ctx.user.id, input);
      /*
        WHAT IS ALREADY READ, and never a read of its own.

        This procedure is the panel's first paint and must answer in the time a
        list takes to render; a scan is fourteen segmenter calls and seconds.
        So the first look at a version gets the library alone and the scan
        arrives on `faceScan` below — and every look after that finds it warm
        here, complete in one round trip.
      */
      const ready = captureCastingFaceScanEnabled(ctx.user.id)
        ? scannedFaceIfReady({
          userId: ctx.user.id,
          candidateId: face.candidateId,
          variantId: face.anchor?.id ?? null,
        })
        : null;
      return {
        enabled: true as const,
        /* Whether a scan is worth asking for. The client fires nothing when
           this is false, so a user outside the scope pays no round trip for a
           capability they do not have. */
        scanning: captureCastingFaceScanEnabled(ctx.user.id),
        /*
          THE FAST PANEL KEEPS PLACES FOR THE ROWS THE SCAN HAS NOT ANSWERED.

          This is the first paint, and on a fresh cast it has nothing at all —
          which is the founder's *"it looks like nothing is even happening"*.
          A read that is COMING is a placeholder row; a read that is not coming
          (the scan is out of scope, or it has already landed) leaves the panel
          exactly as it was.
        */
        ...panelFor(
          face,
          ready === null ? null : panelScanOf(ready),
          captureCastingFaceScanEnabled(ctx.user.id) && ready === null,
          await inkWornBy(ctx.user.id, input.candidateId, face.anchor),
          await carriedGeometryFor(ctx.user.id, face),
        ),
      };
    }),

  /**
   * THE SAME PANEL, AFTER READING HER FACE — the auto-scan's only surface.
   *
   * The panel's rows come from the catalogue and their content from the
   * library, and the library holds only what an EDIT minted — so a face nobody
   * has edited is a column of empty slots (the founder's own screenshot,
   * fable-352). This runs the scan for the version being looked at and returns
   * the panel with those rows filled from what the picture already contains.
   *
   * **It is the same shape as `facePanel` on purpose.** The client renders the
   * fast one and swaps this in when it lands; two payloads that differed in
   * shape would put panel logic in the browser, where it cannot be tested
   * against a face.
   *
   * Scanning is idempotent per (candidate, version): the first caller pays,
   * every caller after joins the same read (`faceScanService`). Nothing is
   * charged to the user — a scan is house money on a read they never asked to
   * pay for — and nothing is written anywhere.
   */
  faceScan: protectedProcedure
    .input(z.object({ candidateId: publicId, variantId: publicId.nullable() }).strict())
    .query(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingRead);
      if (!captureCastingReferenceLibraryEnabled(ctx.user.id) || !captureCastingFaceScanEnabled(ctx.user.id)) {
        /* `done` on the dark answer too, so the client's "is it still reading"
           question has one shape whatever the flags say — a field that exists
           on only one branch is read as `undefined` and polls forever. */
        return { enabled: false as const, scanning: false, done: true, possessive: "their", groups: [] };
      }

      const face = await readOwnedFaceForPanel(ctx.user.id, input);
      /*
        THE FRAME BEING LOOKED AT, and it comes from the same owner-scoped
        reads the panel used. A selected version is its own picture; with none
        selected the master is the face. A row with no image key has nothing to
        read, so it degrades to the unscanned panel rather than throwing.
      */
      let imageKey = face.anchor?.imageKey ?? null;
      if (face.anchor === null) {
        const owned = await getOwnedCandidateWithSelectedFace(ctx.user.id, input.candidateId);
        imageKey = owned?.candidate.imageKey ?? null;
      }

      let scan: PanelScan | null = null;
      let done = true;
      if (imageKey !== null) {
        const key = {
          userId: ctx.user.id,
          candidateId: face.candidateId,
          variantId: face.anchor?.id ?? null,
        };
        /*
          A FAILED SCAN IS TODAY'S PANEL, not an error. The user asked to look
          at a face, not to buy a reading, so a segmenter that is down or a
          frame that will not decode costs them nothing and shows them exactly
          what they saw yesterday (`faceScan`'s own posture, one layer up).
        */
        const reading = scannedFace({ ...key, imageKey }).catch(() => null);
        /*
          AND IT ANSWERS WITH WHAT HAS LANDED (fable-521 §3).

          Fourteen questions run in parallel and the slowest decides when the
          whole scan resolves, so waiting for it means a panel that arrives all
          at once after several seconds. This waits a beat for a fast one, then
          hands back the features that ARE ready and says it is not finished;
          the client asks again and the panel fills a row at a time.

          The bounded wait is not decoration. Without it a warm key — the common
          case, every look after the first — would answer `done: false` with
          nothing and buy a round trip to say what it already knew.
        */
        const finished = await scanSettlesWithin(reading, FIRST_LOOK_PATIENCE_MS);
        const progress = scanProgressOf(key);
        scan = progress === null ? null : panelScanOf(progress.scan);
        /*
          `finished` covers the case rows cannot: a scan that FAILED leaves no
          progress at all, and answering "not finished" to that would have the
          client ask again every second — each ask starting a fresh
          fourteen-question read, because a failed scan is deliberately not
          cached. Failure is an ending, and the panel it leaves is today's.
        */
        done = finished || (progress?.done ?? false);
      }
      /* `scanning` is the panel's word for "a place is kept for rows not
         answered yet", so it is true exactly while the reading is still
         running — not merely because a scan happened. */
      return {
        enabled: true as const,
        scanning: true,
        done,
        ...panelFor(
          face,
          scan,
          !done,
          await inkWornBy(ctx.user.id, input.candidateId, face.anchor),
          await carriedGeometryFor(ctx.user.id, face),
        ),
      };
    }),

  /** Refunds only what never started. Delivered work is never refunded (§H.6). */
  /**
   * THE RETRY BUTTON (#122 shape 1): one failed slice rendered again with its
   * own words, 20 credits, refunded again on failure. A PAID procedure, so it
   * sits in the paid bucket with `createRoll` and `refine`; the flag's own
   * door is inside the service (NOT_FOUND off the flag, before any row is
   * read). `clientRequestId` is the idempotency key; the candidate lock inside
   * the service is the double-tap cover at the wire.
   */
  retry: protectedProcedure
    .input(z.object({ clientRequestId: z.string(), candidateId: publicId }).strict())
    .mutation(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.generation);
      assertClientRequestId(input.clientRequestId);
      return retryCandidate({}, {
        userId: ctx.user.id,
        clientRequestId: input.clientRequestId,
        candidatePublicId: input.candidateId,
      });
    }),

  cancel: protectedProcedure
    .input(z.object({ rollId: publicId }).strict())
    .mutation(async ({ ctx, input }) => {
      requireCastingV2(ctx.user.id);
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingSheet);
      const result = await cancelRoll({ userId: ctx.user.id, rollPublicId: input.rollId });
      return {
        cancelled: result.cancelled,
        refundedCredits: result.refundedCredits,
        // Truthful even when it went wrong: a refund that did not record is
        // never reported as "you weren't charged".
        refundRecorded: !result.refundUnrecorded,
        // A count, so the sheet can say what happens next rather than leaving
        // "0 credits back" to read as a failure. Never used to decide money.
        stillFinishing: result.stillFinishing,
        // Which tiles to paint cancelled. The client cannot derive this — the
        // projection collapses queued and dispatched into one status.
        cancelledCandidateIds: result.cancelledCandidateIds,
      };
    }),

  ink: inkRouter,
  reference: referenceRouter,
  concept: conceptRouter,
});
