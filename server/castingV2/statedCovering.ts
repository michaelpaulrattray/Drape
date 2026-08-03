/**
 * A stated faith covering, rendered as the garment it is.
 *
 * # Why this is a channel and not a word (D-124)
 *
 * Both halves of the presentation-is-intent law verified on paid sheets:
 * "a Muslim woman in her 30s" produced **zero coverings across eight**, and
 * "wearing a hijab" produced **eight of eight**. The law worked.
 *
 * What the pictures showed is that the covering was **styled rather than
 * worn** — the founder's words, *"desert scarf like rather than faith based"*,
 * and the tell is hair visible at the front. A draped scarf and a hijab are not
 * the same garment, and rendering the first when the second was asked for is
 * the drop-a-stated-fact class arriving as a near-miss instead of an absence.
 *
 * A loose noun in free text gets whatever the model's prior does with the word.
 * So the noun is translated into **engineered prose** that says how it sits —
 * the A9 / broken-nose pattern, which exists because a named permanent feature
 * lost to the prior every time until the constant described it plainly.
 *
 * # The second bird: this closes a latent fragility
 *
 * Today a covering renders only because it rides the free-text character-detail
 * channel. The STATED ACCESSORIES licence **explicitly excludes headwear** and
 * the framing block bans hats outright, so the correct behaviour was correct by
 * accident of routing — and a future tightening of the headwear exclusion would
 * have taken faith presentation with it, silently. Naming the channel means the
 * law now holds because something guarantees it.
 *
 * # What does NOT change
 *
 * **Nothing is ever inferred.** No covering follows from a faith, a name, a
 * heritage or an occupation — that is stereotype authoring, and the unstated
 * zero-of-eight stands untouched. This module only ever reads the user's own
 * sentence, the same code-owned gate D-89 established for hair: the code owns
 * WHETHER it was said, and never invents that it was.
 */

/**
 * Coverings this channel knows how to render, and their rendering law.
 *
 * A closed list, and short on purpose. Each entry earns its place by being a
 * garment with a definite way of sitting that a generic "scarf" prior gets
 * wrong — which is the whole reason the channel exists. Anything not listed
 * keeps today's behaviour: it travels as character detail and renders however
 * the words land, which is exactly what happens now.
 *
 * **Nothing here is a faith test.** These are garment names a user typed. The
 * product never asks or infers what someone believes.
 */
const COVERINGS: ReadonlyArray<{ words: readonly string[]; prose: string }> = [
  {
    words: ["hijab", "headscarf", "head scarf", "khimar", "shayla"],
    prose:
      "worn as the faith garment it is: the hair COMPLETELY covered with no fringe, "
      + "parting or loose strands showing at the front or temples, the fabric meeting the "
      + "forehead in a clean line and framing the face neatly, draping to cover the ears, "
      + "neck and shoulders",
  },
  {
    words: ["niqab"],
    prose:
      "worn as the faith garment it is: the hair and neck completely covered and the face "
      + "veiled below the eyes, leaving only the eye area visible",
  },
  {
    words: ["chador"],
    prose:
      "worn as the faith garment it is: a full-length outer cloak drawn over the head and "
      + "held closed at the front, the hair completely covered with nothing showing at the "
      + "hairline, the face itself open",
  },
  {
    words: ["turban", "dastar"],
    prose:
      "worn as the faith garment it is: neatly wound and tucked, sitting squarely on the "
      + "head with the hairline covered, not draped or loosely wrapped",
  },
  {
    words: ["kippah", "yarmulke"],
    prose:
      "worn as the faith garment it is: a small round cap sitting flat on the crown of the "
      + "head, the rest of the hair uncovered",
  },
];

/**
 * Word-boundary matching against the user's OWN sentence.
 *
 * Whole words only, for the same reason the wardrobe detector uses them: a
 * stemming match turns ordinary English about a person into a garment
 * instruction, and this one writes prose into a paid prompt.
 */
export function statedCovering(briefText: string | null): { word: string; prose: string } | null {
  if (!briefText) return null;
  const words = new Set(briefText.toLowerCase().split(/[^a-z]+/).filter(Boolean));
  const phrase = briefText.toLowerCase();
  for (const covering of COVERINGS) {
    for (const word of covering.words) {
      const found = word.includes(" ") ? phrase.includes(word) : words.has(word);
      if (found) return { word, prose: covering.prose };
    }
  }
  return null;
}

/**
 * The sentence that goes in the prompt, in the user's own noun.
 *
 * Their word leads, because it is what they typed and the record should read
 * back as theirs — the engineered prose follows to say how it sits.
 */
export function coveringDirective(covering: { word: string; prose: string }): string {
  return `STATED COVERING: This person is wearing a ${covering.word}, ${covering.prose}. `
    + "Render it exactly so. It is this person's own garment and not a styling choice: "
    + "never a loosely draped fashion scarf, never a hood, and never arranged to show the "
    + "hair it covers. A stated covering that fails to appear, or appears as fashion "
    + "styling, is a failed candidate.";
}
