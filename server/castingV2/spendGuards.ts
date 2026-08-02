/**
 * Checks that must happen BEFORE anything is claimed or charged.
 *
 * Shared by the roll and the Sign because a refusal that arrives after the
 * claim leaves an operation to explain and a receipt to reconcile, and a
 * refusal that arrives after the charge leaves money to give back. Neither is
 * necessary for a condition we can read for free.
 */
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { users } from "../../drizzle/schema";
import { getDb } from "../db/connection";

/**
 * Frozen accounts cannot spend.
 *
 * The same check `withAtomicCredits` performs, hoisted to where it can refuse
 * without leaving an operation behind.
 */
export async function assertNotFrozen(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const [user] = await db
    .select({ frozenAt: users.frozenAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user?.frozenAt) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Your account is currently under review. Generations are temporarily paused while we verify your billing records.",
    });
  }
}
