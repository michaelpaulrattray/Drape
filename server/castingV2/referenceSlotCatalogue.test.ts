/**
 * THE CATALOGUE'S TESTS — the ones that would fail if somebody made the table
 * convenient.
 *
 * Three defects are worth more than the rest here, and each has its own case:
 * a question that carries a laterality word (the segmenter ignores it and the
 * guard's second read agrees with the cut about the wrong ear), a question
 * invented rather than taken from a table that owns one, and a slot quietly
 * given the nearest bigger region so that it can mint something.
 *
 * The totality case is the cheap one and it is the one that catches the future:
 * a facet added to the refine vocabulary with no home here is a feature the
 * panel silently cannot show.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { LANDMARK_OF_ACCESSORY } from "./accessoryKinds";
import {
  INK_PLACEMENTS,
  inkPlacementBareNoun,
  inkPlacementEntry,
} from "../../shared/inkPlacementVocabulary";
import { inkSideSlotKey, inkSlotKey } from "./referenceSlots";
import { REGION_CARDS } from "./regionCards";
import { regionNameOf } from "./maskedRefine";
import { assembleRecipe } from "./recipeAssembler";
import {
  catalogueSlots,
  slotDefinition,
  slotSpecFor,
  FACET_SLOTS,
  SLOT_CATALOGUE,
  DERIVED_REGION_KEY,
  isDerivedRegion,
  isAskable,
  DISPLAY_REGION_VOCABULARY,
} from "./referenceSlotCatalogue";
import { allFacets } from "./refineFacets";

const SHE = { subject: "she", object: "her", possessive: "her", plural: false } as const;

describe("what a slot is", () => {
  it("answers the mint's four questions for a slot that has a question of its own", () => {
    expect(slotDefinition("hair")).toEqual({
      slot: "hair",
      feature: "hair",
      instance: null,
      tier: "anatomy",
      group: "hair",
      /* Whether the panel draws a row for it is the catalogue's answer too —
         structure is words, lashes are read on the eyes, and everything else
         speaks for itself (fable-382 §1). */
      panel: { row: "own" },
      noun: "hair",
      question: "hair",
      guardKind: "hair",
      frame: "wholeFrame",
      /* And when its crop is re-cut. Almost every slot keeps the crop it has
         until a render earns it again; `build` is the one exception, and its
         entry carries the reason. */
      remint: "whenEarned",
      /* And whether the panel draws it from somewhere other than the region it
         is cut from — `skin` and `teeth` do, each because the two genuinely
         come apart there. */
      display: null,
      /* And what the row says when the scan asks and finds nothing — hair is
         the founder's own case (fable-889: "yes show bald"). The reason
         travels ON the slot, because the admission IS the reason: an empty
         read here cannot mean "hidden". */
      whenAbsent: {
        says: "bald",
        why: expect.stringContaining("the crown is in frame"),
      },
    });
  });

  it("carries NO absent state on a slot nobody admitted one for", () => {
    /* The other half of the record above, and the one that keeps the field
       honest: it is present exactly where it was authored, and a slot without
       it does not carry the key at all. */
    expect(slotDefinition("lips")).toMatchObject({ slot: "lips" });
    expect(Object.keys(slotDefinition("lips")!)).not.toContain("whenAbsent");
  });

  it("names an instance on its own side, and never in the question", () => {
    const left = slotDefinition("earring@left");
    expect(left).toMatchObject({
      slot: "earring@left",
      feature: "earring",
      instance: "left",
      tier: "item",
      group: "accessories",
      noun: "left earring",
      question: "earring",
      guardKind: "earring",
      frame: "ownSide",
    });
  });

  it("REFUSES rather than defaulting: an unknown slot, a ledger key, a side on a single feature", () => {
    expect(slotDefinition("cheekbones")).toBeNull();
    expect(slotDefinition("makeup@face skin")).toBeNull();
    expect(slotDefinition("hair@left")).toBeNull();
    /* A bilateral feature has no whole-face row: `eye` alone would be a slot
       whose crop is whichever eye the segmenter named. */
    expect(slotDefinition("eye")).toBeNull();
    expect(slotDefinition("earring")).toBeNull();
  });
});

describe("no question is invented, and none carries a side", () => {
  it("takes every anatomy question from the region vocabulary that owns it", () => {
    for (const definition of catalogueSlots()) {
      if (definition.question === null) continue;
      /* A DERIVED region is the one thing here that is not asked at all, so it
         is not owned by a table and must not be: it is composed by the mint
         from regions that ARE owned. It is admitted by name, and the next test
         proves the name could never reach a segmenter as a question. */
      if (isDerivedRegion(definition.question)) continue;
      const entry = SLOT_CATALOGUE.find((candidate) => candidate.feature === definition.feature)!;
      const owned = entry.facets.some((facet) => regionNameOf(facet) === definition.question)
        || LANDMARK_OF_ACCESSORY.some((accessory) => accessory.region === definition.question)
        /*
          OR THE REGION CARDS, for a question asked of the DELIVERED frame.

          An addition's facet card says `region: null` and means it — segmenting
          the MASTER for horns asks where a thing is she does not have. Its
          cutting word is still a real region with a real card (phrasing, edge,
          neighbours), and the card table is the one that owns it. The source
          says which picture the word is for, so this is an ownership test that
          still cannot be satisfied by an invented phrase.
        */
        || (entry.question.from === "deliveredRegion"
          && REGION_CARDS[definition.question as keyof typeof REGION_CARDS] !== undefined);
      expect(owned, `${definition.slot} asks "${definition.question}", which no table owns`).toBe(true);
    }
  });

  it("a derived key is not a question, and cannot be mistaken for one", () => {
    const keys = Object.values(DERIVED_REGION_KEY);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      /* Not in the region vocabulary, not in the accessory table — so a reader
         handed it would be being asked an open question, which is what D-213
         forbids and why the mint composes these rather than asking. */
      expect(allFacets().some((facet) => regionNameOf(facet) === key)).toBe(false);
      expect(LANDMARK_OF_ACCESSORY.some((accessory) => accessory.region === key)).toBe(false);
      /* And it announces itself: a phrase beginning `derived:` is not something
         a caller could type by accident and get past the mint's routing. */
      expect(key.startsWith("derived:")).toBe(true);
      expect(isDerivedRegion(key)).toBe(true);
    }
    expect(isDerivedRegion("face skin")).toBe(false);
    expect(isDerivedRegion(null)).toBe(false);
  });

  it("her build is the derived one, and it is the only one", () => {
    const derived = catalogueSlots().filter((definition) => isDerivedRegion(definition.question));
    expect(derived.map((definition) => definition.slot)).toEqual(["build"]);
    /* Her skin is NOT derived: fable-423 closed that question — every designed
       carrier was ridden and none was faithful, so skin keeps its words. */
    expect(slotDefinition("skin")!.question).toBeNull();
  });

  it("NEVER puts a laterality word in a question — SAM 3 returned the same hoop twice", () => {
    for (const definition of catalogueSlots()) {
      expect(definition.question ?? "").not.toMatch(/\b(left|right)\b/i);
    }
  });

  it("reads a bilateral slot on its own side, and a single one on the whole frame", () => {
    expect(slotDefinition("eye@left")!.frame).toBe("ownSide");
    expect(slotDefinition("brow@right")!.frame).toBe("ownSide");
    expect(slotDefinition("ear@left")!.frame).toBe("ownSide");
    expect(slotDefinition("earring@right")!.frame).toBe("ownSide");
    expect(slotDefinition("lips")!.frame).toBe("wholeFrame");
    expect(slotDefinition("glasses")!.frame).toBe("wholeFrame");
  });
});

describe("a slot with no question of its own is words-only, and says why", () => {
  it("refuses to hand her jaw the face's region", () => {
    const jaw = slotDefinition("jaw")!;
    expect(jaw.question).toBeNull();
    expect(jaw.guardKind).toBeNull();
    expect(jaw.wordsOnly).toContain("face skin");
    expect(jaw.wordsOnly).toContain("broader");
  });

  it("refuses to file a face crop as her skin, which is the other direction", () => {
    const skin = slotDefinition("skin")!;
    expect(skin.question).toBeNull();
    expect(skin.wordsOnly).toContain("narrower");
  });

  it("carries a question and a guard kind together, or neither", () => {
    for (const definition of catalogueSlots()) {
      expect(definition.question === null).toBe(definition.guardKind === null);
      expect(definition.question === null).toBe(definition.wordsOnly !== undefined);
    }
  });

  it("gives the same name to the guard kind and the question, so no crop is judged by another kind's number", () => {
    for (const definition of catalogueSlots()) {
      expect(definition.guardKind).toBe(definition.question);
    }
  });
});

describe("a pair carries the word it is spoken as", () => {
  it("writes the plural down rather than adding an s to it", () => {
    expect(slotDefinition("eye@left")!.pairNoun).toBe("eyes");
    expect(slotDefinition("ear@right")!.pairNoun).toBe("ears");
    /* The case a rule gets wrong: "lashes" pluralized reads "lasheses". */
    expect(slotDefinition("lashes@left")!.pairNoun).toBe("lashes");
    expect(slotDefinition("earring@left")!.pairNoun).toBe("earrings");
  });

  it("gives one to every per-side slot and to no single one", () => {
    for (const definition of catalogueSlots()) {
      expect(
        definition.pairNoun !== undefined,
        `${definition.slot} is ${definition.instance === null ? "single" : "per side"}`,
      ).toBe(definition.instance !== null);
    }
  });
});

describe("the tier boundary, as the rulings left it", () => {
  it("has NO surface-tier slot — a surface worn on anatomy is the anatomy slot's stack", () => {
    expect(catalogueSlots().filter((definition) => definition.tier === "surface")).toEqual([]);
    expect(FACET_SLOTS.makeup).toMatchObject({ notASlot: expect.stringContaining("fable-201") });
  });

  it("files everything she wears as an item and everything she is as anatomy", () => {
    const tierOf = (slot: string) => slotDefinition(slot)!.tier;
    expect(tierOf("earring@left")).toBe("item");
    expect(tierOf("glasses")).toBe("item");
    expect(tierOf("nose-stud")).toBe("item");
    expect(tierOf("lips")).toBe("anatomy");
    expect(tierOf("skin")).toBe("anatomy");
    expect(tierOf("hair")).toBe("anatomy");
  });
});

describe("the accessory slots are derived from the placement table, not restated", () => {
  it("has one slot family per kind the product can place, and pairs come in twos", () => {
    for (const accessory of LANDMARK_OF_ACCESSORY) {
      const feature = accessory.region.replace(/ /g, "-");
      const sides = catalogueSlots().filter((definition) => definition.feature === feature);
      expect(sides.map((definition) => definition.slot).sort())
        .toEqual(accessory.pair ? [`${feature}@left`, `${feature}@right`] : [feature]);
      for (const side of sides) expect(side.question).toBe(accessory.region);
    }
  });

  it("keeps the key free of spaces, because a key with one is not a slot", () => {
    expect(slotDefinition("nose stud")).toBeNull();
    expect(slotDefinition("nose-stud")).toMatchObject({ noun: "nose stud", question: "nose stud" });
  });
});

describe("every facet has a home, or a stated reason for not having one", () => {
  it("is total over the refine vocabulary", () => {
    for (const facet of allFacets()) {
      const assignment = FACET_SLOTS[facet];
      expect(assignment, `facet "${facet}" has no entry in FACET_SLOTS`).toBeDefined();
    }
  });

  it("points every assigned facet at a slot the catalogue actually has", () => {
    for (const facet of allFacets()) {
      const assignment = FACET_SLOTS[facet]!;
      if ("feature" in assignment) {
        expect(
          SLOT_CATALOGUE.some((entry) => entry.feature === assignment.feature),
          `facet "${facet}" points at "${assignment.feature}", which is not in the catalogue`,
        ).toBe(true);
      }
    }
  });

  it("gives every catalogued slot at least one facet whose words land in it", () => {
    for (const entry of SLOT_CATALOGUE) {
      expect(entry.facets.length, `${entry.feature} holds nobody's words`).toBeGreaterThan(0);
    }
  });

  it("keeps expression OUT, with the reason rather than by omission", () => {
    expect(FACET_SLOTS.expression).toMatchObject({ notASlot: expect.stringContaining("D-136") });
  });

  /*
    INK LEFT THIS LIST ON 2026-08-20, and the pin above is what noticed.

    It read `notASlot` with a reason beginning "OWED" — and the reason turned
    out to be the specification: one slot per placement, its question from the
    placement rather than from a region table. The assignment is now the third
    shape, `perPlacement`, and the fence became the spec.
  */
  it("gives ink a per-placement home now that the lane exists", () => {
    expect(FACET_SLOTS.ink).toEqual({ perPlacement: "ink" });
    /* And it is NOT a feature assignment: `{ feature: "tattoo" }` is the tidy
       collapse the caution below exists to stop, and it would send a segmenter
       an open question. */
    expect("feature" in FACET_SLOTS.ink).toBe(false);
  });

  /*
    THE CAUTION SURVIVED THE FENCE IT WAS WRITTEN ON (fable-1146 §2's condition).

    The `notASlot` string is gone, and with it the sentence that has been
    stopping people inventing a `tattoo` segmenter question. The ruling let the
    string go on one condition — that D-213's caution rides along VERBATIM into
    the assignment's own docblock — so the condition is made mechanical here
    rather than left as a promise: read off the source, because a docblock is
    the one kind of statement a normal assertion cannot see.

    This is a `derive-never-mirror` exception on purpose. There is nothing to
    derive from: the fact under test IS that a particular sentence is present in
    a particular file.
  */
  it("carries D-213's caution forward, verbatim, where the decision is made", () => {
    const source = readFileSync(
      new URL("./referenceSlotCatalogue.ts", import.meta.url),
      "utf8",
    );
    /* A docblock WRAPS, so the sentence is read the way a person reads it:
       comment furniture off, whitespace collapsed. Asserting the raw file would
       fail on a re-wrap, which would make this arm about line breaks rather
       than about the caution. */
    const prose = source
      .replace(/^\s*\*\s?/gm, "")
      .replace(/\s+/g, " ");
    expect(prose).toContain(
      "Inventing a `tattoo` question here would ask a segmenter an open question (D-213)",
    );
    /* And the half that says WHY there is no such region — the three measured
       words, which is what makes the caution actionable rather than a rule. */
    expect(prose).toContain("There is no `tattoo` region");
  });
});

describe("the catalogue's nouns are the ones the recipe assembler can speak", () => {
  it("builds a recipe naming every catalogued slot, with no bare-noun refusal", () => {
    /*
      AT THE WIRE, not against a copy of the rule. The assembler owns the
      determiner grammar and it refuses `nounNotBare`; asserting a regex here
      would prove the regex, not the nouns. Every slot is put through the real
      assembler with one word in its stack.
    */
    const recipe = assembleRecipe({
      master: { key: "master.png" },
      pronouns: SHE,
      library: catalogueSlots().map((definition) => ({
        slot: definition.slot,
        tier: definition.tier,
        noun: definition.noun,
        words: ["as she is"],
      })),
      asks: [],
    });
    expect(recipe.ok, "ok" in recipe && recipe.ok === false ? `${recipe.reason}: ${recipe.detail}` : "").toBe(true);
  });

  it("speaks a worn thing with an article and a part of her with the possessive", () => {
    const recipe = assembleRecipe({
      master: { key: "master.png" },
      pronouns: SHE,
      library: [
        { slot: "lips", tier: "anatomy", noun: slotDefinition("lips")!.noun, words: ["full"] },
        {
          slot: "earring@left",
          tier: "item",
          noun: slotDefinition("earring@left")!.noun,
          words: ["a gold hoop"],
          anchor: { key: "hoop.png" },
        },
      ],
      asks: [
        { slot: "lips", words: "a deeper cupid's bow" },
        { slot: "earring@left", words: "noticeably bigger" },
      ],
    });
    if (!recipe.ok) throw new Error(`${recipe.reason}: ${recipe.detail}`);
    expect(recipe.ask).toContain("her lips");
    expect(recipe.ask).toContain("the left earring");
  });
});

describe("what the mint is handed", () => {
  it("composes a spec the mint can cut, with the words the caller supplied", () => {
    expect(slotSpecFor("hair", ["a blunt bob", "copper"])).toEqual({
      slot: "hair",
      tier: "anatomy",
      noun: "hair",
      words: ["a blunt bob", "copper"],
      question: "hair",
      guardKind: "hair",
      frame: "wholeFrame",
    });
  });

  /*
    THE FRAME TRAVELS WITH THE SPEC, and it is the mint's whole defence against
    cutting one of a pair from a union of both.

    `toEqual` above is exhaustive on purpose: a field the catalogue knows and
    forgets to pass is a decision made here and lost on the way, which is how a
    per-side slot would arrive at the mint looking like any other.
  */
  it("carries a per-side slot's own-side frame through to the mint's spec", () => {
    expect(slotSpecFor("earring@left", ["dangly gold crosses"])).toEqual({
      slot: "earring@left",
      tier: "item",
      noun: "left earring",
      words: ["dangly gold crosses"],
      question: "earring",
      guardKind: "earring",
      frame: "ownSide",
    });
  });

  it("hands a words-only slot its nulls rather than the nearest region", () => {
    expect(slotSpecFor("teeth", ["straight and white"])).toMatchObject({
      slot: "teeth",
      question: null,
      guardKind: null,
      words: ["straight and white"],
    });
  });

  it("returns null for a slot it has never heard of, instead of composing a guess", () => {
    expect(slotSpecFor("hat", ["a wide brim"])).toBeNull();
    expect(slotSpecFor("makeup@lips", ["nude gloss"])).toBeNull();
  });
});

/**
 * SHOWN, NEVER CARRIED — the never-crossing assertion (fable-428 §3).
 *
 * The founder's box rule says every panel row has a bounding box on the
 * photograph. `skin` is the row where the region it is DRAWN from and the region
 * it may be CUT from come apart: her skin is all of her visible skin (working
 * law 8), so a face crop filed as her skin is a partial wearing the name of the
 * whole — while the same face-skin cutout is exactly the right picture for a
 * row that is a name and a click affordance.
 *
 * That separation may not live in a comment. These drive it: a display region
 * has no route to the mint, and the one door the mint has does not carry it.
 */
describe("a display region is shown and never carried", () => {
  const displayed = catalogueSlots().filter((definition) => definition.display !== null);

  it("has a member — otherwise every case below passes on an empty list", () => {
    /* The positive control. A vacuous sweep is the checker that cannot fail,
       and this file already learned that lesson on the totality case. */
    /*
      TWO NOW (fable-463). Teeth joined skin at the same door and for the same
      reason: the region is the right picture for the row and the wrong crop to
      file as it. Their regions differ from their questions in opposite
      directions — skin's is narrower than the slot, teeth's is a question the
      catalogue refuses to CUT from because a crop of it filed as her teeth is
      the mouth under a second name.
    */
    /*
      THREE, THEN TWO AGAIN (fable-527 §3, then the founder's carry ruling of
      2026-08-15). Horns arrived at this door from a third direction — its
      display region and its cutting region were the SAME words, and only the
      cutting one was refused — and it LEFT the moment the founder ruled that a
      feature carries by reference. Its row now draws from its own question, so
      it is no longer a slot whose picture and crop must differ, which is the
      only thing this list is about.
    */
    /*
      AND TEETH'S WORDS CHANGED (fable-619 §2, benched 2026-08-15): the bare
      noun answered the class with an INSTANCE — one fang on his own render, 10%
      of the mouth's width — so the row now asks for "all the teeth", which
      returns 76–98% of it on every frame where teeth show and nothing on a
      closed mouth. Pinned here because the words are the fix.
    */
    expect(displayed.map((definition) => definition.slot)).toEqual(["teeth", "skin"]);
    expect(displayed.map((definition) => [definition.slot, definition.display]))
      .toEqual([["teeth", "all the teeth"], ["skin", "face skin"]]);
  });

  it("names a region the segmenter actually answers, never an invented one", () => {
    /* Same rule as a question's: a display region is asked of a real reader, so
       an improvised phrase here would be the open question D-213 forbids
       arriving through the display door instead of the cutting one. */
    for (const definition of displayed) {
      const owned = allFacets().some((facet) => regionNameOf(facet) === definition.display)
        || LANDMARK_OF_ACCESSORY.some((accessory) => accessory.region === definition.display)
        /* Or the display vocabulary's own table, whose entries carry the
           reading that earned them (fable-463: teeth). */
        || DISPLAY_REGION_VOCABULARY[definition.display!] !== undefined;
      expect(owned, `${definition.slot} draws from "${definition.display}", which no table owns`)
        .toBe(true);
      expect(isDerivedRegion(definition.display)).toBe(false);
    }
  });

  it("NEVER reaches the mint — the spec the mint is handed does not carry it", () => {
    /*
      `slotSpecFor` is the mint's only door. A display region reaching it as a
      `question` would be cut, guarded against its own region, and filed as the
      slot's crop — her face stored as her skin, complete against the wrong
      boundary, which is the exact failure the catalogue note refuses.
    */
    for (const definition of displayed) {
      const spec = slotSpecFor(definition.slot, ["a warm olive tone"])!;
      expect(spec.question).toBeNull();
      expect(spec.guardKind).toBeNull();
      /* The field itself never crosses the door. Asserted on the KEY rather
         than by searching the values: `teeth` draws from a region that shares
         its own name, so a value search would read the slot's noun as a leak
         (and did, the first time this ran). */
      expect(Object.keys(spec)).not.toContain("display");
    }
  });

  it("does not silently become a question by being a display region", () => {
    /* The other direction: a slot with a display region must still be
       words-only by the catalogue's own account, so nothing downstream can read
       `display` as permission to cut. */
    for (const definition of displayed) {
      expect(isAskable(definition)).toBe(false);
      expect(definition.wordsOnly).toBeTypeOf("string");
    }
  });
});

/**
 * A STATED ABSENCE IS ADMITTED PER SLOT, IN WRITING, OR IT DOES NOT HAPPEN
 * (founder ruling fable-889, `PANEL_ABSENT_STATE_DESIGN.md`).
 *
 * *"Yes show bald"* — and the same ruling's scope note is the reason this file
 * has a case at all: *"do not invent none-states for features the scan cannot
 * honestly assert none about."* `empty` is one field carrying two facts (she
 * has none of it · I could not see it), and which one it is depends on the pose
 * and the hair. So the admission is authored beside its reason and the default
 * is silence — the discipline `panel` and `display` already follow.
 */
describe("which features may state a finding of nothing", () => {
  const admitted = catalogueSlots().filter((definition) => definition.whenAbsent !== undefined);

  it("is hair and facial hair, and nothing else", () => {
    /* The positive control, and the enumeration is the point: a third member
       arriving without a court is what this case is here to make visible. */
    expect(admitted.map((definition) => [definition.slot, definition.whenAbsent!.says]))
      .toEqual([["hair", "bald"], ["facial-hair", "clean-shaven"]]);
  });

  it("carries the reason it is safe, on the slot", () => {
    /* Not decoration: the reason is the whole admission — the crown and the jaw
       are in frame on every casting framing and nothing hides them. A member
       with no argument beside it is a member somebody added by pattern. */
    for (const definition of admitted) {
      expect(definition.whenAbsent!.why.length).toBeGreaterThan(60);
      expect(definition.whenAbsent!.says.length).toBeGreaterThan(0);
    }
  });

  it("is never a per-side slot, because a hidden side is not an absent one", () => {
    /*
      THE NEGATIVE CONTROL, and it closes a silent gap rather than a loud one:
      the panel builds a stated absence only on the single-instance branch, so
      `whenAbsent` on a bilateral slot would do NOTHING and say nothing about
      doing nothing. An ear behind her hair and an ear she does not have are the
      same empty read; eyes, brows and lashes are the same argument.
    */
    for (const definition of admitted) expect(definition.instance).toBeNull();
    /* And the fixture that proves this case can fail: the catalogue does have
       per-side slots, so an admission on one is expressible. */
    expect(catalogueSlots().some((definition) => definition.instance !== null)).toBe(true);
  });

  it("is a slot the scan actually asks about, and draws a row of its own", () => {
    /* An admission on a slot with no question could never be reached — the fact
       is derived from an empty ANSWER — and one on a slot the panel does not
       draw would be a state nobody can see. Both are inert admissions, which
       read as decisions until somebody looks. */
    for (const definition of admitted) {
      expect(definition.question).not.toBeNull();
      expect(definition.panel.row).toBe("own");
    }
  });
});

/*
  THE INK LANE, IN THE CATALOGUE — shape (a)–(c)/(e), countersigned fable-1137
  §2, and its whole point is that nothing here was invented.

  The `ink` facet card wrote this shape long before anybody built it, in a
  `notASlot` reason meant as a fence: *"ink is per placement and its question
  comes from the placement rather than from a region table"*, with the mistake
  to avoid named on the same line — *"inventing a `tattoo` question here would
  ask a segmenter an open question (D-213)"*. So the arms below are mostly
  DERIVATION arms: they fail if a word was retyped rather than read.
*/
describe("a tattoo at a place", () => {
  it("is one slot per placement, never one `tattoo` slot", () => {
    /* The card's own caution made mechanical. A single `tattoo` question is
       exactly the open question D-213 forbids asking a segmenter. */
    expect(slotDefinition("ink:")).toBeNull();
    for (const placement of INK_PLACEMENTS) {
      const key = inkPlacementEntry(placement).sides === "perSide"
        ? inkSideSlotKey(placement, "left")
        : inkSlotKey(placement);
      expect(slotDefinition(key), key).not.toBeNull();
    }
  });

  /*
    THE QUESTION IS THE PLACEMENT'S OWN MEASURED WORD — read off the entry, not
    retyped beside it.

    `neck`, `upper arm` and `upper chest` were bought on sixteen production
    masters: the reading where `collarbone`, `clavicle` and `decolletage`
    returned nothing on skin that was plainly bare while `upper chest` found it
    exactly. This arm compares the slot's question to the VOCABULARY rather than
    to a string, so the day a better word is measured the catalogue follows it
    and this test is not the thing that has to be remembered.
  */
  it("asks the vocabulary's word and no new one", () => {
    for (const placement of INK_PLACEMENTS) {
      const entry = inkPlacementEntry(placement);
      const key = entry.sides === "perSide"
        ? inkSideSlotKey(placement, "right")
        : inkSlotKey(placement);
      const definition = slotDefinition(key);
      expect(definition, key).not.toBeNull();
      expect(definition!.question, key).toBe(entry.readerWord);
    }
  });

  /*
    THE SIDE IS THE VOCABULARY'S ANSWER TOO, and both rejections are driven.

    `upperArm` is `perSide` — the side is this road's measured failure, with 300
    credits refunded twice for a design on the wrong anatomical side
    (DECISION_LOG R7-7G). `neck` and `upperChest` are one place each, so a sided
    key for them is a key nobody could mean.
  */
  it("refuses a sideless key for a paired surface, and a sided one for a single", () => {
    expect(slotDefinition("ink:upperArm")).toBeNull();
    expect(slotDefinition("ink:neck@left")).toBeNull();
    expect(slotDefinition("ink:upperChest@right")).toBeNull();
    expect(slotDefinition("ink:upperArm@left")).not.toBeNull();
    expect(slotDefinition("ink:neck")).not.toBeNull();
  });

  it("puts the side on the slot, which is what the picture-half clause reads", () => {
    /* (e)'s side half is structural rather than a second sentence: the
       assembler's `whereItIs` reaches `sidePhrasing.imageHalfClause` through
       this field, so an ink slot with no instance would silently lose the
       clause that took a per-side court from four misses in twelve to none. */
    expect(slotDefinition("ink:upperArm@left")!.instance).toBe("left");
    expect(slotDefinition("ink:upperArm@right")!.instance).toBe("right");
    expect(slotDefinition("ink:neck")!.instance).toBeNull();
  });

  it("is an ITEM — introduced and worn, never anatomy the master owns", () => {
    /* The tier's own first example is *"an earring, a tattoo, her own
       glasses"*. Anatomy would make the words ride every render for a thing
       the master never had. */
    expect(slotDefinition("ink:neck")!.tier).toBe("item");
  });

  it("draws no panel row, and says the ROOM rather than the feature is missing", () => {
    const definition = slotDefinition("ink:upperArm@left")!;
    expect(definition.panel.row).toBe("none");
    expect(definition.panel.row === "none" && definition.panel.why)
      .toContain("ink studio");
  });

  it("speaks the surface in the stylist's bare words", () => {
    expect(slotDefinition("ink:neck")!.noun).toBe("neck tattoo");
    expect(slotDefinition("ink:upperArm@left")!.noun).toBe("left upper arm tattoo");
    expect(slotDefinition("ink:upperChest")!.noun).toBe("upper chest tattoo");
    /* Derived off the vocabulary's copy with the possessive off, never a second
       spelling — *"her her left upper arm"* is what a naive join makes. */
    expect(slotDefinition("ink:upperArm@right")!.noun)
      .toBe(`right ${inkPlacementBareNoun("upperArm")} tattoo`);
  });

  /*
    NO COMPLETENESS GUARD, AND THE REASON IS NOT "NOBODY MEASURED IT YET".

    A completeness family judges a crop WE CUT against specimens of that kind,
    and ink is never cut for the library (fable-1137 §3) — the design's own
    bytes are the carrier. So the biconditional the closed catalogue states is
    broken here the way the open lane breaks it, on a ground of its own, and the
    reason is RECORDED rather than left as a silent null.
  */
  it("carries no guard and says why, on every ink slot", () => {
    for (const key of ["ink:neck", "ink:upperArm@left", "ink:upperChest", "ink:sleeve"]) {
      const definition = slotDefinition(key);
      expect(definition, key).not.toBeNull();
      expect(definition!.guardKind, key).toBeNull();
      expect(definition!.question, key).not.toBeNull();
      expect(definition!.noSpecimen, key).toContain("never cut for the library");
    }
  });

  /*
    HER OWN WORD FOR A SURFACE NOBODY MEASURED (shape (c)).

    fable-1078: a reference-tattoo ask is never refused on placement. So an open
    placement resolves, with its own noun as the question and a SECOND reason on
    its `noSpecimen` — there is no measured region to cut from either.
  */
  it("takes an open placement, with the extra sentence a measured one does not get", () => {
    const open = slotDefinition("ink:sleeve")!;
    expect(open.question).toBe("sleeve");
    expect(open.noun).toBe("sleeve tattoo");
    expect(open.noSpecimen).toContain("names no surface the vocabulary has measured");
    /* And a measured one must NOT carry that sentence — the negative control
       kept after the positive passes, or the two reasons collapse into one. */
    expect(slotDefinition("ink:neck")!.noSpecimen)
      .not.toContain("names no surface the vocabulary has measured");
  });

  it("refuses a placement the slot grammar itself would refuse", () => {
    /* The shape rule is asked of `parseSlot` rather than restated, so a spaced
       phrase cannot resolve here and be refused downstream AFTER a paid
       render — the gap the open lane's kebab note records paying for. */
    expect(slotDefinition("ink:left forearm")).toBeNull();
  });

  /*
    AND IT IS NOT IN THE SCAN'S ENUMERATION, which is what makes the `question`
    above honest about being inert today.

    `catalogueSlots()` is the closed catalogue, and the face scan pays real
    money per region it enumerates. An ink slot appearing there would buy a
    segmenter read of an upper arm on every face panel opened.
  */
  it("is absent from the closed catalogue's own list", () => {
    expect(catalogueSlots().some((one) => one.slot.startsWith("ink:"))).toBe(false);
  });
});
