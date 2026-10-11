/**
 * THE SCRIPT GUARDS RUN OVER THE TREE BEING PUSHED (#152).
 *
 * A shift's edition commit carries its court harnesses under `scripts/`, and
 * the deploy rite pushes that commit to `main` without running `pnpm test`
 * (minutes — deliberately, see the rite's own docblock). Seven suites under
 * `server/` read `scripts/` and hold every script to a contract — how it
 * exits, how it opens a database, which world it may touch. None of them ran
 * on the push path, so on 2026-08-27 two disposables without a terminal
 * `process.exit(0)` rode to main with briefing e39, `scriptExitDiscipline` was
 * red on main for a night, and the NEXT pull request's gate inherited the
 * failure and was blamed for it (#152).
 *
 * # Why a worktree, and not the working directory
 *
 * These suites read the DISK. The shared main tree carries hundreds of
 * untracked disposables at any hour, and on the day this was written two of
 * them breached — so running the suites in place would have refused a push
 * for files that were not in it. A guard whose refusal is a lie about the
 * push is friction with a good name, and friction on the only push path is
 * how a control gets `--anyway`'d out of existence. The commit is checked
 * out detached into a throwaway worktree, `node_modules` is reached through a
 * junction (the recipe every shift already uses), and the suites run THERE:
 * what they see is exactly what `origin/main` will hold.
 *
 * # Why the suite list is derived
 *
 * Naming the seven here would be a second list of "which suites read
 * scripts/", and the eighth suite would be written without anyone opening
 * this file (working law 4). The list is read off the suites themselves, and
 * the derivation is held to a floor it cannot fall through: the origin case
 * must be in it, or the guard REFUSES rather than running a shorter list
 * (invariant 7: refuse, never allow, when the instrument is blind).
 *
 * **THE CONTRACT, STATED EXACTLY** (review of #157, finding 2): a suite is in
 * the list when its source contains the bare double-quoted token `"scripts"`
 * — the way a per-file sweeper names the directory it walks
 * (`walk("scripts")`, `path.join(root, "scripts")`). It is NOT "mentions
 * scripts/ somehow": ~80 suites cite one script by path (`"scripts/x.mts"`)
 * and those are a suite about ONE file, which `pnpm test` covers and the rite
 * deliberately does not. So a NEW sweep-guard over `scripts/` must name the
 * directory with that exact token to be run here — under-inclusion is the
 * silent direction, and the floor only protects the origin case. Over-
 * inclusion (a suite that happens to hold the token) is the safe direction
 * and costs a second.
 *
 * This is a MODULE (imported by the rite and by its suite) and it never exits.
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  type AloneRerun,
  readFailedArms,
  suiteFilesOf,
} from "./riteFailureMemory.mts";
import { inWorktreeOf } from "./riteWorktree.mts";

/** The suite #152 was filed on; a derivation that loses it is not a derivation. */
export const ORIGIN_SUITE = "server/scriptExitDiscipline.test.ts";

/**
 * SUITES THAT RUN ON THE PUSH PATH BY NAME, because the derivation above cannot
 * reach them (#263, review finding 1).
 *
 * ⚠ **This is deliberately a hand-written list and it is the SECOND kind of
 * entry, not a shadow of the first.** The grep answers one question — *"does
 * this suite sweep the `scripts` directory?"* — and it answers it well. It
 * cannot answer *"must this suite run before a direct push to main?"*, which is
 * a judgement about what the rite is custodian of. A suite is added here by
 * somebody deciding it, exactly like enumerating a public endpoint.
 *
 * The first entry is the sharpest possible argument for the list existing.
 * `server/pushPathsToMain.test.ts` is the control that catches a NEW script
 * that can push to `main` — and it was built, merged into the gate, and left
 * running **only on pull requests**, which is precisely the hole its own card
 * (#263) was filed to close. A shift rite-pushing a disposable that pushes
 * would have landed an unenumerated door and reddened the NEXT pull request's
 * gate, which is #152's origin incident happening again to #152's own successor.
 * Caught by the reviewer on the PR, not by us.
 */
export const PUSH_PATH_SUITES = [
  /* #263 — the push-path enumeration. Never matches the grep: it names
     `"scripts/deploy-rite.mts"` and `"../scripts/lib/pushPaths.mts"`, always
     with a path after the directory, so the bare token contract below excludes
     it correctly and this list includes it deliberately. */
  "server/pushPathsToMain.test.ts",
  /* #263 — the typecheck's own verdict logic: that a red status is red, and
     that a run which produced NOTHING is refused rather than read as a pass.
     Here by the same argument as its sibling — it guards a control the rite
     performs, so it must run where the rite runs. 7.3s, measured. */
  "server/typecheckOnCommit.test.ts",
];

/**
 * Every non-integration server suite whose source names the `scripts` directory,
 * plus `PUSH_PATH_SUITES`.
 */
export const listScriptGuardSuites = (
  root: string,
  grep: (root: string) => string = defaultGrep,
): string[] => {
  const suites = grep(root)
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\\/g, "/"))
    .filter((line) => line !== "" && !line.endsWith(".integration.test.ts"))
    .sort();
  if (!suites.includes(ORIGIN_SUITE)) {
    throw new Error(
      `script-guard derivation lost its origin case (${ORIGIN_SUITE}); found ${suites.length}: ${suites.join(", ") || "(none)"}`,
    );
  }
  /* The floor above is checked on the DERIVED list alone, so a named suite can
     never rescue a grep that has stopped working. */
  return [...new Set([...suites, ...PUSH_PATH_SUITES])].sort();
};

const defaultGrep = (root: string): string => {
  try {
    return execFileSync("git", ["grep", "-l", "-e", "\"scripts\"", "--", "server/*.test.ts"], {
      cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
    });
  } catch (error: any) {
    /* `git grep` exits 1 for no match; that is an empty list, and the floor
       above turns it into the refusal it deserves. Anything else is real. */
    if (error?.status === 1 && !String(error?.stderr ?? "").trim()) return "";
    throw error;
  }
};

/**
 * The same grep AT THE COMMIT, so the list and the run read one tree (#479).
 *
 * Until 2026-09-09 the list was derived from the WORKING TREE while the suites
 * ran in a worktree of the commit — same tree only because the rite refused
 * any dirty tracked file before reaching here. The rite's guard is narrower
 * now (a desk-only dirty `server/*.test.ts` no longer refuses the push), so
 * the "same commit by construction" the rite's comment promised has to be
 * constructed HERE rather than inherited: `git grep <commit>` reads committed
 * bytes wherever the desk stands. A dirty test file that dropped the token
 * from the desk copy can no longer silently drop its suite from the run.
 */
export const grepAtCommit = (root: string, commit: string): string => {
  const prefix = `${commit}:`;
  try {
    return execFileSync("git", ["grep", "-l", "-e", "\"scripts\"", commit, "--", "server/*.test.ts"], {
      cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
    })
      .split(/\r?\n/)
      .map((line) => (line.startsWith(prefix) ? line.slice(prefix.length) : line))
      .join("\n");
  } catch (error: any) {
    if (error?.status === 1 && !String(error?.stderr ?? "").trim()) return "";
    throw error;
  }
};

export type ScriptGuardVerdict = {
  ok: boolean;
  suites: string[];
  /** The last few lines the runner printed — enough to name the file at fault. */
  printed: string;
  /**
   * EVERY FAILING ARM'S IDENTITY, read from the FULL output (#2212 item 4).
   *
   * ⚠ `printed` is the last twelve lines and the `FAIL` lines are not reliably
   * among them, so this cannot be recovered downstream — it is read here, where
   * the whole output exists, and nowhere else. It is what lets the rite compare
   * one refusal of a commit with another and say whether the set MOVED, which
   * is the only mechanical way to tell the two roads of its refusal apart.
   *
   * Empty means nothing was read, NOT that nothing failed; `riteFailureMemory`
   * carries why that distinction is load-bearing.
   */
  failedArms: string[];
  /**
   * SET WHEN THE RUN COULD NOT BE ATTEMPTED AT ALL (#967) — the worktree could
   * not be made, so no suite was ever handed a tree.
   *
   * ⚠ **This is not a milder `ok: false`. It is a different KIND of answer**,
   * and keeping them apart is the whole of this card. `ok` is false either way,
   * because a rite that cannot see the tree must refuse exactly as hard as one
   * that saw a breach (invariant 7) — what changes is who is implicated. A
   * finding implicates the COMMIT; this implicates the MACHINE, and the commit
   * is not accused of anything.
   */
  couldNotRun?: string;
};

/**
 * Run the derived suites against `commit` in a throwaway worktree, so that
 * what they see is exactly what `origin/main` will hold. The worktree recipe
 * and its teardown live in `riteWorktree.mts`, shared with the typecheck
 * custody check (#263) — the junction teardown is the dangerous part and it is
 * written once.
 *
 * ⚠ **A THROW FROM THE WORKTREE MACHINERY BECOMES A VERDICT, NOT AN EXCEPTION
 * (#967).** `inWorktreeOf` throws when it cannot make the tree — correctly, and
 * its own docblock says why. Before this, that throw travelled out of here,
 * out of the rite's top level, and ended the process on a raw stack trace with
 * no refusal line and no receipt sentence. The refusal is unchanged (`ok` is
 * false and the caller must not push); what is added is that the rite can now
 * SAY which of the two happened instead of guessing.
 *
 * It is deliberately narrow: only the tree-making throw is caught here. A throw
 * from inside `vitest` is the runner's own business and still propagates.
 */
export const runScriptGuardsOnCommit = (root: string, commit: string, options: {
  suites?: string[];
  vitest?: (cwd: string, suites: string[]) => { status: number | null; output: string };
} = {}): ScriptGuardVerdict => {
  const suites = options.suites ?? listScriptGuardSuites(root, (r) => grepAtCommit(r, commit));
  const vitest = options.vitest ?? defaultVitest;
  let ran = false;
  try {
    return inWorktreeOf(root, commit, (tree) => {
      ran = true;
      const result = vitest(tree, suites);
      return {
        ok: result.status === 0,
        suites,
        printed: result.output.trim().split(/\r?\n/).filter((line) => line.trim() !== "").slice(-12).join("\n"),
        failedArms: result.status === 0 ? [] : armsOrNone(result.output),
      };
    });
  } catch (error: unknown) {
    /* `ran` is the load-bearing half: once the body has been entered the tree
       existed, so a throw from here on is NOT "could not run" — it is the
       runner or the teardown, and mislabelling it would hand the commit an
       alibi it has not earned. Re-thrown rather than dressed up. */
    if (ran) throw error;
    const stderr = String((error as { stderr?: unknown })?.stderr ?? "").trim();
    const message = (stderr !== "" ? stderr : String((error as Error)?.message ?? error)).trim();
    /* No run happened, so there is no arm to read — and an empty list here is
       exactly the "unreadable" state `riteFailureMemory` refuses to compare,
       which is the right answer about a tree that never existed. */
    return { ok: false, suites, printed: message, failedArms: [], couldNotRun: message.split(/\r?\n/).slice(0, 4).join("\n") };
  }
};

/**
 * A DIAGNOSTIC MUST NOT BE ABLE TO KILL THE PUSH PATH (#2212).
 *
 * `readFailedArms` is pure string work and has no throwing construct in it, so
 * this catch is not expected to fire. It is here because of WHERE it sits: on
 * the one road to `main`, inside a refusal that a shift is already reading, in
 * a file whose own card is about a gate whose refusals made the next refusal
 * likelier. A reader that could turn a diagnosable refusal into an uncaught
 * stack trace would be that shape again, one layer up — and #967 is this
 * repository's record of the rite dying exactly that way.
 *
 * Empty is the honest fallback and not a convenient one: it is precisely the
 * "unreadable" state `riteFailureMemory` refuses to draw a conclusion from, so
 * a reader that broke accuses nobody.
 */
const armsOrNone = (output: string): string[] => {
  try {
    return readFailedArms(output);
  } catch {
    return [];
  }
};

const defaultVitest = (cwd: string, suites: string[]) => {
  const result = spawnSync("npx", ["vitest", "run", ...suites], { cwd, encoding: "utf8", shell: true, maxBuffer: 32 * 1024 * 1024 });
  return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
};

/**
 * RE-RUN A SET OF FAILING ARMS' SUITES ALONE, AT THE SAME COMMIT (#2248).
 *
 * The control that tells the rite's two roads apart when the failure set
 * REPEATS rather than moving: `judgeAgainstMemory`'s *a set that repeats is the
 * commit* holds only while the machine's interference is transient, and a
 * persistent contention fails the same arms every single time. So the question
 * is not *did it repeat* but *are those arms capable of passing on this machine
 * right now* — and that is answered by running them with nothing else in
 * flight. `lib/riteFailureMemory.mts` carries the measurement and the two
 * things the reading must not conclude.
 *
 * ⚠ **IT RUNS ONLY THE SUITES THE REFUSAL NAMED, AND REFUSES TO RUN A
 * SUBSET.** If any arm identity cannot be resolved to a file, nothing is run:
 * a subset that passes would read as *alone-pass, so the machine* on evidence
 * that never covered the whole refusal.
 *
 * ⚠ **IT IS A FRESH WORKTREE OF THE SAME COMMIT, not the shift's directory.**
 * Same argument as `runScriptGuardsOnCommit` and `riteWorktree.mts`' own
 * header: the main tree carries hundreds of untracked disposables, and a
 * control run there would answer about a tree nobody is pushing. The cost is
 * paid ONLY on a second refusal of one commit, which is where the card's own
 * ~50 s estimate comes from.
 *
 * ⚠ **A THROW FROM THE WORKTREE MACHINERY BECOMES `ran: false`, NEVER AN
 * EXCEPTION.** This sits inside a refusal a shift is already reading, on the
 * one road to `main` — #967 is this repository's record of the rite dying on a
 * raw stack trace with no receipt line, and a diagnostic that can do that is
 * the shape #2212 named: *a refusal that makes the next refusal more likely.*
 * A control that could not be taken settles nothing and says so.
 */
export const rerunArmsAlone = (root: string, commit: string, arms: readonly string[], options: {
  vitest?: (cwd: string, suites: string[]) => { status: number | null; output: string };
} = {}): AloneRerun => {
  const reading = suiteFilesOf(arms);
  if (reading.unparsed.length > 0) {
    return {
      ran: false,
      why: `${reading.unparsed.length} of ${arms.length} failing arm identities named no suite file`
        + ` (${reading.unparsed.slice(0, 3).join("; ")}), and a PARTIAL re-run would answer a different`
        + " question from the refusal's.",
    };
  }
  if (reading.files.length === 0) {
    return { ran: false, why: "the refusal named no failing arms at all, so there is nothing to re-run alone." };
  }
  const vitest = options.vitest ?? defaultVitest;
  let ran = false;
  try {
    return inWorktreeOf(root, commit, (tree) => {
      ran = true;
      const result = vitest(tree, reading.files);
      return {
        ran: true as const,
        passed: result.status === 0,
        /* Read for the REPORT only — `passed` is the exit status, because a
           green run prints no `FAIL` line and an unreadable one prints none
           either. */
        arms: result.status === 0 ? [] : armsOrNone(result.output),
        files: reading.files,
      };
    });
  } catch (error: unknown) {
    const stderr = String((error as { stderr?: unknown })?.stderr ?? "").trim();
    const message = (stderr !== "" ? stderr : String((error as Error)?.message ?? error)).trim();
    /* `ran` tells the two apart exactly as it does one function up: once the
       body was entered the tree existed, so a throw from there is the runner's
       and not a tree that could not be made. Either way the control was not
       TAKEN, so both are `ran: false` — but the sentence says which. */
    return {
      ran: false,
      why: (ran ? "the solo re-run itself threw: " : "a worktree of the commit could not be made: ")
        + message.split(/\r?\n/).slice(0, 2).join(" "),
    };
  }
};
