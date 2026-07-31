/**
 * The brief echo's grammar.
 *
 * The compiled brief used to render as a row of pills, and the founder's note
 * was that it "reads tokenized". This composes the same facts into one English
 * sentence with the pinned ones adjustable in place.
 *
 * Two rules shape everything here.
 *
 * **Your own words are never repeated back.** The role stays in the brief box
 * where you typed it. A machine paraphrase of your sentence is the thing that
 * makes software feel like it is talking *about* you rather than working for
 * you, and it is the specific AI-product tell this design avoids. The echo
 * covers only what the system did: what it pinned across all eight, what it
 * left free, and how the eight differ.
 *
 * **Composed, not templated.** A fuller brief and an emptier one do not produce
 * the same sentence with different words in the gaps — sex and age fuse into one
 * noun phrase, build folds in as an adjective, open axes are named up to three
 * and collapse past that. Differently shaped sentences from differently shaped
 * intents is the tell of composition, and it is the difference between this and
 * the pill row wearing a sentence costume.
 *
 * Server-owned facts, client-owned grammar: `readBriefFacts` validates, this
 * writes. Nothing here re-derives a fact.
 */

export type BriefFacts = {
  locks: {
    sex?: string;
    ageBand?: string;
    agePhase?: string;
    heritage?: string[];
    build?: string;
    energy?: string;
    look?: string;
  };
  open: string[];
  variationAxis: "look" | "disposition" | null;
};

/** Which lock a span adjusts. Matches the server's overridable vocabulary. */
export type EchoField = "sex" | "ageBand" | "agePhase" | "heritage" | "build" | "energy" | "look";

/**
 * One piece of the sentence.
 *
 * `text` is connective prose and renders at secondary weight; `fact` is a
 * pinned value and renders at full ink with a hairline underline; `open` is an
 * axis the roll deliberately varied, dashed and pinnable. The founder's
 * two-layer typography condition lives in this distinction: regulars scan the
 * facts at chip-speed because the facts are the only thing at full contrast,
 * while the sentence still reads as a sentence for a first-timer.
 */
export type EchoSpan =
  | { kind: "text"; text: string }
  | { kind: "fact"; text: string; field: EchoField }
  | { kind: "open"; text: string; field: EchoField };

/** Everyday words. The vocabulary the system stores is not the one people cast in. */
const AXIS_WORDS: Record<string, string> = {
  sex: "sex",
  ageBand: "age",
  heritage: "heritage",
  build: "build",
  energy: "presence",
  look: "look",
};

const AXIS_ORDER: EchoField[] = ["heritage", "build", "energy", "look", "sex", "ageBand"];

/** "female" + "20s" + "early" + "slim" → "a slim woman in her early 20s". */
function subjectPhrase(locks: BriefFacts["locks"]): EchoSpan[] {
  const spans: EchoSpan[] = [];
  const { sex, ageBand, agePhase, build } = locks;

  const noun = sex === "female" ? "woman" : sex === "male" ? "man" : sex ? "person" : null;
  const possessive = sex === "female" ? "her" : sex === "male" ? "his" : "their";

  // No sex and no age: there is no subject noun phrase to write at all.
  if (!noun && !ageBand) {
    if (!build) return [];
    return [
      { kind: "text", text: "Everyone on this sheet is " },
      { kind: "fact", text: `${build} built`, field: "build" },
    ];
  }

  spans.push({ kind: "text", text: "Everyone on this sheet is " });

  if (noun) {
    // Build folds into the noun as an adjective — "a slim woman", never
    // "a woman, slim". One fused span, because a user adjusting "slim woman"
    // is adjusting two facts and the popover offers whichever they clicked.
    const article = build && /^[aeiou]/i.test(build) ? "an" : "a";
    spans.push(
      build
        ? { kind: "fact", text: `${article} ${build} ${noun}`, field: "build" }
        : { kind: "fact", text: `a ${noun}`, field: "sex" },
    );
  } else {
    spans.push({ kind: "text", text: "someone " });
  }

  if (ageBand) {
    const phase = agePhase ? `${agePhase} ` : "";
    const decade = ageBand === "70s+" ? "seventies or older" : ageBand;
    const preposition = noun ? ` in ${possessive} ` : "";
    spans.push({ kind: "text", text: preposition || " " });
    spans.push({ kind: "fact", text: `${phase}${decade}`, field: "ageBand" });
  }

  return spans;
}

function heritagePhrase(heritage: string[]): EchoSpan[] {
  return [
    { kind: "text", text: ", of " },
    { kind: "fact", text: `${heritage.join(" and ")} heritage`, field: "heritage" },
  ];
}

/**
 * The sentence.
 *
 * Returns spans rather than a string so the renderer can give facts their own
 * typography and their own popover without parsing prose back apart.
 */
/**
 * Beyond this many characters the sentence needs a third line at the widths
 * the sheet actually renders at. Measured, not guessed: the sheet's echo column
 * fits roughly 110 characters per line at 14px Archivo.
 */
const TWO_LINE_BUDGET = 210;

export function composeEcho(
  facts: BriefFacts,
  options: { terse?: boolean; followLabel?: string | null } = {},
): EchoSpan[] {
  const full = composeSpans(facts, options);
  /*
    The founder's hard two-line cap, enforced by SAYING LESS rather than by
    clipping. The first version capped with `-webkit-line-clamp` and
    `overflow: hidden`, which hid the later facts entirely and cut the popover
    panel off at the sentence's bottom edge. A shorter true sentence beats a
    longer one with its end cut off — and the terse form drops the latitude
    clause, which is the part a returning user has already read.
  */
  if (options.terse || echoText(full).length <= TWO_LINE_BUDGET) return full;
  return composeSpans(facts, { ...options, terse: true });
}

function composeSpans(
  facts: BriefFacts,
  options: { terse?: boolean; followLabel?: string | null },
): EchoSpan[] {
  const { locks, open, variationAxis } = facts;
  const spans: EchoSpan[] = [...subjectPhrase(locks)];

  if (locks.heritage && locks.heritage.length > 0) spans.push(...heritagePhrase(locks.heritage));

  if (locks.energy) {
    spans.push({ kind: "text", text: ", reading " });
    spans.push({ kind: "fact", text: locks.energy, field: "energy" });
  }

  if (locks.look) {
    spans.push({ kind: "text", text: ", held to " });
    spans.push({ kind: "fact", text: locks.look, field: "look" });
  }

  const pinnedAnything = spans.length > 0;
  if (pinnedAnything) spans.push({ kind: "text", text: "." });

  /*
    Open axes, and the collapse rule that keeps this from becoming the pill row
    in a sentence costume. Three named axes is real English —
    "heritage, build and presence were left to the roll" — and six is a list
    wearing a coat. Past three it says nothing about which, because at that
    point "nothing pinned" is both shorter and truer.

    The variation axis is excluded from the enumeration when it names the same
    idea: saying presence is varying and then saying the eight differ by
    disposition is one thought colliding with itself.
  */
  const axisTwin = variationAxis === "disposition" ? "energy" : variationAxis === "look" ? "look" : null;
  const namedOpen = AXIS_ORDER.filter((axis) => open.includes(axis) && axis !== axisTwin);

  if (!pinnedAnything) {
    spans.push({ kind: "text", text: "Nothing pinned — the roll cast freely from your words." });
  } else if (namedOpen.length > 0 && namedOpen.length <= 3 && !options.terse) {
    const words = namedOpen.map((axis) => AXIS_WORDS[axis] ?? axis);
    spans.push({ kind: "text", text: " " });
    namedOpen.forEach((axis, index) => {
      if (index > 0) {
        spans.push({ kind: "text", text: index === namedOpen.length - 1 ? " and " : ", " });
      }
      spans.push({
        kind: "open",
        text: index === 0 ? capitalize(words[index]) : words[index],
        field: axis,
      });
    });
    // "Build was", "Heritage and build were" — a sentence that gets its own
    // verb wrong is a sentence nobody believes was written on purpose.
    spans.push({ kind: "text", text: namedOpen.length === 1 ? " was left to the roll." : " were left to the roll." });
  }

  if (options.followLabel) {
    spans.push({
      kind: "text",
      text: ` The eight follow ${options.followLabel}${variationAxis ? `, and differ by ${variationAxis}` : ""}.`,
    });
  } else if (variationAxis) {
    spans.push({ kind: "text", text: ` The eight differ by ${variationAxis}.` });
  }

  return spans;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Plain text, for the accessible label and for tests. */
export function echoText(spans: EchoSpan[]): string {
  return spans.map((span) => span.text).join("").replace(/\s+/g, " ").trim();
}
