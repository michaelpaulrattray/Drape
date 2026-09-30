import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { runHook } from "./testing/hookDriver";

/* This suite asks git itself two questions (`ls-files`, `grep`) through
   `runHook`, so it declares the shared floor rather than racing vitest's 5 s
   default under a parallel run — `server/testing/childProcessSuites.ts` derives
   its population from that driver, one hop, so this file is in it. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * THE WATCHDOG'S REGISTRATION RECIPE IS IN TRACKED BYTES (#1610).
 *
 * The night-shift team runs because of ONE Windows scheduled task on ONE
 * machine, `Drape Foreman Watchdog`. Until #1610 landed, **no tracked file in
 * this repository contained the word `Watchdog`**: the script the task launches
 * is under `.agents/`, which is gitignored on a founder rule, and so is every
 * note describing the team. A rebuilt or replaced machine had nothing to read.
 *
 * # ⚠ THE ARM THAT MATTERS IS THE TRACKED ONE, AND IT IS FIRST ON PURPOSE
 *
 * A guard built only out of `readFileSync` would pass on an UNTRACKED
 * `docs/FOREMAN_WATCHDOG.md` sitting in somebody's working tree — which is
 * precisely the state #1610 was filed about, wearing a filename. So the first
 * question asked here is git's, not the filesystem's, and it carries a positive
 * control on the reader: a blind `git ls-files` returns nothing, and nothing
 * satisfies "the file is not listed" perfectly happily (working law 2). Driven
 * before it was believed: with both files written but UNSTAGED, the two git arms
 * were RED and every content arm was green.
 *
 * # ⚠ THE CONTENT ARMS READ THE RECIPE BLOCK, NOT THE DOCUMENT — SABOTAGE IS WHY
 *
 * The first cut asserted `toContain("-MultipleInstances IgnoreNew")` over the
 * whole file. **Deleting that setting from the `Register-ScheduledTask` call
 * left the suite GREEN**, because the paragraph explaining why the setting
 * matters mentions it too — so the arm was held up by PROSE ABOUT the recipe
 * while the recipe itself had lost it. That is the shape this repository keeps
 * paying for: an anchor loose enough that the thing it guards can leave without
 * anything going red. The fenced PowerShell block is the recipe; a sentence next
 * to it is not, and the arms now know the difference.
 *
 * # NO SUITE CAN READ A MACHINE-LOCAL SCHEDULED TASK
 *
 * Not here and not in CI, so what is held is the half that lives in tracked
 * bytes: **what the recipe tells you to register.** The live half is read back
 * by hand, with the commands the document itself carries — which is the mistake
 * #1596 fixed next door, where a task was changed by hand and its written recipe
 * was not. `server/crewReplyMirror.test.ts` holds the sibling arms for the reply
 * mirror's recipe, and the two documents POINT at each other rather than copying
 * each other (working law 4).
 *
 * # ⚠ ANCHORED ON THE ACTION, NEVER ON A BARE SUBSTRING
 *
 * The card asked for this by name: `powershell.exe` appears all over this
 * repository, so an arm matching it anywhere would stay green on a document that
 * had lost the recipe entirely. What is held is the shape that actually decides
 * what gets registered — the `New-ScheduledTaskAction` call, the `-File`
 * argument naming the runner, and the three settings the live task carries that
 * are load-bearing rather than incidental.
 */

const REPO_ROOT = join(__dirname, "..");
const RECIPE = "docs/FOREMAN_WATCHDOG.md";
const MIRROR_RECIPE = "scripts/crew-mirror-replies.mts";

function git(args: string[]): { status: number; stdout: string } {
  return runHook("git", args, { cwd: REPO_ROOT });
}

/** Lines of a `git ls-files`/`git grep -l` answer, slash-normalised. */
function listed(args: string[]): string[] {
  const { status, stdout } = git(args);
  /* `git grep -l` exits 1 on "no match", which is an ANSWER; anything past 1 is
     git failing to understand the question and must never read as "absent". */
  if (status !== 0 && status !== 1) throw new Error(`git ${args.join(" ")} answered ${status}`);
  return stdout.split(/\r?\n/).map((line) => line.trim().replace(/\\/g, "/")).filter(Boolean);
}

/**
 * The document's fenced PowerShell blocks, in order — the RECIPE, as opposed to
 * the prose about it. See the header: that difference is the one the settings arm
 * failed to make on its first cut.
 */
function powershellBlocks(markdown: string): string[] {
  return [...markdown.matchAll(/```powershell\r?\n([\s\S]*?)\r?\n```/g)].map((match) => match[1]);
}

const recipe = readFileSync(join(REPO_ROOT, RECIPE), "utf8");
const blocks = powershellBlocks(recipe);
/* Found by CONTENT rather than by position: a document that gains a block at the
   top must not silently re-point these arms at the wrong one. */
const register = blocks.find((block) => block.includes("Register-ScheduledTask")) ?? "";
const readback = blocks.find((block) => block.includes("Get-ScheduledTaskInfo")) ?? "";

describe("#1610 · the Foreman Watchdog's registration recipe survives a rebuild", () => {
  it("⚠ the recipe is TRACKED — an untracked file is the defect, not the fix", () => {
    /* THE POSITIVE CONTROL ON THE READER ITSELF, without which this arm is
       worthless: a `git ls-files` that answered nothing would satisfy every
       "is it listed" test by being blind. */
    expect(
      listed(["ls-files"]).length,
      "`git ls-files` saw no tracked files at all — the reader is blind, not the tree empty",
    ).toBeGreaterThan(500);
    expect(
      listed(["ls-files", RECIPE]),
      `${RECIPE} is not tracked — the recipe would not survive the rebuild it exists for`,
    ).toEqual([RECIPE]);
  });

  it("⚠ `git grep Watchdog` finds it — the card's own done-when, asked of git", () => {
    /* The control on the grep reader: the neighbour recipe answers a query of
       the same shape, so an empty answer below means "not written down" rather
       than "git grep found nothing anywhere". */
    expect(
      listed(["grep", "-l", "Register-ScheduledTask"]),
      "`git grep` found no registration recipe anywhere — the reader is blind",
    ).toContain(MIRROR_RECIPE);
    expect(
      listed(["grep", "-l", "Watchdog"]),
      "no tracked file names the Watchdog — this is the state #1610 measured",
    ).toContain(RECIPE);
  });

  it("⚠ CONTROL — the recipe block and the read-back block were both found", () => {
    /* Every arm below reads one of these two strings. An extraction that
       silently returned "" would turn each `not.toMatch` green and is the one
       way this suite could go blind without failing. */
    expect(blocks.length, "the document carries no fenced PowerShell at all").toBeGreaterThanOrEqual(3);
    expect(register, "no fenced block holds a `Register-ScheduledTask` call").not.toBe("");
    expect(readback, "no fenced block reads the task back").not.toBe("");
  });

  it("registers the task against powershell.exe running the runner by its real path", () => {
    expect(register).toContain("New-ScheduledTaskAction -Execute 'powershell.exe'");
    expect(register).toContain("-File C:\\Users\\Admin\\Drape\\.agents\\foreman\\foreman-runner.ps1");
    expect(register).toMatch(/Register-ScheduledTask -TaskName 'Drape Foreman Watchdog'/);
    /* ⚠ THE REALISTIC WRONG EDIT IS A COPY OF THE MIRROR'S RECIPE, whose action
       is `wscript.exe //B` and whose own docblock explains at length why. This
       task's action is `powershell.exe` — the principal is Interactive and
       `-WindowStyle Hidden` suppresses its console because the action IS the
       PowerShell process, with no child console to inherit one. */
    expect(register).not.toMatch(/New-ScheduledTaskAction\s+-Execute\s+'(cmd|wscript)\.exe'/);
  });

  it("the Register call carries the three settings the live task depends on", () => {
    /* `IgnoreNew`: the runner is a CONTINUOUS process, so the hourly trigger
       fires while the previous instance is still alive. Without this the
       scheduler stacks a second runner beside the live one every hour. */
    expect(register).toContain("-MultipleInstances IgnoreNew");
    /* 72 hours: a persistent process under a shorter limit is killed mid-shift. */
    expect(register).toContain("-ExecutionTimeLimit (New-TimeSpan -Hours 72)");
    /* The hourly repetition IS the watchdog — it is what restarts a runner that
       died. A recipe that dropped it would register a task that fires once. */
    expect(register).toContain("-RepetitionInterval (New-TimeSpan -Hours 1)");
  });

  it("⚠ points at the mirror's recipe and never copies it", () => {
    /* Working law 4, and the drift it names is the entire content of #1596: two
       copies of one recipe, one of them fixed. Asked of the WHOLE document,
       unlike the arms above — a copy is drift wherever it sits. */
    expect(readFileSync(join(REPO_ROOT, MIRROR_RECIPE), "utf8")).toContain("Drape Crew Reply Mirror");
    expect(recipe).toContain(MIRROR_RECIPE);
    expect(
      recipe,
      "the mirror's recipe is POINTED at, never copied — a second copy is what #1596 was",
    ).not.toMatch(/Register-ScheduledTask -TaskName 'Drape Crew Reply Mirror'/);
  });

  it("tells the reader to verify at the task, not at the document", () => {
    /* A recipe that does not say "read it back" is how #1596 happened: the
       written half was trusted for a day after the live half moved. All three
       halves of the task are asked for, because a read-back that checked only
       the action would have missed every setting this suite pins. */
    expect(readback).toContain("Get-ScheduledTask -TaskName 'Drape Foreman Watchdog'");
    expect(readback).toContain("$t.Actions");
    expect(readback).toContain("$t.Settings");
    expect(readback).toContain("$t.Triggers[0].Repetition");
  });
});
