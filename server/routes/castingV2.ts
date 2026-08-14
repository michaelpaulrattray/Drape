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

import { router, protectedProcedure } from "../_core/trpc";
import { checkRateLimit, RATE_LIMITS, rateLimitError } from "../security/rateLimit";
import { sheetPreviewKeys } from "../castingV2/sheetPreview";
import { castPronouns } from "../castingV2/castPronouns";
import { runFinalCastDeletionCeremony } from "../casting/finalCastDeletionCeremony";
import { assertFinalModelDeleteEnabled } from "./models";
import { storagePublicUrl } from "../storage";
import { assertClientRequestId } from "../../shared/clientRequestId";
import { CASTING_V2_COSTS, CASTING_V2_ROLL_PRICE_CREDITS } from "../casting/castingCreditCosts";
import { captureCastingV2Enabled } from "../castingV2/castingV2Scope";
import { UNLOCKABLE_FIELDS } from "../castingV2/briefCompiler";
import { listLineageSegments, resolveOwnedCandidateId } from "../db/castingV2Segments";
import { maskFetchUrl, segmentsOnFace } from "../castingV2/segmentsOnFace";
import { facePanel, type PanelScan } from "../castingV2/facePanel";
import { listLineageReferences } from "../db/castingV2ReferenceLibrary";
import {
  captureCastingFaceScanEnabled,
  captureCastingReferenceLibraryEnabled,
} from "../castingV2/castingV2Scope";
import { panelScanOf, scannedFace, scannedFaceIfReady } from "../castingV2/faceScanService";
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
import { signCandidate } from "../castingV2/signService";
import { refineCandidate } from "../castingV2/refineService";
import { pendingStage } from "../castingV2/pendingStage";
import {
  listCandidateVariants,
  listPendingVariants,
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
  getOwnedCandidateWithSelectedFace,
  getOwnedCastingSession,
  getOwnedRoll,
  getRollLineage,
  listKeptCandidates,
  listOpenCastingSessions,
  listRollCandidates,
  listSessionRolls,
} from "../db/castingV2";

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
async function readOwnedFaceForPanel(
  userId: number,
  input: { candidateId: string; variantId: string | null },
): Promise<{
  candidateId: number;
  anchor: Awaited<ReturnType<typeof listCandidateVariants>>[number] | null;
  rows: Awaited<ReturnType<typeof listLineageReferences>>;
  identitySex: string | undefined;
}> {
  const candidateId = await resolveOwnedCandidateId({
    userId,
    candidatePublicId: input.candidateId,
  }).catch(() => null);
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
  return { candidateId, anchor: anchor ?? null, rows, identitySex: identity?.sex };
}

function panelFor(
  face: Awaited<ReturnType<typeof readOwnedFaceForPanel>>,
  scan: PanelScan | null,
) {
  return facePanel({
    rows: face.rows,
    pronouns: pronounsForSex(face.identitySex),
    contentUrl: storagePublicUrl,
    /* A CSS mask is a CORS fetch and the public bucket sends no allow-origin —
       see `maskFetchUrl`. A scan's stencil travels as a data URL and needs
       neither. */
    maskUrl: (key) => maskFetchUrl(storagePublicUrl(key)),
    scan,
  });
}

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
    packageViewCount: CAST_PACKAGE_VIEWS.length,
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
          briefText: z.string().min(1).max(2000),
          unlock: unlockList,
          overrides: overrideObject,
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
          briefText: z.string().min(1).max(2000),
          unlock: unlockList,
          overrides: overrideObject,
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
          name: z.string().trim().min(1).max(60),
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
          instruction: z.string().trim().min(1).max(200),
          /*
            The outstanding question's SENTENCE, not the question (D-180). The
            server re-derives what was asked from it, so a client cannot invent
            an option and have a typed "yes" resolve into an edit nobody offered.
          */
          answering: z.string().trim().min(1).max(200).optional(),
          /*
            THE RECTANGLE SHE POINTED AT (fable-444, ruling C) — a slot key like
            `eye@left`, meaning this ask is about that one instance.

            Capped and shaped here so a malformed key never reaches the
            catalogue; whether the key names anything real is the service's
            door, which refuses free. Absent on every ask the panel does not
            scope, which is all of them until the client sends one.
          */
          scope: z.string().trim().min(1).max(40).optional(),
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
      const [face, variants, pending] = await Promise.all([
        getOwnedCandidateWithSelectedFace(ctx.user.id, input.candidateId),
        listCandidateVariants(ctx.user.id, input.candidateId),
        listPendingVariants(ctx.user.id, input.candidateId),
      ]);
      if (!face) throw new TRPCError({ code: "NOT_FOUND", message: "That candidate is no longer available." });
      return {
        selectedVariantId: face.variantPublicId,
        originalImageUrl: face.candidate.imageKey ? storagePublicUrl(face.candidate.imageKey) : null,
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
          startedAt: variant.createdAt,
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
            now: new Date(),
          }),
        })),
        variants: variants.map((variant) => ({
          variantId: variant.publicId,
          imageUrl: variant.imageKey ? storagePublicUrl(variant.imageKey) : null,
          /* Their own words, returned to them — the only refinement text that
             crosses this boundary. */
          instructions: Array.isArray(variant.instructions)
            ? variant.instructions.filter((entry): entry is string => typeof entry === "string")
            : [],
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
    .input(z.object({ castId: z.string().min(1).max(32), name: z.string().trim().min(1).max(60) }).strict())
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
   * **Gated on `CASTING_REFERENCE_LIBRARY_SCOPE`, which is unset everywhere.**
   * The flag governs whether rows are written; a panel over an empty library
   * would be a list of every feature with nothing said about any of them, which
   * is true and useless. Off, this returns an empty panel and the client renders
   * v1 exactly as today.
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
        ...panelFor(face, ready === null ? null : panelScanOf(ready)),
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
        return { enabled: false as const, scanning: false, possessive: "their", groups: [] };
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
      if (imageKey !== null) {
        /*
          A FAILED SCAN IS TODAY'S PANEL, not an error. The user asked to look
          at a face, not to buy a reading, so a segmenter that is down or a
          frame that will not decode costs them nothing and shows them exactly
          what they saw yesterday (`faceScan`'s own posture, one layer up).
        */
        scan = await scannedFace({
          userId: ctx.user.id,
          candidateId: face.candidateId,
          variantId: face.anchor?.id ?? null,
          imageKey,
        }).then(panelScanOf).catch(() => null);
      }
      return { enabled: true as const, scanning: true, ...panelFor(face, scan) };
    }),

  /** Refunds only what never started. Delivered work is never refunded (§H.6). */
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
});
