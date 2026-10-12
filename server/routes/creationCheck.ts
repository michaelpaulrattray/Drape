/**
 * THE PUBLIC CHECK PAGE AND THE OWNER'S ONE TOGGLE — N2d-3 (#2313).
 *
 * Design: `docs/specs/N2D_RECORD_OF_CREATION_DESIGN_2026-10-12.md` §1, §2 Q2,
 * §3 and §7.3. Four procedures, one namespace:
 *
 *   creationCheck.lookup     PUBLIC. Keyed on the Klieg ID. ⚠ A DELIBERATE
 *                            ADDITION TO THE PUBLIC-ENDPOINT ALLOWLIST — named in
 *                            CLAUDE.md's invariant-5 list in the same commit, and
 *                            pinned by `server/architecturePublicEndpoints.test.ts`.
 *                            IP-rate-limited (a real `TOO_MANY_REQUESTS`,
 *                            invariant 6), `.strict()` input (invariant 4),
 *                            structurally read-only: it calls one SELECT and
 *                            nothing else, and it has no session to act for.
 *   creationCheck.status     The owner's switch, read without making anything.
 *   creationCheck.preview    What the public page WILL show, through the same
 *                            projector the public read uses — shown to the owner
 *                            before the page goes on (design §2 Q2). Makes the
 *                            record on first request if the cast has none yet
 *                            (the backfill entrance N2d-1 built for this).
 *   creationCheck.setPublic  The toggle. Writes `publicAt` on the owner's record;
 *                            turning it off nulls it.
 *
 * # Dark
 *
 * Behind `CASTING_CREATION_RECORD_SCOPE` (child of `CASTING_V2_SCOPE`), read at
 * the point of use. Off for the caller: `status` answers `available: false` (so
 * the room draws no toggle) and `preview`/`setPublic` refuse `NOT_FOUND`. Off
 * for a page's OWNER: `lookup` answers `NO_PUBLIC_RECORD`, exactly as it answers
 * an ID that does not exist — so turning the scope off takes every public page
 * down without anyone being able to tell that is what happened.
 *
 * # ⚠ No existence oracle
 *
 * Every road out of `lookup` that is not a page someone turned on returns the
 * one frozen constant `NO_PUBLIC_RECORD`. The rate limiter runs BEFORE anything
 * is read, keyed on the IP alone, so it fires identically for every ID.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { createModuleLogger } from "../logging/logger";
import { checkRateLimit, getClientIp } from "../security/rateLimit";
import { waitPhrase } from "@shared/waitPhrase";
import { captureCastingCreationRecordEnabled } from "../castingV2/castingV2Scope";
import {
  CREATION_CHECK_ID_MAX_LENGTH,
  NO_PUBLIC_RECORD,
  normaliseCreationCheckId,
  projectPublicCreationCheck,
  type PublicCreationCheckAnswer,
} from "../castingV2/creationCheck";
import { ensureCastCreationRecord } from "../castingV2/creationRecordService";
import { getCastCreationRecord } from "../db/castCreationRecords";
import {
  readCreationCheckSwitch,
  readPublicCreationCheck,
  resolveOwnedSignedCast,
  setCreationCheckPublic,
} from "../db/castCreationCheck";

const log = createModuleLogger("routes/creationCheck");

/** A stranger checking IDs: generous for a person, useless for enumeration (80-bit IDs). */
export const CREATION_CHECK_LOOKUP_RATE = {
  windowMs: 10 * 60 * 1000,
  maxRequests: 30,
  keyPrefix: "creation_check_lookup",
} as const;

/** The owner's preview and toggle. A preview can make the record, which reads the master's bytes. */
export const CREATION_CHECK_OWNER_RATE = {
  windowMs: 10 * 60 * 1000,
  maxRequests: 30,
  keyPrefix: "creation_check_owner",
} as const;

const castIdInput = z.object({ castId: z.string().min(1).max(CREATION_CHECK_ID_MAX_LENGTH) }).strict();

function limit(identifier: string, config: typeof CREATION_CHECK_LOOKUP_RATE | typeof CREATION_CHECK_OWNER_RATE) {
  const verdict = checkRateLimit(identifier, config);
  if (!verdict.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many checks. Try again ${waitPhrase(verdict.resetIn)}.`,
    });
  }
}

/** The owner's signed, live cast behind `castId`, or the refusal the room shows. */
async function ownedCast(userId: number, castId: string) {
  if (!captureCastingCreationRecordEnabled(userId)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No such thing." });
  }
  const kliegId = normaliseCreationCheckId(castId);
  const cast = kliegId ? await resolveOwnedSignedCast(userId, kliegId) : null;
  if (!kliegId || !cast) {
    throw new TRPCError({ code: "NOT_FOUND", message: "This character couldn't be found." });
  }
  return { kliegId, ...cast };
}

/**
 * Make sure the cast has its record. A refusal here is a cast that is not
 * finished being made (a provisioning cast has no mint yet) — said in the
 * customer's words, never the road's.
 */
async function ensureRecord(userId: number, modelId: number): Promise<void> {
  const outcome = await ensureCastCreationRecord({}, { userId, modelId });
  if (outcome.kind === "recorded") return;
  if (outcome.kind === "dark") throw new TRPCError({ code: "NOT_FOUND", message: "No such thing." });
  log.info({ modelId, reason: outcome.reason }, "[creationCheck] no record could be made for this cast yet");
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "This character's record isn't ready yet. Try again once all of its views are finished.",
  });
}

export const creationCheckRouter = router({
  /**
   * PUBLIC — the check page's one read. See the header: rate limit first, one
   * statement, one constant for every ID with no page.
   */
  lookup: publicProcedure
    .input(z.object({ kliegId: z.string().min(1).max(CREATION_CHECK_ID_MAX_LENGTH) }).strict())
    .query(async ({ ctx, input }): Promise<PublicCreationCheckAnswer> => {
      limit(getClientIp(ctx.req), CREATION_CHECK_LOOKUP_RATE);
      const kliegId = normaliseCreationCheckId(input.kliegId);
      if (!kliegId) return NO_PUBLIC_RECORD;
      const row = await readPublicCreationCheck(kliegId);
      if (!row) return NO_PUBLIC_RECORD;
      /* The OWNER's scope, not the visitor's: a page is up only while its owner's road is. */
      if (!captureCastingCreationRecordEnabled(row.ownerId)) return NO_PUBLIC_RECORD;
      const projected = projectPublicCreationCheck(row);
      if (!projected) {
        log.warn({ kliegId }, "[creationCheck] a public record could not be read in full — answered as no record");
        return NO_PUBLIC_RECORD;
      }
      return { found: true, ...projected };
    }),

  /** The owner's switch. Makes nothing; a cast with no record yet is simply off. */
  status: protectedProcedure.input(castIdInput).query(async ({ ctx, input }) => {
    if (!captureCastingCreationRecordEnabled(ctx.user.id)) return { available: false as const, isPublic: false };
    const kliegId = normaliseCreationCheckId(input.castId);
    const cast = kliegId ? await resolveOwnedSignedCast(ctx.user.id, kliegId) : null;
    if (!cast) return { available: false as const, isPublic: false };
    const state = await readCreationCheckSwitch(ctx.user.id, cast.modelId);
    return { available: true as const, isPublic: Boolean(state?.publicAt) };
  }),

  /**
   * What a stranger WILL see — the same projector as `lookup`, over the owner's
   * own record, so the preview cannot show something the page does not.
   */
  preview: protectedProcedure.input(castIdInput).query(async ({ ctx, input }) => {
    limit(String(ctx.user.id), CREATION_CHECK_OWNER_RATE);
    const cast = await ownedCast(ctx.user.id, input.castId);
    await ensureRecord(ctx.user.id, cast.modelId);
    const record = await getCastCreationRecord(ctx.user.id, cast.modelId);
    const projected = record
      ? projectPublicCreationCheck({
        kliegId: cast.kliegId,
        recordJson: record.recordJson,
        stampedAt: record.stampedAt,
      })
      : null;
    if (!projected) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "This character's record isn't ready yet. Try again in a moment.",
      });
    }
    return projected;
  }),

  /** The toggle. On makes the record first if there is none; off just nulls `publicAt`. */
  setPublic: protectedProcedure
    .input(z.object({ castId: z.string().min(1).max(CREATION_CHECK_ID_MAX_LENGTH), public: z.boolean() }).strict())
    .mutation(async ({ ctx, input }) => {
      limit(String(ctx.user.id), CREATION_CHECK_OWNER_RATE);
      const cast = await ownedCast(ctx.user.id, input.castId);
      if (input.public) await ensureRecord(ctx.user.id, cast.modelId);
      const result = await setCreationCheckPublic({ userId: ctx.user.id, modelId: cast.modelId, on: input.public });
      if (!result.updated && input.public) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This character couldn't be found." });
      }
      return { isPublic: input.public };
    }),
});
