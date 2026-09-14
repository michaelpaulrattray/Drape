import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { grepAtCommit, listScriptGuardSuites, ORIGIN_SUITE, PUSH_PATH_SUITES, runScriptGuardsOnCommit } from "../scripts/lib/scriptGuards.mts";
import { gitTreeReader } from "../scripts/lib/pushPaths.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* This suite drives a real child process, so it declares the class's timeout
   rather than racing vitest's 5 s default under a parallel run (#548). */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * The rite's script-guard step (#152) — the derivation and the verdict, driven
 * without a real vitest run. The real run is driven at the artifacts on the PR
 * that lands it: HEAD green, and a commit carrying a breaching script red.
 */
const ROOT = path.resolve(import.meta.dirname, "..");

/**
 * The worktrees git currently knows about, resolved, read from the repository
 * rather than from the file system. This is the property the teardown really
 * owes (#652): a leaked REGISTRATION makes every later `git worktree add`
 * pick a fresh admin name and leaves the repository carrying a tree that is
 * not there, which is what breaks a subsequent run.
 */
const registeredWorktrees = (): string[] =>
  execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: ROOT, encoding: "utf8" })
    .split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => path.resolve(line.slice("worktree ".length)));

/**
 * Where this repository keeps its worktree admin entries — the COMMON git
 * directory, so the reading holds whether the suite runs in the main checkout
 * or inside a linked worktree (a shift branch always runs it in the latter,
 * and `<worktree>/.git` is a FILE there, not a directory).
 */
const WORKTREE_ADMIN_DIR = path.join(
  path.resolve(execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: ROOT, encoding: "utf8" }).trim()),
  "worktrees",
);

/**
 * The `gitdir:` a checked-out worktree carries in its own `.git` FILE.
 *
 * ⚠ This is the RACE-IMMUNE way to prove the body ran inside a real worktree
 * of this repository, and it replaces a `git worktree list` read taken inside
 * the body (PR #653 review, finding 1). That read asked whether the tree was
 * REGISTERED at that instant — the very property this suite has just finished
 * proving can be lost while a tree is alive — so the positive control would
 * have been a smaller-windowed instance of the #652 flake it was written to
 * end. A prune deletes the admin entry; it never touches the tree's own `.git`
 * file, so this reading cannot be raced by a sibling suite.
 */
const gitdirOf = (tree: string): string => {
  try { return readFileSync(path.join(tree, ".git"), "utf8").trim(); } catch { return ""; }
};

describe("the script-guard suite list is derived from the suites", () => {
  it("finds the origin case at the real tree, and more than it alone", () => {
    const suites = listScriptGuardSuites(ROOT);
    expect(suites).toContain(ORIGIN_SUITE);
    /* Six siblings were counted the day this was written; the floor is well
       under that so a retired guard does not redden this, and well above one
       so a derivation that only finds its own origin case does. */
    expect(suites.length).toBeGreaterThanOrEqual(3);
    expect(suites.every((suite) => suite.startsWith("server/") && suite.endsWith(".test.ts"))).toBe(true);
    expect(suites.some((suite) => suite.endsWith(".integration.test.ts"))).toBe(false);
  });

  it("REFUSES rather than running a shorter list when the derivation loses the origin case", () => {
    expect(() => listScriptGuardSuites(ROOT, () => "")).toThrow(/lost its origin case/);
    expect(() => listScriptGuardSuites(ROOT, () => "server/scriptWorldGuard.test.ts\n")).toThrow(/lost its origin case/);
  });

  it("drops integration suites and normalises separators", () => {
    const suites = listScriptGuardSuites(ROOT, () => [
      "server\\scriptExitDiscipline.test.ts",
      "server/foo.integration.test.ts",
      "server/scriptWorldGuard.test.ts",
      "",
    ].join("\n"));
    /* ⚠ THIS ARM MOVED, and it moved because the function's contract changed —
       said out loud rather than edited quietly. `PUSH_PATH_SUITES` (#263) is
       merged in after the derivation, so the list is now "what the grep found,
       plus what somebody named". The arm still pins the derivation's own work:
       the integration suite is dropped and the backslash normalised. */
    expect(suites).toEqual([
      ...PUSH_PATH_SUITES,
      "server/scriptExitDiscipline.test.ts",
      "server/scriptWorldGuard.test.ts",
    ].sort());
  });

  it("derives the list from the COMMIT, not the desk — the #479 narrowing's other half", () => {
    /* Until 2026-09-09 the list came from a working-tree grep while the suites
       ran in a worktree of the commit; the rite's blanket dirty-tree refusal
       was the only thing making those the same tree. That guard is narrowed
       now (a desk-only dirty `server/*.test.ts` no longer refuses a push), so
       the sameness must be constructed here. Driven on a real repository whose
       desk copy of a suite has LOST the deriving token while the commit keeps
       it: the desk grep drops the suite (the negative control — the hole is
       real), the commit grep keeps it, and `runScriptGuardsOnCommit`'s DEFAULT
       derivation is the commit-scoped one. */
    const repo = mkdtempSync(path.join(os.tmpdir(), "drape-guardlist-"));
    try {
      const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" });
      git("init", "--quiet");
      git("config", "user.email", "suite@drape.test");
      git("config", "user.name", "suite");
      mkdirSync(path.join(repo, "server"), { recursive: true });
      mkdirSync(path.join(repo, "node_modules"), { recursive: true });
      writeFileSync(path.join(repo, "server", ORIGIN_SUITE.split("/")[1]!), 'walk("scripts")\n');
      writeFileSync(path.join(repo, "server", "deskDrops.test.ts"), 'walk("scripts")\n');
      git("add", "server");
      git("commit", "--quiet", "-m", "fixture");
      const sha = git("rev-parse", "HEAD").trim();
      writeFileSync(path.join(repo, "server", "deskDrops.test.ts"), "walk('nothing')\n");

      expect(listScriptGuardSuites(repo)).not.toContain("server/deskDrops.test.ts");
      expect(listScriptGuardSuites(repo, (r) => grepAtCommit(r, sha))).toContain("server/deskDrops.test.ts");

      const handed: string[][] = [];
      const verdict = runScriptGuardsOnCommit(repo, sha, {
        vitest: (cwd, suites) => {
          handed.push(suites);
          return { status: 0, output: "" };
        },
      });
      expect(verdict.ok).toBe(true);
      expect(handed).toHaveLength(1);
      expect(handed[0]).toContain("server/deskDrops.test.ts");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("the named push-path suites are added, deduplicated, and cannot rescue a broken grep", () => {
    expect(PUSH_PATH_SUITES.length).toBeGreaterThan(0);
    /* Named AND found by the grep: it appears once, not twice. */
    const both = listScriptGuardSuites(ROOT, () => [ORIGIN_SUITE, ...PUSH_PATH_SUITES].join("\n"));
    expect(both.filter((s) => s === PUSH_PATH_SUITES[0])).toHaveLength(1);
    /* The origin floor is checked on the DERIVED list alone, so the named list
       cannot keep a dead derivation looking alive. */
    expect(() => listScriptGuardSuites(ROOT, () => PUSH_PATH_SUITES.join("\n"))).toThrow(/lost its origin case/);
  });
});

describe("the verdict is the runner's exit status on the pushed tree", () => {
  it("runs the suites in a detached worktree of the commit, and tears it down on both arms", () => {
    const seen: { cwd: string; suites: string[]; gitdir: string }[] = [];
    const vitest = (status: number) => (cwd: string, suites: string[]) => {
      /* Read INSIDE the body, which is the only moment the tree is supposed to
         exist. Without this the absence assertion below is green on nothing —
         a runner that never made a worktree would satisfy it too. */
      seen.push({ cwd, suites, gitdir: gitdirOf(cwd) });
      return { status, output: "line 1\n\nline 2\n" };
    };
    const green = runScriptGuardsOnCommit(ROOT, "HEAD", { suites: [ORIGIN_SUITE], vitest: vitest(0) });
    expect(green.ok).toBe(true);
    const red = runScriptGuardsOnCommit(ROOT, "HEAD", { suites: [ORIGIN_SUITE], vitest: vitest(1) });
    expect(red.ok).toBe(false);
    expect(red.printed).toBe("line 1\nline 2");
    /* The runner was handed a tree that is NOT the working directory, and it
       was a real worktree of THIS repository while it ran. */
    expect(seen).toHaveLength(2);
    for (const call of seen) {
      expect(path.resolve(call.cwd)).not.toBe(ROOT);
      expect(call.suites).toEqual([ORIGIN_SUITE]);
      expect(call.gitdir, "the body ran inside a real worktree of this repository")
        .toMatch(/^gitdir: \S/);
      expect(
        path.resolve(call.gitdir.replace(/^gitdir:\s*/, "")).startsWith(WORKTREE_ADMIN_DIR),
        `the tree's gitdir must sit under ${WORKTREE_ADMIN_DIR}, and it reads ${call.gitdir}`,
      ).toBe(true);
    }
    /*
      THE PROMISE IS THE REGISTRATION, NOT THE DIRECTORY (#652).

      This line used to be `expect(seen.some((call) => existsSync(call.cwd)))
      .toBe(false)` and it failed roughly one run in three when the five
      worktree-creating suites ran together — an assertion failure at ~6s, not
      a timeout, so #548's clock fix could never have touched it. A guard that
      reddens at random on a branch that did not touch it is a guard a shift
      learns to ignore, and it reddened two `pnpm preflight` runs the night it
      was filed.

      It was asserting a stronger property than this platform gives. Driven
      before the assertion moved — TWO runs of a concurrent probe of
      `inWorktreeOf`, five processes then four, **120 trees in total**:
      DIRECTORY left behind **8**, REGISTRATION left behind **0**, and every
      leftover read `registered=false`. (The split was 58 trees / 4 left, then
      62 / 4.) The mechanism is visible in git's own stderr: a sibling
      `git worktree prune` unregisters a tree whose directory is still there,
      so this teardown's own `git worktree remove --force` then says *"is not
      a working tree"*, throws into the swallowing `catch`, and leaves the
      directory. The registration was gone either way.

      So the two properties genuinely come apart, and only one of them is this
      guard's business: a leaked registration breaks the next run, a leftover
      temp directory is litter. The litter is real — **7.8 GB** across 32
      `drape-rite-*` trees were standing in `%TEMP%` when this was measured —
      and it is **issue #654** rather than an assertion here, because a test
      cannot fix a teardown by failing about it.
    */
    expect(registeredWorktrees()).not.toContain(path.resolve(seen[0].cwd));
    expect(registeredWorktrees()).not.toContain(path.resolve(seen[1].cwd));
    /*
      SIXTY SECONDS, BECAUSE THE SUBJECT IS REAL GIT (#216, second finding).
      This `it()` checks out TWO detached worktrees of HEAD and tears them down.
      Alone on this bench it takes 4823ms against vitest's 5000ms default — a
      177ms margin — so it reddened the Janitor's full `pnpm test` and passed
      alone immediately after, which costs a shift a diagnosis for a red it did
      not cause. The number here is NOT that margin, though: measured inside a
      full 680-file run on 2026-08-29 the same arm took **20547ms**, so a budget
      chosen from the solo timing would have been the same bug again. 60s is the
      house figure for tree-and-git suites (`atlasMergeDriver`, `preCommitGate`,
      whose own arms reach 48.9s under that load). Making the test cheaper is
      the wrong repair: the worktree checkout IS the thing it proves.
    */
  }, 60_000);

  /*
    ⚠ THIS ARM USED TO ASSERT A THROW, AND #967 MOVED THE CONTRACT UNDER IT.

    The property it was written for is unchanged and is asserted below: a run
    that could not be made must REFUSE, never allow. What changed is the shape
    the refusal arrives in — a verdict the rite can read and narrate, instead
    of an exception that reached the rite's top level, ended the process on a
    raw stack trace, and printed no refusal line into the receipt at all.
  */
  it("a commit that cannot be checked out REFUSES, and says the commit is not the culprit", () => {
    const verdict = runScriptGuardsOnCommit(ROOT, "no-such-commit-0000", {
      suites: [ORIGIN_SUITE], vitest: () => ({ status: 0, output: "" }),
    });
    /* The load-bearing half, and the one the old `toThrow()` was really for:
       a blind run is NOT a pass, whatever the stubbed runner said. */
    expect(verdict.ok, "blind refuses, never allows").toBe(false);
    expect(verdict.couldNotRun, "the verdict must SAY it could not run").toBeTruthy();
    expect(verdict.couldNotRun).toMatch(/no-such-commit-0000|invalid reference|not a valid object/i);
  });

  it("POSITIVE CONTROL — a real finding is NOT dressed as 'could not run'", () => {
    /* Without this arm the field above could be set on every red and the rite
       would narrate every breach as a machine stumble — which is #967's own
       defect pointing the other way, and the more dangerous direction: it
       would tell a shift to re-run over a genuinely broken script. */
    const verdict = runScriptGuardsOnCommit(ROOT, "HEAD", {
      suites: [ORIGIN_SUITE],
      vitest: () => ({ status: 1, output: "FAIL server/scriptExitDiscipline.test.ts\n" }),
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.couldNotRun, "the suites RAN and found something — the commit is implicated").toBeUndefined();
    expect(verdict.printed).toContain("scriptExitDiscipline");
  });

  it("a throw from the RUNNER still propagates — it cannot borrow the commit's alibi", () => {
    /* The tree existed and the body was entered, so this is the runner or the
       teardown failing, not a run that never happened. Catching it into
       `couldNotRun` would hand the commit an alibi it has not earned. */
    expect(() => runScriptGuardsOnCommit(ROOT, "HEAD", {
      suites: [ORIGIN_SUITE],
      vitest: () => { throw new Error("the runner exploded"); },
    })).toThrow(/the runner exploded/);
  });
});

/**
 * THE RITE'S SENTENCE, READ AT ITS BYTES (#967).
 *
 * `die()` ends the process, so the only way to hold these two refusals to their
 * contract is to read the source that produces them. The property is narrow and
 * it is the whole card: the guard refusal must not assert ONE cause, because
 * twice in twenty-four hours it asserted the wrong one (#943, then #967) and
 * sent a shift after a broken script that did not exist.
 */
describe("the rite's guard refusal names what it can read, not a culprit it guessed", () => {
  const rite = gitTreeReader(ROOT).read("scripts/deploy-rite.mts");

  /* THE FLOOR: every assertion below is about one block, so a rename that moves
     the block must redden here rather than silently making the arms vacuous. */
  const block = rite.slice(rite.indexOf("runScriptGuardsOnCommit(path.resolve"));
  it("the block this suite is about is still findable", () => {
    expect(rite).toContain("runScriptGuardsOnCommit(path.resolve");
    expect(block.length).toBeGreaterThan(200);
  });

  it("refuses separately when the guards could not be RUN, and clears the commit", () => {
    expect(block).toContain("verdict.couldNotRun");
    expect(block).toMatch(/could not be RUN/);
    expect(block).toMatch(/NOTHING IN THE COMMIT IS IMPLICATED/);
  });

  it("names BOTH roads on a red, and never the one road alone", () => {
    expect(block).toMatch(/ONE OF TWO THINGS/);
    /* The superseded sentence, pinned by its own shape: a `repair:` that goes
       straight to "fix the named script" with no second road beside it. */
    const repairLine = block.slice(block.indexOf("did not PASS"));
    expect(repairLine).toContain("breached a contract");
    expect(repairLine).toMatch(/failed on the machine rather than on the commit/);
  });

  it("POSITIVE CONTROL — the assertions fail on the sentence they replaced", () => {
    const before = block
      .replace(/⚠ this is ONE OF TWO THINGS[\s\S]*?a refusal that repeats on the same commit is the first kind\."\);/,
        '  repair: fix the named script in the commit, commit, re-run");');
    expect(before).not.toEqual(block); // the sabotage landed
    expect(before).not.toMatch(/ONE OF TWO THINGS/);
  });
});
