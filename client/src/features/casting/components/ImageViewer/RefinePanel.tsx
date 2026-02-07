import { RefObject } from 'react';
import { Loader2 } from 'lucide-react';
import Tooltip from '@/components/Tooltip';
import { useCastingUIStore } from '@/features/casting/useCastingUIStore';

// ============ Types ============

type EditTool = 'none' | 'surgical' | 'eraser';

interface RefinePanelProps {
  // Tool state (still passed as props due to local drawing state)
  maskPathsCount: number;
  isMasking: boolean;
  
  // View state (computed values still passed as props)
  isViewLocked: boolean;
  isIterationAllowed: boolean;
  
  // Refs (must be passed as props)
  textAreaRef: RefObject<HTMLTextAreaElement | null>;
  
  // Actions (handlers still in parent due to tRPC mutations)
  handleGenerate: () => void;
  handleEnhance: () => void;
  handleRefineSubmit: () => void;
}

// ============ Sub-components ============

const RegenerateButton = ({ onClick, disabled }: { onClick: () => void; disabled: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex-shrink-0 p-1.5 transition-colors ${disabled ? 'text-subtle cursor-not-allowed' : 'text-charcoal hover:text-obsidian'}`}
    title="Regenerate with Current Settings"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
    </svg>
  </button>
);

const EnhanceButton = ({ onClick, disabled, isEnhancing }: { onClick: () => void; disabled: boolean; isEnhancing: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex-shrink-0 p-1.5 text-charcoal hover:text-obsidian disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    title="Enhance Prompt (AI)"
  >
    {isEnhancing ? (
      <Loader2 className="w-4 h-4 animate-spin" />
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/>
        <path d="M17.8 11.8 19 13"/><path d="M15 9h0"/><path d="M17.8 6.2 19 5"/>
        <path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/>
      </svg>
    )}
  </button>
);

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
}: RefinePanelProps) {
  // Get UI state from Zustand store
  const {
    activeView,
    activeTool,
    refineInput,
    setRefineInput,
    isEnhancing,
    unlockMode,
    setUnlockMode,
  } = useCastingUIStore();

  const isLocked = isViewLocked && !unlockMode;
  const hasMask = maskPathsCount > 0;

  // Get placeholder text based on state
  const getPlaceholder = () => {
    if (isEnhancing) return "Optimizing instruction with AI...";
    if (isViewLocked) {
      return activeView === 'backFull' 
        ? "WARNING: MAKING CHANGES TO THIS IMAGE COULD RUIN CHARACTER CONSISTENCY..." 
        : "Editing will reset downstream assets...";
    }
    if (activeTool === 'surgical') {
      return `Describe change for masked area (e.g. 'Add scar')...`;
    }
    return `Iterate on ${activeView.replace(/([A-Z])/g, ' $1').toLowerCase()}...`;
  };

  // Render submit button based on tool
  const renderSubmitButton = () => {
    if (activeTool === 'eraser') {
      return (
        <button 
          onClick={handleRefineSubmit}
          disabled={!hasMask}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
            hasMask 
              ? 'bg-purple-500 text-obsidian hover:bg-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]' 
              : 'bg-slate-accent text-subtle cursor-not-allowed'
          }`}
        >
          Erase
        </button>
      );
    }
    
    if (activeTool === 'surgical') {
      return (
        <button 
          onClick={handleRefineSubmit}
          disabled={!hasMask || !refineInput.trim() || isLocked}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
            (hasMask && refineInput.trim()) 
              ? 'bg-red-500 text-obsidian hover:bg-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)]' 
              : 'bg-slate-accent text-subtle cursor-not-allowed'
          }`}
        >
          Apply
        </button>
      );
    }
    
    return (
      <button 
        onClick={handleRefineSubmit}
        disabled={!refineInput.trim() || isLocked || !isIterationAllowed}
        className={`flex-shrink-0 p-1.5 rounded-full transition-colors ${
          isLocked || !isIterationAllowed 
            ? 'bg-slate-accent text-subtle cursor-not-allowed' 
            : 'bg-white text-black hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    );
  };

  // Render input area based on state
  const renderInputArea = () => {
    if (activeTool === 'eraser') {
      return (
        <div className="flex-1 px-2 py-1.5 min-h-[28px] flex items-center">
          <span className="text-xs font-medium text-purple-400/50">
            {!hasMask ? "Paint Area to Erase" : "Ready to Erase"}
          </span>
        </div>
      );
    }
    
    if (isLocked) {
      return (
        <div className="flex-1 flex items-center justify-between px-2 py-1">
          <div className="flex items-center space-x-2 text-charcoal select-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span className="text-xs font-medium">Locked</span>
            <Tooltip content={
              activeView === 'backFull' 
                ? "Editing this finalized view may break visual consistency with the rest of the character pack."
                : "This view is the source for downstream assets (Full Body, Angles). Editing it will reset them."
            } />
          </div>
          <button 
            onClick={() => setUnlockMode(true)}
            className="text-xs font-medium text-subtle hover:text-obsidian transition-colors border-b border-dashed border-gray-300 hover:border-white pb-0.5"
          >
            Unlock to Edit
          </button>
        </div>
      );
    }
    
    if (!isIterationAllowed) {
      return (
        <div className="flex-1 px-2 py-1 flex items-center space-x-2 text-subtle select-none">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          <span className="text-xs font-medium">Locked Angle</span>
          <Tooltip content="To maintain consistency, only the Headshot, Front Full Body, and Back View can be iterated with text. Use Magic Eraser for corrections." />
        </div>
      );
    }
    
    return (
      <textarea 
        ref={textAreaRef}
        value={refineInput}
        onChange={(e) => setRefineInput(e.target.value)}
        disabled={isEnhancing} 
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !isEnhancing) {
            e.preventDefault();
            handleRefineSubmit();
          }
        }}
        placeholder={getPlaceholder()}
        rows={1}
        className={`flex-1 bg-transparent border-none text-sm placeholder:text-subtle focus:outline-none focus:ring-0 px-2 py-1.5 resize-none custom-scrollbar min-h-[28px] max-h-[200px] ${
          isViewLocked ? 'text-amber-100 placeholder:text-amber-500/50' : 
          isEnhancing ? 'text-subtle animate-pulse' : 'text-obsidian'
        }`}
      />
    );
  };

  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-full max-w-xl z-30 px-2" onClick={e => e.stopPropagation()} style={{marginBottom: '60px', marginLeft: '10px'}}>
      {/* Inline Helper Text for Masking */}
      {isMasking && (
        <div className="mb-2 flex justify-center animate-in fade-in slide-in-from-bottom-1 duration-300">
          <div className="flex items-center gap-2 px-3 py-1 bg-white/80 backdrop-blur-md rounded border border-gray-200 shadow-lg">
            <span className={`text-xs font-medium ${activeTool === 'eraser' ? 'text-purple-500' : 'text-red-500'}`}>
              {!hasMask ? "STEP 01" : "STEP 02"}
            </span>
            <span className="w-px h-2 bg-white/20"></span>
            <span className="text-xs font-medium text-gray-700">
              {!hasMask 
                ? "Paint Target Area" 
                : (activeTool === 'eraser' ? "Click Erase Button" : "Describe Edit & Generate")
              }
            </span>
          </div>
        </div>
      )}

      <div className={`mx-1 bg-white/90 backdrop-blur-md border rounded-full shadow-xl flex items-center p-1 transition-all focus-within:ring-1 focus-within:ring-white/20 ${
        isLocked && activeTool !== 'eraser' ? 'border-gray-300 opacity-90' : 'border-gray-200'
      }`}>
        {/* Regenerate Button */}
        <RegenerateButton 
          onClick={handleGenerate} 
          disabled={isLocked || !isIterationAllowed} 
        />

        <div className="w-px h-4 bg-white/10 mx-1"></div>

        {/* Input Area */}
        {renderInputArea()}
        
        {/* Enhance button */}
        {((!isViewLocked || unlockMode) && isIterationAllowed && activeTool !== 'eraser') && (
          <EnhanceButton 
            onClick={handleEnhance}
            disabled={!refineInput.trim() || isEnhancing}
            isEnhancing={isEnhancing}
          />
        )}

        {/* Submit button */}
        {renderSubmitButton()}
      </div>
    </div>
  );
}

export default RefinePanel;
