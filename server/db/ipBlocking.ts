/**
 * IP Blocking Domain — IP block/unblock, blocked IP listing, and emergency tokens.
 */

import { eq, desc, sql } from "drizzle-orm";
import {
  blockedIps,
  emergencyTokens,
} from "../../drizzle/schema";
import { getDb } from "./connection";
import { randomUUID } from "crypto";
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
 * Unblock an IP address.
 */
export async function unblockIp(ipAddress: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.delete(blockedIps).where(eq(blockedIps.ipAddress, ipAddress));
    return true;
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to unblock IP:");
    return false;
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

/**
 * Create an emergency action token.
 * Tokens are valid for 24 hours and single-use.
 */
export async function createEmergencyToken(
  action: "block_ip" | "suspend_user",
  targetId: string,
  metadata?: Record<string, unknown>
): Promise<{ token: string; expiresAt: Date } | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const token =
      randomUUID().replace(/-/g, "") +
      randomUUID().replace(/-/g, "").slice(0, 32);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(emergencyTokens).values({
      token,
      action,
      targetId,
      metadata: metadata || null,
      expiresAt,
    });

    return { token, expiresAt };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to create emergency token:");
    return null;
  }
}

/**
 * Validate and consume an emergency token.
 * Returns the token data if valid, null if invalid/expired/used.
 */
export async function consumeEmergencyToken(
  token: string,
  usedBy?: string
): Promise<{
  action: "block_ip" | "suspend_user";
  targetId: string;
  metadata: Record<string, unknown> | null;
} | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const [tokenRecord] = await db
      .select()
      .from(emergencyTokens)
      .where(eq(emergencyTokens.token, token))
      .limit(1);

    if (!tokenRecord) {
      log.warn("[EmergencyToken] Token not found");
      return null;
    }

    if (tokenRecord.usedAt) {
      log.warn("[EmergencyToken] Token already used");
      return null;
    }

    if (new Date(tokenRecord.expiresAt) < new Date()) {
      log.warn("[EmergencyToken] Token expired");
      return null;
    }

    await db
      .update(emergencyTokens)
      .set({
        usedAt: new Date(),
        usedBy: usedBy || null,
      })
      .where(eq(emergencyTokens.id, tokenRecord.id));

    return {
      action: tokenRecord.action,
      targetId: tokenRecord.targetId,
      metadata: tokenRecord.metadata as Record<string, unknown> | null,
    };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to consume emergency token:");
    return null;
  }
}
