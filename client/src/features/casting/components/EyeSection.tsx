import { EYE_PRESETS } from "@/features/casting/constants";
import { useCastingFormStore } from "@/features/casting/stores/useCastingFormStore";

// ============ Types ============

interface EyePreset {
  label: string;
  hex: string;
  image?: string;
}

// ============ Sub-Components ============

function VisualEyeGrid({
  options,
  selected,
  onSelect,
}: {
  options: EyePreset[];
  selected: string;
  onSelect: (val: string) => void;
}) {
  // Split options into 2 rows
  const midPoint = Math.ceil(options.length / 2);
  const row1 = options.slice(0, midPoint);
  const row2 = options.slice(midPoint);

  const renderOption = (opt: EyePreset) => {
    const isSelected = selected === opt.label;
    return (
      <button
        key={opt.label}
        onClick={() => onSelect(opt.label)}
        className={`
          relative flex-shrink-0 w-16 h-16 rounded-full transition-all duration-200 group overflow-hidden
          ${isSelected
            ? 'ring-2 ring-[#0A0A0A] ring-offset-2 scale-105 z-10'
            : 'hover:scale-105 opacity-80 hover:opacity-100'
          }
        `}
        title={opt.label}
      >
        {opt.image ? (
          <img
            src={opt.image}
            alt={opt.label}
            className="absolute inset-0 w-full h-full object-cover rounded-full pointer-events-none"
            draggable={false}
          />
        ) : (
          <>
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: `radial-gradient(circle at 35% 35%, ${opt.hex} 0%, #2a2a2a 80%)` }}
            />
            <div className="absolute top-[25%] left-[25%] w-[15%] h-[15%] bg-white rounded-full blur-[1px] opacity-60" />
          </>
        )}
      </button>
    );
  };

  return (
    <div className="relative -mx-2">
      {/* Left fade indicator */}
      <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
      {/* Right fade indicator */}
      <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
      
      <div 
        className="overflow-hidden px-2 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={(e) => {
          e.preventDefault();
          const container = e.currentTarget;
          const startX = e.pageX - container.offsetLeft;
          const scrollLeft = container.scrollLeft;
          
          const handleMouseMove = (moveEvent: MouseEvent) => {
            moveEvent.preventDefault();
            const x = moveEvent.pageX - container.offsetLeft;
            const walk = (x - startX) * 2;
            container.scrollLeft = scrollLeft - walk;
          };
          
          const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };
          
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        }}
        style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="flex flex-col gap-2 min-w-max py-1">
          <div className="flex gap-2">
            {row1.map(renderOption)}
          </div>
          <div className="flex gap-2">
            {row2.map(renderOption)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Main Component ============

export function EyeSection() {
  // Get state directly from Zustand store
  const eyeColor = useCastingFormStore((state) => state.prefs.eyeColor);
  const updatePref = useCastingFormStore((state) => state.updatePref);

  return (
    <div className="space-y-2 pt-1">
      <label className="text-xs font-medium text-[#757575] block">Eye Color</label>
      <VisualEyeGrid
        options={EYE_PRESETS}
        selected={eyeColor || ""}
        onSelect={(val) => updatePref('eyeColor', val)}
      />
    </div>
  );
}

export default EyeSection;
