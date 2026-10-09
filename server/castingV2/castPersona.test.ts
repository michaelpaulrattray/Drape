/**
 * N2b's reader, DRIVEN — personality and voice born at Sign (#1242).
 *
 * ⚠ **WORKING LAW 3: the guard is driven directly, never through the model.**
 * Every arm below hands `createCastPersonaReader` a fake `TextEngine` and reads
 * what it does with a reply, so the behaviour that matters — a failed read
 * writes NOTHING — is proven by a reply we chose rather than by a live model
 * happening to misbehave on the day.
 *
 * ⚠ **AND THE ASK IS ASSERTED AT THE WIRE (invariant 5).** Several arms read the
 * `TextRequest` the engine actually received rather than a constant near the
 * call: the three sources reaching the reader, and the census word the price is
 * accounted under, are both facts about the outgoing request.
 *
 * The POSITIVE control is first and it is load-bearing: a suite of refusal arms
 * passes perfectly if the reader refuses everything, which would be the feature
 * never working at all.
 */
import { describe, expect, it, vi } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import { ProviderError } from "../providers/types";
import { renderLikeFrame } from "../testing/renderLikeFrame";
import {
  castPersonaEditBlock,
  castPersonaSystemPrompt,
  createCastPersonaReader,
  fitToHerCap,
  parseCastPersonaDraft,
  PERSONA_EDIT_SENTENCE_LIMIT,
  PERSONA_EDIT_SENTENCE_MAX_CHARS,
  PERSONA_MAX_OUTPUT_TOKENS,
  PERSONA_TIMEOUT_MS,
} from "./castPersona";
import {
  CAST_PERSONALITY_MAX_LENGTH,
  CAST_VOICE_MAX_LENGTH,
} from "../../shared/inputLimits";
import type { CastPronouns } from "./castPronouns";

/* A real decodable frame: `boundForJudge` re-encodes on the way out and FAILS
   OPEN on bytes it cannot read, so ASCII fixtures would reach the wire intact
   and an arm about bounding would pass for the wrong reason. */
const anchor = { bytes: await renderLikeFrame(64, 96), contentType: "image/png" };

const she: CastPronouns = { subject: "she", object: "her", possessive: "her", plural: false };
const they: CastPronouns = { subject: "they", object: "them", possessive: "their", plural: true };

const good = JSON.stringify({
  personality:
    "Square-shouldered and still — weight on the back foot, hands loose at the sides. Tips the chin down and looks away the instant anyone speaks to her directly.",
  voice: "Flat, mid-register, clipped at the ends; drops almost to nothing on a question.",
});

function engineReturning(text: string, extra: Partial<{ truncated: boolean }> = {}): TextEngine {
  return {
    id: "test-persona",
    complete: vi.fn(async () => ({
      text,
      latencyMs: 1,
      provenance: { provider: "openrouter" as const, model: "test" },
      ...extra,
    })),
  };
}

function request(overrides: Partial<Parameters<ReturnType<typeof createCastPersonaReader>["read"]>[0]> = {}) {
  return {
    anchor,
    brief: "a tired night-shift paramedic, late thirties",
    editSentences: ["give her shorter hair", "actually make the jacket darker"],
    pronouns: she,
    ...overrides,
  };
}

describe("the persona reader — the positive control first", () => {
  it("returns both lines from a well-formed reply", async () => {
    const reader = createCastPersonaReader({ engine: engineReturning(good) });
    const lines = await reader.read(request());

    expect(lines).not.toBeNull();
    expect(lines?.personality).toContain("Square-shouldered");
    expect(lines?.voice).toContain("mid-register");
  });

  it("trims whitespace the model leaves on either line", async () => {
    const reader = createCastPersonaReader({
      engine: engineReturning(JSON.stringify({ personality: "  Still and square.  ", voice: "\n Low. \n" })),
    });
    const lines = await reader.read(request());

    expect(lines).toEqual({ personality: "Still and square.", voice: "Low." });
  });

  it("reads a reply the model fenced as a code block", async () => {
    const reader = createCastPersonaReader({ engine: engineReturning("```json\n" + good + "\n```") });

    expect(await reader.read(request())).not.toBeNull();
  });
});

describe("a read that fails writes NOTHING — his brief's own rule", () => {
  /*
    Each of these is a road to an empty card, and the product answer is the same
    on all of them: no lines, no badge. An invented line would be worse than no
    line, and a badge over nothing is a feature that looks broken.
  */
  it("a reply that is not JSON derives no lines", async () => {
    const reader = createCastPersonaReader({ engine: engineReturning("She seems nice!") });

    expect(await reader.read(request())).toBeNull();
  });

  it("a reply missing the voice line derives no lines", async () => {
    const reader = createCastPersonaReader({
      engine: engineReturning(JSON.stringify({ personality: "Still and square." })),
    });

    expect(await reader.read(request())).toBeNull();
  });

  it("⚠ BOTH LINES OR NEITHER — one empty string is a failed read, not a half answer", async () => {
    const reader = createCastPersonaReader({
      engine: engineReturning(JSON.stringify({ personality: "Still and square.", voice: "   " })),
    });

    expect(await reader.read(request())).toBeNull();
  });

  it("a reply carrying an extra field derives no lines — the schema is strict", async () => {
    const reader = createCastPersonaReader({
      engine: engineReturning(
        JSON.stringify({ personality: "Still and square.", voice: "Low.", confidence: 0.9 }),
      ),
    });

    expect(await reader.read(request())).toBeNull();
  });

  it("a reply cut off at the token ceiling derives no lines and is not retried here", async () => {
    const engine = engineReturning(good, { truncated: true });
    const reader = createCastPersonaReader({ engine });

    expect(await reader.read(request())).toBeNull();
    /* One attempt from this module. The engine owns its own retry and has
       already paid it; a third try would cost the house money on every Sign. */
    expect(engine.complete).toHaveBeenCalledTimes(1);
  });

  it("a transport failure derives no lines rather than throwing into the mint", async () => {
    const engine: TextEngine = {
      id: "test-persona",
      complete: vi.fn(async () => {
        throw new ProviderError("transport", "the reader could not be reached");
      }),
    };
    const reader = createCastPersonaReader({ engine });

    /* It must NOT throw: the mint calls this off the customer's wait, and a
       rejection escaping here would reach a Sign that has already been paid. */
    await expect(reader.read(request())).resolves.toBeNull();
  });

  it("a content refusal derives no lines", async () => {
    const engine: TextEngine = {
      id: "test-persona",
      complete: vi.fn(async () => {
        throw new ProviderError("content_policy", "refused");
      }),
    };

    expect(await createCastPersonaReader({ engine }).read(request())).toBeNull();
  });
});

describe("the ask, asserted at the wire", () => {
  async function sent(overrides: Parameters<typeof request>[0] = {}): Promise<TextRequest> {
    let seen: TextRequest | null = null;
    const engine: TextEngine = {
      id: "test-persona",
      complete: vi.fn(async (req: TextRequest) => {
        seen = req;
        return { text: good, latencyMs: 1, provenance: { provider: "openrouter" as const, model: "t" } };
      }),
    };
    await createCastPersonaReader({ engine }).read(request(overrides));
    expect(seen).not.toBeNull();
    return seen as unknown as TextRequest;
  }

  it("files its price under its own census word, so the cost per Sign is answerable", async () => {
    expect((await sent()).about).toBe("persona");
  });

  it("posts exactly ONE picture — the frame she signed", async () => {
    const req = await sent();

    expect(req.images).toHaveLength(1);
    /* Bounded on the way out, so the bytes are re-encoded rather than the
       fixture's: what survives is that a picture went, and only one. */
    expect(req.images?.[0]?.bytes.length).toBeGreaterThan(0);
  });

  it("carries all three of his sources: the brief, her corrections and the picture", async () => {
    const req = await sent();

    expect(req.user).toContain("tired night-shift paramedic");
    expect(req.user).toContain("give her shorter hair");
    expect(req.user).toContain("actually make the jacket darker");
    expect(req.images).toHaveLength(1);
  });

  it("asks for reasoning off and a ceiling and deadline sized for two short lines", async () => {
    const req = await sent();

    expect(req.reasoning).toBe("off");
    expect(req.maxOutputTokens).toBe(PERSONA_MAX_OUTPUT_TOKENS);
    expect(req.timeoutMs).toBe(PERSONA_TIMEOUT_MS);
    expect(req.temperature).toBe(0);
    expect(req.json).toBe(true);
  });

  it("says so plainly when she typed no brief, rather than sending an empty heading", async () => {
    expect((await sent({ brief: null })).user).toContain("read the photograph alone");
  });

  it("says so plainly when she refined nothing", async () => {
    expect((await sent({ editSentences: [] })).user).toContain("refined nothing");
  });

  it("carries HER pronouns into the instruction, not a default", async () => {
    const forThey = await sent({ pronouns: they });

    expect(forThey.system).toContain("they");
    expect(forThey.system).toContain("their");
  });
});

describe("her own sentences are bounded before they become an ask", () => {
  it("keeps the NEWEST sentences when there are more than the limit", () => {
    const many = Array.from({ length: PERSONA_EDIT_SENTENCE_LIMIT + 5 }, (_, i) => `change number ${i}`);
    const block = castPersonaEditBlock(many);

    /* The last correction is the state of the face; the one it overruled is not. */
    expect(block).toContain(`change number ${PERSONA_EDIT_SENTENCE_LIMIT + 4}`);
    expect(block).not.toContain("change number 0");
    expect(block.split("\n")).toHaveLength(PERSONA_EDIT_SENTENCE_LIMIT);
  });

  it("caps one long paste so it cannot become the whole ask", () => {
    const block = castPersonaEditBlock(["x".repeat(PERSONA_EDIT_SENTENCE_MAX_CHARS + 500)]);

    expect(block.length).toBeLessThanOrEqual(PERSONA_EDIT_SENTENCE_MAX_CHARS + 2);
  });

  it("drops blank sentences rather than sending empty bullets", () => {
    expect(castPersonaEditBlock(["   ", "\n", ""])).toContain("refined nothing");
  });
});

describe("what the instruction is not allowed to ask for", () => {
  const prompt = castPersonaSystemPrompt(she);

  it("asks for camera-visible traits and names the inner-state exclusion", () => {
    expect(prompt).toContain("ONLY what a camera can see");
    expect(prompt).toMatch(/physical tell/i);
  });

  it("asks for the baseline-then-exception shape his specimen has", () => {
    expect(prompt).toMatch(/baseline/i);
    expect(prompt).toMatch(/exception/i);
  });

  it("⚠ hands his specimens over as FORM and forbids their wording", () => {
    /* A reader given an exemplar copies it unless something stops it, and
       "holds eye contact a beat too long" on every cast in the product would be
       this feature failing in the most visible way available. */
    expect(prompt).toContain("FORM");
    expect(prompt).toMatch(/not reuse their phrases/i);
  });

  it("⚠ never asks the reader about the photography — it is not a judge", () => {
    /* The checker's own lesson (#1903/#1612): a reader handed a specification
       volunteers an opinion about it. This reader is given no framing, no
       wardrobe and no quality question at all; it is told not to mention them. */
    expect(prompt).toMatch(/Do not mention photography/i);
  });
});

describe("the parse, driven without an engine at all", () => {
  it("reads a good reply", () => {
    expect(parseCastPersonaDraft(good)).not.toBeNull();
  });

  it("refuses a JSON array", () => {
    expect(parseCastPersonaDraft('["a","b"]')).toBeNull();
  });

  it("refuses null", () => {
    expect(parseCastPersonaDraft("null")).toBeNull();
  });

  it("refuses an empty string", () => {
    expect(parseCastPersonaDraft("")).toBeNull();
  });
});

/**
 * A DRAFTED LINE SHE CAN ACTUALLY EDIT — the relay's finding 3 on PR #2114.
 *
 * The caps in `shared/inputLimits.ts` were HER ceiling and bounded nothing we
 * wrote, so a long reply was stored and drawn and then she could not save a
 * one-word change to it: `editCastPersonaField` refuses over the cap and the
 * textarea's `maxLength` will not even let her type. **The product writing a
 * line the product then refuses is the machinery showing through.**
 */
describe("a drafted line is fitted to the cap she will be held to", () => {
  const reply = (personality: string, voice: string) =>
    JSON.stringify({ personality, voice });

  it("leaves a line that already fits exactly as it came", () => {
    const line = "Unhurried and sure of herself — deliberate movements, holds eye contact.";
    expect(fitToHerCap(line, CAST_PERSONALITY_MAX_LENGTH)).toBe(line);
  });

  it("cuts an over-long line back to its last whole sentence", () => {
    const keep = "Watchful, and slower to speak than the room expects.";
    const line = `${keep} ${"And then a second sentence that runs on. ".repeat(12)}`;
    const fitted = fitToHerCap(line, CAST_PERSONALITY_MAX_LENGTH);

    expect(fitted.length).toBeLessThanOrEqual(CAST_PERSONALITY_MAX_LENGTH);
    expect(fitted.startsWith(keep)).toBe(true);
    /* A whole sentence, not a cut word: the last character is the full stop. */
    expect(fitted.endsWith(".")).toBe(true);
  });

  it("gives up rather than truncating mid-word when no sentence end is in reach", () => {
    expect(fitToHerCap("x".repeat(CAST_VOICE_MAX_LENGTH + 40), CAST_VOICE_MAX_LENGTH)).toBe("");
  });

  it("treats a full stop with nothing in front of it as no sentence at all", () => {
    expect(fitToHerCap(`.${"x".repeat(CAST_VOICE_MAX_LENGTH + 10)}`, CAST_VOICE_MAX_LENGTH)).toBe("");
  });

  /* ------------------------------------------- and through the real parse */

  it("a reply whose voice line is over the cap is fitted, not stored long", () => {
    const voice = `Low and unhurried. ${"The vowels sit a long way back in the throat. ".repeat(6)}`;
    expect(voice.length).toBeGreaterThan(CAST_VOICE_MAX_LENGTH);

    const draft = parseCastPersonaDraft(reply("Watchful, hands still.", voice));

    expect(draft).not.toBeNull();
    /*
      ⚠ IT KEEPS AS MANY WHOLE SENTENCES AS FIT, not just the first — which is
      what `lastIndexOf` means and is the right answer: a draft should be as
      much of what was written as she can be held to. This arm first asserted
      `"Low and unhurried."` alone and the code was right.
    */
    expect(draft!.voice.length).toBeLessThanOrEqual(CAST_VOICE_MAX_LENGTH);
    expect(draft!.voice.startsWith("Low and unhurried.")).toBe(true);
    expect(draft!.voice.endsWith(".")).toBe(true);
    /* No half sentence at the end: every sentence in it is one the reply wrote
       in full. */
    expect(draft!.voice).not.toMatch(/\bthe vowels sit a long way back in the$/i);
    /* ⚠ And the OTHER line survives untouched. Failing the whole read on one
       long line would throw away a good personality — which is what the
       both-or-neither rule would have done if this were a refusal. */
    expect(draft!.personality).toBe("Watchful, hands still.");
  });

  it("a reply with an unfittable line is a FAILED read, so no half card is drawn", () => {
    const draft = parseCastPersonaDraft(
      reply("Watchful, hands still.", "x".repeat(CAST_VOICE_MAX_LENGTH + 40)),
    );
    expect(draft).toBeNull();
  });

  it.each([
    ["personality", CAST_PERSONALITY_MAX_LENGTH],
    ["voice", CAST_VOICE_MAX_LENGTH],
  ] as const)("whatever the parse returns for %s is within her cap", (line, cap) => {
    /*
      ⚠ DRIVEN OVER BOTH LINES WITH ONE LONG REPLY, because the two caps are
      different numbers and a fit applied to one line only would pass an arm
      written about the other. This is the arm that reddens if a third line is
      added and left unfitted.
    */
    const long = `A real first sentence. ${"and then it keeps going without stopping ".repeat(20)}`;
    const draft = parseCastPersonaDraft(
      line === "voice" ? reply("Watchful.", long) : reply(long, "Low."),
    );
    expect(draft).not.toBeNull();
    expect(draft![line].length).toBeLessThanOrEqual(cap);
  });
});
