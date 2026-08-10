/**
 * A SUITE WHOSE SUBJECT IS IMPORT SHAPE MAY HONESTLY TAKE 30 SECONDS.
 *
 * # The flake this ends, named rather than shrugged at
 *
 * Seven full runs across one shift; four carried a failure; the failing set was
 * never the same twice — `batch3-hardening`, `wardrobe-vto`,
 * `geminiPhase2Migration`, `geminiPhase5Integration`, `emailVerification`,
 * `r7-snapshot-selection-contract`. Every one passed in isolation, which is what
 * kept it filed as "flaky" for two shifts.
 *
 * It is not an assertion failure and it never was. The captured block reads:
 *
 * ```
 * Error: Test timed out in 5000ms.
 *  ❯ server/batch3-hardening.test.ts:68
 *      const { accountRouter } = await import("./routes/account");
 * ```
 *
 * Every member of the family is a dynamic `import()` or a source read inside
 * vitest's default five seconds. Under full-suite parallel load on a developer
 * machine, cold-transforming a large barrel exceeds it — so the set roams with
 * whichever worker lost the race, and isolation always passes because nothing is
 * competing.
 *
 * # Why this is not a global raise, and not fewer workers
 *
 * fable-233 §5. A global raise weakens what "green" means for every suite in the
 * repo — a logic test that hangs for thirty seconds is a defect, and the default
 * is what says so. Fewer workers taxes every run to pay for six files. The
 * timeout belongs to the files whose subject genuinely IS a cold import, and to
 * no others.
 *
 * # Why a function rather than six copies of this paragraph
 *
 * Law 4. The prose lives once; each file that needs it says so in one line at
 * the top. There is no list of the family anywhere — a list would be a second
 * source of truth that drifts from the call sites. The call sites ARE the list.
 */
import { vi } from "vitest";

/** Thirty seconds, for a file whose tests are dominated by module loading. */
export const COLD_IMPORT_TIMEOUT_MS = 30_000;

export function allowColdImports(): void {
  vi.setConfig({ testTimeout: COLD_IMPORT_TIMEOUT_MS });
}
