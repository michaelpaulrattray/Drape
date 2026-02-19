import { useState } from 'react';
import { ChevronDown, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { useCurrentMasterPrompt, useAmendments, useIdentityWarning } from '@/features/casting/stores/useCastingGenerationStore';

// ============ Types ============

interface CompactPromptButtonProps {
  onCompact: () => void;
  isCompacting?: boolean;
}

// ============ Component ============

export function CompactPromptButton({ onCompact, isCompacting }: CompactPromptButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const masterPrompt = useCurrentMasterPrompt();
  const amendments = useAmendments();
  const identityWarning = useIdentityWarning();

  // Don't render if no master prompt exists yet
  if (!masterPrompt) return null;

  const charCount = masterPrompt.length;
  const canCompact = amendments.length >= 2;

  return (
    <div className="border-t border-[#0A0A0A]/5 mt-4 pt-3">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#757575]">
            Master Prompt
          </span>
          <span className="text-[9px] font-medium text-[#757575]/60 bg-[#EBEBEB] px-1.5 py-0.5 rounded-full">
            {charCount.toLocaleString()} chars
          </span>
          {amendments.length > 0 && (
            <span className="text-[9px] font-medium text-amber-600/80 bg-amber-50 px-1.5 py-0.5 rounded-full">
              {amendments.length} {amendments.length === 1 ? 'amendment' : 'amendments'}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#757575] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Identity Warning */}
          {identityWarning && (
            <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200/50 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-amber-700 leading-relaxed">{identityWarning}</p>
            </div>
          )}

          {/* Prompt Text */}
          <div className="relative">
            <pre className="text-[10px] leading-relaxed text-[#0A0A0A]/70 font-mono bg-[#F5F5F5] rounded-lg p-3 max-h-[200px] overflow-y-auto custom-scrollbar whitespace-pre-wrap break-words">
              {masterPrompt}
            </pre>
          </div>

          {/* Compact Button */}
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-[#757575]/60">
              {canCompact
                ? 'Prompt has accumulated amendments — compaction recommended'
                : 'Compaction available after 2+ amendments'}
            </p>
            <button
              onClick={onCompact}
              disabled={!canCompact || isCompacting}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold
                transition-all duration-200
                ${canCompact && !isCompacting
                  ? 'bg-[#0A0A0A] text-white hover:bg-[#0A0A0A]/80'
                  : 'bg-[#EBEBEB] text-[#757575] cursor-not-allowed'
                }
              `}
            >
              {isCompacting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              Compact
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompactPromptButton;
