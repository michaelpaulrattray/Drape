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
 * A row's box comes from the geometry of a crop that was actually minted on this
 * face. Rows without one — most of them today — are absent from the picture
 * entirely rather than placed by proportion: a rectangle over the wrong pixels
 * is a promise that clicking there edits that thing, and it would be a promise
 * the product cannot keep. They remain tappable in the panel, which is where the
 * ask gets scoped either way.
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

  const withBox = rows.filter((row) => row.box !== null);
  if (withBox.length === 0) return null;

  const close = () => selection.select(null);

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
      {withBox.map((row) => {
        const box = row.box!;
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
            key={row.slots.join(" ")}
            type="button"
            className="dpc-regions__box"
            style={style}
            data-active={active ? "true" : "false"}
            data-lit={lit ? "true" : "false"}
            aria-label={`${row.name}. Edit it here.`}
            onMouseEnter={() => selection.hover(row.slots)}
            onMouseLeave={() => selection.hover(null)}
            onFocus={() => selection.hover(row.slots)}
            onBlur={() => selection.hover(null)}
            onClick={() => selection.select({ slots: row.slots, name: row.name, prefill: row.prefill })}
          >
            <span className="dpc-regions__tag">{row.name}</span>
          </button>
        );
      })}

      {open && openRow?.box ? (
        <form
          className="dpc-regions__ask"
          /* Escape belongs to this box while it is open, and the viewer's own
             capture-phase listener has no other way to know — see the handler
             below and `CandidateViewer`'s Escape branch. */
          data-owns-escape="true"
          style={{
            left: `${((openRow.box.x + openRow.box.width / 2) / openRow.box.frame.width) * 100}%`,
            top: `${((openRow.box.y + openRow.box.height) / openRow.box.frame.height) * 100}%`,
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
