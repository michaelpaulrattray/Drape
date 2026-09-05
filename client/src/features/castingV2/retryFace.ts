/**
 * WHICH FACE A TILE WEARS WHILE ITS RETRY IS IN THE AIR (#551).
 *
 * The founder, watching a failed tile on his own sheet: *"when i hit retry on
 * the cast sheet if one of the generation fails when i click it there is no
 * indication anything is happening for around 5 seconds or so — to a user it
 * would feel like you clicked retry there was a 5 second delay and there
 * something happened rather than an immediate effect."*
 *
 * The sheet already knew. `retrying[candidateId]` is set synchronously on the
 * click, and its only effect on the tile was `busy`, which greys the Retry
 * button and leaves the failure exactly where it was. The face changed only
 * once the server had written `casting` on the row AND the roll poll had
 * ticked — the ~5 seconds he felt, and the whole of it.
 *
 * So this is D-38 ("paint first, ask second") applied to the one action on the
 * sheet that never got it. Keep paints its ring on the click, discard removes
 * the card on the click, cancel flips on the click; retry alone waited for a
 * round trip before admitting anything had happened.
 *
 * It lives in its own module for the reason `refineBusy` does: it decides what
 * a tile SHOWS, it has a negative control that matters, and a predicate tested
 * through a substring search of the component is a test that agrees with
 * whoever wrote it rather than one that can catch them.
 */

/** The two facts the question needs — structural, so the tile passes its own. */
export type RetryFaceInput = {
  /** The candidate's projected status, as the tile receives it. */
  status: "casting" | "ready" | "failed-refunded" | "signed";
  /** Is this candidate's own retry request still out? */
  retrying?: boolean;
};

/**
 * Should this tile show the casting skeleton because its retry is in flight?
 *
 * ⚠ **Narrowed to `failed-refunded`, and the narrowing is the protection.**
 * Retry is only ever offered on a failed tile, so in the product today the
 * status check can never be the thing that decides. It is here because the
 * alternative — trusting the flag alone — means any future caller that sets
 * `retrying` on a delivered face BLANKS A PICTURE THE USER IS LOOKING AT, and
 * replaces a finished frame with a skeleton that will never resolve. A flag
 * that can only ever hide a failure is a much smaller blast radius than one
 * that can hide anything.
 *
 * The `casting` case returns false rather than true: such a tile is already
 * showing the skeleton by its own status, and saying "yes" here would claim
 * this predicate was the reason.
 */
export function retryShowsSkeleton(input: RetryFaceInput): boolean {
  return input.retrying === true && input.status === "failed-refunded";
}
