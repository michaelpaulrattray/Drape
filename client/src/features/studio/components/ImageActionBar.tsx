/**
 * ImageActionBar — Higgsfield-style floating action icons for images.
 *
 * White frosted glass style (matching surgical ToolButton aesthetic).
 * Renders a vertical stack of icon buttons in the top-right corner.
 * Shows on hover, fades out when not hovered.
 *
 * Icons (top to bottom):
 *   - Heart/Like (wardrobe/export only, NOT casting)
 *   - Download (via server proxy for CORS)
 *   - Copy to clipboard (via server proxy for CORS)
 *   - Triple-dot menu (opens to the LEFT, toggles on click)
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Heart, Download, Copy, MoreVertical, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { triggerDownload } from "@/lib/triggerDownload";

// ── Types ──

export interface ImageActionBarProps {
  /** Whether the bar is visible (tied to parent hover state) */
  visible: boolean;
  /** Show heart/like icon (false for casting) */
  showHeart?: boolean;
  /** Whether the image is already liked/saved */
  isLiked?: boolean;
  /** Callback when heart is clicked */
  onLike?: () => void;
  /** Image URL for download and copy */
  imageUrl: string | null;
  /** Callback for retry/regenerate */
  onRetry?: () => void;
  /** Whether generating (disables actions) */
  isGenerating?: boolean;
  /** Optional custom menu items */
  extraMenuItems?: { label: string; onClick: () => void }[];
  /** Keyboard shortcuts to show in menu */
  shortcuts?: { key: string; label: string }[];
}

// ── Shared icon button style (white frosted glass — matches surgical ToolButton) ──

const ICON_SIZE = 17;

function ActionButton({
  onClick,
  title,
  children,
  active = false,
  disabled = false,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (!disabled) onClick(); }}
      disabled={disabled}
      title={title}
      className={
        active
          ? "w-9 h-9 rounded-canvas-md flex items-center justify-center transition-colors bg-canvas-ink text-canvas-surface"
          : "w-9 h-9 rounded-canvas-md flex items-center justify-center transition-colors bg-canvas-surface border-hairline border-canvas-border text-canvas-ink-soft hover:text-canvas-ink hover:border-canvas-border-strong"
      }
      style={{
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

// ── Menu dropdown (opens to the LEFT of the triple-dot button) ──

function ActionMenu({
  isOpen,
  onClose,
  onRetry,
  shortcuts,
  extraItems,
  toggleRef,
}: {
  isOpen: boolean;
  onClose: () => void;
  onRetry?: () => void;
  shortcuts?: { key: string; label: string }[];
  extraItems?: { label: string; onClick: () => void }[];
  toggleRef: React.RefObject<HTMLDivElement | null>;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // Skip if click is inside the menu itself
      if (menuRef.current && menuRef.current.contains(target)) return;
      // Skip if click is on the toggle button (let the button's own toggle handle it)
      if (toggleRef.current && toggleRef.current.contains(target)) return;
      onClose();
    };
    // Attach on next frame to avoid the opening click from triggering close
    const raf = requestAnimationFrame(() => {
      document.addEventListener("mousedown", handleClickOutside);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, toggleRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute top-0 right-full mr-2 z-50 rounded-canvas-md bg-canvas-surface border-hairline border-canvas-border-strong"
      style={{ minWidth: 170, padding: "6px 0" }}
      onClick={(e) => e.stopPropagation()}
    >
      {onRetry && (
        <MenuButton
          icon={<RefreshCw size={14} />}
          label="Retry"
          onClick={() => { onRetry(); onClose(); }}
        />
      )}

      {extraItems?.map((item) => (
        <MenuButton
          key={item.label}
          label={item.label}
          onClick={() => { item.onClick(); onClose(); }}
        />
      ))}

      {shortcuts && shortcuts.length > 0 && (
        <>
          <div className="border-t-hairline border-canvas-border my-1" />
          <div className="px-3 pt-1.5 pb-1 text-canvas-xs font-medium text-canvas-ink-faint">
            Shortcuts
          </div>
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between px-3 py-1.5 text-canvas-md text-canvas-ink-soft"
            >
              <span>{s.label}</span>
              <span className="text-canvas-sm font-medium font-mono px-[5px] py-px rounded-sm bg-canvas-surface-inset text-canvas-ink-faint">
                {s.key}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 transition-colors bg-transparent text-canvas-ink-soft hover:bg-canvas-surface-inset"
      style={{ fontSize: 13 }}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Main component ──

export function ImageActionBar({
  visible,
  showHeart = false,
  isLiked = false,
  onLike,
  imageUrl,
  onRetry,
  isGenerating = false,
  extraMenuItems,
  shortcuts,
}: ImageActionBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleBtnRef = useRef<HTMLDivElement>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const proxyImageMutation = trpc.generation.proxyImage.useMutation();

  const handleDownload = useCallback(async () => {
    if (!imageUrl || isDownloading) return;
    setIsDownloading(true);
    try {
      const proxy = await proxyImageMutation.mutateAsync({ imageUrl });
      triggerDownload(proxy.base64, `drape-${Date.now()}.png`);
      toast.success("Image saved to your device");
    } catch {
      toast.error("Could not download the image");
    } finally {
      setIsDownloading(false);
    }
  }, [imageUrl, isDownloading, proxyImageMutation]);

  const handleCopy = useCallback(async () => {
    if (!imageUrl || isCopying) return;
    setIsCopying(true);
    try {
      const proxy = await proxyImageMutation.mutateAsync({ imageUrl });
      // Convert base64 data URL to blob
      const [header, b64] = proxy.base64.split(",");
      const mime = header?.match(/:(.*?);/)?.[1] || "image/png";
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mime });
      await navigator.clipboard.write([
        new ClipboardItem({ [mime]: blob }),
      ]);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
      toast.success("Image copied to clipboard");
    } catch {
      toast.error("Could not copy the image");
    } finally {
      setIsCopying(false);
    }
  }, [imageUrl, isCopying, proxyImageMutation]);

  // Close menu when bar hides
  useEffect(() => {
    if (!visible) setMenuOpen(false);
  }, [visible]);

  return (
    <div
      className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 transition-all duration-200"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(8px)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {showHeart && (
        <ActionButton
          onClick={() => onLike?.()}
          title={isLiked ? "Saved to gallery" : "Save to gallery"}
          active={isLiked}
          disabled={!onLike || isLiked}
        >
          <Heart
            size={ICON_SIZE}
            fill={isLiked ? "#fff" : "none"}
            strokeWidth={2}
          />
        </ActionButton>
      )}

      <ActionButton
        onClick={handleDownload}
        title="Download"
        disabled={!imageUrl || isGenerating || isDownloading}
      >
        {isDownloading ? (
          <div className="w-4 h-4 rounded-full border-2 border-canvas-border animate-spin" style={{ borderTopColor: "var(--color-canvas-ink-soft)" }} />
        ) : (
          <Download size={ICON_SIZE} strokeWidth={2} />
        )}
      </ActionButton>

      <ActionButton
        onClick={handleCopy}
        title="Copy to clipboard"
        disabled={!imageUrl || isGenerating || isCopying}
      >
        {copyFeedback ? (
          <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : isCopying ? (
          <div className="w-4 h-4 rounded-full border-2 border-canvas-border animate-spin" style={{ borderTopColor: "var(--color-canvas-ink-soft)" }} />
        ) : (
          <Copy size={ICON_SIZE} strokeWidth={2} />
        )}
      </ActionButton>

      {/* Only render triple-dot if menu would have content */}
      {(onRetry || (extraMenuItems && extraMenuItems.length > 0) || (shortcuts && shortcuts.length > 0)) && (
        <div className="relative" ref={toggleBtnRef}>
          <ActionButton
            onClick={() => setMenuOpen((prev) => !prev)}
            title="More options"
            active={menuOpen}
          >
            <MoreVertical size={ICON_SIZE} strokeWidth={2} />
          </ActionButton>

          <ActionMenu
            isOpen={menuOpen}
            onClose={() => setMenuOpen(false)}
            onRetry={onRetry}
            shortcuts={shortcuts}
            extraItems={extraMenuItems}
            toggleRef={toggleBtnRef}
          />
        </div>
      )}
    </div>
  );
}
