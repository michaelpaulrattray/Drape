import { useRef, useState, useEffect, useCallback, RefObject } from "react";
import { toast } from "sonner";
import { ViewTabs, RefinePanel, ToolsBar, LoadingOverlay, WarmEmptyState } from "./components/ImageViewer";
import { MaskCanvas } from "./components/ImageViewer/MaskCanvas";
import { useCastingFormStore } from "@/features/casting/stores/useCastingFormStore";
import { useCastingGenerationStore } from "@/features/casting/stores/useCastingGenerationStore";
import { useCastingUIStore } from "@/features/casting/stores/useCastingUIStore";
import { type GeneratedAsset, type GenerationState, type EditTool } from "@/features/casting/constants";
import { ReferenceNode } from "./ReferenceNode";

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
    step: number;
    total: number;
    isAutoGen?: boolean;
    isProgress?: boolean;
  } | null;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  imageRef: RefObject<HTMLImageElement | null>;
  handlePointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerUp: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleRetry: () => void;
  handleGenerate: () => void;
  handleEnhance: () => void;
  handleRefineSubmit: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

// ============ StatusPill ============

function StatusPill({
  activeView,
  genState,
  historyIndex,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  activeView: string;
  genState: GenerationState;
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const viewLabels: Record<string, string> = {
    frontClose: 'HEAD',
    frontFull: 'FULL',
    sideClose: 'SIDE',
    sideFull: 'WALK',
    backFull: 'BACK',
  };

  const statusColor = genState.isGenerating ? '#e8a838' : '#4ade80';

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1"
      style={{
        padding: '4px 6px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.85)',
        boxShadow: '0 2px 14px rgba(0,0,0,0.05)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Undo */}
      <button
        onClick={onUndo}
        disabled={!canUndo || genState.isGenerating}
        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-25"
        style={{ color: '#888' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7v6h6" /><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
        </svg>
      </button>

      {/* Status */}
      <div className="flex items-center gap-1.5 px-2">
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor }} />
        <span style={{ fontSize: 9, fontWeight: 600, color: '#888', letterSpacing: '0.06em' }}>
          {viewLabels[activeView] || activeView.toUpperCase()}
        </span>
        {historyIndex >= 0 && (
          <span style={{ fontSize: 8, color: '#bbb', fontFamily: 'ui-monospace, monospace' }}>
            v{historyIndex + 1}
          </span>
        )}
      </div>

      {/* Redo */}
      <button
        onClick={onRedo}
        disabled={!canRedo || genState.isGenerating}
        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-25"
        style={{ color: '#888' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 7v6h-6" /><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3L21 13" />
        </svg>
      </button>
    </div>
  );
}

// ============ NextStageCTA ============

function NextStageCTA({
  nextStage,
  isAutoGenerating,
  onCancel,
}: {
  nextStage: NonNullable<ImageViewerPanelProps['nextStage']>;
  isAutoGenerating: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="absolute top-1/2 right-6 -translate-y-1/2 z-40 flex flex-col items-end gap-3">
      {/* Progress dots */}
      <div className="flex items-center gap-1.5">
        {[...Array(nextStage.total)].map((_, i) => (
          <div
            key={i}
            style={{
              width: i + 1 < nextStage.step ? 12 : 6,
              height: 3,
              borderRadius: 2,
              background: i + 1 < nextStage.step ? '#1a1a1a' : i + 1 === nextStage.step ? '#1a1a1a' : 'rgba(0,0,0,0.1)',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
        <span style={{ fontSize: 9, fontWeight: 500, color: '#999', marginLeft: 4 }}>
          {nextStage.step > nextStage.total ? 'Complete' : isAutoGenerating ? 'Auto' : 'Next'}
        </span>
      </div>

      {/* Action button */}
      {!isAutoGenerating ? (
        <button
          onClick={nextStage.action}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{
            background: '#1a1a1a',
            color: '#fff',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      ) : (
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg transition-all"
          style={{ background: 'rgba(220,53,69,0.1)', color: '#dc3545', fontSize: 10, fontWeight: 600 }}
        >
          Cancel
        </button>
      )}
    </div>
  );
}

// ============ DownloadButton ============

function DownloadButton({ imageUrl, activeView }: { imageUrl: string; activeView: string }) {
  const handleDownload = async () => {
    try {
      const resp = await fetch(imageUrl);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FORMASTUDIO_${activeView}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Image downloaded');
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <button
      onClick={handleDownload}
      className="absolute bottom-2 right-2 z-30 w-8 h-8 rounded-lg flex items-center justify-center transition-all"
      style={{
        background: 'rgba(255,255,255,0.85)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        backdropFilter: 'blur(8px)',
        color: '#888',
      }}
      title="Download"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    </button>
  );
}

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
  handleUndo,
  handleRedo,
  handleRetry,
  handleGenerate,
  handleEnhance,
  handleRefineSubmit,
  canUndo,
  canRedo,
}: ImageViewerPanelProps) {
  const { prefs, updatePref } = useCastingFormStore();
  const { setGenState, historyIndex } = useCastingGenerationStore();
  const {
    activeView,
    activeTool,
    isAutoGenerating,
    setAutoGenCancelled,
  } = useCastingUIStore();

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [imageAreaHovered, setImageAreaHovered] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if (currentAssets.length === 0) return;

      if (e.key === 'z' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.key === 'Z' && !e.ctrlKey && !e.metaKey) || (e.key === 'z' && e.shiftKey && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        handleRedo();
      }
      if (e.key === '/') {
        e.preventDefault();
        textAreaRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentAssets.length, handleUndo, handleRedo]);

  // Determine if form is ready to generate
  const isFormReady = formProgress >= 50;

  return (
    <main
      className="flex-1 flex flex-col h-[calc(100vh-64px)] lg:h-screen overflow-hidden relative"
      style={{ background: '#eae7e1' }}
    >
      {/* View strip */}
      <ViewTabs nextStage={nextStage} />

      {/* Error overlay */}
      {genState.error && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center p-8"
          style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
        >
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 340, width: '100%', boxShadow: '0 16px 48px rgba(0,0,0,0.12)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#c33', marginBottom: 6 }}>Generation Failed</div>
            <div style={{ fontSize: 11, color: '#888', lineHeight: 1.5, marginBottom: 8 }}>{genState.error}</div>
            <div style={{ fontSize: 10, color: '#bbb', marginBottom: 16 }}>This might be temporary. Please try again.</div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setGenState((p) => ({ ...p, error: null }))} style={{ fontSize: 11, fontWeight: 500, color: '#999' }}>
                Dismiss
              </button>
              <button onClick={handleRetry} className="px-4 py-2 rounded-xl" style={{ background: '#1a1a1a', color: '#fff', fontSize: 11, fontWeight: 600 }}>
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      {currentAssets.length > 0 ? (
        <div className="w-full h-full flex flex-col relative z-10">
          {/* Loading overlay */}
          {genState.isGenerating && <LoadingOverlay statusMessage={genState.currentStep || 'Processing...'} />}

          {/* Status pill */}
          <StatusPill
            activeView={activeView}
            genState={genState}
            historyIndex={historyIndex}
            canUndo={canUndo()}
            canRedo={canRedo()}
            onUndo={handleUndo}
            onRedo={handleRedo}
          />

          {/* Image area */}
          <div
            className="flex-1 relative min-h-0 flex items-center justify-center p-2 lg:p-4"
            onMouseEnter={() => setImageAreaHovered(true)}
            onMouseLeave={() => setImageAreaHovered(false)}
          >
            {/* Next stage CTA */}
            {nextStage && !genState.isGenerating && (
              <NextStageCTA
                nextStage={nextStage}
                isAutoGenerating={isAutoGenerating}
                onCancel={() => setAutoGenCancelled(true)}
              />
            )}

            {/* Reference node */}
            {currentAssets.length > 0 && (
              <div className="absolute top-16 right-6 z-40 hidden lg:block">
                <ReferenceNode
                  image={prefs.referenceImage}
                  onSet={(img) => updatePref('referenceImage', img)}
                  disabled={genState.isGenerating}
                />
              </div>
            )}

            {/* Main image */}
            <div className="relative h-full max-w-full flex items-center justify-center select-none pb-16">
              {currentImageUrl && (
                <>
                  <img
                    ref={imageRef}
                    src={currentImageUrl}
                    alt="Active View"
                    className="max-h-[calc(100vh-200px)] lg:max-h-[calc(100vh-180px)] max-w-full object-contain blur-loading"
                    style={{
                      marginTop: 70,
                      borderRadius: 4,
                      boxShadow: '0 8px 40px rgba(0,0,0,0.1)',
                    }}
                    onLoad={(e) => e.currentTarget.classList.add('loaded')}
                  />

                  {/* Mask canvas */}
                  <MaskCanvas
                    canvasRef={canvasRef}
                    isMasking={isMasking}
                    activeTool={activeTool}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  />
                </>
              )}

              {/* Tools bar */}
              <ToolsBar
                isIterationAllowed={isIterationAllowed}
                isViewLocked={isViewLocked}
                hasDownstreamDependencies={hasDownstreamDependencies}
                isMasking={isMasking}
                imageAreaHovered={imageAreaHovered}
              />

              {/* Download */}
              {currentImageUrl && <DownloadButton imageUrl={currentImageUrl} activeView={activeView} />}

              {/* View label */}
              <div
                className="absolute bottom-2 left-2 z-30"
                style={{
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.85)',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <span style={{ fontSize: 9, fontWeight: 600, color: '#888', letterSpacing: '0.06em' }}>
                  {activeView === 'frontClose' ? 'HEAD' :
                   activeView === 'frontFull' ? 'FULL BODY' :
                   activeView === 'sideClose' ? 'SIDE' :
                   activeView === 'sideFull' ? 'WALK' :
                   activeView === 'backFull' ? 'BACK' : activeView.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Refine panel */}
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
          </div>
        </div>
      ) : genState.isGenerating ? (
        <div className="flex-1 relative">
          <LoadingOverlay statusMessage={genState.currentStep || 'Processing...'} />
        </div>
      ) : (
        <WarmEmptyState canGenerate={isFormReady} onGenerate={handleGenerate} />
      )}
    </main>
  );
}
