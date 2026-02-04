import { useState } from "react";
import HairColorWheel from "@/components/HairColorWheel";
import Tooltip from "@/components/Tooltip";
import { useCastingFormStore } from "@/stores/useCastingFormStore";

// ============ Constants ============

const HAIR_LENGTHS = ["Very Short", "Short", "Medium", "Long", "Very Long"];
const HAIR_TEXTURES = ["Straight", "Slight Wave", "Wavy", "Curly", "Coily / Afro"];
const HAIR_FRINGES = ["None", "Curtain Bangs", "Wispy Bangs", "Blunt Bangs", "Side-Swept", "Micro Fringe"];
const HAIR_PARTINGS = ["Center", "Slight Off-Center", "Side", "Deep Side", "No Part / Slicked"];
const HAIR_VOLUMES = ["Flat / Sleek", "Natural", "Voluminous", "Lifted Crown", "Face-Framing"];
const HAIR_TUCKS = ["None", "One Side", "Both Sides"];
const HAIR_FADES = ["None", "Low Taper", "Mid Fade", "High Fade", "Skin Fade"];

const CHAR_OPTIONS = {
  facialHair: ["None", "Stubble", "Short Beard", "Full Beard", "Goatee", "Mustache"],
};

// ============ Sub-Components ============

function SelectControl({
  label,
  value,
  options,
  onChange,
  tooltip,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (val: string) => void;
  tooltip?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center">
        <label className="text-xs font-medium text-subtle">{label}</label>
        {tooltip && <Tooltip content={tooltip} />}
      </div>
      <div className="relative group">
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm py-2.5 pl-3 pr-8 rounded-lg focus:border-slate-accent focus:outline-none appearance-none cursor-pointer hover:border-slate-accent transition-colors"
        >
          <option value="" className="bg-gray-50 text-subtle">Auto / Random</option>
          {options.map(opt => (
            <option key={opt} value={opt} className="bg-gray-50 text-gray-700">{opt}</option>
          ))}
        </select>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-subtle group-hover:text-gray-700 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </div>
    </div>
  );
}

// ============ Main Component ============

export function HairSection() {
  const [showAdvancedHair, setShowAdvancedHair] = useState(false);
  
  // Get state directly from Zustand store
  const prefs = useCastingFormStore((state) => state.prefs);
  const updatePref = useCastingFormStore((state) => state.updatePref);
  const currentHairFamilies = useCastingFormStore((state) => state.currentHairFamilies);
  
  // Get hair family names for display
  const hairFamilyNames = currentHairFamilies().map(h => h.name);

  return (
    <div className="space-y-5 pt-1">
      {/* Hair Color */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-subtle block">Hair Color</label>
        <HairColorWheel
          currentColor={prefs.hairColor || ""}
          onColorSelect={(val: string) => updatePref('hairColor', val)}
        />
      </div>

      {/* Style Family */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-subtle block">Style Family</label>
        <div className="grid grid-cols-3 gap-2">
          {hairFamilyNames.map(style => {
            const isSelected = prefs.hairStyle === style;
            return (
              <button
                key={style}
                onClick={() => updatePref('hairStyle', style)}
                className={`
                  px-3 py-2.5 rounded-lg border text-xs font-medium transition-all
                  ${isSelected
                    ? 'bg-slate-accent border-white text-obsidian'
                    : 'bg-gray-50 border-gray-200 text-subtle hover:border-slate-accent hover:text-gray-700'
                  }
                `}
              >
                {style}
              </button>
            );
          })}
        </div>
      </div>

      {/* Basic Hair Options */}
      <div className="grid grid-cols-2 gap-4">
        <SelectControl label="Length" options={HAIR_LENGTHS} value={prefs.hairLength || ""} onChange={v => updatePref('hairLength', v)} />
        <SelectControl label="Texture" options={HAIR_TEXTURES} value={prefs.hairTexture || ""} onChange={v => updatePref('hairTexture', v)} />
        <SelectControl label="Fringe" options={HAIR_FRINGES} value={prefs.hairFringe || ""} onChange={v => updatePref('hairFringe', v)} />
        <SelectControl label="Parting" options={HAIR_PARTINGS} value={prefs.hairParting || ""} onChange={v => updatePref('hairParting', v)} />
      </div>
      
      {/* Volume & Facial Hair (Male Only) */}
      <div className={prefs.gender === 'Male' ? "grid grid-cols-2 gap-4" : ""}>
        <SelectControl label="Volume & Shape" options={HAIR_VOLUMES} value={prefs.hairVolume || ""} onChange={v => updatePref('hairVolume', v)} />
        {prefs.gender === 'Male' && (
          <SelectControl label="Facial Hair" options={CHAR_OPTIONS.facialHair} value={prefs.facialHair || ""} onChange={v => updatePref('facialHair', v)} />
        )}
      </div>

      {/* Advanced Hair Toggle */}
      <button
        onClick={() => setShowAdvancedHair(!showAdvancedHair)}
        className="w-full flex items-center justify-between py-2.5 text-xs font-medium text-subtle hover:text-obsidian border-t border-gray-200 transition-colors"
      >
        <span>Advanced Styling</span>
        <span className="text-lg leading-none">{showAdvancedHair ? '−' : '+'}</span>
      </button>

      {/* Advanced Hair Options */}
      {showAdvancedHair && (
        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200 pb-2">
          <SelectControl label="Flyaways" options={["None", "Natural", "Intentional"]} value={prefs.hairFlyaways || ""} onChange={v => updatePref('hairFlyaways', v)} />
          <SelectControl label="Hairline" options={["Natural", "Clean"]} value={prefs.hairHairline || ""} onChange={v => updatePref('hairHairline', v)} />
          <SelectControl label="Tuck" options={HAIR_TUCKS} value={prefs.hairTuck || ""} onChange={v => updatePref('hairTuck', v)} />
          {(prefs.gender === 'Male' || prefs.hairStyle?.includes('Fade') || prefs.hairStyle?.includes('Buzz')) && (
            <SelectControl label="Fade / Taper" options={HAIR_FADES} value={prefs.hairFade || ""} onChange={v => updatePref('hairFade', v)} />
          )}
        </div>
      )}
    </div>
  );
}

export default HairSection;
