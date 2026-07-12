import { useRef, useState, useEffect, useMemo, useCallback, RefObject } from "react";
import { ViewTabs, RefinePanel, WarmEmptyState, RotatingSuggestions, ToolButton, NextStepChip } from "./components/ImageViewer";
import { MaskCanvas } from "./components/ImageViewer/MaskCanvas";
import { useCastingFormStore } from "@/features/casting/stores/useCastingFormStore";
import { useCastingGenerationStore } from "@/features/casting/stores/useCastingGenerationStore";
import { useCastingUIStore } from "@/features/casting/stores/useCastingUIStore";
import { trpc } from "@/lib/trpc";
import { type GeneratedAsset, type GenerationState } from "@/features/casting/constants";
import { StudioCanvas } from "@/features/studio/components/StudioCanvas";
import { ImageActionBar } from "@/features/studio/components/ImageActionBar";

// ============ View Labels ============

const VIEW_DISPLAY_NAMES: Record<string, string> = {
  frontClose: 'Headshot',
  frontFull: 'Full Body',
  sideClose: 'Side',
};



// ============ Types ============

interface ImageViewerPanelProps {
  currentImageUrl: string | undefined;
  currentAssets: GeneratedAsset[];
  genState: GenerationState;
  isViewLocked: boolean;
  hasDownstreamDependencies: boolean;
  isIterationAllowed: boolean;
  isMasking: boolean;
  maskPathsCount: number;
  formProgress: number;
  nextStage: {
    label: string;
    action: () => void;
  } | null;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  imageRef: RefObject<HTMLImageElement | null>;
  handlePointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerUp: () => void;
  handleRetry: () => void;
  handleGenerate: () => void;
  handleEnhance: () => void;
  handleRefineSubmit: () => void;
  isReadOnly?: boolean;
}

const CASTING_TIP_DISMISSED_KEY = 'drape_casting_tip_dismissed';

// ============ Main Component ============

export function ImageViewerPanel({
  currentImageUrl,
  currentAssets,
  genState,
  isViewLocked,
  hasDownstreamDependencies,
  isIterationAllowed,
  isMasking,
  maskPathsCount,
  formProgress,
  nextStage,
  canvasRef,
  imageRef,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handleRetry,
  handleGenerate,
  handleEnhance,
  handleRefineSubmit,
  isReadOnly,
}: ImageViewerPanelProps) {
  const { prefs, updatePref } = useCastingFormStore();
  const {
    setGenState,
    historyIndex,
    history,
    suggestions,
    isLoadingSuggestions,
    identityWarning,
    currentModelId,
  } = useCastingGenerationStore();

  // D-53 vN unification: ONE version vocabulary — the ledger's per-slot count
  // (the same number the comp card shows). The client-stack denominator
  // (`historyIndex + 1`) lied: it counted synthesized cross-view snapshots.
  const packageQuery = trpc.generation.packageState.useQuery(
    { modelId: currentModelId ?? 0 },
    { enabled: !!currentModelId, staleTime: 15_000 },
  );
  const {
    activeView,
    activeTool,
    unlockMode,
    setRefineInput,
  } = useCastingUIStore();

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [imageAreaHovered, setImageAreaHovered] = useState(false);

  // Contextual tip: auto-dismiss after first refinement, persist in localStorage
  const [tipDismissed, setTipDismissed] = useState(() => {
    try { return localStorage.getItem(CASTING_TIP_DISMISSED_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    if (!tipDismissed && historyIndex > 0) {
      setTipDismissed(true);
      try { localStorage.setItem(CASTING_TIP_DISMISSED_KEY, '1'); } catch {}
    }
  }, [historyIndex, tipDismissed]);

  // Floating Reference State
  const [refVisible, setRefVisible] = useState(true);
  const [refPos, setRefPos] = useState({ x: -1, y: 56 });
  const [refSize, setRefSize] = useState(120);
  const refDragging = useRef(false);
  const refDragOffset = useRef({ x: 0, y: 0 });

  // Floating reference drag
  const handleRefMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    refDragging.current = true;
    refDragOffset.current = { x: e.clientX - refPos.x, y: e.clientY - refPos.y };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!refDragging.current) return;
      setRefPos({ x: e.clientX - refDragOffset.current.x, y: e.clientY - refDragOffset.current.y });
    };
    const handleMouseUp = () => { refDragging.current = false; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Compare URL derivation
  const getPreviousImage = useCallback(() => {
    if (historyIndex <= 0 || currentAssets.length === 0) return null;
    const prevAssets = history[historyIndex - 1];
    const prevAsset = prevAssets?.find(a => a.viewType === activeView);
    return prevAsset?.storageUrl || null;
  }, [history, historyIndex, currentAssets, activeView]);

  const compareUrl = getPreviousImage();
  const compareLabel = historyIndex <= 1 ? 'Original' : 'Previous';

  // Determine if form is ready to generate
  const isFormReady = formProgress >= 50;
  const hasAssets = currentAssets.length > 0;
  const hasResult = hasAssets;

  // Casting-specific keyboard handler
  const castingKeyHandler = useCallback((e: KeyboardEvent) => {
    // Ctrl+G / ⌘G — trigger generation (works even with no assets yet)
    if (e.key === 'g' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!isReadOnly && !genState.isGenerating) handleGenerate();
      return true;
    }
    if (currentAssets.length === 0) return false;
    if (isReadOnly) return false; // No editing shortcuts in read-only mode
    switch (e.key) {
      case '/': {
        const refineEl = document.querySelector('[data-refine-input]') as HTMLTextAreaElement;
        if (refineEl) { e.preventDefault(); refineEl.focus(); return true; }
        break;
      }
      case 'f':
      case 'F':
        if (prefs.referenceImage) { setRefVisible(v => !v); return true; }
        break;
    }
    return false;
  }, [currentAssets.length, prefs.referenceImage, isReadOnly, genState.isGenerating, handleGenerate]);

  // ── Derive StudioCanvas props ──
  const viewName = VIEW_DISPLAY_NAMES[activeView] || activeView;
  // D-53: the ledger's per-slot count — the comp card's vN and the viewer's
  // vN are the SAME number now (the client-stack denominator died)
  const ledgerVersion =
    packageQuery.data?.slots.find((s) => s.angle === activeView)?.version ?? null;
  const statusLabel = genState.isGenerating
    ? (genState.currentStep || 'Generating...')
    : isReadOnly && hasResult
      ? `${viewName} \u00b7 final`
      : hasResult
        ? ledgerVersion
          ? `${viewName} \u00b7 v${ledgerVersion}`
          : viewName
        : 'Set up your model';

  // ── Top overlay: ViewTabs + Identity Warning ──
  const topOverlay = (
    <>
      <ViewTabs />
      {/* A1 stage 2 (D-53 rider): the fork-guidance surface — the seal's
          refusal teaches the doors where the edit happened (F4/D-40), with
          a WORKING Fork door (routes into the D-11 fork ceremony carrying
          the attempted edit as the fork's casting note). */}
      {genState.identityRefusal && !genState.isGenerating && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 w-[440px] max-w-[calc(100%-32px)] rounded-canvas-md bg-canvas-surface border-hairline border-canvas-border-strong p-3.5">
          <div className="text-canvas-lg font-medium text-canvas-ink mb-1">
            This edit changes who they are
          </div>
          <div className="text-canvas-md text-canvas-ink-soft mb-3" style={{ lineHeight: 1.5 }}>
            {genState.identityRefusal.message}
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setGenState((p) => ({ ...p, identityRefusal: null }))}
              className="text-canvas-md font-medium text-canvas-ink-faint hover:text-canvas-ink-soft transition-colors"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => {
                const editText = genState.identityRefusal!.editText;
                setGenState((p) => ({ ...p, identityRefusal: null }));
                window.dispatchEvent(
                  new CustomEvent("casting-fork-from-refusal", { detail: { editText } }),
                );
              }}
              className="px-3.5 py-1.5 rounded-canvas-pill bg-canvas-ink text-canvas-md font-medium transition-opacity hover:opacity-90"
              style={{ color: "var(--color-canvas-surface)" }}
            >
              Fork to explore this
            </button>
          </div>
        </div>
      )}
      {identityWarning && !genState.isGenerating && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-canvas-pill bg-canvas-surface border-hairline border-canvas-border-strong text-canvas-md font-medium text-canvas-ink-soft">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-canvas-warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
          {identityWarning}
        </div>
      )}
    </>
  );

  // ── Floating overlay: Reference image ──
  const floatingOverlay = (
    <>
      {prefs.referenceImage && refVisible && hasAssets && (
        <div
          ref={(el) => {
            if (el && refPos.x === -1) {
              const parent = el.parentElement;
              if (parent) setRefPos({ x: parent.clientWidth - refSize - 16, y: 56 });
            }
          }}
          className="absolute z-20 cursor-move select-none"
          style={{
            left: refPos.x === -1 ? undefined : refPos.x,
            right: refPos.x === -1 ? 16 : undefined,
            top: refPos.y,
            width: refSize,
            borderRadius: 'var(--radius-canvas-md)', overflow: 'hidden',
            border: '1px solid var(--color-canvas-border-strong)',
          }}
          onMouseDown={handleRefMouseDown}
        >
          <img src={prefs.referenceImage} alt="Reference" draggable={false}
            className="block w-full" style={{ pointerEvents: 'none' }} />
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
            style={{ background: 'rgba(10,10,10,0.15)', clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
            onMouseDown={(e) => {
              e.stopPropagation();
              const startX = e.clientX;
              const startSize = refSize;
              const onMove = (ev: MouseEvent) => {
                const delta = ev.clientX - startX;
                setRefSize(Math.max(60, Math.min(300, startSize + delta)));
              };
              const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
          />
          <div className="absolute top-0 left-0 right-0 px-1.5 py-0.5"
            style={{ background: 'rgba(10,10,10,0.5)', pointerEvents: 'none' }}>
            <span className="text-canvas-xs font-medium" style={{ color: 'var(--color-canvas-surface)' }}>Ref</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); updatePref('referenceImage', undefined); }}
            className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 12 }}
          >×</button>
        </div>
      )}
      {prefs.referenceImage && !refVisible && hasAssets && (
        <button
          onClick={() => setRefVisible(true)}
          className="absolute right-4 top-3 z-20 flex items-center gap-1.5 px-2.5 py-[5px] rounded-canvas-md bg-canvas-surface border-hairline border-canvas-border text-canvas-sm font-medium text-canvas-ink-soft hover:border-canvas-border-strong transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 15l6-6 4 4 4-4 4 4" />
          </svg>
          Ref
        </button>
      )}
    </>
  );

  // ── Image overlay: MaskCanvas ──
  const imageOverlayNode = hasAssets ? (
    <MaskCanvas
      canvasRef={canvasRef}
      isMasking={isMasking}
      activeTool={activeTool}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  ) : undefined;

  // ── Side overlay: Tool buttons (hidden in read-only mode) ──
  const sideOverlay = hasAssets && !isReadOnly ? (
    <>
      {/* Tools bar — surgical + eraser */}
      {!genState.isGenerating && hasAssets && (
        <div
          className="absolute top-1/2 -translate-y-1/2 right-4 flex flex-col gap-2 z-30 transition-opacity duration-200"
          style={{ opacity: imageAreaHovered ? 1 : 0, pointerEvents: imageAreaHovered ? 'auto' : 'none' }}
        >
          {isIterationAllowed && (!isViewLocked || unlockMode) && (
            <ToolButton
              active={activeTool === 'surgical'}
              title="Surgical edit"
              onClick={() => useCastingUIStore.getState().setActiveTool(activeTool === 'surgical' ? 'none' : 'surgical')}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>}
            />
          )}
          {(!hasDownstreamDependencies || unlockMode) && (
            <ToolButton
              active={activeTool === 'eraser'}
              title="Magic eraser"
              onClick={() => useCastingUIStore.getState().setActiveTool(activeTool === 'eraser' ? 'none' : 'eraser')}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>}
            />
          )}
        </div>
      )}
    </>
  ) : undefined;

  // ── Status overlay: Locked source + active tool pills ──
  const statusOverlay = (isViewLocked || activeTool !== 'none') ? (
    <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 items-start">
      {isViewLocked && (
        <div className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-canvas-md bg-canvas-surface border-hairline border-canvas-border text-canvas-sm font-medium text-canvas-ink-soft">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Locked source
        </div>
      )}
      {activeTool !== 'none' && (
        <div className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-canvas-md bg-canvas-surface border-hairline border-canvas-border">
          <div className="w-1.5 h-1.5 rounded-full bg-canvas-ink" />
          <span className="text-canvas-sm font-medium text-canvas-ink-soft">
            {activeTool === 'eraser' ? 'Magic eraser' : 'Surgical edit'}
          </span>
        </div>
      )}
    </div>
  ) : undefined;

  // ── Bottom overlay: Contextual tip + Refine panel + Shortcuts + Suggestions ──
  const bottomOverlay = hasAssets ? (
    <>
      {/* Bottom Controls */}
      <div
        className="absolute bottom-6 left-1/2 w-full max-w-lg z-30 transition-all duration-300 ease-out"
        style={{
          opacity: imageAreaHovered ? 1 : 0,
          transform: imageAreaHovered ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(12px)',
          pointerEvents: imageAreaHovered ? 'auto' : 'none',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Inline Masking Helper — hidden in read-only */}
        {!isReadOnly && isMasking && (
          <div className="mb-2 flex justify-center relative z-30">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-canvas-md bg-canvas-surface border-hairline border-canvas-border-strong">
              <span className="text-canvas-sm font-medium text-canvas-ink">
                {maskPathsCount > 0 ? "Step 2" : "Step 1"}
              </span>
              <span className="inline-block w-px h-2 bg-canvas-border" />
              <span className="text-canvas-sm font-medium text-canvas-ink-soft">
                {maskPathsCount === 0
                  ? "Paint the target area"
                  : (activeTool === 'eraser' ? "Click the erase button" : "Describe the edit and apply")
                }
              </span>
            </div>
          </div>
        )}

        {/* Contextual Tip for New Model — sits just above refine panel, auto-dismissed after first refinement */}
        {!isReadOnly && !tipDismissed && historyIndex <= 0 && !genState.isGenerating && (!suggestions || suggestions.length === 0) && !isLoadingSuggestions && (
          <div className="flex justify-center mb-2 pointer-events-none transition-all duration-300 ease-out">
            <div className="px-3 py-2 rounded-canvas-md bg-canvas-surface/80 text-canvas-md text-canvas-ink-soft text-center" style={{ maxWidth: 280 }}>
              Type a change below, or use Quick ideas. Hold the image to compare with previous versions.
            </div>
          </div>
        )}

        {/* Refine panel — hidden in read-only */}
        {!isReadOnly && (
          <RefinePanel
            maskPathsCount={maskPathsCount}
            isMasking={isMasking}
            isViewLocked={isViewLocked}
            isIterationAllowed={isIterationAllowed}
            textAreaRef={textAreaRef}
            handleGenerate={handleGenerate}
            handleEnhance={handleEnhance}
            handleRefineSubmit={handleRefineSubmit}
            referenceImage={prefs.referenceImage}
          />
        )}



        {/* Quick Ideas — hidden in read-only */}
        {!isReadOnly && !genState.isGenerating && activeTool === 'none' && (isLoadingSuggestions || (suggestions && suggestions.length > 0)) && (
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20">
            {isLoadingSuggestions ? (
              <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-canvas-pill mx-auto w-fit bg-canvas-surface border-hairline border-canvas-border">
                <div className="w-3 h-3 rounded-full border-2 border-canvas-border animate-spin" style={{ borderTopColor: 'var(--color-canvas-ink-faint)' }} />
                <span className="text-canvas-md text-canvas-ink-soft">Thinking...</span>
              </div>
            ) : (
              <RotatingSuggestions
                ideas={suggestions || []}
                onSelect={(idea) => { setRefineInput(idea); textAreaRef.current?.focus(); }}
              />
            )}
          </div>
        )}
      </div>
    </>
  ) : undefined;

  return (
    <StudioCanvas
      displayUrl={hasAssets ? currentImageUrl ?? null : null}
      imageAlt="Active View"
      imageRef={imageRef}
      isGenerating={genState.isGenerating}
      generatingMessage={genState.currentStep}
      hasResult={hasResult}
      // D-53: casting's session undo is RETIRED — the slot ledger is the
      // version history ("Use this version" in the tile thumb-strip);
      // hold-to-compare stays. The pill props remain live for wardrobe.
      onUndo={() => {}}
      onRedo={() => {}}
      canUndo={false}
      canRedo={false}
      statusLabel={statusLabel}
      errorMessage={genState.error ? (
        genState.error.includes('safety') || genState.error.includes('Safety')
          ? 'Brief flagged by safety filter — try rephrasing.'
          : genState.error
      ) : undefined}
      onClearError={() => setGenState((p) => ({ ...p, error: null }))}
      onRetry={isReadOnly ? () => {} : handleRetry}
      compareUrl={compareUrl}
      compareLabel={compareLabel}
      loadingMessage={genState.currentStep || 'Processing...'}
      isFirstGeneration={!hasAssets}
      showToolbar={hasAssets}
      emptyState={<WarmEmptyState canGenerate={isFormReady} onGenerate={handleGenerate} />}
      topOverlay={topOverlay}
      floatingOverlay={floatingOverlay}
      imageOverlay={imageOverlayNode}
      sideOverlay={sideOverlay}
      statusOverlay={statusOverlay}
      bottomOverlay={bottomOverlay}
      nextStepOverlay={
        !genState.isGenerating && nextStage ? (
          <NextStepChip nextStage={nextStage} />
        ) : undefined
      }
      actionBar={
        hasAssets && !genState.isGenerating ? (
          <ImageActionBar
            visible={imageAreaHovered}
            showHeart={false}
            imageUrl={currentImageUrl ?? null}
            onRetry={isReadOnly ? undefined : handleRetry}
            isGenerating={genState.isGenerating}
            shortcuts={isReadOnly
              ? [...(compareUrl ? [{ key: 'Hold', label: 'Compare' }] : [])]
              : [
                  { key: '/', label: 'Refine' },
                  ...(prefs.referenceImage ? [{ key: 'F', label: 'Toggle Ref' }] : []),
                  ...(compareUrl ? [{ key: 'Hold', label: 'Compare' }] : []),
                ]
            }
          />
        ) : undefined
      }
      extraKeyHandler={castingKeyHandler}
      onHoverChange={setImageAreaHovered}
      onImageLoad={(e) => (e.target as HTMLImageElement).classList.add('loaded')}
    />
  );
}


