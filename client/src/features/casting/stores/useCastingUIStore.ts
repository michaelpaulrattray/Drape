import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { type EditTool, ImageResolution } from '../constants';

// View type for the image viewer (using string for compatibility with ViewTabs)

// Lock modal state
interface LockModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

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
  
  // Refine input state
  refineInput: string;
  setRefineInput: (input: string) => void;
  isEnhancing: boolean;
  setIsEnhancing: (enhancing: boolean) => void;
  unlockMode: boolean;
  setUnlockMode: (mode: boolean) => void;
  
  // Modal states
  isTopupOpen: boolean;
  setIsTopupOpen: (open: boolean) => void;
  showExportModal: boolean;
  setShowExportModal: (show: boolean) => void;
  lockModal: LockModalState;
  setLockModal: (modal: LockModalState) => void;
  closeLockModal: () => void;
  
  // Auto-generation state
  isAutoGenerating: boolean;
  setIsAutoGenerating: (generating: boolean) => void;
  autoGenCancelled: boolean;
  setAutoGenCancelled: (cancelled: boolean) => void;
  
  // Reset UI state
  resetUI: () => void;
}

// Default lock modal state
const defaultLockModal: LockModalState = {
  isOpen: false,
  title: '',
  message: '',
  onConfirm: () => {},
};

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
      resolution: ImageResolution.STD,
      setResolution: (res) => set({ resolution: res }, false, 'setResolution'),
      
      // Panel visibility
      showMobilePanel: false,
      setShowMobilePanel: (show) => set({ showMobilePanel: show }, false, 'setShowMobilePanel'),
      toggleMobilePanel: () => set((state) => ({ showMobilePanel: !state.showMobilePanel }), false, 'toggleMobilePanel'),
      
      // Refine input state
      refineInput: '',
      setRefineInput: (input) => set({ refineInput: input }, false, 'setRefineInput'),
      isEnhancing: false,
      setIsEnhancing: (enhancing) => set({ isEnhancing: enhancing }, false, 'setIsEnhancing'),
      unlockMode: false,
      setUnlockMode: (mode) => set({ unlockMode: mode }, false, 'setUnlockMode'),
      
      // Modal states
      isTopupOpen: false,
      setIsTopupOpen: (open) => set({ isTopupOpen: open }, false, 'setIsTopupOpen'),
      showExportModal: false,
      setShowExportModal: (show) => set({ showExportModal: show }, false, 'setShowExportModal'),
      lockModal: defaultLockModal,
      setLockModal: (modal) => set({ lockModal: modal }, false, 'setLockModal'),
      closeLockModal: () => set({ lockModal: defaultLockModal }, false, 'closeLockModal'),
      
      // Auto-generation state
      isAutoGenerating: false,
      setIsAutoGenerating: (generating) => set({ isAutoGenerating: generating }, false, 'setIsAutoGenerating'),
      autoGenCancelled: false,
      setAutoGenCancelled: (cancelled) => set({ autoGenCancelled: cancelled }, false, 'setAutoGenCancelled'),
      
      // Reset UI state
      resetUI: () => set({
        activeView: 'frontClose',
        activeTool: 'none',
        resolution: ImageResolution.STD,
        showMobilePanel: false,
        refineInput: '',
        isEnhancing: false,
        unlockMode: false,
        isTopupOpen: false,
        showExportModal: false,
        lockModal: defaultLockModal,
        isAutoGenerating: false,
        autoGenCancelled: false,
      }, false, 'resetUI'),
    }),
    { name: 'CastingUIStore' }
  )
);

