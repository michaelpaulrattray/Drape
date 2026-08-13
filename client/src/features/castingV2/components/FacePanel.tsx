import type { FaceSelectionModel } from "./faceSelection";

/**
 * EVERYTHING ABOUT THIS FACE — panel v2 (fable-197/202, on the founder's own
 * words in fable-144).
 *
 * v1 answered *what is this version keeping* and drew a row per stored segment,
 * so a face nobody had edited had no panel at all. His v2 ruling is the other
 * shape — **everything is editable, even on the untouched original** — so the
 * rows are the slot catalogue and the library says what each one currently is.
 *
 * # What this surface promises, and what it deliberately does not
 *
 * Tapping a row scopes the ask box; clicking the feature ON THE PICTURE opens
 * the same scoped box where the feature is (fable-200). Submitting either one is
 * a NORMAL PAID EDIT through the same pipeline — no new render path, no preview,
 * nothing free to walk away from (fable-180). Esc closes and spends nothing.
 *
 * Not here, on purpose: no delete, no reorder, no per-row version history. The
 * fuller per-segment ceremony is M12 on this foundation, and a control that
 * looks like it does more than scope a sentence would be promising it.
 *
 * # THE COPY, CLASSIFIED (UI milestone contract)
 *
 *   "On {possessive} face"                          VERIFIED — founder-cleared
 *                                                   verbatim; the pronoun derived
 *   "Everything here can be changed. Tap one…"       ADAPTED  — v1's sub said
 *                                                   "Things this version is
 *                                                   keeping", which is false of a
 *                                                   list that includes what has
 *                                                   never been touched
 *   "Face" · "Hair" · "Body" · "Accessories"         ADAPTED  — the group names
 *                                                   from fable-197/202, ordered
 *                                                   the way a face is read
 *   "her lips — "                                    VERIFIED — the shipped
 *                                                   prefill shape
 *   "she came with it" · "from an edit"              VERIFIED — the shipped
 *                                                   provenance wording
 *
 * # A row with no thumbnail is not a broken row
 *
 * Most of this panel has no crop: only a slot whose kind has a proven
 * completeness specimen ever mints one, and today that is hair alone. A row
 * without one shows its words instead, which is the carrier of record anyway
 * (§3.0a) — so the panel reads as a description of a face rather than a grid of
 * empty tiles.
 */
export type FacePanelBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  frame: { width: number; height: number };
};

export type FacePanelRow = {
  slots: readonly string[];
  name: string;
  words: readonly string[];
  from: string | null;
  prefill: string;
  /**
   * A MINTED crop is its own picture and `crop` is null. A SCAN-BORN one is the
   * whole frame with a window on it — see `cutoutStyle`.
   */
  thumb: { contentUrl: string; maskUrl: string; crop: FacePanelBox | null } | null;
  box: FacePanelBox | null;
  /**
   * What the RECTANGLE covers, when that is narrower than the row — null on
   * almost every row, and null means the row's own name is the label.
   *
   * A matched pair with geometry for one instance is the case: the row says
   * "Her eyes" because an edit to it means both, and the box says "Her right
   * eye" because that is what those pixels are (fable-378 (c)).
   */
  boxName: string | null;
};

/**
 * How a thumbnail draws itself.
 *
 * Both kinds are one picture stencilled by one shape, which is the founder's
 * ruling in one sentence (*"masked cutouts"*, fable-374): a row born of a scan
 * and a row minted by an edit read as the same object, so the panel is a
 * description of a face rather than a mix of two rendering languages.
 *
 * The difference is only where the picture comes from. A minted crop IS the
 * cutout, so `contain` in the stylesheet is the whole of it. A scan mints
 * nothing — the frame the viewer is already showing is the content — so the
 * window is published here as numbers and the arithmetic lives beside the tile
 * size it depends on, in the stylesheet.
 */
export function cutoutStyle(thumb: { contentUrl: string; maskUrl: string; crop: FacePanelBox | null }) {
  return {
    backgroundImage: `url(${JSON.stringify(thumb.contentUrl)})`,
    /* Both spellings: the unprefixed property is the standard and the prefixed
       one is what older WebKit still reads. */
    WebkitMaskImage: `url(${JSON.stringify(thumb.maskUrl)})`,
    maskImage: `url(${JSON.stringify(thumb.maskUrl)})`,
    ...(thumb.crop
      ? {
        "--dpc-cut-x": thumb.crop.x,
        "--dpc-cut-y": thumb.crop.y,
        "--dpc-cut-w": thumb.crop.width,
        "--dpc-cut-h": thumb.crop.height,
        "--dpc-cut-fw": thumb.crop.frame.width,
        "--dpc-cut-fh": thumb.crop.frame.height,
        /* The longer side, which is what makes the fit a CONTAIN rather than a
           stretch — the same divisor on both axes. */
        "--dpc-cut-max": Math.max(thumb.crop.width, thumb.crop.height),
      }
      : {}),
  } as React.CSSProperties;
}

export type FacePanelGroup = {
  group: string;
  heading: string;
  rows: readonly FacePanelRow[];
};

export function FacePanel({
  groups,
  possessive,
  selection,
  onScope,
}: {
  groups: readonly FacePanelGroup[];
  /** HIS · HER · THEIR — this face's own word, derived on the server. */
  possessive: string;
  /** The one selection model, shared with the picture's regions. */
  selection: FaceSelectionModel;
  /** Writes the opening of their sentence into the ask box. Never submits it. */
  onScope: (prefill: string) => void;
}) {
  if (groups.length === 0) return null;

  return (
    <div className="dpc-face" aria-labelledby="dpc-face-title">
      <div className="dpc-face__head">
        <p className="dpc-face__title" id="dpc-face-title">On {possessive} face</p>
        <p className="dpc-face__sub">Everything here can be changed. Tap one to talk about it.</p>
      </div>
      {groups.map((group) => (
        <section className="dpc-face__group" key={group.group}>
          <p className="dpc-face__groupName">{group.heading}</p>
          <ul className="dpc-face__rows">
            {group.rows.map((row) => {
              const active = row.slots.some((slot) => selection.isSelected(slot));
              const lit = row.slots.some((slot) => selection.isHovered(slot));
              return (
                <li key={row.slots.join(" ")}>
                  <button
                    type="button"
                    className="dpc-face__row"
                    data-active={active ? "true" : "false"}
                    data-lit={lit ? "true" : "false"}
                    /* Their own words for the thing, then what it currently is —
                       the whole label, because the thumbnail is a shape and most
                       rows do not have one at all. */
                    aria-label={`${row.name}${row.words.length ? `, ${row.words.join(", ")}` : ""}. Talk about it.`}
                    aria-pressed={active}
                    onMouseEnter={() => selection.hover(row.slots)}
                    onMouseLeave={() => selection.hover(null)}
                    onFocus={() => selection.hover(row.slots)}
                    onBlur={() => selection.hover(null)}
                    onClick={() => {
                      selection.select({ slots: row.slots, name: row.name, prefill: row.prefill });
                      onScope(row.prefill);
                    }}
                  >
                    {row.thumb ? (
                      <span
                        className={`dpc-face__thumb${row.thumb.crop ? " dpc-face__thumb--cutout" : ""}`}
                        aria-hidden="true"
                        style={cutoutStyle(row.thumb)}
                      />
                    ) : (
                      /* NOT AN EMPTY TILE. A slot with no minted crop has never
                         been cut on this face, and a grey square would read as a
                         picture that failed to load. */
                      <span className="dpc-face__thumb dpc-face__thumb--none" aria-hidden="true" />
                    )}
                    <span className="dpc-face__body">
                      <span className="dpc-face__name">{row.name}</span>
                      {row.words.length > 0 ? (
                        <span className="dpc-face__words">{row.words.join(", ")}</span>
                      ) : null}
                      {row.from ? <span className="dpc-face__from">{row.from}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
