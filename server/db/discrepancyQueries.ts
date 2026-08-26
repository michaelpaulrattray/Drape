/**
 * Credit Discrepancy Flagging Queries — scans all users for
 * credit/record mismatches above a configurable threshold.
 *
 * ⚠ THE ARITHMETIC WAS RE-READ AT THE PRODUCTION ROWS ON 2026-08-26 (#119)
 * AFTER IT FROZE THE FOUNDER'S OWN ACCOUNT FOR 22 HOURS. The old formula was
 *
 *     (gross generation deductions − refunds) − completed − pending
 *
 * over the LEGACY `generations` table alone, and it rested on two premises
 * the product had since overturned on purpose:
 *
 *   1. "Every failed generation is refunded." Not since the founder's
 *      catastrophic-only refund ruling (`5c5a1f3f`): a failed row's cost is
 *      the RULED outcome, not a discrepancy. On production that was 10,730
 *      credits of failed rows against 9,750 refunded overall.
 *   2. "Every charge has a `generations` row." Not since Casting V2: a
 *      refine charges through `generation_operations` and writes no
 *      `generations` row at all (221 refines, 5,525 credits, on one account).
 *
 * Together they read 7,505 on a ledger whose 754 transactions net EXACTLY to
 * the balance — the number the freeze quoted, to the credit.
 *
 * THE RULE NOW: a charge is explained by the record that recorded it.
 *
 *   expected = Σ pointsCost of `generations` rows with NO operation
 *            + Σ over `generation_operations` of
 *                 chargedCredits            when the operation recorded a charge
 *                 Σ its linked rows' cost   when it recorded none
 *   discrepancy = gross generation deductions − expected
 *
 * Why the operation's own charge is authoritative where it exists: a Sign
 * charges 450 through its operation and writes five audit rows at 50 each,
 * so a rows-only formula climbs 200 per Sign for ever — #119's own defect
 * class, a premise that drifts with ordinary use (measured before this was
 * chosen: rows-only read 150 on the founder's account, operation-authoritative
 * 5,160, this hybrid 1,050). Why rows still count where the operation
 * recorded nothing: the parked July evidence family (#6) charged under
 * legacy references and left its operations at `chargedCredits: 0`.
 *
 * What the 1,050 residual on the founder's account IS, named rather than
 * hidden: five `evidence_package_sync` operations from 2026-07-29 that
 * charged 300 each and wrote two 300 audit rows apiece — the parked evidence
 * composer's data, one account, no live road. Every other production account
 * reads 0 under this formula.
 *
 * Refunds are no longer part of the discrepancy. They are written only by
 * the product or by staff (a failure refund, a per-slice refund, an admin
 * correction) and a correction of DELIVERED work is legitimately unbounded by
 * anything a record holds — so a refund-side bound was a false-positive
 * generator, never a control. They are still reported, and the unrefunded
 * failure cost is shown for what it is.
 *
 * ⚠ AND THE SCAN NO LONGER FREEZES ANYONE. Founder ruling 2026-08-26 (Crew
 * reply #5, verbatim): "List-only. A control that can freeze a paying
 * customer should have a person's name on it." `getFlaggedUsers` is a READ.
 * A freeze happens through `freezeAccount` with the moderator's id on it.
 */

import { and, gte, lte, sql } from "drizzle-orm";
import {
  creditTransactions,
  generationOperations,
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
  failedCost: number;
  /** Cost recorded by `generations` rows that belong to no operation. */
  unlinkedCost: number;
  /** Cost recorded by operations (their own charge, or their rows where they recorded none). */
  operationCost: number;
  /** `unlinkedCost + operationCost` — what the records say was charged. */
  expectedCost: number;
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

/** What the per-user aggregation of `generations` rows yields. */
export interface DiscrepancyGenAgg {
  userId: number;
  completedCost: number;
  pendingCost: number;
  failedCost: number;
  unlinkedCost: number;
  totalGenerations: number;
  failedGenerations: number;
}

/** What the per-user aggregation of `generation_operations` yields. */
export interface DiscrepancyOperationAgg {
  userId: number;
  operationCost: number;
}

export type FlaggedDiscrepancyData = Omit<
  FlaggedUserDiscrepancy,
  "userId" | "userName" | "email"
>;

/** The inputs of the rule, for one user (or one user inside a date range). */
export interface DiscrepancyInputs {
  grossDeductions: number;
  totalRefunds: number;
  completedCost: number;
  pendingCost: number;
  failedCost: number;
  unlinkedCost: number;
  operationCost: number;
}

export interface DiscrepancyReading {
  grossDeductions: number;
  totalRefunds: number;
  netCost: number;
  completedCost: number;
  pendingCost: number;
  failedCost: number;
  unlinkedCost: number;
  operationCost: number;
  expectedCost: number;
  discrepancy: number;
  /** Failed-row cost not covered by refunds — the ruled outcome, shown, never flagged. */
  unrefundedFailureCost: number;
}

/**
 * THE RULE. One function, two readers: the all-users scan and the per-user
 * reconciliation page both derive from it (working law 4 — the route used
 * to re-type the arithmetic, and so did its test).
 */
export function computeDiscrepancy(input: DiscrepancyInputs): DiscrepancyReading {
  const grossDeductions = Number(input.grossDeductions ?? 0);
  const totalRefunds = Math.max(0, Number(input.totalRefunds ?? 0));
  const completedCost = Number(input.completedCost ?? 0);
  const pendingCost = Number(input.pendingCost ?? 0);
  const failedCost = Number(input.failedCost ?? 0);
  const unlinkedCost = Number(input.unlinkedCost ?? 0);
  const operationCost = Number(input.operationCost ?? 0);
  const expectedCost = unlinkedCost + operationCost;
  return {
    grossDeductions,
    totalRefunds,
    netCost: grossDeductions - totalRefunds,
    completedCost,
    pendingCost,
    failedCost,
    unlinkedCost,
    operationCost,
    expectedCost,
    discrepancy: grossDeductions - expectedCost,
    unrefundedFailureCost: Math.max(0, failedCost - totalRefunds),
  };
}

/**
 * Every user with |discrepancy| at or above the threshold, and how many were
 * scanned. Pure: the three aggregations come in, the flagged rows go out, so
 * the money arithmetic is driven without a database.
 */
export function computeFlaggedDiscrepancies(
  creditAgg: DiscrepancyCreditAgg[],
  genAgg: DiscrepancyGenAgg[],
  operationAgg: DiscrepancyOperationAgg[],
  threshold: number,
): { flagged: Array<{ userId: number; data: FlaggedDiscrepancyData }>; scannedCount: number } {
  const creditMap = new Map(creditAgg.map((r) => [r.userId, r]));
  const genMap = new Map(genAgg.map((r) => [r.userId, r]));
  const opMap = new Map(operationAgg.map((r) => [r.userId, r]));

  const allUserIds = Array.from(
    new Set([
      ...Array.from(creditMap.keys()),
      ...Array.from(genMap.keys()),
      ...Array.from(opMap.keys()),
    ]),
  );

  const flagged: Array<{ userId: number; data: FlaggedDiscrepancyData }> = [];

  for (const uid of allUserIds) {
    const credit = creditMap.get(uid);
    const gen = genMap.get(uid);
    const op = opMap.get(uid);

    const reading = computeDiscrepancy({
      grossDeductions: credit?.grossDeductions ?? 0,
      totalRefunds: credit?.totalRefunds ?? 0,
      completedCost: gen?.completedCost ?? 0,
      pendingCost: gen?.pendingCost ?? 0,
      failedCost: gen?.failedCost ?? 0,
      unlinkedCost: gen?.unlinkedCost ?? 0,
      operationCost: op?.operationCost ?? 0,
    });

    if (Math.abs(reading.discrepancy) >= threshold) {
      flagged.push({
        userId: uid,
        data: {
          grossDeductions: reading.grossDeductions,
          totalRefunds: reading.totalRefunds,
          netCost: reading.netCost,
          completedCost: reading.completedCost,
          pendingCost: reading.pendingCost,
          failedCost: reading.failedCost,
          unlinkedCost: reading.unlinkedCost,
          operationCost: reading.operationCost,
          expectedCost: reading.expectedCost,
          discrepancy: reading.discrepancy,
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
 * by the size of the discrepancy, largest first.
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
 * The operation-side cost expression: the operation's own charge where it
 * recorded one, the summed cost of its linked `generations` rows where it
 * recorded none (a correlated aggregate over the rows that name this
 * operation).
 *
 * ⚠ THE CORRELATION IS WRITTEN WITH EXPLICIT QUALIFIERS ON PURPOSE. Drizzle
 * renders a column of a single-table select UNQUALIFIED, so the first
 * version — `${generations.operationId} = ${generationOperations.id}` —
 * became `WHERE operationId = id`, and inside the subquery BOTH names bound
 * to `generations` (which has its own `id`): never true, fallback always 0,
 * and the scan read 5,160 on production where the raw SQL read 1,050. Caught
 * by driving the module against the real database before it was believed
 * (working law 2); `server/discrepancyOperationCostSql.test.ts` pins the
 * generated text so the qualifier cannot quietly drop out again.
 */
export const OPERATION_COST_SQL = sql<number>`COALESCE(SUM(CASE WHEN ${generationOperations.chargedCredits} > 0 THEN ${generationOperations.chargedCredits} ELSE COALESCE((SELECT SUM(linked.pointsCost) FROM ${generations} AS linked WHERE linked.operationId = ${generationOperations}.id), 0) END), 0)`;

/**
 * Scan all users for credit discrepancies above a threshold.
 * Uses SQL aggregation for performance — no N+1 queries. A READ: it writes
 * nothing and freezes nobody (see the header).
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

  // Step 2: Aggregate `generations` rows per user by status, and the cost of the rows no operation owns
  const genAgg = await db
    .select({
      userId: generations.userId,
      completedCost: sql<number>`COALESCE(SUM(CASE WHEN ${generations.status} = 'completed' THEN ${generations.pointsCost} ELSE 0 END), 0)`.as("completedCost"),
      pendingCost: sql<number>`COALESCE(SUM(CASE WHEN ${generations.status} IN ('pending', 'processing') THEN ${generations.pointsCost} ELSE 0 END), 0)`.as("pendingCost"),
      failedCost: sql<number>`COALESCE(SUM(CASE WHEN ${generations.status} = 'failed' THEN ${generations.pointsCost} ELSE 0 END), 0)`.as("failedCost"),
      unlinkedCost: sql<number>`COALESCE(SUM(CASE WHEN ${generations.operationId} IS NULL THEN ${generations.pointsCost} ELSE 0 END), 0)`.as("unlinkedCost"),
      totalGenerations: sql<number>`COUNT(*)`.as("totalGenerations"),
      failedGenerations: sql<number>`COALESCE(SUM(CASE WHEN ${generations.status} = 'failed' THEN 1 ELSE 0 END), 0)`.as("failedGenerations"),
    })
    .from(generations)
    .groupBy(generations.userId);

  // Step 3: Aggregate operation-recorded cost per user
  const operationAgg = await db
    .select({
      userId: generationOperations.userId,
      operationCost: OPERATION_COST_SQL.as("operationCost"),
    })
    .from(generationOperations)
    .groupBy(generationOperations.userId);

  // Steps 4-6: lookup maps, the union of user ids, and the threshold filter.
  const { flagged, scannedCount } = computeFlaggedDiscrepancies(creditAgg, genAgg, operationAgg, threshold);

  // Step 7: Fetch user info for flagged users
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

/**
 * The record side of the rule for ONE user, optionally inside a date range —
 * the same two expressions the scan aggregates, scoped by `userId` in the
 * WHERE. The per-user reconciliation page reads this so its number is the
 * scan's number for the same user.
 */
export async function getUserRecordCosts(
  userId: number,
  range: { startDate?: Date; endDate?: Date } = {},
): Promise<{ unlinkedCost: number; operationCost: number }> {
  const db = await getDb();
  if (!db) return { unlinkedCost: 0, operationCost: 0 };

  const genConditions = [sql`${generations.userId} = ${userId}`, sql`${generations.operationId} IS NULL`];
  if (range.startDate) genConditions.push(gte(generations.createdAt, range.startDate));
  if (range.endDate) genConditions.push(lte(generations.createdAt, range.endDate));

  const [genRow] = await db
    .select({
      unlinkedCost: sql<number>`COALESCE(SUM(${generations.pointsCost}), 0)`.as("unlinkedCost"),
    })
    .from(generations)
    .where(and(...genConditions));

  const opConditions = [sql`${generationOperations.userId} = ${userId}`];
  if (range.startDate) opConditions.push(gte(generationOperations.createdAt, range.startDate));
  if (range.endDate) opConditions.push(lte(generationOperations.createdAt, range.endDate));

  const [opRow] = await db
    .select({ operationCost: OPERATION_COST_SQL.as("operationCost") })
    .from(generationOperations)
    .where(and(...opConditions));

  return {
    unlinkedCost: Number(genRow?.unlinkedCost ?? 0),
    operationCost: Number(opRow?.operationCost ?? 0),
  };
}
