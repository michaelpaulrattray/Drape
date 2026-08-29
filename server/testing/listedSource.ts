/**
 * A FILE A LISTING NAMED CAN BE GONE BY THE TIME YOU READ IT (#223).
 *
 * # The refusal this ends, named rather than shrugged at
 *
 * On 2026-08-29 the deploy rite **refused a clean tree** and the push did not
 * fire. Receipt `output/deploy-receipts/2026-08-29T03-23-36-338Z-34268.txt`:
 *
 * ```
 *  FAIL  server/castingV2/uploadRefusalCopy.test.ts
 *  Error: ENOENT: no such file or directory, open
 *    '…\tree\scripts\_scriptworldguard-positive-control-32952-disposable.mts'
 * ```
 *
 * Re-run unchanged on the same commit: green. So it is a race, and it fails in
 * the expensive direction — a FALSE REFUSAL of the only push path the team has.
 * A shift that took it at face value would have shipped no briefing.
 *
 * # The mechanism
 *
 * `server/scriptWorldGuard.test.ts`'s positive control — and it is a good one —
 * plants a real unguarded script in the **real `scripts/` directory**, proves
 * the reader finds it, and unlinks it in `finally`. Its own comment reasons the
 * plant safe: *"The main assertion above filters to tracked files, so the plant
 * can never redden it, even mid-flight."* That reasoning is correct about its
 * own suite and **silent about every other one.** vitest runs test FILES in
 * parallel, and six other suites walk the same directory: they `readdirSync`
 * (the plant is present), then `readFileSync` each entry (the plant is gone).
 * ENOENT, thrown out of a `.filter()`.
 *
 * This is NOT #216's class. Those five tree-walking suites reddened on the 5 s
 * default timeout and were fixed with `{ timeout: 60_000 }`. This is a file
 * vanishing between the list and the read — a different failure wearing the
 * same symptom, which is why that sweep would not have caught it.
 *
 * # Why the fix is here and not at the planter
 *
 * Moving the plant into an `mkdtemp` copy was the cheaper candidate and it was
 * declined: the control's stated purpose is that *"a walk that silently stopped
 * reading … is indistinguishable from a fully guarded repository"*, which wants
 * the real tree, and `trackedScripts` relativises `git ls-files` output against
 * the repo root, so a temp root would need its own answer too.
 *
 * The reader's tolerance is right **independent of the plant**, which is the
 * argument that actually settles it: this working tree is shared by several
 * sessions and carries ~440 untracked disposables (#8). A file can leave
 * between the list and the read for reasons that have nothing to do with a
 * test. A walk lists, then reads; a file that is gone at the read was not part
 * of the tree at the moment of the reading, and skipping it is the CORRECT
 * answer rather than a tolerated failure.
 *
 * # The blind spot, named rather than left to be discovered
 *
 * Skipping is how a reader goes quiet. Two things bound it, and neither is a
 * promise:
 *
 * 1. **ENOENT only.** Every other error still throws — EISDIR, EACCES, a
 *    decoding failure. The negative control in this module's suite drives that
 *    directly, because a helper that swallowed everything would turn each of
 *    these guards green by making it blind (invariant 7).
 * 2. **The subjects are tracked files.** Every guard in the population filters
 *    to `git ls-files` output or asserts a named-file floor; a tracked file
 *    cannot vanish mid-run without a concurrent git operation on the tree, at
 *    which point nothing in the run is trustworthy anyway. And five of the
 *    seven callers carry their own "found the population at all" arm, so a
 *    reader that went genuinely blind reddens on its own floor rather than
 *    passing vacuously.
 *
 * # The list-side twin, which reading the code did not find and driving it did
 *
 * This helper covers the READ, and the first cut of the fix stopped there. A
 * driver that churned files through `scripts/` while the seven suites ran
 * (`scripts/_shift93-race-driver-disposable.mts`) showed the ENOENT surviving
 * in `scriptConnectionDiscipline.test.ts` — and it said **`stat`, not `open`**:
 * its walk classifies each listed entry with `statSync(full).isDirectory()`,
 * and an entry can be gone before it is even classified. That site now passes
 * `{ throwIfNoEntry: false }` and skips the empty answer, which is how
 * `queueOrdinalDiscipline.test.ts` has walked all along; the suite beside this
 * module refuses any class member that stats a listed entry without it.
 *
 * The lesson is worth more than the site: **the race is at every step that
 * touches a listed path, not only the read.** A fix aimed at the symptom in the
 * receipt covered one of the two shapes and looked complete.
 *
 * A stated limit that remains: a DIRECTORY vanishing between its parent's
 * listing and its own `readdirSync` would still throw. That has not been
 * observed here — the litter is files, at the top level — and inventing a guard
 * for a population nobody has measured is the thing this repository does not do.
 */
import { readFileSync } from "node:fs";

/**
 * Read a file a directory listing just named, as UTF-8.
 *
 * Returns `null` — and only — when the file is no longer there. Callers skip
 * the `null`; they must not treat it as empty content, which would read as a
 * file that holds nothing rather than a file that is not there.
 */
export function readListedSource(absolutePath: string): string | null {
  try {
    return readFileSync(absolutePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") return null;
    throw error;
  }
}
