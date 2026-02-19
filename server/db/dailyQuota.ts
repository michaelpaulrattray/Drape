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

import { eq, and, gte, sql, count } from "drizzle-orm";
import { generations } from "../../drizzle/schema";
import { getDb } from "./connection";

const DAILY_LIMIT = parseInt(process.env.DAILY_GENERATION_LIMIT ?? "50", 10);

/** Image generation types that consume Gemini image RPD */
const IMAGE_GEN_TYPES = [
  "castingImage",
  "fullBody",
  "multiView",
  "iteration",
  "upscale",
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
    .select({ total: count() })
    .from(generations)
    .where(
      and(
        eq(generations.userId, userId),
        gte(generations.createdAt, todayStart),
        sql`${generations.type} IN ('castingImage', 'fullBody', 'multiView', 'iteration', 'upscale')`,
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

/** Get the configured daily limit (for stats/UI) */
export function getDailyLimit(): number {
  return DAILY_LIMIT;
}
