import { describe, it, expect, beforeEach } from 'vitest';
import { useStudioStore } from '@/features/studio/stores/useStudioStore';
import { getToolAvailability, type CanvasState } from '@/features/studio/types';

// Reset store between tests
beforeEach(() => {
  useStudioStore.getState().resetStudio();
});

// ─── useStudioStore ───────────────────────────────────────────────

describe('useStudioStore', () => {
  it('initializes with casting as the active tool', () => {
    const state = useStudioStore.getState();
    expect(state.activeTool).toBe('casting');
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
    expect(state.activeTool).toBe('casting');
    expect(state.canvas.hasModel).toBe(false);
    expect(state.isRailCollapsed).toBe(false);
  });
});

// ─── getToolAvailability ──────────────────────────────────────────

describe('getToolAvailability', () => {
  const emptyCanvas: CanvasState = {
    hasModel: false,
    hasFullBody: false,
    hasAllViews: false,
    modelSource: null,
  };

  const frontCloseOnly: CanvasState = {
    hasModel: true,
    hasFullBody: false,
    hasAllViews: false,
    modelSource: 'cast',
  };

  const withFullBody: CanvasState = {
    hasModel: true,
    hasFullBody: true,
    hasAllViews: false,
    modelSource: 'cast',
  };

  const allViewsCast: CanvasState = {
    hasModel: true,
    hasFullBody: true,
    hasAllViews: true,
    modelSource: 'cast',
  };

  const uploadedModel: CanvasState = {
    hasModel: true,
    hasFullBody: true,
    hasAllViews: true,
    modelSource: 'uploaded',
  };

  // Casting is always available
  it('casting is always enabled', () => {
    expect(getToolAvailability('casting', emptyCanvas).enabled).toBe(true);
    expect(getToolAvailability('casting', allViewsCast).enabled).toBe(true);
  });

  // Wardrobe requires model + full body
  it('wardrobe is disabled with empty canvas', () => {
    const result = getToolAvailability('wardrobe', emptyCanvas);
    expect(result.enabled).toBe(false);
    expect(result.tooltip).toContain('Load a model');
  });

  it('wardrobe is disabled with front close only', () => {
    const result = getToolAvailability('wardrobe', frontCloseOnly);
    expect(result.enabled).toBe(false);
    expect(result.tooltip).toContain('full body');
  });

  it('wardrobe is enabled once full body exists', () => {
    expect(getToolAvailability('wardrobe', withFullBody).enabled).toBe(true);
  });

  // Export requires all views + cast model
  it('export is disabled without all views', () => {
    const result = getToolAvailability('export', withFullBody);
    expect(result.enabled).toBe(false);
    expect(result.tooltip).toContain('all views');
  });

  it('export is enabled with all views from cast model', () => {
    expect(getToolAvailability('export', allViewsCast).enabled).toBe(true);
  });

  it('export is disabled for uploaded models', () => {
    const result = getToolAvailability('export', uploadedModel);
    expect(result.enabled).toBe(false);
    expect(result.tooltip).toContain('cast model');
  });
});
