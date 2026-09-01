import { useEffect, useRef, useState } from "react";

import {
  SHOWCASE_DECK,
  deckOffsets,
  entryAt,
  type HeroDeckEntry,
} from "../heroDeck";

/**
 * THE CASTING HERO'S DECK (#234, his spec §4 — `casting-hero.md`; corrected by
 * #240).
 *
 * A prompt field alone asks the customer to imagine the result. This shows it:
 * a fanned deck of frames this studio really rendered, and under it the exact
 * sentence that cast whoever is in the centre. That pairing is the point of the
 * whole section — face and words move together, same index, always.
 *
 * The three laws that are easy to break and were written down because of it:
 *
 *   - **The deck sizes itself from its own box, with no media query and no JS
 *     measurement.** `container-type: size` on the wrapper makes `100cqh` the
 *     deck's own height, so a card is capped by BOTH the column's width and by
 *     what fits at 4:5 in the height available. Setting width and height
 *     together instead would break the ratio — `aspect-ratio` only resolves an
 *     `auto` axis.
 *   - **It stops when you look at it.** Hovering anywhere in the column holds
 *     the rotation and freezes the progress tick; a moving target someone is
 *     trying to read is hostile. `prefers-reduced-motion` gets no timer at all,
 *     and a hidden tab does not advance.
 *   - **EVERY CARD IS THE SAME KIND OF CONTROL (#240).** A click — centre or
 *     peek — puts that card's brief in the prompt field and submits nothing.
 *     A peek additionally brings itself to the centre.
 *
 *     ⚠ This used to read *"exactly as the TRY chips do"*, and #375 removed
 *     those chips PRECISELY because it was exact: two mechanisms for one job
 *     (working law 4). **The deck is the survivor and it is the better one** —
 *     a chip filled the box with a sentence somebody wrote, a card fills it
 *     with the real brief that cast the face you are looking at. Nothing here navigates: these are examples of what the studio can
 *     make, not anybody's signed Cast, so there is no room to open. The deck
 *     does not read the roster and does not vary by account — a fresh customer
 *     and an account with forty signed Casts see the same six faces.
 */

/** How long a card holds the centre. */
const DWELL_MS = 4000;

export function HeroDeck({ onUseBrief }: { onUseBrief: (brief: string) => void }) {
  const entries = SHOWCASE_DECK;
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const reduced = usePrefersReducedMotion();

  const safeIndex = entries.length === 0 ? 0 : index % entries.length;

  useEffect(() => {
    if (reduced || held || entries.length < 2) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setIndex((current) => (current + 1) % entries.length);
    }, DWELL_MS);
    return () => window.clearInterval(timer);
  }, [reduced, held, entries.length]);

  if (entries.length === 0) return null;
  const centre = entryAt(entries, safeIndex, 0);
  const offsets = deckOffsets(entries.length);

  return (
    <div
      className="dpc-deck"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
    >
      <div className="dpc-deck__stage">
        {offsets.map((offset) => {
          const entry = entryAt(entries, safeIndex, offset);
          const isCentre = offset === 0;
          return (
            <DeckCard
              key={entry.key}
              entry={entry}
              offset={offset}
              isCentre={isCentre}
              onSelect={() => {
                /*
                  A PEEK DOES BOTH, and in this order (his ruling on #240: the
                  peek's click still centres it, AND a click on any card fills
                  the field). Centring first means the brief the customer now
                  reads under the deck is the one that just landed in the box —
                  the pairing law extended to the click.
                */
                if (!isCentre) {
                  setIndex((current) => (((current + offset) % entries.length) + entries.length) % entries.length);
                }
                onUseBrief(entry.brief);
              }}
            />
          );
        })}
      </div>

      <div className="dpc-deck__brief">
        <span className="dpc-deck__eyebrow">
          {/*
            One eyebrow, because there is one deck. It says the true thing about
            these six frames — those words produced that face — and it cannot be
            read as a claim about the viewer's roster, because the caption on the
            centre card says `Example` in the same breath.
          */}
          Cast from these words
          <span className="dpc-deck__rule" aria-hidden="true" />
        </span>
        <p className="dpc-deck__quote">&ldquo;{centre.brief}&rdquo;</p>
        {/*
          THE TICKS SPAN THE COLUMN (#240, his amendment with a reference frame
          at `docs/specs/references/hero/progress-ticks-reference.png`: *"the
          bottom progress chips should expand the length of the hero section at
          the moment they are tiny"*). The geometry is CSS — each tick is
          `flex: 1` across the row — so this markup states the STATE and the
          stylesheet states the shape.
        */}
        <div className="dpc-deck__ticks" aria-hidden="true">
          {entries.map((entry, position) => (
            <span
              key={entry.key}
              className={
                position === safeIndex
                  ? "dpc-deck__tick dpc-deck__tick--now"
                  : position < safeIndex
                    ? "dpc-deck__tick dpc-deck__tick--past"
                    : "dpc-deck__tick"
              }
            >
              {position === safeIndex ? (
                <span
                  /*
                    Re-keyed on the index so the fill restarts with each card
                    rather than continuing a previous run; paused rather than
                    stopped while the deck is held, so it resumes where the eye
                    left it.
                  */
                  key={safeIndex}
                  className="dpc-deck__tickfill"
                  style={{
                    animationDuration: `${DWELL_MS}ms`,
                    animationPlayState: held || reduced || entries.length < 2 ? "paused" : "running",
                  }}
                />
              ) : null}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeckCard({
  entry,
  offset,
  isCentre,
  onSelect,
}: {
  entry: HeroDeckEntry;
  offset: number;
  isCentre: boolean;
  onSelect: () => void;
}) {
  const className = [
    "dpc-deck__card",
    isCentre ? "dpc-deck__card--centre" : "dpc-deck__card--peek",
    offset < 0 ? "dpc-deck__card--left" : offset > 0 ? "dpc-deck__card--right" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      onClick={onSelect}
      /*
        The label names what the click DOES, not what the card is. A peek states
        both of its effects because both are real state changes and a screen
        reader user gets no fan to watch.
      */
      aria-label={isCentre ? "Use this brief" : `Show ${entry.name} and use that brief`}
    >
      <img src={entry.imageUrl} alt={entry.name} loading="lazy" draggable={false} />
      {isCentre ? (
        <span className="dpc-deck__caption">
          <span className="dpc-deck__name">{entry.name}</span>
          <span className="dpc-deck__meta">{entry.meta}</span>
        </span>
      ) : null}
    </button>
  );
}

/** Motion is an accent, never the state (D-169's family). */
function usePrefersReducedMotion(): boolean {
  const query = useRef<MediaQueryList | null>(null);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    query.current = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.current.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.current.addEventListener("change", listener);
    return () => query.current?.removeEventListener("change", listener);
  }, []);
  return reduced;
}
