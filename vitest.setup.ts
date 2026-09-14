/**
 * Vitest global setup — loads .env so tests see the same configuration the
 * server does (OAuth client IDs, feature flags, and the like).
 *
 * Two classes of credential are deliberately stripped, for the same reason:
 * `.env` is the *live* configuration, and a unit test that reaches live
 * infrastructure is not a unit test.
 *
 * **DATABASE_URL** points at the live Railway database. Unit tests must never
 * read from or write to it. Suites that need a database skip themselves when
 * it is absent; to run them, provide a disposable database via
 * `TEST_DATABASE_URL`.
 *
 * **Provider keys** (fal, OpenRouter, Gemini, Stripe, Resend…) spend real
 * money. This was not a hypothetical: when M5 swapped the deterministic brief
 * compiler for the real interpreter, the roll suite went from 17ms to 32
 * seconds because every run was making live OpenRouter calls against the
 * founder's account. Nothing failed, nothing warned — a green suite was
 * quietly billing. The fix belongs here rather than in each suite's mocks,
 * because remembering to inject a seam is exactly the discipline that fails
 * silently.
 *
 * A suite that genuinely needs a live provider asks for it by name:
 * `TEST_FAL_KEY`, `TEST_OPENROUTER_API_KEY`, and so on. Absent that, the
 * variable is gone and the code under test takes its unavailable path — which
 * is a path worth exercising anyway.
 */
import "dotenv/config";

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else {
  delete process.env.DATABASE_URL;
}

/**
 * Credentials whose absence the code already handles. Deleting them is the
 * strongest option: the module under test takes its unavailable path, which is
 * a path worth exercising anyway.
 */
const STRIPPED_CREDENTIALS = [
  "FAL_KEY",
  "OPENROUTER_API_KEY",
  "GEMINI_API_KEY",
  "KLAVIYO_PRIVATE_KEY",
  "ELEVENLABS_API_KEY",
] as const;

/**
 * Credentials that are read at *module construction* — `stripeService.ts`
 * builds its client on import, so deleting the key throws before a single test
 * runs and takes ~40 unrelated suites with it.
 *
 * These get an obviously-invalid sentinel instead. The module constructs, the
 * suites run, and any call that actually escapes to the provider fails
 * authentication rather than transacting. The sentinel is worded so that if it
 * ever shows up in a log or an error, it says what went wrong.
 */
const NEUTRALIZED_CREDENTIALS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
] as const;

const SENTINEL = "unit-tests-must-never-reach-a-live-provider";

for (const name of STRIPPED_CREDENTIALS) {
  const testScoped = process.env[`TEST_${name}`];
  if (testScoped) process.env[name] = testScoped;
  else delete process.env[name];
}

for (const name of NEUTRALIZED_CREDENTIALS) {
  const testScoped = process.env[`TEST_${name}`];
  process.env[name] = testScoped || SENTINEL;
}

/**
 * THE SUITE MUST MEAN THE SAME THING ON EVERY MACHINE — the scope flags are
 * stripped (opus-467, found the hard way).
 *
 * The header above says tests should see the server's configuration, feature
 * flags included, and for credentials that reasoning holds. For the casting
 * SCOPE flags it does the opposite: they are per-developer values that switch
 * whole roads on and off, so the same commit is green on one machine and red on
 * another. Setting `CASTING_REPAINT_SCOPE=users:1` in a local `.env` — the
 * production shape, and the obvious thing to do when reproducing the founder's
 * behaviour — turns eight `refineService` tests red, and not one of them is
 * about a defect.
 *
 * So the unit suite declares its own world: every road OFF unless the test
 * arms it, which every suite that cares already does with `vi.stubEnv`. That
 * makes the arming visible in the test rather than inherited from a file
 * nobody reads while reviewing a diff.
 *
 * **What this pins is also what it admits**: the suite asserts the flags-off
 * road. Coverage of the armed roads lives in the suites that arm them, and any
 * gap there is a gap, not something a local `.env` should paper over by
 * accident.
 */
for (const name of Object.keys(process.env)) {
  if (/^CASTING_[A-Z0-9_]*SCOPE$/.test(name)) delete process.env[name];
}

/**
 * ONE LIBVIPS THREAD PER WORKER — the suite already has its parallelism, and
 * the second helping was costing it (#965).
 *
 * `sharp.concurrency()` is never called anywhere in this repository, so libvips
 * takes its default of one thread per core: **20 on this box, inside each of
 * the 8 vitest workers.** Nobody chose that number; it is what a library picks
 * when it assumes it is the only thing running. It is `FAL_CONCURRENCY`'s shape
 * exactly — a provider default going unbounded until somebody measured it.
 *
 * ⚠ **AND THE SINGLE-ARM READING SAYS THE OPPOSITE OF THE POPULATION READING,
 * WHICH IS WHY THIS IS SET FROM THE SECOND ONE.** Counting OS threads under a
 * child doing the #962 casualty arm's own work — decode a 1.5 MB PNG, resize to
 * 120x160 — the ceiling is INERT: 19 threads at 20, 18 threads at 1, against a
 * positive control (a 3000x3000 resize plus blur) that reaches 41 and proves the
 * counter can see a ceiling bind. That one arm asks libvips for a single thread
 * whatever it is allowed. Across the 46 test files that genuinely import sharp
 * it binds plainly, and the whole difference lives in files nobody would have
 * picked by eye — a `grep` for large dimensions in those files returns 9000,
 * 4096 and 4000, and every one of them is an ASSERTION rather than a sharp call.
 *
 * MEASURED, this box (20 cores, 8 workers), 3 interleaved rounds per candidate,
 * 780 tests passing and 0 red in every arm:
 *
 *   ceiling   median wall   peak node threads
 *   today(20)    17.0 s           588
 *   4            15.3 s           500      -9.6%
 *   2            15.1 s           478     -11.1%
 *   1            14.5 s           463     -14.6%
 *
 * Monotonic, and 1's slowest round (14.8 s) is faster than every other
 * candidate's fastest. The reason it goes the way it does: vitest is ALREADY
 * running a worker per core, so a second thread inside libvips cannot find an
 * idle core to use — it can only add pool overhead and contention to cores that
 * are busy running other test files.
 *
 * ⚠ **ON THE WHOLE SUITE THE WIN IS MUCH SMALLER AND MUCH NOISIER, AND THAT IS
 * THE NUMBER TO QUOTE.** The 46 sharp files are 780 of 13,013 tests, so the
 * figure above is diluted. Pooled over **12 full-suite runs** (two instruments,
 * arms interleaved within each):
 *
 *   today   n=6   median 145.8 s   mean 147.2 s   range 141.7–157.6
 *   pinned  n=6   median 140.7 s   mean 141.0 s   range 138.6–144.1
 *                 -3.5% median, -4.2% mean — **and the ranges OVERLAP**
 *
 * The first instrument alone said 5.5% and the second said 1.8%; quoting either
 * would have been picking a run. **13,013 tests pass in every arm of both**, so
 * what is bought is a few seconds and a quieter thread pool, not a fix — this
 * is filed as a small measured win and nothing larger.
 *
 * ⚠ **IT IS NOT CLAIMED TO REDUCE RED RUNS.** One red appeared in one of the
 * six pinned runs and was not reproduced in six further runs across both arms;
 * the instrument that saw it did not capture its name, so what it was is
 * unknown. The suite's background flake rate is non-zero on today's state too —
 * #962 was exactly such a red without the pin. Red counts are reported here,
 * never interpreted: **0 reds in 3+3 on the second instrument, 1 red in 6
 * pinned and 0 in 6 today overall.**
 *
 * ⚠ **THE ENV VAR RATHER THAN `sharp.concurrency(1)`, AND THAT IS THE WHOLE
 * REASON THIS IS A LINE AND NOT AN IMPORT.** Calling the setter would mean
 * importing sharp's native binding into all 8 workers — including the ~750 test
 * files that never touch it. libvips reads `VIPS_CONCURRENCY` at its own init,
 * so this costs nothing to a worker that never loads sharp.
 *
 * ⚠ **IT CANNOT REACH A RUNNING SERVER, STRUCTURALLY.** This file is named only
 * by `vitest.config.ts`'s `setupFiles`; no server, script or client module
 * imports it, and nothing in `server/`, `client/`, `shared/` or the workflows
 * reads `VIPS_CONCURRENCY` at all — so the product's own image work keeps every
 * thread it has today. `server/sharpTestCeiling.test.ts` holds both halves: that
 * the ceiling really is 1 inside a test run, and that it stays test-only.
 *
 * ⚠ **THE NUMBERS ABOVE ARE THIS BOX'S.** The gate's runner is 4-core and runs
 * three workers (`server/testing/workerCap.ts`), where the default would be
 * 4 threads x 3 workers on 4 cores — oversubscribed by the same mechanism and
 * in the same direction, but the SIZE of the win there is unmeasured and is not
 * claimed. The one machine shape this reasoning would not hold for is a box with
 * fewer workers than cores, where libvips would have idle cores to use.
 */
process.env.VIPS_CONCURRENCY = "1";
