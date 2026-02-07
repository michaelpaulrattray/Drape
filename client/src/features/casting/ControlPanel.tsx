import React from "react";
import { useLocation } from "wouter";
import { Loader2, ChevronLeft, Zap, X, Menu } from "lucide-react";
import { toast } from "sonner";
import { HairSection } from "@/components/CastingStudio/HairSection";
import { EyeSection } from "@/components/CastingStudio/EyeSection";
import { SkinSection } from "@/components/CastingStudio/SkinSection";
import { FaceSection } from "@/components/CastingStudio/FaceSection";
import { BrandSelector } from "@/components/CastingStudio/BrandSelector";
import { PhysiqueSelector } from "@/components/CastingStudio/PhysiqueSelector";
import { useCastingFormStore } from "@/stores/useCastingFormStore";
import { useCastingGenerationStore } from "@/stores/useCastingGenerationStore";
import { useCastingUIStore } from "@/stores/useCastingUIStore";
import { CollapsibleSection, generateRandomPreferences } from "./castingHelpers";
import type { GenerationState, GeneratedAsset } from "@/constants/casting";

interface ControlPanelProps {
  user: { role?: string } | null;
  creditsBalance: number;
  isFormValid: boolean;
  genState: GenerationState;
  currentAssets: GeneratedAsset[];
  handleGenerate: () => void;
}

export function ControlPanel({
  user,
  creditsBalance,
  isFormValid,
  genState,
  currentAssets,
  handleGenerate,
}: ControlPanelProps) {
  const [, navigate] = useLocation();
  const { prefs, setPrefs } = useCastingFormStore();
  const { showMobilePanel, setShowMobilePanel } = useCastingUIStore();

  const handleDebugFill = (autoGenerate: boolean = false) => {
    const randomPrefs = generateRandomPreferences();
    setPrefs({ ...prefs, ...randomPrefs });
    toast.success('Debug: Form populated with random preferences');
    
    if (autoGenerate) {
      setTimeout(() => {
        toast.info('Debug: Ready to generate - press Generate button or use Ctrl+Shift+G');
      }, 100);
    }
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-subtle hover:text-obsidian transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back</span>
        </button>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-obsidian" />
            <span className="text-sm font-medium text-obsidian">{creditsBalance}</span>
          </div>
          <button
            onClick={() => setShowMobilePanel(!showMobilePanel)}
            className="p-2 rounded-lg bg-slate-accent text-obsidian"
          >
            {showMobilePanel ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Left Panel - Control Panel */}
      <aside className={`
        ${showMobilePanel ? 'fixed inset-0 z-50 pt-16 flex flex-col' : 'hidden'}
        lg:relative lg:flex lg:flex-col lg:w-[400px] lg:pt-0
        bg-white border-r border-gray-200 h-screen flex-shrink-0
      `}>
        {/* Header */}
        <div className="hidden lg:flex p-4 border-b border-gray-200 items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-subtle hover:text-obsidian transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-obsidian" />
            <span className="text-xs font-medium text-obsidian">{creditsBalance}</span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-2 custom-scrollbar">
          <CollapsibleSection title="Casting Basics" required id="section-casting-basics">
            <BrandSelector />
          </CollapsibleSection>

          <CollapsibleSection title="Physique" id="section-physique">
            <PhysiqueSelector />
          </CollapsibleSection>

          <CollapsibleSection title="Face Structure">
            <FaceSection />
          </CollapsibleSection>

          <CollapsibleSection title="Skin & Complexion" required id="section-skin">
            <SkinSection />
          </CollapsibleSection>

          <CollapsibleSection title="Eyes" required id="section-eyes">
            <EyeSection />
          </CollapsibleSection>

          <CollapsibleSection title="Hair" required id="section-hair">
            <HairSection />
          </CollapsibleSection>
        </div>

        {/* Generate Button */}
        <div className="p-5 border-t border-gray-200 bg-white mt-auto">
          <button
            data-debug-generate
            onClick={(e) => {
              const button = e.currentTarget;
              button.classList.add('animate-button-pulse');
              setTimeout(() => {
                if (button) button.classList.remove('animate-button-pulse');
              }, 600);
              handleGenerate();
            }}
            disabled={!isFormValid || genState.isGenerating}
            className="w-full py-4 bg-slate-accent hover:bg-[#5D6E7C] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl hover-scale active:scale-95"
          >
            {genState.isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{genState.currentStep}</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                <span>{currentAssets.length > 0 ? 'Recast Model' : 'Cast Model'}</span>
              </>
            )}
          </button>
          {!isFormValid && (
            <p className="text-xs text-subtle text-center mt-2">
              Complete required fields to enable casting
            </p>
          )}
          
          {/* Admin Tools - Only visible to admins */}
          {user?.role === 'admin' && (
            <details className="mt-3 pt-3 border-t border-gray-100 group">
              <summary className="text-xs text-subtle cursor-pointer hover:text-charcoal transition-colors flex items-center gap-1.5 select-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90"><polyline points="9 18 15 12 9 6"></polyline></svg>
                Admin Tools
              </summary>
              <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDebugFill(false)}
                    disabled={genState.isGenerating}
                    className="flex-1 py-1.5 px-2 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 text-subtle hover:text-charcoal text-xs font-medium rounded-md border border-gray-200 transition-colors"
                    title="Ctrl+Shift+D"
                  >
                    Random Fill
                  </button>
                  <button
                    onClick={() => {
                      const randomPrefs = generateRandomPreferences();
                      setPrefs({ ...prefs, ...randomPrefs });
                      toast.success('Auto-generating model...');
                      setTimeout(() => {
                        const generateBtn = document.querySelector('[data-debug-generate]') as HTMLButtonElement;
                        if (generateBtn && !generateBtn.disabled) {
                          generateBtn.click();
                        }
                      }, 200);
                    }}
                    disabled={genState.isGenerating}
                    className="flex-1 py-1.5 px-2 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 text-subtle hover:text-charcoal text-xs font-medium rounded-md border border-gray-200 transition-colors"
                    title="Ctrl+Shift+G"
                  >
                    Auto Generate
                  </button>
                </div>
              </div>
            </details>
          )}
        </div>
      </aside>
    </>
  );
}
