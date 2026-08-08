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
}[] = [
  { words: ["earring", "stud", "hoop", "dangle", "drop"], landmark: "earlobe", drops: true, region: "earring" },
  { words: ["glasses", "spectacles", "frames", "sunglasses", "eyewear"], landmark: "eye", drops: false, region: "glasses" },
  { words: ["nose ring", "nose stud", "septum", "nostril"], landmark: "nose", drops: false, region: "nose stud" },
];

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
