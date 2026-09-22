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
import { cardNumberOf, findCardPullRequests } from "../shared/crewShiftState";
import {
  OPEN_PR_READ_TIMEOUT_MS,
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
