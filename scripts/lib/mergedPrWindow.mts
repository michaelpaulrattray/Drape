/**
 * WHICH MERGED PULL REQUESTS THE *SHIPPED BUT STILL OPEN* READING ASKS FOR, AND
 * HOW IT KNOWS THE READ WAS COMPLETE (#2291).
 *
 * The rule lives in `shared/crewShippedNotClosed.ts` and the I/O is wired in
 * `scripts/crew-desk-sweep.mts`. This module is the third thing, and #2291 is
 * about exactly it: **how many merged pull requests reach the rule at all, and
 * what the reading says when it could not see them.**
 *
 * # THE DEFECT
 *
 * The read was `gh pr list --state merged --limit 200` with **no truncation
 * check of any kind**. Measured 2026-10-11 at the live repository: **1089
 * merged pull requests against a bound of 200.** So the reading saw the most
 * recent fifth of the history and reported the other four fifths as *clean* —
 * and the finding it feeds is *a card was shipped by a merged pull request and
 * never closed*, whose honest answer on a healthy board is zero. **An unread
 * board answers zero too**, which is the sentence the sweep's own blocks
 * already carry three times over.
 *
 * Its two neighbours in that file guard precisely this (`ordered.length >= 200`,
 * `allOpen.length >= OPEN_QUEUE_LIMIT`). The merged read was the one that was
 * missed, and it is the only one of the three whose population grows without
 * limit.
 *
 * # ⚠ BOTH REPAIRS THE CARD OFFERED WERE MEASURED, AND ONE OF THEM IS DEAD
 *
 * **A DERIVED DATE WINDOW BUYS NOTHING HERE.** `crewNamingWindow.mts` next door
 * narrows its own read to *merged after the oldest open card*, on the sound
 * ground that nothing merged earlier can qualify. Measured on the live queue
 * rather than assumed: the oldest open card is **#14, filed 2026-08-25**, and
 * **1089 of the 1089 merges in this repository postdate it**. The derived
 * window IS the whole history, so narrowing moves no row at all — and because
 * the window would then be a `--search` read, it would hand the reading
 * GitHub's 1000-result ceiling as a new ceiling it cannot detect. #2290
 * measured the same thing on its own reading the same day and took the same
 * road out.
 *
 * **A FIXED BOUND WITH A REFUSAL IS #507'S DISEASE ON A FUSE.** It is the
 * neighbours' shape, and it works for them because an open-card population is
 * bounded by how fast cards close. This one is not. Measured: **757 merges in
 * the last 30 days, 197 in the last 7 — about 25 a day.** A bound of 1500
 * against today's 1089 would therefore refuse every run inside **~16 days**,
 * and from the report that is indistinguishable from the read being broken.
 * Any constant here has a fortnight's life.
 *
 * # THE BOUND IS DERIVED FROM THE LIVE POPULATION, AND THE READ IS HELD AGAINST IT
 *
 * So the population is read first — one cheap call that returns a COUNT and no
 * rows — the page bound is set from it, and the reading is then held against
 * that same number. ⚠ **That is the shape #2291 itself names as the best in the
 * tree**: `server/crew/liveQueue.ts` detects truncation from the search API's
 * own `total_count` (`open.total > open.items.length`) rather than by comparing
 * a row count to a bound it chose. This gives that shape to a `gh pr list`
 * reader, which cannot ask for a total directly.
 *
 * ⚠ **THE TWO ROADS ARE NOT INTERCHANGEABLE AND THE SPLIT IS THE WHOLE TRICK.**
 * The COUNT comes off the search API, which is the only road that reports a
 * total; the ROWS come off `--state merged`, which is **not** a search and
 * which the 1000-result ceiling therefore does not bind (the population is
 * already 1089, so the search road is structurally unable to answer this at
 * all). Reading the count on one road and the rows on the other is also what
 * makes this two readers rather than one trusting itself.
 *
 * ⚠ **AND THE VERDICT NEEDS BOTH COMPARES, NOT ONE.** A read short of the
 * population is a floor — that is the liveQueue compare. But a read that came
 * back AT the bound is also a floor, and the population compare cannot see it:
 * the bound sits above the population by construction, so a capped page reads
 * as *more rows than the population* and passes. Each compare is blind to the
 * other's case; `server/mergedPrWindow.test.ts` drives them separately.
 *
 * # ⚠ WHY A CONSTANT IS STILL ALLOWED FOR THE HEADROOM
 *
 * {@link MERGED_PR_READ_HEADROOM} is a number in a file, which is what the
 * paragraphs above just argued against — so the asymmetry is stated rather than
 * left to be noticed. **A bound has to be at least a population that grows
 * forever; this has to be at least the merges that land in the seconds BETWEEN
 * the two calls.** One of those tracks the history and the other tracks a
 * stopwatch. At the measured ~25 merges a day a single merge arrives about once
 * an hour, the two calls are about six seconds apart, and the headroom is 100 —
 * four days of merges, for a gap measured in seconds. It cannot expire because
 * it is not following anything.
 *
 * It is not zero, and that is the reason: with the bound set to exactly the
 * population, a merge landing between the count and the list pushes the newest
 * row off the page — and the newest merge is the likeliest of all of them to be
 * the one that just shipped a card nobody closed.
 *
 * # WHAT IT COSTS, MEASURED
 *
 * 1089 rows of `number,title` is **6.0 s** against the old 200-row read's
 * **1.4 s**, plus one count call that returns a single row. Paid once per sweep,
 * at a shift close. The fields are `number,title` and deliberately not `body`
 * (#2270): the planner reads the title limb alone, and 1089 pull-request bodies
 * would be megabytes of dependabot changelog that nothing here reads.
 */

/**
 * How far the page bound sits above the population it was derived from.
 *
 * See the header: this absorbs merges landing between the count call and the
 * list call, which is a gap of seconds — it is not tracking the history, so it
 * is not the expiring constant the header refuses.
 */
export const MERGED_PR_READ_HEADROOM = 100;

/**
 * The count call. ⚠ **`{owner}` and `{repo}` are substituted by `gh` from the
 * current repository**, inside the query string as well as the path — driven at
 * the live repository before it was relied on, because a repository slug typed
 * into a script is one more thing that can be wrong. So this module names no
 * repository, and `server/crew/liveQueue.ts`'s own `LIVE_QUEUE_REPO` constant
 * is not borrowed here.
 *
 * `per_page=1` because only `total_count` is read; the one row it returns is
 * discarded.
 */
export function mergedPrPopulationArgs(): string[] {
  return ["api", "search/issues?q=repo:{owner}/{repo}+is:pr+is:merged&per_page=1"];
}

/**
 * `total_count` off that response, or `null` when it is not a usable count.
 *
 * ⚠ **A SHAPE IT CANNOT READ IS `null`, NEVER A ZERO.** Zero is a real and
 * believable answer from this endpoint (a repository with no merges), so
 * falling back to it would turn an unreadable count into *"the history is
 * empty"* — and an empty history makes every bound look sufficient.
 */
export function mergedPrPopulationFrom(response: unknown): number | null {
  const total = (response as { total_count?: unknown } | null)?.total_count;
  if (typeof total !== "number" || !Number.isSafeInteger(total) || total < 0) return null;
  return total;
}

/** The page bound for a population — the header's one arithmetic claim. */
export function mergedPrPageBound(population: number): number {
  return population + MERGED_PR_READ_HEADROOM;
}

/**
 * The row call, bounded from the population.
 *
 * ⚠ **`--state merged`, NOT `--search` (see the header).** The search road
 * stops at 1000 results and the population passed that before this was
 * written, so the search road cannot answer this question at any bound.
 */
export function mergedPrListArgs(population: number): string[] {
  return [
    "pr", "list",
    "--state", "merged",
    "--limit", String(mergedPrPageBound(population)),
    "--json", "number,title",
  ];
}

/** What the reading is: whole, short, or never taken. */
export type MergedPrReadVerdict =
  | { readonly kind: "complete"; readonly rows: number; readonly population: number }
  | { readonly kind: "floor"; readonly why: string }
  | { readonly kind: "unread"; readonly why: string };

/**
 * IS THIS READING THE WHOLE MERGED HISTORY?
 *
 * The two compares are the header's: short of the population, or stopped at the
 * bound. Either one is a floor, and a floor is reported as a floor rather than
 * as a clean population.
 */
export function mergedPrReadVerdict(input: {
  readonly population: number | null;
  readonly rows: number | null;
}): MergedPrReadVerdict {
  const { population, rows } = input;
  if (population === null) {
    return {
      kind: "unread",
      why:
        "the number of merged pull requests could not be read, so there is nothing to size the page "
        + "against and no way to tell a whole reading from a short one",
    };
  }
  if (rows === null) {
    return { kind: "unread", why: "the merged pull requests could not be read" };
  }
  const bound = mergedPrPageBound(population);
  if (rows >= bound) {
    return {
      kind: "floor",
      why:
        `the page stopped at its bound of ${bound}, so this is a floor and not the history — `
        + `${population} merged pull request(s) were counted a moment earlier`,
    };
  }
  if (rows < population) {
    return {
      kind: "floor",
      why:
        `${rows} merged pull request(s) came back where ${population} were counted, so `
        + `${population - rows} of them were not read and no card can be cleared against them`,
    };
  }
  return { kind: "complete", rows, population };
}
