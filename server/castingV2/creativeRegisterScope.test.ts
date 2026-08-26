/**
 * `CASTING_CREATIVE_REGISTER_SCOPE` — the ladder, THE PROMPT AUTHOR it now
 * governs (#131), and the WIRE both sides of the flag.
 *
 * The founder's verdict on the Prompt Author court (Crew reply #8, 2026-08-26)
 * is the spec: *"B is the studio … build the author verbatim-first with LOW as
 * the default. MAX as written gives one face eight times; rewrite the MAX
 * instruction so it always leaves the face and a few axes open … Never say
 * 'sternum'."* The arms below assert each clause at the request or at the
 * prompt, never at a constant near it (working law 5), and every author call
 * is DRIVEN by an engine double — the road is proven without a reader that
 * usually behaves (law 3).
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
import { castingBriefCompiler } from "./briefCompiler";
import {
  AUTHOR_MAX_OUTPUT_TOKENS,
  authorAllowance,
  authorPrompt,
  AUTHOR_ALLOWANCE_FLOOR,
  composeFinalPrompt,
  countWords,
  DEFAULT_IMAGINATION,
  draftRefusal,
  maxSystemPrompt,
  NEVER_WRITTEN,
  neverWrittenIn,
  staticPrompt,
  WORD_BUDGET,
} from "./promptAuthor";
import { AUTHOR_ROAD_FRAMING, containsHouseSentence, HOUSE_BLOCK, HOUSE_BLOCK_SENTENCES } from "./houseBlock";
import { PHOTOREAL_HUMAN_BLOCKS, photorealHumanConstant } from "./cohortPhotorealHuman";

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

/* ----------------------------------------- the interpreter is the READER */

describe("the interpreter is never asked to route (ruling rule 2 — the engagement gate is gone)", () => {
  it("no option exists that would append a creativeRegister question, and the base prompt has none", () => {
    const base = interpreterSystemPrompt();
    expect(base).not.toContain(`"creativeRegister"`);
    /* The three surviving options compose exactly as before; none reintroduces the key. */
    expect(interpreterSystemPrompt({ wardrobe: true, ink: true, fidelity: true })).not.toContain(`"creativeRegister"`);
  });
});

/* -------------------------------------------------------------- the author */

const THIN = "goth woman mid 30s";
const RICH =
  "A photorealistic high-fashion portrait of a young woman with an intense cyber-goth aesthetic, facing the camera "
  + "directly from the chest up. She has extremely pale porcelain skin and a sharp, androgynous face. Soft neutral gray "
  + "studio background with seamless gradient.";

describe("the locked house block (ruling §5c) — code's, derived, reviewed once", () => {
  it("is derived from the cohort's own sentences: capture minus the set sentence, the three realism sentences, every negative, the authority paragraph", () => {
    for (const sentence of PHOTOREAL_HUMAN_BLOCKS.captureSentences) {
      if (sentence.startsWith("Eight candidates")) expect(HOUSE_BLOCK).not.toContain(sentence);
      else expect(HOUSE_BLOCK).toContain(sentence);
    }
    expect(PHOTOREAL_HUMAN_BLOCKS.realismSentences).toHaveLength(3);
    for (const sentence of PHOTOREAL_HUMAN_BLOCKS.realismSentences) expect(HOUSE_BLOCK).toContain(sentence);
    for (const sentence of PHOTOREAL_HUMAN_BLOCKS.negativeSentences) expect(HOUSE_BLOCK).toContain(sentence);
    expect(HOUSE_BLOCK.endsWith(PHOTOREAL_HUMAN_BLOCKS.authority)).toBe(true);
    /* The anatomy blocks stay retired on this road. */
    for (const retired of ["EYES:", "SCLERA:", "CATCHLIGHTS:", "IDENTITY", "PRIORITY"]) expect(HOUSE_BLOCK).not.toContain(retired);
  });

  it("is chest-up by his word — the cohort's waist-up pair and the DIRECTION referent are out, by name", () => {
    for (const sentence of AUTHOR_ROAD_FRAMING) expect(HOUSE_BLOCK).toContain(sentence);
    expect(HOUSE_BLOCK).not.toContain("waist-up");
    expect(HOUSE_BLOCK).not.toContain("mid-torso");
    expect(HOUSE_BLOCK).not.toContain("DIRECTION block");
    expect(HOUSE_BLOCK).toContain("ENTIRE HAIR SILHOUETTE");
    expect(HOUSE_BLOCK).toContain("BACKGROUND:");
    expect(HOUSE_BLOCK).toContain("collarbones");
  });

  it("carries no word this studio never sends, and the house composer's own bytes did not move", () => {
    expect(neverWrittenIn(HOUSE_BLOCK)).toBeNull();
    const house = photorealHumanConstant(null);
    expect(house).toContain(PHOTOREAL_HUMAN_BLOCKS.capture);
    expect(house).toContain(PHOTOREAL_HUMAN_BLOCKS.negatives);
    expect(house).toContain("Eight candidates must not share one skin");
    expect(HOUSE_BLOCK_SENTENCES.length).toBeGreaterThan(15);
    expect(containsHouseSentence("Pale cool-toned skin, intense black makeup language.")).toBeNull();
    expect(containsHouseSentence(`x ${PHOTOREAL_HUMAN_BLOCKS.negativeSentences[0]} y`)).not.toBeNull();
  });
});

describe("the author's instruction (§5b, at the text)", () => {
  it("LOW is his default and makes no text call at all — seed + camera/studio is the whole spec", () => {
    expect(DEFAULT_IMAGINATION).toBe("low");
    expect(staticPrompt(THIN)).toBe(`${THIN}\n\n${HOUSE_BLOCK}`);
  });

  it("MAX asks for art direction only and forbids, by name, an exact face, hairstyle, eye colour, jewellery item, garment, body type or expression", () => {
    const max = maxSystemPrompt(200);
    for (const clause of [
      "aesthetic language only",
      "mood, materials, makeup language, hair language and lighting taste",
      "exact face, exact hairstyle, exact eye colour, exact jewellery item, exact garment, exact body type or exact expression",
      "Never lock a repeating signature item",
      "more taste, not more world",
      "Do NOT write any camera, lens, framing",
      "Do NOT write notes about the series",
      "You may add; you may not take away.",
      "at most 200 words",
      "avoid explicit sheer or revealing clothing language",
      "placed VERBATIM before your text",
    ]) expect(max, clause).toContain(clause);
    /* No studio sentence and no forbidden word is in the model's ear. */
    expect(containsHouseSentence(max)).toBeNull();
    expect(neverWrittenIn(max)).toBeNull();
  });

  it("never says 'sternum', a pipeline note or a set word — and the guard names them", () => {
    expect(neverWrittenIn("the crop just below the sternum")).toBe("sternum");
    expect(neverWrittenIn("the crop just below the collarbones")).toBeNull();
    expect(neverWrittenIn("expression left unset")).toBe("left unset");
    expect(neverWrittenIn("this is the signature that must repeat across all eight")).toBe("across all eight");
    expect(neverWrittenIn("pick one direction per subject, never both")).toBe("per subject");
    expect(neverWrittenIn("build ranges from lean to fuller, left open across the set")).toBe("across the set");
    expect(neverWrittenIn("bone structure direction leans toward severity")).toBe("leans toward");
    expect(neverWrittenIn("each cast member wears black")).toBe("cast member");
    expect(neverWrittenIn("the setting is a grey studio")).toBeNull();
    /* A phrase split by a newline or a double space is still the phrase (review of #141, finding 4). */
    expect(neverWrittenIn("pick one direction per
subject")).toBe("per subject");
    expect(neverWrittenIn("expression left  open")).toBe("left open");
    for (const { word } of NEVER_WRITTEN) expect(maxSystemPrompt(100).toLowerCase()).not.toMatch(new RegExp(`(^|[^a-z])${word.replace("-", "\\-")}([^a-z]|$)`));
  });
});

describe("the budget (rule 14) — the brief is never cut, the author fits in what is left, the block is outside it", () => {
  it("allowance is the budget minus the brief's words, floored", () => {
    expect(countWords(THIN)).toBe(4);
    expect(authorAllowance(THIN)).toBe(WORD_BUDGET - 4);
    const huge = Array.from({ length: 600 }, () => "word").join(" ");
    expect(authorAllowance(huge)).toBe(AUTHOR_ALLOWANCE_FLOOR);
  });

  it("the composition is brief → content → block, verbatim first BY CODE, block last BY CODE", () => {
    expect(composeFinalPrompt(`  ${RICH}  `, " added ")).toBe(`${RICH}\n\nadded\n\n${HOUSE_BLOCK}`);
    expect(composeFinalPrompt(THIN, null)).toBe(`${THIN}\n\n${HOUSE_BLOCK}`);
    expect(composeFinalPrompt(THIN, "   ")).toBe(`${THIN}\n\n${HOUSE_BLOCK}`);
  });

  it("a draft is refused for: empty, overrun, a forbidden word, a studio sentence", () => {
    expect(draftRefusal("", 100)).toContain("empty");
    expect(draftRefusal(Array.from({ length: 120 }, () => "w").join(" "), 100)).toContain("allowance is 100");
    expect(draftRefusal("lips oxblood on every subject, left open across the set", 100)).toContain('"across the set"');
    expect(draftRefusal(`Pale skin. ${PHOTOREAL_HUMAN_BLOCKS.negativeSentences[1]}`, 100)).toContain("camera/studio language");
    expect(draftRefusal("Pale cool-toned skin, intense black makeup language, sculpted black hair.", 100)).toBeNull();
  });
});

/* --------------------------------------------------------------- doubles */

type Engine = TextEngine & { complete: ReturnType<typeof vi.fn> };

const INTENT = JSON.stringify({
  cohort: "photoreal_human",
  role: "a goth woman",
  characterNotes: "Goth styling, mid thirties",
  sex: "female",
  ageBand: "30s",
  heritage: [],
  statedAccessories: [],
});

/**
 * A stub transport that answers the INTERPRETER with a fixed intent and the
 * AUTHOR with the replies given, in order — or throws for the author when a
 * reply is an Error — keyed on `about`, so the suite reads which question was
 * put and what came back, at the request.
 */
function engineAnswering(authorReplies: (string | Error)[]): Engine {
  let authorCalls = 0;
  const complete = vi.fn(async (request: TextRequest) => {
    let text = INTENT;
    if (request.about === "author") {
      const answer = authorReplies[authorCalls] ?? "";
      authorCalls += 1;
      if (answer instanceof Error) throw answer;
      text = answer;
    }
    return {
      text,
      latencyMs: 7,
      provenance: { provider: "openrouter" as const, model: "stub-model", servedModel: "stub-model" },
    };
  });
  return { id: "stub", complete } as unknown as Engine;
}

const sent = (engine: Engine, about: string): TextRequest[] =>
  engine.complete.mock.calls
    .map((call: unknown[]) => call[0] as TextRequest)
    .filter((request) => request.about === about);

const ADDITION = "Pale cool-toned skin, intense black makeup language, sculpted black hair, and dark structured fashion built from patent, mesh, lace, high collars and metal hardware. Still, confrontational studio presence.";

/* ------------------------------------------------ the author, driven */

describe("authorPrompt, driven by a throwing and a misbehaving double (law 3)", () => {
  it("LOW: no call at all — seed + block, mode 'seed', zero attempts", async () => {
    const engine = engineAnswering([ADDITION]);
    const out = await authorPrompt({ engine, briefText: THIN });
    expect(sent(engine, "author")).toHaveLength(0);
    expect(out).toMatchObject({ mode: "seed", authored: false, content: null, imagination: "low", attempts: 0, addedWords: 0, model: null, latencyMs: null });
    expect(out.prompt).toBe(`${THIN}\n\n${HOUSE_BLOCK}`);
    expect(out.houseBlockWords).toBe(countWords(HOUSE_BLOCK));
  });

  it("MAX: one call at 0.8 with the MAX instruction, the interpreter's deadline, no transport retries, the brief as the user turn; content between brief and block", async () => {
    const engine = engineAnswering([ADDITION]);
    const out = await authorPrompt({ engine, briefText: THIN, imagination: "max" });
    const [request] = sent(engine, "author");
    expect(sent(engine, "author")).toHaveLength(1);
    expect(request?.user).toBe(THIN);
    expect(request?.system).toBe(maxSystemPrompt(authorAllowance(THIN)));
    expect(request?.temperature).toBe(0.8);
    expect(request?.timeoutMs).toBe(INTERPRET_TIMEOUT_MS);
    expect(request?.retries).toBe(0);
    expect(request?.maxOutputTokens).toBe(AUTHOR_MAX_OUTPUT_TOKENS);
    expect(request?.json).toBeUndefined();
    expect(out).toMatchObject({ mode: "authored", authored: true, content: ADDITION, imagination: "max", attempts: 1, model: "stub-model", latencyMs: 7 });
    expect(out.prompt).toBe(`${THIN}\n\n${ADDITION}\n\n${HOUSE_BLOCK}`);
    expect(out.addedWords).toBe(countWords(ADDITION));
    /* The block is byte-identical at the end, and the author wrote none of it. */
    expect(out.prompt.endsWith(HOUSE_BLOCK)).toBe(true);
    expect(containsHouseSentence(out.content ?? "")).toBeNull();
  });

  it("a reply that says 'sternum' is refused and re-asked ONCE, naming the word; the clean second draft is the content", async () => {
    const engine = engineAnswering(["Chest-up, the crop just below the sternum.", ADDITION]);
    const out = await authorPrompt({ engine, briefText: THIN, imagination: "max" });
    const calls = sent(engine, "author");
    expect(calls).toHaveLength(2);
    expect(calls[1]?.system).toContain('used the word "sternum"');
    expect(calls[1]?.system).toContain("PREVIOUS DRAFT:");
    expect(out).toMatchObject({ mode: "authored", attempts: 2, content: ADDITION });
    expect(neverWrittenIn(out.content ?? "")).toBeNull();
  });

  it("a draft that narrates the SET or writes a pipeline note is refused by name (dev roll 95 — 7 of 8 tiles were contact-sheet grids)", async () => {
    const engine = engineAnswering(["Skin left open across the set, lips oxblood on every subject.", ADDITION]);
    const out = await authorPrompt({ engine, briefText: THIN, imagination: "max" });
    expect(sent(engine, "author")[1]?.system).toContain('used the word "across the set"');
    expect(out).toMatchObject({ mode: "authored", attempts: 2 });
  });

  it("a draft that writes studio language is refused — the studio appends its own block", async () => {
    const engine = engineAnswering([`Pale skin. ${PHOTOREAL_HUMAN_BLOCKS.negativeSentences[0]}`, ADDITION]);
    const out = await authorPrompt({ engine, briefText: THIN, imagination: "max" });
    expect(sent(engine, "author")[1]?.system).toContain("camera/studio language");
    expect(out).toMatchObject({ mode: "authored", attempts: 2, content: ADDITION });
  });

  it("an overrun draft is re-asked once to trim itself; refused twice, seed + block stands with mode 'static'", async () => {
    const allowance = authorAllowance(THIN);
    const long = Array.from({ length: Math.ceil(allowance * 1.2) }, () => "word").join(" ");
    const engine = engineAnswering([long, long]);
    const out = await authorPrompt({ engine, briefText: THIN, imagination: "max" });
    expect(sent(engine, "author")).toHaveLength(2);
    expect(sent(engine, "author")[1]?.system).toContain(`the allowance is ${allowance}`);
    expect(out).toMatchObject({ mode: "static", authored: false, content: null, attempts: 2, model: null, addedWords: 0 });
    expect(out.prompt).toBe(staticPrompt(THIN));
  });

  it("a throwing author (deadline, transport) costs the customer the AUTHOR and never the roll", async () => {
    const engine = engineAnswering([new Error("TimeoutError")]);
    const out = await authorPrompt({ engine, briefText: RICH, imagination: "max" });
    expect(out).toMatchObject({ mode: "static", authored: false, attempts: 1, model: null, latencyMs: null });
    expect(out.prompt).toBe(staticPrompt(RICH));
    expect(out.prompt.startsWith(RICH)).toBe(true);
  });

  it("code fences are stripped and an empty reply is re-asked", async () => {
    const engine = engineAnswering(["", "```\n" + ADDITION + "\n```"]);
    const out = await authorPrompt({ engine, briefText: THIN, imagination: "max" });
    expect(out).toMatchObject({ mode: "authored", content: ADDITION });
  });
});

/* --------------------------------------------------------------- the WIRE */

describe("the WIRE — off is today's product to the byte", () => {
  it("the author is never called, the row carries no register, the eight prompts are the house road", async () => {
    const engine = engineAnswering([ADDITION]);
    const compiled = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-off",
      engine,
    });
    expect(sent(engine, "interpret").length).toBeGreaterThan(0);
    expect(sent(engine, "author")).toHaveLength(0);
    expect(compiled.compiledBrief).not.toHaveProperty("register");
    for (const candidate of compiled.candidates) {
      expect(candidate.prompt.startsWith("CASTING CATEGORY (ABSOLUTE)")).toBe(true);
      expect(candidate.prompt).not.toContain(AUTHOR_ROAD_FRAMING[0]);
      /* The house composer's own block did not move (the derivation is by reference). */
      expect(candidate.prompt).toContain("Eight candidates must not share one skin");
    }
  });
});

describe("the WIRE — on, EVERY roll is the author road: one prompt, verbatim first, the reader untouched", () => {
  it("all eight slices carry the ONE authored prompt; the locks are the reader's and identical to the unflagged compile", async () => {
    const off = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-on",
      engine: engineAnswering([]),
    });
    const engine = engineAnswering([ADDITION]);
    const on = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-on",
      engine,
      creativeRegister: true,
    });
    /* The interpreter ran as the READER, and was not asked to route. */
    expect(sent(engine, "interpret").length).toBeGreaterThan(0);
    for (const request of sent(engine, "interpret")) expect(request.system).not.toContain(`"creativeRegister"`);
    /* LOW (his default): NO author call — seed + the locked block is the whole spec (§5b). */
    expect(sent(engine, "author")).toHaveLength(0);

    const prompts = new Set(on.candidates.map((c) => c.prompt));
    expect(on.candidates).toHaveLength(8);
    expect(prompts.size).toBe(1);
    const [prompt] = prompts;
    expect(prompt).toBe(`${RICH}\n\n${HOUSE_BLOCK}`);
    for (const houseOnly of ["CASTING CATEGORY (ABSOLUTE)", "SUBJECT:", "PHYSIQUE:", "DIRECTION:", "THIS CANDIDATE:", "WARDROBE"]) {
      expect(prompt, houseOnly).not.toContain(houseOnly);
    }
    /* The reader's record did not move. */
    expect(on.lockContract).toEqual(off.lockContract);
    expect(on.candidates.map((c) => c.resolvedIdentity)).toEqual(off.candidates.map((c) => c.resolvedIdentity));
    expect(on.candidates.map((c) => c.personaLine)).toEqual(off.candidates.map((c) => c.personaLine));
    /* The row says who wrote it, and carries the whole prompt for the sheet to show. */
    expect(on.compiledBrief.register).toMatchObject({
      kind: "author",
      imagination: "low",
      mode: "seed",
      authored: false,
      content: null,
      attempts: 0,
      model: null,
      houseBlockWords: countWords(HOUSE_BLOCK),
      prompt: `${RICH}\n\n${HOUSE_BLOCK}`,
    });
  });

  it("a THIN brief at MAX — the four words first, the author's art direction, the block last; ONE author call", async () => {
    const engine = engineAnswering([ADDITION]);
    const on = await castingBriefCompiler({
      briefText: THIN,
      candidateCount: 8,
      rollSeed: "wire-thin",
      engine,
      creativeRegister: true,
      imagination: "max",
    });
    expect(sent(engine, "author")).toHaveLength(1);
    expect(sent(engine, "author")[0]?.temperature).toBe(0.8);
    expect(sent(engine, "author")[0]?.user).toBe(THIN);
    expect(on.candidates[0]?.prompt).toBe(`${THIN}\n\n${ADDITION}\n\n${HOUSE_BLOCK}`);
    expect(on.compiledBrief.register).toMatchObject({ kind: "author", imagination: "max", mode: "authored", authored: true, content: ADDITION, prompt: `${THIN}\n\n${ADDITION}\n\n${HOUSE_BLOCK}` });
  });

  it("the author down at MAX, the sheet still rolls on seed + block and the row says nobody authored it", async () => {
    const engine = engineAnswering([new Error("ECONNRESET")]);
    const on = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-author-down",
      engine,
      creativeRegister: true,
      imagination: "max",
    });
    expect(on.candidates).toHaveLength(8);
    for (const candidate of on.candidates) expect(candidate.prompt).toBe(staticPrompt(RICH));
    expect(on.compiledBrief.register).toMatchObject({ kind: "author", mode: "static", authored: false, model: null, attempts: 1 });
  });
});

/* ------------------------- what the author road cannot carry yet (review of #132) */

const FOLLOW = {
  sex: "female",
  ageBand: "20s",
  agePhase: "early",
  heritage: [{ heritage: "Nordic", pct: 100 }],
  energy: "warm",
  hair: { family: "long", colour: "blonde" },
  look: "severe minimal",
  realized: {
    eyeColour: "blue",
    hairStyle: { name: "low bun", family: "long", worn: "worn up" },
    facialHair: null,
    hairTexture: "straight",
    hairModifiers: null,
    wornState: "worn up",
    browStyle: "feathered",
    skinCharacter: "plain",
  },
} as const;

describe("the WIRE — a roll the author road cannot carry composes HOUSE under the flag, and the row says why", () => {
  it("a FOLLOW keeps its anchor: the author is never called, the eight prompts equal the unflagged follow compile, the row says 'anchored'", async () => {
    const off = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-follow",
      engine: engineAnswering([]),
      followIdentity: FOLLOW as never,
    });
    const engine = engineAnswering([ADDITION]);
    const on = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-follow",
      engine,
      followIdentity: FOLLOW as never,
      creativeRegister: true,
    });
    expect(sent(engine, "author")).toHaveLength(0);
    expect(on.candidates.map((c) => c.prompt)).toEqual(off.candidates.map((c) => c.prompt));
    expect(on.candidates[0]?.prompt).toContain("low bun");
    expect(on.compiledBrief.register).toEqual({ kind: "house", because: "anchored" });
  });

  it("a chip UNLOCK or OVERRIDE is an edit the engine must be told: house, 'edited'", async () => {
    const unlocked = engineAnswering([ADDITION]);
    const a = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-unlock",
      engine: unlocked,
      unlock: ["sex"] as never,
      creativeRegister: true,
    });
    expect(sent(unlocked, "author")).toHaveLength(0);
    expect(a.compiledBrief.register).toEqual({ kind: "house", because: "edited" });
    expect(a.candidates[0]?.prompt.startsWith("CASTING CATEGORY (ABSOLUTE)")).toBe(true);

    const overridden = engineAnswering([ADDITION]);
    const b = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-override",
      engine: overridden,
      overrides: { ageBand: "40s" } as never,
      creativeRegister: true,
    });
    expect(sent(overridden, "author")).toHaveLength(0);
    expect(b.compiledBrief.register).toEqual({ kind: "house", because: "edited" });

    /* An EMPTY override object is not an edit — the author road is taken (MAX, so a call is visible). */
    const empty = engineAnswering([ADDITION]);
    const c = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-empty-override",
      engine: empty,
      overrides: {},
      unlock: [],
      creativeRegister: true,
      imagination: "max",
    });
    expect(sent(empty, "author")).toHaveLength(1);
    expect(c.compiledBrief.register).toMatchObject({ kind: "author", mode: "authored" });
  });

  it("a brand name never reaches the engine (founder gate 21): the brief is scrubbed before the author sees it and before the prompt is composed", async () => {
    const engine = engineAnswering([ADDITION]);
    const on = await castingBriefCompiler({
      briefText: "a young male Mediterranean model inspired by Versace editorial",
      candidateCount: 8,
      rollSeed: "wire-brand",
      engine,
      creativeRegister: true,
      imagination: "max",
    });
    const [request] = sent(engine, "author");
    expect(request?.user.toLowerCase()).not.toContain("versace");
    expect(request?.user).toContain("editorial");
    for (const candidate of on.candidates) expect(candidate.prompt.toLowerCase()).not.toContain("versace");
    expect(String((on.compiledBrief.register as { prompt: string }).prompt).toLowerCase()).not.toContain("versace");
  });
});

describe("authorPrompt keeps the latency it already spent when the re-ask throws", () => {
  it("first draft refused, second call throws: static bundle, attempts 2, latency of the first call kept", async () => {
    const engine = engineAnswering(["the crop just below the sternum", new Error("ECONNRESET")]);
    const out = await authorPrompt({ engine, briefText: THIN, imagination: "max" });
    expect(out).toMatchObject({ mode: "static", authored: false, attempts: 2, model: null, latencyMs: 7 });
    expect(out.prompt).toBe(staticPrompt(THIN));
  });
});

/* ================================================= slice C — the walls */

import {
  COHORT_INSTRUCTION,
  COHORT_SCHEMA_LINE,
  SUBJECT_INSTRUCTION,
  SUBJECT_SCHEMA_LINE,
  interpretBrief,
} from "./interpreter";
import { BriefRefusal, LIKENESS_MESSAGE, NOT_A_BEING_MESSAGE } from "./briefCompiler";
import { parseCastingIntent } from "./castingIntent";

/**
 * A stub transport whose INTERPRETER replies are given in order (a string is
 * the reply text; an object is serialised), and whose AUTHOR reply is fixed.
 * The suite reads which system prompt each interpreter call carried.
 */
function engineReading(interpretReplies: (string | Record<string, unknown>)[], authorReply: string = ADDITION): Engine {
  let interpretCalls = 0;
  const complete = vi.fn(async (request: TextRequest) => {
    let text = authorReply;
    if (request.about === "interpret") {
      const answer = interpretReplies[Math.min(interpretCalls, interpretReplies.length - 1)] ?? INTENT;
      interpretCalls += 1;
      text = typeof answer === "string" ? answer : JSON.stringify(answer);
    }
    return {
      text,
      latencyMs: 7,
      provenance: { provider: "openrouter" as const, model: "stub-model", servedModel: "stub-model" },
    };
  });
  return { id: "stub", complete } as unknown as Engine;
}

const intentWith = (cohort: string): Record<string, unknown> => ({ ...JSON.parse(INTENT), cohort });

async function refusalOf(run: () => Promise<unknown>): Promise<BriefRefusal> {
  try {
    await run();
  } catch (error) {
    if (error instanceof BriefRefusal) return error;
    throw error;
  }
  throw new Error("expected a BriefRefusal");
}

describe("slice C — the subject question, at the prompt (working law 5)", () => {
  it("off, the reader is asked today's two-valued cohort question — the swap's own constants are the unflagged text", () => {
    const base = interpreterSystemPrompt();
    expect(base).toContain(COHORT_SCHEMA_LINE);
    expect(base).toContain(COHORT_INSTRUCTION);
    expect(base).not.toContain(SUBJECT_SCHEMA_LINE);
    expect(base).not.toContain(`"not_a_being"`);
    expect(base).not.toContain(`"being"`);
    expect(base).not.toContain(`"likeness"`);
  });

  it("on, the same slot asks the four-valued question, and only that slot moves", () => {
    const off = interpreterSystemPrompt({ wardrobe: true, ink: true, fidelity: true });
    const on = interpreterSystemPrompt({ wardrobe: true, ink: true, fidelity: true, author: true });
    expect(on).toContain(SUBJECT_SCHEMA_LINE);
    expect(on).toContain(SUBJECT_INSTRUCTION);
    expect(on).not.toContain(COHORT_SCHEMA_LINE);
    expect(on).not.toContain(COHORT_INSTRUCTION);
    /* Everything else is byte-identical: put the old text back and the two are equal. */
    expect(on.replace(SUBJECT_SCHEMA_LINE, COHORT_SCHEMA_LINE).replace(SUBJECT_INSTRUCTION, COHORT_INSTRUCTION)).toBe(off);
    /* The four values are in the model's ear, and so is the founder's example. */
    for (const value of ["photoreal_human", "being", "likeness", "not_a_being"]) expect(SUBJECT_INSTRUCTION).toContain(`"${value}"`);
    expect(SUBJECT_INSTRUCTION).toContain("a red sports car");
    expect(SUBJECT_INSTRUCTION).toContain("cast the being");
  });
});

describe("slice C — parseCastingIntent reads four on the author road and two off it", () => {
  it("off the author road, anything but photoreal_human is unsupported_cohort — 'being' included", () => {
    for (const cohort of ["other", "being", "likeness", "not_a_being"]) {
      expect(parseCastingIntent(intentWith(cohort), THIN)).toEqual({ ok: false, reason: "unsupported_cohort" });
    }
    const human = parseCastingIntent(intentWith("photoreal_human"), THIN);
    expect(human.ok && human.subject).toBe("human");
  });

  it("on it, a being casts and says so, the two kept walls come back by name, and an answer outside the four is unreadable", () => {
    const being = parseCastingIntent(intentWith("Being"), THIN, undefined, { author: true });
    expect(being.ok && being.subject).toBe("being");
    expect(being.ok && being.intent.cohort).toBe("photoreal_human");
    const human = parseCastingIntent(intentWith("photoreal_human"), THIN, undefined, { author: true });
    expect(human.ok && human.subject).toBe("human");
    expect(parseCastingIntent(intentWith("likeness"), THIN, undefined, { author: true })).toEqual({ ok: false, reason: "likeness" });
    expect(parseCastingIntent(intentWith("not_a_being"), THIN, undefined, { author: true })).toEqual({ ok: false, reason: "not_a_being" });
    expect(parseCastingIntent(intentWith("other"), THIN, undefined, { author: true })).toEqual({ ok: false, reason: "unreadable" });
  });

  it("the parse never carries a creativeRegister key any more", () => {
    const parsed = parseCastingIntent({ ...intentWith("photoreal_human"), creativeRegister: { engaged: true, reasons: ["goth"] } }, THIN);
    expect(parsed.ok && Object.keys(parsed.intent)).not.toContain("creativeRegister");
  });
});

describe("slice C — interpretBrief asks the question its caller named, and asks the wall twice", () => {
  it("author: true puts the four-valued prompt on the wire; a 'being' reply is an intent with subject 'being'", async () => {
    const engine = engineReading([intentWith("being")]);
    const out = await interpretBrief({ briefText: "a lizard man with emerald scales", engine, author: true });
    expect(sent(engine, "interpret")[0]?.system).toContain(SUBJECT_INSTRUCTION);
    expect(out.ok && out.subject).toBe("being");
  });

  it("off, the wire carries today's question, and a 'being' reply walls as unsupported_cohort after a second read", async () => {
    const engine = engineReading([intentWith("being"), intentWith("being")]);
    const out = await interpretBrief({ briefText: "a lizard man with emerald scales", engine });
    expect(sent(engine, "interpret")[0]?.system).toContain(COHORT_INSTRUCTION);
    expect(sent(engine, "interpret")).toHaveLength(2);
    expect(out).toEqual({ ok: false, reason: "unsupported_cohort" });
  });

  it("not_a_being twice is walled by that name; a first-read wobble rescued by the second read casts", async () => {
    const walled = engineReading([intentWith("not_a_being"), intentWith("not_a_being")]);
    expect(await interpretBrief({ briefText: "a red sports car", engine: walled, author: true })).toEqual({ ok: false, reason: "not_a_being" });
    expect(sent(walled, "interpret")).toHaveLength(2);

    const wobble = engineReading([intentWith("not_a_being"), intentWith("being")]);
    const out = await interpretBrief({ briefText: "a red sports car with a face", engine: wobble, author: true });
    expect(out.ok && out.subject).toBe("being");
  });

  it("likeness twice is walled by that name", async () => {
    const engine = engineReading([intentWith("likeness"), intentWith("likeness")]);
    expect(await interpretBrief({ briefText: "Master Chief from Halo", engine, author: true })).toEqual({ ok: false, reason: "likeness" });
  });
});

describe("slice C — the WIRE through the compiler: two walls on the author road, free, and no third", () => {
  it("'a red sports car' refuses free as not_a_being, in the founder's words, and the author is never called", async () => {
    const engine = engineReading([intentWith("not_a_being")]);
    const refusal = await refusalOf(() =>
      castingBriefCompiler({ briefText: "a red sports car", candidateCount: 8, rollSeed: "c-car", engine, creativeRegister: true }),
    );
    expect(refusal.code).toBe("not_a_being");
    expect(refusal.message).toBe(NOT_A_BEING_MESSAGE);
    expect(refusal.message).toContain("You have not been charged");
    expect(sent(engine, "author")).toHaveLength(0);
  });

  it("a named character refuses free as likeness — the wall the ruling KEEPS", async () => {
    const engine = engineReading([intentWith("likeness")]);
    const refusal = await refusalOf(() =>
      castingBriefCompiler({ briefText: "a Spider-Man look-alike", candidateCount: 8, rollSeed: "c-likeness", engine, creativeRegister: true }),
    );
    expect(refusal.code).toBe("likeness");
    expect(refusal.message).toBe(LIKENESS_MESSAGE);
    expect(sent(engine, "author")).toHaveLength(0);
  });

  it("a creature CASTS on the author road — the stage wall is dead there — and the row records the reading", async () => {
    const brief = "a swamp monster with moss-green skin and amber eyes";
    const engine = engineReading([intentWith("being")]);
    const on = await castingBriefCompiler({ briefText: brief, candidateCount: 8, rollSeed: "c-creature", engine, creativeRegister: true });
    expect(sent(engine, "author")).toHaveLength(0);
    expect(on.candidates[0]?.prompt).toBe(`${brief}\n\n${HOUSE_BLOCK}`);
    expect(on.compiledBrief.register).toMatchObject({ kind: "author", mode: "seed", subject: "being" });
    /* The adapter that resolved the reader's record is still the photoreal-human one, and the row says which. */
    expect(on.cohortKey).toBe("photoreal_human");
    expect(on.compiledBrief.intent).not.toHaveProperty("creativeRegister");
  });

  it("the same creature OFF the flag still walls as unsupported_cohort — byte-identical to today", async () => {
    const engine = engineReading([intentWith("being"), intentWith("being")]);
    const refusal = await refusalOf(() =>
      castingBriefCompiler({ briefText: "a swamp monster with moss-green skin", candidateCount: 8, rollSeed: "c-creature-off", engine }),
    );
    expect(refusal.code).toBe("unsupported_cohort");
    expect(sent(engine, "interpret")[0]?.system).not.toContain(SUBJECT_INSTRUCTION);
  });

  it("a human on the author road records subject 'human'; an unparsed reply records 'unread' and the sheet goes out on the verbatim brief", async () => {
    const human = engineReading([intentWith("photoreal_human")]);
    const a = await castingBriefCompiler({ briefText: THIN, candidateCount: 8, rollSeed: "c-human", engine: human, creativeRegister: true });
    expect(a.compiledBrief.register).toMatchObject({ kind: "author", subject: "human" });

    const garbage = engineReading(["not json at all", "still not json"]);
    const b = await castingBriefCompiler({ briefText: THIN, candidateCount: 8, rollSeed: "c-unread", engine: garbage, creativeRegister: true });
    expect(b.compiledBrief.interpreted).toBe(false);
    expect(b.compiledBrief.register).toMatchObject({ kind: "author", subject: "unread" });
    expect(b.candidates[0]?.prompt.startsWith(`${THIN}\n\n`)).toBe(true);
  });

  it("the styled-brief screen is not consulted on the author road: an anime brief with an unparsed reply paints from its own words; off, it still walls", async () => {
    const brief = "an anime girl with silver twin-tails";
    const on = await castingBriefCompiler({
      briefText: brief, candidateCount: 8, rollSeed: "c-styled-on", engine: engineReading(["{ not: json"]), creativeRegister: true,
    });
    expect(on.candidates[0]?.prompt.startsWith(`${brief}\n\n`)).toBe(true);
    expect(on.compiledBrief.register).toMatchObject({ kind: "author", subject: "unread" });

    const refusal = await refusalOf(() =>
      castingBriefCompiler({ briefText: brief, candidateCount: 8, rollSeed: "c-styled-off", engine: engineReading(["{ not: json"]) }),
    );
    expect(refusal.code).toBe("unsupported_cohort");
  });

  it("a FOLLOW under the flag composes house and is asked today's question — the house composer cannot paint a being", async () => {
    const engine = engineReading([intentWith("photoreal_human")]);
    await castingBriefCompiler({
      briefText: RICH, candidateCount: 8, rollSeed: "c-follow", engine, followIdentity: FOLLOW as never, creativeRegister: true,
    });
    expect(sent(engine, "interpret")[0]?.system).toContain(COHORT_INSTRUCTION);
    expect(sent(engine, "interpret")[0]?.system).not.toContain(SUBJECT_INSTRUCTION);
  });
});
