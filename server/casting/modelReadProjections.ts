/**
 * R7-7B4 outward account-owned model projections.
 *
 * Snapshot mode exposes immutable identity documents plus explicit selected
 * assets. The complete model-assets ledger remains available as history, but
 * newest-filled order never chooses the current image in these projections.
 */
import {
  getUserDraftModels,
  getUserDraftModelsWithThumbnail,
  getUserMintedModels,
  getUserMintedModelsWithThumbnail,
} from "../db/models";
import {
  resolveEffectiveCastStatesForRead,
} from "./effectiveCastRead";
import type { EffectiveCastState } from "./effectiveCastState";
import type { SnapshotReadMode } from "./snapshotReadScope";

export function selectedAssetsFromEffectiveState(state: EffectiveCastState) {
  return state.status === "current"
    ? state.selectedViews.map((view) => view.asset)
    : [];
}

export function selectedAssetForAngle(
  state: EffectiveCastState,
  angle: string,
) {
  if (state.status !== "current") return null;
  return state.selectedViews.find((view) => view.angle === angle)?.asset ?? null;
}

/**
 * Safe models.get projection. Snapshot pointer ids, seals, stateVersion and
 * the rollback-only mutable revision id do not cross the public boundary.
 */
export function projectEffectiveModelForClient(state: EffectiveCastState) {
  const {
    currentPackageSnapshotId: _currentPackageSnapshotId,
    sealedIdentitySnapshotId: _sealedIdentitySnapshotId,
    sealedPackageSnapshotId: _sealedPackageSnapshotId,
    stateVersion: _stateVersion,
    identityRevisionId: _identityRevisionId,
    ...publicModel
  } = state.model;
  const identity = state.status === "current" ? state.identity : null;
  return {
    ...publicModel,
    masterPrompt: identity?.masterPrompt ?? state.model.masterPrompt,
    technicalSchema: identity?.technicalSchema ?? state.model.technicalSchema,
    preferences: identity?.preferences ?? state.model.preferences,
    assets: [...state.ledger.assets],
    selectedAssets: selectedAssetsFromEffectiveState(state).map((asset) => ({
      id: asset.id,
      viewType: asset.viewType,
      storageUrl: asset.storageUrl,
    })),
  };
}

export async function getUserMintedModelsWithThumbnailForRead(input: {
  userId: number;
  limit: number;
  readMode: SnapshotReadMode;
}) {
  if (input.readMode === "r6") {
    return getUserMintedModelsWithThumbnail(input.userId, input.limit);
  }
  const rows = await getUserMintedModels(input.userId, input.limit);
  if (rows.length === 0) return [];

  const states = await resolveEffectiveCastStatesForRead({
    userId: input.userId,
    modelIds: rows.map((row) => row.id),
  });
  return rows.flatMap((row) => {
    const state = states.get(row.id);
    if (!state || state.status !== "current") return [];
    const thumbnail = selectedAssetForAngle(state, "frontFull")
      ?? selectedAssetForAngle(state, "frontClose");
    if (!thumbnail) return [];
    return [{
      id: row.id,
      name: row.name,
      status: row.status,
      agencyId: row.agencyId,
      masterPrompt: state.identity.masterPrompt,
      thumbnailUrl: thumbnail.storageUrl,
      mintedAt: row.mintedAt,
      updatedAt: row.updatedAt,
      assetCount: state.selectedViews.length,
    }];
  });
}

export async function getUserDraftModelsWithThumbnailForRead(input: {
  userId: number;
  limit: number;
  readMode: SnapshotReadMode;
}) {
  if (input.readMode === "r6") {
    return getUserDraftModelsWithThumbnail(input.userId, input.limit);
  }
  const rows = await getUserDraftModels(input.userId, input.limit);
  if (rows.length === 0) return [];

  const states = await resolveEffectiveCastStatesForRead({
    userId: input.userId,
    modelIds: rows.map((row) => row.id),
  });
  return rows.flatMap((row) => {
    const state = states.get(row.id);
    if (!state || state.status !== "current") return [];
    const thumbnail = selectedAssetForAngle(state, "frontClose");
    if (!thumbnail) return [];
    return [{
      id: row.id,
      name: row.name,
      masterPrompt: state.identity.masterPrompt,
      technicalSchema: state.identity.technicalSchema,
      preferences: state.identity.preferences,
      thumbnailUrl: thumbnail.storageUrl,
      assetCount: state.selectedViews.length,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }];
  });
}
