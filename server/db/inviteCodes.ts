import { eq, and, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { inviteCodes, users } from "../../drizzle/schema";

/**
 * Validate an invite code and approve the user if valid.
 * Returns { success, error? } — atomic: increments usage + approves user in one flow.
 */
export async function redeemInviteCode(userId: number, code: string): Promise<{ success: boolean; error?: string }> {
  const trimmedCode = code.trim().toUpperCase();

  const db = await getDb();
  if (!db) return { success: false, error: "Database not available." };

  // Find the code
  const [inviteCode] = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.code, trimmedCode))
    .limit(1);

  if (!inviteCode) {
    return { success: false, error: "Invalid access code." };
  }

  if (!inviteCode.isActive) {
    return { success: false, error: "This access code has been deactivated." };
  }

  if (inviteCode.expiresAt && inviteCode.expiresAt < new Date()) {
    return { success: false, error: "This access code has expired." };
  }

  if (inviteCode.currentUses >= inviteCode.maxUses) {
    return { success: false, error: "This access code has reached its usage limit." };
  }

  // Check if user is already approved
  const [user] = await db
    .select({ approved: users.approved })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.approved) {
    return { success: false, error: "Your account is already approved." };
  }

  // Atomically increment usage count
  await db
    .update(inviteCodes)
    .set({ currentUses: sql`${inviteCodes.currentUses} + 1` })
    .where(
      and(
        eq(inviteCodes.id, inviteCode.id),
        sql`${inviteCodes.currentUses} < ${inviteCodes.maxUses}`
      )
    );

  // Approve the user
  await db
    .update(users)
    .set({
      approved: true,
      accessCode: trimmedCode,
      approvedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return { success: true };
}

/**
 * Create a new invite code (admin only).
 */
export async function createInviteCode(params: {
  code: string;
  createdBy: number;
  maxUses?: number;
  expiresAt?: Date | null;
  note?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const trimmedCode = params.code.trim().toUpperCase();

  const db = await getDb();
  if (!db) return { success: false, error: "Database not available." };

  // Check for duplicate
  const [existing] = await db
    .select({ id: inviteCodes.id })
    .from(inviteCodes)
    .where(eq(inviteCodes.code, trimmedCode))
    .limit(1);

  if (existing) {
    return { success: false, error: "A code with this value already exists." };
  }

  await db.insert(inviteCodes).values({
    code: trimmedCode,
    createdBy: params.createdBy,
    maxUses: params.maxUses ?? 1,
    expiresAt: params.expiresAt ?? null,
    note: params.note ?? null,
  });

  return { success: true };
}

/**
 * List all invite codes (admin only).
 */
export async function listInviteCodes() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(inviteCodes)
    .orderBy(inviteCodes.createdAt);
}

/**
 * Deactivate an invite code (admin only).
 */
export async function deactivateInviteCode(codeId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(inviteCodes)
    .set({ isActive: false })
    .where(eq(inviteCodes.id, codeId));
}

/**
 * Approve a user directly (admin bypass, no code needed).
 */
export async function approveUserDirectly(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({
      approved: true,
      accessCode: "ADMIN_APPROVED",
      approvedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
