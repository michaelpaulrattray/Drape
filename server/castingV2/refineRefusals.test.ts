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
  refusalCharge,
  refusalReportClass,
} from "./refineRefusals";
import { refusalMessage } from "./refineInterpreter";
import type { RefineRefusal } from "./refineDelta";

const said = (refusal: RefineRefusal) => refusalMessage({ ok: false, refusal } as never);

describe("every refusal answers all three questions", () => {
  it("covers every reason the type allows, with nothing extra", () => {
    /* `satisfies Record<RefineRefusal["reason"], …>` is the compile half; this
       is the runtime half, and it is what a report can count. */
    expect(REFUSAL_REASONS.length).toBe(9);
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
      expect(refusalCharge(reason), reason).toBe("free");
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

  it("classes them for the report without inventing a fourth family", () => {
    expect(refusalReportClass("wall_stage")).toBe("wall");
    expect(refusalReportClass("gate_ink_document")).toBe("gate");
    expect(refusalReportClass("absorbed_departure")).toBe("absorbed");
    expect(refusalReportClass("unreadable")).toBe("unread");
  });
});

describe("the copy, pinned verbatim through the fold", () => {
  it("says the same sentences it said as a switch", () => {
    expect(said({ reason: "wall_likeness" })).toBe(
      "Refining can't make someone look like a specific real person. Nothing was charged.");
    expect(said({ reason: "wall_content" })).toBe("That one can't be rendered. Nothing was charged.");
    expect(said({ reason: "empty" })).toBe(
      "Say what you'd like changed — anything about the person themselves.");
    expect(said({ reason: "absorbed", asked: "freckles" })).toBe(
      "She already has freckles — this would have changed nothing, so nothing was charged. "
      + "Ask for more of it, or say it another way.");
    expect(said({ reason: "absorbed_departure", asked: "Her glasses" })).toBe(
      "Her glasses — that's already off her, so this would have changed nothing and nothing "
      + "was charged. Say what you'd like instead and I'll put it on.");
  });

  it("keeps the stage wall's TWO sentences apart", () => {
    /*
      The measured split: an unbacked claim must not assert what the thing IS.
      "Antlers is a garment, a prop or the set" is a false sentence, and a false
      refusal is worse than a vague one.
    */
    const backed = said({ reason: "wall_stage", asked: "a red coat" });
    const unbacked = said({ reason: "wall_stage", asked: "antlers", backed: false });
    expect(backed).toContain("a garment, a prop or the set");
    expect(unbacked).not.toContain("a garment, a prop or the set");
    expect(unbacked).toContain("isn't one of the things this can name");
    /* And absence means backed — every refusal written before the field existed
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
