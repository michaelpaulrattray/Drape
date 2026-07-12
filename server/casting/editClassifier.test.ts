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

// ── F6 stale-writer selection (D-53 rider, C5) ──────────────────────────────
import { selectStaleSiblingHeads } from "./editClassifier";

describe("selectStaleSiblingHeads — the F6 line", () => {
  // Newest-first, like getModelAssets
  const assets = [
    { id: 50, viewType: "frontFull", storageUrl: "https://r2/ff-v2.png", pinned: false },
    { id: 40, viewType: "frontFull", storageUrl: "https://r2/ff-v1.png", pinned: false },
    { id: 30, viewType: "sideClose", storageUrl: "https://r2/side.png", pinned: true },
    { id: 20, viewType: "threeQuarter", storageUrl: "https://r2/tq.png", pinned: false },
    { id: 10, viewType: "frontClose", storageUrl: "https://r2/head.png", pinned: false },
    { id: 5, viewType: "backFull", storageUrl: "", pinned: false }, // failed marker — not a head
  ];

  it("marks each OTHER angle's head, never the edited angle", () => {
    const ids = selectStaleSiblingHeads(assets, "frontFull");
    expect(ids).toContain(20); // threeQuarter head
    expect(ids).toContain(10); // headshot head
    expect(ids).not.toContain(50); // the edited angle
    expect(ids).not.toContain(40);
  });

  it("skips pinned heads — accepted-final feels no staleness pressure", () => {
    expect(selectStaleSiblingHeads(assets, "frontFull")).not.toContain(30);
  });

  it("only the HEAD row per angle, never older versions", () => {
    const ids = selectStaleSiblingHeads(assets, "frontClose");
    expect(ids).toContain(50); // frontFull head (v2)
    expect(ids).not.toContain(40); // frontFull v1 — not a head
  });

  it("ignores unfilled marker rows", () => {
    expect(selectStaleSiblingHeads(assets, "frontClose")).not.toContain(5);
  });

  it("a single-view draft marks nothing", () => {
    expect(selectStaleSiblingHeads([assets[4]], "frontClose")).toEqual([]);
  });
});
