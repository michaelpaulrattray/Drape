/**
 * Warm-theme UI primitives for the v3 Casting Studio ControlPanel.
 * These small building blocks (ChipRow, OptionGrid, SelectControl, etc.)
 * are shared across multiple sections of the ControlPanel.
 */

import { useState, useRef, useEffect, useCallback } from "react";

// ── Ethnicity Constants ───────────────────────

export const ETHNICITIES = [
  "Slavic", "Nordic", "East Asian", "South Asian",
  "Afro-Caribbean", "West African", "Latino",
  "Middle Eastern", "Polynesian",
];

const ETH_COLORS: Record<string, string> = {
  "Slavic": "#b8a080", "Nordic": "#8fb6cd", "East Asian": "#c49647",
  "South Asian": "#d9ae88", "Afro-Caribbean": "#8d5e42", "West African": "#593b2b",
  "Latino": "#c08a65", "Middle Eastern": "#a06d48", "Polynesian": "#947846",
};

// ── Tiny Helpers ──────────────────────────────

export const ReqDot = ({ filled }: { filled: boolean }) => (
  !filled ? <span className="inline-block w-1 h-1 rounded-full bg-[#e07c5a] ml-1 align-middle" /> : null
);

export const FieldLabel = ({ children, filled = true }: { children: React.ReactNode; filled?: boolean }) => (
  <div style={{ fontSize: 9, fontWeight: 500, color: '#999', marginBottom: 6 }}>
    {children}<ReqDot filled={filled} />
  </div>
);

// ── ChipRow ───────────────────────────────────

export const ChipRow = ({ options, selected, onSelect, allowDeselect = false }: {
  options: string[]; selected: string; onSelect: (v: string) => void; allowDeselect?: boolean;
}) => {
  const cols = options.length <= 3 ? options.length : options.length === 4 ? 2 : 3;
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => allowDeselect && selected === opt ? onSelect('') : onSelect(opt)}
          className="py-2 rounded-xl text-center transition-all"
          style={{
            fontSize: 10, fontWeight: selected === opt ? 600 : 400,
            background: selected === opt ? '#1a1a1a' : '#f5f3ef',
            color: selected === opt ? '#fff' : '#888',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
};

// ── OptionGrid ────────────────────────────────

export const OptionGrid = ({ options, selected, onSelect, cols = 3, showAutoReset = false }: {
  options: string[]; selected: string; onSelect: (v: string) => void; cols?: number; showAutoReset?: boolean;
}) => {
  const isAuto = !selected || selected === 'Auto';
  const peerOptions = showAutoReset ? options.filter(o => o !== 'Auto') : options;
  return (
    <div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {peerOptions.map(opt => (
          <button
            key={opt}
            onClick={() => showAutoReset && selected === opt ? onSelect('Auto') : onSelect(opt)}
            className="py-2.5 rounded-xl text-center transition-all"
            style={{
              fontSize: 10, fontWeight: selected === opt ? 600 : 400,
              background: selected === opt ? '#1a1a1a' : '#f5f3ef',
              color: selected === opt ? '#fff' : '#888',
            }}
          >
            {opt}
          </button>
        ))}
      </div>
      {showAutoReset && (
        <div style={{ marginTop: 6, minHeight: 16 }}>
          {!isAuto ? (
            <button
              onClick={() => onSelect('Auto')}
              className="flex items-center gap-1 transition-colors hover:text-[#999]"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 9, color: '#ccc' }}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              Reset to Auto
            </button>
          ) : (
            <span style={{ fontSize: 9, color: '#d8d4ce' }}>Guided by casting direction</span>
          )}
        </div>
      )}
    </div>
  );
};

// ── SelectControl ─────────────────────────────

export const WarmSelectControl = ({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) => (
  <div>
    <div style={{ fontSize: 9, fontWeight: 500, color: '#999', marginBottom: 4 }}>{label}</div>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full py-2 px-2.5 rounded-xl outline-none cursor-pointer appearance-none"
        style={{ background: '#f5f3ef', border: '1px solid rgba(0,0,0,0.04)', fontSize: 11, color: value ? '#1a1a1a' : '#bbb' }}
      >
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#bbb' }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </div>
    </div>
  </div>
);

// ── EyeGrid ───────────────────────────────────

const EYE_PRESETS = [
  { label: "Ice", hex: "#c4d6e0" }, { label: "Sky", hex: "#8fb6cd" },
  { label: "Azure", hex: "#4e7bb5" }, { label: "Navy", hex: "#283655" },
  { label: "Grey", hex: "#9baec2" }, { label: "Steel", hex: "#687684" },
  { label: "Mint", hex: "#8caea0" }, { label: "Green", hex: "#4f6f46" },
  { label: "Olive", hex: "#6e7039" }, { label: "Hazel", hex: "#947846" },
  { label: "Amber", hex: "#c49647" }, { label: "Honey", hex: "#b89650" },
  { label: "Brown", hex: "#634e34" }, { label: "Dark", hex: "#3b2b22" },
  { label: "Black", hex: "#1c1c1c" },
];

export const EyeGrid = ({ selected, onSelect }: {
  selected: string; onSelect: (v: string) => void;
}) => (
  <div className="grid grid-cols-5 gap-2">
    {EYE_PRESETS.map(opt => {
      const isSelected = selected === opt.label;
      return (
        <button
          key={opt.label}
          onClick={() => onSelect(opt.label)}
          className="relative w-full aspect-square rounded-full overflow-hidden transition-all"
          style={{
            border: isSelected ? '2px solid #1a1a1a' : '2px solid rgba(0,0,0,0.06)',
            transform: isSelected ? 'scale(1.1)' : 'scale(1)',
            boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
          }}
          title={opt.label}
        >
          <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 35% 35%, ${opt.hex} 0%, #333 80%)` }} />
          <div className="absolute top-[25%] left-[25%] w-[15%] h-[15%] bg-white rounded-full blur-[1px] opacity-50" />
        </button>
      );
    })}
  </div>
);

// ── Ethnicity Blender ─────────────────────────

export const EthnicityBlender = ({ selected, onChange }: {
  selected: { name: string; pct: number }[];
  onChange: (val: { name: string; pct: number }[]) => void;
}) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrag = useCallback((clientX: number) => {
    if (!barRef.current || selected.length !== 2) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = Math.max(0.1, Math.min(0.9, (clientX - rect.left) / rect.width));
    const pct1 = Math.round(x * 100);
    onChange([{ ...selected[0], pct: pct1 }, { ...selected[1], pct: 100 - pct1 }]);
  }, [selected, onChange]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => handleDrag(e.clientX);
    const onTouchMove = (e: TouchEvent) => handleDrag(e.touches[0].clientX);
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, handleDrag]);

  const toggleEth = (name: string) => {
    const exists = selected.find(e => e.name === name);
    if (exists) {
      const next = selected.filter(e => e.name !== name);
      if (next.length === 1) next[0] = { ...next[0], pct: 100 };
      onChange(next);
    } else if (selected.length >= 2) {
      onChange([{ ...selected[selected.length - 1], pct: 50 }, { name, pct: 50 }]);
    } else if (selected.length === 1) {
      onChange([{ ...selected[0], pct: 60 }, { name, pct: 40 }]);
    } else {
      onChange([{ name, pct: 100 }]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {ETHNICITIES.map(eth => {
          const active = selected.some(e => e.name === eth);
          return (
            <button key={eth} onClick={() => toggleEth(eth)}
              className="py-2.5 rounded-xl text-center transition-all"
              style={{ fontSize: 10, fontWeight: active ? 600 : 400, background: active ? '#1a1a1a' : '#f5f3ef', color: active ? '#fff' : '#888' }}
            >{eth}</button>
          );
        })}
      </div>
      {selected.length === 2 && (
        <div className="space-y-1 pt-1">
          <div ref={barRef} className="relative flex" style={{ height: 30, borderRadius: 8, userSelect: 'none', cursor: dragging ? 'col-resize' : 'default' }}>
            {selected.map((eth, i) => (
              <div key={eth.name} style={{
                width: `${eth.pct}%`, height: '100%',
                background: `linear-gradient(135deg, ${ETH_COLORS[eth.name] || '#888'}38, ${ETH_COLORS[eth.name] || '#888'}18)`,
                borderRadius: i === 0 ? '8px 0 0 8px' : '0 8px 8px 0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', transition: dragging ? 'none' : 'width 0.2s ease',
              }}>
                {eth.pct > 20 && (
                  <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', color: ETH_COLORS[eth.name] || '#888', opacity: 0.9 }}>
                    {eth.name.length > 8 ? eth.name.split(' ')[0].slice(0, 6).toUpperCase() : eth.name.toUpperCase()}
                  </span>
                )}
                <span style={{ position: 'absolute', bottom: -14, left: '50%', transform: 'translateX(-50%)', fontSize: 9, fontWeight: 600, color: ETH_COLORS[eth.name] || '#888', opacity: 0.7, whiteSpace: 'nowrap' }}>{eth.pct}%</span>
              </div>
            ))}
            <div
              onMouseDown={(e) => { e.preventDefault(); setDragging(true); }}
              onTouchStart={() => setDragging(true)}
              style={{ position: 'absolute', left: `${selected[0].pct}%`, top: 0, width: 14, height: '100%', marginLeft: -7, cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, touchAction: 'none' }}
            >
              <div style={{ width: 3, height: 14, borderRadius: 2, background: dragging ? '#1a1a1a' : 'rgba(0,0,0,0.15)', transition: 'all 0.15s' }} />
            </div>
          </div>
          <div style={{ height: 14 }} />
        </div>
      )}
      {selected.length === 1 && (
        <div style={{ fontSize: 9, color: '#b8b3a8', paddingLeft: 2, marginTop: 2 }}>Tap a second ethnicity to create a blend</div>
      )}
    </div>
  );
};

// ── Collapsible Section ───────────────────────

export const CollapsibleSection = ({ id, title, isOpen, onToggle, completionRatio, children }: {
  id: string; title: string; isOpen: boolean; onToggle: (id: string) => void; completionRatio: number; children: React.ReactNode;
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  // Sync height when open/close toggles
  useEffect(() => {
    if (contentRef.current) {
      setHeight(isOpen ? contentRef.current.scrollHeight : 0);
    }
  }, [isOpen]);

  // Watch for content size changes via ResizeObserver (replaces children dep)
  useEffect(() => {
    if (!isOpen || !contentRef.current) return;
    const el = contentRef.current;
    const ro = new ResizeObserver(() => {
      setHeight(el.scrollHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen]);

  const dots = 3;
  const filled = Math.round(completionRatio * dots);

  return (
    <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
      <button onClick={() => onToggle(id)} className="w-full flex items-center justify-between px-4 py-3" style={{ cursor: 'pointer', background: 'transparent', border: 'none' }}>
        <div className="flex items-center gap-2.5">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="3" strokeLinecap="round"
            style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span style={{ fontSize: 10, fontWeight: 500, color: '#999', letterSpacing: '0.06em' }}>{title.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: dots }).map((_, i) => (
            <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i < filled ? '#1a1a1a' : 'rgba(0,0,0,0.08)', transition: 'background 0.3s' }} />
          ))}
        </div>
      </button>
      <div style={{ height, overflow: 'hidden', transition: 'height 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        <div ref={contentRef} className="px-4 pb-4">{children}</div>
      </div>
    </div>
  );
};

// ── Summary Strip ─────────────────────────────

export const SummaryStrip = ({ prefs, ethnicityBlend }: {
  prefs: Record<string, unknown>;
  ethnicityBlend: { name: string; pct: number }[];
}) => {
  const tags = [
    prefs.gender as string,
    prefs.age && `${prefs.age}y`,
    ethnicityBlend.length > 0 && ethnicityBlend.map(e => e.pct < 100 ? `${e.pct}% ${e.name}` : e.name).join(' · '),
    (prefs.skinTone as string)?.split(' / ')[0],
    prefs.eyeColor && `${prefs.eyeColor} eyes`,
    prefs.hairColor as string,
    prefs.hairStyle as string,
    prefs.castingBrand as string,
  ].filter(Boolean);

  if (tags.length <= 2) return null;

  return (
    <div className="px-4 py-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', background: 'rgba(245,243,239,0.5)', display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {tags.map((tag, i) => (
        <span key={i} style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.04)', fontSize: 8, fontWeight: 500, color: '#999', whiteSpace: 'nowrap' }}>{String(tag)}</span>
      ))}
    </div>
  );
};

// ── Skin Tone Grid ────────────────────────────

const SKIN_TONES = [
  { label: "Porcelain", value: "Porcelain / Pale", base: "#ffe0d6", shadow: "#eac0b0" },
  { label: "Fair", value: "Fair / Light", base: "#f5cbb6", shadow: "#dcb098" },
  { label: "Medium", value: "Medium / Olive", base: "#d9ae88", shadow: "#bf926b" },
  { label: "Tan", value: "Tan / Bronze", base: "#c08a65", shadow: "#a06d48" },
  { label: "Deep", value: "Deep / Brown", base: "#8d5e42", shadow: "#6b422a" },
  { label: "Ebony", value: "Ebony / Dark", base: "#593b2b", shadow: "#3d2316" },
];

export const SkinToneGrid = ({ selected, onSelect }: { selected: string; onSelect: (v: string) => void }) => (
  <div className="grid grid-cols-6 gap-2">
    {SKIN_TONES.map(tone => (
      <button key={tone.label} onClick={() => onSelect(tone.value)} title={tone.label}
        className="h-8 rounded-lg overflow-hidden transition-all"
        style={{
          background: `linear-gradient(135deg, ${tone.base} 0%, ${tone.shadow} 100%)`,
          border: selected === tone.value ? '2.5px solid #1a1a1a' : '2px solid rgba(0,0,0,0.06)',
          transform: selected === tone.value ? 'scale(1.1)' : 'scale(1)',
        }}
      />
    ))}
  </div>
);
