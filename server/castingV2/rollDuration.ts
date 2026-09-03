/**
 * HOW LONG A SHEET TAKES — the receipt line's third value (#435, his brief 10
 * §2d, `docs/specs/Casting-ui-ux-design/drape-redesign/10-casting-hero-and-settings.md`).
 *
 * The hero's receipt line reads `8 CANDIDATES · 160 CR · ~50 SECONDS`, and his
 * rule for it is the reason this file exists rather than a literal in the
 * client: *"Derive all three from the same constants the roll uses. A
 * hand-written price that disagrees with the charge does the opposite of what
 * this line is for."* The count and the price already had server constants
 * (`CASTING_V2_COSTS.rollCandidateCount`, `CASTING_V2_ROLL_PRICE_CREDITS`); the
 * duration had none anywhere in the product, so it would have been the single
 * typed number on a line whose whole point is that nothing on it is typed.
 *
 * # It is a MEASUREMENT, and it carries its date
 *
 * Read on production 2026-09-03 over every completed roll operation —
 * `generation_operations` where `kind = 'castingV2.roll'`, wall time
 * `createdAt → completedAt`, **n = 234**:
 *
 *     min 35s · p25 42s · MEDIAN 47s · p75 53s · p90 64s · max 359s · mean 57.6s
 *
 * His brief writes `~40 SECONDS`, which the measurement does not support: the
 * fastest roll on record is 35s and better than three quarters of them overrun
 * 40. **50 is the nearest five-step at or above the median**, so the median and
 * everything under it beat the number a customer was given, which is the only
 * direction an estimate on a wait may be wrong in. The mean is higher than the
 * median because a handful of recovered rolls carry minutes of lease into the
 * figure; the median is what a person actually waits.
 *
 * ⚠ **A NUMBER LIKE THIS GOES STALE SILENTLY.** It describes the engine and the
 * queue depth of the day it was taken, and both move — the disappearing-
 * technology law's first clause, *"a model chosen well eighteen months ago is
 * not thereby chosen well now"*, is the same argument one layer down. Re-read it
 * with the query above when the roll engine, its concurrency or its provider
 * changes, and move the number rather than leaving a promise the product no
 * longer keeps.
 */
export const CASTING_V2_ROLL_TYPICAL_SECONDS = 50;
