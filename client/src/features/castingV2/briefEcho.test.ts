import { describe, expect, it } from "vitest";

import { composeEcho, echoText, type BriefFacts } from "./briefEcho";

/**
 * The sentence has to survive every shape of intent, from everything pinned to
 * nothing pinned, without ever reading as a template with words dropped in.
 *
 * These are readability assertions as much as correctness ones: several check
 * the exact string, because "does it read like English" is the requirement and
 * a looser assertion would pass on prose no one would ship.
 */

function facts(partial: Partial<BriefFacts>): BriefFacts {
  return { role: null, locks: {}, ...partial };
}

describe("the sentence composes rather than templates", () => {
  it("fuses sex, age and build into one noun phrase", () => {
    const spans = composeEcho(
      facts({
        locks: { sex: "female", ageBand: "20s", agePhase: "early", build: "slim" },
      }),
    );
    expect(echoText(spans)).toBe(
      "Everyone on this sheet is a slim woman in her early 20s.",
    );
  });

  it("drops the phase when the brief only pinned the decade", () => {
    const spans = composeEcho(facts({ locks: { sex: "male", ageBand: "50s" } }));
    expect(echoText(spans)).toBe("Everyone on this sheet is a man in his 50s.");
  });

  it("writes heritage, presence and look as prose, not as a list", () => {
    const spans = composeEcho(
      facts({
        locks: { sex: "female", ageBand: "20s", heritage: ["East Asian"], energy: "dry", look: "severe minimal" },
      }),
    );
    expect(echoText(spans)).toBe(
      "Everyone on this sheet is a woman in her 20s, of East Asian heritage, reading dry, held to severe minimal.",
    );
  });

  it("says both heritages when two were pinned", () => {
    const spans = composeEcho(facts({ locks: { heritage: ["Nordic", "Slavic"], sex: "male" } }));
    expect(echoText(spans)).toContain("of Nordic and Slavic heritage");
  });

  it("says 'seventies or older' rather than the raw band label", () => {
    const spans = composeEcho(facts({ locks: { sex: "male", ageBand: "70s+" } }));
    expect(echoText(spans)).toBe("Everyone on this sheet is a man in his seventies or older.");
  });
});

/*
  ⚠ **THE LATITUDE CLAUSE IS RETIRED — #1288, 2026-09-26, HIS WORD.** The three
  arms that stood here pinned it: it named up to three open axes in real English,
  it collapsed past three, and it withheld the axis the differ-by sentence already
  named. Shown the sentence and asked whether that withheld axis should be named,
  his answer was neither option, verbatim: *"i honestly dont think it's neccesary
  that line is really just giving you a rundown of the casting sheet you already
  can see your prompt."*

  What replaces them is the arm below, and it is driven over the shapes that used
  to PRODUCE the clause rather than asserted about one — a `not.toContain` over a
  sentence that composes nothing would pass for the wrong reason, so the positive
  control is inside the same loop.
*/
describe("nothing is said about what the roll was free to vary", () => {
  it("never says it, on any shape that used to say it", () => {
    /*
      The clause emitted when SOMETHING was pinned and axes were left open. These
      are the shapes its own retired arms used, plus the four-axis case PR #1320
      measured as the one where naming the varying axis would have cost the whole
      sentence.
    */
    const shapes: BriefFacts["locks"][] = [
      { sex: "female", ageBand: "50s" },
      { ageBand: "30s", sex: "male" },
      { sex: "female", ageBand: "40s" },
      { sex: "male", look: "commanding glamour" },
      { sex: "male" },
      { sex: "female", ageBand: "20s", heritage: ["Nordic"] },
    ];
    for (const locks of shapes) {
      for (const authorRoad of [true, false]) {
        const text = echoText(composeEcho(facts({ locks }), { authorRoad }));
        const where = `${JSON.stringify(locks)} / ${authorRoad}`;
        expect(text, where).not.toContain("left to the roll");
        /* THE POSITIVE CONTROL: the sentence still says who was cast. */
        expect(text, where).toContain("Everyone on this sheet");
      }
    }
  });

  it("names no axis as varying — there is no span kind left that could", () => {
    /*
      The clause was the only producer of `kind: "open"`. This is the structural
      half of the arm above: a future clause reintroducing a varying-axis span
      reddens here rather than only in the string assertion, and the words the
      enumeration used are pinned by name because "presence" for `energy` was
      vocabulary this module owned and nothing else does.
    */
    const spans = composeEcho(
      facts({ locks: { sex: "male", look: "commanding glamour" } }),
    );
    expect(spans.every((span) => span.kind !== ("open" as typeof span.kind))).toBe(true);
    const text = echoText(spans);
    for (const word of ["presence", "heritage was", "build was", "were left", "was left"]) {
      expect(text, word).not.toContain(word);
    }
  });

  it("falls back to the free-cast line when nothing at all was pinned", () => {
    const spans = composeEcho(facts({}));
    expect(echoText(spans)).toBe(
      "Nothing pinned — the roll cast freely from your words.",
    );
  });
});

describe("lineage", () => {
  it("closes with the followed candidate and the axis in one clause", () => {
    const spans = composeEcho(
      facts({ locks: { sex: "female", ageBand: "40s" } }),
      { followLabel: "the third face on roll 01" },
    );
    expect(echoText(spans)).toBe(
      "Everyone on this sheet is a woman in her 40s. The eight follow the third face on roll 01.",
    );
  });

  /*
    ⚠ **THE TERSE FORM IS GONE (#1288) AND THIS ARM IS WHAT STANDS IN ITS PLACE.**
    It used to prove the terser repeat form dropped the latitude clause and kept
    the pins. `terse` suppressed nothing else in the whole module, so with the
    clause retired the option, the two-line budget that triggered it and the
    sheet's `terse={rolls.length > 1}` all went. What is worth pinning now is the
    consequence: the sentence a returning user reads is the SAME sentence, which
    is the thing a reviewer would otherwise have to take on trust.
  */
  it("reads the same on a first roll and on a repeat", () => {
    const shown = facts({ locks: { sex: "female", ageBand: "20s", heritage: ["Nordic"] } });
    expect(echoText(composeEcho(shown))).toBe(
      "Everyone on this sheet is a woman in her 20s, of Nordic heritage.",
    );
    expect(echoText(composeEcho(shown, { followLabel: "01 on roll 05" }))).toBe(
      "Everyone on this sheet is a woman in her 20s, of Nordic heritage. The eight follow 01 on roll 05.",
    );
  });
});

describe("the spans carry the two-layer typography", () => {
  it("marks pinned facts as facts and connective prose as text", () => {
    const spans = composeEcho(
      facts({ locks: { sex: "female", ageBand: "20s", heritage: ["Nordic"] } }),
    );
    const fields = spans.filter((span) => span.kind === "fact").map((span) => span.field);
    expect(fields).toEqual(["sex", "ageBand", "heritage"]);
    // Every non-fact span is connective prose, which renders at secondary
    // weight — that split IS the founder's two-layer condition.
    expect(spans.some((span) => span.kind === "text")).toBe(true);
  });

  it("gives every span carrying a field one the server will accept", () => {
    const spans = composeEcho(
      facts({
        locks: { sex: "female", ageBand: "30s", build: "athletic", energy: "wry", look: "quiet luxury" },
      }),
    );
    const OVERRIDABLE = new Set(["sex", "ageBand", "agePhase", "heritage", "build", "energy", "look"]);
    for (const span of spans) {
      // "role" and "stated" spans carry no field — both are the user's own
      // free text and have no picker, which is exactly why neither is
      // adjustable.
      if (span.kind === "text" || span.kind === "role" || span.kind === "stated") continue;
      expect(OVERRIDABLE.has(span.field)).toBe(true);
    }
  });
});

/*
  ⚠ **THE GRAMMAR NO LONGER CHOOSES WHAT TO DROP — #1288, AND THAT IS WHY TWO
  ARMS LEFT THIS BLOCK.**

  The founder's cap was two lines, and the first implementation enforced it with
  CSS — `line-clamp` plus `overflow: hidden` — which hid the later facts and cut
  the popover panel off at the sentence's bottom edge. So the grammar was made to
  say less instead, by shedding the LATITUDE clause: two arms here proved it went
  when the sentence would have needed a third line and stayed when there was
  room. With the clause retired there is nothing droppable left, the 210-character
  budget could only have recomposed a byte-identical sentence, and `-webkit-line-clamp`
  in `BriefEcho.tsx` is the backstop it always was.

  What survives is the half that was never about the clause and is the reason the
  CSS cap was rejected in the first place: **a pinned fact is never dropped.** The
  second arm is new and is this block's positive control — without it, "nothing is
  ever dropped" would be satisfied by a grammar that had stopped composing.
*/
describe("a pinned fact is never dropped to make the sentence fit", () => {
  it("keeps every pinned fact on the longest sentence the grammar can build", () => {
    const spans = composeEcho({
      role: null,
      locks: {
        sex: "female",
        ageBand: "30s",
        agePhase: "late",
        build: "broad",
        heritage: ["Mediterranean", "West African"],
        energy: "wry",
        look: "quiet luxury",
      },
    }, { followLabel: "the sixth face on roll 02" });
    const fields = spans.filter((s) => s.kind === "fact").map((s) => s.field);
    expect(fields).toEqual(["build", "ageBand", "heritage", "energy", "look"]);
  });

  it("composes the whole sentence rather than truncating it anywhere", () => {
    /*
      THE POSITIVE CONTROL for the arm above, and for the removal of the budget:
      the sentence that used to overrun 210 characters now renders in full, to its
      last clause, instead of being recomposed shorter.
    */
    const text = echoText(composeEcho({
      role: "an oncology nurse",
      locks: {
        sex: "female",
        ageBand: "20s",
        agePhase: "early",
        build: "athletic",
        heritage: ["Western European", "Southeast Asian"],
        energy: "guarded",
        look: "commanding glamour",
      },
      statedAccessories: ["chunky glasses"],
    }, { followLabel: "the third face on roll 01" }));
    expect(text).toBe(
      "Everyone on this sheet is cast as an oncology nurse — an athletic woman in her early 20s, "
      + "of Western European and Southeast Asian heritage, reading guarded, held to commanding glamour, "
      + "wearing chunky glasses. The eight follow the third face on roll 01.",
    );
    expect(text.length).toBeGreaterThan(210);
  });
});

describe("the casting category is in the sentence", () => {
  /*
    Founder's round-6 finding: "a runway model early 20s" echoed as
    "Everyone on this sheet is someone early 20s" — the category missing
    entirely, and the grammar broken where it should have been.

    The interpreter was innocent: it captured role="runway model" on that exact
    brief and on every phrasing tried. The echo was composed from lockContract,
    which is the VALIDATOR's input and has no role field, so the category was
    never in the data the sentence was written from. The loudest lock on the
    sheet was the one the sentence could not see.
  */
  it("names the category the founder's brief stated", () => {
    const spans = composeEcho(
      facts({ role: "runway model", locks: { ageBand: "20s", agePhase: "early" } }),
    );
    expect(echoText(spans)).toBe(
      "Everyone on this sheet is cast as a runway model — in their early 20s.",
    );
  });

  it("never says 'someone early 20s' again", () => {
    // The other half of the report: with no sex pinned the preposition was
    // dropped, because it only existed on the branch that had a noun.
    const spans = composeEcho(facts({ locks: { ageBand: "20s", agePhase: "early" } }));
    expect(echoText(spans)).toBe("Everyone on this sheet is in their early 20s.");
    expect(echoText(spans)).not.toContain("someone");
  });

  /*
    #230, his verdict on a live MAX sheet (verbatim): *"Delete the differ-by
    line on LOW and MAX. Don't say the eight differ by look, disposition, or
    expression. Keep only: Everyone on this sheet is cast as [type] — [sex] in
    their [age band]. The sheet already proves whether the faces are
    different."*

    ⚠ **IT IS NOW EVERY ROAD (#1251).** The author road lost the caption first,
    because there it was also FALSE — one authored prompt paints all eight and
    the per-slice identities are marked unsent (#176), so no axis was ever
    varied. The house road lost it on 2026-09-26 for his own stated reason
    rather than for falsity: #1241 retired the disposition label under each
    tile, so the sentence named a difference the page can no longer show.

    ⚠ **SO THIS ARM NEEDED A NEW POSITIVE CONTROL, AND THAT IS THE WHOLE POINT
    OF THE REWRITE.** It used to hold the roads apart by asserting the house road
    still SAID the caption; with the caption gone from both, every
    `not.toContain("differ by")` here is satisfied by a `composeEcho` that
    returns nothing at all. The surviving difference between the roads is the
    FOLLOW sentence, which the same early return suppresses — so that is what
    holds them apart now.
  */
  it("the author road says who is being cast and stops", () => {
    const shown = facts({
      role: "oncology nurse",
      locks: { sex: "female", ageBand: "50s", heritage: ["British Isles"], energy: "grave" },
    });
    expect(echoText(composeEcho(shown, { authorRoad: true }))).toBe(
      "Everyone on this sheet is cast as an oncology nurse — a woman in her 50s, of British Isles heritage, reading grave.",
    );

    /*
      THE POSITIVE CONTROL: the early return still suppresses something the
      house road says. Without it this arm passes over an empty module.
    */
    const followed = facts({ locks: { sex: "female", ageBand: "40s" } });
    expect(echoText(composeEcho(followed, { followLabel: "the third face on roll 01" }))).toContain(
      "The eight follow the third face on roll 01.",
    );
    expect(
      echoText(composeEcho(followed, { authorRoad: true, followLabel: "the third face on roll 01" })),
    ).not.toContain("follow");
  });

  /*
    The caption is gone from BOTH roads, and it is driven over both rather than
    asserted about the road that lost it first. The positive control is the arm
    above: `composeEcho` still composes.

    ⚠ **IT USED TO DRIVE `variationAxis` AS A THIRD DIMENSION AND CANNOT NOW
    (#1288)** — that field was the caption's own subject, and it left the
    projection with the last clause that read it. The axis a house-road sheet
    varies along is still recorded on the compiled brief; it simply no longer
    crosses to the client, so there is no value here to vary. Its replacement
    dimension is the LOCK, because a pinned look was the one input that ever
    changed what the caption said.
  */
  it("says how the eight differ on no road at all", () => {
    for (const authorRoad of [true, false]) {
      for (const look of [undefined, "severe minimal", "commanding glamour"]) {
        for (const followLabel of [undefined, "the third face on roll 01"]) {
          const spans = composeEcho(
            facts({ role: "blacksmith", locks: { sex: "male", ...(look ? { look } : {}) } }),
            { authorRoad, ...(followLabel ? { followLabel } : {}) },
          );
          expect(echoText(spans), `${authorRoad} / ${look} / ${followLabel}`).not.toContain(
            "differ by",
          );
        }
      }
    }
  });

  it("carries the category alongside a full subject", () => {
    const spans = composeEcho(
      facts({
        role: "oncology nurse",
        locks: { sex: "female", ageBand: "50s", heritage: ["British Isles"], energy: "grave" },
      }),
    );
    expect(echoText(spans)).toBe(
      "Everyone on this sheet is cast as an oncology nurse — a woman in her 50s, of British Isles heritage, reading grave.",
    );
  });

  it("stands alone when the category is all the brief gave", () => {
    const spans = composeEcho(facts({ role: "blacksmith" }));
    expect(echoText(spans)).toBe(
      "Everyone on this sheet is cast as a blacksmith.",
    );
  });

  it("does not double the article on a category the user wrote with one", () => {
    const spans = composeEcho(facts({ role: "a retired boxer" }));
    expect(echoText(spans)).toBe("Everyone on this sheet is cast as a retired boxer.");
    expect(echoText(spans)).not.toContain("as a a ");
  });

  it("picks 'an' before a vowel", () => {
    expect(echoText(composeEcho(facts({ role: "editorial fashion model" })))).toContain(
      "cast as an editorial fashion model",
    );
  });

  it("renders the category as a role span — full ink, never a picker", () => {
    // Every other fact opens a closed vocabulary. A category is free text, so
    // underlining it would promise an adjustment that cannot exist.
    const spans = composeEcho(facts({ role: "runway model", locks: { sex: "female" } }));
    const role = spans.find((span) => span.kind === "role");
    expect(role).toBeDefined();
    expect(spans.some((span) => span.kind === "fact" && span.text.includes("runway"))).toBe(false);
  });
});

/*
  ⚠ **THE `effectiveAxis` / `axisTwin` ARMS ARE GONE, AND THIS IS THE RECORD OF
  WHY — #1288, 2026-09-26.**

  The rule was founder-ruled and real: *a locked look cannot also be the thing the
  eight differ by.* His sheet had read *"held to commanding glamour … The eight
  differ by look"* — a sentence contradicting itself, and not merely bad copy: it
  was reporting the compiler's own confusion, because a pinned look goes to every
  candidate and disposition is what actually varies.

  The sentence it corrected stopped rendering at #1251, which left the correction
  observable ONLY through which open axis the "left to the roll" enumeration was
  allowed to name; #1251 therefore re-pointed these two arms at that observable
  rather than deleting them, and carded the question. He answered it and the whole
  clause went, so there is no observable left — and two arms re-pointed at a
  deleted observable would be arms asserting the absence of prose no code can
  emit, which is the shape that reads as coverage and is not.

  ⚠ **WHAT IS NOT GONE, and the distinction is the whole reason this paragraph
  is long:** the COMPILER's `variationAxis` still decides how the house road
  resolves the eight. `effectiveAxis` was a DISPLAY correction applied on the way
  out — it never changed a cast, only what the sentence was allowed to say about
  one. Retiring the sentence retires the correction; it does not reopen the
  confusion the correction was written about, because nothing says the thing any
  more. Its history now lives beside the code that replaced it, in
  `briefEcho.ts`.
*/

describe("no clause may open the sentence with a comma", () => {
  /*
    Founder report: "An East Asian model with long pastel pink hair" echoed as
    ", of East Asian heritage. The eight differ by look." — a leading comma and
    no opening clause.

    Cause: every clause after the subject was written assuming a subject
    existed, so each hard-coded a leading ", ". With no category and no sex,
    age or build, both openers return nothing and the first optional clause
    became the first thing on the line.

    One test per clause that can lead, because the bug is positional and a
    clause added later would reproduce it.
  */
  it("opens on heritage when heritage is the only thing pinned", () => {
    const spans = composeEcho(facts({ locks: { heritage: ["East Asian"] } }));
    const text = echoText(spans);
    expect(text.startsWith(",")).toBe(false);
    expect(text).toBe("Everyone on this sheet is of East Asian heritage.");
  });

  it("opens on presence when presence is the only thing pinned", () => {
    const spans = composeEcho(facts({ locks: { energy: "dry" } }));
    expect(echoText(spans)).toBe("Everyone on this sheet reads dry.");
  });

  it("opens on look when the look is the only thing pinned", () => {
    const spans = composeEcho(facts({ locks: { look: "severe minimal" } }));
    expect(echoText(spans)).toBe("Everyone on this sheet is held to severe minimal.");
  });

  it("still continues rather than re-opening once a subject exists", () => {
    const spans = composeEcho(
      facts({ locks: { sex: "female", heritage: ["Nordic"], energy: "warm" } }),
    );
    expect(echoText(spans)).toBe(
      "Everyone on this sheet is a woman, of Nordic heritage, reading warm.",
    );
  });

  it("never starts with punctuation, whatever single fact is pinned", () => {
    // The class, not the instance. Any one lock alone must still read.
    const singles: Partial<BriefFacts["locks"]>[] = [
      { heritage: ["Latino"] },
      { energy: "wry" },
      { look: "clean commercial" },
      { sex: "male" },
      { ageBand: "40s" },
      { build: "athletic" },
    ];
    for (const locks of singles) {
      const text = echoText(composeEcho(facts({ locks })));
      expect(text[0], text).toMatch(/[A-Z]/);
      expect(text, text).not.toContain(" ,");
    }
  });
});

/**
 * Stated accessories, and the sentence's own contract.
 *
 * The echo claims to say what the brief said. It used to say only what the
 * brief LOCKED — and a stated accessory is neither a lock nor a varying axis,
 * so it fell through the gap: "wearing chunky glasses" was rendered, charged
 * for, and never mentioned by the one line that claims to report the brief.
 */
describe("what the brief said they are wearing", () => {
  const base = { role: null, locks: {} };

  it("says it, in the user's own words", () => {
    const text = echoText(composeEcho({ ...base, statedAccessories: ["chunky glasses"] }));
    expect(text).toContain("wearing chunky glasses");
  });

  it("joins several the way English does", () => {
    const text = echoText(composeEcho({
      ...base,
      statedAccessories: ["a nose stud", "a wedding ring"],
    }));
    expect(text).toContain("wearing a nose stud and a wedding ring");
  });

  it("continues the sentence rather than opening a second one", () => {
    const text = echoText(composeEcho({
      ...base,
      role: "a model",
      locks: { sex: "female", ageBand: "20s" },
      statedAccessories: ["chunky glasses"],
    }));
    // One sentence, and the accessory continues it rather than starting a second.
    expect(text).toContain(", wearing chunky glasses");
    expect(text).not.toContain(". Everyone on this sheet is wearing");
  });

  /*
    A STATED FACT IS NEVER DROPPED TO SHORTEN THE SENTENCE. This arm passed
    `{ terse: true }` until #1288 — shortening existed to shed the latitude
    clause, which a returning user had already read, and shedding something they
    said themselves would have been the opposite trade. The clause is gone and so
    is the option; what still has to hold is that the longest sentence the grammar
    can build carries the accessory to the end of it.
  */
  it("survives the longest sentence the grammar can build", () => {
    const text = echoText(composeEcho(
      {
        role: "an oncology nurse",
        locks: {
          sex: "female",
          ageBand: "20s",
          agePhase: "early",
          build: "athletic",
          heritage: ["Western European", "Southeast Asian"],
          energy: "guarded",
          look: "commanding glamour",
        },
        statedAccessories: ["chunky glasses"],
      },
      { followLabel: "the third face on roll 01" },
    ));
    expect(text).toContain("chunky glasses");
  });

  it("is silent when the brief named nothing worn", () => {
    const text = echoText(composeEcho({ ...base, role: "a dad", statedAccessories: [] }));
    expect(text).not.toContain("wearing");
  });

  /*
    Not adjustable, and for the same reason the category is not: it is the
    user's own free text, and an underline would promise a picker that cannot
    exist. The brief box is where a stated fact changes.
  */
  it("carries no field, because there is no picker for free text", () => {
    const spans = composeEcho({ ...base, statedAccessories: ["chunky glasses"] });
    const stated = spans.filter((span) => span.kind === "stated");
    expect(stated).toHaveLength(1);
    expect(stated[0]).not.toHaveProperty("field");
  });
});
