import { useEffect, useRef } from "react";
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
  stage: "queued" | "dispatched";
  /** How many are running, when more than one is (the picture narrates none). */
  extra?: number;
};

/** The two states, in words a person uses. */
const STAGE_WORDS: Record<ViewerWait["stage"], string> = {
  queued: "in line",
  dispatched: "being drawn",
};

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
 * "A minute or two" covers both populations without promising either, and it
 * hands off exactly where the panel's supervised-wait sentence takes over past
 * two minutes. Founder-approved via voice check, 2026-08-08.
 *
 * It stays a constant rather than a query because a number that moves on its
 * own is a number nobody has checked; re-measuring and editing this line is a
 * deliberate act. **The latency itself is a named program item** — the honest
 * answer is to make it faster, not to widen the sentence again.
 */
const TYPICAL_WAIT = "usually a minute or two";

export function CandidateViewer({
  frames,
  index,
  onIndexChange,
  onClose,
  below,
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
  const frame = frames[index] ?? frames[0];
  const canStep = Boolean(onIndexChange) && frames.length > 1;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, onIndexChange, canStep, index, frames.length]);

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
        if (target.closest("img, .dpc-viewer__chrome, .dpc-refine, .dpc-regions")) return;
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

      <figure className="dpc-viewer__frame" data-wait={wait ? "true" : "false"}>
        {/*
          The picture and everything laid over it share one box, so the dots and
          the type land on the IMAGE rather than on the letterboxing beside it.
          An overlay measured against the figure would drift the moment a
          portrait and a landscape frame sat in the same viewer.
        */}
        <span className="dpc-viewer__plate">
          <img src={frame.url} alt={frame.personaLine ?? frame.label} />
          {/* The face's own regions, in the same box as the picture. */}
          {overlay}
          {wait ? (
            <>
              <span className="dpc-viewer__dots" aria-hidden="true" />
              <span className="dpc-viewer__falloff" aria-hidden="true" />
              <span className="dpc-viewer__wait" role="status">
                <span className="dpc-viewer__waitSaid">{wait.instruction}</span>
                <span className="dpc-viewer__waitMeta">
                  <span>{STAGE_WORDS[wait.stage]}</span>
                  <span className="dpc-viewer__waitTypical">{TYPICAL_WAIT}</span>
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
      {below}
    </div>,
    document.body,
  );
}
