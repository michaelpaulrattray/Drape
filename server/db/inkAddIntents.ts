import { and, eq, isNull } from "drizzle-orm";
import {
  generationOperationLocks,
  generationOperations,
  modelIdentityFeatureIntents,
  modelReferencePlates,
  modelSnapshotFeatureSelections,
  models,
} from "../../drizzle/schema";
import { INK_ADD_CAPABILITY_KEY } from "../casting/evidence/evidenceCandidateContract";
import {
  INK_ADD_ONTOLOGY_VERSION,
  INK_ADD_SIDES,
  INK_ADD_SURFACE,
  INK_ADD_TARGET_VIEW,
  INK_ADD_ZONE,
  type InkAddSide,
} from "../casting/evidence/composer/inkAddRecipe";
import {
  normalizeInkDescriptor,
} from "../casting/evidence/composer/inkAuthorization";
import {
  buildEffectiveCastState,
  type EffectiveCastState,
} from "../casting/effectiveCastState";
import { modelOperationLockKey } from "../casting/operationContract";
import { readSnapshotShadowStateIn } from "../casting/snapshotShadow";
import { getDb, withTransaction, type TransactionHandle } from "./connection";
import { finalizeClaimedGenerationOperationSuccessIn } from "./generationOperations";

export const INK_ADD_INTENT_PUBLIC_MESSAGE =
  "The tattoo preview could not be started. Nothing was charged.";

export type InkAddIntentStateCode =
  | "model_unavailable"
  | "operation_unavailable"
  | "snapshot_unavailable"
  | "source_unavailable"
  | "feature_already_selected"
  | "intent_already_active";

export class InkAddIntentStateError extends Error {
  constructor(public readonly code: InkAddIntentStateCode) {
    super(INK_ADD_INTENT_PUBLIC_MESSAGE);
    this.name = "InkAddIntentStateError";
  }
}

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return Number((result[0] as { affectedRows?: unknown })?.affectedRows ?? 0);
  }
  return Number((result as { affectedRows?: unknown })?.affectedRows ?? 0);
}

async function lockOwnedDraftModelIn(
  tx: TransactionHandle,
  input: { userId: number; modelId: number },
) {
  const [model] = await tx
    .select()
    .from(models)
    .where(and(
      eq(models.id, input.modelId),
      eq(models.userId, input.userId),
      eq(models.status, "draft"),
      isNull(models.deletedAt),
    ))
    .limit(1)
    .for("update");
  if (!model) throw new InkAddIntentStateError("model_unavailable");
  return model;
}

async function lockClaimedIntentOperationIn(
  tx: TransactionHandle,
  input: { userId: number; modelId: number; operationId: string },
) {
  const [operation] = await tx
    .select()
    .from(generationOperations)
    .where(and(
      eq(generationOperations.id, input.operationId),
      eq(generationOperations.userId, input.userId),
      eq(generationOperations.modelId, input.modelId),
      eq(generationOperations.kind, "evidence_intent_begin"),
      eq(generationOperations.status, "claimed"),
    ))
    .limit(1)
    .for("update");
  if (!operation) throw new InkAddIntentStateError("operation_unavailable");

  const [lock] = await tx
    .select({ lockKey: generationOperationLocks.lockKey })
    .from(generationOperationLocks)
    .where(and(
      eq(generationOperationLocks.lockKey, modelOperationLockKey(input.modelId)),
      eq(generationOperationLocks.operationId, input.operationId),
      eq(generationOperationLocks.kind, "evidence_intent_begin"),
    ))
    .limit(1)
    .for("update");
  if (!lock) throw new InkAddIntentStateError("operation_unavailable");
  return operation;
}

export interface BeginInkAddIntentResult {
  intentId: string;
}

/**
 * The claimed operation, intent, and immutable expected head become visible
 * atomically. The model row is locked first and every client child id is
 * re-anchored through the current owner-scoped snapshot in this transaction.
 */
export async function commitBeginInkAddIntent(input: {
  userId: number;
  modelId: number;
  operationId: string;
  intentId: string;
  sourceAssetId: number;
  side: InkAddSide;
  normalizedDescriptor: string;
}): Promise<BeginInkAddIntentResult> {
  return withTransaction(async (tx) => {
    const model = await lockOwnedDraftModelIn(tx, input);
    await lockClaimedIntentOperationIn(tx, input);

    let state: EffectiveCastState;
    try {
      const shadow = await readSnapshotShadowStateIn(tx, {
        userId: input.userId,
        modelId: input.modelId,
      });
      state = buildEffectiveCastState(
        { ...shadow, model },
      );
    } catch {
      throw new InkAddIntentStateError("snapshot_unavailable");
    }
    if (state.status !== "current" || !state.package || !state.identity) {
      throw new InkAddIntentStateError("snapshot_unavailable");
    }
    const source = state.selectedViews.find(
      (view) => view.angle === INK_ADD_TARGET_VIEW,
    );
    if (
      !source
      || source.asset.id !== input.sourceAssetId
      || source.compatibility !== "current"
    ) {
      throw new InkAddIntentStateError("source_unavailable");
    }

    const [selectedFeature] = await tx
      .select({ featureId: modelSnapshotFeatureSelections.featureId })
      .from(modelSnapshotFeatureSelections)
      .where(and(
        eq(modelSnapshotFeatureSelections.modelId, input.modelId),
        eq(
          modelSnapshotFeatureSelections.identitySnapshotId,
          state.identity.id,
        ),
      ))
      .limit(1)
      .for("update");
    if (selectedFeature) {
      throw new InkAddIntentStateError("feature_already_selected");
    }

    const [activeIntent] = await tx
      .select({ id: modelIdentityFeatureIntents.id })
      .from(modelIdentityFeatureIntents)
      .where(and(
        eq(modelIdentityFeatureIntents.modelId, input.modelId),
        eq(
          modelIdentityFeatureIntents.activeCapabilityKey,
          INK_ADD_CAPABILITY_KEY,
        ),
        eq(modelIdentityFeatureIntents.status, "pending"),
      ))
      .limit(1)
      .for("update");
    if (activeIntent) {
      throw new InkAddIntentStateError("intent_already_active");
    }

    const quoted = await tx
      .update(generationOperations)
      .set({
        expectedStateVersion: model.stateVersion,
        expectedPackageSnapshotId: state.package.id,
        expectedIdentityRevisionId: model.identityRevisionId,
      })
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
        eq(generationOperations.modelId, input.modelId),
        eq(generationOperations.kind, "evidence_intent_begin"),
        eq(generationOperations.status, "claimed"),
        isNull(generationOperations.expectedStateVersion),
      ));
    if (affectedRows(quoted) !== 1) {
      throw new InkAddIntentStateError("operation_unavailable");
    }

    await tx.insert(modelIdentityFeatureIntents).values({
      id: input.intentId,
      userId: input.userId,
      modelId: input.modelId,
      capabilityKey: INK_ADD_CAPABILITY_KEY,
      activeCapabilityKey: INK_ADD_CAPABILITY_KEY,
      status: "pending",
      category: "ink",
      operation: "add",
      ontologyVersion: INK_ADD_ONTOLOGY_VERSION,
      zone: INK_ADD_ZONE,
      surface: INK_ADD_SURFACE,
      side: input.side,
      normalizedDescriptor: input.normalizedDescriptor,
      sourceAssetId: input.sourceAssetId,
      expectedStateVersion: model.stateVersion,
      identitySnapshotId: state.identity.id,
      packageSnapshotId: state.package.id,
      createdByOperationId: input.operationId,
    });

    const result = { intentId: input.intentId };
    await finalizeClaimedGenerationOperationSuccessIn(tx, {
      userId: input.userId,
      operationId: input.operationId,
      result,
    });
    return result;
  });
}

export interface OwnedPendingInkIntent {
  id: string;
  userId: number;
  modelId: number;
  side: InkAddSide;
  normalizedDescriptor: string;
  sourceAssetId: number;
  expectedStateVersion: number;
  identitySnapshotId: string;
  packageSnapshotId: string;
  referencePlateId: string | null;
}

export type OwnedInkAddAvailability =
  | "eligible"
  | "model_unavailable"
  | "source_unavailable"
  | "feature_selected";

/**
 * Read-only, owner-scoped capability truth for the Studio door. This mirrors
 * the load-bearing begin-intent checks without taking locks or granting write
 * authority; the mutation repeats every proof under the model lock.
 */
export async function inspectOwnedInkAddAvailability(input: {
  userId: number;
  modelId: number;
}): Promise<OwnedInkAddAvailability> {
  return withTransaction(async (tx) => {
    const [model] = await tx
      .select()
      .from(models)
      .where(and(
        eq(models.id, input.modelId),
        eq(models.userId, input.userId),
        eq(models.status, "draft"),
        isNull(models.deletedAt),
      ))
      .limit(1);
    if (!model) return "model_unavailable";

    let state: EffectiveCastState;
    try {
      const shadow = await readSnapshotShadowStateIn(tx, input);
      state = buildEffectiveCastState({ ...shadow, model });
    } catch {
      return "source_unavailable";
    }
    if (state.status !== "current" || !state.package || !state.identity) {
      return "source_unavailable";
    }
    const source = state.selectedViews.find(
      (view) => view.angle === INK_ADD_TARGET_VIEW,
    );
    if (!source || source.compatibility !== "current") {
      return "source_unavailable";
    }

    const [selectedFeature] = await tx
      .select({ featureId: modelSnapshotFeatureSelections.featureId })
      .from(modelSnapshotFeatureSelections)
      .where(and(
        eq(modelSnapshotFeatureSelections.modelId, input.modelId),
        eq(
          modelSnapshotFeatureSelections.identitySnapshotId,
          state.identity.id,
        ),
      ))
      .limit(1);
    return selectedFeature ? "feature_selected" : "eligible";
  });
}

export async function findOwnedInkIntentClaimSubject(input: {
  userId: number;
  intentId: string;
}): Promise<{ id: string; modelId: number } | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [intent] = await db
    .select({
      id: modelIdentityFeatureIntents.id,
      modelId: modelIdentityFeatureIntents.modelId,
    })
    .from(modelIdentityFeatureIntents)
    .innerJoin(models, and(
      eq(models.id, modelIdentityFeatureIntents.modelId),
      eq(models.userId, input.userId),
      eq(models.status, "draft"),
      isNull(models.deletedAt),
    ))
    .where(and(
      eq(modelIdentityFeatureIntents.id, input.intentId),
      eq(modelIdentityFeatureIntents.userId, input.userId),
      eq(modelIdentityFeatureIntents.capabilityKey, INK_ADD_CAPABILITY_KEY),
    ))
    .limit(1);
  return intent ?? null;
}

export async function findOwnedPendingInkIntent(input: {
  userId: number;
  intentId: string;
}): Promise<OwnedPendingInkIntent | null> {
  return withTransaction(async (tx) => {
    const [intent] = await tx
      .select({
        id: modelIdentityFeatureIntents.id,
        userId: modelIdentityFeatureIntents.userId,
        modelId: modelIdentityFeatureIntents.modelId,
        side: modelIdentityFeatureIntents.side,
        normalizedDescriptor: modelIdentityFeatureIntents.normalizedDescriptor,
        sourceAssetId: modelIdentityFeatureIntents.sourceAssetId,
        expectedStateVersion: modelIdentityFeatureIntents.expectedStateVersion,
        identitySnapshotId: modelIdentityFeatureIntents.identitySnapshotId,
        packageSnapshotId: modelIdentityFeatureIntents.packageSnapshotId,
        referencePlateId: modelReferencePlates.id,
      })
      .from(modelIdentityFeatureIntents)
      .innerJoin(models, and(
        eq(models.id, modelIdentityFeatureIntents.modelId),
        eq(models.userId, input.userId),
        eq(models.status, "draft"),
        isNull(models.deletedAt),
      ))
      .leftJoin(modelReferencePlates, and(
        eq(
          modelReferencePlates.featureIntentId,
          modelIdentityFeatureIntents.id,
        ),
        eq(modelReferencePlates.userId, input.userId),
        eq(
          modelReferencePlates.modelId,
          modelIdentityFeatureIntents.modelId,
        ),
      ))
      .where(and(
        eq(modelIdentityFeatureIntents.id, input.intentId),
        eq(modelIdentityFeatureIntents.userId, input.userId),
        eq(modelIdentityFeatureIntents.capabilityKey, INK_ADD_CAPABILITY_KEY),
        eq(modelIdentityFeatureIntents.status, "pending"),
        eq(
          modelIdentityFeatureIntents.activeCapabilityKey,
          INK_ADD_CAPABILITY_KEY,
        ),
      ))
      .limit(1);
    if (!intent || !intent.normalizedDescriptor) return null;
    if (
      !(INK_ADD_SIDES as readonly string[]).includes(intent.side)
      || normalizeInkDescriptor(intent.normalizedDescriptor)
        !== intent.normalizedDescriptor
    ) {
      throw new InkAddIntentStateError("snapshot_unavailable");
    }
    return intent as OwnedPendingInkIntent;
  });
}

export async function findActiveOwnedInkIntent(input: {
  userId: number;
  modelId: number;
}): Promise<OwnedPendingInkIntent | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [intent] = await db
    .select({ id: modelIdentityFeatureIntents.id })
    .from(modelIdentityFeatureIntents)
    .where(and(
      eq(modelIdentityFeatureIntents.userId, input.userId),
      eq(modelIdentityFeatureIntents.modelId, input.modelId),
      eq(modelIdentityFeatureIntents.status, "pending"),
      eq(
        modelIdentityFeatureIntents.activeCapabilityKey,
        INK_ADD_CAPABILITY_KEY,
      ),
    ))
    .limit(1);
  return intent
    ? findOwnedPendingInkIntent({ userId: input.userId, intentId: intent.id })
    : null;
}
