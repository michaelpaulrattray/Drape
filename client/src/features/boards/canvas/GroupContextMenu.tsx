/**
 * GroupContextMenu — right-click on a multi-selection (D-50.1: PARITY with
 * the group toolbar — same actions, two surfaces). Duplicate · Download all
 * · Focus · Delete, plus the reserved Run all slot (D-50.4).
 */
import { useEffect, useRef } from "react";
import { Copy, Download, Maximize, Play, Trash2, type LucideIcon } from "lucide-react";

export type GroupAction = "duplicate" | "download" | "focus" | "delete";

const ITEMS: Array<{ action: GroupAction | "runAll"; label: (n: number) => string; icon: LucideIcon; danger?: boolean; disabled?: boolean }> = [
  { action: "duplicate", label: (n) => `Duplicate ${n}`, icon: Copy },
  { action: "download", label: () => "Download all", icon: Download },
  { action: "focus", label: () => "Focus", icon: Maximize },
  { action: "runAll", label: () => "Run all", icon: Play, disabled: true },
  { action: "delete", label: (n) => `Delete ${n}`, icon: Trash2, danger: true },
];

export function GroupContextMenu({
  x,
  y,
  itemIds,
  onAction,
  onClose,
}: {
  x: number;
  y: number;
  itemIds: number[];
  onAction: (action: GroupAction, itemIds: number[]) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const menuW = 200;
  const pad = 12;
  const left = Math.max(pad, Math.min(x, window.innerWidth - menuW - pad));
  const top = Math.max(pad, Math.min(y, window.innerHeight - 200 - pad));

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-md py-1"
      style={{ left, top, width: menuW }}
    >
      <div className="px-3 pt-1.5 pb-1 text-canvas-xs text-canvas-ink-faint">
        {itemIds.length} selected
      </div>
      {ITEMS.map(({ action, label, icon: Icon, danger, disabled }) => (
        <button
          key={action}
          type="button"
          disabled={disabled}
          title={disabled ? "Runs the selected flow — arrives with consumer nodes" : undefined}
          className={
            danger
              ? "w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-canvas-sm text-canvas-destructive hover:bg-canvas-surface-inset transition-colors"
              : "w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-canvas-sm text-canvas-ink hover:bg-canvas-surface-inset transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
          }
          onClick={() => {
            if (action === "runAll") return;
            onAction(action, itemIds);
            onClose();
          }}
        >
          <Icon className="w-3.5 h-3.5 opacity-60" strokeWidth={1.6} />
          <span>{label(itemIds.length)}</span>
        </button>
      ))}
    </div>
  );
}
