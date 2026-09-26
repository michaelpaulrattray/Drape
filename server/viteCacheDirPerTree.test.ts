/**
 * THE VITE AND VITEST CACHES ARE PER-TREE, AND A WORKTREE IS WHY (#1327).
 *
 * `scripts/shift-worktree.mts` junctions every worktree's `node_modules` at the
 * main tree's, because the install is over a gigabyte and one copy per seat is
 * not affordable. The consequence nobody wrote down until #1327: a cache under
 * `node_modules` is not per-tree at all — it resolves THROUGH the junction, so
 * every concurrent builder seat shares one dependency-optimizer cache and each
 * boot invalidates the last one's.
 *
 * ⚠ THE OBVIOUS FIX IS A NO-OP AND THAT IS WHAT THIS SUITE EXISTS TO PIN.
 * `path.resolve(import.meta.dirname, "node_modules/.vite")` looks per-tree, is
 * the value Vite already computes by default, and realpaths straight back to
 * the main tree. So an assertion that `cacheDir` is merely SET would pass on
 * the broken value. Both arms below therefore test the REALPATH, which is the
 * only reading that can tell the two apart — and `realpathSync` is what makes
 * it a measurement rather than a string comparison.
 *
 * The two configs are checked separately on purpose: `vitest.config.ts` does
 * not read `vite.config.ts`, so one line does not cover both, and a reader who
 * assumes it does would leave half the defect in place.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

/** Where a cache directory REALLY is, junctions followed. A directory that does
 *  not exist yet cannot be a junction, so its literal path is the answer. */
function realpath(target: string): string {
  return fs.existsSync(target) ? fs.realpathSync(target) : path.resolve(target);
}

const NODE_MODULES_REAL = realpath(path.join(REPO_ROOT, "node_modules"));

async function cacheDirOf(configPath: string): Promise<string> {
  const mod = await import(configPath);
  const config = mod.default as { cacheDir?: string };
  expect(
    config.cacheDir,
    `${path.basename(configPath)} declares no cacheDir, so it falls back to node_modules/.vite — which is the junction (#1327)`,
  ).toBeTruthy();
  return config.cacheDir as string;
}

describe("the vite and vitest caches are per-tree (#1327)", () => {
  for (const config of ["../vite.config.ts", "../vitest.config.ts"]) {
    const name = path.basename(config);

    it(`${name} puts its cache inside THIS tree`, async () => {
      const cacheDir = await cacheDirOf(config);
      expect(realpath(cacheDir).toLowerCase()).toBe(
        path.join(REPO_ROOT, ".vite").toLowerCase(),
      );
    });

    it(`${name}'s cache does not resolve through the node_modules junction`, async () => {
      const resolved = realpath(await cacheDirOf(config));
      // The assertion that actually catches the tempting fix: `node_modules/.vite`
      // inside a worktree realpaths to the MAIN tree, so a cache under the real
      // node_modules is shared however per-tree its literal path looks.
      expect(
        resolved.toLowerCase().startsWith(NODE_MODULES_REAL.toLowerCase()),
        `${name}'s cacheDir realpaths to ${resolved}, which is inside ${NODE_MODULES_REAL} — shared between every worktree`,
      ).toBe(false);
    });
  }

  it("the cache directory is gitignored, since it now sits outside node_modules", () => {
    // `**/node_modules` does not cover `.vite` any more, and an untracked cache
    // showing up in `git status` is how a seat comes to commit 17 MB of deps.
    const ignore = fs.readFileSync(path.join(REPO_ROOT, ".gitignore"), "utf8");
    expect(/^\.vite\/?$/m.test(ignore)).toBe(true);
  });
});
