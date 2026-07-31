import { describe, expect, it } from "vitest";

import {
  NEIGHBOUR_THRESHOLD,
  beardBucket,
  colourBucket,
  neighbourPairs,
  sameNeighbourhood,
  secondAxis,
} from "./heritageNeighbourhoods";
import { applySheetTaste } from "./realizedAxes";
import { resolveCandidateIdentity } from "./cohortPhotorealHuman";
import { deterministicBriefCompiler } from "./briefCompiler";
import { HAIR_COLOUR_WEIGHTS, stylesFor } from "./hairStyles";
import type { CastingIntent, HeritageComponent, ResolvedIdentity } from "./castingIntent";

/**
 * The twin-breaker, and the neighbourhood computation under it.
 *
 * Founder finding: two pairs on one skincare-founder sheet read as near-twins.
 * The persisted identities disproved the first diagnosis — one pair differed on
 * EIGHT axes — and showed the real cause: Afro-Caribbean and West African are
 * near-clones in every vocabulary we feed the model, so the resolver believed
 * it had varied heritage while nothing downstream varied.
 */

function heritage(name: string): HeritageComponent[] {
  return [{ heritage: name as HeritageComponent["heritage"], pct: 100 }];
}

describe("the neighbourhood computation", () => {
  it("pins the exact pairs, so a palette edit cannot silently re-group", () => {
    /*
      The founder's "cannot rot" requirement, operationalized. This asserts the
      SET rather than a count or a spot-check: any widening or narrowing of a
      colour, texture or style table that moves a pair over the line fails here
      and asks for a human ruling instead of quietly changing who counts as a
      twin.

      The gap this threshold sits in is thin — 0.81 in, 0.76 out — which is
      exactly why the snapshot is load-bearing rather than decorative.
    */
    expect(neighbourPairs()).toEqual([
      "Afro-Caribbean|West African",
      "British Isles|Slavic",
      "British Isles|Western European",
      "Latino|Mediterranean",
      "Latino|Middle Eastern",
      "Mediterranean|Middle Eastern",
      "Slavic|Western European",
    ]);
  });

  it("finds the pair the founder actually saw", () => {
    expect(sameNeighbourhood("West African", "Afro-Caribbean")).toBe(true);
  });

  it("keeps heritages our vocabularies genuinely separate apart", () => {
    // The metric's floor cases: East Asian against the coiled traditions score
    // 0.04 and 0.10. If these ever became neighbours the metric is broken.
    expect(sameNeighbourhood("East Asian", "West African")).toBe(false);
    expect(sameNeighbourhood("Nordic", "Polynesian")).toBe(false);
    expect(sameNeighbourhood("East Asian", "Nordic")).toBe(false);
  });

  it("is symmetric and reflexive", () => {
    expect(sameNeighbourhood("Latino", "Mediterranean")).toBe(sameNeighbourhood("Mediterranean", "Latino"));
    expect(sameNeighbourhood("Nordic", "Nordic")).toBe(true);
  });

  it("does not chain through a bridge heritage", () => {
    /*
      Pairwise on purpose. Under a transitive grouping at a lower threshold the
      Mediterranean cluster swallows East Asian, which would assert "these
      render alike" about two heritages the metric scored far apart.
    */
    expect(sameNeighbourhood("Latino", "Middle Eastern")).toBe(true);
    expect(sameNeighbourhood("Middle Eastern", "South Asian")).toBe(false);
    expect(sameNeighbourhood("Latino", "South Asian")).toBe(false);
  });

  it("keeps the threshold where the evidence put it", () => {
    expect(NEIGHBOUR_THRESHOLD).toBe(0.8);
  });
});

describe("the second-axis buckets", () => {
  it("reads facial hair at the resolution a contact sheet does", () => {
    // Both founder pairs are here: heavy vs light stubble, short vs full beard.
    expect(beardBucket("heavy stubble")).toBe(beardBucket("light stubble"));
    expect(beardBucket("short beard")).toBe(beardBucket("full beard"));
    expect(beardBucket("full beard")).not.toBe(beardBucket("clean-shaven"));
    expect(beardBucket(null)).toBeNull();
  });

  it("buckets every colour the palette can produce", () => {
    // Derived from SHADE_LADDER, so a widened palette cannot leave one out.
    expect(colourBucket("platinum blonde")).toBe("light");
    expect(colourBucket("black")).toBe("dark");
    expect(colourBucket("grey")).toBe("grey");
    expect(colourBucket("white")).toBe("grey");
    expect(colourBucket("brown")).not.toBe(colourBucket("blonde"));
  });

  it("gives men the beard axis and everyone else colour", () => {
    expect(secondAxis("male")).toBe("beard");
    expect(secondAxis("female")).toBe("colour");
    expect(secondAxis("nonbinary")).toBe("colour");
  });
});

/* ---------------------------------------------------- the rule on a sheet */

/**
 * Every invariant is recomputed from the RETURNED sheet, never from the pass's
 * internal bookkeeping. That is the only shape that catches bookkeeping drift —
 * and drift is not hypothetical here: the shipped distinct-floor bug was a rule
 * mutating an axis after its own ledger had been written.
 */
function twinViolations(sheet: { heritage: HeritageComponent[]; sex: string; hair: { colour: string } | null; realized: { hairStyle: { family: string }; facialHair: string | null } }[]) {
  const violations: string[] = [];
  for (let i = 0; i < sheet.length; i += 1) {
    for (let j = i + 1; j < sheet.length; j += 1) {
      const a = sheet[i];
      const b = sheet[j];
      const ha = a.heritage[0]?.heritage ?? "";
      const hb = b.heritage[0]?.heritage ?? "";
      if (!sameNeighbourhood(ha, hb)) continue;
      if (a.realized.hairStyle.family !== b.realized.hairStyle.family) continue;
      const second =
        secondAxis(a.sex as never) === "beard"
          ? beardBucket(a.realized.facialHair as never) === beardBucket(b.realized.facialHair as never)
          : a.hair && b.hair && colourBucket(a.hair.colour as never) === colourBucket(b.hair.colour as never);
      if (second) violations.push(`${i}/${j} ${ha}~${hb} ${a.realized.hairStyle.family}`);
    }
  }
  return violations;
}

function lockedSheet(options: {
  heritage: string;
  sex: "male" | "female";
  ageBand?: "20s" | "40s";
  rollSeed: string;
  count?: number;
}) {
  const intent = {
    heritage: heritage(options.heritage),
    sex: options.sex,
    ageBand: options.ageBand ?? "40s",
    reads: [],
  } as unknown as CastingIntent;
  const raw = Array.from({ length: options.count ?? 8 }, (_, position) =>
    resolveCandidateIdentity(intent, position, options.rollSeed),
  );
  return applySheetTaste(raw, options.rollSeed);
}

describe("the twin-breaker on a sheet", () => {
  it("uses every distinct pairing its vocabulary can offer", () => {
    /*
      Eight candidates from one heritage is the adversarial set: every pair sits
      in the same neighbourhood by definition, so the rule works with nothing
      but the axes inside one palette. Some of those sheets CANNOT be fully
      separated — an East Asian female sheet has three silhouettes and one
      colour bucket, three distinct pairings for eight people — so asserting
      "no twins" would be asserting something arithmetic cannot deliver.

      What IS assertable is that the pass spends everything available: the
      number of distinct (silhouette, second-axis) pairings equals the smaller
      of the sheet size and the vocabulary's capacity. That is exact, it
      degrades honestly on a narrow palette, and a regression that stopped
      breaking twins shows up immediately as a shortfall.
    */
    for (const heritageName of ["West African", "Mediterranean", "British Isles", "Nordic", "East Asian"]) {
      for (const sex of ["male", "female"] as const) {
        const families = new Set(
          stylesFor(sex, heritageName, "40s").filter(([style]) => !style.statement).map(([style]) => style.family),
        );
        const buckets =
          secondAxis(sex) === "beard"
            ? new Set(["bearded", "bare"])
            : new Set((HAIR_COLOUR_WEIGHTS[heritageName] ?? []).map(([shade]) => colourBucket(shade)));
        const ideal = Math.min(8, families.size * buckets.size);

        for (let roll = 0; roll < 60; roll += 1) {
          const sheet = lockedSheet({ heritage: heritageName, sex, rollSeed: `same-${heritageName}-${sex}-${roll}` });
          const pairings = new Set(
            sheet.map((candidate) => {
              const second =
                secondAxis(sex) === "beard"
                  ? beardBucket(candidate.realized.facialHair)
                  : candidate.hair
                    ? colourBucket(candidate.hair.colour)
                    : "none";
              return `${candidate.realized.hairStyle.family}|${second}`;
            }),
          );
          /*
            At least the ideal. Greying is age-driven and sits outside the
            heritage palette, so an older sheet can reach one bucket MORE than
            the palette alone offers — capacity the pass is welcome to spend.
            The bar is that it never spends less.
          */
          expect(pairings.size, `${heritageName}/${sex} roll ${roll}`).toBeGreaterThanOrEqual(ideal);
        }
      }
    }
  });

  it("breaks far more twins than it leaves", () => {
    // The rule has to be observably doing work: without it, a same-heritage
    // sheet of eight collides constantly.
    let before = 0;
    let after = 0;
    for (let roll = 0; roll < 60; roll += 1) {
      const intent = {
        heritage: heritage("West African"),
        sex: "male",
        ageBand: "40s",
        reads: [],
      } as unknown as CastingIntent;
      const raw = Array.from({ length: 8 }, (_, position) =>
        resolveCandidateIdentity(intent, position, `work-${roll}`),
      );
      before += twinViolations(raw as never).length;
      after += twinViolations(applySheetTaste(raw, `work-${roll}`) as never).length;
    }
    expect(before).toBeGreaterThan(0);
    expect(after).toBeLessThan(before / 3);
  });

  it("leaves no twin at all on an open brief, where the palette has room", async () => {
    for (const brief of ["a model", "a male model", "a skincare founder in his 40s"]) {
      for (let roll = 0; roll < 120; roll += 1) {
        const compiled = await deterministicBriefCompiler({
          briefText: brief,
          candidateCount: 8,
          rollSeed: `twin-${brief}-${roll}`,
        });
        const sheet = compiled.candidates.map((candidate) => candidate.resolvedIdentity);
        expect(twinViolations(sheet as never), `${brief} roll ${roll}`).toEqual([]);
      }
    }
  });

  it("still holds the three rules it already had", () => {
    /*
      Recomputed from the returned sheet. The twin rule narrows the same style
      pool the cap and the floor use, so it is exactly the kind of change that
      could quietly cost the floor a slot.
    */
    for (let roll = 0; roll < 200; roll += 1) {
      const sheet = lockedSheet({ heritage: "British Isles", sex: roll % 2 ? "male" : "female", rollSeed: `keep-${roll}` });
      const names = new Set(sheet.map((c) => c.realized.hairStyle.name));
      const statements = sheet.filter((c) => c.realized.hairStyle.statement).length;
      expect(statements, `roll ${roll} statements`).toBeLessThanOrEqual(1);
      expect(names.size, `roll ${roll} distinct`).toBeGreaterThanOrEqual(5);
      const pairs = sheet
        .filter((c) => c.hair && c.hair.colour !== "grey" && c.hair.colour !== "white")
        .map((c) => `${c.hair!.colour}|${c.realized.hairStyle.family}`);
      expect(new Set(pairs).size, `roll ${roll} colour pairs`).toBe(pairs.length);
    }
  });

  it("never leaves a candidate's own heritage palette to break a twin", () => {
    // The founder's hard line: never break a twin by washing heritage.
    const seen = new Set<string>();
    for (let roll = 0; roll < 60; roll += 1) {
      for (const candidate of lockedSheet({ heritage: "West African", sex: "male", rollSeed: `wash-${roll}` })) {
        if (candidate.hair) seen.add(candidate.hair.colour);
      }
    }
    for (const banned of ["blonde", "ash blonde", "golden blonde", "platinum blonde", "red", "copper", "strawberry blonde", "auburn", "chestnut", "brown"]) {
      expect(seen.has(banned as never), banned).toBe(false);
    }
  });

  it("never mints a statement cut to break a twin", () => {
    for (let roll = 0; roll < 100; roll += 1) {
      const sheet = lockedSheet({ heritage: "Mediterranean", sex: "male", rollSeed: `stmt-${roll}` });
      expect(sheet.filter((c) => c.realized.hairStyle.statement).length).toBeLessThanOrEqual(1);
    }
  });

  it("defers when the brief stated facial hair", async () => {
    /*
      Under deference no realized facial-hair line is emitted, so flipping the
      value would change nothing visible while making the stored identity
      disagree with the prompt actually sent.
    */
    const brief = "a bearded skincare founder in his 40s";
    const compiled = await deterministicBriefCompiler({ briefText: brief, candidateCount: 8, rollSeed: "stated-fh" });
    const intent = { heritage: [], sex: "male", reads: [] } as unknown as CastingIntent;
    void intent;
    const raw = compiled.candidates.map((candidate) => candidate.resolvedIdentity);
    const untouched = applySheetTaste(raw as never, "stated-fh", { statedFacialHair: true });
    untouched.forEach((candidate, index) => {
      expect(candidate.realized.facialHair).toBe(raw[index].realized.facialHair);
    });
  });
});

describe("the pairs the founder actually reported", () => {
  /*
    The complaint itself, encoded. These are the persisted identities read back
    from the production sheet, reduced to the axes the rule reads. Feeding them
    through the pass must separate them — if this ever passes again unchanged,
    the fix has regressed.
  */
  function candidate(input: {
    heritage: string;
    family: string;
    facialHair: string;
    colour: string;
    agePhase: string;
  }): ResolvedIdentity {
    return {
      sex: "male",
      ageBand: "40s",
      agePhase: input.agePhase,
      heritage: heritage(input.heritage),
      build: null,
      hair: { family: input.family, colour: input.colour },
      look: null,
      energy: "warm",
      realized: {
        eyeColour: "dark brown",
        hairStyle: { name: `cut-${input.family}`, family: input.family },
        facialHair: input.facialHair,
        hairTexture: "coiled",
        browStyle: "full",
        skinCharacter: "plain",
      },
    } as unknown as ResolvedIdentity;
  }

  it("would have flagged Roll 1 tiles 06/07 before the fix", () => {
    const before = [
      candidate({ heritage: "Afro-Caribbean", family: "mid-length", facialHair: "heavy stubble", colour: "dark brown", agePhase: "mid" }),
      candidate({ heritage: "West African", family: "mid-length", facialHair: "light stubble", colour: "black", agePhase: "mid" }),
    ];
    // Same neighbourhood, same silhouette, same beard bucket — a twin.
    expect(twinViolations(before as never)).toHaveLength(1);
  });

  it("would have flagged Roll 3 tiles 01/02 before the fix", () => {
    // The pair that differed on all four axes the first diagnosis named, and
    // still read as twins: both bearded, and both long-ish coiled silhouettes.
    const before = [
      candidate({ heritage: "Afro-Caribbean", family: "long", facialHair: "short beard", colour: "black", agePhase: "early" }),
      candidate({ heritage: "West African", family: "long", facialHair: "full beard", colour: "black", agePhase: "late" }),
    ];
    expect(twinViolations(before as never)).toHaveLength(1);
  });

  it("separates both once the pass has run", () => {
    for (const pair of [
      [
        candidate({ heritage: "Afro-Caribbean", family: "mid-length", facialHair: "heavy stubble", colour: "dark brown", agePhase: "mid" }),
        candidate({ heritage: "West African", family: "mid-length", facialHair: "light stubble", colour: "black", agePhase: "mid" }),
      ],
      [
        candidate({ heritage: "Afro-Caribbean", family: "long", facialHair: "short beard", colour: "black", agePhase: "early" }),
        candidate({ heritage: "West African", family: "long", facialHair: "full beard", colour: "black", agePhase: "late" }),
      ],
    ]) {
      const after = applySheetTaste(pair as never, "founder-pairs");
      expect(twinViolations(after as never)).toEqual([]);
    }
  });
});

describe("a brief that states hair", () => {
  /*
    "A skincare founder in his 40s, silver at the temples" — the founder's own
    brief, and the one the twin-breaker would never have run on.

    "Silver" trips hair deference, which suppresses every authored hair line.
    The first version of the taste pass treated that as a reason to skip the
    WHOLE pass, which was right when the pass only held hair rules and wrong
    the moment the twin rule arrived: the twin rule's second axis is facial
    hair, and deference over HAIR has nothing to say about a beard.
  */
  function rawSheet(rollSeed: string) {
    const intent = { heritage: [], sex: "male", ageBand: "40s", reads: [] } as unknown as CastingIntent;
    return Array.from({ length: 8 }, (_, position) => resolveCandidateIdentity(intent, position, rollSeed));
  }

  function beardTwins(sheet: ResolvedIdentity[]) {
    let count = 0;
    for (let i = 0; i < sheet.length; i += 1) {
      for (let j = i + 1; j < sheet.length; j += 1) {
        const hi = sheet[i].heritage[0]?.heritage ?? "";
        const hj = sheet[j].heritage[0]?.heritage ?? "";
        if (!sameNeighbourhood(hi, hj)) continue;
        if (beardBucket(sheet[i].realized.facialHair) === beardBucket(sheet[j].realized.facialHair)) count += 1;
      }
    }
    return count;
  }

  /** With k candidates in one neighbourhood and two buckets, the best split is
   *  ceil(k/2) against floor(k/2). Everything below that is unavoidable. */
  function pigeonholeFloor(sheet: ResolvedIdentity[]) {
    const groups: string[][] = [];
    for (const candidate of sheet) {
      const h = candidate.heritage[0]?.heritage ?? "";
      const group = groups.find((entries) => entries.every((other) => sameNeighbourhood(other, h)));
      if (group) group.push(h);
      else groups.push([h]);
    }
    const pairs = (n: number) => (n * (n - 1)) / 2;
    return groups.reduce(
      (sum, group) => sum + pairs(Math.ceil(group.length / 2)) + pairs(Math.floor(group.length / 2)),
      0,
    );
  }

  it("still separates on facial hair when the silhouette is unavailable", () => {
    /*
      Optimal, not merely better: with only two beard buckets the pass reaches
      the pigeonhole floor exactly. Asserting equality with the floor rather
      than a fixed number keeps the bar honest if the vocabulary changes.
    */
    let after = 0;
    let floor = 0;
    let before = 0;
    for (let roll = 0; roll < 200; roll += 1) {
      const raw = rawSheet(`stated-${roll}`);
      before += beardTwins(raw);
      after += beardTwins(applySheetTaste(raw, `stated-${roll}`, { hairAuthored: false }));
      floor += pigeonholeFloor(raw);
    }
    expect(after).toBe(floor);
    expect(before).toBeGreaterThan(floor * 2);
  });

  it("leaves the hair record alone, because none of it reaches the prompt", () => {
    /*
      The hair rules stand down rather than editing a record the image never
      saw. Mutating hair here would be the record-that-lies failure in reverse:
      a stored cut nothing rendered.
    */
    for (let roll = 0; roll < 60; roll += 1) {
      const raw = rawSheet(`untouched-${roll}`);
      const after = applySheetTaste(raw, `untouched-${roll}`, { hairAuthored: false });
      after.forEach((candidate, index) => {
        expect(candidate.hair).toEqual(raw[index].hair);
        expect(candidate.realized.hairStyle).toEqual(raw[index].realized.hairStyle);
        expect(candidate.realized.hairTexture).toEqual(raw[index].realized.hairTexture);
      });
    }
  });

  it("does nothing at all when facial hair is stated too", () => {
    // Both axes deferred: the pass has nothing left it is allowed to touch.
    for (let roll = 0; roll < 40; roll += 1) {
      const raw = rawSheet(`both-${roll}`);
      const after = applySheetTaste(raw, `both-${roll}`, { hairAuthored: false, statedFacialHair: true });
      expect(after).toEqual(raw);
    }
  });
});
