/**
 * DeleteOverlayButton — Standardized delete button used across all lobby cards.
 *
 * Frosted-glass dark circle with Trash icon. Subtle hover (slightly lighter).
 * Appears on parent hover via group-hover. Supports optional
 * double-tap confirmation for destructive actions.
 *
 * Variants:
 *  - "overlay" (default): positioned absolute on image cards
 *  - "inline": static positioning for row-based layouts
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { Trash2, Loader2 } from "lucide-react";

type Placement = "top-right" | "top-left";

interface DeleteOverlayButtonProps {
  onClick: (e: React.MouseEvent) => void;
  /** Show spinner instead of icon */
  isDeleting?: boolean;
  /** Require double-tap to confirm */
  requireConfirm?: boolean;
  /** Button diameter in px */
  size?: number;
  /** Absolute placement on parent — ignored when variant is "inline" */
  placement?: Placement;
  /** "overlay" = absolute positioned, "inline" = static in flex row */
  variant?: "overlay" | "inline";
  /** Custom title / tooltip */
  title?: string;
}

const CONFIRM_TIMEOUT_MS = 2000;

const PLACEMENT_STYLES: Record<Placement, React.CSSProperties> = {
  "top-right": { top: 6, right: 6 },
  "top-left": { top: 6, left: 6 },
};

export function DeleteOverlayButton({
  onClick,
  isDeleting = false,
  requireConfirm = false,
  size = 24,
  placement = "top-right",
  variant = "overlay",
  title,
}: DeleteOverlayButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear confirm timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (isDeleting) return;

      if (requireConfirm && !isConfirming) {
        setIsConfirming(true);
        timerRef.current = setTimeout(() => setIsConfirming(false), CONFIRM_TIMEOUT_MS);
        return;
      }

      // Either no confirm needed, or second tap
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsConfirming(false);
      onClick(e);
    },
    [onClick, isDeleting, requireConfirm, isConfirming],
  );

  const iconSize = Math.round(size * 0.5);

  const baseStyle: React.CSSProperties = {
    width: size,
    height: size,
    background: isConfirming ? "rgba(239,68,68,0.7)" : "rgba(0,0,0,0.45)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    cursor: "pointer",
    transition: "background 0.15s ease, opacity 0.15s ease",
    ...(variant === "overlay" ? PLACEMENT_STYLES[placement] : {}),
  };

  const resolvedTitle = isConfirming
    ? "Tap again to confirm"
    : title || "Delete";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent);
        }
      }}
      className={[
        "flex items-center justify-center rounded-full z-10",
        variant === "overlay"
          ? "absolute opacity-0 group-hover:opacity-100"
          : "flex-shrink-0 opacity-0 group-hover:opacity-100",
      ].join(" ")}
      style={baseStyle}
      title={resolvedTitle}
      onMouseEnter={(e) => {
        if (!isConfirming) {
          (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.6)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isConfirming) {
          (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.45)";
        }
      }}
    >
      {isDeleting ? (
        <Loader2
          style={{ width: iconSize, height: iconSize, color: "#fff" }}
          className="animate-spin"
        />
      ) : (
        <Trash2 style={{ width: iconSize, height: iconSize, color: "#fff" }} />
      )}
    </div>
  );
}
