import { describe, expect, it, vi } from "vitest";
import { parseCastingIntent, parseWardrobePick } from "./castingIntent";
import {
  SYSTEM_PROMPT_FOR_TESTS,
  interpretBrief,
  interpreterSystemPrompt,
} from "./interpreter";
import type { TextEngine } from "../providers/types";

/**
 * THE PICK — cases (a) and (b) of the Wardrobe path (design §4, item 4).
 *
 * Three seams, and the middle one is the reason this file exists rather than
 * two arms bolted onto the compiler suite:
 *
 *   1. the PROMPT is composed with the wardrobe question only when asked;
 *   2. that composition reaches the TRANSPORT — asserted on the outgoing
 *      request, never on a constant near it (invariant 5);
 *   3. the reply is parsed through §4.1's door.
 */

/** Records what the interpreter actually put on the wire. */
function recordingEngine(reply: string) {
  const sent: { system: string }[] = [];
  const engine: TextEngine = {
    id: "test:wardrobe",
    complete: async (request: { system: string }) => {
      sent.push({ system: request.system });
      return {
        text: reply,
        latencyMs: 5,
        provenance: { provider: "openrouter" as const, model: "test", servedModel: "test" },
      };
    },
  } as unknown as TextEngine;
  return { engine, sent };
}

const REPLY = JSON.stringify({
  cohort: "photoreal_human",
  role: "a barista",
  sex: "female",
  wardrobe: "a red apron over a plain white tee, dark straight jeans, plain low shoes",
});

describe("the wardrobe question is asked only when it will be read", () => {
  it("⚠ the BASE prompt does not mention the field at all — the dark landing", () => {
    /*
      A prompt is live behaviour. Every fact on a paid sheet comes out of this
      one reply, and this campaign has measured that context is not additive: a
      SUBSET of prompt context raised the stage wall twice as often as its
      superset. So an account outside `CASTING_TWO_PATHS_SCOPE` must receive
      the bytes it received yesterday, and this arm is what says so.
    */
    expect(SYSTEM_PROMPT_FOR_TESTS()).not.toMatch(/"wardrobe"/);
    expect(interpreterSystemPrompt()).toBe(SYSTEM_PROMPT_FOR_TESTS());
    expect(interpreterSystemPrompt({ wardrobe: false })).toBe(SYSTEM_PROMPT_FOR_TESTS());
  });

  it("adds the block — and only the block — when asked", () => {
    const asked = interpreterSystemPrompt({ wardrobe: true });
    expect(asked).toMatch(/"wardrobe"/);
    expect(asked.startsWith(SYSTEM_PROMPT_FOR_TESTS())).toBe(true);
    /* The bound the picker is given, in the prompt rather than only in a
       docblock: the door refuses these, and an instruction that never mentions
       them makes every refusal a surprise. */
    for (const bound of ["No weapons", "No props", "hats", "logos"]) {
      expect(asked, bound).toContain(bound);
    }
  });

  it("⚠ AT THE WIRE — the flag is the only variable in what the transport receives", async () => {
    /*
      Invariant 5. A contract about what gets SENT is proven on the outgoing
      request, and this campaign's own named failure is a feature that passed
      two benches while nothing carried it to the engine.
    */
    const off = recordingEngine(REPLY);
    await interpretBrief({ briefText: "a barista in a red apron", engine: off.engine });
    const on = recordingEngine(REPLY);
    await interpretBrief({
      briefText: "a barista in a red apron",
      engine: on.engine,
      wardrobe: true,
    });

    expect(off.sent).toHaveLength(1);
    expect(on.sent).toHaveLength(1);
    expect(off.sent[0].system).not.toMatch(/"wardrobe"/);
    expect(on.sent[0].system).toMatch(/"wardrobe"/);
    /* CONTROL — the two prompts really are the same prompt plus one block, so
       the arm above is reading the block and not two unrelated strings. */
    expect(on.sent[0].system.startsWith(off.sent[0].system)).toBe(true);
  });

  it("carries the picked outfit through the parse when it was asked for", async () => {
    const { engine } = recordingEngine(REPLY);
    const outcome = await interpretBrief({
      briefText: "a barista in a red apron",
      engine,
      wardrobe: true,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.intent.wardrobe).toContain("red apron");
    /* It is COMPLETE — the sheet is waist-up but the signed portrait set is
       full length, so bottoms and footwear are the point of the field. */
    expect(outcome.intent.wardrobe).toContain("jeans");
  });
});

describe("the pick goes through §4.1's door on its way into the intent", () => {
  it("admits an ordinary outfit and returns it unchanged", () => {
    const line = "dark canvas work jacket, straight jeans, plain boots";
    expect(parseWardrobePick(line)).toBe(line);
  });

  it("⚠ refuses a costume rather than repairing it — and the roll still runs", () => {
    /*
      The garment guard's founder ruling: never patch a language model's output
      with code, and never fail a roll over it. `null` is §4(c), the house line,
      which is today's picture — so a refused pick costs the customer a choice
      she never made and nothing else.
    */
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(parseWardrobePick("a hide tunic, bare feet, and a heavy wooden club")).toBeNull();
      expect(parseWardrobePick("a work jacket, jeans, boots, and a baseball cap")).toBeNull();
      expect(parseWardrobePick("a graphic tee with a slogan, jeans, plain shoes")).toBeNull();
    } finally {
      warn.mockRestore();
    }
  });

  it("treats absence as absence", () => {
    expect(parseWardrobePick(null)).toBeNull();
    expect(parseWardrobePick(undefined)).toBeNull();
    expect(parseWardrobePick("")).toBeNull();
    expect(parseWardrobePick(17)).toBeNull();
  });

  it("⚠ IS NOT SOURCE-CONTAINED, and that is the declared exception", () => {
    /*
      Every other free value in this product must appear in the customer's own
      sentence (D-172), and case (b) cannot: "a caveman" names no clothes. This
      arm pins the exception so that a future author reaching for
      `tokensComeFromBrief` here — the obvious tidy — finds a red test and this
      paragraph rather than an empty feature.
    */
    const reply = JSON.stringify({
      cohort: "photoreal_human",
      role: "a caveman",
      wardrobe: "a one-shoulder hide tunic, rough-cut, and bare feet",
    });
    const parsed = parseCastingIntent(reply, "a caveman");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.intent.wardrobe).toContain("hide tunic");
    /* CONTROL — a contained field on the SAME reply and the SAME brief really
       does drop an invention, so the arm above is measuring this field's
       exception and not a parse that checks nothing. */
    const contained = parseCastingIntent(
      JSON.stringify({ cohort: "photoreal_human", statedAccessories: ["a bone necklace"] }),
      "a caveman",
    );
    expect(contained.ok).toBe(true);
    if (!contained.ok) return;
    expect(contained.intent.statedAccessories).toEqual([]);
  });
});
