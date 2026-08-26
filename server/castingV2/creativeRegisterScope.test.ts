/**
 * `CASTING_CREATIVE_REGISTER_SCOPE` — the door on whether a CREATIVE brief
 * compiles in the creative register (`docs/specs/CREATIVE_REGISTER_DESIGN.md`;
 * step 2 of its §5, ordered by the founder's verdict on the court, #16).
 *
 * What these arms hold it to:
 *
 *   1. the LADDER — off by default, absent means off, and it cannot be armed
 *      over a user `CASTING_V2_SCOPE` does not cover;
 *   2. the GATE, BOTH SIDES — off is today's interpreter prompt BYTE FOR BYTE,
 *      and on appends exactly one block, LAST, so every existing pair of flags
 *      keeps the bytes it has today;
 *   3. the SELECTOR IS CONSERVATIVE (§2b) — `engaged` must be literally true,
 *      and a true with no grounds in the brief's own words is read as false;
 *   4. the WIRE — compiled through the real entrance with a stub transport,
 *      read at the CANDIDATE PROMPT (invariant 5): off, the prompts and the
 *      row are byte-identical to today's whatever the model volunteers; on
 *      with an ORDINARY brief, the eight prompts are string-for-string the
 *      unflagged ones; on with a creative brief, the ask is first and
 *      verbatim, the house frame is kept, the house person-prose is gone, and
 *      each slice carries its own line of the card;
 *   5. the CARD IS REFUSED WHOLE, never trimmed — the W arm's lesson — and a
 *      sheet that went without one says so on the row.
 *
 * The WIRE from `validateEnv()` to the coverage check is not this file's job
 * and this file does not claim it.
 */
import { describe, expect, it, vi } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";

import {
  CastingCreativeRegisterCoverageError,
  CastingCreativeRegisterScopeConfigurationError,
  parseCastingCreativeRegisterScope,
  validateCastingCreativeRegisterEnvironment,
} from "./castingV2Scope";
import { INTERPRET_TIMEOUT_MS, interpreterSystemPrompt } from "./interpreter";
import { parseCreativeRegister, CREATIVE_REASONS_LIMIT } from "./castingIntent";
import { castingBriefCompiler } from "./briefCompiler";
import {
  CANDIDATE_CARD_LABEL,
  CARD_MAX_OUTPUT_TOKENS,
  CREATIVE_REGISTER_AUTHORITY,
  composeCreativeCandidatePrompt,
  INVITATION_MAX,
  parseVarianceCard,
  varianceCardSystemPrompt,
} from "./creativeRegister";

/* ------------------------------------------------------------ the ladder */

describe("the ladder", () => {
  it("is off when absent, and off means off", () => {
    expect(parseCastingCreativeRegisterScope(undefined).kind).toBe("off");
    expect(parseCastingCreativeRegisterScope("").kind).toBe("off");
    expect(parseCastingCreativeRegisterScope("off").kind).toBe("off");
  });

  it("refuses a grammar it does not recognise", () => {
    for (const raw of ["on", "true", "users:", "users:0", "users:1,1", "users: 1"]) {
      expect(() => parseCastingCreativeRegisterScope(raw)).toThrow(
        CastingCreativeRegisterScopeConfigurationError,
      );
    }
  });

  it("refuses while casting itself is off — what it governs is the COMPILE of a roll", () => {
    expect(() =>
      validateCastingCreativeRegisterEnvironment({ scope: "users:1", castingScope: "off" }),
    ).toThrow(CastingCreativeRegisterCoverageError);
  });

  it("refuses a user the parent does not cover", () => {
    expect(() =>
      validateCastingCreativeRegisterEnvironment({ scope: "users:1,7", castingScope: "users:1" }),
    ).toThrow(/names users outside CASTING_V2_SCOPE: 7/);
  });

  it("refuses `all` while the parent names specific users", () => {
    expect(() =>
      validateCastingCreativeRegisterEnvironment({ scope: "all", castingScope: "users:1" }),
    ).toThrow(CastingCreativeRegisterCoverageError);
  });

  it("admits a covered user, and admits anything under an open parent", () => {
    expect(
      validateCastingCreativeRegisterEnvironment({ scope: "users:1", castingScope: "users:1,2" }).kind,
    ).toBe("users");
    expect(validateCastingCreativeRegisterEnvironment({ scope: "all", castingScope: "all" }).kind).toBe(
      "all",
    );
    expect(validateCastingCreativeRegisterEnvironment({ scope: "off", castingScope: "off" }).kind).toBe(
      "off",
    );
  });
});

/* ---------------------------------------------------- the gate, both sides */

describe("the gate, both sides", () => {
  it("OFF is today's interpreter prompt byte for byte", () => {
    const off = interpreterSystemPrompt();
    expect(off).not.toContain(`"creativeRegister"`);
    /* Explicitly false rather than merely absent: undefined and false must
       produce the same bytes. */
    expect(interpreterSystemPrompt({ register: false })).toBe(off);
  });

  it("ON appends exactly one block and nothing else", () => {
    const off = interpreterSystemPrompt();
    const on = interpreterSystemPrompt({ register: true });
    expect(on.startsWith(off)).toBe(true);
    const appended = on.slice(off.length);
    expect(appended.startsWith("\n")).toBe(true);
    expect(appended).toContain(`"creativeRegister"`);
    /* The design's §2b, in the model's ear and at the bytes. */
    expect(appended).toContain("AMBIGUITY RESOLVES TO false");
    /* And the lane rule every block carries: never a place to move a fact out
       of `role` or `characterNotes`. */
    expect(appended).toContain("THIS DECIDES A ROUTE AND NOTHING ELSE");
  });

  it("composes LAST, so every existing pair of flags keeps the bytes it has today", () => {
    const off = interpreterSystemPrompt();
    const registerAppended = interpreterSystemPrompt({ register: true }).slice(off.length);
    const withoutRegister = interpreterSystemPrompt({ fidelity: true, ink: true, wardrobe: true });
    const withRegister = interpreterSystemPrompt({
      fidelity: true,
      ink: true,
      wardrobe: true,
      register: true,
    });
    expect(withRegister.startsWith(withoutRegister)).toBe(true);
    expect(withRegister.slice(withoutRegister.length)).toBe(registerAppended);
  });
});

/* ----------------------------------------------- the selector's parse */

const CYBORG =
  "Bald male, mid-40s, pale porcelain skin, heavily weathered. Severe bone structure: "
  + "pronounced brow ridge, deep-set eyes, hard jawline, gaunt cheeks. Intense unsmiling "
  + "expression. Cybernetic augmentation as part of his body: matte-black implant ports "
  + "embedded in his skull above the right temple, a dark mechanical plate along his jawline, "
  + "and his right eye glowing faint amber-red. The augmentations are surgically integrated "
  + "into his skin, not worn";

describe("the selector's parse is conservative (§2b)", () => {
  it("absent, null or malformed is null — the question was not answered", () => {
    expect(parseCreativeRegister(undefined, CYBORG)).toBeNull();
    expect(parseCreativeRegister(null, CYBORG)).toBeNull();
    expect(parseCreativeRegister("CREATIVE", CYBORG)).toBeNull();
    expect(parseCreativeRegister(["creative"], CYBORG)).toBeNull();
  });

  it("`engaged` must be literally true", () => {
    for (const engaged of ["true", 1, "yes", "CREATIVE"]) {
      const reading = parseCreativeRegister(
        { engaged, reasons: ["cybernetic augmentation as part of his body"] },
        CYBORG,
      );
      expect(reading?.engaged).toBe(false);
    }
  });

  it("a true with no grounds is read as false", () => {
    expect(parseCreativeRegister({ engaged: true, reasons: [] }, CYBORG)?.engaged).toBe(false);
    expect(parseCreativeRegister({ engaged: true }, CYBORG)?.engaged).toBe(false);
  });

  it("a true whose every reason paraphrases is read as false — the reasons are HER words", () => {
    const reading = parseCreativeRegister(
      { engaged: true, reasons: ["a futuristic robot man with chrome implants"] },
      CYBORG,
    );
    expect(reading).toEqual({ engaged: false, reasons: [] });
  });

  it("a true with a reason in the brief's own words engages, and keeps the reason", () => {
    const reading = parseCreativeRegister(
      {
        engaged: true,
        reasons: [
          "cybernetic augmentation as part of his body",
          "a futuristic robot man with chrome implants",
          "right eye glowing faint amber-red",
        ],
      },
      CYBORG,
    );
    expect(reading?.engaged).toBe(true);
    expect(reading?.reasons).toEqual([
      "cybernetic augmentation as part of his body",
      "right eye glowing faint amber-red",
    ]);
  });

  it("caps and dedupes the reasons", () => {
    const reading = parseCreativeRegister(
      {
        engaged: true,
        reasons: [
          "cybernetic augmentation",
          "Cybernetic Augmentation",
          "implant ports",
          "mechanical plate",
          "glowing faint amber-red",
        ],
      },
      CYBORG,
    );
    expect(reading?.reasons).toHaveLength(CREATIVE_REASONS_LIMIT);
  });

  it("false is false, and carries no reasons whatever was offered", () => {
    expect(
      parseCreativeRegister({ engaged: false, reasons: ["cybernetic augmentation"] }, CYBORG),
    ).toEqual({ engaged: false, reasons: [] });
  });
});

/* -------------------------------------------------------- the card parse */

describe("the card is refused whole, never trimmed", () => {
  const eight = Array.from({ length: 8 }, (_, i) => `the augmentation carried differently on slice ${i + 1}, seams and edges distinct.`);

  it("exactly the count asked, each distinct and inside the bounds, is a card", () => {
    expect(parseVarianceCard(JSON.stringify({ invitations: eight }), 8)).toEqual(eight);
  });

  it("seven of eight is NOT a card — the W arm rendered 'the first 3' and measured the instrument", () => {
    expect(parseVarianceCard(JSON.stringify({ invitations: eight.slice(0, 7) }), 8)).toBeNull();
    expect(parseVarianceCard(JSON.stringify({ invitations: [...eight, eight[0]] }), 8)).toBeNull();
  });

  it("a long-but-compliant line is a card (#99): 35 words of the register's own vocabulary, over the old 240-character bound", () => {
    /* 35 words, each a word this register actually uses; the gate review of
       PR #94 found the prompt said "12-35 words" while the parser counted 240
       characters, so this exact line used to lose the whole card. The arm
       asserts the line is over the old bound so it cannot pass by being short. */
    const longWords = "augmentation oxidised collarbone mechanical hardware continuing beneath jawline seams scuffed";
    const thirtyFive = Array.from({ length: 35 }, (_, i) => longWords.split(" ")[i % 9]!).join(" ");
    expect(thirtyFive.split(" ")).toHaveLength(35);
    expect(thirtyFive.length).toBeGreaterThan(240);
    expect(thirtyFive.length).toBeLessThanOrEqual(INVITATION_MAX);
    expect(parseVarianceCard(JSON.stringify({ invitations: [...eight.slice(0, 7), thirtyFive] }), 8)).toEqual([...eight.slice(0, 7), thirtyFive]);
    expect(parseVarianceCard(JSON.stringify({ invitations: [...eight.slice(0, 7), "x".repeat(INVITATION_MAX + 1)] }), 8)).toBeNull();
  });

  it("the prompt states the bound in the unit the parser enforces (#99)", () => {
    const prompt = varianceCardSystemPrompt(8);
    expect(prompt).toContain(`${INVITATION_MAX} characters`);
    expect(prompt).not.toMatch(/\d+-\d+ words(?![^.]*characters)/);
  });

  it("a duplicate, an essay, a stub or a non-string refuses the whole card", () => {
    expect(parseVarianceCard(JSON.stringify({ invitations: [...eight.slice(0, 7), eight[0]!] }), 8)).toBeNull();
    expect(parseVarianceCard(JSON.stringify({ invitations: [...eight.slice(0, 7), "x".repeat(INVITATION_MAX + 1)] }), 8)).toBeNull(); /* was a magic 300 — pinned to the bound so raising it cannot silently pass an essay */
    expect(parseVarianceCard(JSON.stringify({ invitations: [...eight.slice(0, 7), "older."] }), 8)).toBeNull();
    expect(parseVarianceCard(JSON.stringify({ invitations: [...eight.slice(0, 7), 42] }), 8)).toBeNull();
  });

  it("strips a label the author repeated, and refuses non-JSON", () => {
    const labelled = eight.map((line) => `THIS CANDIDATE: ${line}`);
    expect(parseVarianceCard(JSON.stringify({ invitations: labelled }), 8)).toEqual(eight);
    expect(parseVarianceCard("not json", 8)).toBeNull();
    expect(parseVarianceCard("[]", 8)).toBeNull();
  });
});

/* -------------------------------------------------------------- compose */

describe("the slice's shape", () => {
  it("the ask first and verbatim, the frame, the authority, the card last", () => {
    const prompt = composeCreativeCandidatePrompt({
      briefText: `  ${CYBORG}  `,
      role: "an augmented-human character actor",
      wardrobeLine: null,
      invitation: "older wear — the ports scuffed at their edges.",
    });
    const parts = prompt.split("\n\n");
    expect(parts[0]).toBe(CYBORG);
    expect(parts[1]).toBe("Every candidate is a credible an augmented-human character actor; vary within that.");
    expect(parts[2]).toContain("FRAMING: Single subject, waist-up");
    expect(parts[2]).toContain("CAMERA: Medium-format sensor");
    expect(parts[2]).toContain("REALISM: RAW skin");
    expect(parts[2]).toContain("PHOTOREALISTIC ONLY");
    expect(parts[2]?.endsWith(CREATIVE_REGISTER_AUTHORITY)).toBe(true);
    expect(parts[3]).toBe(`${CANDIDATE_CARD_LABEL} older wear — the ports scuffed at their edges.`);
    expect(parts).toHaveLength(4);
  });

  it("no role and no card: two parts, and the house tee is the wardrobe clause", () => {
    const prompt = composeCreativeCandidatePrompt({
      briefText: CYBORG,
      role: null,
      wardrobeLine: null,
      invitation: null,
    });
    expect(prompt.split("\n\n")).toHaveLength(2);
    expect(prompt).toContain("WARDROBE: plain unbranded clothing in neutral grey or off-white");
    expect(prompt).not.toContain(CANDIDATE_CARD_LABEL);
  });

  it("a wardrobe line reaches the frame the same way it reaches the house one", () => {
    const prompt = composeCreativeCandidatePrompt({
      briefText: CYBORG,
      role: null,
      wardrobeLine: "a black cotton tank, dark straight jeans, plain black boots",
      invitation: null,
    });
    expect(prompt).toContain("WARDROBE: a black cotton tank, dark straight jeans, plain black boots.");
    expect(prompt).not.toContain("WARDROBE: plain unbranded clothing");
  });

  it("the house person-prose is not in the frame", () => {
    const prompt = composeCreativeCandidatePrompt({
      briefText: CYBORG,
      role: "a man",
      wardrobeLine: null,
      invitation: null,
    });
    for (const houseOnly of [
      "SUBJECT:",
      "PHYSIQUE:",
      "DIRECTION:",
      "PRESENCE:",
      "CASTING CATEGORY (ABSOLUTE)",
      "HERITAGE IS BONE",
      "PRIORITY WHEN INSTRUCTIONS CONFLICT",
      "a costume,",
    ]) {
      expect(prompt, houseOnly).not.toContain(houseOnly);
    }
  });
});

/* --------------------------------------------------------------- the WIRE */

type Engine = TextEngine & { complete: ReturnType<typeof vi.fn> };

/**
 * A stub transport that answers the INTERPRETER with one JSON and the AUTHOR
 * with another, keyed on `about` — so the suite reads which question was put
 * and what came back, at the request.
 */
function engineAnswering(input: {
  creativeRegister?: unknown;
  cards?: (string[] | string)[];
}): Engine {
  let authorCalls = 0;
  const complete = vi.fn(async (request: TextRequest) => {
    const text =
      request.about === "author"
        ? (() => {
            const answer = input.cards?.[authorCalls] ?? [];
            authorCalls += 1;
            return typeof answer === "string" ? answer : JSON.stringify({ invitations: answer });
          })()
        : JSON.stringify({
            cohort: "photoreal_human",
            role: "an augmented man",
            characterNotes: "Bald, severe bone structure, cybernetic augmentation",
            sex: "male",
            ageBand: "40s",
            heritage: [],
            statedAccessories: [],
            ...(input.creativeRegister === undefined ? {} : { creativeRegister: input.creativeRegister }),
          });
    return {
      text,
      latencyMs: 1,
      provenance: { provider: "openrouter" as const, model: "stub-model", servedModel: "stub-model" },
    };
  });
  return { id: "stub", complete } as unknown as Engine;
}

const eightLines = Array.from(
  { length: 8 },
  (_, i) => `the augmentation carried differently on candidate ${i + 1} — distinct seams, distinct wear.`,
);

const ENGAGED = { engaged: true, reasons: ["cybernetic augmentation as part of his body"] };

const sent = (engine: Engine, about: string): TextRequest[] =>
  engine.complete.mock.calls
    .map((call: unknown[]) => call[0] as TextRequest)
    .filter((request) => request.about === about);

describe("the WIRE — off is today's product to the byte, whatever the model volunteers", () => {
  it("the interpreter is not asked, the author is never called, the row carries no register", async () => {
    const engine = engineAnswering({ creativeRegister: ENGAGED, cards: [eightLines] });
    const compiled = await castingBriefCompiler({
      briefText: CYBORG,
      candidateCount: 8,
      rollSeed: "wire-off",
      engine,
    });
    /* However many times the interpreter is sampled (D-83's retry is its own
       business), not one of those requests carries the question. */
    const interpretations = sent(engine, "interpret");
    expect(interpretations.length).toBeGreaterThan(0);
    for (const request of interpretations) expect(request.system).not.toContain(`"creativeRegister"`);
    expect(sent(engine, "author")).toHaveLength(0);
    expect(compiled.compiledBrief).not.toHaveProperty("register");
    /* The volunteered answer is DISCARDED at the compiler, the wardrobe pick's
       rule, so the persisted intent is byte-identical to today's. */
    expect((compiled.compiledBrief.intent as { creativeRegister: unknown }).creativeRegister).toBeNull();
    for (const candidate of compiled.candidates) {
      expect(candidate.prompt.startsWith("CASTING CATEGORY (ABSOLUTE)")).toBe(true);
      expect(candidate.prompt).not.toContain(CANDIDATE_CARD_LABEL);
      expect(candidate.prompt).not.toContain(CREATIVE_REGISTER_AUTHORITY);
    }
  });
});

describe("the WIRE — on with an ORDINARY brief is the house road, string for string", () => {
  it("the eight prompts and the locks are identical to the unflagged compile", async () => {
    const off = await castingBriefCompiler({
      briefText: CYBORG,
      candidateCount: 8,
      rollSeed: "wire-house",
      engine: engineAnswering({ creativeRegister: { engaged: false, reasons: [] } }),
    });
    const engine = engineAnswering({ creativeRegister: { engaged: false, reasons: [] } });
    const on = await castingBriefCompiler({
      briefText: CYBORG,
      candidateCount: 8,
      rollSeed: "wire-house",
      engine,
      creativeRegister: true,
    });
    /* The question WAS put, on every sample — that is the one thing the flag
       changes here. */
    for (const request of sent(engine, "interpret")) expect(request.system).toContain(`"creativeRegister"`);
    expect(sent(engine, "author")).toHaveLength(0);
    expect(on.candidates.map((c) => c.prompt)).toEqual(off.candidates.map((c) => c.prompt));
    expect(on.lockContract).toEqual(off.lockContract);
    expect(on.compiledBrief.register).toEqual({ kind: "house", reasons: [] });
  });

  it("and a reading the parse cannot trust is the house road too", async () => {
    const on = await castingBriefCompiler({
      briefText: CYBORG,
      candidateCount: 8,
      rollSeed: "wire-house-2",
      engine: engineAnswering({
        creativeRegister: { engaged: true, reasons: ["a chrome robot"] },
        cards: [eightLines],
      }),
      creativeRegister: true,
    });
    expect(on.compiledBrief.register).toEqual({ kind: "house", reasons: [] });
    expect(on.candidates[0]?.prompt.startsWith("CASTING CATEGORY (ABSOLUTE)")).toBe(true);
  });
});

describe("the WIRE — on with a CREATIVE brief is the register", () => {
  it("the ask is first and verbatim on every slice, the house frame is kept, the person-prose is gone, and each slice carries its own line", async () => {
    const engine = engineAnswering({ creativeRegister: ENGAGED, cards: [eightLines] });
    const compiled = await castingBriefCompiler({
      briefText: CYBORG,
      candidateCount: 8,
      rollSeed: "wire-creative",
      engine,
      creativeRegister: true,
    });
    expect(compiled.candidates).toHaveLength(8);
    const author = sent(engine, "author");
    expect(author).toHaveLength(1);
    expect(author[0]?.user).toBe(CYBORG);
    expect(author[0]?.maxOutputTokens).toBe(CARD_MAX_OUTPUT_TOKENS);
    expect(author[0]?.timeoutMs).toBe(INTERPRET_TIMEOUT_MS);
    /* The author loops twice itself; an inner transport retry would multiply a hung provider. */
    expect(author[0]?.retries).toBe(0);
    expect(author[0]?.temperature).toBe(0.8);

    const lines = new Set<string>();
    for (const candidate of compiled.candidates) {
      const { prompt } = candidate;
      expect(prompt.startsWith(CYBORG)).toBe(true);
      expect(prompt).toContain("Every candidate is a credible an augmented man; vary within that.");
      expect(prompt).toContain("FRAMING: Single subject, waist-up");
      expect(prompt).toContain("Frame from mid-torso up in a 2:3 portrait");
      expect(prompt).toContain("CAMERA: Medium-format sensor");
      expect(prompt).toContain("REALISM: RAW skin");
      expect(prompt).toContain("PHOTOREALISTIC ONLY");
      expect(prompt).toContain(CREATIVE_REGISTER_AUTHORITY);
      for (const houseOnly of ["SUBJECT:", "PHYSIQUE:", "DIRECTION:", "CASTING CATEGORY (ABSOLUTE)", "HERITAGE IS BONE"]) {
        expect(prompt, houseOnly).not.toContain(houseOnly);
      }
      const card = prompt.slice(prompt.lastIndexOf(CANDIDATE_CARD_LABEL));
      expect(card).toBe(`${CANDIDATE_CARD_LABEL} ${eightLines[candidate.position]}`);
      lines.add(card);
    }
    expect(lines.size).toBe(8);

    /* The record: what routed it, and that the card was authored. */
    expect(compiled.compiledBrief.register).toMatchObject({
      kind: "creative",
      reasons: ["cybernetic augmentation as part of his body"],
      cardAuthored: true,
      card: eightLines,
      cardModel: "stub-model",
    });
    /* And the identities are the HOUSE resolver's: the locks did not move. */
    expect(compiled.lockContract).toMatchObject({ sex: "male", ageBand: "40s" });
    expect(compiled.candidates.every((c) => c.resolvedIdentity.sex === "male")).toBe(true);
  });

  it("a card that comes back short is refused, retried ONCE, and the second answer is the card", async () => {
    const engine = engineAnswering({ creativeRegister: ENGAGED, cards: [eightLines.slice(0, 7), eightLines] });
    const compiled = await castingBriefCompiler({
      briefText: CYBORG,
      candidateCount: 8,
      rollSeed: "wire-retry",
      engine,
      creativeRegister: true,
    });
    expect(sent(engine, "author")).toHaveLength(2);
    expect(compiled.compiledBrief.register).toMatchObject({ kind: "creative", cardAuthored: true });
    expect(compiled.candidates[7]?.prompt.endsWith(eightLines[7]!)).toBe(true);
  });

  it("refused twice, the sheet renders WITHOUT a card and the row says so", async () => {
    const engine = engineAnswering({ creativeRegister: ENGAGED, cards: ["not json", eightLines.slice(0, 4)] });
    const compiled = await castingBriefCompiler({
      briefText: CYBORG,
      candidateCount: 8,
      rollSeed: "wire-nocard",
      engine,
      creativeRegister: true,
    });
    expect(sent(engine, "author")).toHaveLength(2);
    expect(compiled.compiledBrief.register).toEqual({
      kind: "creative",
      reasons: ["cybernetic augmentation as part of his body"],
      cardAuthored: false,
      card: null,
    });
    for (const candidate of compiled.candidates) {
      expect(candidate.prompt.startsWith(CYBORG)).toBe(true);
      expect(candidate.prompt).not.toContain(CANDIDATE_CARD_LABEL);
      /* Still the register — arm D's shape, not a fall back to house. */
      expect(candidate.prompt).toContain(CREATIVE_REGISTER_AUTHORITY);
    }
  });
});
