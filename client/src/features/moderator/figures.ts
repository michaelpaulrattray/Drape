/**
 * How a measured figure is written on the moderator surfaces.
 *
 * ⚠ **ONE COPY, AND THE THIRD CONSUMER IS WHY** (#412 re-review, findings 1 and
 * 3, which are the same finding seen twice). The rule started in
 * `ReconciliationSubTab`, was swept into `FlaggedDiscrepanciesCard`, and stopped
 * one file short of `CreditsSubTab` — whose Amount cell still rendered
 * `String(tx.amount)`: an ASCII hyphen for a negative, ungrouped, in a mono
 * column two tabs from the pane that insists on `−1,240`.
 *
 * The reviewer's own line settles the shape: *"if finding 1 adds a third
 * consumer, that's the moment to export one helper instead of writing a third
 * copy."* Working law 4 — derive, never mirror.
 *
 * The rules, all three from brief 09 §3 (*"Signs carry the direction, not
 * colour"*) and from a frame:
 *
 *  - **A sign carries the direction**, because colour no longer does.
 *  - ⚠ **Zero takes no sign.** Writing the minus unconditionally for a spend
 *    printed **`−0`** on an account that had never spent anything — a number
 *    that does not exist, in a ledger. Twenty-nine source arms and ninety-four
 *    driven readings passed over it; an eye on the frame did not.
 *  - **The minus is U+2212**, not the hyphen `toLocaleString` returns. Under a
 *    column of `+` signs at mono 400 a hyphen is visibly the wrong length, and
 *    these columns are the one place that shows.
 */

/** `+2,400` · `−1,860` · `0`. */
export function signed(n: number): string {
  if (n === 0) return "0";
  return n > 0 ? `+${n.toLocaleString()}` : `−${Math.abs(n).toLocaleString()}`;
}

/**
 * A figure that is a deduction by nature — total spent, refunded out. Zero
 * stays `0`, because "spent nothing" is not a negative quantity.
 */
export function negated(n: number): string {
  return n === 0 ? "0" : `−${Math.abs(n).toLocaleString()}`;
}

/** Unsigned but grouped — a charged total is still a number a person reads. */
export function grouped(n: number): string {
  return n.toLocaleString();
}
