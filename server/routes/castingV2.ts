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
import { CASTING_V2_SIGN_PRICE_CREDITS, CAST_PACKAGE_VIEWS } from "../castingV2/castViewPackage";
import { projectSignedCast } from "../castingV2/castProjection";
import {
  getCastLineage,
  getOwnedCastByPublicId,
  listCastAssets,
  listCastPromisedAngles,
  listCastPublicIdsForCandidates,
  listSignedCasts,
} from "../db/castingV2Sign";
import { discard, setKept, undo } from "../castingV2/candidateService";
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
          const previewSource =
            kept.length > 0
              ? kept
              : latest
                ? await listRollCandidates(ctx.user.id, latest.id)
                : [];
          /*
            `thumbKey ?? imageKey`, and the fallback is the whole point.

            The first version filtered on `thumbKey` alone and the strip was
            empty on every real sheet — nothing writes that column. The
            thumbnail transform worker is deferred scope (§G.6), so `thumbKey`
            is null on every candidate in production and always has been. It
            rendered in a dev check only because the fixture set it by hand.

            Filtering on a field nothing populates is the same mistake as a
            control that is never called: it looks right, it passes review, and
            it does nothing. Full images are heavier than thumbs and four of
            them at 90px is a cost worth paying until the worker exists.
          */
          const previewUrls = previewSource
            .filter((candidate) => candidate.status === "ready" && (candidate.thumbKey || candidate.imageKey))
            .slice(0, 4)
            .map((candidate) => storagePublicUrl((candidate.thumbKey ?? candidate.imageKey) as string));

          return {
            sessionId: session.publicId,
            briefText: latest?.briefText ?? null,
            previewUrls,
            rollCount: rolls.length,
            keptCount: kept.length,
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
   * roll on it was delivered. It writes the same `abandoned` status the 7-day
   * sweep writes, so the object purge that follows is the existing machinery.
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
          // Optional by design: an unnamed Cast shows its KI id until its owner
          // names it. Bounded because it reaches a varchar(128).
          name: z.string().trim().min(1).max(60).optional(),
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
        name: input.name ?? null,
      });
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
        // A Cast whose package is still building says so rather than looking
        // finished; it is reachable either way.
        status: model.status === "provisioning" ? ("building" as const) : ("ready" as const),
        signedAt: model.mintedAt ? model.mintedAt.toISOString() : null,
      }));
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
      const [assets, lineage, promisedAngles] = await Promise.all([
        listCastAssets(ctx.user.id, model.id),
        getCastLineage(ctx.user.id, model),
        listCastPromisedAngles(ctx.user.id, model.id),
      ]);
      return projectSignedCast({ model, assets, lineage, promisedAngles });
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
