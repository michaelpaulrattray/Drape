import type { ResolvedIdentity } from "./castingIntent";

/**
 * The sheet variance budget — a paid sheet where the pick doesn't matter
 * carries no information.
 *
 * THE SHEET THAT FORCED IT. A follow of a blonde candidate under "a females 23
 * high fashion editorial casting for Versace" came back an eight-way tie. Every
 * rule was individually correct:
 *
 *   - the follow anchored sex, heritage and hair colour;
 *   - the captured Versace direction locked the look flat across all eight;
 *   - the stated age locked the band;
 *   - the category put hair at silhouette tier, so no named cut varied.
 *
 * Four correct rules whose INTERSECTION left no axis alive that separates two
 * tiles at arm's length. Nothing was broken; the sheet was simply worthless,
 * and it cost the same as a good one.
 *
 * So this counts, after resolution and before composition, how many axes will
 * VISIBLY differ across the eight — and when the count is too low it releases
 * pressure in reverse-authority order, on the anchor and treatment tiers only.
 * The one thing it must never do is touch something the user stated: a sheet
 * that quietly varies a fact the brief pinned is a worse failure than a boring
 * sheet, because the boring one is at least honest.
 *
 * REGISTRY-SHAPED (M7 slice zero). It counts tag states through one list, so a
 * new axis is added in one place and the budget picks it up rather than needing
 * a new clause. That is deliberate: the defect it exists to catch is precisely
 * the one that appears when nobody is counting the whole set.
 */

/**
 * What a viewer can actually tell apart at tile scale.
 *
 * Not every axis in the identity — heritage PERCENTAGES differ constantly and
 * are invisible; `agePhase` inside one band shows only at the edges. The list
 * is what survives being looked at on a contact sheet, which is the only
 * measure that matters for the defect.
 */
export const VISIBLE_AXES = [
  "cut",
  "texture",
  "wornState",
  "facialHair",
  "heritage",
  "agePhase",
  "look",
  "eyeColour",
  "skinCharacter",
  "energy",
] as const;
export type VisibleAxis = (typeof VISIBLE_AXES)[number];

/** How many distinct values each visible axis carries across the sheet. */
export function countVisibleVariance(
  sheet: readonly ResolvedIdentity[],
): Record<VisibleAxis, number> {
  const distinct = (values: readonly unknown[]) =>
    new Set(values.map((value) => (value == null ? "∅" : String(value)))).size;

  return {
    cut: distinct(sheet.map((c) => c.realized?.hairStyle?.name ?? null)),
    texture: distinct(sheet.map((c) => c.realized?.hairTexture ?? null)),
    wornState: distinct(sheet.map((c) => c.realized?.wornState ?? null)),
    facialHair: distinct(sheet.map((c) => c.realized?.facialHair ?? null)),
    heritage: distinct(sheet.map((c) => c.heritage?.map((h) => h.heritage).join("+") ?? null)),
    agePhase: distinct(sheet.map((c) => c.agePhase ?? null)),
    look: distinct(sheet.map((c) => c.look ?? null)),
    eyeColour: distinct(sheet.map((c) => c.realized?.eyeColour ?? null)),
    skinCharacter: distinct(sheet.map((c) => c.realized?.skinCharacter ?? null)),
    energy: distinct(sheet.map((c) => c.energy ?? null)),
  };
}

/**
 * How many axes are doing real work.
 *
 * An axis counts when it carries at least two values — one value across eight
 * tiles is an axis that is present in the record and absent from the sheet.
 */
export function liveAxisCount(sheet: readonly ResolvedIdentity[]): number {
  const counts = countVisibleVariance(sheet);
  return VISIBLE_AXES.filter((axis) => counts[axis] >= 2).length;
}

/**
 * The floor.
 *
 * Three, and the number is a judgement rather than a derivation: the Versace
 * sheet had two (eye colour and skin character, neither of which reads at tile
 * scale on its own), and a sheet that differs on three visible axes is one a
 * founder can defend choosing from. Set higher and ordinary locked sheets start
 * fighting their own locks; set lower and the tie survives.
 */
export const VARIANCE_FLOOR = 3;

/**
 * What to release, in reverse-authority order.
 *
 * Reverse-authority is the whole safety argument: the loosest, least
 * user-owned thing gives first, and a stated lock never gives at all. Each rung
 * names a lever the resolver already has — this list is the ORDER, and the
 * resolver applies it.
 */
export const RELEASE_LADDER = [
  /** More of the eight drift their cut and worn state on a follow. */
  "widen-drift",
  /** Texture and worn state move even where the cut holds. */
  "loosen-styling",
  /** A wider secondary heritage on an unstated blend. */
  "widen-heritage",
  /** Early/mid/late inside a stated BAND, which the band does not pin. */
  "widen-age-phase",
  /** Stronger per-tile presence prose — the last thing that always varies. */
  "strengthen-presence",
] as const;
export type ReleaseRung = (typeof RELEASE_LADDER)[number];

/**
 * The plan for one sheet: how many rungs to spend, and whether to confess.
 *
 * Confession is not a failure mode, it is the honest one. If everything that
 * could separate the eight is something the user actually stated, then the
 * sheet genuinely cannot vary — and saying so BEFORE the roll is worth more
 * than spending their credits on eight near-copies and letting them find out.
 */
export type VariancePlan = {
  live: number;
  /** Rungs to apply, in order. Empty when the sheet is already varied enough. */
  release: ReleaseRung[];
  /** True when even the full ladder cannot reach the floor. */
  confess: boolean;
};

export function planVariance(sheet: readonly ResolvedIdentity[], headroom: number): VariancePlan {
  const live = liveAxisCount(sheet);
  if (live >= VARIANCE_FLOOR) return { live, release: [], confess: false };

  /*
    One rung per missing axis, capped by what the sheet can actually spend.
    `headroom` is how many rungs are legal on THIS sheet — a rung whose axis
    the user stated is not available, and the caller knows which those are.
  */
  const wanted = VARIANCE_FLOOR - live;
  const release = RELEASE_LADDER.slice(0, Math.min(wanted, headroom));
  return { live, release, confess: release.length < wanted };
}

/**
 * What the echo says when the sheet cannot vary.
 *
 * Before the roll, not after. The user is about to spend credits on eight
 * faces that will differ mainly in expression, and they are entitled to know
 * that while it is still a decision.
 */
export const VARIANCE_CONFESSION =
  "Most of this sheet is held — the eight will differ mainly in expression.";
