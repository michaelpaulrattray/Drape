/**
 * THE TIMEOUT EVERY SUITE THAT DRIVES A REAL CHILD PROCESS DECLARES (#548).
 *
 * ⚠ **A TOOL THAT REDDENS AT RANDOM IS A TOOL A SHIFT LEARNS TO IGNORE**, and
 * that is this card's whole subject. `pnpm preflight` runs a large slice of the
 * suite on a developer machine that is already running everything else the
 * shift is doing, and it is the FIRST thing a shift sees before it pushes. One
 * unexplained red teaches the next shift to skip the step, and then the
 * gate-runs-per-PR number preflight exists to move goes straight back up.
 *
 * A dozen suites spawn real `git`, `tsc` and `npx` processes. Alone they finish
 * comfortably inside vitest's 5,000 ms default; under the parallel load of the
 * full run they cross it and fail with `Test timed out in 5000ms` — a red with
 * nothing to do with the diff, and a DIFFERENT set of arms each run, which is
 * the tell that this is starvation and not a broken assertion.
 *
 * MEASURED AT THE ARTIFACT rather than reasoned about — the full 12,495-test
 * run on this machine, 2026-09-07:
 *
 *   server/nextUpEscalation.test.ts   4 arms FAILED — 9,087 / 7,406 / 5,376 /
 *                                     5,192 ms against the 5,000 ms default.
 *                                     Its other twenty arms passed at 1.8–2.9 s,
 *                                     which is the point: the whole FILE sits
 *                                     one bad moment from red, not four arms.
 *   server/atlasCommitHook.test.ts    arms at 6.9 / 6.9 / 6.4 / 6.1 s, all
 *                                     PASSED — that file already declares
 *                                     `{ timeout: 60_000 }` on its describes.
 *   server/typecheckOnCommit.test.ts  9.3 s, PASSED — every spawning arm there
 *                                     already carries `60_000`.
 *
 * ⚠ **THE CARD NAMED THAT LAST FILE AS THE SECOND INSTANCE AND IT WAS ALREADY
 * PROTECTED WHEN THIS WAS TAKEN.** The correction is the argument for the shape
 * of the fix rather than a quibble: the per-arm road WORKS and it LEAKS.
 * `typecheckOnCommit.test.ts` covers four of its eight arms; a hand-typed
 * number is not inherited by the arm somebody writes next to it tomorrow. A
 * file-level declaration is.
 *
 * TWO ROADS REJECTED, both on the card's own reasoning: raising the GLOBAL
 * `testTimeout`, which would hide a genuine hang everywhere in the suite; and
 * `--no-file-parallelism` in preflight, which trades a minute of every shift's
 * time for a problem belonging to a dozen files.
 */

/**
 * The floor for the class, sized from the measurement above rather than from
 * taste: the worst arm observed under full load is 9,087 ms, so this is ~3× the
 * measured worst case. A genuine hang still fails — in thirty seconds.
 *
 * ⚠ **A FLOOR, NOT A CEILING, AND THE PRECEDENCE WAS DRIVEN BEFORE IT WAS
 * RELIED ON** (vitest 4.0.18, both directions, 2026-09-07): a file-level
 * `vi.setConfig({ testTimeout })` DOES replace the 5 s default, and a per-arm
 * number DOES still win over it. So arms that legitimately need longer keep
 * their own explicit figure — `castingV2/typecheckGate.test.ts` runs a real
 * `tsc` over the whole casting tree in 40 s and declares `120_000`, and
 * `architectureAtlas.test.ts` builds two independent Projects in 33 s.
 *
 * Declared once per file, never per arm:
 *
 *     import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
 *     vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });
 *
 * `server/childProcessTestTimeouts.test.ts` derives the population that must
 * carry it, so the list cannot drift as suites are added.
 */
export const CHILD_PROCESS_TEST_TIMEOUT_MS = 30_000;
