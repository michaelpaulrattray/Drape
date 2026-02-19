import { useRef, useState, useEffect, useCallback } from 'react';

// ============ Constants ============

const ETHNICITIES = [
  "Slavic", "Nordic", "East Asian", "South Asian",
  "Afro-Caribbean", "West African", "Latino",
  "Middle Eastern", "Polynesian",
];

const ETH_COLORS: Record<string, string> = {
  "Slavic": "#b8a080",
  "Nordic": "#8fb6cd",
  "East Asian": "#c49647",
  "South Asian": "#d9ae88",
  "Afro-Caribbean": "#8d5e42",
  "West African": "#593b2b",
  "Latino": "#c08a65",
  "Middle Eastern": "#a06d48",
  "Polynesian": "#947846",
};

// ============ Types ============

interface EthnicityBlenderProps {
  selected: { name: string; pct: number }[];
  onChange: (val: { name: string; pct: number }[]) => void;
}

// ============ Component ============

export function EthnicityBlender({ selected, onChange }: EthnicityBlenderProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrag = useCallback((clientX: number) => {
    if (!barRef.current || selected.length !== 2) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = Math.max(0.1, Math.min(0.9, (clientX - rect.left) / rect.width));
    const pct1 = Math.round(x * 100);
    onChange([
      { ...selected[0], pct: pct1 },
      { ...selected[1], pct: 100 - pct1 },
    ]);
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
      // Replace oldest with new, default 50/50
      onChange([
        { ...selected[selected.length - 1], pct: 50 },
        { name, pct: 50 },
      ]);
    } else if (selected.length === 1) {
      onChange([{ ...selected[0], pct: 60 }, { name, pct: 40 }]);
    } else {
      onChange([{ name, pct: 100 }]);
    }
  };

  return (
    <div className="space-y-3">
      {/* 3-column ethnicity grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {ETHNICITIES.map(eth => {
          const active = selected.some(e => e.name === eth);
          return (
            <button
              key={eth}
              onClick={() => toggleEth(eth)}
              className={`
                py-2.5 rounded-xl text-center text-[10px] transition-all
                ${active
                  ? 'bg-[#0A0A0A] text-white font-semibold'
                  : 'bg-[#EBEBEB] text-[#757575] font-normal hover:text-[#0A0A0A] hover:bg-[#D4D4D4]'
                }
              `}
            >
              {eth}
            </button>
          );
        })}
      </div>

      {/* Blend bar — visible when 2 selected */}
      {selected.length === 2 && (
        <div className="space-y-1 pt-1">
          <div
            ref={barRef}
            className="relative flex h-[30px] rounded-lg select-none"
            style={{ cursor: dragging ? 'col-resize' : 'default' }}
          >
            {selected.map((eth, i) => {
              const color = ETH_COLORS[eth.name] || '#888';
              return (
                <div
                  key={eth.name}
                  className="relative flex items-center justify-center"
                  style={{
                    width: `${eth.pct}%`,
                    height: '100%',
                    background: `linear-gradient(135deg, ${color}38, ${color}18)`,
                    borderRadius: i === 0 ? '8px 0 0 8px' : '0 8px 8px 0',
                    transition: dragging ? 'none' : 'width 0.2s ease',
                  }}
                >
                  {eth.pct > 20 && (
                    <span
                      className="text-[8px] font-bold tracking-wider"
                      style={{ color, opacity: 0.9 }}
                    >
                      {eth.name.length > 8
                        ? eth.name.split(' ')[0].slice(0, 6).toUpperCase()
                        : eth.name.toUpperCase()}
                    </span>
                  )}
                  <span
                    className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[9px] font-semibold whitespace-nowrap"
                    style={{ color, opacity: 0.7 }}
                  >
                    {eth.pct}%
                  </span>
                </div>
              );
            })}

            {/* Drag handle */}
            <div
              onMouseDown={(e) => { e.preventDefault(); setDragging(true); }}
              onTouchStart={() => setDragging(true)}
              className="absolute top-0 flex items-center justify-center z-10"
              style={{
                left: `${selected[0].pct}%`,
                width: 14,
                height: '100%',
                marginLeft: -7,
                cursor: 'col-resize',
                touchAction: 'none',
              }}
            >
              <div
                className="w-[3px] h-3.5 rounded-sm transition-all"
                style={{
                  background: dragging ? '#1a1a1a' : 'rgba(0,0,0,0.15)',
                }}
              />
            </div>
          </div>
          <div className="h-3.5" /> {/* Spacer for percentage labels */}
        </div>
      )}

      {/* Hint when 1 selected */}
      {selected.length === 1 && (
        <p className="text-[9px] text-[#757575] pl-0.5 mt-0.5">
          Tap a second ethnicity to create a blend
        </p>
      )}
    </div>
  );
}

export default EthnicityBlender;
