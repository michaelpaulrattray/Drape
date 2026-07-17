import { create } from 'zustand';
import type { CanonicalViewAngle } from '@shared/boardTypes';

interface CastingRefreshState {
  refreshingByModel: Record<number, CanonicalViewAngle[]>;
  packageHealthOpen: boolean;
  setPackageHealthOpen: (open: boolean) => void;
  begin: (modelId: number, angles: CanonicalViewAngle[]) => void;
  end: (modelId: number, angles: CanonicalViewAngle[]) => void;
}

/** Same-tab refresh truth shared by Canvas and Studio. Server-persisted job
 * state remains R7; this registry only covers work started in this client. */
export const useCastingRefreshStore = create<CastingRefreshState>((set) => ({
  refreshingByModel: {},
  packageHealthOpen: false,
  setPackageHealthOpen: (open) => set({ packageHealthOpen: open }),
  begin: (modelId, angles) => set((state) => ({
    refreshingByModel: {
      ...state.refreshingByModel,
      // Keep duplicate entries as a tiny ref-count: Canvas and Studio can
      // start the same angle concurrently, and one completion must not clear
      // the other operation's in-flight state.
      [modelId]: [...(state.refreshingByModel[modelId] ?? []), ...angles],
    },
  })),
  end: (modelId, angles) => set((state) => {
    const remaining = [...(state.refreshingByModel[modelId] ?? [])];
    for (const angle of angles) {
      const index = remaining.indexOf(angle);
      if (index >= 0) remaining.splice(index, 1);
    }
    const next = { ...state.refreshingByModel };
    if (remaining.length > 0) next[modelId] = remaining;
    else delete next[modelId];
    return { refreshingByModel: next };
  }),
}));
