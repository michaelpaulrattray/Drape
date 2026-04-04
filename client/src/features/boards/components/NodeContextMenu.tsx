/**
 * NodeContextMenu — Right-click context menu for canvas nodes (images/models).
 *
 * Shows context-aware actions grouped by category:
 *  - Model actions: Modify / Iterate, Generate Views (expanding submenu)
 *  - AI Tools: Style Outfit, Remove Background, Upscale
 *  - Edit: Rename, Duplicate
 *  - File: Open in New Tab, Download, Copy URL
 *  - Danger: Delete
 *
 * Styled as frosted-glass dropdown matching AddNodeMenu's visual language.
 */
import { useEffect, useRef, useState } from 'react';
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
  RotateCcw,
  Camera,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

/* ── Types ────────────────────────────────────────────────── */

export type ViewAngle = 'front' | 'side' | 'back' | 'three_quarter' | 'all';

export type NodeContextAction =
  | 'modify_iterate'
  | 'generate_views'
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
  group: 'model' | 'ai' | 'edit' | 'file' | 'danger';
  /** Show a chevron indicating a submenu */
  hasSubmenu?: boolean;
  /** Only show for model-type nodes */
  modelOnly?: boolean;
};

const MENU_ITEMS: MenuItem[] = [
  { action: 'modify_iterate', label: 'Modify / Iterate', icon: RotateCcw, group: 'model', modelOnly: true },
  { action: 'generate_views', label: 'Generate Views', icon: Camera, group: 'model', hasSubmenu: true, modelOnly: true },
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

const VIEW_OPTIONS: { id: ViewAngle; label: string }[] = [
  { id: 'front', label: 'Front View' },
  { id: 'side', label: 'Side View' },
  { id: 'back', label: 'Back View' },
  { id: 'three_quarter', label: '3/4 View' },
  { id: 'all', label: 'All Views' },
];

/* ── Props ────────────────────────────────────────────────── */

type NodeContextMenuProps = {
  position: { x: number; y: number };
  nodeId: number;
  nodeType: string;
  imageUrl: string | null;
  onAction: (action: NodeContextAction, nodeId: number) => void;
  onViewGenerate: (nodeId: number, angle: ViewAngle) => void;
  onClose: () => void;
};

/* ── Component ────────────────────────────────────────────── */

export function NodeContextMenu({
  position,
  nodeId,
  nodeType,
  imageUrl,
  onAction,
  onViewGenerate,
  onClose,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [expandedSubmenu, setExpandedSubmenu] = useState<NodeContextAction | null>(null);

  const isModel = nodeType === 'model';

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
    const menuH = 480;
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

  // Filter items based on node type and image availability
  const visibleItems = MENU_ITEMS.filter((item) => {
    // Hide model-only items for non-model nodes
    if (item.modelOnly && !isModel) return false;
    // Hide image-dependent actions when there's no image
    if (!imageUrl && ['open_new_tab', 'download', 'copy_url', 'remove_bg', 'upscale', 'style_outfit'].includes(item.action)) {
      return false;
    }
    return true;
  });

  const groups = ['model', 'ai', 'edit', 'file', 'danger'] as const;

  const handleItemClick = (item: MenuItem) => {
    // Items with submenus toggle the submenu instead of firing action
    if (item.action === 'generate_views') {
      setExpandedSubmenu((prev) => (prev === 'generate_views' ? null : 'generate_views'));
      return;
    }

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
        @keyframes submenuSlideIn {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 200px; }
        }
      `}</style>

      <div
        className="overflow-visible"
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

            // Check if any previous group had visible items for divider logic
            const prevGroupsHaveItems = groups
              .slice(0, gi)
              .some((g) => visibleItems.some((i) => i.group === g));

            return (
              <div key={group}>
                {/* Divider between groups */}
                {prevGroupsHaveItems && (
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
                    const isExpanded = expandedSubmenu === item.action;

                    return (
                      <div key={item.action}>
                        <button
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
                          {item.hasSubmenu && (
                            <ChevronRight
                              className="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-150"
                              style={{
                                color: 'rgba(0, 0, 0, 0.25)',
                                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                              }}
                            />
                          )}
                        </button>

                        {/* Generate Views submenu — inline expansion */}
                        {item.action === 'generate_views' && isExpanded && (
                          <div
                            style={{
                              overflow: 'hidden',
                              animation: 'submenuSlideIn 0.15s ease-out forwards',
                              paddingLeft: 8,
                            }}
                          >
                            {VIEW_OPTIONS.map((view) => (
                              <button
                                key={view.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onViewGenerate(nodeId, view.id);
                                  onClose();
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                }}
                                className="w-full flex items-center gap-2.5 cursor-pointer"
                                style={{
                                  height: 32,
                                  padding: '0 10px',
                                  borderRadius: 7,
                                  fontSize: 12,
                                  fontWeight: 500,
                                  color: view.id === 'all' ? '#1a1a1a' : '#555',
                                  background: 'transparent',
                                  border: 'none',
                                  transition: 'background 0.1s ease',
                                }}
                              >
                                <span
                                  style={{
                                    width: 4,
                                    height: 4,
                                    borderRadius: 2,
                                    background: view.id === 'all' ? '#1a1a1a' : 'rgba(0, 0, 0, 0.2)',
                                    flexShrink: 0,
                                  }}
                                />
                                <span>{view.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
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
