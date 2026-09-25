/**
 * THE BRIEF'S OWN OUTFIT, RECORDED — #1222's arms.
 *
 * His Sifr brief said *"a white, body-conscious dress that mixes qipao
 * structure with industrial straps, buckles, and a worn graphic on the
 * chest"*; the signed full front delivered overall trousers and black boots.
 * The defect was a RECORD that never existed: the author road sends the brief
 * to the engine verbatim, so the eight candidates wear the dress, and then
 * nothing writes what she wears — `casting_rolls.wardrobeLine` was null by
 * construction and the five views guessed her lower half against a chest-up
 * reference.
 *
 * These arms hold the three pieces of the repair:
 *
 *  1. the PARSE — her words in, her words out, and nothing else
 *     (`parseStatedWardrobeLine`: full source containment, whole-or-nothing);
 *  2. the WIRE — the extraction block is asked exactly when the author road
 *     compiles, and every other option combination keeps its exact bytes
 *     (invariant 5: proven on the outgoing call, not on a constant);
 *  3. the COMPILE — the author road returns the stated line for the roll row
 *     to write, and it NEVER enters the eight prompts, because the brief
 *     itself already reached the engine (the #132 review's "WARDROBE — <line>"
 *     double-statement is the shape this refuses).
 */
import { describe, expect, it } from "vitest";

import { castingBriefCompiler } from "./briefCompiler";
import { parseStatedWardrobeLine } from "./castingIntent";
import { interpreterSystemPrompt } from "./interpreter";
import type { TextEngine } from "../providers/types";

const SIFR_BRIEF =
  "A young woman with sharp features and a cool, guarded presence. She wears a white, "
  + "body-conscious dress that mixes qipao structure with industrial straps, buckles, and a "
  + "worn graphic on the chest. Her hair is black, cut blunt.";

const SIFR_LINE =
  "a white, body-conscious dress that mixes qipao structure with industrial straps, "
  + "buckles and a worn graphic on the chest";

/** A text engine that returns exactly what a test wants the interpreter to say. */
function engineReturning(text: string): TextEngine {
  return {
    id: "test:interpreter",
    complete: async () => ({
      text,
      latencyMs: 12,
      provenance: { provider: "openrouter" as const, model: "test", servedModel: "test" },
    }),
  };
}

/** The same engine, keeping every system prompt it was handed. */
function engineRecording(text: string): TextEngine & { systems: string[] } {
  const systems: string[] = [];
  return {
    id: "test:interpreter",
    systems,
    complete: async (call: { system?: string }) => {
      systems.push(call.system ?? "");
      return {
        text,
        latencyMs: 12,
        provenance: { provider: "openrouter" as const, model: "test", servedModel: "test" },
      };
    },
  } as TextEngine & { systems: string[] };
}

/** An interpreter reply whose only interesting field is the stated outfit. */
function replyWith(statedWardrobe: unknown): string {
  return JSON.stringify({
    cohort: "photoreal_human",
    subject: "photoreal_human",
    role: "a young woman",
    sex: "female",
    statedWardrobe,
  });
}

describe("parseStatedWardrobeLine — her words in, her words out", () => {
  it("keeps a sentence extracted close to verbatim", () => {
    expect(parseStatedWardrobeLine(SIFR_LINE, SIFR_BRIEF)).toBe(SIFR_LINE);
  });

  it("⚠ drops a reply that improves her outfit — containment is the wall, not the prompt", () => {
    /*
      The extraction block tells the model not to invent; this is what makes
      the instruction unnecessary to trust. "scuffed leather boots" is a
      perfectly plausible completion of the Sifr outfit, and it is exactly the
      guess #1222 retires — she never typed it, so the whole reply drops and
      the roll records nothing, which is today's shipped behaviour.
    */
    expect(parseStatedWardrobeLine(`${SIFR_LINE}, scuffed leather boots`, SIFR_BRIEF)).toBeNull();
  });

  it("drops the non-answers whole: blank, non-string, digits", () => {
    expect(parseStatedWardrobeLine(null, SIFR_BRIEF)).toBeNull();
    expect(parseStatedWardrobeLine(undefined, SIFR_BRIEF)).toBeNull();
    expect(parseStatedWardrobeLine("   ", SIFR_BRIEF)).toBeNull();
    expect(parseStatedWardrobeLine(42, SIFR_BRIEF)).toBeNull();
    expect(parseStatedWardrobeLine("a dress with 3 straps", "she wears a dress with 3 straps")).toBeNull();
  });

  it("⚠ WHOLE OR NOTHING — a line longer than the column is dropped, never truncated", () => {
    /*
      The views JUDGE against this line. A truncation that lost the footwear
      mid-word would fail her own boots as additions — a refunded slice
      manufactured by our own cap. Longer than `WARDROBE_LINE_MAX_LENGTH`
      (240) means null, and null composes the views exactly as today.
    */
    const garment = "a very long coat with many many described details";
    const long = Array(8).fill(garment).join(", and ");
    expect(long.length).toBeGreaterThan(240);
    expect(parseStatedWardrobeLine(long, `she wears ${long}`)).toBeNull();
  });

  it("scrubs a brand and keeps the sentence — the product's standing answer to that class", () => {
    const briefText = "a courier in a Nike hoodie and plain black shorts";
    const parsed = parseStatedWardrobeLine("a Nike hoodie and plain black shorts", briefText);
    expect(parsed).not.toBeNull();
    expect(parsed).not.toContain("Nike");
    expect(parsed).toContain("hoodie");
  });
});

describe("the wire — the extraction block is asked exactly when the author road compiles", () => {
  const marker = "THE OUTFIT THE BRIEF ITSELF DESCRIBES";

  it("the option adds the block, and its absence is today's bytes", () => {
    expect(interpreterSystemPrompt({ statedWardrobe: true })).toContain(marker);
    expect(interpreterSystemPrompt()).not.toContain(marker);
    expect(interpreterSystemPrompt({ statedWardrobe: false })).not.toContain(marker);
  });

  it("⚠ appends LAST, so every existing option combination keeps its exact bytes as a prefix", () => {
    /*
      Context is not additive in this program, measured — a block that landed
      MID-prompt would move every block after it. Appended last, an account
      with any other combination gets a prompt whose existing bytes are
      untouched, which is the property the fixed-order rule exists for.
    */
    for (const options of [
      {},
      { author: true },
      { fidelity: true },
      { author: true, ink: true },
      { author: true, fidelity: true, ink: true },
    ]) {
      const without = interpreterSystemPrompt(options);
      const withBlock = interpreterSystemPrompt({ ...options, statedWardrobe: true });
      expect(withBlock.startsWith(without), JSON.stringify(options)).toBe(true);
      expect(withBlock).toContain(marker);
    }
  });

  it("⚠ ASSERTED AT THE OUTGOING CALL — the author compile asks, the house compile does not", async () => {
    const authorEngine = engineRecording(replyWith(SIFR_LINE));
    await castingBriefCompiler({
      briefText: SIFR_BRIEF,
      candidateCount: 8,
      rollSeed: "seed-stated-wire-author",
      engine: authorEngine,
      creativeRegister: true,
    });
    /* The interpreter may legitimately re-sample once, so the claim is about
       EVERY call that went out, not about there being one. */
    expect(authorEngine.systems.length).toBeGreaterThanOrEqual(1);
    for (const system of authorEngine.systems) {
      expect(system).toContain(marker);
      /* And the PICK's inventing block is still never asked — the two
         contracts do not travel together. */
      expect(system).not.toContain("THE ONE OUTFIT ALL EIGHT OF THESE PEOPLE WEAR");
    }

    const houseEngine = engineRecording(replyWith(SIFR_LINE));
    await castingBriefCompiler({
      briefText: SIFR_BRIEF,
      candidateCount: 8,
      rollSeed: "seed-stated-wire-house",
      engine: houseEngine,
    });
    expect(houseEngine.systems.length).toBeGreaterThanOrEqual(1);
    for (const system of houseEngine.systems) {
      expect(system).not.toContain(marker);
    }
  });
});

describe("the compile — the author road records her outfit and never restates it", () => {
  it("returns the stated line for the roll row to write", async () => {
    const compiled = await castingBriefCompiler({
      briefText: SIFR_BRIEF,
      candidateCount: 8,
      rollSeed: "seed-stated-line",
      engine: engineReturning(replyWith(SIFR_LINE)),
      creativeRegister: true,
    });
    expect(compiled.wardrobeLine).toBe(SIFR_LINE);
  });

  it("⚠ the line never enters the eight prompts — the brief already reached the engine verbatim", async () => {
    /*
      The #132 review's finding: a sheet that drew "WARDROBE — <line>" over an
      outfit the engine was never told about. On the author road the outfit IS
      in the request (the brief travels verbatim), so the record must stay a
      record. The dress reaches the prompt inside her own sentence and nowhere
      else — asserted on the code-owned WARDROBE framing, not on the words,
      which legitimately appear inside the quoted brief.
    */
    const compiled = await castingBriefCompiler({
      briefText: SIFR_BRIEF,
      candidateCount: 8,
      rollSeed: "seed-stated-not-restated",
      engine: engineReturning(replyWith(SIFR_LINE)),
      creativeRegister: true,
    });
    expect(compiled.wardrobeLine).toBe(SIFR_LINE);
    for (const candidate of compiled.candidates) {
      expect(candidate.prompt).toContain(SIFR_BRIEF.trim());
      expect(candidate.prompt).not.toContain("WARDROBE:");
      expect(candidate.prompt).not.toContain("WARDROBE —");
    }
  });

  it("a brief that names no outfit records nothing — the honest case, not a failure", async () => {
    const compiled = await castingBriefCompiler({
      briefText: "a woman in her 30s with a warm, open face",
      candidateCount: 8,
      rollSeed: "seed-stated-none",
      engine: engineReturning(replyWith(null)),
      creativeRegister: true,
    });
    expect(compiled.wardrobeLine).toBeNull();
  });

  it("⚠ an INVENTED reply on the author road records nothing either — the poison arm", async () => {
    /*
      The reply names an outfit the brief never stated. The containment drops
      it whole, so the roll records null and the views keep the
      continue-the-reference sentence — a wrong extraction can only ever cost
      the feature, never invent a fact about her.
    */
    const compiled = await castingBriefCompiler({
      briefText: "a woman in her 30s with a warm, open face",
      candidateCount: 8,
      rollSeed: "seed-stated-poison",
      engine: engineReturning(replyWith("a red leather jacket and dark jeans")),
      creativeRegister: true,
    });
    expect(compiled.wardrobeLine).toBeNull();
  });

  it("the house road is untouched — its line is still the follow's inherited sentence or nothing", async () => {
    const compiled = await castingBriefCompiler({
      briefText: SIFR_BRIEF,
      candidateCount: 8,
      rollSeed: "seed-stated-house",
      engine: engineReturning(replyWith(SIFR_LINE)),
    });
    /* The reply VOLUNTEERS a stated line; the house road does not read it. */
    expect(compiled.wardrobeLine).toBeNull();
  });
});
