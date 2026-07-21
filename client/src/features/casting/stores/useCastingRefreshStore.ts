import { create } from 'zustand';
import type { CanonicalViewAngle } from '@shared/boardTypes';
import {
  projectRefreshingByModel,
  type GenerationOperationDto,
} from '@/features/operations/generationOperationProjection';

interface CastingRefreshState {
  refreshingByModel: Record<number, CanonicalViewAngle[]>;
  localRefreshingByModel: Record<number, CanonicalViewAngle[]>;
  detailsOpen: boolean;
  setDetailsOpen: (open: boolean) => void;
  beginLocalRefresh: (modelId: number, angles: CanonicalViewAngle[]) => void;
  endLocalRefresh: (modelId: number, angles: CanonicalViewAngle[]) => void;
  syncServerOperations: (operations: readonly GenerationOperationDto[]) => void;
}

/** Durable progress plus the brief pre-poll local bridge. Both Studio
 * surfaces read this store, so opening Details cannot expose a second click
 * while the strip's request is already starting. */
export const useCastingRefreshStore = create<CastingRefreshState>((set) => ({
  refreshingByModel: {},
  localRefreshingByModel: {},
  detailsOpen: false,
  setDetailsOpen: (open) => set({ detailsOpen: open }),
  beginLocalRefresh: (modelId, angles) => set((state) => ({
    localRefreshingByModel: {
      ...state.localRefreshingByModel,
      [modelId]: Array.from(new Set([...(state.localRefreshingByModel[modelId] ?? []), ...angles])),
    },
  })),
  endLocalRefresh: (modelId, angles) => set((state) => {
    const removed = new Set(angles);
    const remaining = (state.localRefreshingByModel[modelId] ?? []).filter((angle) => !removed.has(angle));
    const next = { ...state.localRefreshingByModel };
    if (remaining.length > 0) next[modelId] = remaining;
    else delete next[modelId];
    return { localRefreshingByModel: next };
  }),
  syncServerOperations: (operations) => set({
    refreshingByModel: projectRefreshingByModel(operations),
  }),
}));
