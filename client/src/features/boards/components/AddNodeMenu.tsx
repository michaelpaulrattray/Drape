/**
 * AddNodeMenu — the right-click at-cursor add path (ruling B: the flat pill
 * is the stable anchor; this menu survives as the at-cursor accelerator).
 *
 * Offers exactly the pill's addable node types (Cast · Note today — new
 * types join as passes land). The legacy frosted-glass surface with its
 * search box and dead rows (wardrobe panel, coming-soon uploads) retired
 * with the C7 reconcile — a two-row menu needs no search, and an
 * affordance that toasts "coming soon" is a broken promise, not a feature.
 * Canvas tokens throughout (GroupContextMenu's conventions).
 */
import { useEffect, useRef } from 'react';
import { User, StickyNote, type LucideIcon } from 'lucide-react';

export type AddNodeAction = 'cast' | 'note';

const MENU_ITEMS: Array<{ action: AddNodeAction; label: string; icon: LucideIcon }> = [
  { action: 'cast', label: 'Cast model', icon: User },
  { action: 'note', label: 'Add note', icon: StickyNote },
];

type AddNodeMenuProps = {
  position: { x: number; y: number };
  onSelect: (action: AddNodeAction) => void;
  onClose: () => void;
};

export function AddNodeMenu({ position, onSelect, onClose }: AddNodeMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) onClose();
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

  const menuW = 180;
  const pad = 12;
  const left = Math.max(pad, Math.min(position.x, window.innerWidth - menuW - pad));
  const top = Math.max(pad, Math.min(position.y, window.innerHeight - 100 - pad));

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-md py-1"
      style={{ left, top, width: menuW }}
    >
      {MENU_ITEMS.map(({ action, label, icon: Icon }) => (
        <button
          key={action}
          type="button"
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-canvas-sm text-canvas-ink hover:bg-canvas-surface-inset transition-colors"
          onClick={() => onSelect(action)}
        >
          <Icon className="w-3.5 h-3.5 opacity-60" strokeWidth={1.6} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
