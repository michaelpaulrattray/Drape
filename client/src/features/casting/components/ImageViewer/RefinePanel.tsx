import { RefObject, useRef, useState, useEffect } from 'react';
import { Sparkles, SendHorizontal } from 'lucide-react';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';

// F5 (founder-ruled): iterate can ADD things — distinctive marks, accessories,
// any feature — and nobody knew. Discoverability, not a feature: rotating
// placeholder EXAMPLES teach the field's range. Explicitly NOT a selector —
// marks are open creative space; enum-izing them is wrong.
const ROTATING_EXAMPLES = [
  'brighten the lighting',
  'add a small tattoo on the forearm',
  'soften the makeup',
  'add thin gold earrings',
  'make the expression warmer',
  'add light freckles',
];
const EXAMPLE_INTERVAL_MS = 4500;

// ============ Types ============

// The stage-lock branch (era-1, audit V2) is dead. The per-view iterate
// gate is RESTORED for the stabilization wrap (see useCastingGeneration) —
// it dies with the V1+V14 fix in the revised plan, not before.
interface RefinePanelProps {
  maskPathsCount: number;
  isMasking: boolean;
  isIterationAllowed: boolean;
  textAreaRef: RefObject<HTMLTextAreaElement | null>;
  handleGenerate: () => void;
  handleEnhance: () => void;
  handleRefineSubmit: () => void;
  referenceImage?: string;
}

// The floating bar shell — flat surface, hairline border, no shadow (D-40 language)
const barShellClass =
  'rounded-canvas-lg bg-canvas-surface border-hairline border-canvas-border-strong';

// ============ Main Component ============

export function RefinePanel({
  maskPathsCount,
  isMasking,
  isIterationAllowed,
  textAreaRef,
  handleGenerate,
  handleEnhance,
  handleRefineSubmit,
  referenceImage,
}: RefinePanelProps) {
  const {
    activeView,
    activeTool,
    refineInput,
    setRefineInput,
    isEnhancing,
  } = useCastingUIStore();

  const [glowActive, setGlowActive] = useState(false);
  const glowFiredRef = useRef(false);

  // F5: rotate the placeholder examples while the field is empty
  const [exampleIndex, setExampleIndex] = useState(0);
  useEffect(() => {
    if (refineInput) return; // typing — hold still
    const timer = setInterval(
      () => setExampleIndex((i) => (i + 1) % ROTATING_EXAMPLES.length),
      EXAMPLE_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [refineInput]);

  const hasMask = maskPathsCount > 0;

  // Auto-resize textarea
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = '34px';
      const sh = textAreaRef.current.scrollHeight;
      textAreaRef.current.style.height = Math.min(Math.max(sh, 34), 80) + 'px';
    }
  }, [refineInput]);

  // Enhance glow trigger
  useEffect(() => {
    const wordCount = refineInput.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount >= 3 && !glowFiredRef.current && !isEnhancing) {
      glowFiredRef.current = true;
      setGlowActive(true);
    }
    if (wordCount < 3) {
      glowFiredRef.current = false;
      setGlowActive(false);
    }
  }, [refineInput, isEnhancing]);

  const handleSubmit = () => {
    if (refineInput.trim() || activeTool === 'eraser') {
      handleRefineSubmit();
    }
  };

  // Wrap honesty fix: every gated view gets a stated reason — the old code
  // had copy only for sideClose, leaving ¾/Walk as a live-looking box that
  // silently refused typing (the round-4 walk finding). Capability unchanged.
  const iterationDisabledReason = isIterationAllowed
    ? null
    : activeView === 'sideClose'
      ? 'Side profile cannot be edited directly yet. Edit the headshot or full body instead.'
      : 'This view cannot be edited directly yet. Edit the headshot or full body instead.';

  const glowKeyframes = `
    @keyframes enhanceFloat {
      0%, 100% { transform: translateY(0px); }
      50%       { transform: translateY(-2px); }
    }
  `;

  // ── Eraser mode ──
  if (activeTool === 'eraser') {
    return (
      <div style={{ width: 420, maxWidth: 'calc(100% - 40px)', margin: '0 auto' }}>
        <div className={`flex items-center justify-center gap-2 p-2 ${barShellClass}`}>
          <span className="text-canvas-lg font-medium text-canvas-ink-soft">
            {hasMask ? 'Ready to erase' : 'Paint an area to erase'}
          </span>
          {hasMask && (
            <button
              onClick={handleSubmit}
              className="px-4 py-1.5 rounded-canvas-md bg-canvas-ink text-canvas-surface text-canvas-md font-medium transition-colors"
            >
              Erase
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Iteration disabled (stabilization gate — reason always stated) ──
  if (iterationDisabledReason) {
    return (
      <div style={{ width: 420, maxWidth: 'calc(100% - 40px)', margin: '0 auto' }}>
        <div className={`flex items-center justify-center gap-2 p-3 ${barShellClass}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-canvas-ink-faint)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          <span className="text-canvas-lg text-canvas-ink-soft">{iterationDisabledReason}</span>
        </div>
      </div>
    );
  }

  // ── Refine bar ──
  const getPlaceholder = () => {
    if (activeTool === 'surgical') return 'Describe change for masked area...';
    if (referenceImage) return "e.g. 'use hairstyle from reference image'";
    return `Describe a change — "${ROTATING_EXAMPLES[exampleIndex]}"`;
  };

  return (
    <div style={{ width: 420, maxWidth: 'calc(100% - 40px)', margin: '0 auto' }}>
      <div className={`flex items-end gap-2 p-1.5 ${barShellClass}`}>
        {/* Enhance */}
        {glowActive && <style>{glowKeyframes}</style>}
        <button
          onClick={handleEnhance}
          disabled={!refineInput.trim() || isEnhancing}
          className={`flex-shrink-0 w-8 h-8 rounded-canvas-md flex items-center justify-center ${glowActive ? 'text-canvas-ink' : 'text-canvas-ink-faint'}`}
          style={{
            animation: glowActive ? 'enhanceFloat 1.4s ease-in-out infinite' : 'none',
            transition: 'color 0.4s ease',
          }}
          title="Enhance with AI"
        >
          {isEnhancing ? (
            <div className="w-3 h-3 border-2 border-t-transparent border-canvas-border-strong rounded-full animate-spin" />
          ) : (
            <Sparkles size={14} strokeWidth={2} />
          )}
        </button>

        <div className="w-px h-5 mb-1.5 bg-canvas-border" />

        {/* Reference thumbnail */}
        {referenceImage && (
          <div className="flex-shrink-0 mb-0.5" title="Reference image attached — mention it in your instruction">
            <div className="w-7 h-7 rounded-canvas-sm overflow-hidden border-hairline border-canvas-border-strong">
              <img src={referenceImage} alt="Ref" className="w-full h-full object-cover" />
            </div>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textAreaRef}
          data-refine-input
          value={refineInput}
          onChange={(e) => setRefineInput(e.target.value)}
          placeholder={getPlaceholder()}
          rows={1}
          className="flex-1 outline-none resize-none bg-transparent border-none text-canvas-ink placeholder:text-canvas-ink-faint"
          style={{ fontSize: 14, lineHeight: 1.5, padding: '8px 8px', minHeight: 34, maxHeight: 80 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!refineInput.trim()}
          className={`flex-shrink-0 px-4 py-2 rounded-canvas-md transition-colors mb-0.5 flex items-center gap-1.5 text-canvas-md font-medium ${
            refineInput.trim()
              ? 'bg-canvas-ink text-canvas-surface'
              : 'bg-canvas-border text-canvas-ink-faint'
          }`}
        >
          <SendHorizontal size={12} strokeWidth={2} style={{ marginRight: -2 }} />
          <span>Apply</span>
        </button>
      </div>
    </div>
  );
}

export default RefinePanel;
