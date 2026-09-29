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

/*
  TWO ARMS STOOD HERE — the aesthetic reference reaching all eight as
  `REFERENCE DIRECTION:` and never as the category block, and its companion
  that a sheet with no composed direction says nothing. ⚠ The second is named
  here because it would have SURVIVED AS A GREEN NO-OP: with no composition at
  all, "does not contain REFERENCE DIRECTION" is true of every prompt for the
  wrong reason. The arms that read the INTENT — that the reference is captured
  rather than vanishing, which is this file's C7 subject — survive.

  ⚠ **DELETED WITH THE HOUSE ROAD — #1490 act 1, and FOLDED INTO #1125 rather
  than re-pointed.** Every one of these arms asserted that a resolved and
  persisted value left a FOOTPRINT IN THE PER-SLICE COMPOSED PROMPT. The author
  road composes no per-slice prompt: one authored prompt paints all eight and
  the dice records are marked `unsent` (#176), so there is no per-tier sentence
  to look for and nothing for the arm to be right or wrong about.

  ⚠ **THIS IS A FLOOR DROP AND IT IS SAID OUT LOUD.** The class these arms
  guard is the UNOWNED-AXIS COLLAPSE — an axis nobody owns is decided by
  whichever prior is loudest, identically on every tile — and it was caught
  FIVE separate times by the founder's own eye. It is not abandoned: #1125
  (`debt`, `rung:N3`) is exactly this loss, filed by the #180 ghost audit
  BEFORE these arms fell over, and its ruling is that the question — did the
  delivered picture carry what she asked for — is #30's, asked of a FRAME
  rather than of a prompt string.

  What survives in this file is everything that reads the PARSE or the
  RESOLVER directly, which is the half that still decides a real record.
*/
