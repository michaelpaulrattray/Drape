/**
 * What a cancel says, in one honest line.
 *
 * The founder's finding: cancelling a roll whose eight were already with the
 * provider showed "Cancelled · 0 credits back so far". The money was correct —
 * nothing queued means nothing to refund, and the in-flight work refunds as it
 * lands under the generosity rule — but the sentence read as a failure at the
 * exact moment the user was worrying about their balance.
 *
 * Two laws pull in different directions here, and both are kept:
 *
 *   - **R6's refund honesty**: every refund outcome reaches the user verbatim —
 *     the recorded amount, or the support reference when recording failed. So
 *     a non-zero refund still states its number.
 *   - **Say what is true, not what is reassuring**: when nothing was refunded
 *     because nothing was cancellable, the useful sentence is about the work
 *     still arriving, not about the zero.
 *
 * Every branch is a point-in-time statement and worded as one. A total stated
 * as final would be wrong by the time the user reads their balance.
 */
export type CancelOutcome = {
  refundedCredits: number;
  refundRecorded: boolean;
  stillFinishing: number;
};

export function cancelNoticeFor(outcome: CancelOutcome): string {
  if (!outcome.refundRecorded) {
    // The one branch that must never be softened or merged.
    return "Cancelled — part of the refund could not be recorded. Support has the details.";
  }

  const finishing =
    outcome.stillFinishing === 1
      ? "1 still finishing"
      : `${outcome.stillFinishing} still finishing`;

  if (outcome.stillFinishing > 0 && outcome.refundedCredits > 0) {
    return `Cancelled · ${outcome.refundedCredits} credits back — ${finishing}, refunds complete as they land.`;
  }
  if (outcome.stillFinishing > 0) {
    return `Cancelled — ${finishing}; refunds complete as they land.`;
  }
  if (outcome.refundedCredits > 0) {
    return `Cancelled · ${outcome.refundedCredits} credits back.`;
  }
  /*
    Nothing queued and nothing in flight: the roll had already finished. Saying
    "0 credits back" here would be technically true and actively misleading —
    there was nothing to refund because the user received the work.
  */
  return "Cancelled — this roll had already finished, so there was nothing to refund.";
}

/**
 * CANCEL IS A SHEET STATE, NOT A FIRED EVENT.
 *
 * The mechanics were already right and the arc was still disjointed: a notice
 * written once from the mutation's reply, frozen at the moment of the click,
 * while the thing it described — work landing and refunding one slice at a
 * time — carried on underneath it for another minute.
 *
 * So the line is DERIVED, every render, from the same projection the tiles are
 * drawn from. Three properties fall out of that rather than being engineered:
 *
 *   - it cannot go stale, because there is no stored sentence to age;
 *   - it survives navigating away and back, because the projection does;
 *   - it needs no new server shape — a refunded candidate already shows as
 *     `failed-refunded` and a finishing one as `casting`.
 *
 * The running total has exactly one home. Tiles say what THEY are doing;
 * this line is the only place the money is counted.
 */
export type CancelStoryInput = {
  /** The roll is cancelled — sticky, from the projection, never a local flag. */
  cancelled: boolean;
  /** Candidates that reached a refunded terminal state. */
  refunded: number;
  /** Candidates still with the provider, which will refund as they land. */
  finishing: number;
  /** Every candidate on the roll, refunded or delivered or otherwise. */
  total: number;
  /** What one candidate cost. The roll price divided by its own slice count. */
  sliceCredits: number;
  /**
   * Whether the cancel's own refunds recorded.
   *
   * The ONLY part of this that cannot be derived, because a refund that failed
   * to record leaves no row to count. It comes from the cancel reply and is
   * therefore unavailable after a hard reload — in which case this reports the
   * recorded branch. The server logs and alarms on the unrecorded case
   * regardless; this is a display limitation, not a silent one.
   */
  refundRecorded: boolean;
};

export function cancelStory(input: CancelStoryInput): string | null {
  if (!input.cancelled) return null;

  /*
    Mid-arc: the count is the story. Deliberately "N of M refunded" rather than
    a credit figure, because the credit figure is still moving and a number
    that ticks upward invites the user to watch it instead of the faces.
  */
  if (input.finishing > 0) {
    return `Cancelled — ${input.refunded} of ${input.total} refunded · ${input.finishing} finishing`;
  }

  /*
    Terminal: hand back to the branches that were already ratified, including
    the unrecorded-refund sentence verbatim. R6's law is that a recorded amount
    reaches the user as a number, so this is where the number appears — once,
    at the end, when it has stopped moving.
  */
  return cancelNoticeFor({
    refundedCredits: input.refunded * input.sliceCredits,
    refundRecorded: input.refundRecorded,
    stillFinishing: 0,
  });
}
