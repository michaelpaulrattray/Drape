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
 * ⚠ THE STATUS READ, AND `--ignored=matching` IS THE WHOLE REPAIR OF #1823.
 *
 * It read `git status --porcelain` from the day it was written, and **`git
 * status` does not list ignored files.** `output/` is on `.gitignore`, so a
 * worktree holding a court's entire artifact set was indistinguishable, at that
 * reading, from one holding nothing — and this module's verdict is what
 * authorises a recursive delete. Measured 2026-10-03: the sweep asked about
 * `drape-shift-sign-engine-court-1394`, was told `uncommitted 0 file(s)`, and
 * the directory held **1.357 GB in 188 files** — 155 renders, the rows JSON and
 * the eye strips his *"keep NBP 2k for signing views"* was given on. Reproduced
 * against a real repository in this module's suite rather than argued.
 *
 * ⚠ **AND IT HAD NEVER BEEN SEEN BECAUSE OF WHO ASKS.** A seat removes its own
 * tree knowing what it put there; a SWEEP removes somebody else's, and the only
 * thing it can ask is this tool.
 *
 * ONE call answers both questions — `!!` lines are the ignored population and
 * every other line is the dirty one — rather than a second `git status` beside
 * the first, because two readings of one tree drift (working law 4) and the
 * drift would sit four lines above a recursive delete.
 *
 * `--ignored=matching` rather than a scoped read of `output/`: the scoped form
 * answers for the one directory this card was filed about and goes silent on the
 * next one somebody adds. Measured on a real seat worktree, matching mode
 * COLLAPSES a wholly-ignored directory to `node_modules/` and never descends
 * into it, so the cost is a listing of a handful of paths rather than a walk of
 * the install: 5.1 s cold, 0.04 s warm, two lines out on a clean tree.
 */
export function worktreeStatusArgs(): string[] {
  return ["status", "--porcelain", "--ignored=matching"];
}

/** The two populations of one `git status --porcelain --ignored=matching`. */
export type WorktreeStatus = {
  /** Tracked files modified or staged, plus untracked non-ignored files. */
  readonly dirty: readonly string[];
  /** Paths git is ignoring — a file, or a wholly-ignored directory with its slash. */
  readonly ignored: readonly string[];
};

/**
 * Split a porcelain status into dirty and ignored.
 *
 * ⚠ **THE FIRST TWO COLUMNS DECIDE, NEVER A SUBSTRING.** Porcelain's shape is
 * `XY <path>` and `!!` in the X/Y position is the ignored marker; a path may
 * itself contain `!!`, so the test is on the prefix. The slice-and-trim of the
 * rest is the reading this tool has always made, kept byte for byte, so the
 * dirty population does not change meaning in the commit that adds the other one.
 */
export function parseWorktreeStatus(porcelain: string): WorktreeStatus {
  const dirty: string[] = [];
  const ignored: string[] = [];
  for (const raw of porcelain.split(/\r?\n/)) {
    const path = raw.slice(3).trim();
    if (path.length === 0) continue;
    (raw.startsWith("!!") ? ignored : dirty).push(path);
  }
  return { dirty, ignored };
}

/**
 * THE IGNORED PATHS WORTH KEEPING — a NAMED set, which is the shape the card
 * asked for rather than a flat *ignored files present* (#1823).
 *
 * ⚠ **"IGNORED" IS NOT "VALUABLE", AND REFUSING ON ALL OF IT WOULD REFUSE EVERY
 * WORKTREE THIS PROGRAM HAS EVER CUT.** `node_modules` is a junction to the main
 * tree's install, `.vite`, `dist` and `.tools` regenerate, `.env` is copied in
 * by the runner identical to every other tree's, and `docs/architecture/index.html`
 * is a derivation of a committed file. A guard firing on all of those is a guard
 * that gets `--force`d by habit — this module's own stated hazard, and the reason
 * the set is enumerated rather than inverted.
 *
 * **Each reason is read off `.gitignore`'s own comment for that rule**, and
 * `server/shiftWorktree.test.ts` asserts every prefix here is still a rule in
 * that file — so an ignore rule renamed out from under this set reddens instead
 * of quietly making it unreachable.
 *
 * ⚠ **A LOOSE FRAME IS ALREADY COVERED AND MUST NOT GET A SECOND RULE.** The
 * card names *"`output/`, loose frames"*; a `.png` dropped at the worktree root
 * matches no ignore pattern, so it is a `??` entry and the dirty refusal below
 * has always caught it. Read at `.gitignore`: no image or frame pattern exists
 * there. What hides a frame from the old reading is being UNDER one of these.
 *
 * ⚠ **THE HONEST REMAINDER: VALUE CANNOT BE DERIVED.** A new ignore rule for
 * something worth keeping will not add itself here, and no reader can tell a
 * court's renders from a build cache by their path. This is a judgement and a
 * floor, never a complete list.
 */
export const KEPT_IGNORED_PATHS: readonly { readonly prefix: string; readonly why: string }[] = [
  { prefix: "output/", why: "drive-script and court artifacts — renders, reports, rows JSON, minted frames" },
  { prefix: ".calibration/", why: "real-spend calibration output, founder-reviewed before it is disposed of" },
  { prefix: ".theme-shots/", why: "theme-parity screenshots — the frames working law 6 is satisfied with" },
  { prefix: ".playwright-mcp/", why: "browser console logs and page snapshots from a drive" },
];

/**
 * The entry of {@link KEPT_IGNORED_PATHS} a path falls under, or `null`.
 *
 * ⚠ Git QUOTES a path containing a space or a non-ASCII byte (`!! "a b/"`), so
 * the leading quote comes off before the test — otherwise the one directory
 * whose name forced a quote would read as disposable. The trailing slash is
 * normalised off both sides because git prints a wholly-ignored directory WITH
 * one and an individual file without.
 */
export function keptIgnoredPrefixFor(
  path: string,
): { readonly prefix: string; readonly why: string } | null {
  const normalised = path.replace(/^"/, "").replace(/\\/g, "/").replace(/\/+$/, "");
  for (const entry of KEPT_IGNORED_PATHS) {
    const base = entry.prefix.replace(/\/+$/, "");
    if (normalised === base || normalised.startsWith(`${base}/`)) return entry;
  }
  return null;
}

/**
 * Which ignored paths are worth keeping, and which are disposable.
 *
 * Both halves come back, because the printed line says how many were LOOKED at.
 * A reading that prints only when it finds something cannot be told apart from a
 * reading nobody ever took — which is the whole defect of #1823 in other clothes.
 */
export function classifyIgnored(
  paths: readonly string[],
): { readonly kept: readonly string[]; readonly disposable: readonly string[] } {
  const kept: string[] = [];
  const disposable: string[] = [];
  for (const path of paths) {
    (keptIgnoredPrefixFor(path) === null ? disposable : kept).push(path);
  }
  return { kept, disposable };
}

/** One kept ignored path with what it measured on disk. */
export type KeptIgnoredPath = {
  readonly path: string;
  readonly bytes: number;
  readonly files: number;
  /** `true` when the walk hit its entry cap, so both figures are a floor. */
  readonly capped: boolean;
  /**
   * `true` when the walk could not finish — a refused stat, a link, a directory
   * it could not list, a file it could not size. Both figures are then a floor
   * and a zero means *not counted*, never *empty* (#2155).
   */
  readonly unreadable: boolean;
};

/**
 * WHETHER A KEPT IGNORED PATH ACTUALLY HOLDS ANYTHING — the reading the verdict
 * below used to take and throw away (#2155).
 *
 * ⚠ **MEASURED, NOT REASONED: 15 OF THE 34 LEFTOVER WORKTREES ON THIS MACHINE
 * REFUSED REMOVAL ON AN `output/` DIRECTORY HOLDING `0 B in 0 files`** — read
 * through the real `remove --dry-run`, then confirmed at the disk (`find -type f`
 * returned nothing in each). The tool measured the directory, PRINTED
 * `output/ (0 B in 0 files)`, and then refused on it anyway; a shift reads a
 * refusal and leaves the tree, so the leftovers accumulate and every one of them
 * keeps a live `node_modules` junction into the main tree's install — which is
 * the hazard `#2155` and this module's own header are about.
 *
 * **So the class is not "shifts that ended without running the tool", which is
 * what the card supposed.** It is this function's absence: *a verdict that
 * discards a measurement it already took.* `#1823`'s refusal is right and is
 * untouched for anything that holds bytes — what changes is that an empty
 * directory is no longer called work.
 *
 * ⚠ **AND IT FAILS CLOSED, WHICH IS THE WHOLE REASON `measureTree` NOW REPORTS
 * `unreadable`.** A zero that came from *could not look* must keep refusing, or
 * this repair hands `#1823`'s 1.36 GB back to the delete by a different door. A
 * capped walk is the same answer for the same reason: the figures are a floor,
 * so a zero is not a measurement.
 */
export function keptIgnoredHoldsWork(kept: KeptIgnoredPath): boolean {
  if (kept.unreadable || kept.capped) return true;
  return kept.files > 0 || kept.bytes > 0;
}

/**
 * Bytes as a person reads them.
 *
 * ⚠ **A FIFTH DECLARATION, NAMED AS ONE RATHER THAN PRETENDED AWAY.** Four
 * `kb()` helpers already exist — `scripts/lib/afterPaintBudget.mts`,
 * `scripts/lib/bundleBudget.mts`, `scripts/lib/bundleFold.mts` (exported) and
 * `scripts/janitor-backup-retention.mts` — and **not one reaches GB**, which is
 * the unit the 1.357 GB that filed this card is read in. This module also has NO
 * IMPORTS on purpose (`scripts/lib/riteWorktree.mts`'s header leans on it: this
 * file takes numbers and booleans so both directions drive without a disk), so
 * it may not borrow the exported one. The consolidation is a Retro proposal and
 * is deliberately NOT done here.
 */
export function humanBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${bytes} B`;
}

/** One kept path, worded once for the refusal, the warning and the printed line. */
export function describeKeptIgnored(kept: KeptIgnoredPath): string {
  /* ⚠ NOT `0 B in 0 files`, WHICH IS WHAT AN UNREADABLE PATH USED TO PRINT
     (#2155) — the most reassuring sentence available about the one state nobody
     measured, four lines above a recursive delete. */
  if (kept.unreadable) return `${kept.path} (SIZE NOT READ — the walk could not finish, so it is kept)`;
  const floor = kept.capped ? "at least " : "";
  return `${kept.path} (${floor}${humanBytes(kept.bytes)} in ${floor}${kept.files} file${kept.files === 1 ? "" : "s"})`;
}

/**
 * THE LINE THE TOOL PRINTS ABOUT IGNORED FILES — one owner, so the arms drive
 * the sentence a reader actually sees rather than a copy of it.
 *
 * ⚠ **IT PRINTS ON EVERY REMOVAL, INCLUDING WHEN THERE IS NOTHING TO SAY.**
 * #1540's lesson was that a line on every clean run can read as a confident
 * wrong sentence; this is the mirror case and it points the other way — the
 * reader who authorised deleting 1.36 GB was looking at a report with NO
 * ignored line at all, and silence about a population cannot be told apart from
 * an empty one.
 */
export function ignoredReadingLine(state: {
  readonly keptIgnored: readonly KeptIgnoredPath[];
  readonly disposableIgnored: readonly string[];
}): string {
  const total = state.keptIgnored.length + state.disposableIgnored.length;
  const counted = `${total} path(s)`;
  if (state.keptIgnored.length === 0) {
    return total === 0
      ? `${counted} — git is ignoring nothing in this worktree`
      : `${counted}, none worth keeping (${state.disposableIgnored.join(", ")})`;
  }
  /* ⚠ THE KEPT SET SPLITS IN TWO AND BOTH HALVES ARE SAID (#2155). A path in the
     named set that measured EMPTY is not work — it no longer earns the ⚠ and no
     longer refuses — but it is still printed, because #1823's whole lesson is
     that silence about a population cannot be told apart from an empty one. */
  const holding = state.keptIgnored.filter(keptIgnoredHoldsWork);
  const empty = state.keptIgnored.filter((path) => !keptIgnoredHoldsWork(path));
  const emptyNote = empty.length === 0
    ? ""
    : `; ${empty.length} kept path${empty.length === 1 ? "" : "s"} measured EMPTY (${empty.map((path) => path.path).join(", ")})`;
  const rest = state.disposableIgnored.length === 0
    ? ""
    : `; ${state.disposableIgnored.length} disposable (${state.disposableIgnored.join(", ")})`;
  if (holding.length === 0) return `${counted}, none worth keeping${emptyNote}${rest}`;
  return `${counted} — ⚠ WORTH KEEPING: ${holding.map(describeKeptIgnored).join("; ")}${emptyNote}${rest}`;
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
  /**
   * IGNORED PATHS WORTH KEEPING, each measured on disk (#1823).
   *
   * ⚠ **THE FACT `dirtyFiles` CANNOT SEE, AND THE REASON 1.36 GB READ AS CLEAN.**
   * `git status` does not list ignored files, so this is a separate population
   * rather than more entries in that one — and it is separate in the VERDICT
   * too, because the refusal it earns names different acts (move it out, not
   * commit it).
   */
  readonly keptIgnored: readonly KeptIgnoredPath[];
  /**
   * The rest of the ignored population — `node_modules/`, `.env`, `dist/`.
   *
   * ⚠ **IT DECIDES NOTHING AND IS CARRIED ANYWAY, BECAUSE THE COUNT IS THE
   * PROOF THE READING HAPPENED.** Nothing here is ever refused on: these
   * regenerate, and a guard that fired on them would be `--force`d away on its
   * first week. What they buy is the printed line being able to say *two paths,
   * none worth keeping* rather than saying nothing — which is what the report
   * that lost the court said.
   */
  readonly disposableIgnored: readonly string[];
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
  /**
   * ⚠ THE REFUSAL THE CARD'S EVIDENCE ARGUES FOR, AND IT IS NARROWER THAN THE
   * CARD'S OWN SENTENCE — said here rather than left to be noticed (#1823).
   *
   * The card asked for the reading and a printed line and added *"Not as a
   * refusal by default"*, justifying it entirely with *"`node_modules`, `.vite`
   * and `dist` are ignored too and are genuinely disposable"*. That argument is
   * honoured exactly: nothing in `disposableIgnored` is ever refused on, and a
   * flat *ignored files present* refusal would have fired on every worktree this
   * program has cut. What it does not cover is the NAMED set the same sentence
   * goes on to ask for.
   *
   * **A printed warning cannot stop the reader this card is about.** The defect
   * was found when a SWEEP — not a seat — removed somebody else's tree and could
   * only ask the tool; a warning in a log read after the delete is invariant 7's
   * own failure (a control that does not block is not a control). So the kept set
   * refuses, `--force` clears it exactly as it clears the other two, and the
   * force path SAYS what it is destroying with the bytes in it.
   *
   * ⚠ **AND IT IS AFTER THE OTHER TWO ON PURPOSE.** Commits, then tracked work,
   * then artifacts: a worktree with all three gets the most valuable sentence
   * first, and a refusal naming renders over lost commits would send a shift to
   * copy a directory and `--force` past the commits.
   */
  /* ⚠ THE SUBSET THAT HOLDS SOMETHING, NEVER THE WHOLE NAMED SET (#2155). An
     `output/` measured at `0 B in 0 files` refused 15 of the 34 leftover
     worktrees on this machine, and a refusal a shift cannot act on is how 37 of
     them came to be standing with live junctions. `keptIgnoredHoldsWork` fails
     closed, so an unreadable or capped measurement still refuses here. */
  const keptHoldingWork = state.keptIgnored.filter(keptIgnoredHoldsWork);
  if (keptHoldingWork.length > 0 && !force) {
    const named = keptHoldingWork.map(describeKeptIgnored).join("; ");
    return {
      proceed: false,
      reason: `the worktree holds ignored work that is worth keeping: ${named}`
        + " — `git status` does not list ignored files, which is why this used to read as clean (#1823);"
        + " move it out, or pass --force to destroy it",
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
  /* ⚠ THE ONE SENTENCE A SWEEP OPERATOR WOULD HAVE WANTED ON 2026-10-03 (#1823).
     It names the paths and the bytes rather than a count, because the count is
     what the old report had: `uncommitted 0 file(s)` was a true number about the
     wrong population. */
  if (force && keptHoldingWork.length > 0) {
    warnings.push(
      `--force is destroying ignored work worth keeping: ${keptHoldingWork.map(describeKeptIgnored).join("; ")}`,
    );
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

// ---- the shared install's own lockfile ------------------------------------
/**
 * ⚠ **ONE `node_modules`, N TREES, AND IT CAN ONLY SATISFY THE ONES WHOSE
 * LOCKFILE IT WAS INSTALLED FROM (#2148, 2026-10-09).**
 *
 * Every shift worktree junctions `node_modules` at the main tree's real one —
 * the install is over a gigabyte and the overlap rule cuts two trees a night,
 * so copying it is absurd. The price is that the install is **shared mutable
 * state between trees that do not share a lockfile**, and nothing was reading
 * it: a dependency bump lands on `main`, every worktree cut afterwards
 * typechecks against the install from before it, and the red names files the
 * diff never touched.
 *
 * **Measured the day this was written.** `86c560c3` took cookie 2.0.1, which
 * renames `parse` to `parseCookie`. The shared install still held cookie 1.0.2,
 * so a worktree cut from `origin/main` reported three errors in
 * `server/_core/sdk.ts` and `server/routes/googleAuth.ts` — **both auth files,
 * neither of them anybody's diff** — while `pnpm check` in the main tree was
 * GREEN, because that tree was four commits behind and therefore agreed with
 * the stale install. Two relay agents hit it before it was carded.
 *
 * ⚠ **pnpm ALREADY RECORDS THE ANSWER AND NOTHING WAS READING IT** — the
 * disappearing-technology law's clause 4, pointed at a tool rather than a
 * model: `node_modules/.pnpm/lock.yaml` is pnpm's own copy of the lockfile it
 * installed from. So "does this install match this tree?" is a byte compare
 * against an artifact the installer already wrote, not a version census we
 * invent. No `pnpm` invocation, no network, no guess.
 *
 * ⚠ **AND THE READING IS NEVER AN INSTALL.** Refreshing the install is a
 * mutation under every other tree on the machine, and on the day this landed
 * it would have reddened a LIVE seat whose branch predated the bump and swapped
 * the dependencies under two running dev servers. So this reports, names the
 * one command, and names who else the command would move — the choice stays
 * with whoever can see whether the machine is quiet. A tool that silently
 * installed would be the convenient path and the wrong one.
 */
export const INSTALLED_LOCKFILE_RELATIVE = "node_modules/.pnpm/lock.yaml";

export function installedLockfilePath(repoRoot: string): string {
  return `${repoRoot}/${INSTALLED_LOCKFILE_RELATIVE}`;
}

/**
 * ⚠ **NORMALISED BEFORE COMPARING, AND THAT IS NOT DECORATION ON THIS
 * MACHINE.** `.gitattributes` says `* text=auto eol=lf`, so both files are LF
 * today and the compare would pass raw — but this very tool warns three steps
 * earlier that a checkout can arrive CRLF-SMUDGED, and a smudged
 * `pnpm-lock.yaml` would read as a skew against pnpm's LF copy on every tree
 * at once. That is a false alarm telling every shift to run a pointless
 * install, so the one line that cannot produce it is worth having. A trailing
 * newline is dropped for the same reason.
 */
function normaliseLockfile(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n+$/, "");
}

export type SharedInstallReading =
  /** The install was made from this tree's lockfile. Nothing to say. */
  | { readonly kind: "match" }
  /**
   * The question could not be answered — say which file and why, and do NOT
   * warn. A missing marker is what a tree with no install at all looks like,
   * and crying skew there would train the warning away.
   */
  | { readonly kind: "unreadable"; readonly why: string }
  /**
   * The install does not match this tree. `collisions` are the OTHER trees a
   * refresh would move off their own lockfile — the reason this is reported
   * rather than fixed in place.
   */
  | {
      readonly kind: "skew";
      readonly collisions: readonly string[];
      /**
       * ⚠ WHETHER THE REPAIR COMMAND WOULD ACTUALLY REPAIR THIS — the question
       * the first cut of this reading did not ask (#2148, round 2).
       *
       * `pnpm install` installs the lockfile of the tree it is RUN IN. The
       * printed command names the tree this tool was launched from, and that
       * tree can be on a different commit from the worktree just cut — `add`
       * creates the worktree from `origin/main`, never from the launching
       * tree's HEAD. When the two disagree the command produces the launching
       * tree's dependency list and the skew just reported survives it.
       */
      readonly repairTree: "same-lockfile" | "different-lockfile" | "unreadable";
    };

/**
 * Pure: the three readings, from text that is already in hand.
 *
 * `otherTrees` carries every other checkout sharing the install, each with its
 * own lockfile text (`null` when it could not be read — unknown, so never
 * counted as a collision, because a guessed collision argues against the one
 * command that fixes the tree in front of you).
 *
 * ⚠ **`repairTreeLock` IS THE LOCKFILE OF THE TREE THE PRINTED COMMAND NAMES,
 * AND IT WAS IN `otherTrees` ALL ALONG WITHOUT BEING ASKED (#2148, round 2).**
 * The launching tree was read, compared, and counted as one collision among 36
 * — and then the warning told the shift to run `pnpm install` in it without
 * ever saying that doing so produces THAT tree's dependency list. Measured on
 * this machine the hour this was written, three lockfiles and no two alike:
 * the install was made from `04d1a5fd…`, the launching tree holds `24d2c74c…`,
 * and `origin/main` — which is what `add` cuts from, so it is the new
 * worktree's — holds `be7c3b77…`. The named repair moves the install from the
 * first to the second; the worktree needs the third. Same class as the verdict
 * that discarded `measureTree`'s own measurement (#2155): a decision that does
 * not read a fact the code is already holding.
 */
export function judgeSharedInstall(state: {
  readonly installedLock: string | null;
  readonly treeLock: string | null;
  /** The lockfile of the tree the printed `pnpm install` would run IN. */
  readonly repairTreeLock: string | null;
  readonly otherTrees: readonly { readonly path: string; readonly lock: string | null }[];
}): SharedInstallReading {
  if (state.treeLock === null) {
    return { kind: "unreadable", why: "this worktree has no pnpm-lock.yaml to compare" };
  }
  if (state.installedLock === null) {
    return {
      kind: "unreadable",
      why: `the shared install records no lockfile at ${INSTALLED_LOCKFILE_RELATIVE} — nothing to compare it against`,
    };
  }

  const tree = normaliseLockfile(state.treeLock);
  if (normaliseLockfile(state.installedLock) === tree) return { kind: "match" };

  const collisions = state.otherTrees
    .filter((other) => other.lock !== null && normaliseLockfile(other.lock) !== tree)
    .map((other) => other.path);
  /* ⚠ UNREADABLE IS ITS OWN ANSWER, NEVER "same" (#2148, round 2). Falling back
     to the friendly reading is how the command came to be printed as a repair
     in the first place: a sentence that is always confident is never wrong-
     looking. A tree whose lockfile cannot be read gets a warning that says the
     repair was not checked, which is one honest sentence rather than a guess. */
  const repairTree = state.repairTreeLock === null
    ? "unreadable" as const
    : normaliseLockfile(state.repairTreeLock) === tree
      ? "same-lockfile" as const
      : "different-lockfile" as const;
  return { kind: "skew", collisions, repairTree };
}

/**
 * The lines `add` prints for a skew. Kept here with the judgement so the words
 * a shift reads are driven by the same suite as the verdict — a warning whose
 * text nothing tests is a warning that can lose its command.
 *
 * ⚠ **IT STATES THE COUNT AND NEVER THE LIST, AND THAT WAS MEASURED ON THIS
 * MACHINE RATHER THAN REASONED.** The first shape of this printed every
 * colliding tree's path. Driven through the real `add`, it printed **36 of
 * them** — nearly all leftover shells from three days earlier, each a genuine
 * checkout with a genuine older lockfile, so the judge was right and the output
 * was a wall. A shift cannot act on 36 paths; it learns to scroll past the
 * block, which is the same death the CRLF control exists to prevent arriving by
 * a different door. The arms could not catch it, because an arm picks two
 * fixtures and two paths read fine — the real output caught it, which is
 * working law 6 pointed at a terminal instead of a screen.
 *
 * So the words carry the two things a shift can act on — **how many** other
 * trees the repair would move, and **the commands that show which of them is
 * alive** — and the paths stay on the verdict, where a caller that wants them
 * can have them and a reader is not drowned in them.
 */
export function sharedInstallWarning(reading: SharedInstallReading, repoRoot: string): readonly string[] {
  if (reading.kind !== "skew") return [];
  const lines = [
    "⚠ THE SHARED node_modules WAS INSTALLED FROM A DIFFERENT LOCKFILE than this",
    "  worktree's. Expect `pnpm check` and `pnpm preflight` to go red naming files",
    "  your diff never touched. CI installs fresh, so the gate is unaffected.",
  ];
  /* ⚠ THE REPAIR IS NAMED ONLY WHERE IT IS ONE (#2148, round 2). `pnpm install`
     installs the lockfile of the tree it runs IN, and this tool's launching tree
     can sit on an older commit than the worktree `add` just cut from
     `origin/main` — which is the live state on this machine. A command printed
     under the word "repair" that leaves the red exactly where it was costs a
     shift the seven minutes it was written to save, and then teaches it to
     distrust the block. */
  if (reading.repairTree === "same-lockfile") {
    lines.push(`  repair: run \`pnpm install\` in ${repoRoot}`);
  } else if (reading.repairTree === "different-lockfile") {
    lines.push(
      `  ⚠ AND \`pnpm install\` IN ${repoRoot} WOULD NOT REPAIR IT.`,
      "    That tree owns the install and is on a DIFFERENT lockfile from this",
      "    worktree, so installing there produces ITS dependency list and this",
      "    worktree stays red. It has to reach this worktree's commit FIRST, and",
      "    that is its owner's act, not a seat's — the main tree is shared with",
      "    live sessions.",
    );
  } else {
    lines.push(
      `  ⚠ WHETHER \`pnpm install\` IN ${repoRoot} WOULD REPAIR IT IS UNKNOWN — that`,
      "    tree's own pnpm-lock.yaml could not be read, and the install takes the",
      "    lockfile of the tree it runs in.",
    );
  }
  if (reading.collisions.length > 0) {
    lines.push(
      "",
      `  ⚠ BUT THE INSTALL IS SHARED, and ${reading.collisions.length} other tree(s) on this machine sit`,
      "    on a different lockfile — the repair above moves every one of them off",
      "    theirs. Check nothing is live first, and only then install:",
      "      npx tsx scripts/dev-servers.mts          (what is running, and from where)",
      "      npx tsx scripts/shift-worktree.mts list  (which trees those are)",
    );
  }
  return lines;
}

/**
 * ⚠ **THE WORDS FOR THE MOMENT THE RED ACTUALLY ARRIVES — `pnpm preflight`
 * (#2148, round 3, law 7's sweep on its own fix).**
 *
 * `sharedInstallWarning` above is printed ONCE, by `add`, and its own first
 * line predicts exactly this: *"Expect `pnpm check` and `pnpm preflight` to go
 * red naming files your diff never touched."* **Then the tool that goes red
 * said nothing.** So the instance was fixed at the door and the sibling — the
 * place every seat is sent before a push — was left, which is the class this
 * repository has paid for before: a warning at `add` time is read by the seat
 * that cut the tree, and the red is met by whoever is in it an hour later,
 * often after a `git merge origin/main` that no `add` ever ran.
 *
 * Measured on this machine the hour this was written, in a worktree cut from
 * `origin/main` by the real `add`: `npx tsc --noEmit` reports three errors in
 * `server/_core/sdk.ts` and `server/routes/googleAuth.ts` — **both auth files,
 * neither of them anybody's diff** — preflight stops there, and **six of its
 * nine checks are never reached.** A seat facing that either hand-assembles the
 * remaining six or skips them; both were recorded on #2148 this week.
 *
 * ⚠ **ONE JUDGE, TWO CALLERS, AND THE WORDS DIFFER BECAUSE THE MOMENT DOES.**
 * `judgeSharedInstall` is the only thing that decides, so there is no second
 * reader to drift (working law 4). What cannot be shared is the tense: `add`
 * says *expect a red*, and this is said with the red already on the screen —
 * printing a prediction of a thing that has just happened is how a block gets
 * learned as noise.
 *
 * ⚠ **AND IT IS PRINTED ONLY UNDER A RED.** A skew line on every green
 * preflight is the 36-path wall of round 1 arriving by a different door: the
 * block that is always there is the block nobody reads. `collisions` is
 * deliberately left empty by the preflight caller too — diagnosing one red is
 * this function's job, and planning a machine-wide refresh is `add`'s.
 *
 * `installOwner` is the tree that owns the real `node_modules`, **read and not
 * guessed**: a worktree's `node_modules` is a junction, so
 * `realpathSync` resolves it to the owning tree and the parent of that path is
 * the tree whose lockfile an install there would produce. That is the fact
 * `repairTree` needs, and in a worktree it is NOT the tree preflight is running
 * in — which is precisely the mistake round 2 of this card was about.
 */
export function sharedInstallRedDiagnosis(
  reading: SharedInstallReading,
  installOwner: string,
): readonly string[] {
  if (reading.kind !== "skew") return [];
  const lines = [
    "⚠ THIS RED MAY NOT BE YOUR DIFF. The shared node_modules was installed from a",
    "  DIFFERENT LOCKFILE than this tree's, so `pnpm check` reports errors in files",
    "  nobody touched. CI installs fresh, so the gate is unaffected — a green gate",
    "  over this red is the expected pair, not a contradiction.",
    `  The install lives in ${installOwner} and serves every worktree on this machine.`,
  ];
  if (reading.repairTree === "same-lockfile") {
    lines.push(
      `  repair: run \`pnpm install\` in ${installOwner} — it is on this tree's lockfile,`,
      "    so installing there produces the dependency list this tree needs.",
    );
  } else if (reading.repairTree === "different-lockfile") {
    lines.push(
      `  ⚠ AND \`pnpm install\` IN ${installOwner} WOULD NOT FIX IT. That tree owns the`,
      "    install and is on a DIFFERENT lockfile from this one, so installing there",
      "    produces ITS dependency list and this tree stays red. It has to reach this",
      "    tree's commit FIRST. Both steps, in this order, and never the first alone:",
      `      git -C ${installOwner} merge --ff-only origin/main`,
      `      pnpm install        # in ${installOwner}`,
      "    ⚠ THAT IS THE MACHINE OWNER'S ACT, NOT A SEAT'S — the tree is shared with",
      "    live sessions, and the first step alone moves it INTO this skew.",
    );
  } else {
    lines.push(
      `  ⚠ WHETHER AN INSTALL IN ${installOwner} WOULD FIX IT IS UNKNOWN — that tree's`,
      "    own pnpm-lock.yaml could not be read, and an install takes the lockfile of",
      "    the tree it runs in.",
    );
  }
  return lines;
}
