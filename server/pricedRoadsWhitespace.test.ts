import { describe, it, expect } from "vitest";

/**
 * THE PRICED ROADS REFUSE A WHITESPACE-ONLY BRIEF — #816's remainder, named by
 * PR #821's reviewer (law 7: the sweep is part of the fix).
 *
 * `castingV2.createRoll` / `follow` / `reimagine` carried `briefText:
 * z.string().min(1)` untrimmed while every neighbouring free-text field in the
 * same file (`name`, `instruction`, `answering`, `scope`) already read
 * `.trim().min(1)`. A brief of one space passed, `normalizeBrief` collapsed it to
 * `""` downstream, and eight priced candidates rolled off a blank — the "credits
 * spent on a blank" the wider-class PR fixed for legacy iterate, on the
 * most-charged road in the product. The box refuses it
 * (`CastingSheet.tsx`: `brief.trim().length === 0` returns before the press);
 * the procedure is the control.
 *
 * This file mocks NOTHING, on purpose: `castingV2.ts` imports most of the
 * server, and the wholesale `./db` / `./storage` mocks the sibling suite
 * (`freeTextWhitespace.test.ts`) needs for its driven routers refuse to load it.
 * The production schema is read off the router the way
 * `_core/invalidInputWire.test.ts` reads it, and the parse IS the control here —
 * it runs before the handler and before any charge.
 *
 * Every "refuses" line was red on the unfixed product. Green after.
 */
import { castingV2Router } from "./routes/castingV2";
import { castingRefinementRouter } from "./routes/generation/castingRefinement";
import { waitlistRouter } from "./routes/waitlist";
import { wardrobeOutfitSaveInput } from "./routes/wardrobeInput";

/**
 * The production schema itself, off the production procedure — the shape
 * `_core/invalidInputWire.test.ts` uses. The parse is the control on these
 * roads: it runs before the handler, so a refusal here is a refusal before any
 * charge, and driving the whole roll road to prove one `.trim()` would mock
 * more of the product than it tests.
 */
function realInputSchema(routerLike: unknown, procedureName: string): { safeParse: (v: unknown) => { success: boolean; data?: any } } {
  const procedures = (routerLike as { _def: { procedures: Record<string, { _def: { inputs: unknown[] } }> } })._def.procedures;
  const procedure = procedures[procedureName];
  if (!procedure) throw new Error(`no procedure "${procedureName}"`);
  const inputs = procedure._def.inputs;
  if (inputs.length !== 1) throw new Error(`expected one input schema on ${procedureName}, got ${inputs.length}`);
  return inputs[0] as never;
}
describe("the priced roads — PR #821's reviewer, law-7 remainder", () => {
  const ROLL = { clientRequestId: "11111111-1111-4111-8111-111111111111", sessionId: "22222222-2222-4222-8222-222222222222", unlock: [], overrides: {} };

  it("castingV2.createRoll refuses a whitespace-only brief BEFORE eight priced candidates roll off a blank, and trims a padded one", () => {
    const schema = realInputSchema(castingV2Router, "createRoll");
    expect(schema.safeParse({ ...ROLL, briefText: " \n\t " }).success).toBe(false);
    const padded = schema.safeParse({ ...ROLL, briefText: "  a tall goth with a silver eyepiece \n" });
    expect(padded.success && padded.data.briefText).toBe("a tall goth with a silver eyepiece");
  });

  it("castingV2.follow — the same price, the same rule", () => {
    const schema = realInputSchema(castingV2Router, "follow");
    expect(schema.safeParse({ ...ROLL, candidateId: "33333333-3333-4333-8333-333333333333", briefText: "   " }).success).toBe(false);
    const padded = schema.safeParse({ ...ROLL, candidateId: "33333333-3333-4333-8333-333333333333", briefText: " give her a fringe " });
    expect(padded.success && padded.data.briefText).toBe("give her a fringe");
  });

  it("castingV2.reimagine — house money with no charge path to pace it — refuses a blank", () => {
    const schema = realInputSchema(castingV2Router, "reimagine");
    expect(schema.safeParse({ briefText: "\t" }).success).toBe(false);
    const padded = schema.safeParse({ briefText: "  a rider  " });
    expect(padded.success && padded.data.briefText).toBe("a rider");
  });

  it("generation.enhance refuses a whitespace prompt before a rate-limited text call is spent on it", () => {
    const schema = realInputSchema(castingRefinementRouter, "enhance");
    expect(schema.safeParse({ prompt: "    " }).success).toBe(false);
    const padded = schema.safeParse({ prompt: " moody studio light " });
    expect(padded.success && padded.data.prompt).toBe("moody studio light");
  });

  it("wardrobe.outfits.save refuses a whitespace-only outfit NAME — a blank label on the customer's wardrobe", () => {
    expect(wardrobeOutfitSaveInput.safeParse({ name: "   ", garmentIds: [1] }).success).toBe(false);
    expect(wardrobeOutfitSaveInput.parse({ name: "  Summer casual ", garmentIds: [1] }).name).toBe("Summer casual");
  });

  it("waitlist.join — a PUBLIC endpoint — refuses a whitespace-only name and trims a padded one", () => {
    const schema = realInputSchema(waitlistRouter, "join");
    expect(schema.safeParse({ email: "ada@example.com", name: " " }).success).toBe(false);
    const padded = schema.safeParse({ email: "ada@example.com", name: "  Ada " });
    expect(padded.success && padded.data.name).toBe("Ada");
    // POSITIVE CONTROL — the field is optional and stays so.
    expect(schema.safeParse({ email: "ada@example.com" }).success).toBe(true);
  });
});

