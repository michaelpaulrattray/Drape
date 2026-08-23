/**
 * THE REFUSAL REGISTRY (fable-486 §f), and what it is holding together.
 *
 * A refusal's sentence, its charge behaviour and its report class used to live
 * in three unrelated places, so a new one could ship saying something kind and
 * answering nothing about what it cost her. The registry makes all three
 * unavoidable; these arms make them true.
 *
 * The copy itself is PINNED, verbatim, because folding a `switch` into a table
 * is exactly the kind of change that rewrites a sentence a customer reads while
 * calling itself a refactor.
 */
import { describe, expect, it } from "vitest";

import {
  REFINE_REFUSALS,
  REFUSAL_REASONS,
} from "./refineRefusals";
import { refusalMessage } from "./refineInterpreter";
import { pronounsForSex } from "./castPronouns";
import type { RefineRefusal } from "./refineDelta";

const said = (refusal: RefineRefusal) => refusalMessage({ ok: false, refusal } as never);
/** The same sentence about a Cast whose pronouns we actually know. */
const saidOf = (refusal: RefineRefusal, sex: string | null) =>
  refusalMessage({ ok: false, refusal } as never, pronounsForSex(sex));

describe("every refusal answers all three questions", () => {
  it("covers every reason the type allows, with nothing extra", () => {
    /*
      `satisfies Record<RefineRefusal["reason"], …>` is the compile half; this
      is the runtime half, and it is what a report can count.

      ⚠ THE LITERAL IS GONE (2026-08-21). It read `toBe(9)`, and a hand-typed
      count is a fixture pin rather than a contract: adding a tenth reason —
      `gate_ink_uncarried`, the words-road court's own answer — reddened this
      arm for having done the thing correctly, and the only available repair was
      to retype the number. What the test is FOR is that the registry and the
      type agree, so it asserts THAT instead, and it cannot be satisfied by
      editing a digit.
    */
    expect(REFUSAL_REASONS.length).toBe(Object.keys(REFINE_REFUSALS).length);
    expect(REFUSAL_REASONS.length, "the registry emptied itself").toBeGreaterThan(0);
    expect(new Set(REFUSAL_REASONS).size, "a reason is listed twice")
      .toBe(REFUSAL_REASONS.length);
    for (const reason of REFUSAL_REASONS) {
      const entry = REFINE_REFUSALS[reason];
      expect(typeof entry.say, reason).toBe("function");
      expect(["free", "charged"], reason).toContain(entry.charge);
      expect(["wall", "gate", "absorbed", "unread"], reason).toContain(entry.report);
    }
  });

  it("costs her NOTHING, every one of them — and says so where it matters", () => {
    /*
      Every refusal in this family is free today. The field exists so the day
      one is not, saying so is unavoidable; the sentences are checked against it
      rather than trusted, because "Nothing was charged" is a promise about
      money and the only thing worse than not making it is making it falsely.
    */
    for (const reason of REFUSAL_REASONS) {
      expect(REFINE_REFUSALS[reason].charge, reason).toBe("free");
    }
    /* The two that deliberately do NOT say it are the two that never reached a
       charge in the first place: an empty box and an unreadable sentence are
       answered before anything is claimed. */
    const silent = new Set(["empty"]);
    for (const reason of REFUSAL_REASONS) {
      const sentence = said({ reason, asked: "her glasses" } as RefineRefusal);
      if (silent.has(reason)) continue;
      expect(sentence.toLowerCase(), reason).toContain("nothing was charged");
    }
  });

  /*
    ⚠ ITEM 7a — THREE SENTENCES WHERE THERE WAS ONE (fable-1368 ruling 1).

    The gate's reasons only COINCIDED while the product had a single outfit.
    Each arm below is one of the three, and what is asserted is that each says
    the thing that is TRUE for its own case and does not say the others'.
  */
  describe("the ink gate's three reasons say three different things", () => {
    const alternatives = ["neck", "upper arm"];

    it("a covering says her top covers it — and offers the surfaces that work", () => {
      const sentence = saidOf(
        { reason: "gate_ink_uncarried", place: "upper chest", surface: "upperChest", alternatives } as RefineRefusal,
        "female",
      );
      expect(sentence).toContain("top covers her upper chest");
      expect(sentence).toContain("her neck or an upper arm");
      expect(sentence).toContain("change what she is wearing");
    });

    it("⚠ a BARE surface the road cannot keep NEVER claims a garment", () => {
      /*
        The false-sentence this split exists to prevent: said to somebody
        looking at a shirtless render, "your top covers your chest" is untrue
        about the picture in front of her.
      */
      const sentence = saidOf(
        { reason: "gate_ink_unkeepable", place: "upper chest", alternatives } as RefineRefusal,
        "male",
      );
      expect(sentence).not.toContain("covers");
      expect(sentence).toContain("lost on the next edit");
      expect(sentence).toContain("his neck or an upper arm");
    });

    it("⚠ an UNREAD outfit names OUR gap, never a covering", () => {
      /* Fails closed exactly like a covering and must never be reported as one:
         a fail-closed gate that lies about why it closed is how somebody learns
         to distrust every refusal this product writes. */
      const sentence = saidOf(
        { reason: "gate_ink_coverage_unread", place: "neck", surface: "neck", alternatives: [] } as RefineRefusal,
        "female",
      );
      expect(sentence).toContain("can't tell yet");
      expect(sentence).not.toContain("covers");
      /* And with nothing to offer it says so rather than inventing a door —
         D-180's dead-end-offer class. */
      expect(sentence).toContain("nowhere else");
    });

    it("⚠ CONTROL — the surfaces offered are the REFUSAL'S, not the sentence's", () => {
      /*
        The frozen-promise defect the census caught one file over
        (`inkNeedsDocumentMessage`, finding 4(c)) and did not catch here: this
        sentence read "I can put it on her neck or an upper arm now" as a
        constant, so on a roll-neck cast it would have named two surfaces under
        a jumper. Hand it a different list and the sentence must move.
      */
      const sentence = saidOf(
        { reason: "gate_ink_uncarried", place: "upper chest", surface: "upperChest", alternatives: ["upper arm"] } as RefineRefusal,
        "female",
      );
      expect(sentence).toContain("her upper arm");
      expect(sentence).not.toContain("neck");
    });
  });

  it("classes them for the report without inventing a fourth family", () => {
    expect(REFINE_REFUSALS.wall_stage.report).toBe("wall");
    expect(REFINE_REFUSALS.gate_ink_document.report).toBe("gate");
    expect(REFINE_REFUSALS.absorbed_departure.report).toBe("absorbed");
    expect(REFINE_REFUSALS.unreadable.report).toBe("unread");
  });
});

describe("the copy, pinned verbatim through the fold", () => {
  it("says the same sentences it said as a switch", () => {
    expect(said({ reason: "wall_likeness" })).toBe(
      "Refining can't make someone look like a specific real person. Nothing was charged.");
    expect(said({ reason: "wall_content" })).toBe("That one can't be rendered. Nothing was charged.");
    expect(said({ reason: "empty" })).toBe(
      "Say what you'd like changed — anything about the person themselves.");
    /*
      ⚠ THE TWO SENTENCES THAT NAME A PERSON ARE NO LONGER PINNED TO "she", and
      the old pin is why (fable-1244 §1a).

      They said "She already has …" hard-coded, and the founder read that about
      his own MALE cast — *"She already has jacked build"* — while trying to
      rescue the build a carry break had lost. This test pinned the defect
      verbatim and would have gone red for the FIX rather than for a regression,
      which is the shape a pin takes when the thing it froze was wrong.

      So the pin moves to what is actually invariant: the SENTENCE, per Cast,
      with its own verb agreement.
    */
    expect(saidOf({ reason: "absorbed", asked: "freckles" }, "female")).toBe(
      "She already has freckles — this would have changed nothing, so nothing was charged. "
      + "Ask for more of it, or say it another way.");
    expect(saidOf({ reason: "absorbed", asked: "jacked build" }, "male")).toBe(
      "He already has jacked build — this would have changed nothing, so nothing was charged. "
      + "Ask for more of it, or say it another way.");
    /* `they HAVE`, not `they has` — the agreement rides on `plural` rather than
       on three call sites remembering it. */
    expect(saidOf({ reason: "absorbed", asked: "freckles" }, null)).toBe(
      "They already have freckles — this would have changed nothing, so nothing was charged. "
      + "Ask for more of it, or say it another way.");
    expect(saidOf({ reason: "absorbed_departure", asked: "Her glasses" }, "female")).toBe(
      "Her glasses — that's already off her, so this would have changed nothing and nothing "
      + "was charged. Say what you'd like instead and I'll put it on.");
    expect(saidOf({ reason: "absorbed_departure", asked: "His glasses" }, "male")).toBe(
      "His glasses — that's already off him, so this would have changed nothing and nothing "
      + "was charged. Say what you'd like instead and I'll put it on.");
  });

  /*
    AND THE DEFAULT IS `they`, WHICH IS THE HALF THAT KEEPS THIS FIXED.

    `refusalMessage` has three call sites and only one of them had an identity
    in hand when this landed. A `she` default would have left the founder's own
    defect reachable through either of the other two, and reachable SILENTLY —
    the whole failure mode being that nobody reads a refusal sentence until a
    customer does. `they` is correct English for a person whose pronouns are
    unknown and it cannot misgender anybody.
  */
  it("defaults to THEY, never to she, when no Cast is in hand", () => {
    expect(said({ reason: "absorbed", asked: "freckles" }))
      .toBe(saidOf({ reason: "absorbed", asked: "freckles" }, null));
    expect(said({ reason: "absorbed", asked: "freckles" })).not.toContain("She already");
    expect(said({ reason: "absorbed_departure", asked: "Her glasses" })).not.toContain("off her");
  });

  it("keeps the stage wall's TWO sentences apart", () => {
    /*
      The measured split: an unbacked claim must not assert what the thing IS.
      "Antlers is a garment, a prop or the set" is a false sentence, and a false
      refusal is worse than a vague one.
    */
    const backed = said({ reason: "wall_stage", asked: "a red coat" });
    /* SINCE CENSUS CARD C1 THE TWO SENTENCES ARE TWO WALLS, and this arm is why
       the split was safe to make: it already asserted that they must DIFFER and
       that the unbacked one must not claim what the thing is. Both halves still
       hold, on the id each half now has. */
    const unbacked = said({ reason: "wall_unbacked", asked: "antlers" });
    expect(backed).toContain("a garment, a prop or the set");
    expect(unbacked).not.toContain("a garment, a prop or the set");
    expect(unbacked).toContain("isn't one of the things this can name");
    /* The pair must DIFFER — two assertions about one string are satisfied by a
       string that ignores its argument (fable-1333 §2), and here they would be
       satisfied by one wall having quietly swallowed the other. */
    expect(unbacked).not.toBe(backed);
    /* And absence of `backed` means backed — every refusal written before the field existed
       came from a matched stage word. */
    expect(said({ reason: "wall_stage", asked: "a red coat", backed: true })).toBe(backed);
  });

  it("names what she asked about wherever the refusal carries it", () => {
    /* A refusal that cannot name the thing is a dead end wearing polite words. */
    for (const reason of ["wall_stage", "absorbed", "absorbed_departure"] as const) {
      expect(said({ reason, asked: "a beauty mark" } as RefineRefusal), reason)
        .toContain("a beauty mark");
    }
  });
});
