/**
 * BoardCastingPanel — Right-side panel for casting a model from the board canvas.
 *
 * Wraps the existing ControlPanel and hooks from the casting feature.
 * On successful headshot generation, inserts a board_item (type: 'model')
 * onto the canvas. Subsequent view generations update the card image.
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
import { useCastingExport } from '@/features/casting/hooks/useCastingExport';
import { CreditTopupModal } from '@/features/billing/CreditTopupModal';

/* ── Types ────────────────────────────────────────────────── */

interface BoardCastingPanelProps {
  boardId: number;
  onModelGenerated?: (itemId: number) => void;
}

/* ── Component ────────────────────────────────────────────── */

export function BoardCastingPanel({ boardId, onModelGenerated }: BoardCastingPanelProps) {
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
  });

  // View generation hook
  const { nextStage } = useCastingViewGeneration({
    isAuthenticated,
    creditsData,
    refetchCreditsWithWarning,
  });

  // Export hook
  const { handleExport } = useCastingExport({
    currentModelId,
    currentAssets,
    genState,
    setGenState,
    setShowExportModal,
  });

  // Board item insertion mutation
  const addItemMutation = trpc.boards.addItem.useMutation({
    onSuccess: () => utils.boards.getItems.invalidate({ boardId }),
  });

  // Track whether we've already inserted a card for this model
  const insertedModelRef = useRef<number | null>(null);

  // After headshot generation succeeds, insert a board_item
  useEffect(() => {
    if (!currentModelId) return;
    if (insertedModelRef.current === currentModelId) return;

    const headshot = currentAssets.find((a) => a.viewType === 'frontClose');
    if (!headshot) return;

    // Mark as inserted before the mutation fires
    insertedModelRef.current = currentModelId;

    addItemMutation.mutate(
      {
        boardId,
        type: 'model',
        label: modelName || `Model ${currentModelId}`,
        imageUrl: headshot.storageUrl,
        sourceModelId: currentModelId,
        positionX: 100 + Math.floor(Math.random() * 200),
        positionY: 100 + Math.floor(Math.random() * 200),
        width: 280,
        height: 280,
        metadata: { viewType: 'frontClose' },
      },
      {
        onSuccess: (result) => {
          onModelGenerated?.(result.id);
        },
        onError: () => {
          toast.error('Failed to add model to canvas');
          insertedModelRef.current = null;
        },
      },
    );
  }, [currentModelId, currentAssets, boardId, modelName]);

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

  // Handle new model — reset stores
  const handleNewModel = useCallback(() => {
    useCastingGenerationStore.getState().resetGeneration();
    useCastingFormStore.getState().resetForm();
    insertedModelRef.current = null;
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
