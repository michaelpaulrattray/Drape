import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { StudioTool, ActiveTool, CanvasState, ModelSource } from '../types';

/** Default empty canvas — no model loaded */
const DEFAULT_CANVAS: CanvasState = {
  hasModel: false,
  hasFullBody: false,
  hasAllViews: false,
  modelSource: null,
  uploadedModelUrl: null,
  castModelId: null,
  castMasterPrompt: null,
  castFullBodyUrl: null,
  isMinted: false,
};

interface StudioState {
  /** Currently active tool — null = lobby/landing state */
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;

  /**
   * Wardrobe-start state — shown when the user entered via the Wardrobe
   * deep link but has no session to resume and no model loaded yet
   * (pick a minted model or upload a photo). Only meaningful while
   * activeTool is null; cleared whenever a tool activates.
   */
  wardrobeStart: boolean;
  setWardrobeStart: (value: boolean) => void;

  /** Shared canvas state — derived from model assets */
  canvas: CanvasState;
  setCanvas: (canvas: Partial<CanvasState>) => void;

  /** Load a model from an uploaded image URL */
  loadModelFromUpload: (imageUrl: string) => void;

  /** Load a model from a previous cast (minted model from gallery) */
  loadModelFromCast: (modelId: number, fullBodyUrl: string, masterPrompt: string) => void;

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
      activeTool: null, // Start in lobby state
      setActiveTool: (tool) =>
        set(
          (state) => ({
            activeTool: tool,
            wardrobeStart: tool === null ? state.wardrobeStart : false,
          }),
          false,
          'setActiveTool'
        ),

      wardrobeStart: false,
      setWardrobeStart: (value) =>
        set({ wardrobeStart: value }, false, 'setWardrobeStart'),

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
              castModelId: null,
              castMasterPrompt: null,
              castFullBodyUrl: null,
              isMinted: false,
            },
            activeTool: 'wardrobe' as StudioTool,
            wardrobeStart: false,
          },
          false,
          'loadModelFromUpload'
        ),

      loadModelFromCast: (modelId, fullBodyUrl, masterPrompt) =>
        set(
          {
            canvas: {
              hasModel: true,
              hasFullBody: true,
              hasAllViews: false,
              modelSource: 'cast' as ModelSource,
              uploadedModelUrl: null,
              castModelId: modelId,
              castMasterPrompt: masterPrompt,
              castFullBodyUrl: fullBodyUrl,
              isMinted: true, // Gallery-loaded models are always minted
            },
            activeTool: 'wardrobe' as StudioTool,
            wardrobeStart: false,
          },
          false,
          'loadModelFromCast'
        ),

      clearUploadedModel: () =>
        set(
          {
            canvas: { ...DEFAULT_CANVAS },
            activeTool: null, // Return to lobby
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
            activeTool: null, // Reset to lobby
            wardrobeStart: false,
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
