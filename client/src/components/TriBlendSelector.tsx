import React, { useRef, useState, useMemo } from 'react';
import Tooltip from './Tooltip';

interface TriBlendSelectorProps {
  value: { editorial: number; commercial: number; runway: number };
  onChange: (value: { editorial: number; commercial: number; runway: number }) => void;
}

// --- GEOMETRY CONSTANTS ---
const WIDTH = 280;
const HEIGHT = 240; 
const PADDING_TOP = 25;
const PADDING_BOTTOM = 25;
const PADDING_X = 25;

// Triangle Vertices
const A = { x: WIDTH / 2, y: PADDING_TOP }; // Top (Editorial)
const B = { x: PADDING_X, y: HEIGHT - PADDING_BOTTOM }; // Left (Commercial)
const C = { x: WIDTH - PADDING_X, y: HEIGHT - PADDING_BOTTOM }; // Right (Runway)

// --- GEOMETRY HELPERS ---

type Point = { x: number, y: number };

// Squared distance between two points
const dist2 = (p1: Point, p2: Point) => (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;

// Find closest point on a line segment AB to point P
const getClosestPointOnSegment = (p: Point, a: Point, b: Point): Point => {
    const atob = { x: b.x - a.x, y: b.y - a.y };
    const atop = { x: p.x - a.x, y: p.y - a.y };
    const len2 = atob.x * atob.x + atob.y * atob.y;
    let t = (atop.x * atob.x + atop.y * atob.y) / len2;
    // Clamp t to segment [0, 1]
    t = Math.max(0, Math.min(1, t));
    return { x: a.x + t * atob.x, y: a.y + t * atob.y };
};

// Barycentric weights from XY
const getWeightsFromXY = (x: number, y: number) => {
    const denominator = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
    const u = ((B.y - C.y) * (x - C.x) + (C.x - B.x) * (y - C.y)) / denominator;
    const v = ((C.y - A.y) * (x - C.x) + (A.x - C.x) * (y - C.y)) / denominator;
    const w = 1 - u - v;
    return { u, v, w };
};

// XY from Barycentric weights
const getXYFromWeights = (u: number, v: number, w: number) => {
    return {
      x: u * A.x + v * B.x + w * C.x,
      y: u * A.y + v * B.y + w * C.y
    };
};

const PRESETS = [
    { label: "Commercial", w: { editorial: 0, commercial: 1, runway: 0 } },
    { label: "Editorial", w: { editorial: 1, commercial: 0, runway: 0 } },
    { label: "Runway", w: { editorial: 0, commercial: 0, runway: 1 } },
    { label: "Balanced", w: { editorial: 0.33, commercial: 0.33, runway: 0.33 } },
    { label: "Comm + Edit", w: { editorial: 0.5, commercial: 0.5, runway: 0 } },
    { label: "Edit + Run", w: { editorial: 0.5, commercial: 0, runway: 0.5 } },
];

const TriBlendSelector: React.FC<TriBlendSelectorProps> = ({ value, onChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleInteraction = (e: React.PointerEvent) => {
    const el = containerRef.current;
    if (!el) return;

    // 1. Get exact visual bounds
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // 2. Calculate cursor position relative to the container's top-left
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 3. Scale to internal SVG coordinate space (280x240)
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const p = { x: x * scaleX, y: y * scaleY };

    // 4. Geometric Projection (Stick to Triangle)
    let { u, v, w } = getWeightsFromXY(p.x, p.y);
    
    // If outside triangle (any weight negative), project to closest edge physically
    if (u < 0 || v < 0 || w < 0) {
        const pAB = getClosestPointOnSegment(p, A, B);
        const pBC = getClosestPointOnSegment(p, B, C);
        const pCA = getClosestPointOnSegment(p, C, A);

        const dAB = dist2(p, pAB);
        const dBC = dist2(p, pBC);
        const dCA = dist2(p, pCA);

        let bestP = pAB;
        let minD = dAB;

        if (dBC < minD) { bestP = pBC; minD = dBC; }
        if (dCA < minD) { bestP = pCA; minD = dCA; }

        const newWeights = getWeightsFromXY(bestP.x, bestP.y);
        u = newWeights.u;
        v = newWeights.v;
        w = newWeights.w;
    }

    // 5. Corner Snap (High Confidence only)
    if (u > 0.96) { u = 1; v = 0; w = 0; }
    else if (v > 0.96) { u = 0; v = 1; w = 0; }
    else if (w > 0.96) { u = 0; v = 0; w = 1; }

    // Final safety clamp & normalize
    u = Math.max(0, Math.min(1, u));
    v = Math.max(0, Math.min(1, v));
    w = Math.max(0, Math.min(1, w));
    
    const sum = u + v + w;
    if (sum > 0) {
        u /= sum;
        v /= sum;
        w /= sum;
    }

    onChange({ editorial: u, commercial: v, runway: w });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    (e.target as Element).setPointerCapture(e.pointerId);
    handleInteraction(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
        e.preventDefault();
        e.stopPropagation();
        handleInteraction(e);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  // Derived Values
  const pos = getXYFromWeights(value.editorial, value.commercial, value.runway);
  const dominant = useMemo(() => {
    if (value.editorial > 0.5) return "Editorial";
    if (value.commercial > 0.5) return "Commercial";
    if (value.runway > 0.5) return "Runway";
    return "Balanced";
  }, [value]);

  return (
    <div className="w-full bg-white border border-[#0A0A0A]/10 rounded-2xl shadow-sm overflow-hidden select-none">
        {/* 1. Header */}
        <div className="px-5 pt-5 pb-2 flex justify-between items-start">
            <div>
                <h3 className="text-xs font-medium text-[#757575] mb-0.5">Tone & Energy</h3>
                <p className="text-[10px] text-[#757575]/70">Blend between Commercial, Editorial and Runway.</p>
            </div>
            <Tooltip content="Adjust the visual weight of the output. Editorial adds avant-garde distortion. Commercial adds warmth/smile. Runway adds intensity/stare." />
        </div>

        {/* 2. Triangle Surface */}
        <div className="relative w-full flex justify-center py-2 px-4">
            {/* The Main Container: Events attached here */}
            <div 
                ref={containerRef}
                className="relative w-full max-w-[280px] cursor-crosshair touch-none" 
                style={{ aspectRatio: '280/240' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >
                {/* Labels */}
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-[#757575] uppercase tracking-wider pointer-events-none z-10">Editorial</span>
                <span className="absolute bottom-2 -left-2 text-[9px] font-semibold text-[#757575] uppercase tracking-wider pointer-events-none z-10">Commercial</span>
                <span className="absolute bottom-2 -right-2 text-[9px] font-semibold text-[#757575] uppercase tracking-wider pointer-events-none z-10">Runway</span>

                {/* VISUAL LAYER (SVG) - Background */}
                <svg 
                    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                    preserveAspectRatio="none"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                >
                    <defs>
                        <linearGradient id="tri-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#EBEBEB" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="#F5F5F5" stopOpacity="0.4" />
                        </linearGradient>
                    </defs>

                    {/* Triangle Base */}
                    <path 
                        d={`M${A.x},${A.y} L${B.x},${B.y} L${C.x},${C.y} Z`} 
                        fill="url(#tri-grad)" 
                        stroke="#0A0A0A" 
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        strokeOpacity="0.15"
                    />

                    {/* Internal Grid (Dashed) */}
                    <g stroke="#0A0A0A" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.1">
                        <line x1={A.x} y1={A.y} x2={(B.x + C.x) / 2} y2={B.y} />
                        <line x1={B.x} y1={B.y} x2={(A.x + C.x) / 2} y2={(A.y + C.y) / 2} />
                        <line x1={C.x} y1={C.y} x2={(A.x + B.x) / 2} y2={(A.y + B.y) / 2} />
                    </g>

                    {/* Live Connectors */}
                    {isDragging && (
                        <g stroke="#0A0A0A" strokeWidth="0.5" opacity="0.25">
                            <line x1={pos.x} y1={pos.y} x2={A.x} y2={A.y} />
                            <line x1={pos.x} y1={pos.y} x2={B.x} y2={B.y} />
                            <line x1={pos.x} y1={pos.y} x2={C.x} y2={C.y} />
                        </g>
                    )}
                </svg>

                {/* PUCK LAYER (DOM) - Centered Overlay */}
                <div
                    className={`absolute w-4 h-4 bg-[#0A0A0A] rounded-full pointer-events-none shadow-[0_0_10px_rgba(10,10,10,0.3)] transition-transform duration-75 ease-out ${isDragging ? 'scale-125' : 'scale-100'}`}
                    style={{
                        left: `${(pos.x / WIDTH) * 100}%`,
                        top: `${(pos.y / HEIGHT) * 100}%`,
                        transform: 'translate(-50%, -50%)'
                    }}
                ></div>

            </div>
        </div>

        {/* 3. Readout & Bars */}
        <div className="bg-[#FAFAFA] border-t border-[#0A0A0A]/10 p-5 space-y-4">
            
            <div className="text-center space-y-1">
                <div className="text-xs text-[#0A0A0A]">
                    <span className="text-[#757575] uppercase tracking-wide">Selected: </span>
                    <span className="font-semibold">{dominant}</span>
                    {Math.max(value.editorial, value.commercial, value.runway) > 0.6 && <span className="text-[#757575] text-[10px] ml-1">(Dominant)</span>}
                </div>
                <div className="text-[9px] text-[#757575] tracking-wider">
                    C {Math.round(value.commercial * 100)}% • E {Math.round(value.editorial * 100)}% • R {Math.round(value.runway * 100)}%
                </div>
            </div>

            <div className="space-y-2">
                {[
                    { label: "Commercial", val: value.commercial },
                    { label: "Editorial", val: value.editorial },
                    { label: "Runway", val: value.runway }
                ].map((item) => (
                    <div key={item.label} className="flex items-center space-x-3 text-[10px] uppercase tracking-wide">
                        <span className="w-16 text-[#757575] text-right font-medium">{item.label}</span>
                        <div className="flex-1 h-1.5 bg-[#EBEBEB] rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-[#0A0A0A] transition-all duration-300 ease-out" 
                                style={{ width: `${item.val * 100}%` }}
                            ></div>
                        </div>
                        <span className="w-8 text-[#0A0A0A] text-right font-medium">{Math.round(item.val * 100)}%</span>
                    </div>
                ))}
            </div>
            
            {/* 4. Preset Chips */}
            <div className="pt-2 border-t border-[#0A0A0A]/5 flex flex-wrap gap-2 justify-center">
                {PRESETS.map((p) => {
                    const isActive = Math.abs(p.w.editorial - value.editorial) < 0.05 && 
                                     Math.abs(p.w.commercial - value.commercial) < 0.05 &&
                                     Math.abs(p.w.runway - value.runway) < 0.05;

                    return (
                        <button
                            key={p.label}
                            onClick={() => onChange(p.w)}
                            className={`
                                px-3 py-1.5 rounded-full text-[9px] uppercase tracking-wide border transition-all
                                ${isActive 
                                    ? 'bg-[#0A0A0A] text-white border-[#0A0A0A] shadow-sm font-semibold' 
                                    : 'bg-transparent text-[#757575] border-[#0A0A0A]/10 hover:border-[#0A0A0A]/30 hover:text-[#0A0A0A] font-medium'
                                }
                            `}
                        >
                            {p.label}
                        </button>
                    )
                })}
            </div>
        </div>
    </div>
  );
};

export default TriBlendSelector;
