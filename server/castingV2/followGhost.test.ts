/**
 * THE FOLLOW GHOST (#176) — the author road wrote the house dice's per-slice
 * identity records as if they described the frames, and the family clause read
 * them as the anchor's facts.
 *
 * The specimen is real: dev candidate 578 (roll 103, publicId
 * 4791704d-1afd-4913-8147-ad698cb00084), the man the founder followed. His
 * roll's one authored prompt said NOTHING about heritage, facial hair or hair
 * length beyond the brief — "a fitness creator in their 30s, close-cropped
 * hair" plus a 40s override — yet the stored `resolved` record claims
 * `heritage: 100% South Asian`, `hair: mid-length dark brown`, `facialHair:
 * goatee`, `beardGrey: salt and pepper`. The rebuilt family clause (#154) read
 * that record through `anchorFrom` and told the engine to KEEP the heritage,
 * so every one of the eight "family" members was Indian while the anchor is
 * visibly Mediterranean/European. His words at the frames: *"he is not indian
 * yet every family member of him looks indian they dont look anything like
 * him."*
 *
 * The class (law 9 / wire-honest-memory-lied): a record describing what was
 * ROLLED, consumed as a fact about what was DELIVERED. These arms hold both
 * halves of the fix — the record is marked unsent and refused by the one
 * validated reader, and a follow of an author-road parent anchors on the
 * BRIEF's stated facts, never the dice — with the defect's own reproduction
 * kept as the positive control, so a green run means the fixture could have
 * produced the ghost and did not.
 */
import { describe, expect, it, vi } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";

import { castingBriefCompiler, statedAnchorFrom } from "./briefCompiler";
import { honestFollowSource, readResolvedIdentity } from "./rollService";
import { rollComposedOnAuthorRoad } from "./rollProjection";
import { HOUSE_BLOCK } from "./houseBlock";

/* ------------------------------------------------------- the 578 specimen */

/** Candidate 578's stored record, byte for byte — none of it was ever sent. */
const SPECIMEN_RESOLVED = {
  sex: "male",
  hair: { colour: "dark brown", family: "mid-length" },
  look: null,
  build: null,
  energy: "open",
  ageBand: "40s",
  agePhase: "mid",
  heritage: [{ pct: 100, heritage: "South Asian" }],
  realized: {
    makeup: null,
    eyeShape: null,
    beardGrey: "salt and pepper",
    browStyle: "softly arched",
    eyeColour: "brown",
    hairStyle: null,
    wornState: null,
    facialHair: "goatee",
    hairTexture: "straight",
    hairModifiers: null,
    skinCharacter: "visibly textured",
    statedDetails: null,
  },
  hairTiers: {
    hairStyle: "suppressed",
    wornState: "suppressed",
    facialHair: "realized",
    hairColour: "realized",
    hairTexture: "realized",
    hairModifiers: "suppressed",
  },
  stylingResolution: "stated",
} as const;

const SPECIMEN_BRIEF_TEXT = "a fitness creator in their 30s, close-cropped hair";

/** Roll 103's compiled brief, cut to the fields the readers consult. */
const SPECIMEN_COMPILED_BRIEF = {
  register: { kind: "author", mode: "seed" },
  intent: {
    sex: null,
    look: null,
    role: "fitness creator",
    build: null,
    cohort: "photoreal_human",
    energy: null,
    /* The parent's own 40s override became a stated fact of its intent. */
    ageBand: "40s",
    agePhase: null,
    heritage: [],
    characterNotes: null,
  },
} as const;

const SPECIMEN_INTERNAL_PROMPT = {
  prompt: `${SPECIMEN_BRIEF_TEXT}\n\nCast as a person, in their 40s; where this differs from the request above, this wins.\n\n(house block)`,
  resolved: SPECIMEN_RESOLVED,
} as const;

/** Every value the ghost put in front of the engine — none may appear again. */
const FICTION_WORDS = ["South Asian", "goatee", "mid-length", "salt and pepper", "dark brown", "softly arched"];

/* --------------------------------------------------------------- doubles */

type Engine = TextEngine & { complete: ReturnType<typeof vi.fn> };

/* The interpreter's reply for the follow roll — the reader reads the same
   brief again; nothing here states sex or heritage, exactly as on roll 103. */
const INTENT = JSON.stringify({
  cohort: "photoreal_human",
  role: "fitness creator",
  characterNotes: null,
  sex: null,
  ageBand: "30s",
  heritage: [],
  statedAccessories: [],
});

function interpreterOnly(): Engine {
  const complete = vi.fn(async (_request: TextRequest) => ({
    text: INTENT,
    latencyMs: 7,
    provenance: { provider: "openrouter" as const, model: "stub-model", servedModel: "stub-model" },
  }));
  return { id: "stub", complete } as unknown as Engine;
}

/* ------------------------------------------------- the reader refuses fiction */

describe("readResolvedIdentity — an unsent record is not a delivered fact (#176)", () => {
  it("refuses a record marked `unsent: true`", () => {
    expect(
      readResolvedIdentity({ prompt: "p", resolved: { ...SPECIMEN_RESOLVED, unsent: true } }),
    ).toBeNull();
  });

  it("positive control: the identical record WITHOUT the mark still parses whole", () => {
    const identity = readResolvedIdentity(SPECIMEN_INTERNAL_PROMPT);
    expect(identity).not.toBeNull();
    expect(identity?.sex).toBe("male");
    expect(identity?.heritage).toEqual([{ pct: 100, heritage: "South Asian" }]);
  });
});

/* --------------------------------------------- the honest follow source */

describe("honestFollowSource — which record was actually sent decides what a follow inherits", () => {
  it("an AUTHOR-road parent donates its brief's stated facts and NEVER the dice — the 578 specimen", () => {
    expect(rollComposedOnAuthorRoad(SPECIMEN_COMPILED_BRIEF)).toBe(true);
    const honest = honestFollowSource({
      compiledBrief: SPECIMEN_COMPILED_BRIEF,
      internalPrompt: SPECIMEN_INTERNAL_PROMPT,
    });
    expect(honest.identity).toBeNull();
    expect(honest.statedAnchor).toEqual({
      sex: null,
      ageBand: "40s",
      heritage: [],
      hair: null,
      look: null,
      realized: null,
    });
  });

  it("positive control: a HOUSE-road parent still donates its record whole — its prompt was composed from it", () => {
    const houseBrief = { intent: SPECIMEN_COMPILED_BRIEF.intent };
    expect(rollComposedOnAuthorRoad(houseBrief)).toBe(false);
    const honest = honestFollowSource({
      compiledBrief: houseBrief,
      internalPrompt: SPECIMEN_INTERNAL_PROMPT,
    });
    expect(honest.statedAnchor).toBeNull();
    expect(honest.identity?.heritage).toEqual([{ pct: 100, heritage: "South Asian" }]);
  });

  it("the superseded PR #94 register (`kind: creative`) composed per-slice prompts from its identities — it is not gated", () => {
    expect(rollComposedOnAuthorRoad({ register: { kind: "creative" }, intent: {} })).toBe(false);
  });

  it("statedAnchorFrom validates rather than trusts: unknown members and malformed components read as unstated", () => {
    expect(
      statedAnchorFrom({
        intent: {
          sex: "attack-helicopter",
          ageBand: "40s",
          heritage: [{ heritage: "South Asian" }, { heritage: "Klingon", pct: 100 }, "junk"],
          look: 7,
        },
      }),
    ).toEqual({ sex: null, ageBand: "40s", heritage: [], hair: null, look: null, realized: null });
    expect(statedAnchorFrom(null)).toBeNull();
    expect(statedAnchorFrom({ register: {} })).toBeNull();
  });
});

/* ----------------------------------------------------- the WIRE, both arms */

describe("the WIRE — a follow of 578 composes a family prompt with NOTHING from the resolved record", () => {
  it("the fixed road: the clause holds the brief's stated facts alone; every fiction word is absent from the whole prompt", async () => {
    const engine = interpreterOnly();
    const compiled = await castingBriefCompiler({
      briefText: SPECIMEN_BRIEF_TEXT,
      candidateCount: 8,
      rollSeed: "ghost-fixed",
      engine,
      creativeRegister: true,
      followPersonaLine: "08",
      followStatedAnchor: statedAnchorFrom(SPECIMEN_COMPILED_BRIEF),
    });
    const prompts = new Set(compiled.candidates.map((candidate) => candidate.prompt));
    expect(prompts.size).toBe(1);
    const [prompt] = prompts;
    const clause =
      "Continue this family: same casting brief, new person — a person, in their 40s. "
      + "Keep the same age range. "
      + "Do not copy this face, this exact hairline, this exact bone structure, or this exact expression. "
      + "Cast a different person who could be booked for the same role.";
    expect(prompt).toBe(`${SPECIMEN_BRIEF_TEXT}\n\n${clause}\n\n${HOUSE_BLOCK}`);
    for (const word of FICTION_WORDS) {
      expect(prompt, word).not.toContain(word);
    }
    /* And the eight records of THIS roll are themselves marked unsent. */
    for (const candidate of compiled.candidates) {
      expect(candidate.resolvedIdentity.unsent).toBe(true);
      expect(candidate.personaLine).toBeNull();
    }
  });

  it("positive control — the defect reproduces: handed the dice record the way the pre-fix wiring did, the clause says South Asian", async () => {
    const engine = interpreterOnly();
    const compiled = await castingBriefCompiler({
      briefText: SPECIMEN_BRIEF_TEXT,
      candidateCount: 8,
      rollSeed: "ghost-reproduced",
      engine,
      creativeRegister: true,
      followPersonaLine: "08",
      followIdentity: SPECIMEN_RESOLVED as never,
    });
    expect(compiled.candidates[0]?.prompt).toContain("of South Asian heritage");
    expect(compiled.candidates[0]?.prompt).toContain("Keep the same");
  });

  it("precedence: with both supplied, the honest anchor wins and the dice are never read", async () => {
    const engine = interpreterOnly();
    const compiled = await castingBriefCompiler({
      briefText: SPECIMEN_BRIEF_TEXT,
      candidateCount: 8,
      rollSeed: "ghost-precedence",
      engine,
      creativeRegister: true,
      followPersonaLine: "08",
      followIdentity: SPECIMEN_RESOLVED as never,
      followStatedAnchor: statedAnchorFrom(SPECIMEN_COMPILED_BRIEF),
    });
    for (const word of FICTION_WORDS) {
      expect(compiled.candidates[0]?.prompt, word).not.toContain(word);
    }
  });
});
