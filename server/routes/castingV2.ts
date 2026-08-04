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
import { listCandidateVariants, selectVariant } from "../db/castingV2Variants";
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
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingPoll);
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
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingPoll);
      const selected = await selectVariant({
        userId: ctx.user.id,
        candidatePublicId: input.candidateId,
        variantPublicId: input.variantId,
      });
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
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingPoll);
      const [face, variants] = await Promise.all([
        getOwnedCandidateWithSelectedFace(ctx.user.id, input.candidateId),
        listCandidateVariants(ctx.user.id, input.candidateId),
      ]);
      if (!face) throw new TRPCError({ code: "NOT_FOUND", message: "That candidate is no longer available." });
      return {
        selectedVariantId: face.variantPublicId,
        originalImageUrl: face.candidate.imageKey ? storagePublicUrl(face.candidate.imageKey) : null,
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
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingPoll);
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
      enforceRateLimit(ctx.user.id, RATE_LIMITS.castingPoll);
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
