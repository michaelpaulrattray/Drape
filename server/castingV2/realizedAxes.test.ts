import { describe, expect, it } from "vitest";

import { realizeAxes } from "./realizedAxes";
import { resolveCandidateIdentity, type FollowAnchor } from "./cohortPhotorealHuman";
import { castingBriefCompiler } from "./briefCompiler";
import type { CastingIntent, HeritageComponent, ResolvedIdentity } from "./castingIntent";
import { REALIZED_AXIS_KEYS } from "../../shared/castingRealization";
import type { TextEngine } from "../providers/types";

/**
 * An axis nobody assigns collapses to the model's favourite default.
 *
 * The founder confirmed the first instance in production: the large majority of
 * casts came back brown-eyed, which is exactly what the port audit's D1 row
 * predicted and then accepted. The acceptance was the mistake — five axes were
 * in the same position, and "eye colour" was the one visible enough to notice.
 *
 * These tests are about the CLASS. Every axis must vary, must vary plausibly
 * for who the person is, must lose to anything the brief actually said, and
 * must draw from its own hash rather than a shifted shared one.
 */

function heritage(name: string): HeritageComponent[] {
  return [{ heritage: name as HeritageComponent["heritage"], pct: 100 }];
}

function realizeEight(options: {
  heritage: string;
  ageBand?: "teens" | "20s" | "30s" | "40s" | "50s" | "60s" | "70s+";
  sex?: "male" | "female" | "nonbinary";
  seed?: string;
}) {
  return Array.from({ length: 8 }, (_, position) =>
    realizeAxes({
      heritage: heritage(options.heritage),
      ageBand: options.ageBand ?? "30s",
      sex: options.sex ?? "female",
      position,
      rollSeed: options.seed ?? "axes",
    }),
  );
}

describe("every axis actually varies", () => {
  /*
    The collision lesson, asserted per axis. Deriving several axes by shifting
    one hash is what made hair family come back as ONE value across eight
    candidates: FNV-1a advances by its prime per position, so a shifted hash
    modulo a weight total lands on the same bucket for consecutive positions.
  */
  const SEEDS = ["a", "b", "c", "d", "e"];

  it("eye colour reaches at least four values on an open sheet", () => {
    for (const seed of SEEDS) {
      const eyes = new Set(realizeEight({ heritage: "British Isles", seed }).map((a) => a.eyeColour));
      expect(eyes.size, seed).toBeGreaterThanOrEqual(4);
    }
  });

  it("facial hair reaches at least three states among men", () => {
    for (const seed of SEEDS) {
      const states = new Set(
        realizeEight({ heritage: "Mediterranean", sex: "male", seed }).map((a) => a.facialHair),
      );
      expect(states.size, seed).toBeGreaterThanOrEqual(3);
    }
  });

  it("hair texture reaches at least three values where heritage allows", () => {
    for (const seed of SEEDS) {
      const textures = new Set(realizeEight({ heritage: "Latino", seed }).map((a) => a.hairTexture));
      expect(textures.size, seed).toBeGreaterThanOrEqual(3);
    }
  });

  it("brows are visibly non-uniform", () => {
    for (const seed of SEEDS) {
      const brows = new Set(realizeEight({ heritage: "Nordic", seed }).map((a) => a.browStyle));
      expect(brows.size, seed).toBeGreaterThanOrEqual(3);
    }
  });

  it("the axes are independent of one another", () => {
    // If two axes shared a hash they would move together across positions.
    const eight = realizeEight({ heritage: "Western European", sex: "male" });
    const pairs = new Set(eight.map((a) => `${a.eyeColour}|${a.browStyle}`));
    expect(pairs.size).toBeGreaterThan(new Set(eight.map((a) => a.eyeColour)).size - 1);
  });
});

describe("realization is conditioned, not a rainbow", () => {
  it("never gives a West African candidate blue or grey eyes", () => {
    const colours = new Set(
      Array.from({ length: 40 }, (_, position) =>
        realizeAxes({
          heritage: heritage("West African"),
          ageBand: "30s",
          sex: "female",
          position,
          rollSeed: `wa${position}`,
        }).eyeColour,
      ),
    );
    for (const banned of ["blue", "pale blue", "grey", "green", "green-grey"]) {
      expect(colours.has(banned as never), banned).toBe(false);
    }
  });

  it("gives Nordic candidates the light colours the default palette never would", () => {
    const colours = new Set(
      Array.from({ length: 40 }, (_, position) =>
        realizeAxes({
          heritage: heritage("Nordic"),
          ageBand: "30s",
          sex: "female",
          position,
          rollSeed: `no${position}`,
        }).eyeColour,
      ),
    );
    expect(colours.has("blue") || colours.has("pale blue")).toBe(true);
  });

  it("never assigns facial hair to women", () => {
    for (const axes of realizeEight({ heritage: "Mediterranean", sex: "female" })) {
      expect(axes.facialHair).toBeNull();
    }
  });

  it("keeps teenagers off full beards", () => {
    const states = new Set(
      Array.from({ length: 40 }, (_, position) =>
        realizeAxes({
          heritage: heritage("Mediterranean"),
          ageBand: "teens",
          sex: "male",
          position,
          rollSeed: `t${position}`,
        }).facialHair,
      ),
    );
    expect(states.has("full beard")).toBe(false);
    expect(states.has("short beard")).toBe(false);
  });

  it("keeps most skin plain — seasoning, not costume", () => {
    const characters = Array.from({ length: 80 }, (_, position) =>
      realizeAxes({
        heritage: heritage("Mediterranean"),
        ageBand: "30s",
        sex: "female",
        position,
        rollSeed: `s${position}`,
      }).skinCharacter,
    );
    const plain = characters.filter((c) => c === "plain").length;
    expect(plain / characters.length).toBeGreaterThan(0.55);
  });

  it("gives coiled texture to West African candidates and effectively never to East Asian", () => {
    const wa = new Set(realizeEight({ heritage: "West African" }).map((a) => a.hairTexture));
    expect(wa.has("coiled")).toBe(true);
    const ea = Array.from({ length: 40 }, (_, position) =>
      realizeAxes({
        heritage: heritage("East Asian"),
        ageBand: "30s",
        sex: "female",
        position,
        rollSeed: `ea${position}`,
      }).hairTexture,
    );
    expect(ea.filter((t) => t === "coiled").length).toBe(0);
  });
});

describe("a stated fact outranks a realized one", () => {
  function intentOf(partial: Partial<CastingIntent> = {}): CastingIntent {
    return {
      cohort: "photoreal_human",
      role: null,
      characterNotes: null,
      sex: null,
      ageBand: null,
      agePhase: null,
      heritage: [],
      build: null,
      energy: null,
      archetype: null,
      variationAxis: null,
      look: null,
      reads: [],
      ...partial,
    } as CastingIntent;
  }

  async function promptFor(brief: string, notes: string | null): Promise<string> {
    const compiled = await castingBriefCompiler({
      briefText: brief,
      candidateCount: 1,
      rollSeed: `stated:${brief}`,
      engine: {
        id: "test",
        complete: async () => ({
          text: JSON.stringify({
            cohort: "photoreal_human",
            role: "creator",
            characterNotes: notes,
            reads: null,
          }),
          latencyMs: 1,
          provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
        }),
      } satisfies TextEngine,
    });
    return compiled.candidates[0].prompt;
  }

  it.each([
    ["green eyes", "EYE COLOUR:"],
    ["a full beard", "FACIAL HAIR:"],
    ["thick bushy eyebrows", "BROW CHARACTER:"],
    ["freckles across the nose", "SKIN CHARACTER:"],
  ])("says nothing about the axis when the brief states %j", async (notes, marker) => {
    /*
      Deference, not contradiction. The "shaved head" lesson: the brief said
      shaved and the hair axis assigned curls anyway, because nothing asked
      whether the user had already decided.
    */
    expect(await promptFor(`a creator with ${notes}`, notes)).not.toContain(marker);
  });

  it("still realizes the axes the brief said nothing about", async () => {
    const prompt = await promptFor("a creator with green eyes", "green eyes");
    expect(prompt).not.toContain("EYE COLOUR:");
    expect(prompt).toContain("BROW CHARACTER:");
  });

  it("realizes everything on a brief that states none of them", async () => {
    const prompt = await promptFor("an oncology nurse", "tired at the end of a shift");
    expect(prompt).toContain("EYE COLOUR:");
    expect(prompt).toContain("BROW CHARACTER:");
  });

  it("injects the engineered iris render, not just the colour name", async () => {
    // D1's whole point: "hazel" alone renders as generic brown.
    const prompt = await promptFor("an oncology nurse", null);
    expect(prompt).toMatch(/EYE COLOUR: [a-z -]+ — .*(striation|limbal|flecks|micro-texture|pupil)/);
  });
});

describe("a follow inherits the realized axes", () => {
  it("carries the parent's BIOLOGY on every tile, and only the styling drifts", () => {
    const parent = resolveCandidateIdentity(
      { ...({} as CastingIntent), heritage: [], reads: [] } as unknown as CastingIntent,
      0,
      "parent",
    );
    const anchor: FollowAnchor = {
      sex: parent.sex,
      heritage: parent.heritage,
      ageBand: parent.ageBand,
      hair: parent.hair,
      look: parent.look,
      realized: parent.realized,
    };
    const eight = Array.from({ length: 8 }, (_, position) =>
      resolveCandidateIdentity(
        { ...({} as CastingIntent), heritage: [], reads: [] } as unknown as CastingIntent,
        position,
        "child",
        anchor,
      ),
    );
    /*
      REWRITTEN to the founder's follow-drift ruling, deliberately.

      This asserted that every realized axis carried flat to all eight, which
      is exactly the behaviour the ruling replaced: hair is the loudest signal
      a tile has, and a follow that repeated the parent's cut and beard eight
      times read as a clone stamp rather than as one family.

      What the ruling kept is what this now pins. Biology is inherited whole —
      eyes, brows and skin are the followed PERSON, and drifting them would be
      following someone else. Styling is where a follow is allowed to breathe.
    */
    for (const candidate of eight) {
      expect(candidate.realized.eyeColour).toBe(parent.realized.eyeColour);
      expect(candidate.realized.browStyle).toBe(parent.realized.browStyle);
      expect(candidate.realized.skinCharacter).toBe(parent.realized.skinCharacter);
    }
    // And the styling is not merely allowed to vary — it does. Without a count
    // floor this passes just as well when the drift silently disappears.
    const cuts = new Set(eight.map((candidate) => candidate.realized.hairStyle?.name));
    const beards = new Set(eight.map((candidate) => candidate.realized.facialHair));
    expect(cuts.size + beards.size).toBeGreaterThan(2);
  });
});

describe("the registry", () => {
  it("names every axis realize() produces, so M7 needs no special cases", () => {
    const produced = Object.keys(realizeEight({ heritage: "Nordic" })[0]).sort();
    expect([...REALIZED_AXIS_KEYS].sort()).toEqual(produced);
  });
});
