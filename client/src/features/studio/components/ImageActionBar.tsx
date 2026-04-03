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
      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
      style={{
        background: active ? "#1a1a1a" : "rgba(255,255,255,0.85)",
        color: active ? "#fff" : "#71716A",
        boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
        backdropFilter: "blur(8px)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.background = "rgba(255,255,255,0.95)";
          e.currentTarget.style.color = "#1a1a1a";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "rgba(255,255,255,0.85)";
          e.currentTarget.style.color = "#71716A";
        }
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
}: {
  isOpen: boolean;
  onClose: () => void;
  onRetry?: () => void;
  shortcuts?: { key: string; label: string }[];
  extraItems?: { label: string; onClick: () => void }[];
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use setTimeout to avoid the click that opened the menu from immediately closing it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute top-0 right-full mr-2 z-50"
      style={{
        minWidth: 170,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(16px)",
        borderRadius: 12,
        padding: "6px 0",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
      }}
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
          <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "4px 0" }} />
          <div style={{ padding: "6px 12px 4px", fontSize: 10, fontWeight: 600, color: "#A09E96", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Shortcuts
          </div>
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between px-3 py-1.5"
              style={{ fontSize: 12, color: "#52524B" }}
            >
              <span>{s.label}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "monospace",
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: "rgba(0,0,0,0.05)",
                  color: "#A09E96",
                }}
              >
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
      className="w-full flex items-center gap-2 px-3 py-2 transition-colors"
      style={{ fontSize: 13, color: "#52524B", background: "transparent" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
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
      {showHeart && onLike && (
        <ActionButton
          onClick={onLike}
          title={isLiked ? "Remove from gallery" : "Save to gallery"}
          active={isLiked}
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
          <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "#E8E4DF", borderTopColor: "#71716A" }} />
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
          <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "#E8E4DF", borderTopColor: "#71716A" }} />
        ) : (
          <Copy size={ICON_SIZE} strokeWidth={2} />
        )}
      </ActionButton>

      <div className="relative">
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
        />
      </div>
    </div>
  );
}
