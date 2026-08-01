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
