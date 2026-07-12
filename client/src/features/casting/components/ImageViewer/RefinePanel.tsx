import { RefObject, useRef, useState, useEffect } from 'react';
import { Sparkles, SendHorizontal } from 'lucide-react';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';

// ============ Types ============

interface RefinePanelProps {
  maskPathsCount: number;
  isMasking: boolean;
  isViewLocked: boolean;
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
  isViewLocked,
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
    unlockMode,
    setUnlockMode,
  } = useCastingUIStore();

  const [glowActive, setGlowActive] = useState(false);
  const glowFiredRef = useRef(false);

  const isLocked = isViewLocked && !unlockMode;
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

  const iterationDisabledReason =
    activeView === 'sideClose'
      ? 'Side profile cannot be edited directly. Edit the headshot or full body instead.'
      : null;

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

  // ── Iteration disabled ──
  if (!isIterationAllowed && iterationDisabledReason) {
    return (
      <div style={{ width: 420, maxWidth: 'calc(100% - 40px)', margin: '0 auto' }}>
        <div className={`flex items-center justify-center gap-2 p-3 ${barShellClass}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-canvas-ink-faint)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          <span className="text-canvas-lg text-canvas-ink-soft">{iterationDisabledReason}</span>
        </div>
      </div>
    );
  }

  // ── View locked ──
  if (isLocked) {
    return (
      <div style={{ width: 420, maxWidth: 'calc(100% - 40px)', margin: '0 auto' }}>
        <div className={`flex items-center justify-between p-3 ${barShellClass}`}>
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-canvas-ink-faint)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            <span className="text-canvas-lg text-canvas-ink-soft">View locked</span>
          </div>
          <button
            onClick={() => setUnlockMode(true)}
            className="text-canvas-md font-medium text-canvas-ink underline"
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  // ── Normal refine bar ──
  const getPlaceholder = () => {
    if (activeTool === 'surgical') return 'Describe change for masked area...';
    if (referenceImage) return "e.g. 'use hairstyle from reference image'";
    return 'Describe a change... (press / to focus)';
  };

  return (
    <div style={{ width: 420, maxWidth: 'calc(100% - 40px)', margin: '0 auto' }}>
      <div className={`flex items-end gap-2 p-1.5 ${barShellClass}`}>
        {/* Enhance */}
        {isIterationAllowed && (
          <>
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
          </>
        )}

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
          disabled={!isIterationAllowed}
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
