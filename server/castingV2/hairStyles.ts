import type { AgeBand, HairColour, Sex } from "./castingIntent";
import type { HairTexture } from "../../shared/castingRealization";
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

/* -------------------------------------------------------------- texture */

/*
  Hoisted here from realizedAxes 2026-08-01 so the neighbourhood computation
  can read it without importing back into its own caller. Hair vocabulary in
  one module; realizedAxes re-exports what it needs.
*/
export const TEXTURE_BY_HERITAGE: Record<string, readonly (readonly [HairTexture, number])[]> = {
  Nordic: [["straight", 56], ["wavy", 34], ["curly", 10]],
  "British Isles": [["straight", 44], ["wavy", 36], ["curly", 20]],
  "Western European": [["straight", 44], ["wavy", 36], ["curly", 20]],
  Slavic: [["straight", 52], ["wavy", 34], ["curly", 14]],
  Mediterranean: [["wavy", 40], ["curly", 30], ["straight", 30]],
  "Middle Eastern": [["wavy", 38], ["curly", 32], ["straight", 30]],
  "East Asian": [["straight", 80], ["wavy", 18], ["curly", 2]],
  "South Asian": [["straight", 56], ["wavy", 34], ["curly", 10]],
  "West African": [["coiled", 74], ["curly", 24], ["wavy", 2]],
  "Afro-Caribbean": [["coiled", 60], ["curly", 32], ["wavy", 8]],
  Latino: [["wavy", 38], ["straight", 32], ["curly", 26], ["coiled", 4]],
  Polynesian: [["wavy", 44], ["curly", 34], ["straight", 22]],
};

export const TEXTURE_DEFAULT: readonly (readonly [HairTexture, number])[] = [
  ["straight", 42], ["wavy", 34], ["curly", 18], ["coiled", 6],
];

/* --------------------------------------------------------------- colour */

/**
 * Hair colour, conditioned on heritage — the trap in authoring hair at all.
 *
 * An unconditioned colour pick is a heritage-washing vector: it would cheerfully
 * hand a West African candidate blonde hair a third of the time, and that fights
 * `IDENTITY_INTEGRITY` head-on. So the weights are per-heritage, and grey/white
 * is not in them at all — it comes from age, because grey is something that
 * happens to a person rather than something they are born with.
 *
 * These are casting-pool plausibilities, not genetics. The point is that a sheet
 * looks like a room of real people.
 *
 * Widened 2026-08-01 to colourist resolution. The rare shades are deliberately
 * rare and deliberately conditioned: platinum and white-blonde occur naturally
 * at the Nordic end and effectively nowhere else, so they carry a few points
 * there and are absent everywhere else. Strawberry and copper are broken out of
 * "auburn", which had been doing the work of three colours.
 */
export const HAIR_COLOUR_WEIGHTS: Record<string, readonly (readonly [HairColour, number])[]> = {
  Nordic: [
    ["golden blonde", 20], ["ash blonde", 16], ["blonde", 10],
    ["brown", 16], ["dark brown", 12], ["strawberry blonde", 8], ["red", 6],
    ["copper", 4], ["auburn", 4], ["platinum blonde", 4],
  ],
  "British Isles": [
    ["brown", 22], ["dark brown", 20], ["chestnut", 12], ["blonde", 10],
    ["ash blonde", 8], ["red", 8], ["auburn", 8], ["copper", 6], ["strawberry blonde", 6],
  ],
  "Western European": [
    ["brown", 24], ["dark brown", 24], ["chestnut", 14], ["blonde", 12],
    ["golden blonde", 8], ["auburn", 9], ["copper", 5], ["red", 4],
  ],
  Slavic: [
    ["dark brown", 26], ["brown", 24], ["ash blonde", 16], ["blonde", 12],
    ["chestnut", 12], ["auburn", 6], ["red", 4],
  ],
  Mediterranean: [["black", 28], ["dark brown", 38], ["brown", 20], ["chestnut", 10], ["auburn", 4]],
  "Middle Eastern": [["black", 44], ["dark brown", 38], ["brown", 14], ["chestnut", 4]],
  "East Asian": [["black", 78], ["dark brown", 22]],
  "South Asian": [["black", 72], ["dark brown", 28]],
  "West African": [["black", 82], ["dark brown", 18]],
  "Afro-Caribbean": [["black", 78], ["dark brown", 22]],
  Latino: [["black", 38], ["dark brown", 40], ["brown", 16], ["chestnut", 6]],
  Polynesian: [["black", 80], ["dark brown", 20]],
};

export const DEFAULT_HAIR_COLOURS: readonly (readonly [HairColour, number])[] = [
  ["dark brown", 32],
  ["black", 24],
  ["brown", 22],
  ["chestnut", 10],
  ["blonde", 8],
  ["auburn", 4],
];

/**
 * The shade ladder, light to dark — what "adjacent" means for the pair-breaker.
 *
 * Only an ordering, not a second vocabulary: the pair-breaker walks outward
 * from a candidate's current colour and takes the nearest shade that is
 * genuinely in that candidate's own heritage palette. Grey and white are absent
 * on purpose. They are age facts rather than palette draws, so shifting one
 * would be quietly editing how old the person reads.
 */
export const SHADE_LADDER: readonly HairColour[] = [
  "platinum blonde",
  "ash blonde",
  "golden blonde",
  "blonde",
  "strawberry blonde",
  "copper",
  "red",
  "auburn",
  "chestnut",
  "brown",
  "dark brown",
  "black",
];

/**
 * The nearest shade to `colour` inside `palette` that passes `acceptable`.
 *
 * Walks outward one rung at a time and takes the first side that offers
 * something, with the starting direction chosen by seed so the sheet does not
 * always drift lighter. Returns null when the palette has nothing else to
 * offer — an East Asian sheet has two colours in it, and inventing a third is
 * exactly the heritage-washing the per-heritage weights exist to prevent.
 */
export function adjacentShade(
  colour: HairColour,
  palette: readonly (readonly [HairColour, number])[],
  seed: number,
  acceptable: (candidate: HairColour) => boolean,
): HairColour | null {
  const available = new Set(palette.map(([value]) => value));
  const at = SHADE_LADDER.indexOf(colour);
  if (at < 0) return null;

  const preferLighter = seed % 2 === 0;
  for (let step = 1; step < SHADE_LADDER.length; step += 1) {
    const sides = preferLighter ? [at - step, at + step] : [at + step, at - step];
    for (const index of sides) {
      const shade = SHADE_LADDER[index];
      if (shade && available.has(shade) && acceptable(shade)) return shade;
    }
  }
  return null;
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
