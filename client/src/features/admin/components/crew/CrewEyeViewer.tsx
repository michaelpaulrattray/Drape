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
 *
 * ⚠ **THIS FILE HELD NO HEX AND STILL CHANGED (#398).** Its colours were
 * `white/60`, `black/40` and an inline `rgba(10,10,10,.92)` — invisible to the
 * hex guard by construction, and every one of them a scrim value the token
 * file already owns. A viewer sits OFF the page's ground, so its text is
 * `--onScrim` and never `--ink`: `--ink` flips with the theme and the scrim
 * does not, which is white-on-white the first time somebody reads this page in
 * light mode.
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
      className="dp-crew__viewer"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={frame.caption}
      ref={dialogRef}
      tabIndex={-1}
    >
      {/* Top bar: position, 1:1 toggle, close. Stops propagation so its own
          clicks never fall through to the backdrop dismiss. */}
      <div className="dp-crew__viewerbar" onClick={(event) => event.stopPropagation()}>
        <span className="dp-crew__viewerpos">
          {index + 1} / {frames.length}
        </span>
        <div className="dp-crew__focus">
          <button
            type="button"
            onClick={() => setActualSize((size) => !size)}
            className="dp-crew__viewerbtn"
          >
            {actualSize ? "Fit to screen" : "View 1:1"}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close viewer"
            className="dp-crew__viewerclose"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* The frame. In fit mode it is bounded by the viewport; at 1:1 the
          container scrolls, so a 1536x2304 render is inspectable pixel for
          pixel. Clicks on the image itself do not dismiss. */}
      <div
        className={cn("dp-crew__viewerstage", actualSize && "dp-crew__viewerstage--actual")}
      >
        <img
          src={eyeFrameSrc(frame.key)}
          alt={frame.caption}
          onClick={(event) => event.stopPropagation()}
          className="dp-crew__viewerimg"
        />
      </div>

      {/* Caption stays with the picture — he never loses what he is judging. */}
      <div className="dp-crew__viewercap" onClick={(event) => event.stopPropagation()}>
        <p>
          {frame.arm && <span className="dp-crew__viewerarm">{frame.arm}</span>}
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
          className="dp-crew__viewernav dp-crew__viewernav--prev"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {next !== null && (
        <button
          type="button"
          aria-label="Next frame"
          onClick={(event) => { event.stopPropagation(); page(next); }}
          className="dp-crew__viewernav dp-crew__viewernav--next"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
