/**
 * THE RUNNING ORDER OF HIS ORDERED BAND — one function, because two of them
 * disagreed (#718, settled by the founder on 2026-09-09).
 *
 * # His ruling, verbatim and entire
 *
 * > **Urgent wins inside your ordered group**
 *
 * Crew reply #168, on card `ordered-queue-order-718`. The question put to him
 * was exactly one thing — *inside the band he ordered, does `urgent` float to
 * the top?* — and that is his answer. Nothing else about either label moved:
 * the two BANDS are still separate everywhere they are printed (#471: `urgent`
 * means this cannot wait, `founder-ordered` means he chose the order), and no
 * card was relabelled.
 *
 * # What went wrong, and why one function is the repair
 *
 * Two shift-facing views of the same ranking gave different *take this first*
 * answers, and both were defensible readings of his own words:
 *
 * - `scripts/crew-desk-sweep.mts` writes NEXT UP on his Crew page, and floated
 *   `urgent` to the top **within** the ordered population.
 * - `scripts/queue-standing-exceptions.mts` prints his ordered band wholly
 *   above the urgent band, and sorted it oldest-first with nothing floating.
 *
 * The worked example from the card: an old non-urgent ordered card filed 25 Aug
 * against a newer card carrying BOTH labels filed 5 Sept. **His page said take
 * the newer one; the shift's priority view said take the older one.**
 *
 * ⚠ **The fix is not "make the second one agree with the first" — that is a
 * mirror, and a mirror always drifts (working law 4). It is what produced the
 * disagreement**: the desk sweep's own docblock used to end *"queue-standing-
 * exceptions is the same sort"*, a sentence that was true when written and
 * silently stopped being true. So the comparator lives HERE, once, and both
 * consumers call it. Neither declares its own.
 *
 * # Oldest-first is on `createdAt`, in both
 *
 * ⚠ **The desk sweep used to tiebreak on `issueNumber`**, which is oldest-first
 * for issues in one repository and was therefore not wrong — but it is a
 * DIFFERENT KEY, and two functions comparing different keys cannot be held to
 * each other by anything but prose. Both now read the field GitHub stamps at
 * filing, so the two orders are one order rather than two that happen to agree.
 *
 * `server/orderedBandOrder.test.ts` drives both consumers over ONE fixture and
 * asserts they return the same running order, so a future edit to either side
 * reddens rather than quietly re-opening #718.
 */

/**
 * The three fields the running order reads. Deliberately the minimum: a
 * consumer passes its own row shape through and keeps whatever else it carries.
 */
export type OrderedBandRow = {
  /** Does the card carry the `urgent` label. */
  urgent: boolean;
  /** ISO-8601, as GitHub stamps it at filing. May be absent — see `filedKey`. */
  createdAt: unknown;
  /** ⚠ The tiebreak, and it is required rather than optional — see below. */
  issueNumber: number;
};

/**
 * ⚠ **ONE NORMALISATION OF A MISSING `createdAt`, BECAUSE TWO OF THEM IS THIS
 * FILE'S OWN DEFECT RE-GROWN IN MINIATURE** (review of PR #722, finding 1).
 *
 * The first shape of this repair left each consumer to stringify the field
 * itself, and they disagreed: `String(row.createdAt)` gives `"undefined"`,
 * which sorts AFTER every ISO date, while `String(row.createdAt ?? "")` gives
 * `""`, which sorts BEFORE all of them. **So a row arriving without the field
 * would have led one view and trailed another** — the exact "two keys held
 * together by a sentence" class this module exists to close.
 *
 * The sentinel sorts LAST on purpose: a card whose filing date could not be
 * read must not be given the front of his queue, and the `issueNumber` limb
 * below then resolves two such rows against each other rather than leaving
 * them to input order.
 */
export function filedKey(createdAt: unknown): string {
  return typeof createdAt === "string" && createdAt !== "" ? createdAt : "￿";
}

/**
 * HIS RULING AS A COMPARATOR: urgent first, then oldest first, then the issue
 * number.
 *
 * The second limb is PROGRAM.md's ordered clause untouched (*absent a word,
 * oldest first*) and #236, the incident about an old card sitting unworked.
 *
 * ⚠ **THE THIRD LIMB EXISTS TO MAKE THIS A TOTAL ORDER** (review of PR #722,
 * finding 2). Without it, two cards filed in the same second compared equal and
 * fell to input order under a stable sort — so the three views agreed on ties
 * only because all three feed on one `gh issue list` call and inherit its
 * server-side ordering. **That is a premise no arm can test**, since a fixture
 * hands every consumer the same array; and the team files cards by script, so
 * same-second filings are not hypothetical. A tie whose `gh` order shifted
 * between runs would also churn the desk sweep's `JSON.stringify` comparison
 * and rewrite NEXT UP for no reason. The issue number is oldest-first by the
 * same relation `createdAt` is, so it never contradicts the limb above it.
 */
export function compareOrderedBand(a: OrderedBandRow, b: OrderedBandRow): number {
  if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
  const byDate = filedKey(a.createdAt).localeCompare(filedKey(b.createdAt));
  if (byDate !== 0) return byDate;
  return a.issueNumber - b.issueNumber;
}

/** A sorted COPY, so a caller's array is never re-ordered under it. */
export function sortOrderedBand<T extends OrderedBandRow>(rows: readonly T[]): T[] {
  return [...rows].sort(compareOrderedBand);
}

/**
 * The one sentence both views print about their running order, so his page and
 * a shift's terminal cannot describe the same sort two different ways.
 */
export const ORDERED_BAND_RULE =
  "urgent first, then oldest first (his ruling on #718)";
