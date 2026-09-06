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
  composeFinalPrompt,
  countWords,
  isStacked,
  NEVER_WRITTEN,
  neverWrittenIn,
  PIECE_NOUNS,
  pieceNounIn,
  seedPromptRecord,
  skinContradictionIn,
  staticPrompt,
} from "./promptAuthor";
import { reimagineRefusal, reimagineSystemPrompt } from "./reimagine";
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
describe("the word guards both roads share (#230's rules, now the Re-imagine chain's)", () => {
  it("a stacked draft is refused by SHAPE — a blank line is what a second essay looks like", () => {
    expect(isStacked("One paragraph, however long, with no break in it.")).toBe(false);
    expect(isStacked("goth woman mid 30s\n\nPale cool-toned skin, black lace.")).toBe(true);
    /* A single newline is a line wrap, not a second block. */
    expect(isStacked("goth woman mid 30s\nPale cool-toned skin.")).toBe(false);
    /* A seed with no locked trio, so the shape check is the only guard in play here. */
    expect(reimagineRefusal("a\n\nb", 100, "a portrait")).toContain("more than one paragraph");
    expect(reimagineRefusal("a b c", 100, "a portrait")).toBeNull();
  });

  it("a skin word the AUTHOR added is refused; the SAME word in her own brief is not (his 'porcelain-pale' rule)", () => {
    const seed = "goth woman in her mid 30s";
    expect(skinContradictionIn("Translucent, poreless skin under cold light.", seed)).toBe("translucent");
    expect(reimagineRefusal("A goth woman in her mid 30s, translucent skin, black lace.", 100, seed)).toContain("real skin");
    /*
      THE NEGATIVE CONTROL, and it is the whole reason this guard is
      seed-exempt: a customer may write any of these about her own cast, and
      her own words go to the same engine anyway.
    */
    const hers = "goth woman, translucent porcelain skin";
    expect(skinContradictionIn("Translucent skin, black lace.", hers)).toBeNull();
    expect(reimagineRefusal("A goth woman, translucent skin, black lace.", 100, hers)).toBeNull();
  });

  it("a word this studio never sends is exempt where SHE wrote it — the idea carries her words", () => {
    /* The guard is unchanged where the author introduced the word. */
    expect(neverWrittenIn("lips oxblood across the set")).toBe("across the set");
    expect(neverWrittenIn("lips oxblood across the set", "a goth woman")).toBe("across the set");
    /* Her own sentence said it, so refusing the idea would buy nothing: her own words send it too. */
    expect(neverWrittenIn("a contact sheet aesthetic, hard flash", "shot like a contact sheet")).toBeNull();
    expect(reimagineRefusal("a contact sheet aesthetic", 100, "shot like a contact sheet")).toBeNull();
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
    /* NO author call, ever, at a roll (#535): seed + the locked block is the whole road. */
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
    /* The row says how it was composed, and carries the whole prompt for the sheet to show. */
    expect(on.compiledBrief.register).toMatchObject({
      kind: "author",
      mode: "seed",
      authored: false,
      content: null,
      houseBlockWords: countWords(HOUSE_BLOCK),
      prompt: `${RICH}\n\n${HOUSE_BLOCK}`,
    });
    /*
      And NO author-call field rides a new row (#535): the level, the call
      count and the refusal record were facts about a text call this road no
      longer makes. A census over old rows still reads them there.
    */
    for (const gone of ["imagination", "attempts", "refusals", "model", "latencyMs", "allowance", "addedWords"]) {
      expect(gone in (on.compiledBrief.register as Record<string, unknown>), gone).toBe(false);
    }
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

  it("a FOLLOW makes NO author call — the courted formula is exhaustive (photo + brief + clause + block), recorded as seed", async () => {
    const engine = engineAnswering([]);
    const on = await castingBriefCompiler({
      briefText: THIN,
      candidateCount: 8,
      rollSeed: "wire-follow-max",
      engine,
      followIdentity: FOLLOW as never,
      creativeRegister: true,
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
    const empty = engineAnswering([]);
    const c = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-empty-override",
      engine: empty,
      overrides: {},
      unlock: [],
      creativeRegister: true,
    });
    /* No author call at a roll (#535); the seed road, with no clause. */
    expect(sent(empty, "author")).toHaveLength(0);
    expect(c.compiledBrief.register).toMatchObject({ kind: "author", mode: "seed" });
    expect(c.candidates[0]?.prompt).toBe(`${RICH}\n\n${HOUSE_BLOCK}`);
  });

  it("a brand name never reaches the engine (founder gate 21): the brief is scrubbed before the prompt is composed", async () => {
    const engine = engineAnswering([]);
    const on = await castingBriefCompiler({
      briefText: "a young male Mediterranean model inspired by Versace editorial",
      candidateCount: 8,
      rollSeed: "wire-brand",
      engine,
      creativeRegister: true,
    });
    for (const candidate of on.candidates) expect(candidate.prompt.toLowerCase()).not.toContain("versace");
    const prompt = String((on.compiledBrief.register as { prompt: string }).prompt);
    expect(prompt.toLowerCase()).not.toContain("versace");
    expect(prompt).toContain("editorial");
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

  it("the composition records the style: absent means photoreal, given is kept", () => {
    const absent = seedPromptRecord({ briefText: THIN });
    expect(absent).toMatchObject({ style: "photoreal", mode: "seed", prompt: `${THIN}\n\n${HOUSE_BLOCK}` });
    const given = seedPromptRecord({ briefText: THIN, style: "photoreal" });
    expect(given).toMatchObject({ style: "photoreal", mode: "seed", prompt: `${THIN}\n\n${HOUSE_BLOCK}` });
  });

  it("the compile writes the style onto the register row, and the projection reads it back through a validator", async () => {
    const on = await castingBriefCompiler({
      briefText: RICH,
      candidateCount: 8,
      rollSeed: "wire-style",
      engine: engineAnswering([]),
      creativeRegister: true,
      style: "photoreal",
    });
    expect(on.compiledBrief.register).toMatchObject({ kind: "author", style: "photoreal" });
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
       so the placements and prohibitions govern named and implied anatomy alike.
       The anchors are asserted PRESENT first, or a deleted named-anatomy clause —
       the exact tightening he forbade — would make the indexOf pair pass vacuously
       (review of #528, finding 1). */
    expect(ANATOMY_VISIBILITY_LINE).toContain("anatomy the description names");
    expect(ANATOMY_VISIBILITY_LINE).toContain("Do not hide it behind the back.");
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

  it("the lane reaches the PROMPT and the row through the one composition (#535: the seed road is the only road)", () => {
    const brief = "a sphinx-cat humanoid with a long tail";
    const creature = seedPromptRecord({ briefText: brief, lane: "creature" });
    expect(creature.prompt).toBe(`${brief}\n\n${CREATURE_HOUSE_BLOCK}`);
    expect(creature.lane).toBe("creature");
    expect(creature.houseBlockWords).toBe(countWords(CREATURE_HOUSE_BLOCK));
    /* And the default is the human lane, byte for byte. */
    const human = seedPromptRecord({ briefText: brief });
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
    /* And so does his own "optional heat", which is pressure and not parts (one word removed under #477 — the full-chain arm below). */
    expect(pieceNounIn("Metal hand-finished and battle-worn, not costume-clean. Eyes still and calculating. No soft rounding.", seed)).toBeNull();
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
      So these pass the CHECK and are carried by the Re-imagine instruction
      alone (#535 — qualities-never-pieces is its whole contract now), and a
      green suite must never be read as a reader that catches them.
    */
    for (const notCaught of ["a cropped leather jacket", "a silver septum ring", "a blunt bob", "knee-high boots"]) {
      expect(pieceNounIn(notCaught, "seed")).toBeNull();
    }
    /* The instruction is where they live. */
    const rules = reimagineSystemPrompt(220);
    expect(rules).toContain("Never pin an exact garment, cut, jewellery piece or armour piece the request did not name");
    expect(rules).toContain("REINVENT WHAT THEY ARE MADE OF");
    /* And the instruction must not teach the words the set-narration ban exists for. */
    expect(neverWrittenIn(rules)).toBeNull();
  });

  it("every entry carries its reason, and the refusal order puts the piece AFTER the skin word", () => {
    expect(PIECE_NOUNS.length).toBeGreaterThanOrEqual(12);
    for (const { word, because } of PIECE_NOUNS) {
      expect(word).toBe(word.toLowerCase());
      expect(because.length).toBeGreaterThan(10);
    }
    const seed = "a sphinx-cat humanoid";
    /* A draft with BOTH a banned skin word and a piece is told about the skin first: it is the one that makes the engine refuse the picture. */
    expect(reimagineRefusal("Translucent-skinned feline humanoid in angular pauldrons.", 400, seed)).toContain("translucent");
    expect(reimagineRefusal("Feline humanoid in angular pauldrons.", 400, seed)).toContain("pauldron");
  });
});



