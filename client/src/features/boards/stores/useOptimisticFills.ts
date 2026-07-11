/**
 * useOptimisticFills — the D-38 fill ledger. Optimistic node fills (library
 * pick, mint landing) live HERE, outside the query cache, because cache
 * writes lose races: a getItems refetch already in flight when the fill
 * lands resolves later with pre-fill data and overwrites it, and the
 * post-success invalidate gets deduped against that same in-flight fetch
 * (the fill-then-vanish race, VC-R3 family). BoardPage overlays these onto
 * canvasItems; entries self-prune once the server row carries the image.
 * Same pattern as the pending-forks overlay and the VC2 position ledger:
 * client intent always outlives cache churn.
 */
import { create } from "zustand";

export interface OptimisticFill {
  imageUrl: string;
  label: string | null;
  modelId: number;
  draft?: boolean;
}

interface OptimisticFillsState {
  fills: Record<number, OptimisticFill>;
  setFill: (itemId: number, fill: OptimisticFill) => void;
  clearFill: (itemId: number) => void;
}

export const useOptimisticFills = create<OptimisticFillsState>()((set) => ({
  fills: {},
  setFill: (itemId, fill) =>
    set((s) => ({ fills: { ...s.fills, [itemId]: fill } })),
  clearFill: (itemId) =>
    set((s) => {
      if (!(itemId in s.fills)) return s;
      const fills = { ...s.fills };
      delete fills[itemId];
      return { fills };
    }),
}));
