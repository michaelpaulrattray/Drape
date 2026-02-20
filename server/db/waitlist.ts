/**
 * Waitlist Domain — waitlist signup, position lookup, and email checks.
 */

import { eq, count } from "drizzle-orm";
import { waitlist, InsertWaitlist } from "../../drizzle/schema";
import { getDb } from "./connection";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("db/waitlist");

export async function addToWaitlist(
  data: InsertWaitlist
): Promise<{ success: boolean; position?: number; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    const existing = await db
      .select()
      .from(waitlist)
      .where(eq(waitlist.email, data.email))
      .limit(1);
    if (existing.length > 0) {
      const position = await getWaitlistPosition(data.email);
      return { success: true, position, error: "already_registered" };
    }

    await db.insert(waitlist).values(data);
    const position = await getWaitlistPosition(data.email);

    return { success: true, position };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to add to waitlist:");
    return { success: false, error: "Failed to join waitlist" };
  }
}

export async function getWaitlistPosition(email: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const entry = await db
      .select()
      .from(waitlist)
      .where(eq(waitlist.email, email))
      .limit(1);
    if (entry.length === 0) return 0;

    const position = entry[0].id;
    return position;
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to get waitlist position:");
    return 0;
  }
}

export async function getWaitlistCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db.select({ count: count() }).from(waitlist);
    return result[0]?.count ?? 0;
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to get waitlist count:");
    return 0;
  }
}

export async function checkEmailOnWaitlist(email: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    const result = await db
      .select()
      .from(waitlist)
      .where(eq(waitlist.email, email))
      .limit(1);
    return result.length > 0;
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to check waitlist:");
    return false;
  }
}
