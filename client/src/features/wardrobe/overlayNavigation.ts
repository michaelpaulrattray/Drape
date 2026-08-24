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
 * ✅ AND THE DEAD BINDING BESIDE IT IS GONE (2026-08-25, countersigned
 * fable-1631). `useWardrobeGeneration` selected `getCachedOverlay` from the
 * store and never called it — `git log -S "getCachedOverlay("` over that file
 * was EMPTY, so the call site was never written; the handlers reach into
 * `state.overlayCache` directly, which is why nothing was broken by it. The
 * store action had no consumer anywhere and is deleted: the interface member,
 * the implementation, and the hook's selector line. **Kept written down
 * because an unused BINDING is not an unused BEHAVIOUR** — the near-miss on
 * this one was stopped only by opening the handler, and the sentence is what
 * keeps the next reader from re-deriving a store action nobody asked for.
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
