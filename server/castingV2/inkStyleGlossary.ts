/**
 * WHAT A TATTOO STYLE'S NAME MEANS TO A TATTOOIST, AND WHAT IT MISLEADS AN
 * ENGINE INTO — founder-ordered (fable-1313 §2), from his own test of the
 * words road.
 *
 * # The specimen, and why a glossary rather than a better prompt
 *
 * He asked for a **cybersigilism** tattoo on a cast's neck. The mechanism
 * worked end to end — rendered, minted a crop, drew a card — and the DESIGN was
 * wrong: *"its definitely cyber but not modern cybersigilism type design"*. The
 * frame came back circuit traces, nodes and chip lines, because the engine read
 * the word the way the word looks. Cybersigilism is not about technology at
 * all: it is ultra-fine spiky ornamental work, thorn-like flicks and tapering
 * points, closer to gothic ironwork than to a motherboard.
 *
 * A style name is a word the culture agrees on and the engine does not. So this
 * is a VOCABULARY — the smallest thing that fixes it — and not a change to how
 * ink is asked for or how it is painted. `inkRealism.ts`'s clauses are what
 * make ink read as ink in skin; those are untouched, and this sits beside them.
 *
 * # THE NOT-CLAUSE IS THE HALF THAT DOES THE WORK
 *
 * Every entry may say what its name misleads toward, and the misleading ones
 * are exactly the entries worth having: *cybersigilism* pulls toward circuitry,
 * *tribal* toward a specific 1990s armband, *biomech* toward robots, *ignorant
 * style* toward badly drawn. A description alone competes with the engine's
 * prior; a description plus an explicit refusal displaces it.
 *
 * Entries whose name is honest carry no `not` — *dotwork* really is made of
 * dots — and inventing one for them would be noise on a paid prompt.
 *
 * # ONE OWNER, BOTH ROADS
 *
 * Every road that turns WORDS into ink reads this: the words-road recipe, and
 * the reference road wherever a style is named in prose rather than shown in a
 * picture. A second copy of *"cybersigilism means…"* would drift at exactly the
 * point it exists to hold still (working law 4).
 *
 * It never touches a road that has the DESIGN as a picture and no style word in
 * the sentence: a crop of her own tattoo is the description, and prose about
 * what a style usually looks like would be an instruction competing with the
 * artwork in front of it.
 */

export type InkStyle = {
  /** The catalogue's own key — stable, and what a log or a test names. */
  readonly key: string;
  /**
   * Every spelling the culture actually uses, including the ones people type.
   *
   * Matched longest-first and on word boundaries, so `neo-traditional` cannot
   * be swallowed by `traditional` and `fineline` matches as readily as
   * `fine line`. Hyphen and space are treated as the same character, because
   * nobody agrees which one a style takes.
   */
  readonly names: readonly string[];
  /**
   * WHICH OF THOSE NAMES ARE ALSO ORDINARY ENGLISH — each with its one-line
   * reason, so the judgement lives beside the word it is about.
   *
   * ⚠ **The court that bought this** (ordered fable-1384, run opus-1036, ruled
   * fable-1390 §1). `geometric` and `traditional` are style names AND ordinary
   * adjectives, so an ask that was never about style drew a style clause. At
   * the frames, on a controlled pair whose only difference was the adjective:
   * *"a small geometric skeleton design"* came back a WIDE SYMMETRIC MANDALA
   * across the whole throat with a skull at its centre, and the same ask
   * without the word came back the small side-of-neck skeleton figure she
   * asked for. **The clause did not tune the design; it replaced it.**
   *
   * A bare name only counts when the next word is a STYLE MARKER
   * ({@link STYLE_MARKERS}) or when it is the last thing she said. Anything
   * else and the occurrence is ignored — which is a return to exactly the
   * prompt this product composed before the glossary existed, so the failure
   * direction is *no clause* rather than *a wrong clause*.
   *
   * The other measured over-trigger, `traditional`, is here **on the mechanism
   * and not on harm** — the founder judged the fired frame acceptable
   * (*"traditional came out japanese traditional and its correct"*, fable-1392),
   * overruling both my reading and the reviewer's. The routing is still wrong:
   * an entry's paint string reached a prompt that did not name that entry.
   *
   * Absent where every name is coined. `inkStyleGlossary.test.ts` pins the
   * classification of EVERY name in the glossary, so a style added later
   * cannot skip the question — an unclassified name reddens the suite.
   */
  /*
    `string | undefined` rather than `string`: `Object.freeze` on the seed array
    below defeats contextual typing, so TypeScript infers a UNION of the entry
    literals and gives every entry an optional `?: undefined` member for every
    key any sibling declared. The values are never undefined in practice, and
    the test asserts each marking carries a real reason.
  */
  readonly bare?: Readonly<Record<string, string | undefined>>;
  /** What the engine should PAINT — the tattooist's reading of the word. */
  readonly paint: string;
  /**
   * What the NAME pulls toward and the style is not. Absent where the name is
   * honest; never invented to fill the field.
   */
  readonly not?: string;
};

/**
 * The seed set, as ordered (fable-1313 §2).
 *
 * Ordered loosely by how badly the name misleads rather than alphabetically —
 * the top of this list is the reason it exists.
 */
export const INK_STYLES: readonly InkStyle[] = Object.freeze([
  {
    key: "cybersigilism",
    names: ["cybersigilism", "cyber sigilism", "cybersigil", "cyber sigil"],
    paint: "ultra-fine spiky ornamental linework — thorn-like flicks, sharp tapering points, "
      + "barbed and claw-like forms, baroque or gothic flourishes, sigil-like symmetry, and "
      + "generous empty skin between the strokes",
    not: "NOT circuitry, not circuit-board traces, not microchips, not wiring or nodes, and "
      + "nothing that depicts technology or machinery",
  },
  {
    key: "tribal",
    bare: { tribal: "an ordinary adjective — 'a tribal mask portrait' is a subject, not a style" },
    names: ["tribal", "polynesian", "maori", "neotribal", "neo tribal"],
    paint: "bold solid black shapes with sweeping curves and sharp points, built from thick "
      + "tapering bands that interlock, with the skin itself forming the pattern between them",
    not: "not a thin decorative band and not a small motif — the black mass is the design",
  },
  {
    key: "biomechanical",
    names: ["biomechanical", "biomech", "bio mechanical", "bio-mech"],
    paint: "forms that look grown rather than built — sinew, bone and carapace flowing into "
      + "one another, deeply shaded so they read as three-dimensional under the skin",
    not: "not robots, not visible screws or panels, and not anything that looks manufactured",
  },
  {
    key: "ignorantStyle",
    bare: { ignorant: "ordinary English on its own — the two-word `ignorant style` is longer and wins where she means the style" },
    names: ["ignorant style", "ignorant-style", "ignorant", "naive style"],
    paint: "deliberately crude single-weight outlines with childlike, unpolished proportions "
      + "and no shading — drawn quickly and confidently on purpose",
    not: "not badly executed and not shaky — the roughness is the style, and the line itself "
      + "is still clean and deliberate",
  },
  {
    key: "fineLine",
    names: ["fine line", "fine-line", "fineline", "single needle", "single-needle", "micro realism", "microrealism"],
    paint: "very thin, even, delicate linework with little or no solid black, soft or absent "
      + "shading, and a light overall touch",
  },
  {
    key: "americanTraditional",
    bare: {
      traditional: "the commonest ordinary adjective in the whole vocabulary — 'a traditional chinese dragon' means CLASSICAL and drew the sailor palette (measured, fable-1392: the frame was still acceptable to him)",
      "old school": "ordinary English — 'an old school telephone' is a subject",
    },
    names: ["american traditional", "old school", "old-school", "sailor jerry", "traditional"],
    paint: "heavy black outlines, a small flat palette of red, yellow and green, simple bold "
      + "iconography and minimal shading",
  },
  {
    key: "neoTraditional",
    names: ["neo traditional", "neo-traditional", "neotraditional"],
    paint: "traditional's bold outline discipline with a wider palette, richer shading and "
      + "more decorative, illustrative detail",
  },
  {
    key: "irezumi",
    bare: { japanese: "a nationality before it is a style — 'a japanese maple leaf' would draw koi, dragons and saturated colour onto a delicate leaf" },
    names: ["irezumi", "japanese", "japanese traditional", "tebori", "horimono"],
    paint: "classical Japanese imagery — koi, dragons, tigers, peonies, waves — with bold "
      + "outlines, deep saturated colour and stylised wind-and-water background flowing "
      + "around the subject",
  },
  {
    key: "blackwork",
    bare: {
      "black work": "two ordinary words beside each other; the closed-up `blackwork` is the coined one",
      "black out": "ordinary English — a blackout is a thing that happens to a room",
      blackout: "same word, closed up, and no more a style word for it",
    },
    names: ["blackwork", "black work", "black out", "blackout"],
    paint: "solid black used as the material itself — large filled areas, strong graphic "
      + "shapes, and high contrast against bare skin",
  },
  {
    key: "dotwork",
    bare: { "dot work": "two ordinary words beside each other; the closed-up `dotwork` is the coined one" },
    names: ["dotwork", "dot work", "stippling", "stipple"],
    paint: "form and shadow built entirely from dots of varying density, with no solid "
      + "shading and no continuous grey",
  },
  {
    key: "geometric",
    bare: { geometric: "THE PROVEN-HARM SPECIMEN — 'a small geometric skeleton design' delivered a throat mandala instead (opus-1036 §3a, at the frames)" },
    names: ["geometric", "sacred geometry", "linework geometric"],
    paint: "precise repeating geometry — mandalas, tessellation, mirrored symmetry — drawn "
      + "with ruled, even lines",
  },
  {
    key: "chicano",
    names: ["chicano", "chicanx", "black and grey chicano"],
    paint: "fine black-and-grey soft shading with smooth gradients, script lettering, roses, "
      + "and portrait work with no colour at all",
  },
  {
    key: "watercolour",
    names: ["watercolour", "watercolor", "water colour", "water color"],
    paint: "loose translucent washes of colour with soft bleeding edges and visible splashes "
      + "or runs, with little or no black outline",
    not: "not a bright cartoon fill — the colour must look thin and bled rather than blocked in",
  },
]);

/** Hyphens, underscores and runs of space are one separator — nobody agrees. */
function flatten(text: string): string {
  return text.toLowerCase().replace(/[\s_-]+/g, " ").trim();
}

/**
 * WHICH STYLES HER SENTENCE NAMES, longest name first so a compound wins.
 *
 * `neo-traditional` contains `traditional`; without the length ordering an ask
 * for the first would file as the second and be painted with the wrong palette
 * — a wrong answer that looks like a right one, which is the shape of every
 * matcher bug this repo has paid for.
 *
 * At most ONE style is returned. Two style clauses in one prompt are two
 * instructions about how to draw one design, and the engine gets to choose —
 * the same reason a transform refuses two axes in one sentence. The first
 * match by name length wins, which is the most specific thing she said.
 *
 * # ⚠ AND A BARE NAME MUST BE FOLLOWED BY A MARKER (fable-1390 §1)
 *
 * See {@link InkStyle.bare}. A name that is also ordinary English only counts
 * where the next word says she is talking about a STYLE, or where it is the
 * last thing she said. Otherwise the occurrence is SKIPPED and the search goes
 * on — so *"a small geometric skeleton design"* can still find a real style
 * word later in the sentence, and finds nothing when there is none.
 *
 * The failure direction is deliberate: a bare name that goes unmatched composes
 * exactly the prompt this product composed before the glossary existed. A bare
 * name that matches wrongly REPLACES her design, which is what the frames
 * showed.
 */
export function inkStyleNamedIn(words: string | null | undefined): InkStyle | null {
  if (!words) return null;
  const said = ` ${flatten(words)} `;
  const candidates = INK_STYLES
    .flatMap((style) => style.names.map((name) => ({
      style,
      name: flatten(name),
      /*
        ⚠ BARENESS IS A FACT ABOUT THE FLATTENED WORD, NOT ABOUT ONE SPELLING
        OF IT — and the first draft got this wrong in a way the sweep caught.

        `old school` was marked and `old-school` was not; they flatten to the
        same string, the unmarked one sorted equal and matched first, and
        *"an old school telephone"* went on drawing the sailor palette while the
        entry beside it said the word was bare. So a name is bare if ANY authored
        spelling that flattens to it is marked, which makes marking one spelling
        enough and removes the whole class.
      */
      bare: style.bare !== undefined
        && Object.keys(style.bare).some((marked) => flatten(marked) === flatten(name)),
    })))
    .sort((a, b) => b.name.length - a.name.length);
  for (const { style, name, bare } of candidates) {
    const at = said.indexOf(` ${name} `);
    if (at === -1) continue;
    if (!bare) return style;
    /* What she said next. The name sits between two spaces, so the remainder
       starts one space past its end. */
    const after = said.slice(at + name.length + 2).trim();
    if (after === "") return style;
    if (STYLE_MARKERS.has(after.split(" ")[0])) return style;
  }
  return null;
}

/**
 * THE WORDS THAT SAY SHE IS NAMING A STYLE AND NOT DESCRIBING A SUBJECT.
 *
 * Short on purpose, and every entry is a word that can only follow a style
 * name: *"a tribal tattoo"*, *"a geometric pattern"*, *"a traditional piece"*.
 * The ones that hurt are the ones that could equally follow an adjective
 * describing a THING — `skeleton`, `dragon`, `leaf`, `mask` — and none of those
 * is here, which is the whole discrimination.
 *
 * ⚠ **Adding a word here widens what a bare name can claim.** `mandala` is the
 * tempting one and it is deliberately absent: it is the geometric entry's own
 * paint word, so admitting it would let `geometric` claim a design that named
 * the shape rather than the style.
 */
const STYLE_MARKERS: ReadonlySet<string> = new Set([
  "tattoo", "tattoos", "tattooing",
  "style", "styles", "styled",
  "piece", "pieces",
  "work", "artwork",
  "design", "designs",
  "pattern", "patterns",
  "lettering", "script", "flash", "sleeve", "band", "motif", "ink",
]);

/**
 * THE CLAUSE, or an empty string when she named no style.
 *
 * Empty is the common case and it must cost nothing: an ink ask with no style
 * word in it composes exactly the prompt it composed before this existed, byte
 * for byte. That is what makes the glossary safe to consult on every ink road
 * rather than only on the ones somebody remembered to wire.
 */
export function inkStyleClause(words: string | null | undefined): string {
  const style = inkStyleNamedIn(words);
  if (style === null) return "";
  const not = style.not ? ` It is ${style.not}.` : "";
  return `The style named is ${style.names[0]}: ${style.paint}.${not}`;
}
