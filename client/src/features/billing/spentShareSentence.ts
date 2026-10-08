import { displayBalance, formatCredits } from "@shared/creditDisplay";

/**
 * WHY TODAY'S PRICE IS HIGHER, WHEN IT IS (#1965 repair — the relay's finding:
 * a raised figure with no reason is not an honest price).
 *
 * On an interval switch the unused part of the old cycle comes off the new
 * price, EXCEPT the part whose credits are already spent — that part is
 * charged back. This is the one plain line that says so, under the price, in
 * the customer's own unit. The number is the quote's `spentShareCredits`
 * through `displayBalance`, never a figure composed here. Empty whenever the
 * charge is zero, so every other switch reads exactly as before.
 */
export function spentShareSentence(quote: {
  spentShareCharge?: number;
  spentShareCredits?: number;
  currentInterval?: "monthly" | "annual";
}): string {
  if (!quote.spentShareCharge || quote.spentShareCharge <= 0 || !quote.spentShareCredits) return "";
  const cycle = quote.currentInterval === "annual" ? "this year" : "this month";
  return ` Includes ${formatCredits(displayBalance(quote.spentShareCredits))} credits you've already used ${cycle}.`;
}

/**
 * WHAT COMES OFF THE YEAR, AND WHAT IS DUE TODAY (#2023 bullet 3).
 *
 * The confirm step for a switch to yearly opened *"The unused part of your
 * current cycle comes off that"* whatever had happened — and in the spent case
 * that was false: the part whose credits she has already used does NOT come
 * off; it is paid for, as its own line on the switch's invoice
 * (`SPENT_SHARE_PRODUCT`, *"Credits already used this cycle"*). So the clause
 * is chosen by the quote, in three cases and never by a figure composed here:
 *
 * - **nothing spent** (`spentShareCharge` 0) — the sentence as it always read;
 * - **all spent** (nothing left to take back, `creditUnwind` 0) — nothing
 *   comes off, and it says why. ⚠ Its first wording was *"its unused time is
 *   paid for rather than coming off that"*, which the relay read as hard going
 *   on PR #2053; this is its plainer sentence, which says the same thing.
 *   Nothing in #1952's approved wording covers this road;
 * - **part spent** — the rest comes off, except the quote's
 *   `spentShareCredits`, which are paid for instead.
 *
 * `dueToday` is the caller's own formatted `immediateCharge`, so the figure is
 * the one on the Confirm button. The spent case carries the credits inside the
 * sentence, so {@link spentShareSentence} is NOT appended after it — saying
 * them twice was the other half of the old line's problem.
 */
export function yearlySwitchOffsetSentence(
  quote: { spentShareCharge?: number; spentShareCredits?: number; creditUnwind?: number },
  dueToday: string,
): string {
  if (!quote.spentShareCharge || quote.spentShareCharge <= 0 || !quote.spentShareCredits) {
    return `The unused part of your current cycle comes off that, so about ${dueToday} is due today.`;
  }
  if (!quote.creditUnwind || quote.creditUnwind <= 0) {
    return (
      `You've already used this cycle's credits, so nothing comes off for the ` +
      `time left. About ${dueToday} is due today.`
    );
  }
  return (
    `The unused part of your current cycle comes off that, except for ` +
    `${formatCredits(displayBalance(quote.spentShareCredits))} credits you've already used, ` +
    `which are paid for instead. About ${dueToday} is due today.`
  );
}
