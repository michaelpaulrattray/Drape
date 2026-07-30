import { recoverCastingV2RollOperation } from "../castingV2/rollRecovery";
import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import {
  creditTransactions,
  generationOperations,
  generations,
  modelAssets,
  modelPackageSnapshots,
  modelPackageSnapshotSlots,
  models,
  type Generation,
  type GenerationOperation,
  type ModelAsset,
} from "../../drizzle/schema";
import { addCredits, normalizeCreditReferenceId } from "../db/credits";
import { getDb, withTransaction } from "../db/connection";
import {
  finalizeClaimedGenerationOperationFailure,
  finalizeGenerationOperationFailure,
  finalizeGenerationOperationSuccess,
  markClaimedGenerationOperationRecoveryRequired,
  markGenerationOperationRecoveryRequired,
} from "../db/generationOperations";
import { adjudicateStaleInkEvidenceOperation } from "../db/inkAddRecovery";
import { createModuleLogger } from "../logging/logger";
import { recordRefund } from "./atomicCredits";
import { slotCost } from "./packagePricing";
import {
  assertGenerationOperationKind,
  assertGenerationOperationProgress,
  type GenerationOperationKind,
  type PublicOperationResult,
} from "./operationContract";
import { isCanonicalViewType } from "../../shared/exportViews";
import {
  MINT_TIER_SLOTS,
  type CanonicalViewAngle,
  type MintTier,
} from "../../shared/boardTypes";
import {
  assessSupportedInkFeatureGraph,
} from "./evidence/evidencePackagePlan";
import {
  readEvidencePackageFeatureRowsIn,
} from "./evidence/evidencePackageFeatureRows";

const log = createModuleLogger("casting/operationRecovery");
const STALE_CLAIM_MS = 15 * 60 * 1000;
const RECOVERY_RETRY_MS = 5 * 60 * 1000;

type PublicResultRecoveryStrategy =
  | "headshot"
  | "iterate"
  | "refresh"
  | "mint"
  | "evidence_mint"
  | "canvas_cast"
  | "canvas_fork"
  | "not_reconstructable";

const PUBLIC_RESULT_RECOVERY_BY_KIND: Readonly<
  Record<GenerationOperationKind, PublicResultRecoveryStrategy>
> = {
  "model.create": "not_reconstructable",
  "casting.headshot": "headshot",
  "casting.iterate": "iterate",
  "casting.mint": "mint",
  "casting.add_views": "mint",
  evidence_plate_ingest: "not_reconstructable",
  evidence_plate_discard: "not_reconstructable",
  evidence_intent_begin: "not_reconstructable",
  evidence_intent_reference: "not_reconstructable",
  evidence_candidate_generate: "not_reconstructable",
  evidence_candidate_retry: "not_reconstructable",
  evidence_candidate_accept: "not_reconstructable",
  evidence_candidate_cancel: "not_reconstructable",
  evidence_fork_copy: "not_reconstructable",
  evidence_package_sync: "refresh",
  evidence_mint: "evidence_mint",
  "casting.refresh": "refresh",
  "casting.restore": "not_reconstructable",
  "casting.restore_state": "not_reconstructable",
  "casting.pin": "not_reconstructable",
  "casting.compact": "not_reconstructable",
  "model.delete": "not_reconstructable",
  "canvas.cast": "canvas_cast",
  "canvas.recast": "not_reconstructable",
  "canvas.fork": "canvas_fork",
  "canvas.variations": "not_reconstructable",
  // The bespoke adjudicator reads the roll's own candidate rows, so there is
  // no generic public result to reconstruct here.
  "castingV2.roll": "not_reconstructable",
};

type StaleRecoveryStrategy =
  | "standard"
  | "castingv2_roll"
  | "ink_evidence"
  | "evidence_fork"
  | "evidence_mint";

const STALE_RECOVERY_BY_KIND: Readonly<
  Record<GenerationOperationKind, StaleRecoveryStrategy>
> = {
  "model.create": "standard",
  "casting.headshot": "standard",
  "casting.iterate": "standard",
  "casting.mint": "standard",
  "casting.add_views": "standard",
  evidence_plate_ingest: "standard",
  evidence_plate_discard: "standard",
  evidence_intent_begin: "standard",
  evidence_intent_reference: "standard",
  evidence_candidate_generate: "ink_evidence",
  evidence_candidate_retry: "ink_evidence",
  evidence_candidate_accept: "ink_evidence",
  evidence_candidate_cancel: "ink_evidence",
  evidence_fork_copy: "evidence_fork",
  evidence_package_sync: "standard",
  evidence_mint: "evidence_mint",
  "casting.refresh": "standard",
  "casting.restore": "standard",
  "casting.restore_state": "standard",
  "casting.pin": "standard",
  "casting.compact": "standard",
  "model.delete": "standard",
  "canvas.cast": "standard",
  "canvas.recast": "standard",
  "canvas.fork": "standard",
  "canvas.variations": "standard",
  // Bespoke: the standard path assumes one output per operation, whereas a
  // roll has eight independently-refundable slices.
  "castingV2.roll": "castingv2_roll",
};

const LANDING_RECOVERY_BY_KIND: Readonly<
  Record<GenerationOperationKind, "pending" | "relink_required" | null>
> = {
  "model.create": null,
  "casting.headshot": null,
  "casting.iterate": null,
  "casting.mint": null,
  "casting.add_views": null,
  evidence_plate_ingest: null,
  evidence_plate_discard: null,
  evidence_intent_begin: null,
  evidence_intent_reference: null,
  evidence_candidate_generate: null,
  evidence_candidate_retry: null,
  evidence_candidate_accept: null,
  evidence_candidate_cancel: null,
  evidence_fork_copy: null,
  evidence_package_sync: null,
  evidence_mint: null,
  "casting.refresh": null,
  "casting.restore": null,
  "casting.restore_state": null,
  "casting.pin": null,
  "casting.compact": null,
  "model.delete": null,
  "canvas.cast": "pending",
  "canvas.recast": null,
  "canvas.fork": "relink_required",
  "canvas.variations": null,
  // A roll lands nothing into a board item; the canvas origin is filled at
  // Sign (M10), not by the roll itself.
  "castingV2.roll": null,
};

function assertNever(value: never): never {
  throw new TypeError(`Unhandled operation recovery strategy: ${String(value)}`);
}

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
  assertGenerationOperationKind(kind);
  const landing = LANDING_RECOVERY_BY_KIND[kind];
  return landing ? { landing: { status: landing } } : {};
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

function viewRefundReference(
  operation: GenerationOperation,
  angle: CanonicalViewAngle,
): string {
  return refundReferenceFor(`${operation.chargeReferenceId!}:slot:${angle}`);
}

function childRefundReference(operation: GenerationOperation, child: Generation): string {
  const charge = operation.chargeReferenceId!;
  if (child.stepKey?.startsWith("view:") && child.viewAngle) {
    return viewRefundReference(operation, child.viewAngle as CanonicalViewAngle);
  }
  if (child.stepKey?.startsWith("variation:")) {
    return refundReferenceFor(`${charge}:candidate:${child.stepKey.slice("variation:".length)}`);
  }
  return refundReferenceFor(charge);
}

function evidenceMintTier(
  operation: GenerationOperation,
): MintTier | null {
  try {
    assertGenerationOperationProgress(operation.progress);
  } catch {
    return null;
  }
  if (
    operation.progress.total !== 1
    || operation.progress.steps.length !== 1
  ) {
    return null;
  }
  const match = /^mint:(draft|core|production)$/.exec(
    operation.progress.steps[0].stepKey,
  );
  return match ? match[1] as MintTier : null;
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

  assertGenerationOperationKind(operation.kind);
  const strategy = PUBLIC_RESULT_RECOVERY_BY_KIND[operation.kind];
  switch (strategy) {
    case "headshot": {
      const asset = assetFor(completed[0]);
      return asset ? { assetId: asset.id } : null;
    }
    case "iterate": {
      const child = completed[0];
      const asset = child ? assetFor(child) : null;
      const metadata = child?.metadata as { authorizationClass?: unknown } | null;
      return asset ? {
        assetId: asset.id,
        identityChanged: metadata?.authorizationClass === "identity",
        staledAngles: [],
      } : null;
    }
    case "refresh":
      return {
        refreshed: completed.map((child) => ({ angle: child.viewAngle, assetId: assetFor(child)!.id })),
        failedAngles,
      };
    case "mint": {
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
    case "evidence_mint": {
      const db = await getDb();
      if (!db || !operation.modelId) return null;
      const [model] = await db
        .select()
        .from(models)
        .where(eq(models.id, operation.modelId))
        .limit(1);
      const tier = evidenceMintTier(operation);
      if (!model || !tier) return null;
      return {
        agencyId: model.agencyId,
        minted: model.status === "active" || model.status === "locked",
        tier,
        generated: [],
        failedAngles: [],
      };
    }
    case "canvas_cast": {
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
    case "canvas_fork": {
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
    case "not_reconstructable":
      return null;
    default:
      return assertNever(strategy);
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

type EvidencePackageRecovery =
  | { type: "not_committed" }
  | { type: "durable_success" }
  | {
      type: "terminal_failure";
      chargedCredits: number;
      refundedCredits: number;
    }
  | {
      type: "recovery_required";
      chargedCredits: number;
      refundedCredits: number;
    };

export async function recoverEvidencePackageSyncOperation(
  operation: GenerationOperation,
): Promise<EvidencePackageRecovery> {
  if (operation.kind !== "evidence_package_sync" || !operation.modelId) {
    return { type: "not_committed" };
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const chargeRows = operation.chargeReferenceId
    ? await db.select().from(creditTransactions).where(and(
        eq(creditTransactions.userId, operation.userId),
        eq(creditTransactions.referenceId, operation.chargeReferenceId),
      ))
    : [];
  const charge = chargeRows[0];
  const chargedCredits =
    charge?.type === "generation" && charge.amount < 0
      ? Math.abs(charge.amount)
      : 0;
  const snapshots = await db
    .select()
    .from(modelPackageSnapshots)
    .where(and(
      eq(modelPackageSnapshots.modelId, operation.modelId),
      eq(modelPackageSnapshots.createdByOperationId, operation.id),
    ));
  if (snapshots.length === 0 && chargeRows.length === 0) {
    return { type: "not_committed" };
  }
  try {
    assertGenerationOperationProgress(operation.progress);
  } catch {
    return {
      type: "recovery_required",
      chargedCredits,
      refundedCredits: 0,
    };
  }
  const requestedAngles = operation.progress.steps.flatMap((step) =>
    step.stepKey === `view:${step.viewAngle}`
    && typeof step.viewAngle === "string"
    && isCanonicalViewType(step.viewAngle)
      ? [step.viewAngle]
      : []
  );
  const uniqueAngles = new Set(requestedAngles);
  const plannedFromSteps = requestedAngles.reduce((sum, angle) => {
    try {
      return sum + slotCost(angle);
    } catch {
      return Number.NaN;
    }
  }, 0);
  if (
    requestedAngles.length === 0
    || uniqueAngles.size !== requestedAngles.length
    || plannedFromSteps !== operation.plannedCredits
  ) {
    return {
      type: "recovery_required",
      chargedCredits: operation.chargedCredits,
      refundedCredits: operation.refundedCredits,
    };
  }
  const expectedRefunds = new Map(
    requestedAngles.map((angle) => [
      viewRefundReference(operation, angle),
      slotCost(angle),
    ]),
  );
  const refundRows = expectedRefunds.size > 0
    ? await db.select().from(creditTransactions).where(and(
        eq(creditTransactions.userId, operation.userId),
        inArray(creditTransactions.referenceId, Array.from(expectedRefunds.keys())),
      ))
    : [];
  const refundLedgerInvalid = refundRows.some((row) =>
    row.referenceId === null
    || row.type !== "refund"
    || row.amount !== expectedRefunds.get(row.referenceId)
  ) || new Set(refundRows.map((row) => row.referenceId)).size !== refundRows.length;
  let refundedCredits = refundRows.reduce((sum, row) => sum + row.amount, 0);
  const accountingInvalid =
    chargeRows.length !== 1
    || chargedCredits !== operation.plannedCredits
    || refundLedgerInvalid
    || refundedCredits > chargedCredits;
  if (accountingInvalid || snapshots.length > 1) {
    return {
      type: "recovery_required",
      chargedCredits,
      refundedCredits,
    };
  }
  const ensureAngleRefund = async (
    angle: CanonicalViewAngle,
  ): Promise<boolean> => {
    const amount = slotCost(angle);
    const result = await addCredits(
      operation.userId,
      amount,
      "refund",
      "Recovery refund: evidence package view did not settle",
      viewRefundReference(operation, angle),
    );
    return result.success;
  };
  if (snapshots.length === 0) {
    for (const angle of requestedAngles) {
      if (!await ensureAngleRefund(angle)) {
        return {
          type: "recovery_required",
          chargedCredits,
          refundedCredits,
        };
      }
    }
    refundedCredits = chargedCredits;
    await finalizeGenerationOperationFailure({
      userId: operation.userId,
      operationId: operation.id,
      errorCode: "INTERNAL_SERVER_ERROR",
      publicMessage:
        "The view update stopped before it was saved. The charged credits were refunded.",
      chargedCredits,
      refundedCredits,
    });
    return { type: "terminal_failure", chargedCredits, refundedCredits };
  }
  const snapshot = snapshots[0];
  const [model] = await db
    .select()
    .from(models)
    .where(and(
      eq(models.id, operation.modelId),
      eq(models.userId, operation.userId),
    ))
    .limit(1);
  if (!model || model.currentPackageSnapshotId !== snapshot.id) {
    return { type: "recovery_required", chargedCredits, refundedCredits };
  }
  const slots = await db
    .select()
    .from(modelPackageSnapshotSlots)
    .where(eq(modelPackageSnapshotSlots.packageSnapshotId, snapshot.id));
  const changedSlots = slots.filter(
    (slot) =>
      uniqueAngles.has(slot.viewAngle)
      && slot.compatibility === "current"
      && slot.selectionReason !== "carried",
  );
  if (changedSlots.length === 0) {
    return { type: "recovery_required", chargedCredits, refundedCredits };
  }
  const changedAngles = new Set(changedSlots.map((slot) => slot.viewAngle));
  if (changedAngles.size !== changedSlots.length) {
    return { type: "recovery_required", chargedCredits, refundedCredits };
  }
  const selectedIds = changedSlots.map((slot) => slot.selectedAssetId);
  const assets = await db
    .select()
    .from(modelAssets)
    .where(and(
      eq(modelAssets.modelId, operation.modelId),
      inArray(modelAssets.id, selectedIds),
    ));
  if (assets.length !== selectedIds.length) {
    return { type: "recovery_required", chargedCredits, refundedCredits };
  }
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const changedAssetInvalid = changedSlots.some((slot) => {
    const asset = assetById.get(slot.selectedAssetId);
    const provenance = asset?.provenance as {
      source?: unknown;
      acceptedFeatureVersionId?: unknown;
    } | null;
    return (
      !asset?.storageUrl?.trim()
      || asset.viewType !== slot.viewAngle
      || asset.pointsCost !== slotCost(slot.viewAngle)
      || provenance?.source !== "evidence_package_sync"
      || typeof provenance.acceptedFeatureVersionId !== "string"
      || provenance.acceptedFeatureVersionId.length === 0
    );
  });
  const changedRefundReferences = new Set(
    Array.from(changedAngles, (angle) =>
      viewRefundReference(operation, angle as CanonicalViewAngle)
    ),
  );
  if (
    changedAssetInvalid
    || refundRows.some((row) =>
      row.referenceId !== null
      && changedRefundReferences.has(row.referenceId)
    )
  ) {
    return { type: "recovery_required", chargedCredits, refundedCredits };
  }
  const failedAngles = requestedAngles.filter((angle) => !changedAngles.has(angle));
  for (const angle of failedAngles) {
    if (!await ensureAngleRefund(angle)) {
      return { type: "recovery_required", chargedCredits, refundedCredits };
    }
  }
  refundedCredits = failedAngles.reduce(
    (sum, angle) => sum + slotCost(angle),
    0,
  );
  const refreshed = changedSlots.map((slot) => {
    const asset = assetById.get(slot.selectedAssetId);
    if (!asset?.storageUrl) throw new Error("Recovered package asset is invalid");
    return {
      angle: slot.viewAngle,
      assetId: asset.id,
    };
  });
  await finalizeGenerationOperationSuccess({
    userId: operation.userId,
    operationId: operation.id,
    result: { refreshed, failedAngles },
    chargedCredits,
    refundedCredits,
    terminalStatus: failedAngles.length ? "partial" : "succeeded",
  });
  return { type: "durable_success" };
}

type EvidenceMintRecovery =
  | { type: "not_committed" }
  | { type: "durable_success" }
  | { type: "free_failure" }
  | { type: "recovery_required" };

export async function recoverEvidenceMintOperation(
  operation: GenerationOperation,
): Promise<EvidenceMintRecovery> {
  if (operation.kind !== "evidence_mint" || !operation.modelId) {
    return { type: "not_committed" };
  }
  const tier = evidenceMintTier(operation);
  if (
    !tier
    || operation.plannedCredits !== 0
    || operation.chargedCredits !== 0
    || operation.refundedCredits !== 0
  ) {
    return { type: "recovery_required" };
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const accountingRows = operation.chargeReferenceId
    ? await db
      .select({ id: creditTransactions.id })
      .from(creditTransactions)
      .where(and(
        eq(creditTransactions.userId, operation.userId),
        or(
          eq(
            creditTransactions.referenceId,
            operation.chargeReferenceId,
          ),
          eq(
            creditTransactions.referenceId,
            refundReferenceFor(operation.chargeReferenceId),
          ),
        ),
      ))
    : [];
  if (accountingRows.length > 0) {
    return { type: "recovery_required" };
  }
  const snapshots = await db
    .select()
    .from(modelPackageSnapshots)
    .where(and(
      eq(modelPackageSnapshots.modelId, operation.modelId),
      eq(modelPackageSnapshots.createdByOperationId, operation.id),
    ));
  const [model] = await db
    .select()
    .from(models)
    .where(and(
      eq(models.id, operation.modelId),
      eq(models.userId, operation.userId),
    ))
    .limit(1);
  if (!model || snapshots.length > 1) {
    return { type: "recovery_required" };
  }
  if (snapshots.length === 0) {
    const unchangedDraft =
      model.status === "draft"
      && !model.agencyId
      && !model.mintedAt
      && !model.sealedIdentitySnapshotId
      && !model.sealedPackageSnapshotId
      && model.stateVersion === operation.expectedStateVersion
      && (model.currentPackageSnapshotId ?? null)
        === (operation.expectedPackageSnapshotId ?? null);
    if (!unchangedDraft) return { type: "recovery_required" };
    await finalizeGenerationOperationFailure({
      userId: operation.userId,
      operationId: operation.id,
      errorCode: "INTERNAL_SERVER_ERROR",
      publicMessage:
        "Minting stopped before the Cast was sealed. Nothing was charged.",
      chargedCredits: 0,
      refundedCredits: 0,
    });
    return { type: "free_failure" };
  }

  const snapshot = snapshots[0];
  if (
    snapshot.reason !== "mint"
    || snapshot.parentPackageSnapshotId
      !== operation.expectedPackageSnapshotId
    || snapshot.identitySnapshotId
      !== operation.expectedIdentitySnapshotId
    || model.currentPackageSnapshotId !== snapshot.id
    || model.sealedPackageSnapshotId !== snapshot.id
    || model.sealedIdentitySnapshotId !== snapshot.identitySnapshotId
    || model.status !== "active"
    || !model.agencyId?.trim()
    || !model.mintedAt
    || model.stateVersion !== (operation.expectedStateVersion ?? -1) + 1
  ) {
    return { type: "recovery_required" };
  }
  const slots = await db
    .select()
    .from(modelPackageSnapshotSlots)
    .where(eq(modelPackageSnapshotSlots.packageSnapshotId, snapshot.id));
  if (
    slots.length === 0
    || slots.some((slot) =>
      slot.selectionReason !== "carried"
      || !slot.sourceSelectionId
    )
  ) {
    return { type: "recovery_required" };
  }
  const requiredAngles = MINT_TIER_SLOTS[tier];
  const requiredSlots = requiredAngles.map((angle) =>
    slots.find((slot) => slot.viewAngle === angle)
  );
  if (requiredSlots.some((slot) => !slot || slot.compatibility !== "current")) {
    return { type: "recovery_required" };
  }
  const selectedIds = Array.from(new Set(
    slots.map((slot) => slot.selectedAssetId),
  ));
  const assets = await db
    .select()
    .from(modelAssets)
    .where(and(
      eq(modelAssets.modelId, operation.modelId),
      inArray(modelAssets.id, selectedIds),
    ));
  if (
    assets.length !== selectedIds.length
    || slots.some((slot) => {
      const asset = assets.find(
        (candidate) => candidate.id === slot.selectedAssetId,
      );
      return (
        !asset?.storageUrl?.trim()
        || asset.viewType !== slot.viewAngle
      );
    })
  ) {
    return { type: "recovery_required" };
  }
  const frontFull = slots.find((slot) => slot.viewAngle === "frontFull");
  const featureClosure = await withTransaction(async (tx) => {
    const rows = await readEvidencePackageFeatureRowsIn(tx, {
      userId: operation.userId,
      modelId: operation.modelId!,
      identitySnapshotId: snapshot.identitySnapshotId,
    });
    return {
      graph: assessSupportedInkFeatureGraph(
        rows.graph,
        frontFull?.selectedAssetId ?? null,
      ),
      pending: rows.hasUnresolvedIntentOrReadyCandidate,
    };
  });
  if (!featureClosure.graph || featureClosure.pending) {
    return { type: "recovery_required" };
  }
  await finalizeGenerationOperationSuccess({
    userId: operation.userId,
    operationId: operation.id,
    result: {
      agencyId: model.agencyId,
      minted: true,
      tier,
      generated: [],
      failedAngles: [],
    },
    chargedCredits: 0,
    refundedCredits: 0,
  });
  return { type: "durable_success" };
}

export async function adjudicateStaleGenerationOperation(
  operation: GenerationOperation,
  now = new Date(),
): Promise<StaleOperationDecision | "skipped"> {
  if (operation.status !== "claimed" && operation.status !== "running") return "skipped";
  if (!await claimRecoveryAttempt(operation, now)) return "skipped";
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  assertGenerationOperationKind(operation.kind);
  const recoveryStrategy = STALE_RECOVERY_BY_KIND[operation.kind];
  if (operation.kind === "evidence_package_sync") {
    const recovered = await recoverEvidencePackageSyncOperation(operation);
    if (recovered.type === "durable_success") return "durable_success";
    if (recovered.type === "terminal_failure") return "paid_failure";
    if (recovered.type === "recovery_required") {
      await markGenerationOperationRecoveryRequired({
        userId: operation.userId,
        operationId: operation.id,
        publicMessage:
          `This operation needs support review before it can be retried. Operation ${operation.id}.`,
        chargedCredits: recovered.chargedCredits,
        refundedCredits: recovered.refundedCredits,
      });
      return "recovery_required";
    }
  }
  if (operation.kind === "castingV2.roll") {
    /*
      No provider probe is passed, deliberately. §H.6's probe distinguishes
      "the provider never did the work" from "it did and we lost it" — an
      accounting distinction about COGS, not a billing one: the refund happens
      either way because the user has no image either way. Wiring a live fal
      call into the sweep would let a provider outage slow or stall recovery
      for everyone, so recovery stays offline until that telemetry is worth
      the coupling. Every dispatched candidate therefore adjudicates as
      `unrecovered`, which is honest — we genuinely do not know.
    */
    const recovered = await recoverCastingV2RollOperation({
      ...operation,
      // Narrowed above; the row's column type is a bare string.
      status: operation.status === "claimed" ? "claimed" : "running",
    });
    if (recovered.type === "durable_success") return "durable_success";
    // Partial and total failure both end the same way for the sweep: the work
    // is terminal and the owed slices have been refunded. The distinction is
    // recorded on the roll, which is what the client reads.
    if (recovered.type === "partial" || recovered.type === "paid_failure") return "paid_failure";
    // The crash landed before the charge. Terminal, and nothing was taken —
    // the sweep must not report this as a paid failure, because "paid" is what
    // downstream accounting reads to decide money moved.
    if (recovered.type === "free_failure") return "free_failure";
    if (recovered.type === "recovery_required") {
      await markGenerationOperationRecoveryRequired({
        userId: operation.userId,
        operationId: operation.id,
        publicMessage:
          `This operation needs support review before it can be retried. Operation ${operation.id}.`,
        chargedCredits: recovered.chargedCredits,
        refundedCredits: recovered.refundedCredits,
      });
      return "recovery_required";
    }
  }
  if (operation.kind === "evidence_mint") {
    const recovered = await recoverEvidenceMintOperation(operation);
    if (recovered.type === "durable_success") return "durable_success";
    if (recovered.type === "free_failure") return "free_failure";
    if (recovered.type === "recovery_required") {
      await markGenerationOperationRecoveryRequired({
        userId: operation.userId,
        operationId: operation.id,
        publicMessage:
          `This operation needs support review before it can be retried. Operation ${operation.id}.`,
        chargedCredits: 0,
        refundedCredits: 0,
      });
      return "recovery_required";
    }
  }
  if (
    operation.status === "running"
    && recoveryStrategy === "ink_evidence"
  ) {
    const chargeRows = operation.chargeReferenceId
      ? await db.select().from(creditTransactions).where(and(
        eq(creditTransactions.userId, operation.userId),
        eq(creditTransactions.referenceId, operation.chargeReferenceId),
      ))
      : [];
    const refundRows = operation.chargeReferenceId
      ? await db.select().from(creditTransactions).where(and(
        eq(creditTransactions.userId, operation.userId),
        eq(
          creditTransactions.referenceId,
          refundReferenceFor(operation.chargeReferenceId),
        ),
      ))
      : [];
    const charge = chargeRows[0];
    const refund = refundRows[0];
    const chargedCredits =
      charge?.type === "generation" && charge.amount < 0
        ? Math.abs(charge.amount)
        : 0;
    const refundedCredits =
      refund?.type === "refund" && refund.amount > 0
        ? refund.amount
        : 0;
    const accountingMismatch =
      chargeRows.length > 1
      || refundRows.length > 1
      || (!!charge && (charge.type !== "generation" || charge.amount >= 0))
      || (!!refund && (refund.type !== "refund" || refund.amount <= 0))
      || chargedCredits > operation.plannedCredits
      || refundedCredits > chargedCredits
      || (
        operation.plannedCredits > 0
        && chargedCredits !== 0
        && chargedCredits !== operation.plannedCredits
      );
    if (accountingMismatch) {
      await markGenerationOperationRecoveryRequired({
        userId: operation.userId,
        operationId: operation.id,
        publicMessage:
          `This operation needs support review before it can be retried. Operation ${operation.id}.`,
        chargedCredits,
        refundedCredits,
      });
      return "recovery_required";
    }
    const evidenceDecision = await adjudicateStaleInkEvidenceOperation({
      operation,
      chargedCredits,
      refundedCredits,
      now,
    });
    if (evidenceDecision?.type === "durable_success") {
      await finalizeGenerationOperationSuccess({
        userId: operation.userId,
        operationId: operation.id,
        result: evidenceDecision.result,
        chargedCredits: evidenceDecision.chargedCredits,
        refundedCredits: evidenceDecision.refundedCredits,
      });
      return "durable_success";
    }
    if (evidenceDecision?.type === "terminal_failure") {
      let finalRefundedCredits = refundedCredits;
      if (evidenceDecision.needsRefund) {
        if (!operation.chargeReferenceId || chargedCredits === 0) {
          await markGenerationOperationRecoveryRequired({
            userId: operation.userId,
            operationId: operation.id,
            publicMessage:
              `This operation needs support review before it can be retried. Operation ${operation.id}.`,
            chargedCredits,
            refundedCredits,
          });
          return "recovery_required";
        }
        const outcome = await recordRefund(
          operation.userId,
          chargedCredits,
          "Recovery refund: tattoo preview stopped before delivery",
          operation.chargeReferenceId,
        );
        if (!outcome.recorded) {
          await markGenerationOperationRecoveryRequired({
            userId: operation.userId,
            operationId: operation.id,
            publicMessage:
              `This operation needs support review before it can be retried. Operation ${operation.id}.`,
            chargedCredits,
            refundedCredits,
          });
          return "recovery_required";
        }
        finalRefundedCredits = outcome.amount;
      }
      await finalizeGenerationOperationFailure({
        userId: operation.userId,
        operationId: operation.id,
        errorCode: evidenceDecision.errorCode,
        publicMessage: evidenceDecision.publicMessage,
        chargedCredits: evidenceDecision.chargedCredits,
        refundedCredits: finalRefundedCredits,
      });
      return evidenceDecision.chargedCredits > 0
        ? "paid_failure"
        : "free_failure";
    }
    if (evidenceDecision?.type === "recovery_required") {
      await markGenerationOperationRecoveryRequired({
        userId: operation.userId,
        operationId: operation.id,
        publicMessage:
          `This operation needs support review before it can be retried. Operation ${operation.id}.`,
        chargedCredits,
        refundedCredits,
      });
      return "recovery_required";
    }
  }
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
  // evidence_fork_copy publishes its model, assets, optional Canvas placement,
  // and success receipt in one transaction. A stale claimed receipt therefore
  // proves that publication did not commit. Child rows and reserved cleanup
  // objects are pre-publication evidence, not an ambiguous durable result.
  let decision =
    operation.status === "claimed"
      && recoveryStrategy === "evidence_fork"
      && operation.plannedCredits === 0
      && chargedCredits === 0
      && !ledgerDisagrees
      ? "free_failure"
      : classifyStaleOperation(evidence);

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
  if (operation.status === "claimed") {
    await markClaimedGenerationOperationRecoveryRequired({
      userId: operation.userId,
      operationId: operation.id,
      publicMessage: message,
    });
  } else {
    await markGenerationOperationRecoveryRequired({
      userId: operation.userId,
      operationId: operation.id,
      publicMessage: message,
      chargedCredits,
      refundedCredits: existingRefundCredits,
    });
  }
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
