import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import {
  creditTransactions,
  generationOperations,
  generations,
  modelAssets,
  models,
  type Generation,
  type GenerationOperation,
  type ModelAsset,
} from "../../drizzle/schema";
import { addCredits, normalizeCreditReferenceId } from "../db/credits";
import { getDb } from "../db/connection";
import {
  finalizeClaimedGenerationOperationFailure,
  finalizeGenerationOperationFailure,
  finalizeGenerationOperationSuccess,
  markGenerationOperationRecoveryRequired,
} from "../db/generationOperations";
import { createModuleLogger } from "../logging/logger";
import type { PublicOperationResult } from "./operationContract";

const log = createModuleLogger("casting/operationRecovery");
const STALE_CLAIM_MS = 15 * 60 * 1000;
const RECOVERY_RETRY_MS = 5 * 60 * 1000;

export type StaleOperationDecision =
  | "free_failure"
  | "paid_failure"
  | "durable_success"
  | "recovery_required";

export interface StaleOperationEvidence {
  status: "claimed" | "running";
  plannedCredits: number;
  chargedCredits: number;
  childCount: number;
  processingChildren: number;
  completedChildren: number;
  failedChildren: number;
  durableResultCount: number;
  possiblePartialWrite: boolean;
  ledgerDisagrees: boolean;
}

export function recoveredLandingState(kind: GenerationOperation["kind"]):
  | { landing: { status: "pending" | "relink_required" } }
  | Record<string, never> {
  if (kind === "canvas.cast") return { landing: { status: "pending" } };
  if (kind === "canvas.fork") return { landing: { status: "relink_required" } };
  return {};
}

/** Pure, deliberately conservative policy used by both the sweeper and tests. */
export function classifyStaleOperation(evidence: StaleOperationEvidence): StaleOperationDecision {
  if (evidence.ledgerDisagrees || evidence.processingChildren > 0) return "recovery_required";
  if (
    evidence.status === "claimed" &&
    evidence.chargedCredits === 0 &&
    evidence.childCount === 0 &&
    evidence.durableResultCount === 0
  ) return "free_failure";
  if (
    evidence.chargedCredits === 0 &&
    evidence.childCount === 0 &&
    evidence.durableResultCount === 0 &&
    !evidence.possiblePartialWrite
  ) return "free_failure";
  if (evidence.durableResultCount > 0 && evidence.completedChildren > 0) return "durable_success";
  if (
    evidence.chargedCredits > 0 &&
    evidence.childCount > 0 &&
    evidence.failedChildren === evidence.childCount &&
    evidence.durableResultCount === 0
  ) return "paid_failure";
  return "recovery_required";
}

function refundReferenceFor(referenceId: string): string {
  return normalizeCreditReferenceId(`refund:${referenceId}`);
}

function childRefundReference(operation: GenerationOperation, child: Generation): string {
  const charge = operation.chargeReferenceId!;
  if (child.stepKey?.startsWith("view:") && child.viewAngle) {
    return refundReferenceFor(`${charge}:slot:${child.viewAngle}`);
  }
  if (child.stepKey?.startsWith("variation:")) {
    return refundReferenceFor(`${charge}:candidate:${child.stepKey.slice("variation:".length)}`);
  }
  return refundReferenceFor(charge);
}

async function reconstructPublicResult(
  operation: GenerationOperation,
  children: Generation[],
  assets: ModelAsset[],
): Promise<PublicOperationResult | null> {
  const completed = children.filter((child) => child.status === "completed" && child.resultUrl);
  const assetFor = (child: Generation) => assets.find((asset) => asset.storageUrl === child.resultUrl);
  if (completed.some((child) => !assetFor(child))) return null;
  const failedAngles = children
    .filter((child) => child.status === "failed" && child.viewAngle)
    .map((child) => child.viewAngle!);

  switch (operation.kind) {
    case "casting.headshot": {
      const asset = assetFor(completed[0]);
      return asset ? { assetId: asset.id } : null;
    }
    case "casting.iterate": {
      const child = completed[0];
      const asset = child ? assetFor(child) : null;
      const metadata = child?.metadata as { authorizationClass?: unknown } | null;
      return asset ? {
        assetId: asset.id,
        identityChanged: metadata?.authorizationClass === "identity",
        staledAngles: [],
      } : null;
    }
    case "casting.refresh":
      return {
        refreshed: completed.map((child) => ({ angle: child.viewAngle, assetId: assetFor(child)!.id })),
        failedAngles,
      };
    case "casting.mint":
    case "casting.add_views": {
      const db = await getDb();
      if (!db || !operation.modelId) return null;
      const [model] = await db.select().from(models).where(eq(models.id, operation.modelId)).limit(1);
      if (!model) return null;
      const metadata = completed[0]?.metadata as { mintTier?: unknown } | null;
      const tier = metadata?.mintTier;
      if (tier !== "draft" && tier !== "core" && tier !== "production") return null;
      return {
        agencyId: model.agencyId,
        minted: model.status === "active" || model.status === "locked",
        tier,
        generated: completed.map((child) => ({ angle: child.viewAngle, assetId: assetFor(child)!.id })),
        failedAngles,
      };
    }
    case "canvas.cast": {
      const child = completed[0];
      const asset = child ? assetFor(child) : null;
      if (!asset || !operation.modelId || !operation.originItemId) return null;
      return {
        success: true,
        itemId: operation.originItemId,
        modelId: operation.modelId,
        assetId: asset.id,
        imageUrl: asset.storageUrl,
        creditCost: Math.abs(child.pointsCost),
        placed: false,
        placementMessage: "Your cast was saved in Models. Reopen it from the library to place it on the Canvas.",
      };
    }
    case "canvas.fork": {
      const child = completed[0];
      const asset = child ? assetFor(child) : null;
      if (!asset || !child.modelId || !operation.originItemId) return null;
      return {
        decision: "fork",
        itemId: operation.originItemId,
        newItemId: null,
        modelId: child.modelId,
        imageUrl: asset.storageUrl,
        placed: false,
        placementMessage: "Your fork was saved in Models. Reopen it from the library to place it on the Canvas.",
      };
    }
    default:
      return null;
  }
}

async function claimRecoveryAttempt(operation: GenerationOperation, now: Date): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const retryBefore = new Date(now.getTime() - RECOVERY_RETRY_MS);
  const result = await db
    .update(generationOperations)
    .set({ recoveryAttemptedAt: now })
    .where(and(
      eq(generationOperations.id, operation.id),
      eq(generationOperations.status, operation.status),
      or(
        isNull(generationOperations.recoveryAttemptedAt),
        lt(generationOperations.recoveryAttemptedAt, retryBefore),
      ),
    ));
  const affected = result as { affectedRows?: number } | [{ affectedRows?: number }];
  return (Array.isArray(affected) ? affected[0]?.affectedRows : affected.affectedRows) === 1;
}

export async function adjudicateStaleGenerationOperation(
  operation: GenerationOperation,
  now = new Date(),
): Promise<StaleOperationDecision | "skipped"> {
  if (operation.status !== "claimed" && operation.status !== "running") return "skipped";
  if (!await claimRecoveryAttempt(operation, now)) return "skipped";
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const children = await db.select().from(generations).where(eq(generations.operationId, operation.id));
  const urls = children.flatMap((child) => child.resultUrl ? [child.resultUrl] : []);
  const assets = urls.length > 0
    ? await db.select().from(modelAssets).where(inArray(modelAssets.storageUrl, urls))
    : [];
  const chargeRows = operation.chargeReferenceId
    ? await db.select().from(creditTransactions).where(and(
        eq(creditTransactions.userId, operation.userId),
        eq(creditTransactions.referenceId, operation.chargeReferenceId),
      ))
    : [];
  const charge = chargeRows[0];
  const chargedCredits = charge?.type === "generation" && charge.amount < 0 ? Math.abs(charge.amount) : 0;
  const expectedRefunds = new Map<string, number>();
  for (const child of children.filter((candidate) => candidate.status === "failed")) {
    if (!operation.chargeReferenceId) continue;
    const reference = childRefundReference(operation, child);
    if (expectedRefunds.has(reference)) {
      // Two child attempts sharing one semantic refund id cannot be safely
      // reconciled automatically; keep the receipt sealed for support.
      expectedRefunds.set(reference, Number.NaN);
    } else {
      expectedRefunds.set(reference, child.pointsCost);
    }
  }
  const refundRows = expectedRefunds.size > 0
    ? await db.select().from(creditTransactions).where(and(
        eq(creditTransactions.userId, operation.userId),
        inArray(creditTransactions.referenceId, Array.from(expectedRefunds.keys())),
      ))
    : [];
  const existingRefundCredits = refundRows.reduce((sum, row) => sum + (row.type === "refund" ? row.amount : 0), 0);
  const refundLedgerDisagrees = refundRows.some((row) =>
    row.referenceId === null ||
    row.type !== "refund" ||
    row.amount !== expectedRefunds.get(row.referenceId)
  ) || Array.from(expectedRefunds.values()).some((amount) => !Number.isSafeInteger(amount));
  const ledgerDisagrees =
    chargeRows.length > 1 ||
    (!!charge && (charge.type !== "generation" || charge.amount >= 0)) ||
    (!!charge && operation.plannedCredits > 0 && chargedCredits !== operation.plannedCredits) ||
    (!charge && operation.plannedCredits > 0 && (children.length > 0 || assets.length > 0)) ||
    refundLedgerDisagrees;
  const evidence: StaleOperationEvidence = {
    status: operation.status,
    plannedCredits: operation.plannedCredits,
    chargedCredits,
    childCount: children.length,
    processingChildren: children.filter((child) => child.status === "pending" || child.status === "processing").length,
    completedChildren: children.filter((child) => child.status === "completed").length,
    failedChildren: children.filter((child) => child.status === "failed").length,
    durableResultCount: assets.length,
    possiblePartialWrite: operation.status === "running" && operation.plannedCredits === 0,
    ledgerDisagrees,
  };
  let decision = classifyStaleOperation(evidence);

  const ensureFailedChildRefunds = async (): Promise<number | null> => {
    let total = 0;
    for (const child of children.filter((candidate) => candidate.status === "failed")) {
      if (!operation.chargeReferenceId) return null;
      const refund = await addCredits(
        operation.userId,
        child.pointsCost,
        "refund",
        "Recovery refund: generation attempt failed",
        childRefundReference(operation, child),
      );
      if (!refund.success) return null;
      total += child.pointsCost;
    }
    return total;
  };

  if (decision === "free_failure") {
    if (operation.status === "claimed") {
      await finalizeClaimedGenerationOperationFailure({
        userId: operation.userId,
        operationId: operation.id,
        errorCode: "TIMEOUT",
        publicMessage: "This operation stopped before it began. Nothing was charged.",
      });
    } else {
      await finalizeGenerationOperationFailure({
        userId: operation.userId,
        operationId: operation.id,
        errorCode: "TIMEOUT",
        publicMessage: "This operation stopped before any paid work began. Nothing was charged.",
        chargedCredits: 0,
        refundedCredits: 0,
      });
    }
    return decision;
  }

  if (decision === "paid_failure") {
    const refundedCredits = await ensureFailedChildRefunds();
    if (refundedCredits === chargedCredits) {
      await finalizeGenerationOperationFailure({
        userId: operation.userId,
        operationId: operation.id,
        errorCode: "INTERNAL_SERVER_ERROR",
        publicMessage: "The generation failed and the charged credits were refunded.",
        chargedCredits,
        refundedCredits,
      });
      return decision;
    }
  }

  if (decision === "durable_success") {
    const result = await reconstructPublicResult(operation, children, assets);
    const refundedCredits = await ensureFailedChildRefunds();
    if (result && refundedCredits !== null) {
      const failed = children.some((child) => child.status === "failed");
      await finalizeGenerationOperationSuccess({
        userId: operation.userId,
        operationId: operation.id,
        result,
        chargedCredits,
        refundedCredits,
        terminalStatus: failed ? "partial" : "succeeded",
        ...recoveredLandingState(operation.kind),
      });
      return decision;
    }
    decision = "recovery_required";
  }

  const message = `This operation needs support review before it can be retried. Operation ${operation.id}.`;
  await markGenerationOperationRecoveryRequired({
    userId: operation.userId,
    operationId: operation.id,
    publicMessage: message,
    chargedCredits,
    refundedCredits: existingRefundCredits,
  });
  return "recovery_required";
}

export async function sweepStaleGenerationOperations(input: {
  now?: Date;
  limit?: number;
} = {}): Promise<{ inspected: number; resolved: number; recoveryRequired: number; skipped: number }> {
  const now = input.now ?? new Date();
  const limit = Math.max(1, Math.min(input.limit ?? 25, 100));
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const staleClaimBefore = new Date(now.getTime() - STALE_CLAIM_MS);
  const rows = await db
    .select()
    .from(generationOperations)
    .where(or(
      and(eq(generationOperations.status, "claimed"), lt(generationOperations.updatedAt, staleClaimBefore)),
      and(eq(generationOperations.status, "running"), lt(generationOperations.leaseExpiresAt, now)),
    ))
    .limit(limit);
  let resolved = 0;
  let recoveryRequired = 0;
  let skipped = 0;
  for (const operation of rows) {
    try {
      const decision = await adjudicateStaleGenerationOperation(operation, now);
      if (decision === "skipped") skipped += 1;
      else if (decision === "recovery_required") recoveryRequired += 1;
      else resolved += 1;
    } catch (error) {
      skipped += 1;
      log.error({ err: error, operationId: operation.id }, "[OperationRecovery] stale adjudication failed safely");
    }
  }
  return { inspected: rows.length, resolved, recoveryRequired, skipped };
}

let recoverySweepTimer: ReturnType<typeof setInterval> | null = null;
let recoverySweepRunning = false;

/** Start one bounded, non-overlapping server sweep. Database CAS remains the
 * authority when two deploy instances briefly overlap. */
export function startGenerationOperationRecoverySweep(): void {
  if (recoverySweepTimer) return;
  const run = async () => {
    if (recoverySweepRunning) return;
    recoverySweepRunning = true;
    try {
      const result = await sweepStaleGenerationOperations({ limit: 25 });
      if (result.inspected > 0) log.info(result, "[OperationRecovery] bounded stale sweep completed");
    } catch (error) {
      log.error({ err: error }, "[OperationRecovery] bounded stale sweep failed safely");
    } finally {
      recoverySweepRunning = false;
    }
  };
  const startup = setTimeout(run, 60_000);
  startup.unref?.();
  recoverySweepTimer = setInterval(run, 60_000);
  recoverySweepTimer.unref?.();
}
