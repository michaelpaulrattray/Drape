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
import { lstatSync, mkdtempSync, rmdirSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Does `p` still exist as an entry on disk?
 *
 * ⚠ `lstat` and NOT `existsSync`: a junction is a link, and `existsSync`
 * FOLLOWS it — a junction whose TARGET has gone reads as absent while the link
 * itself is still standing in the directory about to be removed recursively.
 * The question both callers ask is only ever "is there still a link in the
 * way", so the reading must not follow.
 *
 * **Exported because there are TWO places that authorise a recursive delete on
 * this answer** (law 7's sweep, taken with #654): this module's
 * `removeThrowawayDir`, and `scripts/shift-worktree.mts`, which feeds it to
 * `junctionMustBeGone`. That guard lives in `shiftWorktree.mts`, which has no
 * imports at all — it takes booleans so it can be driven without a disk — so
 * the READING cannot live beside it, and a second `lstat` helper over there
 * would be working law 4 on the one predicate that stands between a sweep and
 * the main checkout. `server/riteWorktree.test.ts` holds both call sites to
 * this declaration.
 */
export const stillOnDisk = (p: string): boolean => {
  try { lstatSync(p); return true; } catch { return false; }
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
): "removed" | "kept-junction-present" | "kept-remove-failed" => {
  /* The non-recursive removal first, unchanged: on the overwhelmingly common
     path `git worktree remove` has already taken the tree and this is the
     empty parent. */
  try { rmdirSync(dir); return "removed"; } catch { /* the tree is still inside */ }
  if (junction !== null && stillOnDisk(junction)) return "kept-junction-present";
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
       and had regrown to 4 within a day of being swept by hand. */
    removeThrowawayDir(dir, junction);
  }
};
