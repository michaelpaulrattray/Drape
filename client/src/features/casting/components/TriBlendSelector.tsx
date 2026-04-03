import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Tooltip from '@/components/Tooltip';

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
const PRESETS = [
  { label: 'Catalogue',   edge: 300, heat: 333, desc: 'E-commerce, lookbook ready' },
  { label: 'Commercial',  edge: 200, heat: 500, desc: 'Clean, sellable, broad appeal' },
  { label: 'High-Com',    edge: 400, heat: 250, desc: 'Premium commercial, editorial polish' },
  { label: 'Balanced',    edge: 660, heat: 500, desc: 'Versatile, all-rounder' },
  { label: 'Street-Ed',   edge: 750, heat: 333, desc: 'Raw editorial with commercial edge' },
  { label: 'Editorial',   edge: 900, heat: 111, desc: 'Moody, narrative, conceptual' },
  { label: 'Avant-Garde', edge: 950, heat: 368, desc: 'Experimental, art-forward' },
  { label: 'Runway',      edge: 900, heat: 889, desc: 'Powerful, commanding, dramatic' },
];

const SNAP_THRESHOLD = 35;

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

  return (
    <div
      style={{
        background: '#F4F4F5',
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 14,
        padding: '14px 14px 12px',
      }}
      className="w-full select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a' }}>Tone & Energy</span>
          <Tooltip content="Drag the sliders or type a value (0-1000). Tap a preset to snap to a known vibe." />
        </div>
        <span style={{
          fontSize: 10, fontWeight: 400, color: '#71717A',
          fontStyle: 'italic', opacity: activePreset ? 1 : 0.5,
        }}>
          {activePreset ? activePreset.label : 'Custom'}
        </span>
      </div>

      {/* EDGE SLIDER */}
      <div style={{ marginBottom: 16 }}>
        <div className="flex items-baseline justify-between" style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.06em', color: '#777168', textTransform: 'lowercase' }}>
            <span style={{ color: '#d4d0c9', marginRight: 1 }}>--</span>edge
          </span>
          <input
            type="number"
            value={edgeInputVal}
            onChange={handleEdgeInput}
            onBlur={handleEdgeBlur}
            min={0} max={1000} step={10}
            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            style={{
              width: 42, textAlign: 'right', fontFamily: 'inherit',
              fontSize: 11, fontWeight: 600, color: '#1a1a1a',
              background: 'none', border: 'none', borderBottom: '1px solid transparent',
              outline: 'none', padding: '0 0 1px 0',
            }}
          />
        </div>
        <div
          ref={edgeTrackRef}
          onMouseDown={onEdgeDrag}
          onTouchStart={onEdgeDrag}
          style={{ position: 'relative', height: 28, display: 'flex', alignItems: 'center', cursor: 'pointer', touchAction: 'none' }}
        >
          <div style={{ width: '100%', height: 3, borderRadius: 2, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 2, background: '#FAFAFA' }} />
            <div style={{
              position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 2,
              background: 'linear-gradient(to right, #A1A1AA, #888580, #4a4846, #1a1a1a)',
              width: `${pctEdge}%`, transition: 'width 0.12s ease-out',
            }} />
          </div>
          <div style={{
            position: 'absolute', top: '50%', left: `${pctEdge}%`,
            transform: 'translate(-50%, -50%)', width: 14, height: 14,
            borderRadius: '50%', background: '#1a1a1a',
            boxShadow: '0 1px 6px rgba(0,0,0,0.15)',
            cursor: 'grab', zIndex: 3, transition: 'left 0.12s ease-out',
          }} />
        </div>
        <div className="flex justify-between" style={{ marginTop: 5 }}>
          <span style={{ fontSize: 8, color: '#d4d0c9' }}>safe</span>
          <span style={{ fontSize: 8, color: '#d4d0c9' }}>bold</span>
        </div>
      </div>

      {/* HEAT SLIDER */}
      <div>
        <div className="flex items-baseline justify-between" style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.06em', color: '#777168', textTransform: 'lowercase' }}>
            <span style={{ color: '#d4d0c9', marginRight: 1 }}>--</span>heat
          </span>
          <input
            type="number"
            value={heatInputVal}
            onChange={handleHeatInput}
            onBlur={handleHeatBlur}
            min={0} max={1000} step={10}
            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            style={{
              width: 42, textAlign: 'right', fontFamily: 'inherit',
              fontSize: 11, fontWeight: 600, color: '#1a1a1a',
              background: 'none', border: 'none', borderBottom: '1px solid transparent',
              outline: 'none', padding: '0 0 1px 0',
            }}
          />
        </div>
        <div
          ref={heatTrackRef}
          onMouseDown={onHeatDrag}
          onTouchStart={onHeatDrag}
          style={{ position: 'relative', height: 28, display: 'flex', alignItems: 'center', cursor: 'pointer', touchAction: 'none' }}
        >
          <div style={{ width: '100%', height: 3, borderRadius: 2, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 2, background: '#FAFAFA' }} />
            <div style={{
              position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 2,
              background: 'linear-gradient(to right, #8a9aa8, #b8a088, #c4956a, #d4784a)',
              width: `${pctHeat}%`, transition: 'width 0.12s ease-out',
            }} />
          </div>
          <div style={{
            position: 'absolute', top: '50%', left: `${pctHeat}%`,
            transform: 'translate(-50%, -50%)', width: 14, height: 14,
            borderRadius: '50%', background: '#c4956a',
            boxShadow: '0 1px 8px rgba(196,149,106,0.3)',
            cursor: 'grab', zIndex: 3, transition: 'left 0.12s ease-out',
          }} />
        </div>
        <div className="flex justify-between" style={{ marginTop: 5 }}>
          <span style={{ fontSize: 8, color: '#d4d0c9' }}>narrative</span>
          <span style={{ fontSize: 8, color: '#d4d0c9' }}>commanding</span>
        </div>
      </div>

      {/* Description */}
      <div style={{ fontSize: 9, color: '#71717A', marginTop: 12, paddingLeft: 2, lineHeight: 1.4, minHeight: 13 }}>
        {activePreset ? activePreset.desc : getCustomDesc(edge, heat)}
      </div>

      {/* Presets Toggle */}
      <button
        onClick={() => setPresetsOpen(!presetsOpen)}
        className="flex items-center gap-1.5 transition-colors"
        style={{
          marginTop: 10, padding: 0, background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 8, fontWeight: 600,
          letterSpacing: '0.06em', color: '#71717A',
        }}
      >
        <svg
          width="8" height="8" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="3" strokeLinecap="round"
          style={{ transform: presetsOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        PRESETS
      </button>

      {/* Collapsible Preset Grid */}
      <div style={{
        maxHeight: presetsOpen ? 120 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(4, 1fr)', paddingTop: 10 }}>
          {PRESETS.map(p => {
            const dist = Math.sqrt((edge - p.edge) ** 2 + (heat - p.heat) ** 2);
            const isActive = dist < SNAP_THRESHOLD;
            return (
              <button
                key={p.label}
                onClick={() => onChange(edgeHeatToWeights(p.edge, p.heat))}
                className="py-2.5 rounded-xl text-center transition-all"
                style={{
                  background: isActive ? '#1a1a1a' : '#F4F4F5',
                  color: isActive ? '#fff' : '#888',
                  fontSize: 10, fontWeight: isActive ? 600 : 400,
                  border: 'none', cursor: 'pointer', lineHeight: 1.2,
                  fontFamily: 'inherit',
                }}
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
