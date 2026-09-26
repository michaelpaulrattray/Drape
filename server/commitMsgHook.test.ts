import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  existsSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

import { requireShell, runHook } from "./testing/hookDriver";
import { readListedSource } from "./testing/listedSource";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * `.githooks/commit-msg` — A CLOSING KEYWORD REFUSED WHILE THE COMMIT DOES NOT
 * YET EXIST (#1430, Retro run 5's R13).
 *
 * #376's rule is written down in the card, in `PROGRAM.md` and in the standing
 * orders, and was breached SIX times in eight days by shifts carrying all three
 * — the most-hit gate rejection of that window. The defect is WHERE the readers
 * sat: the gate reads a pull request's title and body, the merge tool reads
 * title, body AND commit messages, and **nothing at all read a commit message
 * before the commit existed.** So a keyword living only in a commit message
 * passed the gate green and was caught at the squash, where the repair is a new
 * branch, because a pushed commit message cannot be fixed without a force push.
 * One instance cost four pull requests for one word (#1347 → #1353 → #1354 →
 * #1355) and collided with a hand review already posted on the head it closed.
 *
 * # WHAT EACH GROUP HERE PROVES, AND WHAT IT CANNOT
 *
 * 1. **The hook's own verdict, driven on the real file** — the real
 *    `.githooks/commit-msg`, run by `sh`, on the real offending text from
 *    #1347. This is the refusal, the pass, the exit codes and the guidance.
 * 2. **WHICH ROADS GIT FIRES IT ON, driven — one scratch repository per road.**
 *    `CLAUDE.md`'s #606 paragraph measured that `pre-commit` is skipped by
 *    `git revert`, `git cherry-pick` and a replayed rebase commit;
 *    `commit-msg` had never been measured here, and a hook covering some roads
 *    and silently missing others "reads as coverage". These arms use a STUB
 *    hook, so they answer *"does git invoke a `commit-msg` hook on this road"*
 *    and nothing about the checker — which is the only question a road table
 *    asks, and it keeps them fast enough to run every one.
 * 3. **The header's claims are the arms' subject, not their decoration.** The
 *    road table is written into that hook's header; these arms are what stop it
 *    becoming a sentence nobody re-drove after a git upgrade.
 *
 * ⚠ The two groups deliberately do not overlap. Group 1 cannot say git runs the
 * hook; group 2 cannot say the hook is right. Neither claims the other's ground.
 */

const ROOT = process.cwd();
const HOOK = resolve(ROOT, ".githooks/commit-msg");
const repos: string[] = [];

afterAll(() => {
  for (const dir of repos) rmSync(dir, { recursive: true, force: true });
});

/* ── group 1: the real hook's own verdict ──────────────────────────────────── */

function driveRealHook(message: string): { status: number; stdout: string; stderr: string } {
  const dir = mkdtempSync(join(tmpdir(), "drape-1430-msg-"));
  repos.push(dir);
  const file = join(dir, "COMMIT_EDITMSG");
  writeFileSync(file, message, { encoding: "utf8" });
  return runHook(requireShell(), [HOOK, file], { cwd: ROOT });
}

describe("the hook's verdict on a message (#1430)", () => {
  it("REFUSES the real offending text from #1347, naming the line", () => {
    const run = driveRealHook("fix(casting): the Try again row\n\nCloses #1347\n");
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("Closes #1347");
    /* The repair, not only the refusal — a gate that says no without saying what
       to write instead is the thing shifts route around. */
    expect(run.stdout).toContain("Card: #N");
  });

  it("PASSES the house-style replacement, with the word `closes` in prose", () => {
    /*
      ⚠ THE ARM THAT KEEPS THE HOOK USABLE. A checker that refused ordinary
      English containing "closes" would be edited out of the hooks directory
      within a week, and `closingKeyword.mts`'s own header says so. The keyword
      must immediately precede a reference; here it does not.
    */
    const run = driveRealHook("fix(casting): the Try again row\n\nCard: #1347 — closes the gap in the row\n");
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("closing keyword: none");
  });

  it("REFUSES every one of GitHub's nine keywords, not only `Closes`", () => {
    /* The pattern is `closingKeyword.mts`'s and is proven there; this is the arm
       that says THIS hook reaches it, rather than a narrower copy of it. */
    for (const keyword of ["Fixes", "Resolved", "close"]) {
      const run = driveRealHook(`chore: a thing\n\n${keyword} #1347\n`);
      expect(run.status, `${keyword} #1347 was not refused`).toBe(1);
    }
  });

  it("PASSES a message with no card reference at all", () => {
    const run = driveRealHook("chore(retro): patrol #5 addendum\n");
    expect(run.status).toBe(0);
  });

  it("SKIPS out loud, rather than passing silently, when the checker is not beside it", () => {
    /*
      A tree without the checker is not a commit to refuse. But a skip that
      printed nothing would read exactly like a check that passed, which is the
      green-over-nothing shape invariant 7 exists for — so the hook says which
      of the two happened, and this arm holds it to that.
    */
    const solo = mkdtempSync(join(tmpdir(), "drape-1430-solohook-"));
    repos.push(solo);
    const hooks = join(solo, ".githooks");
    mkdirSync(hooks);
    const copied = join(hooks, "commit-msg");
    writeFileSync(copied, readFileSync(HOOK, "utf8"), { encoding: "utf8" });
    chmodSync(copied, 0o755);
    const file = join(solo, "COMMIT_EDITMSG");
    writeFileSync(file, "chore: a thing\n\nCloses #1347\n", { encoding: "utf8" });

    const run = runHook(requireShell(), [copied, file], { cwd: solo });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("SKIPPED, not passed");
  });

  it("resolves its checker relative to ITSELF, not to the caller's repository", () => {
    /*
      ⚠ THIS ARM'S FIRST DRAFT COULD NOT ASK THE QUESTION. It stood in a bare
      temporary directory, where `git rev-parse --show-toplevel` FAILS — so the
      sabotage that swapped the self-relative resolution for that command fell
      through to its own fallback and refused correctly anyway: seventeen arms
      green over a hook reading the wrong root.

      The subject has to be a DIFFERENT repository, which is also the real
      hazard. The hook belongs to the tree it ships in; `--show-toplevel` answers
      for whatever tree the caller is standing in, and in a tree with no
      `scripts/check-closing-keyword.mts` the hook would announce a SKIP and let
      the keyword straight through.
    */
    const elsewhere = mkdtempSync(join(tmpdir(), "drape-1430-elsewhere-"));
    repos.push(elsewhere);
    if (plainGit(elsewhere, "init", "-q", "-b", "main").status !== 0) {
      throw new Error("could not make the other repository — this arm cannot ask its question");
    }
    expect(
      existsSync(join(elsewhere, "scripts", "check-closing-keyword.mts")),
      "the other repository must NOT hold the checker, or this arm proves nothing",
    ).toBe(false);

    const file = join(elsewhere, "COMMIT_EDITMSG");
    writeFileSync(file, "chore: a thing\n\nCloses #1347\n", { encoding: "utf8" });

    const run = runHook(requireShell(), [HOOK, file], { cwd: elsewhere });
    expect(run.stdout, "the hook looked for its checker in the caller's tree")
      .not.toContain("SKIPPED, not passed");
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("Closes #1347");
  });
});

/* ── group 2: which roads git fires a `commit-msg` hook on ─────────────────── */

type Road = {
  /** The road, named as the header names it. */
  name: string;
  /** Whether git runs `commit-msg` on it, as measured on git 2.55. */
  firesCommitMsg: boolean;
  walk: (repo: string) => void;
};

/**
 * git, through the shared driver.
 *
 * ⚠ ON `runHook` RATHER THAN `execFileSync`, AND THE TREE'S OWN GUARD IS WHY.
 * The first draft wrapped `execFileSync` and returned `{ status: e.status ?? -1 }`
 * on failure — which is the exact shape `server/testing/hookDriver.ts` was written
 * to end: `-1` is not an exit code, it is the driver saying "I have no answer"
 * dressed as one. `server/testing/hookDriver.test.ts`'s derived population caught
 * this file the first time the full suite ran it, which is the guard earning its
 * keep on the day a new suite was added.
 */
function plainGit(repo: string, ...args: string[]): { status: number; stdout: string; stderr: string } {
  return runHook("git", ["-C", repo, ...args], {
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "road", GIT_AUTHOR_EMAIL: "road@example.invalid",
      GIT_COMMITTER_NAME: "road", GIT_COMMITTER_EMAIL: "road@example.invalid",
      GIT_EDITOR: "true",
    },
  });
}

/**
 * A repository whose `commit-msg` and `pre-commit` hooks each append their own
 * name to a witness file. The seed commit is made with `--no-verify`, so the
 * witness holds only what the road under test fired.
 */
function roadRepo(): { repo: string; fired: () => string[] } {
  const repo = mkdtempSync(join(tmpdir(), "drape-1430-road-"));
  repos.push(repo);
  const hooks = join(repo, ".hooks");
  mkdirSync(hooks);
  const witness = join(repo, "witness.txt").split("\\").join("/");
  for (const hook of ["pre-commit", "commit-msg"] as const) {
    const path = join(hooks, hook);
    writeFileSync(path, `#!/bin/sh\nprintf '%s\\n' "${hook}" >> "${witness}"\nexit 0\n`, { encoding: "utf8" });
    chmodSync(path, 0o755);
  }
  plainGit(repo, "init", "-q", "-b", "main");
  plainGit(repo, "config", "core.hooksPath", ".hooks");
  plainGit(repo, "config", "commit.gpgsign", "false");
  writeFileSync(join(repo, "a.txt"), "one\n");
  plainGit(repo, "add", "a.txt");
  if (plainGit(repo, "commit", "-q", "--no-verify", "-m", "base").status !== 0) {
    throw new Error("the seed commit failed — this repository cannot answer anything");
  }
  return {
    repo,
    fired: () => {
      const path = join(repo, "witness.txt");
      if (!existsSync(path)) return [];
      return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
    },
  };
}

const ROADS: Road[] = [
  {
    name: "git commit",
    firesCommitMsg: true,
    walk: (repo) => {
      writeFileSync(join(repo, "a.txt"), "two\n");
      plainGit(repo, "add", "a.txt");
      plainGit(repo, "commit", "-q", "-m", "ordinary");
    },
  },
  {
    name: "git commit --amend",
    firesCommitMsg: true,
    walk: (repo) => {
      writeFileSync(join(repo, "a.txt"), "two\n");
      plainGit(repo, "add", "a.txt");
      plainGit(repo, "commit", "-q", "--no-verify", "-m", "to amend");
      plainGit(repo, "commit", "-q", "--amend", "-m", "amended");
    },
  },
  {
    /* The road `pre-commit` misses and this one catches — `pre-merge-commit`
       covers the other hook's job here, and nothing covered the message. */
    name: "git merge (a real merge commit)",
    firesCommitMsg: true,
    walk: (repo) => {
      plainGit(repo, "checkout", "-q", "-b", "side");
      writeFileSync(join(repo, "b.txt"), "side\n");
      plainGit(repo, "add", "b.txt");
      plainGit(repo, "commit", "-q", "--no-verify", "-m", "side work");
      plainGit(repo, "checkout", "-q", "main");
      writeFileSync(join(repo, "c.txt"), "main\n");
      plainGit(repo, "add", "c.txt");
      plainGit(repo, "commit", "-q", "--no-verify", "-m", "main work");
      plainGit(repo, "merge", "--no-ff", "--no-edit", "side");
    },
  },
  {
    name: "git revert",
    firesCommitMsg: false,
    walk: (repo) => {
      writeFileSync(join(repo, "a.txt"), "two\n");
      plainGit(repo, "add", "a.txt");
      plainGit(repo, "commit", "-q", "--no-verify", "-m", "to revert");
      plainGit(repo, "revert", "--no-edit", "HEAD");
    },
  },
  {
    name: "git cherry-pick",
    firesCommitMsg: false,
    walk: (repo) => {
      plainGit(repo, "checkout", "-q", "-b", "side");
      writeFileSync(join(repo, "b.txt"), "side\n");
      plainGit(repo, "add", "b.txt");
      plainGit(repo, "commit", "-q", "--no-verify", "-m", "side work");
      plainGit(repo, "checkout", "-q", "main");
      plainGit(repo, "cherry-pick", "side");
    },
  },
  {
    name: "git rebase (a replayed commit)",
    firesCommitMsg: false,
    walk: (repo) => {
      plainGit(repo, "checkout", "-q", "-b", "side");
      writeFileSync(join(repo, "b.txt"), "side\n");
      plainGit(repo, "add", "b.txt");
      plainGit(repo, "commit", "-q", "--no-verify", "-m", "side work");
      plainGit(repo, "checkout", "-q", "main");
      writeFileSync(join(repo, "c.txt"), "main\n");
      plainGit(repo, "add", "c.txt");
      plainGit(repo, "commit", "-q", "--no-verify", "-m", "main work");
      plainGit(repo, "checkout", "-q", "side");
      plainGit(repo, "rebase", "main");
    },
  },
  {
    name: "git commit --no-verify",
    firesCommitMsg: false,
    walk: (repo) => {
      writeFileSync(join(repo, "a.txt"), "two\n");
      plainGit(repo, "add", "a.txt");
      plainGit(repo, "commit", "-q", "--no-verify", "-m", "bypassed");
    },
  },
];

describe("which roads to a commit fire `commit-msg` (#1430, measured)", () => {
  for (const road of ROADS) {
    it(`${road.name} — commit-msg ${road.firesCommitMsg ? "FIRES" : "is skipped"}`, () => {
      const { repo, fired } = roadRepo();
      road.walk(repo);
      const hooks = fired();
      /* A road that produced no commit answered nothing: the witness would be
         empty for "skipped" and for "the git command failed", and those are
         different facts. */
      const commits = Number(plainGit(repo, "rev-list", "--count", "HEAD").stdout.trim());
      expect(commits, `${road.name} produced no new commit — this arm proved nothing`)
        .toBeGreaterThan(1);
      expect(hooks.includes("commit-msg")).toBe(road.firesCommitMsg);
    });
  }

  it("the three roads `commit-msg` skips are the three `pre-commit` skips — same list", () => {
    /* Not a coincidence worth leaving unstated: it is why the hook's header can
       argue those roads REPLAY a message that already passed this hook, rather
       than claiming they are covered. */
    const skipped = ROADS.filter((r) => !r.firesCommitMsg && r.name !== "git commit --no-verify")
      .map((r) => r.name);
    expect(skipped).toEqual(["git revert", "git cherry-pick", "git rebase (a replayed commit)"]);
  });
});

/* ── the header is the subject, not decoration ─────────────────────────────── */

describe("the hook is installed and says what it was measured to do", () => {
  it("this clone arms it — `core.hooksPath` is `.githooks`", () => {
    const read = runHook("git", ["config", "--get", "core.hooksPath"], { cwd: ROOT });
    expect(read.status, "git could not read the config").toBe(0);
    expect(read.stdout.trim()).toBe(".githooks");
  });

  it("EVERY hook in the directory is committed EXECUTABLE, this one included", () => {
    /*
      ⚠ MEASURED, NOT ASSUMED — THIS COMMIT'S OWN FIRST ATTEMPT GOT IT WRONG.
      `.githooks/commit-msg` landed in the index as `100644` while all nine of its
      neighbours were `100755`: Windows does not carry the bit, `chmodSync` on the
      working file changes nothing git records, and it takes
      `git update-index --chmod=+x`. A hook without the bit is SILENTLY INERT on a
      POSIX clone — invariant 7's exact shape, and it would have shipped green
      because every arm above runs it through `sh` explicitly rather than letting
      the kernel decide.

      Derived over the whole directory rather than naming this one file, so the
      next hook added cannot repeat it.
    */
    const read = runHook("git", ["ls-files", "-s", ".githooks"], { cwd: ROOT });
    expect(read.status, "git could not list the hooks").toBe(0);
    const listed = read.stdout.trim().split(/\r?\n/).filter(Boolean);
    expect(listed.length, "git listed no hooks — this arm read nothing")
      .toBeGreaterThanOrEqual(10);
    const notExecutable = listed
      .filter((row) => !row.startsWith("100755"))
      .map((row) => row.split("\t")[1]);
    expect(notExecutable, "a hook is committed non-executable and is inert on a POSIX clone")
      .toEqual([]);
  });

  it("the header's road table names every road these arms drive, with the same verdict", () => {
    /*
      ⚠ A HEADER IS A CLAIM (working law 1). This hook's authority is "measured,
      not argued", and `prepare-commit-msg`'s own header carried a FALSE sentence
      about its own hook until a drive caught it. So the table and the arms are
      held equal here: a road added above without its row, or a row whose verdict
      disagrees with the measurement, reddens.
    */
    const header = readListedSource(HOOK);
    expect(header, ".githooks/commit-msg is not there").not.toBeNull();
    for (const road of ROADS) {
      const row = new RegExp(
        `${road.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+\\S+\\s+(FIRED|skipped)`,
      ).exec(header!);
      expect(row, `the header has no row for "${road.name}"`).not.toBeNull();
      expect(row![1], `the header's verdict for "${road.name}" disagrees with the measurement`)
        .toBe(road.firesCommitMsg ? "FIRED" : "skipped");
    }
  });

  it("holds NO second copy of the pattern — one reader, `closingKeyword.mts`", () => {
    /* A regex in the shell script would be working law 4 with a merge queue
       attached: three surfaces already share that module, and a fourth spelling
       of the keyword list is how they start disagreeing. */
    const header = readListedSource(HOOK);
    expect(header).not.toBeNull();
    expect(header!).toContain("scripts/check-closing-keyword.mts");
    for (const keyword of ["Closes #", "Fixes #", "Resolves #"]) {
      /* Named in the prose is fine; a MATCHER is not. What this forbids is the
         shell doing its own reading — `grep -E`, `case`, `expr` over the text. */
      expect(header!.includes(`grep ${keyword}`)).toBe(false);
    }
    expect(header!).not.toMatch(/grep\s+-[A-Za-z]*E?[A-Za-z]*\s+['"].*clos/i);
  });
});
