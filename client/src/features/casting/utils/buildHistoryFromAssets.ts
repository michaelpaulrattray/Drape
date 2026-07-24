/**
 * buildHistoryFromAssets — Reconstructs undo/redo history from DB assets.
 *
 * The model_assets table stores ALL iterations (old + new) for each viewType.
 * getModelAssets returns them ordered by createdAt DESC (newest first).
 *
 * Strategy:
 * - Group assets by viewType
 * - For each viewType, the assets are ordered newest→oldest (from DB)
 * - Build history entries: entry 0 = oldest per viewType, entry N = newest per viewType
 * - Each history entry is a snapshot of all viewTypes at that point in time
 *
 * Example: 2 frontClose iterations + 1 frontFull
 *   DB returns: [frontClose(new), frontClose(old), frontFull]
 *   History[0] = [frontClose(old), frontFull]     ← initial state
 *   History[1] = [frontClose(new), frontFull]     ← after iteration
 *   currentAssets = History[1], historyIndex = 1
 */

import type { GeneratedAsset } from '../constants';

interface AssetWithMeta {
  id: number;
  viewType: string;
  storageUrl: string;
  createdAt?: string | Date | null;
}

export function buildHistoryFromAssets(
  allAssets: AssetWithMeta[],
  selectedAssets?: AssetWithMeta[],
): { history: GeneratedAsset[][]; historyIndex: number; currentAssets: GeneratedAsset[] } {
  const hasSelectedProjection = selectedAssets !== undefined;
  // Group by viewType — DB returns newest first. All six package slots
  // (D-39) hydrate; the old frontClose/frontFull/sideClose whitelist made a
  // Production mint look three slots short on re-edit (VC-R3b bug 1).
  const PACKAGE_VIEW_TYPES = ['frontClose', 'threeQuarter', 'sideClose', 'frontFull', 'sideFull', 'backFull'];
  const byViewType = new Map<string, AssetWithMeta[]>();
  for (const asset of allAssets) {
    if (!PACKAGE_VIEW_TYPES.includes(asset.viewType)) continue;
    // Skip failed-slot markers (storageUrl-less status rows, D-40) — they'd
    // otherwise inject a blank frame into the viewer history
    if (!asset.storageUrl) continue;
    const existing = byViewType.get(asset.viewType) || [];
    existing.push(asset);
    byViewType.set(asset.viewType, existing);
  }

  // Find the max number of iterations across any viewType
  let maxIterations = 0;
  for (const assets of Array.from(byViewType.values())) {
    maxIterations = Math.max(maxIterations, assets.length);
  }

  if (maxIterations === 0) {
    return { history: [], historyIndex: -1, currentAssets: [] };
  }

  // Build history entries from oldest to newest
  // DB order is newest first, so reverse each group
  const reversedByViewType = new Map<string, AssetWithMeta[]>();
  for (const [viewType, assets] of Array.from(byViewType.entries())) {
    reversedByViewType.set(viewType, [...assets].reverse()); // oldest first
  }

  const history: GeneratedAsset[][] = [];

  for (let i = 0; i < maxIterations; i++) {
    const snapshot: GeneratedAsset[] = [];
    for (const [viewType, assets] of Array.from(reversedByViewType.entries())) {
      // Use the asset at index i, or the latest available if this viewType has fewer iterations
      const asset = assets[Math.min(i, assets.length - 1)];
      snapshot.push({
        id: asset.id,
        viewType: asset.viewType,
        storageUrl: asset.storageUrl,
      });
    }
    history.push(snapshot);
  }

  const selected = (selectedAssets ?? [])
    .filter((asset) => PACKAGE_VIEW_TYPES.includes(asset.viewType) && !!asset.storageUrl)
    .map((asset) => ({
      id: asset.id,
      viewType: asset.viewType,
      storageUrl: asset.storageUrl,
    }));
  if (selected.length > 0) {
    const currentIds = new Map(history[history.length - 1].map((asset) => [asset.viewType, asset.id]));
    const selectionDiffers = selected.some((asset) => currentIds.get(asset.viewType) !== asset.id)
      || selected.length !== currentIds.size;
    // A package restore can select a historical mix that cannot be inferred
    // from asset creation order. Preserve the ledger-derived history and add
    // the server-selected package as the current presentation state.
    if (selectionDiffers) history.push(selected);
  }

  if (hasSelectedProjection && selected.length === 0) {
    return { history, historyIndex: -1, currentAssets: [] };
  }
  const historyIndex = history.length - 1;
  const currentAssets = hasSelectedProjection ? selected : history[historyIndex];

  return { history, historyIndex, currentAssets };
}
