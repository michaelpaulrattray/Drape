import { TRPCError } from "@trpc/server";
import { and, eq, isNull, ne } from "drizzle-orm";
import { models } from "../../drizzle/schema";
import type { TransactionHandle } from "./connection";

/**
 * Durable R7-5 model-reference fence.
 *
 * The row lock is intentional. A writer that wins it commits its new
 * dependency before deletion can plan; deletion then discovers that row. A
 * deletion that wins it first leaves a tombstone, so the writer refuses. This
 * closes the validate-then-insert race that route-level ownership checks do
 * not close.
 */
export async function assertOwnedAvailableModelIn(
  tx: TransactionHandle,
  input: { modelId: number; userId: number },
): Promise<void> {
  const [model] = await tx
    .select({ id: models.id })
    .from(models)
    .where(and(
      eq(models.id, input.modelId),
      eq(models.userId, input.userId),
      isNull(models.deletedAt),
      ne(models.status, "archived"),
    ))
    .limit(1)
    .for("update");
  if (!model) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  }
}
