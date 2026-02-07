import Tooltip from "@/components/Tooltip";
import { useCastingFormStore } from "@/features/casting/useCastingFormStore";

// ============ Types ============

interface SkinTone {
  label: string;
  value: string;
  base: string;
  shadow: string;
}

// ============ Constants ============

const SKIN_TONES: SkinTone[] = [
  { label: "Porcelain", value: "Porcelain / Pale", base: "#ffe0d6", shadow: "#eac0b0" },
  { label: "Fair", value: "Fair / Light", base: "#f5cbb6", shadow: "#dcb098" },
  { label: "Medium", value: "Medium / Olive", base: "#d9ae88", shadow: "#bf926b" },
  { label: "Tan", value: "Tan / Bronze", base: "#c08a65", shadow: "#a06d48" },
  { label: "Deep", value: "Deep / Brown", base: "#8d5e42", shadow: "#6b422a" },
  { label: "Ebony", value: "Ebony / Dark", base: "#593b2b", shadow: "#3d2316" },
];

const SKIN_TEXTURES = ["Raw / Standard", "Glass / Perfect", "Freckled", "Textured / Acneic", "Mature"];
const SKIN_FINISHES = ["Natural", "Matte / Powdered", "Dewy / Sweat", "Oily"];

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

export function SkinSection() {
  // Get state directly from Zustand store
  const prefs = useCastingFormStore((state) => state.prefs);
  const updatePref = useCastingFormStore((state) => state.updatePref);

  return (
    <div className="space-y-5 pt-1">
      {/* Skin Tone Visual Picker */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-subtle block">Skin Tone</label>
        <div className="flex gap-2">
          {SKIN_TONES.map(tone => {
            const isSelected = prefs.skinTone === tone.value;
            return (
              <button
                key={tone.label}
                onClick={() => updatePref('skinTone', tone.value)}
                className={`
                  relative flex-1 aspect-square rounded-lg border-2 transition-all duration-300 group overflow-hidden
                  ${isSelected
                    ? 'border-obsidian ring-2 ring-obsidian/50 scale-105 z-10 shadow-lg'
                    : 'border-transparent hover:border-slate-accent hover:scale-105'
                  }
                `}
                title={tone.label}
              >
                <div
                  className="absolute inset-0"
                  style={{ background: `linear-gradient(145deg, ${tone.base} 0%, ${tone.shadow} 100%)` }}
                />
                <div className="absolute top-1 left-1 w-2 h-2 bg-white/30 rounded-full blur-[2px]" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Texture & Finish Dropdowns */}
      <div className="grid grid-cols-2 gap-4">
        <SelectControl 
          label="Texture" 
          options={SKIN_TEXTURES} 
          value={prefs.skinTexture || ""} 
          onChange={v => updatePref('skinTexture', v)} 
          tooltip="Skin surface quality" 
        />
        <SelectControl 
          label="Finish" 
          options={SKIN_FINISHES} 
          value={prefs.skinFinish || ""} 
          onChange={v => updatePref('skinFinish', v)} 
          tooltip="Skin shine level" 
        />
      </div>
    </div>
  );
}

export default SkinSection;
