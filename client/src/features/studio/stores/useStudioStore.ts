import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { StudioTool, CanvasState, ModelSource } from '../types';

/** Default empty canvas — no model loaded */
const DEFAULT_CANVAS: CanvasState = {
  hasModel: false,
  hasFullBody: false,
  hasAllViews: false,
  modelSource: null,
  uploadedModelUrl: null,
};

interface StudioState {
  /** Currently active tool in the tool rail */
  activeTool: StudioTool;
  setActiveTool: (tool: StudioTool) => void;

  /** Shared canvas state — derived from model assets */
  canvas: CanvasState;
  setCanvas: (canvas: Partial<CanvasState>) => void;

  /** Load a model from an uploaded image URL */
  loadModelFromUpload: (imageUrl: string) => void;

  /** Clear the uploaded model and reset to empty canvas */
  clearUploadedModel: () => void;

  /** Whether the tool rail is collapsed (mobile) */
  isRailCollapsed: boolean;
  setRailCollapsed: (collapsed: boolean) => void;
  toggleRail: () => void;

  /** Reset the entire studio state */
  resetStudio: () => void;
}

export const useStudioStore = create<StudioState>()(
  devtools(
    (set) => ({
      activeTool: 'casting',
      setActiveTool: (tool) => set({ activeTool: tool }, false, 'setActiveTool'),

      canvas: { ...DEFAULT_CANVAS },
      setCanvas: (partial) =>
        set(
          (state) => ({ canvas: { ...state.canvas, ...partial } }),
          false,
          'setCanvas'
        ),

      loadModelFromUpload: (imageUrl) =>
        set(
          {
            canvas: {
              hasModel: true,
              hasFullBody: true,
              hasAllViews: false,
              modelSource: 'uploaded' as ModelSource,
              uploadedModelUrl: imageUrl,
            },
            activeTool: 'wardrobe',
          },
          false,
          'loadModelFromUpload'
        ),

      clearUploadedModel: () =>
        set(
          {
            canvas: { ...DEFAULT_CANVAS },
            activeTool: 'casting',
          },
          false,
          'clearUploadedModel'
        ),

      isRailCollapsed: false,
      setRailCollapsed: (collapsed) =>
        set({ isRailCollapsed: collapsed }, false, 'setRailCollapsed'),
      toggleRail: () =>
        set(
          (state) => ({ isRailCollapsed: !state.isRailCollapsed }),
          false,
          'toggleRail'
        ),

      resetStudio: () =>
        set(
          {
            activeTool: 'casting',
            canvas: { ...DEFAULT_CANVAS },
            isRailCollapsed: false,
          },
          false,
          'resetStudio'
        ),
    }),
    { name: 'StudioStore' }
  )
);

/** Selector: active tool */
export const useActiveTool = () => useStudioStore((s) => s.activeTool);

/** Selector: canvas state */
export const useCanvas = () => useStudioStore((s) => s.canvas);
