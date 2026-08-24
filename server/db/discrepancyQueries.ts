/**
 * Credit Discrepancy Flagging Queries — scans all users for
 * credit/generation mismatches above a configurable threshold.
 */

import { sql } from "drizzle-orm";
import {
  creditTransactions,
  generations,
  users,
} from "../../drizzle/schema";
import { getDb } from "./connection";

export interface FlaggedUserDiscrepancy {
  userId: number;
  userName: string | null;
  email: string | null;
  grossDeductions: number;
  totalRefunds: number;
  netCost: number;
  completedCost: number;
  pendingCost: number;
  discrepancy: number;
  totalGenerations: number;
  failedGenerations: number;
}

/** What the per-user aggregation of credit transactions yields. */
export interface DiscrepancyCreditAgg {
  userId: number;
  grossDeductions: number;
  totalRefunds: number;
}

/** What the per-user aggregation of generations yields. */
export interface DiscrepancyGenAgg {
  userId: number;
  completedCost: number;
  pendingCost: number;
  totalGenerations: number;
  failedGenerations: number;
}

export type FlaggedDiscrepancyData = Omit<
  FlaggedUserDiscrepancy,
  "userId" | "userName" | "email"
>;

/**
 * The discrepancy arithmetic itself — every user with |discrepancy| at or
 * above the threshold, and how many were scanned.
 *
 * Lifted out of `getUsersWithDiscrepancies` BYTE-PRESERVING (2026-08-25, 3g)
 * so the money arithmetic can be driven without a database.
 * `getUsersWithDiscrepancies` below is its first and production reader.
 *
 * ⚠ WHY: `server/discrepancyFlagging.test.ts` opened with the line
 * *"Mirror the core computation logic from discrepancyQueries.ts"* and then
 * re-typed 60 lines of it — the netCost subtraction, the `Math.max(0, …)` on
 * refunds, the `>=` threshold and the abs-descending sort — and every arm
 * tested the copy. The copy happened to be faithful when it was checked; that
 * is luck, not a property, and it is the arrangement in which the credit
 * discrepancy arithmetic could be changed here with the suite green.
 * Working law 4: derive, never mirror.
 */
export function computeFlaggedDiscrepancies(
  creditAgg: DiscrepancyCreditAgg[],
  genAgg: DiscrepancyGenAgg[],
  threshold: number,
): { flagged: Array<{ userId: number; data: FlaggedDiscrepancyData }>; scannedCount: number } {
  const creditMap = new Map(creditAgg.map((r) => [r.userId, r]));
  const genMap = new Map(genAgg.map((r) => [r.userId, r]));

  const allUserIds = Array.from(new Set([...Array.from(creditMap.keys()), ...Array.from(genMap.keys())]));

  const flagged: Array<{ userId: number; data: FlaggedDiscrepancyData }> = [];

  for (const uid of allUserIds) {
    const credit = creditMap.get(uid);
    const gen = genMap.get(uid);

    const grossDeductions = Number(credit?.grossDeductions ?? 0);
    const totalRefunds = Math.max(0, Number(credit?.totalRefunds ?? 0));
    const netCost = grossDeductions - totalRefunds;
    const completedCost = Number(gen?.completedCost ?? 0);
    const pendingCost = Number(gen?.pendingCost ?? 0);
    const discrepancy = netCost - completedCost - pendingCost;

    if (Math.abs(discrepancy) >= threshold) {
      flagged.push({
        userId: uid,
        data: {
          grossDeductions,
          totalRefunds,
          netCost,
          completedCost,
          pendingCost,
          discrepancy,
          totalGenerations: Number(gen?.totalGenerations ?? 0),
          failedGenerations: Number(gen?.failedGenerations ?? 0),
        },
      });
    }
  }

  return { flagged, scannedCount: allUserIds.length };
}

/**
 * Attach the user's name and email to each flagged row and order the report
 * by the size of the discrepancy, largest first. Lifted with the function
 * above and for the same reason.
 */
export function attachUserInfoToFlagged(
  flagged: Array<{ userId: number; data: FlaggedDiscrepancyData }>,
  userRows: Array<{ id: number; name: string | null; email: string | null }>,
): FlaggedUserDiscrepancy[] {
  const userMap = new Map(userRows.map((u) => [u.id, u]));

  return flagged
    .map((f) => {
      const u = userMap.get(f.userId);
      return {
        userId: f.userId,
        userName: u?.name ?? null,
        email: u?.email ?? null,
        ...f.data,
      };
    })
    .sort((a, b) => Math.abs(b.discrepancy) - Math.abs(a.discrepancy));
}

/**
 * Scan all users for credit discrepancies above a threshold.
 * Uses SQL aggregation for performance — no N+1 queries.
 *
 * Discrepancy = netCost - completedCost - pendingCost
 * where netCost = grossGenerationDeductions - refunds
 */
export async function getUsersWithDiscrepancies(
  threshold: number = 50
): Promise<{ users: FlaggedUserDiscrepancy[]; scannedCount: number }> {
  const db = await getDb();
  if (!db) return { users: [], scannedCount: 0 };

  // Step 1: Aggregate credit transactions per user (generation deductions + refunds)
  const creditAgg = await db
    .select({
      userId: creditTransactions.userId,
      grossDeductions: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.type} = 'generation' THEN ABS(${creditTransactions.amount}) ELSE 0 END), 0)`.as("grossDeductions"),
      totalRefunds: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.type} = 'refund' THEN ${creditTransactions.amount} ELSE 0 END), 0)`.as("totalRefunds"),
    })
    .from(creditTransactions)
    .groupBy(creditTransactions.userId);

  // Step 2: Aggregate generation costs per user by status
  const genAgg = await db
    .select({
      userId: generations.userId,
      completedCost: sql<number>`COALESCE(SUM(CASE WHEN ${generations.status} = 'completed' THEN ${generations.pointsCost} ELSE 0 END), 0)`.as("completedCost"),
      pendingCost: sql<number>`COALESCE(SUM(CASE WHEN ${generations.status} IN ('pending', 'processing') THEN ${generations.pointsCost} ELSE 0 END), 0)`.as("pendingCost"),
      totalGenerations: sql<number>`COUNT(*)`.as("totalGenerations"),
      failedGenerations: sql<number>`COALESCE(SUM(CASE WHEN ${generations.status} = 'failed' THEN 1 ELSE 0 END), 0)`.as("failedGenerations"),
    })
    .from(generations)
    .groupBy(generations.userId);

  // Steps 3-5: lookup maps, the union of user ids, and the threshold filter.
  const { flagged, scannedCount } = computeFlaggedDiscrepancies(creditAgg, genAgg, threshold);

  // Step 6: Fetch user info for flagged users
  if (flagged.length === 0) {
    return { users: [], scannedCount };
  }

  const flaggedIds = flagged.map((f) => f.userId);
  const userRows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(sql`${users.id} IN (${sql.join(flaggedIds.map((id) => sql`${id}`), sql`, `)})`);

  return { users: attachUserInfoToFlagged(flagged, userRows), scannedCount };
}
