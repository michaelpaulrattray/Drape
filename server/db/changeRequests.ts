/**
 * Change Requests Domain — CRUD for moderator-submitted change requests.
 */

import { eq, and, asc, desc, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  changeRequests,
  ChangeRequest,
  InsertChangeRequest,
} from "../../drizzle/schema";
import { getDb } from "./connection";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("db/changeRequests");

/**
 * Create a new change request submitted by a moderator.
 */
export async function createChangeRequest(
  data: Omit<InsertChangeRequest, "id" | "status" | "createdAt" | "updatedAt">
): Promise<{ success: boolean; requestId?: number; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    const [result] = await db.insert(changeRequests).values({
      ...data,
      status: "pending",
    });
    return { success: true, requestId: result.insertId };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to create change request:");
    return { success: false, error: String(error) };
  }
}

/**
 * Get a single change request by ID.
 */
export async function getChangeRequestById(
  id: number
): Promise<ChangeRequest | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const [row] = await db
      .select()
      .from(changeRequests)
      .where(eq(changeRequests.id, id))
      .limit(1);
    return row || null;
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to get change request:");
    return null;
  }
}

/**
 * List change requests with filtering and pagination.
 * Used by admins to review pending requests and by moderators to view their own.
 */
export async function listChangeRequests(
  options: {
    status?:
      | "pending"
      | "approved"
      | "denied"
      | "cancelled"
      | "expired"
      | "pending_execution";
    type?: string;
    submittedById?: number;
    targetUserId?: number;
    priority?: string;
    limit?: number;
    offset?: number;
    sortBy?: "createdAt" | "priority" | "updatedAt";
    sortOrder?: "asc" | "desc";
  } = {}
): Promise<{
  requests: ChangeRequest[];
  total: number;
  summary: {
    pendingCount: number;
    approvedCount: number;
    deniedCount: number;
    cancelledCount: number;
    expiredCount: number;
    pendingExecutionCount: number;
    totalCount: number;
  };
}> {
  const db = await getDb();
  if (!db) {
    return {
      requests: [],
      total: 0,
      summary: {
        pendingCount: 0,
        approvedCount: 0,
        deniedCount: 0,
        cancelledCount: 0,
        expiredCount: 0,
        pendingExecutionCount: 0,
        totalCount: 0,
      },
    };
  }

  const {
    status,
    type,
    submittedById,
    targetUserId,
    priority,
    limit = 50,
    offset = 0,
    sortOrder = "desc",
  } = options;

  try {
    const conditions: SQL[] = [];
    if (status) conditions.push(eq(changeRequests.status, status));
    if (type) conditions.push(eq(changeRequests.type, type as any));
    if (submittedById)
      conditions.push(eq(changeRequests.submittedById, submittedById));
    if (targetUserId)
      conditions.push(eq(changeRequests.targetUserId, targetUserId));
    if (priority)
      conditions.push(eq(changeRequests.priority, priority as any));

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const orderFn = sortOrder === "asc" ? asc : desc;
    const requests = await db
      .select()
      .from(changeRequests)
      .where(whereClause)
      .orderBy(orderFn(changeRequests.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(changeRequests)
      .where(whereClause);
    const total = countResult?.count || 0;

    const summaryConditions: SQL[] = [];
    if (submittedById)
      summaryConditions.push(
        eq(changeRequests.submittedById, submittedById)
      );
    if (targetUserId)
      summaryConditions.push(eq(changeRequests.targetUserId, targetUserId));
    const summaryWhere =
      summaryConditions.length > 0
        ? and(...summaryConditions)
        : undefined;

    const summaryRows = await db
      .select({
        status: changeRequests.status,
        count: sql<number>`count(*)`,
      })
      .from(changeRequests)
      .where(summaryWhere)
      .groupBy(changeRequests.status);

    let pendingCount = 0;
    let approvedCount = 0;
    let deniedCount = 0;
    let cancelledCount = 0;
    let expiredCount = 0;
    let pendingExecutionCount = 0;
    let totalCount = 0;
    for (const row of summaryRows) {
      totalCount += row.count;
      if (row.status === "pending") pendingCount = row.count;
      else if (row.status === "approved") approvedCount = row.count;
      else if (row.status === "denied") deniedCount = row.count;
      else if (row.status === "cancelled") cancelledCount = row.count;
      else if (row.status === "expired") expiredCount = row.count;
      else if (row.status === "pending_execution")
        pendingExecutionCount = row.count;
    }

    return {
      requests,
      total,
      summary: {
        pendingCount,
        approvedCount,
        deniedCount,
        cancelledCount,
        expiredCount,
        pendingExecutionCount,
        totalCount,
      },
    };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to list change requests:");
    return {
      requests: [],
      total: 0,
      summary: {
        pendingCount: 0,
        approvedCount: 0,
        deniedCount: 0,
        cancelledCount: 0,
        expiredCount: 0,
        pendingExecutionCount: 0,
        totalCount: 0,
      },
    };
  }
}

/**
 * Update the status of a change request (approve, deny, cancel, expire).
 * Used by admins to review requests.
 */
export async function updateChangeRequestStatus(
  id: number,
  update: {
    status:
      | "approved"
      | "denied"
      | "cancelled"
      | "expired"
      | "pending_execution";
    reviewedById?: number;
    reviewedByName?: string;
    reviewNotes?: string;
    slackApprovalId?: string;
  },
  fromStatus: "pending" | "pending_execution" = "pending"
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    const setData: Record<string, unknown> = {
      status: update.status,
      updatedAt: new Date(),
    };
    if (update.reviewedById !== undefined)
      setData.reviewedById = update.reviewedById;
    if (update.reviewedByName !== undefined)
      setData.reviewedByName = update.reviewedByName;
    if (update.reviewNotes !== undefined)
      setData.reviewNotes = update.reviewNotes;
    if (update.slackApprovalId !== undefined)
      setData.slackApprovalId = update.slackApprovalId;
    if (fromStatus === "pending") setData.reviewedAt = new Date();

    const [result] = await db
      .update(changeRequests)
      .set(setData)
      .where(
        and(eq(changeRequests.id, id), eq(changeRequests.status, fromStatus))
      );

    if (result.affectedRows === 0) {
      return {
        success: false,
        error: `Change request not found or not in ${fromStatus} status`,
      };
    }

    return { success: true };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to update change request status");
    return { success: false, error: String(error) };
  }
}

/**
 * Get change requests submitted by a specific moderator.
 * Convenience wrapper around listChangeRequests.
 */
export async function getChangeRequestsByModerator(
  moderatorId: number,
  options: {
    status?:
      | "pending"
      | "approved"
      | "denied"
      | "cancelled"
      | "expired"
      | "pending_execution";
    limit?: number;
    offset?: number;
  } = {}
): Promise<{
  requests: ChangeRequest[];
  total: number;
  summary: {
    pendingCount: number;
    approvedCount: number;
    deniedCount: number;
    totalCount: number;
  };
}> {
  return listChangeRequests({
    submittedById: moderatorId,
    status: options.status,
    limit: options.limit,
    offset: options.offset,
  });
}
