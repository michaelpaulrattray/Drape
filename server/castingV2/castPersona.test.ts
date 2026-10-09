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
  fitToCap,
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

  it("asks for the baseline-then-break shape his specimen has", () => {
    expect(prompt).toMatch(/baseline/i);
    /* His craft correction (#2136) calls it a BREAK rather than an exception,
       and the clause says there is exactly one of them. */
    expect(prompt).toMatch(/single break|one thing that breaks|ONE thing that breaks/);
  });

  /*
    HIS THREE CRAFT RULES — card #2136, from the Desk item recording "Mike's
    corrections, verbatim". Each is pinned as its own arm, because the court
    measured that the instruction is what moves the output: the before arm,
    missing these clauses, produced no timing sentence and no performance half
    on any of his three casts.
  */
  it("⚠ rule 1 — gives each personality sentence its own job: rest, then timing", () => {
    expect(prompt).toMatch(/SENTENCE ONE/);
    expect(prompt).toMatch(/at REST/);
    expect(prompt).toMatch(/SENTENCE TWO/);
    expect(prompt).toMatch(/TIMING/);
    /* The order is load-bearing: rest first, timing second, as he wrote it. */
    expect(prompt.indexOf("SENTENCE ONE")).toBeLessThan(prompt.indexOf("SENTENCE TWO"));
  });

  it("⚠ rule 2 — makes translating a feeling into a camera-word OUR job, not the customer's", () => {
    /* His words: "Menacing" is not storable; "moves all at once, without
       wind-up" is. The translation is the engine's job, never the customer's. */
    expect(prompt).toMatch(/menacing/i);
    expect(prompt).toMatch(/YOUR work/);
    expect(prompt).toMatch(/not the customer's/);
  });

  it("⚠ rule 3 — requires BOTH voice halves: the sound of it, then how it is used", () => {
    expect(prompt).toMatch(/timbre/i);
    expect(prompt).toMatch(/USES it/);
    expect(prompt).toMatch(/how a question/i);
    expect(prompt).toMatch(/Both halves are required/);
  });

  it("⚠ no longer tells the reader to ignore what the voice says — that clause CONTRADICTED rule 3", () => {
    /* The instruction used to end the voice clause with "never what it says",
       which forbids the performance half he asked for by name. A sweep for the
       old sentence is the only thing that keeps it from drifting back in. */
    expect(prompt).not.toMatch(/never what it says/i);
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

/*
 * THE CAPS FIT HIS OWN SPECIMEN — card #2136, and the arm that would have gone
 * red before it.
 *
 * `fitToCap` cuts at a SENTENCE END, so a line one character over the cap loses
 * its entire second sentence — which under his craft rules is the exact half
 * the correction added. The old numbers therefore deleted the feature while
 * looking like a harmless bound: measured on three of his production casts,
 * the voice was cut 3 of 3 and the personality 2 of 3.
 */
describe("the caps fit the shape his craft rules produce (#2136)", () => {
  /** His own Pigman specimen, from the card. The product must store it whole. */
  const hisPersonality = "Stands planted and square, chin level, clouded eyes fixed forward "
    + "without blinking rhythm; the one break is the jaw, which hangs faintly open as though "
    + "the tusks no longer fit the mouth that holds them. Slow to move and slower to answer: "
    + "ignores what is said until it is said twice, then moves all at once, without wind-up.";
  const hisVoice = "A wet, dragging rumble that stays flat for whole sentences, then catches "
    + "on a phlegmy snag before pushing through. Says little: three or four words after a "
    + "pause, and a question gets ignored until it is asked twice.";

  /** The widest line the court actually measured through the real reader. */
  const MEASURED_WIDEST_PERSONALITY = 474;
  const MEASURED_WIDEST_VOICE = 303;

  it("keeps his own voice specimen whole", () => {
    expect(hisVoice.length).toBe(215);
    expect(fitToCap(hisVoice, CAST_VOICE_MAX_LENGTH)).toBe(hisVoice);
  });

  it("keeps his own personality specimen whole", () => {
    expect(hisPersonality.length).toBe(323);
    expect(fitToCap(hisPersonality, CAST_PERSONALITY_MAX_LENGTH)).toBe(hisPersonality);
  });

  it("⚠ NEGATIVE CONTROL — the OLD caps cut his specimen, and cut the half he added", () => {
    /* Drives the defect rather than asserting the repair: at 200 his voice
       loses its second sentence entirely, which is the performance style. */
    const cutAtOldCap = fitToCap(hisVoice, 200);
    expect(cutAtOldCap).not.toBe(hisVoice);
    expect(cutAtOldCap).not.toMatch(/Says little/);
    expect(hisVoice).toMatch(/Says little/);
  });

  it("⚠ leaves headroom above the widest line the court measured, not just at it", () => {
    /* A cap sized to the three casts measured would cut the fourth. */
    expect(CAST_VOICE_MAX_LENGTH).toBeGreaterThan(MEASURED_WIDEST_VOICE);
    expect(CAST_PERSONALITY_MAX_LENGTH).toBeGreaterThan(MEASURED_WIDEST_PERSONALITY);
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
 * A DRAFTED LINE A CUSTOMER CAN ACTUALLY EDIT — the relay's finding 3 on PR #2114.
 *
 * The caps in `shared/inputLimits.ts` were the CUSTOMER's ceiling and bounded
 * nothing we wrote, so a long reply was stored and drawn and then a one-word
 * change to it could not be saved: `editCastPersonaField` refuses over the cap
 * and the textarea's `maxLength` will not even let it be typed. **The product writing a
 * line the product then refuses is the machinery showing through.**
 */
describe("a drafted line is fitted to the cap the customer is held to", () => {
  const reply = (personality: string, voice: string) =>
    JSON.stringify({ personality, voice });

  it("leaves a line that already fits exactly as it came", () => {
    const line = "Unhurried and self-assured — deliberate movements, holds eye contact.";
    expect(fitToCap(line, CAST_PERSONALITY_MAX_LENGTH)).toBe(line);
  });

  it("cuts an over-long line back to its last whole sentence", () => {
    const keep = "Watchful, and slower to speak than the room expects.";
    const line = `${keep} ${"And then a second sentence that runs on. ".repeat(12)}`;
    const fitted = fitToCap(line, CAST_PERSONALITY_MAX_LENGTH);

    expect(fitted.length).toBeLessThanOrEqual(CAST_PERSONALITY_MAX_LENGTH);
    expect(fitted.startsWith(keep)).toBe(true);
    /* A whole sentence, not a cut word: the last character is the full stop. */
    expect(fitted.endsWith(".")).toBe(true);
  });

  it("gives up rather than truncating mid-word when no sentence end is in reach", () => {
    expect(fitToCap("x".repeat(CAST_VOICE_MAX_LENGTH + 40), CAST_VOICE_MAX_LENGTH)).toBe("");
  });

  it("treats a full stop with nothing in front of it as no sentence at all", () => {
    expect(fitToCap(`.${"x".repeat(CAST_VOICE_MAX_LENGTH + 10)}`, CAST_VOICE_MAX_LENGTH)).toBe("");
  });

  /* ------------------------------------------- and through the real parse */

  it("a reply whose voice line is over the cap is fitted, not stored long", () => {
    /*
      ⚠ THE REPEAT COUNT IS DERIVED FROM THE CAP, NOT TYPED — working law 4.
      It was `.repeat(6)`, sized against a cap of 200, and #2136 raised the cap
      to 320: the fixture quietly stopped being over the cap at all, so the arm
      asserted that an UNDER-cap line is left alone and still went green on the
      strength of its own title. A fixture that mirrors a constant drifts from
      it, and this one drifted in the direction that keeps the test passing.
    */
    const sentence = "The vowels sit a long way back in the throat. ";
    let voice = "Low and unhurried. ";
    while (voice.length <= CAST_VOICE_MAX_LENGTH) voice += sentence;
    expect(voice.length).toBeGreaterThan(CAST_VOICE_MAX_LENGTH);

    const draft = parseCastPersonaDraft(reply("Watchful, hands still.", voice));

    expect(draft).not.toBeNull();
    /*
      ⚠ IT KEEPS AS MANY WHOLE SENTENCES AS FIT, not just the first — which is
      what `lastIndexOf` means and is the right answer: a draft should be as
      much of what was written as the customer can be held to. This arm first asserted
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
  ] as const)("whatever the parse returns for %s is within the cap", (line, cap) => {
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
