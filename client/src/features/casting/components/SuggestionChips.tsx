import { useSuggestions, useIsLoadingSuggestions } from "@/features/casting/stores/useCastingGenerationStore";

// ============ Constants ============

const SKELETON_WIDTHS = ["w-20", "w-28", "w-24", "w-32", "w-20", "w-26"];

// ============ Component ============

interface SuggestionChipsProps {
  onChipClick: (text: string) => void;
  disabled?: boolean;
}

export function SuggestionChips({ onChipClick, disabled }: SuggestionChipsProps) {
  const suggestions = useSuggestions();
  const isLoading = useIsLoadingSuggestions();

  // Nothing to show
  if (!isLoading && suggestions.length === 0) return null;

  return (
    <div className="w-full overflow-x-auto scrollbar-hide pb-1">
      <div className="flex gap-1.5 px-1">
        {isLoading ? (
          // Shimmer skeleton chips
          SKELETON_WIDTHS.map((w, i) => (
            <div
              key={i}
              className={`${w} h-7 rounded-full bg-[#0A0A0A]/5 animate-pulse shrink-0`}
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))
        ) : (
          // Actual suggestion chips
          suggestions.map((text, i) => (
            <button
              key={`${text}-${i}`}
              onClick={() => !disabled && onChipClick(text)}
              disabled={disabled}
              className={`
                shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium
                border border-[#0A0A0A]/10 bg-white/80 backdrop-blur-sm
                text-[#0A0A0A]/70 hover:text-[#0A0A0A] hover:bg-white hover:border-[#0A0A0A]/25
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200 animate-in fade-in slide-in-from-bottom-1
              `}
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
            >
              {text}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default SuggestionChips;
