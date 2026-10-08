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
 * This page cannot see a push, so it cannot know whether an older finding was
 * already repaired; `repairFlaggedAtForPullRequest` carries the whole argument.
 * The reader that can afford the exact question is the seat cut's
 * (`scripts/lib/repairsOwed.mts`), which is what ORDERS the work — this is the
 * glance that tells him it is piling up.
 *
 * ⚠ **AND IT UNDER-COUNTS TODAY, BY A MEASURED AMOUNT — #1984.** Drawn on the
 * real board the day it landed it read **5** where the exact reader saw **9**:
 * any comment after the relay makes a finding read stale on this road, and a
 * seat answering a finding under its own header is enough (31 seconds, on
 * #1960). It is the rows beside it that are quiet, not this summary — agreeing
 * with them is the right relationship, and the repair is #1984 rather than a
 * second rule here.
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
