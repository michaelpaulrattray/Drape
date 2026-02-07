import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { type GeneratedAsset, type GenerationState } from '../constants';

// Default generation state
const DEFAULT_GEN_STATE: GenerationState = {
  isGenerating: false,
  currentStep: '',
  error: null,
};

// Generation store state interface
interface CastingGenerationState {
  // Generation status
  genState: GenerationState;
  setGenState: (state: GenerationState | ((prev: GenerationState) => GenerationState)) => void;
  
  // Current model
  currentModelId: number | null;
  setCurrentModelId: (id: number | null) => void;
  
  // Generated assets
  currentAssets: GeneratedAsset[];
  setCurrentAssets: (assets: GeneratedAsset[]) => void;
  
  // Master prompt and schema
  currentMasterPrompt: string;
  setCurrentMasterPrompt: (prompt: string) => void;
  currentTechnicalSchema: Record<string, unknown> | null;
  setCurrentTechnicalSchema: (schema: Record<string, unknown> | null) => void;
  
  // History for undo/redo
  history: GeneratedAsset[][];
  historyIndex: number;
  setHistory: (history: GeneratedAsset[][]) => void;
  setHistoryIndex: (index: number | ((prev: number) => number)) => void;
  
  // History helpers
  pushHistory: (assets: GeneratedAsset[]) => void;
  
  // Computed selectors (as functions)
  canUndo: () => boolean;
  canRedo: () => boolean;
  getCurrentImageUrl: (activeView: string) => string | null;
  
  // Reset
  resetGeneration: () => void;
}

// Create the store
export const useCastingGenerationStore = create<CastingGenerationState>()(
  devtools(
    (set, get) => ({
      // Generation status
      genState: { ...DEFAULT_GEN_STATE },
      setGenState: (stateOrFn) => set(
        (state) => ({
          genState: typeof stateOrFn === 'function' ? stateOrFn(state.genState) : stateOrFn
        }),
        false,
        'setGenState'
      ),
      
      // Current model
      currentModelId: null,
      setCurrentModelId: (id) => set({ currentModelId: id }, false, 'setCurrentModelId'),
      
      // Generated assets
      currentAssets: [],
      setCurrentAssets: (assets) => set({ currentAssets: assets }, false, 'setCurrentAssets'),
      
      // Master prompt and schema
      currentMasterPrompt: '',
      setCurrentMasterPrompt: (prompt) => set({ currentMasterPrompt: prompt }, false, 'setCurrentMasterPrompt'),
      currentTechnicalSchema: null,
      setCurrentTechnicalSchema: (schema) => set({ currentTechnicalSchema: schema }, false, 'setCurrentTechnicalSchema'),
      
      // History for undo/redo
      history: [],
      historyIndex: -1,
      setHistory: (history) => set({ history }, false, 'setHistory'),
      setHistoryIndex: (indexOrFn) => set(
        (state) => ({
          historyIndex: typeof indexOrFn === 'function' ? indexOrFn(state.historyIndex) : indexOrFn
        }),
        false,
        'setHistoryIndex'
      ),
      
      // Push new history entry (used after each generation/iteration)
      pushHistory: (assets) => {
        const { history, historyIndex } = get();
        const newHistory = [...history.slice(0, historyIndex + 1), assets];
        set({
          history: newHistory,
          historyIndex: newHistory.length - 1,
        }, false, 'pushHistory');
      },
      
      // Computed selectors
      canUndo: () => get().historyIndex > 0,
      canRedo: () => get().historyIndex < get().history.length - 1,
      getCurrentImageUrl: (activeView: string) => {
        const asset = get().currentAssets.find((a) => a.viewType === activeView);
        return asset?.storageUrl || null;
      },
      
      // Reset all generation state
      resetGeneration: () => set({
        genState: { ...DEFAULT_GEN_STATE },
        currentModelId: null,
        currentAssets: [],
        currentMasterPrompt: '',
        currentTechnicalSchema: null,
        history: [],
        historyIndex: -1,
      }, false, 'resetGeneration'),
    }),
    { name: 'CastingGenerationStore' }
  )
);

// Selector hooks for optimized re-renders
export const useGenState = () => useCastingGenerationStore((state) => state.genState);
export const useSetGenState = () => useCastingGenerationStore((state) => state.setGenState);

export const useCurrentModelId = () => useCastingGenerationStore((state) => state.currentModelId);
export const useSetCurrentModelId = () => useCastingGenerationStore((state) => state.setCurrentModelId);

export const useCurrentAssets = () => useCastingGenerationStore((state) => state.currentAssets);
export const useSetCurrentAssets = () => useCastingGenerationStore((state) => state.setCurrentAssets);

export const useCurrentMasterPrompt = () => useCastingGenerationStore((state) => state.currentMasterPrompt);
export const useSetCurrentMasterPrompt = () => useCastingGenerationStore((state) => state.setCurrentMasterPrompt);

export const useCurrentTechnicalSchema = () => useCastingGenerationStore((state) => state.currentTechnicalSchema);
export const useSetCurrentTechnicalSchema = () => useCastingGenerationStore((state) => state.setCurrentTechnicalSchema);

export const useHistory = () => useCastingGenerationStore((state) => state.history);
export const useHistoryIndex = () => useCastingGenerationStore((state) => state.historyIndex);
export const usePushHistory = () => useCastingGenerationStore((state) => state.pushHistory);

export const useCanUndo = () => useCastingGenerationStore((state) => state.canUndo);
export const useCanRedo = () => useCastingGenerationStore((state) => state.canRedo);
export const useGetCurrentImageUrl = () => useCastingGenerationStore((state) => state.getCurrentImageUrl);

export const useResetGeneration = () => useCastingGenerationStore((state) => state.resetGeneration);
