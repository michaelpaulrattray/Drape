import { describe, expect, it } from "vitest";

import { mentionsGarments } from "./brandScrub";
import { statesWardrobe } from "./statedWardrobe";

describe("the brief stated what they are wearing", () => {
  it("fires on clothing the sheet replaces with the studio tee", () => {
    expect(statesWardrobe("a musician in a red leather jacket")).toBe(true);
    expect(statesWardrobe("a speedrunner in an old hoodie")).toBe(true);
    expect(statesWardrobe("a doctor in a white coat, late 40s")).toBe(true);
    expect(statesWardrobe("a bride in a simple dress")).toBe(true);
    expect(statesWardrobe("a chef, apron, forearms")).toBe(true);
  });

  /*
    THE FALSE POSITIVES THAT WOULD MAKE THE LINE NOISE.

    Whole-word matching is the mechanism, and these are the cases that prove it
    is doing work: a stemming matcher fires on every one of them, and the line
    would then appear on ordinary English about a person.
  */
  it("stays silent on ordinary English that merely resembles clothing", () => {
    expect(statesWardrobe("it suits her, mid 30s")).toBe(false);
    expect(statesWardrobe("a printed brief, 20s")).toBe(false);
    expect(statesWardrobe("a barista mid-shift, warm")).toBe(false);
    expect(statesWardrobe("a boxer, broken nose")).toBe(false);
    expect(statesWardrobe("a wiry cyclist in her 20s, freckled")).toBe(false);
  });

  it("says nothing about a brief that mentions nothing worn", () => {
    expect(statesWardrobe("a lighthouse keeper, weathered")).toBe(false);
    expect(statesWardrobe("a Wes Anderson casting, mid 30s")).toBe(false);
    expect(statesWardrobe(null)).toBe(false);
    expect(statesWardrobe("")).toBe(false);
  });

  /*
    THE DIVERGENCE FROM THE DIRECTION GUARD, PINNED.

    `mentionsGarments` includes accessories on purpose — a composed direction
    may not name them. But stated accessories are the framing law's one
    carve-out: they reach the picture. Confessing to ignoring an instruction
    that was HONOURED is the record-that-lies class, so the two lists must not
    be quietly unified later. This test fails if anybody does.
  */
  it("never confesses over an accessory the sheet actually honours", () => {
    for (const brief of [
      "a dad in his 30s wearing chunky glasses",
      "a woman in her 40s, gold earrings",
      "a man with a chain and a wedding ring",
      "an idol, small nose stud",
    ]) {
      expect(statesWardrobe(brief), brief).toBe(false);
    }
  });

  it("is deliberately narrower than the composed-direction garment guard", () => {
    // The guard rejects a direction naming jewellery; the confession does not
    // fire on a brief naming it. Same word, opposite jobs.
    expect(mentionsGarments("soft knitwear and gold earrings")).toBe(true);
    expect(statesWardrobe("soft knitwear and gold earrings")).toBe(false);
  });
});
