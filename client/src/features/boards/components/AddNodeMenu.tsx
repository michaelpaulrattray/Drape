/**
 * AddNodeMenu — Luma/ElevenLabs-style dropdown for adding nodes to the board canvas.
 *
 * Appears on:
 *  - Clicking the "+" empty-state button
 *  - Right-clicking anywhere on the canvas
 *
 * Renders a floating menu with tool options (Cast Model, Style Outfit, Upload Media, Add Note).
 * Positioned absolutely relative to the canvas container.
 */
import { useEffect, useRef } from 'react';
import { User, Shirt, Upload, StickyNote, Image } from 'lucide-react';

export type AddNodeAction = 'cast' | 'wardrobe' | 'upload' | 'note' | 'reference';

type MenuItem = {
  action: AddNodeAction;
  label: string;
  icon: React.ReactNode;
  description?: string;
};

const MENU_ITEMS: MenuItem[] = [
  {
    action: 'cast',
    label: 'Cast Model',
    icon: <User className="w-4 h-4" />,
  },
  {
    action: 'wardrobe',
    label: 'Style Outfit',
    icon: <Shirt className="w-4 h-4" />,
  },
  {
    action: 'reference',
    label: 'Add Reference',
    icon: <Image className="w-4 h-4" />,
  },
  {
    action: 'upload',
    label: 'Upload Media',
    icon: <Upload className="w-4 h-4" />,
  },
  {
    action: 'note',
    label: 'Add Note',
    icon: <StickyNote className="w-4 h-4" />,
  },
];

type AddNodeMenuProps = {
  position: { x: number; y: number };
  onSelect: (action: AddNodeAction) => void;
  onClose: () => void;
};

export function AddNodeMenu({ position, onSelect, onClose }: AddNodeMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

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

    // Delay listener attachment to avoid the triggering click closing the menu
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

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ left: position.x, top: position.y }}
    >
      <div
        className="min-w-[200px] rounded-xl bg-white border border-stone-200/80 shadow-lg overflow-hidden"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)' }}
      >
        {/* Header */}
        <div className="px-4 pt-3 pb-1.5">
          <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
            Add new node
          </span>
        </div>

        {/* Menu items */}
        <div className="py-1 px-1.5">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.action}
              onClick={() => {
                onSelect(item.action);
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-stone-700 hover:bg-stone-50 hover:text-stone-900 transition-colors duration-100 cursor-pointer"
            >
              <span className="text-stone-400">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
