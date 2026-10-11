/**
 * A FINISHED CARD THAT READS AS OPEN WORK, DRIVEN (#2265).
 *
 * The reading this gives on a healthy board is ZERO — measured over all 49 open
 * cards and the real 200 merged pull requests the hour it was written. **So a
 * clean run proves nothing on its own**, which is working law 2: a checker that
 * cannot fail is not a checker. These arms are what tells a clean reading apart
 * from a blind one.
 *
 * Nothing here is a fixture invented to pass:
 *
 *  - the POSITIVE control is the real pair, with the real squash titles —
 *    `#2247` via PR `#2255` and `#2248` via PR `#2254`, both labelled
 *    `seat:retro`, both open at 07:20Z with their work live in build
 *    `ceb1165f1`;
 *  - the NEGATIVE controls are the three cards that were ALSO open with merged
 *    pull requests that same hour and are each correctly open — `#1882`,
 *    `#1952`, `#2155`;
 *  - the REGRESSION controls are the planner's TWO measured false positives,
 *    and both named card `#18`. Before the BRANCH limb came off,
 *    `dependabot/npm_and_yarn/dotenv-18.0.5` read as building it because
 *    `18.0.5` contains the digit run `18`; and before the BODY limb came off
 *    (#2270), **PR #2268 — the pull request that built this reader** — read as
 *    building it, because its body carries the sentence *describing* the first
 *    false positive. Measured over the real 200 merged pull requests: title and
 *    body together reported that one card and nothing true; the title alone
 *    reported nothing.
 */
import { describe, expect, it } from "vitest";

import { pullRequestBuildsCard } from "../shared/crewCardBuildState.js";
import { CREW_HOLD_LABELS } from "../shared/crewNextUpHold.js";
import {
  SHIPPED_NOT_CLOSED_HOLD_LABELS,
  type ShippedNotClosedCard,
  type ShippedNotClosedPullRequest,
  planShippedNotClosed,
  shippedNotClosedLines,
} from "../shared/crewShippedNotClosed.js";

function card(issueNumber: number, labels: readonly string[] = []): ShippedNotClosedCard {
  return { issueNumber, labels };
}

function pr(number: number, title: string): ShippedNotClosedPullRequest {
  return { number, title };
}

/* The real squash titles, copied from the merged pull requests. */
const PR_2255 = pr(2255, "fix(crew): the desk sweep reads his Problems section (Card: #2247)");
const PR_2254 = pr(
  2254,
  "fix(rite): a repeating failure set is not evidence until the arms run alone (Card: #2248)",
);
const PR_1884 = pr(1884, "chore(janitor): sweep the probe leftovers (Card: #1882)");
const PR_2031 = pr(2031, "fix(billing): plain receipts on the credit lines (Card: #1952)");
const PR_2160 = pr(2160, "chore(janitor): unregister the stale worktrees (Card: #2155)");

const run = (input: {
  open: readonly ShippedNotClosedCard[];
  merged?: readonly ShippedNotClosedPullRequest[];
  openPullRequests?: readonly ShippedNotClosedPullRequest[];
}) =>
  planShippedNotClosed({
    open: input.open,
    merged: input.merged ?? [],
    openPullRequests: input.openPullRequests ?? [],
  }).map((finding) => finding.issueNumber);

describe("#2265 · planShippedNotClosed — the positive control is the real pair", () => {
  it("names #2247 and #2248 from their real squash titles", () => {
    expect(run({
      open: [card(2247, ["seat:retro"]), card(2248, ["seat:retro"])],
      merged: [PR_2255, PR_2254],
    })).toEqual([2247, 2248]);
  });

  it("names the card even though a LIVE CLAIM is what hid it — a claim is not an input here", () => {
    /* Both measured instances carried a claim comment less than twelve hours
       old, which is the reading that kept them off every other board. This
       planner takes no claim at all, so there is nothing to suppress it. */
    expect(run({ open: [card(2247, ["seat:retro"])], merged: [PR_2255] })).toEqual([2247]);
  });

  it("carries the merged pull request numbers, ascending", () => {
    const found = planShippedNotClosed({
      open: [card(2247, ["seat:retro"])],
      merged: [pr(2300, "fix: later slice (Card: #2247)"), PR_2255],
      openPullRequests: [],
    });
    expect(found).toHaveLength(1);
    expect(found[0]?.mergedPullRequests).toEqual([2255, 2300]);
  });
});

describe("#2265 · planShippedNotClosed — the negative controls are the live board", () => {
  it("names NOTHING on the three cards that were open with merged PRs and are correctly open", () => {
    expect(run({
      open: [
        card(1882, ["seat:janitor", "blocked"]),
        card(1952, ["founder-ordered", "blocked", "small-fix"]),
        card(2155, ["seat:janitor", "blocked"]),
      ],
      merged: [PR_1884, PR_2031, PR_2160],
    })).toEqual([]);
  });

  it("names nothing when no merged pull request claims the card", () => {
    expect(run({
      open: [card(2247, ["seat:retro"])],
      merged: [pr(2300, "fix(crew): something else entirely (Card: #999)")],
    })).toEqual([]);
  });

  it("a title that names ANOTHER card is not a claim on this one", () => {
    expect(run({
      open: [card(2247, ["seat:retro"])],
      merged: [pr(2300, "fix(crew): unrelated (Card: #999)")],
    })).toEqual([]);
  });
});

describe("#2265 · planShippedNotClosed — each suppressor, driven on its own", () => {
  it.each([...SHIPPED_NOT_CLOSED_HOLD_LABELS])(
    "the hold label %s suppresses the finding on its own",
    (label) => {
      expect(run({ open: [card(2247, [label])], merged: [PR_2255] })).toEqual([]);
    },
  );

  it("an OPEN pull request suppresses it — the merged one was an earlier slice", () => {
    expect(run({
      open: [card(2247, ["seat:retro"])],
      merged: [PR_2255],
      openPullRequests: [pr(2400, "fix(crew): slice two (Card: #2247)")],
    })).toEqual([]);
  });

  it("an open pull request on ANOTHER card does not suppress it", () => {
    expect(run({
      open: [card(2247, ["seat:retro"])],
      merged: [PR_2255],
      openPullRequests: [pr(2400, "fix(crew): slice two (Card: #1999)")],
    })).toEqual([2247]);
  });

  it("a card number that is not a positive integer is ignored rather than matched", () => {
    expect(run({
      open: [card(0), card(-5), card(Number.NaN)],
      merged: [pr(2300, "fix: zero (Card: #0)")],
    })).toEqual([]);
  });
});

describe("#2265 · the branch limb is withheld — the dependabot regression", () => {
  /* The real pull request and the real card it falsely matched. */
  const DOTENV = pr(1891, "chore(deps): Bump dotenv from 17.2.3 to 18.0.5");

  it("does NOT read `dotenv-18.0.5` as building card #18", () => {
    expect(run({ open: [card(18, ["design-unbuilt", "rung:N4"])], merged: [DOTENV] })).toEqual([]);
  });

  it("the semver in the title is not a card token — `18.0.5` has no `#`", () => {
    expect(run({ open: [card(18)], merged: [DOTENV] })).toEqual([]);
  });

  it("the type carries number and title ONLY, so neither limb can be re-supplied", () => {
    /* A compile-time fact asserted at runtime: the object the planner is handed
       has exactly these two keys, so a later caller cannot widen the read by
       passing a head ref or a body it would then match on. */
    expect(Object.keys(DOTENV).sort()).toEqual(["number", "title"]);
  });
});

describe("#2270 · the body limb is withheld — prose that mentions a card is not a claim", () => {
  /*
    The instrument's own first live run named card #18 off PR #2268 — the pull
    request that BUILT this reader — because its body carries the sentence
    describing the dependabot false positive above. Measured over the real 200
    merged pull requests: title+body reported that one card and nothing true;
    title alone reported nothing. These arms are that measurement, pinned.
  */
  const REAL_SENTENCE = "it read as building card #18, because 18.0.5 contains the digit run 18";

  it("a pull request whose BODY says `card #18` does not read as building card #18", () => {
    /* The body cannot even be supplied now — the arm is that the real sentence
       is absent from everything the planner sees, so the card is not named. */
    const built = pr(2268, "fix(crew): the desk sweep asks whether an open card already shipped (Card: #2265)");
    expect(Object.values(built).join(" ")).not.toContain("card #18");
    expect(run({ open: [card(18, ["design-unbuilt", "rung:N4"])], merged: [built] })).toEqual([]);
  });

  it("the same pull request DOES still name the card its title claims", () => {
    /* The negative arm above must not pass by the reader having gone blind. */
    const built = pr(2268, "fix(crew): the desk sweep asks whether an open card already shipped (Card: #2265)");
    expect(run({ open: [card(2265, ["seat:retro"])], merged: [built] })).toEqual([2265]);
  });

  it("the sentence that caused it would have matched the body limb, which is why it is gone", () => {
    /* Drives the OLD rule directly, so this arm fails if somebody restores the
       body limb believing it harmless. */
    expect(pullRequestBuildsCard(
      { number: 2268, title: "fix(crew): unrelated", body: REAL_SENTENCE },
      18,
    )).toContain("body");
    expect(pullRequestBuildsCard({ number: 2268, title: "fix(crew): unrelated" }, 18)).toEqual([]);
  });
});

describe("#2265 · the hold set is derived, not retyped", () => {
  it("is the three hold labels plus parked, and nothing else", () => {
    expect([...SHIPPED_NOT_CLOSED_HOLD_LABELS].sort())
      .toEqual(["awaiting-fable", "blocked", "needs-sitting", "parked"]);
  });

  it("contains every CREW_HOLD_LABELS value, so a fourth hold joins with no edit here", () => {
    for (const label of Object.values(CREW_HOLD_LABELS)) {
      expect(SHIPPED_NOT_CLOSED_HOLD_LABELS).toContain(label);
    }
  });

  it("does NOT contain founder-ordered — the set that answers the seat's question is the wrong one", () => {
    /* `workHoldExclusionFor` holds off `founder-ordered` because the focus lane
       owns those cards. Deriving this reader from it would have skipped every
       card on the current rung, which is the population the next instance of
       this fault will sit in. */
    expect(SHIPPED_NOT_CLOSED_HOLD_LABELS).not.toContain("founder-ordered");
    expect(run({ open: [card(2251, ["founder-ordered", "rung:N2c"])], merged: [pr(2256, "feat: file several casts (Card: #2251)")] }))
      .toEqual([2251]);
  });
});

describe("#2265 · shippedNotClosedLines", () => {
  it("says nothing at all when there is nothing to say", () => {
    expect(shippedNotClosedLines([])).toEqual([]);
  });

  it("names each card with its merged pull requests, and names the remedy", () => {
    const lines = shippedNotClosedLines([
      { issueNumber: 2247, mergedPullRequests: [2255] },
      { issueNumber: 2248, mergedPullRequests: [2254] },
    ]);
    const text = lines.join("\n");
    expect(lines[0]).toContain("2 card(s)");
    expect(text).toContain("#2247 — merged in #2255");
    expect(text).toContain("#2248 — merged in #2254");
    expect(text).toContain("RELEASED");
  });
});
