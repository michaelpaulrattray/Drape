/**
 * IP Blocking Domain — IP block/unblock and blocked IP listing.
 * (The emergency-token helpers lived here until #800: they existed only for
 * the Slack emergency buttons, which are retired. The `emergency_tokens`
 * table stays declared in the schema — dropping it is a founder ceremony.)
 */

import { eq, desc, sql } from "drizzle-orm";
import {
  blockedIps,
} from "../../drizzle/schema";
import { getDb } from "./connection";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("db/ipBlocking");

/**
 * Check if an IP address is blocked.
 * Returns blocking info if blocked, null if not blocked.
 */
export async function isIpBlocked(
  ipAddress: string
): Promise<{ blocked: boolean; reason?: string; expiresAt?: Date | null }> {
  const db = await getDb();
  if (!db) return { blocked: false };

  try {
    const [block] = await db
      .select()
      .from(blockedIps)
      .where(eq(blockedIps.ipAddress, ipAddress))
      .limit(1);

    if (!block) return { blocked: false };

    if (block.expiresAt && new Date(block.expiresAt) < new Date()) {
      await db.delete(blockedIps).where(eq(blockedIps.id, block.id));
      return { blocked: false };
    }

    return {
      blocked: true,
      reason: block.reason,
      expiresAt: block.expiresAt,
    };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to check IP block:");
    return { blocked: false };
  }
}

/**
 * Block an IP address.
 */
export async function blockIp(
  ipAddress: string,
  reason: string,
  blockedBy: number,
  expiresAt?: Date | null
): Promise<{ success: boolean; id?: number }> {
  const db = await getDb();
  if (!db) return { success: false };

  try {
    const existing = await isIpBlocked(ipAddress);
    if (existing.blocked) {
      return { success: true };
    }

    const result = await db.insert(blockedIps).values({
      ipAddress,
      reason,
      blockedBy,
      expiresAt: expiresAt || null,
    });

    return { success: true, id: Number(result[0].insertId) };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to block IP:");
    return { success: false };
  }
}

/**
 * Unblock an IP address. Answers how many rows the delete actually removed
 * (#816, PR #820 review): the route used to log an unblock on a `true` that
 * meant only "the statement ran", so an address that matched nothing produced
 * three log rows claiming an act that never happened.
 */
export async function unblockIp(
  ipAddress: string,
): Promise<{ success: true; removed: number } | { success: false }> {
  const db = await getDb();
  if (!db) return { success: false };

  try {
    const [result] = await db.delete(blockedIps).where(eq(blockedIps.ipAddress, ipAddress));
    return { success: true, removed: result.affectedRows };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to unblock IP:");
    return { success: false };
  }
}

/**
 * Get list of blocked IPs with pagination.
 */
export async function getBlockedIps(
  limit: number = 50,
  offset: number = 0
): Promise<{ ips: (typeof blockedIps.$inferSelect)[]; total: number }> {
  const db = await getDb();
  if (!db) return { ips: [], total: 0 };

  try {
    const [ips, countResult] = await Promise.all([
      db
        .select()
        .from(blockedIps)
        .orderBy(desc(blockedIps.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(blockedIps),
    ]);

    return {
      ips,
      total: countResult[0]?.count || 0,
    };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to get blocked IPs:");
    return { ips: [], total: 0 };
  }
}
