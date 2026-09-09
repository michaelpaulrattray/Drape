/**
 * THE TIMEOUT EVERY SUITE THAT DOES REAL WORK **IN PROCESS** DECLARES (#741).
 *
 * ⚠ **THIS IS `childProcessTimeout.ts`'S SIBLING, AND THE SIBLING WAS THE
 * BLIND SPOT.** #548 measured the mechanism exactly right and then scoped its
 * population to suites that **spawn a child process** — `git`, `tsc`, `npx`.
 * Its deriver therefore cannot see, and was never meant to see, a suite that
 * does its heavy work inside the vitest worker: a walk over the source tree, a
 * loop that compiles a hundred sheets, a `sharp` encode. Same starvation, same
 * `Test timed out in 5000ms`, same "a different set of arms each run" tell —
 * and no population that could hold it.
 *
 * MEASURED AT THE ARTIFACT, `server/castingV2` on `f88cd549`, 2026-09-10, five
 * consecutive runs of an unchanged tree:
 *
 *   run 1  maskedRefine · openLanePinning · uploadRefusalCopy
 *   run 2  one file (name not captured)
 *   run 3  hairStyles
 *   run 4  openLanePinning
 *   run 5  hairStyles · uploadRefusalCopy
 *
 * **Seven failure instances. Six were read at the error and all six are
 * `Test timed out in 5000ms` — not one assertion failure among them.** (The
 * seventh, `maskedRefine` in run 1, was not captured and is counted on the
 * family read rather than a reading; it is named here as such.)
 *
 * The per-arm numbers, from vitest's own JSON reporter over the same directory
 * — 5,590 arms, of which **exactly eight exceed 2 s**:
 *
 *   uploadRefusalCopy  "no file but the two that must hold it"   330 ms alone
 *                      → **5,855 ms** in the directory. **17.7×**, and RED.
 *   hairStyles         "reaches five distinct cuts"              185 ms alone
 *                      → **4,031 ms**. **21.8×** — it survived that run by
 *                      under a second, which is the flake rather than a pass.
 *   characterSheet     "keeps the export inside the envelope"    **3,629 ms**
 *   viewVocabulary     "is the only vocabulary the V2 surface"   **2,846 ms**
 *   faceScanService    "counts a key that was evicted"          15,197 ms —
 *                      PASSED; it carries a per-arm `30_000` already.
 *   typecheckGate      a real `tsc` over the casting tree       14,911 ms —
 *                      PASSED; declares `CHILD_PROCESS_TEST_TIMEOUT_MS`.
 *
 * ⚠ **SO THE TWO SLOWEST ARMS IN THE DIRECTORY ARE THE TWO THAT ARE GREEN, AND
 * THAT IS THE ARGUMENT.** Nothing here is about arms being slow. It is about a
 * 5,000 ms default, chosen for a mocked unit test, standing over an arm whose
 * cost multiplies by fifteen or twenty when 275 test files share one disk.
 *
 * TWO ROADS REJECTED, and both were rejected once already by #548 on the same
 * reasoning — recorded rather than re-argued: raising the GLOBAL `testTimeout`,
 * which buys this at the price of hiding a genuine hang in all 5,582 arms that
 * do not need it; and `--no-file-parallelism`, which charges every shift a
 * minute for a problem belonging to a dozen files.
 *
 * ⚠ **AND THE FIRST WAVE OF DECLARATIONS DID NOT CLOSE IT, WHICH IS THE MOST
 * USEFUL THING MEASURED HERE.** With sixteen suites declared, three more runs
 * of the same directory produced two files that had not appeared in the five
 * before-runs at all — `refineService` and `falRegionReader` — and both, read
 * at the error, were the same `Test timed out in 5000ms`. So the population was
 * re-derived from DURATIONS rather than shape: three runs, worst arm per file,
 * which found five more suites over a second and two that had gone red. All are
 * declared now (twenty-three files).
 *
 * ⚠ **THE THRESHOLD IS A FLOOR AND NOT A BOUNDARY, AND ONE FILE PROVES IT:
 * `falRegionReader.test.ts` PEAKED UNDER ONE SECOND ACROSS THREE RUNS AND
 * CROSSED FIVE IN A FOURTH.** The variance IS the phenomenon — `hairStyles`
 * ranged 185 ms alone to 7,758 ms contended, a factor of forty-two — so no
 * duration cutoff and no static shape can enumerate this class completely.
 * **What is claimed here is therefore a floor: every suite MEASURED to do real
 * work is declared, and the reading that found them is recorded so the next
 * shift extends it instead of re-deriving it.** If the directory reddens on
 * this class again, the decision to take is the GLOBAL raise #548 rejected —
 * and it should be taken with these numbers in front of it rather than by
 * declaring one more file.
 *
 * ⚠ **ONE COST OF THE DEFECT IS WORSE THAN A RED AND WAS NOT KNOWN BEFORE
 * TONIGHT: A TIMEOUT IN ONE ARM CAN MAKE ITS NEIGHBOUR FAIL AN ASSERTION.**
 * When `refineService`'s overlap arm timed out, the arm directly below it —
 * its own stated CONTROL — reported `expected [ 'lips', 'statedAccessories',
 * 'lips' ] to deeply equal [ 'lips' ]`, because the abandoned arm's calls were
 * still in flight against the shared barrier. **That red does not look like a
 * timeout and does not look like contention; it looks like a real defect in
 * the refine road**, and a shift would have gone looking for one.
 *
 * ⚠ **AND THE PER-ARM ROAD FAILED IN FRONT OF ME WHILE THIS WAS BEING PROVEN,
 * WHICH IS BETTER EVIDENCE THAN THE ARGUMENT FOR IT.** Four confirming runs
 * with twenty-three suites declared: three green, and the fourth red on
 * faceScanService.test.ts, at Test timed out in 5000ms, on the arm DIRECTLY
 * BESIDE the one that already carries a per-arm 30_000 from September. The
 * protected arm passed; its neighbour inherited nothing and starved. It is now
 * declared at file level like the rest (twenty-four files), and its per-arm
 * number is left where it is because that arm legitimately wants the ceiling
 * on its own account.
 */

/**
 * The floor for the class. **30 s, and it is the same figure by three
 * independent sizings rather than by copying one** — ~5× the worst contended
 * cost measured here (5,855 ms), the number #548 sized from its own worst arm
 * (9,087 ms), and the number `faceScanService.test.ts` already carries on the
 * arm whose docblock records the identical story. A genuine hang still fails,
 * in thirty seconds.
 *
 * ⚠ **IT IS A SEPARATE CONSTANT FROM `CHILD_PROCESS_TEST_TIMEOUT_MS` ON
 * PURPOSE, AND THAT IS NOT A MIRROR (working law 4).** The two are sized from
 * different measurements of different populations and are each free to move
 * without the other; what a mirror would be is a second list of the FILES, and
 * there is none — `sourceSweepSuites.ts` derives the population from the tree.
 * Where a file is in both populations, either declaration satisfies the guard,
 * because either one already lifts it off the 5 s default.
 *
 * Declared once per FILE, never per arm:
 *
 *     import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";
 *     vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });
 *
 * ⚠ **PER-ARM IS THE ROAD THAT LEAKS, AND THIS TREE HELD THE PROOF TWICE
 * BEFORE THE PROOF ARRIVED BY ITSELF.** `faceScanService.test.ts` protected
 * the one arm that went red in September and none of its neighbours — and one
 * of those neighbours then went red during this card's own confirming runs;
 * `changeRequestLabels.test.ts` protects one arm of many. A number typed onto
 * an `it(…)` is not inherited by the arm somebody writes beside it tomorrow. A
 * file-level declaration is. Both files carry one now.
 */
export const CONTENDED_TEST_TIMEOUT_MS = 30_000;
