/**
 * The realized identity axes — vocabularies only.
 *
 * These are the axes legacy assigned and V2 was leaving to the image model. An
 * axis nobody assigns does not come back varied; it collapses to the model's
 * single favourite default, which is why the large majority of casts came back
 * brown-eyed. The port audit predicted exactly that for eye colour and accepted
 * it; the founder found it in production, and the acceptance is withdrawn.
 *
 * Shared with the client for the same reason the core vocabularies are: a
 * hand-copied second list drifts, and the compiler is the only thing that
 * reliably keeps two lists in step.
 *
 * These are NOT intent fields. Nothing here is ever a lock the user wrote — a
 * stated value is honoured by deference (the brief's own words govern and no
 * realized line is emitted), exactly as stated hair already works. So they stay
 * out of the brief echo, which speaks locks, not realizations.
 */

import type { HairFamily } from "./castingVocabularies";

/**
 * Eye colour, at the resolution a casting director would use.
 *
 * The browns are deliberately several values rather than one. "Brown eyes" is
 * most of the world and rendering it as a single token is how eight candidates
 * end up with the same eyes — amber, honey, dark and near-black are as
 * different from each other as blue is from grey.
 */
export const EYE_COLOURS = [
  "pale blue",
  "blue",
  "grey",
  "green",
  "green-grey",
  "hazel",
  "amber",
  "honey brown",
  "brown",
  "dark brown",
  "near-black",
] as const;
export type EyeColour = (typeof EYE_COLOURS)[number];

/** Sex-gated and age-conditioned. Never assigned to women. */
export const FACIAL_HAIR = [
  "clean-shaven",
  "light stubble",
  "heavy stubble",
  "moustache",
  "short beard",
  "full beard",
] as const;
export type FacialHair = (typeof FACIAL_HAIR)[number];

/**
 * Hair texture, separate from family.
 *
 * The hair axis was silhouette-only — "long", "cropped", "shaved" — with
 * "coiled" the single value that carried any texture at all. Two candidates
 * could both be "long brown" and land as the same head of hair.
 */
export const HAIR_TEXTURES = ["straight", "wavy", "curly", "coiled"] as const;
export type HairTexture = (typeof HAIR_TEXTURES)[number];

/** Brow CHARACTER. The rendering protocol (A8) is separate and already ported. */
export const BROW_STYLES = [
  "full",
  "straight",
  "softly arched",
  "high-arched",
  "thin",
  "feathered",
  "brushed-up",
  "bleached",
] as const;
export type BrowStyle = (typeof BROW_STYLES)[number];

/**
 * Skin character — seasoning, not costume.
 *
 * Unstated skin came back uniformly clear. The weights are deliberately
 * conservative: a sheet should read like a street, where most faces are
 * unremarkable and a few carry something, rather than like a casting gimmick
 * where everybody has a distinguishing feature.
 */
export const SKIN_CHARACTERS = [
  "plain",
  "freckled",
  "lightly freckled",
  "a beauty mark",
  "visibly textured",
  "sun-weathered",
] as const;
export type SkinCharacter = (typeof SKIN_CHARACTERS)[number];

/** Everything realization fills in, as one object. */
export type RealizedAxes = {
  /*
    NULLABLE, and that is D-88 (founder ruling: it rides the D-79 re-ship,
    because it is the same deference-record-truth change).

    Hair deference nulls what it silences. Eye, brow and skin deference used to
    silence WITHOUT nulling, so a brief saying "green eyes" still persisted a
    fabricated eye colour — and a follow inherits the biology tier whole, so the
    fabrication travelled and could then COMPOSE, flipping the followed face's
    eyes away from what the brief asked for. Same class as every other record
    that lies; now it cannot be written.
  */
  eyeColour: EyeColour | null;
  /** The named cut. Carries its own coherent length and, sometimes, texture. */
  /*
    NULL when deference suppressed it. The persisted identity is the M7
    registry sole truth, so it must not carry a cut no prompt ever asked for —
    a shaved-head brief used to record hair: long, brown beside a prompt that
    said neither.
  */
  hairStyle: HairStyle | null;
  facialHair: FacialHair | null;
  hairTexture: HairTexture | null;
  /**
   * The cut's authored components, or null.
   *
   * Null in exactly the cases the cut itself is absent or unsaid: deference
   * suppressed the axis, or the sheet is in BIAS tier where the prompt carries
   * a silhouette rather than a named cut. A record that named a fringe no
   * prompt ever asked for is the same defect as a record naming a cut no prompt
   * carried, and that one is already ratified.
   */
  hairModifiers: HairModifiers | null;
  /**
   * Up, down, or somewhere between. Null when the family cannot wear it (a
   * buzz cut is not "worn up") or when deference silenced the whole axis.
   */
  wornState: WornState | null;
  browStyle: BrowStyle | null;
  skinCharacter: SkinCharacter | null;
};

/**
 * The registry M7's slice-zero enumerates.
 *
 * One list, so a sixth axis is added in one place and every consumer — the
 * follow anchor, the prompt composer, the distinctness tests, the M7 refactor —
 * picks it up without a special case.
 */
export const REALIZED_AXIS_KEYS = [
  "eyeColour",
  "hairStyle",
  "facialHair",
  "hairTexture",
  "hairModifiers",
  "wornState",
  "browStyle",
  "skinCharacter",
] as const;
export type RealizedAxisKey = (typeof REALIZED_AXIS_KEYS)[number];

/**
 * Named hairstyles, on legacy's D9 pattern.
 *
 * The realized hair axis varied over six coarse silhouettes — shaved, cropped,
 * short, mid-length, long, coiled — so unstated hair collapsed to the model's
 * default salon-neutral styling at each length. Eight candidates could all be
 * "mid-length brown" and arrive as the same haircut.
 *
 * **Legality lives in the entry, not a matrix.** Each style is authored as an
 * already-coherent combination: a pixie is short by definition, locs carry
 * their own texture, a bob cannot be very long. That is the entire job legacy's
 * D11 legality matrix existed to do, done by construction instead — there is no
 * way to express "buzz cut, very long, curtain bangs" because no entry says it.
 *
 * **The weights read like a street, not an editorial** (founder ruling).
 * Legacy's lists leaned stylish and every fourth candidate looked art-directed.
 * Ordinary cuts carry the bulk; statement cuts stay rare-but-possible. Same
 * lesson as legacy's silver-hair weighting: uniform randomness over stylish
 * options destroys plausibility.
 */
export type HairStyle = {
  name: string;
  /** The silhouette it implies — coherent by construction. */
  family: HairFamily;
  /** Set when the style dictates its own texture; else the axis decides. */
  texture?: HairTexture;
  /** Rare-but-possible. At most one per sheet is the taste target. */
  statement?: true;
  /**
   * Set when the cut's NAME already says how it is worn — a ponytail is worn
   * in a ponytail. The axis defers to it, exactly as it defers to `texture`,
   * so "a bun, worn loose" is unsayable rather than merely unlikely.
   */
  worn?: WornState;
  /**
   * Which authored components this cut can PHYSICALLY wear (catalog D10).
   *
   * Legality by construction, the same way `texture` works: a buzz cut has no
   * fringe and no parting, and the way to make that unsayable is for the entry
   * not to offer the slot — rather than generating "buzz cut, curtain fringe"
   * and hoping a validator catches it. Absent means "the ordinary set", which
   * is what most cuts wear; an explicit empty list means "none".
   */
  wears?: readonly ModifierSlot[];
};

/**
 * The modifier slots — legacy's D10 layer, restored.
 *
 * The D9 port took the named cuts and dropped the components that make a cut
 * belong to a PERSON. "Long hair" is a length; "long, curtain fringe,
 * centre-parted, soft flyaways" is somebody's hair. Legacy authored these and
 * the founder's eye caught their absence.
 */
/**
 * How the hair is WORN — the fourth confirmed unowned-axis collapse.
 *
 * Two founder observations that turned out to be one defect from opposite
 * ends. Open sheets never showed hair up: nothing authored the axis, so the
 * image prior answered it and its favourite answer is "down", eight times. And
 * a category follow converged on identical pulled-back editorial styling the
 * parent did not have: the bias prose said "how it is worn off the face, as
 * this casting wears it", handing the same axis to the CATEGORY prior — which
 * also has exactly one favourite answer.
 *
 * The law, now fourth-instanced: an axis nobody owns is not free, it is
 * decided by whichever prior is loudest, identically on every tile. Naming it
 * is what makes it vary.
 *
 * It is silhouette-level, which is why it is the one styling component legal
 * at BIAS tier — a named cut would compete with the casting the user asked
 * for, but whether the hair is up or down would not.
 */
export const WORN_STATES = [
  "loose", "tied back", "in a ponytail", "worn up", "half-up",
  /*
    F7 - an ordinary styling state with no entry, so it was unsayable by the
    dice in any world. A worn-state rather than a cut, which is why it is cheap:
    it composes on top of whatever the person already has.
  */
  "slicked back",
] as const;
export type WornState = (typeof WORN_STATES)[number];

/*
  `lineup` is F2's line-up finding, and it is a slot rather than a cut: the crisp
  edge-up sits ON TOP of waves, an afro, locs or a buzz and is what makes them
  read barbered rather than merely short. Legality by construction as ever - only
  entries that declare it in `wears` can carry one.
*/
export const MODIFIER_SLOTS = ["fringe", "parting", "volume", "flyaways", "lineup"] as const;
export type ModifierSlot = (typeof MODIFIER_SLOTS)[number];

/**
 * The resolved components, as ONE composite value rather than four axes.
 *
 * They are subordinate to the cut, not peers of it: they are nulled with it
 * under deference, re-resolved when it swaps, and legal only relative to it.
 * Four separate registry keys would mean four fields that every consumer has to
 * remember to null and re-resolve together — a discipline invariant repeated
 * across sites, which is the exact shape that produced the records that lied
 * about their own prompts. One null-partner cannot drift apart from itself.
 */
export type HairModifiers = {
  [K in ModifierSlot]: string | null;
};

/**
 * Skin finish — A9's engineered prose, re-homed.
 *
 * Legacy injected an authored finish on every generation and the founder
 * confirms those finishes produced visibly better skin. V2 kept only A3's
 * deferral sentence with no vocabulary behind it, which reads as generic studio
 * skin: the light block correctly refused to decide the sheen, and then nothing
 * else decided it either.
 *
 * Deliberately NOT per-candidate. A sheet is one casting call under one
 * lighting setup, so the finish is chosen once per roll by the archetype — the
 * framing law holds and eight candidates stay comparable.
 */
/**
 * The parts of "hair" a brief can speak to, separately — D-79's unit of "said".
 *
 * The doctrine is unchanged at its root: null means the brief did not say. What
 * changes is granularity. "Silver at the temples" states a colour fact; the cut,
 * the length and the texture remain unsaid and should still be authored, which
 * is what makes eight candidates eight people rather than one look repeated.
 *
 * Coverage is deliberately absent. "Shaved", "bald" and "buzzed" leave no
 * remainder to author — there is no cut on a bald man — so they suppress every
 * part at once rather than being a part of their own.
 */
export const HAIR_PARTS = ["cutLength", "colour", "texture"] as const;
export type HairPart = (typeof HAIR_PARTS)[number];

export const SKIN_FINISHES = [
  "matte",
  "natural",
  "dewy",
  "luminous",
  "oily",
  "weathered",
] as const;
export type SkinFinish = (typeof SKIN_FINISHES)[number];
