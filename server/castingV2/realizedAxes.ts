import {
  type AgeBand,
  type Hair,
  type HairColour,
  type Heritage,
  type HeritageComponent,
  type Sex,
} from "./castingIntent";
import { BEARD_BIAS_PROSE, type StylingResolution } from "./stylingResolution";
import {
  beardBucket,
  colourBucket,
  sameNeighbourhood,
  secondAxis,
  type BeardBucket,
  type ColourBucket,
} from "./heritageNeighbourhoods";
import {
  resolveModifiers,
  resolveTexture,
  resolveWornState,
  DEFAULT_HAIR_COLOURS,
  HAIR_COLOUR_WEIGHTS,
  TEXTURE_BY_HERITAGE,
  TEXTURE_DEFAULT,
  adjacentShade,
  stylesFor,
} from "./hairStyles";
import { applyTasteWrite, type TasteWrite } from "./axisRegistry";
import { FREE_SUBJECTS, type FreeSubject } from "./refineSubjects";
import { leanFacialHairWeights, leanStyleWeights, type FacialHairLean } from "./poolTendencies";
import type { HairFamily } from "../../shared/castingVocabularies";
import {
  HAIR_PARTS,
  REALIZED_AXIS_KEYS,
  type BrowStyle,
  type HairPart,
  type EyeColour,
  type EyeShape,
  type BeardGrey,
  type FacialHair,
  type HairStyle,
  type HairTexture,
  type RealizedAxes,
  type SkinCharacter,
} from "../../shared/castingRealization";

/**
 * The axes legacy assigned and V2 was leaving to the image model.
 *
 * `resolveCandidateIdentity` realized nine axes and left every other identity
 * axis to the prior — and an unassigned axis does not come back varied, it
 * collapses to the model's single favourite. The founder confirmed the first
 * instance in production: the large majority of casts rendered brown eyes,
 * which is precisely what the port audit's D1 row predicted and then accepted.
 *
 * This is the class, not the instance. Five axes, all on the `varyHair`
 * pattern: weighted rather than uniform, conditioned on heritage, age or sex
 * where biology or convention actually conditions them, and each drawing from
 * its OWN named hash.
 *
 * That last part is not a style preference. Deriving several axes by shifting
 * one hash is what made hair family come back as one value across eight
 * candidates and `ageBand` as two of seven: FNV-1a advances by its prime per
 * position, so a shifted hash modulo a weight total lands on the same bucket
 * for consecutive candidates. Every axis here hashes its own string.
 *
 * Realization fills only what the brief left null. Precedence is unchanged and
 * runs locks → hand adjustments → follow anchor → realization, so nothing in
 * this file can overwrite something the user said. A stated value is honoured
 * by DEFERENCE — the brief's own words govern and no realized line is emitted
 * at all — which is the ratified "shaved head" lesson applied to five more
 * axes rather than re-litigated.
 */

/** FNV-1a, matching the resolver's. Kept local so this module stands alone. */
function hash(seed: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value >>> 0;
}

/** Styles are objects, so they need their own pick — same weighting, no strings. */
function fromWeights(entries: ReturnType<typeof stylesFor>, seed: number): HairStyle {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = seed % total;
  for (const [style, weight] of entries) {
    cursor -= weight;
    if (cursor < 0) return style;
  }
  return entries[entries.length - 1][0];
}

function pickStyle(
  sex: Sex,
  heritage: string,
  ageBand: AgeBand,
  seed: number,
  avoidFamilies: readonly HairFamily[] = [],
): HairStyle {
  return fromWeights(leanStyleWeights(stylesFor(sex, heritage, ageBand), avoidFamilies), seed);
}

function weightedPick<T extends string>(entries: readonly (readonly [T, number])[], seed: number): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = seed % total;
  for (const [value, weight] of entries) {
    cursor -= weight;
    if (cursor < 0) return value;
  }
  return entries[entries.length - 1][0];
}

type Weights<T extends string> = readonly (readonly [T, number])[];

/* ------------------------------------------------------------- eye colour */

/**
 * Heritage-conditioned, and deliberately not a uniform rainbow.
 *
 * Blue eyes on a West African candidate would be as wrong as the single brown
 * default is boring, so the light colours appear where heritage supports them
 * and the browns carry the variety elsewhere. Every palette spreads across at
 * least three values, because the failure being fixed is sameness.
 */
/*
  Palettes tuned 2026-08-01 after a measured diagnosis, founder-approved
  (`docs/specs/CASTING_V2_EYE_PALETTE_PROPOSAL.md`).

  The finding: 65.5% of candidates on an open sheet drew a brown-family eye,
  with heritage spread evenly across all twelve — so it was the palettes
  compounding, not the iris prose. Roughly globally accurate, and useless on a
  sheet of eight, where five indistinguishable dark eyes means the axis
  separates nobody.

  Two levers, because "light" is not plausible everywhere:

    A. Where light colours genuinely exist (the European palettes), nudge them
       up 4–8 points, taken from `brown` and `dark brown`. Nordic is untouched
       — it is already 8% brown-family, and pushing it further would be tuning
       toward a stereotype rather than away from one.
    B. Where they do not, shift WITHIN the brown family from the two darkest
       values toward amber, honey and mid brown. This is the workhorse: it
       applies to the eight palettes that dominate the average, and it is the
       one that reads — near-black and dark brown do not separate at tile
       scale, amber and honey do.

  No palette gains a colour it did not already have. Plausibility is the
  constraint the whole change is built inside, and the alternative of weighting
  the HERITAGE draw instead was declined by founder ruling: the even open-sheet
  draw is an identity commitment, not a tuning surface.
*/
const EYE_BY_HERITAGE: Record<string, Weights<EyeColour>> = {
  // Lever A — European palettes, modest bumps out of the browns.
  Nordic: [["blue", 34], ["pale blue", 16], ["grey", 14], ["green", 14], ["green-grey", 8], ["hazel", 6], ["brown", 8]],
  "British Isles": [["blue", 26], ["green", 18], ["grey", 12], ["hazel", 14], ["brown", 16], ["dark brown", 8], ["pale blue", 6]],
  "Western European": [["brown", 20], ["blue", 22], ["green", 14], ["hazel", 14], ["dark brown", 13], ["grey", 11], ["amber", 6]],
  Slavic: [["blue", 26], ["grey", 18], ["green", 16], ["hazel", 12], ["brown", 18], ["dark brown", 10]],
  // Lever B — the within-brown shift, away from the two darkest values.
  Mediterranean: [["dark brown", 26], ["brown", 22], ["hazel", 16], ["amber", 14], ["honey brown", 10], ["green", 8], ["near-black", 4]],
  "Middle Eastern": [["dark brown", 28], ["near-black", 18], ["brown", 22], ["amber", 16], ["hazel", 6], ["honey brown", 10]],
  "East Asian": [["near-black", 32], ["dark brown", 34], ["brown", 24], ["honey brown", 10]],
  "South Asian": [["dark brown", 30], ["near-black", 24], ["brown", 24], ["amber", 12], ["honey brown", 10]],
  "West African": [["dark brown", 31], ["near-black", 28], ["brown", 26], ["amber", 15]],
  "Afro-Caribbean": [["dark brown", 29], ["near-black", 23], ["brown", 26], ["amber", 14], ["hazel", 8]],
  Latino: [["dark brown", 24], ["brown", 22], ["honey brown", 17], ["hazel", 12], ["amber", 13], ["green", 8], ["near-black", 4]],
  Polynesian: [["dark brown", 34], ["near-black", 24], ["brown", 30], ["amber", 12]],
};

const EYE_DEFAULT: Weights<EyeColour> = [
  ["brown", 26], ["dark brown", 22], ["blue", 14], ["hazel", 12],
  ["green", 10], ["near-black", 8], ["amber", 4], ["grey", 4],
];

/**
 * D1, ported. Fifteen engineered optical renders in legacy; the vocabulary here
 * is eleven, and each carries the same kind of description — zoning, striations,
 * a warm/cool split — because "hazel" alone renders as generic brown and the
 * description is the entire reason legacy's fifteen options were actually
 * distinguishable.
 *
 * These COMPOSE with the A5 iris-structure protocol already in the cohort
 * constant: A5 says how any iris is built, this says which one this person has.
 */
export const IRIS_RENDER: Record<EyeColour, string> = {
  "pale blue": "pale ice blue, low saturation with a bright inner ring and a distinct darker limbal ring, fine radial striations clearly visible",
  blue: "clear medium blue with subtle teal shifts, visible radial striations, bright and open",
  grey: "cool neutral grey with a blue-silver undertone, visible darker grey striations through the iris",
  green: "true forest green with golden-brown flecks near the pupil, a warm-cool split from centre to edge",
  "green-grey": "muted green-grey, green near the pupil cooling to grey at the outer iris, low saturation and clearly striated",
  hazel: "multi-tonal: amber-brown near the pupil blending to green-grey at the outer iris, warm centre and cool edge",
  amber: "warm golden-brown with a tawny undertone, lighter than standard brown, visible radial copper-gold striations, natural warmth",
  "honey brown": "light warm brown with golden flecks radiating from the pupil, noticeably translucent in direct light",
  brown: "rich chocolate brown with visible depth variation, warmer at the centre, darker at the limbal ring",
  "dark brown": "deep coffee brown, the pupil still distinct against it, warm red-brown micro-texture visible near the centre",
  "near-black": "iris and pupil nearly indistinguishable, extremely dark with faint brown micro-texture only visible at macro distance",
};

/**
 * Eye geometry as ANATOMY, never as an adjective (M8, the A9 pattern).
 *
 * "Hooded eyes" handed over as a word renders as ordinary wide-open eyes,
 * because the model's portrait prior is a beauty prior and a single adjective
 * does not outweigh it — the same failure as the broken nose and the styled-not-
 * worn hijab (D-124). Each line therefore names what a camera would see: how
 * much lid is exposed, where the crease sits, which way the outer corner runs,
 * how far apart the eyes are set.
 *
 * Nothing here touches how an eye is BUILT — the lash line, limbal ring and
 * catchlight belong to the cohort constant's EYES block, and nothing here may
 * introduce asymmetry between the two eyes, which that constant forbids
 * outright and for good reason.
 */
export const EYE_SHAPE_RENDER: Record<EyeShape, string> = {
  almond: "the upper lid curving to a slightly tapered outer corner, a clear visible crease, the iris partly covered at the top and the white visible either side",
  round: "a tall opening with the full circle of the iris visible including a sliver of white above it, the crease high and the outer corner not tapered",
  hooded: "a fold of upper lid skin resting over the crease and hiding most of it, so little or no lid space shows when the eyes are open, the lash line close under the fold",
  monolid: "a smooth upper lid with no visible crease at all, the lid running unbroken from lash line to brow bone, the inner corner covered by a soft epicanthic fold",
  upturned: "the outer corner sitting clearly higher than the inner corner, the lower lash line rising toward it",
  downturned: "the outer corner sitting clearly lower than the inner corner, the lower lash line dropping away toward it and a little more white visible beneath the iris",
  "deep-set": "the eyes sitting further back under a prominent brow bone, which casts a soft shadow across the upper lid and shortens the visible lid space",
  "wide-set": "the gap between the inner corners noticeably wider than the width of one eye, giving an open, broad-featured face",
  "close-set": "the gap between the inner corners noticeably narrower than the width of one eye, drawing the features toward the centre of the face",
  /*
    Anatomy, not the trend photo. "Fox eyes" names a look people recognise; what
    makes it render is where the outer corner sits and how long the opening is,
    which is what a camera can see. Deliberately says STRUCTURE so the prose
    itself resists the makeup reading (D-148's bare-term rule).
  */
  "fox eyes": "the outer corner lifted distinctly higher than the inner corner with a strong upward canthal tilt, the eye opening long and narrow rather than round, the whole eye reading as elongated toward the temple — this is the bone and lid STRUCTURE of the eye itself, not liner, shadow or any makeup effect",
};

/**
 * Hair COLOUR as a colourist would call it — the refinement tier's prose (M8).
 *
 * "Blonde" is four different heads of hair, and handing the bare word to an
 * edit gets whichever one the prior likes. Each line names tone, depth and
 * where the light sits, which is what makes two blondes different.
 */
export const HAIR_COLOUR_RENDER: Record<HairColour, string> = {
  black: "true black with a cool blue-black sheen where the light catches it",
  "dark brown": "deep espresso brown, warm rather than black, with lighter brown showing at the ends",
  brown: "mid brown with a neutral tone, slightly warmer through the lengths",
  chestnut: "warm red-brown with visible golden-red lights through the mid-lengths",
  auburn: "deep red-brown, richer and redder than chestnut, with copper lights at the surface",
  copper: "bright orange-red with real saturation, brightest where the light hits the crown",
  "strawberry blonde": "pale blonde with a distinct warm pink-gold cast, delicate rather than orange",
  blonde: "mid blonde, neither ash nor gold — a neutral wheat tone with slightly deeper roots",
  "golden blonde": "warm honey blonde with strong yellow-gold lights and deeper gold underneath",
  "ash blonde": "cool blonde with a grey-beige cast and no warmth at all",
  "platinum blonde": "very pale near-white blonde, cool and even, with the roots only slightly deeper",
  red: "saturated natural red, more crimson than copper, deepest at the roots",
  grey: "salt-and-pepper grey, individual white and dark strands visible rather than a flat tone",
  white: "soft true white with a faint silver cast, fine and light-catching",
};

/**
 * Hair TEXTURE as a pattern, not a label.
 *
 * The four words name curl families that a model renders very differently
 * depending on what it decides they mean; the prose says the pattern.
 */
export const HAIR_TEXTURE_RENDER: Record<HairTexture, string> = {
  straight: "a straight pattern with no wave, falling flat from the root and catching light along the length",
  wavy: "a soft S-wave pattern that begins below the ear rather than at the root",
  curly: "defined spiral curls with visible individual curl clumps and real separation between them",
  coiled: "a tight coil pattern with dense springy definition close to the head",
};

/* ----------------------------------------------------------- facial hair */

/**
 * Sex-gated and age-conditioned.
 *
 * Teens skew clean because a full beard at seventeen reads as a costume, and
 * the older bands admit the fuller styles. Women are never assigned facial
 * hair, and androgynous subjects are left alone rather than guessed at.
 */
/*
  F5 — the goatee is ordinary worldwide and had no entry, so it is funded from
  WITHIN the bearded shares at every band that carries it: the clean/stubble
  split is untouched, and only the shape of "bearded" widens. The 30s+ gate is
  the audit's; a goatee on a nineteen-year-old reads as a costume.

  The 70s+ long full beard is presence-not-default, funded out of the plain full
  beard at the same band — the patriarch exists and should be rare.
*/
const FACIAL_HAIR_BY_AGE: Record<AgeBand, Weights<FacialHair>> = {
  teens: [["clean-shaven", 66], ["light stubble", 30], ["heavy stubble", 4]],
  "20s": [["clean-shaven", 34], ["light stubble", 28], ["heavy stubble", 18], ["short beard", 14], ["moustache", 3], ["full beard", 3]],
  // bearded 50: short 18→15, full 8→6 fund goatee 5
  "30s": [["clean-shaven", 26], ["light stubble", 24], ["heavy stubble", 20], ["short beard", 15], ["full beard", 6], ["goatee", 5], ["moustache", 4]],
  // bearded 54: short 20→17, full 12→10 fund goatee 5
  "40s": [["clean-shaven", 26], ["light stubble", 20], ["heavy stubble", 18], ["short beard", 17], ["full beard", 10], ["goatee", 5], ["moustache", 4]],
  // bearded 56: short 22→19, full 14→12 fund goatee 5
  "50s": [["clean-shaven", 28], ["light stubble", 16], ["heavy stubble", 14], ["short beard", 19], ["full beard", 12], ["goatee", 5], ["moustache", 6]],
  // bearded 56: short 22→20, full 16→14 fund goatee 4
  "60s": [["clean-shaven", 30], ["light stubble", 14], ["heavy stubble", 10], ["short beard", 20], ["full beard", 14], ["goatee", 4], ["moustache", 8]],
  // bearded 54: short 20→18, full 18→13 fund goatee 4 + long full beard 3
  "70s+": [["clean-shaven", 34], ["light stubble", 12], ["heavy stubble", 8], ["short beard", 18], ["full beard", 13], ["goatee", 4], ["long full beard", 3], ["moustache", 8]],
};

/**
 * F5 — the beard greys a band AHEAD of the hair, and independently.
 *
 * Greying lived only on the hair-colour axis, so a salt-and-pepper beard under
 * still-dark hair could not be produced. These are the hair-grey chances shifted
 * one band up, which is the audit's own phrasing and matches how it actually
 * goes: the beard shows it first.
 *
 * Its own named hash, like every other axis here — sharing the hair-grey seed
 * would chain the two back together and undo the whole point.
 */
const BEARD_GREY_CHANCE: Record<AgeBand, number> = {
  teens: 0,
  "20s": 0,
  "30s": 14,
  "40s": 38,
  "50s": 58,
  "60s": 74,
  "70s+": 85,
};

/** Past the midpoint of its band, it has gone further than salt and pepper. */
function resolveBeardGrey(
  facialHair: FacialHair | null,
  ageBand: AgeBand,
  seed: number,
): BeardGrey | null {
  // Nothing to grey. Stubble is too short to read as anything but its colour.
  if (facialHair === null) return null;
  if (facialHair === "clean-shaven" || facialHair === "light stubble") return null;
  const roll = seed % 100;
  const chance = BEARD_GREY_CHANCE[ageBand];
  if (roll >= chance) return null;
  return roll < chance / 3 ? "mostly grey" : "salt and pepper";
}

/* ---------------------------------------------------------- hair texture */


/* ------------------------------------------------------------------ brows */

/**
 * F4 — brows are sex-conditioned but were never age-conditioned.
 *
 * Two of the most face-defining brows in casting were unsayable: the wiry,
 * overgrown 70s+ male brow, and the sparse, faded older-female one. Same
 * presence-not-default framing as the set curls — a rare-but-possible tail
 * rather than a new default, funded from within so the mix does not shift.
 */
function ageAdjustBrows(entries: Weights<BrowStyle>, sex: Sex, ageBand: AgeBand): Weights<BrowStyle> {
  if (sex === "male" && ageBand === "70s+") {
    // full 34→28, feathered 12→10 fund wiry 8.
    return [
      ["wiry and overgrown", 8], ["full", 28], ["straight", 26], ["softly arched", 16],
      ["feathered", 10], ["brushed-up", 8], ["thin", 3], ["high-arched", 1],
    ];
  }
  if (sex === "female" && (ageBand === "60s" || ageBand === "70s+")) {
    // full 22→18, feathered 14→12 fund thin 8→14 — sparse and faded with age.
    return [
      ["softly arched", 26], ["full", 18], ["high-arched", 16], ["thin", 14],
      ["feathered", 12], ["straight", 12], ["brushed-up", 1], ["bleached", 1],
    ];
  }
  return entries;
}

const BROW_BY_SEX: Record<Sex, Weights<BrowStyle>> = {
  male: [["full", 34], ["straight", 26], ["softly arched", 16], ["feathered", 12], ["brushed-up", 8], ["thin", 3], ["high-arched", 1]],
  female: [["softly arched", 26], ["full", 22], ["high-arched", 16], ["feathered", 14], ["straight", 12], ["thin", 8], ["brushed-up", 1], ["bleached", 1]],
  nonbinary: [["straight", 24], ["full", 22], ["softly arched", 20], ["feathered", 16], ["brushed-up", 10], ["high-arched", 6], ["bleached", 2]],
};

/**
 * D8, ported. Two enum values that legacy secretly expanded into prose, because
 * the bare label renders wrong: "brushed up" comes back laminated and glossy,
 * "bleached" comes back painted white.
 */
const BROW_RENDER: Partial<Record<BrowStyle, string>> = {
  "wiry and overgrown": "long wiry strands, individual hairs curling past the brow line, unruly rather than groomed",
  "brushed-up": "natural fluffy brushed-up texture, individual hairs visible, not laminated",
  bleached: "bleached blonde to near-invisible, high-fashion editorial",
  thin: "naturally fine and sparse rather than plucked to a line",
  "high-arched": "a high natural arch, still grown rather than drawn",
};

/* ---------------------------------------------------------- skin character */

/** Freckling is heritage-conditioned; everything else is even and rare. */
const FRECKLE_WEIGHT: Record<string, number> = {
  "British Isles": 26,
  Nordic: 18,
  "Western European": 12,
  Slavic: 10,
  Mediterranean: 6,
  Latino: 6,
  "Middle Eastern": 4,
  "Afro-Caribbean": 4,
  "West African": 3,
  "South Asian": 3,
  "East Asian": 2,
  Polynesian: 2,
};

function skinWeights(primary: string, ageBand: AgeBand): Weights<SkinCharacter> {
  const freckles = FRECKLE_WEIGHT[primary] ?? 8;
  // Weathering belongs to the older bands and to nobody under thirty.
  const weathered = ageBand === "teens" || ageBand === "20s" ? 0 : ageBand === "30s" ? 4 : 10;
  return [
    ["plain", 100],
    ["lightly freckled", Math.round(freckles * 0.6)],
    ["freckled", Math.round(freckles * 0.4)],
    ["a beauty mark", 9],
    ["visibly textured", 7],
    ["sun-weathered", weathered],
  ];
}

/* ---------------------------------------------------------------- realize */

/**
 * Fill the five axes for one candidate.
 *
 * Every pick hashes its own named string — never one hash shifted five ways.
 */
export function realizeAxes(input: {
  heritage: HeritageComponent[];
  ageBand: AgeBand;
  sex: Sex;
  position: number;
  rollSeed: string;
  /** What the category implies. Re-weights the draw; never decides it. */
  facialHairLean?: FacialHairLean | null;
  /** Silhouette families this pool does not wear. Down-weighted, never removed. */
  avoidFamilies?: readonly HairFamily[];
}): RealizedAxes {
  const { heritage, ageBand, sex, position, rollSeed } = input;
  const primary = (heritage[0]?.heritage ?? "") as Heritage | "";
  const seedFor = (axis: string) => hash(`${rollSeed}:${axis}:${position}`);
  const hairStyle = pickStyle(sex, primary, ageBand, seedFor("hairStyle"), input.avoidFamilies);
  /*
    Resolved before the object literal because the beard's greying depends on
    it: only a real beard can go salt-and-pepper, and stubble is too short to
    read as anything but its colour.
  */
  const facialHair =
    sex === "male"
      ? weightedPick(
          leanFacialHairWeights(FACIAL_HAIR_BY_AGE[ageBand], input.facialHairLean ?? null),
          seedFor("facialHair"),
        )
      : null;

  return {
    eyeColour: weightedPick(EYE_BY_HERITAGE[primary] ?? EYE_DEFAULT, seedFor("eyeColour")),
    /*
      ALWAYS NULL, and that is the whole point of how eye shape is filed (M8).

      The sheet does not draw eye geometry. Adding a ninth drawn axis would
      widen every roll's variance surface and change output on a milestone that
      is about refining ONE face, so the draw stays exactly as it was and this
      axis only ever gets a value from a refinement. Pinned by a test over a
      wide draw, because "we simply never set it" is a convention and the
      guarantee has to be mechanical.
    */
    eyeShape: null,
    /* Never drawn, for D-116's reason: the dice stay bare and eight unmade
       faces are the default. Only a stated fact or a refinement sets it. */
    makeup: null,
    /* Never drawn — a refinement is the only writer (D-131). */
    statedDetails: null,
    hairStyle,
    /*
      The cut's authored components (D10), resolved beside the cut they belong
      to. Legality is the entry's own declaration, so a buzz cut cannot be
      given a fringe here — there is no slot to fill.
    */
    hairModifiers: resolveModifiers(hairStyle, seedFor),
    /*
      Its own named hash, per the collision law. Sharing the cut's seed would
      tie the two together — every ponytail arriving on the same tiles — which
      is the correlation that made a whole gate's sheets quietly narrower.
    */
    wornState: resolveWornState(hairStyle.family, hairStyle, seedFor("wornState")),
    /*
      Only men carry it. An androgynous subject is left alone rather than
      guessed at — the brief said nothing, and inventing a beard would be
      deciding something about them that they did not.
    */
    facialHair,
    /*
      A cut that dictates its own texture wins. Locs are coiled by definition,
      and a "straight locs" pairing is exactly the kind of impossible
      combination legacy needed a legality matrix (D11) to prevent — here the
      style entry carries the answer and the axis defers to it.

      Null on a shaved cut, because a shaved head has no grain to show and the
      composer never says one. See `resolveTexture`.
    */
    hairTexture: resolveTexture(hairStyle, primary, seedFor("hairTexture")),
    /* Its own named hash — chaining it to the hair grey is the defect. */
    beardGrey: resolveBeardGrey(facialHair, ageBand, seedFor("beardGrey")),
    browStyle: weightedPick(ageAdjustBrows(BROW_BY_SEX[sex], sex, ageBand), seedFor("browStyle")),
    skinCharacter: weightedPick(skinWeights(primary, ageBand), seedFor("skinCharacter")),
  };
}

/**
 * The realized axes, as prompt lines.
 *
 * Each axis is skipped entirely when the brief already spoke about it — the
 * deference rule. Nothing here ever contradicts the user's own words, and a
 * skipped axis emits no line at all rather than a hedged one.
 */
export function describeRealizedAxes(
  axes: RealizedAxes,
  stated: (axis: "eyes" | "facialHair" | "brows" | "skin") => boolean,
  /*
    Only the STYLING tier reads this. Eye colour, brow character and skin
    character are biology — no creative direction implies them, so they author
    identically in every mode and a named cast direction can never disagree
    with them.
  */
  resolution: StylingResolution = "prescribe",
): string {
  const parts: string[] = [];

  if (axes.eyeColour && !stated("eyes")) {
    parts.push(`EYE COLOUR: ${axes.eyeColour} — ${IRIS_RENDER[axes.eyeColour]}.`);
  }
  /*
    Geometry, on its own line and under its own heading.

    Ships in the SAME change as the registry footprint deliberately: a
    footprint whose emitter arrives later is invariant 7's inert control — a
    rule that looks enforced and refuses nothing.

    Not gated on `stated("eyes")` the way colour is. That gate exists because a
    brief naming an eye COLOUR must not have a drawn colour argue with it; eye
    shape is never drawn, so a value here came from the user in the first place
    and there is nothing for it to contradict.
  */
  if (axes.eyeShape) {
    parts.push(`EYE SHAPE: ${axes.eyeShape} — ${EYE_SHAPE_RENDER[axes.eyeShape]}.`);
  }
  /*
    The user's own words, because there is no enum to translate. The STATED
    MAKEUP licence in the cohort constant is what gives them teeth — this line
    only has to put them where that licence can see them.
  */
  if (axes.makeup) {
    parts.push(`MAKEUP: ${axes.makeup}.`);
  }
  /*
    The free lane's filed facts, each under the heading it was filed with. This
    is what makes a followed variant's brow survive into all eight cousins —
    without it, a filed fact would be inherited by the record and rendered by
    nothing: unowned-axis instance eight.
  */
  for (const [subject, value] of Object.entries(axes.statedDetails ?? {})) {
    if (value) parts.push(`${FREE_SUBJECTS[subject as FreeSubject] ?? subject.toUpperCase()}: ${value}.`);
  }
  if (axes.facialHair && !stated("facialHair")) {
    /*
      Under context, whether there is a beard rather than which one — the shape
      belongs to the casting. The twin rule loses nothing: its second axis for
      men was already the two-value bucket, never the six-value enum.
    */
    /*
      F5's greying rides the same line rather than getting its own, because it
      is a property OF the beard: a second sentence would read as a second
      instruction and invite the model to weigh them against each other.
    */
    const greying = axes.beardGrey
      ? axes.beardGrey === "mostly grey"
        ? " Gone mostly grey, noticeably lighter than the hair."
        : " Salt and pepper through it, greyer than the hair on the head."
      : "";
    parts.push(
      resolution === "bias"
        ? `${BEARD_BIAS_PROSE[beardBucket(axes.facialHair)!]}${greying}`
        : axes.facialHair === "clean-shaven"
          ? "FACIAL HAIR: clean-shaven, with the faint shadow of real beard growth under the skin rather than a smooth blank jaw."
          : `FACIAL HAIR: ${axes.facialHair}, grown naturally and unevenly, individual hairs visible at the edges.${greying}`,
    );
  }
  if (axes.browStyle && !stated("brows")) {
    const render = BROW_RENDER[axes.browStyle];
    /*
      "BROW CHARACTER", not "BROWS" — the cohort constant already has a BROWS
      section carrying A8's rendering protocol (growth direction, gaps,
      root-to-tip colour). Two blocks with the same heading is a contradiction
      to a reader and an ambiguity to the model. A8 says how a brow is BUILT;
      this says which brow this person HAS.
    */
    parts.push(`BROW CHARACTER: ${axes.browStyle}${render ? ` — ${render}` : ""}.`);
  }
  if (axes.skinCharacter && axes.skinCharacter !== "plain" && !stated("skin")) {
    parts.push(
      axes.skinCharacter === "a beauty mark"
        ? "SKIN CHARACTER: one small natural beauty mark on the face, placed asymmetrically."
        : `SKIN CHARACTER: ${axes.skinCharacter} skin, natural and unretouched.`,
    );
  }

  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

/** Exported so the registry has exactly one definition. */
export { REALIZED_AXIS_KEYS };

/* ----------------------------------------------------- the sheet-level pass */

/**
 * The three taste rules that are properties of the SHEET, not of a person.
 *
 * The founder set the first two at the M5 gate: at most one statement cut across
 * eight candidates, and at least five visibly distinct hairstyles. Neither can be
 * decided by `realizeAxes`, which sees one candidate — and the first attempt
 * proved it the expensive way. It re-derived what the earlier positions "would
 * have" drawn from THIS candidate's weighted list, which is exact only when the
 * brief locks heritage; on an open brief every position draws from a different
 * list, so the re-derivation was a fiction. It passed a fixed-heritage unit
 * test at 200/200 while leaking on 2.3% of real sheets.
 *
 * So the rules live here, over the resolved set, and run before the prompts are
 * composed — a record that disagrees with the prompt that was actually sent is
 * the failure mode this whole file exists to prevent.
 *
 * **Distinct means by NAME.** "plain short cut" and "side part" count as two.
 * That is the resolution the user sees on a sheet: they are looking at eight
 * photographs, and two different named cuts photograph differently even when
 * they share a silhouette.
 *
 * **Replacements are ordinary cuts from the candidate's OWN list.** Never
 * cross-list, because the list is what makes a style legal for this person, and
 * never a statement, because filling the variety floor with statement cuts
 * would satisfy one founder ruling by breaking the other.
 *
 * **Colour gets a pair-breaker, not a floor** (founder ruling, 2026-08-01). A
 * "five distinct colours" rule would fight realism to satisfy a metric, because
 * palette width is heritage-dependent: a Mediterranean or East Asian brief
 * legitimately produces a mostly dark-haired sheet, and eight black-haired
 * candidates are correct as long as the cuts differ. What actually went wrong
 * on the graded sheet was narrower — two candidates read as twins because they
 * shared BOTH colour and silhouette. So the rule is exactly that: no two
 * candidates may share a colour and a style family, and a collision re-picks
 * one colour to an adjacent shade inside its own heritage palette.
 *
 * A grey or white head is left alone. Those come from age rather than from the
 * palette, so shifting one would quietly edit how old the person reads — and
 * the ladder deliberately has no rung for them. A twinned pair of grey heads is
 * therefore possible; it needs the style rule to separate them, which it does.
 *
 * **NAMED LIMIT: a sheet of women whose hair the brief genuinely stated cannot
 * be separated at all.** The hair rules stand down because nothing authored
 * reaches the prompt, and the twin rule's fallback axis is facial hair, which a
 * sheet of women does not have. Measured at 189 neighbourhood twins across 200
 * such sheets, against 1 when the hair rules run. This sits beside the
 * narrow-palette limit as something the design cannot currently fix rather than
 * something it forgot: closing it needs a second visible axis for women that
 * survives hair deference — build is null under any stated role, so it would
 * have to be something new. Recorded rather than worked around, because a
 * silent partial fix here would be worse than a known gap.
 *
 * ⚠ **AND THE MALE MIRROR IS NOT THE HEALTHY CASE — MEASURED 2026-08-25, AND
 * THIS PARAGRAPH IS WHY NOBODY LOOKED.** The limit above is stated so well that
 * it reads as a COMPLETE account of where this pass is weak. It is not. On a
 * sheet of MEN whose hair the brief stated, the fallback DOES fire — and the
 * separation it buys costs more variety than it returns.
 *
 * Driven over 2,000 synthetic sheets of a real production brief's shape (male,
 * 40s, hair STATED, everything else open), before the pass against after:
 *
 *   clean-shaven              26.0%  →  21.1%
 *   short beard               17.0%  →  27.4%   ← becomes the TOP value
 *   distinct values / sheet     5.27 →   4.98   ← FEWER
 *   values moved                        22.8%
 *   the same, ORDINARY brief             0.0%   (0 of 16,000)
 *
 * The mechanism is the re-pick below: a clashing bucket flips to the OTHER
 * bucket and re-picks from that bucket's WEIGHTED pool, and for a man in his
 * 40s the `bearded` pool is ~47% `short beard`. So every forced flip toward
 * `bearded` lands on one value about half the time and the sheet concentrates.
 *
 * The founder saw it before the instrument did — *"they all have the same facial
 * hair for some reason"*, on a sheet where 4 of 5 delivered slices carried
 * `FACIAL HAIR: short beard`. The repair is designed and NOT built (three
 * candidate shapes, graded offline against the census above rather than argued):
 * `docs/specs/CASTING_V2_YIELD_RULE_SWEEP.md` §1 kind 2.
 *
 * ⚠ **The lesson for the paragraph above, not just for this one: a stated limit
 * should say what it has NOT measured, not only what it has.**
 *
 * **M7 note:** after this pass, `realizeAxes(rollSeed, position)` no longer
 * reproduces the stored value for an adjusted candidate. The registry must read
 * the persisted `resolvedIdentity` as truth and never re-derive it.
 */
const STATEMENT_CAP = 1;
const DISTINCT_FLOOR = 5;

export type SheetCandidate = {
  heritage: HeritageComponent[];
  ageBand: AgeBand;
  sex: Sex;
  hair: Hair | null;
  realized: RealizedAxes;
};

/** Age-driven colours. Not palette draws, so the pair-breaker leaves them be. */
const AGE_COLOURS = new Set<HairColour>(["grey", "white"]);

export function applySheetTaste<T extends SheetCandidate>(
  sheet: T[],
  rollSeed: string,
  options: {
    statedFacialHair?: boolean;
    /**
     * Which parts of hair this sheet may author — D-79's per-part mask.
     *
     * Was a single `hairAuthored` boolean, which is the shape the ruling
     * rejects: "silver at the temples" states a colour and stood down the CUT
     * rules too, so the sheet lost its variety to honour one fact. Derived once
     * in the compiler from the same gate the composer reads, so the taste pass
     * and the prompt cannot disagree about what was said.
     */
    authoredParts?: ReadonlySet<HairPart>;
    /*
      The pool's absent silhouettes reach the taste pass too.

      They did not at first, and the leak is the shape this milestone keeps
      paying for: the pass RE-PICKS a style from `stylesFor` when it breaks a
      statement cap or a twin, so a k-pop sheet that had correctly avoided
      shaved cuts at resolution got them handed straight back a moment later.
      A rule applied at one site and not the others is a rule that does not
      hold.
    */
    avoidFamilies?: readonly HairFamily[];
    /*
      Under creative context the prompt carries the SILHOUETTE, not the cut, so
      distinctness has to be counted at the resolution the image actually
      receives. Counting names there would let a sheet score eight distinct cuts
      while showing four silhouettes — the taste rule satisfied on paper and not
      in the picture.
    */
    biasResolution?: boolean;
  } = {},
): T[] {
  /*
    When the brief stated hair, nothing authored here reaches the prompt, so
    every hair rule stands down rather than editing a record the image never
    saw. The twin rule keeps working on its second axis — that is the whole
    reason this is a flag and not an early return.
  */
  const authoredParts = options.authoredParts ?? new Set<HairPart>(HAIR_PARTS);
  const authorsCut = authoredParts.has("cutLength");
  const authorsColour = authoredParts.has("colour");
  /** What counts as "a distinct cut" — the name, or the silhouette it carries. */
  const identityOf = (style: HairStyle) => (options.biasResolution ? style.family : style.name);
  const seen = new Set<string>();
  const twins = new Set<string>();
  let statements = 0;
  const pairKey = (colour: HairColour, family: string) => `${colour}|${family}`;
  /*
    The neighbourhood ledger. One entry per candidate, holding only what the
    twin rule reads, so the check is against what each earlier candidate ENDED
    UP as rather than what they drew.
  */
  const placed: { heritage: string; family: string; beard: BeardBucket | null; bucket: ColourBucket | null }[] = [];
  const neighbours = (heritage: string) => placed.filter((entry) => sameNeighbourhood(entry.heritage, heritage));

  return sheet.map((candidate, position) => {
    const current = candidate.realized.hairStyle;
    /*
      A candidate whose hair was suppressed by deference has nothing to arrange.
      The pass runs before the persisted record is blanked, so this is normally
      unreachable — but the type is nullable now, and a guard that states why is
      better than a non-null assertion that hides it.
    */
    if (current === null) return candidate;

    const primary = (candidate.heritage[0]?.heritage ?? "") as Heritage | "";
    /*
      EXCLUDED here, not merely down-weighted — and the difference is the bug.

      The taste pass chooses by FAMILY MEMBERSHIP rather than by weight: its
      first pool is "silhouettes nobody nearby has", a filter. So a family
      pushed to weight 1 at resolution still won outright the moment it was the
      only unused one, and a k-pop sheet got its buzz cuts back from the rule
      that exists to spread silhouettes.

      The resolution draw excludes them too (D-94: the never-zero law protects
      people, not grooming), so this is the same rule at the second of its three
      sites rather than a stricter one. What keeps it honest is that it only
      ever runs on a cut that is OURS to choose — a stated cut never reaches
      here at all.
    */
    const avoided = new Set<string>(options.avoidFamilies ?? []);
    const all = stylesFor(candidate.sex, primary, candidate.ageBand);
    const permitted = all.filter(([style]) => !avoided.has(style.family));
    const entries = permitted.length > 0 ? permitted : all;
    const ordinary = entries.filter(([style]) => !style.statement);
    const nearby = neighbours(primary);
    const familiesNearby = new Set(nearby.map((entry) => entry.family));

    const overStatement = current.statement === true && statements >= STATEMENT_CAP;
    /*
      The floor, enforced only as late as it has to be. A sheet is allowed to
      repeat a cut — on a real street two women both have long hair — right up
      to the point where the positions that are left can no longer reach five.
      From there, every remaining draw has to be one nobody has taken.

      `mustBeNew` asks that arithmetically rather than "is this a repeat": with
      `d` distinct so far and `r` positions left including this one, declining
      to add a new cut here caps the sheet at `d + r - 1`. The first version
      asked the narrower question and the demotion path slipped past it — a
      statement being demoted could land on a name already used and quietly
      spend the slot the floor was counting on. One sheet in four hundred came
      out at four.
    */
    const remaining = sheet.length - position;
    const mustBeNew = seen.size + remaining - 1 < DISTINCT_FLOOR;
    const familyClashes = familiesNearby.has(current.family);

    /*
      ONE style decision, taking every constraint as a pool filter.

      The rules are not applied in sequence and they must not be: the shipped
      distinct-floor bug was a second rule re-picking a style AFTER `seen` had
      been written, so an abandoned name inflated `seen.size` and the floor
      arithmetic lied. The law that generalises from it — no rule may mutate an
      axis after that axis's sheet-level bookkeeping is committed — is why the
      cap, the floor and the neighbourhood family constraint all narrow the
      same pool and the bookkeeping below happens once, on the final value.

      Pools fall back outward: the tightest that still has entries wins, so a
      constrained sheet degrades one constraint at a time instead of failing.
    */
    /*
      How many second-axis values this candidate could actually reach. A man
      can always be moved between bearded and bare; a woman is bounded by how
      many colour buckets her heritage palette holds, which for East Asian and
      West African is exactly one. A grey head cannot move at all — that is an
      age fact, not a palette draw.
    */
    const ownColour = candidate.hair?.colour ?? null;
    const reachableBuckets: ReadonlySet<string> =
      secondAxis(candidate.sex) === "beard"
        ? new Set(["bearded", "bare"])
        : ownColour !== null && AGE_COLOURS.has(ownColour)
          ? new Set([colourBucket(ownColour)])
          : new Set(
              (HAIR_COLOUR_WEIGHTS[primary] ?? DEFAULT_HAIR_COLOURS).map(([shade]) => colourBucket(shade)),
            );

    /*
      A family still has room when the neighbourhood has not already used every
      second-axis value alongside it. Without this the pool knew only "is this
      silhouette taken at all", so once all five families were spoken for it
      chose blindly and landed on families whose every bucket was gone — 6 of a
      possible 8 distinct pairings on a sheet with capacity for 10.
    */
    const familyHasRoom = (family: string) => {
      const used = new Set<string>();
      for (const entry of nearby) {
        if (entry.family !== family) continue;
        const bucket = secondAxis(candidate.sex) === "beard" ? entry.beard : entry.bucket;
        if (bucket !== null) used.add(bucket);
      }
      return Array.from(reachableBuckets).some((bucket) => !used.has(bucket));
    };

    let style = current;
    if (authorsCut && (overStatement || (mustBeNew && seen.has(identityOf(current))) || familyClashes)) {
      const usable = ordinary.filter(([entry]) => !overStatement || !entry.statement);
      /*
        The floor is a HARD filter, not another preference. Ranking the twin
        constraints above it is precisely the mistake that produced the shipped
        distinct-floor bug in a new costume: the first draft of this pool put
        `familyHasRoom` ahead of `mustBeNew` and sheets started coming back with
        four distinct cuts. When the floor is at risk, every option must already
        be a name nobody has used; the twin rules then choose among those.
      */
      const base = mustBeNew ? usable.filter(([entry]) => !seen.has(identityOf(entry))) : usable;
      const pools = [
        // A silhouette nobody nearby has.
        base.filter(([entry]) => !familiesNearby.has(entry.family)),
        // Silhouettes are exhausted — take one that still has a free bucket, so
        // the second axis can finish the separation.
        base.filter(([entry]) => familyHasRoom(entry.family)),
        base,
        // Nothing left to satisfy; at least stop the statement overflow.
        usable,
      ];
      const pool = pools.find((option) => option.length > 0);
      if (pool) style = fromWeights(pool, hash(`${rollSeed}:hairStyleTaste:${position}`));
    }

    if (style.statement) statements += 1;
    seen.add(identityOf(style));

    /*
      The pair-breaker, applied after the cut is final — the collision is
      against the style family this candidate actually ends up with, not the one
      they drew and lost.
    */
    const wantsColour = secondAxis(candidate.sex) === "colour";
    /*
      The second half of the twin rule, and the subtlety that matters: the
      conflict is with earlier candidates sharing this SILHOUETTE, not with
      everyone in the neighbourhood.

      The first version compared against every nearby bucket and barely worked —
      by the third candidate both beard buckets were present somewhere on the
      sheet, so the flip moved into a bucket that was equally taken and changed
      nothing. A twin is (same neighbourhood AND same family AND same bucket);
      the fix has to be keyed on the same conjunction the violation is.
    */
    const sameSilhouette = nearby.filter((entry) => entry.family === style.family);
    const bucketsHere = new Set(
      sameSilhouette.map((entry) => entry.bucket).filter((bucket): bucket is ColourBucket => bucket !== null),
    );

    let colour = candidate.hair?.colour ?? null;
    if (authorsColour && colour !== null && !AGE_COLOURS.has(colour)) {
      const palette = HAIR_COLOUR_WEIGHTS[primary] ?? DEFAULT_HAIR_COLOURS;
      const seed = hash(`${rollSeed}:hairColourTaste:${position}`);
      const bucketClashes = wantsColour && bucketsHere.has(colourBucket(colour));

      if (twins.has(pairKey(colour, style.family)) || bucketClashes) {
        /*
          One re-pick serving both colour rules, for the same reason the style
          pick serves three: two sequential shifts would let the second undo
          what the first bought. Tightest predicate first, then relax.
        */
        const wants = [
          (shade: HairColour) =>
            !twins.has(pairKey(shade, style.family)) &&
            (!wantsColour || !bucketsHere.has(colourBucket(shade))),
          (shade: HairColour) => !twins.has(pairKey(shade, style.family)),
        ];
        for (const acceptable of wants) {
          const shifted = adjacentShade(colour, palette, seed, acceptable);
          // Null means this heritage has nothing else to offer — an East Asian
          // palette holds two colours, and inventing a third is the exact
          // heritage-washing the per-heritage weights exist to prevent. The
          // pair stands, separated by whatever else differs.
          if (shifted) {
            colour = shifted;
            break;
          }
        }
      }
      twins.add(pairKey(colour, style.family));
    }

    /*
      Facial hair last, and safely: it carries no sheet-level bookkeeping of
      its own, so moving it cannot invalidate a decision already committed.

      Skipped when the brief STATED facial hair. Under deference no realized
      facial-hair line is emitted at all, so flipping the value would change
      nothing the customer sees while making the persisted identity disagree
      with the prompt that was actually sent — the record-that-lies failure
      this whole pass is ordered to avoid.
    */
    let facialHair = candidate.realized.facialHair;
    if (facialHair !== null && !options.statedFacialHair && secondAxis(candidate.sex) === "beard") {
      const beardsHere = new Set(
        nearby
          .filter((entry) => !authorsCut || entry.family === style.family)
          .map((entry) => entry.beard)
          .filter((bucket): bucket is BeardBucket => bucket !== null),
      );
      if (beardsHere.has(beardBucket(facialHair)!)) {
        const wanted: BeardBucket = beardBucket(facialHair) === "bearded" ? "bare" : "bearded";
        const pool = FACIAL_HAIR_BY_AGE[candidate.ageBand].filter(
          ([value]) => beardBucket(value) === wanted,
        );
        if (pool.length > 0) {
          facialHair = weightedPick(pool, hash(`${rollSeed}:facialHairTaste:${position}`));
        }
      }
    }

    placed.push({
      heritage: primary,
      family: style.family,
      beard: beardBucket(facialHair),
      bucket: colour === null ? null : colourBucket(colour),
    });

    /*
      EVERY DECISION THIS PASS MADE, AS ONE TYPED WRITE.

      The write surface is `TasteWrite`, whose key type is derived from the axis
      registry's taste-writable set — and that set is provably a subset of the
      realized shelf (`OnlyRealizedIsTasteWritable`, a compile-time binding).
      So the ratified law, *only realized values are writable by the sheet taste
      pass*, stops being a discipline enforced by per-rule skip lists and
      becomes a thing the compiler refuses. Adding `sex` or `eyeColour` to this
      object does not review badly; it does not build.

      `applyTasteWrite` also owns the routing, which is why the colour no longer
      reaches into `candidate.hair` from here. Where an axis is stored is the
      registry's business — a rule should say what it decided, never where the
      value lives.
    */
    const write: TasteWrite = {};

    if (colour !== null && colour !== candidate.hair?.colour) write.hairColour = colour;
    if (facialHair !== candidate.realized.facialHair) write.facialHair = facialHair;

    if (style !== current) {
      write.hairStyle = style;
      /*
        Texture, components and worn state follow the CUT — all three, together,
        in the same write. A style that dictates its own texture wins, and a
        swap that left any of the old three behind would strand "coiled" on a
        bob or a curtain fringe on a french crop: the illegal pairings the
        entry-level legality rule exists to make unsayable, reintroduced by a
        spread that looks like it is copying something safe.
      */
      write.hairTexture = resolveTexture(style, primary, hash(`${rollSeed}:hairTexture:${position}`));
      write.hairModifiers = resolveModifiers(style, (axis) => hash(`${rollSeed}:${axis}:${position}`));
      write.wornState = resolveWornState(style.family, style, hash(`${rollSeed}:wornState:${position}`));
    }

    return applyTasteWrite(candidate, write);
  });
}
