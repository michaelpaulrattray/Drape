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
  /**
   * Commits on the branch that no remote has.
   *
   * ⚠ **THIS IS NOT THE SAME QUESTION AS *would real work vanish*, AND IT
   * STOPPED BEING A USABLE PROXY FOR IT ON 2026-09-29 (#1540).** `delete_branch_on_merge`
   * went on that night (#1434), and **a squash merge does not make the branch's
   * commits ancestors of `main`** — so a branch that merged perfectly reads here
   * exactly like a branch whose work would be destroyed. Read
   * `mergedPullRequest` below with it; this field alone can no longer tell the
   * guard's two cases apart.
   */
  readonly unpushedCommits: number;
  /** Tracked files modified or staged, plus untracked non-ignored files. */
  readonly dirtyFiles: readonly string[];
  /** Whether git still knows about this path as a worktree. */
  readonly registered: boolean;
  /** Whether the node_modules junction is still in place. */
  readonly junctionPresent: boolean;
  /**
   * DID THIS BRANCH ALREADY MERGE? — the fact `unpushedCommits` cannot see
   * (#1540).
   *
   * Ancestry cannot answer it under squash merging, and the ref graph cannot
   * answer it once the remote branch is deleted, so the PULL REQUEST is asked —
   * the same reading `pr-merge-in-order` already makes. Three states, kept
   * apart, because they want three different sentences:
   *
   *  - a NUMBER — a merged pull request names this branch, so the commits are
   *    shipped and the worktree is litter. **Not unpushed work.**
   *  - `null` — the read landed and there is no merged pull request. ⚠ **This is
   *    the case worth refusing, and the card asked for it by name**: no pull
   *    request and no remote ref means the only copy of those commits is the
   *    directory about to be deleted.
   *  - `{ unreadable }` — nobody could ask (no `gh`, offline, unauthenticated).
   *    **It must read as `null` for the VERDICT and never as a merge**, and it
   *    must say so out loud, which is why it is not folded into `null` here.
   */
  readonly mergedPullRequest: number | null | { readonly unreadable: string };
  /**
   * MERGED, AND THEN WORKED ON — set only when a merged pull request WAS found
   * and this branch's HEAD sits PAST its recorded head (#1540, found at review).
   *
   * ⚠ **THIS FIELD NEVER DECIDES ANYTHING; IT ONLY WORDS THE REFUSAL.** When it
   * is set, `mergedPullRequest` is `null` — the caller maps it that way on
   * purpose — so the refusal is the one `decideRemoval` already had and this
   * says *why* rather than *whether*. A shift told "2 commits are on no remote"
   * over a branch it merged an hour ago reaches for `--force`; told "PR #1514
   * merged this branch and then 2 commits were made on it", it pushes.
   */
  readonly unshippedPastMerge: { readonly pr: number; readonly commits: number } | null;
};

/** `true` when the merged-PR read did not land. One owner, two consumers. */
export function prReadFailed(
  state: RemovalState["mergedPullRequest"],
): state is { readonly unreadable: string } {
  return typeof state === "object" && state !== null && "unreadable" in state;
}

export type RemovalVerdict =
  | { readonly proceed: true; readonly warnings: readonly string[] }
  | { readonly proceed: false; readonly reason: string; readonly overridable: boolean };

export function decideRemoval(state: RemovalState, force: boolean): RemovalVerdict {
  const merged = typeof state.mergedPullRequest === "number" ? state.mergedPullRequest : null;
  if (state.unpushedCommits > 0 && merged === null && !force) {
    /* ⚠ **AND THE REFUSAL NOW SAYS WHICH QUESTION IT ASKED**, because the whole
       defect of #1540 was a message arguing for the wrong act on the common
       path: a shift that reads "on no remote" over a branch that merged an hour
       ago learns to reach for `--force` reflexively, and then the guard is not a
       guard on the branch that genuinely never merged. */
    /* Three sentences for three readings, and they are mutually exclusive by
       construction: the caller cannot set `unshippedPastMerge` alongside an
       `unreadable`, because both come out of one `ShipReading`. */
    const asked = prReadFailed(state.mergedPullRequest)
      ? ` — and whether a merged pull request names this branch COULD NOT BE READ (${state.mergedPullRequest.unreadable}), so this refusal is the safe answer rather than a finding`
      : state.unshippedPastMerge !== null
        ? ` — PR #${state.unshippedPastMerge.pr} merged this branch and ${state.unshippedPastMerge.commits} commit${state.unshippedPastMerge.commits === 1 ? " was" : "s were"} made on it AFTER that merge, so this directory is their only copy`
        : " and no merged pull request names this branch, so this directory is their only copy";
    return {
      proceed: false,
      reason: `${state.unpushedCommits} commit${state.unpushedCommits === 1 ? "" : "s"} on this branch are on no remote${asked} — push them, or pass --force to destroy them`,
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
  /* ⚠ **A MERGED BRANCH'S COMMITS ARE NOT "DESTROYED" AND MUST NOT SAY THEY
     ARE** (#1540). This warning fired over work that had already shipped —
     *"⚠ --force is destroying 2 unpushed commit(s)"* on the night of PR #1536 —
     and a warning that cries wolf on the common path is how the real one stops
     being read. The count is still SAID, because a shift asked to trust a tool
     about deleting things is owed the number it saw; what changes is the verb. */
  if (merged !== null && state.unpushedCommits > 0) {
    warnings.push(
      `${state.unpushedCommits} commit(s) sit on no remote, and that is expected: PR #${merged} merged this`
      + " branch (a squash merge does not make them ancestors of main, and the remote branch is deleted on merge)",
    );
  } else if (force && state.unpushedCommits > 0) {
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
 * THE CALL THAT ASKS THE PULL REQUEST — as an array, so an arm asserts what is
 * SENT rather than a constant near it (working law 5).
 *
 * `--state merged` and not `--state all`: a CLOSED-unmerged pull request over a
 * deleted branch is work that was rejected and is now nowhere, which is exactly
 * the case still worth refusing. Only a merge means the commits shipped.
 */
export function mergedPrArgs(branch: string): string[] {
  return ["pr", "list", "--head", branch, "--state", "merged", "--limit", "5", "--json", "number,mergedAt"];
}

/**
 * DID A MERGED PULL REQUEST NAME THIS BRANCH? — the reading, over an injected
 * runner so both directions are drivable without a network (#1540).
 *
 * ⚠ **EVERY FAILURE IS `unreadable` AND NEVER `null`.** The two are one
 * character apart in a hurry and opposite in meaning: `null` says *asked, and
 * nobody merged this*, which is a fact that keeps a refusal honest; `unreadable`
 * says *nobody asked*. Collapsing them would let an absent `gh` quietly assert
 * that a branch never merged — and on a machine with no `gh` at all, every
 * removal would then read as the dangerous case forever, which is how a guard
 * trains the `--force` habit it exists to prevent.
 *
 * The newest merge wins when there are several (a branch reopened and merged
 * twice): what the caller needs is *did this ship*, and the latest merge is the
 * one that answers it.
 */
export function readMergedPullRequest(
  branch: string,
  gh: (args: string[]) => { status: number; out: string; err: string },
): number | null | { readonly unreadable: string } {
  let result: { status: number; out: string; err: string };
  try {
    result = gh(mergedPrArgs(branch));
  } catch (failure) {
    return { unreadable: `\`gh pr list\` could not run: ${failure instanceof Error ? failure.message : String(failure)}` };
  }
  if (result.status !== 0) {
    const why = (result.err || result.out).trim().split(/\r?\n/)[0] ?? "no reason given";
    return { unreadable: `\`gh pr list\` exited ${result.status}: ${why}` };
  }
  let rows: unknown;
  try {
    rows = JSON.parse(result.out);
  } catch {
    return { unreadable: "`gh pr list` did not answer with JSON" };
  }
  if (!Array.isArray(rows)) return { unreadable: "`gh pr list` did not answer with a list" };
  const merged = rows
    .map((row) => (row && typeof row === "object" ? row as { number?: unknown; mergedAt?: unknown } : null))
    .filter((row): row is { number: number; mergedAt: string | null } =>
      row !== null && Number.isSafeInteger(row.number) && (row.number as number) > 0)
    .sort((a, b) => String(b.mergedAt ?? "").localeCompare(String(a.mergedAt ?? "")));
  return merged[0]?.number ?? null;
}

/**
 * DID *THESE COMMITS* SHIP? — the question `mergedPullRequest` alone cannot
 * answer, and the gap the review found (#1540, relay verdict on PR #1549).
 *
 * ⚠ **"A MERGED PULL REQUEST NAMES THIS BRANCH" AND "THESE COMMITS SHIPPED"
 * ARE TWO DIFFERENT FACTS, AND THE SECOND IS THE ONE THE GUARD IS FOR.** A
 * branch merges; the seat keeps working on the SAME branch for its next card —
 * measured on this machine the night the first shape was written:
 * `seat-1-20260930-013307` sat on `team/shared-bare-door-id-1506` with new work
 * after PR #1514 merged. One commit later, `remove` would have read *"1
 * commit(s) sit on no remote, and that is expected: PR #1514 merged this
 * branch"* and proceeded **without `--force`**. That commit never shipped. The
 * refusal this card exists to keep meaningful would have been bypassed on the
 * very path it guards, and with a friendlier sentence than before.
 *
 * **The artifact survives the branch deletion, which is what makes this
 * answerable at all:** GitHub keeps `refs/pull/<N>/head` after
 * `delete_branch_on_merge` removes the branch, so the pull request's recorded
 * head is still fetchable when `refs/heads/team/…` is long gone. The commits
 * shipped exactly when `HEAD` is an ancestor of that ref.
 *
 * ⚠ **IT CAN ONLY EVER MAKE THE GUARD REFUSE, NEVER PROCEED.** `pastMerge` and
 * `notMerged` are both mapped by the caller onto `mergedPullRequest: null`, so
 * they fall into the refusal `decideRemoval` ALREADY had rather than needing a
 * new branch in it. A new fact that can only tighten a destructive guard is the
 * shape to reach for; one that can also loosen it has to be right.
 */
export type ShipReading =
  /** A merged pull request's head CONTAINS this branch's HEAD. Litter, not work. */
  | { readonly shippedBy: number }
  /** Asked, and no merged pull request names this branch. The dangerous case. */
  | { readonly notMerged: true }
  /** Merged — and then worked on. The commits past the merge are nowhere else. */
  | { readonly pastMerge: { readonly pr: number; readonly commits: number } }
  /** Nobody could ask. Never a merge, and it says which read failed. */
  | { readonly unreadable: string };

/** The fetch that reaches a merged pull request's head after its branch is gone. */
export function prHeadFetchArgs(pr: number): string[] {
  return ["fetch", "--no-tags", "origin", `refs/pull/${pr}/head`];
}

/**
 * THE READING, over injected runners so every branch is drivable with no
 * network and no GitHub (#1540).
 *
 * ⚠ **`merge-base --is-ancestor` USES EXIT 1 AS AN ANSWER AND EVERYTHING ELSE
 * AS AN ERROR, AND CONFLATING THE TWO IS HOW THIS WOULD GO QUIETLY WRONG.**
 * Exit 0 is *yes*, exit 1 is *no* — a real verdict — and 128 is *I could not
 * tell you* (a bad object, a broken repository). A reader that treated "not 0"
 * as *no* would turn every git failure into a confident refusal; one that
 * treated "not 1" as *yes* would turn it into a confident PROCEED over a
 * directory holding the only copy of somebody's work. Both are named here
 * because both are one character away.
 */
export function readShippedCommits(
  branch: string,
  gh: (args: string[]) => { status: number; out: string; err: string },
  gitInWorktree: (args: string[]) => { status: number; out: string; err: string },
): ShipReading {
  const pr = readMergedPullRequest(branch, gh);
  if (prReadFailed(pr)) return { unreadable: pr.unreadable };
  if (pr === null) return { notMerged: true };

  const fetched = gitInWorktree(prHeadFetchArgs(pr));
  if (fetched.status !== 0) {
    const why = (fetched.err || fetched.out).trim().split(/\r?\n/)[0] ?? "no reason given";
    return { unreadable: `could not fetch refs/pull/${pr}/head: ${why}` };
  }

  const ancestor = gitInWorktree(["merge-base", "--is-ancestor", "HEAD", "FETCH_HEAD"]);
  if (ancestor.status === 0) return { shippedBy: pr };
  if (ancestor.status !== 1) {
    const why = (ancestor.err || ancestor.out).trim().split(/\r?\n/)[0] ?? "no reason given";
    return { unreadable: `could not compare HEAD with refs/pull/${pr}/head: ${why}` };
  }

  const past = gitInWorktree(["log", "--oneline", "FETCH_HEAD..HEAD"]);
  if (past.status !== 0) {
    const why = (past.err || past.out).trim().split(/\r?\n/)[0] ?? "no reason given";
    return { unreadable: `HEAD is past PR #${pr}'s head and the count could not be read: ${why}` };
  }
  const commits = past.out.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
  /* HEAD not being an ancestor means HEAD itself is in `FETCH_HEAD..HEAD`, so a
     zero here is arithmetically impossible and means the two reads disagree.
     Refusing to invent a number is the only honest answer to that. */
  if (commits === 0) {
    return { unreadable: `HEAD is not contained by PR #${pr}'s head, yet no commit separates them` };
  }
  return { pastMerge: { pr, commits } };
}

/**
 * THE READING FOLDED INTO WHAT THE VERDICT SEES — and it lives HERE, exported,
 * so the arms can drive the real mapping instead of a copy of it (working law 4:
 * a second list shadowing a source of truth always drifts from it).
 *
 * ⚠ **ONLY `shippedBy` BECOMES A NUMBER, AND THAT IS THE WHOLE SAFETY
 * ARGUMENT.** `pastMerge` and `notMerged` both become `null`, so each falls into
 * the refusal `decideRemoval` already had; a merged-then-worked-on branch
 * therefore cannot reach a proceed even if a later edit forgets this case exists.
 * `pastMerge`'s count travels sideways in `unshippedPastMerge`, which words the
 * refusal and decides nothing.
 *
 * `null` in means the question was never asked because nothing was unpushed —
 * there is no refusal to clear, so there is nothing to say.
 */
export function removalStateFromShipReading(
  ship: ShipReading | null,
): Pick<RemovalState, "mergedPullRequest" | "unshippedPastMerge"> {
  if (ship === null) return { mergedPullRequest: null, unshippedPastMerge: null };
  if ("shippedBy" in ship) return { mergedPullRequest: ship.shippedBy, unshippedPastMerge: null };
  if ("unreadable" in ship) {
    return { mergedPullRequest: { unreadable: ship.unreadable }, unshippedPastMerge: null };
  }
  if ("pastMerge" in ship) return { mergedPullRequest: null, unshippedPastMerge: ship.pastMerge };
  return { mergedPullRequest: null, unshippedPastMerge: null };
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
