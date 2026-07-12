import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import Tooltip from '@/components/Tooltip';
import { cn } from '@/lib/utils';
import { chipClass } from './WarmPrimitives';

interface TriBlendSelectorProps {
  value: { editorial: number; commercial: number; runway: number };
  onChange: (value: { editorial: number; commercial: number; runway: number }) => void;
}

// ── Conversion Functions ──────────────────────
function weightsToEdgeHeat(w: { commercial: number; editorial: number; runway: number }): { edge: number; heat: number } {
  const edge = Math.round((1 - w.commercial) * 1000);
  const nonCom = w.editorial + w.runway;
  const heat = nonCom > 0.001 ? Math.round((w.runway / nonCom) * 1000) : 500;
  return { edge, heat };
}

function edgeHeatToWeights(edge: number, heat: number): { commercial: number; editorial: number; runway: number } {
  const a = edge / 1000;
  const b = heat / 1000;
  return {
    commercial: 1 - a,
    editorial: a * (1 - b),
    runway: a * b,
  };
}

// ── Preset Data ───────────────────────────────
// Exported for formatVibe (DS §5.9 chip formatter — nearest preset within
// SNAP_THRESHOLD, else "Custom"); audit F
export const PRESETS = [
  { label: 'Catalogue',   edge: 300, heat: 333, desc: 'E-commerce, lookbook ready' },
  { label: 'Commercial',  edge: 200, heat: 500, desc: 'Clean, sellable, broad appeal' },
  { label: 'High-Com',    edge: 400, heat: 250, desc: 'Premium commercial, editorial polish' },
  { label: 'Balanced',    edge: 660, heat: 500, desc: 'Versatile, all-rounder' },
  { label: 'Street-Ed',   edge: 750, heat: 333, desc: 'Raw editorial with commercial edge' },
  { label: 'Editorial',   edge: 900, heat: 111, desc: 'Moody, narrative, conceptual' },
  { label: 'Avant-Garde', edge: 950, heat: 368, desc: 'Experimental, art-forward' },
  { label: 'Runway',      edge: 900, heat: 889, desc: 'Powerful, commanding, dramatic' },
];

export const SNAP_THRESHOLD = 35;

function findNearestPreset(e: number, h: number) {
  let best = PRESETS[0];
  let bestDist = Infinity;
  for (const p of PRESETS) {
    const dist = Math.sqrt((e - p.edge) ** 2 + (h - p.heat) ** 2);
    if (dist < bestDist) { bestDist = dist; best = p; }
  }
  return bestDist < SNAP_THRESHOLD ? best : null;
}

function getCustomDesc(e: number, h: number): string {
  const edgeWord = e < 250 ? 'Controlled' : e < 450 ? 'Polished' : e < 650 ? 'Expressive' : e < 850 ? 'Bold' : 'Extreme';
  const heatWord = h < 250 ? 'quiet, narrative' : h < 450 ? 'nuanced' : h < 650 ? 'balanced energy' : h < 850 ? 'assertive' : 'intense, commanding';
  return `${edgeWord}, ${heatWord}`;
}

// ── Draggable Slider Hook ─────────────────────
function useSliderDrag(
  trackRef: React.RefObject<HTMLDivElement | null>,
  onValueChange: (val: number) => void
) {
  const dragging = useRef(false);

  const getVal = useCallback((clientX: number) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(pct * 100) * 10;
  }, [trackRef]);

  const onDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    dragging.current = true;
    const touch = 'touches' in e ? e.touches[0] : e;
    onValueChange(getVal(touch.clientX));
  }, [getVal, onValueChange]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) onValueChange(getVal(e.clientX)); };
    const onTouchMove = (e: TouchEvent) => { if (dragging.current) onValueChange(getVal(e.touches[0].clientX)); };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [getVal, onValueChange]);

  return onDown;
}

// ── Slider (DS §13.1: 4px inset track, hairline border, flat ink fill,
//    14px ink thumb with 2px surface border — the ConnectionDot ring trick) ──
const BlendSlider = ({ trackRef, onDrag, pct, endLabels }: {
  trackRef: React.RefObject<HTMLDivElement | null>;
  onDrag: (e: React.MouseEvent | React.TouchEvent) => void;
  pct: number;
  endLabels: [string, string];
}) => (
  <div>
    <div
      ref={trackRef}
      onMouseDown={onDrag}
      onTouchStart={onDrag}
      className="relative h-7 flex items-center cursor-pointer touch-none"
    >
      <div className="w-full h-1 rounded-canvas-pill relative bg-canvas-surface-inset border-hairline border-canvas-border overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-canvas-ink"
          style={{ width: `${pct}%`, transition: 'width 0.12s ease-out' }}
        />
      </div>
      <div
        className="absolute w-3.5 h-3.5 rounded-full bg-canvas-ink cursor-grab z-[3]"
        style={{
          top: '50%',
          left: `${pct}%`,
          transform: 'translate(-50%, -50%)',
          border: '2px solid var(--color-canvas-surface)',
          transition: 'left 0.12s ease-out',
        }}
      />
    </div>
    <div className="flex justify-between mt-1">
      <span className="text-canvas-xs text-canvas-ink-faint">{endLabels[0]}</span>
      <span className="text-canvas-xs text-canvas-ink-faint">{endLabels[1]}</span>
    </div>
  </div>
);

// ── Main Component ────────────────────────────
const TriBlendSelector: React.FC<TriBlendSelectorProps> = ({ value, onChange }) => {
  const [presetsOpen, setPresetsOpen] = useState(false);

  const { edge, heat } = useMemo(() => weightsToEdgeHeat(value), [value]);

  const [edgeInputVal, setEdgeInputVal] = useState(String(edge));
  const [heatInputVal, setHeatInputVal] = useState(String(heat));

  useEffect(() => { setEdgeInputVal(String(edge)); }, [edge]);
  useEffect(() => { setHeatInputVal(String(heat)); }, [heat]);

  const emitChange = useCallback((newEdge: number, newHeat: number) => {
    onChange(edgeHeatToWeights(newEdge, newHeat));
  }, [onChange]);

  const edgeTrackRef = useRef<HTMLDivElement>(null);
  const heatTrackRef = useRef<HTMLDivElement>(null);

  const onEdgeDrag = useSliderDrag(edgeTrackRef, (v) => emitChange(v, heat));
  const onHeatDrag = useSliderDrag(heatTrackRef, (v) => emitChange(edge, v));

  const handleEdgeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEdgeInputVal(e.target.value);
    const v = parseInt(e.target.value);
    if (!isNaN(v)) emitChange(Math.max(0, Math.min(1000, v)), heat);
  };

  const handleHeatInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHeatInputVal(e.target.value);
    const v = parseInt(e.target.value);
    if (!isNaN(v)) emitChange(edge, Math.max(0, Math.min(1000, v)));
  };

  const handleEdgeBlur = () => setEdgeInputVal(String(edge));
  const handleHeatBlur = () => setHeatInputVal(String(heat));

  const activePreset = useMemo(() => findNearestPreset(edge, heat), [edge, heat]);

  const pctEdge = (edge / 1000) * 100;
  const pctHeat = (heat / 1000) * 100;

  const numberInputClass =
    "w-[42px] text-right font-medium text-canvas-lg text-canvas-ink bg-transparent border-none outline-none p-0 pb-px " +
    "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  return (
    // Outer container deleted per DS §13.1 — the host section provides the surface.
    <div className="w-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <span className="text-canvas-md font-medium text-canvas-ink">Tone & energy</span>
          <Tooltip content="Drag the sliders or type a value (0-1000). Tap a preset to snap to a known vibe." />
        </div>
        <span className={cn("text-canvas-xs italic", activePreset ? "text-canvas-ink-soft" : "text-canvas-ink-faint")}>
          {activePreset ? activePreset.label : 'Custom'}
        </span>
      </div>

      {/* EDGE SLIDER */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-canvas-xs font-medium text-canvas-ink-soft">Edge</span>
          <input
            type="number"
            value={edgeInputVal}
            onChange={handleEdgeInput}
            onBlur={handleEdgeBlur}
            min={0} max={1000} step={10}
            className={numberInputClass}
          />
        </div>
        <BlendSlider trackRef={edgeTrackRef} onDrag={onEdgeDrag} pct={pctEdge} endLabels={['Safe', 'Bold']} />
      </div>

      {/* HEAT SLIDER */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-canvas-xs font-medium text-canvas-ink-soft">Heat</span>
          <input
            type="number"
            value={heatInputVal}
            onChange={handleHeatInput}
            onBlur={handleHeatBlur}
            min={0} max={1000} step={10}
            className={numberInputClass}
          />
        </div>
        <BlendSlider trackRef={heatTrackRef} onDrag={onHeatDrag} pct={pctHeat} endLabels={['Narrative', 'Commanding']} />
      </div>

      {/* Description */}
      <div className="text-canvas-sm text-canvas-ink-soft mt-3 pl-0.5 leading-[1.4] min-h-[13px]">
        {activePreset ? activePreset.desc : getCustomDesc(edge, heat)}
      </div>

      {/* Presets Toggle */}
      <button
        onClick={() => setPresetsOpen(!presetsOpen)}
        className="flex items-center gap-1.5 mt-2.5 p-0 bg-transparent border-none cursor-pointer text-canvas-xs font-medium text-canvas-ink-soft hover:text-canvas-ink transition-colors"
      >
        <ChevronRight
          className={cn("w-2 h-2 transition-transform duration-200", presetsOpen && "rotate-90")}
          strokeWidth={3}
        />
        Presets
      </button>

      {/* Collapsible Preset Grid */}
      <div
        className="overflow-hidden"
        style={{ maxHeight: presetsOpen ? 120 : 0, transition: 'max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        <div className="grid grid-cols-4 gap-1.5 pt-2.5">
          {PRESETS.map(p => {
            const dist = Math.sqrt((edge - p.edge) ** 2 + (heat - p.heat) ** 2);
            const isActive = dist < SNAP_THRESHOLD;
            return (
              <button
                key={p.label}
                onClick={() => onChange(edgeHeatToWeights(p.edge, p.heat))}
                className={cn(chipClass(isActive), "py-2.5 leading-[1.2]")}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TriBlendSelector;
