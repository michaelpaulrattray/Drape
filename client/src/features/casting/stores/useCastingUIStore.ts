import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { type EditTool, ImageResolution } from '../constants';

// (Stage-lock modal + auto-generation state removed with the D-46/A4
// belt-slimming — the ladder died at the unification; this was its last
// dead plumbing, per the D-46 R7 log item 4.)

// UI State interface
interface CastingUIState {
  // View state
  activeView: string;
  setActiveView: (view: string) => void;
  
  // Tool state
  activeTool: EditTool;
  setActiveTool: (tool: EditTool) => void;
  
  // Resolution state
  resolution: ImageResolution;
  setResolution: (res: ImageResolution) => void;
  
  // Panel visibility
  showMobilePanel: boolean;
  setShowMobilePanel: (show: boolean) => void;
  toggleMobilePanel: () => void;
  identityChangeOpen: boolean;
  setIdentityChangeOpen: (open: boolean) => void;
  
  // Refine input state
  refineInput: string;
  setRefineInput: (input: string) => void;
  isEnhancing: boolean;
  setIsEnhancing: (enhancing: boolean) => void;

  // Modal states
  isTopupOpen: boolean;
  setIsTopupOpen: (open: boolean) => void;

  // Reset UI state
  resetUI: () => void;
}

// Create the store
export const useCastingUIStore = create<CastingUIState>()(
  devtools(
    (set) => ({
      // View state
      activeView: 'frontClose',
      setActiveView: (view) => set({ activeView: view }, false, 'setActiveView'),
      
      // Tool state
      activeTool: 'none',
      setActiveTool: (tool) => set({ activeTool: tool }, false, 'setActiveTool'),
      
      // Resolution state
      resolution: ImageResolution.HIGH,
      setResolution: (res) => set({ resolution: res }, false, 'setResolution'),
      
      // Panel visibility
      showMobilePanel: false,
      setShowMobilePanel: (show) => set({ showMobilePanel: show }, false, 'setShowMobilePanel'),
      toggleMobilePanel: () => set((state) => ({ showMobilePanel: !state.showMobilePanel }), false, 'toggleMobilePanel'),
      identityChangeOpen: false,
      setIdentityChangeOpen: (open) => set({ identityChangeOpen: open }, false, 'setIdentityChangeOpen'),
      
      // Refine input state
      refineInput: '',
      setRefineInput: (input) => set({ refineInput: input }, false, 'setRefineInput'),
      isEnhancing: false,
      setIsEnhancing: (enhancing) => set({ isEnhancing: enhancing }, false, 'setIsEnhancing'),

      // Modal states
      isTopupOpen: false,
      setIsTopupOpen: (open) => set({ isTopupOpen: open }, false, 'setIsTopupOpen'),

      // Reset UI state
      resetUI: () => set({
        activeView: 'frontClose',
        activeTool: 'none',
        resolution: ImageResolution.HIGH,
        showMobilePanel: false,
        identityChangeOpen: false,
        refineInput: '',
        isEnhancing: false,
        isTopupOpen: false,
      }, false, 'resetUI'),
    }),
    { name: 'CastingUIStore' }
  )
);

