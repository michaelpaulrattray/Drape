/**
 * Plan-change credit settlements (#711) — the QUEUE half of the settlement
 * rule: a plan change's credit move is recorded here when Stripe accepts the
 * update, and applied (server/stripe/planChangeSettlement.ts) when the
 * change's own invoice settles.
 *
 * This table is bookkeeping, not the idempotency guard: the credit ledger's
 * unique (userId, referenceId) index — keyed on the invoice id — is what
 * stops a double application when changePlan and the invoice webhook race.
 * The status column exists so a row that will never apply (a final payment
 * failure) says so instead of reading as queued work forever.
 */
import { and, eq } from "drizzle-orm";
import { planChangeSettlements, type PlanChangeSettlement } from "../../drizzle/schema";
import { getDb } from "./connection";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("db/planChangeSettlements");

export type RecordPlanChangeSettlementInput = {
  userId: number;
  stripeInvoiceId: string;
  direction: "grant" | "unwind";
  credits: number;
  description: string;
  clientRequestId?: string;
};

export async function recordPlanChangeSettlement(
  input: RecordPlanChangeSettlementInput,
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };
  try {
    await db
      .insert(planChangeSettlements)
      .values({
        userId: input.userId,
        stripeInvoiceId: input.stripeInvoiceId,
        direction: input.direction,
        credits: input.credits,
        description: input.description,
        clientRequestId: input.clientRequestId ?? null,
      })
      // One invoice, one settlement: a replayed record for the same invoice
      // (a retried mutation that somehow re-read the same invoice) is a no-op.
      .onDuplicateKeyUpdate({ set: { stripeInvoiceId: input.stripeInvoiceId } });
    return { success: true };
  } catch (error) {
    log.error({ err: error, input }, "[Settlement] failed to record plan-change settlement");
    return { success: false, error: "Failed to record settlement" };
  }
}

export async function getPlanChangeSettlementByInvoice(
  stripeInvoiceId: string,
): Promise<PlanChangeSettlement | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(planChangeSettlements)
    .where(eq(planChangeSettlements.stripeInvoiceId, stripeInvoiceId))
    .limit(1);
  return rows[0] ?? null;
}

/** pending → applied/void. Only a pending row moves; returns whether one did. */
export async function resolvePlanChangeSettlement(
  stripeInvoiceId: string,
  status: "applied" | "void",
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .update(planChangeSettlements)
    .set({ status, resolvedAt: new Date() })
    .where(
      and(
        eq(planChangeSettlements.stripeInvoiceId, stripeInvoiceId),
        eq(planChangeSettlements.status, "pending"),
      ),
    );
  const affected = (result as any)[0]?.affectedRows ?? (result as any).affectedRows ?? 0;
  return affected > 0;
}
