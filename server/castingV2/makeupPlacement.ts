/**
 * WHERE A MAKEUP ASK LIVES ON HER FACE — the stylist's answer, not the mask's.
 *
 * # The defect this ends
 *
 * `makeup` mapped to the region `face skin`, full stop. So "add nude lip gloss"
 * claimed her entire face: the segmenter was asked for face skin, the painter
 * was handed face skin, and under the surrender rule the newer edit wins the
 * pixels it claims. On the first production walk of segment permanence that
 * cost her the freckles she had paid for one render earlier — a lip ask
 * legitimately took the whole face, freckles included, and no amount of
 * carried-set correctness could have saved them.
 *
 * This is law 8, in its own words: *this is a visual studio, not a maths class.*
 * A stylist knows a lip gloss lives on lips. The mask was arithmetically
 * consistent and ontologically wrong, which is the fringe incident's exact
 * shape — a change scoped by the region the code found convenient rather than
 * by the thing the user named.
 *
 * # Why a TABLE, and not a field on the interpreter (fable-103)
 *
 * The D-238 shape: a closed vocabulary consulted deterministically, which is
 * knowledge rather than string overlap. Widening the interpreter's output means
 * changing a prompt on the paid path, and this campaign does not make that trade
 * for a hypothetical. The catalogue's own makeup asks are all coverable here;
 * the interpreter field is FILED with a trigger — the first walk or Tier A miss
 * attributable to a placement this table could not know reopens it, with the
 * frame on the table.
 *
 * # The default is the old behaviour, deliberately
 *
 * Silence resolves to `full-face`, which is the region makeup has always used.
 * So an ask this table has never heard of is exactly as well served as it is
 * today — coarse, and never WRONGLY placed. A default that guessed `lips`
 * would put foundation on her mouth.
 */

/** Where on a face a makeup ask lands. Closed — the mask has no other answers. */
export const MAKEUP_PLACEMENTS = ["lips", "eyes", "cheeks", "full-face"] as const;
export type MakeupPlacement = typeof MAKEUP_PLACEMENTS[number];

/**
 * WHERE SHE SAID IT GOES — her own words, and they outrank the dictionary
 * (founder specimen, fable-104).
 *
 * "Gloss on her cheekbones" goes on her cheekbones. The product-kind table
 * below is the FALLBACK, for asks that name a thing without naming a place;
 * law 8 puts her sentence first and the dictionary second.
 *
 * This is also the context gate that keeps a noun from capturing an ask it has
 * nothing to do with. "Add gloss to her skin" is a skin-finish ask and "gloss
 * on her hair" a hair-finish ask — both belong to other facets entirely, and if
 * one ever reaches here as makeup it must NOT be dragged onto her mouth by the
 * word "gloss". Neither names a lip, so neither can be.
 *
 * Hair has no entry, deliberately: there is no makeup placement for it, so a
 * hair-worded ask falls to the coarse default rather than being given a
 * confident wrong answer.
 */
const DESTINATION_OF_MAKEUP: ReadonlyArray<{
  words: readonly string[];
  placement: MakeupPlacement;
}> = [
  { placement: "lips", words: ["lips", "lip", "mouth", "pout", "cupid's bow"] },
  { placement: "eyes", words: ["eyes", "eye", "eyelid", "eyelids", "lid", "lids", "lash", "lashes", "waterline"] },
  { placement: "cheeks", words: ["cheekbones", "cheekbone", "cheeks", "cheek"] },
  { placement: "full-face", words: ["skin", "complexion", "whole face", "all over her face", "face"] },
];

/**
 * WHAT KIND OF THING IT IS — the fallback, for an ask that names no place.
 *
 * Product nouns only, and specific ones. Bare finish words ("gloss", "shadow")
 * are deliberately absent: they are the ones that capture asks belonging to
 * other facets, which is the swamp-with-a-menu failure D-173 named. "Lip gloss"
 * lands by its LIP, not by its gloss.
 *
 * Longest match wins, for `accessoryEntry`'s own reason: "lip liner" contains
 * "liner", and a first-match scan would put her lip liner on her eyelids — an
 * answer that depends on the order of an array is a defect waiting for someone
 * to tidy it.
 */
export const PLACEMENT_OF_MAKEUP: ReadonlyArray<{
  words: readonly string[];
  placement: MakeupPlacement;
}> = [
  { placement: "lips", words: ["lipstick", "lipgloss", "lip gloss", "lip liner", "lip stain", "lip tint", "lip balm"] },
  { placement: "eyes", words: ["eyeliner", "eye liner", "winged liner", "eyeshadow", "eye shadow", "smoky eye", "smokey eye", "mascara"] },
  { placement: "cheeks", words: ["blusher", "blush", "contouring", "contour", "bronzer", "highlighter"] },
  { placement: "full-face", words: ["foundation", "concealer", "base makeup", "full glam", "full-glam", "no-makeup makeup"] },
];

/**
 * WHERE THIS ASK GOES — `full-face` when the table has never heard of it.
 *
 * Never null. A null would have to be handled by every caller, and the one that
 * forgot would reach the mask with `undefined` and segment nothing.
 */
export function placementOfMakeup(described: string | null | undefined): MakeupPlacement {
  const said = (described ?? "").toLowerCase();
  const longest = (table: typeof PLACEMENT_OF_MAKEUP) => {
    let best: { placement: MakeupPlacement; length: number } | null = null;
    for (const entry of table) {
      for (const word of entry.words) {
        if (!said.includes(word)) continue;
        if (!best || word.length > best.length) best = { placement: entry.placement, length: word.length };
      }
    }
    return best?.placement ?? null;
  };
  /* Her sentence first, the dictionary second, the coarse default last. */
  return longest(DESTINATION_OF_MAKEUP) ?? longest(PLACEMENT_OF_MAKEUP) ?? "full-face";
}

/**
 * THE SEGMENTATION QUESTION EACH PLACEMENT ASKS.
 *
 * `cheeks` and `full-face` both answer `face skin`, and that is honest rather
 * than lazy: the segmenter's vocabulary has no cheeks, so a blush ask is
 * coarse — correctly placed on skin, just not narrowed further. It is written
 * as its own placement anyway, because the day a cheek region exists this table
 * is the only thing that changes.
 */
const REGION_OF_PLACEMENT: Record<MakeupPlacement, string> = {
  lips: "lips",
  eyes: "eyes",
  cheeks: "face skin",
  "full-face": "face skin",
};

export function regionOfPlacement(placement: MakeupPlacement): string {
  return REGION_OF_PLACEMENT[placement];
}

/** The region a makeup ask should be segmented and harvested in. */
export function makeupRegionFor(described: string | null | undefined): string {
  return regionOfPlacement(placementOfMakeup(described));
}
