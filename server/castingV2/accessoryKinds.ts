/**
 * WHAT KIND OF THING AN ACCESSORY IS — one table, two very different consumers.
 *
 * # Why this moved out of the mask-cutter
 *
 * It began as the mask-cutter's private placement table: an earring hangs from a
 * lobe, glasses sit at the eyes, so `statedAccessories` is one facet over
 * several objects and every question about it needs the instruction as well as
 * the facet. That much is unchanged.
 *
 * Composition then turned out to need the same knowledge for a different reason
 * (D-238). A departure is retired by a later ANSWER on the same subject — that
 * is what makes the founder's remove-then-re-add work — but `statedAccessories`
 * is plural, so the subject is too coarse a unit to retire on:
 *
 *     "remove her glasses"  then  "round wire-frame glasses"   → retire
 *     "remove her glasses"  then  "small gold hoops"           → DO NOT retire
 *
 * Retiring on the second would resurrect her glasses while she was asking about
 * her ears. The two asks are told apart by what KIND of object each names, and
 * the kind vocabulary already existed here — so it is shared rather than
 * restated. A second copy of this table is a second answer to "are these the
 * same thing", and law 4 says the copies drift.
 */

/**
 * The objects the product can place, anchor and name.
 *
 * `region` doubles as the kind id: two descriptions that segment to the same
 * region are the same kind of thing. That is not a coincidence being exploited —
 * a region here IS "where this class of object lives on a face", which is the
 * same question composition is asking.
 */
export const LANDMARK_OF_ACCESSORY: {
  words: readonly string[];
  landmark: string;
  drops: boolean;
  /**
   * WHAT TO ASK A SEGMENTER FOR ONCE IT EXISTS — the other half of the same
   * table, and it was missing.
   *
   * An addition cannot be segmented before it is painted, but it can be
   * segmented AFTER, and that is what the harvest asks. The name for that
   * question was a hardcoded `"earring"` fallback, so **an edit adding or
   * removing GLASSES harvested wherever her earrings were.** Exactly the defect
   * `landmarkNameOf` exists to prevent: `statedAccessories` is one facet over
   * several objects, and every question about it needs the instruction as well
   * as the facet.
   */
  region: string;
  /**
   * IS THIS THING WORN IN TWOS? (fable-118 ruling (b).)
   *
   * CLAUDE.md law 8's founding example, and it took the founder's own eyes to
   * find it: he asked for "gold hoop earrings" and got ONE, on v#156, with the
   * other ear fully visible and bare — then the same single hoop on the OTHER
   * ear on v#157. Nothing in the paid prompt had ever said a pair means both
   * ears, and nothing in the reader's question had either, so the painter chose
   * an ear and the reader passed what it saw.
   *
   * Glasses are one object across two eyes; a nose stud is one thing in one
   * place. Only earrings are a genuine pair, so only earrings say so.
   */
  pair: boolean;
  /** How to name both sides, in the painter's clause and the reader's. */
  bothSides?: string;
  /**
   * WHAT THE SITE LOOKS LIKE WITH THE THING GONE (chunk 3,
   * `LIBRARY_REMOVAL_DESIGN.md` §3).
   *
   * A removal on the repaint road is a slot declared vacant, and dropping its
   * words and its crop is not enough: the MASTER is reference 1, so a born-worn
   * item — her own glasses, in the master by definition — is painted straight
   * back on by the very render that was meant to take it off. The recipe has to
   * SAY the absence.
   *
   * Required, not optional, so a new kind cannot land without one — the
   * compiler asks the question a reviewer would forget to.
   *
   * Written as a STATE and never as an instruction ("no earrings — bare
   * earlobes", never "remove the earrings"), which is what makes it pass
   * `IMPERATIVE_OPENER` by construction rather than by care. And derived from
   * this table at emission rather than authored beside each ask, for the reason
   * fable-195 gave about descriptions: a sentence generated from the record has
   * nowhere to diverge to.
   */
  vacantPhrase: string;
}[] = [
  {
    words: ["earring", "stud", "hoop", "dangle", "drop"],
    landmark: "earlobe",
    drops: true,
    region: "earring",
    pair: true,
    bothSides: "one on each ear, a matching pair",
    /* Both lobes named, for the same reason `bothSides` exists: a pair is the
       one kind here that can be half-removed by a painter reading loosely. */
    vacantPhrase: "no earrings — both earlobes bare, nothing hanging from either ear",
  },
  {
    words: ["glasses", "spectacles", "frames", "sunglasses", "eyewear"],
    landmark: "eye",
    drops: false,
    region: "glasses",
    pair: false,
    /* The specimen this whole clause exists for. Her glasses are IN the master,
       so silence about them is an instruction to keep them — and the founder's
       "ghost rim" is what a half-hearted removal leaves behind. */
    vacantPhrase: "no glasses — her face uncovered, no frames, no lenses and no rim shadow on her cheeks or brows",
  },
  {
    words: ["nose ring", "nose stud", "septum", "nostril"],
    landmark: "nose",
    drops: false,
    region: "nose stud",
    pair: false,
    vacantPhrase: "no nose jewellery — her nose and septum bare, with no piercing visible",
  },
];

/**
 * The clause that says a pair means both sides, or "" for a thing worn singly.
 *
 * Derived from the same table the mask-cutter and composition read, so the
 * painter's clause, the reader's question and the placement corridor cannot
 * disagree about what kind of object this is.
 */
export function pairClauseFor(described?: string): string {
  /*
    THROUGH `accessoryEntry`, NEVER A SECOND SCAN OF THE SAME WORDS.

    The first version of this matched the word list itself and put "one on each
    ear" on **a small nose stud** — "stud" is an earring word, and first-match
    over a word list is the exact defect `accessoryEntry`'s longest-match rule
    was written to end. Caught by its own test rather than by a founder, which
    is the only reason it is a footnote instead of a fifth finding.
  */
  const matched = accessoryEntry(described);
  if (!matched) return "";
  const entry = LANDMARK_OF_ACCESSORY.find((candidate) => candidate.region === matched.region);
  return entry?.pair && entry.bothSides ? `, ${entry.bothSides}` : "";
}

/**
 * WHICH ENTRY AN INSTRUCTION NAMES.
 *
 * **Longest match wins, not first match.** "A small nose stud" contains both
 * "stud" and "nose stud", and a first-match scan put it on her earlobe — the
 * answer depended on the order of a list, which is a defect waiting for someone
 * to tidy the array. The longest matched word is the most specific thing the
 * instruction said.
 */
export function accessoryEntry(described?: string) {
  const said = (described ?? "").toLowerCase();
  let best: { landmark: string; drops: boolean; region: string; length: number } | null = null;
  for (const entry of LANDMARK_OF_ACCESSORY) {
    for (const word of entry.words) {
      if (!said.includes(word)) continue;
      if (!best || word.length > best.length) {
        best = { landmark: entry.landmark, drops: entry.drops, region: entry.region, length: word.length };
      }
    }
  }
  return best;
}

/** The kind id alone — null when nothing in the table names this thing. */
export function accessoryKindOf(described: string): string | null {
  return accessoryEntry(described)?.region ?? null;
}

/**
 * THE SENTENCE A VACATED SLOT SAYS, by kind id.
 *
 * Keyed on the REGION rather than on the words, because by the time a recipe is
 * being assembled the object has already been identified — re-reading the
 * user's phrase here would be a second answer to "what kind of thing is this",
 * and `pairClauseFor` has the scar from the first time that was done (a nose
 * stud told it was worn one on each ear).
 *
 * Null for a kind this table does not hold, and the caller must refuse rather
 * than improvise: an absence sentence invented at the call site is exactly the
 * free-floating parallel prose fable-195 ruled against, and the price of
 * getting it wrong is a paid render that says something untrue about her face.
 * Open-vocabulary removals arrive with their own vocabulary (roadmap §5), never
 * by loosening this door.
 */
export function vacantPhraseFor(kind: string | null | undefined): string | null {
  if (!kind) return null;
  return LANDMARK_OF_ACCESSORY.find((entry) => entry.region === kind)?.vacantPhrase ?? null;
}
