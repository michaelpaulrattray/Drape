/**
 * HOW MANY VITEST WORKERS — vitest's own default rule, with a ceiling (#743).
 *
 * vitest's default is `availableParallelism() - 1` workers, so this 20-core
 * box runs **19** at once, and nine of the suites they run shell out to `tsc`,
 * the atlas generators or `git` on top of that (#233's diagnosis §2 named the
 * mechanism on 2026-08-30 — *"no pool limits"* — and nothing acted on it).
 * The result is not slowness, it is starvation: a synchronous child-process
 * arm that takes 14 s alone holds its worker for **428 s** in the full run,
 * and the cheap mocked assertion scheduled beside it crosses the 5 s default
 * while it waits.
 *
 * MEASURED, `pnpm test` on `61ae4786`, 807 files / 13,029 arms, this box
 * (20 cores, 32 GB, ~3 GB free beside the founder's own applications), JSON
 * reporter, 2026-09-12:
 *
 *   workers   wall                      red arms
 *   19        430 · 393 · 365 · 680 s    14 · 13 · 13 · 22  — every one a timeout, none an assertion
 *   12        265 s                      2
 *    8        179 · 236 · 429 · 301 s    1 · 1 · 8 · 2
 *    6        198 · 283 s                0 · 1
 *
 * The box's OTHER load moved during the sitting (the 429 s / 8 row at eight
 * workers and the 680 s / 22 row at nineteen were an hour after the first
 * rows, with Unity, Godot, Codex and a browser resident), which is why the
 * last two rows are a PAIR run back to back: same tree, same hour, **301 s and
 * 2 reds at eight against 680 s and 22 at nineteen.** Every pair reads the
 * same way. So a ceiling of 8 roughly halves the wall time and takes the reds
 * from a dozen to one or two — the opposite of the trade #741 rejected in
 * `--no-file-parallelism`, which charges every shift a minute to buy the same
 * quiet. The residual reds at 8 are the two heaviest synchronous child-process
 * arms (`architectureAtlas`'s freshness check, `selfInvocationCheck`'s
 * run-directly arm); no worker count fixes an arm whose own cost is a minute
 * on a loaded box, and that is a different card.
 *
 * ⚠ IT IS A CEILING ON THE DEFAULT, NOT A NUMBER. vitest takes `maxWorkers`
 * as given — a flat `8` would spawn eight workers on the gate's 4-core runner,
 * which today runs three and is green 38 of the last 40 runs. So the rule is
 * the default's own (`cores - 1`), ceilinged: 8 here, 3 on `ubuntu-latest`,
 * unchanged anywhere with nine cores or fewer. vitest's browser pool applies
 * the same shape to itself (`Math.min(12, numCpus - 1)`, *"the main thread
 * chokes"*), which is why a ceiling and not a percentage: `"50%"` would cut
 * the gate to two.
 *
 * ⚠ THE 76 PER-FILE DECLARATIONS THE CARD'S STEP 2 ASKED FOR WERE NOT MADE,
 * AND THE CARD SAID NOT TO MAKE THEM AT THIS COUNT. Three runs put 112 files
 * over one second and 76 of them undeclared — `referral`, `model-gallery`,
 * `signOutWording`, ordinary mocked suites that reach a second only because
 * nineteen workers starve them. Declaring a 30 s floor on a mocked unit test
 * is the global raise #548 rejected, one file at a time. Under the ceiling the
 * same reading is 39–45 files, and the ones that remain are the child-process
 * and tree-sweep suites that already declare.
 */
export const WORKER_CEILING = 8;

/** vitest's default (`cores - 1`, never below 1), capped at `WORKER_CEILING`. */
export const workerCap = (availableParallelism: number): number =>
  Math.min(WORKER_CEILING, Math.max(1, availableParallelism - 1));
