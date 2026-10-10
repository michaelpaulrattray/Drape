/**
 * THE STALE-TREE SWEEP THE RITE RUNS BEFORE ITS FIRST CHECKOUT (#2212).
 *
 * Its own module rather than a function in `riteWorktree.mts`, because it
 * WALKS a directory (git's worktree admin entries) and then reads what it
 * listed — #223's class — and so reads every entry through the ENOENT-tolerant
 * helpers in `listedEntry.mts`. The recursive delete it may end in is NOT
 * written here: it goes through `riteWorktree.mts`'s `removeThrowawayDir`,
 * behind `readJunctionAt`, the one gate that module's header exists for.
 *
 * This is a MODULE (imported by the rite and by its suite) and it never exits.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, rmdirSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { readIfPresent, statIfPresent } from "./listedEntry.mts";
import { readJunctionAt, removeThrowawayDir } from "./riteWorktree.mts";

/**
 * How old a LOCKED rite tree must be before {@link sweepStaleRiteWorktrees}
 * takes it. `git worktree add` holds the lock only while it checks out, and the
 * slowest checkout measured on this machine is 29.6 s (#2212) — so fifteen
 * minutes is thirty times that, and a lock this old has no `add` behind it.
 */
export const STALE_RITE_LOCK_MS = 15 * 60_000;

export type StaleRiteSweep = {
  tree: string;
  verdict: "swept" | "kept-young" | "kept-junction-present" | "kept-real-node-modules" | "kept-unreadable" | "kept-remove-failed";
};

/**
 * TAKE DOWN THE `drape-rite-*` TREES A KILLED RUN LEFT LOCKED (#2212).
 *
 * `git worktree add` writes a `locked` marker into the registration while it
 * checks out and removes it when it finishes; #969 drove that `prune` honours
 * it. So a rite killed DURING the checkout — the slowest step it takes, and the
 * one a refused shift is most likely to interrupt — leaves a registration that
 * no prune will ever collect, beside a partial checkout that nothing will ever
 * delete. Three were standing on 2026-10-10, two of them another seat's, and
 * **clearing them took the rite's failure set from six arms to one**: each
 * refused run made the next refusal likelier. That is the worst shape a gate
 * can have, so the rite calls this before its first checkout.
 *
 * ⚠ **WHAT IT TAKES IS NARROW ON PURPOSE, AND EVERY CONDITION IS A REASON TO
 * KEEP:**
 *   - the tree is `<tmpRoot>/drape-rite-XXXXXX/tree` — the exact shape
 *     `inWorktreeOf` makes and nothing else (a seat's worktree, a review tree,
 *     a tree someone locked by hand elsewhere: never);
 *   - it is LOCKED — an unlocked registration is `prune`'s, and an unlocked
 *     tree with its directory standing may be a live body;
 *   - the lock is older than {@link STALE_RITE_LOCK_MS} — a sibling suite or a
 *     second checkout may be mid-`add` right now;
 *   - no `node_modules` LINK is left inside it once one has been unlinked, read
 *     through {@link readJunctionAt} — the predicate this module's header calls
 *     the thing standing between a sweep and the main checkout. A real
 *     directory or an unreadable one there is KEPT: an `add` lock is released
 *     before the junction is made, so neither is a shape this module produces.
 *
 * The directory goes through {@link removeThrowawayDir}, the one recursive
 * delete this module allows, behind the same gate.
 */
export const sweepStaleRiteWorktrees = (root: string, options: {
  tmpRoot?: string;
  now?: number;
  staleAfterMs?: number;
} = {}): StaleRiteSweep[] => {
  const tmpRoot = path.resolve(options.tmpRoot ?? os.tmpdir());
  const now = options.now ?? Date.now();
  const staleAfterMs = options.staleAfterMs ?? STALE_RITE_LOCK_MS;
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: "pipe" });
  const same = (a: string, b: string) => process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;

  const commonDir = path.resolve(root, git("rev-parse", "--path-format=absolute", "--git-common-dir").trim());
  const adminRoot = path.join(commonDir, "worktrees");
  let names: string[];
  try { names = readdirSync(adminRoot); } catch { return []; }

  const out: StaleRiteSweep[] = [];
  for (const name of names) {
    const adminDir = path.join(adminRoot, name);
    /* Read through the tolerant helpers (#223): a sibling's teardown can take
       an entry between the listing and the read, and that is "not ours", never
       a throw that ends the rite. */
    const lock = statIfPresent(path.join(adminDir, "locked"));
    const gitdir = readIfPresent(path.join(adminDir, "gitdir"));
    if (lock === null || gitdir === null || gitdir.trim() === "") continue; /* not locked, or not readable: not ours */
    const lockedAt = lock.mtimeMs;
    const tree = path.dirname(path.resolve(gitdir.trim()));
    const parent = path.dirname(tree);
    if (path.basename(tree) !== "tree") continue;
    if (!/^drape-rite-[A-Za-z0-9]{6}$/.test(path.basename(parent))) continue;
    if (!same(path.dirname(parent), tmpRoot)) continue;

    if (now - lockedAt < staleAfterMs) { out.push({ tree, verdict: "kept-young" }); continue; }

    const junction = path.join(tree, "node_modules");
    if (readJunctionAt(junction) === "link") {
      try { rmdirSync(junction); } catch {
        try { unlinkSync(junction); } catch { /* read again below */ }
      }
    }
    const at = readJunctionAt(junction);
    if (at === "link") { out.push({ tree, verdict: "kept-junction-present" }); continue; }
    if (at === "real") { out.push({ tree, verdict: "kept-real-node-modules" }); continue; }
    if (at === "unreadable") { out.push({ tree, verdict: "kept-unreadable" }); continue; }

    try { git("worktree", "unlock", tree); } catch { /* read the registration below */ }
    try { git("worktree", "remove", "--force", tree); } catch {
      try { git("worktree", "prune"); } catch { /* best effort */ }
    }
    if (statIfPresent(adminDir) !== null) { out.push({ tree, verdict: "kept-remove-failed" }); continue; }
    removeThrowawayDir(parent, junction);
    out.push({ tree, verdict: "swept" });
  }
  return out;
};
