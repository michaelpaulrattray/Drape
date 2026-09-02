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
import { mkdtempSync, rmdirSync, symlinkSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

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
    try { rmdirSync(dir); } catch { /* the remove already took it */ }
  }
};
