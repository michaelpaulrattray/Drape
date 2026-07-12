import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

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

  // E1b root cause (found at R6 C1): never auto-commit before the user touches
  // the wheel. When the hydrated color doesn't parse into the lists (unset →
  // the "Natural" fallback, or a D-41 Open state), the mount-time commit
  // rebuilt a DIFFERENT string (Dyed[0] → "Silver") and wrote it to prefs just
  // after hydration — the phantom hairColor diff that raised the D-11 ceremony
  // on zero-edit saves.
  const hasInteracted = useRef(false);

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
    if (!isDragging && hasInteracted.current) {
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
    hasInteracted.current = true;
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
  const toneQualifier = tone === 'Warm' ? 'Warm' : tone === 'Cool' ? 'Cool / ash' : null;

  const renderWheel = () => {
    const radius = 120;
    const innerRadius = 80;
    const center = 160;

    return (
      <svg viewBox="0 0 320 320" className="w-full h-full">
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
                stroke={isSelected ? "var(--color-canvas-ink)" : "var(--color-canvas-border)"}
                strokeWidth={isSelected ? 1.5 : 0.5}
                className="transition-all duration-200"
              />
              {showLabel && (
                <text
                  x={lx}
                  y={ly}
                  fill={isSelected ? "var(--color-canvas-ink)" : "var(--color-canvas-ink-soft)"}
                  fontSize={isSelected ? "11" : "9"}
                  fontWeight={isSelected ? "500" : "normal"}
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

        {/* Center readout (DS §13.4) */}
        <text
          x={center}
          y={toneQualifier ? center - 4 : center}
          fill="var(--color-canvas-ink)"
          fontSize="12"
          fontWeight="500"
          textAnchor="middle"
          alignmentBaseline="middle"
          className="pointer-events-none"
        >
          {currentSelection.label}
        </text>
        {toneQualifier && (
          <text
            x={center}
            y={center + 12}
            fill="var(--color-canvas-ink-faint)"
            fontSize="10"
            textAnchor="middle"
            alignmentBaseline="middle"
            className="pointer-events-none"
          >
            {toneQualifier}
          </text>
        )}

        {/* Selection Puck */}
        {(() => {
          const angle = (selectedIndex * segmentAngle) - 90;
          const r = (radius + innerRadius) / 2;
          const px = center + r * Math.cos(Math.PI * angle / 180);
          const py = center + r * Math.sin(Math.PI * angle / 180);

          return (
            <g className="transition-all duration-300 ease-out" style={{ transformOrigin: 'center' }}>
              <circle cx={px} cy={py} r="14" fill="var(--color-canvas-surface)" stroke="var(--color-canvas-border-strong)" strokeWidth="1" />
              <circle cx={px} cy={py} r="10" fill={currentSelection.hex} />
            </g>
          );
        })()}
      </svg>
    );
  };

  return (
    <div className="w-full flex flex-col space-y-4 select-none">
      {/* Dyed/Natural — underline tabs (studio pattern, §6) */}
      <div className="flex justify-center gap-6 border-b-hairline border-canvas-border">
        {(['Dyed', 'Natural'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { hasInteracted.current = true; setActiveTab(tab); }}
            className={cn(
              "px-2 pb-2 text-canvas-md transition-colors -mb-px border-b",
              activeTab === tab
                ? "text-canvas-ink font-medium border-canvas-ink"
                : "text-canvas-ink-soft border-transparent hover:text-canvas-ink",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* The Wheel */}
      <div
        className="relative w-full aspect-square p-2 cursor-crosshair touch-none rounded-canvas-md bg-canvas-surface-inset border-hairline border-canvas-border"
        ref={wheelRef}
        onMouseDown={handleMouseDown}
      >
        {renderWheel()}
      </div>

      {/* Tone Controls — segmented control (§6.1 pattern) */}
      <div className="space-y-3 pt-2 border-t-hairline border-canvas-border">
        <div className="flex items-center">
          <span className="text-canvas-xs font-medium text-canvas-ink-soft">Tone</span>
        </div>

        <div className="flex p-0.5 rounded-canvas-md bg-canvas-surface-inset border-hairline border-canvas-border">
          {['Warm', 'Neutral', 'Cool'].map((t) => (
            <button
              key={t}
              onClick={() => { hasInteracted.current = true; setTone(t as 'Warm' | 'Neutral' | 'Cool'); }}
              className={cn(
                "flex-1 py-1.5 rounded-canvas-sm text-canvas-sm transition-colors",
                tone === t
                  ? "bg-canvas-surface border-hairline border-canvas-ink text-canvas-ink font-medium"
                  : "text-canvas-ink-soft hover:text-canvas-ink",
              )}
            >
              {t === 'Cool' ? 'Cool / ash' : t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HairColorWheel;
