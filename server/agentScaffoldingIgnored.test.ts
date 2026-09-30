import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* This suite asks git itself two questions (`ls-files`, `check-ignore`), so it
   declares the shared floor rather than racing vitest's 5 s default under a
   parallel run — `server/testing/childProcessSuites.ts` derives its population
   from calls like the ones below, so this file is in it. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * THE AGENT SCAFFOLDING STAYS OUT OF THE TREE, AND THE ONE EXEMPTION STAYS ONE
 * FILE (#1468).
 *
 * `.gitignore` carries a founder rule in so many words — *"Local agent
 * scaffolding — never committed (founder rule)"* — and it names the incident it
 * descends from: the mailbox was staged by name once (`c47b27ba`) and untracked
 * again (`1f2d3011`). That rule now has exactly ONE exemption, granted by him on
 * 2026-09-29 for `.agents/foreman/PROGRAM.md`, the campaign pointer `CLAUDE.md`
 * calls binding.
 *
 * # ⚠ WHY AN EXEMPTION NEEDS A GUARD AND THE BLANKET RULE DID NOT
 *
 * A blanket `.agents/` needs nothing watching it: there is no way to commit
 * through it by accident, which is what its own comment says it is for. **What
 * replaced it is a four-line stepwise re-opening, and three of those four lines
 * exist only to close the door again behind the one file.** Drop
 * `.agents/foreman/*` and every future `.ps1`, every backup, every hand-written
 * note in that directory becomes stageable — and it becomes stageable QUIETLY,
 * because the thing that would tell you is a `git status` somebody happens to
 * read on the day. The standing orders' own `prompt.md` sits there: 90 KB of
 * operating detail he was NOT asked about, one careless edit from publication.
 *
 * ⚠ **AND IT IS NOT A SPELLING TEST.** Asserting that `.gitignore` still
 * CONTAINS four particular lines would pass a file where they had been reordered
 * into uselessness — `!` before the `*` that re-closes the level is a no-op git
 * says nothing about. So both arms ask GIT what it would actually do, which is
 * the only reading that settles the question (working law 1: the pattern is the
 * claim, git's verdict is the fact).
 */

const REPO_ROOT = join(__dirname, "..");
const PROGRAM = ".agents/foreman/PROGRAM.md";

function git(args: string[]): { status: number; stdout: string } {
  try {
    const stdout = execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
    return { status: 0, stdout };
  } catch (failure) {
    /* `check-ignore` exits 1 for "not ignored", which is an ANSWER and not an
       error — so the exit code is data here, never a throw to swallow. */
    const error = failure as { status?: number; stdout?: string };
    return { status: typeof error.status === "number" ? error.status : -1, stdout: error.stdout ?? "" };
  }
}

/** `true` when git would ignore this path — the fact, not the pattern. */
function isIgnored(path: string): boolean {
  const { status } = git(["check-ignore", "-q", "--no-index", path]);
  if (status !== 0 && status !== 1) throw new Error(`git check-ignore could not answer for ${path}`);
  return status === 0;
}

describe("#1468 · the agent scaffolding stays out, and the exemption stays one file", () => {
  it("⚠ EXACTLY ONE path under `.agents/` is tracked, and it is the campaign pointer", () => {
    const tracked = git(["ls-files", ".agents"]).stdout
      .split(/\r?\n/).map((line) => line.trim().replace(/\\/g, "/")).filter(Boolean);
    /* THE POSITIVE CONTROL ON THE READER ITSELF: a blind `git ls-files` returns
       nothing, and nothing would satisfy "no second file" perfectly happily.
       This arm is worthless without it (working law 2). */
    expect(
      git(["ls-files"]).stdout.split(/\r?\n/).filter(Boolean).length,
      "`git ls-files` saw no tracked files at all — the reader is blind, not the tree empty",
    ).toBeGreaterThan(500);
    expect(
      tracked,
      "his exemption was for the campaign pointer and nothing else — a second tracked"
      + " path under `.agents/` publishes something he was not asked about",
    ).toEqual([PROGRAM]);
  });

  it("⚠ the standing orders, the mailbox and the runner family are STILL ignored", () => {
    /* Two of these exist on the machine that runs the nights and none exists in
       CI, which is exactly why `check-ignore` is the right instrument: it answers
       about the PATH and needs no file on disk. `--no-index` is what makes that
       true for the tracked one below. */
    for (const path of [
      ".agents/foreman/prompt.md",
      ".agents/foreman/DIGEST.md",
      ".agents/foreman/foreman-runner.ps1",
      ".agents/foreman/check-park.ps1",
      ".agents/foreman/wake-state.json",
      ".agents/mailbox/foreman-20260930-1006.md",
      ".agents/mailbox/PROTOCOL.md",
      ".agents/STOP",
      ".agents/ESCALATE",
    ]) {
      expect(isIgnored(path), `${path} is stageable — the .gitignore negation has been widened`).toBe(true);
    }
  });

  it("⚠ AND A FILE THAT DOES NOT EXIST YET IS IGNORED TOO — the re-close is what this pins", () => {
    /* `.agents/foreman/*` is the line a careless edit drops, because with the
       file-level `!` already present the tree looks correct without it. Nothing
       on disk can tell you it is missing; a path that has never existed can. */
    expect(isIgnored(".agents/foreman/NOTES-FROM-TONIGHT.md")).toBe(true);
    expect(isIgnored(".agents/foreman/PROGRAM.md.bak")).toBe(true);
    expect(isIgnored(".agents/foreman/some/deeper/thing.ps1")).toBe(true);
  });

  it("⚠ THE NEGATIVE CONTROL ON `check-ignore` — the exempt file comes back NOT ignored", () => {
    /* Without this, an instrument that answered "ignored" to everything would
       pass all three arms above. It is the same shape as the population control
       in the first arm, pointed at the other reader. */
    expect(isIgnored(PROGRAM), `${PROGRAM} is ignored — his exemption is not in force`).toBe(false);
  });
});
