import { useState } from "react";
import Tooltip from "@/components/Tooltip";
import { useCastingFormStore } from "@/features/casting/stores/useCastingFormStore";

// ============ Constants ============

const FACE_SHAPES = ["Oval", "Round", "Square", "Heart", "Diamond", "Random"];

const FACE_ICONS: Record<string, React.ReactNode> = {
  "Oval": <path d="M12 2C7 2 5 6 5 11C5 16 8 22 12 22C16 22 19 16 19 11C19 6 17 2 12 2Z" />,
  "Round": <circle cx="12" cy="12" r="10" />,
  "Square": <rect x="4" y="4" width="16" height="16" rx="2" />,
  "Heart": <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" transform="scale(0.8) translate(3, 2)" />,
  "Diamond": <polygon points="12 2 4 10 12 22 20 10" />,
  "Random": <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l-5 5M4 4l5 5" />,
};

const CHAR_OPTIONS = {
  jawline: ["Sharp / Chiseled", "Soft / Rounded", "Strong / Pronounced", "Receding / Weak", "Snatched"],
  cheekbones: ["High", "Defined", "Soft"],
  cheeks: ["Slightly Hollow", "Full", "Balanced"],
  eyeShape: ["Thin Almond", "Monolids", "Wide-Set", "Round", "Hooded"],
  noseShape: ["Thin", "Straight Bridge", "Rounded", "Prominent", "Button"],
  lipShape: ["Full", "Subtle", "Lip Lift", "Wide", "Cupid's Bow"],
  eyebrows: ["Brushed Up", "Straight", "Arched", "Bold", "Bleached", "Random"],
  facialHair: ["Clean Shaven", "Stubble", "Short Beard", "Full Beard"],
};

// ============ Sub-Components ============

function VisualOptionGrid({
  options,
  selected,
  onSelect,
  icons,
}: {
  options: string[];
  selected: string;
  onSelect: (val: string) => void;
  icons?: Record<string, React.ReactNode>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map(opt => {
        const isSelected = selected === opt;
        return (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={`
              flex flex-col items-center justify-center h-16 rounded border transition-all duration-200 group
              ${isSelected
                ? 'bg-slate-accent border-white text-obsidian'
                : 'bg-transparent border-gray-200 text-subtle hover:border-slate-accent hover:bg-gray-50 hover:text-gray-700'
              }
            `}
          >
            <div className={`mb-1.5 transition-transform duration-200 ${isSelected ? 'scale-100' : 'scale-90 group-hover:scale-100'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={isSelected ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isSelected ? "0" : "1.5"}>
                {icons?.[opt] || <circle cx="12" cy="12" r="8" />}
              </svg>
            </div>
            <span className="text-[10px] font-medium leading-none text-center">{opt}</span>
          </button>
        );
      })}
    </div>
  );
}

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

export function FaceSection() {
  const [showAdvancedFace, setShowAdvancedFace] = useState(false);
  
  // Get state directly from Zustand store
  const prefs = useCastingFormStore((state) => state.prefs);
  const updatePref = useCastingFormStore((state) => state.updatePref);

  return (
    <div className="space-y-5 pt-1">
      {/* Face Shape */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-subtle block">Face Shape</label>
        <VisualOptionGrid
          options={FACE_SHAPES}
          selected={prefs.faceShape || "Oval"}
          onSelect={(val) => updatePref('faceShape', val)}
          icons={FACE_ICONS}
        />
      </div>

      {/* Eyebrow Style */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-subtle block">Eyebrow Style</label>
        <VisualOptionGrid
          options={CHAR_OPTIONS.eyebrows}
          selected={prefs.eyebrowStyle || ""}
          onSelect={(val) => updatePref('eyebrowStyle', val)}
        />
      </div>

      {/* Advanced Face Toggle */}
      <button
        onClick={() => setShowAdvancedFace(!showAdvancedFace)}
        className="w-full flex items-center justify-between py-2.5 text-xs font-medium text-subtle hover:text-obsidian border-t border-gray-200 transition-colors"
      >
        <span>Advanced Features</span>
        <span className="text-lg leading-none">{showAdvancedFace ? '−' : '+'}</span>
      </button>

      {/* Advanced Face Options */}
      {showAdvancedFace && (
        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200 pb-2">
          <SelectControl label="Jawline" options={CHAR_OPTIONS.jawline} value={prefs.jawline || ""} onChange={v => updatePref('jawline', v)} />
          <SelectControl label="Cheekbones" options={CHAR_OPTIONS.cheekbones} value={prefs.cheekbones || ""} onChange={v => updatePref('cheekbones', v)} />
          <SelectControl label="Cheeks" options={CHAR_OPTIONS.cheeks} value={prefs.cheeks || ""} onChange={v => updatePref('cheeks', v)} />
          <SelectControl label="Eye Shape" options={CHAR_OPTIONS.eyeShape} value={prefs.eyeShape || ""} onChange={v => updatePref('eyeShape', v)} />
          <SelectControl label="Nose" options={CHAR_OPTIONS.noseShape} value={prefs.noseShape || ""} onChange={v => updatePref('noseShape', v)} />
          <SelectControl label="Lips" options={CHAR_OPTIONS.lipShape} value={prefs.lipShape || ""} onChange={v => updatePref('lipShape', v)} />
          {prefs.gender === 'Male' && (
            <SelectControl label="Facial Hair" options={CHAR_OPTIONS.facialHair} value={prefs.facialHair || ""} onChange={v => updatePref('facialHair', v)} />
          )}
        </div>
      )}
    </div>
  );
}

export default FaceSection;
