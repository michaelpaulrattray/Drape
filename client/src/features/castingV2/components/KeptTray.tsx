import { useEffect, useRef, useState } from "react";

import { CandidateViewer, type ViewerFrame } from "./CandidateViewer";
import { canBeSigned } from "../signTarget";

/**
 * The shortlist, at a size that can actually do its job.
 *
 * It was four 24×30px chips, overlapping, with a `title` tooltip and no click.
 * The founder's finding: the tray's one job is comparing a shortlist before a
 * 500-credit Sign, and nothing is comparable at 24px — it read as a decorative
 * stack rather than as the thing you decide with.
 *
 * Three changes, each answering that job:
 *
 *   - **Big enough to tell apart.** Faces at 44×56 are distinguishable at a
 *     glance; at 24×30 they are colour swatches.
 *   - **Clicking opens the viewer.** Judging a face is what the viewer exists
 *     for, and the tray is where a shortlist is judged.
 *   - **It expands when it is carrying several.** The dock has finite width, so
 *     the resting state stays compact and the count is the affordance — the
 *     alternative is a strip that pushes Roll again off the edge, which is the
 *     defect that moved the shortlist into the dock in the first place.
 */

export type KeptEntry = {
  candidateId: string;
  thumbUrl: string | null;
  imageUrl: string | null;
  personaLine: string | null;
  /** Which roll this face came from — the shortlist spans the whole sheet. */
  sourceRollIndex: number;
  indexLabel: string;
  /**
   * ALREADY SIGNED — and therefore never a Sign target (fable-729 §5).
   *
   * The server has always sent this and said why at the projection: a signed
   * face stays in the tray because it is part of this sheet's story, and it
   * cannot be signed again. The client did not carry the field, so the tray
   * drew it as an ordinary radio labelled *"Sign 03 from ROLL 02"* — and the
   * sheet's own target list filters signed faces out, so clicking one wrote a
   * selection nothing could honour and the accent ring stayed on a different
   * woman. A dead click on the control that aims a 450-credit ceremony.
   */
  signed?: boolean;
};

/** "ROLL 02" — the useful label here, since the tray crosses rolls. */
function labelFor(entry: KeptEntry): string {
  return `ROLL ${String(entry.sourceRollIndex).padStart(2, "0")}`;
}

/** Compact enough to sit beside Roll again without crowding it. */
const RESTING = 4;

/**
 * SELECTION LIVES ON THE TRAY (founder ruling, 2026-08-02).
 *
 * The dock briefly carried its own cluster of kept thumbs beside the Sign
 * button, and that cluster read as multi-sign — an F2 violation in the UI's
 * grammar rather than in its behaviour, since the ceremony was always single.
 * The fix is not a smaller cluster: it is putting the choice where the faces
 * already are. One tray, radio semantics, an accent ring on the selected face,
 * and a Sign button that names no number because the ring already says who.
 */
export function KeptTray({
  shortlist,
  selectedId,
  onSelect,
  focusCandidateId,
}: {
  shortlist: KeptEntry[];
  /**
   * A face someone was sent here to find (`?focus=` on the sheet).
   *
   * The tray expands and rings her, rather than opening the viewer: whoever
   * followed a sibling tile came to look AROUND her sheet — dropping them
   * straight into a full-screen picture would hide the thing they navigated to.
   */
  focusCandidateId?: string | null;
  /** The face the dock's Sign will act on. */
  selectedId?: string | null;
  onSelect?: (candidateId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [viewing, setViewing] = useState<KeptEntry | null>(null);
  const focusRef = useRef<HTMLButtonElement>(null);

  const focusPresent = Boolean(
    focusCandidateId && shortlist.some((entry) => entry.candidateId === focusCandidateId),
  );
  useEffect(() => {
    if (!focusPresent) return;
    // Expand first: she may be past the resting six, and scrolling to a chip
    // that is not rendered yet scrolls to nothing.
    setExpanded(true);
    const timer = window.setTimeout(() => {
      focusRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
      focusRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [focusPresent, focusCandidateId]);

  if (shortlist.length === 0) return null;

  const shown = expanded ? shortlist : shortlist.slice(0, RESTING);
  const hidden = shortlist.length - shown.length;

  /*
    The WHOLE shortlist is the viewer's set, not the resting six — collapsing
    the strip is a display decision and must not shorten what the arrows reach.
  */
  const viewerFrames: ViewerFrame[] = shortlist
    .map((entry) => ({ entry, url: entry.imageUrl ?? entry.thumbUrl }))
    .filter((row): row is { entry: KeptEntry; url: string } => Boolean(row.url))
    .map(({ entry, url }) => ({
      url,
      label: entry.indexLabel,
      personaLine: entry.personaLine ?? null,
      downloadName: `${labelFor(entry)}-${entry.indexLabel}`,
    }));

  return (
    <>
      <span className={expanded ? "dpc-keptstack dpc-keptstack--open" : "dpc-keptstack"}>
        {shown.map((entry) => {
          const src = entry.thumbUrl ?? entry.imageUrl ?? null;
          const selected = entry.candidateId === selectedId;
          /*
            A SIGNED FACE IS NOT A TARGET (fable-729 §5). She is still here —
            the tray is the sheet's story — but she is out of the aim: no radio
            semantics, no selection write, and dimmed so the eye knows before
            the hand does. Her single click OPENS her instead, because the one
            thing this sweep is closing is controls that do nothing.
          */
          const aimable = Boolean(onSelect) && canBeSigned(entry);
          return src ? (
            <button
              key={entry.candidateId}
              type="button"
              ref={entry.candidateId === focusCandidateId ? focusRef : undefined}
              role={aimable ? "radio" : undefined}
              aria-checked={aimable ? selected : undefined}
              className={[
                "dpc-keptstack__chip dpc-keptstack__chip--open",
                selected && aimable ? "is-selected" : "",
                entry.signed ? "is-signed" : "",
              ].filter(Boolean).join(" ")}
              /*
                A single click SELECTS — the thing the dock is about to spend
                on. Opening the viewer moved to a double click and to the
                keyboard, because with ten keeps there was no way to lock one
                in at all, and choosing is the more common intent by far.
              */
              onClick={() => (aimable ? onSelect?.(entry.candidateId) : setViewing(entry))}
              onDoubleClick={() => setViewing(entry)}
              aria-label={
                aimable
                  ? `Sign ${entry.indexLabel} from ${labelFor(entry)}`
                  : entry.signed
                    ? `${entry.indexLabel} from ${labelFor(entry)} — already signed`
                    : `Open kept face from ${labelFor(entry)}`
              }
            >
              <img src={src} alt="" />
              {selected && aimable ? <span className="dpc-keptstack__ring" aria-hidden="true" /> : null}
            </button>
          ) : (
            <span key={entry.candidateId} className="dpc-keptstack__chip" />
          );
        })}
        {hidden > 0 ? (
          <button
            type="button"
            className="dpc-keptstack__more"
            onClick={() => setExpanded(true)}
            aria-label={`Show all ${shortlist.length} kept`}
          >
            +{hidden}
          </button>
        ) : null}
        {expanded && shortlist.length > RESTING ? (
          <button
            type="button"
            className="dpc-keptstack__more"
            onClick={() => setExpanded(false)}
            aria-label="Collapse the kept tray"
          >
            Less
          </button>
        ) : null}
      </span>

      {viewing && (viewing.thumbUrl || viewing.imageUrl) ? (
        /*
          The arrows walk the shortlist. Comparing is the tray's entire job,
          and a viewer you have to close and reopen between two faces is a
          viewer that makes comparing harder than the grid did.
        */
        <CandidateViewer
          frames={viewerFrames}
          index={Math.max(
            0,
            viewerFrames.findIndex((frame) => frame.url === (viewing.imageUrl ?? viewing.thumbUrl)),
          )}
          onIndexChange={(next) => {
            const target = viewerFrames[next];
            const entry = shortlist.find(
              (candidate) => (candidate.imageUrl ?? candidate.thumbUrl) === target?.url,
            );
            if (entry) setViewing(entry);
          }}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </>
  );
}
