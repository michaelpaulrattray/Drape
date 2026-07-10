/**
 * CastingBindings — the state/action surface the generation hooks consume.
 *
 * Audit A1 (CANVAS_AUDIT_ADDENDUM_V2) prerequisite: `useCastingGeneration` and
 * `useCastingViewGeneration` read the three casting Zustand stores directly,
 * which makes them uncallable from a node-local canvas context. This module
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

export type FailedAction = {
  type: "NEW" | "ITERATE" | "BODY" | "SIDE";
  args?: { text: string; view: string; mask?: string };
};

export interface LockModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

export interface CastingBindings {
  /* ── Form ─────────────────────────────────────────────── */
  prefs: ModelPreferences;
  modelName: string;
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

  /* ── Staged view generation UI (useCastingViewGeneration) ─ */
  setShowExportModal: (b: boolean) => void;
  setLockModal: (m: LockModalState) => void;
  closeLockModal: () => void;
  isAutoGenerating: boolean;
  setIsAutoGenerating: (b: boolean) => void;
  setAutoGenCancelled: (b: boolean) => void;
}

/**
 * Legacy adapter: bindings backed by the three casting stores.
 * /studio-scoped by decision D-24; no canvas code may call this.
 */
export function useLegacyCastingBindings(): CastingBindings {
  const { prefs, modelName } = useCastingFormStore();
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
    setLockModal,
    closeLockModal,
    isAutoGenerating,
    setIsAutoGenerating,
    setAutoGenCancelled,
  } = useCastingUIStore();

  return {
    prefs,
    modelName,
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
    setLockModal,
    closeLockModal,
    isAutoGenerating,
    setIsAutoGenerating,
    setAutoGenCancelled,
  };
}
