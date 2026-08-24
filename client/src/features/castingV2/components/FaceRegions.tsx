import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { refineTypingAllowance } from "@shared/refineLimits";

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
 * stated where the filter lives (`facePanel.ts`), and it is not nothing: a row
 * nothing can locate on the frame leaves the panel until something can. Which
 * rows those are is not written here — this sentence named her earrings, whose
 * detector has since been armed, and a roster in a comment is the one thing on
 * this surface no test reads.
 *
 * # THE COPY, CLASSIFIED (UI milestone contract)
 *
 * This surface had no classification block until shift 79, and the gap was
 * found by a copy audit rather than by reading the file — every string below
 * was shipping unclassified while the panel beside it had a full block.
 *
 *   "{Left eye}. Edit it here."           INVENTED — no mock covers a
 *                                         screen-reader label. The NAME is not
 *                                         invented: it is the row's own, or the
 *                                         instance's on a pair (fable-378 (c)),
 *                                         so the rectangle speaks the person's
 *                                         ontology and not the geometry's.
 *                                         BARE since 2026-08-14, and it is the
 *                                         founder's own ruling (fable-451):
 *                                         *"even on hover it's too long — just
 *                                         'Left eye'"*. The side stays, because
 *                                         the side is the information the
 *                                         pronoun never was
 *   "Describe your edit…"                 ADAPTED  — the founder's own words for
 *                                         what this field should now show
 *                                         (fable-1270 §1). It REPLACES the ask
 *                                         box's "Change something about them…",
 *                                         which was reused verbatim while this
 *                                         field opened pre-filled with the
 *                                         feature's name; the two doors still do
 *                                         not disagree, because this one is now
 *                                         a HINT over an empty box and the other
 *                                         is a hint over an unscoped one
 *   "Refine" · "Refining…"                VERIFIED — the shipped submit label
 *                                         and its busy state (`RefinePanel:301`)
 *   "{25} credits"                        DELETED  — founder, fable-1270 §2:
 *                                         *"its already stated in the
 *                                         description under the chatbar."*
 *                                         D-15/D-109 is not repealed; it is read
 *                                         as ONCE PER SURFACE rather than once
 *                                         per control, and the panel under the
 *                                         picture is where this surface says it.
 *                                         The drive arm that pinned it is
 *                                         AMENDED, never silently dropped
 *   "What to change about {her lips}"     INVENTED — the field's screen-reader
 *                                         label. The one label here that is a
 *                                         SENTENCE, so it keeps the possessive
 *                                         while the tags go bare: a reader
 *                                         hearing "what to change about left
 *                                         eye" is being read a column header
 *                                         rather than asked a question. Taken
 *                                         from the server's `spoken`, never
 *                                         composed here (fable-450/451)
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
  busy,
  onAsk,
}: {
  rows: readonly FacePanelRow[];
  selection: FaceSelectionModel;
  /* `priceCredits` was here and is GONE with the chip it fed (fable-1270 §2).
     Removed rather than left unread: a prop nothing renders is a caller still
     being asked for a fact, and the next person would put a chip back to use
     it. */
  busy: boolean;
  /** The same paid edit the ask box submits, scoped to one instance when she
   *  clicked one instance's rectangle. */
  onAsk: (instruction: string, scope?: string) => void;
}) {
  const [draft, setDraft] = useState("");
  /** Which of the open row's rectangles was clicked — a pair has two. */
  const [openAt, setOpenAt] = useState(0);
  const fieldRef = useRef<HTMLInputElement>(null);

  const open = selection.selected;
  const openRow = open ? rows.find((row) => row.slots.join(" ") === open.slots.join(" ")) : undefined;

  /*
    ⚠ THE POPOVER IS KEPT INSIDE THE PICTURE, ON ALL FOUR EDGES (founder, with
    his own frame: the field ran off the right of the stage).

    It hangs under the tapped rectangle and is centred on it — which is right in
    the middle of the picture and wrong at its edges. His specimen was a LEFT
    UPPER ARM tattoo, whose box sits flush against the image's right border,
    because her left arm is the image's right side. So the first tap on the
    feature he had just verified opened a field he could not fully see.

    **Swept rather than patched at the instance he hit.** The same arithmetic
    fails at every edge and each one has a real box waiting for it: a forehead
    orb sits against the TOP the day its card lands, a neck tattoo against the
    bottom of the crop, and her right arm against the left. So this clamps in
    both axes rather than shifting left when the right edge is near.

    A NUDGE rather than a re-anchor: the popover keeps pointing at its own
    rectangle and slides just far enough to fit, so nothing about which box the
    ask is about becomes ambiguous. Measured rather than computed from
    percentages, because its width depends on the theme's font and its own
    `max-width: min(420px, 92%)` — a number this file must not hold a second
    copy of.
  */
  const askRef = useRef<HTMLFormElement | null>(null);
  const [nudge, setNudge] = useState<{ x: number; y: number } | null>(null);
  /*
    Which rectangle it hangs under. A new tap starts from un-nudged, or the last
    box's correction would be applied to this one's position.

    ⚠ **DERIVED FROM THE SELECTION AND NOT FROM `anchor`, AND THAT IS A HOOK
    RULE RATHER THAN A PREFERENCE.** `anchor` is computed below two early
    returns (`busy`, and a face with no measured boxes), so a hook that reads it
    would have to live below them too — and a hook after a conditional return
    runs on some renders and not others. React's answer to that is to throw
    *"Rendered more hooks than during the previous render"*, which is exactly
    what the first draft of this fix did to the whole viewer. Caught in the
    running app (law 6), not in a type or a test.
  */
  const anchorKey = open ? `${open.slots.join(" ")}:${openAt}` : null;
  useLayoutEffect(() => { setNudge(null); }, [anchorKey]);
  useLayoutEffect(() => {
    const form = askRef.current;
    const stage = form?.parentElement;
    if (!form || !stage) return;
    const inside = stage.getBoundingClientRect();
    const it = form.getBoundingClientRect();
    /* The same 8px it already hangs by, so the gap reads as one decision. */
    const margin = 8;
    let x = 0;
    if (it.left < inside.left + margin) x = (inside.left + margin) - it.left;
    else if (it.right > inside.right - margin) x = (inside.right - margin) - it.right;
    let y = 0;
    if (it.bottom > inside.bottom - margin) y = (inside.bottom - margin) - it.bottom;
    else if (it.top < inside.top + margin) y = (inside.top + margin) - it.top;
    /* Converges in one pass: the correction is applied, this runs again, and
       the second reading finds nothing to move. Rounded so a sub-pixel
       remainder cannot oscillate. */
    if (Math.round(x) === 0 && Math.round(y) === 0) return;
    setNudge((held) => ({ x: (held?.x ?? 0) + x, y: (held?.y ?? 0) + y }));
  }, [anchorKey, nudge]);

  /*
    THE BOX OPENS EMPTY, AND THE FEATURE IT IS ABOUT IS CARRIED INVISIBLY
    (FOUNDER, fable-1270 §1, on his own screenshot of the popover).

    It used to open with `open.prefill` as TYPED TEXT — *"his upper chest tattoo
    — "* sitting in the field with the caret after it. He wants hint text
    instead, and the box already says which feature it belongs to: the tag on
    the rectangle it is anchored under names it, and the field's own
    `aria-label` says it as a sentence.

    ⚠ **THE PREFILL IS NOT DROPPED, IT MOVES TO SUBMIT — and that is
    load-bearing rather than tidy.** A bare *"make it bigger"* with no noun in
    it is `unreadable` to the interpreter, which runs BEFORE the prior question
    that would have resolved WHICH tattoo she means. So the noun still has to
    reach the wire; what changed is only whether she has to look at it. Composed
    in `onSubmit` below, from the same `open.prefill` this line used to paste.
  */
  useEffect(() => {
    if (!open) return;
    setDraft("");
    fieldRef.current?.focus();
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
        /*
          AND THE LIT RECTANGLE IS THE ONE THE ASK IS ABOUT.

          A selection is about a row, so both of a pair used to light — which was
          right while every ask was about both. It is a false claim the moment
          she clicks one eye: the box says "her left eye", the ask goes out
          scoped to her left eye, and the picture would still be drawing a bright
          outline around the eye this render will not touch. Same rule as the
          panel's words on a diverged pair (fable-444 condition 1) one surface
          over — the picture may never claim what the ask does not say.

          Unscoped selections are untouched: her lips, her hair, and a pair
          tapped from the panel's own row all still light everything they mean.
        */
        const active = open?.scope !== undefined
          ? open.scope === region.slot
          : row.slots.some((slot) => selection.isSelected(slot));
        /* Lit for the instance these pixels ARE, not for its row: hovering the
           left eye's child row in the panel must light the left eye and not
           both (fable-452). A whole-row hover still lights both, because it
           hovers both slots. */
        const lit = selection.isHovered(region.slot);
        return (
          <button
            key={`${row.slots.join(" ")}:${at}`}
            type="button"
            className="dpc-regions__box"
            style={style}
            data-active={active ? "true" : "false"}
            data-lit={lit ? "true" : "false"}
            /*
              ⚠ THE LABEL IS THE SAME CLASS AS THE POPOVER, ONE ELEMENT DOWN —
              and it was found at the frame while verifying that fix, not
              reasoned about (fable-1405 asked for the class, not the instance).
              His own screenshot shows it: `Left upper arm tatto`, the last
              letter cut off at the picture's edge.

              The tag hangs from its box's LEFT corner and never wraps, so a box
              in the last quarter of the frame runs its name off the picture.
              Anchored to the box's RIGHT corner instead, the name grows inward,
              which is always safe there — the box's right edge IS near the
              picture's right edge, so there is room to the left by
              construction.

              Decided from the geometry this component already holds rather than
              by measuring the rendered text: no ref, no layout pass, and
              nothing that can disagree with where the box actually is.
            */
            data-edge={(box.x + box.width) / box.frame.width > 0.75 ? "right" : "left"}
            /*
              THE RECTANGLE NAMES WHAT IT COVERS (fable-378 (c)). On almost
              every box that is the row's own name. On a matched pair it is the
              instance — the row still reads "Her eyes" and this says "Her right
              eye", because clicking a rectangle is a promise about those pixels.
              The edit is still the row's: both slots, one ask.
            */
            aria-label={`${region.name ?? row.name}. Edit it here.`}
            /* And hovering ONE rectangle speaks about one instance, so its own
               child row lights and its sibling's does not. The parent row lights
               either way — its slots include this one. */
            onMouseEnter={() => selection.hover([region.slot])}
            onMouseLeave={() => selection.hover(null)}
            onFocus={() => selection.hover([region.slot])}
            onBlur={() => selection.hover(null)}
            onClick={() => {
              setOpenAt(at);
              /*
                THE RECTANGLE IS THE SCOPING GESTURE — fable-438 §2, granted on
                the founder's own question (*"how would i edit just the left or
                right eye?"*), and the court's answer that the engine already
                can: 31 of 32 single-side paints on exactly the asked eye, zero
                on the wrong one.

                So the box opens about THIS eye, says so in her own words, and
                the ask goes out carrying the slot. The row stays "Her eyes" and
                tapping the ROW still means both — the stylist's ontology on the
                list, the pixels on the picture, and neither has to lie for the
                other.

                Scoped only where there is something to narrow, and the second
                condition is fable-378 (c) surviving intact rather than being
                overwritten:

                  the rectangle IS an instance   a feature there is only one of
                  the server can narrow to       (her lips) sends nothing. A
                                                 scope that names the whole face
                                                 does nothing, and "does
                                                 nothing" is the silent
                                                 whole-face render this defect
                                                 class starts with — the server
                                                 refuses it rather than obeying.
                                                 ⚠ AND IT IS THE SERVER'S
                                                 ANSWER NOW, not the key's
                                                 shape: `region.scopable`
                                                 replaced `slot.includes("@")`
                                                 the day the panel learned to
                                                 draw an OPEN kind, whose
                                                 `open:wings@left` carries the
                                                 `@` and is refused by the
                                                 scope door on purpose. A
                                                 rectangle scoping into that
                                                 wall is a tap that dead-ends
                  BOTH of the pair are drawn     or the row is already about one
                                                 of them. A pair read on ONE
                                                 side has one rectangle because
                                                 the SCAN missed the other, not
                                                 because her face has one eye —
                                                 scoping there would let a
                                                 measurement gap quietly turn
                                                 "change her eyes" into "change
                                                 her left eye", which is the
                                                 rule fable-378 (c) wrote and
                                                 nothing here supersedes
              */
              const scoped = region.scopable
                && (row.regions.length > 1 || row.slots.length === 1);
              selection.select({
                slots: row.slots,
                name: scoped ? region.name ?? row.name : row.name,
                spoken: scoped ? region.spoken ?? row.spoken : row.spoken,
                prefill: scoped ? region.prefill ?? row.prefill : row.prefill,
                ...(scoped ? { scope: region.slot } : {}),
              });
            }}
          >
            <span className="dpc-regions__tag">{region.name ?? row.name}</span>
          </button>
        );
      })}

      {open && anchor ? (
        <form
          ref={askRef}
          className="dpc-regions__ask"
          /* Escape belongs to this box while it is open, and the viewer's own
             capture-phase listener has no other way to know — see the handler
             below and `CandidateViewer`'s Escape branch. */
          data-owns-escape="true"
          style={{
            left: `${((anchor.box.x + anchor.box.width / 2) / anchor.box.frame.width) * 100}%`,
            top: `${((anchor.box.y + anchor.box.height) / anchor.box.frame.height) * 100}%`,
            /* The clamp above, spoken in the transform the stylesheet already
               owns — `translate(-50%, 8px)` stays the anchoring rule and these
               are the pixels it had to give to stay inside the picture. */
            transform: `translate(calc(-50% + ${Math.round(nudge?.x ?? 0)}px), calc(8px + ${Math.round(nudge?.y ?? 0)}px))`,
          }}
          onSubmit={(event) => {
            event.preventDefault();
            const said = draft.trim();
            if (!said || busy) return;
            /* THE NOUN REJOINS HER WORDS HERE — see the open effect above. The
               field shows hint text; the wire still gets the whole sentence,
               because the interpreter reads it before anything knows which
               rectangle she tapped. */
            onAsk(`${open.prefill}${said}`, open.scope);
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
            placeholder="Describe your edit…"
            /*
              THE ROOM LEFT AFTER THE INVISIBLE NOUN — ruled fable-1613.

              This field holds the TAIL; `onSubmit` above composes
              `prefill + said` and the router caps the WHOLE. A bare 200 here
              therefore let the box build an ask the server refused, and the
              refusal read *"please keep it to 200 characters or fewer"* to
              somebody the box had already held to 200 — advice about
              characters she cannot see.

              It is SILENT rather than counted (ruled fable-1613 §2, on his own
              two prunings of this popover): the worst room the catalogue can
              produce is 151 characters and the longest ask anyone has ever
              typed is 144, so a counter here would be furniture. The condition
              that reopens that is written down — if a raised cap ever brings
              typical asks near the composed limit, the counter arrives with
              THAT build.
            */
            maxLength={refineTypingAllowance(open.prefill)}
            disabled={busy}
            /* The one label that is a SENTENCE, so it keeps the possessive
               (fable-451): a screen reader hearing "what to change about left
               eye" is being read a column header, not asked a question. */
            aria-label={`What to change about ${open.spoken}`}
          />
          <button type="submit" className="dpc-regions__submit" disabled={!draft.trim() || busy}>
            {busy ? "Refining…" : "Refine"}
          </button>
          {/*
            ⚠ THE PRICE CHIP IS GONE FROM THIS POPOVER (FOUNDER, fable-1270 §2):
            *"its already stated in the description under the chatbar."*

            The standing law is D-15/D-109 — a paid affordance states its price
            — and it is NOT being repealed. It is being read the way he reads
            it: **the price is stated once per SURFACE, not once per control.**
            The refine panel under the picture already says *"… · 25 credits
            each"*, and this popover is a second control on that same surface,
            so a second chip was the same fact said twice, eight pixels from a
            picture of somebody's face.

            The browser-drive arm that pinned the chip is AMENDED rather than
            deleted, citing this ruling — a founder ruling and a mechanised law
            disagreeing is a thing to resolve out loud, never by quietly
            dropping the assertion and never by fighting him with a test.
          */}
        </form>
      ) : null}
    </span>
  );
}
