/**
 * CastingWorkspace — the complete casting surface (attributes, generation,
 * views, surgical edits, refinement) composed from the existing studio parts.
 * One casting surface, two hosts (D-35 Option B): DrapeStudio's casting tool
 * and the board's CastingTakeover.
 *
 * Owns the casting hook wiring and the casting-scoped modals (StageLock,
 * Export). The mint gate (CastModelModal + useCastGate) and credit top-up
 * belong to the hosts — the studio triggers the gate from its sidebar, the
 * takeover from its top bar.
 */
import { useEffect, useMemo, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { useStudioStore } from '../stores/useStudioStore';
import { AnimatedPanel } from './AnimatedPanel';
import { StudioSidePanel } from './StudioSidePanel';
import { useImagePreloader } from '../hooks/useImagePreloader';
import { buildHistoryFromAssets } from '@/features/casting/utils/buildHistoryFromAssets';
import { useCastingFormStore } from '@/features/casting/stores/useCastingFormStore';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';
import { ControlPanel } from '@/features/casting/ControlPanel';
import { ImageViewerPanel } from '@/features/casting/ImageViewerPanel';
import { MasterPromptPanel } from '@/features/casting/MasterPromptPanel';
import { ExportModal } from '@/features/casting/ExportModal';
import { useCastingCanvas } from '@/features/casting/hooks/useCastingCanvas';
import { useCastingGeneration } from '@/features/casting/hooks/useCastingGeneration';
import { useCastingExport } from '@/features/casting/hooks/useCastingExport';
import { useCastingViewGeneration } from '@/features/casting/hooks/useCastingViewGeneration';
import { useLegacyCastingBindings } from '@/features/casting/hooks/castingBindings';

export interface CastingWorkspaceProps {
  user: { role?: string } | null;
  isAuthenticated: boolean;
  isReadOnly: boolean;
  onNewModel: () => void;
  /** Studio's entrance choreography; hosts without it default to visible. */
  leftReady?: boolean;
  rightReady?: boolean;
}

export function CastingWorkspace({
  user,
  isAuthenticated,
  isReadOnly,
  onNewModel,
  leftReady = true,
  rightReady = true,
}: CastingWorkspaceProps) {
  const { canvas, setCanvas } = useStudioStore();
  // R3: minted-edit sessions route saves through the host's identity dialog —
  // the panel's own generate button hides (it would bypass D-11)
  const mintedEdit = useStudioStore((s) => s.mintedEditContext !== null);

  // Casting stores
  const { prefs, modelName } = useCastingFormStore();
  const { genState, setGenState, currentModelId, currentAssets } = useCastingGenerationStore();
  const {
    activeView,
    activeTool: castingActiveTool,
    showExportModal,
    setShowExportModal,
  } = useCastingUIStore();

  // Eagerly preload casting images into browser cache (warm S3 URLs)
  const castingAssetUrls = useMemo(
    () => currentAssets.map((a) => a.storageUrl),
    [currentAssets],
  );
  useImagePreloader(castingAssetUrls);

  // Sync casting assets → shared canvas (skip for uploaded/gallery models)
  useEffect(() => {
    const isExternalModel = canvas.modelSource === 'uploaded' || canvas.castModelId !== null;
    if (isExternalModel) return;

    const hasModel = currentAssets.some((a) => a.viewType === 'frontClose' && a.storageUrl);
    const hasFullBody = currentAssets.some((a) => a.viewType === 'frontFull' && a.storageUrl);
    const hasAllViews =
      hasModel &&
      hasFullBody &&
      currentAssets.some((a) => a.viewType === 'sideClose' && a.storageUrl);

    setCanvas({
      hasModel,
      hasFullBody,
      hasAllViews,
      modelSource: currentModelId ? 'cast' : canvas.modelSource,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAssets, currentModelId]);

  // Canvas drawing hook
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

  // Legacy store-backed bindings for the generation hooks (audit A1 / D-24)
  const castingBindings = useLegacyCastingBindings();

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
    bindings: castingBindings,
  });

  // Post-headshot "next step" affordance (Export). Stage-lock retired (D-46).
  const { nextStage } = useCastingViewGeneration({ bindings: castingBindings });

  // Export hook
  const { handleExport } = useCastingExport({
    currentModelId,
    currentAssets,
    genState,
    setGenState,
    setShowExportModal,
  });

  // Hydrate casting store for gallery/edit-loaded models (assets in DB, not
  // Zustand). IMPERATIVE fetch, not useQuery: a hook would serve the STALE
  // cached model first and the one-shot hydration guard would then block the
  // fresh data — the exact post-update stale-baseline bug (VC-R3 bug 2b).
  // utils.fetch() refetches whenever the entry is stale, so every hydration
  // starts from server truth; the takeover's loader covers the round trip.
  const utils = trpc.useUtils();
  const hydratingRef = useRef(false);
  useEffect(() => {
    const modelId = canvas.castModelId;
    if (modelId === null || currentAssets.length > 0 || hydratingRef.current) return;
    hydratingRef.current = true;
    let cancelled = false;
    utils.models.get
      .fetch({ modelId })
      .then((model) => {
        if (cancelled || !model) return;
        if (useCastingGenerationStore.getState().currentAssets.length > 0) return; // already hydrated

        const assets = (model.assets || []) as Array<{ id: number; viewType: string; storageUrl: string }>;
        const genStore = useCastingGenerationStore.getState();
        const { history, historyIndex, currentAssets: rebuilt } = buildHistoryFromAssets(assets);

        if (rebuilt.length > 0) {
          genStore.setCurrentModelId(model.id);
          genStore.setCurrentAssets(rebuilt);
          genStore.setHistory(history);
          genStore.setHistoryIndex(historyIndex);
          useCastingGenerationStore.setState({ historyAmendments: history.map(() => []) });
          if (model.masterPrompt) {
            genStore.setCurrentMasterPrompt(model.masterPrompt);
          }
        }
        // Restore form preferences so ControlPanel shows actual model identity
        if ((model as any).preferences) {
          const formStore = useCastingFormStore.getState();
          formStore.setPrefs((model as any).preferences as any);
          formStore.setModelName(model.name || '');
        }
        // Minted edit: the D-11 diff baseline is THIS payload — the same
        // data the form was just filled from, recorded here rather than
        // re-read from the store later (timing-free by construction)
        const studio = useStudioStore.getState();
        if (studio.mintedEditContext?.modelId === model.id) {
          studio.setMintedEditContext({
            ...studio.mintedEditContext,
            baselinePrefs: JSON.parse(JSON.stringify((model as any).preferences ?? {})),
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        hydratingRef.current = false;
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas.castModelId, currentAssets.length]);

  // Form completion progress (12 fields)
  const formProgress = useMemo(() => {
    const c = [!!prefs.castingBrand, !!(prefs.castingVibe && (prefs.castingVibe.editorial > 0 || prefs.castingVibe.commercial > 0 || prefs.castingVibe.runway > 0)), !!prefs.gender, !!(prefs.age && prefs.ethnicity), !!prefs.bodyType, !!prefs.faceShape, !!prefs.skinTone, !!(prefs.skinTexture || prefs.skinFinish), !!prefs.eyeColor, !!prefs.eyeColor, !!prefs.hairColor, !!prefs.hairStyle];
    return Math.round((c.filter(Boolean).length / 12) * 100);
  }, [prefs]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 relative w-full">
      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        previewImage={
          currentAssets.find((a) => a.viewType === 'frontClose')?.storageUrl ?? undefined
        }
      />

      {/* Left Panel — Control (slides from left) */}
      <AnimatedPanel
        ready={leftReady}
        from="left"
        offset={60}
        duration={500}
        className="w-full lg:w-auto flex-shrink-0 relative z-10"
      >
        <StudioSidePanel side="left" width={320}>
          <ControlPanel
            user={user}
            isFormValid={isFormValid}
            genState={genState}
            currentAssets={currentAssets}
            handleGenerate={handleGenerate}
            isReadOnly={isReadOnly}
            onNewModel={onNewModel}
            modelName={modelName}
            mintedEdit={mintedEdit}
          />
        </StudioSidePanel>
      </AnimatedPanel>

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
          isReadOnly={isReadOnly}
        />
      </div>

      {/* Right Panel — Master Prompt (slides from right) */}
      <AnimatedPanel
        ready={rightReady}
        from="right"
        offset={60}
        duration={500}
        className="hidden lg:block flex-shrink-0"
      >
        <StudioSidePanel side="right" width={320}>
          <MasterPromptPanel />
        </StudioSidePanel>
      </AnimatedPanel>
    </div>
  );
}
