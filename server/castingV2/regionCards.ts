/**
 * ONE CARD PER REGION — the third key space (V1's accessory half).
 *
 * # What it holds now, and what it was built for
 *
 * The region card was built for two facts about a REGION rather than about the
 * kind that lives there: whether its material stands proud of any outline a
 * segmenter can draw (`fringe`), and which other regions its boundary is
 * confused with (`neighbours`). Both were read by the masked-edit harvest and
 * by nothing else, and both were deleted with it under #2859 — his word,
 * *"delete dead code"*, on a road #1577 slice 4b had already retired.
 *
 * What is left is the phrasing — the words that actually leave for the
 * segmenter when they are not the region's own name, with the reading that
 * chose them — and the key set. The keys still mean something on their own: a
 * question asked of the DELIVERED frame (horns) proves it is owned by having a
 * card here (`referenceSlotCatalogue.test.ts`), so an empty card is an answer
 * rather than an absence.
 *
 * ⚠ What the keys no longer have is a closure test. `maskedRefine`'s fringe
 * table required a card for every region a segmenter could be asked about, so
 * that its "no fringe" default never had to be relied on. With the table gone
 * there is no default left to protect, and the requirement went with it.
 *
 * # What this is NOT
 *
 * It is not a list of regions. The regions themselves are named by the facet
 * cards and by the accessory table; this holds what is TRUE of them.
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
   * A region's name is a KEY — courts, floors and library rows are keyed on
   * it — and what the segmenter is ASKED is a phrasing, chosen by measurement.
   * Absent means the key is the phrasing, which is true of every region but
   * one.
   */
  readonly askedAs?: AskedAs;
};

export const REGION_CARDS = {
  hair: {},
  "facial hair": {},
  eyebrows: {},
  eyes: {},
  earring: {},
  glasses: {},
  "face skin": {},
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
  },
  nose: {},
  ear: {},
  "nose stud": {},
  /*
    HORNS — a cutting region since the founder ruled features carry by crop
    (2026-08-15). The phrasing is the region's own name and was measured before
    it was one: the detection court read 0.0000% on three visibly bare frames
    against 0.39–0.87% on twelve worn ones, across two faces, asked exactly
    "horns" (`V2_HORNS_VERDICT.md` §2).
  */
  horns: {},
} as const satisfies Record<string, RegionCard>;

export const REGION_CARD_ENTRIES = Object.entries(REGION_CARDS) as ReadonlyArray<
  readonly [string, RegionCard]
>;
