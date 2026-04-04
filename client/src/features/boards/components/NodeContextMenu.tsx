/**
 * NodeContextMenu — Right-click context menu for canvas nodes.
 *
 * Features:
 *  - Inline prompt input for quick iteration ("Start typing...")
 *  - Model actions: Modify / Iterate, Generate Views (expanding submenu)
 *  - AI Tools: Wardrobe, Remove Background, Upscale, Extract Palette
 *  - Edit: Rename (triggers inline rename on node)
 *  - File: Open in New Tab, Download Image (fetch+blob), Copy Image (clipboard)
 *  - Info: Shows cast image details
 *  - Danger: Delete
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Shirt,
  Eraser,
  ArrowUpRight,
  Pencil,
  ExternalLink,
  Download,
  ClipboardCopy,
  Trash2,
  ChevronRight,
  RotateCcw,
  Camera,
  Info,
  Palette,
  Send,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

/* ── Types ────────────────────────────────────────────────── */

export type ViewAngle = 'front' | 'side' | 'back' | 'three_quarter' | 'all';

export type NodeContextAction =
  | 'modify_iterate'
  | 'generate_views'
  | 'wardrobe'
  | 'remove_bg'
  | 'upscale'
  | 'extract_palette'
  | 'rename'
  | 'open_new_tab'
  | 'download'
  | 'copy_image'
  | 'info'
  | 'delete';

type MenuItem = {
  action: NodeContextAction;
  label: string;
  icon: LucideIcon;
  group: 'model' | 'ai' | 'edit' | 'file' | 'danger';
  hasSubmenu?: boolean;
  modelOnly?: boolean;
};

const MENU_ITEMS: MenuItem[] = [
  { action: 'modify_iterate', label: 'Modify / Iterate', icon: RotateCcw, group: 'model', modelOnly: true },
  { action: 'generate_views', label: 'Generate Views', icon: Camera, group: 'model', hasSubmenu: true, modelOnly: true },
  { action: 'wardrobe', label: 'Wardrobe', icon: Shirt, group: 'ai', hasSubmenu: true },
  { action: 'remove_bg', label: 'Remove Background', icon: Eraser, group: 'ai' },
  { action: 'upscale', label: 'Upscale Image', icon: ArrowUpRight, group: 'ai' },
  { action: 'extract_palette', label: 'Extract Palette', icon: Palette, group: 'ai' },
  { action: 'rename', label: 'Rename', icon: Pencil, group: 'edit' },
  { action: 'info', label: 'Info', icon: Info, group: 'edit' },
  { action: 'open_new_tab', label: 'Open in New Tab', icon: ExternalLink, group: 'file' },
  { action: 'download', label: 'Download Image', icon: Download, group: 'file' },
  { action: 'copy_image', label: 'Copy Image', icon: ClipboardCopy, group: 'file' },
  { action: 'delete', label: 'Delete', icon: Trash2, group: 'danger' },
];

const VIEW_OPTIONS: { id: ViewAngle; label: string }[] = [
  { id: 'front', label: 'Front View' },
  { id: 'side', label: 'Side View' },
  { id: 'back', label: 'Back View' },
  { id: 'three_quarter', label: '3/4 View' },
  { id: 'all', label: 'All Views' },
];

/* ── Helpers ──────────────────────────────────────────────── */

/** Build a same-origin proxy URL to bypass CORS for S3 images */
function proxyUrl(originalUrl: string, download = false): string {
  const params = new URLSearchParams({ url: originalUrl });
  if (download) params.set('download', '1');
  return `/api/image-proxy?${params.toString()}`;
}

async function downloadImage(url: string, filename: string) {
  try {
    // Use server proxy — sets Content-Disposition: attachment
    const a = document.createElement('a');
    a.href = proxyUrl(url, true);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Image downloading...');
  } catch {
    window.open(url, '_blank');
    toast.info('Opened image in new tab');
  }
}

async function copyImageToClipboard(url: string) {
  try {
    // Fetch through our proxy (same-origin, no CORS issues)
    const res = await fetch(proxyUrl(url));
    if (!res.ok) throw new Error('Proxy fetch failed');
    const blob = await res.blob();
    // Convert to PNG for clipboard compatibility
    const pngBlob = blob.type === 'image/png'
      ? blob
      : await convertToPng(blob);
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': pngBlob }),
    ]);
    toast.success('Image copied to clipboard');
  } catch {
    // Fallback: copy URL
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Image URL copied (image copy not supported in this browser)');
    } catch {
      toast.error('Failed to copy image');
    }
  }
}

function convertToPng(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No canvas context'));
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('toBlob failed'));
      }, 'image/png');
    };
    img.onerror = reject;
    img.crossOrigin = 'anonymous';
    img.src = URL.createObjectURL(blob);
  });
}

/* ── Props ────────────────────────────────────────────────── */

type NodeContextMenuProps = {
  position: { x: number; y: number };
  nodeId: number;
  nodeType: string;
  imageUrl: string | null;
  onAction: (action: NodeContextAction, nodeId: number) => void;
  onViewGenerate: (nodeId: number, angle: ViewAngle) => void;
  onPromptSubmit: (nodeId: number, prompt: string) => void;
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
  onPromptSubmit,
  onClose,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLInputElement>(null);
  const [expandedSubmenu, setExpandedSubmenu] = useState<NodeContextAction | null>(null);
  const [promptText, setPromptText] = useState('');

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

  // Focus prompt input on mount
  useEffect(() => {
    const timer = setTimeout(() => promptRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  // Clamp position to viewport
  const adjustedPosition = (() => {
    const menuW = 248;
    const menuH = 520;
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
    if (item.modelOnly && !isModel) return false;
    if (!imageUrl && ['open_new_tab', 'download', 'copy_image', 'remove_bg', 'upscale', 'wardrobe', 'extract_palette'].includes(item.action)) {
      return false;
    }
    return true;
  });

  const groups = ['model', 'ai', 'edit', 'file', 'danger'] as const;

  const handlePromptSubmit = useCallback(() => {
    const text = promptText.trim();
    if (!text) return;
    onPromptSubmit(nodeId, text);
    onClose();
  }, [promptText, nodeId, onPromptSubmit, onClose]);

  const handleItemClick = (item: MenuItem) => {
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
        @keyframes submenuSlideIn {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 200px; }
        }
      `}</style>

      <div
        className="overflow-visible"
        style={{
          width: 248,
          borderRadius: 12,
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(20px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
      >
        {/* Prompt input at top */}
        <div style={{ padding: '8px 8px 4px 8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(0, 0, 0, 0.04)',
              borderRadius: 8,
              padding: '0 10px',
              height: 36,
            }}
          >
            <input
              ref={promptRef}
              type="text"
              placeholder="Start typing..."
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') handlePromptSubmit();
              }}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 13,
                color: '#2a2a2a',
                padding: 0,
              }}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePromptSubmit();
              }}
              disabled={!promptText.trim()}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: promptText.trim() ? 'pointer' : 'default',
                color: promptText.trim() ? '#1a1a1a' : 'rgba(0, 0, 0, 0.2)',
                display: 'flex',
                transition: 'color 0.15s ease',
              }}
            >
              <Send className="w-[14px] h-[14px]" />
            </button>
          </div>
        </div>

        {/* Divider after prompt */}
        <div style={{ height: 1, margin: '4px 14px', background: 'rgba(0, 0, 0, 0.06)' }} />

        {/* Menu items */}
        <div style={{ padding: '0 0 4px 0' }}>
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

                        {/* Generate Views submenu */}
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
