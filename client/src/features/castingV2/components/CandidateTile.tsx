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
  status: "casting" | "ready" | "failed-refunded";
  imageUrl: string | null;
  personaLine: string | null;
  kept: boolean;
};

export function CandidateTile({
  candidate,
  lineageLabel,
  rollWasCancelled,
  busy,
  paidBusy,
  onKeep,
  onDiscard,
  onFollow,
}: {
  candidate: TileCandidate;
  /** "FROM 03" — set when this whole roll followed a parent candidate. */
  lineageLabel?: string | null;
  /** Changes what a refunded tile says: cancelled by them, or failed by us. */
  rollWasCancelled?: boolean;
  busy?: boolean;
  /**
   * A paid roll is already in flight anywhere on this sheet. Follow is the
   * only affordance here that spends, so it is the only one this disables —
   * keeping and discarding stay live, because making free actions wait on a
   * paid one would be a worse sheet, not a safer one.
   */
  paidBusy?: boolean;
  onKeep: () => void;
  onDiscard: () => void;
  onFollow: () => void;
}) {
  if (candidate.status === "casting") {
    return (
      <div className="dp-stack" style={{ gap: 9 }}>
        <Skeleton style={{ aspectRatio: "4 / 5" }} label={`CASTING ${candidate.indexLabel}`} />
        <span className="dp-metadata">Casting…</span>
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
      <div className="dpc-card">
        {candidate.imageUrl ? (
          <img
            src={candidate.imageUrl}
            alt={candidate.personaLine ?? `Candidate ${candidate.indexLabel}`}
          />
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
