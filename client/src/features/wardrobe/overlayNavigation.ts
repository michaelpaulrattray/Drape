/**
 * What the garment overlay should do when the customer navigates history.
 *
 * Lifted out of `useWardrobeGeneration`'s `handleUndo` / `handleRedo`
 * BYTE-PRESERVING (2026-08-25, 3g). Both are its production readers, and they
 * were byte-identical to each other apart from which store action they called
 * first — so this removes a duplicate as well as a mirror.
 *
 * ⚠ WHY: `server/wardrobe.test.ts` carried a private `resolveOverlayOnNavigation`
 * and a `shouldUpdateOverlay`, commented "Simulate the scanResultOverlay
 * stale-check pattern" and "Simulate undo/redo cache-or-scan logic". The
 * copies were faithful, which is luck rather than a property — the rule that
 * decides whether a customer pays a fresh vision read on every undo could have
 * been changed in the hook with those arms green.
 *
 * ⚠ AND A DEAD BINDING SITS BESIDE THIS, reported rather than removed here
 * because deleting a store action is a product change and not a mirror repair:
 * `useWardrobeGeneration` selects `getCachedOverlay` from the store (line 70)
 * and never calls it — `git log -S "getCachedOverlay("` over that file is
 * EMPTY, so the call site was never written. The handlers reach into
 * `state.overlayCache` directly instead, which is why nothing was broken by
 * it. The store action has no consumer anywhere.
 */

/** A re-scan only applies if no newer generation has started since it was asked. */
export function shouldUpdateOverlay(genIdAtCall: number, currentGenId: number): boolean {
  return genIdAtCall === currentGenId;
}

export type OverlayNavigationPlan<TItem> =
  | { source: "cache"; items: TItem[] }
  | { source: "scan"; url: string }
  | { source: "none" };

/**
 * Cache first, then a fresh scan, then nothing.
 *
 * The order is the point and it is about money: a scan is a vision call on the
 * house, so a cached index must never buy one.
 */
export function resolveOverlayOnNavigation<TItem>(
  overlayCache: ReadonlyMap<number, TItem[]>,
  historyIndex: number,
  historyUrl: string | undefined,
): OverlayNavigationPlan<TItem> {
  const cached = overlayCache.get(historyIndex);
  if (cached) return { source: "cache", items: cached };
  if (historyUrl) return { source: "scan", url: historyUrl };
  return { source: "none" };
}
