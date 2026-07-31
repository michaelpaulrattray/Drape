import type { AgeBand, Sex } from "./castingIntent";
import type { HairStyle, SkinFinish } from "../../shared/castingRealization";

/**
 * The named-cut vocabulary, on legacy's D9 pattern, weighted for a street.
 *
 * **The taste ruling is the load-bearing part** (founder-approved). Legacy's
 * lists leaned stylish — quiffs and wolf cuts everywhere — and every fourth
 * candidate came out looking art-directed. Ordinary cuts carry the bulk of the
 * weight here; the statement cuts stay rare-but-possible. It is the same lesson
 * as legacy's silver-hair weighting, where a uniform pick over eight colours
 * gave silver and platinum a combined 25% and every fourth randomized cast read
 * grey: uniform randomness over stylish options destroys plausibility.
 *
 * **Legality is in the entry.** Each style is authored as an already-coherent
 * length and, where the cut dictates it, texture — a pixie is short by
 * definition, locs carry their own texture. Legacy needed a legality matrix
 * (D11) to stop "buzz cut, very long, curtain bangs" reaching a prompt; here
 * there is no way to say it, because no entry does.
 */

type StyleWeights = readonly (readonly [HairStyle, number])[];

/* The ordinary cuts. These carry the sheet. */
const PLAIN_SHORT: HairStyle = { name: "plain short cut", family: "short" };
const NATURAL_MID: HairStyle = { name: "natural mid-length", family: "mid-length" };
const SIMPLE_LONG: HairStyle = { name: "simple long hair", family: "long" };
const STANDARD_CROP: HairStyle = { name: "standard crop", family: "cropped" };
const SOFT_LAYERS: HairStyle = { name: "soft layers", family: "mid-length" };
const TIED_BACK: HairStyle = { name: "hair tied back", family: "long" };

/* Barbering vocabulary — ordinary in the real world, not statements. */
const FRENCH_CROP: HairStyle = { name: "french crop", family: "cropped" };
const CAESAR: HairStyle = { name: "caesar cut", family: "cropped" };
const BUZZ: HairStyle = { name: "buzz cut", family: "shaved" };
const SIDE_PART: HairStyle = { name: "side part", family: "short" };
const BOB: HairStyle = { name: "bob", family: "mid-length" };
const PONYTAIL: HairStyle = { name: "ponytail", family: "long" };
const BUN: HairStyle = { name: "low bun", family: "long" };

/* Textured cuts that carry their own texture by definition. */
const AFRO: HairStyle = { name: "afro", family: "coiled", texture: "coiled" };
const LOCS: HairStyle = { name: "locs", family: "long", texture: "coiled" };
const BRAIDS: HairStyle = { name: "braids", family: "long", texture: "coiled" };
const TWIST_OUT: HairStyle = { name: "twist-out", family: "mid-length", texture: "coiled" };
const CURLY_CROP: HairStyle = { name: "curly crop", family: "cropped", texture: "curly" };

/* Statement cuts. Rare-but-possible, at most one per sheet by weight. */
const QUIFF: HairStyle = { name: "quiff", family: "short", statement: true };
const UNDERCUT: HairStyle = { name: "undercut", family: "short", statement: true };
const FADE: HairStyle = { name: "high fade", family: "cropped", statement: true };
const WOLF: HairStyle = { name: "wolf cut", family: "mid-length", statement: true };
const PIXIE: HairStyle = { name: "pixie", family: "short", statement: true };
const SHAVED: HairStyle = { name: "shaved head", family: "shaved", statement: true };

const MALE_STYLES: StyleWeights = [
  [PLAIN_SHORT, 22], [STANDARD_CROP, 16], [SIDE_PART, 12], [NATURAL_MID, 11],
  [FRENCH_CROP, 9], [CAESAR, 7], [BUZZ, 7], [SIMPLE_LONG, 6], [TIED_BACK, 3],
  // Statements: 7 of 100 between them.
  [FADE, 3], [QUIFF, 2], [UNDERCUT, 1], [SHAVED, 1],
];

const FEMALE_STYLES: StyleWeights = [
  [SIMPLE_LONG, 20], [NATURAL_MID, 18], [SOFT_LAYERS, 14], [PONYTAIL, 11],
  [BOB, 10], [BUN, 9], [PLAIN_SHORT, 8], [TIED_BACK, 4],
  // Statements: 6 of 100.
  [PIXIE, 3], [WOLF, 2], [UNDERCUT, 1],
];

const NONBINARY_STYLES: StyleWeights = [
  [PLAIN_SHORT, 18], [NATURAL_MID, 17], [STANDARD_CROP, 13], [SOFT_LAYERS, 12],
  [SIMPLE_LONG, 11], [BOB, 8], [SIDE_PART, 7], [BUZZ, 5],
  [PIXIE, 4], [UNDERCUT, 3], [WOLF, 2],
];

/** Coiled-hair traditions, mixed in where heritage supports them. */
const COILED_STYLES: StyleWeights = [
  [TWIST_OUT, 22], [BRAIDS, 20], [AFRO, 18], [LOCS, 14],
  [CURLY_CROP, 12], [STANDARD_CROP, 8], [BUZZ, 6],
];

const COILED_HERITAGES = new Set(["West African", "Afro-Caribbean"]);

/**
 * Age nudges the list rather than replacing it: a wolf cut at seventy reads as
 * costume, and the tied-back and bun styles get commoner with age.
 */
function ageAdjust(entries: StyleWeights, ageBand: AgeBand): StyleWeights {
  const old = ageBand === "60s" || ageBand === "70s+";
  const young = ageBand === "teens" || ageBand === "20s";
  return entries.map(([style, weight]) => {
    if (style.statement) return [style, old ? Math.max(0, weight - 2) : young ? weight + 1 : weight] as const;
    if (old && (style === TIED_BACK || style === BUN || style === PLAIN_SHORT)) {
      return [style, weight + 4] as const;
    }
    return [style, weight] as const;
  });
}

export function stylesFor(sex: Sex, heritage: string, ageBand: AgeBand): StyleWeights {
  const base = COILED_HERITAGES.has(heritage)
    ? COILED_STYLES
    : sex === "male"
      ? MALE_STYLES
      : sex === "female"
        ? FEMALE_STYLES
        : NONBINARY_STYLES;
  return ageAdjust(base, ageBand);
}

/**
 * A9's engineered finish prose, re-homed.
 *
 * The single word is not the craft — the expansion is. Legacy's matrix said
 * what "matte" actually means to a camera ("skin absorbs light rather than
 * reflecting it. NO specular hotspots, NO oil sheen"), and without that the
 * word rides alone and renders as nothing in particular. Same pattern as the
 * H12 age idioms and the D1 iris descriptions.
 */
export const FINISH_RENDER: Record<SkinFinish, string> = {
  matte: "velvet matte finish — the skin absorbs light rather than reflecting it. No specular hotspots, no oil sheen, no wet or dewy appearance anywhere on the face.",
  natural: "natural finish — a faint sheen on the forehead and nose bridge only, matte through the cheeks. Skin that has been neither powdered nor oiled.",
  dewy: "dewy finish — hydrated, water-fresh skin with soft light bouncing off the cheekbones and the bridge of the nose. Moist rather than oily, and never greasy.",
  luminous: "luminous finish — lit from within, with a controlled high-point sheen across the cheekbones, brow bone and the top of the nose. Glass-clear but still pored and textured.",
  oily: "oily finish — genuine sebum sheen across the T-zone and the tops of the cheeks, with visible specular hotspots. Real skin at the end of a long day, not a beauty gloss.",
  weathered: "weathered finish — dry, sun-exposed skin with visible texture, roughened surface at the cheeks and a matte, hard-wearing quality. Light catches the texture rather than the surface.",
};

/** Words in a brief that state a finish, and what they map to. */
export const FINISH_WORDS: Array<[SkinFinish, string[]]> = [
  ["dewy", ["dewy", "hydrated", "glossy", "glowing", "glowy"]],
  ["matte", ["matte", "powdered", "flat"]],
  ["oily", ["oily", "greasy", "sweaty", "shiny", "sweat"]],
  ["weathered", ["weathered", "leathery", "windburned", "sunworn", "rugged"]],
  ["luminous", ["luminous", "radiant", "lit"]],
  ["natural", ["bare", "unretouched"]],
];

/** The finish a brief states, or null. */
export function statedFinish(text: string): SkinFinish | null {
  const words = new Set(text.toLowerCase().split(/[^a-z]+/));
  const found = FINISH_WORDS.filter(([, tokens]) => tokens.some((token) => words.has(token)));
  return found.length === 1 ? found[0][0] : null;
}
