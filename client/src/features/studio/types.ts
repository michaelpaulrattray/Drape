/**
 * Drape Studio — Unified workspace types
 *
 * The studio hosts two environments under one slim chrome (R6 shell
 * unification): casting and wardrobe. There is no tool rail and no export
 * tool — export is a verb on the model (library chooser, card right-click,
 * the environment's Export action), and navigation between environments
 * happens via the lobby, never a stage switcher (the decomposition law:
 * the USER composes the sequence).
 */

/** Available studio environments */
export type StudioTool = 'casting' | 'wardrobe';

/** Active tool state — null means no environment mounted */
export type ActiveTool = StudioTool | null;

/** How the model was loaded into the canvas */
export type ModelSource = 'cast' | 'uploaded' | null;

/** Canvas state — represents what's currently on the shared canvas */
export interface CanvasState {
  /** Whether a model is loaded on the canvas */
  hasModel: boolean;
  /** Whether the full body view has been generated (required for wardrobe) */
  hasFullBody: boolean;
  /** Whether all 3 views exist */
  hasAllViews: boolean;
  /** How the model was loaded */
  modelSource: ModelSource;
  /** URL of an uploaded model image (when source === 'uploaded') */
  uploadedModelUrl: string | null;
  /** DB model ID when loaded from a previous cast (for cross-app retrieval) */
  castModelId: number | null;
  /** Master prompt when loaded from a previous cast (identity reinforcement) */
  castMasterPrompt: string | null;
  /** Full body URL when loaded from a previous cast */
  castFullBodyUrl: string | null;
  /** Whether the model has been minted (identity locked, status: active) */
  isMinted: boolean;
}
