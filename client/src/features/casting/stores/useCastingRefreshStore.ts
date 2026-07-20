import { create } from 'zustand';
import type { CanonicalViewAngle } from '@shared/boardTypes';
import {
  projectRefreshingByModel,
  type GenerationOperationDto,
} from '@/features/operations/generationOperationProjection';

interface CastingRefreshState {
  refreshingByModel: Record<number, CanonicalViewAngle[]>;
  packageHealthOpen: boolean;
  setPackageHealthOpen: (open: boolean) => void;
  syncServerOperations: (operations: readonly GenerationOperationDto[]) => void;
}

/** Render projection of durable child-attempt truth. The only unrelated local
 * state retained here is whether the package-health surface owns Escape. */
export const useCastingRefreshStore = create<CastingRefreshState>((set) => ({
  refreshingByModel: {},
  packageHealthOpen: false,
  setPackageHealthOpen: (open) => set({ packageHealthOpen: open }),
  syncServerOperations: (operations) => set({
    refreshingByModel: projectRefreshingByModel(operations),
  }),
}));
