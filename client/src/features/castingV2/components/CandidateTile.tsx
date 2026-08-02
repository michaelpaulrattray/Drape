import { useState } from "react";
import { Check, RotateCcw, Sparkles, X } from "lucide-react";

import { Button, Skeleton } from "@/foundation";

/**
 * One candidate, one tile, arriving on its own.
 *
 * This component never knows about the other seven, and that is the design:
 * M3 measured a roll of eight at 66–82s wall clock with a p50 of 54s per
 * image, so a sheet that waits for all of them is a minute of nothing. Each
 * tile renders a skeleton immediately and swaps when its own image lands
 * (foundation README §8: stream, don't batch).
 *
 * The prototype flips all eight at once off a single timer. That is artwork —
 * the reconciliation resolves it explicitly in favour of streaming.
 */

export type TileCandidate = {
  candidateId: string;
  position: number;
  indexLabel: string;
  status: "casting" | "ready" | "failed-refunded" | "signed";
  imageUrl: string | null;
  personaLine: string | null;
  kept: boolean;
  /** Set once this candidate became a Cast — the room's address. */
  castId: string | null;
};

export function CandidateTile({
  candidate,
  lineageLabel,
  rollWasCancelled,
  cancelling,
  windingDown,
  overdue,
  busy,
  paidBusy,
  rollPriceCredits,
  onKeep,
  onDiscard,
  onFollow,
  onOpenCast,
  onOpenViewer,
}: {
  candidate: TileCandidate;
  /**
   * Open the viewer on THIS face — REQUIRED, not optional.
   *
   * The viewer itself lives on the sheet, because the sheet is what holds the
   * set: arrows that walk from one tile to the next cannot be driven by state
   * that belongs to a single tile. Required so a tile cannot quietly opt out of
   * the one image grammar (founder ruling, 2026-08-02) — a new caller that
   * forgets it fails to compile rather than shipping a dead picture.
   */
  onOpenViewer: () => void;
  /** "FROM 03" — set when this whole roll followed a parent candidate. */
  lineageLabel?: string | null;
  /** Changes what a refunded tile says: cancelled by them, or failed by us. */
  rollWasCancelled?: boolean;
  /**
   * A cancel is in flight for this roll.
   *
   * Deliberately weaker than `rollWasCancelled`: it says the request is on its
   * way, not that this tile was stopped. The sheet cannot know which tiles are
   * still cancellable — §J collapses queued and dispatched into one status —
   * so the click frame says "Cancelling…" and the server names the rest.
   */
  cancelling?: boolean;
  /**
   * This roll was cancelled and this tile was already with the provider.
   *
   * A TILE NEVER REVERTS. The first version flipped every casting tile to
   * "Cancelling…" and then, when the server named the ones it had actually
   * stopped, dropped the rest back to plain "Casting…" — as though the click
   * had not happened. The user's intent has to stay acknowledged on every tile
   * until it resolves, so an unstopped tile winds down instead: dimmed, slower,
   * and honest that it is still coming and will be refunded when it does.
   */
  windingDown?: boolean;
  /**
   * This tile has been casting noticeably longer than a roll takes.
   *
   * The companion to the shortened lease. Even at five minutes there is a
   * window where a dead operation's tiles sit there saying "Casting…" as
   * though nothing were wrong — and a user cannot tell that from slow. Saying
   * so converts the wait from broken into supervised: it is true, it costs
   * nothing, and it names the outcome so nobody has to wonder about the money.
   */
  overdue?: boolean;
  busy?: boolean;
  /**
   * A paid roll is already in flight anywhere on this sheet. Follow is the
   * only affordance here that spends, so it is the only one this disables —
   * keeping and discarding stay live, because making free actions wait on a
   * paid one would be a worse sheet, not a safer one.
   */
  paidBusy?: boolean;
  /**
   * The roll price. No longer printed on this button — the dock states it once,
   * persistently, for rolls and follows together (founder ruling, 2026-08-02).
   *
   * D-15's intent is no surprise spend, and it was written after Follow reading
   * as free cost the founder 640 credits. Its literal implementation had become
   * price-tags-as-wallpaper: "· 160 cr" eight times on one sheet, which is how
   * a price stops being read at all. This is the TRY-chip mechanism applied to
   * Follow — the price lives once, adjacent and always visible, so no tap is
   * ever unpriced and no tap shouts.
   *
   * Kept as a prop because the tile still refuses to fire while a paid roll is
   * in flight, and because a future surface may need to print it again.
   */
  rollPriceCredits?: number;
  onKeep: () => void;
  onDiscard: () => void;
  onFollow: () => void;
  /** Client-side navigation to a signed candidate's room. */
  onOpenCast?: (castId: string) => void;
}) {
  // Declared before any early return — a hook after a conditional return is a
  // hook that sometimes does not run.

  if (candidate.status === "casting") {
    /*
      Three states, and the order matters: the click frame, then the wind-down,
      then ordinary casting. Nothing here can move backwards — `windingDown` is
      derived from the roll being cancelled, which is sticky, so a tile that
      has acknowledged the cancel never un-acknowledges it.
    */
    /*
      Order matters and is deliberate: the cancel states outrank the overdue
      one, because a user who has cancelled already knows why this is taking a
      while and already has the refund promise in the dock's line.
    */
    const caption = cancelling
      ? "Cancelling…"
      : windingDown
        ? "Finishing — will be refunded"
        : overdue
          ? "Taking longer than usual — this refunds automatically if it can't finish"
          : "Casting…";
    return (
      <div className={windingDown ? "dp-stack dpc-tile--winding" : "dp-stack"} style={{ gap: 9 }}>
        <Skeleton style={{ aspectRatio: "4 / 5" }} label={`CASTING ${candidate.indexLabel}`} />
        <span className="dp-metadata">{caption}</span>
      </div>
    );
  }

  /*
    SIGNED — and this state exists because its absence lost a Cast.

    The founder signed a candidate for 500 credits, left the room, and could
    not find her again: the tile looked exactly like every other ready
    candidate and offered to sign her a second time. A permanent purchase is
    reachable from the place it was made, or it may as well not have happened.

    So the tile keeps her picture, says what she became, and is a LINK. Keep,
    Follow and Discard are gone: none of them mean anything to a spent
    candidate, and Sign least of all.
  */
  if (candidate.status === "signed") {
    return (
      <div className="dp-stack dpc-tile" style={{ gap: 9 }}>
        <a
          className="dpc-card dpc-card--openable dpc-card--signed"
          href={candidate.castId ? `/casting/cast/${candidate.castId}` : undefined}
          onClick={(event) => {
            if (!candidate.castId || !onOpenCast) return;
            event.preventDefault();
            onOpenCast(candidate.castId);
          }}
          aria-label={`Open ${candidate.personaLine ?? `candidate ${candidate.indexLabel}`}'s room`}
        >
          {candidate.imageUrl ? (
            <img src={candidate.imageUrl} alt={candidate.personaLine ?? candidate.indexLabel} />
          ) : null}
          <span className="dpc-card__signed">SIGNED</span>
        </a>
        <div className="dpc-card__caption">
          <span className="dpc-card__line">{candidate.personaLine ?? candidate.indexLabel}</span>
          <span className="dp-metadata">{candidate.indexLabel}</span>
        </div>
        <span className="dp-secondary">In your roster — open her room</span>
      </div>
    );
  }

  if (candidate.status === "failed-refunded") {
    return (
      <div className="dp-stack" style={{ gap: 9 }}>
        <div className="dp-media dpc-tile__failed">
          <span className="dp-metadata">{candidate.indexLabel}</span>
        </div>
        {/*
          Two different events wearing one projection status. A candidate the
          user cancelled should not be told "didn't arrive" — that blames us
          for their decision. The roll's own status is what tells them apart.
        */}
        <span className="dp-metadata">
          {rollWasCancelled ? "Cancelled · refunded" : "Didn't arrive · refunded"}
        </span>
      </div>
    );
  }

  return (
    <div className="dp-stack dpc-tile" style={{ gap: 9 }}>
      <div className={candidate.imageUrl ? "dpc-card dpc-card--openable" : "dpc-card"}>
        {/*
          Open the viewer (item 18). A founder cannot judge a face at 178px,
          and choosing between eight faces is what this whole surface is for.

          A button rather than a click handler on the image, so it is a real
          tab stop with a real name — and it wraps only the media, leaving the
          Keep/Discard row beneath untouched. View-only per D-52: this opens a
          picture and closes again.
        */}
        {candidate.imageUrl ? (
          <button
            type="button"
            className="dpc-card__open"
            aria-label={`View candidate ${candidate.indexLabel} larger`}
            onClick={onOpenViewer}
          >
            <img
              src={candidate.imageUrl}
              alt={candidate.personaLine ?? `Candidate ${candidate.indexLabel}`}
            />
          </button>
        ) : null}


        {lineageLabel ? <span className="dpc-card__lineage">{lineageLabel}</span> : null}

        {/* Kept renders in place: inset ring + badge, on the tile itself. */}
        {candidate.kept ? (
          <>
            <span className="dpc-card__ring" aria-hidden="true" />
            <span className="dpc-card__check" aria-hidden="true">
              <Check size={12} strokeWidth={2.6} />
            </span>
          </>
        ) : null}

      </div>

      <div className="dpc-card__caption">
        <span className="dpc-card__line">{candidate.personaLine ?? candidate.indexLabel}</span>
        <span className="dp-metadata">{candidate.indexLabel}</span>
      </div>

      {/*
        The action row sits under the card (founder preference, 2026-07-31 —
        superseding the on-media scrim row the prototype draws). It reads more
        plainly: three labelled controls at full contrast rather than two glyph
        squares on a photograph, and nothing is hidden behind an image.

        It costs vertical height, which is what pushed the dock off-screen
        before — but the dock is sticky now and the grid is scroll-padded, so
        the cost no longer lands anywhere.

        Real buttons, so keyboard and focus work: the foundation bans
        hover-only divs at the primitive layer rather than leaving it to each
        call site (plan §D.10).
      */}
      <div className="dp-row" style={{ gap: 6 }}>
        <Button
          variant={candidate.kept ? "primary" : "secondary"}
          size="small"
          disabled={busy}
          onClick={onKeep}
          aria-pressed={candidate.kept}
        >
          {candidate.kept ? <Check size={11} strokeWidth={2.4} aria-hidden="true" /> : null}
          {candidate.kept ? "Kept" : "Keep"}
        </Button>
        <Button variant="quiet" size="small" disabled={busy || paidBusy} onClick={onFollow}>
          <Sparkles size={11} strokeWidth={1.9} aria-hidden="true" />
          Follow
        </Button>
        <Button
          variant="quiet"
          size="small"
          destructive
          disabled={busy}
          onClick={onDiscard}
          aria-label={`Discard candidate ${candidate.indexLabel}`}
        >
          <X size={11} strokeWidth={2.2} aria-hidden="true" />
        </Button>
      </div>

    </div>
  );
}

/**
 * The one-step undo (plan §F).
 *
 * Undoing a discard restores the candidate but NOT its kept state — a discard
 * clears kept, and the undo is deliberately not clever about putting it back.
 * The copy says what happened rather than implying a full rewind.
 */
export function UndoDiscard({ onUndo, busy }: { onUndo: () => void; busy?: boolean }) {
  return (
    <Button variant="quiet" size="small" onClick={onUndo} disabled={busy}>
      <RotateCcw size={11} strokeWidth={2.1} aria-hidden="true" />
      Undo discard
    </Button>
  );
}
