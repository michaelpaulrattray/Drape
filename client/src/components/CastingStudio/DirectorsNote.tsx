import { useState } from 'react';
import { useCastingGenerationStore } from '@/stores/useCastingGenerationStore';

// ============ Main Component ============

export function DirectorsNote() {
  // Get state from Zustand store
  const currentMasterPrompt = useCastingGenerationStore((state) => state.currentMasterPrompt);
  const currentTechnicalSchema = useCastingGenerationStore((state) => state.currentTechnicalSchema);

  const [showSchema, setShowSchema] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    const content = showSchema 
      ? JSON.stringify(currentTechnicalSchema, null, 2) 
      : currentMasterPrompt;
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="w-full bg-studio-950 border-t border-gray-200 flex-shrink-0 z-20">
      <div className="w-full max-w-[1400px] mx-auto p-3 lg:p-4">
        <div className="flex flex-col md:flex-row gap-3 items-start">
          <div className="flex-1 space-y-2 group">
            {/* Header with toggle and copy buttons */}
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] uppercase font-bold text-subtle tracking-widest">
                {showSchema ? "Technical Schema" : "Director's Note"}
              </h3>
              <div className="flex items-center space-x-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button 
                  onClick={() => setShowSchema(!showSchema)}
                  className="text-xs font-medium text-charcoal hover:text-obsidian transition-colors"
                >
                  {showSchema ? "View Description" : "View Technical Schema"}
                </button>
                <button 
                  onClick={handleCopy}
                  className={`text-xs font-medium transition-colors ${isCopied ? 'text-green-500' : 'text-charcoal hover:text-obsidian'}`}
                >
                  {isCopied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            {/* Content display */}
            {showSchema ? (
              <pre className="text-xs text-charcoal leading-relaxed max-h-32 overflow-y-auto custom-scrollbar select-text bg-gray-100/30 p-3 rounded border border-gray-200">
                {currentTechnicalSchema 
                  ? JSON.stringify(currentTechnicalSchema, null, 2) 
                  : "Technical schema will appear here after generation..."}
              </pre>
            ) : (
              <p className="text-xs text-charcoal leading-relaxed max-h-16 overflow-y-auto custom-scrollbar select-text">
                {currentMasterPrompt || "Master prompt will appear here after generation..."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DirectorsNote;
