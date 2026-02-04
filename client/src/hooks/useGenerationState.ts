import { useState, useCallback, useMemo } from 'react';

/**
 * useGenerationState - Custom hook for managing CastingStudio generation state
 * 
 * INTEGRATION GUIDE:
 * -----------------
 * To integrate this hook into CastingStudio.tsx:
 * 
 * 1. Import the hook:
 *    import { 
 *      useGenerationState, 
 *      type GeneratedAsset, 
 *      type GenerationState,
 *      type EditTool,
 *      ImageResolution,
 *      CREDIT_COSTS 
 *    } from '@/hooks/useGenerationState';
 * 
 * 2. Replace state declarations in CastingStudio component:
 *    const {
 *      genState, setGenState,
 *      currentModelId, setCurrentModelId,
 *      currentAssets, setCurrentAssets,
 *      activeView, setActiveView,
 *      currentMasterPrompt, setCurrentMasterPrompt,
 *      currentTechnicalSchema, setCurrentTechnicalSchema,
 *      history, setHistory,
 *      historyIndex, setHistoryIndex,
 *      isAutoGenerating, setIsAutoGenerating,
 *      autoGenCancelled, setAutoGenCancelled,
 *      activeTool, setActiveTool,
 *      // Computed values
 *      isMasking,
 *      currentImageUrl,
 *      isViewLocked,
 *      hasDownstreamDependencies,
 *      isIterationAllowed,
 *      // Mutations
 *      mutations,
 *      // Helpers
 *      startGeneration,
 *      updateProgress,
 *      endGeneration,
 *    } = useGenerationState();
 * 
 * 3. Replace mutation declarations with mutations object:
 *    // BEFORE: const createModelMutation = trpc.models.create.useMutation();
 *    // AFTER:  Use mutations.createModel
 * 
 * 4. Remove local computed values (isMasking, currentImageUrl, etc.)
 * 
 * 5. Update handler functions to use helper methods:
 *    // BEFORE: setGenState({ isGenerating: true, currentStep: "...", ... });
 *    // AFTER:  startGeneration("...", 15000);
 * 
 * NOTE: Handler functions (handleGenerate, handleGenerateFullBody, etc.)
 * should remain in the component as they orchestrate complex UI interactions.
 */

import { trpc } from '@/lib/trpc';

// ============ Types ============

export interface GeneratedAsset {
  id: number;
  viewType: string;
  storageUrl: string;
}

export interface GenerationState {
  isGenerating: boolean;
  currentStep: string;
  error: string | null;
  progress?: number; // 0-100 percentage
  startTime?: number; // timestamp when generation started
  estimatedDuration?: number; // estimated duration in ms
}

export type EditTool = 'none' | 'surgical' | 'eraser';

export enum ImageResolution {
  STD = '1K',
  HIGH = '2K',
  ULTRA = '4K',
}

// Credit costs for each action (1 credit ≈ $0.01)
export const CREDIT_COSTS = {
  masterPrompt: 0,      // Included with castingImage
  castingImage: 7,      // Initial headshot generation
  fullBody: 6,          // Full body from headshot
  multiView: 6,         // Single view: side/walk/back
  iteration: 7,         // Surgical edit / iteration
  eraser: 7,            // Magic eraser
} as const;

// ============ Hook ============

export function useGenerationState() {
  // Generation state
  const [genState, setGenState] = useState<GenerationState>({
    isGenerating: false,
    currentStep: "",
    error: null,
  });

  // Current model state
  const [currentModelId, setCurrentModelId] = useState<number | null>(null);
  const [currentAssets, setCurrentAssets] = useState<GeneratedAsset[]>([]);
  const [activeView, setActiveView] = useState<string>("frontClose");
  const [currentMasterPrompt, setCurrentMasterPrompt] = useState<string>("");
  const [currentTechnicalSchema, setCurrentTechnicalSchema] = useState<Record<string, any> | null>(null);

  // History for undo/redo
  const [history, setHistory] = useState<GeneratedAsset[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Auto-generation state
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [autoGenCancelled, setAutoGenCancelled] = useState(false);

  // Tools state
  const [activeTool, setActiveTool] = useState<EditTool>('none');

  // Mutations
  const createModelMutation = trpc.models.create.useMutation();
  const generateCastingMutation = trpc.generation.castingImage.useMutation();
  const generateFullBodyMutation = trpc.generation.fullBody.useMutation();
  const generateMultiViewMutation = trpc.generation.multiView.useMutation();
  const generateAllViewsMutation = trpc.generation.generateAllViews.useMutation();
  const iterateMutation = trpc.generation.iterate.useMutation();
  const upscaleMutation = trpc.generation.upscale.useMutation();
  const proxyImageMutation = trpc.generation.proxyImage.useMutation();
  const enhanceMutation = trpc.generation.enhance.useMutation();
  const mintMutation = trpc.generation.mint.useMutation();
  const generatePdfMutation = trpc.generation.generatePdf.useMutation();

  // Computed values
  const isMasking = activeTool !== 'none';

  const currentImageUrl = useMemo(() => {
    const asset = currentAssets.find((a) => a.viewType === activeView);
    return asset?.storageUrl || null;
  }, [currentAssets, activeView]);

  const isViewLocked = useMemo(() => {
    if (activeView === 'frontClose' && currentAssets.some(a => a.viewType === 'frontFull')) return true;
    if (activeView === 'frontFull' && currentAssets.some(a => ['sideClose', 'sideFull', 'backFull'].includes(a.viewType))) return true;
    return false;
  }, [activeView, currentAssets]);

  const hasDownstreamDependencies = useMemo(() => {
    if (currentAssets.length === 0) return false;
    if (activeView === 'frontClose' && currentAssets.some(a => a.viewType === 'frontFull')) return true;
    if (activeView === 'frontFull' && currentAssets.some(a => a.viewType === 'sideClose')) return true;
    return false;
  }, [activeView, currentAssets]);

  const isIterationAllowed = useMemo(() => {
    return ['frontClose', 'frontFull', 'backFull'].includes(activeView);
  }, [activeView]);

  // State update helpers
  const startGeneration = useCallback((step: string, estimatedDuration: number = 15000) => {
    setGenState({
      isGenerating: true,
      currentStep: step,
      error: null,
      progress: 0,
      startTime: Date.now(),
      estimatedDuration,
    });
  }, []);

  const updateProgress = useCallback((step: string, progress: number) => {
    setGenState(prev => ({ ...prev, currentStep: step, progress }));
  }, []);

  const endGeneration = useCallback((error?: string) => {
    setGenState({
      isGenerating: false,
      currentStep: "",
      error: error || null,
    });
  }, []);

  const addAsset = useCallback((asset: GeneratedAsset, clearDownstream: boolean = false) => {
    setCurrentAssets(prev => {
      let newAssets = [...prev];
      
      if (clearDownstream) {
        // Clear downstream views based on current view
        if (asset.viewType === 'frontClose') {
          newAssets = newAssets.filter(a => a.viewType === 'frontClose');
        } else if (asset.viewType === 'frontFull') {
          newAssets = newAssets.filter(a => ['frontClose', 'frontFull'].includes(a.viewType));
        }
      }
      
      // Replace or add the asset
      newAssets = [...newAssets.filter(a => a.viewType !== asset.viewType), asset];
      return newAssets;
    });
  }, []);

  const updateHistory = useCallback((newAssets: GeneratedAsset[]) => {
    setHistory(prev => [...prev.slice(0, historyIndex + 1), newAssets]);
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  // Reset state
  const resetGeneration = useCallback(() => {
    setGenState({ isGenerating: false, currentStep: "", error: null });
    setCurrentModelId(null);
    setCurrentAssets([]);
    setActiveView("frontClose");
    setCurrentMasterPrompt("");
    setCurrentTechnicalSchema(null);
    setHistory([]);
    setHistoryIndex(-1);
    setIsAutoGenerating(false);
    setAutoGenCancelled(false);
    setActiveTool('none');
  }, []);

  return {
    // State
    genState,
    setGenState,
    currentModelId,
    setCurrentModelId,
    currentAssets,
    setCurrentAssets,
    activeView,
    setActiveView,
    currentMasterPrompt,
    setCurrentMasterPrompt,
    currentTechnicalSchema,
    setCurrentTechnicalSchema,
    history,
    setHistory,
    historyIndex,
    setHistoryIndex,
    isAutoGenerating,
    setIsAutoGenerating,
    autoGenCancelled,
    setAutoGenCancelled,
    activeTool,
    setActiveTool,

    // Computed values
    isMasking,
    currentImageUrl,
    isViewLocked,
    hasDownstreamDependencies,
    isIterationAllowed,

    // Mutations
    mutations: {
      createModel: createModelMutation,
      generateCasting: generateCastingMutation,
      generateFullBody: generateFullBodyMutation,
      generateMultiView: generateMultiViewMutation,
      generateAllViews: generateAllViewsMutation,
      iterate: iterateMutation,
      upscale: upscaleMutation,
      proxyImage: proxyImageMutation,
      enhance: enhanceMutation,
      mint: mintMutation,
      generatePdf: generatePdfMutation,
    },

    // Helpers
    startGeneration,
    updateProgress,
    endGeneration,
    addAsset,
    updateHistory,
    resetGeneration,
  };
}

export type UseGenerationStateReturn = ReturnType<typeof useGenerationState>;
