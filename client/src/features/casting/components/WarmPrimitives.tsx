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

const ReqDot = ({ filled }: { filled: boolean }) => (
  !filled ? <span className="inline-block w-1 h-1 rounded-full bg-[#e07c5a] ml-1 align-middle" /> : null
);

export const FieldLabel = ({ children, filled = true }: { children: React.ReactNode; filled?: boolean }) => (
  <div style={{ fontSize: 11, fontWeight: 500, color: '#52524B', marginBottom: 6 }}>
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
            fontSize: 12, fontWeight: selected === opt ? 600 : 500,
            background: selected === opt ? '#1a1a1a' : '#ffffff',
            color: selected === opt ? '#fff' : '#52524B',
            border: selected === opt ? '1px solid #1a1a1a' : '1px solid #E8E4DF',
            boxShadow: selected === opt ? '0 2px 8px rgba(26,26,26,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
          }}
          onMouseEnter={(e) => { if (selected !== opt) { e.currentTarget.style.borderColor = '#C5BFB6'; e.currentTarget.style.background = '#FAFAF8'; } }}
          onMouseLeave={(e) => { if (selected !== opt) { e.currentTarget.style.borderColor = '#E8E4DF'; e.currentTarget.style.background = '#ffffff'; } }}
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
              fontSize: 12, fontWeight: selected === opt ? 600 : 500,
              background: selected === opt ? '#1a1a1a' : '#ffffff',
              color: selected === opt ? '#fff' : '#52524B',
              border: selected === opt ? '1px solid #1a1a1a' : '1px solid #E8E4DF',
              boxShadow: selected === opt ? '0 2px 8px rgba(26,26,26,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={(e) => { if (selected !== opt) { e.currentTarget.style.borderColor = '#C5BFB6'; e.currentTarget.style.background = '#FAFAF8'; } }}
            onMouseLeave={(e) => { if (selected !== opt) { e.currentTarget.style.borderColor = '#E8E4DF'; e.currentTarget.style.background = '#ffffff'; } }}
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
              className="flex items-center gap-1 transition-colors hover:text-[#52524B]"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11, color: '#71716A' }}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              Reset to Auto
            </button>
          ) : (
            <span style={{ fontSize: 11, color: '#d8d4ce' }}>Guided by casting direction</span>
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
    <div style={{ fontSize: 11, fontWeight: 500, color: '#52524B', marginBottom: 4 }}>{label}</div>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full py-2 px-2.5 rounded-xl outline-none cursor-pointer appearance-none"
        style={{ background: '#ffffff', border: '1px solid #E8E4DF', fontSize: 13, color: value ? '#1a1a1a' : '#999' }}
      >
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#71716A' }}>
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
              style={{
                fontSize: 12, fontWeight: active ? 600 : 500,
                background: active ? '#1a1a1a' : '#ffffff',
                color: active ? '#fff' : '#52524B',
                border: active ? '1px solid #1a1a1a' : '1px solid #E8E4DF',
                boxShadow: active ? '0 2px 8px rgba(26,26,26,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
              }}
              onMouseEnter={(e) => { if (!active) { e.currentTarget.style.borderColor = '#C5BFB6'; e.currentTarget.style.background = '#FAFAF8'; } }}
              onMouseLeave={(e) => { if (!active) { e.currentTarget.style.borderColor = '#E8E4DF'; e.currentTarget.style.background = '#ffffff'; } }}
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
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: ETH_COLORS[eth.name] || '#888', opacity: 0.9 }}>
                    {eth.name.length > 8 ? eth.name.split(' ')[0].slice(0, 6).toUpperCase() : eth.name.toUpperCase()}
                  </span>
                )}
                <span style={{ position: 'absolute', bottom: -14, left: '50%', transform: 'translateX(-50%)', fontSize: 11, fontWeight: 600, color: ETH_COLORS[eth.name] || '#888', opacity: 0.7, whiteSpace: 'nowrap' }}>{eth.pct}%</span>
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
        <div style={{ fontSize: 11, color: '#52524B', paddingLeft: 2, marginTop: 2 }}>Tap a second ethnicity to create a blend</div>
      )}
    </div>
  );
};

// ── Collapsible Section ───────────────────────

export const CollapsibleSection = ({ id, title, icon, isOpen, onToggle, completionRatio, children }: {
  id: string; title: string; icon?: React.ReactNode; isOpen: boolean; onToggle: (id: string) => void; completionRatio: number; children: React.ReactNode;
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
          {icon && <span style={{ color: isOpen ? '#1a1a1a' : '#bbb', transition: 'color 0.2s', display: 'flex', alignItems: 'center' }}>{icon}</span>}
          <span style={{ fontSize: 12, fontWeight: 500, color: '#52524B', letterSpacing: '0.06em' }}>{title.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: dots }).map((_, i) => (
            <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i < filled ? '#1a1a1a' : 'rgba(0,0,0,0.08)', transition: 'background 0.3s' }} />
          ))}
        </div>
      </button>
      <div style={{ height, overflow: 'hidden', transition: 'height 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        <div
          ref={contentRef}
          className="px-4 pb-4"
          style={{
            opacity: isOpen ? 1 : 0,
            transform: isOpen ? 'translateY(0)' : 'translateY(-6px)',
            transition: 'opacity 0.2s ease 0.05s, transform 0.2s ease 0.05s',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

// ── Summary Strip ─────────────────────────────

// Inline SVG icon helpers for SummaryStrip (no emojis)
const sz = 8;
const sw = 1.8;
const SummaryIconFemale = () => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round">
    <circle cx="12" cy="8" r="5" /><line x1="12" y1="13" x2="12" y2="21" /><line x1="9" y1="18" x2="15" y2="18" />
  </svg>
);
const SummaryIconMale = () => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round">
    <circle cx="10" cy="14" r="5" /><line x1="14" y1="10" x2="21" y2="3" /><polyline points="15 3 21 3 21 9" />
  </svg>
);
const SummaryIconNeutral = () => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round">
    <circle cx="12" cy="12" r="9" /><line x1="12" y1="3" x2="12" y2="21" />
  </svg>
);
const SummaryIconAge = () => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const SummaryIconGlobe = () => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round">
    <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);
const SummaryIconSkin = () => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round">
    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
    <path d="M2 12h20" />
  </svg>
);
const SummaryIconEye = () => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const SummaryIconScissors = () => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round">
    <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
);
const SummaryIconStyle = () => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const SummaryIconBrand = () => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 8v8" /><path d="M8 12h8" />
  </svg>
);

const SUMMARY_ICON_MAP: Record<string, () => React.JSX.Element> = {
  gender_female: SummaryIconFemale,
  gender_male: SummaryIconMale,
  gender_neutral: SummaryIconNeutral,
  age: SummaryIconAge,
  ethnicity: SummaryIconGlobe,
  skin: SummaryIconSkin,
  eyes: SummaryIconEye,
  hair: SummaryIconScissors,
  style: SummaryIconStyle,
  brand: SummaryIconBrand,
};

export const SummaryStrip = ({ prefs, ethnicityBlend }: {
  prefs: Record<string, unknown>;
  ethnicityBlend: { name: string; pct: number }[];
}) => {
  const items: { iconKey: string; label: string }[] = [];

  if (prefs.gender) {
    const g = prefs.gender as string;
    const key = g === 'Female' ? 'gender_female' : g === 'Male' ? 'gender_male' : 'gender_neutral';
    items.push({ iconKey: key, label: g });
  }
  if (prefs.age) items.push({ iconKey: 'age', label: `${prefs.age}y` });
  if (ethnicityBlend.length > 0) items.push({ iconKey: 'ethnicity', label: ethnicityBlend.map(e => e.pct < 100 ? `${e.pct}% ${e.name}` : e.name).join(' · ') });
  if (prefs.skinTone) items.push({ iconKey: 'skin', label: (prefs.skinTone as string).split(' / ')[0] });
  if (prefs.eyeColor) items.push({ iconKey: 'eyes', label: `${prefs.eyeColor}` });
  if (prefs.hairColor) items.push({ iconKey: 'hair', label: prefs.hairColor as string });
  if (prefs.hairStyle) items.push({ iconKey: 'style', label: prefs.hairStyle as string });
  if (prefs.castingBrand) items.push({ iconKey: 'brand', label: prefs.castingBrand as string });

  if (items.length <= 2) return null;

  return (
    <div
      className="custom-scrollbar"
      style={{
        borderBottom: '1px solid rgba(0,0,0,0.04)',
        background: 'rgba(245,243,239,0.5)',
        display: 'flex',
        gap: 4,
        padding: '6px 16px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      {items.map((item, i) => {
        const IconComp = SUMMARY_ICON_MAP[item.iconKey];
        return (
          <span
            key={i}
            className="flex items-center gap-1 shrink-0"
            style={{
              padding: '3px 8px',
              borderRadius: 20,
              background: 'rgba(0,0,0,0.04)',
              fontSize: 11,
              fontWeight: 500,
              color: '#52524B',
              whiteSpace: 'nowrap',
              letterSpacing: '0.01em',
            }}
          >
            <span style={{ opacity: 0.55, display: 'flex', alignItems: 'center' }}>{IconComp && <IconComp />}</span>
            {item.label}
          </span>
        );
      })}
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
