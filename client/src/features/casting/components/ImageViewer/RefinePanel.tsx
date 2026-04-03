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
        <div
          className="flex items-center justify-center gap-2 p-2 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 8px 32px rgba(0,0,0,0.06)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.4)' }}
        >
          <span style={{ fontSize: 13, color: '#7c6bef', fontWeight: 500 }}>
            {hasMask ? 'Ready to Erase' : 'Paint Area to Erase'}
          </span>
          {hasMask && (
            <button
              onClick={handleSubmit}
              className="px-4 py-1.5 rounded-lg transition-all"
              style={{ background: '#7c6bef', color: '#fff', fontSize: 12, fontWeight: 600 }}
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
        <div
          className="flex items-center justify-center gap-2 p-3 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 8px 32px rgba(0,0,0,0.06)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.4)' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          <span style={{ fontSize: 13, color: '#52524B' }}>{iterationDisabledReason}</span>
        </div>
      </div>
    );
  }

  // ── View locked ──
  if (isLocked) {
    return (
      <div style={{ width: 420, maxWidth: 'calc(100% - 40px)', margin: '0 auto' }}>
        <div
          className="flex items-center justify-between p-3 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 8px 32px rgba(0,0,0,0.06)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.4)' }}
        >
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            <span style={{ fontSize: 13, color: '#52524B' }}>View Locked</span>
          </div>
          <button
            onClick={() => setUnlockMode(true)}
            style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', textDecoration: 'underline' }}
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
                <Sparkles size={14} strokeWidth={2} />
              )}
            </button>
          </>
        )}

        <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.06)', marginBottom: 6 }} />

        {/* Reference thumbnail */}
        {referenceImage && (
          <div className="flex-shrink-0 mb-0.5" title="Reference image attached — mention it in your instruction">
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
          className="flex-1 outline-none resize-none bg-transparent placeholder-[#52524B]"
          style={{ border: 'none', fontSize: 14, color: '#1a1a1a', lineHeight: 1.5, padding: '8px 8px', minHeight: 34, maxHeight: 80 }}
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
          className="flex-shrink-0 px-4 py-2 rounded-lg transition-all mb-0.5 flex items-center gap-1.5"
          style={{
            background: refineInput.trim() ? '#1a1a1a' : '#E8E4DF',
            color: refineInput.trim() ? '#fff' : '#aaa',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <SendHorizontal size={12} strokeWidth={2} style={{ marginRight: -2 }} />
          <span>Apply</span>
        </button>
      </div>
    </div>
  );
}

export default RefinePanel;
