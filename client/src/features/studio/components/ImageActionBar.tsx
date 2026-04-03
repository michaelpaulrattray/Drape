/**
 * ImageActionBar — Higgsfield-style floating action icons for images.
 *
 * Renders a vertical stack of frosted-glass icon buttons in the top-right
 * corner of the image. Shows on hover, fades out when not hovered.
 *
 * Icons (top to bottom):
 *   - Heart/Like (wardrobe/export only, NOT casting)
 *   - Download
 *   - Copy to clipboard
 *   - Triple-dot menu (Retry, Keyboard Shortcuts, etc.)
 */
import { useState, useRef, useEffect } from "react";
import { Heart, Download, Copy, MoreVertical, RefreshCw } from "lucide-react";
import { toast } from "sonner";

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

// ── Shared icon button style ──

const ICON_SIZE = 18;

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
      className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
      style={{
        background: active ? "#1a1a1a" : "rgba(0,0,0,0.45)",
        color: active ? "#fff" : "rgba(255,255,255,0.9)",
        backdropFilter: "blur(12px)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.background = "rgba(0,0,0,0.65)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = active ? "#1a1a1a" : "rgba(0,0,0,0.45)";
        }
      }}
    >
      {children}
    </button>
  );
}

// ── Menu dropdown ──

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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute top-0 right-full mr-2 z-50"
      style={{
        minWidth: 160,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(16px)",
        borderRadius: 12,
        padding: "6px 0",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
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
          <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "4px 0" }} />
          <div style={{ padding: "6px 12px 4px", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Shortcuts
          </div>
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between px-3 py-1.5"
              style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}
            >
              <span>{s.label}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "monospace",
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.5)",
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
      style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", background: "transparent" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
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

  const handleDownload = async () => {
    if (!imageUrl) return;
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `drape-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Image saved to your device");
    } catch {
      toast.error("Could not download the image");
    }
  };

  const handleCopy = async () => {
    if (!imageUrl) return;
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
      toast.success("Image copied to clipboard");
    } catch {
      toast.error("Could not copy the image");
    }
  };

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
        disabled={!imageUrl || isGenerating}
      >
        <Download size={ICON_SIZE} strokeWidth={2} />
      </ActionButton>

      <ActionButton
        onClick={handleCopy}
        title="Copy to clipboard"
        disabled={!imageUrl || isGenerating}
      >
        {copyFeedback ? (
          <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <Copy size={ICON_SIZE} strokeWidth={2} />
        )}
      </ActionButton>

      <div className="relative">
        <ActionButton
          onClick={() => setMenuOpen(!menuOpen)}
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
