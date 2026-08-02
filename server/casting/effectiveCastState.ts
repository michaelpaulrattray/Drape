/**
 * Private R7-7B1 effective Cast-state resolver.
 *
 * This is snapshot-only authority and deliberately has no R6 fallback. It is
 * not yet reachable from a route, worker or client. The model asset ledger is
 * loaded only to validate selected/anchor rows and preserve future history /
 * failure summaries; newest-filled order never chooses current state here.
 */
import { createHash } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  modelAssets,
  modelIdentitySnapshots,
  modelPackageSnapshots,
  modelPackageSnapshotSlots,
  models,
  PACKAGE_SLOT_COMPATIBILITY,
  type Model,
  type ModelAsset,
  type ModelIdentitySnapshot,
  type ModelPackageSnapshot,
  type ModelPackageSnapshotSlot,
} from "../../drizzle/schema";
import {
  CAST_VIEW_ANGLES,
  CANONICAL_VIEW_ANGLES,
  type CanonicalViewAngle,
  type CastViewAngle,
} from "../../shared/boardTypes";
import { isModelMintedStatus } from "../../shared/modelLifecycle";
import { withTransaction } from "../db/connection";
import { assetIdentityRole, selectIdentityAnchor } from "./identity/anchorSelector";
import { availableModelWhere } from "./modelAvailability";

export const EFFECTIVE_CAST_STATE_ERROR_CODES = [
  "model_not_found",
  "snapshot_pointer_state",
  "snapshot_head_missing",
  "snapshot_head_unexpected",
  "current_package_missing",
  "current_identity_missing",
  "identity_hash_invalid",
  "identity_anchor_invalid",
  "slot_duplicate_angle",
  "slot_duplicate_asset",
  "slot_package_invalid",
  "slot_angle_invalid",
  "slot_compatibility_invalid",
  "slot_asset_invalid",
  "slot_failure_marker",
  "displayed_headshot_missing",
  "seal_pointer_pair",
  "mint_seal_missing",
  "draft_seal_present",
  "sealed_package_missing",
  "sealed_identity_missing",
  "sealed_package_identity_mismatch",
  "sealed_identity_mismatch",
] as const;

export type EffectiveCastStateErrorCode =
  typeof EFFECTIVE_CAST_STATE_ERROR_CODES[number];

const TEMPORARILY_UNAVAILABLE =
  "This Cast is temporarily unavailable while its saved state is checked. No credits were used.";

export class EffectiveCastStateError extends Error {
  constructor(public readonly code: EffectiveCastStateErrorCode) {
    super(code === "model_not_found" ? "Model not found" : TEMPORARILY_UNAVAILABLE);
    this.name = "EffectiveCastStateError";
  }
}

export interface EffectiveCastStateRows {
  model: Model;
  /** Newest-first ledger/history rows. They never choose current state. */
  assets: ModelAsset[];
  currentPackage: ModelPackageSnapshot | null;
  currentIdentity: ModelIdentitySnapshot | null;
  currentSlots: ModelPackageSnapshotSlot[];
  sealedPackage: ModelPackageSnapshot | null;
  sealedIdentity: ModelIdentitySnapshot | null;
}

export interface EffectiveSelectedView {
  angle: CastViewAngle;
  compatibility: "current" | "stale" | "unverified";
  selection: ModelPackageSnapshotSlot;
  asset: ModelAsset;
}

/**
 * A selected view that is provably one of the comp-card six.
 *
 * The narrowing is carried in the TYPE, so a legacy artifact builder cannot be
 * handed a close-up by accident — it would not compile. That is the difference
 * between this and the filter it replaces.
 */
export interface EffectiveCompCardView extends EffectiveSelectedView {
  angle: CanonicalViewAngle;
}

export type EffectiveCastState =
  | {
      authority: "snapshot";
      status: "headless";
      model: Model;
      stateVersion: 0;
      package: null;
      identity: null;
      anchor: null;
      displayedHeadshot: null;
      selectedViews: readonly [];
      sealedPackage: null;
      sealedIdentity: null;
      ledger: { readonly assets: readonly ModelAsset[] };
    }
  | {
      authority: "snapshot";
      status: "current";
      model: Model;
      stateVersion: number;
      package: ModelPackageSnapshot;
      identity: ModelIdentitySnapshot;
      anchor: ModelAsset;
      displayedHeadshot: ModelAsset;
      selectedViews: readonly EffectiveSelectedView[];
      sealedPackage: ModelPackageSnapshot | null;
      sealedIdentity: ModelIdentitySnapshot | null;
      ledger: { readonly assets: readonly ModelAsset[] };
    };

function fail(code: EffectiveCastStateErrorCode): never {
  throw new EffectiveCastStateError(code);
}

function isFailureMarker(asset: ModelAsset): boolean {
  const status = asset.status as { state?: string } | null;
  return !asset.storageUrl || status?.state === "failed";
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/*
  The LEDGER's vocabulary, not the comp card's.

  This authority's job is to read what a Cast actually has, and package v3
  legitimately seals a `closeUp` slot. Narrowing here to the comp-card six was a
  live fault: the first SUCCESSFUL v3 Sign would have sealed a snapshot this
  function then refused with `slot_angle_invalid`, bricking ink, evidence and
  restore for exactly the Casts whose packages worked. A legacy authority
  meeting a V2 snapshot widens or refuses by name — it never filters (D-102).
*/
function isCastAngle(value: string): value is CastViewAngle {
  return (CAST_VIEW_ANGLES as readonly string[]).includes(value);
}

function isCanonicalAngle(value: CastViewAngle): value is CanonicalViewAngle {
  return (CANONICAL_VIEW_ANGLES as readonly string[]).includes(value);
}

/**
 * The comp-card six a Cast currently has selected — the legacy artifact view.
 *
 * The ONE place the six-angle narrowing is allowed, and it is a function rather
 * than a field so that reaching for it is a deliberate act with a name on it.
 *
 * Package v3 seals a `closeUp` slot, and the legacy artifacts genuinely have
 * nowhere to put it: the PDF has six cells, the export has six filenames, ink
 * placement has six zones. Those builders are right to want six. What they must
 * not do is map over `selectedViews` and quietly drop the seventh — silent
 * narrowing at the call site is exactly how a close-up came to be generated,
 * charged, judged and refunded without ever reaching a screen.
 *
 * The narrowing is carried in the RETURN TYPE, so a comp-card builder cannot be
 * handed a close-up by accident; it would not compile. Anything that wants
 * every view a Cast owns keeps reading `selectedViews` (D-102).
 */
export function compCardViews(
  state: EffectiveCastState,
): readonly EffectiveCompCardView[] {
  if (state.status !== "current") return [];
  return state.selectedViews.filter(
    (view): view is EffectiveCompCardView => isCanonicalAngle(view.angle),
  );
}

/**
 * Pure validation/projection over one transaction-consistent row set.
 */
export function buildEffectiveCastState(rows: EffectiveCastStateRows): EffectiveCastState {
  const { model } = rows;
  const pointer = model.currentPackageSnapshotId ?? null;
  const hasAnchor = !!selectIdentityAnchor(rows.assets);

  if ((!pointer && model.stateVersion !== 0) || (pointer && model.stateVersion <= 0)) {
    fail("snapshot_pointer_state");
  }

  if (!pointer) {
    if (hasAnchor) fail("snapshot_head_missing");
    if (rows.currentPackage || rows.currentIdentity || rows.currentSlots.length > 0) {
      fail("snapshot_head_unexpected");
    }
    if (model.sealedIdentitySnapshotId || model.sealedPackageSnapshotId) {
      fail("seal_pointer_pair");
    }
    // A minted Cast cannot be genuinely headless: minting seals a complete
    // identity/package pair. Refuse this corrupt legacy shape instead of
    // presenting it as an ordinary empty draft.
    if (isModelMintedStatus(model.status)) fail("mint_seal_missing");
    return {
      authority: "snapshot",
      status: "headless",
      model,
      stateVersion: 0,
      package: null,
      identity: null,
      anchor: null,
      displayedHeadshot: null,
      selectedViews: [],
        sealedPackage: null,
      sealedIdentity: null,
      ledger: { assets: rows.assets },
    };
  }

  const currentPackage = rows.currentPackage;
  if (!currentPackage || currentPackage.id !== pointer || currentPackage.modelId !== model.id) {
    fail("current_package_missing");
  }
  const currentIdentity = rows.currentIdentity;
  if (
    !currentIdentity
    || currentIdentity.id !== currentPackage.identitySnapshotId
    || currentIdentity.modelId !== model.id
  ) {
    fail("current_identity_missing");
  }
  if (hash(currentIdentity.identityText) !== currentIdentity.identityTextHash) {
    fail("identity_hash_invalid");
  }

  const byAssetId = new Map(rows.assets.map((asset) => [asset.id, asset]));
  const anchor = byAssetId.get(currentIdentity.anchorAssetId);
  if (
    !anchor
    || anchor.modelId !== model.id
    || anchor.viewType !== "frontClose"
    || isFailureMarker(anchor)
    || assetIdentityRole(anchor) !== "anchor"
  ) {
    fail("identity_anchor_invalid");
  }

  const seenAngles = new Set<CastViewAngle>();
  const seenAssets = new Set<number>();
  const selectedViews: EffectiveSelectedView[] = [];
  for (const selection of rows.currentSlots) {
    if (selection.packageSnapshotId !== currentPackage.id) fail("slot_package_invalid");
    if (!isCastAngle(selection.viewAngle)) fail("slot_angle_invalid");
    if (seenAngles.has(selection.viewAngle)) fail("slot_duplicate_angle");
    if (seenAssets.has(selection.selectedAssetId)) fail("slot_duplicate_asset");
    if (
      !(PACKAGE_SLOT_COMPATIBILITY as readonly string[])
        .includes(selection.compatibility)
    ) {
      fail("slot_compatibility_invalid");
    }
    const asset = byAssetId.get(selection.selectedAssetId);
    if (
      !asset
      || asset.modelId !== model.id
      || asset.viewType !== selection.viewAngle
    ) {
      fail("slot_asset_invalid");
    }
    if (isFailureMarker(asset)) fail("slot_failure_marker");
    seenAngles.add(selection.viewAngle);
    seenAssets.add(selection.selectedAssetId);
    selectedViews.push({
      angle: selection.viewAngle,
      compatibility: selection.compatibility,
      selection,
      asset,
    });
  }

  const displayed = selectedViews.find((view) => view.angle === "frontClose");
  if (!displayed) fail("displayed_headshot_missing");
  selectedViews.sort(
    // CAST_VIEW_ANGLES: a close-up would score -1 against the comp-card six and
    // sort first by accident. It sorts first here on purpose.
    (a, b) => CAST_VIEW_ANGLES.indexOf(a.angle) - CAST_VIEW_ANGLES.indexOf(b.angle),
  );

  const hasSealedIdentity = !!model.sealedIdentitySnapshotId;
  const hasSealedPackage = !!model.sealedPackageSnapshotId;
  if (hasSealedIdentity !== hasSealedPackage) fail("seal_pointer_pair");

  const minted = isModelMintedStatus(model.status);
  if (minted && (!hasSealedIdentity || !hasSealedPackage)) fail("mint_seal_missing");
  if (!minted && (hasSealedIdentity || hasSealedPackage)) fail("draft_seal_present");

  if (model.sealedPackageSnapshotId) {
    if (
      !rows.sealedPackage
      || rows.sealedPackage.id !== model.sealedPackageSnapshotId
      || rows.sealedPackage.modelId !== model.id
    ) {
      fail("sealed_package_missing");
    }
  } else if (rows.sealedPackage) {
    fail("snapshot_head_unexpected");
  }
  if (model.sealedIdentitySnapshotId) {
    if (
      !rows.sealedIdentity
      || rows.sealedIdentity.id !== model.sealedIdentitySnapshotId
      || rows.sealedIdentity.modelId !== model.id
    ) {
      fail("sealed_identity_missing");
    }
  } else if (rows.sealedIdentity) {
    fail("snapshot_head_unexpected");
  }
  if (
    rows.sealedPackage
    && rows.sealedIdentity
    && rows.sealedPackage.identitySnapshotId !== rows.sealedIdentity.id
  ) {
    fail("sealed_package_identity_mismatch");
  }
  if (minted && rows.sealedIdentity && currentIdentity.id !== rows.sealedIdentity.id) {
    fail("sealed_identity_mismatch");
  }

  return {
    authority: "snapshot",
    status: "current",
    model,
    stateVersion: model.stateVersion,
    package: currentPackage,
    identity: currentIdentity,
    anchor,
    displayedHeadshot: displayed.asset,
    selectedViews,
    sealedPackage: rows.sealedPackage,
    sealedIdentity: rows.sealedIdentity,
    ledger: { assets: rows.assets },
  };
}

function validPositiveId(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

/**
 * Owner-scoped, transaction-consistent batch resolver for outward account
 * projections. All requested subjects must be live and owned by the caller;
 * one missing/foreign row refuses the whole projection rather than silently
 * dropping it. Ledger rows are loaded in one query and remain history only.
 */
export async function resolveOwnedEffectiveCastStates(input: {
  userId: number;
  modelIds: readonly number[];
}): Promise<Map<number, EffectiveCastState>> {
  if (!validPositiveId(input.userId)) fail("model_not_found");
  if (input.modelIds.length === 0) return new Map();
  if (
    input.modelIds.some((modelId) => !validPositiveId(modelId))
    || new Set(input.modelIds).size !== input.modelIds.length
  ) {
    fail("model_not_found");
  }

  return withTransaction(async (tx) => {
    const subjectRows = await tx
      .select()
      .from(models)
      .where(and(
        inArray(models.id, [...input.modelIds]),
        eq(models.userId, input.userId),
        availableModelWhere(),
      ));
    if (subjectRows.length !== input.modelIds.length) fail("model_not_found");

    const assets = await tx
      .select()
      .from(modelAssets)
      .where(inArray(modelAssets.modelId, [...input.modelIds]))
      .orderBy(desc(modelAssets.createdAt), desc(modelAssets.id));

    const packageIds = Array.from(new Set(subjectRows.flatMap((model) => [
      model.currentPackageSnapshotId,
      model.sealedPackageSnapshotId,
    ].filter((value): value is string => !!value))));
    const packages = packageIds.length > 0
      ? await tx
          .select()
          .from(modelPackageSnapshots)
          .where(and(
            inArray(modelPackageSnapshots.id, packageIds),
            inArray(modelPackageSnapshots.modelId, [...input.modelIds]),
          ))
      : [];

    const identityIds = Array.from(new Set([
      ...packages.map((snapshot) => snapshot.identitySnapshotId),
      ...subjectRows
        .map((model) => model.sealedIdentitySnapshotId)
        .filter((value): value is string => !!value),
    ]));
    const identities = identityIds.length > 0
      ? await tx
          .select()
          .from(modelIdentitySnapshots)
          .where(and(
            inArray(modelIdentitySnapshots.id, identityIds),
            inArray(modelIdentitySnapshots.modelId, [...input.modelIds]),
          ))
      : [];

    const currentPackageIds = subjectRows
      .map((model) => model.currentPackageSnapshotId)
      .filter((value): value is string => !!value);
    const slots = currentPackageIds.length > 0
      ? await tx
          .select()
          .from(modelPackageSnapshotSlots)
          .where(inArray(modelPackageSnapshotSlots.packageSnapshotId, currentPackageIds))
      : [];

    const assetsByModel = new Map<number, ModelAsset[]>();
    for (const asset of assets) {
      const grouped = assetsByModel.get(asset.modelId) ?? [];
      grouped.push(asset);
      assetsByModel.set(asset.modelId, grouped);
    }
    const packageById = new Map(packages.map((snapshot) => [snapshot.id, snapshot]));
    const identityById = new Map(identities.map((snapshot) => [snapshot.id, snapshot]));
    const slotsByPackage = new Map<string, ModelPackageSnapshotSlot[]>();
    for (const slot of slots) {
      const grouped = slotsByPackage.get(slot.packageSnapshotId) ?? [];
      grouped.push(slot);
      slotsByPackage.set(slot.packageSnapshotId, grouped);
    }
    const modelById = new Map(subjectRows.map((model) => [model.id, model]));
    const resolved = new Map<number, EffectiveCastState>();
    for (const modelId of input.modelIds) {
      const model = modelById.get(modelId);
      if (!model) fail("model_not_found");
      const currentPackage = model.currentPackageSnapshotId
        ? packageById.get(model.currentPackageSnapshotId) ?? null
        : null;
      resolved.set(modelId, buildEffectiveCastState({
        model,
        assets: assetsByModel.get(modelId) ?? [],
        currentPackage,
        currentIdentity: currentPackage
          ? identityById.get(currentPackage.identitySnapshotId) ?? null
          : null,
        currentSlots: currentPackage
          ? slotsByPackage.get(currentPackage.id) ?? []
          : [],
        sealedPackage: model.sealedPackageSnapshotId
          ? packageById.get(model.sealedPackageSnapshotId) ?? null
          : null,
        sealedIdentity: model.sealedIdentitySnapshotId
          ? identityById.get(model.sealedIdentitySnapshotId) ?? null
          : null,
      }));
    }
    return resolved;
  });
}

/**
 * Owner-scoped, read-only and snapshot-only. No route imports this in B1.
 */
export async function resolveOwnedEffectiveCastState(input: {
  userId: number;
  modelId: number;
}): Promise<EffectiveCastState> {
  if (!validPositiveId(input.userId) || !validPositiveId(input.modelId)) {
    fail("model_not_found");
  }
  const states = await resolveOwnedEffectiveCastStates({
    userId: input.userId,
    modelIds: [input.modelId],
  });
  return states.get(input.modelId) ?? fail("model_not_found");
}
