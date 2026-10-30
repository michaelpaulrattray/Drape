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
import {
  liveCardClaimsFromFacts,
  pullRequestBuildsCard,
  type CrewCardCommentFact,
  type CrewLiveClaim,
} from "../../shared/crewCardBuildState.ts";
import { isShiftAnswer } from "../../shared/handVerdict.ts";
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
  /**
   * WHEN A SHIFT ANSWERED IT, or `null` when none has (#2855).
   *
   * ⚠ **A REPAIR IS NOT ALWAYS A COMMIT, and that is the whole of this field.**
   * `tallyRounds` calls a finding stale only when the head moved under it, which
   * is right — a pushed repair IS a new head. But the relay's finding on PR
   * #2852 asked for a **re-measurement** and said so in its own last line; a
   * shift ran it (72 readings, $2.00 of house money) and answered under the
   * standing orders' header. **The head never moved**, so this reader went on
   * offering a repair that was delivered and sitting in a comment — and the
   * cost is the silent direction: a seat that trusts the row re-runs the
   * measurement.
   *
   * ⚠ **IT HOLDS NOTHING BACK AND CLEARS NOTHING.** The pull request stays on
   * this list, stays held, and `pr-merge-in-order` has never heard of this
   * field. What it changes is the ORDER: an answered repair sorts behind every
   * un-answered one, so a seat is handed the work nobody has touched first. A
   * shift cannot clear its own hold by writing a header, and the way it cannot
   * is that no decision reads this.
   */
  readonly answeredAt: string | null;
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
    /*
      ⚠ MEASURED AGAINST THE NEWEST FRESH FINDING, never the oldest (#2855). The
      list is ordered by the oldest because that is how long the repair has been
      owed; whether it has been ANSWERED is a different question, and an answer
      older than the relay's second reading answers nothing. Both facts come off
      the same tally, so they cannot disagree about which findings are fresh.
    */
    const newestFinding = tally.findings[tally.findings.length - 1];
    const answered = (row.comments ?? [])
      .filter((comment) => (comment.author?.login ?? "") === ownerLogin && isShiftAnswer(comment.body ?? ""))
      .map((comment) => comment.createdAt ?? "")
      .filter((at) => at !== "" && newestFinding !== undefined && at > newestFinding.createdAt)
      .sort((a, b) => b.localeCompare(a))[0] ?? null;
    repairs.push({
      pullRequest: number,
      title: row.title ?? "",
      headRefName: row.headRefName ?? "",
      draft: row.isDraft === true,
      heldSince: oldest.createdAt,
      findings: tally.findings.length,
      answeredAt: answered,
    });
  }

  repairs.sort((a, b) => {
    /* ⚠ AN ANSWERED REPAIR SORTS BEHIND EVERY UN-ANSWERED ONE (#2855). It is
       not removed — the work may still be owed if the relay disagrees, and a
       list that could lose a repair is the behaviour this module exists to end
       — but a seat is handed what nobody has touched first. */
    const answered = Number(a.answeredAt !== null) - Number(b.answeredAt !== null);
    if (answered !== 0) return answered;
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
  /* ⚠ THE ANSWERED ONES ARE COUNTED APART (#2855). A bare total reads as work
     nobody has touched, and on a night when every held pull request has already
     been answered that number is the one somebody acts on. */
  const answered = reading.repairs.filter((repair) => repair.answeredAt !== null).length;
  const said = answered === 0 ? "" : `, ${answered} answered — waiting on the relay`;
  return ` | repairs ${reading.repairs.length} (${age}, PR #${oldest.pullRequest}${said})`
    + (reading.partial ? " — page full, may be short" : "");
}

/*
  ── WHOSE HANDS ARE ALREADY ON THIS? (#2769) ──────────────────────────────────

  ⚠ **NOTHING ON THIS ROAD ASKED, AT ANY POINT, UNTIL THIS BLOCK.** Read at the
  bytes the day the card was filed: this module held **zero** occurrences of
  `claim`. The claim rule itself is good and asks well —
  `crew-shift-start.mts` re-asks at every moment a card is DECLARED on a
  row, the row read refusing on an open run and the comment read on another
  seat's live `CLAIMED —` line — but **a repair is handed out as a PULL
  REQUEST, not as a card.** A seat told to check out somebody else's branch and
  push never declares a card, so not one of those readers is ever reached.

  Measured instance: a claim was published, was SIX MINUTES OLD, sat on the card
  the repair was for, and nothing read it. Cost, one full Opus session producing
  one comment.

  # IT INFORMS AND NEVER HOLDS, and that is the card's own asymmetry

  A held pull request with a repair owed is the highest-priority work on the
  board (his word, #1977), and a stale claim must never be able to stall one. So
  nothing here withholds a repair, reorders one, or refuses: it attaches a FACT
  to the hand-out and the seat reads it. A reading that held would turn the cure
  into the disease — the shape `renderNoteForeignClaimWarning` already argues
  against on the heartbeat road.

  # THE CARD IS DERIVED FROM THE TITLE, BY THE READER THAT ALREADY OWNS THAT

  `RepairOwed` carries no card and the runner's `REPAIR FIRST` line names
  none, so the first missing fact is WHICH CARD. It is read with
  {@link pullRequestBuildsCard} — `shared/crewCardBuildState.ts`, the same
  reader his page and five queue readers use — over the open board the cut
  already holds.

  ⚠ **TITLE LIMB ONLY, which is `shared/crewShippedNotClosed.ts`'s own narrowing
  and not a new one.** That reader passes the title alone on purpose, and here
  the branch limb would be actively wrong: it matches any digit RUN in a branch
  name, and a seat branch is `team/seat-1-20261029-…` — so it would resolve
  card **#1** for every seat branch in the repository.

  ⚠ **MEASURED ON THE EXACT POPULATION THIS ROAD WALKS, not on a proxy.** Over
  `server/__fixtures__/repairsOwed.live.json` — the real `gh pr list` answer
  of the day #1977 was written, nine of its twelve open pull requests held on a
  finding — **9 of 9 held pull requests resolve exactly ONE card from the
  title**, and the fixture's two dependabot rows resolve NONE. Over the 120
  newest merged pull requests the convention holds at **114 of 120** (4 name no
  card, 2 name two, and both of those genuinely built two cards). A pull request
  naming no card is SILENT and behaves exactly as this road did before — which
  is the only direction a derivation like this may fail in.

  # AND THE CHANNEL IS THE `SEATS` LINE, measured rather than assumed

  `.agents/foreman/foreman-runner.ps1` pipes the cut's stdout through
  `Where-Object { $_ -match "^SEATS " }` and keeps the last match — so
  **every other line the cut prints reaches nobody on the automated road**, the
  `REPAIR OWED | …` lines among them. {@link repairClaimWord} is therefore
  written for that line, and the per-repair line and the plan item carry the same
  fact for the person and the machine respectively.

  ⚠ **THE LAST HOP IS DECLARED, exactly as #1977 declared it rather than
  pretending otherwise** (the fidelity law's stated shortcut). The runner builds
  its own `REPAIR FIRST` sentence from the item's fields and is UNTRACKED, so
  no pull request can teach it a new one; the relay owns that line. What this
  commit does is make the fact impossible to miss in the three places a tracked
  change can reach: the plan item, the cut's own output, and the one line the
  runner logs.
*/

/** The live claim on the card a held pull request is for — `null` when there is none. */
export type RepairCardClaim = {
  readonly pullRequest: number;
  /**
   * The cards this pull request's TITLE names that are open on the board right
   * now — normally exactly one, empty for a dependabot bump, two for a pull
   * request that genuinely built two cards.
   */
  readonly cards: readonly number[];
  /**
   * The live claims on the livest of those cards, or `null` when none is held.
   *
   * ⚠ **`mine` IS NOT A STATE THIS ROAD CAN HAVE, and it is said rather than
   * left to be noticed.** The cut does not know which seat will be handed which
   * repair — the runner deals them round-robin after the plan is written — so
   * every claim here is reported and none is filtered out as the reader's own.
   * The seat reads the name and decides, which is also what makes a claim of its
   * own harmless to report.
   *
   * ⚠ **AND IT CARRIES EVERY LIVE CLAIM ON THAT CARD, NOT THE NEWEST ONE
   * (#2775).** It was `{ card, seat, at }`, which on a contested card named the
   * seat that got there LAST — so the hand-out whose whole job is to say *whose
   * hands are already on it* pointed at the wrong seat on the one occasion two
   * seats are involved. `claims` is newest-first and non-empty whenever this
   * field is set; `liveCardClaimsFromFacts` carries the measurement for why no
   * single name is chosen here.
   */
  readonly claim: { readonly card: number; readonly claims: readonly CrewLiveClaim[] } | null;
};

/**
 * THE READING, pure over facts already read — one row per repair, in the
 * repairs' own order.
 *
 * Both inputs are things the cut already holds: the open board
 * (`readOpenCards`) and the card comment facts (`readCardComments` →
 * `buildBoard`). So this costs **no `gh` call at all**, which is why there
 * is no cap on it and no budget argument to make: the claim-probe cap the
 * heartbeat road needs (`HEARTBEAT_FOREIGN_CLAIM_PROBE_MAX`) exists because
 * that road pays one read per candidate, and this one pays none.
 */
export function repairCardClaims(input: {
  readonly repairs: readonly RepairOwed[];
  readonly openCards: readonly number[];
  readonly facts: readonly CrewCardCommentFact[];
  readonly nowMs: number;
}): readonly RepairCardClaim[] {
  return input.repairs.map((repair) => {
    const cards = input.openCards.filter((card) =>
      pullRequestBuildsCard({ number: repair.pullRequest, title: repair.title }, card).length > 0);
    let claim: RepairCardClaim["claim"] = null;
    for (const card of cards) {
      const live = liveCardClaimsFromFacts({ card, facts: input.facts, nowMs: input.nowMs });
      if (live.length === 0) continue;
      /* The livest CARD across the cards it names, judged on that card's newest
         claim exactly as before. In practice there is one card; a two-card pull
         request reports on whichever is livest — and then on ALL of that card's
         live claims (#2775), because the question this answers is "whose hands
         are on it" and a contested card has more than one honest answer. */
      if (claim === null || live[0].at.localeCompare(claim.claims[0].at) > 0) {
        claim = { card, claims: live };
      }
    }
    return { pullRequest: repair.pullRequest, cards, claim };
  });
}

/**
 * THE WORDS FOR THE `SEATS` LINE — `""` when the board has nothing to say,
 * which is the ordinary case and must cost the line nothing.
 *
 * ⚠ **IT NAMES THE SEAT AND THE AGE, never a bare count**, for
 * {@link renderNoteForeignClaimWarning}'s own measured reason: a claim three
 * minutes old is somebody at a keyboard, and one eleven hours old is a finished
 * shift that never released. Those two want opposite actions from the seat
 * reading the line, so a word that could not tell them apart would be an alarm
 * rather than a fact.
 */
export function repairClaimWord(claims: readonly RepairCardClaim[], nowMs: number): string {
  const held = claims.filter(
    (row): row is RepairCardClaim & { claim: NonNullable<RepairCardClaim["claim"]> } => row.claim !== null,
  );
  if (held.length === 0) return "";
  const words = held.map((row) => {
    /* ⚠ EVERY LIVE CLAIM, EACH WITH ITS OWN AGE (#2775). The age stays per
       seat rather than collapsing to a count, for this function's own stated
       reason: three minutes is somebody at a keyboard and eleven hours is a
       finished shift that never released, and on a contested card the two seats
       can be one of each — which is precisely the thing worth reading. */
    const seats = row.claim.claims.map((claim) => {
      const hours = (nowMs - Date.parse(claim.at)) / 3_600_000;
      const age = Number.isFinite(hours)
        ? hours < 1 ? Math.max(0, Math.round(hours * 60)) + "m ago" : hours.toFixed(1) + "h ago"
        : "age unreadable";
      return (claim.seat ?? "a seat that did not name itself") + " " + age;
    });
    return "PR #" + row.pullRequest + " -> card #" + row.claim.card + " claimed by " + seats.join(" and ");
  });
  return " | repair claims: " + words.join("; ");
}
