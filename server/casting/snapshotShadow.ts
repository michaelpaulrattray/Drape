/**
 * R7-7A4 private shadow reader.
 *
 * R6 remains authoritative. This module performs no writes and returns only
 * ids, counts, enums, booleans and hashes so parity can be inspected without
 * exposing identity documents, names, image URLs or storage keys.
 */
import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, ne, type SQL } from "drizzle-orm";
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
import { isModelMintedStatus } from "../../shared/modelLifecycle";
import { withTransaction, type TransactionHandle } from "../db/connection";
import { deriveBootstrapState } from "./snapshotBootstrap";
import { stableCanonicalJson } from "./operationContract";

export const SNAPSHOT_SHADOW_MISMATCH_KINDS = [
  "snapshot_pointer_state",
  "snapshot_head_missing",
  "snapshot_head_unexpected",
  "current_package_missing",
  "current_identity_missing",
  "identity_documents",
  "identity_text_hash",
  "identity_anchor",
  "displayed_headshot",
  "slot_missing_snapshot",
  "slot_missing_legacy",
  "slot_asset",
  "slot_compatibility",
  "snapshot_selection_invalid",
  "snapshot_duplicate_selection",
  "seal_pointer_pair",
  "mint_seal_missing",
  "draft_seal_present",
  "sealed_package_missing",
  "sealed_identity_missing",
  "sealed_identity_mismatch",
  "sealed_package_identity_mismatch",
] as const;

export type SnapshotShadowMismatchKind = typeof SNAPSHOT_SHADOW_MISMATCH_KINDS[number];

export const SNAPSHOT_SHADOW_SURFACES = [
  "identity_profile",
  "casting_package_state",
  "casting_mint_plan",
  "casting_refresh_plan",
  "casting_export",
  "board_library",
  "models_registry",
  "mint_seal",
] as const;

export type SnapshotShadowSurface = typeof SNAPSHOT_SHADOW_SURFACES[number];

interface ShadowIdentitySummary {
  hash: string | null;
  anchorAssetId: number | null;
}

interface ShadowPackageSummary {
  hash: string | null;
  displayedHeadshotAssetId: number | null;
  selectedSlotCount: number;
}

export interface SnapshotShadowReport {
  modelId: number;
  parity: boolean;
  headState: "headless" | "current" | "invalid";
  stateVersion: number;
  minted: boolean;
  currentPackageSnapshotId: string | null;
  currentIdentitySnapshotId: string | null;
  sealedIdentitySnapshotId: string | null;
  sealedPackageSnapshotId: string | null;
  legacyIdentity: ShadowIdentitySummary;
  snapshotIdentity: ShadowIdentitySummary;
  legacyPackage: ShadowPackageSummary;
  snapshotPackage: ShadowPackageSummary;
  mismatchKinds: SnapshotShadowMismatchKind[];
}

const ALL_SHADOW_SURFACES: readonly SnapshotShadowSurface[] = SNAPSHOT_SHADOW_SURFACES;

const MISMATCH_SURFACES: Record<SnapshotShadowMismatchKind, readonly SnapshotShadowSurface[]> = {
  snapshot_pointer_state: ALL_SHADOW_SURFACES,
  snapshot_head_missing: ALL_SHADOW_SURFACES,
  snapshot_head_unexpected: ALL_SHADOW_SURFACES,
  current_package_missing: ALL_SHADOW_SURFACES,
  current_identity_missing: ALL_SHADOW_SURFACES,
  identity_documents: [
    "identity_profile",
    "casting_mint_plan",
    "casting_refresh_plan",
    "casting_export",
    "models_registry",
  ],
  identity_text_hash: [
    "identity_profile",
    "casting_mint_plan",
    "casting_refresh_plan",
    "casting_export",
    "models_registry",
  ],
  identity_anchor: [
    "identity_profile",
    "casting_mint_plan",
    "casting_refresh_plan",
    "casting_export",
    "models_registry",
  ],
  displayed_headshot: [
    "casting_package_state",
    "casting_mint_plan",
    "casting_export",
    "board_library",
    "models_registry",
  ],
  slot_missing_snapshot: [
    "casting_package_state",
    "casting_mint_plan",
    "casting_refresh_plan",
    "casting_export",
    "board_library",
    "models_registry",
  ],
  slot_missing_legacy: [
    "casting_package_state",
    "casting_mint_plan",
    "casting_refresh_plan",
    "casting_export",
    "board_library",
    "models_registry",
  ],
  slot_asset: [
    "casting_package_state",
    "casting_mint_plan",
    "casting_refresh_plan",
    "casting_export",
    "board_library",
    "models_registry",
  ],
  slot_compatibility: [
    "casting_package_state",
    "casting_mint_plan",
    "casting_refresh_plan",
    "casting_export",
    "board_library",
  ],
  snapshot_selection_invalid: ALL_SHADOW_SURFACES,
  snapshot_duplicate_selection: ALL_SHADOW_SURFACES,
  seal_pointer_pair: ["casting_mint_plan", "casting_export", "models_registry", "mint_seal"],
  mint_seal_missing: ["casting_mint_plan", "casting_export", "models_registry", "mint_seal"],
  draft_seal_present: ["casting_mint_plan", "casting_export", "models_registry", "mint_seal"],
  sealed_package_missing: ["casting_export", "models_registry", "mint_seal"],
  sealed_identity_missing: ["casting_export", "models_registry", "mint_seal"],
  sealed_identity_mismatch: [
    "identity_profile",
    "casting_mint_plan",
    "casting_refresh_plan",
    "casting_export",
    "models_registry",
    "mint_seal",
  ],
  sealed_package_identity_mismatch: ["casting_export", "models_registry", "mint_seal"],
};

export function affectedSnapshotShadowSurfaces(
  report: Pick<SnapshotShadowReport, "mismatchKinds">,
): SnapshotShadowSurface[] {
  const affected = new Set<SnapshotShadowSurface>();
  for (const mismatch of report.mismatchKinds) {
    for (const surface of MISMATCH_SURFACES[mismatch]) affected.add(surface);
  }
  return SNAPSHOT_SHADOW_SURFACES.filter((surface) => affected.has(surface));
}

export interface SnapshotShadowState {
  model: Pick<
    Model,
    | "id"
    | "status"
    | "masterPrompt"
    | "technicalSchema"
    | "preferences"
    | "currentPackageSnapshotId"
    | "stateVersion"
    | "sealedIdentitySnapshotId"
    | "sealedPackageSnapshotId"
  >;
  /** Newest-first, exactly like getModelAssets. */
  assets: ModelAsset[];
  currentPackage: ModelPackageSnapshot | null;
  currentIdentity: ModelIdentitySnapshot | null;
  currentSlots: ModelPackageSnapshotSlot[];
  sealedPackage: ModelPackageSnapshot | null;
  sealedIdentity: ModelIdentitySnapshot | null;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function identityDocumentHash(input: {
  masterPrompt: string;
  technicalSchema: unknown;
  preferences: unknown;
  identityTextHash: string;
}): string {
  return sha256(stableCanonicalJson(input));
}

function packageSelectionHash(
  rows: Array<{
    viewAngle: CanonicalViewAngle;
    selectedAssetId: number;
    compatibility: string;
  }>,
): string {
  return sha256(stableCanonicalJson(
    [...rows]
      .sort((a, b) => a.viewAngle.localeCompare(b.viewAngle))
      .map((row) => ({
        viewAngle: row.viewAngle,
        selectedAssetId: row.selectedAssetId,
        compatibility: row.compatibility,
      })),
  ));
}

function orderedMismatches(values: Set<SnapshotShadowMismatchKind>): SnapshotShadowMismatchKind[] {
  return SNAPSHOT_SHADOW_MISMATCH_KINDS.filter((kind) => values.has(kind));
}

/**
 * Pure parity comparison. It never includes the identity content used to
 * calculate its hashes in the returned report.
 */
export function compareSnapshotShadowState(input: SnapshotShadowState): SnapshotShadowReport {
  const mismatch = new Set<SnapshotShadowMismatchKind>();
  const { model } = input;
  const derived = deriveBootstrapState(model, input.assets);
  const minted = isModelMintedStatus(model.status);
  const packagePointer = model.currentPackageSnapshotId ?? null;

  if (
    (!packagePointer && model.stateVersion !== 0)
    || (packagePointer && model.stateVersion <= 0)
  ) {
    mismatch.add("snapshot_pointer_state");
  }
  if (derived && !packagePointer) mismatch.add("snapshot_head_missing");
  if (!derived && packagePointer) mismatch.add("snapshot_head_unexpected");
  if (packagePointer && !input.currentPackage) mismatch.add("current_package_missing");
  if (input.currentPackage && !input.currentIdentity) mismatch.add("current_identity_missing");

  const legacyIdentityHash = derived
    ? identityDocumentHash({
        masterPrompt: model.masterPrompt,
        technicalSchema: model.technicalSchema,
        preferences: model.preferences,
        identityTextHash: derived.identityTextHash,
      })
    : null;
  const snapshotIdentityHash = input.currentIdentity
    ? identityDocumentHash({
        masterPrompt: input.currentIdentity.masterPrompt,
        technicalSchema: input.currentIdentity.technicalSchema,
        preferences: input.currentIdentity.preferences,
        identityTextHash: input.currentIdentity.identityTextHash,
      })
    : null;
  if (legacyIdentityHash && snapshotIdentityHash && legacyIdentityHash !== snapshotIdentityHash) {
    mismatch.add("identity_documents");
  }
  if (
    input.currentIdentity
    && sha256(input.currentIdentity.identityText) !== input.currentIdentity.identityTextHash
  ) {
    mismatch.add("identity_text_hash");
  }
  if (
    derived
    && input.currentIdentity
    && derived.anchorAssetId !== input.currentIdentity.anchorAssetId
  ) {
    mismatch.add("identity_anchor");
  }

  const byAssetId = new Map(input.assets.map((asset) => [asset.id, asset]));
  const slotsByAngle = new Map<CanonicalViewAngle, ModelPackageSnapshotSlot>();
  const selectedIds = new Set<number>();
  for (const slot of input.currentSlots) {
    if (slotsByAngle.has(slot.viewAngle) || selectedIds.has(slot.selectedAssetId)) {
      mismatch.add("snapshot_duplicate_selection");
    }
    slotsByAngle.set(slot.viewAngle, slot);
    selectedIds.add(slot.selectedAssetId);
    const selected = byAssetId.get(slot.selectedAssetId);
    if (
      !selected
      || selected.modelId !== model.id
      || selected.viewType !== slot.viewAngle
      || !selected.storageUrl
    ) {
      mismatch.add("snapshot_selection_invalid");
    }
  }
  if (
    input.currentPackage
    && input.currentSlots.length > 0
    && !slotsByAngle.has("frontClose")
  ) {
    mismatch.add("snapshot_selection_invalid");
  }

  const derivedByAngle = new Map(derived?.slots.map((slot) => [slot.viewAngle, slot]) ?? []);
  for (const angle of CANONICAL_VIEW_ANGLES) {
    const legacySlot = derivedByAngle.get(angle);
    const snapshotSlot = slotsByAngle.get(angle);
    if (legacySlot && !snapshotSlot) mismatch.add("slot_missing_snapshot");
    if (!legacySlot && snapshotSlot) mismatch.add("slot_missing_legacy");
    if (legacySlot && snapshotSlot) {
      if (legacySlot.selectedAssetId !== snapshotSlot.selectedAssetId) mismatch.add("slot_asset");
      if (legacySlot.compatibility !== snapshotSlot.compatibility) mismatch.add("slot_compatibility");
    }
  }

  const legacyDisplayedHeadshotAssetId = derivedByAngle.get("frontClose")?.selectedAssetId ?? null;
  const snapshotDisplayedHeadshotAssetId = slotsByAngle.get("frontClose")?.selectedAssetId ?? null;
  if (
    legacyDisplayedHeadshotAssetId !== null
    && snapshotDisplayedHeadshotAssetId !== null
    && legacyDisplayedHeadshotAssetId !== snapshotDisplayedHeadshotAssetId
  ) {
    mismatch.add("displayed_headshot");
  }

  const hasSealedIdentity = !!model.sealedIdentitySnapshotId;
  const hasSealedPackage = !!model.sealedPackageSnapshotId;
  if (hasSealedIdentity !== hasSealedPackage) mismatch.add("seal_pointer_pair");
  if (minted && (!hasSealedIdentity || !hasSealedPackage)) mismatch.add("mint_seal_missing");
  if (!minted && (hasSealedIdentity || hasSealedPackage)) mismatch.add("draft_seal_present");
  if (model.sealedIdentitySnapshotId && !input.sealedIdentity) mismatch.add("sealed_identity_missing");
  if (model.sealedPackageSnapshotId && !input.sealedPackage) mismatch.add("sealed_package_missing");
  if (
    input.currentIdentity
    && input.sealedIdentity
    && input.currentIdentity.id !== input.sealedIdentity.id
  ) {
    mismatch.add("sealed_identity_mismatch");
  }
  if (
    input.sealedPackage
    && input.sealedIdentity
    && input.sealedPackage.identitySnapshotId !== input.sealedIdentity.id
  ) {
    mismatch.add("sealed_package_identity_mismatch");
  }

  const legacyRows = derived?.slots ?? [];
  const snapshotRows = input.currentSlots.map((slot) => ({
    viewAngle: slot.viewAngle,
    selectedAssetId: slot.selectedAssetId,
    compatibility: slot.compatibility,
  }));
  const mismatchKinds = orderedMismatches(mismatch);
  const hasSnapshotStructure = !!(
    packagePointer
    && input.currentPackage
    && input.currentIdentity
  );
  return {
    modelId: model.id,
    parity: mismatchKinds.length === 0,
    headState: !derived && !packagePointer
      ? "headless"
      : hasSnapshotStructure && !mismatch.has("snapshot_selection_invalid")
        ? "current"
        : "invalid",
    stateVersion: model.stateVersion,
    minted,
    currentPackageSnapshotId: packagePointer,
    currentIdentitySnapshotId: input.currentIdentity?.id ?? null,
    sealedIdentitySnapshotId: model.sealedIdentitySnapshotId ?? null,
    sealedPackageSnapshotId: model.sealedPackageSnapshotId ?? null,
    legacyIdentity: {
      hash: legacyIdentityHash,
      anchorAssetId: derived?.anchorAssetId ?? null,
    },
    snapshotIdentity: {
      hash: snapshotIdentityHash,
      anchorAssetId: input.currentIdentity?.anchorAssetId ?? null,
    },
    legacyPackage: {
      hash: derived ? packageSelectionHash(legacyRows) : null,
      displayedHeadshotAssetId: legacyDisplayedHeadshotAssetId,
      selectedSlotCount: legacyRows.length,
    },
    snapshotPackage: {
      hash: input.currentPackage ? packageSelectionHash(snapshotRows) : null,
      displayedHeadshotAssetId: snapshotDisplayedHeadshotAssetId,
      selectedSlotCount: input.currentSlots.length,
    },
    mismatchKinds,
  };
}

async function readSnapshotShadowStateIn(
  tx: TransactionHandle,
  input: { userId: number; modelId: number },
): Promise<SnapshotShadowState> {
  const [model] = await tx
    .select()
    .from(models)
    .where(and(
      eq(models.id, input.modelId),
      eq(models.userId, input.userId),
      isNull(models.deletedAt),
      ne(models.status, "archived"),
    ))
    .limit(1);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  const assets = await tx
    .select()
    .from(modelAssets)
    .where(eq(modelAssets.modelId, model.id))
    .orderBy(desc(modelAssets.createdAt), desc(modelAssets.id));

  const currentPackage = model.currentPackageSnapshotId
    ? (await tx
        .select()
        .from(modelPackageSnapshots)
        .where(and(
          eq(modelPackageSnapshots.id, model.currentPackageSnapshotId),
          eq(modelPackageSnapshots.modelId, model.id),
        ))
        .limit(1))[0] ?? null
    : null;
  const currentIdentity = currentPackage
    ? (await tx
        .select()
        .from(modelIdentitySnapshots)
        .where(and(
          eq(modelIdentitySnapshots.id, currentPackage.identitySnapshotId),
          eq(modelIdentitySnapshots.modelId, model.id),
        ))
        .limit(1))[0] ?? null
    : null;
  const currentSlots = currentPackage
    ? await tx
        .select()
        .from(modelPackageSnapshotSlots)
        .where(eq(modelPackageSnapshotSlots.packageSnapshotId, currentPackage.id))
    : [];

  const sealedIdentity = model.sealedIdentitySnapshotId
    ? (await tx
        .select()
        .from(modelIdentitySnapshots)
        .where(and(
          eq(modelIdentitySnapshots.id, model.sealedIdentitySnapshotId),
          eq(modelIdentitySnapshots.modelId, model.id),
        ))
        .limit(1))[0] ?? null
    : null;
  const sealedPackage = model.sealedPackageSnapshotId
    ? (await tx
        .select()
        .from(modelPackageSnapshots)
        .where(and(
          eq(modelPackageSnapshots.id, model.sealedPackageSnapshotId),
          eq(modelPackageSnapshots.modelId, model.id),
        ))
        .limit(1))[0] ?? null
    : null;

  return {
    model,
    assets,
    currentPackage,
    currentIdentity,
    currentSlots,
    sealedPackage,
    sealedIdentity,
  };
}

/**
 * Private, read-only and owner-scoped. The transaction provides one consistent
 * comparison snapshot without taking the model's mutation lock.
 */
export async function compareModelSnapshotShadow(input: {
  userId: number;
  modelId: number;
}): Promise<SnapshotShadowReport> {
  return withTransaction(async (tx) => compareSnapshotShadowState(
    await readSnapshotShadowStateIn(tx, input),
  ));
}

/**
 * Guarded cohort primitive for the read-only A4 audit script. A selector is
 * mandatory so an accidental invocation cannot scan every Cast in a database.
 * Every model in the cohort is compared inside the same consistent transaction.
 */
export async function compareSnapshotShadowCohort(input: {
  userId?: number;
  modelIds?: number[];
}): Promise<SnapshotShadowReport[]> {
  const modelIds = Array.from(new Set(input.modelIds ?? []))
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((a, b) => a - b);
  if (!input.userId && modelIds.length === 0) {
    throw new Error("A snapshot shadow cohort requires a user id or at least one model id");
  }
  if (input.userId !== undefined && (!Number.isInteger(input.userId) || input.userId <= 0)) {
    throw new Error("Snapshot shadow cohort user id must be a positive integer");
  }
  return withTransaction(async (tx) => {
    const filters: SQL[] = [
      isNull(models.deletedAt),
      ne(models.status, "archived"),
    ];
    if (input.userId !== undefined) filters.push(eq(models.userId, input.userId));
    if (modelIds.length > 0) filters.push(inArray(models.id, modelIds));
    const subjects = await tx
      .select({ id: models.id, userId: models.userId })
      .from(models)
      .where(and(...filters))
      .orderBy(models.id);
    const reports: SnapshotShadowReport[] = [];
    for (const subject of subjects) {
      reports.push(compareSnapshotShadowState(await readSnapshotShadowStateIn(tx, {
        userId: subject.userId,
        modelId: subject.id,
      })));
    }
    return reports;
  });
}
