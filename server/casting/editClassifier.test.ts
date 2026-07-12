/**
 * editClassifier — the A1 seal's pure layer.
 * Contracts under test: the refusal fires ONLY on minted × identity-level
 * (drafts stay freely editable per D-43; cosmetic refinements stay allowed
 * per D-43.2); fail-open classifications never refuse; the force hook makes
 * the refusal drivable live; the prompt covers the identity dimensions the
 * founder's example (tattoos) belongs to.
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  IDENTITY_EDIT_PROMPT,
  classifyEditIdentityImpact,
  shouldRefuseIteration,
} from "./editClassifier";

afterEach(() => {
  delete process.env.ITERATE_CLASSIFY_FORCE_IDENTITY;
});

describe("shouldRefuseIteration (the D-43 seal rule)", () => {
  it("refuses identity-level edits on every non-draft status", () => {
    const identity = { identityLevel: true, checked: true };
    expect(shouldRefuseIteration("active", identity)).toBe(true);
    expect(shouldRefuseIteration("locked", identity)).toBe(true);
    expect(shouldRefuseIteration("archived", identity)).toBe(true);
  });

  it("never refuses drafts — freely editable, full stop (D-43)", () => {
    expect(shouldRefuseIteration("draft", { identityLevel: true, checked: true })).toBe(false);
  });

  it("never refuses cosmetic edits — refinements are same-person non-events (D-43.2)", () => {
    expect(shouldRefuseIteration("active", { identityLevel: false, checked: true })).toBe(false);
  });

  it("fail-open classifications never refuse (a broken classifier must not block paid edits)", () => {
    expect(shouldRefuseIteration("active", { identityLevel: false, checked: false })).toBe(false);
  });
});

describe("classifier force hook (live refusal verification)", () => {
  it("classifies everything identity-level when forced, marked checked", async () => {
    process.env.ITERATE_CLASSIFY_FORCE_IDENTITY = "1";
    const verdict = await classifyEditIdentityImpact("brighten the lighting");
    expect(verdict).toEqual({ identityLevel: true, checked: true });
  });
});

describe("the prompt (single tuning point)", () => {
  it("names the identity dimensions — permanent marks, build, face, hair, demographics", () => {
    expect(IDENTITY_EDIT_PROMPT).toMatch(/tattoos/i);
    expect(IDENTITY_EDIT_PROMPT).toMatch(/body build/i);
    expect(IDENTITY_EDIT_PROMPT).toMatch(/facial structure/i);
    expect(IDENTITY_EDIT_PROMPT).toMatch(/hair color/i);
    expect(IDENTITY_EDIT_PROMPT).toMatch(/age, gender, ethnicity/i);
  });

  it("blesses the cosmetic space — lighting, styling, pose, quality", () => {
    expect(IDENTITY_EDIT_PROMPT).toMatch(/lighting/i);
    expect(IDENTITY_EDIT_PROMPT).toMatch(/clothing, styling/i);
    expect(IDENTITY_EDIT_PROMPT).toMatch(/pose/i);
    expect(IDENTITY_EDIT_PROMPT).toMatch(/artifacts/i);
  });
});
