import { describe, expect, it } from "vitest";
import {
  CAST_PACKAGE_VIEWS,
  CAST_PACKAGE_WARDROBE_SPEC,
  castPackageWardrobeSpec,
  composePackageViewPrompt,
  packageViewExpectation,
  wardrobeSpecFor,
} from "./castViewPackage";
import { pronounsForSex, type CastPronouns } from "./castPronouns";
import { castWardrobeLine } from "./wardrobeLine";

/**
 * THE FIVE VIEWS AND THEIR JUDGE READ ONE ANSWER (design §3.3, item 6).
 *
 * The Cast's outfit is decided once at Sign and stored on its own record. What
 * these arms hold is the property that costs money when it breaks: **the
 * sentence the view was GENERATED from and the sentence it is JUDGED against
 * are the same sentence**. A judge told a different outfit than the prompt
 * asked for fails a view for obeying its instructions — five views, the wardrobe
 * axis, refunded slices, which is how the crew-neck chest design already cost
 * the customer money.
 */
describe("the package's wardrobe sentence", () => {
  const LINE = "dark canvas work jacket, straight jeans, plain boots";
  /*
    ⚠ The view with its own sentence is `closeUp`, NOT `frontClose`, and that
    distinction is one this file's own header warns about: `frontClose` means
    "Headshot" everywhere else in the product, and the package's `frontClose` is
    a tight close-up. The one carrying `CLOSE_UP_WARDROBE` is `closeUp`. Read off
    the source rather than inferred from the name, after inferring it wrongly.
  */
  const FULL_VIEWS = CAST_PACKAGE_VIEWS.filter((angle) => angle !== "closeUp");

  describe("⚠ UNPATHED IS UNCHANGED — every Cast signed to date", () => {
    it("is the constant, verbatim, on every view that shares it", () => {
      for (const angle of FULL_VIEWS) {
        expect(packageViewExpectation(angle).wardrobe).toBe(CAST_PACKAGE_WARDROBE_SPEC);
      }
      expect(castPackageWardrobeSpec(null)).toBe(CAST_PACKAGE_WARDROBE_SPEC);
    });

    it("keeps the below-frame clause, which is the honest answer with nothing written down", () => {
      expect(CAST_PACKAGE_WARDROBE_SPEC).toContain("CANNOT be compared to it and must not fail this check");
    });
  });

  describe("with a line", () => {
    it("⚠ the generator and the judge are given the SAME sentence", () => {
      /*
        One function, two callers. This is the arm the whole slice exists for:
        `composePackageViewPrompt` and `packageViewExpectation` derive their
        wardrobe sentence from one place, so they cannot come to describe two
        outfits.
      */
      for (const angle of CAST_PACKAGE_VIEWS) {
        const expectation = packageViewExpectation(angle, LINE);
        expect(composePackageViewPrompt(angle, LINE)).toContain(`WARDROBE: ${expectation.wardrobe}`);
      }
    });

    it("names the outfit and makes the FULL-LENGTH views judgeable for the first time", () => {
      const spec = castPackageWardrobeSpec(LINE);
      expect(spec).toContain(LINE);
      /*
        §3.3's payoff. The below-frame escape exists because a chest-up
        reference cannot establish trousers or shoes; a written line can, so the
        clause that told the judge to ignore them goes.
      */
      expect(spec).not.toContain("CANNOT be compared");
      expect(spec).toContain("below the frame of the reference photograph");
    });

    it("⚠ NEITHER sentence calls a JACKET an addition — her outfit may BE one", () => {
      /*
        The same self-contradiction the roll prompt's "No jackets" had, in the
        one place where the price is a refunded slice: a judge told that a
        jacket fails wherever it appears, handed a Cast whose outfit is a work
        jacket, fails a view for wearing what we asked for.

        ⚠ **THIS ARM USED TO ASSERT THE SHARED SENTENCE STILL SAID IT** — the
        contrast was the point, and the clause was left standing there on the
        reasoning that a Cast with no written line has nothing a jacket could
        contradict. **Read at production on 2026-09-25 (#1207): 5 of 5 signed
        Casts have no line**, so the branch this arm treated as the safe one is
        the only branch that has ever run, and the contradiction was live for
        every Cast whose outfit includes a jacket — while the branch it was
        fixed on had never once been taken. The shared sentence defers to the
        reference now, so both are free of it and the contrast is gone.
      */
      expect(CAST_PACKAGE_WARDROBE_SPEC).not.toContain("a jacket");
      expect(castPackageWardrobeSpec(LINE)).not.toContain("a jacket");
      /* The reader is not inert: it finds the phrase in the text that had it. */
      expect("plus ADDITIONS — a jacket, jewellery").toContain("a jacket");
      /* And the rest of the addition list survives, which it CAN because the
         door refuses hats, props, logos and printed text in the line. */
      for (const addition of ["jewellery", "a hat", "a bag", "a prop", "printed"]) {
        expect(castPackageWardrobeSpec(LINE), addition).toContain(addition);
      }
    });

    it("leaves the CLOSE-UP's own sentence alone", () => {
      /*
        It is written about the REFERENCE rather than about a spec — *where the
        collar IS visible it matches the reference's neckline* — so it is
        already correct on every path, including a Basics Cast with no collar.
      */
      const closeUp = packageViewExpectation("closeUp", LINE).wardrobe;
      expect(closeUp).toBe(packageViewExpectation("closeUp").wardrobe);
      expect(closeUp).not.toContain(LINE);
    });

    it("CONTROL — a different line really produces a different expectation", () => {
      expect(packageViewExpectation("frontFull", LINE).wardrobe)
        .not.toBe(packageViewExpectation("frontFull", "a plain white tee and dark jeans").wardrobe);
    });
  });
});

/**
 * READING THE SNAPSHOT BACK — the one reader, and it fails safe.
 *
 * `technicalSchema` is an unstructured column written across several eras, so
 * everything unrecognised answers `null`: compose and judge exactly as the
 * product always has. The alternative dresses a Cast in an outfit nobody chose.
 */
describe("castWardrobeLine", () => {
  it("reads the line Sign stored", () => {
    expect(castWardrobeLine({ wardrobe: { path: "wardrobe", line: "a red apron", source: "born" } }))
      .toBe("a red apron");
  });

  it("answers null for every shape that is not one", () => {
    for (const schema of [
      null,
      undefined,
      "a string",
      42,
      {},
      /* Every Cast signed before the paths existed: no key at all. */
      { subject: {}, cohortKey: "photoreal_human" },
      /* The unpathed snapshot this Sign writes today. */
      { wardrobe: { path: null, line: null, source: null } },
      /* An incoherent roll — a path with no line. Refused, never guessed. */
      { wardrobe: { path: "basics", line: null, source: null } },
      { wardrobe: "a red apron" },
      { wardrobe: { line: "   " } },
    ]) {
      expect(castWardrobeLine(schema), JSON.stringify(schema)).toBeNull();
    }
  });
});

/**
 * #1479 — THE REFERENCE'S OWN JEWELLERY IS HERS, ON EVERY ROAD.
 *
 * His Sign of "Bingu" (cast 61, 2026-09-29) lost its `backFull` to the wardrobe
 * axis — `model_assets` 361, `failed`, *"This view came back in the wrong
 * clothing"* — on this judge note:
 *
 * > *"The layered dark draped fabric robe and scarf match, but the
 * > earrings/dangling jewelry visible at the ears are an addition not covered by
 * > the wardrobe description."*
 *
 * The anchor shows those earrings. The view carried them faithfully and was
 * refused and refunded for it.
 *
 * ⚠ **The judge was obeying us.** Read at the rows, that Sign ran on roll 309
 * with `wardrobeLine = "dark draped fabric"` — the STORED-LINE road, whose
 * sentence said *"Judge the clothing against this description"* and
 * *"ADDITIONS are failures wherever they appear: jewellery…"*, with no reference
 * exception at all. The other two sentences had been narrowed twice (#1207,
 * #1278 part 1); this one was skipped both times on the recorded ground that it
 * had never run. #1278 part 1 is what made it run.
 *
 * So these arms are pointed at the CLASS rather than at the line: every wardrobe
 * sentence the product can send, on every road, must say that what the reference
 * shows is hers.
 */
describe("#1479 · every wardrobe sentence defers to the reference photograph", () => {
  const LINE_WITHOUT_JEWELLERY = "dark draped fabric";
  const DESCRIPTION = "a layered dark draped fabric robe with a heavy scarf";

  /**
   * THE POPULATION IS DERIVED, NEVER LISTED (working law 4).
   *
   * Three roads through `wardrobeSpecFor` × every package view. Listing the
   * three constants by name is what let one of them be forgotten twice: a
   * fourth road added later joins this set by existing, and a road that stops
   * deferring to the reference reddens here rather than on a customer's Sign.
   */
  const everySentenceTheProductCanSend = (
    pronouns: CastPronouns = pronounsForSex(null),
  ): Array<{ road: string; angle: string; text: string }> =>
    CAST_PACKAGE_VIEWS.flatMap((angle) => [
      { road: "nothing written down", angle, text: wardrobeSpecFor(angle, null, null, pronouns) },
      { road: "the cast's own brief", angle, text: wardrobeSpecFor(angle, null, DESCRIPTION, pronouns) },
      { road: "a stored line", angle, text: wardrobeSpecFor(angle, LINE_WITHOUT_JEWELLERY, null, pronouns) },
    ]);

  it("says what the reference shows is the cast's own — all three roads, every view, every pronoun", () => {
    /*
      ⚠ **THE REGEX SAID `shows her wearing` AND MOVED WITH #1480 FINDING A**,
      which is what the card predicted: this clause and the reference paragraph
      take the cast's pronouns together, *"or the male cast reads her in one
      sentence and his in the next"*. Pinning the WORD would have frozen the
      defect; pinning the SHAPE per pronoun is what the arm was always about.
    */
    for (const sex of [null, "male", "female"]) {
      const pronouns = pronounsForSex(sex);
      const sentences = everySentenceTheProductCanSend(pronouns);
      /* A floor, so a `flatMap` that silently returned nothing cannot pass. */
      expect(sentences.length, "three roads over every package view").toBeGreaterThanOrEqual(15);
      for (const { road, angle, text } of sentences) {
        expect(text, `${String(sex)} · ${road} · ${angle}`).toMatch(
          new RegExp(`the reference (photograph itself shows ${pronouns.object} wearing|DOES show) is this person's own`),
        );
      }
    }
  });

  it("⚠ and the pronoun is the CAST'S — a sentence frozen back to `her` reddens here (#1480 finding A)", () => {
    /*
      The arm above would pass perfectly well on a sentence that had gone back to
      a fixed word, because it builds its own regex from the same pronouns it
      passes in — a guard measuring itself. This is the half that cannot: two
      pronouns, one sentence, and they must DIFFER.
    */
    const his = wardrobeSpecFor("frontFull", null, DESCRIPTION, pronounsForSex("male"));
    const hers = wardrobeSpecFor("frontFull", null, DESCRIPTION, pronounsForSex("female"));
    expect(his).not.toBe(hers);
    expect(his).toContain("shows him wearing");
    expect(hers).toContain("shows her wearing");
  });

  it("⚠ NO sentence carries an unconditional addition list — the exact clause that refused his earrings", () => {
    for (const { road, angle, text } of everySentenceTheProductCanSend()) {
      /* The sentence as it stood, verbatim, so this arm names the defect rather
         than describing it. */
      expect(text, `${road} · ${angle}`).not.toContain("ADDITIONS are failures wherever they appear");
      /* And the general shape of it: an addition list must always be qualified
         by what the reference shows. */
      if (text.includes("ADDITIONS —")) {
        expect(text, `${road} · ${angle}`).toContain("that the reference does not show");
      }
    }
  });

  it("keeps the check that EARNS its refunds — an addition in neither record still fails", () => {
    /*
      The half a one-sided fix would have deleted. A sentence that only said
      "the reference's things are hers" would have stopped the axis failing
      anything at all, which is refund noise traded for a blind judge. Both
      directions, on the road that broke.
    */
    const spec = castPackageWardrobeSpec(LINE_WITHOUT_JEWELLERY);
    for (const addition of ["jewellery", "a hat", "a bag", "a prop", "printed text or logo"]) {
      expect(spec, addition).toContain(addition);
    }
    expect(spec).toContain("are a failure wherever they appear");
    /* And it is judged against BOTH records now, not the words alone — the
       clause the judge quoted back at us when it refused him. */
    expect(spec).toContain("this description and the reference photograph together");
    expect(spec).not.toContain("Judge the clothing against this description.");
  });

  it("the described road still needs BOTH records silent, which #1278 part 1 established", () => {
    /* Unchanged by this fix and asserted here so the unification cannot quietly
       loosen it: with a description in hand, an addition fails only when the
       photograph does not show it AND the words do not name it. */
    const described = wardrobeSpecFor("frontFull", null, DESCRIPTION);
    expect(described).toContain("does not show AND the description does not name");
    /* With NO description there is no second record to consult, so the
       conjunction must not appear — a sentence promising the judge a
       description it was never given is an instruction it cannot follow. */
    expect(wardrobeSpecFor("frontFull", null, null)).not.toContain("AND the description does not name");
  });
});
