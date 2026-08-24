/**
 * `CASTING_BRIEF_FIDELITY_SCOPE` — the door on whether a customer's own words
 * are RATIONED on the way into her sheet
 * (`docs/specs/CASTING_V2_BRIEF_FIDELITY_BUILD.md`, countersigned fable-1600).
 *
 * The flag exists for ONE unmeasured thing — the IMAGE side. Both courts under
 * this build are TEXT, and a `Character detail:` line going from ~150 to ~500
 * characters is more image-prompt context, in a product whose own measurement
 * is that context is not additive. So an unflagged roll must get the bytes it
 * has always got, to the byte.
 *
 * What these arms hold it to:
 *
 *   1. the LADDER — off by default, absent means off, and it cannot be armed
 *      over a user `CASTING_V2_SCOPE` does not cover;
 *   2. the GATE, BOTH SIDES — off is today's system prompt BYTE FOR BYTE, and
 *      on swaps exactly one sentence and nothing else. A flag whose two sides
 *      are never asserted together is a flag nobody has read;
 *   3. the SWAP CANNOT MISS SILENTLY — `String.replace` that matches nothing
 *      returns its input, so an edit to the cap sentence would leave a flagged
 *      account quietly running the unflagged prompt;
 *   4. the TWO NUMBERS MOVE TOGETHER — the bound the reply is held to follows
 *      the announcement, because a raised announcement with the old bound is
 *      measurably WORSE than neither: the budget court watched the model say
 *      everything and the guillotine take it, 3 drives of 3;
 *   5. the MALFUNCTION ARM the new bound can no longer catch (ruled fable-1600)
 *      — a summary LONGER THAN THE BRIEF IT SUMMARISES is a defect wearing
 *      length, and it is asserted independently of either cap.
 *
 * The WIRE — that `validateEnv()` actually calls the coverage check — is not
 * this file's job and this file does not claim it.
 */
import { describe, expect, it, vi } from "vitest";

import type { TextEngine } from "../providers/types";

import {
  CastingBriefFidelityCoverageError,
  CastingBriefFidelityScopeConfigurationError,
  parseCastingBriefFidelityScope,
  validateCastingBriefFidelityEnvironment,
} from "./castingV2Scope";
import {
  NOTES_CAP_RELEASED,
  NOTES_CAP_SENTENCE,
  interpretBrief,
  interpreterSystemPrompt,
} from "./interpreter";
import {
  NOTES_MAX,
  NOTES_MAX_FIDELITY,
  parseCastingIntent,
  parseStatedSkin,
} from "./castingIntent";
import { statedAxis, statedSkinSentence } from "./cohortPhotorealHuman";
import { castingBriefCompiler } from "./briefCompiler";

describe("the ladder", () => {
  it("is off when absent, and off means off", () => {
    expect(parseCastingBriefFidelityScope(undefined).kind).toBe("off");
    expect(parseCastingBriefFidelityScope("off").kind).toBe("off");
  });

  it("refuses a grammar it does not recognise", () => {
    expect(() => parseCastingBriefFidelityScope("users:")).toThrow(
      CastingBriefFidelityScopeConfigurationError,
    );
    expect(() => parseCastingBriefFidelityScope("everyone")).toThrow(
      CastingBriefFidelityScopeConfigurationError,
    );
  });

  it("refuses while casting itself is off — what it governs is the COMPILE of a roll", () => {
    expect(() => validateCastingBriefFidelityEnvironment({ scope: "users:1", castingScope: "off" }))
      .toThrow(CastingBriefFidelityCoverageError);
  });

  it("refuses a user the parent does not cover", () => {
    expect(() => validateCastingBriefFidelityEnvironment({
      scope: "users:1,7", castingScope: "users:1",
    })).toThrow(CastingBriefFidelityCoverageError);
  });

  it("refuses `all` while the parent names specific users", () => {
    expect(() => validateCastingBriefFidelityEnvironment({ scope: "all", castingScope: "users:1" }))
      .toThrow(CastingBriefFidelityCoverageError);
  });

  it("admits a covered user, and admits anything under an open parent", () => {
    expect(validateCastingBriefFidelityEnvironment({ scope: "users:1", castingScope: "users:1,2" }).kind)
      .toBe("users");
    expect(validateCastingBriefFidelityEnvironment({ scope: "all", castingScope: "all" }).kind)
      .toBe("all");
  });
});

describe("the gate, both sides", () => {
  it("OFF is today's prompt byte for byte — the announced cap still stands", () => {
    const off = interpreterSystemPrompt();
    expect(off).toContain(NOTES_CAP_SENTENCE);
    expect(off).not.toContain(NOTES_CAP_RELEASED);
    /* And explicitly false rather than merely absent: a flag read as undefined
       and a flag read as false must produce the same bytes. */
    expect(interpreterSystemPrompt({ fidelity: false })).toBe(off);
  });

  it("ON swaps exactly one sentence and appends exactly one block", () => {
    const off = interpreterSystemPrompt();
    const on = interpreterSystemPrompt({ fidelity: true });
    expect(on).not.toContain(NOTES_CAP_SENTENCE);
    expect(on).toContain(NOTES_CAP_RELEASED);

    /*
      The whole difference stated as an identity rather than as a handful of
      `toContain`s: the flagged prompt IS the unflagged one with that sentence
      replaced, followed by ONE appended block and nothing else. Anything that
      moved inside the base would fail on the prefix; anything extra appended
      would fail on the tail.
    */
    const swapped = off.replace(NOTES_CAP_SENTENCE, NOTES_CAP_RELEASED);
    expect(on.startsWith(swapped)).toBe(true);
    const appended = on.slice(swapped.length);
    expect(appended.startsWith("\n")).toBe(true);
    expect(appended).toContain(`"statedSkin"`);
    /* And the lane's own rule, at the bytes: it must not read as a place to
       move a fact OUT of the summary — `statedHair`'s original defect. */
    expect(appended).toContain("IN ADDITION TO, NEVER INSTEAD OF");
  });

  it("composes with the other blocks in a FIXED ORDER", () => {
    const both = interpreterSystemPrompt({ fidelity: true, ink: true });
    const inkOnly = interpreterSystemPrompt({ ink: true });
    /* The base is the same base under both, swapped only when flagged. */
    expect(both.startsWith(interpreterSystemPrompt().replace(NOTES_CAP_SENTENCE, NOTES_CAP_RELEASED)))
      .toBe(true);
    /* Both blocks are present, and the ORDER is fixed — two accounts with the
       same pair of flags must get the same bytes, which is the composer's own
       stated contract. */
    expect(both).toContain(`"statedSkin"`);
    expect(both).toContain(`"statedInk"`);
    expect(both.indexOf(`"statedSkin"`)).toBeLessThan(both.indexOf(`"statedInk"`));
    /* And the ink block itself is untouched by the fidelity flag: whatever the
       ink-only prompt appended, the both-prompt appends the same bytes. */
    const inkAppended = inkOnly.slice(interpreterSystemPrompt().length);
    expect(both.endsWith(inkAppended)).toBe(true);
  });
});

describe("the swap cannot miss silently", () => {
  /*
    ⚠ THE ARM THIS BUILD MOST NEEDS AND THE ONE A REVIEWER WOULD SKIP.

    `String.replace` that matches nothing returns its input, so an edit to the
    cap sentence — a comma, a re-word — would leave every flagged account
    running the UNFLAGGED prompt with no error anywhere. It is the footprint
    class this repository has already been bitten by, and the guard is a throw
    rather than a log because a prompt nobody chose must not reach a paid roll.

    Driven at the real function by asserting the sentence the swap looks for is
    the sentence the prompt actually carries — if those two ever part company,
    this arm reddens before a customer meets it.
  */
  it("the sentence it replaces IS in the shipped prompt", () => {
    expect(interpreterSystemPrompt()).toContain(NOTES_CAP_SENTENCE);
  });

  it("and the replacement is not already there, or the swap would be a no-op", () => {
    expect(interpreterSystemPrompt()).not.toContain(NOTES_CAP_RELEASED);
  });
});

describe("the two numbers move together", () => {
  const longNotes = "x".repeat(600);
  const wire = (notes: string) => JSON.stringify({
    cohort: "photoreal_human", role: "a runway model", characterNotes: notes,
    sex: null, ageBand: null, agePhase: null, heritage: [], build: null,
    energy: null, archetype: null, variationAxis: null, look: null, reads: null,
    composedDirection: null, statedHair: null, statedAccessories: [],
    poolTendencies: null,
  });

  it("OFF: the reply is held to NOTES_MAX and the overflow is reported", () => {
    const parsed = parseCastingIntent(wire(longNotes), "");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.intent.characterNotes!.length).toBeLessThanOrEqual(NOTES_MAX);
    expect(parsed.notes.overflow).toBe(600 - NOTES_MAX);
  });

  it("ON: the same reply survives whole, because the bound is the brief's own", () => {
    const parsed = parseCastingIntent(wire(longNotes), "", NOTES_MAX_FIDELITY);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.intent.characterNotes).toBe(longNotes);
    expect(parsed.notes.overflow).toBe(0);
  });

  it("and the raised bound is the BRIEF's own bound, not a measured one", () => {
    /* 2000 is where the roll's own input schema caps `briefText`. A measured
       number (1200 covered the longest reply seen) was rejected at the
       countersign on the principle that a bound true by construction beats one
       true by measurement. */
    expect(NOTES_MAX_FIDELITY).toBe(2000);
  });
});

describe("the WIRE — interpretBrief actually hands the bound down", () => {
  /*
    ⚠ THIS SUITE WAS WRITTEN WITHOUT THIS BLOCK AND THE GAP WAS FOUND BY
    SABOTAGE, WHICH IS THE ONLY REASON IT IS HERE.

    Every arm above drives `parseCastingIntent` DIRECTLY, so they prove the
    parser honours a bound it is handed and prove nothing about whether anything
    hands it one. Replacing `interpretBrief`'s

        const notesMax = input.fidelity === true ? NOTES_MAX_FIDELITY : NOTES_MAX;

    with a flat `NOTES_MAX` reddened NOTHING: sixteen green arms over a flag
    whose enforcing half had been deleted. That is `arm-at-the-producer` with
    the sign flipped — an arm at the CONSUMER reads the same whether the
    producer works — and it is the defect this whole build exists to repair,
    arriving in its own suite.

    So this drives the real `interpretBrief` with a stub transport and asserts
    the DELIVERED notes differ by the flag alone.
  */
  const LONG = "z".repeat(600);
  const stub = (): TextEngine => ({
    id: "stub",
    complete: vi.fn(async () => ({
      text: JSON.stringify({
        cohort: "photoreal_human", role: "a runway model", characterNotes: LONG,
        heritage: [], statedAccessories: [],
      }),
      latencyMs: 1,
      provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
    })),
  } as unknown as TextEngine);

  it("OFF: the delivered notes are cut to NOTES_MAX", async () => {
    const outcome = await interpretBrief({ briefText: "a runway model", engine: stub() });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.intent.characterNotes!.length).toBeLessThanOrEqual(NOTES_MAX);
  });

  it("ON: the same reply is delivered whole", async () => {
    const outcome = await interpretBrief({
      briefText: "a runway model", engine: stub(), fidelity: true,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.intent.characterNotes).toBe(LONG);
  });

  it("and the flagged prompt is what reaches the transport", async () => {
    const engine = stub();
    await interpretBrief({ briefText: "a runway model", engine, fidelity: true });
    /* Asserted at the WIRE rather than at the composer: invariant 5's rule is
       that a contract about what gets sent is proven on the outgoing request. */
    const request = (engine.complete as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0] as {
      system: string;
    };
    expect(request.system).toContain(NOTES_CAP_RELEASED);
    expect(request.system).not.toContain(NOTES_CAP_SENTENCE);
  });

  it("and the UNflagged prompt is byte-identical to the shipped one", async () => {
    const engine = stub();
    await interpretBrief({ briefText: "a runway model", engine });
    const request = (engine.complete as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0] as {
      system: string;
    };
    expect(request.system).toBe(interpreterSystemPrompt());
  });
});

describe("the malfunction the new bound can no longer catch", () => {
  /*
    ⚠ RULED WITH THE 2000 (fable-1600): a bound that can no longer ration also
    can no longer NOTICE. The headroom reading measured the notes coming back
    SHORTER THAN THE BRIEF on 8 of 8 drives with the cap released, so a summary
    LONGER than its own input is a different defect wearing length — and it must
    not be able to hide behind a generous bound.
  */
  const brief = "A woman in her forties with short dark hair.";
  const wire = (notes: string) => JSON.stringify({
    cohort: "photoreal_human", role: null, characterNotes: notes,
    sex: null, ageBand: null, agePhase: null, heritage: [], build: null,
    energy: null, archetype: null, variationAxis: null, look: null, reads: null,
    composedDirection: null, statedHair: null, statedAccessories: [],
    poolTendencies: null,
  });

  it("a summary longer than its brief is visible in the parsed result", () => {
    const bloated = "y".repeat(brief.length * 3);
    const parsed = parseCastingIntent(wire(bloated), brief, NOTES_MAX_FIDELITY);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    /* The assertion the product side would make. It is stated here rather than
       enforced in the parser on purpose: the parser's job is to read, and a
       reader that silently rewrites a malfunction is how a malfunction stops
       being visible. */
    expect(parsed.intent.characterNotes!.length).toBeGreaterThan(brief.length);
  });

  it("and an ordinary summary is shorter than its brief, which is the measured case", () => {
    const ordinary = "Short dark hair, forties.";
    const parsed = parseCastingIntent(wire(ordinary), brief, NOTES_MAX_FIDELITY);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.intent.characterNotes!.length).toBeLessThan(brief.length);
  });
});

describe("the lane — parse, speak, and stand down", () => {
  /*
    ⚠ THREE ARMS AND NOT ONE, because the lane has three halves and any two of
    them without the third is a defect this product has already shipped once.
    `statedHair` filled a field and never spoke, so his bald cast came back with
    hair; widening deference without a speaking lane would be the same mistake
    from the other side.
  */

  describe("what the parser will keep", () => {
    const brief = "Bald male, mid-40s, pale porcelain skin, heavily weathered.";

    it("keeps her own words", () => {
      const stated = parseStatedSkin(
        { tone: "pale porcelain", character: "heavily weathered" }, brief,
      );
      expect(stated).toEqual({ tone: "pale porcelain", character: "heavily weathered" });
    });

    it("DROPS a paraphrase, because a null is better than words in her mouth", () => {
      /* "sallow" is a perfectly good reading of this brief and she did not
         type it. Source containment (D-89): dropped, never repaired. */
      const stated = parseStatedSkin({ tone: "sallow", character: null }, brief);
      expect(stated.tone).toBeNull();
    });

    it("drops a digit and a clothing word, exactly as the hair lane does", () => {
      expect(parseStatedSkin({ tone: "type 4 skin", character: null }, "type 4 skin").tone)
        .toBeNull();
      expect(parseStatedSkin({ tone: "shirt", character: null }, "a shirt").tone)
        .toBeNull();
    });

    it("answers empty on absence rather than throwing", () => {
      expect(parseStatedSkin(null, brief)).toEqual({ tone: null, character: null });
      expect(parseStatedSkin("nonsense", brief)).toEqual({ tone: null, character: null });
    });
  });

  describe("what the composer says", () => {
    it("says nothing at all when the lane is empty — an unflagged roll", () => {
      expect(statedSkinSentence(null)).toBe("");
      expect(statedSkinSentence({ tone: null, character: null })).toBe("");
    });

    it("says her tone, her character, or both in one sentence", () => {
      expect(statedSkinSentence({ tone: "pale porcelain", character: null }))
        .toBe("SKIN: pale porcelain — exactly as described.");
      expect(statedSkinSentence({ tone: null, character: "deeply lined" }))
        .toBe("SKIN: deeply lined — exactly as described.");
      expect(statedSkinSentence({ tone: "olive", character: "scarred" }))
        .toBe("SKIN: olive, scarred — exactly as described.");
    });
  });

  describe("and the gate stands down on the same facts", () => {
    /*
      The six that used to leave the engine authoring a skin character ON TOP of
      her own word — driven at the real function before the lane existed
      (`scripts/_skin-axis-probe-disposable.mts`, free, no model).
    */
    const wereAuthoring = [
      "a ruddy man in his fifties",
      "olive-skinned, mid-30s",
      "she is very fair",
      "a sallow office worker",
      "a woman with a deep tan",
      "porcelain",
    ];
    for (const statement of wereAuthoring) {
      it(`defers on "${statement}"`, () => {
        expect(statedAxis("skin", statement)).toBe(true);
      });
    }

    /*
      ⚠ THE ARMS THAT PROVE THE INFLECTION WALK IS DOING SOMETHING, and they
      exist because a sabotage said it was not.

      Deleting the walk reddened NOTHING on the first pass: every statement in
      the list above defers through a listed word, so the walk was carrying no
      weight in this suite and would have read as a mechanism nobody needed.
      These are the shapes it actually buys — a PLURAL of a listed singular,
      which is how a person writes about marks on a face.
    */
    it("defers on a plural of a listed word — the walk, not the list", () => {
      expect(statedAxis("skin", "she has scars on her cheek")).toBe(true);
      expect(statedAxis("skin", "a few moles across the nose")).toBe(true);
      expect(statedAxis("skin", "two birthmarks on her jaw")).toBe(true);
    });

    it("and the ones that always worked still work", () => {
      expect(statedAxis("skin", "Bald male, mid-40s, pale porcelain skin, heavily weathered.")).toBe(true);
      expect(statedAxis("skin", "tanned and freckled")).toBe(true);
      expect(statedAxis("skin", "she has a scar on her cheek")).toBe(true);
    });

    /*
      ⚠ THE NEGATIVE CONTROL, and it is the reason the inflection walk strips a
      SUFFIX rather than matching a PREFIX. `scar` inside `scarce` and `tan`
      inside `tantrum` would stand the whole axis down on briefs that say
      nothing about skin at all — a wider gate that silences the engine for
      free is not an improvement, it is the defect with better manners.
    */
    it("does NOT defer on words that merely contain a skin word", () => {
      expect(statedAxis("skin", "a scarce, quiet presence")).toBe(false);
      expect(statedAxis("skin", "prone to a tantrum")).toBe(false);
      expect(statedAxis("skin", "a molecular biologist")).toBe(false);
      expect(statedAxis("skin", "a woman in her forties")).toBe(false);
    });
  });
});

describe("the WIRE, again — the lane reaches the eight prompts", () => {
  /*
    ⚠ WRITTEN BECAUSE THE SABOTAGE ON THE BOUND FOUND THIS SUITE'S FIRST HOLE.

    Everything in "the lane" above drives the parser and the sentence helper
    directly. That proves the helper composes a sentence and proves nothing
    about whether the composer CALLS it — which is the same shape as the
    defect that suite already caught once, and the same shape as the defect
    this whole build exists to repair: a fact that goes missing between two
    honest components.

    So this compiles a brief through the real entrance with a stub transport,
    and reads the CANDIDATE PROMPT (invariant 5 — a contract about what gets
    sent is proven on the outgoing request).
  */
  const BRIEF = "Bald male, mid-40s, pale porcelain skin, heavily weathered.";

  const engineSaying = (statedSkin: unknown): TextEngine => ({
    id: "stub",
    complete: vi.fn(async () => ({
      text: JSON.stringify({
        cohort: "photoreal_human",
        role: "a weathered man",
        characterNotes: "Bald, severe bone structure",
        sex: "male",
        ageBand: "40s",
        heritage: [],
        statedAccessories: [],
        statedSkin,
      }),
      latencyMs: 1,
      provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
    })),
  } as unknown as TextEngine);

  it("her word is in EVERY ONE of the eight prompts", async () => {
    const compiled = await castingBriefCompiler({
      briefText: BRIEF,
      candidateCount: 8,
      rollSeed: "lane-wire",
      engine: engineSaying({ tone: "pale porcelain", character: "heavily weathered" }),
      briefFidelity: true,
    });
    const prompts = compiled.candidates.map((candidate) => candidate.prompt);
    expect(prompts).toHaveLength(8);
    for (const prompt of prompts) {
      expect(prompt).toContain("SKIN: pale porcelain, heavily weathered — exactly as described.");
    }
  });

  it("and an empty lane contributes NOTHING to the prompt", async () => {
    const compiled = await castingBriefCompiler({
      briefText: BRIEF,
      candidateCount: 8,
      rollSeed: "lane-wire",
      engine: engineSaying({ tone: null, character: null }),
      briefFidelity: true,
    });
    for (const candidate of compiled.candidates) {
      /*
        `SKIN:` and nothing looser. The first draft of this arm also asserted
        the absence of *"exactly as described"* and went red on working code:
        that phrase is house prose in the STATED ACCESSORIES and STATED MAKEUP
        constants, which have nothing to do with this lane. A negative arm wide
        enough to catch its neighbours is an arm that will be edited away the
        first time it fires.
      */
      expect(candidate.prompt).not.toContain("SKIN:");
    }
  });

  it("and a PARAPHRASE never reaches the picture, however confident the reader was", async () => {
    /* The reader answers "sallow" about a brief that says "porcelain". Source
       containment drops it, and the prompt says nothing rather than saying a
       word she did not type about her own face. */
    const compiled = await castingBriefCompiler({
      briefText: BRIEF,
      candidateCount: 8,
      rollSeed: "lane-wire",
      engine: engineSaying({ tone: "sallow", character: null }),
      briefFidelity: true,
    });
    for (const candidate of compiled.candidates) {
      expect(candidate.prompt).not.toContain("sallow");
    }
  });
});
