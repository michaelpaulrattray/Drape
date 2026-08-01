import type { AgeBand, HairColour, Sex } from "./castingIntent";
import type { HairTexture } from "../../shared/castingRealization";
import {
  MODIFIER_SLOTS,
  type HairModifiers,
  type HairStyle,
  type ModifierSlot,
  type SkinFinish,
  type WornState,
} from "../../shared/castingRealization";

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
const TIED_BACK: HairStyle = { name: "hair tied back", family: "long", worn: "tied back" };

/* Barbering vocabulary — ordinary in the real world, not statements. */
const FRENCH_CROP: HairStyle = { name: "french crop", family: "cropped" };
const CAESAR: HairStyle = { name: "caesar cut", family: "cropped" };
const BUZZ: HairStyle = { name: "buzz cut", family: "shaved" };
const SIDE_PART: HairStyle = { name: "side part", family: "short" };
const BOB: HairStyle = { name: "bob", family: "mid-length" };
const PONYTAIL: HairStyle = { name: "ponytail", family: "long", worn: "in a ponytail" };
const BUN: HairStyle = { name: "low bun", family: "long", worn: "worn up" };
/*
  Worn up, and ORDINARY (founder, 2026-08-01): "a street includes people whose
  hair is up". Ponytail, low bun and tied back were already here at ordinary
  weights; these two were the genuine gaps. Both sit outside the statement cap
  by construction — having your hair up is not a statement, and treating it as
  one is what made every sheet read as loose hair.
*/
const BUN_HIGH: HairStyle = { name: "bun", family: "long", worn: "worn up" };
const HALF_UP: HairStyle = { name: "half-up", family: "long", worn: "half-up" };

/* Textured cuts that carry their own texture by definition. */
const AFRO: HairStyle = { name: "afro", family: "coiled", texture: "coiled" };
const LOCS: HairStyle = { name: "locs", family: "long", texture: "coiled" };
const BRAIDS: HairStyle = { name: "braids", family: "long", texture: "coiled" };
const TWIST_OUT: HairStyle = { name: "twist-out", family: "mid-length", texture: "coiled" };
const CURLY_CROP: HairStyle = { name: "curly crop", family: "cropped", texture: "curly" };

/*
  Coiled hair worn UP — the gap the founder caught, and it contradicted the
  street ruling harder than the female list did: the coiled shelf had no
  up-style at all, so every West African and Afro-Caribbean sheet came back
  entirely worn out. These are the real names, not "coiled hair in a bun".
*/
const HIGH_PUFF: HairStyle = { name: "high puff", family: "coiled", texture: "coiled", worn: "worn up" };
const WRAPPED_BUN: HairStyle = { name: "wrapped bun", family: "coiled", texture: "coiled", worn: "worn up" };
const BRAIDED_UPDO: HairStyle = { name: "braided updo", family: "long", texture: "coiled", worn: "worn up" };
const PINEAPPLE: HairStyle = { name: "pineapple", family: "coiled", texture: "coiled", worn: "worn up" };

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

/*
  The up-styles are funded from WITHIN the long family, not from the sheet.

  The first attempt simply added them, which pushed long from 44 of 100 to 52
  and measurably narrowed the silhouette mix — the twin-breaker lost a pairing
  it used to reach on British Isles female sheets. The founder asked for
  people whose hair is up, not for more long hair. Family shares are therefore
  preserved exactly: long 44, mid-length 42, short 8, statements 6.
*/
const FEMALE_STYLES: StyleWeights = [
  // long — 44
  [SIMPLE_LONG, 15], [PONYTAIL, 10], [BUN, 7], [BUN_HIGH, 5], [HALF_UP, 4], [TIED_BACK, 3],
  // mid-length — 42
  [NATURAL_MID, 18], [SOFT_LAYERS, 14], [BOB, 10],
  // short — 8
  [PLAIN_SHORT, 8],
  // Statements: 6 of 100, untouched by the up-style additions.
  [PIXIE, 3], [WOLF, 2], [UNDERCUT, 1],
];

const NONBINARY_STYLES: StyleWeights = [
  [PLAIN_SHORT, 18], [NATURAL_MID, 17], [STANDARD_CROP, 13], [SOFT_LAYERS, 12],
  // Long funded from within its own family here too.
  [SIMPLE_LONG, 8], [TIED_BACK, 4],
  [BOB, 8], [SIDE_PART, 6], [BUZZ, 5],
  [PIXIE, 4], [UNDERCUT, 3], [WOLF, 2],
];

/**
 * Coiled-hair traditions, mixed in where heritage supports them.
 *
 * Share-conserved exactly as the long family was: the four up-styles are funded
 * from within the families they belong to, so the silhouette mix is unchanged
 * and only the vocabulary widens. Every family total is identical to before —
 * coiled 18, long 34, mid-length 22, cropped 20, shaved 6.
 *
 * The first attempt at the female list simply ADDED entries and narrowed the
 * silhouette mix without meaning to; the twin-breaker caught it. The lesson is
 * cheap to apply twice, and the arithmetic is written down here so the next
 * person can check it rather than trust it.
 */
const COILED_STYLES: StyleWeights = [
  // coiled — 18
  [AFRO, 9], [HIGH_PUFF, 4], [PINEAPPLE, 3], [WRAPPED_BUN, 2],
  // long — 34
  [BRAIDS, 16], [LOCS, 11], [BRAIDED_UPDO, 7],
  // mid-length — 22
  [TWIST_OUT, 22],
  // cropped — 20
  [CURLY_CROP, 12], [STANDARD_CROP, 8],
  // shaved — 6
  [BUZZ, 6],
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
    if (old && (style === TIED_BACK || style === BUN || style === BUN_HIGH || style === PLAIN_SHORT)) {
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

/* ------------------------------------------------- D10: the modifier layer */

/*
  Its own copy rather than an import from `realizedAxes`: that module already
  imports this one, and reaching back would close a cycle. Same shape, same
  law — a weighted list resolved by one named hash.
*/
type Weights<T extends string> = readonly (readonly [T, number])[];

function weightedPick<T extends string>(entries: Weights<T>, seed: number): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = seed % total;
  for (const [value, weight] of entries) {
    if (cursor < weight) return value;
    cursor -= weight;
  }
  return entries[entries.length - 1][0];
}

/**
 * The authored components of a cut — legacy's D10, restored.
 *
 * Every slot carries a null option at a deliberately heavy weight, because
 * "natural weights" means MOST people are not wearing all four. The founder's
 * own example is three: "long, curtain fringe, centre-parted, soft flyaways".
 * A candidate wearing every slot every time is a costume department, not a
 * street, and it would also crowd the one prompt line that carries the cut.
 *
 * Each slot hashes its OWN named string (`hairFringe`, `hairParting`, …) per
 * the collision law. Sharing one seed across four slots would correlate them —
 * every centre-parting arriving with the same fringe — which is the same
 * failure that made a whole gate's sheets quietly narrower.
 */
/*
  The null weights are the load-bearing numbers, and they were tuned DOWN from
  a first pass that had a fifth of every sheet wearing three or four components
  at once. Four clauses hung off one cut is a costume note, not a person, and
  it crowds the single prompt line that carries the cut itself. Measured bar:
  four candidates in five wear at most two.
*/
const FRINGE: Weights<string> = [
  ["", 68],
  ["a curtain fringe", 11],
  ["a soft side-swept fringe", 9],
  ["a blunt fringe", 6],
  ["wispy face-framing pieces", 6],
];

const PARTING: Weights<string> = [
  ["", 62],
  ["centre-parted", 15],
  ["side-parted", 15],
  ["a deep side parting", 8],
];

const VOLUME: Weights<string> = [
  ["", 74],
  ["with volume through the mid-lengths", 9],
  ["worn flat to the head", 8],
  ["lifted at the root", 9],
];

const FLYAWAYS: Weights<string> = [
  ["", 74],
  ["a few loose flyaways at the hairline", 13],
  ["baby hairs at the temples", 7],
  ["strands escaping where it is pinned", 6],
];

const SLOT_WEIGHTS: Record<ModifierSlot, Weights<string>> = {
  fringe: FRINGE,
  parting: PARTING,
  volume: VOLUME,
  flyaways: FLYAWAYS,
};

/**
 * What an ordinary cut can wear when it does not say otherwise.
 *
 * Shaved and cropped families are excluded from fringe and parting at the
 * FAMILY level as a floor — there is no fringe on a buzz cut and no parting on
 * a french crop — so a new entry added later cannot accidentally become
 * sayable. Entry-level `wears` narrows further; it never widens past physics.
 */
const ORDINARY_SLOTS: readonly ModifierSlot[] = ["fringe", "parting", "volume", "flyaways"];
const CLOSE_CROPPED_SLOTS: readonly ModifierSlot[] = ["flyaways"];

export function slotsFor(style: HairStyle): readonly ModifierSlot[] {
  if (style.wears) return style.wears;
  if (style.family === "shaved") return [];
  if (style.family === "cropped") return CLOSE_CROPPED_SLOTS;
  return ORDINARY_SLOTS;
}

/**
 * Resolve the components for one candidate's cut.
 *
 * PRESCRIBE TIER ONLY — the caller decides. In bias mode the prompt carries a
 * silhouette rather than a named cut, so authoring a fringe would put a detail
 * in the record that no prompt ever asked for. That is the ratified
 * record-truth rule, applied verbatim to the layer below the cut.
 */
export function resolveModifiers(
  style: HairStyle,
  seedFor: (axis: string) => number,
): HairModifiers {
  const allowed = new Set(slotsFor(style));
  const resolved = {} as HairModifiers;
  for (const slot of MODIFIER_SLOTS) {
    if (!allowed.has(slot)) {
      resolved[slot] = null;
      continue;
    }
    const picked = weightedPick(SLOT_WEIGHTS[slot], seedFor(`hair-${slot}`));
    resolved[slot] = picked === "" ? null : picked;
  }
  return resolved;
}

/**
 * The components as prose, in the order a person would describe them.
 *
 * Returns "" when nothing is worn, so the caller's sentence closes normally
 * rather than trailing a comma into nothing.
 */
export function describeModifiers(modifiers: HairModifiers | null): string {
  if (!modifiers) return "";
  const parts = MODIFIER_SLOTS.map((slot) => modifiers[slot]).filter(
    (value): value is string => Boolean(value),
  );
  return parts.length > 0 ? `, ${parts.join(", ")}` : "";
}


/* ------------------------------------------------------ worn state (4b) */

/**
 * Which worn states a silhouette can physically take.
 *
 * Legality by construction again: there is no "worn up" on a buzz cut, and the
 * way to guarantee that is for the shelf not to offer it. Cropped hair can be
 * pushed back but not gathered; mid-length can do everything except a proper
 * bun with any conviction.
 *
 * The null weights are what keep "loose" the commonest answer without it being
 * the ONLY answer — which was the whole defect. Hair that is up is ordinary,
 * not a statement, so it needs no cap and gets none.
 */
const WORN_BY_FAMILY: Record<string, Weights<WornState>> = {
  shaved: [],
  cropped: [],
  short: [["loose", 86], ["tied back", 14]],
  "mid-length": [["loose", 58], ["tied back", 16], ["in a ponytail", 14], ["half-up", 12]],
  long: [["loose", 44], ["in a ponytail", 18], ["worn up", 16], ["tied back", 12], ["half-up", 10]],
  coiled: [["loose", 62], ["worn up", 20], ["tied back", 18]],
};

/**
 * How this person is wearing it.
 *
 * Defers to the cut when the cut's own name already says it — a ponytail is
 * worn in a ponytail, and letting the axis contradict the name would put "a
 * bun, worn loose" into a paid prompt.
 *
 * `style` is null at BIAS tier, where there is no named cut and the family is
 * all we have. That is the case this axis exists for: it is silhouette-level,
 * so it can vary the eight in a mode where a named cut would compete with the
 * casting the user actually asked for.
 */
/** Every worn state this silhouette can physically take. */
export function wornStatesFor(family: string): readonly WornState[] {
  return (WORN_BY_FAMILY[family] ?? []).map(([value]) => value);
}

export function resolveWornState(
  family: string,
  style: HairStyle | null,
  seed: number,
): WornState | null {
  if (style?.worn) return style.worn;
  const shelf = WORN_BY_FAMILY[family] ?? [];
  if (shelf.length === 0) return null;
  return weightedPick(shelf, seed);
}

/** The clause, or "" when there is nothing to say. */
export function describeWornState(worn: WornState | null): string {
  return worn && worn !== "loose" ? `, ${worn}` : "";
}
