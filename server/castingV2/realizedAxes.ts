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
  DEFAULT_HAIR_COLOURS,
  HAIR_COLOUR_WEIGHTS,
  TEXTURE_BY_HERITAGE,
  TEXTURE_DEFAULT,
  adjacentShade,
  stylesFor,
} from "./hairStyles";
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

function pickStyle(sex: Sex, heritage: string, ageBand: AgeBand, seed: number): HairStyle {
  return fromWeights(stylesFor(sex, heritage, ageBand), seed);
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
  const seedFor = (axis: string) => hash(`${rollSeed}:${axis}:${position}`);
  const hairStyle = pickStyle(sex, primary, ageBand, seedFor("hairStyle"));

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
  /*
    Only the STYLING tier reads this. Eye colour, brow character and skin
    character are biology — no creative direction implies them, so they author
    identically in every mode and a named cast direction can never disagree
    with them.
  */
  resolution: StylingResolution = "prescribe",
): string {
  const parts: string[] = [];

  if (!stated("eyes")) {
    parts.push(`EYE COLOUR: ${axes.eyeColour} — ${IRIS_RENDER[axes.eyeColour]}.`);
  }
  if (axes.facialHair && !stated("facialHair")) {
    /*
      Under context, whether there is a beard rather than which one — the shape
      belongs to the casting. The twin rule loses nothing: its second axis for
      men was already the two-value bucket, never the six-value enum.
    */
    parts.push(
      resolution === "bias"
        ? BEARD_BIAS_PROSE[beardBucket(axes.facialHair)!]
        : axes.facialHair === "clean-shaven"
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
    hairAuthored?: boolean;
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
  const hairAuthored = options.hairAuthored ?? true;
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
    const entries = stylesFor(candidate.sex, primary, candidate.ageBand);
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
    if (hairAuthored && (overStatement || (mustBeNew && seen.has(identityOf(current))) || familyClashes)) {
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
    if (hairAuthored && colour !== null && !AGE_COLOURS.has(colour)) {
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
          .filter((entry) => !hairAuthored || entry.family === style.family)
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

    const colourChanged = colour !== null && colour !== candidate.hair?.colour;
    const beardChanged = facialHair !== candidate.realized.facialHair;
    if (style === current && !colourChanged && !beardChanged) return candidate;

    const hair = colourChanged && candidate.hair ? { ...candidate.hair, colour } : candidate.hair;
    /*
      Texture follows the cut. A style that dictates its own texture wins, and a
      swap that left the old dictation behind would strand "coiled" on a bob —
      the illegal pairing the entry-level legality rule exists to prevent.
    */
    const hairTexture =
      style === current
        ? candidate.realized.hairTexture
        : style.texture ??
          weightedPick(
            TEXTURE_BY_HERITAGE[primary] ?? TEXTURE_DEFAULT,
            hash(`${rollSeed}:hairTexture:${position}`),
          );
    return {
      ...candidate,
      hair,
      realized: { ...candidate.realized, hairStyle: style, hairTexture, facialHair },
    };
  });
}
