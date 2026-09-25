import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { CANONICAL_VIEW_ANGLES } from "../../shared/boardTypes";
import { CASTING_V2_SIGN_COSTS } from "../casting/castingCreditCosts";
import {
  PHOTOREAL_HUMAN_BLOCKS,
  photorealHumanConstant,
  referenceRealism,
} from "./cohortPhotorealHuman";
import { CAPTURE_SENTENCES, DROPPED_FROM_BLOCK, LIGHTING_LINE } from "./houseBlock";
import {
  CASTING_V2_SIGN_PRICE_CREDITS,
  CAST_PACKAGE_VIEWS,
  CAST_PACKAGE_VIEW_PRICE,
  castPackageView,
  composePackageViewPrompt,
  packageViewExpectation,
} from "./castViewPackage";

/**
 * The package's spec, its price, and the one boundary that keeps view
 * conformance from quietly becoming prompt compliance.
 */
describe("the canonical view package", () => {
  it("promises five generated views, in the order the strip reads them", () => {
    /*
      PACKAGE v3.1, the final composition: close-up, three-quarter, front,
      profile, back — with the Master leading the strip as presentation only.
      Read as angles it is a clean 0°/45°/90°/180° turnaround plus the detail
      shot.

      The retirement is asserted BY NAME, because a retired view coming back is
      exactly the kind of change that should have to argue for itself — and
      because this list has now moved three times, each time repricing the
      product through the derived constant below.
    */
    expect([...CAST_PACKAGE_VIEWS]).toEqual([
      "closeUp",
      "threeQuarter",
      "frontFull",
      "sideClose",
      "backFull",
    ]);
    // The walk retired in v2; the portrait in v3.1, because the Master already
    // shows her chest-up and square to camera — three frontal crops was one too
    // many.
    expect(CAST_PACKAGE_VIEWS).not.toContain("sideFull");
    expect(CAST_PACKAGE_VIEWS).not.toContain("frontClose");
    expect(new Set(CAST_PACKAGE_VIEWS).size).toBe(CAST_PACKAGE_VIEWS.length);
  });

  it("keeps the close-up out of the comp-card six", () => {
    /*
      `closeUp` is a Casting V2 package view, not a canonical comp-card angle.
      Folding it into `CANONICAL_VIEW_ANGLES` broke thirty legacy assertions
      that correctly say the comp card is six — the export filenames, the PDF
      cells, the ink registry, the iterate crops. It lives in the same database
      column and in its own vocabulary.
    */
    expect(CANONICAL_VIEW_ANGLES).not.toContain("closeUp");
    expect(CANONICAL_VIEW_ANGLES.length).toBe(6);
  });

  it("still knows the retired walk, because two signed Casts own one", () => {
    // A package is a historical record. Deleting the entry would leave their
    // walk slot rendering with no label.
    expect(castPackageView("sideFull").label).toBe("Walk");
  });

  it("specifies the close-up as a BAND, failable from both sides", () => {
    /*
      The founder's final framing, and the reason it is a range rather than a
      point: a single ideal crop can only be judged by "how close is this",
      which a vision model answers with a shrug. Two named landmarks and two
      named failure directions can each be checked by looking.

      v3 shipped a macro cropped at the lower lip. It was too tight — a face
      with no chin is a texture sample, not a portrait of anyone — so the
      shipped spec is now a conformance FAILURE under its own successor.
    */
    const closeUp = castPackageView("closeUp");
    expect(closeUp.label).toBe("Close-up");

    // What must be in frame: the tight bound.
    expect(closeUp.spec.framing).toContain("BELOW the chin");
    expect(closeUp.spec.framing).toContain("both eyes");
    // The band itself, stated by its two landmarks.
    expect(closeUp.spec.framing).toContain("eyebrows-to-chin");
    expect(closeUp.spec.framing).toContain("forehead-to-chin");
    // BOTH failure directions, or the judge has nothing to fail on.
    expect(closeUp.spec.framing).toContain("TOO TIGHT");
    expect(closeUp.spec.framing).toContain("TOO LOOSE");
    // And the superseded macro language is gone, not merely softened.
    expect(closeUp.spec.framing).not.toContain("tight macro");
    expect(closeUp.directive).not.toContain("EXTREME CLOSE-UP MACRO");
    expect(closeUp.directive).not.toContain("below the lower lip");
  });

  it("brings the three-quarter back with its spec intact", () => {
    /*
      45° is the angle downstream generation actually asks for, and it was the
      one genuinely missing viewpoint. Its entry survived the v3 retirement
      untouched — including the reference-relative wardrobe the maiden voyage
      forced, which it inherited from the shared constant rather than carrying
      its own copy. A per-view wardrobe string would have rotted here silently.
    */
    const threeQuarter = castPackageView("threeQuarter");
    expect(threeQuarter.label).toBe("Three-quarter");
    expect(threeQuarter.spec.framing).toContain("45 degrees");
    expect(threeQuarter.spec.framing).toContain("both eyes still visible");
    // Reference-relative, never an absolute colour (the maiden-voyage defect).
    expect(threeQuarter.spec.wardrobe).not.toMatch(/mid-grey|off-white/);
  });

  it("derives the Sign price from the number of views it actually promises", () => {
    // §H.10 as amended: 200 promotion + 5 × 50. Derived, so retiring a view
    // reprices the product rather than leaving a literal behind.
    expect(CASTING_V2_SIGN_PRICE_CREDITS).toBe(450);
    expect(CASTING_V2_SIGN_PRICE_CREDITS).toBe(
      CASTING_V2_SIGN_COSTS.promotion + CAST_PACKAGE_VIEW_PRICE * CAST_PACKAGE_VIEWS.length,
    );
    // The refundable slice is an integer, because the ledger is.
    expect(Number.isSafeInteger(CAST_PACKAGE_VIEW_PRICE)).toBe(true);
  });

  it("gives every slot both a customer-facing spec and a generator directive", () => {
    for (const angle of CAST_PACKAGE_VIEWS) {
      const view = castPackageView(angle);
      expect(view.label.length).toBeGreaterThan(0);
      expect(view.spec.framing.length).toBeGreaterThan(20);
      expect(view.spec.wardrobe.length).toBeGreaterThan(20);
      expect(view.directive.length).toBeGreaterThan(20);
    }
  });

  /**
   * THE BOUNDARY (D-92). The judge is handed the spec and only the spec. If it
   * is ever handed the directive or the code-owned constant, "does this match
   * what we sold" silently becomes "did the model do as it was told" — the
   * settled anti-pattern, and a check that passes happily while the picture is
   * wrong in a way nobody described.
   *
   * Asserted on distinctive phrases rather than on whole strings, because a
   * partial leak is the realistic failure: someone reaches for `view.directive`
   * to "give the judge more context".
   */
  it("never leaks the generation prompt into what the judge is told", () => {
    for (const angle of CAST_PACKAGE_VIEWS) {
      const expectation = packageViewExpectation(angle);
      const judgeText = `${expectation.framing}\n${expectation.wardrobe}`;
      const prompt = composePackageViewPrompt(angle);

      // Nothing the generator is uniquely told may appear in the judge's brief.
      expect(judgeText).not.toContain("OUTPUT FRAME");
      expect(judgeText).not.toContain("AUTHORITY:");
      expect(judgeText).not.toContain("PHOTOREALISTIC ONLY");
      expect(judgeText).not.toContain(castPackageView(angle).directive);

      // And the generator IS told those things — otherwise the assertions above
      // would pass on an empty prompt.
      expect(prompt).toContain(castPackageView(angle).directive);
      expect(prompt).toContain("AUTHORITY:");
    }
  });

  it("puts the code-owned constant last, where it outranks the description", () => {
    const prompt = composePackageViewPrompt("frontFull");
    // The authority paragraph claims precedence over everything above it, so
    // anything appended after it would silently outrank the guarantee.
    expect(prompt.trimEnd().endsWith("it always wins.")).toBe(true);
  });

  it("holds every full view to one wardrobe, and lets the close-up be honest", () => {
    const full = CAST_PACKAGE_VIEWS.filter((angle) => angle !== "closeUp");
    const wardrobes = new Set(full.map((angle) => packageViewExpectation(angle).wardrobe));
    // One garment contract across the views that can actually show a garment,
    // or "did the shirt change between the front and the back" is not a
    // question the judge can answer.
    expect(wardrobes.size).toBe(1);

    /*
      The close-up is deliberately different. At that crop the garment is often
      not in frame at all, and the judge is told to fail an axis it is unsure
      about — so the shared sentence would refund views for being hard to see.
      Its own sentence makes "nothing visible" a stated pass and keeps the axis
      pointed at what a close-up CAN show: things added to the face.
    */
    const closeUp = packageViewExpectation("closeUp").wardrobe;
    expect(closeUp).not.toBe(packageViewExpectation("frontFull").wardrobe);
    expect(closeUp).toContain("passes");
    /*
      ⚠ This read `toContain("earrings")` until #1221, when the sentence stopped
      being a ban list and the plural became "an earring". The literal was
      standing in for the CLAIM — that the axis still points at things added to
      the face — so the claim is what it asserts now, and the wording it happens
      to use is pinned next door where that is the actual subject.
    */
    expect(closeUp).toContain("earring");
    expect(closeUp).toContain("a failure wherever it appears");
  });

  it("names no absolute garment colour — continuity is with the reference", () => {
    /*
      The first real Sign failed and refunded its headshot because the spec said
      "mid-grey" while the signed candidate wore off-white: the generator obeyed
      the spec, the judge compared against the reference as instructed, and the
      customer paid for a contradiction we had authored. A colour word here is
      that defect coming back.
    */
    const wardrobe = packageViewExpectation("frontFull").wardrobe.toLowerCase();
    for (const colour of ["mid-grey", "grey", "gray", "off-white", "cream", "black", "white"]) {
      expect(wardrobe).not.toContain(colour);
    }
    expect(wardrobe).toContain("same");
    expect(wardrobe).toContain("reference");
    /*
      ⚠ **AND NO ABSOLUTE GARMENT EITHER (#1207)** — the same lesson one level
      up, and the arm above it did not catch it for thirteen months. This
      sentence said *"the SAME plain unbranded CREW-NECK TOP"*, so a Cast whose
      brief dressed her in anything else was described to the engine as wearing
      something she is not. A colour was a refund in August; a garment type is
      his Sifr cast: *"she is wearing pants and shoes these dont match her
      described outfit at all in the brief."*
    */
    for (const garment of ["crew-neck", "t-shirt", "shirt", "top,", "trousers", "shoes"]) {
      expect(wardrobe, `names the garment "${garment}"`).not.toContain(garment);
    }
  });

  it("keeps the sixth slot a walk, which is what the product calls it", () => {
    // D-44: `sideFull` is labelled "Walk" everywhere in the product. A spec
    // describing a standing profile would be judging a different photograph
    // from the one the room promises.
    const walk = castPackageView("sideFull");
    expect(walk.label).toBe("Walk");
    expect(walk.spec.framing).toContain("walking");
    expect(walk.directive.toLowerCase()).toContain("walk");
  });
});

describe("the wardrobe axis only judges what the reference can establish", () => {
  it("does not ask the judge about clothing the anchor cannot show", () => {
    /*
      The maiden voyage lost a view to "mid-grey vs off-white"; the v3.1
      verification lost its full back to "dark leather dress shoes instead of
      plain neutral shoes". Same class, second occurrence: the anchor is a
      CHEST-UP photograph, so it shows no trousers and no shoes, and the judge
      was left adjudicating our own adjective against its own taste. An axis
      told to fail when unsure must never be pointed at something the reference
      cannot establish.
    */
    const wardrobe = castPackageView("backFull").spec.wardrobe;
    expect(wardrobe).toContain("CANNOT be compared");
    expect(wardrobe).toContain("must not fail this check");
    /*
      Trousers and shoes are still NAMED — the judge has to be told which
      garments it cannot adjudicate, or the exclusion is unstateable. What must
      be gone is the REQUIREMENT: the spec no longer demands a particular kind
      of them, which is what the judge was measuring its own taste against.
    */
    expect(wardrobe).not.toContain("plain unbranded neutral trousers");
    expect(wardrobe).not.toContain("plain unbranded shoes");
    // Additions remain a failure wherever they appear — that is the half of
    // this axis that IS answerable from a chest-up reference.
    expect(wardrobe).toMatch(/jewellery|logo/);
    /*
      ⚠ **AND "a jacket" LEFT THAT LIST ON 2026-09-25 (#1207), deliberately.**
      With no stored line — which production measured as 5 of 5 signed Casts,
      all time — a jacket may BE the outfit the reference shows, and the clause
      then fails the customer's own clothes. The exclusion is phrased against
      the reference now, so it still catches a real addition without owning a
      list of garments nobody may wear.
    */
    expect(wardrobe, "names a garment that may be her own outfit").not.toContain("a jacket");
    expect(wardrobe).toContain("the reference does not show");
  });

  it("still tells the GENERATOR about her legs — but to CONTINUE the outfit, never to replace it", () => {
    /*
      The instruction moved rather than vanished. `spec.wardrobe` is read by the
      judge AND the generator (`composePackageViewPrompt`), so scoping it for
      the judge would have quietly stopped asking for trousers at all — the fix
      creating a worse defect than the one it closed.

      ⚠ **AND IT MOVED AGAIN ON 2026-08-23, WHICH IS WHY THIS ARM NOW READS THE
      COMPOSED PROMPT RATHER THAN THE CONSTANT.** The clause lived on
      `directive`, so it went into every full-length prompt — including one that
      four lines later said *"a plain hide loincloth, bare feet"*. The engine was
      obeying us, and the judge (already deriving from the stored line) refused
      the view and refunded it: 2 of 4 full-length views across two Sign courts.

      So the clause is COMPOSED now, and only for a Cast with no line of its own.
      This arm's claim is unchanged — the generator is still told — and the thing
      it reads had to move with the instruction, because a constant is no longer
      where the answer is. `fullLengthBottoms.test.ts` holds the other direction.

      ⚠ **AND ON 2026-09-25 (#1207) THE INSTRUCTION CHANGED SIDES.** It still
      exists — this arm's claim is untouched, and dropping it would be the
      "quietly stopped asking" defect the paragraph above warns about. What
      changed is WHAT it asks for: the clause named *"plain unbranded neutral
      trousers and plain unbranded shoes"*, which is a garment the customer
      never chose, and his Sifr cast wore it over her own outfit. It now asks
      the engine to continue what the reference already shows.
    */
    for (const angle of ["frontFull", "sideFull", "backFull"] as const) {
      const prompt = composePackageViewPrompt(angle, null);
      expect(prompt, angle).toContain("Below the waist");
      expect(prompt, angle).toContain("CONTINUE THE SAME OUTFIT");
      /* The literal his report names, so this cannot pass by paraphrase. */
      expect(prompt, angle).not.toMatch(/\btrousers\b/i);
      expect(prompt, angle).not.toMatch(/\bshoes\b/i);
    }
    // And never on a view that does not reach the waist.
    for (const angle of ["closeUp", "threeQuarter", "sideClose"] as const) {
      expect(composePackageViewPrompt(angle, null), angle).not.toContain("Below the waist");
    }
  });
});

/**
 * ⚠ **THE LIGHT A SIGNED VIEW IS SHOT UNDER — #1207, and nothing pinned it
 * before.** His report, verbatim: *"the side profile has a harsh flash which
 * doesnt match the master or the closeup."*
 *
 * The flash was ORDERED, not hallucinated: `composePackageViewPrompt` sent
 * `PHOTOREAL_HUMAN_BLOCKS.capture` whole, whose third sentence is *"LIGHTING:
 * Direct on-camera or slightly off-axis front flash … No gels, no diffusion"* —
 * while every master since 2026-09-24 is rendered by the author road, which
 * §5e replaces that sentence in and then lists those very phrases in
 * `DROPPED_FROM_BLOCK`. **The Sign was sending phrases the road that made its
 * own reference forbids**, and no arm anywhere could see it.
 */
describe("a signed view is lit the way its master was lit", () => {
  /* The paragraph the two roads must agree on, isolated rather than searched
     for: the whole prompt also carries realism and negatives, which is a
     different question and is why this reads one block. */
  const captureOf = (prompt: string) =>
    prompt.split("\n").find((line) => line.startsWith("CAMERA:")) ?? "";

  it("carries the founder's own LIGHTING line, and never the flash studio's", () => {
    for (const angle of CAST_PACKAGE_VIEWS) {
      const capture = captureOf(composePackageViewPrompt(angle, null));
      expect(capture, `${angle} has no capture paragraph`).not.toBe("");
      expect(capture, angle).toContain(LIGHTING_LINE);
      expect(capture, angle).not.toContain("front flash");
      expect(capture, angle).not.toContain("No gels, no diffusion");
    }
  });

  it("⚠ sends the SAME capture the author road sends — so the two cannot drift", () => {
    /*
      The invariant, not a coincidence of wording: a view is a photograph of the
      person the house block already made, so the day that block's camera or
      light changes, the package's must move with it. Derived from the author
      road's own constant rather than retyped beside it (working law 4).
    */
    for (const angle of CAST_PACKAGE_VIEWS) {
      expect(captureOf(composePackageViewPrompt(angle, null)), angle)
        .toBe(CAPTURE_SENTENCES.join(" "));
    }
  });

  it("⚠ carries none of the §5e sentences the author road DROPPED", () => {
    /*
      Derived from `DROPPED_FROM_BLOCK`, and deliberately only the §5e CAPTURE
      entries — that list also holds framing, expression and negative drops, and
      a signed view legitimately keeps the cohort's directive and negatives
      ("Arms relaxed at the sides", "NO open mouth"). Taking the whole list
      would be deriving from a set that answers a different question, which is
      a silent behaviour change wearing a refactor's clothes.
    */
    const captureDrops = DROPPED_FROM_BLOCK.filter(
      (entry) => entry.from.includes("§5e") && !entry.from.startsWith("BACKGROUND"),
    );
    expect(captureDrops.length, "the §5e capture drops vanished from the source list")
      .toBeGreaterThanOrEqual(6);
    for (const angle of CAST_PACKAGE_VIEWS) {
      const capture = captureOf(composePackageViewPrompt(angle, null));
      for (const { phrase, from } of captureDrops) {
        expect(capture, `${angle} still carries "${phrase}" (${from})`).not.toContain(phrase);
      }
    }
  });

  it("CONTROL — the reader can see a capture paragraph, and would catch the flash if it came back", () => {
    /*
      Three of the arms above are absences. This is the same reader finding a
      real sentence in the real output, plus the flash reader driven over the
      text it exists to catch — so a mangled phrase or a `captureOf` that
      returns nothing cannot make the absences pass on nothing.
    */
    const capture = captureOf(composePackageViewPrompt("sideClose", null));
    expect(capture).toContain("CAMERA: Medium-format sensor");
    expect(capture.length).toBeGreaterThan(200);
    /* The exact sentence this defect was, taken from the cohort block that
       still holds it, proving the absence arms above are readable claims. */
    const theFlashSentence = PHOTOREAL_HUMAN_BLOCKS.captureSentences
      .find((sentence) => sentence.startsWith("LIGHTING:"));
    expect(theFlashSentence, "the cohort's flash sentence has moved").toContain("front flash");
    expect(`CAMERA: x ${theFlashSentence}`).toContain("front flash");
  });
});

/**
 * ⚠ **A SIGNED VIEW KEEPS HER INK AND HER MAKEUP — #1221, the third instance of
 * the class after the trousers (#1207) and the flash (#1207).**
 *
 * His Sifr2 close-up came back with a bare unmade face and no neck tattoos from
 * a master that has both. The cause is one block over from the flash and the
 * same shape: `composePackageViewPrompt` sent the cohort's realism block whole,
 * whose four stated-X doors defer to *"the character description"* — and a Sign
 * view sends none. **The wire carried "Never invent damage, scars or ink that
 * was not asked for" and "the default is a bare, unmade face" to a render whose
 * whole job was to reproduce a person who has both.**
 *
 * These arms are AT THE WIRE (working law 5): every one composes the real
 * prompt through the real entrance and reads the string that would be sent. The
 * card's own grep was run over `castViewPackage.ts` and found nothing, because
 * the sentences arrive through an import — which is exactly the reading #1207's
 * docblock says a prompt claim must not be made from.
 */
describe("a signed view's realism block reads the reference, not a description", () => {
  const declined = PHOTOREAL_HUMAN_BLOCKS.viewDeclinedSentences;
  const theDocumentRule = PHOTOREAL_HUMAN_BLOCKS.referenceDocumentSentences;

  it("⚠ carries none of the description-bound sentences, on any of the five views", () => {
    /*
      Derived from the drop list itself, never from a copy of its prose: a
      sentence edited in the cohort file moves here on the same commit, and a
      sentence that leaves the drop list stops being checked LOUDLY rather than
      silently (the count arm below).
    */
    expect(declined.length, "the declined list emptied — this arm would pass on nothing")
      .toBe(11);
    for (const angle of CAST_PACKAGE_VIEWS) {
      const prompt = composePackageViewPrompt(angle, null);
      for (const sentence of declined) {
        expect(prompt, `${angle} still carries "${sentence.slice(0, 60)}…"`)
          .not.toContain(sentence);
      }
    }
  });

  it("⚠ CONTROL — the ROLL block carries every one of them, so the absences above are readable claims", () => {
    /*
      The positive control the card asked for, and it is the arm that matters:
      eleven `not.toContain` assertions pass just as happily against a mangled
      sentence, a renamed export or an empty list. This drives the SAME reader
      over the SAME strings in the place they are still supposed to be.
    */
    const roll = photorealHumanConstant(null);
    for (const sentence of declined) {
      expect(roll, `the roll road lost "${sentence.slice(0, 60)}…"`).toContain(sentence);
    }
    expect(roll).toContain("Never invent damage, scars or ink that was not asked for.");
    expect(roll).toContain("the default is a bare, unmade face");
  });

  it("⚠ the two sentences his close-up was actually lost to are gone from the wire", () => {
    /* Named literally as well as derived. The derived arm above proves the
       mechanism; this one proves THIS defect, and survives a refactor that
       reshapes the lists. */
    for (const angle of CAST_PACKAGE_VIEWS) {
      const prompt = composePackageViewPrompt(angle, null);
      expect(prompt, angle).not.toContain("Never invent damage, scars or ink that was not asked for");
      expect(prompt, angle).not.toContain("the default is a bare, unmade face");
      expect(prompt, angle).not.toContain("Makeup is never added to a face");
      expect(prompt, angle).not.toContain("Render only what the description names");
    }
  });

  it("puts the founder's one rule in their place, on every view", () => {
    expect(theDocumentRule.length).toBe(3);
    for (const angle of CAST_PACKAGE_VIEWS) {
      const prompt = composePackageViewPrompt(angle, null);
      for (const sentence of theDocumentRule) {
        expect(prompt, angle).toContain(sentence);
      }
      /* The three things his report named, by name, in the sent string. */
      expect(prompt, angle).toContain("tattoos and ink");
      expect(prompt, angle).toContain("makeup");
      expect(prompt, angle).toContain("Add nothing the reference photograph does not show.");
    }
  });

  it("⚠ keeps EVERY photographic sentence — the subtraction takes the doors and nothing else", () => {
    /*
      The over-subtraction arm, and the reason this is a filter rather than a
      second array. Without it, a view could pass every absence above by
      sending no realism block at all.
    */
    const kept = PHOTOREAL_HUMAN_BLOCKS.realismSentencesAll
      .filter((sentence) => !declined.includes(sentence));
    expect(kept.length, "the kept set collapsed").toBeGreaterThanOrEqual(13);
    for (const angle of CAST_PACKAGE_VIEWS) {
      const prompt = composePackageViewPrompt(angle, null);
      for (const sentence of kept) {
        expect(prompt, `${angle} dropped "${sentence.slice(0, 50)}…"`).toContain(sentence);
      }
    }
    /* Named explicitly because his ruling names them as the keeps. */
    const one = composePackageViewPrompt("closeUp", null);
    for (const headline of ["REALISM:", "EYES:", "CATCHLIGHTS:", "SCLERA:", "PUPILS:", "LASHES:", "LIPS:", "BROWS:"]) {
      expect(one, `the close-up lost ${headline}`).toContain(headline);
    }
  });

  it("⚠ every declined sentence is one the ROLL array actually holds — no stale entry", () => {
    /*
      A drop list can rot in the other direction: a sentence rewritten in the
      roll array leaves a declined entry matching nothing, and every absence arm
      above keeps passing while the real sentence sails through. This is the
      reading that catches it, and it is why the two lists share constants
      rather than prose.
    */
    for (const sentence of declined) {
      expect(
        PHOTOREAL_HUMAN_BLOCKS.realismSentencesAll,
        `"${sentence.slice(0, 50)}…" is declined but is no longer in the roll block`,
      ).toContain(sentence);
    }
  });
});

/**
 * ⚠ **THE ROLL ROAD DOES NOT MOVE — the condition on his ruling, pinned by
 * hash rather than by trust (#1221).**
 *
 * His words: *"The roll's own block is untouched here — on the author road the
 * brief IS the description and those clauses still have a referent."* The
 * repair splits one sentence in two and replaces four literal groups with named
 * constants; every one of those is a chance to move a byte in a prompt that
 * eight paid candidates a roll are rendered from.
 *
 * The hashes are the block as it stood at `26017bc4`, read before the edit.
 */
describe("the roll road's realism block is byte-identical", () => {
  const sha = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

  it("realism block — 5095 chars, unchanged", () => {
    expect(PHOTOREAL_HUMAN_BLOCKS.realism.length).toBe(5095);
    expect(sha(PHOTOREAL_HUMAN_BLOCKS.realism))
      .toBe("4a5462c9e6f4ce782d0f102357e30f556d0931eb7d0ddc8927780c6eec0d7bfe");
  });

  it("the whole cohort constant — 11291 chars, unchanged", () => {
    expect(photorealHumanConstant(null).length).toBe(11291);
    expect(sha(photorealHumanConstant(null)))
      .toBe("da30b47c962e3acaeea1ec69c6cf27d044cbc720db6e870aa9207c85bc235f0a");
  });

  it("CONTROL — the hash reader can tell two blocks apart", () => {
    /* Without this, a `sha` that returned a constant would pass both arms
       above forever. */
    expect(sha(PHOTOREAL_HUMAN_BLOCKS.realism)).not.toBe(sha(referenceRealism()));
    expect(referenceRealism().length).toBeLessThan(PHOTOREAL_HUMAN_BLOCKS.realism.length);
  });
});

/**
 * ⚠ **THE CLOSE-UP'S WARDROBE SENTENCE STOPPED BANNING HER OWN JEWELLERY
 * (#1221).**
 *
 * It read *"No earrings, no glasses, no piercings, no hat, no headphones, no
 * visible logo or text"* and only THEN *"nothing worn that the reference
 * photograph does not show"* — two rules with the absolute one first. His
 * ruling: the closing clause is the one that is right, *"never as a list"*.
 * This sentence is the JUDGE's spec as well as the generator's, so under the
 * old wording a customer whose master wears a nose stud could be refunded for
 * her own face.
 */
describe("the close-up's addition check is relative to the reference", () => {
  it("bans nothing absolutely", () => {
    const { wardrobe } = packageViewExpectation("closeUp", null);
    for (const ban of ["No earrings", "no glasses", "no piercings", "no headphones"]) {
      expect(wardrobe, `the close-up still bans outright: "${ban}"`).not.toContain(ban);
    }
  });

  it("still fails an ADDITION, and says the reference's own are hers", () => {
    /* The craft half is kept: this crop genuinely can check addition, and an
       axis that can fail for a real reason is the whole point of the sentence
       (its own docblock). Both directions are asserted — a sentence that only
       said "hers" would have deleted the check. */
    const { wardrobe } = packageViewExpectation("closeUp", null);
    expect(wardrobe).toContain("absent from the reference is ");
    expect(wardrobe).toContain("a failure wherever it appears");
    expect(wardrobe).toContain("the reference DOES show is this person's own and must be there");
    expect(wardrobe).toContain("if no clothing is in frame, this passes");
  });

  it("⚠ the judge and the generator still read ONE answer", () => {
    /* The boundary `packageViewExpectation`'s own docblock exists to keep: a
       spec composed twice is how a judge comes to fail a view for wearing what
       the prompt asked for. */
    expect(composePackageViewPrompt("closeUp", null))
      .toContain(packageViewExpectation("closeUp", null).wardrobe);
  });
});
