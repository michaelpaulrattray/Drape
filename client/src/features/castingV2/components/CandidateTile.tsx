import { useState } from "react";
import { Check, RotateCcw, Sparkles, X } from "lucide-react";

import { Button, Skeleton } from "@/foundation";
import {
  CANDIDATE_FAILURE_CHIPS,
  CANDIDATE_FAILURE_LINES,
  isRetryableFailure,
  type CandidateFailureKind,
} from "@shared/candidateFailure";
import { retryShowsSkeleton } from "../retryFace";

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
  /** Why a failed one didn't arrive (#122) — null unless the row says `failed`. */
  failure?: { kind: CandidateFailureKind } | null;
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
  onRetry,
  retryPriceCredits,
  retrying,
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
  /**
   * THE RETRY BUTTON (#122 shape 1) — render THIS failed tile again with its
   * own words, for one slice's price. Absent when the account is outside
   * `CASTING_RETRY_SCOPE` or the roll is not finished: the sheet passes it
   * only where the server's door would admit the tap, so a control that
   * refuses is never drawn. Drawn only on the kinds the door serves
   * (`isRetryableFailure` — the same list the server reads, working law 4):
   * engine error, didn't arrive, and — since his reply #10 (2026-08-26,
   * "widen it to content-filter tiles") — a content-filter refusal, because
   * the filter is a coin per picture and re-sending the same words rescues
   * it as often as any rewording. Never on a not-a-portrait or not-charged
   * tile, never on a cancelled roll's tile.
   */
  onRetry?: () => void;
  /** The retry price, server-derived (`castingV2.config`) — printed on the button, D-15. */
  retryPriceCredits?: number;
  /**
   * THIS TILE'S RETRY HAS BEEN CLICKED AND HAS NOT COME BACK (#551).
   *
   * The founder, watching his own sheet: *"when i click it there is no
   * indication anything is happening for around 5 seconds or so — to a user it
   * would feel like you clicked retry, there was a 5 second delay, and then
   * something happened rather than an immediate effect."*
   *
   * He was reading the tile correctly: `retrying` already existed on the sheet
   * and its only effect here was `busy`, which greys the button and leaves the
   * failed face in place. The visible change waited on the server writing
   * `casting` and then on the next poll tick — the ~5 seconds he felt.
   *
   * So the click frame paints, exactly as D-38 has every other action on this
   * sheet paint: the tile goes to the SAME skeleton a fresh roll's tile shows
   * before its first frame, and the poll then carries it to the picture or to
   * a second failure as it always did. The sheet clears the flag in its
   * `finally`, so a refusal — closed scope, no credits, the filter — drops the
   * tile back onto its failed face with the toast that says why.
   */
  retrying?: boolean;
}) {
  // Declared before any early return — a hook after a conditional return is a
  // hook that sometimes does not run.

  /*
    A RETRY IN FLIGHT IS A CASTING TILE, and it is asked here rather than at the
    failed branch so that it reaches the one face this product already uses for
    "your picture is being made". The rule and the reason it is narrowed to a
    failed tile live in `retryFace.ts`, with the negative control.
  */
  const retryInFlight = retryShowsSkeleton({ status: candidate.status, retrying });

  if (candidate.status === "casting" || retryInFlight) {
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
    /*
      A retry outranks all three, and it has to. `overdue`, `windingDown` and
      `cancelling` are read from the ORIGINAL attempt — the one that already
      failed minutes ago — so letting them through would open a freshly clicked
      retry on "Taking longer than usual", which is both untrue and the exact
      opposite of the immediacy this change is for.
    */
    const caption = retryInFlight
      ? "Casting…"
      : cancelling
        ? "Cancelling…"
        : windingDown
          ? "Finishing — will be refunded"
          : overdue
            ? "Taking longer than usual — this refunds automatically if it can't finish"
            : "Casting…";
    return (
      <div
        // Same reason as the caption: the wind-down dimming belongs to the
        // attempt that was cancelled, never to the one just paid for.
        className={windingDown && !retryInFlight ? "dp-stack dpc-tile--winding" : "dp-stack"}
        style={{ gap: 9 }}
      >
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
        <span className="dp-secondary">In your roster — open their room</span>
      </div>
    );
  }

  if (candidate.status === "failed-refunded") {
    /*
      Three different events wearing one projection status, told apart in
      this order. A candidate the user cancelled should not be told "didn't
      arrive" — that blames us for their decision — so the roll's own status
      wins. Then the ROW'S reason (#122): the founder watched two tiles of
      eight say "Didn't arrive" while their rows said `content_policy`, and
      had to guess it was the engine's filter. The chip on the card names the
      class in customer words; the line beneath says it in full and keeps the
      refund promise. No reason on the row keeps today's sentence.
    */
    const failure = rollWasCancelled ? null : candidate.failure ?? null;
    const line = rollWasCancelled
      ? "Cancelled · refunded"
      : CANDIDATE_FAILURE_LINES[failure?.kind ?? "unknown"];
    return (
      <div className="dp-stack" style={{ gap: 9 }}>
        <div className="dp-media dpc-tile__failed">
          <span className="dp-metadata">{candidate.indexLabel}</span>
          {failure && failure.kind !== "unknown" ? (
            <span className="dpc-tile__chip" data-kind={failure.kind}>
              {CANDIDATE_FAILURE_CHIPS[failure.kind]}
            </span>
          ) : null}
        </div>
        <span className="dp-metadata">{line}</span>
        {onRetry && failure && isRetryableFailure(failure.kind) ? (
          /*
            One slice, priced on the button. The roll's price left every tile's
            Follow button for the dock (founder ruling, 2026-08-02) because it
            appeared eight times on one sheet; this appears only on a tile
            that failed, so the price sits where the tap is.
          */
          <Button
            variant="quiet"
            size="small"
            disabled={busy || paidBusy}
            onClick={onRetry}
            /* A stack child stretches to the column; the gear needed the same
               line (foreman-27, caught at the frame). */
            style={{ alignSelf: "flex-start" }}
          >
            <RotateCcw size={12} aria-hidden="true" />
            {retryPriceCredits !== undefined ? `Retry · ${retryPriceCredits} credits` : "Retry"}
          </Button>
        ) : null}
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
