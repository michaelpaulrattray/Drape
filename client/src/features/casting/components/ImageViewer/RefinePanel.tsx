import { RefObject, useRef, useState, useEffect } from 'react';
import { Sparkles, SendHorizontal } from 'lucide-react';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';

// F5 as amended by the ratified interim identity policy (Batch C, D-56):
// rotating placeholder EXAMPLES teach the field's range — and advertise ONLY
// what the shared server guard supports today. Mark edits (tattoos, freckles),
// makeup, and accessories refuse during R6, so they never appear here;
// identity leaves (draft headshot) and image-only changes do.
const ROTATING_EXAMPLES = [
  'brighten the lighting',
  'a sharper jawline',
  'shorter hair',
  'make the expression warmer',
  'deep hazel eyes',
  'soften the background',
];
const EXAMPLE_INTERVAL_MS = 4500;

// ============ Types ============

// The stage-lock branch (era-1, audit V2) and the stabilization per-view
// iterate gate (V1, retired with the V1+V14 framing fix) are both dead:
// the refine bar renders on every canonical view; the server classifier +
// identity seal are the gates.
interface RefinePanelProps {
  maskPathsCount: number;
  isMasking: boolean;
  iterationCost: number;
  isGenerating: boolean;
  textAreaRef: RefObject<HTMLTextAreaElement | null>;
  handleGenerate: () => void;
  handleEnhance: () => void;
  handleRefineSubmit: () => void;
  referenceImage?: string;
}

// The floating bar shell — flat surface, hairline border, no shadow (D-40 language)
const barShellClass =
  'rounded-canvas-lg bg-canvas-surface border-hairline border-canvas-border-strong';

export function refineActionState(input: string, isGenerating: boolean, iterationCost: number) {
  const canSubmit = input.trim().length > 0 && !isGenerating;
  return {
    canSubmit,
    ariaLabel: isGenerating
      ? 'Applying refinement'
      : `Apply refinement for ${iterationCost} credits`,
    label: isGenerating ? 'Applying…' : `Apply · ${iterationCost} credits`,
  };
}

// ============ Main Component ============

export function RefinePanel({
  maskPathsCount,
  isMasking,
  iterationCost,
  isGenerating,
  textAreaRef,
  handleGenerate,
  handleEnhance,
  handleRefineSubmit,
  referenceImage,
}: RefinePanelProps) {
  const {
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
    if (!isGenerating && (refineInput.trim() || activeTool === 'eraser')) {
      handleRefineSubmit();
    }
  };

  const glowKeyframes = `
    @keyframes enhanceFloat {
      0%, 100% { transform: translateY(0px); }
      50%       { transform: translateY(-2px); }
    }
  `;

  // ── Eraser mode ──
  if (activeTool === 'eraser') {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className={`flex items-center justify-center gap-2 p-2 ${barShellClass}`}>
          <span className="text-canvas-lg font-medium text-canvas-ink-soft">
            {hasMask ? 'Ready to erase' : 'Paint an area to erase'}
          </span>
          {hasMask && (
            <button
              onClick={handleSubmit}
              disabled={isGenerating}
              className="px-4 py-1.5 rounded-canvas-md bg-canvas-ink text-canvas-surface text-canvas-md font-medium transition-colors"
            >
              Erase
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Refine bar ──
  const getPlaceholder = () => {
    if (activeTool === 'surgical') return 'Describe change for masked area...';
    if (referenceImage) return "e.g. 'use the hairstyle from the reference'";
    return `Describe a change — "${ROTATING_EXAMPLES[exampleIndex]}"`;
  };
  const refineAction = refineActionState(refineInput, isGenerating, iterationCost);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="min-w-0 px-1 pb-2">
        <p className="text-canvas-md font-medium text-canvas-ink">Refine this person</p>
        <p className="text-canvas-sm text-canvas-ink-faint">Keeps their identity</p>
      </div>

      <div className={`flex items-end gap-2 p-1.5 ${barShellClass}`}>
        {/* Enhance */}
        {glowActive && <style>{glowKeyframes}</style>}
        <button
          onClick={handleEnhance}
          disabled={!refineInput.trim() || isEnhancing || isGenerating}
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
          disabled={isGenerating}
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
          disabled={!refineAction.canSubmit}
          aria-label={refineAction.ariaLabel}
          className={`flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-canvas-md transition-colors mb-0.5 flex items-center gap-1.5 text-canvas-md font-medium ${
            refineAction.canSubmit
              ? 'bg-canvas-ink text-canvas-surface'
              : 'bg-canvas-border text-canvas-ink-faint'
          }`}
        >
          <SendHorizontal size={12} strokeWidth={2} style={{ marginRight: -2 }} />
          <span>{refineAction.label}</span>
        </button>
      </div>
    </div>
  );
}

export default RefinePanel;
