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

export type ScriptGuardVerdict = {
  ok: boolean;
  suites: string[];
  /** The last few lines the runner printed — enough to name the file at fault. */
  printed: string;
};

/**
 * Run the derived suites against `commit` in a throwaway worktree, so that
 * what they see is exactly what `origin/main` will hold. The worktree recipe
 * and its teardown live in `riteWorktree.mts`, shared with the typecheck
 * custody check (#263) — the junction teardown is the dangerous part and it is
 * written once.
 */
export const runScriptGuardsOnCommit = (root: string, commit: string, options: {
  suites?: string[];
  vitest?: (cwd: string, suites: string[]) => { status: number | null; output: string };
} = {}): ScriptGuardVerdict => {
  const suites = options.suites ?? listScriptGuardSuites(root);
  const vitest = options.vitest ?? defaultVitest;
  return inWorktreeOf(root, commit, (tree) => {
    const result = vitest(tree, suites);
    return {
      ok: result.status === 0,
      suites,
      printed: result.output.trim().split(/\r?\n/).filter((line) => line.trim() !== "").slice(-12).join("\n"),
    };
  });
};

const defaultVitest = (cwd: string, suites: string[]) => {
  const result = spawnSync("npx", ["vitest", "run", ...suites], { cwd, encoding: "utf8", shell: true, maxBuffer: 32 * 1024 * 1024 });
  return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
};
