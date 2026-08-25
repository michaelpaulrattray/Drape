/**
 * THE JUDGING SURFACE — the eye gallery's full-size viewer (#75, his second
 * verbatim ask, on his first drive of the gallery: *"only thing id say is the
 * image is to small for me to judge i need to be able to view it in a viewer
 * or somthing by clicking on it"*).
 *
 * A frame he cannot inspect at full size is a frame he cannot judge, and
 * judging is the gallery's whole job. So: click a thumbnail → this lightbox —
 * the frame fit to the screen with a 1:1 toggle, its caption and arm label
 * kept in view (he never loses what he is looking at), and ARROWS between the
 * same item's frames, because a court's arms are compared and paging A→B→C
 * without closing IS the comparison working.
 *
 * Bytes still travel the enumerated `/api/crew/eye-frame/:frameName` route
 * only — the viewer adds no address of any kind. Esc, the close button, and a
 * backdrop click all dismiss; arrow keys page; focus lands on the dialog on
 * open so the keyboard works immediately.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { eyeFrameSrc } from "./eyeFrameSrc";
import type { CrewEyeItem } from "./crewTypes";

type Frame = CrewEyeItem["frames"][number];

export function CrewEyeViewer({
  frames,
  index,
  onNavigate,
  onClose,
}: {
  frames: readonly Frame[];
  index: number;
  onNavigate: (index: number) => void;
  onClose: () => void;
}) {
  /* 1:1 vs fit-to-screen. Reset on every page — a zoom chosen for arm A's
     detail is a stale decision about arm B. */
  const [actualSize, setActualSize] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const frame = frames[index];
  const prev = index > 0 ? index - 1 : null;
  const next = index < frames.length - 1 ? index + 1 : null;

  const page = useCallback(
    (to: number | null) => {
      if (to === null) return;
      setActualSize(false);
      onNavigate(to);
    },
    [onNavigate],
  );

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") page(index > 0 ? index - 1 : null);
      if (event.key === "ArrowRight") page(index < frames.length - 1 ? index + 1 : null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, frames.length, onClose, page]);

  if (!frame) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col"
      style={{ background: "rgba(10, 10, 10, 0.92)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={frame.caption}
      ref={dialogRef}
      tabIndex={-1}
    >
      {/* Top bar: position, 1:1 toggle, close. Stops propagation so its own
          clicks never fall through to the backdrop dismiss. */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="text-[12px] tabular-nums text-white/60">
          {index + 1} / {frames.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActualSize((size) => !size)}
            className="text-[12px] px-2.5 py-1 rounded-full border border-white/25 text-white/80 hover:text-white hover:border-white/60 transition-colors"
          >
            {actualSize ? "Fit to screen" : "View 1:1"}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close viewer"
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* The frame. In fit mode it is bounded by the viewport; at 1:1 the
          container scrolls, so a 1536x2304 render is inspectable pixel for
          pixel. Clicks on the image itself do not dismiss. */}
      <div
        className={cn(
          "flex-1 min-h-0",
          actualSize ? "overflow-auto" : "flex items-center justify-center overflow-hidden",
        )}
      >
        <img
          src={eyeFrameSrc(frame.key)}
          alt={frame.caption}
          onClick={(event) => event.stopPropagation()}
          className={cn(actualSize ? "block m-auto" : "max-w-[92vw] max-h-full object-contain")}
          style={actualSize ? { maxWidth: "none" } : undefined}
        />
      </div>

      {/* Caption stays with the picture — he never loses what he is judging. */}
      <div
        className="shrink-0 px-6 py-4 text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[13px] leading-snug text-white/85 max-w-3xl mx-auto">
          {frame.arm && <span className="font-semibold text-white mr-2">{frame.arm}</span>}
          {frame.caption}
        </p>
      </div>

      {/* Arrows — hidden at the ends rather than disabled: an arrow that does
          nothing is a dead control. */}
      {prev !== null && (
        <button
          type="button"
          aria-label="Previous frame"
          onClick={(event) => { event.stopPropagation(); page(prev); }}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white bg-black/40 hover:bg-black/60 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {next !== null && (
        <button
          type="button"
          aria-label="Next frame"
          onClick={(event) => { event.stopPropagation(); page(next); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white bg-black/40 hover:bg-black/60 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
