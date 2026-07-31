import { HERITAGES, type Heritage, type HairColour, type Sex } from "./castingIntent";
import {
  DEFAULT_HAIR_COLOURS,
  HAIR_COLOUR_WEIGHTS,
  SHADE_LADDER,
  TEXTURE_BY_HERITAGE,
  TEXTURE_DEFAULT,
  stylesFor,
} from "./hairStyles";
import type { FacialHair } from "../../shared/castingRealization";

/**
 * Which heritages our own vocabularies render alike — computed, never named.
 *
 * The founder's ruling, and the reason for it: a hand-written list of "these
 * look similar" heritages is a coded statement about populations. Derived from
 * the weight tables, it is instead a statement about OUR DATA — two heritages
 * are neighbours exactly when the vocabularies we feed the image model barely
 * differ. It recomputes whenever a palette changes, so the grouping cannot rot
 * into a stale ethnic list that outlives the numbers that justified it.
 *
 * WHAT PROMPTED IT. The founder saw two pairs on one sheet read as near-twins.
 * The persisted identities showed the resolver had drawn them apart — one pair
 * differed on eight axes — but Afro-Caribbean and West African turn out to
 * share a byte-identical style list, near-identical colour weights (78/22 vs
 * 82/18) and 0.86 texture overlap. The resolver believed it varied heritage
 * and nothing downstream varied. Difference that exists only in an enum is not
 * difference a customer can see.
 *
 * **Pairwise, deliberately, with no transitive closure.** The rule this feeds
 * is itself about a PAIR, so grouping through a bridge heritage would assert
 * "these render alike" about two heritages our own metric scored far apart —
 * and at a lower threshold the chain does form: the Mediterranean group
 * swallows East Asian at 0.70. A symmetric predicate cannot chain by
 * construction, which beats tuning a threshold to avoid it.
 */

/** Overlap of two weighted vocabularies: the mass they share, 0…1. */
function overlap(
  a: readonly (readonly [string, number])[],
  b: readonly (readonly [string, number])[],
): number {
  const normalize = (weights: readonly (readonly [string, number])[]) => {
    const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
    return new Map(weights.map(([value, weight]) => [value, weight / total]));
  };
  const left = normalize(a);
  const right = normalize(b);
  let shared = 0;
  left.forEach((mass, value) => {
    shared += Math.min(mass, right.get(value) ?? 0);
  });
  return shared;
}

/**
 * The bar, pinned rather than derived.
 *
 * Measured across all 66 heritage pairs, the ordered overlaps run …0.82, 0.82,
 * 0.81, then drop to 0.76. 0.80 sits in that gap. It is a constant and not a
 * largest-gap calculation on purpose: a derived threshold would silently
 * re-cluster the moment a palette moved, which is the rot this design exists to
 * prevent. `heritageNeighbourhoods.test.ts` snapshots the resulting pairs, so a
 * palette edit that changes them fails the build and asks for a human ruling.
 */
export const NEIGHBOUR_THRESHOLD = 0.8;

/**
 * Three signals, and the pair is judged by its WEAKEST.
 *
 * Note the style signal is close to degenerate: `stylesFor` branches on
 * coiled-hair heritage and nothing finer, so it separates the coiled
 * traditions from everything else and says nothing within either group. The
 * effective metric is therefore min(colour, texture, coiledness). That is
 * honest for what it is — those are the vocabularies that actually reach the
 * prompt — and it is why the threshold is pinned rather than trusted.
 */
function vocabularyOverlap(a: Heritage, b: Heritage): number {
  const styles = (heritage: Heritage) =>
    stylesFor("male", heritage, "30s").map(([style, weight]) => [style.name, weight] as const);
  const colours = (heritage: Heritage) => HAIR_COLOUR_WEIGHTS[heritage] ?? DEFAULT_HAIR_COLOURS;
  const textures = (heritage: Heritage) => TEXTURE_BY_HERITAGE[heritage] ?? TEXTURE_DEFAULT;
  return Math.min(
    overlap(styles(a), styles(b)),
    overlap(colours(a), colours(b)),
    overlap(textures(a), textures(b)),
  );
}

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Computed once at module load; the tables are constants. */
const NEIGHBOUR_PAIRS: ReadonlySet<string> = (() => {
  const pairs = new Set<string>();
  for (let i = 0; i < HERITAGES.length; i += 1) {
    for (let j = i + 1; j < HERITAGES.length; j += 1) {
      if (vocabularyOverlap(HERITAGES[i], HERITAGES[j]) >= NEIGHBOUR_THRESHOLD) {
        pairs.add(key(HERITAGES[i], HERITAGES[j]));
      }
    }
  }
  return pairs;
})();

/** Exposed so a test can pin the full set and catch a palette edit. */
export function neighbourPairs(): string[] {
  return Array.from(NEIGHBOUR_PAIRS).sort();
}

/** Do our vocabularies render these two alike? Same heritage counts. */
export function sameNeighbourhood(a: string, b: string): boolean {
  return a === b || NEIGHBOUR_PAIRS.has(key(a, b));
}

/* ------------------------------------------------------- the second axis */

/**
 * Colour at the resolution that survives a contact sheet.
 *
 * Derived from `SHADE_LADDER` index ranges rather than a second hand-written
 * list, so widening the palette cannot leave a colour unbucketed. At tile size
 * nobody reads "chestnut versus auburn" — they read light, mid, dark.
 */
export type ColourBucket = "light" | "mid" | "dark" | "grey";

export function colourBucket(colour: HairColour): ColourBucket {
  if (colour === "grey" || colour === "white") return "grey";
  const at = SHADE_LADDER.indexOf(colour);
  if (at < 0) return "mid";
  const third = SHADE_LADDER.length / 3;
  return at < third ? "light" : at < third * 2 ? "mid" : "dark";
}

/**
 * Facial hair at the same resolution: is there a beard or isn't there.
 *
 * Coarse on purpose, and the two flagged pairs are why. One was heavy stubble
 * beside light stubble, the other a short beard beside a full one — four
 * distinct enum values, two visually identical decisions. A finer bucketing
 * would have called both pairs "different" and let them through.
 */
export type BeardBucket = "bearded" | "bare";

export function beardBucket(facialHair: FacialHair | null): BeardBucket | null {
  if (facialHair === null) return null;
  return facialHair === "short beard" || facialHair === "full beard" ? "bearded" : "bare";
}

/**
 * Which axis carries the second signal for this candidate.
 *
 * Men get facial hair, which is the loudest thing on a man's face at tile
 * scale. Everyone else gets hair colour — for women the founder's "colour or
 * length" resolves to colour, because length is already the first axis.
 */
export function secondAxis(sex: Sex): "beard" | "colour" {
  return sex === "male" ? "beard" : "colour";
}
