/**
 * ModelEditorOverlay — Fullscreen overlay for refining a model from the board canvas.
 *
 * Opened by double-clicking a model node on the canvas.
 * Wraps ImageViewerPanel + MasterPromptPanel from the casting feature,
 * providing the full refinement workflow (surgical edit, eraser, undo/redo, views).
 */
import { useCallback, useEffect, useMemo } from 'react';
import { X, Maximize2 } from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { ImageViewerPanel } from '@/features/casting/ImageViewerPanel';
import { MasterPromptPanel } from '@/features/casting/MasterPromptPanel';
import { StageLockModal } from '@/features/casting/StageLockModal';
import { useCastingFormStore } from '@/features/casting/stores/useCastingFormStore';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';
import { useCastingCanvas } from '@/features/casting/hooks/useCastingCanvas';
import { useCastingGeneration } from '@/features/casting/hooks/useCastingGeneration';
import { useCastingViewGeneration } from '@/features/casting/hooks/useCastingViewGeneration';
import { CreditTopupModal } from '@/features/billing/CreditTopupModal';

/* ── Types ────────────────────────────────────────────────── */

interface ModelEditorOverlayProps {
  /** The board item being edited */
  itemId: number;
  /** Close the overlay */
  onClose: () => void;
}

/* ── Component ────────────────────────────────────────────── */

export function ModelEditorOverlay({ itemId, onClose }: ModelEditorOverlayProps) {
  const { isAuthenticated } = useAuth();

  // Casting stores
  const prefs = useCastingFormStore((s) => s.prefs);
  const {
    genState,
    currentAssets,
  } = useCastingGenerationStore();
  const {
    activeView,
    activeTool: castingActiveTool,
    lockModal,
    closeLockModal,
    isTopupOpen,
    setIsTopupOpen,
  } = useCastingUIStore();

  // Canvas hook (masking)
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
    currentImageUrl,
    isViewLocked,
    hasDownstreamDependencies,
    isIterationAllowed,
    handleGenerate,
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

  // Form progress
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

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lockModal.isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, lockModal.isOpen]);

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col"
      style={{ background: '#FAFAF8' }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-5 flex-shrink-0"
        style={{
          height: 52,
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          background: '#fff',
        }}
      >
        <div className="flex items-center gap-3">
          <Maximize2 size={16} style={{ color: '#71716A' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
            Model Editor
          </span>
          {currentAssets.length > 0 && (
            <span
              style={{
                fontSize: 11,
                color: '#71716A',
                background: 'rgba(0,0,0,0.04)',
                padding: '2px 8px',
                borderRadius: 6,
              }}
            >
              {currentAssets.length} view{currentAssets.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            color: '#71716A',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          title="Close (Esc)"
        >
          <X size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* Content area — ImageViewer + MasterPromptPanel */}
      <div className="flex-1 flex min-h-0">
        {/* Center — Image Viewer */}
        <div className="flex-1 min-w-0 h-full relative">
          <ImageViewerPanel
            currentImageUrl={currentImageUrl ?? undefined}
            currentAssets={currentAssets}
            genState={genState}
            isViewLocked={isViewLocked}
            hasDownstreamDependencies={hasDownstreamDependencies}
            isIterationAllowed={isIterationAllowed}
            isMasking={isMasking}
            maskPathsCount={maskPaths.length}
            formProgress={formProgress}
            nextStage={nextStage}
            canvasRef={canvasRef}
            imageRef={imageRef}
            handlePointerDown={handlePointerDown}
            handlePointerMove={handlePointerMove}
            handlePointerUp={handlePointerUp}
            handleUndo={handleUndo}
            handleRedo={handleRedo}
            handleRetry={handleRetry}
            handleGenerate={handleGenerate}
            handleEnhance={handleEnhance}
            handleRefineSubmit={handleRefineSubmit}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        </div>

        {/* Right — Master Prompt Panel */}
        <div
          className="hidden lg:flex flex-col flex-shrink-0"
          style={{
            width: 320,
            borderLeft: '1px solid rgba(0,0,0,0.06)',
            background: '#fff',
          }}
        >
          <MasterPromptPanel />
        </div>
      </div>

      {/* Modals */}
      <StageLockModal
        isOpen={lockModal.isOpen}
        title={lockModal.title}
        message={lockModal.message}
        onConfirm={lockModal.onConfirm}
        onCancel={closeLockModal}
      />
      <CreditTopupModal
        isOpen={isTopupOpen}
        onClose={() => setIsTopupOpen(false)}
        currentBalance={creditsData?.balance || 0}
      />
    </div>
  );
}
