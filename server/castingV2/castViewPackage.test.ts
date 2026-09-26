import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { CANONICAL_VIEW_ANGLES, CAST_VIEW_ANGLES } from "../../shared/boardTypes";
import { CASTING_V2_SIGN_COSTS } from "../casting/castingCreditCosts";
import {
  PHOTOREAL_HUMAN_BLOCKS,
  photorealHumanConstant,
} from "./cohortPhotorealHuman";
import {
  AUTHORITY_LINE,
  CAPTURE_SENTENCES,
  DROPPED_FROM_BLOCK,
  EXPRESSION_LINE,
  HOUSE_BLOCK,
  HOUSE_PHOTOGRAPH_PARAGRAPHS,
  LIGHTING_LINE,
  NEGATIVE_LINES,
} from "./houseBlock";
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
    //
    // Keyed on the ROLL's own authority line since #1240 rather than on the
    // retired cohort's closing words: this arm used to assert the literal
    // "it always wins.", which is a sentence the view no longer sends. Derived,
    // it keeps holding the property (the guarantee is last) through the next
    // rewording as well.
    expect(prompt.trimEnd().endsWith(AUTHORITY_LINE)).toBe(true);
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

  it("⚠ still carries a WHOLE realism paragraph — the over-subtraction arm, re-pointed (#1240)", () => {
    /*
      Without an arm of this shape a view passes every absence above by sending
      no realism at all. Its SUBJECT moved with the block: the view is no longer
      the legacy realism minus its doors, it is the ROLL's own three sentences,
      so those are what must all be there.
    */
    const roll = PHOTOREAL_HUMAN_BLOCKS.realismSentences;
    expect(roll.length, "the roll's realism collapsed — this arm would pass on nothing").toBe(3);
    for (const angle of CAST_PACKAGE_VIEWS) {
      const prompt = composePackageViewPrompt(angle, null);
      for (const sentence of roll) {
        expect(prompt, `${angle} dropped "${sentence.slice(0, 50)}…"`).toContain(sentence);
      }
      expect(prompt, angle).toContain("REALISM:");
    }
  });

  it("⚠ the legacy CRAFT sentences left too — and the view is no poorer than a roll, which is the whole claim", () => {
    /*
      THE ONE DEPARTURE THAT IS A QUESTION RATHER THAN AN ANSWER, pinned here so
      a later seat reads a decision and not a hole.

      The eye, lash, lip, brow and vellus craft leaves the view with the legacy
      block. That is only defensible because the ROLL does not carry it either —
      which is what the third loop below actually measures, rather than asserting
      it in a comment. A close-up is exactly where it would show, so the card's
      court puts both blocks in front of his eye (law 9); if it comes back as a
      VIEW-ONLY addendum, THIS is the arm that changes, and the doors must not
      ride back in with it.
    */
    const craft = PHOTOREAL_HUMAN_BLOCKS.realismSentencesAll
      .filter((sentence) => !PHOTOREAL_HUMAN_BLOCKS.realismSentences.includes(sentence))
      .filter((sentence) => !declined.includes(sentence));
    expect(craft.length, "the craft set collapsed — this arm would pass on nothing")
      .toBeGreaterThanOrEqual(10);

    for (const angle of CAST_PACKAGE_VIEWS) {
      const prompt = composePackageViewPrompt(angle, null);
      for (const sentence of craft) {
        expect(prompt, `${angle} still carries craft "${sentence.slice(0, 50)}…"`)
          .not.toContain(sentence);
      }
    }
    /* CONTROL — every one is still real prose where it lives, so the absences are readable claims. */
    const cohort = photorealHumanConstant(null);
    for (const sentence of craft) {
      expect(cohort, `the cohort lost craft "${sentence.slice(0, 50)}…"`).toContain(sentence);
    }
    /* THE EQUALITY THIS CARD CLAIMS: the roll road does not send them either. */
    for (const sentence of craft) {
      expect(HOUSE_BLOCK, `the roll block carries craft "${sentence.slice(0, 50)}…"`)
        .not.toContain(sentence);
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
 * ⚠ **ONE BLOCK, TWO ROADS — founder ruling, 2026-09-26 (#1240).**
 *
 * His question, verbatim: *"why cant the realism block be the same as when
 * casting a sheet?"* — and his *"yes"* to the shape. A signed view now sends
 * its own lines and then EXACTLY the roll's own house paragraphs, taken from
 * the same constants rather than copied.
 *
 * **The drift arm is the one that matters here**, and it is #1215's shape: the
 * view's block is asserted EQUAL to the house block's own paragraphs, derived,
 * so the two cannot be edited apart. Every defect this road has had — #1207's
 * trousers, #1207's flash, #1221's ink — was one sentence drifting between two
 * copies of one rule, and an arm that re-typed those sentences here would be
 * the same mistake wearing a guard's clothes.
 */
describe("a signed view is photographed under the roll's own house block", () => {
  const paragraphs = HOUSE_PHOTOGRAPH_PARAGRAPHS;

  it("⚠ sends the house block's own paragraphs, in its order, on every view — the drift arm", () => {
    expect(paragraphs.length, "the shared paragraphs collapsed — this arm would pass on nothing")
      .toBe(5);
    for (const angle of CAST_PACKAGE_VIEWS) {
      const lines = composePackageViewPrompt(angle, null).split("\n");
      /* The tail of the prompt IS the block, paragraph for paragraph. */
      expect(lines.slice(-paragraphs.length), angle).toEqual([...paragraphs]);
    }
  });

  it("⚠ CONTROL — those paragraphs really are the ROLL's, sentence by sentence", () => {
    /*
      The equality above is only worth anything if the constant it reads is the
      one a roll is rendered from. A shared constant nothing rolls with would
      satisfy every arm here and still be a second copy.
    */
    for (const sentence of [...CAPTURE_SENTENCES, ...NEGATIVE_LINES, AUTHORITY_LINE]) {
      expect(HOUSE_BLOCK, `the roll block lost "${sentence.slice(0, 50)}…"`).toContain(sentence);
    }
    for (const paragraph of paragraphs) {
      expect(HOUSE_BLOCK, `the roll block lost a whole paragraph: "${paragraph.slice(0, 50)}…"`)
        .toContain(paragraph);
    }
  });

  it("⚠ does NOT take the block's FRAMING paragraph — the one thing a view supplies itself", () => {
    /*
      The reason `HOUSE_PHOTOGRAPH_PARAGRAPHS` exists at all rather than the
      view reading `HOUSE_BLOCK`. Each view carries its own angle directive, and
      the roll's crop and posture sentences would fight it — a close-up told to
      frame mid-torso is the defect this prevents.
    */
    for (const angle of CAST_PACKAGE_VIEWS) {
      const prompt = composePackageViewPrompt(angle, null);
      expect(prompt, angle).not.toContain("CROP: The subject's ENTIRE HAIR SILHOUETTE");
      expect(prompt, angle).not.toContain("BACKGROUND:");
    }
    /* CONTROL — a roll DOES carry them, so the absences above are readable. */
    expect(HOUSE_BLOCK).toContain("CROP: The subject's ENTIRE HAIR SILHOUETTE");
    expect(HOUSE_BLOCK).toContain("BACKGROUND:");
  });

  it("⚠ the legacy cohort's three blocks left the view road entirely", () => {
    /*
      Read as whole blocks rather than as sampled sentences: the card's subject
      is that these PARAGRAPHS are gone, and a sentence-level arm would pass on
      a block that kept nine of its fourteen.
    */
    const legacy: ReadonlyArray<readonly [string, string]> = [
      ["identityIntegrity", PHOTOREAL_HUMAN_BLOCKS.identityIntegrity],
      ["negatives", PHOTOREAL_HUMAN_BLOCKS.negatives],
      ["authority", PHOTOREAL_HUMAN_BLOCKS.authority],
    ];
    for (const angle of CAST_PACKAGE_VIEWS) {
      const prompt = composePackageViewPrompt(angle, null);
      for (const [name, paragraph] of legacy) {
        expect(prompt, `${angle} still carries the cohort's ${name}`).not.toContain(paragraph);
      }
    }
    /* CONTROL — all three are still real prose in the cohort constant, where the roll's own history keeps them. */
    const cohort = photorealHumanConstant(null);
    for (const [name, paragraph] of legacy) {
      expect(cohort, `the cohort lost its ${name} — the absences above stop being claims`)
        .toContain(paragraph);
    }
  });

  it("⚠ the sharpest sentence of the six is gone: a view no longer derives her colouring from a heritage", () => {
    /*
      Named literally as well as derived, because this is the one the card leads
      on. On a view the condition "when the description does not state them" is
      ALWAYS true, so it fired every time and told the engine to work her eye
      and hair colour out from a heritage instead of copying the reference.
    */
    for (const angle of CAST_PACKAGE_VIEWS) {
      const prompt = composePackageViewPrompt(angle, null);
      expect(prompt, angle).not.toContain("When the description does not state them");
      expect(prompt, angle).not.toContain("HERITAGE IS BONE");
      expect(prompt, angle).not.toContain("follow plausibly from their heritage and age");
      /* And the authority paragraph no longer overrides a description that is not there. */
      expect(prompt, angle).not.toContain("override the character description entirely");
      expect(prompt, angle).not.toContain("ignore that implication");
    }
  });

  it("⚠ LETTERS ARE UNBANNED on a view — his ruling — and the marks a studio frame bans are kept", () => {
    /*
      His words, 2026-09-26: *"what do other big SaaS operators do? do they ban
      these? if not unban it"* — they do not; the big generators sell text
      rendering and ban brand marks. A script or lettering tattoo is text on her
      skin, and the old line forbade it on every view.

      The two halves are asserted TOGETHER on purpose: an unban that also lost
      the logo and watermark bans would pass a one-sided arm and be a different,
      worse change.
    */
    for (const angle of CAST_PACKAGE_VIEWS) {
      const prompt = composePackageViewPrompt(angle, null);
      expect(prompt, `${angle} still bans letters`)
        .not.toContain("NO text, letters, numbers, words, logos, captions, labels, watermarks or signage");
      expect(prompt, angle).toContain("NO logos, watermarks, captions or signage anywhere in the frame.");
      expect(prompt, angle).toContain("NO props, furniture, environment, location or scene");
    }
    /* CONTROL — the banned form is real prose the cohort still holds, and the author road dropped it by name. */
    expect(photorealHumanConstant(null))
      .toContain("NO text, letters, numbers, words, logos, captions, labels, watermarks or signage");
    expect(DROPPED_FROM_BLOCK.map((entry) => entry.phrase)).toContain("letters, numbers");
  });

  it("⚠ NO expression rule rides on a view, and that is a DECISION rather than an oversight", () => {
    /*
      STATED OUT LOUD (fidelity law), because it is the one thing this shape
      costs. The roll carries expression in its FRAMING paragraph
      (`EXPRESSION_LINE`), which a view replaces with its own angle directive —
      and four of the five directives name neither a mouth nor a gaze.

      Defensible on this card's own principle: a view has a reference photograph
      showing the expression where a roll has only words. The alternative —
      re-typing a gaze-free expression sentence — was DECLINED, because
      `EXPRESSION_LINE` opens with "Eyes into the lens" and a back view cannot
      obey it, and an authored sentence is exactly what his ruling takes off
      this road. It is a named question for the court's frames.

      This arm exists so the absence is a RECORD. A shift that puts an
      expression rule back reddens it and has to come here and read why.
    */
    expect(EXPRESSION_LINE, "the roll's expression line moved — re-read this decision")
      .toContain("Eyes into the lens");
    expect(HOUSE_BLOCK, "CONTROL — the roll does carry it").toContain(EXPRESSION_LINE);
    for (const angle of CAST_PACKAGE_VIEWS) {
      const prompt = composePackageViewPrompt(angle, null);
      expect(prompt, angle).not.toContain(EXPRESSION_LINE);
      expect(prompt, `${angle} grew an expression negative — say why, here`)
        .not.toContain("NO open mouth, no showing teeth");
    }
  });

  it("keeps the view's own lines, above the block and in order", () => {
    /*
      The other half of the drift arm: the shared block must not swallow the
      lines that are the VIEW's, nor reorder them. Pinned by text, because these
      are the view's own prose and have no constant to derive from.
    */
    for (const angle of CAST_PACKAGE_VIEWS) {
      const prompt = composePackageViewPrompt(angle, null);
      const identity = prompt.indexOf("Keep this exact person unchanged:");
      const document = prompt.indexOf("THE REFERENCE PHOTOGRAPH IS THE DESCRIPTION:");
      const wardrobe = prompt.indexOf("WARDROBE:");
      const block = prompt.indexOf(paragraphs[0]);
      expect(identity, angle).toBe(0);
      expect(document, angle).toBeGreaterThan(identity);
      expect(wardrobe, angle).toBeGreaterThan(document);
      expect(block, `${angle} put the house block above the view's own lines`)
        .toBeGreaterThan(wardrobe);
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
       above forever. It read the retired `referenceRealism()` until #1240; the
       view's own composed prompt is the same control and is a live road. */
    const view = composePackageViewPrompt("closeUp", null);
    expect(sha(PHOTOREAL_HUMAN_BLOCKS.realism)).not.toBe(sha(view));
    expect(sha(view)).not.toBe(sha(photorealHumanConstant(null)));
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


/**
 * #1278 PART 1 — THE VIEW IS DRESSED BY THE BRIEF, NOT BY A PROHIBITION LIST.
 *
 * His eye, 2026-09-26, verbatim: *"The dress is a plain modest version of what
 * the brief describes, and the hem and shoes differ every take."*
 *
 * ⚠ **THE CARD'S DIAGNOSIS WAS RIGHT AND TWO OF ITS FACTS WERE NOT** — both read
 * at the rows and at the composed prompt, and both pinned here because a
 * successor reading the card alone would rebuild the wrong thing:
 *
 *  1. **It blamed `castPackageWardrobeSpec(line)`.** That road has never run in
 *     production: 0 of 6 minted casts carry `technicalSchema.wardrobe.line`, all
 *     time, INCLUDING the two signed the day before he reported this. Every view
 *     ever sent carried `CAST_PACKAGE_WARDROBE_SPEC`, so that is the sentence
 *     this card had to change.
 *  2. **It named `models.masterPrompt` as the words to send.** That column is the
 *     whole COMPILED roll prompt — FRAMING ("waist-up"), CAMERA, REALISM, a
 *     NEGATIVE line banning the letters he unbanned on views, and an AUTHORITY
 *     paragraph claiming precedence over the description. Sending it into a
 *     full-length view orders two framings in one prompt, which is the trousers
 *     class this file already documents. The customer's own words are
 *     `casting_rolls.briefText`, which carries none of it.
 *
 * **What actually produced his plain dress: four sentences, all ours.** The view
 * said "there is no written description of this person, and none is needed",
 * then "Add nothing the reference photograph does not show … no damage", then
 * that the reference is chest-up so nothing below the waist can be compared —
 * and since #1240 brought the roll's `AUTHORITY_LINE` over, "Where the
 * description is silent, this block governs: plain studio frame." **The
 * description was silent because we never sent one, so that paragraph's only
 * live branch was the one that orders plain.** The engine obeyed us.
 */
describe("#1278 part 1 — a signed view is dressed by the cast's own brief", () => {
  /* Her real brief: cast #55 "Sifr", roll 300, user 1, production. */
  const SIFR = "A pale, slightly androgynous cyberpunk woman with short, messy silver-grey hair and "
    + "heavy black makeup that can read as either elegant or damaged depending on the artist. She wears "
    + "a white, body-conscious dress that mixes qipao structure with industrial straps, buckles, and a "
    + "worn graphic on the chest, leaving the exact cut, hardware, and weathering open. Dense tattoos "
    + "cover one arm and parts of her body, but their style, density, and placement can shift. The "
    + "overall presence should feel cold, stylish, and quietly intense — a street-level futurist that "
    + "different versions can interpret without losing the same core look.";

  it("⚠ a cast with NO brief on record composes exactly what it composed before", () => {
    /*
      The safety property of the whole change, and it covers most casts: 4 of 6
      minted casts have no source roll at all. Asserted as the three legacy
      sentences taken from the cohort constant BY NAME — re-typing them here would
      be a copy that stops being true the day somebody edits a comma, which is the
      drift this file has already been bitten by.
    */
    for (const angle of CAST_VIEW_ANGLES) {
      const undescribed = composePackageViewPrompt(angle, null, null);
      for (const sentence of PHOTOREAL_HUMAN_BLOCKS.referenceDocumentSentences) {
        expect(undescribed, `${angle} must still carry the undescribed rule`).toContain(sentence);
      }
      expect(undescribed, `${angle} carries no DESCRIPTION label`).not.toMatch(/^DESCRIPTION: /m);
    }
  });

  it("an absent, empty or whitespace brief is the same fact as no brief", () => {
    /* One door (`viewDescriptionOf`) so the roads cannot disagree about what "no
       description" means, and so a blank brief never emits a bare label. */
    for (const angle of CAST_VIEW_ANGLES) {
      const none = composePackageViewPrompt(angle, null, null);
      expect(composePackageViewPrompt(angle), `${angle}: omitted`).toBe(none);
      expect(composePackageViewPrompt(angle, null, ""), `${angle}: empty`).toBe(none);
      expect(composePackageViewPrompt(angle, null, "   \n  "), `${angle}: whitespace`).toBe(none);
    }
  });

  it("⚠ with a brief on record, the prompt STOPS denying that a description exists", () => {
    /*
      The contradiction arm. Adding a description while the opener still says
      "there is no written description of this person" would be a prompt that
      denies its own next line — the trousers class, which an image model resolves
      by picking one silently, per view. So that sentence has to LEAVE.
    */
    for (const angle of CAST_VIEW_ANGLES) {
      const described = composePackageViewPrompt(angle, null, SIFR);
      expect(described, angle).not.toContain("there is no written description of this person");
      expect(described, angle).not.toContain("This is not a licence to invent — no damage");
      expect(described, angle).toMatch(/^DESCRIPTION: A pale, slightly androgynous/m);
    }
  });

  it("⚠ the DESCRIPTION arrives before the AUTHORITY paragraph that grants it authority", () => {
    /*
      Position is the point, not tidiness. `AUTHORITY_LINE` says "the description
      says WHO to cast … anything the description states outright is a fact and
      overrides any default or negative here" — a paragraph that has been resolving
      to nothing on this road since #1240. The label must precede it, and the
      identity sentence must precede the label, so the reference's primacy is
      established before her brief is read.
    */
    for (const angle of CAST_VIEW_ANGLES) {
      const described = composePackageViewPrompt(angle, null, SIFR);
      const identity = described.indexOf("Keep this exact person unchanged");
      const label = described.indexOf("\nDESCRIPTION: ");
      const authority = described.indexOf("AUTHORITY:");
      expect(identity, `${angle}: identity sentence present`).toBeGreaterThanOrEqual(0);
      expect(label, `${angle}: description after identity`).toBeGreaterThan(identity);
      expect(authority, `${angle}: authority after description`).toBeGreaterThan(label);
    }
  });

  it("⚠ the reference still wins on everything it shows — a roll brief licenses variation", () => {
    /*
      The one authored sentence in this change, and why it is not optional: a brief
      is written for a ROLL, where variation is wanted, and hers says the hair "can
      lean black or dusty teal", the ink "can shift", "different versions can
      interpret". On a VIEW the person is already settled by the reference, so those
      alternatives must be closed explicitly — otherwise dressing the view from the
      brief would invite drift on the one road whose contract is the same individual.
    */
    for (const angle of CAST_VIEW_ANGLES) {
      const described = composePackageViewPrompt(angle, null, SIFR);
      expect(described, angle).toContain("the reference wins");
      expect(described, angle).toContain("is already settled here and is not reopened");
    }
  });

  it("⚠ an ADDITION now needs BOTH records silent — her own chest graphic stops being a failure", () => {
    /*
      The worked example is his own cast. Today's sentence fails "any printed text
      or logo that the reference does not show" — and her brief asks for "a worn
      graphic on the chest", which a chest-up reference may not resolve. The product
      was calling her outfit an addition and refusing the slice.
    */
    for (const angle of CAST_VIEW_ANGLES) {
      const undescribed = packageViewExpectation(angle, null, null).wardrobe;
      const described = packageViewExpectation(angle, null, SIFR).wardrobe;
      if (undescribed === described) continue; /* the close-up keeps its own sentence */
      expect(described, angle).toContain("does not show AND the description does not name");
      expect(described, angle).toContain("a failure wherever they appear");
    }
  });

  it("⚠ the judge narrows WITH the generator and never apart from it", () => {
    /*
      The boundary this file already guards, arriving through a new door. A judge
      reading the unnarrowed sentence while the generator reads the narrowed one
      would refuse the view for wearing exactly what the prompt asked for — and a
      refused slice is a refunded slice.
    */
    for (const angle of CAST_VIEW_ANGLES) {
      const prompt = composePackageViewPrompt(angle, null, SIFR);
      expect(prompt, angle).toContain(packageViewExpectation(angle, null, SIFR).wardrobe);
    }
  });

  it("the close-up keeps its OWN wardrobe sentence on both roads", () => {
    /* At that crop the garment is barely in frame, which is why it has its own
       sentence at all. Only the shared sentence has a described form. */
    expect(packageViewExpectation("closeUp", null, SIFR).wardrobe)
      .toBe(packageViewExpectation("closeUp", null, null).wardrobe);
  });

  it("the three full-length views stop being asked an open question about the hem", () => {
    /* His second fault. The undescribed clause asks for "whatever its lower half
       and footwear WOULD BE", which nothing constrains; with the brief on record
       her own words answer it. What this does NOT do is make the three views agree
       with EACH OTHER — that is part 2's one-sheet-then-cut shape. */
    for (const angle of CAST_VIEW_ANGLES) {
      const undescribed = composePackageViewPrompt(angle, null, null);
      const described = composePackageViewPrompt(angle, null, SIFR);
      if (!undescribed.includes("whatever its lower half and footwear would be")) {
        expect(described, `${angle} has no below-waist clause`).not.toContain("Below the waist,");
        continue;
      }
      expect(described, angle).not.toContain("whatever its lower half and footwear would be");
      expect(described, angle).toContain("footwear the DESCRIPTION names");
    }
  });

  it("⚠ NEGATIVE CONTROL — the view does not receive the roll's photograph direction", () => {
    /*
      The arm that refuses the card's literal instruction. `masterPrompt` and the
      author's `register.prompt` both carry the house block inline, and pasting
      either here would order a second framing, re-ban the letters his 2026-09-25
      ruling unbanned on views, and duplicate what #1240 unified. The description is
      the CHARACTER half only.
    */
    for (const angle of CAST_VIEW_ANGLES) {
      const described = composePackageViewPrompt(angle, null, SIFR);
      /*
        FRAMING is the one house paragraph a view does not take — it replaces it
        with its own angle directive — so the roll's framing sentences arriving here
        could only mean a composed prompt had been pasted in. Taken from the
        constant rather than typed, so the arm cannot drift from the block.
      */
      for (const sentence of PHOTOREAL_HUMAN_BLOCKS.framingSentences) {
        expect(described, `${angle} must not carry the roll's framing`).not.toContain(sentence);
      }
      /* Same for the gaze: a back view cannot obey "Eyes into the lens" (#1240). */
      expect(described, `${angle} must not carry the roll's expression order`)
        .not.toContain(EXPRESSION_LINE);
      /* And the house-road compiler's own opener, which `masterPrompt` carries. */
      expect(described, angle).not.toContain("CASTING CATEGORY (ABSOLUTE)");
      /*
        ⚠ THE ARM THAT WOULD ACTUALLY CATCH A PASTE. The shared capture and realism
        sentences are SUPPOSED to be here — #1240 gives both roads the same ones —
        so banning them would be wrong, and an earlier draft of this arm did exactly
        that and failed. What a pasted `masterPrompt` or `register.prompt` produces
        is a SECOND copy of them. Count, do not ban.
      */
      for (const sentence of [...CAPTURE_SENTENCES, ...NEGATIVE_LINES, AUTHORITY_LINE]) {
        expect(described.split(sentence).length - 1, `${angle}: "${sentence.slice(0, 40)}…" exactly once`)
          .toBe(1);
      }
    }
  });
});
