/**
 * CastingBindings — the state/action surface the generation hooks consume.
 *
 * Audit A1 (CANVAS_AUDIT_ADDENDUM_V2) prerequisite: `useCastingGeneration`
 * read the three casting Zustand stores directly, which made it uncallable
 * from a node-local canvas context. (`useCastingViewGeneration` died with the
 * A4 belt-slimming — the export verb lives in the viewer's ··· menu.) This module
 * inverts that: the hooks take a `CastingBindings` object and never import a
 * store; the *caller* decides where state lives.
 *
 * Two implementations exist:
 * - `useLegacyCastingBindings()` (below) — assembles bindings from the three
 *   legacy stores. Used by /studio's DrapeStudio and (until M4 deletes it)
 *   BoardCastingPanel. Dies with /studio (decision log D-24).
 * - The canvas `useCastNodeController` (M4) — supplies node-local bindings
 *   backed by board_items.metadata + useGenerationJobs.
 *
 * Imperative accessors (getReferenceImage, getFailedAction) exist because the
 * hook bodies read fresh values mid-async-flow to avoid stale closures —
 * preserve that contract in any new implementation.
 */
import type {
  ModelPreferences,
  GenerationState,
  GeneratedAsset,
  Amendment,
  EditTool,
} from "../constants";
import { useCastingFormStore } from "../stores/useCastingFormStore";
import { useCastingGenerationStore } from "../stores/useCastingGenerationStore";
import { useCastingUIStore } from "../stores/useCastingUIStore";
import { useStudioStore } from "@/features/studio/stores/useStudioStore";

export type FailedAction = {
  type: "NEW" | "ITERATE" | "BODY" | "SIDE";
  args?: { text: string; view: string; mask?: string };
};

export interface CastingBindings {
  /* ── Form ─────────────────────────────────────────────── */
  prefs: ModelPreferences;
  modelName: string;
  /** Engine's-choice flags (D-41): required fields explicitly delegated to
   *  the engine — they satisfy validation without a value. */
  engineChoice: Record<string, boolean>;
  /** Write prefs (fire-time resolutions, e.g. the Engine's-choice brand pick
   *  that must be recorded and shown before the paid call). */
  updatePrefs: (partial: Partial<ModelPreferences>) => void;
  /** R3 (D-11): true inside a minted-edit session — the stage-lock never
   *  applies; every save routes through applyModelEdit → the identity dialog.
   *  Held in shared state so a /studio resume can never bypass the dialog. */
  isMintedEditSession: boolean;
  /** Fresh read mid-mutation — never a render-time closure value. */
  getReferenceImage: () => string | undefined;

  /* ── Generation state ─────────────────────────────────── */
  genState: GenerationState;
  setGenState: (s: GenerationState | ((prev: GenerationState) => GenerationState)) => void;
  currentModelId: number | null;
  setCurrentModelId: (id: number | null) => void;
  currentAssets: GeneratedAsset[];
  setCurrentAssets: (assets: GeneratedAsset[]) => void;
  currentMasterPrompt: string;
  setCurrentMasterPrompt: (p: string) => void;
  currentTechnicalSchema: Record<string, unknown> | null;
  setCurrentTechnicalSchema: (s: Record<string, unknown> | null) => void;

  /* ── History (undo/redo within a cast) ─────────────────── */
  history: GeneratedAsset[][];
  historyIndex: number;
  setHistory: (h: GeneratedAsset[][]) => void;
  setHistoryIndex: (i: number | ((prev: number) => number)) => void;
  pushHistory: (assets: GeneratedAsset[]) => void;
  /** First generation resets the amendments timeline in sync with history. */
  resetHistoryAmendments: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getCurrentImageUrl: (activeView: string) => string | null;

  /* ── Suggestions & amendments ──────────────────────────── */
  setSuggestions: (s: string[]) => void;
  setIsLoadingSuggestions: (b: boolean) => void;
  amendments: Amendment[];
  addAmendment: (a: Amendment) => void;
  clearAmendments: () => void;
  setIdentityWarning: (w: string | null) => void;

  /* ── Failed-action retry ───────────────────────────────── */
  getFailedAction: () => FailedAction | null;
  setFailedAction: (a: FailedAction | null) => void;

  /* ── View / tool / input UI ────────────────────────────── */
  activeView: string;
  setActiveView: (v: string) => void;
  setActiveTool: (t: EditTool) => void;
  refineInput: string;
  setRefineInput: (v: string) => void;
  isEnhancing: boolean;
  setIsEnhancing: (b: boolean) => void;
  setIsTopupOpen: (b: boolean) => void;

  /* ── Export ────────────────────────────────────────────── */
  setShowExportModal: (b: boolean) => void;
}

/**
 * Legacy adapter: bindings backed by the three casting stores.
 * /studio-scoped by decision D-24; no canvas code may call this.
 */
export function useLegacyCastingBindings(): CastingBindings {
  const { prefs, modelName, engineChoice, updatePrefs } = useCastingFormStore();
  const isMintedEditSession = useStudioStore((s) => s.mintedEditContext !== null);
  const {
    genState,
    setGenState,
    currentModelId,
    setCurrentModelId,
    currentAssets,
    setCurrentAssets,
    currentMasterPrompt,
    setCurrentMasterPrompt,
    currentTechnicalSchema,
    setCurrentTechnicalSchema,
    history,
    setHistory,
    historyIndex,
    setHistoryIndex,
    pushHistory,
    canUndo,
    canRedo,
    getCurrentImageUrl,
    setSuggestions,
    setIsLoadingSuggestions,
    amendments,
    addAmendment,
    clearAmendments,
    setIdentityWarning,
    setFailedAction,
  } = useCastingGenerationStore();
  const {
    activeView,
    setActiveView,
    setActiveTool,
    refineInput,
    setRefineInput,
    isEnhancing,
    setIsEnhancing,
    setIsTopupOpen,
    setShowExportModal,
  } = useCastingUIStore();

  return {
    prefs,
    modelName,
    engineChoice: engineChoice as Record<string, boolean>,
    updatePrefs,
    isMintedEditSession,
    getReferenceImage: () => useCastingFormStore.getState().prefs.referenceImage,

    genState,
    setGenState,
    currentModelId,
    setCurrentModelId,
    currentAssets,
    setCurrentAssets,
    currentMasterPrompt,
    setCurrentMasterPrompt,
    currentTechnicalSchema,
    setCurrentTechnicalSchema,

    history,
    historyIndex,
    setHistory,
    setHistoryIndex,
    pushHistory,
    resetHistoryAmendments: () =>
      useCastingGenerationStore.setState({ historyAmendments: [[]] }),
    canUndo,
    canRedo,
    getCurrentImageUrl,

    setSuggestions,
    setIsLoadingSuggestions,
    amendments,
    addAmendment,
    clearAmendments,
    setIdentityWarning,

    getFailedAction: () => useCastingGenerationStore.getState().failedAction,
    setFailedAction,

    activeView,
    setActiveView,
    setActiveTool,
    refineInput,
    setRefineInput,
    isEnhancing,
    setIsEnhancing,
    setIsTopupOpen,

    setShowExportModal,
  };
}
