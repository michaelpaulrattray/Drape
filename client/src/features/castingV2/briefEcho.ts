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
  /** The casting category, in the user's own words. A lock, and the loudest. */
  role: string | null;
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
  /** Worn things the brief named, in the user's own words. */
  statedAccessories?: string[];
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
  /** The casting category: full ink, not adjustable — free text has no picker. */
  | { kind: "role"; text: string }
  /**
   * Something the brief said they are wearing. Full ink, and not adjustable
   * for the same reason the category is not: it is the user's own free text,
   * and underlining it would promise a picker that cannot exist.
   */
  | { kind: "stated"; text: string }
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

/** "a"/"an", for a category the user wrote without one. */
function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

/**
 * The casting category — the loudest lock on the sheet, and the one the echo
 * used to leave out entirely.
 *
 * "a runway model early 20s" echoed as "Everyone on this sheet is someone early
 * 20s" — the strongest constraint on the roll, silently absent. It happened
 * because the echo was built from `lockContract`, and `LockFacts` is the
 * *validator's* input: it has no role field, because the validator compares
 * enum values and a category is free text. So the category was never in the
 * data the sentence was composed from.
 *
 * The design rule it collided with was mine — "your own words are never
 * repeated back", written to keep the echo from paraphrasing the brief. That
 * rule is still right about the brief as a whole and wrong about this: the
 * category is not the user's sentence, it is the single fact the compiler
 * treats as ABSOLUTE ("a candidate who would not be credible in this role is a
 * failed candidate"). Omitting it made the echo quietest about the thing it
 * enforced hardest.
 *
 * It renders at full ink and is NOT adjustable. Every other fact opens a closed
 * vocabulary; a category is free text, so underlining it would promise a
 * picker that cannot exist. The brief box is where a category changes.
 */
function categoryPhrase(role: string | null): EchoSpan[] {
  if (!role) return [];
  const lead = /^(a|an|the)\s/i.test(role) ? role : `${article(role)} ${role}`;
  return [
    { kind: "text", text: "Everyone on this sheet is cast as " },
    { kind: "role", text: lead },
  ];
}

/** "female" + "20s" + "early" + "slim" → "a slim woman in her early 20s". */
function subjectPhrase(locks: BriefFacts["locks"], hasRole: boolean): EchoSpan[] {
  const spans: EchoSpan[] = [];
  const { sex, ageBand, agePhase, build } = locks;

  const noun = sex === "female" ? "woman" : sex === "male" ? "man" : sex ? "person" : null;
  const possessive = sex === "female" ? "her" : sex === "male" ? "his" : "their";

  // With a category already named, the subject continues it rather than
  // opening a second sentence about the same people.
  const opener = hasRole ? " — " : "Everyone on this sheet is ";

  // No sex and no age: there is no subject noun phrase to write at all.
  if (!noun && !ageBand) {
    if (!build) return [];
    return [
      { kind: "text", text: opener },
      { kind: "fact", text: `${build} built`, field: "build" },
    ];
  }

  spans.push({ kind: "text", text: opener });

  if (noun) {
    // Build folds into the noun as an adjective — "a slim woman", never
    // "a woman, slim". One fused span, because a user adjusting "slim woman"
    // is adjusting two facts and the popover offers whichever they clicked.
    spans.push(
      build
        ? { kind: "fact", text: `${article(build)} ${build} ${noun}`, field: "build" }
        : { kind: "fact", text: `a ${noun}`, field: "sex" },
    );
  }

  if (ageBand) {
    const phase = agePhase ? `${agePhase} ` : "";
    const decade = ageBand === "70s+" ? "seventies or older" : ageBand;
    /*
      "someone early 20s" was the other half of the founder's report, and it is
      simply broken English — the preposition only existed on the branch that
      had a noun to attach it to. With no sex pinned the subject is "everyone",
      so the age reads "in their early 20s" either way.
    */
    spans.push({ kind: "text", text: noun ? ` in ${possessive} ` : "in their " });
    spans.push({ kind: "fact", text: `${phase}${decade}`, field: "ageBand" });
  }

  return spans;
}

/**
 * The connector before an optional clause, aware of whether it is FIRST.
 *
 * Every clause after the subject was written assuming a subject existed, so it
 * hard-coded a leading ", ". When the brief pins a heritage and nothing else —
 * no category, no sex, no age, no build — both openers return nothing and the
 * sentence began with a comma: ", of East Asian heritage. The eight differ by
 * look." Broken English on the sheet's most-read line.
 *
 * A helper rather than a conditional at each site, because there are three
 * such clauses today and the next one added would reproduce the bug.
 */
function connector(spans: EchoSpan[], opening: string, continuing: string): EchoSpan {
  return { kind: "text", text: spans.length === 0 ? opening : continuing };
}

function heritagePhrase(heritage: string[], first: boolean): EchoSpan[] {
  return [
    { kind: "text", text: first ? "Everyone on this sheet is of " : ", of " },
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
  const { role, locks, open, variationAxis } = facts;
  const spans: EchoSpan[] = [...categoryPhrase(role), ...subjectPhrase(locks, Boolean(role))];

  if (locks.heritage && locks.heritage.length > 0) {
    spans.push(...heritagePhrase(locks.heritage, spans.length === 0));
  }

  if (locks.energy) {
    spans.push(connector(spans, "Everyone on this sheet reads ", ", reading "));
    spans.push({ kind: "fact", text: locks.energy, field: "energy" });
  }

  if (locks.look) {
    spans.push(connector(spans, "Everyone on this sheet is held to ", ", held to "));
    spans.push({ kind: "fact", text: locks.look, field: "look" });
  }

  /*
    STATED ACCESSORIES, said before the sentence closes.

    The echo's contract is that it says what the brief said. It used to say
    only what the brief LOCKED, and a stated accessory is neither a lock nor a
    varying axis — so it fell through the gap and the sentence was quietly
    incomplete about a fact the user had typed and paid to have rendered.

    A stated fact is never dropped by the terse form. Terse exists to shed the
    latitude clause, which a returning user has already read; shedding something
    they said themselves would be the opposite trade.
  */
  const stated = facts.statedAccessories ?? [];
  if (stated.length > 0) {
    spans.push(connector(spans, "Everyone on this sheet is wearing ", ", wearing "));
    stated.forEach((accessory, index) => {
      if (index > 0) {
        spans.push({ kind: "text", text: index === stated.length - 1 ? " and " : ", " });
      }
      spans.push({ kind: "stated", text: accessory });
    });
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
  /*
    A locked look cannot also be the thing the eight differ by.

    The sheet said "held to commanding glamour … The eight differ by look",
    which is a sentence contradicting itself — and it was not merely bad copy,
    it was reporting the compiler's own confusion. When the brief pins a look,
    every candidate gets it, and disposition is what actually varies.
  */
  const effectiveAxis = locks.look && variationAxis === "look" ? "disposition" : variationAxis;
  const axisTwin = effectiveAxis === "disposition" ? "energy" : effectiveAxis === "look" ? "look" : null;
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
      text: ` The eight follow ${options.followLabel}${variationAxis ? `, and differ by ${effectiveAxis}` : ""}.`,
    });
  } else if (effectiveAxis) {
    spans.push({ kind: "text", text: ` The eight differ by ${effectiveAxis}.` });
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
