/**
 * Daily Quota — Tracks and enforces per-user daily generation limits.
 *
 * Uses the existing `generations` table to count today's successful
 * image generations (castingImage, fullBody, multiView, iteration, upscale).
 * No new tables needed — just a query + env-configurable limit.
 *
 * The daily limit is shared across all generation types because the
 * bottleneck is the Gemini API RPD (requests per day), not per-type.
 *
 * Limit is configurable via DAILY_GENERATION_LIMIT env var (default: 50).
 */

import { eq, and, gte, sql } from "drizzle-orm";
import { generationOperations, generations } from "../../drizzle/schema";
import { EVIDENCE_CANDIDATE_GENERATION_TYPE } from "../casting/evidence/evidenceCandidateContract";
import { getDb } from "./connection";
import { envInt } from "../_core/env";

/*
 * ⚠ THIS WAS `parseInt(process.env.DAILY_GENERATION_LIMIT ?? "50", 10)`.
 * `??` does not catch the EMPTY STRING, which is what a Railway variable
 * created with no value holds — so a blank variable made this NaN, `used <
 * NaN` is false, and the quota refused EVERY generation at zero used, at six
 * call sites, telling the customer "Daily generation limit reached (NaN per
 * day)". An outage wearing a quota message. `envInt` refuses at boot by name
 * instead; see NUMERIC_ENV_VARS.
 */
const DAILY_LIMIT = envInt("DAILY_GENERATION_LIMIT");

/**
 * Image generation types that consume Gemini image RPD.
 *
 * ⚠ THIS LIST HAD A SECOND COPY, RE-TYPED INSIDE THE `IN (...)` OF THE QUERY
 * BELOW, AND THE SQL IS DERIVED FROM IT NOW (#638's law-7 sweep, found by the
 * PR #690 review). Two lists of the same thing drift, and this pair drifts in
 * the direction that silently stops counting: a type added here and not there
 * consumes no quota, with nothing red anywhere.
 *
 * The evidence member comes from the family's own constant for the same
 * reason — a raw-SQL string literal is the one spelling TypeScript cannot hold
 * to the enum, so a rename would leave this reader matching nothing.
 */
const IMAGE_GEN_TYPES = [
  "castingImage",
  "fullBody",
  "multiView",
  "iteration",
  "upscale",
  "wardrobeVTO",
  "wardrobeComposite",
  "wardrobeRefinement",
  "wardrobeDigitize",
  EVIDENCE_CANDIDATE_GENERATION_TYPE,
] as const;

/**
 * Get the number of image generations a user has made today (UTC).
 * Only counts completed + pending + processing (not failed, since those are refunded).
 */
export async function getUserDailyGenerationCount(
  userId: number,
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const result = await db
    .select({
      total: sql<number>`COUNT(DISTINCT CASE
        WHEN ${generationOperations.kind} = 'evidence_fork_copy'
          THEN NULL
        WHEN ${generations.type} = ${EVIDENCE_CANDIDATE_GENERATION_TYPE}
          THEN CONCAT('operation:', ${generations.operationId})
        ELSE CONCAT('generation:', ${generations.id})
      END)`,
    })
    .from(generations)
    .leftJoin(
      generationOperations,
      eq(generationOperations.id, generations.operationId),
    )
    .where(
      and(
        eq(generations.userId, userId),
        gte(generations.createdAt, todayStart),
        sql`${generations.type} IN (${sql.join(IMAGE_GEN_TYPES.map((type) => sql`${type}`), sql`, `)})`,
        sql`${generations.status} != 'failed'`,
      ),
    );

  return result[0]?.total ?? 0;
}

/**
 * Check if a user can generate today. Returns remaining quota info.
 */
export async function checkDailyQuota(userId: number): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}> {
  const used = await getUserDailyGenerationCount(userId);
  const remaining = Math.max(0, DAILY_LIMIT - used);

  return {
    allowed: used < DAILY_LIMIT,
    used,
    limit: DAILY_LIMIT,
    remaining,
  };
}

/**
 * Enforce daily quota — throws TRPCError if exceeded.
 * Call this BEFORE withAtomicCredits in generation routes.
 */
export async function enforceDailyQuota(userId: number): Promise<void> {
  const quota = await checkDailyQuota(userId);

  if (!quota.allowed) {
    const { TRPCError } = await import("@trpc/server");
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Daily generation limit reached (${quota.limit} per day). Your quota resets at midnight UTC. You've used ${quota.used} generations today.`,
    });
  }
}

