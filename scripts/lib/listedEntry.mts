/**
 * READING AN ENTRY THAT WAS THERE WHEN YOU LISTED IT (#589, #591).
 *
 * A tree walk lists a directory and then reads what it listed. Between those
 * two steps a file can leave — this repository carries ~440 untracked
 * disposables (#8), suites plant and unlink positive controls, and vitest runs
 * them in parallel. The ENOENT that results refuses the deploy rite on a clean
 * tree, which is what #589 was: `scriptWorldGuard.test.ts` plants a real file
 * in the real `scripts/` directory and unlinks it in `finally`, and the roster
 * walker saw the plant at `readdirSync` and missed it at `statSync`. It
 * refused the only push path twice on 2026-09-06 (receipts
 * `2026-09-06T04-57-28-138Z` and `2026-09-06T04-58-57-115Z`).
 *
 * ⚠ THE TOLERANCE IS ENOENT AND NOTHING ELSE. A helper that swallowed EISDIR
 * or EACCES would turn every sweep built on it green by making it blind —
 * invariant 7, and the failure mode this repository has already been bitten by
 * twice. `server/spendingScriptArguments.test.ts` drives both directions.
 *
 * ⚠ STATED LIMIT, as `server/testing/listedSource.ts` states its own: this
 * covers ENTRIES, not ROOTS. A directory that vanishes before `readdirSync`
 * still throws, and should — a walk whose root is gone has lost its subject.
 *
 * This module is the scripts-side twin of `server/testing/listedSource.ts`.
 * They are separate because neither tree may import the other's, and each
 * states that it is a twin so the pair cannot drift into being one rule told
 * two ways.
 */
import { readFileSync, statSync, type Stats } from "node:fs";

/*
  ONE catch for both helpers (PR #590 review, finding 2): with two hand-rolled
  try/catches the suite's EISDIR arm drove only the read helper, and a blinded
  stat catch would have stayed green. Shared, the one driven arm covers both.
*/
function enoentNull<T>(read: () => T): T | null {
  try {
    return read();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** `statSync` with #589's ENOENT-only tolerance. `null` means it left. */
export function statIfPresent(path: string): Stats | null {
  return enoentNull(() => statSync(path));
}

/** `readFileSync` with #589's ENOENT-only tolerance — see `statIfPresent`. */
export function readIfPresent(path: string): string | null {
  return enoentNull(() => readFileSync(path, "utf8"));
}
