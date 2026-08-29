/**
 * THE CLOCKS FOR SUITES WHOSE SUBJECT IS HONESTLY SLOW.
 *
 * Vitest's default is five seconds. That default is a CONTROL — a logic test
 * that hangs for thirty seconds is a defect and the default is what says so —
 * so nothing here raises it globally. What lives in this file is the small set
 * of FAMILIES whose work genuinely takes longer than five seconds under load,
 * each named once, with the measurement that bought it.
 *
 * There is no list of any family's members anywhere. A list would be a second
 * source of truth that drifts from the call sites (working law 4). **The call
 * sites ARE the list.**
 *
 * ---------------------------------------------------------------------------
 * FAMILY 1 — A SUITE WHOSE SUBJECT IS IMPORT SHAPE MAY HONESTLY TAKE 30 SECONDS
 * ---------------------------------------------------------------------------
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
 * ---------------------------------------------------------------------------
 * FAMILY 2 — A SUITE THAT SWEEPS THE SOURCE TREE MAY HONESTLY TAKE 60 SECONDS
 * ---------------------------------------------------------------------------
 *
 * # ⚠ fable-233 §5's ruling above was RE-TESTED before this was added, and it HELD
 *
 * #233's scheduling half, measured by foreman-109 on 2026-08-30. The temptation
 * at this point is to raise the default for everybody, and the reading is what
 * says not to. Two full-suite runs of the same 10,302 tests, paired test by test
 * — one on a quiet machine, one with eight busy CPU loops stealing cores from
 * ~19 vitest forks on 20:
 *
 * | | |
 * |---|---|
 * | bare-default tests finishing under 1s **even loaded** | **9,950 of 9,988** |
 * | median contention factor (quiet → loaded) | **0.89×** — most tests got FASTER |
 * | p90 / p99 / max contention factor | **1.29× / 5.86× / 6.39×** |
 * | bare-default tests exceeding 4s under load | **ONE** |
 *
 * So contention does not slow the suite broadly; it slows a **thin tail** very
 * hard. A global raise would buy that tail at the price of every one of the
 * 9,950. The per-file opt-in is the right instrument and stays.
 *
 * # What the tail actually is
 *
 * The one casualty was `clientInputCaps`, at **5,016 ms against the 5,000 ms
 * clock** — 785 ms on the same suite run quiet, a **6.4×** blow-up. It reads
 * every `.ts`/`.tsx` under `client/src` off disk, several times over. Its
 * neighbour at 5.9× (`r7-evidence-ingestion-contract`) does the same kind of
 * work.
 *
 * That is a different family from family 1: not module transform, but **IO
 * against the tree**, which is what collapses when the disk and the cores are
 * both contended.
 *
 * # ⚠ Why the quiet-run duration is NOT the enrollment test
 *
 * Because it does not predict the casualty. `clientInputCaps` had **4,166 ms of
 * quiet margin** — comfortably outside the fourteen tests nearest the ceiling —
 * and fell anyway, while `characterSheet`, which has the *smallest* quiet margin
 * on the bare default (646 ms), got FASTER under load (0.7×). Enrollment here is
 * by measured casualty and by the shape of the work, never by a stopwatch on an
 * idle machine.
 *
 * # Why 60 seconds, and why that number was not chosen
 *
 * It is the repo's own precedent for this exact family, already hand-written in
 * four places before this helper existed — `scriptConnectionDiscipline`,
 * `castingV2CssEmitters`, `atlasMergeDriver`, `preCommitGate` all sweep the tree
 * and all carry `60_000`. This helper states the reason once instead of a fifth
 * time; it does not introduce a new value.
 *
 * ⚠ **The specimen that shows why memory is not enough**: `scriptExitDiscipline`
 * and `scriptConnectionDiscipline` are siblings, sweep the same directory, and
 * were written together — and only ONE of them carried the clock. Nothing was
 * wrong with either shift; the asymmetry simply had nowhere to show up.
 *
 * ---------------------------------------------------------------------------
 * ⚠ HAVING A CLOCK IS NOT THE SAME AS HAVING ENOUGH OF ONE
 * ---------------------------------------------------------------------------
 *
 * The second loaded run of 2026-08-30 — the one taken to prove the enrollments
 * above had worked — killed a file that was **already clocked**:
 * `pathB-hardening` at **15,004 ms against its own 15,000 ms**. So the family is
 * not "files without a clock"; it is "files whose clock is close to their work".
 *
 * Measured as UTILISATION (a file's slowest test ÷ its own clock), across every
 * clocked file in the suite, the population splits cleanly and there is no
 * middle:
 *
 * | utilisation | files | outcome under load |
 * |---|---|---|
 * | **67%** `pathB-hardening` | 1 | **FELL** |
 * | **51%** `pathB-completion` | 1 | survived at 74% of its clock |
 * | **≤48%** everything else | 23 | survived, most far under |
 *
 * The reason the safe ones are safe is visible in the same run: contention
 * inflates a suite by **1.2–1.5× when it is already slow** (architectureAtlas
 * 23.0s → 31.0s; scriptGuards 14.6s → 17.1s) but by **4.6–7.2× when it is
 * quick** (castingV2CssEmitters 2.9s → 18.0s; r7-evidence-package-e1 0.6s →
 * 4.3s), because what contends is fixed startup and transform cost rather than
 * the test's own arithmetic. A clock at the family value gives the quick suites
 * their 6× and the slow ones their 2×, which is why one number per family works
 * and a global default cannot.
 *
 * **So the enrollment question is never "is this file slow" — it is "how much of
 * its clock does it already use".** Both `pathB-*` files are 22 and 16
 * `await import()` calls apiece: family 1 exactly, carrying a hand-written
 * `15_000` that predated this helper and sat BELOW the family's own 30s.
 */
import { vi } from "vitest";

/** Thirty seconds, for a file whose tests are dominated by module loading. */
export const COLD_IMPORT_TIMEOUT_MS = 30_000;

/** Sixty seconds, for a file whose tests read the source tree off disk. */
export const TREE_SWEEP_TIMEOUT_MS = 60_000;

export function allowColdImports(): void {
  vi.setConfig({ testTimeout: COLD_IMPORT_TIMEOUT_MS });
}

export function allowTreeSweeps(): void {
  vi.setConfig({ testTimeout: TREE_SWEEP_TIMEOUT_MS });
}
