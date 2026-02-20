import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { type GenerationState, type GeneratedAsset, type Amendment } from '../constants';

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
  
  // Suggestions
  suggestions: string[];
  setSuggestions: (suggestions: string[]) => void;
  isLoadingSuggestions: boolean;
  setIsLoadingSuggestions: (loading: boolean) => void;
  
  // Amendments (iteration history log)
  amendments: Amendment[];
  addAmendment: (amendment: Amendment) => void;
  clearAmendments: () => void;
  
  // Identity warning
  identityWarning: string | null;
  setIdentityWarning: (warning: string | null) => void;
  
  // Failed action tracking for retry
  failedAction: { type: 'NEW' | 'ITERATE' | 'BODY' | 'SIDE'; args?: { text: string; view: string; mask?: string } } | null;
  setFailedAction: (action: { type: 'NEW' | 'ITERATE' | 'BODY' | 'SIDE'; args?: { text: string; view: string; mask?: string } } | null) => void;
  
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
      
      // Suggestions
      suggestions: [],
      setSuggestions: (suggestions) => set({ suggestions }, false, 'setSuggestions'),
      isLoadingSuggestions: false,
      setIsLoadingSuggestions: (loading) => set({ isLoadingSuggestions: loading }, false, 'setIsLoadingSuggestions'),
      
      // Amendments
      amendments: [],
      addAmendment: (amendment) => set(
        (state) => ({ amendments: [...state.amendments, amendment] }),
        false,
        'addAmendment'
      ),
      clearAmendments: () => set({ amendments: [] }, false, 'clearAmendments'),
      
      // Identity warning
      identityWarning: null,
      setIdentityWarning: (warning) => set({ identityWarning: warning }, false, 'setIdentityWarning'),
      
      // Failed action tracking for retry
      failedAction: null,
      setFailedAction: (action) => set({ failedAction: action }, false, 'setFailedAction'),
      
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
        suggestions: [],
        isLoadingSuggestions: false,
        amendments: [],
        identityWarning: null,
        failedAction: null,
      }, false, 'resetGeneration'),
    }),
    { name: 'CastingGenerationStore' }
  )
);

// Selector hooks — only those actually imported by consumers
export const useCurrentMasterPrompt = () => useCastingGenerationStore((state) => state.currentMasterPrompt);
export const useSuggestions = () => useCastingGenerationStore((state) => state.suggestions);
export const useIsLoadingSuggestions = () => useCastingGenerationStore((state) => state.isLoadingSuggestions);
export const useAmendments = () => useCastingGenerationStore((state) => state.amendments);
export const useIdentityWarning = () => useCastingGenerationStore((state) => state.identityWarning);
