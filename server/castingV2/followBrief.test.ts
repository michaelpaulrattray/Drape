/**
 * THE FOLLOW BRIEF (#2576) — the writer, the resolver, and the wire.
 *
 * Driven with engine doubles (law 3: a backstop is tested without a model that
 * usually behaves), and the wire arm drives the REAL `follow` procedure through
 * `appRouter.createCaller` and reads the `briefText` it hands `createRoll`
 * (law 5: the contract is proven on the outgoing request, not on a constant).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import type { FollowBriefSource } from "../db/castingV2";
import {
  FOLLOW_BRIEF_RETRIES,
  FOLLOW_BRIEF_SYSTEM,
  FOLLOW_BRIEF_TIMEOUT_MS,
  followBriefUserTurn,
  writeFollowBrief,
} from "./currentDescription";
import { resolveFollowBrief } from "./followBrief";

const wire = vi.hoisted(() => ({
  createRollInputs: [] as Array<{ briefText: string }>,
  source: null as FollowBriefSource | null,
  engine: null as TextEngine | null,
}));

vi.mock("./rollService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./rollService")>();
  return {
    ...actual,
    createRoll: vi.fn(async (_deps: unknown, input: { briefText: string }) => {
      wire.createRollInputs.push(input);
      /* Stop here: what is being proven is what reached the roll. */
      throw new Error("wire-stop");
    }),
  };
});

vi.mock("../db/castingV2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/castingV2")>();
  return { ...actual, getFollowBriefSource: vi.fn(async () => wire.source) };
});

vi.mock("./interpreter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./interpreter")>();
  return { ...actual, interpreterEngine: () => wire.engine };
});

function engineSaying(text: string, sink: TextRequest[] = []): TextEngine {
  return {
    id: "test:follow",
    complete: async (request) => {
      sink.push(request);
      return {
        text,
        latencyMs: 9,
        tokens: { in: 200, out: 60 },
        provenance: { provider: "openrouter", model: "anthropic/claude-sonnet-5", providerRef: "r" },
      } as never;
    },
  };
}

function engineThrowing(sink: TextRequest[] = []): TextEngine {
  return {
    id: "test:follow-down",
    complete: async (request) => {
      sink.push(request);
      throw new Error("ECONNRESET");
    },
  };
}

const BRIEF = "A cyberpunk operative with dark undercut hair, chrome jaw implants and a long black coat.";
const REWRITTEN = "A cyberpunk operative with platinum blonde graphic undercut hair, chrome jaw implants and a long black coat.";

const editedSource = (overrides: Partial<FollowBriefSource> = {}): FollowBriefSource => ({
  rollBrief: BRIEF,
  edited: true,
  description: "A cyberpunk operative with platinum blonde undercut hair, a thin scar through the left eyebrow, chrome jaw implants and a long black coat.",
  asks: ["make the hair platinum blonde"],
  ...overrides,
});

describe("the follow brief writer", () => {
  it("asks under its own purpose, with the brief and the edited version, on the short budget", async () => {
    const sent: TextRequest[] = [];
    const result = await writeFollowBrief(
      engineSaying(REWRITTEN, sent),
      { brief: BRIEF, description: editedSource().description, asks: [] },
      4000,
    );
    expect(result).toMatchObject({ ok: true, brief: REWRITTEN, model: "anthropic/claude-sonnet-5" });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.about).toBe("follow.brief");
    expect(sent[0]!.timeoutMs).toBe(FOLLOW_BRIEF_TIMEOUT_MS);
    expect(sent[0]!.retries).toBe(FOLLOW_BRIEF_RETRIES);
    expect(FOLLOW_BRIEF_TIMEOUT_MS).toBeLessThanOrEqual(8_000);
    expect(FOLLOW_BRIEF_RETRIES).toBe(1);
    expect(sent[0]!.user).toContain(BRIEF);
    expect(sent[0]!.user).toContain("platinum blonde undercut hair");
  });

  /*
    THE SPLIT HIS RULING TURNS ON — "cousins of that direction of cast not exact
    replicas of the same person you followed". Pinned as two rules, each naming
    its members, so a rewrite of the prompt that drops either half reddens.
  */
  it("pins the direction-level versus one-person-specific split in the prompt", () => {
    const direction = FOLLOW_BRIEF_SYSTEM.split("\n").find((line) => line.includes("DIRECTION-LEVEL"));
    const specifics = FOLLOW_BRIEF_SYSTEM.split("\n").find((line) => line.includes("ONE-PERSON SPECIFICS"));
    expect(direction).toBeDefined();
    expect(specifics).toBeDefined();
    for (const member of ["hair colour", "hairstyle", "overall style", "augments", "outfit direction", "build"]) {
      expect(direction).toContain(member);
    }
    for (const member of ["exact scar", "single mole", "one particular tattoo", "eye colour unless the brief itself already states an eye colour"]) {
      expect(specifics).toContain(member);
    }
    expect(direction).toMatch(/^- Fold in/);
    expect(specifics).toMatch(/^- Leave out/);
    expect(FOLLOW_BRIEF_SYSTEM).toMatch(/cousins and never copies of one person/);
    expect(FOLLOW_BRIEF_SYSTEM).toMatch(/never as a list of edits/);
  });

  /*
    THE NON-PERSON DIRECTION SURVIVES (the reviewer's risk the relay verified):
    setting, light, camera and framing, style and mood are the look of the whole
    family. The prompt rule is pinned, the brief reaches the writer verbatim, and
    a reply that collapses the brief to a person-only paragraph is REFUSED by a
    check no model can talk its way past — the box's own words go instead.
  */
  it("keeps a brief's scene and style direction, and refuses a rewrite that drops it", async () => {
    expect(FOLLOW_BRIEF_SYSTEM).toMatch(/the setting, the light, the camera and framing, the picture style and the mood/);
    expect(FOLLOW_BRIEF_SYSTEM).toMatch(/keep every one of those phrases word for word/);
    const scene = "A cyberpunk operative with dark undercut hair and chrome jaw implants, standing in a rain-soaked neon alley at night, shot from a low angle, cinematic, moody teal and magenta light.";
    const scenePhrases = ["rain-soaked neon alley", "low angle", "cinematic", "teal and magenta light"];
    const input = { brief: scene, description: "A cyberpunk operative with a platinum blonde undercut and chrome jaw implants.", asks: [] };

    const sent: TextRequest[] = [];
    const kept = scene.replace("dark undercut hair", "a platinum blonde undercut");
    const good = await writeFollowBrief(engineSaying(kept, sent), input, 4000);
    expect(good).toMatchObject({ ok: true, brief: kept });
    for (const phrase of scenePhrases) {
      expect(sent[0]!.user).toContain(phrase);
      expect(good.ok && good.brief).toContain(phrase);
    }

    const personOnly = await writeFollowBrief(
      engineSaying("A cyberpunk operative with a platinum blonde undercut and chrome jaw implants."),
      input,
      4000,
    );
    expect(personOnly).toMatchObject({ ok: false, reason: "shrunk" });
  });

  it("falls back to the ask chain when the version has no description", () => {
    const turn = followBriefUserTurn({ brief: BRIEF, description: null, asks: ["make the hair platinum blonde", "add a nose ring"] });
    expect(turn).toContain("- make the hair platinum blonde\n- add a nose ring");
    expect(turn).not.toContain("Who the edited cast is");
  });

  it("refuses without calling the engine when there is nothing to fold in", async () => {
    const sent: TextRequest[] = [];
    await expect(writeFollowBrief(engineSaying(REWRITTEN, sent), { brief: BRIEF, description: null, asks: [] }, 4000))
      .resolves.toMatchObject({ ok: false, reason: "no_edits" });
    expect(sent).toHaveLength(0);
  });

  it("answers every failure as a value, never a throw", async () => {
    const input = { brief: BRIEF, description: "x", asks: [] };
    await expect(writeFollowBrief(null, input, 4000)).resolves.toMatchObject({ ok: false, reason: "no_engine" });
    await expect(writeFollowBrief(engineThrowing(), input, 4000)).resolves.toMatchObject({ ok: false, reason: "failed" });
    await expect(writeFollowBrief(engineSaying("   "), input, 4000)).resolves.toMatchObject({ ok: false, reason: "blank" });
    await expect(writeFollowBrief(engineSaying("a".repeat(41)), input, 40)).resolves.toMatchObject({ ok: false, reason: "too_long" });
    await expect(writeFollowBrief(engineSaying("- platinum blonde hair\n- scar"), input, 4000))
      .resolves.toMatchObject({ ok: false, reason: "edit_list" });
    /* Positive control for the list refusal: a one-paragraph answer passes. */
    await expect(writeFollowBrief(engineSaying(REWRITTEN), input, 4000)).resolves.toMatchObject({ ok: true });
  });
});

describe("resolveFollowBrief — the box's words unless every condition holds", () => {
  const on = { enabled: () => true };

  it("rewrites an edited version's Follow when the box still holds that face's brief", async () => {
    const sent: TextRequest[] = [];
    const result = await resolveFollowBrief(
      { userId: 7, candidatePublicId: "c1", boxText: BRIEF },
      { ...on, readSource: async () => editedSource(), engine: () => engineSaying(REWRITTEN, sent) },
    );
    expect(result).toEqual({ briefText: REWRITTEN, outcome: "rewritten" });
    expect(sent).toHaveLength(1);
  });

  it("hands back the very string it was given, and calls no engine, on every other arm", async () => {
    const box = `${BRIEF}`;
    const arms: Array<[string, Parameters<typeof resolveFollowBrief>[1], string]> = [
      ["off", { enabled: () => false, readSource: async () => editedSource() }, "off"],
      ["never edited", { ...on, readSource: async () => editedSource({ edited: false }) }, "unedited"],
      ["unknown face", { ...on, readSource: async () => null }, "unread"],
      ["reader throws", { ...on, readSource: async () => { throw new Error("db down"); } }, "unread"],
    ];
    for (const [name, deps, outcome] of arms) {
      const sent: TextRequest[] = [];
      const result = await resolveFollowBrief(
        { userId: 7, candidatePublicId: "c1", boxText: box },
        { ...deps, engine: () => engineSaying(REWRITTEN, sent) },
      );
      expect(result.briefText, name).toBe(box);
      expect(result.outcome, name).toBe(outcome);
      expect(sent, name).toHaveLength(0);
    }
  });

  it("sends the customer's own different typing unrewritten", async () => {
    const sent: TextRequest[] = [];
    const typed = "An operative like this one but older, with a shaved head.";
    const result = await resolveFollowBrief(
      { userId: 7, candidatePublicId: "c1", boxText: typed },
      { ...on, readSource: async () => editedSource(), engine: () => engineSaying(REWRITTEN, sent) },
    );
    expect(result).toEqual({ briefText: typed, outcome: "typed" });
    expect(sent).toHaveLength(0);
  });

  it("falls back to the box when the writer does not answer", async () => {
    const result = await resolveFollowBrief(
      { userId: 7, candidatePublicId: "c1", boxText: BRIEF },
      { ...on, readSource: async () => editedSource(), engine: () => engineThrowing() },
    );
    expect(result).toEqual({ briefText: BRIEF, outcome: "writer_failed" });
  });
});

describe("the follow procedure's wire — what reaches createRoll", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    wire.createRollInputs.length = 0;
    wire.source = null;
    wire.engine = null;
    process.env.CASTING_V2_SCOPE = "all";
    process.env.CASTING_CURRENT_DESCRIPTION_SCOPE = "users:5101,5102,5103";
  });

  afterEach(() => {
    for (const name of ["CASTING_V2_SCOPE", "CASTING_CURRENT_DESCRIPTION_SCOPE"]) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  async function pressFollow(userId: number, briefText: string): Promise<string> {
    const { appRouter } = await import("../routers");
    const user = {
      id: userId, openId: `follow-${userId}`, email: "f@example.com", name: "F", role: "user",
      approved: true, approvedAt: new Date(), suspendedAt: null, frozenAt: null, lockedUntil: null,
      failedLoginAttempts: 0, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    } as never;
    const caller = appRouter.createCaller({
      user,
      correlationId: `follow-${userId}`,
      req: { protocol: "https", headers: {} },
      res: { clearCookie: () => undefined },
    } as never);
    await expect(caller.castingV2.follow({
      clientRequestId: globalThis.crypto.randomUUID(),
      sessionId: "11111111-1111-4111-8111-111111111111",
      candidateId: "22222222-2222-4222-8222-222222222222",
      briefText,
    })).rejects.toThrow("wire-stop");
    expect(wire.createRollInputs).toHaveLength(1);
    return wire.createRollInputs[0]!.briefText;
  }

  it("a never-edited face's Follow reaches the roll byte-identical, and asks no writer", async () => {
    const sent: TextRequest[] = [];
    wire.source = editedSource({ edited: false });
    wire.engine = engineSaying(REWRITTEN, sent);
    expect(await pressFollow(5101, BRIEF)).toBe(BRIEF);
    expect(sent).toHaveLength(0);
  });

  it("an edited version's Follow reaches the roll with the rewritten brief", async () => {
    wire.source = editedSource();
    wire.engine = engineSaying(REWRITTEN);
    expect(await pressFollow(5102, BRIEF)).toBe(REWRITTEN);
  });

  it("outside the flag, the same edited version's Follow is untouched", async () => {
    const sent: TextRequest[] = [];
    wire.source = editedSource();
    wire.engine = engineSaying(REWRITTEN, sent);
    expect(await pressFollow(5999, BRIEF)).toBe(BRIEF);
    expect(sent).toHaveLength(0);
  });
});
