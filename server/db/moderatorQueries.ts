/**
 * Moderator Read-Only Queries — detailed credit/generation history, and the
 * same-IP referral flag.
 *
 * It also held the two credit-purchase velocity helpers until 2026-08-19, when
 * they were deleted by founder default: they had counted a user's recent
 * top-ups for months with no call site in the checkout path, and a control that
 * nothing invokes is indistinguishable from a control that was never written.
 * If a purchase cap is wanted it wants a product design first — how fast is too
 * fast for a paying customer, and what happens when they hit it — not a
 * re-wiring of these two queries.
 */

import {
  eq,
  desc,
  and,
  gte,
  lte,
  sql,
  inArray,
} from "drizzle-orm";
import {
  creditTransactions,
  generations,
  models,
} from "../../drizzle/schema";
import { getDb } from "./connection";
import { createModuleLogger } from "../logging/logger";
import { projectEvidenceCandidateForModerator } from "../casting/evidence/moderatorEvidenceProjection";
const log = createModuleLogger("db/moderatorQueries");

// ============================================================================
// MODERATOR READ-ONLY QUERY FUNCTIONS
// ============================================================================

/**
 * Get detailed credit transaction history for a user (moderator read-only).
 * Includes filtering by transaction type and date range.
 */
export async function getDetailedCreditHistory(
  userId: number,
  options: {
    limit?: number;
    offset?: number;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{
  transactions: Array<{
    id: number;
    amount: number;
    type: string;
    description: string | null;
    referenceId: string | null;
    balanceAfter: number;
    engineUsed: string | null;
    createdAt: Date;
  }>;
  total: number;
  summary: {
    totalCreditsEarned: number;
    totalCreditsSpent: number;
    netChange: number;
    transactionsByType: Record<
      string,
      { count: number; totalAmount: number }
    >;
  };
}> {
  const db = await getDb();
  if (!db) {
    return {
      transactions: [],
      total: 0,
      summary: {
        totalCreditsEarned: 0,
        totalCreditsSpent: 0,
        netChange: 0,
        transactionsByType: {},
      },
    };
  }

  const { limit = 50, offset = 0, type, startDate, endDate } = options;

  try {
    const conditions = [eq(creditTransactions.userId, userId)];
    if (type) {
      conditions.push(eq(creditTransactions.type, type as any));
    }
    if (startDate) {
      conditions.push(gte(creditTransactions.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(creditTransactions.createdAt, endDate));
    }

    const whereClause = and(...conditions);

    const txns = await db
      .select({
        id: creditTransactions.id,
        amount: creditTransactions.amount,
        type: creditTransactions.type,
        description: creditTransactions.description,
        referenceId: creditTransactions.referenceId,
        balanceAfter: creditTransactions.balanceAfter,
        engineUsed: creditTransactions.engineUsed,
        createdAt: creditTransactions.createdAt,
      })
      .from(creditTransactions)
      .where(whereClause)
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(creditTransactions)
      .where(whereClause);

    const total = countResult?.count || 0;

    const allTxns = await db
      .select({
        amount: creditTransactions.amount,
        type: creditTransactions.type,
      })
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId));

    let totalCreditsEarned = 0;
    let totalCreditsSpent = 0;
    const transactionsByType: Record<
      string,
      { count: number; totalAmount: number }
    > = {};

    for (const txn of allTxns) {
      if (txn.amount > 0) {
        totalCreditsEarned += txn.amount;
      } else {
        totalCreditsSpent += Math.abs(txn.amount);
      }

      if (!transactionsByType[txn.type]) {
        transactionsByType[txn.type] = { count: 0, totalAmount: 0 };
      }
      transactionsByType[txn.type].count++;
      transactionsByType[txn.type].totalAmount += txn.amount;
    }

    return {
      transactions: txns,
      total,
      summary: {
        totalCreditsEarned,
        totalCreditsSpent,
        netChange: totalCreditsEarned - totalCreditsSpent,
        transactionsByType,
      },
    };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to get detailed credit history");
    return {
      transactions: [],
      total: 0,
      summary: {
        totalCreditsEarned: 0,
        totalCreditsSpent: 0,
        netChange: 0,
        transactionsByType: {},
      },
    };
  }
}

/**
 * Get detailed generation history for a user (moderator read-only).
 * Includes filtering by status, type, and date range.
 */
export async function getDetailedGenerationHistory(
  userId: number,
  options: {
    limit?: number;
    offset?: number;
    status?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{
  /**
   * Metadata only — the staff image boundary (CLAUDE.md "Metadata only is a
   * boundary, not a convenience").
   *
   * Staff may see *that* a generation happened — kind, timestamp, credit cost,
   * status — for support, billing and abuse work. They may not have the
   * creative content. This projection therefore carries `hasResult` instead of
   * `resultUrl`: support can still tell a produced image from a failed one,
   * which is the actual investigative need, without handing over a permanent
   * public URL to a customer's work.
   *
   * The URL is not merely omitted after selection: it is never selected, so
   * there is no path by which a future edit reintroduces it accidentally
   * (access-control law 8 — by construction, not by remembering).
   *
   * `metadata` stays: `projectEvidenceCandidateForModerator` reduces it to the
   * operational facts support actually uses (candidate id, attempt number,
   * billing role, engine, recipe version) for evidence candidates, and the
   * prompt half of the boundary is not implicated — see CLAUDE.md.
   */
  generations: Array<{
    id: number;
    modelId: number | null;
    type: string;
    status: string;
    pointsCost: number;
    hasResult: boolean;
    errorMessage: string | null;
    metadata: unknown;
    createdAt: Date;
    completedAt: Date | null;
    modelName: string | null;
  }>;
  total: number;
  summary: {
    totalGenerations: number;
    completedCount: number;
    failedCount: number;
    pendingCount: number;
    totalCreditsUsed: number;
    generationsByType: Record<string, { count: number; totalCost: number }>;
    failureRate: number;
  };
}> {
  const db = await getDb();
  if (!db) {
    return {
      generations: [],
      total: 0,
      summary: {
        totalGenerations: 0,
        completedCount: 0,
        failedCount: 0,
        pendingCount: 0,
        totalCreditsUsed: 0,
        generationsByType: {},
        failureRate: 0,
      },
    };
  }

  const { limit = 50, offset = 0, status, type, startDate, endDate } =
    options;

  try {
    const conditions = [eq(generations.userId, userId)];
    if (status) {
      conditions.push(eq(generations.status, status as any));
    }
    if (type) {
      conditions.push(eq(generations.type, type as any));
    }
    if (startDate) {
      conditions.push(gte(generations.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(generations.createdAt, endDate));
    }

    const whereClause = and(...conditions);

    const gens = await db
      .select({
        id: generations.id,
        modelId: generations.modelId,
        type: generations.type,
        status: generations.status,
        pointsCost: generations.pointsCost,
        // Presence, never the URL itself — see the projection note above.
        hasResult: sql<number>`${generations.resultUrl} IS NOT NULL`,
        errorMessage: generations.errorMessage,
        metadata: generations.metadata,
        createdAt: generations.createdAt,
        completedAt: generations.completedAt,
        modelName: models.name,
      })
      .from(generations)
      .leftJoin(models, eq(generations.modelId, models.id))
      .where(whereClause)
      .orderBy(desc(generations.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(generations)
      .where(whereClause);

    const total = countResult?.count || 0;

    const allGens = await db
      .select({
        status: generations.status,
        type: generations.type,
        pointsCost: generations.pointsCost,
      })
      .from(generations)
      .where(eq(generations.userId, userId));

    let completedCount = 0;
    let failedCount = 0;
    let pendingCount = 0;
    let totalCreditsUsed = 0;
    const generationsByType: Record<
      string,
      { count: number; totalCost: number }
    > = {};

    for (const gen of allGens) {
      if (gen.status === "completed") completedCount++;
      else if (gen.status === "failed") failedCount++;
      else pendingCount++;

      totalCreditsUsed += gen.pointsCost;

      if (!generationsByType[gen.type]) {
        generationsByType[gen.type] = { count: 0, totalCost: 0 };
      }
      generationsByType[gen.type].count++;
      generationsByType[gen.type].totalCost += gen.pointsCost;
    }

    const totalGenerations = allGens.length;
    const failureRate =
      totalGenerations > 0
        ? (failedCount / totalGenerations) * 100
        : 0;

    return {
      generations: gens
        .map(projectEvidenceCandidateForModerator)
        // MySQL returns the boolean expression as 0/1.
        .map((gen) => ({ ...gen, hasResult: Boolean(gen.hasResult) })),
      total,
      summary: {
        totalGenerations,
        completedCount,
        failedCount,
        pendingCount,
        totalCreditsUsed,
        generationsByType,
        failureRate: Math.round(failureRate * 100) / 100,
      },
    };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to get detailed generation history");
    return {
      generations: [],
      total: 0,
      summary: {
        totalGenerations: 0,
        completedCount: 0,
        failedCount: 0,
        pendingCount: 0,
        totalCreditsUsed: 0,
        generationsByType: {},
        failureRate: 0,
      },
    };
  }
}

// ============================================================================
// FLAGGED REFERRALS (same-IP fraud detection)
// ============================================================================

import { referrals, users } from "../../drizzle/schema";

/**
 * How many user ids one `IN (…)` read of the flagged-referrals page carries.
 * It bounds the length of one list and nothing else — the chunks run one
 * after another, so the page holds at most one pool slot for this read.
 */
export const FLAGGED_REFERRAL_USER_CHUNK = 500;

/**
 * Get referrals flagged with sameIpFlag = true for moderator review.
 * Joins user info for both referrer and referee.
 */
export async function getFlaggedReferrals(
  limit: number = 50,
  offset: number = 0
): Promise<{
  items: Array<{
    id: number;
    referrerUserId: number;
    referrerName: string | null;
    referrerEmail: string | null;
    referredUserId: number | null;
    referredName: string | null;
    referredEmail: string | null;
    referrerIp: string | null;
    referredIp: string | null;
    status: string;
    creditsAwarded: number;
    referrerCredited: boolean;
    referredCredited: boolean;
    createdAt: Date;
    completedAt: Date | null;
  }>;
  total: number;
}> {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const flaggedRows = await db
    .select({
      id: referrals.id,
      referrerUserId: referrals.referrerUserId,
      referredUserId: referrals.referredUserId,
      referredEmail: referrals.referredEmail,
      referrerIp: referrals.referrerIp,
      referredIp: referrals.referredIp,
      status: referrals.status,
      creditsAwarded: referrals.creditsAwarded,
      referrerCredited: referrals.referrerCredited,
      referredCredited: referrals.referredCredited,
      createdAt: referrals.createdAt,
      completedAt: referrals.completedAt,
    })
    .from(referrals)
    .where(eq(referrals.sameIpFlag, true))
    .orderBy(desc(referrals.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(referrals)
    .where(eq(referrals.sameIpFlag, true));
  const total = Number(countResult[0]?.count ?? 0);

  // Enrich with user names/emails — ONE read of every user the page names,
  // never one read per row fired all at once (#2000). The old fan-out held a
  // pool slot per row, and a full page (`limit` up to 100) was 100 concurrent
  // queries onto the shared pool's 20 + 50: past the ceiling, so the page
  // could fail with `Queue limit reached.`. The ids are read in sequential
  // chunks of FLAGGED_REFERRAL_USER_CHUNK, so even a caller passing a larger
  // `limit` than the procedure allows holds one slot at a time. Only `name`
  // and `email` are projected (invariant 8).
  const userIds = Array.from(
    new Set(
      flaggedRows.flatMap((row) =>
        row.referredUserId ? [row.referrerUserId, row.referredUserId] : [row.referrerUserId],
      ),
    ),
  );
  const people = new Map<number, { name: string | null; email: string | null }>();
  for (let at = 0; at < userIds.length; at += FLAGGED_REFERRAL_USER_CHUNK) {
    const chunk = userIds.slice(at, at + FLAGGED_REFERRAL_USER_CHUNK);
    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, chunk));
    for (const row of rows) people.set(row.id, { name: row.name, email: row.email });
  }

  const enriched = flaggedRows.map((row) => {
    const referrer = people.get(row.referrerUserId);
    const referred = row.referredUserId ? people.get(row.referredUserId) : undefined;
    return {
      ...row,
      referrerName: referrer?.name ?? null,
      referrerEmail: referrer?.email ?? null,
      referredName: referred?.name ?? null,
      referredEmail: row.referredEmail,
    };
  });

  return { items: enriched, total };
}


// Re-export discrepancy queries from dedicated module
export { getUsersWithDiscrepancies } from "./discrepancyQueries";
