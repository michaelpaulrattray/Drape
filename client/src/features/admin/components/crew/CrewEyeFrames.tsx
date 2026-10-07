/**
 * THE FRAMES OF ONE EYE ITEM, AND THE VIEWER OVER THEM — one declaration, two
 * readers (#1895).
 *
 * It was inside `CrewEyeGallery` and it is out here because a second surface
 * needs it: an eye item paired to a Needs-you card now draws its frames INSIDE
 * that card, so the question reaches him once instead of twice. Two copies of
 * a thumbnail grid and a lightbox is working law 4 on the one page whose whole
 * job is showing him pictures — the day one learns about a frame state the
 * other would not.
 *
 * ⚠ **THE VIEWER'S STATE IS PER ITEM, WHICH IS WHAT THE GALLERY'S OWN COMMENT
 * ASKED FOR AND SAID IN PROSE.** It read: *"Keyed by item so the viewer's
 * arrows page WITHIN one judgement — a court's arms are compared against each
 * other, never against another item's."* That was a `{ itemId, index }` pair
 * threaded through one component; here the component IS one item, so the index
 * alone says it and no id can go stale against the list.
 *
 * Images load only through `/api/crew/eye-frame/…` (admin-gated; the deployed
 * briefing is the allowlist), never a bucket URL — unchanged, and the reason
 * `eyeFrameSrc` exists.
 */
import { useState } from "react";

import { CrewEyeViewer } from "./CrewEyeViewer";
import { eyeFrameSrc } from "./eyeFrameSrc";
import type { CrewEyeItem } from "./crewTypes";

export function CrewEyeFrames({ frames }: { frames: CrewEyeItem["frames"] }) {
  /* Which frame is under his eye, within THIS item's own strip. */
  const [index, setIndex] = useState<number | null>(null);

  return (
    <>
      <div className="dp-crew__frames">
        {frames.map((frame, frameIndex) => (
          <figure key={frame.key}>
            {/* The thumbnail is the overview; the click opens the judging
                surface (#75's viewer ask, his verbatim). */}
            <button
              type="button"
              onClick={() => setIndex(frameIndex)}
              aria-label={`View full size: ${frame.caption}`}
              className="dp-crew__frame"
            >
              <img
                src={eyeFrameSrc(frame.key)}
                alt={frame.caption}
                loading="lazy"
                className="dp-crew__frameimg"
              />
            </button>
            <figcaption className="dp-crew__caption">
              {frame.arm && <span className="dp-crew__arm">{frame.arm}</span>}
              {frame.caption}
            </figcaption>
          </figure>
        ))}
      </div>

      {index !== null && frames.length > 0 && (
        <CrewEyeViewer
          frames={frames}
          /* The clamp survives a briefing that shortened this strip under an
             open viewer — the gallery's own `Math.min`, kept. */
          index={Math.min(index, frames.length - 1)}
          onNavigate={setIndex}
          onClose={() => setIndex(null)}
        />
      )}
    </>
  );
}
