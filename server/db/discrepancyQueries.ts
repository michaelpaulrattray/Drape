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

  // Step 3: Build lookup maps
  const creditMap = new Map(creditAgg.map((r) => [r.userId, r]));
  const genMap = new Map(genAgg.map((r) => [r.userId, r]));

  // Step 4: Collect all user IDs that have either credit txns or generations
  const allUserIds = Array.from(new Set([...Array.from(creditMap.keys()), ...Array.from(genMap.keys())]));

  // Step 5: Compute discrepancies and filter by threshold
  const flagged: Array<{ userId: number; data: Omit<FlaggedUserDiscrepancy, "userId" | "userName" | "email"> }> = [];

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

  // Step 6: Fetch user info for flagged users
  if (flagged.length === 0) {
    return { users: [], scannedCount: allUserIds.length };
  }

  const flaggedIds = flagged.map((f) => f.userId);
  const userRows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(sql`${users.id} IN (${sql.join(flaggedIds.map((id) => sql`${id}`), sql`, `)})`);

  const userMap = new Map(userRows.map((u) => [u.id, u]));

  const result: FlaggedUserDiscrepancy[] = flagged
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

  return { users: result, scannedCount: allUserIds.length };
}
