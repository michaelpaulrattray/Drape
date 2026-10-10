/**
 * "SAY IT YOUR WAY" — THE TRANSLATION, DRIVEN (#2197 / #2205).
 *
 * Four things are proven here, each against the real module and a recording
 * text engine that never reaches a provider:
 *
 *   1. **the Sign's instruction did not move** when its craft rules were
 *      factored out for this road to share — pinned against digests of the
 *      text as it stood BEFORE the refactor, one per pronoun set;
 *   2. **the translation reuses those rules rather than a copy** — every line
 *      of the matching blocks is in the translation's instruction, read off
 *      `castPersonaCraftRules` itself, and the OTHER line's blocks are not;
 *   3. **what is sent at the wire** — one call, its own census word, text only,
 *      the customer's sentence and the cast's pronouns in the user turn;
 *   4. **every failure is `nothing`, and the customer's sentence is never in a
 *      log line** — the logger is recorded and searched for the sentence.
 */
import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const logged: unknown[] = [];
vi.mock("../logging/logger", () => {
  const record = (...args: unknown[]) => {
    logged.push(args);
  };
  const logger = { info: record, warn: record, error: record, debug: record, trace: record, fatal: record };
  return { createModuleLogger: () => logger, logger };
});

const {
  castPersonaCraftRules,
  castPersonaSystemPrompt,
} = await import("./castPersona");
const {
  castPersonaTranslateSystemPrompt,
  castPersonaTranslateUserPrompt,
  parseCastPersonaTranslation,
  PERSONA_TRANSLATE_TIMEOUT_MS,
  translateCastPersonaOwnWords,
} = await import("./castPersonaTranslate");
const { pronounsForSex } = await import("./castPronouns");
const { CAST_PERSONALITY_MAX_LENGTH, CAST_VOICE_MAX_LENGTH } = await import("../../shared/inputLimits");

import type { TextEngine, TextRequest } from "../providers/types";

const HE = pronounsForSex("male");
const SHE = pronounsForSex("female");
const THEY = pronounsForSex(null);

const BOUNCER = "Basically a tired old bouncer who's seen everything and stopped being surprised.";
const SINGER = "Sounds like a tired blues singer who smokes too much.";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");

/** A text engine that records every request and answers what it is told to. */
function recordingEngine(answer: () => Promise<{ text: string; truncated?: boolean }>) {
  const requests: TextRequest[] = [];
  const engine = {
    id: "recording",
    async complete(request: TextRequest) {
      requests.push(request);
      const reply = await answer();
      return { text: reply.text, truncated: reply.truncated ?? false, latencyMs: 1 };
    },
  } as unknown as TextEngine;
  return { engine, requests };
}

beforeEach(() => {
  logged.length = 0;
});

/* ------------------------------------------ 1 · the Sign's text did not move */

describe("the Sign's instruction is byte-for-byte what it was before the rules were shared", () => {
  /*
    The digests were taken from `castPersonaSystemPrompt` on origin/main
    (51f451bb8) BEFORE `castPersonaCraftRules` existed, for all three pronoun
    sets. *Context is not additive* is a measured law here: one moved clause
    moves every Sign's draft, so a refactor that "only" rearranged it is
    proven by the bytes, not by reading the diff.
  */
  it.each([
    ["he", HE, "4df6dfe2695a8a1cd009d89d487908185c92618b15979d58b7bda929717d9701"],
    ["she", SHE, "fdc103cbdbd368f2d8c3268e0576bebcf63f0f9e28702f9c5a691eabe58f4997"],
    ["they", THEY, "00f526bd7236c855b85842584e0c861a4ed1cbc442c4f358d5edd5d10d9ad5f7"],
  ] as const)("for a %s cast", (_label, pronouns, digest) => {
    expect(sha(castPersonaSystemPrompt(pronouns))).toBe(digest);
  });
});

/* ------------------------------------------- 2 · one copy of the craft rules */

describe("the translation's instruction is built from the Sign's craft rules, not a copy", () => {
  const rules = castPersonaCraftRules(HE);
  const linesOf = (...blocks: string[][]) => blocks.flat().filter((line) => line.trim().length > 0);

  it("the personality door carries every line of the personality, camera-only, writing and length blocks", () => {
    const prompt = castPersonaTranslateSystemPrompt("personality", HE);
    for (const line of linesOf(rules.personality, rules.cameraOnly, rules.writing, rules.length, rules.personalityExample)) {
      expect(prompt).toContain(line);
    }
    /* NEGATIVE CONTROL: the other card's blocks are absent, so a door asked
       for a personality is never also asked for a voice. */
    for (const line of linesOf(rules.voice, rules.voiceExample)) {
      expect(prompt).not.toContain(line);
    }
    expect(prompt).toContain('{"line": "..."}');
  });

  it("the voice door carries every line of the voice, writing and length blocks, and not the personality's", () => {
    const prompt = castPersonaTranslateSystemPrompt("voice", HE);
    for (const line of linesOf(rules.voice, rules.writing, rules.length, rules.voiceExample)) {
      expect(prompt).toContain(line);
    }
    for (const line of linesOf(rules.personality, rules.personalityExample)) {
      expect(prompt).not.toContain(line);
    }
  });

  it("speaks the cast's own pronouns, the object form included", () => {
    expect(castPersonaTranslateSystemPrompt("personality", HE)).toContain("Write about him in the third person");
    expect(castPersonaTranslateSystemPrompt("personality", THEY)).toContain("Write about them in the third person");
  });
});

/* ------------------------------------------------------ 3 · what is sent */

describe("one press is one text call, at the wire", () => {
  it("sends its own census word, no picture, and the sentence and pronouns in the user turn", async () => {
    const { engine, requests } = recordingEngine(async () => ({
      text: JSON.stringify({ line: "A gravel voice, low and slow. Answers late and short." }),
    }));
    const outcome = await translateCastPersonaOwnWords({ engine, line: "voice", ownWords: SINGER, pronouns: HE });

    expect(outcome).toEqual({ kind: "line", text: "A gravel voice, low and slow. Answers late and short." });
    expect(requests).toHaveLength(1);
    const request = requests[0]!;
    expect(request.about).toBe("persona.translate");
    expect(request.images ?? []).toEqual([]);
    expect(request.json).toBe(true);
    expect(request.temperature).toBe(0);
    expect(request.reasoning).toBe("off");
    expect(request.timeoutMs).toBe(PERSONA_TRANSLATE_TIMEOUT_MS);
    expect(request.retries).toBe(1);
    expect(request.system).toBe(castPersonaTranslateSystemPrompt("voice", HE));
    expect(request.user).toBe(castPersonaTranslateUserPrompt(SINGER, HE));
    expect(request.user).toContain(SINGER);
    expect(request.user).toContain("PRONOUNS: he / him / his");
    /* The customer's words are in the USER turn only — never folded into the
       instruction, where they would read as our rules. */
    expect(request.system).not.toContain(SINGER);
  });
});

/* ------------------------------------- 4 · every failure is `nothing`, quietly */

describe("a failed translation answers nothing and never logs the customer's sentence", () => {
  const cases: Array<[string, () => Promise<{ text: string; truncated?: boolean }>]> = [
    ["the call throws", async () => { throw new Error(`provider said no to: ${BOUNCER}`); }],
    ["the reply is cut off at the ceiling", async () => ({ text: '{"line": "Stands at', truncated: true })],
    ["the reply is not JSON", async () => ({ text: `Sure! ${BOUNCER}` })],
    ["the reply is the wrong shape", async () => ({ text: JSON.stringify({ personality: BOUNCER }) })],
    ["the line is over its cap with no sentence end inside it", async () => ({
      text: JSON.stringify({ line: "x".repeat(CAST_PERSONALITY_MAX_LENGTH + 10) }),
    })],
  ];

  it.each(cases)("when %s", async (_label, answer) => {
    const { engine } = recordingEngine(answer);
    const outcome = await translateCastPersonaOwnWords({ engine, line: "personality", ownWords: BOUNCER, pronouns: SHE });
    expect(outcome).toEqual({ kind: "nothing" });

    /* POSITIVE CONTROL first: the failure WAS logged, so the search below is
       over real log lines rather than an empty recorder. */
    expect(logged.length).toBeGreaterThan(0);
    /* ⚠ The thrown error is logged as `err` and its own message carries the
       sentence in the first case — that is the provider's prose, the same
       shape every other text road logs. What is asserted is that THIS module
       never puts the sentence in a log line itself: no field of ours holds it. */
    for (const entry of logged as unknown[][]) {
      const [fields, message] = entry;
      expect(String(message ?? "")).not.toContain("bouncer");
      if (fields && typeof fields === "object") {
        for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
          if (key === "err") continue;
          expect(JSON.stringify(value)).not.toContain("bouncer");
        }
      }
    }
  });
});

describe("the reply is fitted to the line's own cap, at a sentence end", () => {
  it("cuts an over-long personality at its last full stop inside the cap", () => {
    const first = `${"Stands square at the door".padEnd(CAST_PERSONALITY_MAX_LENGTH - 50, " and still")}.`;
    const line = `${first} ${"Then moves".padEnd(200, " slowly")}.`;
    expect(parseCastPersonaTranslation(JSON.stringify({ line }), "personality")).toBe(first);
  });

  it("holds the voice to the VOICE cap, not the personality's", () => {
    const first = `${"A low voice".padEnd(CAST_VOICE_MAX_LENGTH - 40, " and dry")}.`;
    const line = `${first} ${"Talks".padEnd(120, " slowly")}.`;
    expect(line.length).toBeLessThan(CAST_PERSONALITY_MAX_LENGTH);
    expect(parseCastPersonaTranslation(JSON.stringify({ line }), "voice")).toBe(first);
    /* NEGATIVE CONTROL: the same reply as a personality fits whole. */
    expect(parseCastPersonaTranslation(JSON.stringify({ line }), "personality")).toBe(line);
  });

  it("reads a fenced reply, which some models send despite being asked", () => {
    expect(parseCastPersonaTranslation('```json\n{"line": "Low and slow."}\n```', "voice")).toBe("Low and slow.");
  });
});
