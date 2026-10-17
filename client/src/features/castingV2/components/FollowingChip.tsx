/**
 * THE STANDING FOLLOW CHIP (§F) — the followed face, shown as itself (#2622).
 *
 * His report, verbatim, 2026-10-17: *"casts say from 05 meaning from sheet 05
 * and the following sdays following 06 its kind of confusing dont you think is
 * there a better design for this and the UX?"*; on the proposal, *"sounds
 * good"*. The chip read "FOLLOWING 06" — a face index — above eight tiles each
 * reading "FROM 05", a sheet index. So the chip carries no number at all: the
 * word, the face's own picture, and the × that clears it. There is no label
 * prop on purpose — a number cannot come back without changing this file, and
 * `followingChip2622.test.ts` renders it to make sure.
 *
 * Which face it is comes from `followLineage.ts` (#2587), so during the window
 * between a press and the new sheet landing it already shows the face just
 * pressed.
 */
export function FollowingChip({
  faceId,
  thumbUrl,
  onClear,
}: {
  /** The followed candidate's id — read by the interaction-latency probe, never shown. */
  faceId: string | null;
  /** The followed face's picture; null holds an empty frame of the same size. */
  thumbUrl: string | null;
  onClear: () => void;
}) {
  return (
    <div className="dpc-following">
      <span className="dpc-following__chip" data-face={faceId ?? ""}>
        Following
        {thumbUrl ? (
          <img className="dpc-following__face" src={thumbUrl} alt="" />
        ) : (
          <span className="dpc-following__face" aria-hidden="true" />
        )}
        {/*
          A ×, and here it is the right glyph: this one really does mean
          "close" — the follow stops.
        */}
        <button
          type="button"
          className="dpc-following__clear"
          onClick={onClear}
          aria-label="Stop following — the next roll casts openly"
          title="Stop following — the next roll casts openly"
        >
          ×
        </button>
      </span>
      <span className="dpc-following__note">
        Roll again keeps this family. Clear it to cast openly.
      </span>
    </div>
  );
}
