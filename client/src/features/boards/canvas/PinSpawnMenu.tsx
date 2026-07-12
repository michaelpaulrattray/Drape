/**
 * PinSpawnMenu — the D-36a pin-initiated spawn gesture, scoped to pass 1
 * (founder-ruled at R5 planning): dragging from a cast's out-pin into empty
 * canvas offers the six package slots; choosing one spawns that view
 * popped-out at the drop point, pre-connected by its lineage edge.
 *
 * Filled + unpopped slots are live; ghosts point at the casting environment
 * (view generation never happens on the canvas — D-35/D-46); already-popped
 * slots say so. Consumer node types join this menu with pass 2/3.
 *
 * Data comes from the packageState cache (prefetched on board load, D-38) —
 * the menu opens instantly.
 */
import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import type { CanonicalViewAngle } from "@shared/boardTypes";

export interface PinSpawnMenuProps {
  itemId: number;
  modelId: number;
  /** Screen-space drop point (menu position). */
  x: number;
  y: number;
  /** Flow-space drop point (where the pop-out lands). */
  flowX: number;
  flowY: number;
  /** Angles already popped out for this root. */
  poppedAngles: ReadonlySet<CanonicalViewAngle>;
  onClose: () => void;
}

export function PinSpawnMenu({ itemId, modelId, x, y, flowX, flowY, poppedAngles, onClose }: PinSpawnMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { data } = trpc.generation.packageState.useQuery({ modelId }, { staleTime: 15_000 });

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

  // Clamp to viewport
  const menuW = 208;
  const menuH = 232;
  const pad = 12;
  const left = Math.max(pad, Math.min(x, window.innerWidth - menuW - pad));
  const top = Math.max(pad, Math.min(y, window.innerHeight - menuH - pad));

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-md py-1"
      style={{ left, top, width: menuW }}
    >
      <div className="px-3 pt-1.5 pb-1 text-canvas-xs text-canvas-ink-faint">Pop out a view</div>
      {(data?.slots ?? []).map((slot) => {
        const popped = poppedAngles.has(slot.angle);
        const live = slot.filled && !popped;
        return (
          <button
            key={slot.angle}
            type="button"
            disabled={!live}
            title={
              !slot.filled
                ? "Add in the casting environment"
                : popped
                  ? "Already on the board"
                  : undefined
            }
            className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-canvas-sm text-canvas-ink hover:bg-canvas-surface-inset transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("board-pop-out-view", {
                  detail: { itemId, angle: slot.angle, position: { x: flowX, y: flowY } },
                }),
              );
              onClose();
            }}
          >
            <span>{slot.label}</span>
            {!slot.filled ? (
              <span className="text-canvas-xs text-canvas-ink-faint">not cast</span>
            ) : popped ? (
              <span className="text-canvas-xs text-canvas-ink-faint">⤢</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
