/**
 * THE LOCAL `team/*` BRANCH SWEEP'S ARMS (#1797, Janitor patrol #12).
 *
 * ⚠ **THE HEADLINE ARM IS THE SQUASH-MERGE ONE, AND IT IS THE WHOLE CARD.**
 *
 * Every pull request here is squash-merged, so a branch's own commits never
 * become ancestors of `main`. Measured on this machine's real refs the hour this
 * suite was written: of the **121 refs this criterion calls deletable, 121 are
 * NOT ancestors of `origin/main`** — so `git branch --no-merged` would have kept
 * every single one, and `--merged` would have offered none of them while
 * reaching refs this criterion deliberately keeps. A sweep built on either
 * spelling is wrong in one direction or unrecoverable in the other, and that is
 * why `BRANCH_MERGED_SPELLINGS` below is a text arm rather than a comment.
 *
 * The second thing these arms exist for is the failure that produced the card:
 * **a criterion that silently stops selecting anything.** Run 11's local sweep
 * keyed on the branches that same run had deleted remotely; the moment
 * `delete_branch_on_merge` took the remote side over, its input went to near
 * zero and local refs lost their only sweeper — 115 → 295 in three days with
 * nothing anywhere noticing. So every reader here has a refusal arm: an empty
 * reading is a stated refusal, never a tidy table of keeps.
 *
 * Both directions of every KEEP are driven, because the stakes are asymmetric:
 * a wrong KEEP costs a stale ref, and a wrong DELETE costs work this machine
 * alone holds.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  branchesNamedByAnyPr,
  classifyLocalBranches,
  forEachRefArgs,
  isSweepable,
  lsRemotePullHeadsArgs,
  manifestText,
  newestMergedByBranch,
  parseLocalBranches,
  parsePullHeads,
  parsePullRequests,
  refusalForReadings,
  restPullsArgs,
  restoreRoads,
  survivorsOfReRead,
  SWEEP_PREFIX,
  sweepTally,
  type LocalBranch,
  type PullRequestRow,
  type SweepRow,
} from "../scripts/lib/localBranchSweep.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* This suite drives real git child processes, so it declares the class's
   timeout rather than racing vitest's 5 s default under a parallel run (#548). */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const SHA_C = "c".repeat(40);

/** One merged pull request on a branch, at a given head. */
const mergedPr = (number: number, branch: string, at = "2026-09-29T20:18:53Z"): PullRequestRow =>
  ({ number, headRefName: branch, mergedAt: at });

function classify(options: {
  branches: LocalBranch[];
  held?: string[];
  pullRequests?: PullRequestRow[];
  pullHeads?: [number, string][];
}): SweepRow[] {
  return classifyLocalBranches({
    branches: options.branches,
    held: new Set(options.held ?? []),
    pullRequests: options.pullRequests ?? [],
    pullHeads: new Map(options.pullHeads ?? []),
  });
}

describe("the population — `team/*` and nothing else (#1797)", () => {
  it("takes a team branch and refuses everything else", () => {
    expect(isSweepable("team/review-worktree-removal-1796")).toBe(true);
    for (const outside of ["main", "release/p1-scale", "team/", "teamish/x", "", "HEAD"]) {
      expect(isSweepable(outside), outside).toBe(false);
    }
  });

  it("⚠ `main` IS UNREPRESENTABLE, NOT MERELY ABSENT", () => {
    /* Run 11 asserted `main` absent from its delete list, which was right and is
       a check on a list that COULD have held it. Filtering at the prefix means it
       never enters — a stronger thing than an assertion, because an assertion
       has to be remembered on the next sweep. */
    const rows = classify({
      branches: parseLocalBranches(
        `main ${SHA_A}\nrelease/p1-scale ${SHA_B}\nteam/real-1 ${SHA_C}\n`,
      ),
      pullRequests: [mergedPr(1, "main"), mergedPr(2, "team/real-1")],
      pullHeads: [[1, SHA_A], [2, SHA_C]],
    });
    expect(rows.map((row) => row.branch)).toEqual(["team/real-1"]);
    expect(SWEEP_PREFIX).toBe("team/");
  });

  it("parses a tip per branch and drops a line it cannot read", () => {
    const parsed = parseLocalBranches(
      [
        `team/good ${SHA_A}`,
        "team/no-sha",
        `team/short abc123`,
        "",
        `team/also-good ${SHA_B}`,
      ].join("\n"),
    );
    expect(parsed).toEqual([
      { branch: "team/good", tip: SHA_A },
      { branch: "team/also-good", tip: SHA_B },
    ]);
  });
});

describe("the criterion (#1797)", () => {
  it("⚠ A SQUASH-MERGED BRANCH IS DELETABLE THOUGH ITS COMMITS ARE NOT ON MAIN — the whole card", () => {
    /* Measured on the real refs: 121 of 121 deletable refs are NOT ancestors of
       `origin/main`. `--no-merged` keeps all 121; this criterion does not ask
       about ancestry at all, because ancestry cannot answer the question under
       squash merging. */
    const rows = classify({
      branches: [{ branch: "team/shipped-1", tip: SHA_A }],
      pullRequests: [mergedPr(1527, "team/shipped-1")],
      pullHeads: [[1527, SHA_A]],
    });
    expect(rows[0].verdict).toBe("deletable");
    expect(rows[0].pr).toBe(1527);
    expect(rows[0].reason).toContain("refs/pull/1527/head");
  });

  it("⚠ THE WORKTREE HOLD IS ASKED FIRST AND NOTHING BELOW IT CAN OVERRIDE IT", () => {
    /* Run 10 added this criterion after a surprise and run 11 was bitten inside
       its own sitting — a seat moved a worktree's branch mid-run. A branch that
       passes every other test and is checked out is a seat's live tree. */
    const rows = classify({
      branches: [{ branch: "team/busy-1", tip: SHA_A }],
      held: ["team/busy-1"],
      pullRequests: [mergedPr(1, "team/busy-1")],
      pullHeads: [[1, SHA_A]],
    });
    expect(rows[0].verdict).toBe("held");
    expect(rows[0].reason).toContain("registered worktree");
  });

  it("KEEPS a branch no pull request has ever named — it may be the only copy", () => {
    const rows = classify({
      branches: [{ branch: "team/unpushed-1", tip: SHA_A }],
      pullRequests: [mergedPr(1, "team/something-else")],
      pullHeads: [[1, SHA_B]],
    });
    expect(rows[0].verdict).toBe("keep");
    expect(rows[0].reason).toContain("no pull request has ever named it");
    expect(rows[0].pr).toBeNull();
  });

  it("⚠ KEEPS A BRANCH WHOSE PULL REQUEST CLOSED WITHOUT MERGING, AND SAYS IT DIFFERENTLY", () => {
    /* Rejected work is now nowhere, which is the case MOST worth keeping — and
       a manifest a human reads before deleting is owed the difference between
       "nobody ever opened one" and "one was opened and refused". Both KEEP; the
       sentences are not interchangeable. */
    const rows = classify({
      branches: [{ branch: "team/rejected-1", tip: SHA_A }],
      pullRequests: [{ number: 9, headRefName: "team/rejected-1", mergedAt: null }],
      pullHeads: [[9, SHA_A]],
    });
    expect(rows[0].verdict).toBe("keep");
    expect(rows[0].reason).toContain("none of them merged");
    expect(rows[0].reason).toContain("rejected work");
    expect(rows[0].reason).not.toContain("never named it");
  });

  it("⚠ KEEPS A TIP THAT DIFFERS FROM THE RECORDED HEAD — BOTH DIRECTIONS, ONE ANSWER", () => {
    /* Run 11 kept 23 refs for this reason and was right to; the same class is 26
       refs today. A tip PAST the pull head is a seat that kept working after the
       merge (#1540's measured case, commits nowhere else); a tip BEHIND it is a
       ref whose provenance a sha alone cannot establish. Neither is deletable,
       and the reader does not need to know which it is looking at. */
    for (const tip of [SHA_B, SHA_C]) {
      const rows = classify({
        branches: [{ branch: "team/moved-1", tip }],
        pullRequests: [mergedPr(1514, "team/moved-1")],
        pullHeads: [[1514, SHA_A]],
      });
      expect(rows[0].verdict, tip).toBe("keep");
      expect(rows[0].reason).toContain("not its recorded head");
      expect(rows[0].reason).toContain(SHA_A.slice(0, 12));
      expect(rows[0].pr).toBe(1514);
    }
  });

  it("⚠ TWO READERS DISAGREEING IS A FINDING, NEVER A DELETION", () => {
    /* Reader A says it merged; reader B has no `refs/pull/<n>/head` for it. With
       no restore road readable there is nothing to delete against, and the point
       of two readers sharing no resolver is lost if a disagreement resolves in
       favour of the destructive answer. */
    const rows = classify({
      branches: [{ branch: "team/half-read-1", tip: SHA_A }],
      pullRequests: [mergedPr(1600, "team/half-read-1")],
      pullHeads: [],
    });
    expect(rows[0].verdict).toBe("keep");
    expect(rows[0].reason).toContain("the two readers disagree");
    expect(rows[0].reason).toContain("refs/pull/1600/head");
  });

  it("the newest merge wins when a branch merged twice", () => {
    const rows = classify({
      branches: [{ branch: "team/twice-1", tip: SHA_C }],
      pullRequests: [
        mergedPr(10, "team/twice-1", "2026-09-01T00:00:00Z"),
        mergedPr(20, "team/twice-1", "2026-09-20T00:00:00Z"),
      ],
      pullHeads: [[10, SHA_A], [20, SHA_C]],
    });
    expect(rows[0].verdict).toBe("deletable");
    expect(rows[0].pr).toBe(20);
  });

  it("an OPEN pull request beside a merged one does not change the answer", () => {
    const newest = newestMergedByBranch([
      { number: 30, headRefName: "team/x", mergedAt: null },
      mergedPr(31, "team/x"),
    ]);
    expect(newest.get("team/x")?.number).toBe(31);
    expect(branchesNamedByAnyPr([{ number: 30, headRefName: "team/x", mergedAt: null }]).has("team/x")).toBe(true);
  });

  it("the tally is DERIVED from the rows, never counted beside them", () => {
    const rows = classify({
      branches: [
        { branch: "team/a", tip: SHA_A },
        { branch: "team/b", tip: SHA_B },
        { branch: "team/c", tip: SHA_C },
      ],
      held: ["team/c"],
      pullRequests: [mergedPr(1, "team/a")],
      pullHeads: [[1, SHA_A]],
    });
    expect(sweepTally(rows)).toEqual({ deletable: 1, keep: 1, held: 1 });
    expect(rows).toHaveLength(3);
  });
});

describe("⚠ `git branch --merged` MUST NOT APPEAR — the trap the card names (#1797)", () => {
  const lib = readFileSync(join(import.meta.dirname, "..", "scripts", "lib", "localBranchSweep.mts"), "utf8");
  const cli = readFileSync(join(import.meta.dirname, "..", "scripts", "janitor-local-branches.mts"), "utf8");

  /**
   * A text arm and not a comment, because this is the one mistake here whose
   * consequence cannot be given back: `--merged` inverted deletes work only this
   * machine holds.
   *
   * ⚠ **IT FORBIDS THE CALL, NOT THE WORDS — AND THE FIRST CUT OF THIS ARM GOT
   * THAT WRONG AND WENT RED ON BOTH DOCBLOCKS.** It listed `branch --merged` as
   * a forbidden string, which is a sentence both files have to be free to write:
   * naming the trap at length is most of what their headers are FOR. This is the
   * same mistake `shift-worktree`'s `team/${…}` arm records making and fixing
   * (#1613) — forbid the construction, not the prose. A call writes the flag as
   * a quoted argument in an args array; nobody writes that in a sentence.
   */
  const FORBIDDEN = ['"--merged"', '"--no-merged"', "'--merged'", "'--no-merged'"];

  it("neither the criterion nor the CLI consults git's ancestry opinion", () => {
    for (const spelling of FORBIDDEN) {
      expect(lib, `the criterion reaches for ${spelling}`).not.toContain(spelling);
      expect(cli, `the CLI reaches for ${spelling}`).not.toContain(spelling);
    }
  });

  it("⚠ POSITIVE CONTROL — the arm would catch a real call, and lets the prose through", () => {
    /* Without the first half, the arm above passes just as happily on a file
       that was renamed out from under it. Without the SECOND half, the arm is
       the false alarm that gets a guard worked around instead of fixed — both
       headers discuss `git branch --merged` by name, at length, on purpose. */
    const planted = `${lib}\nconst sabotage = git(["branch", "--merged", "main"]);\n`;
    expect(FORBIDDEN.some((spelling) => planted.includes(spelling))).toBe(true);
    expect(lib, "the criterion's header must be free to name the trap").toContain("branch --merged");
    expect(cli, "the CLI's header must be free to name the trap").toContain("branch --merged");
  });

  it("the CLI's `-D` carries its reason, because `-d` would refuse every branch here", () => {
    /* `-d` refuses a branch git does not consider merged, which under squash
       merging is every branch in the population — so it would refuse the whole
       deletable set and teach whoever runs this to reach for `-D` by hand, with
       no criterion at all. */
    expect(cli).toContain('git(["branch", "-D", row.branch])');
    expect(cli.match(/"branch", "-D"/g) ?? []).toHaveLength(1);
    expect(cli).toContain("`-D` AND NOT `-d`");
    expect(cli).toContain("refuses a branch git does not consider merged");
  });
});

describe("the three calls, asserted at the wire (#1797, working law 5)", () => {
  it("⚠ READER A AND READER B SHARE NO RESOLVER, WHICH IS THE CARD'S REQUIREMENT", () => {
    /* One is an HTTP API through `gh`; the other is git's own wire protocol.
       A single reader wrong in both halves is the failure this rules out. */
    const a = restPullsArgs();
    const b = lsRemotePullHeadsArgs();
    expect(a[0]).toBe("api");
    expect(a.join(" ")).toContain("repos/{owner}/{repo}/pulls?state=all");
    expect(b).toEqual(["ls-remote", "origin", "refs/pull/*/head"]);
    expect(b.join(" ")).not.toContain("api");
    expect(a.join(" ")).not.toContain("ls-remote");
  });

  it("⚠ `state=all`, BECAUSE CLOSED-UNMERGED MUST BE TELLABLE FROM MERGED", () => {
    expect(restPullsArgs().join(" ")).toContain("state=all");
    expect(restPullsArgs().join(" ")).not.toContain("state=merged");
    expect(restPullsArgs()).toContain("--paginate");
  });

  it("the local refs are read with their object names, under refs/heads/", () => {
    expect(forEachRefArgs()).toEqual([
      "for-each-ref", "--format=%(refname:short) %(objectname)", "refs/heads/",
    ]);
  });
});

describe("the readers' own failures (#1797)", () => {
  it("⚠ AN UNPARSEABLE PULL-HEAD LINE IS DROPPED, AND DROPPING ONE ONLY EVER KEEPS", () => {
    const heads = parsePullHeads(
      [
        `${SHA_A}\trefs/pull/7/head`,
        "garbage",
        `${SHA_B}\trefs/pull/notanumber/head`,
        `${SHA_C}\trefs/heads/team/not-a-pull-head`,
        `${SHA_B}\trefs/pull/9/head`,
      ].join("\n"),
    );
    expect([...heads.entries()]).toEqual([[7, SHA_A], [9, SHA_B]]);
    /* The safe direction, proven rather than claimed: a pull request whose head
       was dropped can never clear the sha comparison. */
    const rows = classify({
      branches: [{ branch: "team/x", tip: SHA_A }],
      pullRequests: [mergedPr(999, "team/x")],
      pullHeads: [...heads.entries()],
    });
    expect(rows[0].verdict).toBe("keep");
  });

  it("a pull-request answer that is not a list of usable rows is an empty list", () => {
    expect(parsePullRequests("not json")).toEqual([]);
    expect(parsePullRequests('{"number":1}')).toEqual([]);
    expect(parsePullRequests('[null, 3, {"number":0,"headRefName":"team/x"}]')).toEqual([]);
    expect(parsePullRequests('[{"number":1,"headRefName":""}]')).toEqual([]);
    expect(parsePullRequests('[{"number":1,"headRefName":"team/x","mergedAt":null}]'))
      .toEqual([{ number: 1, headRefName: "team/x", mergedAt: null }]);
  });

  it("⚠ AN EMPTY READING REFUSES THE RUN — the #1797 defect is a criterion that stopped selecting", () => {
    /* Every one of these makes all 298 branches read KEEP, which is SAFE for the
       deletion and dishonest as a measurement. A reader whose failure is a
       refusal tells you it is broken; one whose failure is a tidy table does
       not, and that is precisely how 115 became 295 with nobody noticing. */
    expect(refusalForReadings({ branches: [], pullRequests: [mergedPr(1, "team/x")], pullHeads: new Map([[1, SHA_A]]) }))
      .toContain("no local team/* branch");
    expect(refusalForReadings({ branches: [{ branch: "team/x", tip: SHA_A }], pullRequests: [], pullHeads: new Map([[1, SHA_A]]) }))
      .toContain("reader A");
    expect(refusalForReadings({ branches: [{ branch: "team/x", tip: SHA_A }], pullRequests: [mergedPr(1, "team/x")], pullHeads: new Map() }))
      .toContain("reader B");
  });

  it("⚠ NEGATIVE CONTROL — a complete reading does NOT refuse", () => {
    expect(refusalForReadings({
      branches: [{ branch: "team/x", tip: SHA_A }],
      pullRequests: [mergedPr(1, "team/x")],
      pullHeads: new Map([[1, SHA_A]]),
    })).toBeNull();
  });
});

describe("the re-read taken immediately before deleting (#1797)", () => {
  const row = (branch: string, tip: string): SweepRow =>
    ({ branch, tip, verdict: "deletable", reason: "merged", pr: 1 });

  it("an unchanged, unheld row proceeds", () => {
    const out = survivorsOfReRead({
      deletable: [row("team/a", SHA_A)],
      heldNow: new Set(),
      tipsNow: new Map([["team/a", SHA_A]]),
    });
    expect(out.proceed.map((r) => r.branch)).toEqual(["team/a"]);
    expect(out.moved).toEqual([]);
    expect(out.joined).toEqual([]);
  });

  it("⚠ A BRANCH A WORKTREE TOOK SINCE CLASSIFICATION IS SKIPPED — run 11's measured case", () => {
    /* `team/shared-bare-door-id-1506` joined the held set mid-run while
       `team/pin-reader-blocks-1498` left it. Four seats run in one pass now. */
    const out = survivorsOfReRead({
      deletable: [row("team/a", SHA_A), row("team/b", SHA_B)],
      heldNow: new Set(["team/b"]),
      tipsNow: new Map([["team/a", SHA_A], ["team/b", SHA_B]]),
    });
    expect(out.proceed.map((r) => r.branch)).toEqual(["team/a"]);
    expect(out.joined).toEqual(["team/b"]);
  });

  it("⚠ A TIP THAT MOVED IS SKIPPED AND REPORTED, NOT RE-CLASSIFIED", () => {
    /* Re-classifying would mean re-asking both readers mid-deletion about a
       branch somebody is plainly working on. Skipping costs one stale ref until
       the next run and cannot cost a commit. */
    const out = survivorsOfReRead({
      deletable: [row("team/a", SHA_A)],
      heldNow: new Set(),
      tipsNow: new Map([["team/a", SHA_C]]),
    });
    expect(out.proceed).toEqual([]);
    expect(out.moved).toEqual([{ branch: "team/a", was: SHA_A, now: SHA_C }]);
  });

  it("⚠ A TIP THAT HAS GONE IS SKIPPED BY THE SAME TEST, AND SAYS SO", () => {
    /* Somebody else deleted it between the two readings. Reporting it as `gone`
       rather than counting it as deleted is the difference between a receipt
       and a guess. */
    const out = survivorsOfReRead({
      deletable: [row("team/a", SHA_A)],
      heldNow: new Set(),
      tipsNow: new Map(),
    });
    expect(out.proceed).toEqual([]);
    expect(out.moved).toEqual([{ branch: "team/a", was: SHA_A, now: null }]);
  });

  it("⚠ THE HOLD IS ASKED BEFORE THE TIP HERE TOO — a held branch is never reported as moved", () => {
    /* A seat that took the branch AND committed on it would otherwise be
       reported as a moved tip, which reads as litter rather than as a live
       tree. */
    const out = survivorsOfReRead({
      deletable: [row("team/a", SHA_A)],
      heldNow: new Set(["team/a"]),
      tipsNow: new Map([["team/a", SHA_C]]),
    });
    expect(out.joined).toEqual(["team/a"]);
    expect(out.moved).toEqual([]);
    expect(out.proceed).toEqual([]);
  });
});

describe("the restore roads and the manifest (#1797)", () => {
  const deletable: SweepRow = {
    branch: "team/shipped-1",
    tip: SHA_A,
    verdict: "deletable",
    reason: "PR #1527 merged it",
    pr: 1527,
  };

  it("⚠ TWO ROADS PER ROW, AND THE SECOND ONE WORKS AFTER THE BRANCH IS GONE", () => {
    /* `refs/pull/<n>/head` is not a branch and survives `delete_branch_on_merge`
       and this deletion alike, which is what makes every row here recoverable
       rather than merely carefully chosen. */
    const roads = restoreRoads(deletable);
    expect(roads).toHaveLength(2);
    expect(roads[0]).toBe(`git push origin ${SHA_A}:refs/heads/team/shipped-1`);
    expect(roads[1]).toContain("refs/pull/1527/head");
    expect(roads[1]).toContain("git branch team/shipped-1 FETCH_HEAD");
  });

  it("a row with no pull request offers the sha road only, never an invented ref", () => {
    const roads = restoreRoads({ ...deletable, pr: null, verdict: "keep" });
    expect(roads).toHaveLength(1);
    expect(roads[0]).toContain(SHA_A);
  });

  it("⚠ THE MANIFEST CARRIES A RESTORE ROAD FOR EVERY DELETABLE ROW, AND THE COUNTS ARE DERIVED", () => {
    const rows: SweepRow[] = [
      deletable,
      { branch: "team/kept-1", tip: SHA_B, verdict: "keep", reason: "no pull request", pr: null },
      { branch: "team/busy-1", tip: SHA_C, verdict: "held", reason: "a worktree", pr: null },
    ];
    const text = manifestText(rows, "2026-10-02T18:00:00.000Z");
    expect(text).toContain("3 branch(es): 1 deletable, 1 keep, 1 held");
    expect(text).toContain("## DELETABLE — 1");
    expect(text).toContain("## KEEP — 1");
    expect(text).toContain("## HELD — 1");
    for (const road of restoreRoads(deletable)) expect(text).toContain(road);
    /* A kept row must NOT carry a restore line — it was never deleted, and a
       restore road beside it reads as a receipt for something that happened. */
    expect(text).not.toContain(`refs/heads/team/kept-1`);
    /* The trap is named in the artifact a human reads, not only in the code. */
    expect(text).toContain("`git branch --merged` is not");
    expect(text).toContain("squash");
  });
});

/**
 * THE CRITERION AGAINST REAL GIT (#1797).
 *
 * ⚠ **THE PURE ARMS PROVE THE RULE; ONLY THIS PROVES THE SHAS LINE UP THE WAY
 * THE RULE ASSUMES.** The whole criterion rests on two facts about this
 * repository that no pure arm can establish: a squash merge leaves the branch's
 * commits off `main`, and `refs/pull/<n>/head` holds the branch tip and survives
 * the branch's deletion. Both are put in a real repository with a real bare
 * remote here, and the squash is performed rather than simulated.
 *
 * Nothing touches this repository: a fresh repo, a fresh bare remote, a
 * temporary directory, no network.
 */
describe("the criterion against a real repository (#1797)", () => {
  function git(cwd: string, args: string[]) {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });
    return { status: result.status ?? 1, out: result.stdout ?? "", err: result.stderr ?? "" };
  }

  function withRepo(name: string, body: (repo: string) => void) {
    const parent = mkdtempSync(join(tmpdir(), `drape-branchsweep-${name}-`));
    try {
      const repo = join(parent, "repo");
      expect(git(parent, ["init", "-q", "--bare", "remote.git"]).status).toBe(0);
      expect(git(parent, ["init", "-q", "-b", "main", "repo"]).status).toBe(0);
      expect(git(repo, ["config", "user.email", "arm@example.com"]).status).toBe(0);
      expect(git(repo, ["config", "user.name", "Arm"]).status).toBe(0);
      expect(git(repo, ["remote", "add", "origin", join(parent, "remote.git")]).status).toBe(0);
      writeFileSync(join(repo, "main.txt"), "main\n");
      expect(git(repo, ["add", "-A"]).status).toBe(0);
      expect(git(repo, ["commit", "-q", "-m", "main"]).status).toBe(0);
      expect(git(repo, ["push", "-q", "origin", "main"]).status).toBe(0);
      body(repo);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }

  it("⚠ A SQUASH MERGE REALLY DOES LEAVE THE BRANCH OFF MAIN, AND THE PULL HEAD REALLY DOES SURVIVE", () => {
    withRepo("squash", (repo) => {
      /* The feature branch, pushed to `refs/pull/7/head` the way GitHub keeps
         it, then SQUASH-merged into main — the real act, not a fixture. */
      expect(git(repo, ["checkout", "-q", "-b", "team/feature-7"]).status).toBe(0);
      writeFileSync(join(repo, "feature.txt"), "the work\n");
      expect(git(repo, ["add", "-A"]).status).toBe(0);
      expect(git(repo, ["commit", "-q", "-m", "the work"]).status).toBe(0);
      const tip = git(repo, ["rev-parse", "team/feature-7"]).out.trim();
      expect(git(repo, ["push", "-q", "origin", "HEAD:refs/pull/7/head"]).status).toBe(0);

      expect(git(repo, ["checkout", "-q", "main"]).status).toBe(0);
      expect(git(repo, ["merge", "-q", "--squash", "team/feature-7"]).status).toBe(0);
      expect(git(repo, ["commit", "-q", "-m", "the work (#7)"]).status).toBe(0);

      /* ⚠ THE FACT THE WHOLE CARD TURNS ON, read at real git rather than
         asserted: the branch shipped and its commits are NOT ancestors of main. */
      const ancestor = git(repo, ["merge-base", "--is-ancestor", "team/feature-7", "main"]);
      expect(ancestor.status, "a squash merge made the branch an ancestor — the fixture is wrong").toBe(1);
      /* And `--no-merged` therefore still lists it, which is the 147-dead-refs
         failure in one reading. */
      expect(git(repo, ["branch", "--no-merged", "main"]).out).toContain("team/feature-7");

      /* Reader B over the real git protocol, parsed by the real parser. */
      const heads = parsePullHeads(git(repo, lsRemotePullHeadsArgs()).out);
      expect(heads.get(7)).toBe(tip);

      const branches = parseLocalBranches(git(repo, forEachRefArgs()).out);
      expect(branches).toEqual([{ branch: "team/feature-7", tip }]);

      const rows = classifyLocalBranches({
        branches,
        held: new Set(),
        pullRequests: [mergedPr(7, "team/feature-7")],
        pullHeads: heads,
      });
      expect(rows[0].verdict).toBe("deletable");

      /* THE RESTORE ROAD, DRIVEN: delete the branch, prove the pull ref still
         holds the tip, and put the branch back from it. */
      expect(git(repo, ["branch", "-D", "team/feature-7"]).status).toBe(0);
      expect(git(repo, ["rev-parse", "--verify", "--quiet", "refs/heads/team/feature-7"]).status).not.toBe(0);
      const stillThere = parsePullHeads(git(repo, lsRemotePullHeadsArgs()).out);
      expect(stillThere.get(7), "refs/pull/7/head did not survive the branch deletion").toBe(tip);
      expect(git(repo, ["fetch", "-q", "--no-tags", "origin", "refs/pull/7/head"]).status).toBe(0);
      expect(git(repo, ["branch", "team/feature-7", "FETCH_HEAD"]).status).toBe(0);
      expect(git(repo, ["rev-parse", "team/feature-7"]).out.trim()).toBe(tip);
    });
  });

  it("⚠ A COMMIT MADE AFTER THE MERGE MOVES THE TIP OFF THE PULL HEAD AND IS KEPT", () => {
    withRepo("past", (repo) => {
      expect(git(repo, ["checkout", "-q", "-b", "team/feature-8"]).status).toBe(0);
      writeFileSync(join(repo, "feature.txt"), "the work\n");
      expect(git(repo, ["add", "-A"]).status).toBe(0);
      expect(git(repo, ["commit", "-q", "-m", "the work"]).status).toBe(0);
      expect(git(repo, ["push", "-q", "origin", "HEAD:refs/pull/8/head"]).status).toBe(0);
      /* The seat keeps working on the same branch after its PR merged — measured
         on this machine the night #1540 was written. */
      writeFileSync(join(repo, "after.txt"), "the next card\n");
      expect(git(repo, ["add", "-A"]).status).toBe(0);
      expect(git(repo, ["commit", "-q", "-m", "the next card"]).status).toBe(0);

      const rows = classifyLocalBranches({
        branches: parseLocalBranches(git(repo, forEachRefArgs()).out),
        held: new Set(),
        pullRequests: [mergedPr(8, "team/feature-8")],
        pullHeads: parsePullHeads(git(repo, lsRemotePullHeadsArgs()).out),
      });
      const row = rows.find((r) => r.branch === "team/feature-8");
      expect(row?.verdict).toBe("keep");
      expect(row?.reason).toContain("not its recorded head");
    });
  });
});

describe("the CLI's own text — the sequence before a deletion (#1797)", () => {
  const cli = readFileSync(join(import.meta.dirname, "..", "scripts", "janitor-local-branches.mts"), "utf8");

  it("⚠ THE MANIFEST IS WRITTEN BEFORE ANYTHING IS DELETED", () => {
    /* The founder's rule for a deletion card, and the one thing that makes a
       wrong verdict survivable. */
    const manifest = cli.indexOf("writeFileSync(manifestPath");
    const destroy = cli.indexOf('git(["branch", "-D"');
    expect(manifest).toBeGreaterThan(-1);
    expect(destroy).toBeGreaterThan(-1);
    expect(manifest).toBeLessThan(destroy);
  });

  it("⚠ THE HOLD AND THE TIPS ARE RE-READ IMMEDIATELY BEFORE THE DELETE", () => {
    /* It fired on run 11 inside one sitting: a seat moved a worktree's branch
       mid-run, so the held set at classification was not the held set at
       deletion. Four builder seats run in one pass now, so the window is wider. */
    const reread = cli.indexOf("const heldNow = heldBranches();");
    const destroy = cli.indexOf('git(["branch", "-D"');
    expect(reread).toBeGreaterThan(-1);
    expect(reread).toBeLessThan(destroy);
    expect(cli).toContain("re-read before deleting");
  });

  it("⚠ DELETION IS BEHIND `--delete` AND READ-ONLY IS THE DEFAULT", () => {
    expect(cli).toContain('if (arg === "--delete") doDelete = true;');
    expect(cli).toContain("if (!doDelete) {");
    const gate = cli.indexOf("if (!doDelete) {");
    expect(gate).toBeLessThan(cli.indexOf('git(["branch", "-D"'));
  });

  it("⚠ ONLY THE DELETABLE SET IS EVER PASSED TO THE DELETE", () => {
    expect(cli).toContain('rows.filter((row) => row.verdict === "deletable")');
    expect(cli).toContain("for (const row of proceed) {");
  });

  it("⚠ ONE WORKTREE PARSER, SHARED WITH `shift-worktree` (working law 4)", () => {
    /* A second copy of the porcelain reader is the drift #1613 was filed about,
       and a hold this reader missed is a branch deleted out from under a seat. */
    expect(cli).toContain('from "./lib/shiftWorktree.mts"');
    expect(cli).toContain("parseWorktreeList(listed.out)");
    expect(cli).not.toContain("branch refs/heads/");
  });

  it("a failed worktree listing REFUSES rather than reading as an empty hold set", () => {
    /* An empty hold set reads as "nothing is checked out anywhere", which on this
       machine is false of 23 worktrees and would offer a working seat's branch. */
    expect(cli).toContain("git worktree list failed");
    const listing = cli.indexOf("git worktree list failed");
    expect(listing).toBeLessThan(cli.indexOf("const held = new Set<string>();"));
  });

  it("the last top-level statement exits — the script-guard rule, satisfied by construction", () => {
    expect(cli.trimEnd().endsWith("process.exit(0);")).toBe(true);
  });

  it("the suite's own subject exists — a pointer arm cannot pass vacuously", () => {
    expect(existsSync(join(import.meta.dirname, "..", "scripts", "janitor-local-branches.mts"))).toBe(true);
    expect(existsSync(join(import.meta.dirname, "..", "scripts", "lib", "localBranchSweep.mts"))).toBe(true);
  });
});
