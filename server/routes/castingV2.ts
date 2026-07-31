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
import { assertClientRequestId } from "../../shared/clientRequestId";
import { CASTING_V2_COSTS, CASTING_V2_ROLL_PRICE_CREDITS } from "../casting/castingCreditCosts";
import { captureCastingV2Enabled } from "../castingV2/castingV2Scope";
import { UNLOCKABLE_FIELDS } from "../castingV2/briefCompiler";
import { createRoll, cancelRoll } from "../castingV2/rollService";
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
  return projectRoll({
    roll,
    candidates,
    parentRollPublicId: lineage.parentRollPublicId,
    parentCandidatePublicId: lineage.parentCandidatePublicId,
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
          return {
            sessionId: session.publicId,
            briefText: latest?.briefText ?? null,
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
      };
    }),
});
