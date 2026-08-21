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
    names: ["irezumi", "japanese", "japanese traditional", "tebori", "horimono"],
    paint: "classical Japanese imagery — koi, dragons, tigers, peonies, waves — with bold "
      + "outlines, deep saturated colour and stylised wind-and-water background flowing "
      + "around the subject",
  },
  {
    key: "blackwork",
    names: ["blackwork", "black work", "black out", "blackout"],
    paint: "solid black used as the material itself — large filled areas, strong graphic "
      + "shapes, and high contrast against bare skin",
  },
  {
    key: "dotwork",
    names: ["dotwork", "dot work", "stippling", "stipple"],
    paint: "form and shadow built entirely from dots of varying density, with no solid "
      + "shading and no continuous grey",
  },
  {
    key: "geometric",
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
 */
export function inkStyleNamedIn(words: string | null | undefined): InkStyle | null {
  if (!words) return null;
  const said = ` ${flatten(words)} `;
  const candidates = INK_STYLES
    .flatMap((style) => style.names.map((name) => ({ style, name: flatten(name) })))
    .sort((a, b) => b.name.length - a.name.length);
  for (const { style, name } of candidates) {
    if (said.includes(` ${name} `)) return style;
  }
  return null;
}

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
