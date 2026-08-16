import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { decodeFrame } from "../frameDecodes";
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
  /** The second caption line, where there is one. */
  personaLine?: string | null;
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
 * `stage` is the row's own state, never a guess. There is no percentage here
 * and there is no elapsed counter: between dispatch and landing the client
 * receives nothing at all, so anything that appeared to measure would be
 * measuring nothing.
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
  /** How many are running, when more than one is (the picture narrates none). */
  extra?: number;
};

/** The states, in words a person uses. */
const STAGE_WORDS: Record<ViewerWait["stage"], string> = {
  queued: "in line",
  dispatched: "being drawn",
  settling: "this one didn't make it",
};

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
 * How long a refine usually takes — MEASURED, and a copy constant on purpose.
 *
 * RE-MEASURED 2026-08-08, and the previous line had stopped being true. Last 80
 * successful paid refines on production:
 *
 *   p25 31s · median 39s · p75 111s · p90 159s · max 328s
 *   THE LAST TWENTY ALONE: median 151s
 *
 * Two populations, and the recent one is four times slower — the masked path is
 * live and spends several segmentation calls per render. The old line ("usually
 * about half a minute") was measured at median 31s on 2026-08-05 and was true
 * then; it is a lie on the current build, and a walk step delivered honestly in
 * 327.8s while the product promised half a minute.
 *
 * "A minute or two" covered both populations without promising either, and was
 * founder-approved via voice check on 2026-08-08.
 *
 * RE-MEASURED AND MOVED AGAIN, 2026-08-16 — founder: *"yes make it honest."*
 * The call census now reads the median paid edit at **204 s in dev (n=56) and
 * 209 s in production (n=4)**, off the rows themselves rather than a sample
 * (`docs/specs/EDIT_LATENCY_READING_2026-08-16.md`). So "a minute or two" was
 * under by a factor of two, and the customer met the panel's *"taking longer
 * than usual"* note while still inside the ordinary case — two sentences on one
 * screen disagreeing about the same wait.
 *
 * THIS LINE AND `LONG_WAIT_MS` IN `RefinePanel.tsx` ARE ONE PAIR. They moved in
 * one commit and are **re-measured and re-tuned together whenever the speed
 * changes** — the promise made to the founder when he ruled on the wording.
 *
 * It stays a constant rather than a query because a number that moves on its
 * own is a number nobody has checked; re-measuring and editing this line is a
 * deliberate act. **The latency itself is a named program item** — the honest
 * answer is to make it faster, not to widen the sentence again, and the cut
 * list that will shorten it is in that same document.
 */
const TYPICAL_WAIT = "usually three to four minutes";

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
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const asked = frames[index] ?? frames[0];
  const { frame, preview, sizer } = useShownFrame(asked);
  const canStep = Boolean(onIndexChange) && frames.length > 1;

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
      aria-label={`${frame.label}${frame.personaLine ? ` — ${frame.personaLine}` : ""}`}
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
            <span className="dpc-viewer__plate" data-standin={sizer ? "true" : "false"}>
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
                alt={frame.personaLine ?? frame.label}
                data-preview={preview ? "true" : "false"}
              />
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
                    <span className="dpc-viewer__waitSaid">{wait.instruction}</span>
                    <span className="dpc-viewer__waitMeta">
                      <span>{STAGE_WORDS[wait.stage]}</span>
                      <span className="dpc-viewer__waitTypical">
                        {wait.stage === "settling" ? SETTLING_NOTE : TYPICAL_WAIT}
                      </span>
                      {wait.extra ? (
                        <span className="dpc-viewer__waitTypical">
                          {`and ${wait.extra} more running`}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </>
              ) : null}
            </span>
            <figcaption className="dpc-viewer__caption">
              <span className="dp-chrome">{frame.label}</span>
              {frame.personaLine ? <span>{frame.personaLine}</span> : null}
              {canStep ? (
                <span className="dp-chrome dpc-viewer__count">
                  {index + 1} / {frames.length}
                </span>
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
