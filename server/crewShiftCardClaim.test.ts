/**
 * THE OPEN-PR CLAIM WARNING, DRIVEN DIRECTLY (#1083).
 *
 * The finding: a shift can take a card whose PR is already open, because
 * nothing in the shift-start sequence opens `gh pr list`. Measured at
 * timestamps on 2026-09-22 — thirty-five minutes rebuilding a feature that had
 * merged seven minutes before the shift started, with nothing disobeyed.
 *
 * The warning itself lives in `scripts/lib/cardClaimWarning.mts` rather than
 * inside `crew-shift-start.mts` for one reason, and it is this file: the
 * script's block sits past a live database connection and `vitest.setup.ts`
 * strips `DATABASE_URL`, so no suite could ever reach it. A warning nothing can
 * drive is a warning nobody knows the shape of.
 *
 * ⚠ **THE ARM THIS FILE EXISTS FOR IS THE UNREADABLE ONE.** "No open PRs" and
 * "the read failed" are the same picture to a caller that collapses them, and
 * the second one is a board nobody looked at. An unauthenticated `gh` prints
 * nothing, which looks exactly like a clean queue — the same failure shape
 * `#504` named for the NEXT UP read.
 *
 * Nothing here touches a network, a token or a live queue: the reader takes a
 * fixture path, and the source arm reads the file's bytes.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import {
  cardNumberOf,
  findCardPullRequests,
  PR_CONFLICT_NOTE,
  readPullRequestConflict,
} from "../shared/crewShiftState";
import {
  OPEN_PR_READ_TIMEOUT_MS,
  openPullRequestsVerdict,
  readOpenPullRequests,
  renderCardClaimWarning,
  type OpenPullRequest,
} from "../scripts/lib/cardClaimWarning.mts";

/* ⚠ NO ARM HERE SPAWNS ANYTHING — every read goes through a fixture path — and
   the deriver is still right to put this file in its population (#548): it
   IMPORTS a module that calls `execFileSync`, and the import hop is what that
   reader counts. The declaration costs nothing and the alternative is arguing
   with a guard that found its own subject correctly. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const pr = (over: Partial<OpenPullRequest>): OpenPullRequest => ({
  number: 1,
  title: "fix(casting): something",
  body: "A body.",
  url: "https://github.com/x/y/pull/1",
  isDraft: false,
  headRefName: "team/something",
  ...over,
});

describe("cardNumberOf", () => {
  it("reads the forms the card column actually holds", () => {
    expect(cardNumberOf("#1079")).toBe(1079);
    expect(cardNumberOf("1079")).toBe(1079);
    expect(cardNumberOf("#01079")).toBe(1079);
    expect(cardNumberOf(" #1079 ")).toBe(1079);
  });

  /* A founder reply as a card ref is free text and there is no number to search
     for. Returning null here is what keeps the renderer from inventing a
     substring search over prose and reporting noise as diligence. */
  it("is null for free text, for absent, and for zero", () => {
    expect(cardNumberOf("his reply about the hero")).toBeNull();
    expect(cardNumberOf(null)).toBeNull();
    expect(cardNumberOf(undefined)).toBeNull();
    expect(cardNumberOf("#0")).toBeNull();
  });
});

describe("findCardPullRequests", () => {
  it("finds the card in a title, in a body, and in a branch", () => {
    const rows = [
      pr({ number: 10, title: "fix: the thing (#1079)" }),
      pr({ number: 11, body: "Card #1079 (closed by hand with the receipt)." }),
      pr({ number: 12, headRefName: "team/relay1079b" }),
      pr({ number: 13 }),
    ];

    const hits = findCardPullRequests(rows, "#1079");

    expect(hits.map((h) => h.pr.number)).toEqual([10, 11, 12]);
    expect(hits.map((h) => h.where)).toEqual([["title"], ["body"], ["branch"]]);
  });

  /*
    THE NEAR MISSES, AND THEY ARE THE REASON THE MATCH IS A TOKEN RATHER THAN A
    SUBSTRING. `#10790` and `#11079` both contain "1079", and a claim warning
    that fires on an unrelated card is how a real warning stops being read.
  */
  it("does not match a longer number that merely contains the card", () => {
    const rows = [
      pr({ number: 20, title: "fix: something (#10790)" }),
      pr({ number: 21, body: "see #11079 for the road" }),
      pr({ number: 22, headRefName: "team/relay10790" }),
    ];

    expect(findCardPullRequests(rows, "#1079")).toEqual([]);
  });

  it("names every place the number appears on one PR", () => {
    const hits = findCardPullRequests(
      [pr({ number: 30, title: "fix (#1079)", body: "Card #1079.", headRefName: "team/card1079" })],
      "#1079",
    );

    expect(hits).toHaveLength(1);
    expect(hits[0]!.where).toEqual(["title", "body", "branch"]);
  });

  it("is empty for a free-text card ref rather than matching prose", () => {
    expect(findCardPullRequests([pr({ title: "the hero line" })], "the hero line")).toEqual([]);
  });

  it("tolerates a PR row missing every field it reads", () => {
    expect(findCardPullRequests([{} as OpenPullRequest], "#1079")).toEqual([]);
  });
});

describe("renderCardClaimWarning", () => {
  /*
    ⚠ THE ARM THAT MATTERS. A read that failed must not render as a clean board.
    An unauthenticated `gh` exits non-zero and prints nothing; collapsing that
    into "no PRs" is the silence this whole card is about.
  */
  it("says the board was UNREAD when the read failed", () => {
    const warning = renderCardClaimWarning("#1079", null);

    expect(warning).not.toBeNull();
    expect(warning).toContain("could not read the open pull requests");
    expect(warning).toContain("#1079");
    expect(warning).toContain("unread");
  });

  it("says nothing at all when the board is genuinely clean", () => {
    expect(renderCardClaimWarning("#1079", [])).toBeNull();
    expect(renderCardClaimWarning("#1079", [pr({ number: 5, title: "unrelated" })])).toBeNull();
  });

  it("names the PR, its number, its url and where the card was found", () => {
    const warning = renderCardClaimWarning("#1079", [
      pr({ number: 1080, title: "feat: the thing (#1079)", url: "https://github.com/x/y/pull/1080" }),
    ]);

    expect(warning).toContain("#1080");
    expect(warning).toContain("https://github.com/x/y/pull/1080");
    expect(warning).toContain("feat: the thing (#1079)");
    expect(warning).toContain("the number is in its title");
    expect(warning).toContain("1 OPEN pull request already names #1079");
  });

  it("marks a draft as a draft and counts plurals", () => {
    const warning = renderCardClaimWarning("#1079", [
      pr({ number: 1080, title: "a (#1079)" }),
      pr({ number: 1082, title: "b (#1079)", isDraft: true }),
    ]);

    expect(warning).toContain("2 OPEN pull requests already name #1079");
    expect(warning).toContain("#1082 (draft)");
  });

  /*
    IT WARNS AND NEVER REFUSES — the card ruled this before it was built, and
    PR #1082 is the worked example: a legitimate follow-up naming the same card.
    This arm pins the WORDS, because the whole value of the shape is that the
    shift reads it and decides.
  */
  it("tells the shift the run is opening anyway", () => {
    const warning = renderCardClaimWarning("#1079", [pr({ number: 1082, title: "follow-up (#1079)" })])!;

    expect(warning).toContain("WARNING");
    expect(warning).toContain("opening anyway");
    expect(warning.toLowerCase()).not.toContain("refus");
  });

  it("says nothing for a free-text card ref", () => {
    expect(renderCardClaimWarning("his reply about the hero", [pr({ title: "hero" })])).toBeNull();
    expect(renderCardClaimWarning(null, [])).toBeNull();
  });
});

describe("readOpenPullRequests", () => {
  const fixture = (name: string, contents: string): string => {
    const dir = mkdtempSync(join(tmpdir(), "card-claim-"));
    const path = join(dir, name);
    writeFileSync(path, contents, "utf8");
    return path;
  };

  it("reads a fixture file", () => {
    const path = fixture("prs.json", JSON.stringify([{ number: 7, title: "x (#1079)" }]));

    expect(readOpenPullRequests(path)).toEqual([{ number: 7, title: "x (#1079)" }]);
  });

  /* Every unreadable shape is the SAME answer — null — because the renderer's
     unread line is the honest thing to print for all of them. */
  it("is null for a missing file, for malformed json, and for a non-array", () => {
    expect(readOpenPullRequests(join(tmpdir(), "card-claim-does-not-exist.json"))).toBeNull();
    expect(readOpenPullRequests(fixture("bad.json", "{not json"))).toBeNull();
    expect(readOpenPullRequests(fixture("object.json", '{"number":1}'))).toBeNull();
  });

  it("bounds the live read so a hung gh costs a wait and never a session", () => {
    expect(OPEN_PR_READ_TIMEOUT_MS).toBeGreaterThan(0);
    expect(OPEN_PR_READ_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });
});

/*
  ⚠ A CONTROL THAT IS NOT INVOKED DOES NOT EXIST (invariant 7). Every arm above
  drives the lib; none of them proves `crew-shift-start.mts` CALLS it, and the
  script's own block is unreachable from a suite. So this reads the bytes — and
  it is the arm to sabotage first, because it is the one standing in for a drive
  nobody can write.
*/
/*
  #1094 — THE SECOND CALLER, AND THE ARMS EXIST BECAUSE A SABOTAGE STAYED GREEN.

  The shift digest names his ordered cards ~30 seconds before a shift declares
  one, so it asks the same question at the place the CHOICE is made. Its first
  shape did the null-to-UNREADABLE mapping inline in `shift-digest.mts`, where a
  suite cannot reach past the `gh` call — collapsing a failed read into a clean
  board broke nothing. The judgement moved here; these are the arms it now has.
*/
describe("openPullRequestsVerdict — the digest's half", () => {
  it("carries a FAILED read through as unreadable, never as an empty board", () => {
    const verdict = openPullRequestsVerdict(null, true);
    expect(verdict).toHaveProperty("unreadable");
    expect(String((verdict as { unreadable: string }).unreadable)).toContain("gh pr list");
  });

  it("keeps a read NOBODY TOOK apart from a read that failed", () => {
    const skipped = openPullRequestsVerdict(null, false) as { unreadable: string };
    expect(skipped.unreadable).toContain("--no-network");
    /* Two different facts, and a caller that cannot tell them apart reports the
       wrong reason to a shift deciding whether to check by hand. */
    expect(skipped.unreadable).not.toContain("gh pr list");
  });

  it("passes a real answer through untouched, including a genuinely empty one", () => {
    const rows: OpenPullRequest[] = [{ number: 5, title: "x", body: "", headRefName: "team/x" }];
    expect(openPullRequestsVerdict(rows, true)).toBe(rows);
    expect(openPullRequestsVerdict([], true)).toEqual([]);
  });
});

describe("the shift digest actually calls it, and on its OWN root", () => {
  const source = readFileSync(resolve(import.meta.dirname, "..", "scripts", "shift-digest.mts"), "utf8");

  it("reads the open PRs through the shared reader rather than a second gh call", () => {
    expect(source).toContain("readOpenPullRequests(null, root)");
    /* A copied `--json number,title,body,url,isDraft,headRefName` would be a
       mirror of the field list `findCardPullRequests` matches on (working law
       4). One field list, one call shape, two callers. */
    expect(source).not.toContain("\"pr\",");
  });

  it("maps the read through the drivable verdict instead of judging inline", () => {
    expect(source).toContain("openPullRequestsVerdict(");
  });

  it("hands the result to the digest as its own input", () => {
    expect(source).toMatch(/openPullRequests: openPrs/);
  });
});

describe("the shift-start script actually calls it", () => {
  const source = readFileSync(resolve(import.meta.dirname, "..", "scripts", "crew-shift-start.mts"), "utf8");

  it("reads the open PRs and renders the warning on the card it declares", () => {
    expect(source).toContain("renderCardClaimWarning(arg(\"card\"), readOpenPullRequests(arg(\"open-prs\")))");
  });

  it("prints the warning rather than swallowing it", () => {
    expect(source).toMatch(/if \(claimWarning !== null\) console\.log\(claimWarning\)/);
  });

  /* `--open-prs` must be on the strict-args allowlist or passing it REFUSES the
     start outright (#288) — which would make the suite's own fixture road, and
     any hand check of this warning, impossible. */
  it("accepts --open-prs, which the strict reader would otherwise refuse", () => {
    expect(source).toContain("\"open-prs\"");
  });
});

/*
  CAN THE PULL REQUEST THAT CLAIMS THE CARD STILL BE MERGED? (#1099)

  #1078 was finished, green and ready at 11:38Z on 2026-09-22 and unmergeable by
  20:22Z, because main moved three times underneath it. The 19:53Z shift read
  this very warning, saw the PR named, wrote "work in flight, not a hold" and
  moved on — correctly, given what it was shown. Nine hours, and the repair is
  five minutes.

  Why it stayed invisible is worth keeping in front of these arms: a CONFLICTING
  pull request gets no merge ref, so no `pull_request` run fires on it for any
  event, and its checks page keeps showing the last green pass. It looks healthy
  for exactly as long as it is broken.
*/
describe("readPullRequestConflict", () => {
  it("⚠ says TRUE on either field, because GitHub answers this two ways", () => {
    expect(readPullRequestConflict({ mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" })).toBe(true);
    /* Each alone is enough. `gate-stall-check.mts` reads them as an OR for the
       same reason: they are two views of one fact and either may arrive first. */
    expect(readPullRequestConflict({ mergeable: "CONFLICTING" })).toBe(true);
    expect(readPullRequestConflict({ mergeStateStatus: "DIRTY" })).toBe(true);
  });

  it("says FALSE only when GitHub has actually computed a non-conflict", () => {
    expect(readPullRequestConflict({ mergeable: "MERGEABLE", mergeStateStatus: "CLEAN" })).toBe(false);
    expect(readPullRequestConflict({ mergeable: "MERGEABLE", mergeStateStatus: "BLOCKED" })).toBe(false);
    expect(readPullRequestConflict({ mergeable: "MERGEABLE", mergeStateStatus: "BEHIND" })).toBe(false);
  });

  /* THE ARM THIS FUNCTION EXISTS FOR. `false` on UNKNOWN would be a claim the
     reader has not earned — GitHub returns it routinely in the seconds after a
     push, which is exactly when a shift is looking. Collapsing "could not be
     read" into "nothing there" is what this file's own header is about. */
  it("⚠ says NULL while GitHub is still computing — never false", () => {
    expect(readPullRequestConflict({ mergeable: "UNKNOWN", mergeStateStatus: "UNKNOWN" })).toBeNull();
    expect(readPullRequestConflict({ mergeable: "UNKNOWN", mergeStateStatus: "CLEAN" })).toBeNull();
    expect(readPullRequestConflict({ mergeable: "MERGEABLE", mergeStateStatus: "UNKNOWN" })).toBeNull();
  });

  /* The drift case with teeth: a `--json` list that has lost these two fields
     hands every PR back without them. That must read as NOT KNOWABLE, or the
     day somebody trims the field list every PR silently reads as fine. */
  it("⚠ says NULL when the fields are absent — a lost field list is not a clean board", () => {
    expect(readPullRequestConflict({})).toBeNull();
    expect(readPullRequestConflict({ mergeable: null, mergeStateStatus: null })).toBeNull();
    expect(readPullRequestConflict({ mergeable: undefined })).toBeNull();
  });

  it("is case-insensitive, so a lowercased answer is not silently a non-conflict", () => {
    expect(readPullRequestConflict({ mergeable: "conflicting" })).toBe(true);
    expect(readPullRequestConflict({ mergeStateStatus: "dirty" })).toBe(true);
    expect(readPullRequestConflict({ mergeable: "unknown" })).toBeNull();
  });
});

describe("renderCardClaimWarning names a PR that can no longer be merged", () => {
  const conflicted = pr({
    number: 1078,
    title: "fix (#1076)",
    mergeable: "CONFLICTING",
    mergeStateStatus: "DIRTY",
  });

  it("prints the conflict, why it is invisible, and the repair, beside the claim", () => {
    const out = renderCardClaimWarning("#1076", [conflicted]);
    expect(out).toContain("already names #1076");
    expect(out).toContain("NO LONGER BE MERGED");
    /* The thing that makes it invisible is said out loud, or a shift trusts the
       green checks page it is about to open. */
    expect(out).toContain("fires no workflow run");
    /* And the repair is named, because the shift reading this has to do
       something and #984 step 1 is the standing verdict on this shape. */
    expect(out).toContain("#984");
    expect(out).toContain("Re-merge main on its branch");
  });

  it("⚠ stays a WARNING — a drifted PR is exactly when a shift may take the card", () => {
    expect(renderCardClaimWarning("#1076", [conflicted]))
      .toContain("This is a WARNING and the run is opening anyway");
  });

  /* Negative control. Without it, the arm above would pass identically against
     a renderer that printed the note on every claim. */
  it("says NOTHING about mergeability on a clean PR", () => {
    const out = renderCardClaimWarning("#1076", [
      pr({ number: 1078, title: "fix (#1076)", mergeable: "MERGEABLE", mergeStateStatus: "CLEAN" }),
    ]);
    expect(out).toContain("already names #1076");
    expect(out).not.toContain("NO LONGER BE MERGED");
  });

  it("says NOTHING while the answer is UNKNOWN, and nothing when the fields never came", () => {
    const unknown = renderCardClaimWarning("#1076", [
      pr({ number: 1078, title: "fix (#1076)", mergeable: "UNKNOWN", mergeStateStatus: "UNKNOWN" }),
    ]);
    expect(unknown).toContain("already names #1076");
    expect(unknown).not.toContain("NO LONGER BE MERGED");
    expect(renderCardClaimWarning("#1076", [pr({ number: 1078, title: "fix (#1076)" })]))
      .not.toContain("NO LONGER BE MERGED");
  });
});

/*
  THE FIELD LIST IS THE WHOLE DEPENDENCY, SO IT IS HELD AT THE BYTES.

  Every arm above drives the judgement from a fixture, and a fixture cannot
  notice that the live `gh` call stopped ASKING for these two fields — at which
  point `readPullRequestConflict` correctly returns `null` for every PR on the
  board and the whole warning goes quiet with nothing red anywhere. That is the
  silent direction, and it is the direction this card was filed about.
*/
describe("the one gh field list still asks for mergeability", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "..", "scripts", "lib", "cardClaimWarning.mts"),
    "utf8",
  );
  const jsonArg = source.match(/"--json",\s*"([^"]+)"/);
  const fields = (jsonArg?.[1] ?? "").split(",");

  it("has exactly one --json argument, which is what makes it the one field list", () => {
    expect(jsonArg).not.toBeNull();
    expect(source.match(/"--json"/g)).toHaveLength(1);
  });

  it("⚠ asks for mergeable AND mergeStateStatus", () => {
    expect(fields).toContain("mergeable");
    expect(fields).toContain("mergeStateStatus");
  });

  it("still asks for everything the matcher reads, so this cannot be passed by trimming", () => {
    for (const field of ["number", "title", "body", "url", "isDraft", "headRefName"]) {
      expect(fields).toContain(field);
    }
  });
});

describe("the three shift-facing readers all speak the one sentence", () => {
  /* One note, three renderers. A second wording would be a mirror (working law
     4) and, worse, would let one reader be quietly dropped while the other two
     kept the phrase alive in a grep. */
  const files = [
    ["scripts", "lib", "cardClaimWarning.mts"],
    ["scripts", "lib", "shiftDigest.mts"],
    ["scripts", "lib", "standingExceptions.mts"],
  ] as const;

  for (const parts of files) {
    it(`${parts[parts.length - 1]} renders PR_CONFLICT_NOTE rather than its own words`, () => {
      const source = readFileSync(resolve(import.meta.dirname, "..", ...parts), "utf8");
      expect(source).toContain("PR_CONFLICT_NOTE");
      expect(source).toContain("readPullRequestConflict(pr) === true");
      /* `=== true` is the shape, not truthiness: `if (readPullRequestConflict(pr))`
         reads identically and is also correct today, but it is one edit from a
         three-state reader being used as a two-state one. */
      expect(source).not.toMatch(/\(readPullRequestConflict\(pr\)\)/);
    });
  }

  it("PR_CONFLICT_NOTE says what is wrong, why it is invisible, and what to do", () => {
    expect(PR_CONFLICT_NOTE).toContain("NO LONGER BE MERGED");
    expect(PR_CONFLICT_NOTE).toContain("fires no workflow run");
    expect(PR_CONFLICT_NOTE).toContain("#984");
  });
});
