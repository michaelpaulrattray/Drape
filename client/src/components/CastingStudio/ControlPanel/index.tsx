import { ChevronLeft, Zap } from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";
import { BrandSelector } from "../BrandSelector";
import { PhysiqueSelector } from "../PhysiqueSelector";
import { FaceSection } from "../FaceSection";
import { SkinSection } from "../SkinSection";
import { EyeSection } from "../EyeSection";
import { HairSection } from "../HairSection";
import type { ModelPreferences, CastingVibe } from "@/constants/casting";

// ============ Types ============

interface ControlPanelProps {
  prefs: ModelPreferences;
  updatePref: <K extends keyof ModelPreferences>(key: K, value: ModelPreferences[K]) => void;
  currentHairFamilies: string[];
  creditsBalance: number;
  onNavigateBack: () => void;
  showMobilePanel: boolean;
  onToggleMobilePanel: () => void;
}

// ============ Main Component ============

export function ControlPanel({
  prefs,
  updatePref,
  currentHairFamilies,
  creditsBalance,
  onNavigateBack,
  showMobilePanel,
  onToggleMobilePanel,
}: ControlPanelProps) {
  return (
    <aside className={`
      ${showMobilePanel ? 'fixed inset-0 z-50 pt-16 flex flex-col' : 'hidden'}
      lg:relative lg:flex lg:flex-col lg:w-[400px] lg:pt-0
      bg-white border-r border-gray-200 h-screen flex-shrink-0
    `}>
      {/* Header */}
      <div className="hidden lg:flex p-4 border-b border-gray-200 items-center justify-between">
        <button
          onClick={onNavigateBack}
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
        {/* 1. CASTING BASICS */}
        <CollapsibleSection title="Casting Basics" required id="section-casting-basics">
          <BrandSelector
            prefs={prefs}
            updatePref={updatePref as (key: string, value: string | CastingVibe) => void}
          />
        </CollapsibleSection>

        {/* 2. PHYSIQUE */}
        <CollapsibleSection title="Physique" id="section-physique">
          <PhysiqueSelector
            selected={prefs.bodyType || "Slim"}
            onSelect={(val) => updatePref('bodyType', val)}
          />
        </CollapsibleSection>

        {/* 3. FACE STRUCTURE */}
        <CollapsibleSection title="Face Structure">
          <FaceSection
            prefs={prefs}
            updatePref={updatePref}
          />
        </CollapsibleSection>

        {/* 4. SKIN & COMPLEXION */}
        <CollapsibleSection title="Skin & Complexion" required id="section-skin">
          <SkinSection
            prefs={prefs}
            updatePref={updatePref}
          />
        </CollapsibleSection>

        {/* 5. EYES */}
        <CollapsibleSection title="Eyes" required id="section-eyes">
          <EyeSection
            selected={prefs.eyeColor || ""}
            onSelect={(val) => updatePref('eyeColor', val)}
          />
        </CollapsibleSection>

        {/* 6. HAIR */}
        <CollapsibleSection title="Hair" required id="section-hair">
          <HairSection
            prefs={prefs}
            updatePref={updatePref}
            currentHairFamilies={currentHairFamilies}
          />
        </CollapsibleSection>
      </div>
    </aside>
  );
}

export { CollapsibleSection };
export default ControlPanel;
