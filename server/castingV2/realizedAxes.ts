import {
  type AgeBand,
  type Heritage,
  type HeritageComponent,
  type Sex,
} from "./castingIntent";
import { stylesFor } from "./hairStyles";
import {
  REALIZED_AXIS_KEYS,
  type BrowStyle,
  type EyeColour,
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

/**
 * One statement cut per sheet, structurally.
 *
 * The weights alone make a second statement unlikely, not impossible — about
 * one sheet in ten came back with two, and the founder's acceptance bar is *at
 * most one*. Rarity that holds nine times in ten is not a rule, so the second
 * one is demoted rather than hoped against.
 *
 * The check re-derives the earlier positions from the same seed rather than
 * threading state through the caller: realization is deterministic in
 * (rollSeed, position), so position 5 can ask what positions 0–4 drew without
 * anyone having to remember. Eight candidates make this twenty-eight extra
 * hashes, which is nothing, and it keeps `realizeAxes` a pure function of one
 * candidate — the property the follow anchor and M7's registry both rely on.
 */
function pickStyle(
  sex: Sex,
  heritage: string,
  ageBand: AgeBand,
  position: number,
  seedFor: (axis: string) => number,
  seedAt: (axis: string, position: number) => number,
): HairStyle {
  const entries = stylesFor(sex, heritage, ageBand);
  const chosen = fromWeights(entries, seedFor("hairStyle"));
  if (!chosen.statement) return chosen;

  const claimedEarlier = Array.from({ length: position }, (_, earlier) =>
    fromWeights(entries, seedAt("hairStyle", earlier)),
  ).some((style) => style.statement);
  if (!claimedEarlier) return chosen;

  // Demote into the ordinary cuts, with its own hash so the replacement is not
  // just whatever sat next to the statement in the list.
  const ordinary = entries.filter(([style]) => !style.statement);
  return fromWeights(ordinary, seedFor("hairStyleDemoted"));
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
const EYE_BY_HERITAGE: Record<string, Weights<EyeColour>> = {
  Nordic: [["blue", 34], ["pale blue", 16], ["grey", 14], ["green", 14], ["green-grey", 8], ["hazel", 6], ["brown", 8]],
  "British Isles": [["blue", 26], ["green", 16], ["grey", 10], ["hazel", 12], ["brown", 20], ["dark brown", 10], ["pale blue", 6]],
  "Western European": [["brown", 24], ["blue", 20], ["green", 12], ["hazel", 14], ["dark brown", 16], ["grey", 8], ["amber", 6]],
  Slavic: [["blue", 26], ["grey", 16], ["green", 14], ["hazel", 10], ["brown", 22], ["dark brown", 12]],
  Mediterranean: [["dark brown", 30], ["brown", 24], ["hazel", 14], ["amber", 10], ["honey brown", 10], ["green", 8], ["near-black", 4]],
  "Middle Eastern": [["dark brown", 32], ["near-black", 22], ["brown", 20], ["amber", 12], ["hazel", 10], ["honey brown", 4]],
  "East Asian": [["near-black", 40], ["dark brown", 38], ["brown", 18], ["honey brown", 4]],
  "South Asian": [["dark brown", 34], ["near-black", 30], ["brown", 20], ["amber", 8], ["honey brown", 8]],
  "West African": [["dark brown", 36], ["near-black", 34], ["brown", 20], ["amber", 10]],
  "Afro-Caribbean": [["dark brown", 34], ["near-black", 28], ["brown", 22], ["amber", 10], ["hazel", 6]],
  Latino: [["dark brown", 28], ["brown", 24], ["honey brown", 14], ["hazel", 12], ["amber", 10], ["green", 8], ["near-black", 4]],
  Polynesian: [["dark brown", 40], ["near-black", 30], ["brown", 24], ["amber", 6]],
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
const IRIS_RENDER: Record<EyeColour, string> = {
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

/* ----------------------------------------------------------- facial hair */

/**
 * Sex-gated and age-conditioned.
 *
 * Teens skew clean because a full beard at seventeen reads as a costume, and
 * the older bands admit the fuller styles. Women are never assigned facial
 * hair, and androgynous subjects are left alone rather than guessed at.
 */
const FACIAL_HAIR_BY_AGE: Record<AgeBand, Weights<FacialHair>> = {
  teens: [["clean-shaven", 66], ["light stubble", 30], ["heavy stubble", 4]],
  "20s": [["clean-shaven", 34], ["light stubble", 28], ["heavy stubble", 18], ["short beard", 14], ["moustache", 3], ["full beard", 3]],
  "30s": [["clean-shaven", 26], ["light stubble", 24], ["heavy stubble", 20], ["short beard", 18], ["full beard", 8], ["moustache", 4]],
  "40s": [["clean-shaven", 26], ["light stubble", 20], ["heavy stubble", 18], ["short beard", 20], ["full beard", 12], ["moustache", 4]],
  "50s": [["clean-shaven", 28], ["light stubble", 16], ["heavy stubble", 14], ["short beard", 22], ["full beard", 14], ["moustache", 6]],
  "60s": [["clean-shaven", 30], ["light stubble", 14], ["heavy stubble", 10], ["short beard", 22], ["full beard", 16], ["moustache", 8]],
  "70s+": [["clean-shaven", 34], ["light stubble", 12], ["heavy stubble", 8], ["short beard", 20], ["full beard", 18], ["moustache", 8]],
};

/* ---------------------------------------------------------- hair texture */

const TEXTURE_BY_HERITAGE: Record<string, Weights<HairTexture>> = {
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

const TEXTURE_DEFAULT: Weights<HairTexture> = [
  ["straight", 42], ["wavy", 34], ["curly", 18], ["coiled", 6],
];

/* ------------------------------------------------------------------ brows */

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
}): RealizedAxes {
  const { heritage, ageBand, sex, position, rollSeed } = input;
  const primary = (heritage[0]?.heritage ?? "") as Heritage | "";
  const seedAt = (axis: string, at: number) => hash(`${rollSeed}:${axis}:${at}`);
  const seedFor = (axis: string) => seedAt(axis, position);
  const hairStyle = pickStyle(sex, primary, ageBand, position, seedFor, seedAt);

  return {
    eyeColour: weightedPick(EYE_BY_HERITAGE[primary] ?? EYE_DEFAULT, seedFor("eyeColour")),
    hairStyle,
    /*
      Only men carry it. An androgynous subject is left alone rather than
      guessed at — the brief said nothing, and inventing a beard would be
      deciding something about them that they did not.
    */
    facialHair:
      sex === "male" ? weightedPick(FACIAL_HAIR_BY_AGE[ageBand], seedFor("facialHair")) : null,
    /*
      A cut that dictates its own texture wins. Locs are coiled by definition,
      and a "straight locs" pairing is exactly the kind of impossible
      combination legacy needed a legality matrix (D11) to prevent — here the
      style entry carries the answer and the axis defers to it.
    */
    hairTexture:
      hairStyle.texture ??
      weightedPick(TEXTURE_BY_HERITAGE[primary] ?? TEXTURE_DEFAULT, seedFor("hairTexture")),
    browStyle: weightedPick(BROW_BY_SEX[sex], seedFor("browStyle")),
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
): string {
  const parts: string[] = [];

  if (!stated("eyes")) {
    parts.push(`EYE COLOUR: ${axes.eyeColour} — ${IRIS_RENDER[axes.eyeColour]}.`);
  }
  if (axes.facialHair && !stated("facialHair")) {
    parts.push(
      axes.facialHair === "clean-shaven"
        ? "FACIAL HAIR: clean-shaven, with the faint shadow of real beard growth under the skin rather than a smooth blank jaw."
        : `FACIAL HAIR: ${axes.facialHair}, grown naturally and unevenly, individual hairs visible at the edges.`,
    );
  }
  if (!stated("brows")) {
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
  if (axes.skinCharacter !== "plain" && !stated("skin")) {
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
