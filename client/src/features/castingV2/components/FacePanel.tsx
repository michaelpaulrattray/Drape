import { useState } from "react";

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
 *   "Refine them"                                    VERIFIED — his own words
 *                                                   (fable-398, "how about refine
 *                                                   them or somthing"). It replaces
 *                                                   v1's "On {possessive} face",
 *                                                   which this panel had outgrown:
 *                                                   the list gained BODY and SKIN
 *                                                   rows, so a heading naming the
 *                                                   face was false in the same
 *                                                   photograph that showed them.
 *                                                   A possessive variant ("Refine
 *                                                   her/them") derives from the
 *                                                   cast's pronoun the way the rows
 *                                                   already do, if it is ever wanted;
 *                                                   the ruled default is the plain one
 *   "Everything here can be changed. Tap one…"       ADAPTED  — v1's sub said
 *                                                   "Things this version is
 *                                                   keeping", which is false of a
 *                                                   list that includes what has
 *                                                   never been touched
 *   "Face" · "Hair" · "Body" · "Accessories"         ADAPTED  — the group names
 *                                                   from fable-197/202, ordered
 *                                                   the way a face is read
 *   "Reading {possessive} features…"                 ADAPTED  — fable-397's own
 *                                                   example sentence, with the
 *                                                   pronoun derived rather than
 *                                                   the literal "her" shipped
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

/**
 * A MINTED crop is its own picture and `crop` is null. A SCAN-BORN one is the
 * whole frame with a window on it — see `cutoutStyle`.
 */
export type FacePanelCutout = { contentUrl: string; maskUrl: string; crop: FacePanelBox | null };

/**
 * One rectangle on the photograph. `name` is null when it covers what the row
 * says it does — a pair's rectangles each carry their instance's name, because
 * clicking a rectangle is a promise about those pixels (fable-378 (c)).
 */
export type FacePanelRegion = {
  box: FacePanelBox;
  /** BARE — "Left eye", never "Her left eye" (founder, fable-451). The side is
   *  the information; the pronoun was not. */
  name: string | null;
  /** How the product SPEAKS about this one, for the sentences a label is not. */
  spoken: string | null;
  /** The one instance these pixels ARE — `eye@left`. The ROW's slots say what
   *  an edit to the row means; this says what the rectangle is, and clicking it
   *  scopes the ask to it (fable-444, ruling C). */
  slot: string;
  /** This rectangle's own opening sentence, when it differs from the row's.
   *  Written by the server so the browser never composes copy. */
  prefill: string | null;
};

export type FacePanelRow = {
  /** How the product speaks about this row — "her eyes". Labels are bare
   *  (fable-450/451); the possessive survives wherever the product says a
   *  sentence. */
  spoken: string;
  slots: readonly string[];
  name: string;
  words: readonly string[];
  from: string | null;
  prefill: string;
  /**
   * NONE, ONE, OR ONE PER INSTANCE — a matched pair shows both, side by side.
   *
   * Measured rather than chosen: the union of two eye boxes fitted into a 34px
   * tile draws 34 × 5.7 pixels of content in an empty square, and two ears
   * union into a tile that is 85% background. Abutted, the gap between them —
   * which is her face, not her eyes — is simply not in the picture.
   */
  cutouts: readonly FacePanelCutout[];
  /** Where it is on the picture: none, one, or one per instance. */
  regions: readonly FacePanelRegion[];
  /**
   * THE TWO SIDES OF A PAIR, WHEN THIS ROW IS ONE (founder, fable-452).
   *
   * Empty on every row there is only one of. The parent means the pair and a
   * child means that instance — tapping one scopes the ask exactly as clicking
   * that instance's rectangle on the photograph does, which is one mechanism
   * with two entrances rather than a second way to mean the same thing.
   */
  instances: readonly FacePanelInstance[];
};

/** One side of a pair, as a row of its own inside its parent. */
export type FacePanelInstance = {
  slot: string;
  /** Bare, like every label: "Left eye". */
  name: string;
  /** How the product speaks about this one — "her left eye". */
  spoken: string;
  prefill: string;
  words: readonly string[];
  cutout: FacePanelCutout | null;
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
/**
 * AND A PAIR IS ONE OBJECT PHOTOGRAPHED TWICE (founder, fable-462 §3).
 *
 * His right eye was *"zoomed in too much"* beside his left. Measured on the dev
 * fixture, where both halves are scan windows: the left eye's crop came back
 * 34×23 and the right's 50×28, and each tile scaled its own crop to fill its own
 * half — so the frame was drawn at 512px behind one and 348px behind the other.
 * **A 1.47× magnification difference inside one pair**, from nothing but the
 * reader returning a slightly tighter box on one side.
 *
 * So the two halves scale to the SAME extent — the larger of the pair — while
 * each still centres on its own feature. A pair reads as one object seen twice,
 * which is what it is.
 *
 * `scaleTo` is undefined for a lone cutout, which is every other row: nothing
 * changes for them.
 */
export function pairScaleExtent(cutouts: readonly FacePanelCutout[]): { width: number; height: number } | undefined {
  const crops = cutouts.map((cutout) => cutout.crop).filter((crop): crop is FacePanelBox => crop !== null);
  /* Only where BOTH halves are windows. A minted crop is its own picture and
     carries no window to scale — normalising across the two kinds needs the
     library to publish a minted crop's geometry, which it does not today, and
     is named rather than guessed at. */
  if (crops.length < 2 || crops.length !== cutouts.length) return undefined;
  return {
    width: Math.max(...crops.map((crop) => crop.width)),
    height: Math.max(...crops.map((crop) => crop.height)),
  };
}

export function cutoutStyle(thumb: FacePanelCutout, scaleTo?: { width: number; height: number }) {
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
        /* The fit is a CONTAIN and the stylesheet derives it, because the box a
           cutout lands in is only square while the row has one of them. */
        "--dpc-cut-fh": thumb.crop.frame.height,
        /* The extents the SCALE is taken from — its own, unless it is half of a
           pair, in which case both halves take the pair's. Position keeps using
           its own w/h, so each still centres on its own feature. */
        "--dpc-cut-sw": scaleTo?.width ?? thumb.crop.width,
        "--dpc-cut-sh": scaleTo?.height ?? thumb.crop.height,
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
  working,
  selection,
  onScope,
}: {
  groups: readonly FacePanelGroup[];
  /**
   * HIS · HER · THEIR — this face's own word, derived on the server.
   *
   * The ruled heading no longer needs it; the working line below does, and for
   * the reason the heading needed it before: fable-397's example copy reads
   * "Reading her features…", and the mock it came from was of a woman. Shipping
   * that literal would put "her" over a man's photograph, which is the mistake
   * `segmentsOnFace` and the v1 heading each paid for once already (law 8 — a
   * stylist does not call a man's face hers).
   */
  possessive: string;
  /**
   * HER FACE IS BEING READ RIGHT NOW (founder, fable-397).
   *
   * His words, with a screenshot: *"the image should show some sort of loading
   * state while its generating her crops/thumbnails — it usually takes about
   * 5-10 seconds — but currently it looks like nothing is even happening."*
   *
   * It is one line, not a spinner per row, and the rows the library already
   * knows stay on screen and tappable underneath it: the panel is not empty
   * while the scan runs, it is INCOMPLETE, and those are different pictures.
   *
   * **It can never outlive its work.** The caller derives it from the scan
   * query's own pending state, so a scan that errors simply stops being pending
   * and the panel shows what the library alone knows — today's behaviour —
   * rather than a "reading…" that never ends. A working state that can outlive
   * its work is the invisible-run lesson wearing UI clothes.
   */
  working: boolean;
  /** The one selection model, shared with the picture's regions. */
  selection: FaceSelectionModel;
  /** Writes the opening of their sentence into the ask box. Never submits it. */
  onScope: (prefill: string) => void;
}) {
  /*
    WHICH PAIRS ARE OPEN — and it is the one piece of state this panel keeps.

    Not the selection: that is held once, outside, and handed to both surfaces
    (working law 4, and the reason this file was forbidden any state at all
    until the founder's nesting ruling). A disclosure is a different kind of
    fact — nothing else in the product needs to know that she has opened her
    eyes row, and nothing is fetched or stored when she does.

    Collapsed by default, keyed by the row's own slots, so re-rendering the
    panel with new words leaves what she opened open.
  */
  const [opened, setOpened] = useState<readonly string[]>([]);
  const keyOf = (row: FacePanelRow) => row.slots.join(" ");

  if (groups.length === 0) return null;

  return (
    <div className="dpc-face" aria-labelledby="dpc-face-title">
      <div className="dpc-face__head">
        <p className="dpc-face__title" id="dpc-face-title">Refine them</p>
        <p className="dpc-face__sub">Everything here can be changed. Tap one to talk about it.</p>
        {/* `role="status"` so a screen reader is told once, politely, that more
            is coming — and told nothing at all when it lands, because the rows
            arriving are their own announcement. */}
        {working ? <p className="dpc-face__working" role="status">Reading {possessive} features…</p> : null}
      </div>
      {groups.map((group) => (
        <section className="dpc-face__group" key={group.group}>
          <p className="dpc-face__groupName">{group.heading}</p>
          <ul className="dpc-face__rows">
            {group.rows.map((row) => {
              /* The parent is lit for the PAIR. A child's own selection is
                 scoped to one side, and that is what the child reads below —
                 so tapping her left eye does not light the row as though the
                 ask were about both. */
              const active = row.slots.some((slot) => selection.isSelected(slot))
                && selection.selected?.scope === undefined;
              const lit = row.slots.some((slot) => selection.isHovered(slot));
              const isOpen = opened.includes(keyOf(row));
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
                      selection.select({ slots: row.slots, name: row.name, spoken: row.spoken, prefill: row.prefill });
                      onScope(row.prefill);
                    }}
                  >
                    {row.cutouts.length > 0 ? (
                      /* ONE TILE, ONE PICTURE PER INSTANCE. Two eyes share the
                         tile rather than one standing for both — the founder
                         read a single-eye tile on a two-eyed face as broken, and
                         the union of the two boxes measured as a sliver. */
                      <span
                        className="dpc-face__thumb"
                        data-parts={row.cutouts.length}
                        aria-hidden="true"
                      >
                        {row.cutouts.map((cutout, at) => (
                          <span
                            key={`${cutout.contentUrl}:${cutout.crop?.x ?? at}`}
                            className={`dpc-face__cut${cutout.crop ? " dpc-face__cut--cutout" : ""}`}
                            style={cutoutStyle(cutout, pairScaleExtent(row.cutouts))}
                          />
                        ))}
                      </span>
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
                  {/*
                    THE CHEVRON IS ITS OWN TARGET (founder, fable-452).

                    Tapping the row still means what it has always meant — an
                    ask about the pair — so opening it cannot also be what
                    tapping the row does. One button, one job, and it is the
                    only new control on this surface.
                  */}
                  {row.instances.length > 0 ? (
                    <button
                      type="button"
                      className="dpc-face__open"
                      aria-expanded={isOpen}
                      aria-controls={`dpc-face-sides-${keyOf(row).replace(/[^a-z0-9]+/gi, "-")}`}
                      aria-label={`${isOpen ? "Hide" : "Show"} each of ${row.spoken}`}
                      onClick={() => setOpened((held) => (held.includes(keyOf(row))
                        ? held.filter((key) => key !== keyOf(row))
                        : [...held, keyOf(row)]))}
                    >
                      <span aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
                    </button>
                  ) : null}
                  {row.instances.length > 0 && isOpen ? (
                    <ul
                      className="dpc-face__sides"
                      id={`dpc-face-sides-${keyOf(row).replace(/[^a-z0-9]+/gi, "-")}`}
                    >
                      {row.instances.map((instance) => {
                        /*
                          A CHILD MEANS THAT INSTANCE, and it sends the SAME
                          wire the rectangle over that instance sends: the row's
                          slots, scoped to this one (fable-444 ruling C). Two
                          entrances, one scoping mechanism — a second way to say
                          "this eye" is a second thing to get wrong.
                        */
                        const scoped = selection.selected?.scope === instance.slot;
                        return (
                          <li key={instance.slot}>
                            <button
                              type="button"
                              className="dpc-face__row dpc-face__row--side"
                              data-active={scoped ? "true" : "false"}
                              data-lit={selection.isHovered(instance.slot) ? "true" : "false"}
                              aria-label={`${instance.name}${instance.words.length ? `, ${instance.words.join(", ")}` : ""}. Talk about it.`}
                              aria-pressed={scoped}
                              onMouseEnter={() => selection.hover([instance.slot])}
                              onMouseLeave={() => selection.hover(null)}
                              onFocus={() => selection.hover([instance.slot])}
                              onBlur={() => selection.hover(null)}
                              onClick={() => {
                                selection.select({
                                  slots: row.slots,
                                  name: instance.name,
                                  spoken: instance.spoken,
                                  prefill: instance.prefill,
                                  scope: instance.slot,
                                });
                                onScope(instance.prefill);
                              }}
                            >
                              {instance.cutout ? (
                                <span className="dpc-face__thumb" data-parts={1} aria-hidden="true">
                                  <span
                                    className={`dpc-face__cut${instance.cutout.crop ? " dpc-face__cut--cutout" : ""}`}
                                    style={cutoutStyle(instance.cutout)}
                                  />
                                </span>
                              ) : (
                                <span className="dpc-face__thumb dpc-face__thumb--none" aria-hidden="true" />
                              )}
                              <span className="dpc-face__body">
                                <span className="dpc-face__name">{instance.name}</span>
                                {instance.words.length > 0 ? (
                                  <span className="dpc-face__words">{instance.words.join(", ")}</span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
