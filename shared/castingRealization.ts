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
  eyeColour: EyeColour;
  facialHair: FacialHair | null;
  hairTexture: HairTexture;
  browStyle: BrowStyle;
  skinCharacter: SkinCharacter;
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
  "facialHair",
  "hairTexture",
  "browStyle",
  "skinCharacter",
] as const;
export type RealizedAxisKey = (typeof REALIZED_AXIS_KEYS)[number];
