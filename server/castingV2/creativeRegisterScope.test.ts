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
import { FOLLOW_ANCHOR_CLAUSE } from "./familyClause";
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
  FACTS_FIRST_RULE,
  maxSystemPrompt,
  NEVER_WRITTEN,
  NO_NEW_SUBJECT_RULE,
  isStacked,
  neverWrittenIn,
  PIECE_NOUNS,
  pieceNounIn,
  RESOLVE_NOT_STACK_RULE,
  seedFactsOf,
  skinContradictionIn,
  staticPrompt,
  UNIVERSAL_RULES_HEADING,
  WORD_BUDGET,
} from "./promptAuthor";
import { IMAGINATIONS } from "../../shared/imagination";
import {
  ANATOMY_VISIBILITY_LINE,
  AUTHOR_ROAD_FRAMING,
  AUTHORITY_LINE,
  COLOUR_LINE,
  containsHouseSentence,
  CREATURE_EXPRESSION_LINE,
  CREATURE_HOUSE_BLOCK,
  DROPPED_FROM_BLOCK,
  EXPRESSION_LINE,
  HOUSE_BLOCK,
  HOUSE_BLOCK_SENTENCES,
  HOUSE_LANES,
  houseBlockForStyle,
  houseBlockSentencesFor,
  houseLaneFor,
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
    /* The framing token: mid-torso since #182 (founder, 2026-08-27 — "chest
       up is far too tight we need to see the outfit more"); was "collarbones". */
    expect(HOUSE_BLOCK).toContain("mid-torso");
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
      /* #230 — the append rule is gone, and its replacement says the opposite. */
      "REPLACES the request on the wire",
      /*
        #230 — "the user" is BANNED now (it leaked into a live rewrite), so it
        cannot be in the author's ear either: a word in the instruction is a
        word that gets echoed, which is exactly what the arm below asserts for
        every member of the list.
      */
      "anything you leave out is lost",
      "Write ONE paragraph and nothing else",
      "FACTS STAY",
      "TASTE GOES UP",
    ]) expect(max, clause).toContain(clause);
    expect(max).not.toContain("placed VERBATIM before your text");
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
  /*
    #230 INVERTED THIS, and the arm is written as the property rather than the
    arithmetic: the author's paragraph IS the brief now, so an allowance that
    subtracted the brief would order a long seed cut to the floor — an
    instruction to drop the customer's facts, which his ruling forbids.
  */
  it("allowance is the budget, and never less than the seed plus headroom — a rewrite can always say everything the customer said", () => {
    expect(countWords(THIN)).toBe(4);
    expect(authorAllowance(THIN)).toBe(WORD_BUDGET);
    const huge = Array.from({ length: 600 }, () => "word").join(" ");
    expect(authorAllowance(huge)).toBe(600 + AUTHOR_ALLOWANCE_FLOOR);
    expect(authorAllowance(huge)).toBeGreaterThan(countWords(huge));
  });

  /*
    HIS SENTENCE AS A BYTE ASSERTION (#230): *"Engine gets one brief, not a
    stack … The roll only gets authored brief + studio block."* The seed is in
    the composed prompt only where the author wrote nothing — LOW and the
    fallback — and there it is the customer's own words, unchanged, which is
    his LOW spec.
  */
  it("the composition is ONE brief then the block: the author's paragraph REPLACES the seed, and the seed stands only when nobody authored one", () => {
    expect(composeFinalPrompt(`  ${RICH}  `, " authored paragraph ")).toBe(`authored paragraph\n\n${HOUSE_BLOCK}`);
    expect(composeFinalPrompt(RICH, "authored paragraph")).not.toContain(RICH);
    expect(composeFinalPrompt(THIN, null)).toBe(`${THIN}\n\n${HOUSE_BLOCK}`);
    expect(composeFinalPrompt(THIN, "   ")).toBe(`${THIN}\n\n${HOUSE_BLOCK}`);
    /* Two briefs is the shape he refused; there is no argument list that produces one. */
    expect(composeFinalPrompt(THIN, AUTHORED).split("\n\n")).toHaveLength(2);
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
    const engine = engineAnswering(["A young woman in blackened velvet.", AUTHORED]);
    const out = await authorPrompt({ engine, briefText: THIN, imagination: "max", statedAge: { band: "30s", phase: "mid" } });
    const calls = sent(engine, "author");
    expect(calls).toHaveLength(2);
    expect(calls[1]?.system).toContain("moves the stated age (mid 30s)");
    expect(out).toMatchObject({ mode: "authored", attempts: 2, content: AUTHORED });
  });

  it("the MAX instruction states both §5g rules: facts cannot be rewritten; a finished seed gets pressure only, never new nouns", () => {
    const prompt = maxSystemPrompt(100);
    expect(prompt).toContain("Facts cannot be rewritten");
    expect(prompt).toContain('"mid 30s" must never surface as "young woman"');
    expect(prompt).toContain("the decision is by CONTENT, never length");
    /* #230 item 4, his words: "Heat only. No new nouns." — inside the same paragraph. */
    expect(prompt).toContain("HEAT ONLY, inside the same paragraph");
    expect(prompt).toContain("more severe, more editorial, denser texture, stronger mood");
    expect(prompt).toContain("Forbidden on a finished seed: new nouns");
    expect(prompt).toContain("no named haircut");
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

/*
  THE AUTHOR'S PARAGRAPH, and under #230 it is a REWRITE rather than an
  addition — it carries THIN's own facts (a goth WOMAN in her MID 30s) because
  the customer's words are no longer sent beside it. A fixture that dropped
  them would be refused by the fidelity check, which is the point of it.
*/
/*
  #237: "high collars" came OUT of this fixture the day his MAX noun law
  landed. It was a garment CUT the seed never named — a piece, by his own
  definition — so the canonical PASSING draft was one his law refuses. The
  materials it stands beside (patent, mesh, lace, metal) are exactly what the
  law asks for and are untouched, which is why the swap is one phrase.
*/
const AUTHORED = "A goth woman in her mid 30s: pale cool-toned skin, intense black makeup language, sculpted black hair, and dark structured fashion built from patent, mesh, lace and metal hardware. Still, confrontational studio presence.";

/* ------------------------------------------- #230: ONE BRIEF, NOT A STACK */

/**
 * The founder watched a live MAX sheet and refused its SHAPE (#230, verbatim):
 * *"Engine gets one brief, not a stack … MAX: author rewrites the seed into a
 * single type + look paragraph. Facts stay. Taste goes up. No second essay
 * underneath."* His success test is what these arms encode: one brief, facts
 * intact, same universe, no differ-by caption.
 */
describe("#230 — the author REWRITES, and the four ways his first rewrite failed", () => {
  it("a stacked draft is refused by SHAPE — a blank line is what a second essay looks like", () => {
    expect(isStacked("One paragraph, however long, with no break in it.")).toBe(false);
    expect(isStacked("goth woman mid 30s\n\nPale cool-toned skin, black lace.")).toBe(true);
    /* A single newline is a line wrap, not a second block. */
    expect(isStacked("goth woman mid 30s\nPale cool-toned skin.")).toBe(false);
    expect(draftRefusal("a\n\nb", 100)).toContain("more than one paragraph");
    expect(draftRefusal("a b c", 100)).toBeNull();
  });

  it("a skin word the AUTHOR added is refused; the SAME word in her own brief is not (his 'porcelain-pale' rule)", () => {
    const seed = { text: "goth woman mid 30s", facts: { sex: null, age: null } };
    expect(skinContradictionIn("Translucent, poreless skin under cold light.", seed.text)).toBe("translucent");
    expect(draftRefusal("Translucent skin, black lace.", 100, null, seed)).toContain("real skin");
    /*
      THE NEGATIVE CONTROL, and it is the whole reason this guard is
      seed-exempt: a customer may write any of these about her own cast, and
      the fallback would send her word to the same engine anyway.
    */
    const hers = { text: "goth woman, translucent porcelain skin", facts: { sex: null, age: null } };
    expect(skinContradictionIn("Translucent skin, black lace.", hers.text)).toBeNull();
    expect(draftRefusal("Translucent skin, black lace.", 100, null, hers)).toBeNull();
  });

  it("a word this studio never sends is exempt where SHE wrote it — the rewrite carries her words now", () => {
    /* The guard is unchanged where the author introduced the word. */
    expect(neverWrittenIn("lips oxblood across the set")).toBe("across the set");
    expect(neverWrittenIn("lips oxblood across the set", "a goth woman")).toBe("across the set");
    /* Her own sentence said it, so refusing the rewrite would buy nothing: the fallback sends it too. */
    expect(neverWrittenIn("a contact sheet aesthetic, hard flash", "shot like a contact sheet")).toBeNull();
    expect(draftRefusal("a contact sheet aesthetic", 100, null, { text: "shot like a contact sheet", facts: { sex: null, age: null } })).toBeNull();
  });

  it("driven: a rewrite that drops her stated sex is re-asked once, and the clean second paragraph stands", async () => {
    const engine = engineAnswering(["Pale cool-toned skin, mid 30s, black lace and patent hardware.", AUTHORED]);
    const out = await authorPrompt({ engine, briefText: THIN, imagination: "max", statedSex: "female", statedAge: { band: "30s", phase: "mid" } });
    const calls = sent(engine, "author");
    expect(calls).toHaveLength(2);
    expect(calls[1]?.system).toContain("dropped the subject's sex (female)");
    /* The re-ask rides into the system prompt, so it cannot carry a banned word either. */
    expect(neverWrittenIn(calls[1]?.system ?? "")).toBeNull();
    expect(calls[1]?.system).toContain("replaces the request entirely");
    expect(out).toMatchObject({ mode: "authored", attempts: 2, content: AUTHORED });
  });

  it("HER WORDS ARE THE FLOOR: two drafts that drop a fact fall back to the seed + block, never to a paragraph missing it", async () => {
    /* No "she", no "her", no "woman" — the fact she typed is simply gone. */
    const dropsIt = "Pale cool-toned skin, mid 30s, black lace and patent hardware.";
    const engine = engineAnswering([dropsIt, dropsIt]);
    const out = await authorPrompt({ engine, briefText: THIN, imagination: "max", statedSex: "female", statedAge: { band: "30s", phase: "mid" } });
    expect(sent(engine, "author")).toHaveLength(2);
    /* The customer gets her own sentence — his LOW spec — rather than a rewrite that lost her. */
    expect(out).toMatchObject({ mode: "static", authored: false, content: null, attempts: 2 });
    expect(out.prompt).toBe(`${THIN}\n\n${HOUSE_BLOCK}`);
    expect(out.prompt).toContain("woman");
  });

  it("the fact checks are anchored on HER sentence: a reader-inferred fact is never demanded of the rewrite", async () => {
    /* "a ballerina" — the reader says female; she did not, so a paragraph that never says it is fine. */
    const silent = "Weathered, grave, in worn practice wool and old rosin dust.";
    const engine = engineAnswering([silent]);
    const out = await authorPrompt({ engine, briefText: "a ballerina, weathered and grave", imagination: "max", statedSex: "female" });
    expect(sent(engine, "author")).toHaveLength(1);
    expect(out).toMatchObject({ mode: "authored", attempts: 1, content: silent });
  });
});

/* ------------------------------------------------ the author, driven */

describe("authorPrompt, driven by a throwing and a misbehaving double (law 3)", () => {
  it("LOW: no call at all — seed + block, mode 'seed', zero attempts", async () => {
    const engine = engineAnswering([AUTHORED]);
    const out = await authorPrompt({ engine, briefText: THIN });
    expect(sent(engine, "author")).toHaveLength(0);
    expect(out).toMatchObject({ mode: "seed", authored: false, content: null, imagination: "low", attempts: 0, addedWords: 0, model: null, latencyMs: null });
    expect(out.prompt).toBe(`${THIN}\n\n${HOUSE_BLOCK}`);
    expect(out.houseBlockWords).toBe(countWords(HOUSE_BLOCK));
  });

  it("MAX: one call at 0.8 with the MAX instruction, the interpreter's deadline, no transport retries, the brief as the user turn; the paragraph REPLACES the brief (#230)", async () => {
    const engine = engineAnswering([AUTHORED]);
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
    expect(out).toMatchObject({ mode: "authored", authored: true, content: AUTHORED, imagination: "max", attempts: 1, model: "stub-model", latencyMs: 7 });
    expect(out.prompt).toBe(`${AUTHORED}\n\n${HOUSE_BLOCK}`);
    /* #230 — `addedWords` is the GROWTH over the seed now, not the size of an addition. */
    expect(out.addedWords).toBe(countWords(AUTHORED) - countWords(THIN));
    expect(out.seedWords).toBe(countWords(THIN));
    expect(out.compose).toBe("rewrite");
    /* The seed is not on the wire at all — his "one brief, not a stack". */
    expect(out.prompt).not.toContain(THIN);
    /* The block is byte-identical at the end, and the author wrote none of it. */
    expect(out.prompt.endsWith(HOUSE_BLOCK)).toBe(true);
    expect(containsHouseSentence(out.content ?? "")).toBeNull();
  });

  it("a reply that says 'sternum' is refused and re-asked ONCE, naming the word; the clean second draft is the content", async () => {
    const engine = engineAnswering(["Chest-up, the crop just below the sternum.", AUTHORED]);
    const out = await authorPrompt({ engine, briefText: THIN, imagination: "max" });
    const calls = sent(engine, "author");
    expect(calls).toHaveLength(2);
    expect(calls[1]?.system).toContain('used the word "sternum"');
    expect(calls[1]?.system).toContain("PREVIOUS DRAFT:");
    expect(out).toMatchObject({ mode: "authored", attempts: 2, content: AUTHORED });
    expect(neverWrittenIn(out.content ?? "")).toBeNull();
  });

  it("a draft that narrates the SET or writes a pipeline note is refused by name (dev roll 95 — 7 of 8 tiles were contact-sheet grids)", async () => {
    const engine = engineAnswering(["Skin left open across the set, lips oxblood on every subject.", AUTHORED]);
    const out = await authorPrompt({ engine, briefText: THIN, imagination: "max" });
    expect(sent(engine, "author")[1]?.system).toContain('used the word "across the set"');
    expect(out).toMatchObject({ mode: "authored", attempts: 2 });
  });

  it("a draft that writes studio language is refused — the studio appends its own block", async () => {
    const engine = engineAnswering([`Pale skin. ${PHOTOREAL_PRESET[0]}`, AUTHORED]);
    const out = await authorPrompt({ engine, briefText: THIN, imagination: "max" });
    expect(sent(engine, "author")[1]?.system).toContain("camera/studio language");
    expect(out).toMatchObject({ mode: "authored", attempts: 2, content: AUTHORED });
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
    const engine = engineAnswering(["", "```\n" + AUTHORED + "\n```"]);
    const out = await authorPrompt({ engine, briefText: THIN, imagination: "max" });
    expect(out).toMatchObject({ mode: "authored", content: AUTHORED });
  });
});

/* --------------------------------------------------------------- the WIRE */

describe("the WIRE — off is today's product to the byte", () => {
  it("the author is never called, the row carries no register, the eight prompts are the house road", async () => {
    const engine = engineAnswering([AUTHORED]);
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
    const engine = engineAnswering([AUTHORED]);
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
    /* The reader's record did not move — but on the author road it is MARKED
       UNSENT (#176): one authored prompt paints all eight, so the per-slice
       dice never reach the wire and their record may not be read as a
       delivered fact. The caption is dropped for the same reason — a
       disposition nobody cast must not sit under a tile. */
    expect(on.lockContract).toEqual(off.lockContract);
    expect(on.candidates.map((c) => c.resolvedIdentity)).toEqual(
      off.candidates.map((c) => ({ ...c.resolvedIdentity, unsent: true })),
    );
    expect(on.candidates.every((c) => c.personaLine === null)).toBe(true);
    /* The house road's captions did not move (positive control for the drop). */
    expect(off.candidates.every((c) => typeof c.personaLine === "string" && c.personaLine.length > 0)).toBe(true);
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
    const engine = engineAnswering([AUTHORED]);
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
    expect(on.candidates[0]?.prompt).toBe(`${AUTHORED}\n\n${HOUSE_BLOCK}`);
    expect(on.compiledBrief.register).toMatchObject({ kind: "author", imagination: "max", mode: "authored", authored: true, content: AUTHORED, prompt: `${AUTHORED}\n\n${HOUSE_BLOCK}` });
  });

  it("the WIRE of §5g (#171): the compiler hands the READER's recorded age to the author — an aged-down draft is re-asked at the real call site", async () => {
    /* The stub INTENT records ageBand "30s"; the first draft says "young". */
    const engine = engineAnswering(["A young woman in blackened velvet.", AUTHORED]);
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
    expect(calls[1]?.system).toContain("moves the stated age");
    expect(on.compiledBrief.register).toMatchObject({ mode: "authored", attempts: 2, content: AUTHORED });
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

describe("the WIRE — a FOLLOW is the ROW A road (#177): the photo rides, the clause is his courted sentence, and the unflagged compile does not move", () => {
  it("a FOLLOW with the photo riding: one prompt on all eight — the brief verbatim, the Row A clause, the block; no author call; the reader's record is the house follow's, marked unsent", async () => {
    const off = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-follow",
      engine: engineAnswering([]),
      followIdentity: FOLLOW as never,
    });
    const engine = engineAnswering([AUTHORED]);
    const on = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-follow",
      engine,
      followIdentity: FOLLOW as never,
      creativeRegister: true,
      anchorImageAttached: true,
    });
    expect(sent(engine, "author")).toHaveLength(0);
    /* The unflagged follow is the house road, byte for byte, as it always was. */
    expect(off.candidates[0]?.prompt.startsWith("CASTING CATEGORY (ABSOLUTE)")).toBe(true);
    expect(off.candidates[0]?.prompt).toContain("low bun");
    expect(off.compiledBrief).not.toHaveProperty("register");
    /* The flagged follow: ONE prompt, the fixed clause between the brief and the block. */
    const prompts = new Set(on.candidates.map((c) => c.prompt));
    expect(prompts.size).toBe(1);
    expect(on.candidates[0]?.prompt).toBe(`${RICH}\n\n${FOLLOW_ANCHOR_CLAUSE}\n\n${HOUSE_BLOCK}`);
    /* Never the cut, never a realized axis, never an anchor word AT ALL — the photograph carries the look (#177). */
    expect(on.candidates[0]?.prompt).not.toContain("low bun");
    expect(on.candidates[0]?.prompt).not.toContain("Nordic");
    expect(on.candidates[0]?.prompt).not.toContain("CASTING CATEGORY");
    expect(neverWrittenIn(FOLLOW_ANCHOR_CLAUSE)).toBeNull();
    /* The identities the sheet records are still the house follow's — the
       anchor biased the neighbourhood exactly as before — and they are marked
       unsent (#176), because the one authored prompt never carried them. */
    expect(on.candidates.map((c) => c.resolvedIdentity)).toEqual(
      off.candidates.map((c) => ({ ...c.resolvedIdentity, unsent: true })),
    );
    expect(on.compiledBrief.register).toMatchObject({
      kind: "author",
      mode: "seed",
      prompt: `${RICH}\n\n${FOLLOW_ANCHOR_CLAUSE}\n\n${HOUSE_BLOCK}`,
      carried: { follow: true, overrides: {}, clause: FOLLOW_ANCHOR_CLAUSE },
    });
    /* Chips on a follow are a RECORD like every author-road chip (#177: a chip
       cannot strip a photograph) — the #154 three-axis exception is dead. */
    const chips = on.chips.filter((chip) => chip.field);
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) expect(chip.removable, chip.field).toBe(false);
  });

  it("a FOLLOW at MAX makes NO author call — the courted formula is exhaustive (photo + brief + clause + block), recorded as seed", async () => {
    const engine = engineAnswering([AUTHORED]);
    const on = await castingBriefCompiler({
      briefText: THIN,
      candidateCount: 8,
      rollSeed: "wire-follow-max",
      engine,
      followIdentity: FOLLOW as never,
      creativeRegister: true,
      imagination: "max",
      anchorImageAttached: true,
    });
    expect(sent(engine, "author")).toHaveLength(0);
    expect(on.candidates[0]?.prompt).toBe(`${THIN}\n\n${FOLLOW_ANCHOR_CLAUSE}\n\n${HOUSE_BLOCK}`);
    expect(on.compiledBrief.register).toMatchObject({
      kind: "author",
      mode: "seed",
      authored: false,
      content: null,
      carried: { follow: true },
    });
  });

  it("no record can reach the clause — the #176 ghost class is structurally dead: dice AND stated anchor supplied, the clause is the fixed bytes", async () => {
    const engine = engineAnswering([AUTHORED]);
    const on = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-follow-ghostproof",
      engine,
      followIdentity: FOLLOW as never,
      followStatedAnchor: FOLLOW as never,
      creativeRegister: true,
      anchorImageAttached: true,
    });
    const clause = (on.compiledBrief.register as { carried: { clause: string } }).carried.clause;
    expect(clause).toBe(FOLLOW_ANCHOR_CLAUSE);
    for (const recordWord of ["Nordic", "blonde", "severe minimal", "20s", "woman"]) {
      expect(clause, recordWord).not.toContain(recordWord);
    }
    /* Positive control for the reader above: a planted record word IS caught. */
    expect(`${clause} of Nordic heritage`).toContain("Nordic");
  });

  it("adjustments handed in WITH an anchored follow do not move the prompt — the compiler's half of 'facts change at the roll, never at the follow' (the entrance drops them; this is the belt)", async () => {
    const engine = engineAnswering([AUTHORED]);
    const on = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-follow-belt",
      engine,
      followIdentity: FOLLOW as never,
      overrides: { ageBand: "40s" } as never,
      creativeRegister: true,
      anchorImageAttached: true,
    });
    /* No rewrite, no axis in the clause, the wire is the courted bytes. */
    expect((on.compiledBrief.register as { briefSent: string }).briefSent).toBe(RICH);
    expect(on.compiledBrief.register).not.toHaveProperty("rewrites");
    expect(on.candidates[0]?.prompt).toBe(`${RICH}\n\n${FOLLOW_ANCHOR_CLAUSE}\n\n${HOUSE_BLOCK}`);
    expect(on.candidates[0]?.prompt).not.toContain("40s");
  });

  it("a follow WITHOUT the photo attached carries no clause at all — 'the attached look' is never said to an engine with no attachment", async () => {
    const engine = engineAnswering([AUTHORED]);
    const on = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-follow-unattached",
      engine,
      followIdentity: FOLLOW as never,
      creativeRegister: true,
      /* anchorImageAttached deliberately absent. */
    });
    expect(on.candidates[0]?.prompt).toBe(`${RICH}\n\n${HOUSE_BLOCK}`);
    expect(on.candidates[0]?.prompt).not.toContain("attached look");
    expect(on.compiledBrief.register).not.toHaveProperty("carried");
  });

  it("an OVERRIDE without a follow lands in the brief itself — no clause, no tie-breaker (#164, unchanged by Row A)", async () => {
    const overridden = engineAnswering([AUTHORED]);
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
    expect(c.candidates[0]?.prompt).not.toContain("this wins");
  });

  it("an UNLOCK on a plain authored roll reaches nothing the engine reads — no clause, the prompt is the plain one, and every derived chip is read-only", async () => {
    const plain = engineAnswering([AUTHORED]);
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
    const empty = engineAnswering([AUTHORED]);
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
    const engine = engineAnswering([AUTHORED]);
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
function engineReading(interpretReplies: (string | Record<string, unknown>)[], authorReply: string = AUTHORED): Engine {
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
    /*
      #232/#237: the reader called it a `being`, so the block it was painted
      under is the CREATURE lane's — asserted at the candidate's own prompt,
      which is the wire, and never at the constant beside it (working law 5).
    */
    expect(on.candidates[0]?.prompt).toBe(`${brief}\n\n${CREATURE_HOUSE_BLOCK}`);
    expect(on.candidates[0]?.prompt).not.toBe(`${brief}\n\n${HOUSE_BLOCK}`);
    expect(on.compiledBrief.register).toMatchObject({ kind: "author", mode: "seed", subject: "being", lane: "creature" });
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
    const max = await authorPrompt({ engine: engineAnswering([AUTHORED]), briefText: THIN, imagination: "max", style: "photoreal" });
    expect(max).toMatchObject({ style: "photoreal", mode: "authored", prompt: `${AUTHORED}\n\n${HOUSE_BLOCK}` });
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

/* ---------------------------------------------- the lanes (#232, #237) */

describe("the block by LANE — his creature split (#232) and the anatomy clause (#237)", () => {
  it("the HUMAN lane is byte-identical to the block this road has always sent", () => {
    expect(houseBlockForStyle("photoreal")).toBe(HOUSE_BLOCK);
    expect(houseBlockForStyle("photoreal", "human")).toBe(HOUSE_BLOCK);
    /* Positive control: the two lanes really are different bytes, so the arm above could have failed. */
    expect(houseBlockForStyle("photoreal", "creature")).not.toBe(HOUSE_BLOCK);
    expect(houseBlockForStyle("photoreal", "creature")).toBe(CREATURE_HOUSE_BLOCK);
  });

  it("the lanes differ in EXACTLY two sentences, and every other sentence of the block is shared", () => {
    const human = houseBlockSentencesFor("human");
    const creature = houseBlockSentencesFor("creature");
    /* The creature lane ADDS the anatomy sentence and SWAPS the expression one. */
    expect(human.filter((line) => !creature.includes(line))).toEqual([EXPRESSION_LINE]);
    expect(creature.filter((line) => !human.includes(line))).toEqual([ANATOMY_VISIBILITY_LINE, CREATURE_EXPRESSION_LINE]);
    expect(creature).toHaveLength(human.length + 1);
    expect(human).toEqual(HOUSE_BLOCK_SENTENCES);
  });

  it("#232 — the human line keeps 'mouth closed'; the creature line is mouth AT REST with its own anatomy, and keeps every ban he kept", () => {
    expect(EXPRESSION_LINE).toContain("mouth closed");
    expect(CREATURE_EXPRESSION_LINE).not.toContain("mouth closed");
    expect(CREATURE_EXPRESSION_LINE).toContain("mouth at rest");
    /* His own sentence carries the logic. */
    expect(CREATURE_EXPRESSION_LINE).toContain("pose off, anatomy on");
    /* Allowed at rest — his own nouns. */
    for (const anatomy of ["non-human dentition", "tusks", "underbite", "split lip", "species tongue"]) {
      expect(CREATURE_EXPRESSION_LINE).toContain(anatomy);
    }
    /* Still banned — his four, plus the human line's own CGI stare. */
    for (const banned of ["No laugh", "no speech", "no acted roar", "no tongue out as a pose", "no blank CGI stare"]) {
      expect(CREATURE_EXPRESSION_LINE).toContain(banned);
    }
  });

  it("#237 — the anatomy clause is a FRAMING fact: his three placements, both prohibitions, and no second crop word", () => {
    for (const placement of ["over a shoulder", "beside the ribcage", "rising into the picture"]) {
      expect(ANATOMY_VISIBILITY_LINE).toContain(placement);
    }
    expect(ANATOMY_VISIBILITY_LINE).toContain("Do not hide it behind the back.");
    expect(ANATOMY_VISIBILITY_LINE).toContain("Do not switch to a full-body shot.");
    expect(ANATOMY_VISIBILITY_LINE).toContain("tail");
    expect(ANATOMY_VISIBILITY_LINE).toContain("wings");
    /*
      THE ADAPTATION, ASSERTED: his sentence says "the chest-up frame" and the
      block's crop has been MID-TORSO since #182, on his own reversal. A second
      crop word here would hand the engine two framings, so the clause says
      "this frame" — and the creature block must therefore still name exactly
      one crop.
    */
    expect(ANATOMY_VISIBILITY_LINE.toLowerCase()).not.toContain("chest-up");
    expect(ANATOMY_VISIBILITY_LINE.toLowerCase()).not.toContain("chest up");
    expect(CREATURE_HOUSE_BLOCK).toContain("mid-torso");
    expect(CREATURE_HOUSE_BLOCK.toLowerCase()).not.toContain("chest-up");
    /* It sits with the crop sentences, before the posture line — it is framing, not mood. */
    expect(CREATURE_HOUSE_BLOCK.indexOf(ANATOMY_VISIBILITY_LINE)).toBeGreaterThan(CREATURE_HOUSE_BLOCK.indexOf("Nothing on the head is clipped"));
    expect(CREATURE_HOUSE_BLOCK.indexOf(ANATOMY_VISIBILITY_LINE)).toBeLessThan(CREATURE_HOUSE_BLOCK.indexOf(POSTURE_LINE));
  });

  it("#243 — the rule is SPECIES now: his sentence in the creature lane, the people lane structurally without it", () => {
    /*
      Founder order, Crew reply #38 (2026-08-30): "Rewrite the rule to species —
      measured, not guessed. … The next sentence in the house block should be:
      Show anatomy the species implies, even when the brief doesn't name the
      part. People lane unchanged: mouth closed, no teeth, no tongue."
      Court: docs/specs/SPECIES_ANATOMY_COURT_2026-09-05.md (his four checks).
    */
    expect(ANATOMY_VISIBILITY_LINE).toContain(
      "Show anatomy the species implies, even when the description doesn't name the part.",
    );
    /* THE ADAPTATION, ASSERTED like the chest-up one: his "the brief" is "the
       description" here, because "brief" has no referent inside the block and
       AUTHORITY_LINE already names the customer's text "the description". */
    expect(ANATOMY_VISIBILITY_LINE.toLowerCase()).not.toContain("brief");
    /* His sentence sits BETWEEN the named-anatomy rule and his two prohibitions,
       so the placements and prohibitions govern named and implied anatomy alike. */
    expect(ANATOMY_VISIBILITY_LINE.indexOf("Show anatomy the species implies")).toBeGreaterThan(
      ANATOMY_VISIBILITY_LINE.indexOf("anatomy the description names"),
    );
    expect(ANATOMY_VISIBILITY_LINE.indexOf("Show anatomy the species implies")).toBeLessThan(
      ANATOMY_VISIBILITY_LINE.indexOf("Do not hide it behind the back."),
    );
    /* "People lane unchanged" is structural: the human block never carries the
       species sentence — mouth closed, no teeth, no tongue is EXPRESSION_LINE's,
       and the byte-identity arm above holds the rest of that promise. */
    expect(HOUSE_BLOCK).not.toContain("species implies");
    expect(CREATURE_HOUSE_BLOCK).toContain("species implies");
    expect(EXPRESSION_LINE).toContain("mouth closed");
  });

  it("the forbidden-token guard and the never-written list read BOTH lanes, not just the human bytes", () => {
    for (const lane of HOUSE_LANES) {
      const block = houseBlockForStyle("photoreal", lane).toLowerCase();
      for (const { phrase } of DROPPED_FROM_BLOCK) expect(block).not.toContain(phrase.toLowerCase());
      expect(neverWrittenIn(houseBlockForStyle("photoreal", lane))).toBeNull();
    }
    /* And the author may not copy EITHER lane's sentences. */
    expect(containsHouseSentence(`taste. ${CREATURE_EXPRESSION_LINE}`)).toBe(CREATURE_EXPRESSION_LINE);
    expect(containsHouseSentence(`taste. ${ANATOMY_VISIBILITY_LINE}`)).toBe(ANATOMY_VISIBILITY_LINE);
    expect(containsHouseSentence(`taste. ${EXPRESSION_LINE}`)).toBe(EXPRESSION_LINE);
    /* Negative control: ordinary cast-layer prose about a tail is not a house sentence. */
    expect(containsHouseSentence("A sovereign feline humanoid with a long tail.")).toBeNull();
  });

  it("the lane comes from the READER's subject and nothing else — `unread` is the human lane, which is today's bytes", () => {
    expect(houseLaneFor("being")).toBe("creature");
    expect(houseLaneFor("human")).toBe("human");
    expect(houseLaneFor("unread")).toBe("human");
    expect(houseLaneFor(null)).toBe("human");
    expect(houseLaneFor(undefined)).toBe("human");
  });

  it("the lane reaches the PROMPT and the row through the author, on all three modes", async () => {
    const brief = "a sphinx-cat humanoid with a long tail";
    /* seed (LOW): no author call at all. */
    const low = await authorPrompt({ engine: engineAnswering([]), briefText: brief, imagination: "low", lane: "creature" });
    expect(low.prompt).toBe(`${brief}\n\n${CREATURE_HOUSE_BLOCK}`);
    expect(low.lane).toBe("creature");
    expect(low.houseBlockWords).toBe(countWords(CREATURE_HOUSE_BLOCK));
    /* authored (MAX). */
    const max = await authorPrompt({
      engine: engineAnswering(["Sovereign feline humanoid in aged bronze, ceremonial and worn."]),
      briefText: brief, imagination: "max", lane: "creature",
    });
    expect(max.mode).toBe("authored");
    expect(max.prompt.endsWith(CREATURE_HOUSE_BLOCK)).toBe(true);
    expect(max.lane).toBe("creature");
    /* static (MAX, refused twice) — the fallback keeps the lane. */
    const stat = await authorPrompt({ engine: engineAnswering(["", ""]), briefText: brief, imagination: "max", lane: "creature" });
    expect(stat.mode).toBe("static");
    expect(stat.prompt).toBe(`${brief}\n\n${CREATURE_HOUSE_BLOCK}`);
    expect(stat.lane).toBe("creature");
    /* And the default is the human lane, byte for byte. */
    const human = await authorPrompt({ engine: engineAnswering([]), briefText: brief, imagination: "low" });
    expect(human.prompt).toBe(`${brief}\n\n${HOUSE_BLOCK}`);
    expect(human.lane).toBe("human");
  });
});

/* ---------------------------------- the pieces, his MAX law (#237 half 1) */

describe("PIN THE WORLD, NEVER THE PIECES — his MAX noun law (#237)", () => {
  it("his three failing nouns are the fixture, and each is refused only where the AUTHOR added it", () => {
    const seed = "a sphinx-cat humanoid in dark structured armour";
    for (const kit of ["angular pauldrons", "banded vambraces", "a high sculpted collar"]) {
      expect(pieceNounIn(`Sovereign feline humanoid with ${kit}.`, seed)).not.toBeNull();
    }
    /* FACTS STAY PUT — his own clause: a piece the customer typed survives. */
    expect(pieceNounIn("Sovereign feline humanoid with angular pauldrons.", "a warrior in angular pauldrons")).toBeNull();
    /* His golden target passes whole. */
    const golden =
      "Adult feline humanoid, hairless violet-blue skin, large ears, whiskers, luminous amber eyes, long tail. "
      + "Sphinx-cat presence, sovereign and predatory. Dark structured armour in aged bronze and gold with jewel-toned inlay — ceremonial, worn, formidable.";
    expect(pieceNounIn(golden, seed)).toBeNull();
    /* And so does his own "optional heat", which is pressure and not parts. */
    expect(pieceNounIn("Metal hand-finished and battle-worn, not costume-clean. Eyes still and calculating. No soft youthful rounding.", seed)).toBeNull();
  });

  it("THE PLURAL IS THE FIXTURE'S OWN DEFECT: 'high collars' is caught, and 'collarbones' is not", () => {
    expect(pieceNounIn("a high sculpted collar", "seed")).toBe("collar");
    /* The suite's canonical author fixture said "high collarS" — a singular-only list would have missed it. */
    expect(pieceNounIn("dark structured fashion with high collars and metal hardware", "seed")).toBe("collar");
    /*
      POSITIVE CONTROL on the boundary. The court (§4) found "collarbones" is
      what gets a prompt through where "sternum" does not, so a ban that swept
      it would cost the road the one word that works.
    */
    expect(pieceNounIn("cropped at the collarbones", "seed")).toBeNull();
    expect(pieceNounIn("a collarbone tattoo", "seed")).toBeNull();
  });

  it("THE NON-CATCH IS ASSERTED OUT LOUD: garments, cuts and jewellery are INSTRUCTION rules, not banned words", () => {
    /*
      His law names four classes and this list holds ONE of them. A word ban
      over the world's garments either sweeps ordinary prose or is a taxonomy
      nobody wrote — the `cropped` / `framing` class, four times in this repo.
      So these pass the CHECK and are carried by `maxSystemPrompt` alone, and a
      green suite must never be read as a reader that catches them.
    */
    for (const notCaught of ["a cropped leather jacket", "a silver septum ring", "a blunt bob", "knee-high boots"]) {
      expect(pieceNounIn(notCaught, "seed")).toBeNull();
    }
    /* The instruction is where they live, and it names all four classes in his words. */
    const rules = maxSystemPrompt(400);
    expect(rules).toContain("PIN THE WORLD, NEVER THE PIECES");
    expect(rules).toContain("Pin materials, mood and species facts");
    expect(rules).toContain("NEVER pin an exact garment, an exact cut, a jewellery piece or an armour piece the request did not name");
    expect(rules).toContain("FACES STAY FREE. FACTS STAY PUT.");
    /* His golden target and his failing kit are both shown, labelled. */
    expect(rules).toContain("Adult feline humanoid, hairless violet-blue skin");
    expect(rules).toContain("angular pauldrons, banded vambraces, a high sculpted collar");
    /* And the instruction must not teach the words the set-narration ban exists for. */
    expect(neverWrittenIn(rules)).toBeNull();
  });

  it("a draft that names a piece is REFUSED and re-asked — driven at the author, not asserted at the constant", async () => {
    const seed = "a sphinx-cat humanoid in dark structured armour";
    const kit = "Sovereign feline humanoid in angular pauldrons and banded vambraces.";
    const clean = "Sovereign feline humanoid in dark structured armour, aged bronze and gold, ceremonial and worn.";
    const engine = engineAnswering([kit, clean]);
    const out = await authorPrompt({ engine, briefText: seed, imagination: "max", lane: "creature" });
    expect(out.mode).toBe("authored");
    expect(out.content).toBe(clean);
    expect(out.attempts).toBe(2);
    /* The re-ask names the noun, so the author is told what to remove. */
    const second = sent(engine, "author")[1];
    expect(second?.system).toContain("pauldron");
    expect(second?.system).toContain("a specific piece the request never named");
    /* Twice refused falls to the customer's own words, never to a kit. */
    const both = engineAnswering([kit, kit]);
    const fell = await authorPrompt({ engine: both, briefText: seed, imagination: "max", lane: "creature" });
    expect(fell.mode).toBe("static");
    expect(fell.prompt).toBe(`${seed}\n\n${CREATURE_HOUSE_BLOCK}`);
  });

  it("every entry carries its reason, and the refusal order puts the piece AFTER the skin word", () => {
    expect(PIECE_NOUNS.length).toBeGreaterThanOrEqual(12);
    for (const { word, because } of PIECE_NOUNS) {
      expect(word).toBe(word.toLowerCase());
      expect(because.length).toBeGreaterThan(10);
    }
    const seed = { text: "a sphinx-cat humanoid", facts: seedFactsOf("a sphinx-cat humanoid", { sex: null, age: null }) };
    /* A draft with BOTH a banned skin word and a piece is told about the skin first: it is the one that makes the engine refuse the picture. */
    expect(draftRefusal("Translucent-skinned feline humanoid in angular pauldrons.", 400, null, seed)).toContain("translucent");
    expect(draftRefusal("Feline humanoid in angular pauldrons.", 400, null, seed)).toContain("pauldron");
    /* And with no seed handed in, the piece check does not run at all — it cannot know what she typed. */
    expect(draftRefusal("Feline humanoid in angular pauldrons.", 400)).toBeNull();
  });
});

/**
 * FITTED IS NOT A PIECE — his ruling (#279), on the AUTHOR half.
 *
 * The READER half (`conceptDescribe.ts`) has carried this test since the day he
 * ruled it; the author did not, and the author is where the collision lives.
 * The sentence above it says *never name a part*; `FACTS STAY` says every
 * stated feature survives. A bolted-in eye is caught by both.
 *
 * ⚠ THESE ARMS PIN A BEHAVIOUR THAT WAS ALREADY CORRECT, and saying so is the
 * point rather than a caveat. Driven before the clause was written: 18 real
 * drafts over four seed shapes kept the fitted hardware every time and named a
 * product never, and the paid frames gate delivered it on 8 of 8 faces. So
 * nothing here is a repair — it moves a rule off the model's read and onto the
 * sentence, which is what this repo does with anything a coin currently gets
 * right.
 */
describe("FITTED IS NOT A PIECE — his fitted/worn test on the author (#279)", () => {
  /** The clause is judged on the sentence, not on the source layout. */
  const fittedRule = (): string => {
    const prompt = maxSystemPrompt(400);
    const at = prompt.indexOf("FITTED IS NOT A PIECE");
    expect(at, "the clause is in the instruction the engine receives").toBeGreaterThan(-1);
    return prompt.slice(at, at + 900).replace(/\s+/g, " ");
  };

  it("states his test, and states it directly under the rule it resolves", () => {
    const prompt = maxSystemPrompt(400);
    /*
      POSITION IS PART OF THE CLAIM. A clause about the piece-ban that sits
      paragraphs away from the piece-ban is a different instruction: this
      asserts it follows PIN THE WORLD and precedes that rule's worked example,
      so the two are read together.
    */
    const pieces = prompt.indexOf("PIN THE WORLD, NEVER THE PIECES");
    const fitted = prompt.indexOf("FITTED IS NOT A PIECE");
    const example = prompt.indexOf("Worked example of the PIECES rule");
    expect(pieces).toBeGreaterThan(-1);
    expect(fitted).toBeGreaterThan(pieces);
    expect(fitted).toBeLessThan(example);

    const rule = fittedRule();
    /* His own line: by WHERE it sits, not by what it is made of. */
    expect(rule, "the test is placement").toContain("where the thing sits, not by what it is made of");
    expect(rule, "fitted into the body").toContain("Fitted INTO the body it is a FEATURE");
    expect(rule, "worn on the body").toContain("WORN on the body it is an accessory");
    /* Anatomy, widened from biology — his build item 1. */
    expect(rule, "it stands beside the biological features").toContain("like a horn or a tail");
    expect(rule, "his own specimen").toContain("mechanical eye set into the skull");
    /* And it must not tell the author to drop it — his "do not flatten it away". */
    expect(rule, "never flatten the being's own hardware").toContain("Do not flatten one away");
  });

  it("asks for a TYPE and not a product, showing both of the ones he refused", () => {
    const rule = fittedRule();
    for (const type of ["fitted mechanical eye", "integrated facial hardware"]) {
      expect(rule, type).toContain(type);
    }
    for (const sku of ["spiked eye harness", "sleek mechanical eye piece"]) {
      expect(rule, sku).toContain(sku);
    }
  });

  it("⚠ THE NON-CATCH IS ASSERTED OUT LOUD: nothing here became a banned word", () => {
    /*
      His build item 3, and the reason is five recorded instances in this repo
      of a ban that swept ordinary prose (`cropped`, bare `framing`,
      `reminiscent of`…). "harness", "piece", "eye" and "choker" all have a
      second sense a casting paragraph legitimately uses, so the two shapes he
      refused are SHOWN in the instruction and caught by NOTHING. A green suite
      must never be read as a checker that stops them.
    */
    const seed = "a cyborg woman with a mechanical eye";
    for (const notCaught of [
      "a spiked eye harness",
      "a sleek mechanical eye piece",
      "a black leather choker",
      "a fitted mechanical eye set into the skull",
    ]) {
      expect(pieceNounIn(notCaught, seed), notCaught).toBeNull();
      expect(neverWrittenIn(notCaught), notCaught).toBeNull();
    }
    /* POSITIVE CONTROL on the same checker, so the nulls above are not a dead reader. */
    expect(pieceNounIn("a high sculpted collar", seed)).toBe("collar");
  });

  it("the clause itself teaches no word this studio never sends, and no piece the ban would refuse", () => {
    /*
      The instruction is text the model reads and imitates, so it is held to
      the same two checks a draft is. `PIECE_NOUNS` is asked of the CLAUSE
      alone rather than the whole prompt, because the prompt deliberately
      quotes "no sculpted collar" one sentence earlier as the thing to avoid.
    */
    expect(neverWrittenIn(maxSystemPrompt(400))).toBeNull();
    expect(pieceNounIn(fittedRule(), "")).toBeNull();
  });

  it("it reaches the engine — driven at the author, not asserted at the constant", async () => {
    const seed = "cyborg woman, late 30s, augmented face";
    const engine = engineAnswering(["Adult cyborg woman, late 30s, a mechanical eye set into the skull, real weathered skin."]);
    const out = await authorPrompt({ engine, briefText: seed, imagination: "max" });
    expect(out.mode).toBe("authored");
    const system = sent(engine, "author")[0]?.system ?? "";
    expect(system).toContain("FITTED IS NOT A PIECE");
    /* And a draft that keeps a fitted part as a type is not refused by anything. */
    expect(draftRefusal(out.content ?? "", 400, null, { text: seed, facts: seedFactsOf(seed, { sex: null, age: null }) })).toBeNull();
  });
});

/**
 * #327 — MAX IS OVER-AUTHORING. His four corrections, read at his own MAX draft
 * of his own 553-character cyborg brief, under the *"let opus build it"*
 * carve-out and its two conditions.
 *
 * ⚠ **THESE ARMS PROVE THE INSTRUCTION SAYS IT, NEVER THAT THE MODEL OBEYED
 * IT.** Three of his six pass items ("costume generic or absent", "one skin
 * read", "legible at a glance") are judgements with no honest mechanical
 * reader, and `droppedFactIn` tests PRESENCE where he asked for PROMINENCE.
 * The evidence is the driven before/after on his own brief — six author drafts
 * and eight painted frames — and his eye on the strip. A green suite here is
 * not a passing sheet.
 */
describe("#327 — the four corrections to MAX", () => {
  it("carries all four rules, each by the clause that makes it bite", () => {
    const max = maxSystemPrompt(200);
    for (const clause of [
      /* 1 — no new subject. His live case is wardrobe; the class is backstory/profession/world. */
      "NO NEW SUBJECT",
      "keep it generic or leave it out",
      "no profession, no employer, no organisation, no backstory",
      "a casting note about a look, not a character",
      /* 2 — resolve, never stack. */
      "RESOLVE A CONTRADICTION, NEVER STACK IT",
      "never a third layer of texture words piled on afterwards",
      /* 3 — the facts stay first-class, as an ORDERING rule. */
      "STATED FACTS COME FIRST AND STAY LEGIBLE",
      "Taste comes AFTER the facts, never wrapped around them",
      /* 4 — do not restate the block. */
      "do not restate or paraphrase the studio's own rules or its negatives",
      "One brief, not a story plus a brief",
    ]) expect(max, clause).toContain(clause);
  });

  it("⚠ rule 2 may never read as permission to DROP a stated fact", () => {
    /* Without this clause, "resolve into one reading" is an instruction to
       delete one of two stated facts — which is what FACTS STAY forbids and
       what the court measured the free-reword arm doing (2 of 2). It is the
       one sentence in rule 2 whose removal changes the rule's meaning. */
    expect(RESOLVE_NOT_STACK_RULE).toContain("Resolving is not dropping");
    expect(RESOLVE_NOT_STACK_RULE).toContain("both stated facts survive");
  });

  it("⚠ the SIX universal rules are not filed under the thin-seed fork", () => {
    /*
      They were bullets under "On a thin seed:" while the CODE enforced all six
      on BOTH branches — including the no-studio rule his rule 4 is about, and
      his failing draft was of a FINISHED seed. Move any of them back above the
      heading and this reddens.
    */
    const max = maxSystemPrompt(200);
    const thin = max.indexOf("On a thin seed:");
    const universal = max.indexOf(UNIVERSAL_RULES_HEADING);
    expect(thin, "the thin-seed branch is still named").toBeGreaterThan(-1);
    expect(universal, "the universal heading sits after the thin fork").toBeGreaterThan(thin);
    for (const clause of [
      "Do NOT write any camera, lens, framing",
      "Do NOT write notes about the series",
      "Do NOT ADD skin or surface words",
      "Word allowance for YOUR paragraph",
      "avoid explicit sheer or revealing clothing language",
      "Write ONE paragraph and nothing else",
    ]) expect(max.indexOf(clause), clause).toBeGreaterThan(universal);
  });

  it("⚠ rule 3 points at a worked example that is ABOVE it", () => {
    /* Its shape decision is taken from his own approved sphinx target, which
       opens with exactly the compact plain fact list the rule asks for. If the
       example moves below the rule, the instruction tells the author to look
       up at nothing. */
    const max = maxSystemPrompt(200);
    expect(max.indexOf("Worked example of the PIECES rule"))
      .toBeLessThan(max.indexOf(FACTS_FIRST_RULE));
    expect(FACTS_FIRST_RULE).toContain("the way the worked example above opens");
  });

  it("⚠ AND NO WORD BAN WAS ADDED — said out loud, so a green run is never read as a reader that catches these", () => {
    /*
      His four rules are INSTRUCTION rules and nothing else. A ban on
      "soldier", "wardrobe", "history" or "military" would sweep ordinary prose
      about a face — this module's own admission test, and the fifth time this
      repository has met it (`cropped`, `framing`, `reminiscent of`, and the
      two named in PIECE_NOUNS). The measurement lives in the driven
      before/after; his eye is the gate.
    */
    const banned = [...NEVER_WRITTEN.map((n) => n.word), ...PIECE_NOUNS.map((piece) => piece.word)];
    for (const word of ["soldier", "operative", "wardrobe", "backstory", "history", "military"]) {
      expect(banned, `${word} is deliberately NOT banned`).not.toContain(word);
    }
    /* And the instruction may still SAY them — a rule has to name what it forbids. */
    expect(NO_NEW_SUBJECT_RULE).toContain("WARDROBE");
    expect(NO_NEW_SUBJECT_RULE).toContain("backstory");
  });
});
