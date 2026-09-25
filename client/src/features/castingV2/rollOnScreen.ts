/**
 * WHICH ROLL IS ON SCREEN — the fact the sheet's chrome was reading off the
 * wrong question (card 1232).
 *
 * The founder pressed Roll again on sheet 01 and could not get back to it:
 * *"when i roll a new sheet it goes into like a buffering or loading state
 * when i cant swiotch back to sheet 1 or anything until the buffering or
 * loading finishes? and then sheet 02 and 01 are navigable while sheet 02 is
 * generating the images"*.
 *
 * His click WAS registered — the rail's pills are buttons and they set
 * `viewedRollId` — but nothing downstream read it while the dispatch latch was
 * held. The grid, the header, the rail's selection and the skeleton label all
 * asked `awaitingNewRoll`, which answers *"is a roll being paid for"*. That is
 * the right question for the paid affordances and the wrong one for the view:
 * a click that changes nothing on screen reads as locked.
 *
 * Card 1110 fixed the mirror image of this (the rail lit 03 over 04's
 * skeletons) by standing the real pills down while the provisional one is up.
 * It stood them down VISUALLY; it did not stop the grid from ignoring them.
 *
 * # The two questions, kept apart on purpose
 *
 * - **Is a roll being paid for?** (`awaitingNewRoll`) — Roll again disabled,
 *   every tile's Follow locked, the dock saying what it is doing. Unchanged by
 *   this module: money must not be spendable twice whatever she is looking at.
 * - **Is the roll being paid for the one on screen?** (this) — skeletons, the
 *   provisional header, the selected pill, and the CASTING label. Only these
 *   move, and only LOOKING is freed.
 *
 * # Why `viewedRollId === null` is the reading
 *
 * The provisional roll has no id until its row lands, so it cannot be named.
 * What names it is the absence of a choice: `dispatchRoll` sets
 * `setViewedRollId(null)` at the click ("rolling from a historical view jumps
 * you to what you just paid for"), and the rail sets it to a real id when she
 * picks one. So during the latch, null means *"the newest, which is the one I
 * just bought"* and an id means *"that one"*.
 *
 * This is a derivation of two pieces of state the page already holds, not a
 * third piece tracking the same thing (working law 4).
 */

export function showingProvisionalRoll(input: {
  /**
   * A dispatch is in flight and its roll has not appeared yet — the page's
   * `awaitingNewRoll`. False and nothing here is provisional, whatever is
   * being viewed.
   */
  awaitingNewRoll: boolean;
  /**
   * The roll she has chosen to look at, or null for "the newest". Null during
   * a dispatch is the roll being paid for, because that roll has no id yet.
   */
  viewedRollId: string | null;
}): boolean {
  return input.awaitingNewRoll && input.viewedRollId === null;
}
