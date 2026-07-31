import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * The candidate viewer.
 *
 * Founder gate item 18: *"I cannot judge a face at tile size."* Which is the
 * whole milestone's job — a sheet exists so someone can choose between eight
 * people, and at 178px you can see a silhouette and a haircut but not a face.
 * Pulled forward from the Create vision for that reason.
 *
 * **View-only, per D-52.** The canvas viewer earned that ruling by exposing
 * editing affordances outside the edit ceremony; this one shows the image and
 * closes. Keep and Discard stay on the tile where they already are, because a
 * viewer that could spend or destroy would be a second, quieter path to the
 * same actions with none of the surrounding context.
 *
 * Portalled to `document.body` so no ancestor's `overflow` or stacking context
 * can clip it — the mistake that produced item 17 one milestone earlier.
 */
export function CandidateViewer({
  imageUrl,
  indexLabel,
  personaLine,
  onClose,
}: {
  imageUrl: string;
  indexLabel: string;
  personaLine: string | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    /*
      The page behind must not scroll while a full-screen viewer is open —
      otherwise closing it returns you somewhere else in the sheet, and the
      candidate you were comparing against has moved.
    */
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="dpc-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`Candidate ${indexLabel}${personaLine ? ` — ${personaLine}` : ""}`}
      // Click the scrim to close, but not a click that started on the image:
      // dragging off the photo should not dismiss what you were looking at.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        ref={closeRef}
        type="button"
        className="dp-btn--onmedia dpc-viewer__close"
        aria-label="Close the viewer"
        onClick={onClose}
      >
        <X size={15} strokeWidth={2} aria-hidden="true" />
      </button>

      <figure className="dpc-viewer__frame">
        <img src={imageUrl} alt={`Candidate ${indexLabel}`} />
        <figcaption className="dpc-viewer__caption">
          <span className="dp-chrome">{indexLabel}</span>
          {personaLine ? <span>{personaLine}</span> : null}
        </figcaption>
      </figure>
    </div>,
    document.body,
  );
}
