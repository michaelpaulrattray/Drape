/**
 * THE ONE RECIPE FOR "RUN THIS AGAINST THE TREE BEING PUSHED".
 *
 * The deploy rite has two custody checks that must see exactly what
 * `origin/main` will hold and NOT what the shift's working directory holds:
 * the script guards (#152) and the typecheck (#263). The shared main tree
 * carries hundreds of untracked disposables at any hour — measured on the
 * night #263 was built, `pnpm check` was RED there over **ten untracked
 * files** and GREEN on the commit itself — so a check run in place refuses
 * pushes over files that are in no commit. A guard whose refusal is a lie
 * about the push is friction with a good name, and friction on the only push
 * path is how a control gets `--anyway`'d out of existence.
 *
 * # Why this is a module and not copied twice
 *
 * The teardown is the dangerous part and it is the part that would be copied.
 * `node_modules` is reached through a junction, and **removing the tree
 * recursively through a live junction walks into the REAL `node_modules`** —
 * a known way to destroy the main checkout on this machine. That sequence is
 * written once, here, rather than in each caller.
 *
 * This is a MODULE (imported by the rite's helpers and by their suites) and it
 * never exits.
 */
import { execFileSync } from "node:child_process";
import { lstatSync, mkdtempSync, readdirSync, rmdirSync, rmSync, symlinkSync, unlinkSync, type Dirent } from "node:fs";
import os from "node:os";
import path from "node:path";

/* ⚠ A TYPE-ONLY IMPORT, AND THAT IS LOAD-BEARING (#2161). The verdict module is
   kept drivable without a disk — it takes readings, never paths — and a `type`
   import is erased at compile time, so it adds no runtime dependency in either
   direction. The alternative was a second copy of the union, which is working
   law 4 on the vocabulary of the gate above a recursive delete. */
import type { JunctionReading } from "./shiftWorktree.mts";

/**
 * What is at `p` — a LINK, a real entry, nothing, or a reading that could not
 * be taken?
 *
 * ⚠ `lstat` and NOT `existsSync`: a junction is a link, and `existsSync`
 * FOLLOWS it — a junction whose TARGET has gone reads as absent while the link
 * itself is still standing in the directory about to be removed recursively.
 * The question every caller asks is "is there still a LINK in the way", so the
 * reading must not follow.
 *
 * ⚠ **AND UNTIL #2161 IT ANSWERED A DIFFERENT QUESTION FROM THE ONE IT WAS
 * ASKED.** It was `stillOnDisk`, a boolean meaning *is there any entry here*,
 * and all three call sites fed it to a decision about a JUNCTION. Those two
 * questions agree on every tree this tooling creates — and they disagreed on
 * the only two it could not clear: `drape-review-1910` and `drape-review-1915`
 * each hold a `node_modules` that is a **real directory** (`lstat`
 * `isSymbolicLink()` false, 58 top-level entries, 824 directories, 0 files,
 * 0 bytes — an aborted install). `rmdir` removes an empty directory or unlinks
 * a reparse point and does neither to that, so `shift-worktree remove` refused
 * them with a message about a junction that was not there, and they could not
 * be taken down by the tool at all.
 *
 * **`lstat` already knew.** The old shape called `lstatSync` and threw the
 * returned stat away — a decision not reading a fact the code was already
 * holding, which is #2155's own fix one hop over, and the
 * disappearing-technology law's clause 4 pointed at a tool instead of a model.
 * So this returns the distinction rather than a boolean, and the widening is in
 * place rather than beside: a second reader here would be working law 4 on the
 * one predicate this module's header calls the thing standing between a sweep
 * and the main checkout.
 *
 * **Exported because there are THREE places that authorise a recursive delete
 * on this answer** (law 7's sweep, taken with #654 and re-taken with #2161):
 * this module's `removeThrowawayDir`, and `scripts/shift-worktree.mts` twice —
 * once to decide whether to unlink, once to prove no link remains. The verdict
 * ({@link JunctionReading}, `junctionMustBeGone`) lives in `lib/shiftWorktree.mts`,
 * which takes the reading rather than a path so it stays drivable without a
 * disk — a TYPE import is erased, so that property is unchanged.
 * `server/riteWorktree.test.ts` holds every call site to this declaration.
 */
export const readJunctionAt = (p: string): JunctionReading => {
  try {
    return lstatSync(p).isSymbolicLink() ? "link" : "real";
  } catch (error) {
    /* ⚠ ONLY "IT IS NOT THERE" MEANS ABSENT — a bare `catch { return "absent" }`
       reads an EPERM or EACCES on the link path as GONE and authorises the
       recursive delete, on the one predicate this module calls the thing
       standing between a sweep and the main checkout (PR #692 review,
       finding 2). The module's doctrine everywhere else is "when in doubt,
       keep"; this is the same polarity, at the one call that decides it.
       ⚠ And `unreadable` is deliberately NOT folded into `real` by #2161's
       widening: `real` is a permission to delete recursively, and an unknown
       must never become one. */
    return (error as NodeJS.ErrnoException)?.code === "ENOENT" ? "absent" : "unreadable";
  }
};

/**
 * What {@link measureTree} found. `capped` makes both figures a floor.
 *
 * ⚠ **`unreadable` IS THE FIELD THAT LETS A CALLER TRUST A ZERO, AND WITHOUT IT
 * NOBODY COULD (#2155).** `{ bytes: 0, files: 0 }` came back for three different
 * worlds — a directory that is genuinely empty, a directory this process may not
 * list, and a path that is a link — and a caller deciding whether anything would
 * be lost by deleting it cannot tell them apart. The one that is safe to act on
 * is the first; the other two are *when in doubt, keep*, which is this module's
 * doctrine everywhere else.
 *
 * ⚠ **AND THE DOCBLOCK BELOW CLAIMED `capped` SAID THIS AND IT DID NOT.** It
 * read *"the figures are a floor whenever that happens — which `capped` says"*
 * over the failed-`readdirSync` branch, while `capped` is set from the entry cap
 * alone. So an unlistable directory reported a confident zero with a comment
 * asserting it had been flagged.
 */
export type TreeMeasure = { bytes: number; files: number; capped: boolean; unreadable: boolean };

/**
 * ⚠ THE WALK CAP, AND IT IS HERE BECAUSE THIS MEASUREMENT RUNS FOUR LINES ABOVE
 * A RECURSIVE DELETE. An unbounded walk is its own hazard: a tool that hangs
 * while being asked whether a directory is worth keeping gets killed and re-run
 * with `--force`. 50,000 entries is far past anything the named kept set has held
 * (the 1.357 GB court that filed #1823 was 188 files) and well inside a second.
 */
export const MEASURE_ENTRY_CAP = 50_000;

/**
 * How many bytes in how many files a directory holds — the figure the removal
 * tool prints beside an ignored path worth keeping (#1823).
 *
 * **It lives here and not in `shiftWorktree.mts` for the same reason
 * `readJunctionAt` does**, and the header above is the whole argument: that
 * module takes numbers and readings so both directions of every verdict drive
 * without a disk. This is the disk half, beside the only other disk reading this
 * delete makes.
 *
 * ⚠ **IT NEVER FOLLOWS A LINK, WHICH IS THIS MODULE'S DOCTRINE AND NOT A
 * PRECAUTION.** libuv maps a Windows junction to `UV_DIRENT_LINK`, so
 * `isSymbolicLink()` is true for one and the walk stops at it — a measurement
 * that descended through the `node_modules` junction would walk the main
 * checkout's install to answer a question about a seat's `output/` directory.
 *
 * ⚠ **AND THE ROOT IS CHECKED THE SAME WAY, WHICH THE FIRST CUT OF THIS DID NOT
 * DO — the negative control in `server/shiftWorktree.test.ts` caught it on its
 * first run.** The per-entry test above only ever sees a link found INSIDE a
 * directory; `readdirSync` on a junction FOLLOWS it, so `measureTree(<the
 * junction>)` listed the real install and counted it. That is the exact shape of
 * the scar in this module's header, in a function added to stand beside it.
 *
 * A missing path is `0` rather than a throw: a caller asks about a path git has
 * just named, and the one-in-a-thousand race where it goes between the listing
 * and the walk must not turn a removal into an error.
 *
 * ⚠ **AND "MISSING" IS THE ONLY FAILURE THAT COMES BACK AS A TRUSTWORTHY ZERO
 * (#2155).** `ENOENT` means there is provably nothing there. Every other way of
 * failing to count — a stat refused for any other reason, a root that is a link,
 * a directory this process cannot list, a file it cannot size — sets
 * `unreadable`, because a caller four lines above a recursive delete must not
 * read *could not look* as *nothing to lose*.
 */
export const measureTree = (dir: string): TreeMeasure => {
  let bytes = 0;
  let files = 0;
  let seen = 0;
  let unreadable = false;
  /* The root, before anything reads through it. `lstat` and not `stat`, for the
     reason `readJunctionAt` above gives at length. */
  let root: ReturnType<typeof lstatSync>;
  try {
    root = lstatSync(dir);
  } catch (error) {
    /* ⚠ ENOENT is the one trustworthy zero: there is provably nothing there.
       Anything else is a refused read, and a refused read is not an empty
       directory (#2155). */
    const missing = (error as NodeJS.ErrnoException)?.code === "ENOENT";
    return { bytes: 0, files: 0, capped: false, unreadable: !missing };
  }
  if (root.isSymbolicLink() || !root.isDirectory()) {
    /* A link, or a plain file. A link is never walked; a file is its own size.
       ⚠ A LINK IS `unreadable` RATHER THAN EMPTY: nothing here was counted, and
       what it points at is outside this tree and unmeasured, so a caller asking
       *would anything be lost* gets the keep answer. */
    return root.isSymbolicLink()
      ? { bytes: 0, files: 0, capped: false, unreadable: true }
      : { bytes: root.size, files: 1, capped: false, unreadable: false };
  }
  const walk = (at: string): void => {
    /* `Dirent[]`, spelled out: `ReturnType<typeof readdirSync>` resolves to the
       Buffer overload and `entry.name` then stops being a string. */
    let entries: Dirent[];
    try {
      entries = readdirSync(at, { withFileTypes: true });
    } catch {
      /* Gone, or unreadable. Either way nothing here was counted, so the figures
         are a floor — and `unreadable` is what says so. `capped` never did, which
         is the comment this line used to carry (#2155). */
      unreadable = true;
      return;
    }
    for (const entry of entries) {
      if (seen >= MEASURE_ENTRY_CAP) return;
      seen += 1;
      const full = path.join(at, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.isFile()) continue;
      /* ⚠ A FILE THAT CANNOT BE SIZED IS A FILE THAT WAS THERE. Skipping it
         silently is how a directory holding one unreadable file reported zero. */
      try { bytes += lstatSync(full).size; files += 1; } catch { unreadable = true; }
    }
  };
  walk(dir);
  return { bytes, files, capped: seen >= MEASURE_ENTRY_CAP, unreadable };
};

/**
 * Remove the throwaway parent directory, falling back to a RECURSIVE removal
 * only once the junction is PROVEN gone at the disk (#654).
 *
 * ⚠ This is the module's dangerous act and the gate is the whole of it.
 * `rmSync(recursive)` through a live junction walks into the REAL
 * `node_modules` of the main checkout — the destruction this module's header
 * exists to warn about. So the fallback never runs on inference about which
 * teardown call threw; it runs on a positive read of the junction path, and
 * when that read says the link is still there the directory is LEFT (litter is
 * recoverable, the main checkout is not).
 *
 * Returns which of the three happened, so a caller — and the suite — can tell
 * "swept" from "left because it was not safe" from "left because the platform
 * refused", instead of reading a silent `catch`.
 */
export const removeThrowawayDir = (
  dir: string,
  junction: string | null,
): "removed" | "kept-junction-present" | "kept-unreadable" | "kept-remove-failed" => {
  /* The non-recursive removal first, unchanged: on the overwhelmingly common
     path `git worktree remove` has already taken the tree and this is the
     empty parent. */
  try { rmdirSync(dir); return "removed"; } catch { /* the tree is still inside */ }
  /* ⚠ THE SIBLING OF #2161, FOUND BY ITS LAW-7 SWEEP AND FIXED IN THE SAME
     COMMIT. This read `stillOnDisk(junction)` — *is there anything at the
     path* — and returned `kept-junction-present`, so a `node_modules` that is a
     REAL DIRECTORY (an aborted install; the measured state of both review
     shells) made this report a live junction standing in the way when none
     was. The polarity here is the safe one, so nothing was ever destroyed by
     it — what it produced instead is litter that can never be swept, with a
     verdict naming a cause that is not the cause. That is the same wrong
     answer the CLI gave, one module over, and leaving it would be the
     path-three shape this repository keeps paying for.
     `unreadable` keeps the directory for the reason the reading's own docblock
     gives: an unknown is not a permission. */
  if (junction !== null) {
    const at = readJunctionAt(junction);
    if (at === "link") return "kept-junction-present";
    /* ⚠ ITS OWN VERDICT, NOT `kept-junction-present` (#2161). The caller
       behaviour is identical — keep the directory — but the NAME is a claim,
       and "a junction is present" said over a path nobody could read is the
       confident-wrong sentence this module's own history is made of. The
       union's only production consumer discards it; the suite is the reader,
       and the suite should be able to tell the two apart. */
    if (at === "unreadable") return "kept-unreadable";
  }
  try { rmSync(dir, { recursive: true, force: true }); return "removed"; } catch { /* held open */ }
  return "kept-remove-failed";
};

/**
 * Check out `commit` detached into a throwaway worktree of `root`, junction
 * the root's `node_modules` into it, hand the tree's path to `body`, and tear
 * everything down again on every path — including when `body` throws.
 *
 * Throws if the worktree cannot be made. A caller that cannot see the tree is
 * blind, and blind must refuse rather than pass (invariant 7).
 */
/* `<T,>` and not `<T>`: in a `.mts` file the bare form is reserved syntax and
   tsc rejects it (TS7060). */
export const inWorktreeOf = <T,>(root: string, commit: string, body: (tree: string) => T): T => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "drape-rite-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  /* mkdtemp made the directory; `git worktree add` wants to create it, so it
     is handed a child that does not exist yet. */
  const tree = path.join(dir, "tree");
  let junction: string | null = null;
  try {
    /* --quiet: the checkout otherwise streams sixty lines of progress into the
       rite receipt, a durable record (seen on its first live firing). */
    git("worktree", "add", "--quiet", "--detach", tree, commit);
    junction = path.join(tree, "node_modules");
    symlinkSync(path.join(root, "node_modules"), junction, "junction");
    return body(tree);
  } finally {
    /* The junction goes FIRST and as a LINK: removing the tree recursively
       through a live junction walks into the real node_modules. On Windows a
       junction is a directory reparse point and `rmdir` takes it; on POSIX the
       "junction" type makes a plain symlink, which `rmdir` refuses (ENOTDIR)
       and `unlink` takes — so both are tried, and only an absent link is
       tolerated (review of #157, finding 1). */
    if (junction) {
      try { rmdirSync(junction); } catch {
        try { unlinkSync(junction); } catch { /* never made */ }
      }
    }
    try { git("worktree", "remove", "--force", tree); } catch { /* never added */ }
    try { git("worktree", "prune"); } catch { /* best effort */ }
    /* MEASURED: `remove --force` fails on ~6.7% of trees (120 driven, 8 left) —
       a sibling suite's `prune` unregisters a tree whose directory is still
       there, so the remove says "is not a working tree" and gives up. The
       non-recursive `rmdir` then fails too, because the tree is inside. That
       leak stood at 7.8 GB across 32 checkouts in %TEMP% when #654 measured it
       and had regrown to 4 within a day of being swept by hand.

       ⚠ THE SENTENCE ABOVE IS INCOMPLETE, AND THE MISSING HALF IS WHAT YOU
       WOULD ACTUALLY GO LOOKING FOR (#969, driven on git 2.55). A tree with
       BOTH its directory and its own `.git` file present SURVIVES a prune —
       so "whose directory is still there" is not by itself a state prune
       collects. Prune resolves each registration THROUGH the tree's `.git`
       pointer, and collects the registration when that cannot be resolved;
       the directory still standing does not prevent it. Both routes end at
       the same `"is not a working tree"`, which is why the symptom reads the
       same and the cause does not.

       ⚠ AND THE RACE THIS COMMENT INVITES YOU TO SUSPECT DOES NOT EXIST —
       settled so the next reader does not chase it a third time. Every
       throwaway tree here is named `tree`, so concurrent runs collide into
       `tree`, `tree1`, … and it is tempting to read a `tree1` in a failure as
       this global prune having raced a sibling's `add`. It cannot: `git
       worktree add` writes a `locked` marker into the registration while it
       is being built and prune honours it. Driven both ways on one
       registration (marked survives, unmarked is collected) and raced
       directly — 13 adds of a ~1.1 s checkout against 1,460 prunes from a
       second OS process, zero failures — after a positive control proved the
       harness could see a prune interfere at all. #969 closed on that. */
    removeThrowawayDir(dir, junction);
  }
};
