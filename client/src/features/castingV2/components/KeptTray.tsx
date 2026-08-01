import { useState } from "react";

import { CandidateViewer } from "./CandidateViewer";

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
};

/** "ROLL 02" — the useful label here, since the tray crosses rolls. */
function labelFor(entry: KeptEntry): string {
  return `ROLL ${String(entry.sourceRollIndex).padStart(2, "0")}`;
}

/** Compact enough to sit beside Roll again without crowding it. */
const RESTING = 4;

export function KeptTray({ shortlist }: { shortlist: KeptEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const [viewing, setViewing] = useState<KeptEntry | null>(null);

  if (shortlist.length === 0) return null;

  const shown = expanded ? shortlist : shortlist.slice(0, RESTING);
  const hidden = shortlist.length - shown.length;

  return (
    <>
      <span className={expanded ? "dpc-keptstack dpc-keptstack--open" : "dpc-keptstack"}>
        {shown.map((entry) => {
          const src = entry.thumbUrl ?? entry.imageUrl ?? null;
          return src ? (
            <button
              key={entry.candidateId}
              type="button"
              className="dpc-keptstack__chip dpc-keptstack__chip--open"
              onClick={() => setViewing(entry)}
              /*
                Labelled by its source roll, so the tray is navigable by
                keyboard and reads as a shortlist rather than as an unlabelled
                row of images — and a kept face says where it came from.
              */
              aria-label={`Open kept face from ${labelFor(entry)}`}
            >
              <img src={src} alt="" />
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
        <CandidateViewer
          imageUrl={(viewing.imageUrl ?? viewing.thumbUrl) as string}
          indexLabel={labelFor(viewing)}
          personaLine={viewing.personaLine ?? null}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </>
  );
}
