/**
 * REPAIRS OWED — the open pull requests the relay has HELD on a finding, oldest
 * first, so the seat cut can offer them before any new card.
 *
 * **His word, 2026-10-08 (terminal), verbatim:** *"yes shouldnt the manager be
 * on top of this when delegating the work to the crew"* — said after five
 * money/privacy pull requests sat held on the relay's findings with no repair
 * pushed (#1946 for about five hours, plus #1960, #1963, #1974 and #1924) while
 * seats opened new cards, and two founder-ordered wording cards were then
 * refused because they sequence behind #1963.
 *
 * ⚠ **THE RULE WAS ALREADY IN THE STANDING ORDERS AND THAT WAS THE DEFECT
 * (#1977).** `.agents/foreman/prompt.md` carries *A REPAIR OWED COMES BEFORE ANY
 * NEW CARD* in prose, and the seat gate reads the machine's inputs rather than
 * the orders — the class #1840 named, where his word reached a file a person
 * reads and not the field a machine reads.
 *
 * # ⚠ THERE IS NO SECOND READER HERE, AND THAT IS THE WHOLE OF THE DESIGN
 *
 * Which comment holds a pull request is a question THREE readers already ask,
 * and #1673 exists because two of them disagreed about one header for six hours.
 * So this module computes nothing about verdicts: it assembles the identities
 * and hands them to `tallyRounds` + `reviewPresence` — `scripts/lib/reviewRounds.mts`,
 * the merge tool's own reader — and sorts what comes back. A pull request this
 * says is held is, by construction, one `pr-merge-in-order` would refuse to
 * merge.
 *
 * # WHAT "OLDEST" MEANS, read off the findings rather than off the pull request
 *
 * ⚠ **The OLDEST FRESH finding, not the newest.** Several findings can sit on
 * one head — the relay reading twice with no push between — and the repair has
 * then been owed since the FIRST of them. Measured on the live repository the
 * day this was written: ordering by the newest put #1963 at 0.8 h when its
 * repair had been owed 3.0 h, which is the figure that decides whether it comes
 * before #1974. A finding on an earlier head is a repair already pushed and is
 * not owed at all; `tallyRounds` keeps those apart as `staleFindings`.
 */
import { reviewPresence, tallyRounds, type HandVerdictReading } from "./reviewRounds.mjs";

/**
 * HOW MANY OPEN PULL REQUESTS ONE READ MAY ASK FOR — and it is **not** the 100
 * every other pull-request read in this repository uses.
 *
 * ⚠ **MEASURED AGAINST GITHUB'S OWN REFUSAL, not chosen.** `commits` and
 * `comments` are both connections, so asking for them across a page multiplies:
 * at 100 the API answers *"this query ... is requesting up to 1,000,000 possible
 * nodes which exceeds the maximum limit of 500,000"* and the whole read fails.
 * Driven on the live repository: **50 refused, 30 answered, 25 answered, 20
 * answered.** Thirty is the largest measured answer and sits at nearly three
 * times the population it has to cover (eleven open pull requests that day).
 */
export const REPAIR_PR_PAGE = 30;

/** `gh pr list` arguments — exported so the suite asserts the wire, not a constant beside it. */
export const REPAIRS_OWED_LIST_ARGS: readonly string[] = [
  "pr", "list", "--state", "open", "--limit", String(REPAIR_PR_PAGE),
  "--json", "number,title,createdAt,isDraft,headRefName,commits,comments",
];

/** One row of that read, in the shape `gh` returns it. */
export type RepairPullRequestRow = {
  readonly number?: number;
  readonly title?: string;
  readonly createdAt?: string;
  readonly isDraft?: boolean;
  readonly headRefName?: string;
  readonly commits?: readonly { readonly committedDate?: string }[];
  readonly comments?: readonly {
    readonly id?: string | number;
    readonly author?: { readonly login?: string } | null;
    readonly createdAt?: string;
    readonly body?: string;
  }[];
};

/** A pull request whose newest hand comment on its current head is a finding. */
export type RepairOwed = {
  readonly pullRequest: number;
  readonly title: string;
  readonly headRefName: string;
  readonly draft: boolean;
  /** The OLDEST fresh finding's timestamp — how long the repair has been owed. */
  readonly heldSince: string;
  /** How many fresh findings sit on this head, for the line that reports it. */
  readonly findings: number;
};

export type RepairsOwedReading = {
  readonly repairs: readonly RepairOwed[];
  /**
   * ⚠ **THE PAGE CAME BACK FULL, so there may be a repair this reading cannot
   * see.** It is reported rather than swallowed because the failure direction is
   * the wrong one: a repair past the page reads as *not owed*, and a seat then
   * takes a new card — which is precisely the behaviour this card exists to end.
   */
  readonly partial: boolean;
  /** Rows that carried no commits and so could not be dated — named, never dropped silently. */
  readonly undatable: readonly number[];
};

/**
 * THE READING, from rows — pure, so the suite drives it without touching GitHub.
 *
 * ⚠ **A ROW WITH NO COMMITS IS NOT A REPAIR AND NOT SILENCE.** `headCommittedAt`
 * is what makes a finding fresh; with no commits there is no head to be fresh
 * against, so the pull request cannot be judged here at all. It goes into
 * `undatable` for the caller to print — the merge tool refuses outright on the
 * same fact (*"PR #N lists no commits — nothing to review or merge"*), and a
 * reader that quietly dropped it would hide exactly the pull request a person
 * needs to look at.
 */
export function repairsOwedFrom(
  rows: readonly RepairPullRequestRow[],
  ownerLogin: string,
): RepairsOwedReading {
  const repairs: RepairOwed[] = [];
  const undatable: number[] = [];

  for (const row of rows) {
    const number = typeof row.number === "number" ? row.number : 0;
    if (number === 0) continue;
    const commits = row.commits ?? [];
    const head = commits[commits.length - 1];
    if (!head?.committedDate) {
      undatable.push(number);
      continue;
    }
    const comments: HandVerdictReading[] = (row.comments ?? []).map((comment, index) => ({
      id: typeof comment.id === "number" ? comment.id : index,
      authorLogin: comment.author?.login ?? "",
      createdAt: comment.createdAt ?? "",
      body: comment.body ?? "",
    }));
    const tally = tallyRounds(comments, {
      number,
      headRefName: row.headRefName ?? "",
      createdAt: row.createdAt ?? "",
      headCommittedAt: head.committedDate,
      ownerLogin,
    });
    /*
      ⚠ `reviewOwed` is FALSE on purpose, and it is not a shortcut. A finding
      outranks it inside `reviewPresence` either way (#1673's own clause: *"a
      fresh finding on an ORDINARY pull request holds it too"*), and passing a
      guess at who owes this diff a look would make this reader answer a second
      question — *is a review owed* — that it has no business deciding and that
      the merge tool reads the file list to answer properly.
    */
    if (reviewPresence(tally, false) !== "finding") continue;
    const oldest = tally.findings[0];
    if (!oldest) continue;
    repairs.push({
      pullRequest: number,
      title: row.title ?? "",
      headRefName: row.headRefName ?? "",
      draft: row.isDraft === true,
      heldSince: oldest.createdAt,
      findings: tally.findings.length,
    });
  }

  repairs.sort((a, b) => {
    const by = a.heldSince.localeCompare(b.heldSince);
    /* A tie on the clock falls to the lower pull request number, so two seats
       cutting the same pass are handed the same order rather than whatever the
       page happened to list first. */
    return by !== 0 ? by : a.pullRequest - b.pullRequest;
  });

  return { repairs, partial: rows.length >= REPAIR_PR_PAGE, undatable };
}

/** How long the oldest repair has been owed, in hours — `null` when none is. */
export function oldestRepairAgeHours(
  reading: Pick<RepairsOwedReading, "repairs">,
  nowMs: number,
): number | null {
  const oldest = reading.repairs[0];
  if (!oldest) return null;
  const at = Date.parse(oldest.heldSince);
  if (!Number.isFinite(at)) return null;
  return Math.max(0, (nowMs - at) / 3_600_000);
}

/**
 * THE WORDS FOR THE `SEATS` LINE the runner logs — one owner, because the cut
 * prints it and the suite asserts it.
 *
 * ⚠ **IT SAYS THE COUNT AND THE OLDEST AGE, never just a count.** His own
 * complaint was about a repair sitting five hours while seats opened new cards,
 * so a bare `repairs 9` is the number that was already visible on the board; the
 * age is the fact that makes it a problem.
 */
export function repairsOwedWord(reading: RepairsOwedReading, nowMs: number): string {
  if (reading.repairs.length === 0) {
    return reading.partial ? " | repairs none seen (page full — may be short)" : " | repairs none";
  }
  const hours = oldestRepairAgeHours(reading, nowMs);
  const oldest = reading.repairs[0]!;
  const age = hours === null ? "age unreadable" : `oldest ${hours.toFixed(1)}h`;
  return ` | repairs ${reading.repairs.length} (${age}, PR #${oldest.pullRequest})`
    + (reading.partial ? " — page full, may be short" : "");
}
