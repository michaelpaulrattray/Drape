/**
 * R7-7A2 private snapshot bootstrap.
 *
 * Converts the current R6 model/document/newest-filled asset truth into one
 * immutable identity snapshot plus one explicit package selection. This file
 * is deliberately not routed or called by production yet: R7-7A3 adopts it
 * under the durable model-operation lock before any dual writer enables.
 */
import { createHash, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import {
  modelAssets,
  modelIdentitySnapshots,
  modelPackageSnapshots,
  modelPackageSnapshotSlots,
  models,
  type Model,
  type ModelAsset,
  type ModelIdentitySnapshot,
  type ModelPackageSnapshot,
  type ModelPackageSnapshotSlot,
} from "../../drizzle/schema";
import { CANONICAL_VIEW_ANGLES, type CanonicalViewAngle } from "../../shared/boardTypes";
import { withTransaction, type TransactionHandle } from "../db/connection";
import { createModuleLogger } from "../logging/logger";
import { buildIdentityAnchor } from "./geminiClient";
import { selectIdentityAnchor, isStaleAsset } from "./identity/anchorSelector";
import { stableCanonicalJson } from "./operationContract";

const log = createModuleLogger("casting/snapshotBootstrap");

export const SNAPSHOT_BOOTSTRAP_RECIPE_VERSION = "r7-snapshot-bootstrap-v1";

export interface DerivedBootstrapSlot {
  viewAngle: CanonicalViewAngle;
  selectedAssetId: number;
  compatibility: "current" | "stale";
}

export interface DerivedBootstrapState {
  identityText: string;
  identityTextHash: string;
  anchorAssetId: number;
  slots: DerivedBootstrapSlot[];
}

export type SnapshotBootstrapResult =
  | { status: "headless"; modelId: number }
  | {
      status: "created" | "converged" | "current";
      modelId: number;
      identitySnapshotId: string;
      packageSnapshotId: string;
      stateVersion: number;
      selectedSlotCount: number;
    };

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Pure R6 adapter. Assets must be newest-first, matching getModelAssets. */
export function deriveBootstrapState(
  model: Pick<Model, "masterPrompt" | "technicalSchema">,
  assets: Array<Pick<ModelAsset, "id" | "viewType" | "storageUrl" | "status" | "provenance">>,
): DerivedBootstrapState | null {
  const anchor = selectIdentityAnchor(assets);
  if (!anchor) return null;
  const identityText = buildIdentityAnchor(model.masterPrompt || "", model.technicalSchema ?? undefined);
  const slots: DerivedBootstrapSlot[] = [];
  for (const angle of CANONICAL_VIEW_ANGLES) {
    const selected = assets.find((asset) => asset.viewType === angle && !!asset.storageUrl);
    if (!selected) continue;
    slots.push({
      viewAngle: angle,
      selectedAssetId: selected.id,
      compatibility: isStaleAsset(selected) ? "stale" : "current",
    });
  }
  return {
    identityText,
    identityTextHash: sha256(identityText),
    anchorAssetId: anchor.id,
    slots,
  };
}

function sameIdentity(
  model: Pick<Model, "masterPrompt" | "technicalSchema" | "preferences">,
  derived: DerivedBootstrapState,
  snapshot: ModelIdentitySnapshot,
): boolean {
  return snapshot.masterPrompt === model.masterPrompt
    && stableCanonicalJson(snapshot.technicalSchema) === stableCanonicalJson(model.technicalSchema)
    && stableCanonicalJson(snapshot.preferences) === stableCanonicalJson(model.preferences)
    && snapshot.identityText === derived.identityText
    && snapshot.identityTextHash === derived.identityTextHash
    && snapshot.anchorAssetId === derived.anchorAssetId;
}

function sameSlots(derived: DerivedBootstrapState, slots: ModelPackageSnapshotSlot[]): boolean {
  if (derived.slots.length !== slots.length) return false;
  const byAngle = new Map(slots.map((slot) => [slot.viewAngle, slot]));
  return derived.slots.every((slot) => {
    const stored = byAngle.get(slot.viewAngle);
    return stored?.selectedAssetId === slot.selectedAssetId
      && stored.compatibility === slot.compatibility;
  });
}

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) return (result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
  return (result as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
}

async function lockedOwnedModelIn(
  tx: TransactionHandle,
  input: { userId: number; modelId: number },
): Promise<Model> {
  const [model] = await tx
    .select()
    .from(models)
    .where(and(
      eq(models.id, input.modelId),
      eq(models.userId, input.userId),
      isNull(models.deletedAt),
      ne(models.status, "archived"),
    ))
    .limit(1)
    .for("update");
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  return model;
}

async function currentHeadIn(tx: TransactionHandle, model: Model): Promise<{
  packageSnapshot: ModelPackageSnapshot;
  identitySnapshot: ModelIdentitySnapshot;
  slots: ModelPackageSnapshotSlot[];
} | null> {
  if (!model.currentPackageSnapshotId) return null;
  const [packageSnapshot] = await tx
    .select()
    .from(modelPackageSnapshots)
    .where(and(
      eq(modelPackageSnapshots.id, model.currentPackageSnapshotId),
      eq(modelPackageSnapshots.modelId, model.id),
    ))
    .limit(1);
  if (!packageSnapshot) throw new Error("The model snapshot head is invalid");
  const [identitySnapshot] = await tx
    .select()
    .from(modelIdentitySnapshots)
    .where(and(
      eq(modelIdentitySnapshots.id, packageSnapshot.identitySnapshotId),
      eq(modelIdentitySnapshots.modelId, model.id),
    ))
    .limit(1);
  if (!identitySnapshot) throw new Error("The model identity snapshot is invalid");
  const slots = await tx
    .select()
    .from(modelPackageSnapshotSlots)
    .where(eq(modelPackageSnapshotSlots.packageSnapshotId, packageSnapshot.id));
  return { packageSnapshot, identitySnapshot, slots };
}

function assertCurrentHeadClosure(
  current: NonNullable<Awaited<ReturnType<typeof currentHeadIn>>>,
  assets: ModelAsset[],
): void {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const anchor = byId.get(current.identitySnapshot.anchorAssetId);
  if (!anchor?.storageUrl || anchor.viewType !== "frontClose") {
    throw new Error("The model identity snapshot anchor is invalid");
  }
  for (const slot of current.slots) {
    const asset = byId.get(slot.selectedAssetId);
    if (!asset?.storageUrl || asset.viewType !== slot.viewAngle) {
      throw new Error("The model package snapshot selection is invalid");
    }
  }
}

async function nextSequencesIn(tx: TransactionHandle, modelId: number): Promise<{
  identity: number;
  package: number;
}> {
  const [latestIdentity] = await tx
    .select({ sequence: modelIdentitySnapshots.sequence })
    .from(modelIdentitySnapshots)
    .where(eq(modelIdentitySnapshots.modelId, modelId))
    .orderBy(desc(modelIdentitySnapshots.sequence))
    .limit(1);
  const [latestPackage] = await tx
    .select({ sequence: modelPackageSnapshots.sequence })
    .from(modelPackageSnapshots)
    .where(eq(modelPackageSnapshots.modelId, modelId))
    .orderBy(desc(modelPackageSnapshots.sequence))
    .limit(1);
  return {
    identity: (latestIdentity?.sequence ?? 0) + 1,
    package: (latestPackage?.sequence ?? 0) + 1,
  };
}

/**
 * Private and free. The model row lock is the bootstrap serialization point;
 * later A3 user operations must additionally hold the durable model lock.
 */
export async function bootstrapModelSnapshot(input: {
  userId: number;
  modelId: number;
}): Promise<SnapshotBootstrapResult> {
  return withTransaction(async (tx) => {
    const model = await lockedOwnedModelIn(tx, input);
    if (
      (!model.currentPackageSnapshotId && model.stateVersion !== 0)
      || (model.currentPackageSnapshotId && model.stateVersion <= 0)
    ) {
      throw new Error("The model snapshot pointer and state version disagree");
    }
    const assets = await tx
      .select()
      .from(modelAssets)
      .where(eq(modelAssets.modelId, model.id))
      .orderBy(desc(modelAssets.createdAt), desc(modelAssets.id));
    const derived = deriveBootstrapState(model, assets);
    if (!derived) return { status: "headless", modelId: model.id };

    const current = await currentHeadIn(tx, model);
    if (current) assertCurrentHeadClosure(current, assets);
    const identityMatches = current ? sameIdentity(model, derived, current.identitySnapshot) : false;
    if (current && identityMatches && sameSlots(derived, current.slots)) {
      return {
        status: "current",
        modelId: model.id,
        identitySnapshotId: current.identitySnapshot.id,
        packageSnapshotId: current.packageSnapshot.id,
        stateVersion: model.stateVersion,
        selectedSlotCount: current.slots.length,
      };
    }

    const sequence = await nextSequencesIn(tx, model.id);
    const identitySnapshotId = identityMatches && current
      ? current.identitySnapshot.id
      : randomUUID();
    if (!identityMatches) {
      await tx.insert(modelIdentitySnapshots).values({
        id: identitySnapshotId,
        modelId: model.id,
        sequence: sequence.identity,
        parentSnapshotId: current?.identitySnapshot.id ?? null,
        reason: "bootstrap",
        masterPrompt: model.masterPrompt,
        technicalSchema: model.technicalSchema,
        preferences: model.preferences,
        identityText: derived.identityText,
        identityTextHash: derived.identityTextHash,
        anchorAssetId: derived.anchorAssetId,
        recipeVersion: SNAPSHOT_BOOTSTRAP_RECIPE_VERSION,
        createdByOperationId: null,
      });
    }

    const packageSnapshotId = randomUUID();
    await tx.insert(modelPackageSnapshots).values({
      id: packageSnapshotId,
      modelId: model.id,
      identitySnapshotId,
      sequence: sequence.package,
      parentPackageSnapshotId: current?.packageSnapshot.id ?? null,
      reason: "bootstrap",
      createdByOperationId: null,
    });
    if (derived.slots.length > 0) {
      await tx.insert(modelPackageSnapshotSlots).values(derived.slots.map((slot) => ({
        id: randomUUID(),
        packageSnapshotId,
        viewAngle: slot.viewAngle,
        selectedAssetId: slot.selectedAssetId,
        compatibility: slot.compatibility,
        selectionReason: "bootstrap" as const,
        sourceSelectionId: null,
      })));
    }

    const nextStateVersion = model.stateVersion + 1;
    const updated = await tx
      .update(models)
      .set({ currentPackageSnapshotId: packageSnapshotId, stateVersion: nextStateVersion })
      .where(and(
        eq(models.id, model.id),
        eq(models.userId, input.userId),
        isNull(models.deletedAt),
        ne(models.status, "archived"),
        eq(models.stateVersion, model.stateVersion),
        sql`${models.currentPackageSnapshotId} <=> ${model.currentPackageSnapshotId}`,
      ));
    if (affectedRows(updated) !== 1) throw new Error("The model changed during snapshot bootstrap");

    const status = current ? "converged" : "created";
    log.info({
      modelId: model.id,
      status,
      stateVersion: nextStateVersion,
      selectedSlotCount: derived.slots.length,
      identityChanged: !identityMatches,
    }, "[snapshotBootstrap] snapshot head committed");
    return {
      status,
      modelId: model.id,
      identitySnapshotId,
      packageSnapshotId,
      stateVersion: nextStateVersion,
      selectedSlotCount: derived.slots.length,
    };
  });
}
