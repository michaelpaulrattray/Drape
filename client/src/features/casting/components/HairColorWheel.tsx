import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ColorOption {
  label: string;
  hex: string;
}

const NATURAL_COLORS: ColorOption[] = [
  { label: "Jet Black", hex: "#090806" }, { label: "Off Black", hex: "#2C222B" },
  { label: "Dark Brown", hex: "#3B3024" }, { label: "Med. Brown", hex: "#504433" },
  { label: "Light Brown", hex: "#6A5742" }, { label: "Auburn", hex: "#6A3E31" },
  { label: "Copper", hex: "#9F5A47" }, { label: "Strawberry", hex: "#B57B58" },
  { label: "Dark Blonde", hex: "#9D8461" }, { label: "Golden Blonde", hex: "#D8B880" },
  { label: "Ash Blonde", hex: "#C7C2AB" }, { label: "Platinum", hex: "#EBEBE1" },
  { label: "White", hex: "#FFFFFF" }, { label: "Silver", hex: "#A8A9AD" },
  { label: "Salt & Pepper", hex: "#595959" }, { label: "Grey", hex: "#808080" },
];

const DYED_COLORS: ColorOption[] = [
  { label: "Silver", hex: "#C0C0C0" }, { label: "Platinum", hex: "#E5E4E2" },
  { label: "Pearl", hex: "#FDEEF4" }, { label: "Pastel Pink", hex: "#FFD1DC" },
  { label: "Hot Pink", hex: "#FF69B4" }, { label: "Magenta", hex: "#FF00FF" },
  { label: "Purple", hex: "#800080" }, { label: "Violet", hex: "#EE82EE" },
  { label: "Lilac", hex: "#C8A2C8" }, { label: "Indigo", hex: "#4B0082" },
  { label: "Blue", hex: "#0000FF" }, { label: "Teal", hex: "#008080" },
  { label: "Mint", hex: "#98FF98" }, { label: "Emerald", hex: "#50C878" },
  { label: "Green", hex: "#008000" }, { label: "Lime", hex: "#BFFF00" },
  { label: "Yellow", hex: "#FFFF00" }, { label: "Orange", hex: "#FFA500" },
  { label: "Peach", hex: "#FFDAB9" }, { label: "Coral", hex: "#FF7F50" },
  { label: "Red", hex: "#FF0000" }, { label: "Burgundy", hex: "#800020" },
];

interface HairColorWheelProps {
  currentColor: string;
  onColorSelect: (color: string) => void;
}

const HairColorWheel: React.FC<HairColorWheelProps> = ({ currentColor, onColorSelect }) => {
  const [activeTab, setActiveTab] = useState<'Dyed' | 'Natural'>('Dyed');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [tone, setTone] = useState<'Warm' | 'Neutral' | 'Cool'>('Neutral');
  const [isDragging, setIsDragging] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);

  // Track whether the last change originated from this component's own selection
  // to prevent the sync-from-prop effect from re-triggering after commitSelection
  const isInternalChange = useRef(false);

  const colors = activeTab === 'Dyed' ? DYED_COLORS : NATURAL_COLORS;
  const segmentAngle = 360 / colors.length;

  // Sync internal state FROM the parent prop (external changes only)
  useEffect(() => {
    // Skip if the change came from our own commitSelection
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }

    const lower = currentColor.toLowerCase();
    const cleanName = currentColor.replace(/^(Warm|Cool \/ Ash)\s+/i, '').trim();
    let targetTab = activeTab;

    const currentTabColors = activeTab === 'Dyed' ? DYED_COLORS : NATURAL_COLORS;
    const existsInCurrent = currentTabColors.some(c => cleanName.toLowerCase().includes(c.label.toLowerCase()));

    if (!existsInCurrent) {
      const otherTab = activeTab === 'Dyed' ? 'Natural' : 'Dyed';
      const otherTabColors = otherTab === 'Dyed' ? DYED_COLORS : NATURAL_COLORS;
      const existsInOther = otherTabColors.some(c => cleanName.toLowerCase().includes(c.label.toLowerCase()));

      if (existsInOther) {
        targetTab = otherTab;
      } else {
        const isNatural = NATURAL_COLORS.some(c => cleanName.toLowerCase().includes(c.label.toLowerCase()));
        targetTab = isNatural ? 'Natural' : 'Dyed';
      }
    }

    let targetTone: 'Warm' | 'Neutral' | 'Cool' = 'Neutral';
    if (lower.startsWith('warm')) targetTone = 'Warm';
    else if (lower.startsWith('cool') || lower.includes('ash')) targetTone = 'Cool';

    const targetColors = targetTab === 'Dyed' ? DYED_COLORS : NATURAL_COLORS;
    const foundIndex = targetColors.findIndex(c =>
      cleanName.toLowerCase().includes(c.label.toLowerCase())
    );

    if (targetTab !== activeTab) setActiveTab(targetTab);
    setTone(targetTone);
    if (foundIndex !== -1) setSelectedIndex(foundIndex);
  }, [currentColor]); // eslint-disable-line react-hooks/exhaustive-deps

  const commitSelection = useCallback(() => {
    const color = colors[selectedIndex];
    if (!color) return;

    let finalString = color.label;
    if (tone === 'Warm') {
      finalString = `Warm ${color.label}`;
    } else if (tone === 'Cool') {
      finalString = `Cool / Ash ${color.label}`;
    }

    if (finalString !== currentColor) {
      isInternalChange.current = true;
      onColorSelect(finalString);
    }
  }, [colors, selectedIndex, tone, onColorSelect, currentColor]);

  useEffect(() => {
    if (!isDragging) {
      commitSelection();
    }
  }, [selectedIndex, tone, activeTab, isDragging, commitSelection]);

  const handleWheelInteraction = (clientX: number, clientY: number) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    angle += 90;
    if (angle < 0) angle += 360;

    const rawIndex = Math.round(angle / segmentAngle);
    const normalizedIndex = rawIndex % colors.length;

    setSelectedIndex(normalizedIndex);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handleWheelInteraction(e.clientX, e.clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleWheelInteraction(e.clientX, e.clientY);
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, colors.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentSelection = colors[selectedIndex] || colors[0];

  const renderWheel = () => {
    const radius = 120;
    const innerRadius = 80;
    const center = 160;

    return (
      <svg viewBox="0 0 320 320" className="w-full h-full drop-shadow-lg">
        {colors.map((color, i) => {
          const startAngle = (i * segmentAngle) - 90 - (segmentAngle / 2);
          const endAngle = ((i + 1) * segmentAngle) - 90 - (segmentAngle / 2);

          const x1 = center + radius * Math.cos(Math.PI * startAngle / 180);
          const y1 = center + radius * Math.sin(Math.PI * startAngle / 180);
          const x2 = center + radius * Math.cos(Math.PI * endAngle / 180);
          const y2 = center + radius * Math.sin(Math.PI * endAngle / 180);

          const x3 = center + innerRadius * Math.cos(Math.PI * endAngle / 180);
          const y3 = center + innerRadius * Math.sin(Math.PI * endAngle / 180);
          const x4 = center + innerRadius * Math.cos(Math.PI * startAngle / 180);
          const y4 = center + innerRadius * Math.sin(Math.PI * startAngle / 180);

          const labelR = radius + 25;
          const midAngle = (startAngle + endAngle) / 2;
          const lx = center + labelR * Math.cos(Math.PI * midAngle / 180);
          const ly = center + labelR * Math.sin(Math.PI * midAngle / 180);

          const isSelected = i === selectedIndex;
          const showLabel = isSelected || colors.length < 12 || i % 2 === 0;

          return (
            <g key={color.label}>
              <path
                d={`M ${x4} ${y4} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 0 0 ${x4} ${y4} Z`}
                fill={color.hex}
                stroke={isSelected ? "#1a1a1a" : "rgba(0,0,0,0.05)"}
                strokeWidth={isSelected ? 2 : 1}
                className="transition-all duration-200"
              />
              {showLabel && (
                <text
                  x={lx}
                  y={ly}
                  fill={isSelected ? "#1a1a1a" : "#666"}
                  fontSize={isSelected ? "11" : "9"}
                  fontWeight={isSelected ? "bold" : "normal"}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  className="pointer-events-none transition-all duration-300"
                >
                  {color.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Selection Puck */}
        {(() => {
          const angle = (selectedIndex * segmentAngle) - 90;
          const r = (radius + innerRadius) / 2;
          const px = center + r * Math.cos(Math.PI * angle / 180);
          const py = center + r * Math.sin(Math.PI * angle / 180);

          return (
            <g className="transition-all duration-300 ease-out" style={{ transformOrigin: 'center' }}>
              <circle cx={px} cy={py} r="14" fill="white" stroke="rgba(0,0,0,0.1)" strokeWidth="1" className="drop-shadow-md" />
              <circle cx={px} cy={py} r="10" fill={currentSelection.hex} />
            </g>
          );
        })()}
      </svg>
    );
  };

  return (
    <div className="w-full flex flex-col space-y-4 select-none">
      {/* Tabs */}
      <div className="flex justify-center">
        <div className="bg-[#F5F3F0] border border-[rgba(0,0,0,0.05)] p-0.5 rounded-full flex relative">
          <button
            onClick={() => setActiveTab('Dyed')}
            className={`px-8 py-2 rounded-full text-[12px] font-medium tracking-wide transition-all duration-300 ${activeTab === 'Dyed' ? 'bg-[#1a1a1a] text-white shadow-sm' : 'text-[#52524B] hover:text-[#555]'}`}
          >
            Dyed
          </button>
          <button
            onClick={() => setActiveTab('Natural')}
            className={`px-8 py-2 rounded-full text-[12px] font-medium tracking-wide transition-all duration-300 ${activeTab === 'Natural' ? 'bg-[#1a1a1a] text-white shadow-sm' : 'text-[#52524B] hover:text-[#555]'}`}
          >
            Natural
          </button>
        </div>
      </div>

      {/* The Wheel */}
      <div
        className="relative w-full aspect-square p-2 cursor-crosshair touch-none"
        ref={wheelRef}
        onMouseDown={handleMouseDown}
      >
        {renderWheel()}
      </div>

      {/* Tone Controls */}
      <div className="space-y-3 pt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
        <div className="flex items-center">
          <span style={{ fontSize: 11, fontWeight: 500, color: '#52524B' }}>
            Tone
          </span>
        </div>

        <div className="flex bg-[#F5F3F0] p-0.5 rounded border border-[rgba(0,0,0,0.05)]">
          {['Warm', 'Neutral', 'Cool'].map((t) => (
            <button
              key={t}
              onClick={() => setTone(t as 'Warm' | 'Neutral' | 'Cool')}
              className={`flex-1 py-1.5 rounded-sm text-[11px] font-medium tracking-wide transition-all ${tone === t ? 'bg-[#1a1a1a] text-white shadow-sm' : 'text-[#52524B] hover:text-[#555]'}`}
            >
              {t === 'Cool' ? 'Cool / Ash' : t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HairColorWheel;
