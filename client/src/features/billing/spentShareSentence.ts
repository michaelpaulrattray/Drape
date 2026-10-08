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
