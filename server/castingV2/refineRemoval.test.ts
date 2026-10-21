import { describe, expect, it } from "vitest";

import {
  chainAfterRemoval,
  composeChain,
  fingerprintDelta,
  matchSteps,
  readChain,
  reReadNamesAThingToHave,
  readRemovalSubject,
  sameChain,
  stepLabel,
  struckPartOf,
  takenFromKeptSentences,
  type ChainStep,
} from "./refineRemoval";

/* `provenance` defaults to null here: these fixtures are about removal
   arithmetic, and a typed step is the ordinary case. The tests that care about
   where words came from live in `referenceProvenance.test.ts`. */
const step = (
  instruction: string,
  delta: ChainStep["delta"],
  provenance: ChainStep["provenance"] = null,
): ChainStep => ({ instruction, delta, provenance });

/**
 * TYPED REMOVAL RESOLVES AGAINST THE RECIPE (D-163).
 *
 * The model classifies intent and hands back the user's own words. Everything
 * here is mechanical, because three phrasing-list failures in one week made
 * "the code owns the vocabulary" a law: a list of surface forms is a guard that
 * only ever proves the implementation matches itself.
 */
describe("matching the steps a removal takes out", () => {
  const chain = [
    step("give her a mullet", { hairStyle: "a mullet" }),
    step("a smokey eye", { makeup: "a smokey eye" }),
    step("small gold hoops", { free: { statedAccessories: "small gold hoops" } }),
    step("glossy nude lip gloss", { makeup: "glossy nude lip gloss" }),
  ];

  it("takes the WHOLE subject when they name the subject", () => {
    /* "Remove the makeup" — both makeup steps, because they named the lot. */
    expect(matchSteps(chain, { subject: "makeup", match: "makeup", whole: true }))
      .toEqual([{ index: 1, keep: null }, { index: 3, keep: null }]);
  });

  /*
    RUN-7's ROOT CAUSE, PINNED AT THE MATCHER.

    Width used to be inferred from missing words, so this exact call — the
    shape "remove her glasses" arrived in when its words went missing — took
    every accessory step on the face, including one that had been paid for.
    Missing words are not a claim about width, and the honest answer to them is
    rule 3's: no matching step, ask her face.
  */
  it("takes NOTHING when the words are missing and no width was claimed", () => {
    expect(matchSteps(chain, { subject: "statedAccessories", match: null })).toEqual([]);
    expect(matchSteps(chain, { subject: "makeup", match: null })).toEqual([]);
  });

  it("takes ONE step when they name one thing", () => {
    expect(matchSteps(chain, { subject: "makeup", match: "smokey eye" })).toEqual([{ index: 1, keep: null }]);
  });

  it("matches across the lane boundary, by facet", () => {
    /* The accessories step is free-lane; the subject name is the free one. */
    expect(matchSteps(chain, { subject: "statedAccessories", match: "hoops" })).toEqual([{ index: 2, keep: null }]);
  });

  /*
    RULE 3's TRIGGER. Words that match no step ARE "no matching step", so this
    returns nothing and the caller falls through to an ordinary content edit.
    Taking every makeup step because they named one that is not there would
    destroy something they never asked to remove.
  */
  it("takes NOTHING when the words match no step", () => {
    expect(matchSteps(chain, { subject: "makeup", match: "winged liner" })).toEqual([]);
  });

  it("takes nothing when the subject has no steps at all", () => {
    expect(matchSteps(chain, { subject: "brows", match: null })).toEqual([]);
  });

  /*
    MATCHED AGAINST THE FILED VALUES TOO, not only the sentence.

    "Make it greener" stores a sentence that never contains the word the delta
    holds. Matching the sentence alone would miss it; matching the value alone
    would miss the cases where the user's phrasing is the only place their word
    appears. Both, always.
  */
  it("matches a word that only appears in the filed value", () => {
    const relative = [step("make it greener", { eyeColour: "green" })];
    expect(matchSteps(relative, { subject: "eyeColour", match: "green" })).toEqual([{ index: 0, keep: null }]);
  });

  /* And tolerant of ordinary word endings, for the reason source containment
     learned three times over — "hoops" must find "hoop". */
  it("is tolerant of word endings", () => {
    expect(matchSteps(chain, { subject: "statedAccessories", match: "gold hoop" })).toEqual([{ index: 2, keep: null }]);
  });

  it("leaves the surviving chain in order", () => {
    const left = chainAfterRemoval(chain, [{ index: 1, keep: null }, { index: 3, keep: null }], null);
    expect(left.map((entry) => entry.instruction))
      .toEqual(["give her a mullet", "small gold hoops"]);
    expect(composeChain(left)).toEqual({
      hairStyle: "a mullet",
      free: { statedAccessories: "small gold hoops" },
    });
  });
});

/**
 * A PLURAL SUBJECT HOLDS ITEMS, AND REMOVAL DELETES ITEMS (D-171).
 *
 * "Small gold hoops and thin wire glasses" is ONE step holding two facts, so
 * "remove the hoops" used to delete the step and take the glasses with it — the
 * founder's round-4 defect arriving through the recipe rather than the tail.
 */
describe("removing one item out of a step that holds several", () => {
  const worn = [
    step("small gold hoops and thin wire glasses", {
      free: { statedAccessories: ["small gold hoops", "thin wire glasses"] },
    }),
  ];

  it("prunes the item and keeps the step", () => {
    const matches = matchSteps(worn, { subject: "statedAccessories", match: "hoops" });
    expect(matches).toEqual([{ index: 0, keep: ["thin wire glasses"] }]);
    const left = chainAfterRemoval(worn, matches, "statedAccessories");
    expect(composeChain(left)).toEqual({ free: { statedAccessories: ["thin wire glasses"] } });
  });

  /*
    THE ECHO PATH, which had no test and shipped broken (D-173).

    The parser resolves "remove the earrings" to the stored item and the code
    matches by identity. Every test here exercised the WORD path, so the
    production walk was the first thing to run this branch — and it found the
    echoes never reached the matcher at all, which dropped it to the word path
    with no narrowing words and deleted every step on the facet. The glasses
    went with the hoops.
  */
  it("prunes by identity when the parser echoed a stored item", () => {
    const matches = matchSteps(worn, {
      subject: "statedAccessories",
      match: null,
      items: ["small gold hoops"],
    });
    expect(matches).toEqual([{ index: 0, keep: ["thin wire glasses"] }]);
  });

  /* An echo that identifies nothing is "no matching step" — never "take the
     lot", which is what falling through to the wordless path would do. */
  it("takes nothing when the echo matches no stored item", () => {
    expect(matchSteps(worn, {
      subject: "statedAccessories",
      match: null,
      items: ["a silver necklace"],
    })).toEqual([]);
  });

  it("deletes the step only when nothing survives", () => {
    const matches = matchSteps(worn, { subject: "statedAccessories", match: "accessories", whole: true });
    expect(matches).toEqual([{ index: 0, keep: null }]);
    expect(chainAfterRemoval(worn, matches, "statedAccessories")).toEqual([]);
  });

  /*
    MATCHED ON ITEMS, NEVER ON THE SENTENCE. The stored sentence still reads
    "hoops and glasses" after the pruning — asking again must find nothing and
    fall through to D-167's confession, or the step matches forever and the
    glasses go on the second attempt.
  */
  it("stops matching once the named item is gone", () => {
    const pruned = chainAfterRemoval(
      worn,
      matchSteps(worn, { subject: "statedAccessories", match: "hoops" }),
      "statedAccessories",
    );
    expect(pruned[0]!.instruction).toBe("small gold hoops and thin wire glasses");
    expect(matchSteps(pruned, { subject: "statedAccessories", match: "hoops" })).toEqual([]);
  });

  /* The chip reads back from the surviving items — also their own words — so it
     stops claiming a thing the recipe no longer holds. */
  it("labels a pruned step by what survived", () => {
    const pruned = chainAfterRemoval(
      worn,
      matchSteps(worn, { subject: "statedAccessories", match: "hoops" }),
      "statedAccessories",
    );
    expect(stepLabel(pruned[0]!, "statedAccessories")).toBe("thin wire glasses");
  });

  /* Order is not identity: the same items in either order are one recipe, and
     rule 4 hands back an existing picture free rather than charging 25. */
  it("fingerprints the same items in either order identically", () => {
    expect(fingerprintDelta({ free: { statedAccessories: ["a", "b"] } }))
      .toBe(fingerprintDelta({ free: { statedAccessories: ["b", "a"] } }));
    expect(fingerprintDelta({ free: { statedAccessories: ["a", "b"] } }))
      .not.toBe(fingerprintDelta({ free: { statedAccessories: ["a"] } }));
  });

  /* Items can contain commas, so a joined fingerprint would collide. */
  it("does not collide on items containing commas", () => {
    expect(fingerprintDelta({ free: { marks: ["a,b", "c"] } }))
      .not.toBe(fingerprintDelta({ free: { marks: ["a", "b,c"] } }));
  });
});

describe("the subject a removal names is code-owned", () => {
  it("accepts a free subject and a guaranteed axis", () => {
    expect(readRemovalSubject("statedAccessories")).toBe("statedAccessories");
    expect(readRemovalSubject("hairColour")).toBe("hairColour");
  });

  /* D-89's gate: a model-authored subject cannot become a matching key. */
  it("refuses anything it invented", () => {
    expect(readRemovalSubject("earrings")).toBeNull();
    expect(readRemovalSubject(42)).toBeNull();
    expect(readRemovalSubject(null)).toBeNull();
  });
});

/**
 * A CHAIN IS ONLY USABLE WHEN THE TWO LISTS AGREE.
 *
 * `stepDeltas` arrived after the table shipped. A row without it, or one whose
 * lists disagree, has lost the correspondence that makes index i mean anything —
 * and reconstructing the missing steps by diffing ancestors is right most of the
 * time and silently drops an earlier edit the rest.
 */
describe("reading a variant's chain", () => {
  it("pairs the sentences with their own deltas", () => {
    const chain = readChain(["a mullet"], [{ hairStyle: "a mullet" }]);
    /* Provenance is the third member of the family and it is absent here — an
       older row, or simply a step she typed. Absent reads as null, never as a
       missing key, so index i has an answer in all three lists. */
    expect(chain).toEqual([
      { instruction: "a mullet", delta: { hairStyle: "a mullet" }, provenance: null },
    ]);
  });

  it("refuses a pre-column row rather than approximating it", () => {
    expect(readChain(["a mullet"], [])).toBeNull();
  });

  it("refuses a row whose lists disagree", () => {
    expect(readChain(["a", "b"], [{ makeup: "x" }])).toBeNull();
  });
});

/**
 * RULE 4 IS A MONEY RULE, so its comparison is the money-critical part.
 *
 * If the recipe they described already exists as a picture they get that
 * picture and pay nothing — so a comparison that says "different" when they are
 * the same charges 25 credits for a phrasing.
 */
describe("deciding whether a chain already exists", () => {
  it("ignores the order keys happen to have been written in", () => {
    const a = { hairStyle: "a mullet", free: { brows: "thick" } };
    const b = { free: { brows: "thick" }, hairStyle: "a mullet" };
    expect(fingerprintDelta(a)).toBe(fingerprintDelta(b));
    /* And JSON.stringify — the obvious wrong tool — does not. */
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("calls two chains the same only when BOTH halves agree", () => {
    const chain = { instructions: ["a", "b"], delta: { makeup: "a smokey eye" } };
    expect(sameChain(chain, { instructions: ["a", "b"], delta: { makeup: "a smokey eye" } }))
      .toBe(true);
    /* Same sentences, different resolved values — a relative step ("greener
       still") that landed somewhere else. The same words, a different face. */
    expect(sameChain(chain, { instructions: ["a", "b"], delta: { makeup: "winged liner" } }))
      .toBe(false);
    /* Same values, different histories — a record that would lie about how it
       got here. */
    expect(sameChain(chain, { instructions: ["a", "c"], delta: { makeup: "a smokey eye" } }))
      .toBe(false);
    expect(sameChain(chain, { instructions: ["a"], delta: { makeup: "a smokey eye" } }))
      .toBe(false);
  });
});

/**
 * THE AMBIGUOUS-WORD DECISION, AND THE LANE IT COULD NOT SEE.
 *
 * `removalEvidence` says whether her sentence stated subtraction plainly, said
 * nothing, or leaned on a word that also describes a look ("clear rims", "drop
 * earrings"). On that last kind the model proposes BOTH readings and
 * `reReadNamesAThingToHave` picks between them — so what it answers decides
 * whether a paid render adds a thing or takes one off.
 *
 * ⚠ It answered from two readers that walk `FREE_SUBJECT_KEYS` and the labelled
 * axes and stop, so an open kind was invisible to it: FIFTH instance of the
 * enumeration-point class (fable-1378 §2, swept fable-1379 §1).
 *
 * Driven at this door before the fix rather than reasoned about, because
 * removal routing is where this product has refunded 300 credits twice for
 * getting a side wrong — a one-line change here is not a small change.
 */
describe("what the re-read named, and the lane it could not see", () => {
  const decide = (delta: unknown, subject: string | null) => reReadNamesAThingToHave({
    delta: delta as never,
    subject: subject as never,
    match: "earrings",
  });

  it("⚠ AN OPEN KIND NAMES A THING TO HAVE, when the removal named no subject", () => {
    /*
      The defect, at the door: a re-read coming back as *"large feathered
      wings"* is unmistakably a thing to HAVE, and this answered `false` — so
      the removal stood and the open ask was dropped.
    */
    expect(decide({ open: { wings: { noun: "wings", words: "large feathered wings" } } }, null))
      .toBe(true);
  });

  it("⚠ CONTROL — a NAMED subject is still asked about its own facet", () => {
    /*
      And this is the half that must NOT move. The rule is that the re-read
      answers the facet the removal NAMED; an open kind has no facet and is
      about something else, so the removal rightly stands. Widening this too
      would cancel a real removal whenever the model volunteered anything at
      all — which is the 300-credit shape with a new coat.
    */
    expect(decide({ open: { wings: { noun: "wings", words: "large feathered wings" } } },
      "statedAccessories")).toBe(false);
  });

  it("CONTROL — an open kind that RESTATES the departure is not a thing to have", () => {
    /* A positive lane can hold "no earrings", and so can this one. Reading that
       as a thing to have would cancel a real removal on the one lane that had
       no negation guard at all. */
    expect(decide({ open: { earrings: { noun: "earrings", words: "no earrings" } } }, null))
      .toBe(false);
  });

  it("CONTROL — a closed value still decides exactly as it did", () => {
    expect(decide({ free: { statedAccessories: ["gold hoop earrings"] } }, "statedAccessories"))
      .toBe(true);
    expect(decide({ free: { statedAccessories: ["no earrings"] } }, "statedAccessories"))
      .toBe(false);
  });
});

/**
 * #2638 — A FEATURE THE OPEN LANE ADDED CAN BE TAKEN BACK BY NAME.
 *
 * Found by the #2637 drive on dev, through the live interpreter: fangs ADDED by
 * a refine are filed under the open lane, and *"remove her fangs"* matched
 * nothing and refused. So a customer could not take away what they had just
 * paid to add.
 *
 * The cause is structural rather than a phrasing miss, and it is two blind
 * spots in this file, both pointing at `delta.open`:
 *
 *  1. {@link wordsOfStep} read the guaranteed axes and the free lane. An
 *     open-kind step's own noun and words were nowhere in the set, so the step
 *     was WORDLESS to the matcher — no query could ever match it.
 *  2. The candidate filter is by FACET, and `refineDelta` states that an open
 *     kind deliberately has none (*"an open kind has no facet, and that is what
 *     makes it CARRY"*) — `facetsWrittenBy` reads the axes, the free lane and
 *     `absent`, never `open`. So a removal naming a subject dropped every
 *     open-kind step before a single word was compared.
 *
 * The narrowing is what keeps this safe, and the controls below are the point:
 * an open-kind step joins the candidates for the WORD-NARROWED path only, never
 * the `whole` branch. "Remove her teeth" must not take her horns off.
 */
describe("#2638 — taking back a feature the open lane added", () => {
  const chain = [
    step("give her vampire fangs", { open: { fangs: { noun: "fangs", words: "long vampire fangs" } } }),
    step("give her curled horns", { open: { horns: { noun: "horns", words: "curled ram horns" } } }),
    step("a smokey eye", { makeup: "a smokey eye" }),
  ];

  it("takes the open-kind step when the words name it — the card's own case", () => {
    /* The live interpreter files "remove her fangs" under the nearest closed
       subject, `teeth`, because the open kind is not in its vocabulary. The
       words are what identify the step, and they do. */
    expect(matchSteps(chain, { subject: "teeth", match: "fangs" }))
      .toEqual([{ index: 0, keep: null }]);
  });

  it("takes it when the removal named no closed subject at all", () => {
    /* `readRemovalSubject` returns null for anything outside the code's own
       vocabulary, which is what an open kind always is. */
    expect(matchSteps(chain, { subject: null, match: "fangs" }))
      .toEqual([{ index: 0, keep: null }]);
  });

  it("matches on the stored WORDS as well as the noun", () => {
    expect(matchSteps(chain, { subject: null, match: "vampire" }))
      .toEqual([{ index: 0, keep: null }]);
  });

  it("tolerates the ending the way every other lane does", () => {
    /* "fang" against a kind filed as "fangs" — the same stemming source
       containment already learned, and three regressions paid for. */
    expect(matchSteps(chain, { subject: "teeth", match: "fang" }))
      .toEqual([{ index: 0, keep: null }]);
  });

  it("finds an open kind whose own sentence never names it", () => {
    /*
      THE ARM FOR THE LANE ITSELF, and it is the one the first draft missed.

      Every case above could be satisfied by the step's SENTENCE, because a
      customer who asks for fangs usually says "fangs". Here they do not: the
      noun and the state live only in the open-kind row. Before #2638 that row
      was read by nothing, so a removal could reach an open kind only by the
      accident of the sentence repeating it.

      Both roads are asserted, and they are different code: with no subject
      every step is a facet candidate, so the match can only come from
      `wordsOfStep`; with `teeth` named, the facet filter drops the step and
      the open-kind road is the only way back in.
    */
    const quiet = [
      step("make them longer and sharper", {
        open: { fangs: { noun: "fangs", words: "long sharp fangs" } },
      }),
    ];
    expect(matchSteps(quiet, { subject: null, match: "fangs" }))
      .toEqual([{ index: 0, keep: null }]);
    expect(matchSteps(quiet, { subject: "teeth", match: "fangs" }))
      .toEqual([{ index: 0, keep: null }]);
  });

  it("CONTROL — one open kind's words never take another's", () => {
    expect(matchSteps(chain, { subject: null, match: "horns" }))
      .toEqual([{ index: 1, keep: null }]);
    expect(matchSteps(chain, { subject: null, match: "tusks" })).toEqual([]);
  });

  /*
    THE OVER-DELETION CONTROL, AND IT IS THE REASON THE WIDENING IS NARROW.

    Open kinds have no facet, so admitting them to the `whole` branch would make
    "remove her teeth" delete her horns, her wings and every other open kind on
    the face — run-7's earrings, rebuilt on a new lane. They are candidates for
    the word-narrowed path only.
  */
  it("CONTROL — the WHOLE subject never reaches an open kind", () => {
    expect(matchSteps(chain, { subject: "teeth", match: "teeth", whole: true })).toEqual([]);
    expect(matchSteps(chain, { subject: "makeup", match: "makeup", whole: true }))
      .toEqual([{ index: 2, keep: null }]);
  });

  it("CONTROL — no words and no claimed width still takes nothing", () => {
    expect(matchSteps(chain, { subject: "teeth", match: null })).toEqual([]);
    expect(matchSteps(chain, { subject: null, match: null })).toEqual([]);
  });

  /*
    THE END OF THE ROAD, NOT THE MATCH — the arm that answers the card.

    Matching is only half of it: the card asks that the fangs be GONE. So the
    chain is pruned and recomposed the way the service does it, and the
    composed delta is read. `chainAfterRemoval` drops a step whose `keep` is
    null, and because an open kind lives in the step it was filed by, dropping
    the step is what takes the feature off the cast.
  */
  it("leaves the cast without the fangs, and still wearing the horns", () => {
    const matches = matchSteps(chain, { subject: "teeth", match: "fangs" });
    const after = chainAfterRemoval(chain, matches, null);
    const composed = composeChain(after);
    expect(composed.open?.fangs).toBeUndefined();
    expect(composed.open?.horns).toEqual({ noun: "horns", words: "curled ram horns" });
    expect(composed.makeup).toBe("a smokey eye");
    /* And the step itself is gone from the record, not merely emptied. */
    expect(after.map((s) => s.instruction))
      .toEqual(["give her curled horns", "a smokey eye"]);
  });

  it("CONTROL — a closed-lane step beside open kinds is untouched", () => {
    expect(matchSteps(chain, { subject: "makeup", match: "smokey eye" }))
      .toEqual([{ index: 2, keep: null }]);
  });
});

/**
 * #2638 FOLLOW-UP — A NAMED OPEN KIND LEAVES, AND NOTHING ELSE IN ITS STEP DOES.
 *
 * Found on the merged #2643: the open-kind road answered delete-or-nothing,
 * so "remove the fangs" against ONE step that had also filed horns, or a lip
 * colour, deleted the whole step and took those too. Every arm drives the
 * matcher, the chain surgery and the recomposition the way the service does.
 */
describe("#2638 follow-up — only the named open kind leaves its step", () => {
  const fangs = { noun: "fangs", words: "long vampire fangs" };
  const horns = { noun: "horns", words: "curled ram horns" };

  it("fangs and horns in one step: the fangs go, the horns stay", () => {
    const chain = [step("give them vampire fangs and curled horns", { open: { fangs, horns } })];
    const matches = matchSteps(chain, { subject: "teeth", match: "fangs" });
    expect(matches).toEqual([{ index: 0, keep: null, dropOpen: ["fangs"] }]);
    const after = chainAfterRemoval(chain, matches, null);
    /* The step SURVIVES with its sentence, the way an item prune does. */
    expect(after.map((s) => s.instruction)).toEqual(["give them vampire fangs and curled horns"]);
    const composed = composeChain(after);
    expect(composed.open?.fangs).toBeUndefined();
    expect(composed.open?.horns).toEqual(horns);
  });

  it("fangs and makeup in one step: the fangs go, the makeup stays", () => {
    const chain = [step("vampire fangs and a dark red lip", { makeup: "a dark red lip", open: { fangs } })];
    const matches = matchSteps(chain, { subject: "teeth", match: "fangs" });
    expect(matches).toEqual([{ index: 0, keep: null, dropOpen: ["fangs"] }]);
    const composed = composeChain(chainAfterRemoval(chain, matches, null));
    expect(composed.open).toBeUndefined();
    expect(composed.makeup).toBe("a dark red lip");
  });

  it("with no subject named, the same: only the fangs leave", () => {
    /* Facet null makes every step a facet candidate, which is the word path
       that used to find "fangs" in `wordsOfStep` and delete the whole step. */
    const chain = [step("vampire fangs and a dark red lip", { makeup: "a dark red lip", open: { fangs } })];
    const composed = composeChain(chainAfterRemoval(chain, matchSteps(chain, { subject: null, match: "fangs" }), null));
    expect(composed.open).toBeUndefined();
    expect(composed.makeup).toBe("a dark red lip");
  });

  it("CONTROL — a step holding nothing but the fangs is still deleted whole", () => {
    const chain = [step("give them vampire fangs", { open: { fangs } }), step("curled horns", { open: { horns } })];
    const matches = matchSteps(chain, { subject: "teeth", match: "fangs" });
    expect(matches).toEqual([{ index: 0, keep: null }]);
    expect(chainAfterRemoval(chain, matches, null).map((s) => s.instruction)).toEqual(["curled horns"]);
  });

  it("the struck part is the fangs alone, so the render is not told the makeup left", () => {
    const one = step("vampire fangs and a dark red lip", { makeup: "a dark red lip", open: { fangs } });
    const [match] = matchSteps([one], { subject: "teeth", match: "fangs" });
    expect(struckPartOf(one, match!)).toEqual({ open: { fangs } });
    /* CONTROL — a whole-step match strikes the whole step. */
    expect(struckPartOf(one, { index: 0, keep: null })).toBe(one.delta);
  });

  it("the recipe without the fangs is a DIFFERENT recipe, so the fanged picture is never handed back free", () => {
    /* The pruned step keeps its sentence, so the instruction lists are equal;
       only the fingerprint can tell the two recipes apart. */
    const chain = [step("give them vampire fangs and curled horns", { open: { fangs, horns } })];
    const before = { instructions: chain.map((s) => s.instruction), delta: composeChain(chain) };
    const pruned = chainAfterRemoval(chain, matchSteps(chain, { subject: "teeth", match: "fangs" }), null);
    const after = { instructions: pruned.map((s) => s.instruction), delta: composeChain(pruned) };
    expect(after.instructions).toEqual(before.instructions);
    expect(sameChain(after, before)).toBe(false);
    /* CONTROL — the same recipe still matches itself. */
    expect(sameChain(after, { instructions: [...after.instructions], delta: composeChain(pruned) })).toBe(true);
    expect(fingerprintDelta(after.delta)).not.toBe(fingerprintDelta(before.delta));
  });
});

/*
  #2665 — WHAT A KEPT SENTENCE NO LONGER ASKS FOR, read off the lineage through
  the real prune (`matchSteps` + `chainAfterRemoval`), never a hand-built
  "after" delta, so a change to what the prune keeps is a change this sees.
*/
describe("takenFromKeptSentences (#2665)", () => {
  const sentence = "small gold hoops and thin wire glasses";
  const before: ChainStep[] = [
    { instruction: sentence, delta: { free: { statedAccessories: ["small gold hoops", "thin wire glasses"] } }, provenance: null },
  ];
  const after = chainAfterRemoval(
    before,
    matchSteps(before, { subject: "statedAccessories", match: "hoops" }),
    "statedAccessories",
  );

  it("an item pruned from a kept step is named, verbatim, and the survivor is not", () => {
    expect(after.map((one) => one.instruction)).toEqual([sentence]);
    expect(takenFromKeptSentences(after, [before], composeChain(after))).toEqual(["small gold hoops"]);
  });

  it("an open kind pruned from a kept step is named by its noun", () => {
    const fanged: ChainStep[] = [{
      instruction: "add fangs and red lipstick",
      delta: { open: { fangs: { noun: "fangs", words: "long white fangs" } }, free: { lips: "red lipstick" } },
      provenance: null,
    }];
    const pruned = chainAfterRemoval(fanged, matchSteps(fanged, { subject: "teeth", match: "fangs" }), null);
    expect(pruned).toHaveLength(1);
    expect(takenFromKeptSentences(pruned, [fanged], composeChain(pruned))).toEqual(["fangs"]);
  });

  it("CONTROL — nothing is named when the lineage holds no shrunken step", () => {
    expect(takenFromKeptSentences(before, [before], composeChain(before))).toEqual([]);
    expect(takenFromKeptSentences(after, [], composeChain(after))).toEqual([]);
  });

  it("CONTROL — a pruned item the recipe holds again is not taken back", () => {
    const again = composeChain([...after, {
      instruction: "put the gold hoops back",
      delta: { free: { statedAccessories: ["small gold hoops"] } },
      provenance: null,
    }]);
    expect(takenFromKeptSentences(after, [before], again)).toEqual([]);
  });

  it("CONTROL — a different sentence in the lineage is never compared", () => {
    const other: ChainStep[] = [{ ...before[0]!, instruction: "something else entirely" }];
    expect(takenFromKeptSentences(after, [other], composeChain(after))).toEqual([]);
  });
});
