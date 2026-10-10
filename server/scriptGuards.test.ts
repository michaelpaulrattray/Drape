import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { grepAtCommit, listScriptGuardSuites, ORIGIN_SUITE, PUSH_PATH_SUITES, runScriptGuardsOnCommit } from "../scripts/lib/scriptGuards.mts";
import { gitTreeReader } from "../scripts/lib/pushPaths.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { codeOnly } from "./testing/withoutComments";
import { makeThrowawayRepo, realRootRecipeCalls, type ThrowawayRepo, WORKTREE_RECIPE_CALLS } from "./testing/throwawayRepo";

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
const registeredWorktrees = (repo: string): string[] =>
  execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: repo, encoding: "utf8" })
    .split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => path.resolve(line.slice("worktree ".length)));

/**
 * Where this repository keeps its worktree admin entries — the COMMON git
 * directory, so the reading holds whether the suite runs in the main checkout
 * or inside a linked worktree (a shift branch always runs it in the latter,
 * and `<worktree>/.git` is a FILE there, not a directory).
 */
const worktreeAdminDir = (repo: string): string => path.join(
  path.resolve(execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repo, encoding: "utf8" }).trim()),
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
  /*
    ⚠ A ONE-FILE REPOSITORY, NOT THIS ONE (#2212). These arms handed the real
    root to the recipe and each checked out the WHOLE repository — the first of
    them twice. That checkout is 2.5 s on a quiet machine and was 29.6 s into
    `%TEMP%` on 2026-10-10, when these arms reached 55–83 s and failed a
    different few of themselves on each of five rite runs over one unchanged
    commit: the rite refused a correct tree on its own guard's stopwatch. Every
    arm here stubs the vitest it would run, so none of them asks anything about
    this repository's files; the fixture drives the same `inWorktreeOf` — real
    `worktree add --detach`, real junction, real teardown — off the shared
    registry, too, where #652's sibling-prune race lived.
  */
  let repo: ThrowawayRepo;
  let FIXTURE = "";
  beforeAll(() => { repo = makeThrowawayRepo(); FIXTURE = repo.root; }, CHILD_PROCESS_TEST_TIMEOUT_MS);
  afterAll(() => repo?.remove());

  it("runs the suites in a detached worktree of the commit, and tears it down on both arms", () => {
    const seen: { cwd: string; suites: string[]; gitdir: string }[] = [];
    const vitest = (status: number) => (cwd: string, suites: string[]) => {
      /* Read INSIDE the body, which is the only moment the tree is supposed to
         exist. Without this the absence assertion below is green on nothing —
         a runner that never made a worktree would satisfy it too. */
      seen.push({ cwd, suites, gitdir: gitdirOf(cwd) });
      return { status, output: "line 1\n\nline 2\n" };
    };
    const green = runScriptGuardsOnCommit(FIXTURE, "HEAD", { suites: [ORIGIN_SUITE], vitest: vitest(0) });
    expect(green.ok).toBe(true);
    const red = runScriptGuardsOnCommit(FIXTURE, "HEAD", { suites: [ORIGIN_SUITE], vitest: vitest(1) });
    expect(red.ok).toBe(false);
    expect(red.printed).toBe("line 1\nline 2");
    /* The runner was handed a tree that is NOT the working directory, and it
       was a real worktree of THIS repository while it ran. */
    expect(seen).toHaveLength(2);
    const adminDir = worktreeAdminDir(FIXTURE);
    for (const call of seen) {
      expect(path.resolve(call.cwd)).not.toBe(FIXTURE);
      expect(call.suites).toEqual([ORIGIN_SUITE]);
      expect(call.gitdir, "the body ran inside a real worktree of this repository")
        .toMatch(/^gitdir: \S/);
      expect(
        path.resolve(call.gitdir.replace(/^gitdir:\s*/, "")).startsWith(adminDir),
        `the tree's gitdir must sit under ${adminDir}, and it reads ${call.gitdir}`,
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

      ⚠ That last sentence is the SYMPTOM read correctly and the CAUSE read
      short (#969, driven on git 2.55): a tree whose directory AND whose own
      `.git` file are both present survives a prune. Prune resolves the
      registration through that `.git` pointer and collects it when the
      pointer does not resolve — the standing directory does not protect it.
      Nothing here changes; the numbers above were measured at the outcome,
      which is what this arm asserts.

      So the two properties genuinely come apart, and only one of them is this
      guard's business: a leaked registration breaks the next run, a leftover
      temp directory is litter. The litter is real — **7.8 GB** across 32
      `drape-rite-*` trees were standing in `%TEMP%` when this was measured —
      and it is **issue #654** rather than an assertion here, because a test
      cannot fix a teardown by failing about it.
    */
    expect(registeredWorktrees(FIXTURE)).not.toContain(path.resolve(seen[0].cwd));
    expect(registeredWorktrees(FIXTURE)).not.toContain(path.resolve(seen[1].cwd));
    /*
      THE FLOOR, NOT SIXTY SECONDS — AND THE SENTENCE THAT HELD SIXTY HERE WAS
      HALF RIGHT (#216, then #2212). It read *"making the test cheaper is the
      wrong repair: the worktree checkout IS the thing it proves."* The
      CHECKOUT is — a real `git worktree add --detach`, a real gitdir under the
      admin directory, a real teardown — and every one of those is still driven
      above. What it never proved anything about is the 3,838 files of THIS
      repository it happened to check out, and those files are where the time
      went: 4.8 s solo, 20.5 s in a full run on 2026-08-29, and past 60 s under
      the rite on 2026-10-10, where it was one of the arms that refused a
      correct tree. On the one-file fixture it is a second, so the file-level
      floor holds it with room and a genuine hang still fails.
    */
  });

  /*
    ⚠ THIS ARM USED TO ASSERT A THROW, AND #967 MOVED THE CONTRACT UNDER IT.

    The property it was written for is unchanged and is asserted below: a run
    that could not be made must REFUSE, never allow. What changed is the shape
    the refusal arrives in — a verdict the rite can read and narrate, instead
    of an exception that reached the rite's top level, ended the process on a
    raw stack trace, and printed no refusal line into the receipt at all.
  */
  it("a commit that cannot be checked out REFUSES, and says the commit is not the culprit", () => {
    const verdict = runScriptGuardsOnCommit(FIXTURE, "no-such-commit-0000", {
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
    const verdict = runScriptGuardsOnCommit(FIXTURE, "HEAD", {
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
    expect(() => runScriptGuardsOnCommit(FIXTURE, "HEAD", {
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
    /*
      ⚠ RE-ANCHORED FOR #2212, AND THIS ARM IS WHY THE RE-ANCHORING HAPPENED AT
      ALL. The anchor used to end on `a refusal that repeats on the same commit
      is the first kind.");`, which #2212 replaced with the remembered-runs
      verdict — so the sabotage matched nothing, `before` equalled `block`, and
      this control reddened on exactly the thing it exists for: an arm whose
      sabotage has gone inert looks identical to an arm that is passing. The end
      anchor is now the die call's own close after `memory.sentence`.
    */
    const before = block
      .replace(/⚠ this is ONE OF TWO THINGS[\s\S]*?memory\.sentence[\s\S]*?\);/,
        '  repair: fix the named script in the commit, commit, re-run");');
    expect(before).not.toEqual(block); // the sabotage landed
    expect(before).not.toMatch(/ONE OF TWO THINGS/);
  });
});

/**
 * NO SUITE HANDS THIS REPOSITORY'S OWN ROOT TO THE WORKTREE RECIPE (#2212).
 *
 * The class, named: an arm that checks out a worktree of the WHOLE repository
 * pays a cost set by the repository's size and by whatever is scanning
 * `%TEMP%` that minute — 2.5 s to 29.6 s for one checkout on one machine in one
 * day — and none of the arms that did it asked a question about the repository's
 * files. Under the rite five runs over one unchanged commit each failed a
 * different few of them on the stopwatch, and the push never fired. #943 sized
 * the class floor for a `tsx` child; no floor sized for that checkout would
 * stay sized.
 *
 * So the repair is the fixture (`testing/throwawayRepo.ts`), and this is what
 * keeps it: the population is every tracked server suite, read the same way
 * every time, so the next arm written beside these meets this before it meets
 * the stopwatch.
 */
describe("no suite checks out a worktree of this whole repository (#2212)", () => {
  const suites = execFileSync("git", ["ls-files", "server/*.test.ts", "server/**/*.test.ts"], { cwd: ROOT, encoding: "utf8" })
    .split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

  it("the population is real — it holds the suites that drive the recipe", () => {
    /* A reader that saw no file would pass the arm below on nothing. These
       three call the recipe today, so they must be in what is read, and must
       be seen calling it. */
    const callers = suites.filter((file) =>
      WORKTREE_RECIPE_CALLS.some((name) => new RegExp(String.raw`\b${name}\s*\(`).test(codeOnly(read(file)))));
    expect(callers).toEqual(expect.arrayContaining([
      "server/scriptGuards.test.ts", "server/typecheckOnCommit.test.ts", "server/riteWorktree.test.ts",
    ]));
  });

  it("not one of them hands the recipe the real root", () => {
    const offenders = suites.flatMap((file) => realRootRecipeCalls(read(file)).map((call) => `${file}: ${call}`));
    expect(offenders, "check out a makeThrowawayRepo() instead — see testing/throwawayRepo.ts").toEqual([]);
  });

  it("NEGATIVE CONTROL — the reader finds the shape in each spelling it claims", () => {
    expect(realRootRecipeCalls('const ROOT = path.resolve(import.meta.dirname, "..");\ninWorktreeOf(ROOT, "HEAD", body);'))
      .toHaveLength(1);
    expect(realRootRecipeCalls("const repoRoot = path.resolve(__dirname, '../..');\nrunTypecheckOnCommit( repoRoot, sha);"))
      .toHaveLength(1);
    expect(realRootRecipeCalls('runScriptGuardsOnCommit(path.resolve(import.meta.dirname, ".."), sha)')).toHaveLength(1);
  });

  it("POSITIVE CONTROL — a fixture root, and the real root used for anything else, are not findings", () => {
    expect(realRootRecipeCalls('const ROOT = path.resolve(import.meta.dirname, "..");\n'
      + "listScriptGuardSuites(ROOT);\nrunScriptGuardsOnCommit(FIXTURE, \"HEAD\", {});\ninWorktreeOf(repo.root, sha, body);"))
      .toEqual([]);
    /* A ROOT that starts with the same letters is a different identifier. */
    expect(realRootRecipeCalls('const ROOT = path.resolve(__dirname, "..");\ninWorktreeOf(ROOT_FIXTURE, "HEAD", body);'))
      .toEqual([]);
  });
});
