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
 * covers only what the system PINNED across all eight and — where a sheet
 * follows a face — which face it follows. ⚠ It no longer says HOW the eight
 * differ (#1251, #230), and since #1288 it no longer says what was left OPEN
 * either; the faces are directly above the sentence and the brief box is
 * directly below it.
 *
 * **Composed, not templated.** A fuller brief and an emptier one do not produce
 * the same sentence with different words in the gaps — sex and age fuse into one
 * noun phrase, build folds in as an adjective, a clause with nothing to say
 * does not appear. Differently shaped sentences from differently shaped intents
 * is the tell of composition, and it is the difference between this and the
 * pill row wearing a sentence costume.
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
  /** Worn things the brief named, in the user's own words. */
  statedAccessories?: string[];
};

/** Which lock a span adjusts. Matches the server's overridable vocabulary. */
export type EchoField = "sex" | "ageBand" | "agePhase" | "heritage" | "build" | "energy" | "look";

/**
 * One piece of the sentence.
 *
 * `text` is connective prose and renders at secondary weight; `fact` is a
 * pinned value and renders at full ink with a hairline underline. The founder's
 * two-layer typography condition lives in this distinction: regulars scan the
 * facts at chip-speed because the facts are the only thing at full contrast,
 * while the sentence still reads as a sentence for a first-timer.
 *
 * ⚠ **THERE WAS A THIRD KIND, `open` — AN AXIS THE ROLL VARIED, DASHED AND
 * PINNABLE — AND IT LEFT WITH THE CLAUSE THAT PRODUCED IT (#1288).** Its only
 * producer was the "left to the roll" enumeration, so keeping the kind would
 * have left a span variant, a popover branch and a piece of the renderer's
 * vocabulary that nothing can ever emit. That shape — a consumer outliving its
 * only producer — is the one this repository keeps paying for (#1204, #1217).
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
  | { kind: "fact"; text: string; field: EchoField };

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
export type EchoOptions = {
  followLabel?: string | null;
  /**
   * THIS SHEET's road, not the next roll's (#230). True when the sheet in
   * front of the reader was painted from ONE authored prompt, which is what
   * makes the differ-by caption a false sentence rather than merely an
   * unwanted one. Derived at the call site from the sheet's own register.
   */
  authorRoad?: boolean;
};

/*
  ⚠ **THE TWO-LINE BUDGET AND THE TERSE FORM WENT WITH THE LATITUDE CLAUSE
  (#1288), BECAUSE THE CLAUSE WAS THE ONLY THING EITHER OF THEM EVER SHED.**

  This function used to compose the sentence, measure it against a 210-character
  budget, and recompose it `terse` when it overran — and `terse` had exactly one
  effect in the whole module: it suppressed the "left to the roll" enumeration.
  With the enumeration gone the budget could only ever have recomposed a
  byte-identical sentence, and `terse` could only ever have been a prop the
  sheet computed and passed down for nothing.

  The founder's ORIGINAL reason for the budget is untouched and worth keeping
  straight, because losing the mechanism reads like losing the protection: the
  first cap was `-webkit-line-clamp` plus `overflow: hidden`, which hid the later
  facts and cut the popover panel off at the sentence's bottom edge, so the
  grammar was made to say less instead. That argument always rested on the
  LATITUDE clause being the droppable part — a pinned fact was never allowed to
  go, and the suite still pins that. Nothing droppable is left, so there is
  nothing for the mechanism to choose between. The CSS clamp stays in
  `BriefEcho.tsx` as the backstop it always was.
*/
export function composeEcho(
  facts: BriefFacts,
  options: EchoOptions = {},
): EchoSpan[] {
  return composeSpans(facts, options);
}

function composeSpans(
  facts: BriefFacts,
  options: EchoOptions,
): EchoSpan[] {
  const { role, locks } = facts;
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

    A stated fact is never dropped to make the sentence shorter. Shortening
    existed to shed the latitude clause a returning user had already read (and
    is gone with it, #1288); shedding something they said themselves would
    always have been the opposite trade.
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
    ⚠ **NO "… WERE LEFT TO THE ROLL" CLAUSE — RETIRED OUTRIGHT, #1288,
    2026-09-26, ON HIS WORD.**

    Shown the sentence and asked whether the axis it quietly withheld should be
    named, his answer was neither option, verbatim: *"i honestly dont think it's
    neccesary that line is really just giving you a rundown of the casting sheet
    you already can see your prompt."* The two things before it — the faces, and
    the brief box with his own words still in it — already say what it said.

    So the enumeration, its three-axis collapse rule, and the terse form that
    existed to shed it are all gone. What stays is the sentence #230 kept
    (*"Everyone on this sheet is cast as [type] — [sex] in their [age band]"*),
    the stated-accessories clause, and the follow lineage.

    ⚠ **HOW RARE IT ACTUALLY WAS, read before it was removed rather than after** —
    it emitted only on a session's FIRST roll (`terse={rolls.length > 1}` at the
    sheet), only where the compiled brief left axes open, and only inside the
    two-line budget. His own hive-skull roll carries one subject chip and no open
    axes, which is why he had never seen it: it was never reachable for a
    creature brief, and never for any brief past Roll again.

    ⚠ **AND `effectiveAxis` / `axisTwin` LEFT WITH IT, which is a founder-ruled
    correction going quiet, so it is recorded here rather than simply deleted.**
    The rule was: *a locked look cannot also be the thing the eight differ by.*
    His sheet had read "held to commanding glamour … The eight differ by look" —
    a sentence contradicting itself, and not merely bad copy, it was reporting the
    compiler's own confusion, because a pinned look goes to every candidate and
    disposition is what actually varies. That sentence stopped rendering at #1251,
    which left the correction observable ONLY through which open axis this
    enumeration was allowed to name; with the enumeration gone it has no
    observable at all, and a rule with no observable is not a rule. The COMPILER's
    own `variationAxis` is untouched — this was always a display correction
    applied on the way out, never the thing that decided how the eight were cast.
  */
  if (!pinnedAnything) {
    spans.push({ kind: "text", text: "Nothing pinned — the roll cast freely from your words." });
  }

  /*
    ⚠ NO DIFFER-BY CAPTION ANYWHERE — #1251, 2026-09-26. IT WAS THE AUTHOR ROAD
    ONLY, AND THE THING IT NAMED HAS STOPPED BEING SHOWABLE.

    His ruling is #230, his verdict on a live MAX sheet, verbatim: *"Delete the
    differ-by line on LOW and MAX. Don't say the eight differ by look,
    disposition, or expression. Keep only: Everyone on this sheet is cast as
    [type] — [sex] in their [age band]. The sheet already proves whether the
    faces are different."*

    On the AUTHOR road it was also FALSE, which is why the first fix was the
    road rather than the wording: one authored prompt paints all eight and the
    per-slice identities are marked unsent (#176), so there is no axis anyone
    varied; the caption was describing the house resolver's mechanism on a sheet
    that never ran it.

    ⚠ **WHAT CHANGED IS THE HOUSE ROAD, AND NOT BECAUSE THE SENTENCE WENT
    FALSE.** There the eight really are resolved one at a time along that axis,
    so it is still true of them. What #1241 removed is the DISPOSITION LABEL
    under each tile, on his ruling that candidates are auditioners carrying no
    personality — so the sheet now names a difference the customer has no way to
    check. A true sentence about a term the page cannot show is the same defect
    his own reason names: *"The sheet already proves whether the faces are
    different."* That reason is as true of the house road as of the author one,
    and one rule is better than two.

    ⚠ **THE FOLLOW LABEL SURVIVES; ONLY ITS SUBORDINATE CLAUSE GOES.** *"The
    eight follow 01 on roll 05"* is lineage — a fact about which face this sheet
    descends from, which the page does show and which nothing else says in
    prose. It was never part of his ruling's quarrel.

    ⚠ **`effectiveAxis` / `axisTwin` WERE KEPT HERE AND ARE NOW GONE (#1288).**
    #1251 left them deliberately untouched, because they still decided which open
    axis the "left to the roll" enumeration could name, and moving live copy was
    not that card's question. It was carded, he answered it, and the whole clause
    went — so the correction they carried has no observable left. Its history is
    recorded above the `pinnedAnything` branch rather than lost with the code.
  */
  if (options.authorRoad) return spans;

  if (options.followLabel) {
    spans.push({ kind: "text", text: ` The eight follow ${options.followLabel}.` });
  }

  return spans;
}

/** Plain text, for the accessible label and for tests. */
export function echoText(spans: EchoSpan[]): string {
  return spans.map((span) => span.text).join("").replace(/\s+/g, " ").trim();
}
