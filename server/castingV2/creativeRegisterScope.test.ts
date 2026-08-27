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
import { houseBlockForStyle } from "./houseBlock";
import { readCastStyle } from "./rollProjection";
import { CAST_STYLES, CAST_STYLE_LINES, CAST_STYLE_NAMES, COMING_CAST_STYLES, DEFAULT_CAST_STYLE } from "../../shared/castStyles";
import {
  ageContradictionIn,
  AUTHOR_MAX_OUTPUT_TOKENS,
  authorAllowance,
  authorPrompt,
  AUTHOR_ALLOWANCE_FLOOR,
  composeFinalPrompt,
  countWords,
  DEFAULT_IMAGINATION,
  draftRefusal,
  MAX_SHEET_CHECKLIST,
  maxSystemPrompt,
  NEVER_WRITTEN,
  neverWrittenIn,
  staticPrompt,
  WORD_BUDGET,
} from "./promptAuthor";
import { IMAGINATIONS } from "../../shared/imagination";
import {
  AUTHOR_ROAD_FRAMING,
  AUTHORITY_LINE,
  COLOUR_LINE,
  containsHouseSentence,
  DROPPED_FROM_BLOCK,
  EXPRESSION_LINE,
  HOUSE_BLOCK,
  HOUSE_BLOCK_SENTENCES,
  LIGHTING_LINE,
  NEGATIVE_LINES,
  PHOTOREAL_PRESET,
  POSTURE_LINE,
  UNIVERSAL_BLOCK_SENTENCES,
} from "./houseBlock";
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

describe("the locked house block — rebuilt to §5d + §5e (#144), code's, reviewed once", () => {
  it("carries his §5e lighting line and his §5f expression/colour lines verbatim, and the block's own posture, negatives, preset and authority", () => {
    expect(LIGHTING_LINE).toContain(
      "Large soft frontal key just above the lens, high fill, open shadows. Soft chin and jaw shadow only. Grey seamless slightly brighter behind the head, gentle falloff to the edges, no hard vignette. Minimal rim. No coloured gels. Speculars appear where the person's skin and wardrobe naturally catch the source — not as a forced flash sheen on every face.",
    );
    /* §5f (#146): only the geometry of an expression and the absence of a house grade are universal. */
    expect(EXPRESSION_LINE).toBe("EXPRESSION: Eyes into the lens, present, mouth closed. No laugh, no speech, no blank CGI stare.");
    expect(COLOUR_LINE).toBe("COLOUR: Neutral daylight. Skin colour and sheen come from the person, not from a house grade.");
    for (const line of [LIGHTING_LINE, EXPRESSION_LINE, COLOUR_LINE, POSTURE_LINE, ...NEGATIVE_LINES, ...PHOTOREAL_PRESET, ...AUTHOR_ROAD_FRAMING]) {
      expect(HOUSE_BLOCK).toContain(line);
    }
    expect(HOUSE_BLOCK.endsWith(AUTHORITY_LINE)).toBe(true);
    /* The order is the block's: framing → capture → realism → negatives → preset → authority. */
    const at = (s: string) => HOUSE_BLOCK.indexOf(s);
    expect(at(AUTHOR_ROAD_FRAMING[0]!)).toBeLessThan(at("CAMERA:"));
    expect(at("CAMERA:")).toBeLessThan(at("REALISM:"));
    expect(at("REALISM:")).toBeLessThan(at(NEGATIVE_LINES[0]!));
    expect(at(NEGATIVE_LINES[0]!)).toBeLessThan(at(PHOTOREAL_PRESET[0]!));
  });

  it("keeps what §5e keeps, by name from the cohort: hair silhouette, background, camera, noise, the three realism sentences", () => {
    expect(HOUSE_BLOCK).toContain("ENTIRE HAIR SILHOUETTE");
    expect(HOUSE_BLOCK).toContain("Nothing on the head is clipped");
    expect(HOUSE_BLOCK).toContain("BACKGROUND:");
    expect(HOUSE_BLOCK).toContain("CAMERA: Medium-format sensor");
    expect(HOUSE_BLOCK).toContain("Fine luminance-dominant noise");
    expect(PHOTOREAL_HUMAN_BLOCKS.realismSentences).toHaveLength(3);
    for (const sentence of PHOTOREAL_HUMAN_BLOCKS.realismSentences) expect(HOUSE_BLOCK).toContain(sentence);
    expect(HOUSE_BLOCK).toContain("collarbones");
    /* The anatomy blocks stay retired on this road. */
    for (const retired of ["EYES:", "SCLERA:", "CATCHLIGHTS:", "IDENTITY", "PRIORITY"]) expect(HOUSE_BLOCK).not.toContain(retired);
  });

  it("FORBIDDEN TOKENS (#144): none of the dropped phrases is in the block — the flash studio cannot come back by re-derivation", () => {
    expect(DROPPED_FROM_BLOCK.length).toBeGreaterThanOrEqual(15);
    for (const { phrase } of DROPPED_FROM_BLOCK) expect(HOUSE_BLOCK.toLowerCase()).not.toContain(phrase.toLowerCase());
    /* Positive control: every dropped phrase IS in the old studio's own block, so the arm is reading real sentences. */
    const old = photorealHumanConstant(null).toLowerCase();
    const oldHits = DROPPED_FROM_BLOCK.filter(({ phrase }) => old.includes(phrase.toLowerCase())).length;
    expect(oldHits).toBeGreaterThanOrEqual(13);
    /* The old expression bans and the text ban, named outright. */
    for (const gone of ["NO open mouth", "no showing teeth", "NO text", "head straight", "Skin tones warm", "front flash"]) {
      expect(HOUSE_BLOCK).not.toContain(gone);
    }
  });

  it("§5f (#146): mood and skin temperature are the CAST layer's — the house block carries neither, and the guard names all six", () => {
    const lower = HOUSE_BLOCK.toLowerCase();
    /* "beauty-app grade" and not "beauty-app": the photoreal PRESET keeps its own "beauty-app smoothing" style ban (a kept cohort sentence). */
    for (const cast of ["self-possessed", "horror grimace", "broad smile", "5500k", "teal-orange", "beauty-app grade"]) {
      expect(lower).not.toContain(cast);
    }
    const guarded = DROPPED_FROM_BLOCK.map(({ phrase }) => phrase.toLowerCase());
    for (const token of ["self-possessed", "horror grimace", "broad smile", "5500k", "teal-orange", "beauty-app grade"]) expect(guarded).toContain(token);
    /* The house guard reads the BLOCK only: the same words are legal in the cast layer (a seed that says "self-possessed" is not refused). */
    expect(containsHouseSentence("A self-possessed goth woman, severe, in neutral daylight.")).toBeNull();
    /* Positive control: all six were in the §5e lines this arm replaced, so the arm could have failed. */
    const fiveE = "EXPRESSION: Eyes into the lens, present, mouth closed. Self-possessed. No broad smile, no laugh, no blank stare, no horror grimace. COLOUR: Neutral daylight, 5500K. Skin stays true to the person. No teal-orange, no beauty-app grade.".toLowerCase();
    expect(DROPPED_FROM_BLOCK.filter(({ phrase }) => fiveE.includes(phrase.toLowerCase())).length).toBe(6);
  });

  it("the style ban lives in the PRESET, not the universal block (§5d) — and the preset is still appended today", () => {
    const universal = UNIVERSAL_BLOCK_SENTENCES.join(" ");
    /* "CGI" alone is not the token: the kept REALISM sentence says "no CGI sheen" (a skin quality, not a style ban). */
    for (const style of ["PHOTOREALISTIC", "NO CGI", "anime", "cartoon", "3D render", "illustration"]) expect(universal).not.toContain(style);
    expect(PHOTOREAL_PRESET.join(" ")).toContain("PHOTOREALISTIC ONLY");
    expect(PHOTOREAL_PRESET.join(" ")).toContain("NO CGI, cartoon, anime");
    expect(HOUSE_BLOCK).toContain(PHOTOREAL_PRESET[0]!);
    expect(HOUSE_BLOCK_SENTENCES).toEqual([...UNIVERSAL_BLOCK_SENTENCES, ...PHOTOREAL_PRESET, AUTHORITY_LINE]);
  });

  it("the authority is the road's (rule 8): defaults that a stated fact overrides — never 'always wins'", () => {
    expect(AUTHORITY_LINE).toContain("overrides any default or negative");
    expect(AUTHORITY_LINE).toContain("Where the description is silent");
    expect(AUTHORITY_LINE).not.toContain("always wins");
    expect(HOUSE_BLOCK).not.toContain(PHOTOREAL_HUMAN_BLOCKS.authority);
  });

  it("carries no word this studio never sends, and the house composer's own bytes did not move", () => {
    expect(neverWrittenIn(HOUSE_BLOCK)).toBeNull();
    const house = photorealHumanConstant(null);
    expect(house).toContain(PHOTOREAL_HUMAN_BLOCKS.capture);
    expect(house).toContain(PHOTOREAL_HUMAN_BLOCKS.negatives);
    expect(house).toContain("Eight candidates must not share one skin");
    expect(house).toContain("front flash");
    expect(HOUSE_BLOCK_SENTENCES.length).toBeGreaterThan(15);
    expect(containsHouseSentence("Pale cool-toned skin, intense black makeup language.")).toBeNull();
    expect(containsHouseSentence(`x ${NEGATIVE_LINES[0]} y`)).not.toBeNull();
    expect(containsHouseSentence(`x ${LIGHTING_LINE} y`)).not.toBeNull();
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
      /* §5g (#171) superseded the house wording ("You may add; you may not take away") with his own. */
      "Taste can be added. Facts cannot be rewritten.",
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
    expect(neverWrittenIn("pick one direction per" + String.fromCharCode(10) + "subject")).toBe("per subject");
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
    expect(draftRefusal(`Pale skin. ${NEGATIVE_LINES[1]}`, 100)).toContain("camera/studio language");
    expect(draftRefusal(`Pale skin. ${LIGHTING_LINE}`, 100)).toContain("camera/studio language");
    expect(draftRefusal("Pale cool-toned skin, intense black makeup language, sculpted black hair.", 100)).toBeNull();
  });
});

/* ------------------------------------------- the §5g guardrails (#171) */

describe("§5g — seed facts cannot move, including paraphrase (the check compares VALUES)", () => {
  const MID_30S = { band: "30s", phase: "mid" } as const;

  it("his own specimen: 'in her mid-thirties' passes on a mid-30s seed; 'young' is a contradiction", () => {
    expect(ageContradictionIn("Severe editorial styling; she reads in her mid-thirties.", MID_30S)).toBeNull();
    expect(ageContradictionIn("A young woman in blackened velvet.", MID_30S)).toBe("young");
    expect(ageContradictionIn("The styling reads youthful and soft.", MID_30S)).toBe("youthful");
  });

  it("a different stated decade reddens in BOTH directions, in any age-stating wording", () => {
    expect(ageContradictionIn("in her early 20s, luminous", MID_30S)).toBeTruthy();
    expect(ageContradictionIn("she is aged 25", MID_30S)).toBeTruthy();
    expect(ageContradictionIn("a fifty-something presence", MID_30S)).toBeTruthy();
    expect(ageContradictionIn("in their 50s, silvering", MID_30S)).toBeTruthy();
    expect(ageContradictionIn("a teenage softness", MID_30S)).toBeTruthy();
    /* The same value in any wording passes. */
    expect(ageContradictionIn("35 years old, self-possessed", MID_30S)).toBeNull();
    expect(ageContradictionIn("in her thirties", MID_30S)).toBeNull();
    expect(ageContradictionIn("early 30s energy", MID_30S)).toBeNull();
  });

  it("era styling is NOT an age claim — the matchers anchor to age-stating shapes (the #173 lesson)", () => {
    expect(ageContradictionIn("70s disco styling: sequins, lamé, mirrored texture language.", MID_30S)).toBeNull();
    expect(ageContradictionIn("an 80s-inspired matte grade over 90s minimalism", MID_30S)).toBeNull();
  });

  it("QUALIFIED era phrases pass too, and the possessive elder claim still reddens (Fable review of #174, finding 1)", () => {
    expect(ageContradictionIn("late 70s disco styling with mirrored lamé", MID_30S)).toBeNull();
    expect(ageContradictionIn("an early 90s minimalist grade", MID_30S)).toBeNull();
    expect(ageContradictionIn("mid-80s synth styling, chrome and neon texture language", MID_30S)).toBeNull();
    /* The possessive shape is an AGE shape, not an era one — it keeps catching real elder claims. */
    expect(ageContradictionIn("a man in his late 70s", MID_30S)).toBeTruthy();
    /* Word forms are age claims in any shape. */
    expect(ageContradictionIn("late seventies, silver and weathered", MID_30S)).toBeTruthy();
  });

  it("'young' on a teens/20s seed states nothing the seed did not — no drift", () => {
    expect(ageContradictionIn("young, luminous styling", { band: "20s", phase: null })).toBeNull();
    expect(ageContradictionIn("youthful energy", { band: "teens", phase: null })).toBeNull();
  });

  it("driven: an author draft that ages the seed down is refused and re-asked once, naming the stated value; the clean second draft stands", async () => {
    const engine = engineAnswering(["A young woman in blackened velvet.", ADDITION]);
    const out = await authorPrompt({ engine, briefText: THIN, imagination: "max", statedAge: { band: "30s", phase: "mid" } });
    const calls = sent(engine, "author");
    expect(calls).toHaveLength(2);
    expect(calls[1]?.system).toContain("moves the user's stated age (mid 30s)");
    expect(out).toMatchObject({ mode: "authored", attempts: 2, content: ADDITION });
  });

  it("the MAX instruction states both §5g rules: facts cannot be rewritten; a finished seed gets pressure only, never new nouns", () => {
    const prompt = maxSystemPrompt(100);
    expect(prompt).toContain("Facts cannot be rewritten");
    expect(prompt).toContain('"mid 30s" must never surface as "young woman"');
    expect(prompt).toContain("the decision is by CONTENT, never length");
    expect(prompt).toContain("your ENTIRE output is one short intensity clause");
    expect(prompt).toContain("more severe, more editorial, denser texture, stronger mood");
    expect(prompt).toContain("a named haircut, a younger age, a sharper named face");
  });

  it("no third button (§5g): the imagination input is exactly the two endpoints until N3's slider", () => {
    expect(IMAGINATIONS).toEqual(["low", "max"]);
  });

  it("the MAX-sheet checklist carries his five clauses and three failure readings verbatim (item 4 — the eye caption quotes this)", () => {
    for (const clause of [
      "Facts intact",
      "same studio",
      "same designed universe across all eight",
      "eight different faces",
      "bookable for one lookbook",
      "Clones = too tight",
      "Eight unrelated genres = too loose",
      "They got younger = author rewrote the seed",
    ]) {
      expect(MAX_SHEET_CHECKLIST, clause).toContain(clause);
    }
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
    const engine = engineAnswering([`Pale skin. ${PHOTOREAL_PRESET[0]}`, ADDITION]);
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

  it("the WIRE of §5g (#171): the compiler hands the READER's recorded age to the author — an aged-down draft is re-asked at the real call site", async () => {
    /* The stub INTENT records ageBand "30s"; the first draft says "young". */
    const engine = engineAnswering(["A young woman in blackened velvet.", ADDITION]);
    const on = await castingBriefCompiler({
      briefText: THIN,
      candidateCount: 8,
      rollSeed: "wire-age-drift",
      engine,
      creativeRegister: true,
      imagination: "max",
    });
    const calls = sent(engine, "author");
    expect(calls).toHaveLength(2);
    expect(calls[1]?.system).toContain("moves the user's stated age");
    expect(on.compiledBrief.register).toMatchObject({ mode: "authored", attempts: 2, content: ADDITION });
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

/* ------------------- the FAMILY CLAUSE: a follow and a chip edit CARRIED (#154) */

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

const FAMILY_CLAUSE =
  "Continue this family: same casting brief, new person — a woman, in their 20s, of Nordic heritage, blonde hair, with a severe minimal look. "
  + "Keep the same sex, age range, heritage, hair-colour family and grooming world. "
  + "Do not copy this face, this exact hairline, this exact bone structure, or this exact expression. "
  + "Cast a different person who could be booked for the same role.";

describe("the WIRE — a FOLLOW and a chip edit are CARRIED on the author road as the family clause (#154), and the unflagged compile does not move", () => {
  it("a FOLLOW at LOW: one prompt on all eight — the brief verbatim, the family clause from the anchor, the block; no author call; the reader's record is the house follow's", async () => {
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
    /* The unflagged follow is the house road, byte for byte, as it always was. */
    expect(off.candidates[0]?.prompt.startsWith("CASTING CATEGORY (ABSOLUTE)")).toBe(true);
    expect(off.candidates[0]?.prompt).toContain("low bun");
    expect(off.compiledBrief).not.toHaveProperty("register");
    /* The flagged follow: ONE prompt, the clause between the brief and the block. */
    const prompts = new Set(on.candidates.map((c) => c.prompt));
    expect(prompts.size).toBe(1);
    expect(on.candidates[0]?.prompt).toBe(`${RICH}\n\n${FAMILY_CLAUSE}\n\n${HOUSE_BLOCK}`);
    /* Never the cut, never a realized axis, never a house sentence (his answer 3; law 4). */
    expect(on.candidates[0]?.prompt).not.toContain("low bun");
    expect(on.candidates[0]?.prompt).not.toContain("CASTING CATEGORY");
    expect(neverWrittenIn(FAMILY_CLAUSE)).toBeNull();
    /* The identities the sheet records are still the house follow's — the anchor biased the neighbourhood exactly as before. */
    expect(on.candidates.map((c) => c.resolvedIdentity)).toEqual(off.candidates.map((c) => c.resolvedIdentity));
    expect(on.compiledBrief.register).toMatchObject({
      kind: "author",
      mode: "seed",
      prompt: `${RICH}\n\n${FAMILY_CLAUSE}\n\n${HOUSE_BLOCK}`,
      carried: { follow: true, overrides: {}, clause: FAMILY_CLAUSE },
    });
    /* Chips on a follow: the three anchored axes stay removable, the rest are a record (his answer 2). */
    const chips = on.chips.filter((chip) => chip.field);
    for (const chip of chips) {
      expect(chip.removable, chip.field).toBe(["sex", "ageBand", "heritage"].includes(chip.field ?? ""));
    }
  });

  it("a FOLLOW at MAX: the author is asked once, sees the clause beneath the brief, and the clause sits before its content", async () => {
    const engine = engineAnswering([ADDITION]);
    const on = await castingBriefCompiler({
      briefText: THIN,
      candidateCount: 8,
      rollSeed: "wire-follow-max",
      engine,
      followIdentity: FOLLOW as never,
      creativeRegister: true,
      imagination: "max",
    });
    expect(sent(engine, "author")).toHaveLength(1);
    expect(sent(engine, "author")[0]?.user).toBe(`${THIN}\n\n${FAMILY_CLAUSE}`);
    expect(on.candidates[0]?.prompt).toBe(`${THIN}\n\n${FAMILY_CLAUSE}\n\n${ADDITION}\n\n${HOUSE_BLOCK}`);
    expect(on.compiledBrief.register).toMatchObject({ kind: "author", mode: "authored", content: ADDITION, carried: { follow: true } });
  });

  it("an UNLOCK on a follow strips the axis from the clause; an OVERRIDE lands in the brief itself — on a follow the clause also states it, alone there is no clause at all (#164)", async () => {
    const unlocked = engineAnswering([ADDITION]);
    const a = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-follow-unlock",
      engine: unlocked,
      followIdentity: FOLLOW as never,
      unlock: ["sex"] as never,
      creativeRegister: true,
    });
    expect(sent(unlocked, "author")).toHaveLength(0);
    const aClause = (a.compiledBrief.register as { carried: { clause: string } }).carried.clause;
    expect(aClause).not.toContain("woman");
    expect(aClause).not.toContain("same sex");
    expect(aClause).toContain("Keep the same age range, heritage, hair-colour family and grooming world");
    expect(a.candidates[0]?.prompt).toBe(`${RICH}\n\n${aClause}\n\n${HOUSE_BLOCK}`);

    const overriddenFollow = engineAnswering([ADDITION]);
    const b = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-follow-override",
      engine: overriddenFollow,
      followIdentity: FOLLOW as never,
      overrides: { ageBand: "40s" } as never,
      creativeRegister: true,
    });
    const bClause = (b.compiledBrief.register as { carried: { clause: string; overrides: unknown } }).carried.clause;
    expect(bClause).toContain("a woman, in their 40s, of Nordic heritage");
    expect(bClause).not.toContain("20s");
    expect(b.compiledBrief.register).toMatchObject({ kind: "author", carried: { follow: true, overrides: { ageBand: "40s" } } });
    /*
      AT THE WIRE (law 5; review of #173, finding 5): RICH states no decade,
      so the edit APPENDS — the declared consistent repetition is the brief
      and the clause stating the same 40s, with no tie-breaker anywhere.
    */
    expect((b.compiledBrief.register as { briefSent: string }).briefSent).toBe(`${RICH} In their 40s.`);
    expect(b.candidates[0]?.prompt.startsWith(`${RICH} In their 40s.\n\n${bClause}`)).toBe(true);
    expect(b.candidates[0]?.prompt).not.toContain("this wins");
    expect(b.candidates[0]?.prompt).not.toContain("20s");

    const overridden = engineAnswering([ADDITION]);
    const c = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-override",
      engine: overridden,
      overrides: { ageBand: "40s", heritage: "Slavic" } as never,
      creativeRegister: true,
    });
    expect(sent(overridden, "author")).toHaveLength(0);
    /*
      #164: the edit is written into the sentence itself — RICH states neither
      a decade nor a heritage word, so both land as plain appended sentences,
      and there is no override clause and no tie-breaker anywhere.
    */
    const REWRITTEN = `${RICH} In their 40s. Of Slavic heritage.`;
    expect(c.candidates[0]?.prompt).toBe(`${REWRITTEN}\n\n${HOUSE_BLOCK}`);
    expect(c.compiledBrief.register).not.toHaveProperty("carried");
    expect(c.compiledBrief.register).toMatchObject({
      kind: "author",
      briefSent: REWRITTEN,
      rewrites: [
        { field: "ageBand", mode: "appended", to: "In their 40s." },
        { field: "heritage", mode: "appended", to: "Of Slavic heritage." },
      ],
    });
    /* The row never says "house" again — that vocabulary belongs to rows written before this landed. */
    for (const compiled of [a, b, c]) expect((compiled.compiledBrief.register as { kind: string }).kind).toBe("author");
  });

  it("an UNLOCK on a plain authored roll reaches nothing the engine reads — no clause, the prompt is the plain one, and every derived chip is read-only", async () => {
    const plain = engineAnswering([ADDITION]);
    const on = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-unlock",
      engine: plain,
      unlock: ["sex"] as never,
      creativeRegister: true,
    });
    expect(on.candidates[0]?.prompt).toBe(`${RICH}\n\n${HOUSE_BLOCK}`);
    expect(on.compiledBrief.register).not.toHaveProperty("carried");
    expect(on.chips.some((chip) => chip.field)).toBe(true);
    for (const chip of on.chips.filter((chip) => chip.field)) expect(chip.removable, chip.field).toBe(false);
    /* Off the flag the same chips are removable, as they always were. */
    const off = await castingBriefCompiler({ briefText: RICH, candidateCount: 8, rollSeed: "wire-unlock", engine: engineAnswering([]) });
    for (const chip of off.chips.filter((chip) => chip.field)) expect(chip.removable, chip.field).toBe(true);
  });

  it("an EMPTY override object is not an edit — no clause, the author road exactly as before", async () => {
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

  it("a FOLLOW under the flag is the author road too (#154) and is asked the four-valued subject question; off the flag it is asked today's", async () => {
    const engine = engineReading([intentWith("photoreal_human")]);
    await castingBriefCompiler({
      briefText: RICH, candidateCount: 8, rollSeed: "c-follow", engine, followIdentity: FOLLOW as never, creativeRegister: true,
    });
    expect(sent(engine, "interpret")[0]?.system).toContain(SUBJECT_INSTRUCTION);
    expect(sent(engine, "interpret")[0]?.system).not.toContain(COHORT_INSTRUCTION);

    const off = engineReading([intentWith("photoreal_human")]);
    await castingBriefCompiler({ briefText: RICH, candidateCount: 8, rollSeed: "c-follow-off", engine: off, followIdentity: FOLLOW as never });
    expect(sent(off, "interpret")[0]?.system).toContain(COHORT_INSTRUCTION);
    expect(sent(off, "interpret")[0]?.system).not.toContain(SUBJECT_INSTRUCTION);
  });
});

/* ------------------------------------------------ the cast style (#142) */

describe("the cast style (#142) — the settings modal's selector, one member today", () => {
  it("the vocabulary: photoreal is the only style and the default; every style has a name and a line", () => {
    expect([...CAST_STYLES]).toEqual(["photoreal"]);
    expect(CAST_STYLES).toContain(DEFAULT_CAST_STYLE);
    for (const style of CAST_STYLES) {
      expect(CAST_STYLE_NAMES[style].length).toBeGreaterThan(0);
      expect(CAST_STYLE_LINES[style].length).toBeGreaterThan(0);
    }
  });

  it("coming-soon styles are his two, described and never a live style's name (§10b, rule 9)", () => {
    expect(COMING_CAST_STYLES.map((c) => c.name)).toEqual(["Painted realism", "Glossy poster"]);
    const live = new Set(Object.values(CAST_STYLE_NAMES).map((n) => n.toLowerCase()));
    for (const coming of COMING_CAST_STYLES) {
      expect(live.has(coming.name.toLowerCase()), coming.name).toBe(false);
      expect(coming.line.length).toBeGreaterThan(0);
    }
  });

  it("the block is chosen by style, and today's one style is HOUSE_BLOCK byte for byte", () => {
    expect(houseBlockForStyle("photoreal")).toBe(HOUSE_BLOCK);
    expect(() => houseBlockForStyle("oil" as never)).toThrow(/no preset for style oil/);
  });

  it("the author records the style: absent means photoreal, given is kept — on LOW and on MAX alike", async () => {
    const low = await authorPrompt({ engine: engineAnswering([]), briefText: THIN, imagination: "low" });
    expect(low).toMatchObject({ style: "photoreal", mode: "seed", prompt: `${THIN}\n\n${HOUSE_BLOCK}` });
    const max = await authorPrompt({ engine: engineAnswering([ADDITION]), briefText: THIN, imagination: "max", style: "photoreal" });
    expect(max).toMatchObject({ style: "photoreal", mode: "authored", prompt: `${THIN}\n\n${ADDITION}\n\n${HOUSE_BLOCK}` });
  });

  it("the compile writes the style onto the register row, and the projection reads it back through a validator", async () => {
    const on = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-style",
      engine: engineAnswering([]),
      creativeRegister: true,
      imagination: "low",
      style: "photoreal",
    });
    expect(on.compiledBrief.register).toMatchObject({ kind: "author", imagination: "low", style: "photoreal" });
    expect(readCastStyle(on.compiledBrief)).toBe("photoreal");
    /* An author row written BEFORE the style was recorded reads null — the sheet never back-fills a fact. */
    expect(readCastStyle({ register: { kind: "author", imagination: "low" } })).toBeNull();
    /* A house row, a garbage value, and no register at all all read null. */
    expect(readCastStyle({ register: { kind: "house", style: "photoreal" } })).toBeNull();
    expect(readCastStyle({ register: { kind: "author", style: "oil" } })).toBeNull();
    expect(readCastStyle({})).toBeNull();
    expect(readCastStyle(null)).toBeNull();
  });

  it("off the flag the row still carries no register — the style is inert off the author road by construction", async () => {
    const off = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-style-off",
      engine: engineAnswering([]),
      creativeRegister: false,
      style: "photoreal",
    });
    expect(off.compiledBrief.register).toBeUndefined();
    expect(readCastStyle(off.compiledBrief)).toBeNull();
  });
});
