import { useEffect, useMemo, useRef, useState } from "react";

import {
  deckOffsets,
  entryAt,
  heroDeck,
  type HeroDeckEntry,
  type RosterCast,
} from "../heroDeck";

/**
 * THE CASTING HERO'S DECK (#234, his spec §4 — `casting-hero.md`).
 *
 * A prompt field alone asks the customer to imagine the result. This shows it:
 * a fanned deck of real signed performers, and under it the exact sentence
 * that cast whoever is in the centre. That pairing is the point of the whole
 * section — face and words move together, same index, always.
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
 *   - **Both clicks exist.** A peek brings itself to the centre; the centre
 *     opens that Cast's room. A carousel whose off-centre cards are decorative
 *     teaches the customer the deck is a picture.
 */

/** How long a card holds the centre. */
const DWELL_MS = 4000;

export function HeroDeck({
  casts,
  loading = false,
  onOpenCast,
}: {
  casts: readonly RosterCast[] | undefined;
  /** The roster's first fetch is still in flight — see the empty state below. */
  loading?: boolean;
  onOpenCast: (castId: string) => void;
}) {
  const { entries, live } = useMemo(() => heroDeck(casts), [casts]);
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const reduced = usePrefersReducedMotion();

  /*
    The roster arrives after the first paint, so the deck can change length
    under a running index. Clamping here rather than in the timer keeps the
    centre card and its brief on the same entry through that swap.
  */
  const safeIndex = entries.length === 0 ? 0 : index % entries.length;

  useEffect(() => {
    if (reduced || held || entries.length < 2) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setIndex((current) => (current + 1) % entries.length);
    }, DWELL_MS);
    return () => window.clearInterval(timer);
  }, [reduced, held, entries.length]);

  /*
    WHILE THE ROSTER IS IN FLIGHT THE COLUMN IS QUIET, and that is a decision
    rather than an oversight. Drawing the curated deck first would show a
    customer who owns signed Casts a fan of strangers under the words EXAMPLE
    CASTS for a second or so, and then swap it for their own people — a
    momentary claim about their roster that is not true, and a flash of faces
    nobody asked for. The column keeps its width and height, so nothing moves
    when the real deck arrives.
  */
  if (loading) return <div className="dpc-deck" aria-busy="true" />;
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
                if (!isCentre) {
                  setIndex((current) => (((current + offset) % entries.length) + entries.length) % entries.length);
                  return;
                }
                if (entry.castId) onOpenCast(entry.castId);
              }}
            />
          );
        })}
      </div>

      <div className="dpc-deck__brief">
        <span className="dpc-deck__eyebrow">
          {/*
            The eyebrow is where the honesty lives. A live deck says these are
            the words that cast these people; a curated one says plainly that
            they are examples, because this account has signed nobody yet.
          */}
          {live ? "Cast from these words" : "Example casts"}
          <span className="dpc-deck__rule" aria-hidden="true" />
        </span>
        <p className="dpc-deck__quote">&ldquo;{centre.brief}&rdquo;</p>
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
  const interactive = !isCentre || Boolean(entry.castId);
  const className = [
    "dpc-deck__card",
    isCentre ? "dpc-deck__card--centre" : "dpc-deck__card--peek",
    offset < 0 ? "dpc-deck__card--left" : offset > 0 ? "dpc-deck__card--right" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      <img src={entry.imageUrl} alt={entry.name} loading="lazy" draggable={false} />
      {isCentre ? (
        <span className="dpc-deck__caption">
          <span className="dpc-deck__name">{entry.name}</span>
          <span className="dpc-deck__meta">{entry.meta}</span>
        </span>
      ) : null}
    </>
  );

  if (!interactive) return <div className={className}>{body}</div>;
  return (
    <button
      type="button"
      className={className}
      onClick={onSelect}
      aria-label={isCentre ? `Open ${entry.name}` : `Show ${entry.name}`}
    >
      {body}
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
