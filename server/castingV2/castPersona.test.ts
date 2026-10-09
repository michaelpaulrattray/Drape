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
  parseCastPersonaLines,
  PERSONA_EDIT_SENTENCE_LIMIT,
  PERSONA_EDIT_SENTENCE_MAX_CHARS,
  PERSONA_MAX_OUTPUT_TOKENS,
  PERSONA_TIMEOUT_MS,
} from "./castPersona";
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
    expect(parseCastPersonaLines(good)).not.toBeNull();
  });

  it("refuses a JSON array", () => {
    expect(parseCastPersonaLines('["a","b"]')).toBeNull();
  });

  it("refuses null", () => {
    expect(parseCastPersonaLines("null")).toBeNull();
  });

  it("refuses an empty string", () => {
    expect(parseCastPersonaLines("")).toBeNull();
  });
});
