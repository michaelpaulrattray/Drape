/**
 * NodeContextMenu — Right-click context menu for canvas nodes.
 *
 * Stripped to what is real today (founder directive, 2026-07-11 post-VC-R1):
 * Rename, Info, Download, Copy Image, Delete. The legacy prompt-iterate row,
 * Modify/Iterate, Generate Views, and the AI-tools group are gone — casual
 * iteration on minted casts contradicts D-11, view generation predates the
 * package design (D-39), and those capabilities return through their proper
 * milestones (R3 edit path, R5 package).
 */
import { useEffect, useRef } from 'react';
import {
  Pencil,
  Download,
  ClipboardCopy,
  Trash2,
  Info,
  type LucideIcon,
} from 'lucide-react';
import { downloadImage, copyImageToClipboard } from '../canvas/imageActions';

/* ── Types ────────────────────────────────────────────────── */

export type NodeContextAction =
  | 'rename'
  | 'download'
  | 'copy_image'
  | 'info'
  | 'delete';

type MenuItem = {
  action: NodeContextAction;
  label: string;
  icon: LucideIcon;
  group: 'edit' | 'file' | 'danger';
};

const MENU_ITEMS: MenuItem[] = [
  { action: 'rename', label: 'Rename', icon: Pencil, group: 'edit' },
  { action: 'info', label: 'Info', icon: Info, group: 'edit' },
  { action: 'download', label: 'Download Image', icon: Download, group: 'file' },
  { action: 'copy_image', label: 'Copy Image', icon: ClipboardCopy, group: 'file' },
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
    const menuW = 208;
    const menuH = 220;
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

  // Image actions only make sense once an image exists
  const visibleItems = MENU_ITEMS.filter(
    (item) => imageUrl || !['download', 'copy_image'].includes(item.action),
  );

  const groups = ['edit', 'file', 'danger'] as const;

  const handleItemClick = (item: MenuItem) => {
    if (item.action === 'download' && imageUrl) {
      downloadImage(imageUrl, `drape-${nodeId}.png`);
      onClose();
      return;
    }
    if (item.action === 'copy_image' && imageUrl) {
      copyImageToClipboard(imageUrl);
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
        style={{
          width: 208,
          borderRadius: 12,
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(20px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)',
          padding: '4px 0',
        }}
      >
        {groups.map((group, gi) => {
          const groupItems = visibleItems.filter((i) => i.group === group);
          if (groupItems.length === 0) return null;

          const prevGroupsHaveItems = groups
            .slice(0, gi)
            .some((g) => visibleItems.some((i) => i.group === g));

          return (
            <div key={group}>
              {prevGroupsHaveItems && (
                <div style={{ height: 1, margin: '4px 14px', background: 'rgba(0, 0, 0, 0.06)' }} />
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
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isDanger
                          ? 'rgba(220, 38, 38, 0.06)'
                          : 'rgba(0, 0, 0, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
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
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
