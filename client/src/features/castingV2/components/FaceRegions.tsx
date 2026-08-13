import { useEffect, useRef, useState } from "react";

import type { FacePanelRow } from "./FacePanel";
import type { FaceSelectionModel } from "./faceSelection";

/**
 * CLICK THE EARRING, NOT THE LIST — the founder's spec, in his own words
 * (fable-200): *"if the bounding boxes appear on the image you should just be
 * able to click on say the earring of the image and a text box should appear
 * allowing you to make an edit to that one earring."*
 *
 * This lays the panel's regions over the picture. Hovering one lights its row;
 * clicking it opens a small scoped box AT the feature, prefilled exactly as
 * tapping the row would prefill the ask box below.
 *
 * # Submitting is a NORMAL PAID EDIT, and Esc costs nothing
 *
 * The box calls the same handler the ask box calls — same pipeline, same price,
 * same 25 credits, no preview and no second generation (fable-180: no flow
 * anywhere generates a render the user can walk away from for free). Closing it
 * with Esc or a click outside spends nothing, because nothing has been sent.
 *
 * # A REGION IS ONLY DRAWN WHERE ONE WAS MEASURED
 *
 * A row's box comes from a real reading of THIS face — the geometry of a crop a
 * paid edit minted, or, since the scan, where a segmenter found the feature on
 * the frame already on screen. Never from proportion: a rectangle over the wrong
 * pixels is a promise that clicking there edits that thing, and it would be a
 * promise the product cannot keep.
 *
 * A row with no rectangle is no longer *"most of them"* and is no longer merely
 * absent from the PICTURE — fable-414 took it off the panel altogether
 * (*"everything in the right panel should have a bounding box"*), so panel
 * membership and a place on the photograph are now one fact. What that costs is
 * stated where the filter lives (`facePanel.ts`), and it is not nothing: a face
 * wearing earrings has no earrings row today, because earring detection is
 * unarmed and nothing measures where they are.
 *
 * # THE COPY, CLASSIFIED (UI milestone contract)
 *
 * This surface had no classification block until shift 79, and the gap was
 * found by a copy audit rather than by reading the file — every string below
 * was shipping unclassified while the panel beside it had a full block.
 *
 *   "{Her left eye}. Edit it here."       INVENTED — no mock covers a
 *                                         screen-reader label. The NAME is not
 *                                         invented: it is the row's own, or the
 *                                         instance's on a pair (fable-378 (c)),
 *                                         so the rectangle speaks the person's
 *                                         ontology and not the geometry's
 *   "Change something about them…"        VERIFIED — the shipped ask box's own
 *                                         placeholder (`RefinePanel:295`),
 *                                         reused verbatim: two doors to one
 *                                         edit must not speak differently
 *   "Refine" · "Refining…"                VERIFIED — the shipped submit label
 *                                         and its busy state (`RefinePanel:301`)
 *   "{25} credits"                        ADAPTED  — the panel below reads
 *                                         "…· 25 credits each", which is a RATE
 *                                         across tiles. This box is one edit to
 *                                         one feature, so the "each" would be
 *                                         false here. Beside the button and
 *                                         never on it (D-15/D-109)
 *   "What to change about {her lips}"     INVENTED — the field's screen-reader
 *                                         label, derived from the open row's
 *                                         name for the same reason as above
 *
 * # The boxes are in the FRAME's pixels, and the picture is not
 *
 * Every box carries the frame it was measured on, so it is drawn as a percentage
 * of that frame rather than in screen pixels. A box measured on a 1024×1536
 * render and drawn in CSS pixels would sit somewhere else at every window size —
 * the same wrong-space class as a mask measured against a different frame, which
 * the segment writer refuses outright.
 */
export function FaceRegions({
  rows,
  selection,
  priceCredits,
  busy,
  onAsk,
}: {
  rows: readonly FacePanelRow[];
  selection: FaceSelectionModel;
  priceCredits: number;
  busy: boolean;
  /** The same paid edit the ask box submits. */
  onAsk: (instruction: string) => void;
}) {
  const [draft, setDraft] = useState("");
  /** Which of the open row's rectangles was clicked — a pair has two. */
  const [openAt, setOpenAt] = useState(0);
  const fieldRef = useRef<HTMLInputElement>(null);
  const open = selection.selected;
  const openRow = open ? rows.find((row) => row.slots.join(" ") === open.slots.join(" ")) : undefined;

  /* The box opens with their sentence already begun and the caret after it. */
  useEffect(() => {
    if (!open) return;
    setDraft(open.prefill);
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, [open?.slots.join(" "), open?.prefill]);

  /*
    A BUSY FACE HAS NO REGIONS — the founder, fable-365: *"when the image is
    generating a refinement/loading i can still see and click the bounding boxes
    through it."*
    Anything open closes as the work begins, so the layer re-arms clean rather
    than restoring a box whose picture has since been replaced.
  */
  useEffect(() => {
    if (busy && open) selection.select(null);
  }, [busy, open]);

  /*
    AND THE BOXES ARE NOT DRAWN AT ALL WHILE ONE IS IN FLIGHT.

    Disabling the field was not enough and never was: the boxes sat above the
    loading state, still lit, still hit-testable, so a click landed on a frame
    that was about to be superseded — and the panel read as not knowing its own
    render was busy. Hidden rather than greyed, because the founder's taste is
    restrained and a spinner per box would be louder than the thing it explains.
    It re-arms on the terminal state, which is what `busy` falling away IS: the
    refinement has landed or been refused.
  */
  if (busy) return null;

  /*
    ONE RECTANGLE PER MEASURED INSTANCE, not one per row.

    A matched pair used to draw a single rectangle over one eye and call it "Her
    eyes" — the same "only showing one eye" the founder read in the tile, one
    surface across (law 7's sweep). Both eyes are now clickable, each says which
    one it is, and clicking either opens the SAME ask: the row's slots, the row's
    prefill, one edit meaning both.
  */
  const drawn = rows
    .flatMap((row) => row.regions.map((region, at) => ({ row, region, at })))
    /*
      THE SMALLEST BOX WINS THE POINT — the founder, twice: first on hair over
      eyes, then *"the bounding boxes showing by smallest first rule wasnt
      working when i was hovering over her eyes when she was wearing glasses."*

      Measured before this line existed (`probe-region-hover-disposable.mts`):
      **12 of 13 contained overlaps handed the point to the LARGER box.** There
      was no smallest-wins rule anywhere in the code — the browser's own
      hit-test resolves overlapping absolute boxes by PAINT ORDER, so whichever
      feature the catalogue happened to list last swallowed every point inside
      it. On his face that was her glasses, sitting over both eyes, her nose and
      both ears.

      So the paint order IS the rule: largest first, smallest last, on top.
      Derived from the boxes' own area rather than a z-index ladder, because a
      ladder is a second list of how features nest and it would be wrong the
      first time a new feature is added between two rungs.
    */
    .sort((a, b) => (b.region.box.width * b.region.box.height) - (a.region.box.width * a.region.box.height));
  if (drawn.length === 0) return null;

  const close = () => selection.select(null);
  /* Where the open box hangs: under the rectangle that was clicked. Without it,
     clicking her left eye would open the field under her right one. */
  const anchor = openRow
    ? (openRow.regions[Math.min(openAt, openRow.regions.length - 1)] ?? null)
    : null;

  return (
    <span className="dpc-regions" onClick={(event) => event.stopPropagation()}>
      {/*
        CLICK-AWAY CLOSES IT, and it costs nothing (fable-200). Present only
        while a box is open, so the picture is not covered by a swallowing layer
        the rest of the time — the viewer's own click grammar keeps working.
      */}
      {open ? (
        <span
          className="dpc-regions__away"
          aria-hidden="true"
          onClick={close}
        />
      ) : null}
      {drawn.map(({ row, region, at }) => {
        const box = region.box;
        const style = {
          left: `${(box.x / box.frame.width) * 100}%`,
          top: `${(box.y / box.frame.height) * 100}%`,
          width: `${(box.width / box.frame.width) * 100}%`,
          height: `${(box.height / box.frame.height) * 100}%`,
        };
        const active = row.slots.some((slot) => selection.isSelected(slot));
        const lit = row.slots.some((slot) => selection.isHovered(slot));
        return (
          <button
            key={`${row.slots.join(" ")}:${at}`}
            type="button"
            className="dpc-regions__box"
            style={style}
            data-active={active ? "true" : "false"}
            data-lit={lit ? "true" : "false"}
            /*
              THE RECTANGLE NAMES WHAT IT COVERS (fable-378 (c)). On almost
              every box that is the row's own name. On a matched pair it is the
              instance — the row still reads "Her eyes" and this says "Her right
              eye", because clicking a rectangle is a promise about those pixels.
              The edit is still the row's: both slots, one ask.
            */
            aria-label={`${region.name ?? row.name}. Edit it here.`}
            onMouseEnter={() => selection.hover(row.slots)}
            onMouseLeave={() => selection.hover(null)}
            onFocus={() => selection.hover(row.slots)}
            onBlur={() => selection.hover(null)}
            onClick={() => {
              setOpenAt(at);
              selection.select({ slots: row.slots, name: row.name, prefill: row.prefill });
            }}
          >
            <span className="dpc-regions__tag">{region.name ?? row.name}</span>
          </button>
        );
      })}

      {open && anchor ? (
        <form
          className="dpc-regions__ask"
          /* Escape belongs to this box while it is open, and the viewer's own
             capture-phase listener has no other way to know — see the handler
             below and `CandidateViewer`'s Escape branch. */
          data-owns-escape="true"
          style={{
            left: `${((anchor.box.x + anchor.box.width / 2) / anchor.box.frame.width) * 100}%`,
            top: `${((anchor.box.y + anchor.box.height) / anchor.box.frame.height) * 100}%`,
          }}
          onSubmit={(event) => {
            event.preventDefault();
            const said = draft.trim();
            if (!said || busy) return;
            onAsk(said);
            close();
          }}
          /* Esc closes it and spends nothing — there is nothing to undo,
             because nothing was sent. */
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            close();
          }}
        >
          <input
            ref={fieldRef}
            className="dpc-regions__field"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Change something about them…"
            maxLength={200}
            disabled={busy}
            aria-label={`What to change about ${open.name.toLowerCase()}`}
          />
          <button type="submit" className="dpc-regions__submit" disabled={!draft.trim() || busy}>
            {busy ? "Refining…" : "Refine"}
          </button>
          {/* The price is stated quietly and never on the button (D-15/D-109),
              the same way the panel below states it. */}
          <span className="dpc-regions__price">{priceCredits} credits</span>
        </form>
      ) : null}
    </span>
  );
}
