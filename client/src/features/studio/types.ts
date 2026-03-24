/**
 * Drape Studio — Unified workspace types
 *
 * The studio is a single workspace where tools operate on a shared canvas (the model).
 * Tools slide in/out via the ToolRail; the canvas persists across tool switches.
 * When activeTool is null, the lobby/landing state is shown.
 */

/** Available tools in the studio tool rail */
export type StudioTool = 'casting' | 'wardrobe' | 'export';

/** Active tool state — null means lobby (no tool selected) */
export type ActiveTool = StudioTool | null;

/** How the model was loaded into the canvas */
export type ModelSource = 'cast' | 'uploaded' | null;

/** Canvas state — represents what's currently on the shared canvas */
export interface CanvasState {
  /** Whether a model is loaded on the canvas */
  hasModel: boolean;
  /** Whether the full body view has been generated (required for wardrobe) */
  hasFullBody: boolean;
  /** Whether all 3 views exist (required for export) */
  hasAllViews: boolean;
  /** How the model was loaded */
  modelSource: ModelSource;
  /** URL of an uploaded model image (when source === 'uploaded') */
  uploadedModelUrl: string | null;
}

/** Tool availability derived from canvas state */
export interface ToolAvailability {
  enabled: boolean;
  tooltip: string;
  /** Whether switching to this tool requires a confirmation (e.g. will reset progress) */
  needsConfirm?: boolean;
  /** Message to show in the confirmation dialog */
  confirmMessage?: string;
}

/** Derive tool availability from canvas state */
export function getToolAvailability(
  tool: StudioTool,
  canvas: CanvasState
): ToolAvailability {
  switch (tool) {
    case 'casting':
      // Casting is allowed when uploaded, but needs confirmation to reset
      if (canvas.modelSource === 'uploaded') {
        return {
          enabled: true,
          tooltip: 'Casting Studio',
          needsConfirm: true,
          confirmMessage: 'Switching to Casting will clear your uploaded model and any wardrobe progress. This cannot be undone.',
        };
      }
      return { enabled: true, tooltip: 'Casting Studio' };

    case 'wardrobe':
      if (!canvas.hasModel) {
        return { enabled: false, tooltip: 'Load a model first' };
      }
      if (!canvas.hasFullBody) {
        return { enabled: false, tooltip: 'Generate full body first' };
      }
      return { enabled: true, tooltip: 'Wardrobe Studio' };

    case 'export':
      if (!canvas.hasAllViews) {
        return { enabled: false, tooltip: 'Generate all views to unlock export' };
      }
      // Export is only available for cast models (not uploaded)
      if (canvas.modelSource !== 'cast') {
        return { enabled: false, tooltip: 'Export requires a cast model' };
      }
      return { enabled: true, tooltip: 'Export Identity Pack' };

    default:
      return { enabled: false, tooltip: '' };
  }
}

/** Tool metadata for rendering the tool rail */
export interface ToolMeta {
  id: StudioTool;
  label: string;
  shortLabel: string;
}

/** Ordered list of tools for the rail */
export const STUDIO_TOOLS: ToolMeta[] = [
  { id: 'casting', label: 'Casting Studio', shortLabel: 'Cast' },
  { id: 'wardrobe', label: 'Wardrobe Studio', shortLabel: 'Wardrobe' },
  { id: 'export', label: 'Export Pack', shortLabel: 'Export' },
];
