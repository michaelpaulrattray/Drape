/**
 * THE DECLARATIVE-STATE CONTRACT, driven on both sides of the boundary it
 * governs (fable-195, fable-307).
 *
 * The founder's most-used sentence — *"wear her hair down"* — refused at the
 * repaint's door on the first live walk that reached it: `wordsNotDeclarative`,
 * 31.9 seconds, no render, 25 credits back. The assembler was right; the defect
 * was upstream, in the module that owes the conversion.
 *
 * Fable ruled the fix at the INTERPRETER (fable-195 verbatim: *"the interpreter
 * owns converting an ask into a state phrase — that is a job it was always going
 * to need"*), with the boundary normalisation named as the approximation the
 * fidelity law forbids, and one condition attached: **the old road's impact is
 * MEASURED, not hoped.** That measurement is the last describe in this file.
 *
 * Three things are proved here, and none of them needs a model to behave:
 *
 *   1. the marker itself, both ways — it names an instruction and it stays
 *      quiet on a state, including the participles a longer list would eat;
 *   2. the rule reaches the model AT THE WIRE, naming every opener the
 *      assembler refuses, so the two cannot drift apart;
 *   3. what changes on the OLD road when the interpreter files a state instead
 *      of an imperative — one clause, on one of the founder's five asks.
 */
import { describe, expect, it } from "vitest";

import {
  IMPERATIVE_OPENERS,
  declarativeStateRule,
  imperativeOpenerIn,
} from "./declarativeState";
import { refineParseSystemPrompt } from "./refineInterpreter";
import { assembleRecipe } from "./recipeAssembler";
import { composeRenderPrompt } from "./refineDelta";
import { EDIT_PROSE } from "./refineService";

describe("the marker names an instruction and leaves a state alone", () => {
  it("names the opener in the founder's own sentence", () => {
    /* The exact string that refused on the live walk, and the exact word the
       refusal detail quotes back. */
    expect(imperativeOpenerIn("wear her hair down")).toBe("wear");
  });

  it("is quiet on the state phrase that sentence should have become", () => {
    expect(imperativeOpenerIn("hair down")).toBeNull();
  });

  it("CONTROL — a participle that merely shares a stem with a command is a state", () => {
    /* The reason the list is SHORT. Each of these is a correctly written state
       that a longer or fuzzier rule would refuse, and refusing them costs a
       paid render for nothing. */
    expect(imperativeOpenerIn("painted nails")).toBeNull();
    expect(imperativeOpenerIn("set in a low bun")).toBeNull();
    expect(imperativeOpenerIn("swept-back hair")).toBeNull();
    expect(imperativeOpenerIn("taken-in waist")).toBeNull();
  });

  it("reads through leading whitespace and any casing", () => {
    expect(imperativeOpenerIn("  Make her lips fuller")).toBe("Make");
  });

  it("every listed opener is actually caught — the list is not decoration", () => {
    /* A list nothing reads is the shape this program keeps finding. Each word
       is driven through the marker it is supposed to build. */
    const missed = IMPERATIVE_OPENERS.filter((word) => imperativeOpenerIn(`${word} something`) === null);
    expect(missed).toEqual([]);
  });
});

describe("the model is told exactly what the assembler refuses", () => {
  /*
    The two readers of this list sit on opposite sides of one boundary: the
    interpreter is told, the assembler refuses. Two copies would drift the day
    one grew a word, and the drift is silent in the worst direction — the user's
    paid ask refusing at the door with their credits handed back.
  */
  const prompt = refineParseSystemPrompt();

  it("the rule is in the prompt that actually leaves the building", () => {
    expect(prompt).toContain("EVERY VALUE IS A STATE, NEVER AN INSTRUCTION");
    /* The founder's sentence and its conversion, shown rather than described. */
    expect(prompt).toContain('"wear her hair down"        -> hairWorn: "hair down"');
  });

  it("and it names every opener, derived from the same array the marker is built from", () => {
    const missing = IMPERATIVE_OPENERS.filter((word) => !prompt.includes(word));
    expect(missing).toEqual([]);
    /* Said once, in one sentence, rather than scattered — so a reader of the
       prompt can see the whole contract in one place. */
    expect(declarativeStateRule().join("\n")).toContain(IMPERATIVE_OPENERS.join(", "));
  });

  it("CONTROL — the fall-through pass carries the rule too", () => {
    /* D-163's rule-3 second pass is given a prompt that has never heard of
       removal. It is still filing free-lane values, so it still owes states. */
    expect(refineParseSystemPrompt("edit")).toContain("EVERY VALUE IS A STATE");
  });
});

/**
 * A BRAND IS A LOOK, NOT A WALL (fable-404, and the founder paid for it).
 *
 * He asked for "miu miu styled glasses" and the recipe got the bare noun
 * `glasses`. The prompt said "never name a brand" and nothing about the rest of
 * the sentence, so the model dropped the whole ask — it read "lose the brand"
 * and "lose the look" as one lever.
 *
 * **The real instrument for this is the bench, not this file** (n≥3 per
 * phrasing through the live model: styling kept went 3/12 → 12/12, brands out
 * 11/12 → 12/12, the no-brand control unmoved at 6/6). What a unit test can
 * hold is that the sentence which produced those numbers is still in the prompt
 * that leaves the building — an LLM rule deleted by a later edit fails silently
 * and only on a paid ask.
 */
describe("the brand rule tells the model what to KEEP", () => {
  const prompt = refineParseSystemPrompt();

  it("names the substitution, not only the prohibition", () => {
    expect(prompt).toContain("SERVE THE ASK ANYWAY");
    /* The worked example, shown rather than described — it is the founder's own
       sentence and its correct answer. */
    expect(prompt).toContain('"miu miu styled glasses" files ["styled glasses"]');
  });

  it("CONTROL — and still forbids the name itself", () => {
    /* The half that must never relax: a fix that kept the aesthetic by keeping
       the house name would be a worse defect than the one it repairs. */
    expect(prompt).toContain("Never name a brand, a product, or a real person");
  });
});

describe("the door the fix is for", () => {
  const pronouns = { subject: "she", object: "her", possessive: "her", plural: false } as const;
  const master = { key: "masters/one.png" };
  const ask = (words: string) => assembleRecipe({
    master,
    library: [],
    asks: [{ slot: "hair" as never, noun: "hair", words }],
    pronouns,
  });

  it("refuses the imperative the interpreter used to hand it", () => {
    const refused = ask("wear her hair down");
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.reason).toBe("wordsNotDeclarative");
    expect(refused.detail).toContain("the interpreter owes a state phrase");
  });

  it("accepts the state phrase the interpreter now owes — the same ask, said as a state", () => {
    /* The whole point of the fix: the founder's sentence becomes sayable. */
    expect(ask("hair down").ok).toBe(true);
  });
});

/**
 * WHAT THIS COSTS THE ROAD THAT IS LIVE TODAY (fable-307 §3's condition).
 *
 * The interpreter's output is not the repaint's private property — it is stored
 * on the delta and composed into the OLD road's prompt, which is what production
 * runs while `CASTING_REPAINT_SCOPE` is absent. So the fix changes a live
 * behaviour, and the size of that change is measured here rather than assumed.
 *
 * Driven on the founder's five asks (`COMPOSITOR_SWAP_FIVE_ASK_PROOF_PLAN.md`),
 * before and after. Four of the five never move: they are already states, which
 * is why this was one sentence's defect rather than the lane's.
 */
describe("the old road's prompt, before and after, on the founder's five asks", () => {
  const prose = EDIT_PROSE as never;
  const compose = (delta: Parameters<typeof composeRenderPrompt>[0]) =>
    composeRenderPrompt(delta, prose, {}).full;

  /**
   * Is `after` exactly `before` with the value swapped, and nothing else?
   *
   * A LINE differ was written here first and it was vacuous: the composed
   * render prompt is a single paragraph on ONE line, so a line-based measure
   * could only ever answer "one line moved" — an affirmative that had no way to
   * be anything else. Its control caught it (two genuinely different clauses,
   * still one line), which is the whole reason the control was written.
   *
   * This substitutes the old value for the new in the ORIGINAL string and asks
   * for character-for-character equality. Nothing else in the prompt may have
   * moved — not the preservation list, not the strength clause, not a space.
   */
  const onlyTheValueMoved = (before: string, after: string, from: string, to: string): boolean =>
    before.includes(from) && before.split(from).join(to) === after;

  it("CONTROL — the measure can say NO, and does when a second clause moves", () => {
    /*
      The prompt's preservation list is DERIVED from which facets are being
      edited — editing the lips drops "the same mouth" and adds "the same
      teeth". So a second edited facet moves the document in two places at once,
      and the measure below must refuse it. Without this, "only the value moved"
      would be an affirmative with no possible negative.
    */
    const oneFacet = compose({ free: { hairWorn: "hair down" } });
    const twoFacets = compose({ free: { hairWorn: "hair down", lips: ["fuller lips"] } });
    expect(onlyTheValueMoved(oneFacet, twoFacets, "hair down", "hair down")).toBe(false);
    /* And the second clause really is there, so the refusal is about the right
       thing rather than about an empty string. */
    expect(twoFacets).toContain("LIPS: fuller lips");
    expect(oneFacet).toContain("the same mouth");
    expect(twoFacets).toContain("the same teeth");
  });

  it("STEPS 1-3 — nothing to convert, so the old road's prompt cannot move", () => {
    /* "gold hoop earrings" is already how the feature ends up: the rule reaches
       values that hold a command, and these never did. Asserted on the values
       themselves, because that is the property that makes the prompts equal. */
    for (const value of ["gold hoop earrings", "dangly cross earrings", "copper"]) {
      expect(imperativeOpenerIn(value)).toBeNull();
    }
    /* And the clauses those asks compose, so a silent drop would be visible. */
    expect(compose({ free: { statedAccessories: ["gold hoop earrings"] } }))
      .toContain("gold hoop earrings");
    expect(compose({ free: { statedAccessories: ["dangly cross earrings"] } }))
      .toContain("dangly cross earrings");
    expect(compose({ hairColour: "copper" as never })).toContain("copper");
  });

  it("STEP 4 — the whole change, and it is one clause", () => {
    const before = compose({ free: { hairWorn: "wear her hair down" } });
    const after = compose({ free: { hairWorn: "hair down" } });

    /* The clause that moves, said both ways. */
    expect(before).toContain("HAIR WORN: wear her hair down");
    expect(after).toContain("HAIR WORN: hair down");

    /*
      CONTAINED, MEASURED RATHER THAN ASSERTED: substitute the old value for the
      new in the old prompt and you get the new prompt, character for character.
      A render prompt is a long document that carries a preservation list, a
      strength clause and a framing clause, and "it only changed the hair" is
      the kind of claim that is true until it is not.
    */
    expect(onlyTheValueMoved(before, after, "wear her hair down", "hair down")).toBe(true);
    /* Said again as a length, because it is the arithmetic a person can check:
       the prompt gets shorter by exactly what the command cost, and by nothing
       else. */
    expect(before.length - after.length).toBe("wear her hair down".length - "hair down".length);
  });

  it("STEP 5 — a removal writes no free value, so this rule cannot reach it", () => {
    /* "remove her glasses" is classified as a removal rather than filed as a
       free-lane value, so there is nothing here to convert. The repaint refuses
       it by design (`repaintCannotRemove`) and refunds; chunk 3 is what turns it
       into a paint. The composer with no free lane is that state. */
    const composed = compose({});
    expect(composed).not.toContain("HAIR WORN");
    expect(composed).not.toContain("ACCESSORIES");
  });
});
