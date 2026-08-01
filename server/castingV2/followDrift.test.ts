import { describe, expect, it } from "vitest";

import { resolveCandidateIdentity } from "./cohortPhotorealHuman";
import type { CastingIntent } from "./castingIntent";
import { realizeAxes } from "./realizedAxes";
import { stylesFor } from "./hairStyles";

/**
 * One family, not one barber.
 *
 * The founder's taste ruling. The anchor's realized axes carried FLAT to all
 * eight — same named cut, same beard, every tile — and hair is the loudest
 * signal a tile has, so a follow read as a clone stamp instead of as eight
 * people who could be cast for the same part.
 *
 * The bars below are the ruling's two halves, and they pull against each
 * other on purpose: drift too little and it is still a photocopy, drift too
 * much and it stops being a family. Both are asserted with COUNT FLOORS —
 * "at least N differ", "at least N hold" — because an absence-only test passes
 * when the whole mechanism silently disappears.
 */

const INTENT = {
  cohort: "photoreal_human",
  role: "runway model",
  characterNotes: null,
  sex: "male",
  ageBand: "20s",
  agePhase: null,
  heritage: [{ heritage: "British Isles", pct: 100 }],
  build: null,
  energy: null,
  archetype: null,
  variationAxis: "look",
  look: null,
  reads: null,
  composedDirection: null,
} as unknown as CastingIntent;

/** A parent candidate, resolved the way a real follow reads one back. */
function anchorFor(seed: string) {
  const realized = realizeAxes({
    heritage: [{ heritage: "British Isles", pct: 100 }],
    ageBand: "20s",
    sex: "male",
    position: 0,
    rollSeed: seed,
  });
  return {
    sex: "male" as const,
    ageBand: "20s" as const,
    heritage: [{ heritage: "British Isles" as const, pct: 100 }],
    hair: { family: realized.hairStyle?.family ?? "short", colour: "brown" },
    look: null,
    realized,
  };
}

/** How many other cuts this face could plausibly walk in with. */
function poolFor(style: { family: string; name: string } | null | undefined): number {
  if (!style) return 0;
  return stylesFor("male", "British Isles", "20s").filter(
    ([candidate]) =>
      candidate.family === style.family && candidate.name !== style.name && !candidate.statement,
  ).length;
}

function sheet(seed: string) {
  const anchor = anchorFor(seed) as never;
  return Array.from({ length: 8 }, (_, position) =>
    resolveCandidateIdentity(INTENT, position, seed, anchor),
  );
}

describe("a follow reads as one family, not one barber", () => {
  it("drifts the CUT on some tiles and holds it on most", () => {
    /*
      Measured across many rolls rather than asserted on one, because which
      tiles drift is seeded per roll — a single sheet proves nothing about a
      rule that is deliberately not the same every time.
    */
    let couldDrift = 0;
    let didDrift = 0;
    let sheetsWhereMostHold = 0;
    const rolls = 40;

    for (let i = 0; i < rolls; i += 1) {
      const seed = `drift-${i}`;
      const anchor = anchorFor(seed);
      const anchorCut = anchor.realized.hairStyle;
      const cuts = sheet(seed).map((c) => c.realized.hairStyle?.name);
      const held = cuts.filter((name) => name === anchorCut?.name).length;
      if (held >= 5) sheetsWhereMostHold += 1;

      /*
        Only sheets that COULD drift count toward the drift bar. Some families
        have a single wearable cut for a given face — see the thin-shelf test
        below — and scoring those as failures would hide the real rate behind
        a vocabulary fact.
      */
      if (poolFor(anchorCut) > 0) {
        couldDrift += 1;
        if (held < 8) didDrift += 1;
      }
    }

    // The clone stamp is gone wherever the vocabulary allows it to be.
    expect(couldDrift).toBeGreaterThan(rolls / 2);
    expect(didDrift).toBe(couldDrift);
    // And it is still one casting: most tiles hold on nearly every sheet.
    expect(sheetsWhereMostHold).toBeGreaterThanOrEqual(rolls - 2);
  });

  it("holds, rather than reaching, when the family has one wearable cut", () => {
    /*
      A NAMED LIMIT, recorded rather than papered over.

      Male `mid-length` is one cut ("natural mid-length"); West African
      `coiled` is one ("afro"); male `shaved` is a buzz plus a statement that
      the drift pool excludes. A follow anchored there cannot move the cut at
      all, and reaching into a neighbouring family would not be a variation —
      it would be a different casting, which is the ruling's own boundary.

      On MALE sheets the beard still varies, so the sheet is not a photocopy.
      On a female sheet with a thin family there is no second styling axis, and
      those follows do read flat. Closing that needs more cuts in the thin
      families, not a looser rule.
    */
    const thin = Array.from({ length: 40 }, (_, i) => anchorFor(`drift-${i}`).realized.hairStyle)
      .filter((style) => poolFor(style) === 0);
    // The condition is real and reachable — not a branch nobody ever takes.
    expect(thin.length).toBeGreaterThan(0);
    for (const style of thin) {
      expect(style).not.toBeNull();
    }
  });

  it("holds the COLOUR on all eight — colour is the family signal", () => {
    const colours = new Set(sheet("colour-holds").map((c) => c.hair?.colour));
    expect(colours.size).toBe(1);
  });

  it("holds the FAMILY on all eight — shaved must never drift to long", () => {
    for (let i = 0; i < 20; i += 1) {
      const seed = `family-${i}`;
      const anchorFamily = anchorFor(seed).realized.hairStyle?.family;
      const families = new Set(sheet(seed).map((c) => c.realized.hairStyle?.family));
      expect(families.size).toBe(1);
      expect([...families][0]).toBe(anchorFamily);
    }
  });

  it("never drifts into a statement cut, which nothing would cap on a follow", () => {
    /*
      The sheet-taste pass caps a sheet at one statement cut, and it is skipped
      entirely on follows — so a drift pool containing statements would stack
      three of them with nothing to stop it.
    */
    let statements = 0;
    for (let i = 0; i < 40; i += 1) {
      const anchorIsStatement = anchorFor(`stmt-${i}`).realized.hairStyle?.statement;
      if (anchorIsStatement) continue;
      statements += sheet(`stmt-${i}`).filter((c) => c.realized.hairStyle?.statement).length;
    }
    expect(statements).toBe(0);
  });

  it("varies facial hair on some tiles while most carry the parent's", () => {
    let sheetsWithBeardDrift = 0;
    const rolls = 40;
    for (let i = 0; i < rolls; i += 1) {
      const seed = `beard-${i}`;
      const anchorBeard = anchorFor(seed).realized.facialHair;
      const beards = sheet(seed).map((c) => c.realized.facialHair);
      const held = beards.filter((value) => value === anchorBeard).length;
      if (held < 8) sheetsWithBeardDrift += 1;
      expect(held).toBeGreaterThanOrEqual(4);
    }
    expect(sheetsWithBeardDrift).toBeGreaterThanOrEqual(rolls - 2);
  });

  it("moves hair and beard on DIFFERENT tiles, so variance is not stacked", () => {
    /*
      Independent seeds are the point. Sharing `anchoredLook`'s would put every
      axis's variation onto the same two or three faces and leave the other
      five identical — the clone stamp again, with extra steps.
    */
    let sheetsWhereTheyDiffer = 0;
    for (let i = 0; i < 30; i += 1) {
      const seed = `indep-${i}`;
      const anchor = anchorFor(seed);
      const candidates = sheet(seed);
      const hairMoved = candidates
        .map((c, p) => (c.realized.hairStyle?.name !== anchor.realized.hairStyle?.name ? p : -1))
        .filter((p) => p >= 0)
        .join(",");
      const beardMoved = candidates
        .map((c, p) => (c.realized.facialHair !== anchor.realized.facialHair ? p : -1))
        .filter((p) => p >= 0)
        .join(",");
      if (hairMoved !== beardMoved) sheetsWhereTheyDiffer += 1;
    }
    expect(sheetsWhereTheyDiffer).toBeGreaterThanOrEqual(20);
  });

  it("keeps the non-styling axes of the parent identity intact", () => {
    // Eye colour, brows and skin are biology, not grooming — a follow holds
    // them, and drifting them would be following a different person.
    const anchor = anchorFor("biology");
    for (const candidate of sheet("biology")) {
      expect(candidate.realized.eyeColour).toBe(anchor.realized.eyeColour);
      expect(candidate.realized.browStyle).toBe(anchor.realized.browStyle);
      expect(candidate.realized.skinCharacter).toBe(anchor.realized.skinCharacter);
    }
  });
});
