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
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ⚠ **AND `remove` READS THE BRANCH IT IS TALKING ABOUT — IT NO LONGER SPELLS
 * ONE (#1613). `team/<slug>` IS A CONVENTION, AND A CONVENTION IS ONLY TRUE OF
 * THE BRANCH `add` CREATED.**
 *
 * Found by using the tool on itself, minutes after #1540's repair merged: a
 * shift removed its own worktree and `remove` printed
 * `branch team/worktree-merged-1540` — **a branch that does not exist.** The
 * worktree was on `team/worktree-merged-branch-1540`, because it had been made
 * on an EXISTING branch (`git worktree add <path> <branch>`), and from that
 * moment the directory name and the branch name are independent of each other.
 * That shape is PRESCRIBED rather than exotic: a seat picking up a released
 * card is told to continue on the pull request's branch.
 *
 * What it cost was #1540's own brand-new feature. `readShippedCommits` asked
 * `gh pr list --head team/<slug>` about a branch no pull request had ever used,
 * so the answer was always *no merged pull request* — **the friendly outcome
 * that card exists to produce could never appear for this whole class of
 * worktree**, and the cry-wolf refusal it was filed to end came back. The
 * smaller-honest-count read compared against a ref that does not exist, and the
 * printed `branch` line named fiction on a tool whose next four lines delete a
 * directory.
 *
 * ⚠ **THE PLAN NO LONGER CARRIES A BRANCH AT ALL, AND THAT IS THE WHOLE
 * REPAIR.** Tightening the five call sites would have left the derived name one
 * property access away from every future edit on the removal path; removing it
 * from the object `remove` HOLDS means the mistake is not reachable there.
 * `branchToCreate` is the convention, called once, by `add` — the one place a
 * convention is right, because there is nothing yet to read.
 *
 * ⚠ **AND WHERE THE READ CANNOT BE TAKEN, THE ANSWER IS "UNREADABLE", NEVER THE
 * CONVENTION.** Falling back is how this defect read as working for a day: a
 * derived name is always *a* name, so nothing ever looks wrong. A detached HEAD
 * and an unregistered leftover both come back `unreadable`, which prints as such
 * and — on the one path that decides anything — becomes a `ShipReading` of
 * `unreadable`, i.e. the refusal that was already there.
 */

/** What `add` must do, in order, so the caller cannot invent its own sequence. */
export type WorktreePlan = {
  readonly slug: string;
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
    path,
    nodeModulesLink: `${path}/node_modules`,
    envSource: `${repoRoot}/.env`,
    envTarget: `${path}/.env`,
  };
}

/**
 * A PULL REQUEST NUMBER, VALIDATED ONCE — because it becomes a directory name
 * and an argument to a recursive delete, exactly as a slug does (#1796).
 *
 * ⚠ **THE PARSED NUMBER IS WHAT `reviewPlanFor` BUILDS THE PATH FROM, NEVER THE
 * TYPED STRING.** That is the whole injection answer and it is structural rather
 * than a list of forbidden characters: `../x`, `-f`, `1 2`, `1;rm` and
 * `1794b` all fail `^[0-9]+$` here, and anything that passes it is a number by
 * the time a path is made of it. `007` and `7` therefore name ONE directory,
 * which is the property that matters — two spellings of one pull request must
 * not become two shells on disk, since two shells is the whole defect.
 */
export function validatePrNumber(
  raw: string,
): { ok: true; pr: number } | { ok: false; reason: string } {
  if (raw.length === 0) return { ok: false, reason: "--pr was given no number" };
  if (!/^[0-9]+$/.test(raw)) {
    return {
      ok: false,
      reason: `--pr takes a pull request number in digits, and \`${raw}\` is not one`,
    };
  }
  const pr = Number(raw);
  if (!Number.isSafeInteger(pr) || pr <= 0) {
    return { ok: false, reason: `--pr ${raw} is not a pull request number this repository could have` };
  }
  return { ok: true, pr };
}

/**
 * WHERE A REVIEW WORKTREE GOES — the second shape, and the reason there is a
 * second one at all (#1796).
 *
 * ⚠ **IT KEEPS THE NAME THE HAND-ROLLED ROAD ALREADY USED, ON PURPOSE.** Nineteen
 * `drape-review-<N>` shells were swept on the Janitor's run 12 and two more
 * appeared inside the same hour; naming this `drape-shift-review-<N>` would have
 * left every one of those unaddressable by the tool that is supposed to own
 * them. So `remove --pr <N>` can take down a shell made before this existed,
 * which is the half of the fix that pays today rather than tomorrow.
 *
 * ⚠ **AND ONE PATH PER PULL REQUEST IS THE POINT.** The two shells of 2026-10-02
 * were `drape-review-1794` and `drape-review-1794b` — one pull request, two
 * review ATTEMPTS, and the `b` was invented by hand because the first directory
 * was in the way. A derived name has no suffix to invent: a second attempt meets
 * `add`'s own "already exists" refusal, which names `remove --pr <N>`.
 *
 * `slug` is `review-<N>` because `WorktreePlan.slug` is what the CLI prints, and
 * it is NOT a branch: a review worktree is detached by construction, so there is
 * no `team/review-<N>` anywhere and nothing may derive one.
 */
export function reviewPlanFor(pr: number, repoRoot: string, parentDir: string): WorktreePlan {
  const path = `${parentDir}/drape-review-${pr}`;
  return {
    slug: `review-${pr}`,
    path,
    nodeModulesLink: `${path}/node_modules`,
    envSource: `${repoRoot}/.env`,
    envTarget: `${path}/.env`,
  };
}

/**
 * THE ONE PLACE THE `team/<slug>` CONVENTION IS RIGHT (#1613).
 *
 * ⚠ **IT IS FOR THE BRANCH `add` CREATES AND FOR NOTHING ELSE.** Before a
 * worktree exists there is nothing to read, so naming it is the only option —
 * and `add` then makes the name true by passing it to `git worktree add -b`.
 * Every LATER question about that worktree's branch is answered by reading, not
 * by spelling the convention a second time: a worktree can be made on a branch
 * that already exists, and then the directory name and the branch name have
 * nothing to do with each other. Deliberately NOT a field on `WorktreePlan`, so
 * the removal path cannot reach it.
 */
export function branchToCreate(slug: string): string {
  return `team/${slug}`;
}

/**
 * ONE `git worktree list --porcelain` ENTRY — the path, and the branch if it has
 * one.
 *
 * `branch` is `null` for a DETACHED head, which porcelain reports as a bare
 * `detached` line. That is a real state (a bisect, a checked-out tag) and it is
 * kept as `null` rather than as an empty string, because "no branch" and "a
 * branch whose name I failed to read" want different sentences.
 */
export type WorktreeEntry = { readonly path: string; readonly branch: string | null };

/** The listing that answers BOTH questions `remove` asks. One owner, one call. */
export function worktreeListArgs(): string[] {
  return ["worktree", "list", "--porcelain"];
}

/**
 * ⚠ ONE PARSER FOR *IS IT REGISTERED* AND *WHAT BRANCH IS IT ON* (#1613).
 *
 * The CLI held TWO hand-rolled copies of the `worktree <path>` line test and was
 * about to need a third for the branch — which is working law 4 (a second list
 * shadowing a source of truth always drifts from it) with the drift already
 * visible: both copies normalised backslashes and neither could have told you
 * what branch the entry named.
 *
 * ⚠ **AN EXACT PATH MATCH, NOT A SUBSTRING** — the rule the CLI's own comment
 * already carried, kept here so it has one owner: `drape-shift-a` must not match
 * the entry for `drape-shift-a-b`, on a tool that ends in a recursive delete.
 * Backslashes are normalised because git prints Windows paths either way
 * depending on how the worktree was added.
 */
export function parseWorktreeList(porcelain: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  let path: string | null = null;
  let branch: string | null = null;
  const flush = () => {
    if (path !== null) entries.push({ path, branch });
    path = null;
    branch = null;
  };
  for (const raw of porcelain.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("worktree ")) {
      /* A new `worktree` line ends the previous entry whether or not a blank
         line separated them — porcelain uses blank lines, but relying on them
         makes the parser fail silently on a trailing entry with no newline. */
      flush();
      path = line.slice("worktree ".length).trim().replace(/\\/g, "/");
    } else if (line.startsWith("branch refs/heads/")) {
      branch = line.slice("branch refs/heads/".length).trim();
    }
  }
  flush();
  return entries;
}

/** The entry for a path, or `null` when git does not know this path. */
export function entryForPath(
  entries: readonly WorktreeEntry[],
  path: string,
): WorktreeEntry | null {
  const wanted = path.replace(/\\/g, "/");
  return entries.find((entry) => entry.path === wanted) ?? null;
}

/**
 * WHAT BRANCH IS THIS WORKTREE ON — read, or honestly unreadable (#1613).
 *
 * ⚠ **THERE IS NO THIRD ANSWER, AND THERE MUST NOT BE.** The card asked for this
 * by name: *"where the read cannot be taken, refuse rather than fall back to the
 * convention. Falling back is how this defect reads as working."*
 */
export type WorktreeBranch =
  | { readonly branch: string }
  | { readonly unreadable: string };

/** `true` when the branch read did not land. One owner, several consumers. */
export function branchReadFailed(
  read: WorktreeBranch,
): read is { readonly unreadable: string } {
  return "unreadable" in read;
}

/**
 * The branch `remove` may talk about, from what git said about this path.
 *
 * Both unreadable cases are states in which there is no branch state to protect
 * — an unregistered path is litter git has already let go of, and a detached
 * head has no branch to lose — so neither is a reason to REFUSE THE REMOVAL. It
 * is the SENTENCE that is refused, not the act: `remove` prints the reason where
 * it used to print a name it had invented, and its one decision (did these
 * commits ship?) goes to the refusal it already had.
 */
export function branchForRemoval(entry: WorktreeEntry | null): WorktreeBranch {
  if (entry === null) {
    return {
      unreadable: "git does not have this path registered as a worktree, so it names no branch",
    };
  }
  if (entry.branch === null) {
    return { unreadable: "this worktree is on a detached HEAD, so there is no branch to name" };
  }
  return { branch: entry.branch };
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
 * THE REF A REVIEW WORKTREE IS CHECKED OUT AT (#1796).
 *
 * ⚠ **`refs/pull/<N>/head` IS NOT A BRANCH, AND THAT IS WHY IT IS THIS REF AND
 * NOT A LOCAL ONE.** The hand-rolled road cut `-b team/<slug>` per review and
 * deleted neither the branch nor the directory, which is the second contributor
 * #1797 measures — local `team/*` refs went 115 → 295 in three days. A ref under
 * `refs/pull/` never appears in `git branch`, so a review leaves nothing behind
 * for that sweep to find, and the ref is simultaneously the RESTORE road for
 * anything the removal destroys.
 */
export function reviewCheckoutRef(pr: number): string {
  return `refs/pull/${pr}/head`;
}

/**
 * THE FETCH `add --pr` MAKES — into a named ref, not into `FETCH_HEAD` (#1796).
 *
 * ⚠ **TWO DELIBERATE DIFFERENCES FROM `prHeadFetchArgs`, AND BOTH ARE LOAD
 * BEARING.** It has a DESTINATION, because `FETCH_HEAD` is one slot shared by
 * the whole repository and four seats fetch into it concurrently on this machine
 * — a worktree created at `FETCH_HEAD` could be created at somebody else's
 * fetch. And it is FORCED (`+`), because a pull request's head moves whenever
 * its author pushes a repair, which is exactly when the reviewer looks again.
 */
export function prHeadFetchIntoRefArgs(pr: number): string[] {
  return ["fetch", "--no-tags", "origin", `+refs/pull/${pr}/head:refs/pull/${pr}/head`];
}

/** The worktree `add --pr` creates: detached, at the pull request's own head. */
export function reviewWorktreeAddArgs(pr: number, path: string): string[] {
  return ["worktree", "add", "--detach", path, reviewCheckoutRef(pr)];
}

export type ReviewRemovalVerdict =
  | { readonly proceed: true; readonly note: string }
  | { readonly proceed: false; readonly reason: string };

/**
 * MAY A REVIEW WORKTREE BE REMOVED? — the one question `decideRemoval` cannot
 * put, and the reason this road needed anything beyond a second plan (#1796).
 *
 * ⚠ **A REVIEW WORKTREE IS DETACHED, SO `decideRemoval`'s INPUT IS MEANINGLESS
 * FOR IT AND WOULD HAVE REFUSED EVERY SINGLE REMOVAL.** Traced before it was
 * written: a detached HEAD has no upstream, so the CLI's unpushed count falls
 * back to `origin/main..HEAD` and reports the PULL REQUEST'S OWN COMMITS as
 * unpushed; `shipReadingFor` is then handed an unreadable branch and answers
 * `unreadable`; `decideRemoval` refuses. **The reviewer would meet a refusal on
 * the happy path on every review and learn to type `--force` by reflex** — which
 * is the habit `decideRemoval`'s own docblocks say must never be trained, since
 * `--force` is what stands between a real find and a deleted directory.
 *
 * So the question is asked about the REF instead of about a branch: is this
 * worktree's HEAD still contained by `refs/pull/<N>/head`? If it is, GitHub
 * holds every commit in the directory and nothing here is only here. If HEAD
 * sits past it, somebody committed in the review worktree and those commits are
 * nowhere else — the same fact `decideRemoval` refuses on, and it refuses here
 * the same way.
 *
 * ⚠ **`notMerged` CANNOT ARISE AND IS STILL REFUSED.** `readHeadAgainstPrHead`
 * never returns it — only the branch hop can, and the review road has no branch
 * hop. It is refused rather than dropped through a default, so a future edit that
 * routes some other reading in here cannot make an unasked question read as a
 * clean proceed.
 */
export function decideReviewRemoval(
  ship: ShipReading,
  pr: number,
  force: boolean,
): ReviewRemovalVerdict {
  if ("shippedBy" in ship) {
    return {
      proceed: true,
      note: `HEAD is inside PR #${pr}'s own head, which GitHub keeps at refs/pull/${pr}/head — nothing in this directory is only here`,
    };
  }
  if ("pastMerge" in ship) {
    const { commits } = ship.pastMerge;
    if (force) {
      return {
        proceed: true,
        note: `⚠ --force is destroying ${commits} commit(s) made in this review worktree — refs/pull/${pr}/head does not have them`,
      };
    }
    return {
      proceed: false,
      reason:
        `${commits} commit${commits === 1 ? " was" : "s were"} made in this review worktree and PR #${pr}'s head does not contain ${commits === 1 ? "it" : "them"}`
        + ` — this directory is ${commits === 1 ? "its" : "their"} only copy. Push ${commits === 1 ? "it" : "them"} somewhere, or pass --force to destroy ${commits === 1 ? "it" : "them"}`,
    };
  }
  if ("unreadable" in ship) {
    if (force) {
      return {
        proceed: true,
        note: `⚠ --force: whether this worktree still holds only PR #${pr}'s commits was NOT read (${ship.unreadable})`,
      };
    }
    return {
      proceed: false,
      reason:
        `whether this worktree's HEAD is still inside PR #${pr}'s head COULD NOT BE READ (${ship.unreadable})`
        + " — so this refusal is the safe answer rather than a finding. Pass --force if you know the directory holds nothing",
    };
  }
  return {
    proceed: false,
    reason:
      `the reading came back \`notMerged\`, which the review road never asks for and cannot interpret`
      + ` — refusing rather than guessing about deleting a directory`,
  };
}

/**
 * THE READING, over injected runners so every branch is drivable with no
 * network and no GitHub (#1540).
 *
 * The branch resolves a pull request here; the comparison against that pull
 * request's recorded head is `readHeadAgainstPrHead` below, shared with the
 * review road (#1796), and the exit-code trap that reading turns on is named on
 * it rather than restated here.
 */
export function readShippedCommits(
  branch: string,
  gh: (args: string[]) => { status: number; out: string; err: string },
  gitInWorktree: (args: string[]) => { status: number; out: string; err: string },
): ShipReading {
  const pr = readMergedPullRequest(branch, gh);
  if (prReadFailed(pr)) return { unreadable: pr.unreadable };
  if (pr === null) return { notMerged: true };

  return readHeadAgainstPrHead(pr, gitInWorktree);
}

/**
 * DO THIS WORKTREE'S COMMITS SIT INSIDE A KNOWN PULL REQUEST'S HEAD? — the
 * second half of `readShippedCommits`, lifted out so a REVIEW worktree can ask
 * it without the branch hop (#1796).
 *
 * ⚠ **IT IS LIFTED, NOT COPIED, AND THAT IS THE POINT.** A review worktree is
 * detached, so `readShippedCommits`'s first act — *which pull request names this
 * branch* — has no question to put, while its second act is exactly the reading
 * a review removal wants. Writing that reading a second time would be working
 * law 4 on the one path in this file that ends in a recursive delete, and the
 * three states below are each one character from their neighbour. So both
 * callers drive these bytes: `readShippedCommits` reaches it after the branch
 * resolves a pull request, `reviewShipReadingFor` reaches it with the number the
 * reviewer typed.
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
export function readHeadAgainstPrHead(
  pr: number,
  gitInWorktree: (args: string[]) => { status: number; out: string; err: string },
): ShipReading {
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
 * THE SHIP READING, TAKEN ONLY WHEN THERE IS A BRANCH TO ASK ABOUT (#1613).
 *
 * ⚠ **AN UNREADABLE BRANCH BECOMES AN UNREADABLE READING, NEVER A MISSING
 * MERGE.** `readShippedCommits` would happily accept `""` or a guessed name and
 * come back `notMerged` — *asked, and nobody merged this* — which is a confident
 * fact about a question that was never put. `unreadable` says *nobody asked*,
 * and `decideRemoval` already words that case for the shift.
 *
 * The fold lives here rather than in the caller so the arms drive the real one
 * (working law 4), and so the fail-closed choice has a single owner.
 */
export function shipReadingFor(
  branch: WorktreeBranch,
  gh: (args: string[]) => { status: number; out: string; err: string },
  gitInWorktree: (args: string[]) => { status: number; out: string; err: string },
): ShipReading {
  if (branchReadFailed(branch)) {
    return { unreadable: `the branch this worktree is on could not be read — ${branch.unreadable}` };
  }
  return readShippedCommits(branch.branch, gh, gitInWorktree);
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
