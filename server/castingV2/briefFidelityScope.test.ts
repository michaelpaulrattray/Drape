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
import { NOTES_MAX, NOTES_MAX_FIDELITY, parseCastingIntent } from "./castingIntent";

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

  it("ON swaps exactly one sentence and changes nothing else", () => {
    const off = interpreterSystemPrompt();
    const on = interpreterSystemPrompt({ fidelity: true });
    expect(on).not.toContain(NOTES_CAP_SENTENCE);
    expect(on).toContain(NOTES_CAP_RELEASED);
    /* The whole difference, stated as an identity rather than as two
       `toContain`s: the flagged prompt IS the unflagged one with that sentence
       replaced. Anything else that moved would fail here. */
    expect(on).toBe(off.replace(NOTES_CAP_SENTENCE, NOTES_CAP_RELEASED));
  });

  it("composes with the other blocks without disturbing them", () => {
    const both = interpreterSystemPrompt({ fidelity: true, ink: true });
    const inkOnly = interpreterSystemPrompt({ ink: true });
    expect(both).toBe(inkOnly.replace(NOTES_CAP_SENTENCE, NOTES_CAP_RELEASED));
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
