/**
 * THE REPAIRS OWED, SUMMARISED — #1977, his word 2026-10-08: *"yes shouldnt the
 * manager be on top of this when delegating the work to the crew"*.
 *
 * ⚠ **A COUNT ALONE IS WHAT HE ALREADY HAD.** Every held row already says *Needs
 * a repair*, and on the day he asked there were NINE of them among twelve open
 * rows — so the thing missing was never WHICH pull request, it was that one had
 * been waiting nine hours while seats opened new cards. The age is the half that
 * makes the count mean something, and it is the OLDEST rather than an average,
 * because the oldest is the one that is actually wrong.
 *
 * ⚠ **IT IS DERIVED FROM THE ROWS THE SECTION ALREADY DRAWS**, so the summary
 * and the list under it can never disagree (working law 4). That is also why it
 * lives here rather than inside the component: a derivation nothing can import
 * is a derivation nothing can test, and the whole claim of this block is about
 * which rows it counts.
 *
 * ⚠ **THE CLOCK IS *last flagged*, NOT *owed since*, AND THE WORDING SAYS SO.**
 * The page keeps the newest finding per pull request, not every one, so it
 * dates the hold by the finding it is held on. The reader that orders the work
 * is the seat cut's (`scripts/lib/repairsOwed.mts`), and it dates by the oldest
 * finding on the current head — this is the glance that tells him it is piling up.
 *
 * ⚠ **IT UNDER-COUNTED UNTIL #1984, BY A MEASURED AMOUNT.** Drawn on the real
 * board the day it landed it read **5** where the exact reader saw **9**: the
 * rows dated a finding against the pull request's `updatedAt`, so a seat
 * answering under its own header (31 seconds later, on #1960) made the finding
 * read stale. The rows now read the head commit's date and hand the comments to
 * the merge tool's own reader (`server/crew/liveRepairs.ts`), so this summary —
 * still derived from those rows and nothing else — names the same pull requests.
 * When the head cannot be read the rows fall back to the old bound and the
 * under-count returns, in that direction only.
 */
import type { CrewLivePullRequest } from "./crewTypes";

export type CrewRepairsOwed = {
  readonly count: number;
  /** The earliest `repairFlaggedAt` among the held rows, or `null`. */
  readonly oldest: string | null;
};

export function crewRepairsOwed(
  rows: readonly CrewLivePullRequest[],
): CrewRepairsOwed {
  const held = rows.filter((pr) => pr.state === "finding");
  const flagged = held
    .map((pr) => pr.repairFlaggedAt)
    .filter((at): at is string => typeof at === "string" && at !== "")
    .sort();
  return { count: held.length, oldest: flagged[0] ?? null };
}

/**
 * The words, so the component holds no copy logic and the suite reads the
 * sentence rather than reassembling it.
 *
 * ⚠ **`null` WHEN NOTHING IS OWED, NEVER `"0 need a repair"`.** A row reading
 * zero on a clean board is a number nobody can act on, which is exactly what his
 * ruling on the problems list was about.
 */
export function crewRepairsOwedLabel(owed: CrewRepairsOwed): string | null {
  if (owed.count <= 0) return null;
  return owed.count === 1 ? "1 needs a repair" : `${owed.count} need a repair`;
}
