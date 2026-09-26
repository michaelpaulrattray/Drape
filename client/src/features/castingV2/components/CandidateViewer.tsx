import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { decodeFrame } from "../frameDecodes";
import { refineProgress } from "../refineProgress";
import type { RefineStep } from "@shared/refineSteps";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";

/**
 * THE image viewer, and the only interaction grammar images have.
 *
 * Founder gate item 18: *"I cannot judge a face at tile size."* Which is the
 * whole milestone's job — a sheet exists so someone can choose between eight
 * people, and at 178px you can see a silhouette and a haircut but not a face.
 *
 * **One grammar, product-wide, no exceptions** (founder ruling, 2026-08-02):
 *
 *   click opens · ← → walk the set · Esc closes · download lives HERE
 *
 * Clicking IS expanding, so the expand icon is gone everywhere — an icon whose
 * only job is to do what clicking the thing already does is furniture. And
 * download moved off the image and into this chrome, because hover-revealed
 * controls over someone's face turn a room into a file manager, and because a
 * control you must discover by hovering is a control most people never find.
 *
 * **The set is passed in, not the frame.** The three call sites had grown three
 * near-identical modulo walks, which is drift already happening; now the walk
 * is written once and a caller supplies `frames` + `index`. A caller with a
 * single image passes a set of one and the arrows simply do nothing.
 *
 * **Downloads amend D-52's letter, not its reason.** That ruling made the
 * canvas viewer view-only because it exposed EDITING outside the edit ceremony.
 * Download neither spends nor destroys nor edits — it hands the owner bytes
 * they already own and already paid for (D-105). Keep/Discard/Sign stay on the
 * tile, where the surrounding context is.
 *
 * Portalled to `document.body` so no ancestor's `overflow` or stacking context
 * can clip it — the mistake that produced item 17 one milestone earlier.
 */
export type ViewerFrame = {
  url: string;
  /**
   * A small copy of THIS frame, shown while the full one decodes (fable-503).
   *
   * Absent on a frame with no thumbnail — every version delivered before
   * thumbnails existed — and then the viewer holds the previous picture, which
   * is what it did before there was anything smaller to show.
   */
  previewUrl?: string | null;
  /** Shown in the caption chrome: "03", "Close-up", "Master". */
  label: string;
  /**
   * The second caption line, where there is one.
   *
   * It was named after the candidate disposition until #1241 retired that field
   * end to end. The SLOT was never a disposition: on a sheet it carried
   * one (and carries nothing now), while in the cast room it carries her NAME
   * and the founder's third-case sentence for a sibling whose sheet is gone.
   * Renamed to what it is rather than deleted with the field, which would have
   * taken those two with it.
   */
  caption?: string | null;
  /**
   * The saved filename, WITHOUT extension.
   *
   * A product name, never a storage key — a customer saving her own face should
   * get "Nine-close-up.png", not a UUID. Required rather than optional so a new
   * frame cannot reach the viewer with nothing to call itself.
   */
  downloadName: string;
  /**
   * The caller's own id for this frame, when it has one.
   *
   * Ignored by the viewer — it exists so a caller can map an index back to its
   * own record without keeping a second parallel array in sync.
   */
  candidateId?: string;
};

/**
 * A refinement running on the face being shown (D-169).
 *
 * The picture IS the loader, because every refinement is `edit(this picture,
 * these words)` — it is the input, not decoration, and softening it says the
 * only true thing there is to say while nothing else is known.
 *
 * `stage` is the row's own state, never a guess, and `step` is where the ROAD
 * has announced itself to be (#55). There is no percentage here and there is no
 * elapsed counter: the four stages are events the pipeline genuinely passes,
 * and nothing between them is measured, interpolated or guessed at.
 */
export type ViewerWait = {
  /** Their words, verbatim — the record's own text (D-172). */
  instruction: string;
  /**
   * The row's own state. Two of these are a live render moving; the third is
   * not a further point along it.
   *
   * `settling` says the operation's lease has passed, so nobody is working on
   * this row and the recovery sweep now owns it (fable-467). It is here
   * because the alternative — going on saying "being drawn" about a render
   * that died — is what held the founder in a locked sheet for five minutes.
   */
  stage: "queued" | "dispatched" | "settling";
  /**
   * WHERE THE ROAD HAS GOT TO — `preparing` · `rendering` · `reading` ·
   * `storing`, or null when it has announced nothing about this row (#55).
   *
   * Optional on the type and never defaulted in the component: a caller that
   * does not know is a caller whose row gets no bar and no word, which is the
   * honest reading and is his rule — *a stage that does not fire is not shown*.
   */
  step?: RefineStep | null;
  /** How many are running, when more than one is (the picture narrates none). */
  extra?: number;
};

/**
 * THE FRAME THIS ONE REPLACED, for holding against it (M12 row 3).
 *
 * The plan's M12 asks the focused editor for "current-vs-proposed", and the
 * reconciliation's second pass found the capability already proven in the
 * product — on the road V2 replaced. The legacy viewer holds the previous frame
 * under a press (`StudioCanvas`, `ImageViewerPanel`'s `compareUrl`/
 * `compareLabel`); V2 shipped without it, so the only way to see what an edit
 * changed was to click between two chips and remember.
 *
 * **Passed in, never derived here.** Same law as `before`/`beside`/`overlay`:
 * this component is the one image grammar and does not learn what a version is.
 * The caller knows which frame precedes the one on screen; the viewer only
 * knows there is one and what to call it.
 */
export type ViewerCompare = {
  url: string;
  /** "Original" or "Previous" — the legacy road's own two words. */
  label: string;
};

/**
 * How long the press must be held before the previous frame appears.
 *
 * 150ms, taken from the legacy road rather than chosen (`StudioCanvas.tsx:224`),
 * because this is an inheritance and two viewers in one product that answer the
 * same gesture at different speeds are two products. Long enough that an
 * ordinary click never flickers the old frame on its way to doing nothing.
 */
const COMPARE_HOLD_MS = 150;

/**
 * THE ONE STATE THAT IS NOT A STAGE, in words a person uses.
 *
 * ⚠ **THIS WAS A THREE-ENTRY MAP — `in line` / `being drawn` / this — AND ITS
 * FIRST TWO ENTRIES ARE GONE ON HIS WORD (#55, 2026-09-26).** They were the
 * whole vocabulary a wait had while the road announced nothing; the road
 * announces four real stages now, and `refineProgress` names them, so two
 * general words standing in for four specific ones would be the product
 * knowing something the person cannot see.
 *
 * `settling` stays here and never moves into that list, because it is not a
 * point along the road at all: the operation's lease has passed, nobody holds
 * the row, and the recovery sweep is refunding it (fable-467). It gets no bar
 * and no stage word for exactly that reason.
 */
const SETTLING_WORD = "this one didn't make it";

/**
 * What is true INSTEAD of the typical wait, once nobody is rendering.
 *
 * The typical-wait line is a promise about a render in progress. Over a
 * row the sweep has taken, it is a promise about nothing — and the only thing
 * the customer actually needs at that moment is where their credits went. It
 * is the same sentence the long-wait copy and the lost-contact line already
 * make, said by the one surface that now knows it for certain.
 */
const SETTLING_NOTE = "your credits come back on their own";

/**
 * ⚠ THE EXPECTED-TIME LINE LIVED HERE AND HE TOOK IT OFF THE PICTURE (#55,
 * 2026-09-26, verbatim while drawing the loader: *"make the bar one line not 4
 * different line dont put the excpected time either and place the
 * painting/state under the loading bar"*; the filed spec says it flatly —
 * **No expected-time line anywhere.**).
 *
 * What stood here was `TYPICAL_WAIT = "usually three to four minutes"`, and it
 * was honest: founder-ruled on 2026-08-16 (*"yes make it honest"*) off the call
 * census reading the median paid edit at 204 s in dev (n=56) and 209 s in
 * production (n=4) — `docs/specs/EDIT_LATENCY_READING_2026-08-16.md`. It had
 * gone stale twice before that (half a minute → a minute or two → three to
 * four minutes), which is the argument he has now settled the other way: a
 * surface that promises a duration is a surface somebody has to keep
 * re-measuring, and the four real stages say more while promising nothing.
 *
 * **The measurement did not go with the sentence.** `LONG_WAIT_MS` in
 * `RefinePanel.tsx` still stands at five minutes BECAUSE of that reading, and
 * its docblock carries it — so the number that matters is still dated, still
 * sourced, and still re-measured when the speed changes. What is gone is the
 * second copy of it on the photograph, and with it the pair that could
 * disagree with itself.
 */

/**
 * THE PICTURE CHANGES WHEN THE NEW ONE CAN BE PAINTED (fable-501 §a).
 *
 * A src swapped on an <img> is a request, not a picture: until the bytes have
 * DECODED there is nothing to draw, and a fetched-but-undecoded frame still
 * flashes. So the frame on screen holds until the next one is decodable, and
 * then it changes in one paint — no blank, no layout shift.
 *
 * Only WITHIN one face. Stepping the arrows to the next candidate is a
 * different question and must answer immediately: holding the previous woman's
 * photograph while the next decodes would draw her under the next one's name.
 *
 * A decode that FAILS shows the frame anyway. The alternative is a viewer
 * stranded on a picture the user did not ask for because an instrument said no
 * — the same asymmetry the mint's courtesy reads use.
 */
function useShownFrame(frame: ViewerFrame): {
  frame: ViewerFrame; preview: boolean;
  /** The frame being LEFT, drawn hidden to hold the box — see the return. */
  sizer: string | null;
} {
  const [shown, setShown] = useState(frame);

  /*
    ONE DOWNLOAD PER PICTURE, however many times this effect runs — the
    founder's stuck plate, diagnosed rather than argued (fable-609/610).

    `frame` is rebuilt on every render of the sheet, so this effect re-ran on
    every render: each run built a NEW `Image`, set the same src, and started
    the fetch again. Instrumented from the driver under Fast 3G, that is exactly
    what the browser recorded — the wanted frame requested at 44.5s, 46.9s,
    48.0s and 50.5s, and **not one of those decodes ever settled**. Each restart
    threw away the download that was nearly finished, so a 2.6MB PNG on a slow
    connection never arrived at all and the plate kept drawing the frame it
    already had while the chip beside it had moved on: *"the features switch but
    not the image."*

    Re-keying the effect on the URLs was tried first and did not carry its own
    measurement (eight throttled bursts, four failures against one in six), so
    it was reverted. This is the reading's own fix: the in-flight decode is held
    BY URL, so a re-render joins the download already running instead of
    starting a rival to it. The first render of a new picture starts exactly one
    fetch; every render after it waits on that one.

    A decode that FAILS still shows the frame, unchanged: the alternative is a
    viewer stranded on a picture nobody asked for because an instrument said no.

    THE HOLDER NOW LIVES OUTSIDE THIS COMPONENT (`frameDecodes.ts`, fable-686
    §2c) so that a version she has NOT clicked can be decoded while she looks at
    this one. Same holder, so a prefetch and a click can never start two
    downloads of one picture — which is the very defect it was built for.
  */
  /*
    AND A LATE SETTLE NEVER PAINTS OVER A NEWER CLICK (founder bug, fable-701 §4
    / fable-725 §2 — the OTHER half of "sometimes it doesn't switch").

    The burst watch caught the plate coming back to an abandoned version eight
    seconds after the click, with the lit chip never moving: both surfaces read
    the same override through one function, so the override was applying
    throughout and what moved was this held frame.

    The effect's own cleanup (`live`, below) is not enough on its own, and the
    gap is exactly one commit wide. Cleanup runs when React FLUSHES the next
    render's passive effects, which happens after paint and can be many
    milliseconds behind the click during a burst — and a decode that settles
    inside that window finds `live` still true and paints the frame it was
    started for, which by then is a version she has already clicked past.

    So the settle asks the question the cleanup cannot: **is this still the
    picture being asked for?** Held in a ref written from a LAYOUT effect, which
    React runs synchronously inside the commit — before any promise callback can
    run — so there is no window at all between the click's render landing and
    this being true. A settle for a superseded version is dropped, and the frame
    it wanted arrives when its own decode lands.
  */
  const wanted = useRef(frame.url);
  useLayoutEffect(() => { wanted.current = frame.url; }, [frame.url]);

  /** The small copy standing in for a picture that is still downloading, and
   *  the picture it stands in for. See the return below. */
  const standing = useRef<{ forUrl: string; previewUrl: string } | null>(null);
  useLayoutEffect(() => {
    if (frame.previewUrl) standing.current = { forUrl: frame.url, previewUrl: frame.previewUrl };
  }, [frame.url, frame.previewUrl]);

  useEffect(() => {
    if (frame.url === shown.url) return;
    if (frame.candidateId !== shown.candidateId) { setShown(frame); return; }
    /* `live` stays for what it is good at: one paint per picture rather than one
       per render that joined the same download. `wanted` is the ordering rule. */
    let live = true;
    void decodeFrame(frame.url).then(() => {
      if (live && wanted.current === frame.url) setShown(frame);
    });
    return () => { live = false; };
  }, [frame, shown]);

  /*
    AND WHILE IT DECODES, THE SMALL COPY OF THE RIGHT PICTURE (fable-501 §a,
    buildable now that fable-503 mints one).

    Holding the PREVIOUS frame was the honest answer while the rail's chips
    were the full pictures — there was no smaller asset to show. With one, the
    viewer can show what they clicked immediately, soft, and sharpen in place:
    the same frame, the same box, no blank and no layout shift. Without one
    (every version delivered before thumbnails) this is exactly what it was.

    AND IT SAYS WHICH IT IS (fable-686 §2a). The founder: the switch works but
    *"could feel more graceful"* — a small picture blown up to 760px is soft
    whatever anyone intends, and softness with no reason reads as a bad photo.
    Marked as a preview, the same softness is the sheet's own loading state: it
    goes sharp when the real bytes land, which is the whole of the arrival
    moment and is the treatment he already likes on a render.
  */
  /*
    AND THE SMALL COPY DOES NOT LEAVE BEFORE THE REAL ONE ARRIVES (founder's
    abandoned-version comeback, reproduced by the burst watch and read at the
    trace: the plate held the last click's small copy for 11.4 seconds and then
    showed an ENTIRELY DIFFERENT VERSION's full frame, with the lit chip never
    moving).

    The small copy on screen is the picture she clicked. It arrives here through
    `previewUrl`, which the sheet fills only WHILE THE OVERRIDE APPLIES — and
    the override is spent the moment the server catches up. So the sequence was:
    she clicks, the small copy paints instantly, the 2.6MB frame starts
    downloading, and eight seconds later the write lands, the claim is spent,
    `previewUrl` goes null — and this returned `shown`, which is whatever was
    decoded LAST, a version she passed through two clicks ago. It sat there
    until the real bytes finished.

    Nothing about the picture on screen changed at that moment. What changed was
    the answer to a different question — has the server caught up — and a
    surface that redraws on someone else's news is the mirror law wearing a
    different coat. So the stand-in is remembered HERE, against the URL it
    stands in for, and it holds until that URL's own bytes land.

    Written from a layout effect: it is only ever read on a later render (the
    render that loses `previewUrl` is by definition after the one that had it),
    and a ref written in the commit cannot be a render that disagrees with the
    DOM it just produced.
  */
  if (frame.url === shown.url) return { frame, preview: false, sizer: null };
  const standIn = frame.previewUrl
    ?? (standing.current?.forUrl === frame.url ? standing.current.previewUrl : null);
  /*
    AND THE FRAME BEING LEFT HOLDS THE BOX WHILE THE STAND-IN IS DRAWN
    (fable-729 §2 — the SIZER half of the two-layer form, without the fade the
    founder dropped in fable-728).

    A thumbnail is 320px on its longest side and the full frame is ~1500;
    `max-width`/`max-height` only ever shrink, and the plate has no definite
    height of its own — so the picture COLLAPSED to the small copy's natural
    size on every switch and grew back when the real bytes landed. Measured
    with the rail recorder: the plate goes 420px tall to 320 and back, and the
    version rail beside it moves **50px vertically each way**, on one press in
    three. That is not a grace note; it is a thumbnail travelling under his
    hand while he is clicking, which is the class this whole chunk is about.

    So the outgoing frame — already decoded, already on screen, no second
    download — is drawn hidden underneath at its own size and the stand-in is
    laid over it. The box stops moving. The cut stays hard: no fade, no
    transition, exactly the behaviour he has now, minus the jump.
  */
  return standIn
    ? { frame: { ...frame, url: standIn }, preview: true, sizer: shown.url }
    : { frame: shown, preview: false, sizer: null };
}

export function CandidateViewer({
  frames,
  index,
  onIndexChange,
  onClose,
  below,
  before,
  beside,
  overlay,
  wait,
  compare,
}: {
  /** The set being walked. One image is a set of one. */
  frames: readonly ViewerFrame[];
  index: number;
  /** Absent for a single frame: there is nowhere to step to. */
  onIndexChange?: (next: number) => void;
  onClose: () => void;
  /**
   * What sits under the picture — the refine panel, where a caller has one.
   *
   * Passed in rather than built here so this component stays what it is: the
   * one image grammar, used by three call sites, only one of which has anything
   * to refine. A viewer that knew about candidates and variants would be a
   * viewer the room and the package could no longer use.
   */
  below?: React.ReactNode;
  /**
   * What stands BESIDE the picture, in a column of its own — the face's panel.
   *
   * It is not `below` and the distinction is load-bearing. `below` shares the
   * viewer's one vertical axis with the picture, and this viewer's rule is that
   * *the panel is short and fixed, the image is the elastic one*. Panel v2 is the
   * whole catalogue — sixteen rows, ~1200px — so as a `below` it took every pixel
   * and the photograph rendered at 0×0 (shift 27, `output/panel-v2/`). A column
   * beside the picture never competes with it for height, which is also the
   * structure the founder's own mock has: versions left, picture centre, the
   * panel docked right, only the ask box across the bottom.
   */
  beside?: React.ReactNode;
  /**
   * What stands to the LEFT of the picture — the versions of this face.
   *
   * The other half of the same ruling as `beside`: *"thumbnails to appear on the
   * LEFT side and the segments to appear on the RIGHT, only the chatbox is at
   * the bottom."* Passed in for the same reason everything else here is — this
   * component is the one image grammar and does not learn what a version is.
   */
  before?: React.ReactNode;
  /**
   * What is laid OVER the picture, inside the plate — the face's own regions,
   * where a caller has them (fable-200).
   *
   * Inside the plate rather than the figure for the same reason the wait
   * treatment is: an overlay measured against the figure drifts the moment a
   * portrait and a landscape frame share a viewer, and a region box drawn a few
   * per cent off is a click target over the wrong feature. Passed in, so this
   * component stays the one image grammar and does not learn what a slot is.
   */
  overlay?: React.ReactNode;
  /** A refinement running on this face — the picture becomes its loader. */
  wait?: ViewerWait | null;
  /** The frame this one replaced, held against it under a press. Absent on the
   *  original, on a single-frame caller, and wherever there is no previous. */
  compare?: ViewerCompare | null;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const asked = frames[index] ?? frames[0];
  const { frame, preview, sizer } = useShownFrame(asked);
  const canStep = Boolean(onIndexChange) && frames.length > 1;

  /*
    HOLD TO SEE THE ONE BEFORE IT.

    The previous frame is MOUNTED whenever there is one, and only its visibility
    changes — the same device, and the same reason, as the sizer above: a hidden
    element is still decoded, so the swap is instant and cannot flash. Swapping
    `src` on the live image would fight this viewer's own founding rule, which is
    that the picture changes when the next one can be PAINTED (`useShownFrame`).

    The timer is the whole of the gesture: a click is a press that ended before
    it, and it must leave the picture exactly as it found it.
  */
  /*
    WHAT THE BAR AND THE WORD SAY — derived, in one place, from the row (#55).

    Null is the answer whenever nothing honest can be shown: a settling row, or
    a row the road has announced nothing about. The component draws neither
    element in that case rather than drawing an empty one, so there is no bar
    at zero implying a render that has not started.
  */
  const progress = wait ? refineProgress({ stage: wait.stage, step: wait.step ?? null }) : null;
  const [comparing, setComparing] = useState(false);
  const holdRef = useRef<number | null>(null);
  const releaseCompare = () => {
    if (holdRef.current !== null) {
      clearTimeout(holdRef.current);
      holdRef.current = null;
    }
    setComparing(false);
  };
  /*
    AND THE HOLD ENDS WHEN THERE IS NOTHING LEFT TO HOLD AGAINST.

    Selecting the original while the button is down removes the previous frame
    under a live gesture. Without this the badge would name a picture that is no
    longer mounted, which is the stalest thing a surface can say.
  */
  useEffect(() => {
    if (!compare) releaseCompare();
    return () => {
      if (holdRef.current !== null) clearTimeout(holdRef.current);
    };
  }, [compare]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        /*
          A CONTROL INSIDE MAY OWN ESCAPE, and this listener is capture-phase, so
          without asking it never finds out. The scoped box on the picture says
          in its own code that Esc closes IT and spends nothing; what actually
          happened was that the whole viewer closed underneath it, because this
          ran first and `stopPropagation` in a child cannot reach a capture
          listener on the document.

          Same class as the ←/→ carve-out below — a global key handler eating a
          key an inner control owns — so it gets the same shape of answer, and a
          generic one: the viewer asks whether the event came from something that
          claims the key, and never learns what that something is.
        */
        if ((event.target as HTMLElement | null)?.closest?.("[data-owns-escape]")) return;
        event.stopPropagation();
        onClose();
        return;
      }
      /*
        A FIELD OWNS ITS OWN ARROW KEYS, and here that is a money rule.

        This listener is capture-phase, so it used to eat ←/→ before the refine
        input saw them: the caret could not be moved, and the viewer silently
        walked to the next face while a half-typed instruction stayed on screen.
        Enter then fired a 25-credit refine at somebody else.
      */
      const typing = (event.target as HTMLElement | null)?.closest("input, textarea");
      if (typing) return;
      if (canStep && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
        event.preventDefault();
        event.stopPropagation();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        onIndexChange?.((index + direction + frames.length) % frames.length);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    /*
      The page behind must not scroll while a full-screen viewer is open —
      otherwise closing it returns you somewhere else in the sheet, and the
      candidate you were comparing against has moved.
    */
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose, onIndexChange, canStep, index, frames.length]);

  /*
    FOCUS IS TAKEN ONCE, WHEN THE VIEWER OPENS — and never again.

    It used to live in the effect above, whose dependencies include the callers'
    inline `onClose`/`onIndexChange`. Those are new objects on every render of the
    sheet, so the effect re-ran on every render and dragged focus back to the
    close button each time: the scoped box on the picture opened with the caret in
    its field and lost it before a second character could be typed, and Escape —
    now belonging to the close button — shut the whole viewer instead of the box.

    Empty deps, so it happens at open and stays where the person put it. The
    body-scroll lock moves here for the same reason: it is a fact about the
    viewer being open, not about who its callbacks currently are.
  */
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    /* The page behind must not scroll while a full-screen viewer is open —
       otherwise closing it returns you somewhere else in the sheet, and the
       candidate you were comparing against has moved. */
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (!frame) return null;

  return createPortal(
    <div
      className="dpc-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`${frame.label}${frame.caption ? ` — ${frame.caption}` : ""}`}
      /*
        CLOSE ON ANYTHING THAT IS NOT THE PICTURE OR THE CHROME.

        The old test was `target === currentTarget`, which only closed on the
        scrim ITSELF — so the `<figure>`'s padding, the caption row's whitespace
        and the gap beside the image all counted as "inside" and swallowed the
        click. The user aims at empty space, nothing happens, and the dialog
        feels stuck for a reason nothing on screen explains.

        Asking what was hit is the honest question: the image and the chrome are
        the surface, everything else is out.
      */
      onClick={(event) => {
        const target = event.target as HTMLElement;
        /* Every slot this viewer renders belongs to the surface — the rail and
           the dock included. Left out of this list, a tap on a panel row read as
           a tap on the scrim and closed the whole viewer. */
        /*
          AND THE MENU THAT OPENS FROM A CHIP, which is not a DOM descendant of
          this viewer at all — `CardMenu` portals its panel to `document.body`.
          A React portal still bubbles through the REACT tree, so its clicks
          arrive here with a target that is nowhere inside the viewer's own
          markup, and without this the first use of the chip's own menu closed
          the whole viewer. Caught by driving it (law 6), which is the second
          time this list has learned the same lesson.
        */
        if (target.closest(
          "img, .dpc-viewer__chrome, .dpc-viewer__rail, .dpc-viewer__dock, .dpc-refine, .dpc-regions, .dpc-cardmenu__panel, .dpc-cardmenu__trigger",
        )) return;
        onClose();
      }}
    >
      <div className="dpc-viewer__chrome">
        {/*
          The one download control in the product. It is here rather than on the
          image because this is where someone has already decided they want a
          closer look at this particular picture.
        */}
        <a
          className="dp-btn--onmedia dpc-viewer__download"
          href={frame.url}
          download={`${frame.downloadName}.png`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Download ${frame.label}`}
          onClick={(event) => event.stopPropagation()}
        >
          <Download size={15} strokeWidth={2} aria-hidden="true" />
        </a>
        <button
          ref={closeRef}
          type="button"
          className="dp-btn--onmedia dpc-viewer__close"
          aria-label="Close the viewer"
          onClick={onClose}
        >
          <X size={15} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {/*
        THE STAGE: the picture, and whatever stands beside it. One row, so the
        panel's own length can never be taken out of the photograph's height.
      */}
      <div className="dpc-viewer__stage" data-beside={beside ? "true" : "false"}>
        {before ? <aside className="dpc-viewer__rail">{before}</aside> : null}
        <div className="dpc-viewer__column">
          {/*
            THE SOFTENING IS A CLAIM THAT SOMETHING IS BEING DRAWN, so it is
            withheld the moment nothing is. Photographed first (law 6): a
            settling row under the full treatment is a blurred, pulsing
            photograph over the words "this one didn't make it" — the picture
            saying work is happening while the sentence says it stopped. On a
            settling row the picture comes back and only the sentence remains.
          */}
          <figure
            className="dpc-viewer__frame"
            data-wait={wait ? (wait.stage === "settling" ? "settling" : "true") : "false"}
          >
            {/*
              The picture and everything laid over it share one box, so the dots and
              the type land on the IMAGE rather than on the letterboxing beside it.
              An overlay measured against the figure would drift the moment a
              portrait and a landscape frame sat in the same viewer.
            */}
            <span
              className="dpc-viewer__plate"
              data-standin={sizer ? "true" : "false"}
              data-comparing={comparing ? "true" : "false"}
              /* Pointer events rather than mouse: one set of handlers answers a
                 finger and a stylus as well, and this gesture has no reason to
                 be a desktop-only capability. */
              onPointerDown={(event) => {
                if (!compare || event.button !== 0) return;
                /*
                  ONLY ON THE PHOTOGRAPH ITSELF.

                  The regions lie over this same plate and are the other door
                  onto a paid edit; a press on one of those is aiming at a
                  feature, not asking to see the frame before. Without this,
                  pointing at her eye swaps her face for as long as the finger
                  is down. The compare layer takes no pointer events and the
                  sizer is `visibility: hidden`, so the only image a press can
                  land on here is the one on screen.
                */
                if (!(event.target as HTMLElement | null)?.closest?.("img")) return;
                holdRef.current = window.setTimeout(
                  () => setComparing(true),
                  COMPARE_HOLD_MS,
                );
              }}
              onPointerUp={releaseCompare}
              /* Leaving with the button still down ends it too — otherwise the
                 previous frame stays up with nothing holding it, and the only
                 way back is a second press. */
              onPointerLeave={releaseCompare}
              onPointerCancel={releaseCompare}
            >
              {/*
                THE OUTGOING FRAME, HIDDEN, HOLDING THE BOX (fable-729 §2).

                Only while a stand-in is drawn, and always a picture that is
                already decoded — it is the one that was on screen a moment ago
                — so it costs no download and cannot flash. `alt=""` and
                `aria-hidden`: it is furniture, and a screen reader hearing the
                previous version described would be told the wrong picture.
              */}
              {sizer ? (
                <img className="dpc-viewer__sizer" src={sizer} alt="" aria-hidden="true" />
              ) : null}
              {/* Soft while it IS the small copy, sharp the moment the real
                  bytes land — one element, so there is no second decode and
                  nothing to flash between two layers. */}
              <img
                src={frame.url}
                alt={frame.caption ?? frame.label}
                data-preview={preview ? "true" : "false"}
              />
              {/*
                THE FRAME BEFORE THIS ONE — mounted whenever there is one, shown
                only while the press is held.

                `alt=""` and `aria-hidden`: while it is hidden it is not a
                picture anyone is being shown, and while it IS shown the badge
                below names it. A screen reader hearing two photographs
                described in one plate would be told the face has two faces.
              */}
              {compare ? (
                <img
                  className="dpc-viewer__compare"
                  src={compare.url}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                />
              ) : null}
              {/*
                AND IT SAYS WHICH PICTURE IT IS.

                A held gesture that silently swaps someone's face is a surface
                the user has to test to trust. The badge is the legacy road's
                own answer, in this product's chrome type — and it is the reason
                the label travels with the URL rather than being guessed here.
              */}
              {compare && comparing ? (
                <span className="dp-chrome dpc-viewer__compareBadge" role="status">
                  {compare.label}
                </span>
              ) : null}
              {/* The face's own regions, in the same box as the picture. */}
              {overlay}
              {wait ? (
                <>
                  {/* The dot field is the render's own texture — nothing is
                      rendering, so nothing moves. */}
                  {wait.stage === "settling"
                    ? null
                    : <span className="dpc-viewer__dots" aria-hidden="true" />}
                  {/* The scrim stays either way: the sentence has to be
                      readable over a photograph that is no longer softened. */}
                  <span className="dpc-viewer__falloff" aria-hidden="true" />
                  <span className="dpc-viewer__wait" role="status">
                    {/*
                      THE SAME DEFECT AS #1187 AND THE SAME ONE-LINE ANSWER —
                      his ruling there (*"Add a hover tooltip"*) read across by
                      working law 7, which asks for the class rather than the
                      instance.

                      This is HER OWN ASK, `nowrap` + ellipsis at `max-width:
                      24ch` — a harder clip than the made row's 701px, on the
                      screen she is watching while the render she paid for runs.
                      Nothing else on the page carries the sentence at that
                      moment, so without this it cannot be read back at all.

                      Same stated price: a hover affordance does nothing on a
                      touch surface.
                    */}
                    <span className="dpc-viewer__waitSaid" title={wait.instruction}>
                      {wait.instruction}
                    </span>
                    {/*
                      ONE BAR, ONE LINE, AND THE STAGE WORD UNDER IT (#55, his
                      own shape: *"make the bar one line not 4 different line …
                      and place the painting/state under the loading bar"*).

                      The fill is set from the row, inline, because it is DATA —
                      the position of a real event among four. It is deliberately
                      not a keyframe: an animation that grows a width over time
                      IS a progress bar whoever wrote it, and it would be
                      measuring a wait nobody is measuring. `aria-hidden` because
                      the word underneath says the same thing in words, and a
                      reported figure would be the number this card exists to
                      refuse.
                    */}
                    {progress ? (
                      <>
                        <span className="dpc-viewer__bar" aria-hidden="true">
                          <span
                            className="dpc-viewer__barFill"
                            style={{ width: `${progress.fraction * 100}%` }}
                          />
                        </span>
                        <span className="dpc-viewer__step">{progress.word}</span>
                      </>
                    ) : null}
                    {/*
                      AND THE META ROW IS NOW ONLY FOR WHAT IS NOT A STAGE.

                      A settling row says what happened and where the money went
                      — it has no bar and no stage word, because nobody is
                      rendering it. A second render out on the same face is a
                      true fact about work in flight and is kept; it is the one
                      thing here that is neither progress nor a promise.
                    */}
                    {wait.stage === "settling" || wait.extra ? (
                      <span className="dpc-viewer__waitMeta">
                        {wait.stage === "settling" ? (
                          <>
                            <span>{SETTLING_WORD}</span>
                            <span className="dpc-viewer__waitTypical">{SETTLING_NOTE}</span>
                          </>
                        ) : null}
                        {wait.extra ? (
                          <span className={wait.stage === "settling" ? "dpc-viewer__waitTypical" : undefined}>
                            {`and ${wait.extra} more running`}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                </>
              ) : null}
            </span>
            <figcaption className="dpc-viewer__caption">
              <span className="dp-chrome">{frame.label}</span>
              {frame.caption ? <span>{frame.caption}</span> : null}
              {canStep ? (
                <span className="dp-chrome dpc-viewer__count">
                  {index + 1} / {frames.length}
                </span>
              ) : null}
              {/*
                A GESTURE NOBODY IS TOLD ABOUT IS A GESTURE NOBODY USES — the
                same argument that moved download off a hover.

                It sits in the caption's own chrome register, beside the count,
                rather than on the photograph: a hint drawn over someone's face
                is furniture, and this one is only needed until the first time
                it is tried. It stands down while the press is held, because the
                badge is then saying the more useful half.

                No cursor change goes with it. `grab` would promise dragging the
                picture, which this viewer does not do — the exact mistake the
                founder's 2026-08-02 ruling caught in `zoom-in`.

                THE LEGACY ROAD'S OWN WORDS, not a sentence of my own: it
                advertises this gesture as the key/label pair `Hold` · `Compare`
                (`ImageViewerPanel.tsx:572`). Keeping them means this reads as
                chrome — the same register as the count it stands beside, which
                is why mono is right here and wrong on the wait's own sentence.
              */}
              {compare && !comparing ? (
                <span className="dp-chrome dpc-viewer__compareHint">Hold · Compare</span>
              ) : null}
            </figcaption>
          </figure>
          {/*
            THE FURNITURE STANDS UNDER THE PICTURE, NOT UNDER THE VIEWER
            (fable-377, on the founder's screenshot).

            `below` used to be a sibling of the whole stage, so it centred on the
            viewer while the picture centred on the stage's middle column — and
            those are not the same line, because the rail on the left and the
            dock on the right are different widths. Measured before the change:
            the picture at 606, the input at 685, the row and its notes at 720.
            **Three centrelines on one surface**, and his eye found it in a
            screenshot.

            One authority now: the image's own column. The ask box, the credits
            line and the undo line hang off the picture they are about, which is
            the founder's design language — the image is the subject and the
            furniture aligns to it.
          */}
          {below}
        </div>
        {beside ? <aside className="dpc-viewer__dock">{beside}</aside> : null}
      </div>
    </div>,
    document.body,
  );
}
