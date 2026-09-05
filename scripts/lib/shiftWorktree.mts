/**
 * THE SHIFT WORKTREE HELPER — the decisions, kept apart from the doing (#543
 * build item 2, founder-ordered and urgent 2026-09-05).
 *
 * Every shift hand-types the same six steps to cut a worktree and the same two
 * to take it down, and since the overlap rule landed the same night it does it
 * TWICE a shift — a second worktree while the first PR's gate runs. Hand-typing
 * a `rm -rf` twice a night is not a chore, it is a hazard, and this repository
 * already has the scar.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ⚠ THE JUNCTION COMES OUT FIRST, AND THE DANGER IS REAL — BUT IN EXACTLY ONE
 * OF THE FOUR DELETION FORMS. MEASURED 2026-09-05, EACH AGAINST A JUNCTION
 * PROVEN TO RESOLVE BEFORE THE DELETE.
 *
 * A shift worktree gets its `node_modules` as a **Windows junction to the main
 * tree's real one** — the install is over a gigabyte and copying it per
 * worktree is absurd under the overlap rule, which cuts two a night.
 *
 *   | deletion form                                    | main tree's install |
 *   |--------------------------------------------------|----------------------|
 *   | node `fs.rmSync(parent, { recursive: true })`    | survived             |
 *   | PowerShell `Remove-Item -Recurse -Force parent`  | survived             |
 *   | git-bash `rm -rf parent`                         | survived             |
 *   | **git-bash `rm -rf parent/node_modules/`**       | **DESTROYED**        |
 *
 * **The trailing slash is the whole difference, and it is the form a shift
 * types by hand.** `rm -rf <link>` removes the link; `rm -rf <link>/` asks for
 * the DIRECTORY the link points at, and empties the install every other
 * worktree, the dev server and the founder's own session are using. Deleting
 * the PARENT is safe in all three tools tested — Windows surfaces a junction as
 * a reparse point and each unlinks it rather than descending.
 *
 * ⚠ THE MEASUREMENT ALMOST WENT THE OTHER WAY, AND HOW IS WORTH MORE THAN THE
 * RESULT. A first hand-run of the trailing-slash case reported the install
 * SURVIVING, and it was wrong: `mklink` had failed and the run never checked,
 * so the delete met an ordinary empty directory. **A clean null is evidence
 * only if the fixture could have produced a positive.** Every arm in
 * `server/shiftWorktree.test.ts` therefore asserts the junction was created
 * before it deletes anything, and the destroying form is kept as a NEGATIVE
 * CONTROL asserting the destruction — if it ever stops destroying, the other
 * three arms have quietly stopped testing anything.
 *
 * So `remove` unlinks the junction, PROVES it is gone, and only then touches
 * the directory. If the unlink fails it REFUSES: a refusal costs one manual
 * cleanup, and the other branch costs the machine its dependency install.
 *
 * · **`git worktree remove --force` does not finish the job on this machine.**
 *   git 2.55 on Windows reports `Invalid argument`, unregisters the worktree
 *   and leaves the directory sitting there. Reproduced 4/4 on Retro run 1. So
 *   removal is always two acts, and the second is only reached once the
 *   junction is provably gone.
 *
 * · **A held directory is emptied, not refused.** A worktree remove ran while a
 *   watcher pair had the directory open and it deleted a shift's logs. Anything
 *   worth keeping is copied OUT before removal, so `remove` REPORTS what it is
 *   about to destroy and refuses on unpushed work.
 *
 * · **A fresh checkout can arrive CRLF-smudged** and about eight suites that
 *   assert on substrings fail for no reason a shift can see. `add` checks and
 *   says so rather than letting the next hour go to it.
 */

/** What `add` must do, in order, so the caller cannot invent its own sequence. */
export type WorktreePlan = {
  readonly slug: string;
  readonly branch: string;
  readonly path: string;
  readonly nodeModulesLink: string;
  readonly envSource: string;
  readonly envTarget: string;
};

/**
 * A slug becomes a branch name, a directory name and an argument to a
 * recursive delete, so it is validated once, here, rather than trusted three
 * times.
 *
 * ⚠ THE REFUSALS ARE THE POINT. `..` in a slug walks the removal out of the
 * worktree parent; a leading `-` becomes a flag to whichever tool sees it
 * next; an empty slug makes the path the parent directory itself. None of
 * these is hypothetical enough to leave to chance when the tool ends in
 * `rm -rf`.
 */
export function validateSlug(slug: string): { ok: true } | { ok: false; reason: string } {
  if (slug.length === 0) return { ok: false, reason: "the slug is empty" };
  if (slug.length > 60) return { ok: false, reason: "the slug is longer than 60 characters" };
  if (slug.startsWith("-")) return { ok: false, reason: "a slug may not start with '-' — it would read as a flag" };
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return {
      ok: false,
      reason: "a slug is lowercase letters, digits and hyphens, starting with a letter or digit",
    };
  }
  if (slug.includes("--")) return { ok: false, reason: "a slug may not contain '--'" };
  return { ok: true };
}

export function planFor(slug: string, repoRoot: string, parentDir: string): WorktreePlan {
  const path = `${parentDir}/drape-shift-${slug}`;
  return {
    slug,
    branch: `team/${slug}`,
    path,
    nodeModulesLink: `${path}/node_modules`,
    envSource: `${repoRoot}/.env`,
    envTarget: `${path}/.env`,
  };
}

/**
 * Whether a removal may proceed, given what was read off the worktree.
 *
 * Kept pure so both directions are drivable without a real repository in the
 * loop — and both directions matter equally. A helper that refuses too readily
 * gets `--force`d by habit, and then it is not a guard at all.
 */
export type RemovalState = {
  /** Commits on the branch that no remote has. Non-empty means real work would vanish. */
  readonly unpushedCommits: number;
  /** Tracked files modified or staged, plus untracked non-ignored files. */
  readonly dirtyFiles: readonly string[];
  /** Whether git still knows about this path as a worktree. */
  readonly registered: boolean;
  /** Whether the node_modules junction is still in place. */
  readonly junctionPresent: boolean;
};

export type RemovalVerdict =
  | { readonly proceed: true; readonly warnings: readonly string[] }
  | { readonly proceed: false; readonly reason: string; readonly overridable: boolean };

export function decideRemoval(state: RemovalState, force: boolean): RemovalVerdict {
  if (state.unpushedCommits > 0 && !force) {
    return {
      proceed: false,
      reason: `${state.unpushedCommits} commit${state.unpushedCommits === 1 ? "" : "s"} on this branch are on no remote — push them, or pass --force to destroy them`,
      overridable: true,
    };
  }
  if (state.dirtyFiles.length > 0 && !force) {
    const shown = state.dirtyFiles.slice(0, 5).join(", ");
    const more = state.dirtyFiles.length > 5 ? ` (+${state.dirtyFiles.length - 5} more)` : "";
    return {
      proceed: false,
      reason: `the worktree has uncommitted work: ${shown}${more} — commit it, copy it out, or pass --force`,
      overridable: true,
    };
  }
  const warnings: string[] = [];
  if (force && state.unpushedCommits > 0) {
    warnings.push(`--force is destroying ${state.unpushedCommits} unpushed commit(s)`);
  }
  if (force && state.dirtyFiles.length > 0) {
    warnings.push(`--force is destroying ${state.dirtyFiles.length} uncommitted file(s)`);
  }
  if (!state.registered) {
    warnings.push("git does not have this path registered as a worktree — removing the directory only");
  }
  return { proceed: true, warnings };
}

/**
 * ⚠ NEVER OVERRIDABLE, AND SEPARATE FROM `decideRemoval` ON PURPOSE.
 *
 * Every other refusal above is about losing a shift's work, and `--force` is a
 * legitimate answer to that. This one is about the state of the dependency
 * install shared by every worktree on the machine — no measured tool follows
 * the junction (see the header's table), but there is also no situation in
 * which a shift MEANS to run a recursive delete with it still in place, so
 * there is nothing for `--force` to express. Keeping it out of the force-able
 * verdict is what stops a habitual `--force` from reaching it.
 */
export function junctionMustBeGone(junctionPresent: boolean): { ok: boolean; reason: string } {
  if (!junctionPresent) return { ok: true, reason: "" };
  return {
    ok: false,
    reason:
      "the node_modules junction is still in place — a recursive delete would follow it into the MAIN tree's node_modules and empty it. Remove the link first (cmd /c rmdir \"<path>\\node_modules\") and run again. This refusal is not overridable by --force.",
  };
}

/**
 * A checkout arriving with CRLF line endings fails roughly eight substring
 * suites for no visible reason. Cheap to detect: read a file the repository
 * stores with LF and look for a carriage return.
 */
export function looksCrlfSmudged(sample: string): boolean {
  return sample.includes("\r\n");
}
