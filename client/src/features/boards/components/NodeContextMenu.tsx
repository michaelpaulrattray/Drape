/**
 * NodeContextMenu — Right-click context menu for canvas nodes (images/models).
 *
 * Shows image-specific actions grouped by category:
 *  - AI Tools: Style Outfit, Remove Background, Upscale
 *  - Edit: Rename, Duplicate
 *  - File: Open in New Tab, Download, Copy URL
 *  - Danger: Delete
 *
 * Styled as frosted-glass dropdown matching AddNodeMenu's visual language.
 */
import { useEffect, useRef } from 'react';
import {
  Shirt,
  Eraser,
  ArrowUpRight,
  Pencil,
  Copy,
  ExternalLink,
  Download,
  Link,
  Trash2,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

/* ── Types ────────────────────────────────────────────────── */

export type NodeContextAction =
  | 'style_outfit'
  | 'remove_bg'
  | 'upscale'
  | 'rename'
  | 'duplicate'
  | 'open_new_tab'
  | 'download'
  | 'copy_url'
  | 'delete';

type MenuItem = {
  action: NodeContextAction;
  label: string;
  icon: LucideIcon;
  group: 'ai' | 'edit' | 'file' | 'danger';
  /** Show a chevron indicating a submenu (visual only for now) */
  hasSubmenu?: boolean;
};

const MENU_ITEMS: MenuItem[] = [
  { action: 'style_outfit', label: 'Style Outfit', icon: Shirt, group: 'ai', hasSubmenu: true },
  { action: 'remove_bg', label: 'Remove Background', icon: Eraser, group: 'ai' },
  { action: 'upscale', label: 'Upscale Image', icon: ArrowUpRight, group: 'ai' },
  { action: 'rename', label: 'Rename', icon: Pencil, group: 'edit' },
  { action: 'duplicate', label: 'Duplicate', icon: Copy, group: 'edit' },
  { action: 'open_new_tab', label: 'Open in New Tab', icon: ExternalLink, group: 'file' },
  { action: 'download', label: 'Download Image', icon: Download, group: 'file' },
  { action: 'copy_url', label: 'Copy Image URL', icon: Link, group: 'file' },
  { action: 'delete', label: 'Delete', icon: Trash2, group: 'danger' },
];

/* ── Props ────────────────────────────────────────────────── */

type NodeContextMenuProps = {
  position: { x: number; y: number };
  nodeId: number;
  imageUrl: string | null;
  onAction: (action: NodeContextAction, nodeId: number) => void;
  onClose: () => void;
};

/* ── Component ────────────────────────────────────────────── */

export function NodeContextMenu({
  position,
  nodeId,
  imageUrl,
  onAction,
  onClose,
}: NodeContextMenuProps) {
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

  // Clamp position to viewport
  const adjustedPosition = (() => {
    const menuW = 240;
    const menuH = 420;
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

  // Filter out image-dependent actions when there's no image
  const visibleItems = imageUrl
    ? MENU_ITEMS
    : MENU_ITEMS.filter(
        (i) => !['open_new_tab', 'download', 'copy_url', 'remove_bg', 'upscale', 'style_outfit'].includes(i.action),
      );

  const groups = ['ai', 'edit', 'file', 'danger'] as const;

  const handleItemClick = (item: MenuItem) => {
    // Handle file actions inline
    if (item.action === 'open_new_tab' && imageUrl) {
      window.open(imageUrl, '_blank');
      onClose();
      return;
    }
    if (item.action === 'download' && imageUrl) {
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = `image-${nodeId}.png`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Download started');
      onClose();
      return;
    }
    if (item.action === 'copy_url' && imageUrl) {
      navigator.clipboard.writeText(imageUrl);
      toast.success('Image URL copied');
      onClose();
      return;
    }

    onAction(item.action, nodeId);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-[100]"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        animation: 'nodeCtxMenuIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes nodeCtxMenuIn {
          from { opacity: 0; transform: scale(0.95) translateY(-4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <div
        className="overflow-hidden"
        style={{
          width: 240,
          borderRadius: 12,
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(20px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
      >
        <div style={{ padding: '4px 0' }}>
          {groups.map((group, gi) => {
            const groupItems = visibleItems.filter((i) => i.group === group);
            if (groupItems.length === 0) return null;

            return (
              <div key={group}>
                {/* Divider between groups */}
                {gi > 0 && visibleItems.some((i) => i.group === groups[gi - 1]) && (
                  <div
                    style={{
                      height: 1,
                      margin: '4px 14px',
                      background: 'rgba(0, 0, 0, 0.06)',
                    }}
                  />
                )}

                <div style={{ padding: '0 4px' }}>
                  {groupItems.map((item) => {
                    const Icon = item.icon;
                    const isDanger = item.group === 'danger';

                    return (
                      <button
                        key={item.action}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleItemClick(item);
                        }}
                        className="w-full flex items-center gap-2.5 cursor-pointer"
                        style={{
                          height: 34,
                          padding: '0 10px',
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 500,
                          color: isDanger ? '#dc2626' : '#2a2a2a',
                          background: 'transparent',
                          border: 'none',
                          transition: 'background 0.1s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isDanger
                            ? 'rgba(220, 38, 38, 0.06)'
                            : 'rgba(0, 0, 0, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <span
                          style={{
                            color: isDanger ? '#dc2626' : 'rgba(0, 0, 0, 0.4)',
                            display: 'flex',
                            flexShrink: 0,
                          }}
                        >
                          <Icon className="w-[15px] h-[15px]" />
                        </span>
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.hasSubmenu && (
                          <ChevronRight
                            className="w-3.5 h-3.5 flex-shrink-0"
                            style={{ color: 'rgba(0, 0, 0, 0.25)' }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
