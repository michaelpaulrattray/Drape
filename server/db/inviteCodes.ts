import { eq, and, gt, isNull, or, sql } from "drizzle-orm";
import { getDb, withTransaction } from "./connection";
import { inviteCodes, users } from "../../drizzle/schema";

/** The refusals a redeem can give, worded once so the pre-read and the guarded
 *  write cannot drift apart in what they tell the customer. */
const REDEEM_REFUSAL = {
  invalid: "Invalid access code.",
  deactivated: "This access code has been deactivated.",
  expired: "This access code has expired.",
  usedUp: "This access code has reached its usage limit.",
  alreadyApproved: "Your account is already approved.",
} as const;

/** Thrown inside the transaction to roll it back; caught below and turned into
 *  the refusal it carries. Never escapes this module. */
class RedeemRefused extends Error {
  constructor(readonly refusal: string) {
    super(refusal);
  }
}

/** Rows changed by an UPDATE, read off the mysql2 result header in either shape
 *  drizzle hands back (`[header, fields]` or the header alone). A shape it does
 *  not recognise reads as 0, so an unreadable answer refuses rather than admits. */
function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  const count = (header as { affectedRows?: unknown } | null | undefined)?.affectedRows;
  return typeof count === "number" ? count : 0;
}

/**
 * Validate an invite code and approve the user if valid.
 *
 * THE GUARDED WRITES ARE THE AUTHORITY, NOT THE READS (#2373). The reads at the
 * top only choose the friendliest refusal; two sign-ups racing for a code's last
 * use both pass them. What admits a person is the transaction: the code's
 * counter moves only if the code is still active, unexpired and under its limit
 * IN THAT SAME UPDATE, and the person is approved only if they were not already
 * — and each statement must report exactly one changed row, or the whole
 * transaction rolls back and the redeem is refused. Before this, the increment
 * carried the right guard and nobody read its answer, so a used-up code still
 * approved the account and the counter stayed under the limit.
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
    return { success: false, error: REDEEM_REFUSAL.invalid };
  }

  if (!inviteCode.isActive) {
    return { success: false, error: REDEEM_REFUSAL.deactivated };
  }

  if (inviteCode.expiresAt && inviteCode.expiresAt < new Date()) {
    return { success: false, error: REDEEM_REFUSAL.expired };
  }

  if (inviteCode.currentUses >= inviteCode.maxUses) {
    return { success: false, error: REDEEM_REFUSAL.usedUp };
  }

  // Check if user is already approved
  const [user] = await db
    .select({ approved: users.approved })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.approved) {
    return { success: false, error: REDEEM_REFUSAL.alreadyApproved };
  }

  try {
    await withTransaction(async (tx) => {
      /* Spend one use — only if the code can still give one, decided by the
         row as it stands when this statement takes its lock. */
      const spent = await tx
        .update(inviteCodes)
        .set({ currentUses: sql`${inviteCodes.currentUses} + 1` })
        .where(
          and(
            eq(inviteCodes.id, inviteCode.id),
            eq(inviteCodes.isActive, true),
            or(isNull(inviteCodes.expiresAt), gt(inviteCodes.expiresAt, new Date())),
            sql`${inviteCodes.currentUses} < ${inviteCodes.maxUses}`,
          ),
        );
      if (affectedRows(spent) !== 1) throw new RedeemRefused(REDEEM_REFUSAL.usedUp);

      /* Approve — only an account that is not approved yet, so one person
         racing themselves cannot spend two uses on one approval. */
      const approved = await tx
        .update(users)
        .set({
          approved: true,
          accessCode: trimmedCode,
          approvedAt: new Date(),
        })
        .where(and(eq(users.id, userId), eq(users.approved, false)));
      if (affectedRows(approved) !== 1) throw new RedeemRefused(REDEEM_REFUSAL.alreadyApproved);
    });
  } catch (error) {
    if (error instanceof RedeemRefused) return { success: false, error: error.refusal };
    throw error;
  }

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
