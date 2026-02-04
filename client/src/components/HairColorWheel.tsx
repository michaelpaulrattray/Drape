import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ColorOption {
  label: string;
  hex: string;
}

// --- DATA DEFINITIONS ---

const NATURAL_COLORS: ColorOption[] = [
  { label: "Jet Black", hex: "#090806" },
  { label: "Off Black", hex: "#2C222B" },
  { label: "Dark Brown", hex: "#3B3024" },
  { label: "Med. Brown", hex: "#504433" },
  { label: "Light Brown", hex: "#6A5742" },
  { label: "Auburn", hex: "#6A3E31" },
  { label: "Copper", hex: "#9F5A47" },
  { label: "Strawberry", hex: "#B57B58" },
  { label: "Dark Blonde", hex: "#9D8461" },
  { label: "Golden Blonde", hex: "#D8B880" },
  { label: "Ash Blonde", hex: "#C7C2AB" },
  { label: "Platinum", hex: "#EBEBE1" },
  { label: "White", hex: "#FFFFFF" },
  { label: "Silver", hex: "#A8A9AD" },
  { label: "Salt & Pepper", hex: "#595959" },
  { label: "Grey", hex: "#808080" },
];

const DYED_COLORS: ColorOption[] = [
  { label: "Silver", hex: "#C0C0C0" },
  { label: "Platinum", hex: "#E5E4E2" },
  { label: "Pearl", hex: "#FDEEF4" },
  { label: "Pastel Pink", hex: "#FFD1DC" },
  { label: "Hot Pink", hex: "#FF69B4" },
  { label: "Magenta", hex: "#FF00FF" },
  { label: "Purple", hex: "#800080" },
  { label: "Violet", hex: "#EE82EE" },
  { label: "Lilac", hex: "#C8A2C8" },
  { label: "Indigo", hex: "#4B0082" },
  { label: "Blue", hex: "#0000FF" },
  { label: "Teal", hex: "#008080" },
  { label: "Mint", hex: "#98FF98" },
  { label: "Emerald", hex: "#50C878" },
  { label: "Green", hex: "#008000" },
  { label: "Lime", hex: "#BFFF00" },
  { label: "Yellow", hex: "#FFFF00" },
  { label: "Orange", hex: "#FFA500" },
  { label: "Peach", hex: "#FFDAB9" },
  { label: "Coral", hex: "#FF7F50" },
  { label: "Red", hex: "#FF0000" },
  { label: "Burgundy", hex: "#800020" },
];

interface HairColorWheelProps {
  currentColor: string; // The raw string from prefs
  onColorSelect: (color: string) => void;
}

const HairColorWheel: React.FC<HairColorWheelProps> = ({ currentColor, onColorSelect }) => {
  // State
  const [activeTab, setActiveTab] = useState<'Dyed' | 'Natural'>('Dyed');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [tone, setTone] = useState<'Warm' | 'Neutral' | 'Cool'>('Neutral');
  const [isDragging, setIsDragging] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);

  // Derived Data
  const colors = activeTab === 'Dyed' ? DYED_COLORS : NATURAL_COLORS;
  const segmentAngle = 360 / colors.length;

  // Track if we've initialized from the prop
  const initializedRef = useRef(false);
  const lastExternalColorRef = useRef(currentColor);

  // Initialize state from currentColor prop - only when prop changes externally
  useEffect(() => {
    // Skip if this is the same color we just set internally
    if (currentColor === lastExternalColorRef.current && initializedRef.current) {
      return;
    }
    
    // Skip empty colors
    if (!currentColor) {
      initializedRef.current = true;
      return;
    }

    const lower = currentColor.toLowerCase();
    // Clean the name by removing tone prefixes we might have added
    const cleanName = currentColor.replace(/^(Warm|Cool \/ Ash)\s+/i, '').trim();

    // Resolve which tab the new color belongs to.
    // First check Natural colors (more common for initial values)
    const isNatural = NATURAL_COLORS.some(c => cleanName.toLowerCase().includes(c.label.toLowerCase()));
    const isDyed = DYED_COLORS.some(c => cleanName.toLowerCase().includes(c.label.toLowerCase()));
    
    let targetTab: 'Dyed' | 'Natural' = 'Natural'; // Default to Natural
    if (isDyed && !isNatural) {
      targetTab = 'Dyed';
    } else if (isNatural) {
      targetTab = 'Natural';
    }
    
    // 2. Determine Tone (Replaces Intensity)
    let targetTone: 'Warm' | 'Neutral' | 'Cool' = 'Neutral';
    if (lower.startsWith('warm')) targetTone = 'Warm';
    else if (lower.startsWith('cool') || lower.includes('ash')) targetTone = 'Cool';
    
    // 3. Determine Index using the TARGET tab's colors
    const targetColors = targetTab === 'Dyed' ? DYED_COLORS : NATURAL_COLORS;
    const foundIndex = targetColors.findIndex(c => 
      cleanName.toLowerCase().includes(c.label.toLowerCase())
    );
    
    // Update refs before state changes
    lastExternalColorRef.current = currentColor;
    initializedRef.current = true;
    
    // Batch updates - only update if different
    setActiveTab(prev => prev !== targetTab ? targetTab : prev);
    setTone(prev => prev !== targetTone ? targetTone : prev);
    if (foundIndex !== -1) {
      setSelectedIndex(prev => prev !== foundIndex ? foundIndex : prev);
    }
  }, [currentColor]); // Only react to external color changes

  // Update parent when selection changes
  const commitSelection = useCallback(() => {
    const color = colors[selectedIndex];
    if (!color) return;

    let finalString = color.label;
    if (tone === 'Warm') {
        finalString = `Warm ${color.label}`;
    } else if (tone === 'Cool') {
        finalString = `Cool / Ash ${color.label}`;
    }
    
    // Only fire if different to avoid cycle
    if (finalString !== currentColor) {
        // Update ref BEFORE calling onColorSelect to prevent re-initialization
        lastExternalColorRef.current = finalString;
        onColorSelect(finalString);
    }
  }, [colors, selectedIndex, tone, onColorSelect, currentColor]);

  // Track if user is interacting (to avoid committing during initialization)
  const userInteractedRef = useRef(false);

  // Trigger commit on interaction end or click - but only after user interaction
  useEffect(() => {
     if (!isDragging && userInteractedRef.current) {
         commitSelection();
     }
  }, [selectedIndex, tone, activeTab, isDragging, commitSelection]);


  // --- INTERACTION HANDLERS ---

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
    userInteractedRef.current = true;
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
  }, [isDragging, colors.length]);

  const currentSelection = colors[selectedIndex] || colors[0];

  const renderWheel = () => {
    const radius = 120;
    const innerRadius = 80;
    const center = 160; 

    return (
        <svg viewBox="0 0 320 320" className="w-full h-full drop-shadow-2xl">
            <defs>
                 <filter id="inner-glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feComposite in="SourceGraphic" in2="coloredBlur" operator="in"/>
                 </filter>
            </defs>
            {colors.map((color, i) => {
                const startAngle = (i * segmentAngle) - 90 - (segmentAngle/2);
                const endAngle = ((i + 1) * segmentAngle) - 90 - (segmentAngle/2);
                
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
                            stroke={isSelected ? "white" : "rgba(255,255,255,0.1)"}
                            strokeWidth={isSelected ? 2 : 1}
                            className="transition-all duration-200"
                        />
                        {showLabel && (
                            <text 
                                x={lx} 
                                y={ly} 
                                fill={isSelected ? "white" : "#666"}
                                fontSize={isSelected ? "11" : "9"}
                                fontWeight={isSelected ? "bold" : "normal"}
                                textAnchor="middle" 
                                alignmentBaseline="middle"
                                className="font-mono uppercase tracking-wide pointer-events-none transition-all duration-300"
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
                        <circle cx={px} cy={py} r="14" fill="white" stroke="rgba(0,0,0,0.5)" strokeWidth="4" className="drop-shadow-lg" />
                        <circle cx={px} cy={py} r="10" fill={currentSelection.hex} />
                        
                        <g transform={`translate(${px}, ${py - 30})`}>
                           <rect x="-60" y="-22" width="120" height="24" rx="4" fill="white" className="drop-shadow-md" stroke="#d1d5db" />
                           <text x="0" y="-6" textAnchor="middle" fill="#1a1a1a" fontSize="10" fontWeight="bold" className="font-mono uppercase tracking-wide">
                              {currentSelection.label}
                           </text>
                           <path d="M -5 2 L 0 7 L 5 2 Z" fill="white" />
                        </g>
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
             <div className="bg-gray-100 border border-gray-200 p-0.5 rounded-full flex relative">
                  <button
                    onClick={() => { userInteractedRef.current = true; setActiveTab('Dyed'); }}
                    className={`px-8 py-2 rounded-full text-[10px] uppercase font-mono tracking-widest transition-all duration-300 ${activeTab === 'Dyed' ? 'bg-slate-accent text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Dyed
                  </button>
                  <button
                    onClick={() => { userInteractedRef.current = true; setActiveTab('Natural'); }}
                    className={`px-8 py-2 rounded-full text-[10px] uppercase font-mono tracking-widest transition-all duration-300 ${activeTab === 'Natural' ? 'bg-slate-accent text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
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

        {/* Swatches */}
        <div className="overflow-x-auto no-scrollbar pb-2">
            <div className="flex space-x-2.5 px-1">
                {colors.map((c, i) => (
                    <button
                        key={c.label}
                        onClick={() => { userInteractedRef.current = true; setSelectedIndex(i); }}
                        className={`flex flex-col items-center space-y-1 group min-w-[40px]`}
                    >
                        <div className={`w-8 h-8 rounded-full border transition-all duration-200 ${selectedIndex === i ? 'border-slate-accent scale-110 ring-2 ring-slate-accent/30' : 'border-gray-300 group-hover:border-slate-accent'}`} style={{ backgroundColor: c.hex }}>
                            {selectedIndex === i && (
                                <div className="w-full h-full flex items-center justify-center">
                                     <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={(['#FFFFFF', '#EBEBE1', '#FDEEF4', '#E5E4E2'].includes(c.hex)) ? 'black' : 'white'} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                            )}
                        </div>
                        <span className={`text-[8px] font-mono uppercase tracking-tight w-full text-center truncate ${selectedIndex === i ? 'text-obsidian font-bold' : 'text-gray-500'}`}>
                            {c.label.split(' ')[0]}
                        </span>
                    </button>
                ))}
            </div>
        </div>

        {/* Tone Controls (Replaces Intensity) */}
        <div className="space-y-3 pt-2 border-t border-gray-200">
            <div className="flex justify-between items-center">
                 <span className="text-[9px] font-mono uppercase text-gray-500 tracking-wider">
                    Tone
                 </span>
                 <span className="text-[9px] font-mono text-obsidian tracking-widest uppercase">{tone === 'Cool' ? 'Cool (Ash)' : tone}</span>
            </div>
            
            <div className="flex bg-gray-100 p-0.5 rounded border border-gray-200">
                {['Warm', 'Neutral', 'Cool'].map((t) => (
                    <button
                        key={t}
                        onClick={() => { userInteractedRef.current = true; setTone(t as any); }}
                        className={`flex-1 py-1.5 rounded-sm text-[9px] font-mono uppercase tracking-widest transition-all ${tone === t ? 'bg-slate-accent text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
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