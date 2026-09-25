/**
 * THE ORDERED BAND'S ONE SORT — his running order for the cards he asked for
 * by name (`founder-ordered`).
 *
 * Moved here from `scripts/lib/orderedBand.mts` on 2026-09-25 (#1193, the live
 * Desk) so the SERVER can rank the band the same way the sweep and the
 * escalation reader do. The script module re-exports this file; nothing about
 * the rule changed in the move, and `server/orderedBandOrder.test.ts` still
 * drives every view over one fixture.
 *
 * The rule, in his words and rulings:
 *   - his stated sequence first — an `order:<n>` label, lowest first (#1006);
 *   - then urgent before not urgent (#718, Crew reply #168: *"Urgent wins
 *     inside your ordered group"*);
 *   - then oldest first, by the card's filing time;
 *   - then the issue number, so the order is total and two views cannot
 *     disagree on a tie.
 *
 * ⚠ **THE REPAIR WAS NEVER THAT TWO SORTS AGREE — IT IS THAT THERE IS ONE
 * (#472).** Two comparators held to each other by a sentence drifted for a
 * week with a worked example nobody could see. Every view that ranks this band
 * calls `compareOrderedBand`, on the same key.
 */

export type OrderedBandRow = {
  /** His stated position from an `order:<n>` label, or null when he gave none. */
  rank?: number | null;
  urgent: boolean;
  /** The filing time as the queue reported it; `filedKey` owns what a missing one means. */
  createdAt: unknown;
  issueNumber: number;
};

/**
 * What a missing or malformed filing time means for the sort: it sorts LAST
 * (`￿` collates after every ISO date), so a row the queue could not date
 * never jumps the ones it could.
 */
export function filedKey(createdAt: unknown): string {
  return typeof createdAt === "string" && createdAt !== "" ? createdAt : "￿";
}

const ORDER_LABEL_PREFIX = "order:";

/** The lowest `order:<n>` a card carries, or null. Non-numeric suffixes are ignored. */
export function rankFromLabels(labels: readonly string[]): number | null {
  let best: number | null = null;
  for (const label of labels) {
    if (!label.startsWith(ORDER_LABEL_PREFIX)) continue;
    const digits = label.slice(ORDER_LABEL_PREFIX.length);
    if (!/^[1-9][0-9]*$/.test(digits)) continue;
    const rank = Number(digits);
    if (best === null || rank < best) best = rank;
  }
  return best;
}

export function compareOrderedBand(a: OrderedBandRow, b: OrderedBandRow): number {
  const ra = a.rank ?? null;
  const rb = b.rank ?? null;
  if (ra !== rb) {
    if (ra === null) return 1;
    if (rb === null) return -1;
    return ra - rb;
  }
  if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
  const byDate = filedKey(a.createdAt).localeCompare(filedKey(b.createdAt));
  if (byDate !== 0) return byDate;
  return a.issueNumber - b.issueNumber;
}

export function sortOrderedBand<T extends OrderedBandRow>(rows: readonly T[]): T[] {
  return [...rows].sort(compareOrderedBand);
}

export const ORDERED_BAND_RULE =
  "his stated order first (an `order:<n>` label, lowest first — #1006), then urgent first, then oldest first (his ruling on #718)";
