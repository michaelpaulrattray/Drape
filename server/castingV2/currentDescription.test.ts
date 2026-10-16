/**
 * ONE CURRENT DESCRIPTION (#2565 slice 1) — the writer and the sentence, driven
 * directly with an engine double (law 3: the backstops are tested without a
 * model that usually behaves).
 */
import { describe, expect, it } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import { pronounsForSex } from "./castPronouns";
import {
  currentDescriptionUserTurn,
  describedNowSentence,
  looksLikeAnEditList,
  writeCurrentDescription,
} from "./currentDescription";

function engineSaying(text: string, sink: TextRequest[] = []): TextEngine {
  return {
    id: "test:describe",
    complete: async (request) => {
      sink.push(request);
      return {
        text,
        latencyMs: 7,
        tokens: { in: 300, out: 40 },
        provenance: { provider: "openrouter", model: "anthropic/claude-sonnet-5", providerRef: "r" },
      } as never;
    },
  };
}

const seed = { brief: "A weathered fisherman of the north Atlantic, sixty.", earlierAsks: [] as string[] };

describe("the description writer", () => {
  it("returns the model's paragraph, asked under its own purpose with the previous description and the change", async () => {
    const sent: TextRequest[] = [];
    const result = await writeCurrentDescription(
      engineSaying("A weathered fisherman of sixty with a short, neat beard and grey-green eyes.", sent),
      { previous: "A weathered fisherman of sixty with a short, neat beard.", seed, change: "the eyes grey-green" },
    );
    expect(result).toMatchObject({
      ok: true,
      description: "A weathered fisherman of sixty with a short, neat beard and grey-green eyes.",
      tokens: { in: 300, out: 40 },
      model: "anthropic/claude-sonnet-5",
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.about).toBe("refine.describe");
    expect(sent[0]!.user).toContain("A weathered fisherman of sixty with a short, neat beard.");
    expect(sent[0]!.user).toContain("the eyes grey-green");
    /* The previous description is the memory: the brief is NOT re-sent beside it. */
    expect(sent[0]!.user).not.toContain("north Atlantic");
    expect(sent[0]!.system).toMatch(/never as a list of edits/);
    /* The two rules the court bought (round b): a comparison stays a comparison
       against the original photograph, and hair is not the beard. */
    expect(sent[0]!.system).toMatch(/stays a comparison against how they first looked/);
    expect(sent[0]!.system).toMatch(/Hair on the head and facial hair are separate features/);
  });

  it("seeds from the brief and the asks already applied when the previous version has no description", () => {
    const turn = currentDescriptionUserTurn({
      previous: null,
      seed: { brief: "A street casting, mid 20s.", earlierAsks: ["cut the hair into a short crop", "wire-frame glasses"] },
      change: "take the glasses off",
    });
    expect(turn).toContain("A street casting, mid 20s.");
    expect(turn).toContain("- cut the hair into a short crop\n- wire-frame glasses");
    expect(turn).toContain("The change:\ntake the glasses off");
  });

  it("never throws — a throwing engine is a value the caller rides today's prompt on", async () => {
    const throwing: TextEngine = { id: "t", complete: async () => { throw new Error("upstream 502 with the brief echoed"); } };
    await expect(writeCurrentDescription(throwing, { previous: null, seed, change: "x" }))
      .resolves.toMatchObject({ ok: false, reason: "failed" });
  });

  it("answers no_engine with nothing configured", async () => {
    await expect(writeCurrentDescription(null, { previous: null, seed, change: "x" }))
      .resolves.toEqual({ ok: false, reason: "no_engine", latencyMs: 0 });
  });

  it("REFUSES an edit list rather than filing it — his one named shape", async () => {
    const listy = "- short neat beard\n- grey-green eyes";
    await expect(writeCurrentDescription(engineSaying(listy), { previous: null, seed, change: "x" }))
      .resolves.toMatchObject({ ok: false, reason: "edit_list" });
    /* CONTROL: a paragraph is not a list, so the refusal above is the shape, not any text. */
    expect(looksLikeAnEditList("A fisherman with a short beard. They wear no glasses.")).toBe(false);
    expect(looksLikeAnEditList("1. beard shorter")).toBe(true);
    /* Several lines with no bullet are the list shape too — a description is one paragraph. */
    expect(looksLikeAnEditList("A fisherman with a short beard.\nThey wear no glasses.")).toBe(true);
  });

  it("refuses an empty reply and a runaway one", async () => {
    await expect(writeCurrentDescription(engineSaying("   "), { previous: null, seed, change: "x" }))
      .resolves.toMatchObject({ ok: false, reason: "blank" });
    await expect(writeCurrentDescription(engineSaying("a".repeat(2401)), { previous: null, seed, change: "x" }))
      .resolves.toMatchObject({ ok: false, reason: "too_long" });
  });
});

describe("the sentence the refine prompt carries", () => {
  it("is round 2's A4 sentence, word for word, for a cast written as they", () => {
    expect(describedNowSentence("Their hair is cut into a short crop.", pronounsForSex(null))).toBe(
      "This is how they look now: Their hair is cut into a short crop. Everything else about them stays exactly as in Reference 1.",
    );
  });

  it("agrees its verb with a singular pronoun and closes an unpunctuated paragraph", () => {
    expect(describedNowSentence("A fisherman with a short beard", pronounsForSex("male"))).toBe(
      "This is how he looks now: A fisherman with a short beard. Everything else about him stays exactly as in Reference 1.",
    );
  });
});

describe("CASTING_CURRENT_DESCRIPTION_SCOPE", () => {
  it("refuses boot past its parent and admits only inside it", async () => {
    const { validateCastingCurrentDescriptionEnvironment: validate } = await import("./castingV2Scope");
    expect(validate({ scope: undefined, castingScope: undefined })).toEqual({ kind: "off" });
    expect(() => validate({ scope: "all", castingScope: "off" })).toThrow(/CASTING_V2_SCOPE is off/);
    expect(() => validate({ scope: "all", castingScope: "users:1" })).toThrow(/cannot be "all"/);
    expect(() => validate({ scope: "users:2", castingScope: "users:1" })).toThrow(/outside CASTING_V2_SCOPE: 2/);
    expect(() => validate({ scope: "everyone", castingScope: "all" })).toThrow(/must be "off"/);
    expect(validate({ scope: "users:1", castingScope: "users:1,2" })).toMatchObject({ kind: "users" });
  });

  it("is captured as an AND of the chain at the point of use", async () => {
    const { captureCastingCurrentDescriptionEnabled: capture } = await import("./castingV2Scope");
    const saved = { v2: process.env.CASTING_V2_SCOPE, child: process.env.CASTING_CURRENT_DESCRIPTION_SCOPE };
    try {
      process.env.CASTING_CURRENT_DESCRIPTION_SCOPE = "users:1";
      process.env.CASTING_V2_SCOPE = "users:1";
      expect(capture(1)).toBe(true);
      expect(capture(2)).toBe(false);
      process.env.CASTING_V2_SCOPE = "off";
      expect(capture(1), "the parent off closes the child").toBe(false);
      delete process.env.CASTING_CURRENT_DESCRIPTION_SCOPE;
      process.env.CASTING_V2_SCOPE = "all";
      expect(capture(1), "absent is off").toBe(false);
    } finally {
      if (saved.v2 === undefined) delete process.env.CASTING_V2_SCOPE; else process.env.CASTING_V2_SCOPE = saved.v2;
      if (saved.child === undefined) delete process.env.CASTING_CURRENT_DESCRIPTION_SCOPE;
      else process.env.CASTING_CURRENT_DESCRIPTION_SCOPE = saved.child;
    }
  });
});
