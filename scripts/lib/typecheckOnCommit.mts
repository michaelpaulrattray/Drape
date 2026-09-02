/**
 * `pnpm check` RUNS ON THE PUSH PATH (#263, founder ruling 2026-08-30).
 *
 * His words: *"The CI hole is the best find in the card. A gate that only runs
 * on pull requests, plus a path that pushes straight to main, means the gate is
 * optional in practice. Fixing the rite to run the check is right."*
 *
 * The incident: `scripts/_briefing-e124-disposable.mts` reached `main` by a
 * **rite push rather than a pull request**, and `gate-checks` only ever runs on
 * `pull_request` — so `pnpm check` was RED on `main` for a day and nothing
 * looked at it. Measured on the night this landed, from our own history: the
 * last three commits on `main` had **zero check runs between them**, and **343
 * of 499 commits since 25 August reached `main` without a pull request**. The
 * gate was not weak on that path; it was absent from it.
 *
 * # Why the COMMIT and not the working directory
 *
 * This is the load-bearing decision and it is measured, not reasoned. On the
 * night this was built, in the shared main tree:
 *
 * - `pnpm check` **exit 2**, 133s — ten files erroring, **every one untracked**
 *   (old briefing disposables that the `journal` removal in #293 left behind).
 * - `pnpm check` in a clean worktree of that same commit: **exit 0**, 85s.
 *
 * So a working-directory check would have refused that night's push, and every
 * push after it, over files that are in no commit and will never reach `main`.
 * That is friction with a good name, and friction on the only push path is how
 * a control gets argued away. The commit is checked out into a throwaway
 * worktree (`riteWorktree.mts`, shared with the script guards) and checked
 * THERE: what tsc sees is exactly what `origin/main` will hold.
 *
 * # Why the whole `pnpm check`, and not just the arm that caught the incident
 *
 * `pnpm check` is four typechecks, and only the third — `tsconfig.scripts.json`
 * — covers `scripts/`, which is where the origin incident lived. Running only
 * that arm would be a second definition of "the check" sitting beside
 * `package.json`'s, and it would drift the first time a fifth arm is added
 * (working law 4). The rite pushes whatever is committed, not only briefings,
 * so it is checked the same way a pull request is. The script is invoked BY
 * NAME so the two can never disagree.
 *
 * This is a MODULE (imported by the rite and by its suite) and it never exits.
 */
import { spawnSync } from "node:child_process";
import { inWorktreeOf } from "./riteWorktree.mts";

export type TypecheckVerdict = {
  ok: boolean;
  /** Seconds the check took, for the receipt — this is the rite's slowest custody step. */
  seconds: number;
  /** The last few lines the compiler printed — enough to name the file and line at fault. */
  printed: string;
};

/**
 * Run `pnpm check` against `commit` in a throwaway worktree of `root`.
 *
 * Throws if the worktree cannot be made — a blind check must refuse rather
 * than pass (invariant 7).
 */
export const runTypecheckOnCommit = (root: string, commit: string, options: {
  check?: (cwd: string) => { status: number | null; output: string };
} = {}): TypecheckVerdict => {
  const check = options.check ?? defaultCheck;
  const started = Date.now();
  return inWorktreeOf(root, commit, (tree) => {
    const result = check(tree);
    return {
      ok: result.status === 0,
      seconds: Math.round((Date.now() - started) / 1000),
      printed: result.output.trim().split(/\r?\n/)
        .filter((line) => line.trim() !== "")
        .slice(-12).join("\n"),
    };
  });
};

/**
 * `pnpm check` by name. `shell: true` is required for a `.cmd` on Windows —
 * without it `spawnSync` returns EINVAL with both streams EMPTY, which reads
 * exactly like a passing run (foreman-186's 0/7, #11).
 */
const defaultCheck = (cwd: string) => {
  const result = spawnSync("pnpm", ["check"], {
    cwd, encoding: "utf8", shell: true, maxBuffer: 32 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  /* A run that produced nothing at all did not happen. Passing that off as a
     green check is the failure mode this whole module exists to remove, so it
     throws toward the refusal rather than returning ok. */
  if (result.status === null || output.trim() === "") {
    throw new Error(
      `pnpm check produced no output in ${cwd} (status ${result.status}, ${result.error ?? "no error"})`
      + " — the check did not run, and a check that did not run is not a pass",
    );
  }
  return { status: result.status, output };
};
