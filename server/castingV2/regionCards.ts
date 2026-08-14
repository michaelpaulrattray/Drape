/**
 * ONE CARD PER REGION — the third key space (V1's accessory half).
 *
 * # Why a third registry, measured rather than assumed
 *
 * A scaffold accessory kind was added to the accessory table and the suite
 * named every site that still had to be edited by hand. Two, and both are
 * facts about a REGION rather than about the kind that lives there:
 *
 * ```
 * FRINGE_AT_EDGE          does the material stand proud of any outline a
 *                         segmenter can draw
 * CONFUSABLE_NEIGHBOURS   which OTHER regions its boundary is confused with
 * ```
 *
 * Both are keyed on the words sent to the segmenter, and both are shared by
 * anatomy and accessories alike: `hair` has fringe whether the question came
 * from a haircut or from an earring hidden under it. A subject card cannot hold
 * them (five subjects share the hair region), and a facet card cannot either
 * (three facets do). They belong to the region, so the region gets a card.
 *
 * The phrasing lives here too — the words that actually leave for the
 * segmenter, with the reading that chose them — which puts everything about a
 * region in one place: **what it is called on the wire, what its edge is like,
 * and what it is confused with.**
 *
 * # What this is NOT
 *
 * It is not a list of regions. The regions themselves are named by the facet
 * cards and by the accessory table, and this holds what is TRUE of them — a
 * region with no card is a region nobody has answered these questions for, and
 * `maskedRefine`'s own totality tests are what make that impossible to ship.
 */

export type AskedAs = {
  /** The words that actually leave for the segmenter. */
  readonly words: string;
  /**
   * The reading that chose them — the bench's own table, as DATA.
   *
   * A phrasing chosen by measurement and recorded as prose is a number nobody
   * can print again. Each row is `phrasing → share of the frame the returned
   * mask covered`, per specimen, so the verdict can be re-read and compared the
   * day a reader changes underneath it.
   */
  readonly measured: ReadonlyArray<{
    readonly specimen: string;
    readonly readings: Readonly<Record<string, number>>;
  }>;
  /** Why the winner won, in one sentence. */
  readonly verdict: string;
};

export type RegionCard = {
  /**
   * THE WORDS SENT, WHEN THEY ARE NOT THE REGION'S OWN NAME.
   *
   * A region's name is a KEY — courts, floors, neighbour lists and library rows
   * are keyed on it — and what the segmenter is ASKED is a phrasing, chosen by
   * measurement. Absent means the key is the phrasing, which is true of every
   * region but one.
   */
  readonly askedAs?: AskedAs;
  /**
   * DOES ITS MATERIAL STAND PROUD OF THE OUTLINE?
   *
   * A harvest reaches past its boundary only where the answer is yes. Skin does
   * not have fringe, and treating it as though it did is where run-6's tear
   * came from.
   */
  readonly fringe: { readonly at: boolean; readonly why: string };
  /**
   * WHICH REGIONS ITS BOUNDARY IS CONFUSED WITH.
   *
   * Territory nobody asked about goes back to the master, and this is the list
   * that decides what "nobody asked about" means at a shared edge.
   */
  readonly neighbours: { readonly with: readonly string[]; readonly why: string };
};

export const REGION_CARDS = {
  hair: {
    fringe: { at: true, why: "flyaway strands and coils stand proud of any outline — the founding case" },
    neighbours: { with: [], why: "hair is the aggressor here, never the victim" },
  },
  "facial hair": {
    fringe: { at: true, why: "stubble and beard edges are individual hairs over skin" },
    neighbours: { with: ["hair"], why: "they meet at the sideburn" },
  },
  eyebrows: {
    fringe: { at: true, why: "brow hairs stand outside the brow's own shape" },
    neighbours: { with: ["hair"], why: "a fringe reaches the brow" },
  },
  eyes: {
    fringe: { at: true, why: "lashes reach well past the lid the segmenter draws" },
    neighbours: { with: ["hair", "eyebrows"], why: "a fringe falls across the eyes" },
  },
  earring: {
    fringe: { at: true, why: "hooks and fine chains are thinner than a confidence frontier" },
    neighbours: { with: ["hair"], why: "the lobe sits under her hair" },
  },
  glasses: {
    fringe: { at: true, why: "a wire temple arm is a couple of pixels wide" },
    neighbours: { with: ["hair"], why: "the arms run into it at the temples" },
  },
  "face skin": {
    fringe: {
      at: false,
      why: "skin is a surface bounded by other features; it has no fringe, and this is where "
        + "the tear came from",
    },
    neighbours: {
      with: ["hair", "facial hair"],
      why: "both grow over and against skin, and hair is what moved in run-6",
    },
  },
  lips: {
    askedAs: {
      words: "the lips",
      measured: [
        { specimen: "woman, OPEN mouth", readings: { lips: 0, "her lips": 0.000944, "his lips": 0.001022, "the lips": 0.002342 } },
        { specimen: "woman, closed", readings: { lips: 0.0015, "her lips": 0.001459, "his lips": 0.00147, "the lips": 0.001507 } },
        { specimen: "woman (warm)", readings: { lips: 0.002178, "her lips": 0.002151, "his lips": 0.002165, "the lips": 0.002184 } },
        { specimen: "woman (fixture)", readings: { lips: 0.001993, "her lips": 0.001965, "his lips": 0.001963, "the lips": 0.001992 } },
        { specimen: "MAN, closed mouth", readings: { lips: 0.001878, "her lips": 0, "his lips": 0.00187, "the lips": 0.0019 } },
      ],
      verdict: "bare \"lips\" answers NOTHING on an open mouth and \"her lips\" answers "
        + "nothing on a man — a gendered phrasing carries a gendered failure into a product "
        + "that casts men. \"The lips\" answers on 5 of 5 and reads highest of the four on the "
        + "one frame that was failing.",
  
    },
    fringe: { at: false, why: "the vermilion border is an edge, not a fringe" },
    neighbours: { with: ["facial hair"], why: "a moustache sits on the vermilion border" },
  },
  nose: {
    fringe: { at: false, why: "a contour against the face, with nothing finer at its boundary" },
    neighbours: { with: [], why: "nothing that moves borders it" },
  },
  ear: {
    fringe: {
      at: false,
      why: "hair may fall across it, but that fringe is the HAIR's, harvested when hair is "
        + "the question",
    },
    neighbours: { with: ["hair"], why: "hair falls over the ear" },
  },
  "nose stud": {
    fringe: { at: false, why: "a bead — solid, and larger than the boundary's error" },
    neighbours: { with: [], why: "small, and its anchor is named" },
  },
} as const satisfies Record<string, RegionCard>;

export const REGION_CARD_ENTRIES = Object.entries(REGION_CARDS) as ReadonlyArray<
  readonly [string, RegionCard]
>;

/** One field of every card, as the table it used to be typed out as. */
export function regionTableOf<T>(read: (card: RegionCard) => T): Record<string, T> {
  return Object.fromEntries(REGION_CARD_ENTRIES.map(([region, card]) => [region, read(card)]));
}
