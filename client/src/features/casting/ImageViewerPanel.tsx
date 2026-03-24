import { useRef, useState, useEffect, useMemo, useCallback, RefObject } from "react";
import { ViewTabs, RefinePanel, LoadingOverlay, WarmEmptyState } from "./components/ImageViewer";
import { MaskCanvas } from "./components/ImageViewer/MaskCanvas";
import { useCastingFormStore } from "@/features/casting/stores/useCastingFormStore";
import { useCastingGenerationStore } from "@/features/casting/stores/useCastingGenerationStore";
import { useCastingUIStore } from "@/features/casting/stores/useCastingUIStore";
import { type GeneratedAsset, type GenerationState } from "@/features/casting/constants";

// ============ View Labels ============

const VIEW_DISPLAY_NAMES: Record<string, string> = {
  frontClose: 'Headshot',
  frontFull: 'Full Body',
  sideClose: 'Side',
};

// ============ SlotChip + RotatingSuggestions ============

function SlotChip({ slotIdeas, intervalMs, onSelect }: { slotIdeas: string[]; intervalMs: number; onSelect: (idea: string) => void }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => { setIndex(0); setVisible(true); }, [slotIdeas]);

  useEffect(() => {
    if (slotIdeas.length <= 1) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % slotIdeas.length);
        setVisible(true);
      }, 300);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [slotIdeas, intervalMs]);

  if (!slotIdeas.length) return null;
  const idea = slotIdeas[index];

  return (
    <button
      onClick={() => onSelect(idea)}
      title={idea}
      className="px-3 py-1.5 rounded-full transition-all"
      style={{
        background: 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
        fontSize: 10, color: '#777',
        border: '1px solid rgba(0,0,0,0.04)',
        maxWidth: 200, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#1a1a1a'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.8)'; e.currentTarget.style.color = '#777'; }}
    >
      {idea}
    </button>
  );
}

function RotatingSuggestions({ ideas, onSelect }: { ideas: string[]; onSelect: (idea: string) => void }) {
  // Distribute ideas evenly across 3 slots; skip empty slots for <3 items
  const slots = useMemo(() => {
    const buckets: string[][] = [[], [], []];
    ideas.forEach((idea, i) => buckets[i % 3].push(idea));
    return buckets;
  }, [ideas]);
  const intervals = [5000, 6500, 8000];
  return (
    <div className="flex items-center gap-1.5 justify-center" style={{ flexWrap: 'nowrap' }}>
      {slots.map((slot, i) => slot.length > 0 && (
        <SlotChip key={i} slotIdeas={slot} intervalMs={intervals[i]} onSelect={onSelect} />
      ))}
    </div>
  );
}

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
  const {
    setGenState,
    historyIndex,
    history,
    suggestions,
    isLoadingSuggestions,
    identityWarning,
  } = useCastingGenerationStore();
  const {
    activeView,
    activeTool,
    isAutoGenerating,
    setAutoGenCancelled,
    unlockMode,
    refineInput,
    setRefineInput,
  } = useCastingUIStore();

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [imageAreaHovered, setImageAreaHovered] = useState(false);

  // Floating Reference State
  const [refVisible, setRefVisible] = useState(true);
  const [refPos, setRefPos] = useState({ x: -1, y: 56 });
  const [refSize, setRefSize] = useState(120);
  const refDragging = useRef(false);
  const refDragOffset = useRef({ x: 0, y: 0 });

  // Hold-to-Compare State
  const [isComparing, setIsComparing] = useState(false);
  const compareTimerRef = useRef<number | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if (currentAssets.length === 0) return;

      switch (e.key) {
        case 'z':
          if (!e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); handleUndo(); }
          break;
        case 'Z':
          if (e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); handleRedo(); }
          break;
        case '/': {
          const refineEl = document.querySelector('[data-refine-input]') as HTMLTextAreaElement;
          if (refineEl) { e.preventDefault(); refineEl.focus(); }
          break;
        }
        case 'f':
        case 'F':
          if (prefs.referenceImage) setRefVisible(v => !v);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentAssets.length, handleUndo, handleRedo, prefs.referenceImage]);

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

  // Hold-to-compare
  const getPreviousImage = useCallback(() => {
    if (historyIndex <= 0 || currentAssets.length === 0) return null;
    const prevAssets = history[historyIndex - 1];
    const prevAsset = prevAssets?.find(a => a.viewType === activeView);
    return prevAsset?.storageUrl || null;
  }, [history, historyIndex, currentAssets, activeView]);

  const handleImageMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const prev = getPreviousImage();
    if (!prev) return;
    compareTimerRef.current = window.setTimeout(() => {
      setIsComparing(true);
    }, 150);
  };

  const handleImageMouseUp = () => {
    if (compareTimerRef.current) {
      clearTimeout(compareTimerRef.current);
      compareTimerRef.current = null;
    }
    setIsComparing(false);
  };

  const displayImage = isComparing ? (getPreviousImage() || currentImageUrl) : currentImageUrl;

  // Determine if form is ready to generate
  const isFormReady = formProgress >= 50;

  return (
    <main
      className="flex-1 flex flex-col h-[calc(100vh-64px)] lg:h-screen overflow-hidden relative"
      style={{ background: '#eae7e1' }}
    >
      {/* View strip */}
      <ViewTabs nextStage={nextStage} />

      {/* Identity Drift Warning */}
      {identityWarning && !genState.isGenerating && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full"
          style={{
            background: 'rgba(234, 179, 8, 0.9)',
            backdropFilter: 'blur(8px)',
            fontSize: 10, color: '#713f12', fontWeight: 500,
          }}>
          ⚠ {identityWarning}
        </div>
      )}

      {/* Floating Reference */}
      {prefs.referenceImage && refVisible && currentAssets.length > 0 && (
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
            borderRadius: 10, overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
            transition: refDragging.current ? 'none' : 'box-shadow 0.2s',
          }}
          onMouseDown={handleRefMouseDown}
        >
          <img src={prefs.referenceImage} alt="Reference" draggable={false}
            className="block w-full" style={{ pointerEvents: 'none' }} />
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
            style={{ background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.15) 50%)', borderRadius: '0 0 10px 0' }}
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
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.4), transparent)', pointerEvents: 'none' }}>
            <span style={{ fontSize: 8, fontWeight: 600, color: '#fff', letterSpacing: '0.05em' }}>REF</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); updatePref('referenceImage', undefined); }}
            className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 10 }}
          >×</button>
        </div>
      )}

      {/* Collapsed Ref Toggle */}
      {prefs.referenceImage && !refVisible && currentAssets.length > 0 && (
        <button
          onClick={() => setRefVisible(true)}
          className="absolute right-4 top-3 z-20 flex items-center gap-1.5 transition-all"
          style={{
            padding: '5px 10px', borderRadius: 8,
            background: 'rgba(255,255,255,0.85)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
            backdropFilter: 'blur(8px)',
            fontSize: 9, fontWeight: 600, color: '#999',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 15l6-6 4 4 4-4 4 4" />
          </svg>
          Ref
        </button>
      )}

      {/* Error banner (inline, not modal) */}
      {genState.error && !genState.isGenerating && (
        <div className="absolute top-14 left-4 right-4 z-30 flex items-center justify-between px-4 py-3 rounded-xl"
          style={{ background: 'rgba(220,50,50,0.08)', border: '1px solid rgba(220,50,50,0.15)', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 11, color: '#c33', fontWeight: 500 }}>
              {genState.error.includes('safety') || genState.error.includes('Safety')
                ? 'Brief flagged by safety filter — try rephrasing.'
                : genState.error}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGenState((p) => ({ ...p, error: null }))}
              style={{ fontSize: 10, fontWeight: 500, color: '#999' }}
            >
              Dismiss
            </button>
            <button
              onClick={handleRetry}
              style={{ fontSize: 10, fontWeight: 600, color: '#1a1a1a', textDecoration: 'underline' }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      {currentAssets.length > 0 ? (
        <div className="w-full h-full flex flex-col relative z-10">
          {/* Loading overlay */}
          {genState.isGenerating && <LoadingOverlay statusMessage={genState.currentStep || 'Processing...'} />}

          {/* Status Pill — chevron style with comparing state */}
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 pointer-events-auto"
            style={{
              padding: '3px 4px', borderRadius: 14,
              background: 'rgba(255,255,255,0.85)',
              boxShadow: '0 2px 14px rgba(0,0,0,0.05)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <button
              onClick={handleUndo}
              disabled={!canUndo() || genState.isGenerating}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-20"
              style={{ color: '#888' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div style={{ width: 1, height: 14, background: 'rgba(0,0,0,0.06)' }} />

            <div className="flex items-center gap-2 px-2.5">
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: isComparing ? '#7c8aef' : genState.isGenerating ? '#e8a83e' : '#5cad5c',
                boxShadow: genState.isGenerating ? '0 0 6px rgba(232,168,62,0.4)' : 'none',
                transition: 'background 0.2s',
              }} />
              <span style={{ fontSize: 10, fontWeight: 500, color: '#888' }}>
                {isComparing
                  ? 'Comparing...'
                  : genState.isGenerating
                    ? (genState.currentStep || 'Generating...')
                    : `${VIEW_DISPLAY_NAMES[activeView] ?? activeView} · v${historyIndex + 1}`
                }
              </span>
            </div>

            <div style={{ width: 1, height: 14, background: 'rgba(0,0,0,0.06)' }} />

            <button
              onClick={handleRedo}
              disabled={!canRedo() || genState.isGenerating}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-20"
              style={{ color: '#888' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Image area */}
          <div className="flex-1 relative min-h-0 flex items-center justify-center bg-transparent">
            {/* Next stage CTA */}
            {nextStage && !genState.isGenerating && (
              <div className="absolute top-1/2 right-8 -translate-y-1/2 z-40 flex flex-col items-end space-y-4 animate-in fade-in slide-in-from-right-8 duration-700">
                <div className="text-right space-y-1 drop-shadow-md">
                  <div className="flex items-center justify-end space-x-2">
                    <div className="flex space-x-1">
                      {[...Array(nextStage.total)].map((_, i) => (
                        <div key={i} className={`h-1 w-3 rounded-full ${
                          i + 1 < nextStage.step ? 'bg-white' : i + 1 === nextStage.step ? 'bg-white animate-pulse' : 'bg-neutral-700'
                        }`} />
                      ))}
                    </div>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-neutral-400">
                      {nextStage.step > nextStage.total ? 'Workflow Complete' : isAutoGenerating ? 'Auto' : 'Next Stage'}
                    </span>
                  </div>
                  <p className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    {nextStage.label}
                  </p>
                </div>
                {!isAutoGenerating ? (
                  <button
                    onClick={nextStage.action}
                    className="group relative w-16 h-16 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-all duration-300"
                    style={{ boxShadow: '0 0 40px rgba(255,255,255,0.2)' }}
                  >
                    <div className="absolute inset-0 rounded-full border border-white opacity-50 group-hover:animate-ping" />
                    <svg width="18" height="18" fill="none" stroke="#1a1a1a" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={() => setAutoGenCancelled(true)}
                    className="px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: 'rgba(220,53,69,0.1)', color: '#dc3545', fontSize: 10, fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}

            {/* Image + overlays container */}
            <div
              className="relative h-full max-w-full flex items-center justify-center select-none"
              onMouseEnter={() => setImageAreaHovered(true)}
              onMouseLeave={() => setImageAreaHovered(false)}
            >
              {/* Image wrapper */}
              <div className="relative" style={{ borderRadius: 16, overflow: 'hidden' }}>
                {displayImage && (
                  <img
                    ref={imageRef}
                    src={displayImage}
                    alt="Active View"
                    className="block object-contain transition-all duration-200 blur-loading"
                    style={{
                      maxWidth: 'calc(100vw - 620px)',
                      maxHeight: 'calc(100vh - 100px)',
                      boxShadow: '0 24px 80px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
                      opacity: genState.isGenerating ? 0.5 : 1,
                      filter: genState.isGenerating ? 'blur(4px)' : 'none',
                      transform: genState.isGenerating ? 'scale(0.97)' : 'scale(1)',
                      cursor: getPreviousImage() ? 'grab' : 'default',
                    }}
                    onLoad={(e) => e.currentTarget.classList.add('loaded')}
                    onMouseDown={handleImageMouseDown}
                    onMouseUp={handleImageMouseUp}
                    onMouseLeave={handleImageMouseUp}
                  />
                )}

                {/* Comparing badge */}
                {isComparing && (
                  <div className="absolute top-3 left-3 z-10"
                    style={{
                      padding: '3px 8px', borderRadius: 6,
                      background: 'rgba(124,138,239,0.9)', backdropFilter: 'blur(8px)',
                      fontSize: 9, fontWeight: 600, color: '#fff', letterSpacing: '0.03em',
                    }}>
                    Previous
                  </div>
                )}

                {/* Retry on hover */}
                {!genState.isGenerating && !isComparing && (
                  <button
                    onClick={handleRetry}
                    className="absolute top-3 right-3 z-10 flex items-center gap-1.5 transition-opacity duration-200"
                    style={{
                      padding: '5px 10px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.88)',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                      backdropFilter: 'blur(12px)',
                      fontSize: 9, fontWeight: 600, color: '#777',
                      opacity: imageAreaHovered ? 1 : 0,
                      pointerEvents: imageAreaHovered ? 'auto' : 'none',
                    }}
                    title="Regenerate this view"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 4v6h6" />
                      <path d="M3.51 15a9 9 0 105.69-11.49L1 10" />
                    </svg>
                    Retry
                  </button>
                )}

                {/* Mask canvas */}
                <MaskCanvas
                  canvasRef={canvasRef}
                  isMasking={isMasking}
                  activeTool={activeTool}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                />
              </div>
              {/* End image wrapper */}

              {/* Tools bar — surgical + eraser */}
              {!genState.isGenerating && currentAssets.length > 0 && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 right-4 flex flex-col gap-2 z-30 transition-opacity duration-200"
                  style={{ opacity: imageAreaHovered ? 1 : 0, pointerEvents: imageAreaHovered ? 'auto' : 'none' }}
                >
                  {isIterationAllowed && (!isViewLocked || unlockMode) && (
                    <ToolButton
                      active={activeTool === 'surgical'}
                      onClick={() => useCastingUIStore.getState().setActiveTool(activeTool === 'surgical' ? 'none' : 'surgical')}
                      icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>}
                    />
                  )}
                  {(!hasDownstreamDependencies || unlockMode) && (
                    <ToolButton
                      active={activeTool === 'eraser'}
                      onClick={() => useCastingUIStore.getState().setActiveTool(activeTool === 'eraser' ? 'none' : 'eraser')}
                      icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>}
                    />
                  )}
                </div>
              )}

              {/* Status pills — locked source + active tool */}
              {(isViewLocked || activeTool !== 'none') && (
                <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 items-start">
                  {isViewLocked && (
                    <div className="flex items-center gap-1.5"
                      style={{ padding: '5px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.85)', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', backdropFilter: 'blur(8px)', fontSize: 9, fontWeight: 600, color: '#999' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      Locked Source
                    </div>
                  )}
                  {activeTool !== 'none' && (
                    <div className="flex items-center gap-1.5"
                      style={{ padding: '5px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.85)', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', backdropFilter: 'blur(8px)' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: activeTool === 'eraser' ? '#7c6bef' : '#dc3545' }} />
                      <span style={{ fontSize: 9, fontWeight: 600, color: '#777' }}>
                        {activeTool === 'eraser' ? 'Magic Eraser' : 'Surgical Edit'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Contextual Tip for New Model */}
              {historyIndex <= 0 && !genState.isGenerating && (!suggestions || suggestions.length === 0) && !isLoadingSuggestions && (
                <div className="absolute bottom-32 left-1/2 z-10 px-3 py-2 rounded-lg pointer-events-none transition-all duration-300 ease-out"
                  style={{
                    background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', fontSize: 10, color: '#b8b3a8', maxWidth: 280, textAlign: 'center',
                    opacity: imageAreaHovered ? 1 : 0,
                    transform: imageAreaHovered ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(8px)',
                  }}>
                  Type a change below, or use Quick Ideas. Hold the image to compare with previous versions.
                </div>
              )}

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
                {/* Inline Masking Helper */}
                {isMasking && (
                  <div className="mb-2 flex justify-center relative z-30">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: activeTool === 'eraser' ? '#7c6bef' : '#c33' }}>
                        {maskPathsCount > 0 ? "STEP 02" : "STEP 01"}
                      </span>
                      <span style={{ width: 1, height: 8, background: 'rgba(0,0,0,0.1)', display: 'inline-block' }} />
                      <span style={{ fontSize: 9, fontWeight: 500, color: '#777' }}>
                        {maskPathsCount === 0
                          ? "Paint Target Area"
                          : (activeTool === 'eraser' ? "Click Erase Button" : "Describe Edit & Apply")
                        }
                      </span>
                    </div>
                  </div>
                )}

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

                {/* Shortcuts Bar */}
                {!genState.isGenerating && (
                  <div
                    className="mt-2 flex items-center justify-center gap-3 pointer-events-none"
                    style={{
                      padding: '5px 14px', borderRadius: 10,
                      background: 'rgba(255,255,255,0.7)',
                      backdropFilter: 'blur(8px)',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                      width: 'fit-content', margin: '8px auto 0',
                    }}
                  >
                    {[
                      { key: 'Z', label: 'Undo' },
                      { key: '⇧Z', label: 'Redo' },
                      { key: '/', label: 'Refine' },
                      ...(prefs.referenceImage ? [{ key: 'F', label: 'Ref' }] : []),
                      ...(getPreviousImage() ? [{ key: 'Hold', label: 'Compare' }] : []),
                    ].map(s => (
                      <div key={s.key} className="flex items-center gap-1.5">
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: '#bbb',
                          padding: '1px 4px', borderRadius: 3,
                          background: 'rgba(0,0,0,0.04)',
                          fontFamily: 'monospace',
                        }}>
                          {s.key}
                        </span>
                        <span style={{ fontSize: 9, color: '#bbb' }}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Ideas — rotating suggestions */}
                {!genState.isGenerating && activeTool === 'none' && (isLoadingSuggestions || (suggestions && suggestions.length > 0)) && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20">
                    {isLoadingSuggestions ? (
                      <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-full mx-auto w-fit"
                        style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }}>
                        <div className="w-3 h-3 rounded-full border-2 animate-spin"
                          style={{ borderColor: '#e8e5df', borderTopColor: '#999' }} />
                        <span style={{ fontSize: 10, color: '#999' }}>Thinking...</span>
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
            </div>
          </div>
        </div>
      ) : genState.isGenerating ? (
        <div className="flex-1 relative">
          <LoadingOverlay statusMessage={genState.currentStep || 'Processing...'} isFirstGeneration={true} />
        </div>
      ) : (
        <WarmEmptyState canGenerate={isFormReady} onGenerate={handleGenerate} />
      )}
    </main>
  );
}

// ============ ToolButton Helper ============

function ToolButton({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
      style={{
        background: active ? '#1a1a1a' : 'rgba(255,255,255,0.85)',
        color: active ? '#fff' : '#888',
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {icon}
    </button>
  );
}
