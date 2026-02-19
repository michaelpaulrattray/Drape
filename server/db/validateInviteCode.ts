import { eq } from "drizzle-orm";
import { getDb } from "./connection";
import { inviteCodes } from "../../drizzle/schema";

/**
 * Validate an invite code WITHOUT consuming it.
 * Used on the login page before OAuth — checks existence, active status, expiry, and usage.
 * Does NOT increment usage or approve any user.
 */
export async function validateInviteCode(
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const trimmedCode = code.trim().toUpperCase();
  const db = await getDb();
  if (!db) return { valid: false, error: "Service temporarily unavailable." };

  const [inviteCode] = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.code, trimmedCode))
    .limit(1);

  if (!inviteCode) {
    return { valid: false, error: "Invalid access code." };
  }
  if (!inviteCode.isActive) {
    return { valid: false, error: "This access code has been deactivated." };
  }
  if (inviteCode.expiresAt && inviteCode.expiresAt < new Date()) {
    return { valid: false, error: "This access code has expired." };
  }
  if (inviteCode.currentUses >= inviteCode.maxUses) {
    return { valid: false, error: "This access code has reached its usage limit." };
  }

  return { valid: true };
}
