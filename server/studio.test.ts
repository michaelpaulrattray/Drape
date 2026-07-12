import { describe, it, expect, beforeEach } from 'vitest';
import { useStudioStore } from '@/features/studio/stores/useStudioStore';
import { type CanvasState } from '@/features/studio/types';

// Reset store between tests
beforeEach(() => {
  useStudioStore.getState().resetStudio();
});

// ─── useStudioStore ───────────────────────────────────────────────

describe('useStudioStore', () => {
  it('initializes in lobby state (null activeTool)', () => {
    const state = useStudioStore.getState();
    expect(state.activeTool).toBeNull();
  });

  it('initializes with an empty canvas', () => {
    const { canvas } = useStudioStore.getState();
    expect(canvas.hasModel).toBe(false);
    expect(canvas.hasFullBody).toBe(false);
    expect(canvas.hasAllViews).toBe(false);
    expect(canvas.modelSource).toBeNull();
  });

  it('sets active tool', () => {
    useStudioStore.getState().setActiveTool('wardrobe');
    expect(useStudioStore.getState().activeTool).toBe('wardrobe');
  });

  it('updates canvas state partially', () => {
    useStudioStore.getState().setCanvas({ hasModel: true, modelSource: 'cast' });
    const { canvas } = useStudioStore.getState();
    expect(canvas.hasModel).toBe(true);
    expect(canvas.modelSource).toBe('cast');
    expect(canvas.hasFullBody).toBe(false); // unchanged
  });

  it('toggles rail collapsed state', () => {
    expect(useStudioStore.getState().isRailCollapsed).toBe(false);
    useStudioStore.getState().toggleRail();
    expect(useStudioStore.getState().isRailCollapsed).toBe(true);
    useStudioStore.getState().toggleRail();
    expect(useStudioStore.getState().isRailCollapsed).toBe(false);
  });

  it('resets all state', () => {
    useStudioStore.getState().setActiveTool('wardrobe');
    useStudioStore.getState().setCanvas({ hasModel: true, hasFullBody: true });
    useStudioStore.getState().setRailCollapsed(true);

    useStudioStore.getState().resetStudio();

    const state = useStudioStore.getState();
    expect(state.activeTool).toBeNull();
    expect(state.canvas.hasModel).toBe(false);
    expect(state.isRailCollapsed).toBe(false);
  });
});

// ─── getToolAvailability ──────────────────────────────────────────

