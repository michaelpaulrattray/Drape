/**
 * THE CARD TITLES UNDER HIS SWITCH — what the count is actually about (#285).
 *
 * Founder, 2026-08-30, looking at the live panel: *"am i suppose to see a list
 * under these categories?"* — then **"file it"** on the recommendation.
 *
 * # WHY A NUMBER ALONE IS NOT ENOUGH, IN HIS CARD'S OWN WORDS
 *
 * *"A count asks him to trust the queue. The queue is precisely what failed
 * today."* The freshness pass (#271) found, in one sitting, a card saying
 * NOTHING IS BUILT about something built and running, a figure fifteen times
 * out of date, and a priority list whose eight entries were all closed. So
 * `Bugs (10)` tells him there is a night's work and **nothing about whether it
 * is work he wants**. Titles turn the switch from *trust the number* into *see
 * what you are authorising*, which is the whole reason the panel is his.
 *
 * # `shared/` BECAUSE THREE THINGS KEY ON THIS SHAPE
 *
 * The shift tool that writes the row (`scripts/crew-count-queue.mts`), the
 * reader that projects it (`server/db/crewWorkSwitches.ts`), and the panel that
 * draws it. Three copies of one JSON shape drift, and the first anyone would
 * know is a title row that silently stopped rendering — which on this page
 * looks identical to a category with nothing in it.
 *
 * # ⚠ THE PARSE IS HOSTILE-INPUT SAFE, AND THAT IS NOT PARANOIA HERE
 *
 * The column holds a JSON string written by a script, and his ENTIRE Crew tab
 * is one `crew.getState` call — a throw anywhere in this projection is a blank
 * page for the founder, which is the failure the briefing parse arm already
 * exists to prevent. So a malformed, truncated or half-written value degrades
 * to NO TITLES (exactly today's panel) rather than to an error.
 */

/**
 * How many titles are kept and drawn per category.
 *
 * His card: *"Up to five titles per category, most recent first … A sixth is
 * `+3 more`, never a scroll — this is a switch panel, not the queue."* The cap
 * is applied at the WRITE as well as the draw, so the row stays small and the
 * stored value can never become a second copy of the queue.
 */
export const QUEUE_TITLES_PER_CATEGORY = 5;

/**
 * One card, as the panel names it.
 *
 * The NUMBER rides along because it is free — the counter already has it in
 * hand — and because he refers to cards by number in every reply he writes. It
 * is drawn as text, not as a link: his card permits a link only *"if it is
 * free"*, and a link needs an owner/repo string hard-coded in the client, which
 * is a second list of exactly the kind working law 4 is about.
 */
export type CrewQueueTitle = {
  readonly number: number;
  readonly title: string;
};

/** One entry, validated. Anything that is not a real card is dropped. */
function readOne(value: unknown): CrewQueueTitle | null {
  if (typeof value !== "object" || value === null) return null;
  const { number, title } = value as { number?: unknown; title?: unknown };
  if (typeof number !== "number" || !Number.isInteger(number) || number <= 0) return null;
  if (typeof title !== "string") return null;
  const trimmed = title.trim();
  if (trimmed.length === 0) return null;
  return { number, title: trimmed };
}

/**
 * The stored JSON for one category's row.
 *
 * Capped here as well as at the draw: the WRITER decides what is kept, so a
 * category with forty open cards stores five rather than forty. Order is the
 * caller's — `crew-count-queue.mts` sorts most-recent-first before calling.
 */
export function serializeQueueTitles(titles: readonly CrewQueueTitle[]): string {
  const kept = titles
    .map(readOne)
    .filter((entry): entry is CrewQueueTitle => entry !== null)
    .slice(0, QUEUE_TITLES_PER_CATEGORY);
  return JSON.stringify(kept);
}

/**
 * The stored JSON back into cards, or an empty list.
 *
 * ⚠ **EMPTY IS THE ONLY FAILURE MODE.** `null` (the column exists and no shift
 * has written it yet), `""`, a truncated string, an object where an array
 * belongs, an entry missing its number — every one of them yields `[]`, which
 * the panel draws as the count alone. That is today's behaviour, so the
 * degraded state is a state the founder has already seen and understood.
 */
export function parseQueueTitles(raw: unknown): CrewQueueTitle[] {
  if (typeof raw !== "string" || raw.trim().length === 0) return [];
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(decoded)) return [];
  return decoded
    .map(readOne)
    .filter((entry): entry is CrewQueueTitle => entry !== null)
    .slice(0, QUEUE_TITLES_PER_CATEGORY);
}

/** What the panel draws for one category: the rows, and the remainder. */
export type CrewQueueTitlesView = {
  readonly shown: readonly CrewQueueTitle[];
  /** How many open cards are NOT named above. Zero means the list is complete. */
  readonly moreCount: number;
};

/**
 * The five and the remainder, derived from the count and the stored titles.
 *
 * ⚠ **NO TITLES MEANS NO REMAINDER LINE, and that is the load-bearing case.**
 * Between this code deploying and his ceremony running, the column does not
 * exist and every row parses to zero titles while `openCount` is still a real
 * number. Subtracting blindly would draw **"+10 more"** under a category naming
 * nothing at all — a promise of a list that is not there, which is worse than
 * the count he has today. So the remainder is only ever the tail of a list he
 * can actually see the head of.
 *
 * The remainder is `openCount - shown`, never `titles.length - shown`: the
 * count is the population and the titles are a sample of it, and they are
 * written in the same statement so they can never describe two moments.
 */
export function queueTitlesView(
  openCount: number,
  titles: readonly CrewQueueTitle[],
): CrewQueueTitlesView {
  const shown = titles.slice(0, QUEUE_TITLES_PER_CATEGORY);
  if (shown.length === 0) return { shown, moreCount: 0 };
  return { shown, moreCount: Math.max(0, openCount - shown.length) };
}
