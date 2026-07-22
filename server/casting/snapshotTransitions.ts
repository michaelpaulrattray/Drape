/**
 * R7-7A3 private atomic snapshot transition boundary.
 *
 * Live writers adopt this wrapper one-by-one. The legacy model/asset writes
 * supplied by `mutate` and the immutable snapshot/package-head append commit
 * in one database transaction or roll back together. R6 remains read
 * authority throughout R7-7A; this module creates shadow truth only.
 */
import { createHash, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import {
  generationOperationLocks,
  generationOperations,
  IDENTITY_SNAPSHOT_REASONS,
  modelAssets,
  modelIdentitySnapshots,
  modelPackageSnapshots,
  modelPackageSnapshotSlots,
  models,
  PACKAGE_SLOT_COMPATIBILITY,
  PACKAGE_SLOT_SELECTION_REASONS,
  PACKAGE_SNAPSHOT_REASONS,
  type Model,
  type ModelAsset,
  type ModelIdentitySnapshot,
  type ModelPackageSnapshot,
  type ModelPackageSnapshotSlot,
} from "../../drizzle/schema";
import { CANONICAL_VIEW_ANGLES, type CanonicalViewAngle } from "../../shared/boardTypes";
import { withTransaction, type TransactionHandle } from "../db/connection";
import { buildIdentityAnchor } from "./geminiClient";
import { stableCanonicalJson, type GenerationOperationKind } from "./operationContract";
import { prepareRestoreSlotTransition } from "./restoreSlotTransition";
import {
  currentRevisionId,
  identityStampFor,
  mintRevisionId,
  selectStaleSiblingHeads,
} from "./identity/anchorSelector";
import {
  computeIdentityCommit,
  type IdentityCommitResult,
} from "./identity/identityCommit";
import type { AuthorizedIdentityPatch } from "./identity/identityTypes";

type IdentitySnapshotReason = (typeof IDENTITY_SNAPSHOT_REASONS)[number];
type PackageSnapshotReason = (typeof PACKAGE_SNAPSHOT_REASONS)[number];
type PackageSlotCompatibility = (typeof PACKAGE_SLOT_COMPATIBILITY)[number];
type PackageSlotSelectionReason = (typeof PACKAGE_SLOT_SELECTION_REASONS)[number];

export interface SnapshotSlotChange {
  viewAngle: CanonicalViewAngle;
  selectedAssetId: number;
  compatibility: PackageSlotCompatibility;
  selectionReason: Exclude<PackageSlotSelectionReason, "carried" | "bootstrap">;
}

export interface SnapshotIdentityChange {
  reason: Exclude<IdentitySnapshotReason, "bootstrap">;
  anchorAssetId: number;
  recipeVersion: string;
  restoredFromSnapshotId?: string | null;
}

export interface SnapshotTransitionSpec {
  packageReason: Exclude<PackageSnapshotReason, "bootstrap">;
  identity?: SnapshotIdentityChange;
  slotChanges?: SnapshotSlotChange[];
  /** Mint adoption sets this only after its existing draft→active CAS has
   * succeeded inside the same callback transaction. */
  seal?: boolean;
}

export interface CurrentSnapshotHead {
  packageSnapshot: ModelPackageSnapshot;
  identitySnapshot: ModelIdentitySnapshot;
  slots: ModelPackageSnapshotSlot[];
}

export interface SnapshotTransitionContext {
  model: Model;
  current: CurrentSnapshotHead | null;
}

export interface SnapshotTransitionResult<Result> {
  result: Result;
  modelId: number;
  identitySnapshotId: string;
  packageSnapshotId: string;
  stateVersion: number;
  selectedSlotCount: number;
}

/** Stable recovery signal for a lost response after the atomic transition
 * committed. Adopting executors must never string-match a generic error. */
export class SnapshotTransitionAlreadyCommittedError extends Error {
  readonly packageSnapshotId: string;

  constructor(packageSnapshotId: string) {
    super("This operation already committed a package snapshot");
    this.name = "SnapshotTransitionAlreadyCommittedError";
    this.packageSnapshotId = packageSnapshotId;
  }
}

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) return (result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
  return (result as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sameDocument(
  model: Pick<Model, "masterPrompt" | "technicalSchema" | "preferences">,
  identity: Pick<ModelIdentitySnapshot, "masterPrompt" | "technicalSchema" | "preferences">,
): boolean {
  return model.masterPrompt === identity.masterPrompt
    && stableCanonicalJson(model.technicalSchema) === stableCanonicalJson(identity.technicalSchema)
    && stableCanonicalJson(model.preferences) === stableCanonicalJson(identity.preferences);
}

function assertReasonPair(identity: SnapshotIdentityChange, packageReason: SnapshotTransitionSpec["packageReason"]): void {
  const expected: Record<SnapshotIdentityChange["reason"], SnapshotTransitionSpec["packageReason"]> = {
    create: "create",
    identity_edit: "identity_change",
    anchor_reroll: "identity_change",
    document_compact: "identity_change",
    evidence_accept: "identity_change",
    evidence_remove: "identity_change",
    restore: "whole_restore",
    fork_bootstrap: "create",
  };
  if (expected[identity.reason] !== packageReason) {
    throw new Error("Identity and package snapshot reasons disagree");
  }
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

async function currentHeadIn(tx: TransactionHandle, model: Model): Promise<CurrentSnapshotHead | null> {
  if (!model.currentPackageSnapshotId) {
    if (model.stateVersion !== 0) throw new Error("The model snapshot pointer and state version disagree");
    return null;
  }
  if (model.stateVersion <= 0) throw new Error("The model snapshot pointer and state version disagree");
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

async function assertHeadClosureIn(
  tx: TransactionHandle,
  modelId: number,
  current: CurrentSnapshotHead,
): Promise<void> {
  const selectedIds = Array.from(new Set([
    current.identitySnapshot.anchorAssetId,
    ...current.slots.map((slot) => slot.selectedAssetId),
  ]));
  const assets = selectedIds.length > 0
    ? await tx.select().from(modelAssets).where(inArray(modelAssets.id, selectedIds))
    : [];
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const anchor = byId.get(current.identitySnapshot.anchorAssetId);
  if (!anchor || anchor.modelId !== modelId || anchor.viewType !== "frontClose" || !anchor.storageUrl.trim()) {
    throw new Error("The model identity snapshot anchor is invalid");
  }
  const seenAngles = new Set<string>();
  const seenAssets = new Set<number>();
  for (const slot of current.slots) {
    if (seenAngles.has(slot.viewAngle) || seenAssets.has(slot.selectedAssetId)) {
      throw new Error("The model package snapshot contains duplicate selections");
    }
    seenAngles.add(slot.viewAngle);
    seenAssets.add(slot.selectedAssetId);
    const asset = byId.get(slot.selectedAssetId);
    if (!asset || asset.modelId !== modelId || asset.viewType !== slot.viewAngle || !asset.storageUrl.trim()) {
      throw new Error("The model package snapshot selection is invalid");
    }
  }
  if (!seenAngles.has("frontClose")) throw new Error("The model package snapshot has no displayed headshot");
}

async function nextSequencesIn(tx: TransactionHandle, modelId: number): Promise<{ identity: number; package: number }> {
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

function expectedHeadMatches(input: {
  expectedStateVersion: number | null;
  expectedIdentitySnapshotId: string | null;
  expectedPackageSnapshotId: string | null;
  model: Model;
  current: CurrentSnapshotHead | null;
}): boolean {
  return input.expectedStateVersion === input.model.stateVersion
    && input.expectedPackageSnapshotId === (input.model.currentPackageSnapshotId ?? null)
    && input.expectedIdentitySnapshotId === (input.current?.identitySnapshot.id ?? null);
}

async function validateFinalSelectionsIn(
  tx: TransactionHandle,
  modelId: number,
  slots: Array<{
    viewAngle: CanonicalViewAngle;
    selectedAssetId: number;
    compatibility: PackageSlotCompatibility;
    selectionReason: PackageSlotSelectionReason;
    sourceSelectionId: string | null;
  }>,
): Promise<void> {
  if (slots.length === 0) throw new Error("A package snapshot must select a displayed headshot");
  const selectedIds = slots.map((slot) => slot.selectedAssetId);
  if (new Set(selectedIds).size !== selectedIds.length) {
    throw new Error("A package snapshot cannot select one asset for multiple views");
  }
  const assets = await tx.select().from(modelAssets).where(inArray(modelAssets.id, selectedIds));
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  for (const slot of slots) {
    const asset = byId.get(slot.selectedAssetId);
    if (!asset || asset.modelId !== modelId || asset.viewType !== slot.viewAngle || !asset.storageUrl.trim()) {
      throw new Error(`The ${slot.viewAngle} package selection is invalid`);
    }
  }
  if (!slots.some((slot) => slot.viewAngle === "frontClose")) {
    throw new Error("A package snapshot must select a displayed headshot");
  }
}

/**
 * Run one legacy writer and its immutable snapshot append atomically.
 *
 * This is deliberately server-private. Callers pass no expected snapshot
 * authority: the function reads it from the already-running durable receipt.
 */
export async function commitModelSnapshotTransition<Result>(input: {
  userId: number;
  modelId: number;
  operationId: string;
  expectedKind: GenerationOperationKind;
  mutate: (
    tx: TransactionHandle,
    context: SnapshotTransitionContext,
  ) => Promise<{ result: Result; transition: SnapshotTransitionSpec }>;
}): Promise<SnapshotTransitionResult<Result>> {
  return withTransaction(async (tx) => {
    // Shared lock order: model row → operation receipt → operation lock.
    const model = await lockedOwnedModelIn(tx, input);
    const current = await currentHeadIn(tx, model);
    if (current) await assertHeadClosureIn(tx, model.id, current);

    const [operation] = await tx
      .select({
        id: generationOperations.id,
        userId: generationOperations.userId,
        modelId: generationOperations.modelId,
        kind: generationOperations.kind,
        status: generationOperations.status,
        expectedIdentityRevisionId: generationOperations.expectedIdentityRevisionId,
        expectedStateVersion: generationOperations.expectedStateVersion,
        expectedIdentitySnapshotId: generationOperations.expectedIdentitySnapshotId,
        expectedPackageSnapshotId: generationOperations.expectedPackageSnapshotId,
      })
      .from(generationOperations)
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
      ))
      .limit(1)
      .for("update");
    if (
      !operation
      || operation.status !== "running"
      || operation.modelId !== input.modelId
      || operation.kind !== input.expectedKind
    ) {
      throw new Error("The running snapshot operation was not found");
    }
    const [ownedLock] = await tx
      .select({ operationId: generationOperationLocks.operationId })
      .from(generationOperationLocks)
      .where(eq(generationOperationLocks.lockKey, `model:${input.modelId}`))
      .limit(1)
      .for("update");
    if (ownedLock?.operationId !== input.operationId) {
      throw new Error("The operation no longer owns the model lock");
    }
    const [existingTransition] = await tx
      .select({ id: modelPackageSnapshots.id })
      .from(modelPackageSnapshots)
      .where(and(
        eq(modelPackageSnapshots.modelId, input.modelId),
        eq(modelPackageSnapshots.createdByOperationId, input.operationId),
      ))
      .limit(1);
    if (existingTransition) {
      throw new SnapshotTransitionAlreadyCommittedError(existingTransition.id);
    }
    if (!expectedHeadMatches({
      expectedStateVersion: operation.expectedStateVersion,
      expectedIdentitySnapshotId: operation.expectedIdentitySnapshotId,
      expectedPackageSnapshotId: operation.expectedPackageSnapshotId,
      model,
      current,
    })) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This Cast changed while the operation was running. Nothing was saved.",
      });
    }
    const currentRevision = model.identityRevisionId ?? null;
    const expectedRevision = operation.expectedIdentityRevisionId ?? null;
    if (
      expectedRevision !== currentRevision
      && !(currentRevision === null && expectedRevision === "genesis")
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This Cast identity changed while the operation was running. Nothing was saved.",
      });
    }

    const mutation = await input.mutate(tx, { model, current });
    const { transition } = mutation;
    const packageReason = transition.packageReason as string;
    if (!(PACKAGE_SNAPSHOT_REASONS as readonly string[]).includes(packageReason) || packageReason === "bootstrap") {
      throw new Error("Unknown live package snapshot reason");
    }
    if (transition.identity) assertReasonPair(transition.identity, transition.packageReason);
    if (transition.seal && transition.packageReason !== "mint") {
      throw new Error("Only a mint package transition may seal a Cast");
    }
    if (transition.identity && model.status !== "draft") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Minted identity is immutable — fork it." });
    }
    if (transition.identity) {
      const identityReason = transition.identity.reason as string;
      if (
        !(IDENTITY_SNAPSHOT_REASONS as readonly string[]).includes(identityReason)
        || identityReason === "bootstrap"
      ) {
        throw new Error("Unknown live identity snapshot reason");
      }
      if (!transition.identity.recipeVersion.trim() || transition.identity.recipeVersion.length > 64) {
        throw new Error("Identity snapshot recipeVersion must be 1–64 characters");
      }
      if (transition.identity.reason === "document_compact" && (transition.slotChanges?.length ?? 0) > 0) {
        throw new Error("Document compaction cannot change package selections");
      }
    }

    const [postModel] = await tx
      .select()
      .from(models)
      .where(and(
        eq(models.id, input.modelId),
        eq(models.userId, input.userId),
        isNull(models.deletedAt),
        ne(models.status, "archived"),
      ))
      .limit(1);
    if (!postModel) throw new Error("Model is no longer available");
    if (
      postModel.stateVersion !== model.stateVersion
      || (postModel.currentPackageSnapshotId ?? null) !== (model.currentPackageSnapshotId ?? null)
    ) {
      throw new Error("The legacy writer changed snapshot authority directly");
    }
    if (
      (postModel.sealedIdentitySnapshotId ?? null) !== (model.sealedIdentitySnapshotId ?? null)
      || (postModel.sealedPackageSnapshotId ?? null) !== (model.sealedPackageSnapshotId ?? null)
    ) {
      throw new Error("The legacy writer changed snapshot seal authority directly");
    }

    const lifecycleChanged = postModel.status !== model.status;
    if (
      lifecycleChanged
      && !(
        model.status === "draft"
        && postModel.status === "active"
        && transition.packageReason === "mint"
        && transition.seal === true
      )
    ) {
      throw new Error("A snapshot transition cannot change the model lifecycle outside mint");
    }
    if (
      transition.packageReason === "mint"
      && !(
        model.status === "draft"
        && postModel.status === "active"
        && transition.seal === true
      )
    ) {
      throw new Error("A mint snapshot requires the existing draft-to-active transition and seal");
    }

    if (!transition.identity && current && !sameDocument(postModel, current.identitySnapshot)) {
      throw new Error("A package-only transition cannot change identity documents");
    }
    if (!transition.identity && (postModel.identityRevisionId ?? null) !== (model.identityRevisionId ?? null)) {
      throw new Error("A package-only transition cannot change the identity revision");
    }
    if (
      transition.identity
      && !["create", "fork_bootstrap", "document_compact"].includes(transition.identity.reason)
      && (
        !postModel.identityRevisionId
        || postModel.identityRevisionId === model.identityRevisionId
      )
    ) {
      throw new Error("An identity-changing transition must advance the legacy identity revision");
    }

    const staleCarried = !!transition.identity && transition.identity.reason !== "document_compact";
    const finalByAngle = new Map<CanonicalViewAngle, {
      viewAngle: CanonicalViewAngle;
      selectedAssetId: number;
      compatibility: PackageSlotCompatibility;
      selectionReason: PackageSlotSelectionReason;
      sourceSelectionId: string | null;
    }>();
    for (const slot of current?.slots ?? []) {
      finalByAngle.set(slot.viewAngle as CanonicalViewAngle, {
        viewAngle: slot.viewAngle as CanonicalViewAngle,
        selectedAssetId: slot.selectedAssetId,
        compatibility: staleCarried ? "stale" : slot.compatibility,
        selectionReason: "carried",
        sourceSelectionId: slot.id,
      });
    }
    const changedAngles = new Set<CanonicalViewAngle>();
    for (const change of transition.slotChanges ?? []) {
      const selectionReason = change.selectionReason as string;
      if (
        !CANONICAL_VIEW_ANGLES.includes(change.viewAngle)
        || !PACKAGE_SLOT_COMPATIBILITY.includes(change.compatibility)
        || !(PACKAGE_SLOT_SELECTION_REASONS as readonly string[]).includes(selectionReason)
        || selectionReason === "carried"
        || selectionReason === "bootstrap"
        || changedAngles.has(change.viewAngle)
      ) {
        throw new Error("A snapshot transition contains duplicate or unknown view changes");
      }
      changedAngles.add(change.viewAngle);
      finalByAngle.set(change.viewAngle, {
        ...change,
        sourceSelectionId: current?.slots.find((slot) => slot.viewAngle === change.viewAngle)?.id ?? null,
      });
    }
    const finalSlots = CANONICAL_VIEW_ANGLES
      .map((angle) => finalByAngle.get(angle))
      .filter((slot): slot is NonNullable<typeof slot> => !!slot);
    await validateFinalSelectionsIn(tx, input.modelId, finalSlots);

    const sequences = await nextSequencesIn(tx, input.modelId);
    let identitySnapshotId = current?.identitySnapshot.id ?? null;
    if (transition.identity) {
      const [anchorAsset] = await tx
        .select({ id: modelAssets.id, modelId: modelAssets.modelId, viewType: modelAssets.viewType, storageUrl: modelAssets.storageUrl })
        .from(modelAssets)
        .where(eq(modelAssets.id, transition.identity.anchorAssetId))
        .limit(1);
      if (
        !anchorAsset
        || anchorAsset.modelId !== input.modelId
        || anchorAsset.viewType !== "frontClose"
        || !anchorAsset.storageUrl.trim()
      ) {
        throw new Error("The identity snapshot anchor is invalid");
      }
      const displayedHeadshot = finalSlots.find((slot) => slot.viewAngle === "frontClose");
      if (
        transition.identity.reason !== "document_compact"
        && displayedHeadshot?.selectedAssetId !== transition.identity.anchorAssetId
      ) {
        throw new Error("The identity anchor must be the selected displayed headshot");
      }
      if (
        transition.identity.reason === "document_compact"
        && transition.identity.anchorAssetId !== current?.identitySnapshot.anchorAssetId
      ) {
        throw new Error("Document compaction cannot change the identity anchor");
      }
      if (transition.identity.restoredFromSnapshotId) {
        const [restoredFrom] = await tx
          .select({ id: modelIdentitySnapshots.id })
          .from(modelIdentitySnapshots)
          .where(and(
            eq(modelIdentitySnapshots.id, transition.identity.restoredFromSnapshotId),
            eq(modelIdentitySnapshots.modelId, input.modelId),
          ))
          .limit(1);
        if (!restoredFrom) throw new Error("The restored identity snapshot is invalid");
      }
      const identityText = buildIdentityAnchor(postModel.masterPrompt, postModel.technicalSchema ?? undefined);
      identitySnapshotId = randomUUID();
      await tx.insert(modelIdentitySnapshots).values({
        id: identitySnapshotId,
        modelId: input.modelId,
        sequence: sequences.identity,
        parentSnapshotId: current?.identitySnapshot.id ?? null,
        restoredFromSnapshotId: transition.identity.restoredFromSnapshotId ?? null,
        reason: transition.identity.reason,
        masterPrompt: postModel.masterPrompt,
        technicalSchema: postModel.technicalSchema,
        preferences: postModel.preferences,
        identityText,
        identityTextHash: sha256(identityText),
        anchorAssetId: transition.identity.anchorAssetId,
        recipeVersion: transition.identity.recipeVersion,
        createdByOperationId: input.operationId,
      });
    }
    if (!identitySnapshotId) throw new Error("A first package transition requires an identity snapshot");

    if (postModel.status !== "draft" && postModel.sealedIdentitySnapshotId) {
      if (transition.identity || identitySnapshotId !== postModel.sealedIdentitySnapshotId) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Minted identity is immutable — fork it." });
      }
    }

    const packageSnapshotId = randomUUID();
    await tx.insert(modelPackageSnapshots).values({
      id: packageSnapshotId,
      modelId: input.modelId,
      identitySnapshotId,
      sequence: sequences.package,
      parentPackageSnapshotId: current?.packageSnapshot.id ?? null,
      reason: transition.packageReason,
      createdByOperationId: input.operationId,
    });
    await tx.insert(modelPackageSnapshotSlots).values(finalSlots.map((slot) => ({
      id: randomUUID(),
      packageSnapshotId,
      ...slot,
    })));

    if (model.status === "draft" && postModel.status !== "draft" && !transition.seal) {
      throw new Error("The draft-to-minted transition must seal its snapshot head");
    }
    if (transition.seal && postModel.status === "draft") {
      throw new Error("A Cast must complete its existing mint transition before snapshot sealing");
    }
    if (
      transition.seal
      && (postModel.sealedIdentitySnapshotId !== null || postModel.sealedPackageSnapshotId !== null)
    ) {
      throw new Error("The Cast already has a sealed snapshot head");
    }
    const nextStateVersion = model.stateVersion + 1;
    const advanced = await tx
      .update(models)
      .set({
        currentPackageSnapshotId: packageSnapshotId,
        stateVersion: nextStateVersion,
        ...(transition.seal ? {
          sealedIdentitySnapshotId: identitySnapshotId,
          sealedPackageSnapshotId: packageSnapshotId,
        } : {}),
      })
      .where(and(
        eq(models.id, input.modelId),
        eq(models.userId, input.userId),
        isNull(models.deletedAt),
        ne(models.status, "archived"),
        eq(models.stateVersion, model.stateVersion),
        sql`${models.currentPackageSnapshotId} <=> ${model.currentPackageSnapshotId}`,
      ));
    if (affectedRows(advanced) !== 1) throw new Error("The model changed during snapshot transition");

    return {
      result: mutation.result,
      modelId: input.modelId,
      identitySnapshotId,
      packageSnapshotId,
      stateVersion: nextStateVersion,
      selectedSlotCount: finalSlots.length,
    };
  });
}

const DOCUMENT_COMPACTION_RECIPE_VERSION = "r7-document-compact-v1";

/** First live R7-7A3 adopter. The free compact-prompt door keeps its existing
 * protected-language decision outside this transaction; only an accepted,
 * genuinely changed document reaches this paired identity/package commit. */
export async function commitDocumentCompactionSnapshot(input: {
  userId: number;
  modelId: number;
  operationId: string;
  compactedMasterPrompt: string;
}): Promise<SnapshotTransitionResult<{ masterPrompt: string }>> {
  if (!input.compactedMasterPrompt.trim()) {
    throw new Error("A compacted identity document cannot be empty");
  }
  return commitModelSnapshotTransition({
    userId: input.userId,
    modelId: input.modelId,
    operationId: input.operationId,
    expectedKind: "casting.compact",
    mutate: async (tx, context) => {
      if (!context.current) throw new Error("Prompt compaction requires a bootstrapped snapshot head");
      const updated = await tx
        .update(models)
        .set({ masterPrompt: input.compactedMasterPrompt })
        .where(and(
          eq(models.id, input.modelId),
          eq(models.userId, input.userId),
          eq(models.status, "draft"),
          isNull(models.deletedAt),
        ));
      if (affectedRows(updated) !== 1) throw new Error("The draft identity document is no longer available");
      return {
        result: { masterPrompt: input.compactedMasterPrompt },
        transition: {
          packageReason: "identity_change",
          identity: {
            reason: "document_compact",
            anchorAssetId: context.current.identitySnapshot.anchorAssetId,
            recipeVersion: DOCUMENT_COMPACTION_RECIPE_VERSION,
          },
        },
      };
    },
  });
}

/** Free D-53 copy-forward restore, now committed as one legacy asset append
 * plus one immutable package selection. R6 remains the read authority. */
export async function commitRestoredSlotSnapshot(input: {
  userId: number;
  modelId: number;
  operationId: string;
  angle: CanonicalViewAngle;
  assetId: number;
}): Promise<SnapshotTransitionResult<{
  modelId: number;
  angle: CanonicalViewAngle;
  assetId: number;
  url: string;
  version: number;
}>> {
  return commitModelSnapshotTransition({
    userId: input.userId,
    modelId: input.modelId,
    operationId: input.operationId,
    expectedKind: "casting.restore",
    mutate: async (tx, context) => {
      if (!context.current) throw new Error("Slot restore requires a bootstrapped snapshot head");
      const assets = await tx
        .select()
        .from(modelAssets)
        .where(eq(modelAssets.modelId, input.modelId))
        .orderBy(desc(modelAssets.createdAt), desc(modelAssets.id));
      const prepared = prepareRestoreSlotTransition({
        userId: input.userId,
        model: context.model,
        assets,
        angle: input.angle,
        assetId: input.assetId,
      });
      const [inserted] = await tx.insert(modelAssets).values(prepared.assetInsert).$returningId();
      if (!inserted?.id) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Restore failed — nothing was changed" });
      }
      return {
        result: {
          modelId: input.modelId,
          angle: input.angle,
          assetId: inserted.id,
          url: prepared.url,
          version: prepared.version,
        },
        transition: {
          packageReason: "slot_restore",
          slotChanges: [{
            viewAngle: input.angle,
            selectedAssetId: inserted.id,
            compatibility: "current",
            selectionReason: "restored",
          }],
        },
      };
    },
  });
}

interface IterationCandidate {
  storageUrl: string;
  storageKey?: string;
  engine?: string;
  pointsCost: number;
  targetAssetId: number;
}

async function selectedIterationTargetIn(
  tx: TransactionHandle,
  modelId: number,
  targetAssetId: number,
): Promise<ModelAsset & { viewType: CanonicalViewAngle }> {
  const [target] = await tx
    .select()
    .from(modelAssets)
    .where(and(eq(modelAssets.id, targetAssetId), eq(modelAssets.modelId, modelId)))
    .limit(1);
  if (
    !target
    || !CANONICAL_VIEW_ANGLES.includes(target.viewType as CanonicalViewAngle)
    || !target.storageUrl?.trim()
  ) {
    throw new TRPCError({ code: "NOT_FOUND", message: "The selected Cast view is no longer available" });
  }
  return target as ModelAsset & { viewType: CanonicalViewAngle };
}

function assertIterationCandidate(candidate: IterationCandidate): void {
  if (!candidate.storageUrl.trim()) throw new Error("The generated iteration image is unavailable");
  if (!Number.isInteger(candidate.pointsCost) || candidate.pointsCost < 0) {
    throw new Error("The iteration cost is invalid");
  }
}

/** Paid image-only iteration: one legacy display asset plus one complete
 * package selection, atomically. Identity documents and anchor stay fixed. */
export async function commitImageRefineSnapshot(input: {
  userId: number;
  modelId: number;
  operationId: string;
  candidate: IterationCandidate;
  imageOnlyCategories: string[];
}): Promise<SnapshotTransitionResult<{ assetId: number }>> {
  assertIterationCandidate(input.candidate);
  return commitModelSnapshotTransition({
    userId: input.userId,
    modelId: input.modelId,
    operationId: input.operationId,
    expectedKind: "casting.iterate",
    mutate: async (tx, context) => {
      if (!context.current) throw new Error("Image refinement requires a bootstrapped snapshot head");
      const target = await selectedIterationTargetIn(
        tx,
        input.modelId,
        input.candidate.targetAssetId,
      );
      const currentIdentityText = buildIdentityAnchor(
        context.model.masterPrompt || "",
        context.model.technicalSchema ?? undefined,
      );
      const [inserted] = await tx.insert(modelAssets).values({
        modelId: input.modelId,
        viewType: target.viewType,
        resolution: "1K",
        storageUrl: input.candidate.storageUrl,
        storageKey: input.candidate.storageKey ?? null,
        pointsCost: input.candidate.pointsCost,
        pinned: false,
        provenance: {
          inputs: [{ viewAngle: target.viewType, imageUrl: target.storageUrl }],
          ...(input.candidate.engine ? { engine: input.candidate.engine } : {}),
          imageOnlyCategories: input.imageOnlyCategories,
          ...identityStampFor({
            role: "display",
            revisionId: currentRevisionId(context.model),
            identityText: currentIdentityText,
          }),
        },
      }).$returningId();
      if (!inserted?.id) throw new Error("The generated edit could not be saved");
      return {
        result: { assetId: inserted.id },
        transition: {
          packageReason: "image_refine",
          slotChanges: [{
            viewAngle: target.viewType,
            selectedAssetId: inserted.id,
            compatibility: "current",
            selectionReason: "generated",
          }],
        },
      };
    },
  });
}

const IDENTITY_EDIT_RECIPE_VERSION = "r7-identity-edit-v1";

/** Paid typed identity iteration: document/revision/anchor/stale writes and
 * the paired immutable identity/package snapshots commit or roll back as one. */
export async function commitIteratedIdentitySnapshot(input: {
  userId: number;
  modelId: number;
  operationId: string;
  patch: AuthorizedIdentityPatch;
  candidate: IterationCandidate;
}): Promise<SnapshotTransitionResult<IdentityCommitResult>> {
  assertIterationCandidate(input.candidate);
  return commitModelSnapshotTransition({
    userId: input.userId,
    modelId: input.modelId,
    operationId: input.operationId,
    expectedKind: "casting.iterate",
    mutate: async (tx, context) => {
      if (!context.current) throw new Error("Identity iteration requires a bootstrapped snapshot head");
      if (context.model.status !== "draft") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Minted identity is immutable — fork it." });
      }
      const target = await selectedIterationTargetIn(
        tx,
        input.modelId,
        input.candidate.targetAssetId,
      );
      if (target.viewType !== "frontClose") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Identity changes happen on the current headshot.",
        });
      }
      const assets = await tx
        .select()
        .from(modelAssets)
        .where(eq(modelAssets.modelId, input.modelId))
        .orderBy(desc(modelAssets.createdAt), desc(modelAssets.id));
      const computed = computeIdentityCommit(context.model, input.patch);
      const revisionId = mintRevisionId();
      const identityText = buildIdentityAnchor(computed.masterPrompt, computed.technicalSchema);
      const staleIds = selectStaleSiblingHeads(assets, "frontClose");
      const updated = await tx.update(models).set({
        masterPrompt: computed.masterPrompt,
        technicalSchema: computed.technicalSchema,
        preferences: computed.preferences,
        identityRevisionId: revisionId,
      }).where(and(
        eq(models.id, input.modelId),
        eq(models.userId, input.userId),
        eq(models.status, "draft"),
        isNull(models.deletedAt),
      ));
      if (affectedRows(updated) !== 1) throw new Error("The draft identity is no longer available");
      const [inserted] = await tx.insert(modelAssets).values({
        modelId: input.modelId,
        viewType: "frontClose",
        resolution: "1K",
        storageUrl: input.candidate.storageUrl,
        storageKey: input.candidate.storageKey ?? null,
        pointsCost: input.candidate.pointsCost,
        pinned: false,
        provenance: {
          inputs: [{ viewAngle: target.viewType, imageUrl: target.storageUrl }],
          ...(input.candidate.engine ? { engine: input.candidate.engine } : {}),
          ...identityStampFor({ role: "anchor", revisionId, identityText }),
          identityEdits: input.patch.edits,
          identityEditSource: input.patch.source,
          releasedIdentityDependents: computed.releasedDependents,
        },
      }).$returningId();
      if (!inserted?.id) throw new Error("The identity edit could not be saved");
      if (staleIds.length > 0) {
        await tx.update(modelAssets)
          .set({ status: { state: "stale", at: new Date().toISOString() } })
          .where(inArray(modelAssets.id, staleIds));
      }
      return {
        result: {
          assetId: inserted.id,
          identityRevisionId: revisionId,
          masterPrompt: computed.masterPrompt,
          technicalSchema: computed.technicalSchema,
          preferences: computed.preferences,
          staledAssetIds: staleIds,
          releasedDependents: computed.releasedDependents,
        },
        transition: {
          packageReason: "identity_change",
          identity: {
            reason: "identity_edit",
            anchorAssetId: inserted.id,
            recipeVersion: IDENTITY_EDIT_RECIPE_VERSION,
          },
          slotChanges: [{
            viewAngle: "frontClose",
            selectedAssetId: inserted.id,
            compatibility: "current",
            selectionReason: "generated",
          }],
        },
      };
    },
  });
}
