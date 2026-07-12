/**
 * AddNodeMenu — Light frosted glass context menu for adding nodes to the board canvas.
 *
 * Light theme matching the app's warm/clean aesthetic:
 *  - White frosted glass background with subtle shadow
 *  - Clean icon + label rows with soft hover highlights
 *  - Subtle dividers between groups
 *  - Appears on "+" click or right-click on canvas
 */
import { useEffect, useRef, useState } from 'react';
import { User, Shirt, Upload, StickyNote, Image, Search } from 'lucide-react';

// Frames removed per VC-R4 ruling R3 — they return at pass 3 as export units
// (D-20) wearing their real job. Existing frame nodes still render.
export type AddNodeAction = 'cast' | 'wardrobe' | 'upload' | 'note' | 'reference';

type MenuItem = {
  action: AddNodeAction;
  label: string;
  icon: React.ReactNode;
  group: 'create' | 'media';
};

const MENU_ITEMS: MenuItem[] = [
  {
    action: 'cast',
    label: 'Cast Model',
    icon: <User className="w-[15px] h-[15px]" />,
    group: 'create',
  },
  {
    action: 'wardrobe',
    label: 'Style Outfit',
    icon: <Shirt className="w-[15px] h-[15px]" />,
    group: 'create',
  },
  {
    action: 'reference',
    label: 'Add Reference',
    icon: <Image className="w-[15px] h-[15px]" />,
    group: 'create',
  },
  {
    action: 'note',
    label: 'Add Note',
    icon: <StickyNote className="w-[15px] h-[15px]" />,
    group: 'media',
  },
  {
    action: 'upload',
    label: 'Upload Media',
    icon: <Upload className="w-[15px] h-[15px]" />,
    group: 'media',
  },
];

type AddNodeMenuProps = {
  position: { x: number; y: number };
  onSelect: (action: AddNodeAction) => void;
  onClose: () => void;
};

export function AddNodeMenu({ position, onSelect, onClose }: AddNodeMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState('');

  // Auto-focus search input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  // Close on click outside or Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Clamp position to viewport so menu doesn't overflow
  const adjustedPosition = (() => {
    const menuW = 220;
    const menuH = 320;
    const pad = 12;
    let x = position.x;
    let y = position.y;
    if (typeof window !== 'undefined') {
      if (x + menuW + pad > window.innerWidth) x = window.innerWidth - menuW - pad;
      if (y + menuH + pad > window.innerHeight) y = window.innerHeight - menuH - pad;
      if (x < pad) x = pad;
      if (y < pad) y = pad;
    }
    return { x, y };
  })();

  const filtered = filter.trim()
    ? MENU_ITEMS.filter((item) =>
        item.label.toLowerCase().includes(filter.toLowerCase()),
      )
    : MENU_ITEMS;

  const createItems = filtered.filter((i) => i.group === 'create');
  const mediaItems = filtered.filter((i) => i.group === 'media');

  return (
    <div
      ref={menuRef}
      className="fixed z-[100]"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        animation: 'addNodeMenuIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes addNodeMenuIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>

      <div
        className="overflow-hidden"
        style={{
          width: 220,
          borderRadius: 12,
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(20px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow:
            '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
      >
        {/* Search input */}
        <div style={{ padding: '8px 8px 4px' }}>
          <div
            className="flex items-center gap-2"
            style={{
              height: 32,
              borderRadius: 8,
              background: 'rgba(0, 0, 0, 0.04)',
              padding: '0 10px',
            }}
          >
            <Search
              className="flex-shrink-0"
              style={{ width: 13, height: 13, color: 'rgba(0, 0, 0, 0.3)' }}
            />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none"
              style={{
                fontSize: 13,
                color: '#1a1a1a',
                caretColor: '#1a1a1a',
              }}
            />
          </div>
        </div>

        {/* Section label */}
        {createItems.length > 0 && (
          <div
            style={{
              padding: '6px 18px 2px',
              fontSize: 11,
              fontWeight: 500,
              color: 'rgba(0, 0, 0, 0.35)',
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
            }}
          >
            Create
          </div>
        )}

        {/* Create group */}
        {createItems.length > 0 && (
          <div style={{ padding: '2px 6px' }}>
            {createItems.map((item) => (
              <button
                key={item.action}
                onClick={() => {
                  onSelect(item.action);
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 cursor-pointer"
                style={{
                  height: 34,
                  padding: '0 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#2a2a2a',
                  background: 'transparent',
                  border: 'none',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ color: 'rgba(0, 0, 0, 0.4)', display: 'flex' }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Divider */}
        {createItems.length > 0 && mediaItems.length > 0 && (
          <div
            style={{
              height: 1,
              margin: '4px 14px',
              background: 'rgba(0, 0, 0, 0.06)',
            }}
          />
        )}

        {/* Media group */}
        {mediaItems.length > 0 && (
          <div style={{ padding: '2px 6px 8px' }}>
            {mediaItems.map((item) => (
              <button
                key={item.action}
                onClick={() => {
                  onSelect(item.action);
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 cursor-pointer"
                style={{
                  height: 34,
                  padding: '0 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#2a2a2a',
                  background: 'transparent',
                  border: 'none',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ color: 'rgba(0, 0, 0, 0.4)', display: 'flex' }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {filtered.length === 0 && (
          <div
            style={{
              padding: '16px 16px 20px',
              textAlign: 'center',
              fontSize: 13,
              color: 'rgba(0, 0, 0, 0.35)',
            }}
          >
            No matching tools
          </div>
        )}
      </div>
    </div>
  );
}
