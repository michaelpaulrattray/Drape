import { describe, expect, it } from "vitest";

import { parseCastingIntent } from "./castingIntent";
import { castingBriefCompiler } from "./briefCompiler";
import { mentionsGarments } from "./brandScrub";
import { COMPOSED_DIRECTION_ENABLED } from "./stylingResolution";
import type { TextEngine } from "../providers/types";

/**
 * The C7 descendant: an aesthetic reference no shelf entry fits.
 *
 * Measured before building it — "a miu miu campaign model" returned role
 * "campaign model", archetype null, look null. The reference simply vanished,
 * and the sheet was indistinguishable from one that never mentioned it. Legacy
 * warned about *snapping an unusual house to the nearest of eight and losing
 * the reference*; V2 did not even snap.
 *
 * The containment is the whole design, so most of these tests are about what
 * gets DROPPED. A rejected direction always falls back to shelf behaviour and
 * the roll still runs — never patch a language model's output with code, never
 * fail a paid roll over it.
 */

function engineReturning(wire: Record<string, unknown>): TextEngine {
  return {
    id: "test",
    complete: async () => ({
      text: JSON.stringify({ cohort: "photoreal_human", ...wire }),
      latencyMs: 1,
      provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
    }),
  } as unknown as TextEngine;
}

function parseWith(composedDirection: unknown) {
  return parseCastingIntent(JSON.stringify({ cohort: "photoreal_human", composedDirection }));
}

describe("the wire contract", () => {
  it("accepts a well-formed direction", () => {
    const parsed = parseWith({
      thesis: "Quirky, slightly awkward prep-school beauty — unconventional features worn with total ease.",
      avoid: "Do not render as conventional runway prettiness.",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.intent.composedDirection?.thesis).toContain("prep-school");
  });

  it("drops a direction that mentions clothing, whole", () => {
    /*
      Reject, never edit (founder ruling). A direction about clothes was
      written against the wrong brief and half of it is not salvageable — and
      because brand identity lives in objects, garments are also the likeliest
      way a house returns without its name.
    */
    const parsed = parseWith({
      thesis: "Sharp tailoring and a leather jacket, worn with a knowing slouch.",
      avoid: "Do not render as soft.",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.intent.composedDirection).toBeNull();
  });

  it("drops it when the anti-pattern is the part mentioning clothing", () => {
    const parsed = parseWith({
      thesis: "Severe, high-boned, unsmiling.",
      avoid: "Do not render with visible logos or monogram print.",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.intent.composedDirection).toBeNull();
  });

  it("drops it when a house name survives into either half", () => {
    const parsed = parseWith({
      thesis: "The Versace woman — golden, commanding, unmistakably glamorous.",
      avoid: "Do not render as demure.",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const direction = parsed.intent.composedDirection;
    // Either dropped entirely, or scrubbed — never carrying the mark.
    if (direction) {
      expect(direction.thesis.toLowerCase()).not.toContain("versace");
      expect(direction.avoid.toLowerCase()).not.toContain("versace");
    }
  });

  it("drops half a direction, because the anti-pattern is load-bearing", () => {
    expect(parseWith({ thesis: "Severe and high-boned." }).ok).toBe(true);
    const parsed = parseWith({ thesis: "Severe and high-boned.", avoid: "" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.intent.composedDirection).toBeNull();
  });

  it("survives junk without failing the roll", () => {
    for (const junk of [42, "a string", [], { thesis: 1, avoid: 2 }, null]) {
      const parsed = parseWith(junk);
      expect(parsed.ok, JSON.stringify(junk)).toBe(true);
      if (parsed.ok) expect(parsed.intent.composedDirection).toBeNull();
    }
  });

  it("caps both halves", () => {
    const parsed = parseWith({ thesis: "a ".repeat(400), avoid: "b ".repeat(200) });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect((parsed.intent.composedDirection?.thesis ?? "").length).toBeLessThanOrEqual(200);
    expect((parsed.intent.composedDirection?.avoid ?? "").length).toBeLessThanOrEqual(120);
  });
});

describe("the garment guard", () => {
  it("knows a garment from a face", () => {
    expect(mentionsGarments("a leather jacket and heavy boots")).toBe(true);
    expect(mentionsGarments("visible logos on the fabric")).toBe(true);
    expect(mentionsGarments("high cheekbones, a strong nose, unbrushed hair")).toBe(false);
    expect(mentionsGarments("quiet, watchful bearing")).toBe(false);
  });
});

describe("where it lands in the prompt", () => {
  async function compiled(wire: Record<string, unknown>) {
    return castingBriefCompiler({
      briefText: "a campaign model",
      candidateCount: 8,
      rollSeed: "composed",
      engine: engineReturning(wire),
    });
  }

  it.skipIf(!COMPOSED_DIRECTION_ENABLED)("reaches every candidate as DIRECTION, never as the category", async () => {
    const sheet = await compiled({
      role: "campaign model",
      composedDirection: {
        thesis: "Quirky, slightly awkward prep-school beauty — unconventional features worn with ease.",
        avoid: "Do not render as conventional runway prettiness.",
      },
    });
    for (const candidate of sheet.candidates) {
      expect(candidate.prompt).toContain("REFERENCE DIRECTION:");
      expect(candidate.prompt).toContain("prep-school beauty");
      // The category block is the user's own words and stays untouched.
      const category = candidate.prompt.match(/CASTING CATEGORY \(ABSOLUTE\): [^.]*\./)?.[0] ?? "";
      expect(category).not.toContain("prep-school");
    }
  });

  it("says nothing when the interpreter composed nothing", async () => {
    const sheet = await compiled({ role: "campaign model", composedDirection: null });
    for (const candidate of sheet.candidates) {
      expect(candidate.prompt).not.toContain("REFERENCE DIRECTION:");
    }
  });
});
