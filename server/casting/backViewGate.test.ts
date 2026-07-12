/**
 * backViewGate — the per-angle identity gate (D-39 back gate, D-44/D-46 walk).
 * The contract under test: exactly back + walk are gated; the founder's
 * FORCE_FAIL hook fails both angles deterministically; each gated angle
 * judges with its own prompt (the single tuning point the D-46 calibration
 * note relies on).
 */
import { describe, it, expect, afterEach } from "vitest";
import { GATED_ANGLES, GATE_PROMPTS, isGatedAngle, verifyViewIdentity } from "./backViewGate";
import { CANONICAL_VIEW_ANGLES } from "../../shared/boardTypes";

afterEach(() => {
  delete process.env.BACK_VIEW_GATE_FORCE_FAIL;
});

describe("isGatedAngle (D-46: back + walk, nothing else)", () => {
  it("gates exactly backFull and sideFull", () => {
    const gated = CANONICAL_VIEW_ANGLES.filter((a) => isGatedAngle(a));
    expect(gated.sort()).toEqual(["backFull", "sideFull"]);
    expect([...GATED_ANGLES].sort()).toEqual(["backFull", "sideFull"]);
  });

  it("never gates the identity anchor or the static views", () => {
    expect(isGatedAngle("frontClose")).toBe(false);
    expect(isGatedAngle("threeQuarter")).toBe(false);
    expect(isGatedAngle("sideClose")).toBe(false);
    expect(isGatedAngle("frontFull")).toBe(false);
  });
});

describe("per-angle prompts (the calibration tuning point)", () => {
  it("each gated angle has its own prompt", () => {
    expect(GATE_PROMPTS.backFull).not.toBe(GATE_PROMPTS.sideFull);
  });

  it("the back prompt judges what a back view can show — never the face", () => {
    expect(GATE_PROMPTS.backFull).toMatch(/BACK view/);
    expect(GATE_PROMPTS.backFull).toMatch(/face is not visible/i);
  });

  it("the walk prompt judges the profile and expects motion", () => {
    expect(GATE_PROMPTS.sideFull).toMatch(/WALKING SIDE view/);
    expect(GATE_PROMPTS.sideFull).toMatch(/profile/i);
    expect(GATE_PROMPTS.sideFull).toMatch(/motion, stride/i);
  });
});

describe("FORCE_FAIL hook (the live refund-verification path)", () => {
  it("fails the back view deterministically, marked checked", async () => {
    process.env.BACK_VIEW_GATE_FORCE_FAIL = "1";
    const verdict = await verifyViewIdentity("h.png", "v.png", "backFull");
    expect(verdict).toEqual({ ok: false, checked: true });
  });

  it("fails the walk deterministically too — the hook covers every gated angle", async () => {
    process.env.BACK_VIEW_GATE_FORCE_FAIL = "1";
    const verdict = await verifyViewIdentity("h.png", "v.png", "sideFull");
    expect(verdict).toEqual({ ok: false, checked: true });
  });
});
