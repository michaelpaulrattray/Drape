/**
 * Casting ControlPanel section/row primitives (ChipRow, OptionGrid,
 * SelectControl, etc.), shared across the panel's sections.
 * Restyled to the canvas language per DESIGN_SYSTEM.md §13 (R6) —
 * behavior (drag, snap, blend manipulation, selection) unchanged.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// Canonical option lists — single source (R2 dedupe; audit H). The old local
// copies drifted (this file's EYE_PRESETS lacked the `image` field).
import { ETHNICITIES, EYE_PRESETS, SKIN_TONES } from "../constants";

export { ETHNICITIES };

// ── Tiny Helpers ──────────────────────────────

const ReqDot = ({ filled }: { filled: boolean }) => (
  !filled ? <span className="inline-block w-1 h-1 rounded-full bg-canvas-warning ml-1 align-middle" /> : null
);

export const FieldLabel = ({ children, filled = true }: { children: React.ReactNode; filled?: boolean }) => (
  <div className="text-canvas-xs font-medium text-canvas-ink-soft mb-1.5">
    {children}<ReqDot filled={filled} />
  </div>
);

// The standard chip pattern (DS §13.1) — shared by ChipRow, OptionGrid,
// EthnicityBlender's grid, and TriBlendSelector's presets.
export const chipClass = (active: boolean) =>
  cn(
    "py-2 rounded-canvas-md text-center text-canvas-xs transition-colors",
    active
      ? "bg-canvas-surface-inset border border-canvas-ink text-canvas-ink font-medium"
      : "bg-canvas-surface border-hairline border-canvas-border text-canvas-ink-soft hover:border-canvas-border-strong",
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
          className={chipClass(selected === opt)}
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
            className={cn(chipClass(selected === opt), "py-2.5")}
          >
            {opt}
          </button>
        ))}
      </div>
      {showAutoReset && (
        <div className="mt-1.5 min-h-4">
          {!isAuto ? (
            <button
              onClick={() => onSelect('Auto')}
              className="flex items-center gap-1 p-0 bg-transparent border-none cursor-pointer text-canvas-sm text-canvas-ink-faint hover:text-canvas-ink-soft transition-colors"
            >
              <RotateCcw className="w-2 h-2" strokeWidth={2.5} />
              Reset to auto
            </button>
          ) : (
            <span className="text-canvas-sm text-canvas-ink-faint">Guided by casting direction</span>
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
    <div className="text-canvas-xs font-medium text-canvas-ink-soft mb-1">{label}</div>
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full h-9 bg-canvas-surface border-hairline border-canvas-border rounded-canvas-md text-canvas-sm shadow-none focus:ring-0 focus:border-canvas-ink">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent className="shadow-none border-hairline border-canvas-border-strong">
        {options.map(o => <SelectItem key={o} value={o} className="text-canvas-sm">{o}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>
);

// ── EyeGrid (color-data exception — the iris gradient is data) ──

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
          className={cn(
            "relative w-full aspect-square rounded-full overflow-hidden transition-all",
            isSelected
              ? "border border-canvas-ink ring-1 ring-canvas-ink ring-offset-1 ring-offset-canvas-surface"
              : "border-hairline border-canvas-border hover:border-canvas-border-strong",
          )}
          title={opt.label}
        >
          <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 35% 35%, ${opt.hex} 0%, #333 80%)` }} />
        </button>
      );
    })}
  </div>
);

// ── Ethnicity Blender ─────────────────────────
// The blend bar shows proportion; the labels show identity (DS §13.2 —
// per-ethnicity color coding removed).

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
      <div className="grid grid-cols-3 gap-1.5">
        {ETHNICITIES.map(eth => {
          const active = selected.some(e => e.name === eth);
          return (
            <button key={eth} onClick={() => toggleEth(eth)} className={cn(chipClass(active), "py-2.5")}>
              {eth}
            </button>
          );
        })}
      </div>
      {selected.length === 2 && (
        <div className="space-y-1 pt-1">
          <div
            ref={barRef}
            className="relative flex h-8 rounded-canvas-md overflow-hidden border-hairline border-canvas-border select-none"
            style={{ cursor: dragging ? "col-resize" : "default" }}
          >
            {selected.map((eth, i) => (
              <div
                key={eth.name}
                className="h-full flex items-center justify-center relative bg-canvas-surface-inset"
                style={{
                  width: `${eth.pct}%`,
                  transition: dragging ? "none" : "width 200ms ease",
                  ...(i === 0 ? { borderRight: "0.5px solid var(--color-canvas-border)" } : {}),
                }}
              >
                {eth.pct > 20 && (
                  <span className="text-canvas-xs font-medium text-canvas-ink-soft">{eth.name}</span>
                )}
                <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-canvas-xs text-canvas-ink-faint whitespace-nowrap">
                  {eth.pct}%
                </span>
              </div>
            ))}
            <div
              onMouseDown={(e) => { e.preventDefault(); setDragging(true); }}
              onTouchStart={() => setDragging(true)}
              className="absolute top-0 h-full w-3.5 -ml-1.5 cursor-col-resize flex items-center justify-center z-10 touch-none"
              style={{ left: `${selected[0].pct}%` }}
            >
              <div className={cn("w-0.5 h-3.5 rounded-full transition-colors", dragging ? "bg-canvas-ink" : "bg-canvas-border-strong")} />
            </div>
          </div>
          {/* spacer: percentage labels are absolutely positioned below the bar */}
          <div className="h-3.5" />
        </div>
      )}
      {selected.length === 1 && (
        <div className="text-canvas-xs text-canvas-ink-soft pl-0.5 mt-0.5">Tap a second ethnicity to create a blend</div>
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
    <div className="border-t-hairline border-canvas-border">
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer bg-transparent border-none hover:bg-canvas-surface-inset/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <ChevronRight
            className={cn("w-3 h-3 text-canvas-ink-faint transition-transform duration-200", isOpen && "rotate-90")}
            strokeWidth={2}
          />
          {icon && <span className={cn("flex items-center transition-colors duration-200", isOpen ? "text-canvas-ink" : "text-canvas-ink-faint")}>{icon}</span>}
          <span className="text-canvas-sm font-medium text-canvas-ink-soft">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: dots }).map((_, i) => (
            <div key={i} className={cn("w-1 h-1 rounded-full transition-colors duration-300", i < filled ? "bg-canvas-ink" : "bg-canvas-border")} />
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
      className="custom-scrollbar flex gap-1 px-4 py-1.5 overflow-x-auto bg-canvas-surface-inset border-b-hairline border-canvas-border"
      style={{ scrollbarWidth: 'none' }}
    >
      {items.map((item, i) => {
        const IconComp = SUMMARY_ICON_MAP[item.iconKey];
        return (
          <span
            key={i}
            className="flex items-center gap-1 shrink-0 px-2 py-[3px] rounded-canvas-pill bg-canvas-surface border-hairline border-canvas-border text-canvas-xs font-medium text-canvas-ink-soft whitespace-nowrap"
          >
            <span className="opacity-55 flex items-center">{IconComp && <IconComp />}</span>
            {item.label}
          </span>
        );
      })}
    </div>
  );
};

// ── Skin Tone Grid (color-data exception — swatches stay chromatic) ──

export const SkinToneGrid = ({ selected, onSelect }: { selected: string; onSelect: (v: string) => void }) => (
  <div className="grid grid-cols-6 gap-2">
    {SKIN_TONES.map(tone => (
      <button
        key={tone.label}
        onClick={() => onSelect(tone.value)}
        title={tone.label}
        className={cn(
          "h-9 rounded-canvas-md transition-all",
          selected === tone.value
            ? "border border-canvas-ink ring-1 ring-canvas-ink ring-offset-1 ring-offset-canvas-surface"
            : "border-hairline border-canvas-border hover:border-canvas-border-strong",
        )}
        style={{ background: tone.base }}
      />
    ))}
  </div>
);
