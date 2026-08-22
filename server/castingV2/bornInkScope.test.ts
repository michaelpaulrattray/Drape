/**
 * `CASTING_BORN_INK_SCOPE` — 7b(a)'s door, and the two sides of what it gates.
 *
 * The flag exists because fable-1381 ruling 3 required one, and because the
 * thing behind it changes a PROMPT: `context-is-not-additive` in this program
 * measured a SUBSET of prompt context raising the stage wall twice as often as
 * its superset, so an unflagged roll must get the bytes it has always got.
 *
 * What these arms hold it to:
 *
 *   1. the LADDER — off by default, absent means off, and it cannot be armed
 *      over a user `CASTING_V2_SCOPE` does not cover;
 *   2. the GATE, BOTH SIDES — off is today's system prompt BYTE FOR BYTE, and
 *      on adds the ink block and nothing else. A flag whose two sides are never
 *      asserted together is a flag nobody has read;
 *   3. what the block may not do — it names the closed region vocabulary and
 *      asks for her own words, because a reader free to invent either would put
 *      tattoos on a person who never asked for them.
 *
 * The WIRE — that `validateEnv()` actually calls the coverage check — is
 * `scripts/rehearse-born-ink-boot-disposable.mts`, and neither substitutes:
 * this file passes with the call deleted, and that script fails.
 */
import { describe, expect, it } from "vitest";

import {
  CastingBornInkCoverageError,
  CastingBornInkScopeConfigurationError,
  parseCastingBornInkScope,
  validateCastingBornInkEnvironment,
} from "./castingV2Scope";
import { interpreterSystemPrompt } from "./interpreter";
import { BODY_ANCHOR_REGIONS } from "../../shared/bodyAnchorRegions";

describe("the boot guard", () => {
  it("refuses while casting itself is off — the row is minted when a CANDIDATE lands", () => {
    expect(() => validateCastingBornInkEnvironment({ scope: "users:1", castingScope: "off" }))
      .toThrow(CastingBornInkCoverageError);
  });

  it("refuses `all` while the parent is limited to named users", () => {
    expect(() => validateCastingBornInkEnvironment({ scope: "all", castingScope: "users:1" }))
      .toThrow(/cannot be "all" while/);
  });

  it("refuses a user the parent does not cover, and NAMES them", () => {
    /* "someone is uncovered" is not a finding an operator can act on. */
    expect(() => validateCastingBornInkEnvironment({ scope: "users:2,3", castingScope: "users:1,2" }))
      .toThrow(/names users outside .*: *3/);
  });

  it("admits a covered user, and `all` under an `all` parent", () => {
    expect(validateCastingBornInkEnvironment({ scope: "users:1", castingScope: "users:1,2" }))
      .toEqual({ kind: "users", userIds: [1] });
    expect(validateCastingBornInkEnvironment({ scope: "all", castingScope: "all" }))
      .toEqual({ kind: "all" });
  });

  it("lets `off` through untouched, whatever the parent is", () => {
    /* Off is off. A child that refused to be off because its parent was off
       would make turning a feature off harder than leaving it on. */
    expect(validateCastingBornInkEnvironment({ scope: "off", castingScope: "off" }))
      .toEqual({ kind: "off" });
  });

  it("absent means off", () => {
    expect(parseCastingBornInkScope(undefined)).toEqual({ kind: "off" });
    expect(validateCastingBornInkEnvironment({ scope: undefined, castingScope: "all" }))
      .toEqual({ kind: "off" });
  });

  it("refuses a scope that is not the grammar", () => {
    expect(() => parseCastingBornInkScope("everyone")).toThrow(CastingBornInkScopeConfigurationError);
    expect(() => parseCastingBornInkScope("users:0")).toThrow(CastingBornInkScopeConfigurationError);
  });
});

describe("what the flag actually changes — the prompt, both sides", () => {
  it("⚠ OFF is today's prompt, BYTE FOR BYTE", () => {
    /*
      The whole reason this is a flag. A SUBSET of prompt context once raised
      the stage wall twice as often as its superset in this program, so adding a
      section moves what a sheet says about age, heritage and hair in a
      direction nobody has measured. An account whose roll cannot write a
      `bornInk:` row must not pay that.
    */
    const base = interpreterSystemPrompt();
    expect(interpreterSystemPrompt({ ink: false })).toBe(base);
    expect(interpreterSystemPrompt({ wardrobe: false, ink: false })).toBe(base);
    expect(base).not.toContain("statedInk");
  });

  it("⚠ ON adds the ink block and NOTHING ELSE", () => {
    const base = interpreterSystemPrompt();
    const withInk = interpreterSystemPrompt({ ink: true });
    expect(withInk.startsWith(base), "the base is untouched and prefixed").toBe(true);
    expect(withInk).toContain("statedInk");
    /* And it did not quietly drag the other flag's block in with it. */
    expect(withInk).not.toContain("THE ONE OUTFIT ALL EIGHT OF THESE PEOPLE WEAR");
  });

  it("composes the two blocks in a FIXED order, so one pair of flags is one prompt", () => {
    /* Two accounts with the same flags must send the same bytes; an order that
       depended on how the options object was built would make that a coin
       flip nobody could reproduce. */
    expect(interpreterSystemPrompt({ ink: true, wardrobe: true }))
      .toBe(interpreterSystemPrompt({ wardrobe: true, ink: true }));
    const both = interpreterSystemPrompt({ wardrobe: true, ink: true });
    expect(both.indexOf("THE ONE OUTFIT")).toBeLessThan(both.indexOf("statedInk"));
  });

  it("names the CLOSED region vocabulary, every member of it", () => {
    /*
      Read off `BODY_ANCHOR_REGIONS` rather than a list retyped in the prompt:
      a reader offered a vocabulary the parser does not hold answers with
      regions that are silently dropped, and a member the prompt forgets is a
      place the brief can never file ink at.
    */
    const withInk = interpreterSystemPrompt({ ink: true });
    for (const region of BODY_ANCHOR_REGIONS) {
      expect(withInk, `${region} must be offered`).toContain(`"${region}"`);
    }
  });

  it("forbids the inference that would put tattoos on a person who never asked", () => {
    const withInk = interpreterSystemPrompt({ ink: true });
    expect(withInk).toContain("NEVER INFER");
    /* Her words or nothing — the same containment `statedHair` and
       `statedAccessories` announce, said where the model reads it. */
    expect(withInk).toContain("USE ONLY WORDS THAT APPEAR IN THE BRIEF");
    /* And it must not promise a picture: 7b-i records and discloses. */
    expect(withInk).toContain("IT IS RECORDED, NOT DRAWN");
  });
});
