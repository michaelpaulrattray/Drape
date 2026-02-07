import { useCastingFormStore } from "@/features/casting/stores/useCastingFormStore";

// ============ Types ============

interface BodyType {
  label: string;
  value: string;
}

// ============ Constants ============

const BODY_TYPES: BodyType[] = [
  { label: "Ultra Thin", value: "Ultra Thin" },
  { label: "Slim", value: "Slim" },
  { label: "Athletic", value: "Athletic" },
  { label: "Muscular", value: "Muscular" },
  { label: "Curvy", value: "Curvy" },
  { label: "Petite", value: "Petite" },
];

const BODY_ICONS: Record<string, React.ReactNode> = {
  "Ultra Thin": <path d="M12 2C10 2 9 4 9 5C9 7 8 10 9 13C10 16 9 19 9 22H15C15 19 14 16 15 13C16 10 15 7 15 5C15 4 14 2 12 2Z" />,
  "Athletic": <path d="M12 2C9 2 7 4 7 6C7 8 8 11 10 13C11 14 11 16 11 22H13C13 16 13 14 14 13C16 11 17 8 17 6C17 4 15 2 12 2Z" />,
  "Slim": <path d="M12 2C10.5 2 9 4 9 5.5C9 7.5 9.5 10 10 12.5C10.5 15 10.5 18 10.5 22H13.5C13.5 18 13.5 15 14 12.5C14.5 10 15 7.5 15 5.5C15 4 13.5 2 12 2Z" />,
  "Curvy": <path d="M12 2C9 2 8 4 8 6C8 9 7 12 8 15C9 18 8 20 8 22H16C16 20 15 18 16 15C17 12 16 9 16 6C16 4 15 2 12 2Z" />,
  "Muscular": <path d="M12 2C8 2 6 4 6 6C6 8 8 9 9 11C10 13 10 16 10 22H14C14 16 14 13 15 11C16 9 18 8 18 6C18 4 16 2 12 2Z" />,
  "Petite": <path d="M12 3C10.5 3 9.5 4.5 9.5 6C9.5 7.5 10 9.5 10.5 11.5C11 13.5 11 16 11 22H13C13 16 13 13.5 13.5 11.5C14 9.5 14.5 7.5 14.5 6C14.5 4.5 13.5 3 12 3Z" />,
};

// ============ Main Component ============

export function PhysiqueSelector() {
  // Get state directly from Zustand store
  const bodyType = useCastingFormStore((state) => state.prefs.bodyType);
  const updatePref = useCastingFormStore((state) => state.updatePref);

  return (
    <div className="space-y-2 pt-1">
      <div className="grid grid-cols-3 gap-2">
        {BODY_TYPES.map((opt) => {
          const isSelected = bodyType === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => updatePref('bodyType', opt.value)}
              className={`
                relative flex flex-col items-center justify-center aspect-[4/3] rounded-lg border transition-all duration-300 group
                ${isSelected
                  ? 'border-white bg-slate-accent shadow-[0_0_15px_rgba(255,255,255,0.1)] z-10'
                  : 'border-gray-200 bg-gray-50/40 text-subtle hover:bg-slate-accent hover:text-gray-700 hover:border-slate-accent'
                }
              `}
            >
              <div className={`mb-2 transition-transform duration-300 ${isSelected ? 'text-obsidian scale-110' : 'text-current group-hover:scale-105'}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill={isSelected ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isSelected ? "0" : "1.5"}>
                  {BODY_ICONS[opt.value]}
                </svg>
              </div>
              <span className={`text-[10px] font-medium ${isSelected ? 'text-obsidian' : 'text-current'}`}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PhysiqueSelector;
