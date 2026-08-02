/**
 * Category-implied tendencies — the SOFT cross-axis implications.
 *
 * Founder-approved taste batch. The observation behind it: a casting category
 * often knows something about an axis the brief never states. A Twitch streamer
 * casting is young; a K-pop idol casting is clean-shaven; a lumberjack casting
 * is not. When nothing says so, the axis draws from the general population and
 * the sheet comes back with a 58-year-old streamer on it.
 *
 * **They RE-WEIGHT, they never lock.** That distinction is the whole design and
 * it is the difference between this and a stated fact:
 *
 *   - a **hard** implication RESOLVES an axis, because leaving it open would
 *     manufacture a contradiction — a stated beard on an alternated sheet puts
 *     a beard on four women (shipped, `briefStatesSexCodedFacialHair`);
 *   - a **soft** implication only bends the odds, because a young-skewing
 *     category with a 50-year-old on it is *surprising*, not *wrong*. Casting a
 *     sheet with no room for the exception is how a category becomes a
 *     stereotype, and the heritage-draw ruling already forbids exactly that
 *     move in its own domain.
 *
 * So a tendency can never beat a stated fact, never appear in `LockFacts`,
 * never reach `validateLocks`, and never make a value impossible — every option
 * a candidate could have drawn is still reachable, just at different odds.
 *
 * **Closed vocabularies, so the interpreter cannot smuggle anything.** Both
 * fields are enums. This stage hands a language model influence over the
 * weights, which is exactly the kind of channel `CastingIntent` exists to keep
 * narrow, and an enum cannot carry a mug.
 */

import type { AgeBand, Heritage } from "./castingIntent";
import type { FacialHair } from "../../shared/castingRealization";

/**
 * The facial-hair lean is THREE-VALUED, by founder ruling.
 *
 * `any` is not the absence of a lean — it is a lean toward variety, and it has
 * to be distinguishable from "the category said nothing", which is null. The
 * lumberjack is the mirror of the idol: one category implies a beard as
 * strongly as the other implies none, and a two-valued field could only ever
 * express half of that.
 */
export const FACIAL_HAIR_LEANS = ["clean", "beard", "any"] as const;
export type FacialHairLean = (typeof FACIAL_HAIR_LEANS)[number];

export type PoolTendencies = {
  /** The band this casting centres on. Re-weights; the sheet still spreads. */
  ageLean: AgeBand | null;
  facialHairLean: FacialHairLean | null;
  /**
   * The heritage this casting's real pool draws from.
   *
   * **The boundary, recorded because it sits next to a hard ruling.** The
   * heritage-draw ruling forbids weighting the heritage draw to fix a TASTE
   * problem — "cast fewer of X" is never the answer to a sheet you dislike, and
   * that stands untouched. This is a different thing: a k-pop idol pool is
   * predominantly East Asian as a matter of demographic fact, exactly as a
   * Twitch streamer pool is predominantly young. Category-implied heritage is
   * pool demography; aesthetic-driven demographic tuning is what the ruling
   * bans. The test is whether the answer would change if we simply liked the
   * sheet more the other way — here it would not.
   *
   * Honest tails are therefore mandatory rather than decorative: Thai and
   * Chinese idols exist, and a sheet with no room for them is a stereotype
   * rather than a casting. Never a lock.
   */
  heritageLean: Heritage | null;
};

export const NO_TENDENCIES: PoolTendencies = {
  ageLean: null,
  facialHairLean: null,
  heritageLean: null,
};

/**
 * How much of the sheet the leaned heritage takes.
 *
 * Five or six of eight — a clear majority with two or three tiles genuinely
 * drawn from elsewhere. The tail is not a rounding artefact; it is the ruling,
 * and it is why this is a lean rather than a lock.
 *
 * NAMED LIMIT, and it belongs on the F6 flag: an honest k-pop tail wants a
 * SOUTHEAST ASIAN row, which the heritage vocabulary does not have. Until F6's
 * researched heritage workstream adds one, the tail draws from the general
 * cycle, which is wider than the truth rather than narrower — the safe
 * direction, and worth naming rather than quietly accepting.
 */
export const HERITAGE_LEAN_FLOOR = 5;
export const HERITAGE_LEAN_SPREAD = 2;

/**
 * How hard an age lean pulls.
 *
 * The leaned band and its immediate neighbours are boosted rather than the band
 * alone, because a casting is a neighbourhood and not a birthday: a Twitch sheet
 * should read early-twenties-ish, not eight people who are all exactly 24. The
 * neighbours getting a smaller share is what keeps the spread visible.
 *
 * Every other band keeps a real, non-zero weight. That is deliberate and it is
 * the ruling: an unusual casting is surprising, never impossible.
 */
const AGE_LEAN_CENTRE = 9;
const AGE_LEAN_NEIGHBOUR = 3;

const AGE_ORDER: readonly AgeBand[] = ["teens", "20s", "30s", "40s", "50s", "60s", "70s+"];

export function leanAgeWeights(
  base: readonly (readonly [AgeBand, number])[],
  lean: AgeBand | null,
): readonly (readonly [AgeBand, number])[] {
  if (!lean) return base;
  const centre = AGE_ORDER.indexOf(lean);
  if (centre < 0) return base;

  return base.map(([band, weight]) => {
    const distance = Math.abs(AGE_ORDER.indexOf(band) - centre);
    const multiplier = distance === 0 ? AGE_LEAN_CENTRE : distance === 1 ? AGE_LEAN_NEIGHBOUR : 1;
    // Integer weights: `weightedPick` walks a modulo cursor and a fraction
    // would put it between buckets.
    return [band, Math.max(1, Math.round(weight * multiplier))] as const;
  });
}

/**
 * How hard a facial-hair lean pulls.
 *
 * Per-VALUE rather than per-bucket, because the founder's bar is about the
 * clean-shaven value specifically: an idol casting that came back as eight men
 * in light stubble would satisfy a bucket rule and miss the point entirely.
 *
 * The bar is roughly seven of eight, and the multipliers are set to land there
 * on the 20s and 30s distributions rather than chosen for roundness. The
 * remaining share is real: one candidate in eight carrying stubble is the
 * exception the ruling insists stays reachable.
 */
const CLEAN_LEAN: Record<FacialHair, number> = {
  "clean-shaven": 14,
  "light stubble": 2,
  "heavy stubble": 0.15,
  moustache: 0.15,
  "short beard": 0.15,
  "full beard": 0.15,
};

const BEARD_LEAN: Record<FacialHair, number> = {
  "clean-shaven": 0.25,
  "light stubble": 1,
  "heavy stubble": 3,
  moustache: 1,
  "short beard": 6,
  "full beard": 6,
};

/**
 * `any` FLATTENS. It does not tilt toward beards.
 *
 * The first version multiplied the beard values up, which reads as a beard lean
 * with a friendlier name — and it measured that way, dropping clean-shaven to
 * six percent. "Either" is a request to SHOW THE RANGE, so the honest
 * implementation is a near-flat shelf rather than a nudge in one direction.
 *
 * Flat rather than uniform: a moustache alone is rare in life and reads as a
 * costume when one man in six has one, so it keeps its small share. That is a
 * plausibility floor, not a lean.
 */
const ANY_SHELF: readonly (readonly [FacialHair, number])[] = [
  ["clean-shaven", 20],
  ["light stubble", 20],
  ["heavy stubble", 20],
  ["short beard", 20],
  ["full beard", 15],
  ["moustache", 5],
];

const MULTIPLIERS: Record<"clean" | "beard", Record<FacialHair, number>> = {
  clean: CLEAN_LEAN,
  beard: BEARD_LEAN,
};

export function leanFacialHairWeights(
  base: readonly (readonly [FacialHair, number])[],
  lean: FacialHairLean | null,
): readonly (readonly [FacialHair, number])[] {
  if (!lean) return base;
  // The flat shelf replaces the age curve outright rather than scaling it —
  // scaling a curve that already leans clean at every band cannot flatten it.
  if (lean === "any") return ANY_SHELF;
  const multipliers = MULTIPLIERS[lean];
  return base.map(
    ([value, weight]) => [value, Math.max(1, Math.round(weight * multipliers[value]))] as const,
  );
}
