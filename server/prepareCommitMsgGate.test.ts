import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { runHook } from "./testing/hookDriver";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * ARM 1B — THE ROADS `pre-commit` NEVER SEES, DRIVEN (#611).
 *
 * `.githooks/pre-commit` ARM 1 refuses a commit made in the MAIN working tree
 * while HEAD is a `team/*` branch (R3: the founder's interactive sessions and
 * the night shift share one working directory, and a commit made there on a
 * shift branch has swept up another seat's work more than once). PR #610
 * measured that git does not run that hook at all on `git revert`, `git
 * cherry-pick` or a REPLAYED rebase commit — so ARM 1 is absent on exactly the
 * road deploy-on-merge makes shifts walk on purpose, since every rollback
 * proof is a revert.
 *
 * ⚠ TWO OF THIS CARD'S OWN CONCLUSIONS ARE OVERTURNED HERE, BY MEASUREMENT
 * RATHER THAN BY ARGUMENT, AND BOTH ARE PINNED AS ARMS SO THEY STAY CHECKABLE.
 *
 *   1. #611 recommended a `post-checkout` arm. `post-checkout` CANNOT REFUSE —
 *      it exits 1 and the branch switches anyway, because git documents its
 *      exit code as ignored. That is the same property the card correctly used
 *      to rule out `post-commit`. The last arm in this file drives it.
 *
 *   2. #611 ruled `prepare-commit-msg` out. Its objection was measured on a
 *      hook that WRITES AND STAGES A FILE (#610: the staged file is dropped in
 *      a revert) — a REFUSAL has no such problem, and it covers all four
 *      commit roads including the replayed rebase.
 *
 * ⚠ AND THE FIRST BUILD OF THIS ARM WAS A `reference-transaction` HOOK, WHICH
 * WAS DISCARDED ON COST AFTER IT WAS WORKING. It covers the same four roads,
 * but it fires on every ref update in the repository: measured at SEVEN
 * invocations per commit and FOURTEEN per checkout, ~+137 ms on every commit,
 * checkout, fetch, reset and stash in the founder's own shared tree. This hook
 * is ONE invocation per commit and ZERO on checkout and fetch. Recorded here
 * because "we tried the more thorough thing and it was too expensive" is the
 * kind of finding that otherwise has to be rediscovered.
 *
 * ⚠ THE VERDICT IS ALWAYS READ AT THE BRANCH REF, NEVER AT HEAD. A rebase
 * replays onto a DETACHED HEAD, so mid-rebase HEAD legitimately sits elsewhere
 * whether or not anything landed. Reading HEAD is what made the first pass of
 * this work report `prepare-commit-msg` as unable to stop a rebase, which is
 * the opposite of the truth and would have shipped the expensive hook.
 */

const HOOKS_DIR = resolve(".githooks");
const HOOK = join(HOOKS_DIR, "prepare-commit-msg");
const SHARED = join(HOOKS_DIR, "shift-branch-guard");

function gitIn(hooks: string, cwd: string, ...args: string[]) {
  return runHook(
    "git",
    [
      "-c",
      `core.hooksPath=${hooks}`,
      "-c",
      "user.name=gate",
      "-c",
      "user.email=gate@example.invalid",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd },
  );
}

/** The repository's real hooks — every arm about a road runs through these. */
const git = (cwd: string, ...args: string[]) => gitIn(HOOKS_DIR, cwd, ...args);

/**
 * The same call with the hooks path pointed at nothing, for BUILDING fixtures
 * and READING state. A fixture assembled by the gate under test cannot be
 * trusted to be what it claims, and a `rev-parse` the gate could refuse would
 * make every "did the commit land" reading a second opinion from the thing
 * being measured.
 */
const plainGit = (cwd: string, ...args: string[]) => gitIn("/drape-no-hooks-here", cwd, ...args);

/**
 * Make a hook file runnable, on every platform this suite runs on.
 *
 * ⚠ GIT SILENTLY IGNORES A HOOK WITHOUT THE EXECUTABLE BIT — it says so in a
 * `hint:` and carries on as if the hook did not exist. Windows sets
 * `core.filemode=false` so a hook runs regardless, which means a fixture
 * missing this passes locally and measures NOTHING on ubuntu. That is the same
 * defect this file's own index-mode arm exists to catch in `.githooks`, and it
 * arrived here first as a fixture bug — caught by the gate, on the very arm
 * whose whole job is to establish what a hook can and cannot do.
 */
function installable(file: string) {
  chmodSync(file, 0o755);
}

const repos: string[] = [];
afterAll(() => {
  for (const dir of repos) rmSync(dir, { recursive: true, force: true });
});

/**
 * A repository with three commits on `main` and a `side` branch carrying one
 * commit of its own, so a revert, a cherry-pick and a rebase replay all have
 * something real to work with.
 */
function freshRepo(prefix = "drape-pcm-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  repos.push(dir);
  plainGit(dir, "init", "-q", "-b", "main");
  writeFileSync(join(dir, "README.md"), "seed\n");
  plainGit(dir, "add", "README.md");
  if (plainGit(dir, "commit", "-q", "-m", "seed").status !== 0) throw new Error("seed commit failed");
  writeFileSync(join(dir, "second.txt"), "second\n");
  plainGit(dir, "add", "second.txt");
  plainGit(dir, "commit", "-q", "-m", "second");
  plainGit(dir, "checkout", "-q", "-b", "side");
  writeFileSync(join(dir, "side.txt"), "side\n");
  plainGit(dir, "add", "side.txt");
  plainGit(dir, "commit", "-q", "-m", "side work");
  plainGit(dir, "checkout", "-q", "main");
  writeFileSync(join(dir, "third.txt"), "third\n");
  plainGit(dir, "add", "third.txt");
  plainGit(dir, "commit", "-q", "-m", "third");
  return dir;
}

const tipOf = (dir: string, ref: string) => plainGit(dir, "rev-parse", ref).stdout.trim();
const branchOf = (dir: string) => plainGit(dir, "branch", "--show-current").stdout.trim();

describe("the prepare-commit-msg gate", { timeout: 180_000 }, () => {
  beforeAll(() => {
    expect(existsSync(HOOK), "the hook must exist to be driven").toBe(true);
    expect(existsSync(SHARED), "the sourced condition must exist").toBe(true);
    /* A CRLF shebang is a hook `sh` cannot run. `.githooks/**` is pinned LF in
       .gitattributes; this pins the bytes actually on disk. */
    expect(readFileSync(HOOK, "utf8")).not.toContain("\r");
    expect(readFileSync(SHARED, "utf8")).not.toContain("\r");
  });

  it("is executable IN THE INDEX, or a Linux clone silently never runs it", () => {
    /* The failure `preCommitGate` found on the gate (run 32912700673): a hook
       authored on Windows lands mode 100644, ubuntu's git skips it, and every
       refusal arm passes the commit. Windows runs a non-executable hook anyway
       (core.filemode=false), so the index mode is the only reading that is
       true on every machine that clones this. */
    const listing = execFileSync("git", ["ls-files", "-s", "--", ".githooks"], { encoding: "utf8" });
    const named = listing
      .trim()
      .split("\n")
      .filter((row) => /prepare-commit-msg|shift-branch-guard/.test(row));
    expect(named.length, "both new files must be tracked").toBe(2);
    for (const row of named) {
      expect(row, `${row} — fix with: git update-index --chmod=+x <path>`).toMatch(/^100755 /);
    }
  });

  describe("the roads git skips pre-commit on", () => {
    /* THE POSITIVE CONTROL THE CARD NAMES, both halves: "a git revert on a
       team/* branch in the main tree must be refused — and the same revert
       inside a linked worktree must NOT be." */
    it("REFUSES a revert onto a team/* branch in the main tree, and nothing lands", () => {
      const dir = freshRepo();
      plainGit(dir, "checkout", "-q", "-b", "team/611-revert");
      const before = tipOf(dir, "team/611-revert");
      const result = git(dir, "revert", "--no-edit", "HEAD");
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("MAIN working tree");
      expect(result.stderr).toContain("team/611-revert");
      /* ⚠ THE EXIT CODE ALONE IS NOT THE VERDICT — `post-checkout` exits 1 and
         its act happens anyway. What settles it is that no commit was made. */
      expect(tipOf(dir, "team/611-revert"), "the revert must not have committed").toBe(before);

      /* ⚠ WHY THE MESSAGE DOES NOT NAME `git revert --abort`, PINNED (round 2,
         finding 3 — and the arm went RED before this comment existed, which is
         the point). A refused revert leaves NO sequencer state, only its
         staged change, so that command errors with "no revert in progress" on
         the commonest road of the lot. It WAS in the refusal's escape list
         until this arm was written for it.

         A promise in a message is a claim like any other; this is the arm that
         keeps the corrected list honest, on the #649 pattern — if git ever
         starts leaving revert state here, this reddens and the message can
         gain the line back. */
      const aborted = git(dir, "revert", "--abort");
      expect(
        aborted.status,
        "a refused revert leaves nothing to abort — if this passes, the message may name it again",
      ).not.toBe(0);
      /* The revert of the tip commit stages the undo of it — here a deletion
         of `third.txt`. What matters is that SOMETHING is left staged, which
         is why `git checkout main` needed the force below and why the old
         "never refused" promise was an overstatement. */
      expect(
        plainGit(dir, "status", "--porcelain").stdout.trim(),
        "the revert's change is left staged",
      ).not.toBe("");
      /* `git checkout main` is the escape on this road, and it is what the
         message names. Driven, because the previous version of that sentence
         promised an exit it could not always deliver. */
      expect(git(dir, "checkout", "-f", "main").status).toBe(0);
      expect(branchOf(dir)).toBe("main");
    });

    it("REFUSES a cherry-pick onto a team/* branch in the main tree", () => {
      const dir = freshRepo();
      plainGit(dir, "checkout", "-q", "-b", "team/611-pick");
      const before = tipOf(dir, "team/611-pick");
      const result = git(dir, "cherry-pick", "side");
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("MAIN working tree");
      expect(tipOf(dir, "team/611-pick"), "the cherry-pick must not have committed").toBe(before);

      /* The same promise on this road — a refused cherry-pick leaves
         CHERRY_PICK_HEAD and a staged change behind, so `git checkout main` is
         not the answer and the abort the message names has to work. */
      const aborted = git(dir, "cherry-pick", "--abort");
      expect(aborted.status, `git cherry-pick --abort must work: ${aborted.stderr}`).toBe(0);
      expect(tipOf(dir, "HEAD")).toBe(before);
      expect(plainGit(dir, "status", "--porcelain").stdout.trim(), "and it must leave a clean tree").toBe("");
    });

    it("REFUSES a replayed rebase commit — HEAD is DETACHED there, so the branch is read from git's state file", () => {
      /* The road that decides the shape of the hook. `git symbolic-ref HEAD`
         returns nothing mid-replay, and "no branch" is a state ARM 1
         deliberately allows — so a backstop that only asked HEAD would pass
         every rebase straight through while looking correct. */
      const dir = freshRepo();
      plainGit(dir, "checkout", "-q", "-b", "team/611-rebase");
      const before = tipOf(dir, "team/611-rebase");
      const result = git(dir, "rebase", "--onto", "HEAD~2", "HEAD~1", "team/611-rebase");
      expect(result.status).not.toBe(0);
      expect(
        tipOf(dir, "team/611-rebase"),
        "no commit may be replayed onto the shift branch",
      ).toBe(before);
      plainGit(dir, "rebase", "--abort");
    });

    it("lets the refused rebase be ABORTED — a guard you cannot back out of is a trap", () => {
      /* The refusal stops the replay mid-rebase, which leaves rebase state on
         disk naming a `team/*` head. A coarser arm would refuse the very
         command that clears it and strand whoever tripped the guard. The
         hook's own message promises this works; this is what makes the promise
         checkable rather than a sentence. */
      const dir = freshRepo();
      plainGit(dir, "checkout", "-q", "-b", "team/611-abort");
      const before = tipOf(dir, "team/611-abort");
      expect(git(dir, "rebase", "--onto", "HEAD~2", "HEAD~1", "team/611-abort").status).not.toBe(0);
      const aborted = git(dir, "rebase", "--abort");
      expect(aborted.status, aborted.stderr).toBe(0);
      expect(branchOf(dir), "the abort must put him back on his branch").toBe("team/611-abort");
      expect(tipOf(dir, "HEAD"), "and back at the commit he started from").toBe(before);
    });

    it("REFUSES a merge onto a team/* branch — the fifth road, and the header did not name it", () => {
      /* ⚠ FOUND BY REVIEW AND DRIVEN BEFORE IT WAS BELIEVED (round 2, finding
         1). `git merge` runs this hook, so `git merge main` on a shift branch
         in the main tree — the one command CLAUDE.md prescribes for unsticking
         a conflicting PR — is refused. The refusal is the guard working; what
         was wrong was a header presenting its table as the complete
         measurement while missing a road. */
      const dir = freshRepo();
      plainGit(dir, "checkout", "-q", "-b", "team/611-merge");
      const before = tipOf(dir, "team/611-merge");
      const result = git(dir, "merge", "--no-edit", "side");
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("MAIN working tree");
      expect(tipOf(dir, "team/611-merge"), "no merge commit may land").toBe(before);

      /* And the escape the message names for this road actually works — a
         refused merge leaves MERGE_HEAD behind, so `git checkout main` alone
         is not the answer. */
      const aborted = git(dir, "merge", "--abort");
      expect(aborted.status, aborted.stderr).toBe(0);
      expect(tipOf(dir, "HEAD")).toBe(before);
    });

    it("REFUSES `git commit --no-verify` — it skips pre-commit and NOT this hook", () => {
      /* ⚠ THE HEADER CLAIMED THE OPPOSITE UNTIL ROUND 2 OF THE REVIEW. Git's
         githooks documentation: prepare-commit-msg "is not suppressed by the
         --no-verify option". The error was in the safe direction — coverage is
         stronger than was claimed — but it was a false sentence in a header
         whose authority is that it was measured, so the corrected claim is
         pinned here rather than merely rewritten. */
      const dir = freshRepo();
      plainGit(dir, "checkout", "-q", "-b", "team/611-noverify");
      const before = tipOf(dir, "team/611-noverify");
      writeFileSync(join(dir, "bypass.txt"), "x\n");
      plainGit(dir, "add", "bypass.txt");
      const result = git(dir, "commit", "--no-verify", "-m", "bypass");
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("MAIN working tree");
      expect(tipOf(dir, "team/611-noverify"), "--no-verify must not get a commit through").toBe(before);
    });

    it("REFUSES an ordinary commit ON ITS OWN — with pre-commit not installed at all", () => {
      /* ⚠ WITHOUT THIS ISOLATION THE ARM WOULD BE TESTING ARM 1. Both hooks
         fire on an ordinary commit and `pre-commit` runs first, so a refusal
         through the real hooks directory says nothing about this file. Here
         only ARM 1B and the condition it sources are installed. */
      const dir = freshRepo();
      const solo = join(dir, "solo-hooks");
      mkdirSync(solo, { recursive: true });
      copyFileSync(HOOK, join(solo, "prepare-commit-msg"));
      copyFileSync(SHARED, join(solo, "shift-branch-guard"));
      /* Set explicitly rather than trusting what `copyFileSync` carries over —
         see `installable`: a hook without this is ignored on Linux and the arm
         then proves nothing while passing. */
      installable(join(solo, "prepare-commit-msg"));

      plainGit(dir, "checkout", "-q", "-b", "team/611-solo");
      const before = tipOf(dir, "team/611-solo");
      writeFileSync(join(dir, "work.txt"), "shift work\n");
      plainGit(dir, "add", "work.txt");
      const result = gitIn(solo, dir, "commit", "-q", "-m", "shift work");
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("MAIN working tree");
      expect(tipOf(dir, "team/611-solo")).toBe(before);
    });
  });

  describe("the roads it must never touch", () => {
    it("allows the same revert inside a LINKED worktree — the card's other half", () => {
      const dir = freshRepo();
      const wt = `${dir}-wt`;
      repos.push(wt);
      expect(plainGit(dir, "worktree", "add", "-q", wt, "-b", "team/611-in-worktree").status).toBe(0);
      const before = tipOf(wt, "team/611-in-worktree");
      const result = git(wt, "revert", "--no-edit", "HEAD");
      expect(result.status, result.stderr).toBe(0);
      expect(tipOf(wt, "team/611-in-worktree"), "the revert must actually have committed").not.toBe(
        before,
      );
    });

    it("leaves main, census/* and a detached HEAD in the main tree alone", () => {
      /* The negative control ARM 1 already carries, re-driven here because
         this hook reads the branch a different way and could widen it. The
         detached case is the one that matters: this hook has a second road to
         a branch name, and it must not invent one where there is none. */
      const dir = freshRepo();
      writeFileSync(join(dir, "on-main.txt"), "fine\n");
      git(dir, "add", "on-main.txt");
      expect(git(dir, "commit", "-q", "-m", "on main").status).toBe(0);

      git(dir, "checkout", "-q", "-b", "census/full-map");
      writeFileSync(join(dir, "on-census.txt"), "fine\n");
      git(dir, "add", "on-census.txt");
      expect(git(dir, "commit", "-q", "-m", "on census").status).toBe(0);

      git(dir, "checkout", "-q", "--detach");
      writeFileSync(join(dir, "detached.txt"), "fine\n");
      git(dir, "add", "detached.txt");
      expect(git(dir, "commit", "-q", "-m", "detached").status).toBe(0);
    });

    it("allows a rebase of a NON-shift branch — the state file is read, not just noticed", () => {
      /* If the rebase road were wired as "a rebase is in progress" rather than
         "a rebase onto a team/* branch", this would be refused and every
         ordinary rebase in the repository would stop working. */
      const dir = freshRepo();
      plainGit(dir, "checkout", "-q", "-b", "census/rebased");
      const result = git(dir, "rebase", "--onto", "HEAD~2", "HEAD~1", "census/rebased");
      expect(result.status, result.stderr).toBe(0);
      plainGit(dir, "rebase", "--abort");
    });
  });

  describe("the declared gap, and the two conclusions this overturned", () => {
    it("`git am` is NOT covered — the gap the hook's header declares, pinned so it cannot change silently", () => {
      /* ⚠ AN ARM THAT ASSERTS A HOLE, on the pattern #649 settled: a gap
         written down and enforced cannot outlive the reason for it. `git am`
         runs the `applypatch` hooks and not this one, so a mailed patch
         applied onto a shift branch in the main tree commits through. It is
         left because no road in this repository walks `git am` — it appears in
         no script, no rite and no standing order — and closing it means the
         `reference-transaction` hook whose cost is recorded above.

         If this arm ever reddens, `git am` has become covered (or has stopped
         being a road), and the hook's header must be corrected in the same
         edit. */
      const dir = freshRepo();
      plainGit(dir, "checkout", "-q", "side");
      const patches = join(dir, "patches");
      expect(plainGit(dir, "format-patch", "-1", "-o", patches).status).toBe(0);
      const patch = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "patches"], {
        cwd: dir,
        encoding: "utf8",
      })
        .trim()
        .split("\n")[0];
      expect(patch, "a patch file must have been written to apply").toBeTruthy();

      plainGit(dir, "checkout", "-q", "main");
      plainGit(dir, "checkout", "-q", "-b", "team/611-am");
      const before = tipOf(dir, "team/611-am");
      const applied = git(dir, "am", join(dir, patch));
      expect(applied.status, "git am runs applypatch-msg, not prepare-commit-msg").toBe(0);
      expect(
        tipOf(dir, "team/611-am"),
        "the declared gap: git am commits through. If this now holds, close the gap in the header too.",
      ).not.toBe(before);
      plainGit(dir, "am", "--abort");
    });

    it("post-checkout CANNOT refuse — the card's own recommendation, measured not argued", () => {
      /* #611's recommendation was a `post-checkout` arm, on the sound
         reasoning that the condition is a STATE and so can be refused before
         the road starts. The reasoning is right and the hook cannot act on it.
         Kept in the suite so the header's table is a thing somebody can
         re-run, rather than a claim about git that ages silently. */
      const dir = freshRepo();
      const solo = join(dir, "post-checkout-hooks");
      mkdirSync(solo, { recursive: true });
      /* ⚠ THIS FIXTURE WITHOUT ITS chmod IS HOW THIS ARM LIED ON THE GATE.
         Git ignored the hook (`hint: … was ignored because it's not set as
         executable`), the branch switched because NOTHING ran, and the arm
         reported "post-checkout cannot refuse" over a measurement it had not
         made. On Windows it ran anyway and the arm passed. */
      writeFileSync(join(solo, "post-checkout"), "#!/bin/sh\necho REFUSED-BY-post-checkout >&2\nexit 1\n");
      installable(join(solo, "post-checkout"));

      plainGit(dir, "branch", "team/611-postcheckout");
      const result = gitIn(solo, dir, "checkout", "team/611-postcheckout");

      /* ⚠ THE EXIT CODE IS NOT ASSERTED, AND THE GATE IS WHY. This arm first
         read `expect(status).not.toBe(0)` and passed on Windows and FAILED on
         ubuntu, where git reports 0 after a failing `post-checkout`. That
         difference is not the finding — it is a distraction from it. On BOTH
         platforms the hook exited 1 and the branch switched regardless, which
         is the whole claim: `post-checkout` cannot refuse. Asserting the code
         would have made a cross-platform quirk look like the subject. */
      expect(
        branchOf(dir),
        "the branch switched even though post-checkout exited 1 — it cannot refuse",
      ).toBe("team/611-postcheckout");
      expect(result.stderr, "and the hook really did run and object").toContain(
        "REFUSED-BY-post-checkout",
      );
    });
  });

  describe("the shared condition — one rule, two readers", () => {
    it("BOTH hooks stop refusing when the sourced condition is broken", () => {
      /* ⚠ THE ARM THAT MAKES THE COLLAPSE HONEST. `.githooks/pre-commit` ARM 1
         and this hook now read `drape_in_main_working_tree` out of
         `shift-branch-guard` instead of each carrying a copy of it. Collapsing
         a mirror is only better than the mirror if something proves both call
         sites actually go THROUGH the helper — otherwise it is a refactor that
         quietly left one behind, and the copy left behind is the one that
         drifts. So the helper is sabotaged to answer "no" and BOTH roads are
         re-driven on one repository: an ordinary commit (pre-commit's road,
         which this hook alone also refuses) and a revert (only this hook's). */
      /* ⚠ THE SABOTAGE IS ON A COPY, AND THE REAL `.githooks` IS NEVER
         TOUCHED (PR #671 review, finding 2). The first version of this arm
         rewrote the tracked `shift-branch-guard` on disk and restored it in a
         `finally`, which fails two ways:

         — `pnpm test` is `vitest run` with file parallelism, and
           `preCommitGate.test.ts`'s own refusal arm drives the real `.githooks`
           in another worker. Landing inside the window makes ARM 1 allow a
           commit, and a suite this change never touched goes red as a flake
           that reads like a guard failure.
         — worse, `finally` survives a thrown expectation but NOT a killed
           worker. A run that dies inside the window leaves the R3 guard
           permanently answering "not the main tree" — ARM 1 and ARM 1B both
           dead, no failing test, no error, in the founder's shared tree. That
           is the path-three death this repository's working law 7 is about,
           manufactured by the suite whose job is to prevent it.

         The whole hooks directory is copied so nothing is missed —
         `pre-commit` sources `atlas-regenerate` and calls `atlas-stage`, which
         sources `atlas-paths` — and every sourcing is `$(dirname "$0")`
         relative, so the copied call sites go through the COPIED helper. That
         is what makes the copy a faithful test of the real wiring. */
      const solo = mkdtempSync(join(tmpdir(), "drape-sabotage-hooks-"));
      repos.push(solo);
      for (const name of readdirSync(HOOKS_DIR)) {
        copyFileSync(join(HOOKS_DIR, name), join(solo, name));
        installable(join(solo, name));
      }
      const copied = join(solo, "shift-branch-guard");
      const original = readFileSync(copied, "utf8");
      expect(original, "the copy must be the real helper").toContain("drape_in_main_working_tree() {");

      const dir = freshRepo();
      plainGit(dir, "checkout", "-q", "-b", "team/611-shared");

      /* The control FIRST, on the untouched copy: without it the two
         expectations below are equally satisfied by a copy that is simply
         broken, and the arm would pass while proving nothing. */
      expect(
        gitIn(solo, dir, "revert", "--no-edit", "HEAD").status,
        "unsabotaged, the copied hooks must still refuse",
      ).not.toBe(0);
      plainGit(dir, "revert", "--quit");

      writeFileSync(
        copied,
        original.replace(
          "drape_in_main_working_tree() {",
          "drape_in_main_working_tree() {\n  return 1",
        ),
      );

      writeFileSync(join(dir, "sab.txt"), "x\n");
      gitIn(solo, dir, "add", "sab.txt");
      expect(
        gitIn(solo, dir, "commit", "-q", "-m", "sabotaged").status,
        "pre-commit ARM 1 must read the shared condition",
      ).toBe(0);
      expect(
        gitIn(solo, dir, "revert", "--no-edit", "HEAD").status,
        "the prepare-commit-msg arm must read the same one",
      ).toBe(0);

      /* And the real file was never in play — stated as an assertion rather
         than as a promise in the comment above. */
      expect(readFileSync(SHARED, "utf8"), "the tracked helper must be untouched").toContain(
        "drape_in_main_working_tree() {",
      );
      expect(readFileSync(SHARED, "utf8")).not.toContain("drape_in_main_working_tree() {\n  return 1");
    });
  });
});
