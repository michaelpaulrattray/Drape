/**
 * BoardCastingPanel — Right-side panel for casting a model from the board canvas.
 *
 * Wraps the existing ControlPanel and hooks from the casting feature.
 * On generation start, inserts a skeleton board_item (no image) at the viewport center.
 * When the headshot arrives, updates the skeleton with the real image.
 * Subsequent view generations update the card image.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { ControlPanel } from '@/features/casting/ControlPanel';
import { StageLockModal } from '@/features/casting/StageLockModal';
import { ExportModal } from '@/features/casting/ExportModal';
import { useCastingFormStore } from '@/features/casting/stores/useCastingFormStore';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';
import { useCastingCanvas } from '@/features/casting/hooks/useCastingCanvas';
import { useCastingGeneration } from '@/features/casting/hooks/useCastingGeneration';
import { useCastingViewGeneration } from '@/features/casting/hooks/useCastingViewGeneration';
import { useLegacyCastingBindings } from '@/features/casting/hooks/castingBindings';
import { useCastingExport } from '@/features/casting/hooks/useCastingExport';
import { CreditTopupModal } from '@/features/billing/CreditTopupModal';

/* ── Constants ───────────────────────────────────────────── */

const MODEL_NODE_WIDTH = 400;
const MODEL_NODE_HEIGHT = 500;

/* ── Types ────────────────────────────────────────────────── */

interface BoardCastingPanelProps {
  boardId: number;
  onModelGenerated?: (itemId: number) => void;
  getViewportCenter?: () => { x: number; y: number };
  scrollToNode?: (itemId: number) => void;
}

/* ── Component ────────────────────────────────────────────── */

export function BoardCastingPanel({ boardId, onModelGenerated, getViewportCenter, scrollToNode }: BoardCastingPanelProps) {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  // Casting stores
  const { modelName } = useCastingFormStore();
  const {
    genState,
    setGenState,
    currentModelId,
    currentAssets,
  } = useCastingGenerationStore();
  const {
    activeView,
    activeTool: castingActiveTool,
    showExportModal,
    setShowExportModal,
    lockModal,
    closeLockModal,
    isTopupOpen,
    setIsTopupOpen,
  } = useCastingUIStore();

  // Canvas hook (for masking — needed by generation hook)
  const {
    canvasRef,
    imageRef,
    maskPaths,
    isMasking,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    getGuideOverlayDataUrl,
    clearMask,
  } = useCastingCanvas(castingActiveTool, activeView, currentAssets);

  // Legacy store-backed bindings for the generation hooks (audit A1 / D-24 —
  // this whole panel is deleted in M4; until then it stays on the legacy path)
  const castingBindings = useLegacyCastingBindings();

  // Generation hook
  const {
    creditsData,
    refetchCreditsWithWarning,
    isFormValid,
    handleGenerate: baseHandleGenerate,
    handleRefineSubmit,
    handleEnhance,
    handleRetry,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
  } = useCastingGeneration({
    isAuthenticated,
    activeTool: castingActiveTool,
    isMasking,
    getGuideOverlayDataUrl,
    clearMask,
    bindings: castingBindings,
  });

  // View generation hook
  const { nextStage } = useCastingViewGeneration({
    isAuthenticated,
    creditsData,
    refetchCreditsWithWarning,
    bindings: castingBindings,
  });

  // Export hook
  const { handleExport } = useCastingExport({
    currentModelId,
    currentAssets,
    genState,
    setGenState,
    setShowExportModal,
  });

  // Board item mutations
  const addItemMutation = trpc.boards.addItem.useMutation({
    onSuccess: () => utils.boards.getItems.invalidate({ boardId }),
  });

  const updateItemMutation = trpc.boards.updateItem.useMutation({
    onSuccess: () => utils.boards.getItems.invalidate({ boardId }),
  });

  // Track the skeleton board item ID we created for the current generation
  const skeletonItemIdRef = useRef<number | null>(null);
  // Track whether we've already handled this model (to avoid duplicate inserts)
  const insertedModelRef = useRef<number | null>(null);
  // Track previous genState.isGenerating to detect transition to true
  const wasGeneratingRef = useRef(false);
  // Batch generation counter — used to offset each new skeleton in a grid
  const batchIndexRef = useRef(0);
  // Anchor position for the first node in a batch (set on first skeleton)
  const batchAnchorRef = useRef<{ x: number; y: number } | null>(null);

  // Step 1: When generation STARTS, insert a skeleton node (no image) at viewport center
  // Uses grid layout for batch generations: each new skeleton is placed next to the previous one
  useEffect(() => {
    const justStarted = genState.isGenerating && !wasGeneratingRef.current;
    wasGeneratingRef.current = genState.isGenerating;

    if (!justStarted) return;
    // Don't insert skeleton if we already have a model card for this generation
    if (insertedModelRef.current !== null) return;

    const GAP = 24;
    const COLS = 4;
    const center = getViewportCenter?.() ?? { x: 200, y: 200 };

    // Set anchor on first generation in a batch
    if (!batchAnchorRef.current) {
      batchAnchorRef.current = {
        x: center.x - MODEL_NODE_WIDTH / 2,
        y: center.y - MODEL_NODE_HEIGHT / 2,
      };
    }

    const col = batchIndexRef.current % COLS;
    const row = Math.floor(batchIndexRef.current / COLS);
    const posX = Math.round(batchAnchorRef.current.x + col * (MODEL_NODE_WIDTH + GAP));
    const posY = Math.round(batchAnchorRef.current.y + row * (MODEL_NODE_HEIGHT + GAP));
    batchIndexRef.current += 1;

    addItemMutation.mutate(
      {
        boardId,
        type: 'model',
        label: modelName || 'Generating...',
        positionX: posX,
        positionY: posY,
        width: MODEL_NODE_WIDTH,
        height: MODEL_NODE_HEIGHT,
        metadata: { viewType: 'frontClose', isGenerating: true, generatingStep: genState.currentStep || 'Starting...' },
      },
      {
        onSuccess: (result) => {
          skeletonItemIdRef.current = result.id;
        },
        onError: () => {
          skeletonItemIdRef.current = null;
        },
      },
    );
  }, [genState.isGenerating, boardId, modelName, getViewportCenter]);

  // Step 2: When headshot arrives, update the skeleton node with the real image + auto-scroll
  useEffect(() => {
    if (!currentModelId) return;
    if (insertedModelRef.current === currentModelId) return;

    const headshot = currentAssets.find((a) => a.viewType === 'frontClose');
    if (!headshot) return;

    // Mark as handled
    insertedModelRef.current = currentModelId;

    if (skeletonItemIdRef.current) {
      const itemId = skeletonItemIdRef.current;
      updateItemMutation.mutate(
        {
          itemId,
          label: modelName || `Model ${currentModelId}`,
          imageUrl: headshot.storageUrl,
          metadata: { viewType: 'frontClose' },
        },
        {
          onSuccess: () => {
            onModelGenerated?.(itemId);
            // Auto-scroll to the completed node after a brief delay for render
            setTimeout(() => scrollToNode?.(itemId), 300);
          },
          onError: () => {
            toast.error('Failed to update model on canvas');
          },
        },
      );
      skeletonItemIdRef.current = null;
    } else {
      // Fallback: skeleton wasn't created, insert full item at viewport center
      const center = getViewportCenter?.() ?? { x: 200, y: 200 };
      addItemMutation.mutate(
        {
          boardId,
          type: 'model',
          label: modelName || `Model ${currentModelId}`,
          imageUrl: headshot.storageUrl,
          sourceModelId: currentModelId,
          positionX: Math.round(center.x - MODEL_NODE_WIDTH / 2),
          positionY: Math.round(center.y - MODEL_NODE_HEIGHT / 2),
          width: MODEL_NODE_WIDTH,
          height: MODEL_NODE_HEIGHT,
          metadata: { viewType: 'frontClose' },
        },
        {
          onSuccess: (result) => {
            onModelGenerated?.(result.id);
            setTimeout(() => scrollToNode?.(result.id), 300);
          },
          onError: () => {
            toast.error('Failed to add model to canvas');
            insertedModelRef.current = null;
          },
        },
      );
    }
  }, [currentModelId, currentAssets, boardId, modelName, getViewportCenter, scrollToNode]);

  // Update the board item image when a new view is generated (full body, side)
  const prevAssetCountRef = useRef(0);
  useEffect(() => {
    if (currentAssets.length <= prevAssetCountRef.current) {
      prevAssetCountRef.current = currentAssets.length;
      return;
    }
    prevAssetCountRef.current = currentAssets.length;

    // Find the latest asset (the one just generated)
    const latest = currentAssets[currentAssets.length - 1];
    if (!latest || !currentModelId) return;

    // Update the existing board item's image to the latest view
    // We find the item by sourceModelId
    const existingItems = utils.boards.getItems.getData({ boardId });
    const modelItem = existingItems?.find(
      (i) => i.sourceModelId === currentModelId,
    );
    if (modelItem) {
      utils.boards.getItems.setData({ boardId }, (old) =>
        old?.map((i) =>
          i.id === modelItem.id
            ? { ...i, imageUrl: latest.storageUrl, metadata: { ...((i.metadata as Record<string, unknown>) || {}), viewType: latest.viewType } }
            : i,
        ),
      );
    }
  }, [currentAssets, currentModelId, boardId]);

  // Step 2b: Update skeleton node's progress text as genState.currentStep changes
  useEffect(() => {
    if (!genState.isGenerating || !skeletonItemIdRef.current) return;
    const step = genState.currentStep || 'Generating...';
    // Optimistic cache update — no server round-trip
    utils.boards.getItems.setData({ boardId }, (old) =>
      old?.map((i) =>
        i.id === skeletonItemIdRef.current
          ? { ...i, metadata: { ...((i.metadata as Record<string, unknown>) || {}), generatingStep: step } }
          : i,
      ),
    );
  }, [genState.currentStep, genState.isGenerating, boardId]);

  // Handle new model — reset stores
  const handleNewModel = useCallback(() => {
    useCastingGenerationStore.getState().resetGeneration();
    useCastingFormStore.getState().resetForm();
    insertedModelRef.current = null;
    skeletonItemIdRef.current = null;
    wasGeneratingRef.current = false;
    // Don't reset batch refs — allow grid to continue across models
    toast.success('Starting fresh model');
  }, []);

  // Form progress (same calculation as DrapeStudio)
  const prefs = useCastingFormStore((s) => s.prefs);
  const formProgress = useMemo(() => {
    const c = [
      !!prefs.castingBrand,
      !!(prefs.castingVibe && (prefs.castingVibe.editorial > 0 || prefs.castingVibe.commercial > 0 || prefs.castingVibe.runway > 0)),
      !!prefs.gender,
      !!(prefs.age && prefs.ethnicity),
      !!prefs.bodyType,
      !!prefs.faceShape,
      !!prefs.skinTone,
      !!(prefs.skinTexture || prefs.skinFinish),
      !!prefs.eyeColor,
      !!prefs.eyeColor,
      !!prefs.hairColor,
      !!prefs.hairStyle,
    ];
    return Math.round((c.filter(Boolean).length / 12) * 100);
  }, [prefs]);

  return (
    <>
      {/* Stage Lock Modal */}
      <StageLockModal
        isOpen={lockModal.isOpen}
        title={lockModal.title}
        message={lockModal.message}
        onConfirm={lockModal.onConfirm}
        onCancel={closeLockModal}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        previewImage={
          currentAssets.find((a) => a.viewType === 'frontClose')?.storageUrl
        }
      />

      {/* Credit Topup Modal */}
      <CreditTopupModal
        isOpen={isTopupOpen}
        onClose={() => setIsTopupOpen(false)}
        currentBalance={creditsData?.balance || 0}
      />

      {/* Casting Form */}
      <ControlPanel
        user={user}
        isFormValid={isFormValid}
        genState={genState}
        currentAssets={currentAssets}
        handleGenerate={baseHandleGenerate}
        onNewModel={handleNewModel}
        modelName={modelName}
      />
    </>
  );
}
