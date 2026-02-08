import Tooltip from "@/components/Tooltip";
import TriBlendSelector from "@/components/TriBlendSelector";
import { useCastingFormStore } from "@/features/casting/stores/useCastingFormStore";
import { type CastingVibe } from "@/features/casting/constants";

// ============ Types ============

interface BrandOption {
  value: string;
  desc: string;
}

// ============ Constants ============

const BRAND_OPTIONS: BrandOption[] = [
  { value: "Gucci", desc: "Eclectic / Quirky" },
  { value: "Prada", desc: "Intellectual / Severe" },
  { value: "Saint Laurent", desc: "Heroin Chic / Edgy" },
  { value: "Balenciaga", desc: "Brutalist / Street" },
  { value: "Miu Miu", desc: "Subversive / Youthful" },
  { value: "Versace", desc: "Glamour / Bombshell" },
  { value: "Zara", desc: "Trendy / Polished" },
  { value: "Social Media", desc: "Creator / Authentic" },
];

const ETHNICITIES = [
  "Slavic", "Nordic", "East Asian", "South Asian",
  "Afro-Caribbean", "West African", "Latino",
  "Middle Eastern", "Mixed", "Polynesian"
];

// ============ Main Component ============

export function BrandSelector() {
  // Get state directly from Zustand store
  const prefs = useCastingFormStore((state) => state.prefs);
  const updatePref = useCastingFormStore((state) => state.updatePref);

  // Ethnicity selection helpers
  const handleEthnicityClick = (eth: string) => {
    const currentStr = prefs.ethnicity || "";
    let current = currentStr.split(", ").filter(e => e && e.trim() !== "");

    if (eth === "Mixed") {
      if (current.length === 1 && current[0] === "Mixed") updatePref("ethnicity", "");
      else updatePref("ethnicity", "Mixed");
      return;
    }

    if (current.length === 1 && current[0] === "Mixed") current = [];
    current = current.filter(e => e !== "Mixed");

    if (current.includes(eth)) current = current.filter(e => e !== eth);
    else {
      if (current.length >= 2) current.shift();
      current.push(eth);
    }
    updatePref("ethnicity", current.join(", "));
  };

  const isEthSelected = (eth: string) => {
    const currentStr = prefs.ethnicity || "";
    const current = currentStr.split(", ").filter(e => e && e.trim() !== "");
    if (eth === "Mixed") return (current.length === 1 && current[0] === "Mixed") || current.length > 1;
    return current.includes(eth);
  };

  return (
    <div className="space-y-4 pt-1">
      {/* Brand Selector */}
      <div className="space-y-1.5">
        <div className="flex items-center">
          <label className="text-xs font-medium text-[#757575]">Casting For</label>
          <Tooltip content="Sets the brand archetype. Affects face structure, attitude, and styling." />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {BRAND_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updatePref('castingBrand', opt.value)}
              className={`
                flex flex-col items-start p-2.5 rounded-xl border transition-all text-left
                ${prefs.castingBrand === opt.value
                  ? 'bg-[#0A0A0A] border-[#0A0A0A] text-white'
                  : 'bg-[#EBEBEB] border-transparent text-[#757575] hover:border-[#0A0A0A]/20 hover:text-[#0A0A0A]'
                }
              `}
            >
              <span className="text-xs font-semibold">{opt.value}</span>
              <span className={`text-[10px] leading-none mt-1 ${prefs.castingBrand === opt.value ? 'opacity-70' : 'opacity-60'}`}>{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TriBlend Selector */}
      <div className="pt-2">
        <TriBlendSelector
          value={prefs.castingVibe || { editorial: 0.33, commercial: 0.33, runway: 0.34 }}
          onChange={(val) => updatePref('castingVibe', val)}
        />
      </div>

      {/* Gender */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[#757575]">Gender</label>
        <div className="flex bg-[#EBEBEB] p-0.5 rounded-full">
          {[
            { label: 'Female', value: 'Female', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M12 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" /><path d="M12 14v7" /><path d="M9 18h6" /></svg> },
            { label: 'Male', value: 'Male', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="10" cy="14" r="6" /><path d="M20 4v6" /><path d="M20 4h-6" /><path d="m20 4-6 6" /></svg> },
            { label: 'NB', value: 'Non-Binary', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="6" /><path d="M12 6V2" /><path d="M10 2l4 4" /><path d="M14 2l-4 4" /></svg> },
          ].map((opt) => {
            const isActive = prefs.gender === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => updatePref('gender', opt.value)}
                className={`
                  flex-1 py-2.5 text-xs font-medium rounded-full transition-all flex items-center justify-center gap-2
                  ${isActive
                    ? 'bg-[#0A0A0A] text-white shadow-sm'
                    : 'text-[#757575] hover:text-[#0A0A0A]'
                  }
                `}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Age Slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-end">
          <label className="text-xs font-medium text-[#757575]">Age</label>
          <span className="text-xs font-semibold text-[#0A0A0A]">{prefs.age || 23} Years</span>
        </div>
        <input
          type="range"
          min="18"
          max="85"
          step="1"
          value={prefs.age || "23"}
          onChange={(e) => updatePref('age', e.target.value)}
          className="w-full slider-obsidian focus:outline-none"
        />
      </div>

      {/* Ethnicity Grid */}
      <div className="space-y-3 pt-2">
        <div className="flex justify-between items-end">
          <label className="text-xs font-medium text-[#757575]">Ethnicity</label>
          <span className="text-xs text-[#757575]">
            {prefs.ethnicity ? (prefs.ethnicity === 'Mixed' ? 'Mixed' : 'Max 2') : 'Auto'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {ETHNICITIES.map(eth => {
            const isSelected = isEthSelected(eth);
            return (
              <button
                key={eth}
                onClick={() => handleEthnicityClick(eth)}
                className={`
                  relative flex items-center justify-between px-3 py-3 rounded-xl border transition-all duration-200 group
                  ${isSelected
                    ? 'bg-[#0A0A0A] border-[#0A0A0A] text-white'
                    : 'bg-[#EBEBEB] border-transparent text-[#757575] hover:border-[#0A0A0A]/20 hover:text-[#0A0A0A]'
                  }
                `}
              >
                <span className="text-xs font-medium leading-none">{eth}</span>
                <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${isSelected ? 'bg-white scale-100' : 'bg-[#0A0A0A] scale-0'}`} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default BrandSelector;
