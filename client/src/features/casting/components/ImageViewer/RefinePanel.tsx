import { RefObject, useRef, useState, useEffect } from 'react';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { SuggestionChips } from '../SuggestionChips';

// ============ Types ============

type EditTool = 'none' | 'surgical' | 'eraser';

interface RefinePanelProps {
  maskPathsCount: number;
  isMasking: boolean;
  isViewLocked: boolean;
  isIterationAllowed: boolean;
  textAreaRef: RefObject<HTMLTextAreaElement | null>;
  handleGenerate: () => void;
  handleEnhance: () => void;
  handleRefineSubmit: () => void;
  onSuggestionClick?: (text: string) => void;
  referenceImage?: string;
}

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
  onSuggestionClick,
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

  const handleChipClick = (text: string) => {
    if (onSuggestionClick) onSuggestionClick(text);
    else setRefineInput(text);
  };

  const handleSubmit = () => {
    if (refineInput.trim() || activeTool === 'eraser') {
      handleRefineSubmit();
    }
  };

  const iterationDisabledReason =
    activeView === 'sideClose'
      ? 'Side profile cannot be edited directly. Edit the headshot or full body instead.'
      : null;

  // ── Eraser mode ──
  if (activeTool === 'eraser') {
    return (
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30" style={{ width: 420, maxWidth: 'calc(100% - 40px)' }}>
        <div
          className="flex items-center justify-center gap-2 p-2 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 8px 32px rgba(0,0,0,0.06)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.4)' }}
        >
          <span style={{ fontSize: 11, color: '#7c6bef', fontWeight: 500 }}>
            {hasMask ? 'Ready to Erase' : 'Paint Area to Erase'}
          </span>
          {hasMask && (
            <button
              onClick={handleSubmit}
              className="px-4 py-1.5 rounded-lg transition-all"
              style={{ background: '#7c6bef', color: '#fff', fontSize: 10, fontWeight: 600 }}
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
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30" style={{ width: 420, maxWidth: 'calc(100% - 40px)' }}>
        <div
          className="flex items-center justify-center gap-2 p-3 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 8px 32px rgba(0,0,0,0.06)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.4)' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          <span style={{ fontSize: 11, color: '#999' }}>{iterationDisabledReason}</span>
        </div>
      </div>
    );
  }

  // ── View locked ──
  if (isLocked) {
    return (
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30" style={{ width: 420, maxWidth: 'calc(100% - 40px)' }}>
        <div
          className="flex items-center justify-between p-3 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 8px 32px rgba(0,0,0,0.06)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.4)' }}
        >
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            <span style={{ fontSize: 11, color: '#999' }}>View Locked</span>
          </div>
          <button
            onClick={() => setUnlockMode(true)}
            style={{ fontSize: 10, fontWeight: 600, color: '#1a1a1a', textDecoration: 'underline' }}
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

  const glowKeyframes = `
    @keyframes enhanceFloat {
      0%, 100% { transform: translateY(0px); }
      50%       { transform: translateY(-2px); }
    }
  `;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
      {/* Suggestion Chips */}
      {!isMasking && isIterationAllowed && (
        <div className="mb-2 px-1">
          <SuggestionChips onChipClick={handleChipClick} disabled={false} />
        </div>
      )}

      {/* Masking helper */}
      {isMasking && (
        <div className="mb-2 flex justify-center animate-in fade-in slide-in-from-bottom-1 duration-300">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
          >
            <span style={{ fontSize: 9, fontWeight: 700, color: '#c33' }}>{hasMask ? 'STEP 02' : 'STEP 01'}</span>
            <span style={{ width: 1, height: 8, background: 'rgba(0,0,0,0.1)', display: 'inline-block' }} />
            <span style={{ fontSize: 9, fontWeight: 500, color: '#777' }}>
              {!hasMask ? 'Paint Target Area' : 'Describe Edit & Apply'}
            </span>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div style={{ width: 420, maxWidth: 'calc(100% - 40px)', margin: '0 auto' }}>
        <div
          className="flex items-end gap-2 p-1.5 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 8px 32px rgba(0,0,0,0.06)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.4)' }}
        >
          {/* Enhance */}
          {isIterationAllowed && (
            <>
              {glowActive && <style>{glowKeyframes}</style>}
              <button
                onClick={handleEnhance}
                disabled={!refineInput.trim() || isEnhancing}
                className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                style={{
                  color: glowActive ? '#a89cf5' : '#bbb',
                  animation: glowActive ? 'enhanceFloat 1.4s ease-in-out infinite' : 'none',
                  transition: 'color 0.4s ease',
                }}
                title="Enhance with AI"
              >
                {isEnhancing ? (
                  <div className="w-3 h-3 border-2 border-t-transparent border-gray-400 rounded-full animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                )}
              </button>
            </>
          )}

          <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.06)', marginBottom: 6 }} />

          {/* Reference thumbnail */}
          {referenceImage && (
            <div className="flex-shrink-0 mb-0.5" title="Reference image attached">
              <div className="w-7 h-7 rounded-lg overflow-hidden" style={{ border: '1.5px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
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
            className="flex-1 outline-none resize-none bg-transparent placeholder-[#b8b3a8]"
            style={{ border: 'none', fontSize: 12, color: '#1a1a1a', lineHeight: 1.5, padding: '8px 8px', minHeight: 34, maxHeight: 80 }}
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
            className="flex-shrink-0 px-4 py-2 rounded-lg transition-all mb-0.5"
            style={{
              background: refineInput.trim() ? '#1a1a1a' : '#e8e5df',
              color: refineInput.trim() ? '#fff' : '#aaa',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            Apply
          </button>
        </div>
      </div>

      {/* Shortcuts bar */}
      <div
        className="mt-2 flex items-center justify-center gap-3 pointer-events-none"
        style={{
          padding: '5px 14px',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          width: 'fit-content',
          margin: '8px auto 0',
        }}
      >
        {[
          { key: 'Z', label: 'Undo' },
          { key: '⇧Z', label: 'Redo' },
          { key: '/', label: 'Refine' },
          ...(referenceImage ? [{ key: 'F', label: 'Ref' }] : []),
        ].map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: '#bbb',
                padding: '1px 4px',
                borderRadius: 3,
                background: 'rgba(0,0,0,0.04)',
                fontFamily: 'monospace',
              }}
            >
              {s.key}
            </span>
            <span style={{ fontSize: 9, color: '#bbb' }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RefinePanel;
