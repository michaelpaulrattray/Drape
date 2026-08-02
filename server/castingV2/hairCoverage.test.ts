import { describe, expect, it } from "vitest";

import { COILED_HERITAGES, slotsFor, stylesFor, wornStatesFor } from "./hairStyles";
import type { HairStyle } from "../../shared/castingRealization";

/**
 * The coverage-audit batch, and the one property that governs all of it:
 * **share conservation**.
 *
 * The audit's own history is the argument. The first up-styles attempt simply
 * ADDED entries, which pushed the long family from 44 of 100 to 52 and
 * measurably narrowed the silhouette mix — the twin-breaker lost a pairing it
 * used to reach. Nobody asked for more long hair; they asked for people whose
 * hair is up.
 *
 * So every addition here is funded from within its own family, and this file
 * checks the arithmetic rather than trusting the comment beside it. A family
 * total that moves is a silhouette mix that moved.
 */

function familyShares(entries: readonly (readonly [HairStyle, number])[]) {
  const shares: Record<string, number> = {};
  for (const [style, weight] of entries) {
    shares[style.family] = (shares[style.family] ?? 0) + weight;
  }
  return shares;
}

describe("share conservation — every addition funded from within its family", () => {
  it("keeps the female family mix exactly", () => {
    // long 44, mid-length 42, short 8, statements inside short/mid.
    const shares = familyShares(stylesFor("female", "Nordic", "30s"));
    expect(shares.long).toBe(44);
    expect(shares["mid-length"]).toBe(44); // 42 ordinary + WOLF 2
    expect(shares.short).toBe(12); // 8 ordinary + PIXIE 3 + UNDERCUT 1
  });

  it("keeps the coiled family mix across the sex split", () => {
    /*
      The split is where this mattered most: two lists now exist where one did,
      and either could have drifted on its own. Both are checked against the
      SINGLE list's original totals — coiled 18, long 34, mid 22, cropped 20,
      shaved 6.
    */
    for (const sex of ["male", "female"] as const) {
      const shares = familyShares(stylesFor(sex, "West African", "30s"));
      expect(shares.coiled, sex).toBe(18);
      expect(shares.long, sex).toBe(34);
      expect(shares["mid-length"], sex).toBe(22);
      expect(shares.cropped, sex).toBe(20);
      expect(shares.shaved, sex).toBe(6);
    }
  });

  it("keeps the nonbinary long family whole after the plait", () => {
    const shares = familyShares(stylesFor("nonbinary", "Nordic", "30s"));
    expect(shares.long).toBe(12);
  });
});

describe("F1 — the single long plait", () => {
  it("is reachable for women of every non-coiled heritage", () => {
    for (const heritage of ["Nordic", "South Asian", "Latino", "Mediterranean", "Slavic"]) {
      const names = stylesFor("female", heritage, "30s").map(([style]) => style.name);
      expect(names, heritage).toContain("a single long plait");
    }
  });

  it("is texture-open, because a plait reads in any grain", () => {
    const plait = stylesFor("female", "Nordic", "30s").find(
      ([style]) => style.name === "a single long plait",
    );
    expect(plait?.[0].texture).toBeUndefined();
  });
});

describe("F2 — male coiled barbering", () => {
  const male = () => stylesFor("male", "West African", "30s");

  it("offers the two commonest Black male cuts, which had no entries at all", () => {
    const names = male().map(([style]) => style.name);
    expect(names).toContain("brushed waves");
    expect(names).toContain("tapered afro");
    expect(names).toContain("sponge twists");
  });

  it("keeps puff and pineapple POSSIBLE on men, at street frequency", () => {
    // Real and uncommon rather than wrong — the audit's own wording.
    const puff = male().find(([style]) => style.name === "high puff");
    expect(puff?.[1]).toBeGreaterThan(0);
    expect(puff?.[1]).toBeLessThan(4);
  });

  it("gives women the goddess braids and does NOT give them male barbering", () => {
    const names = stylesFor("female", "Afro-Caribbean", "30s").map(([style]) => style.name);
    expect(names).toContain("goddess braids");
    expect(names).not.toContain("brushed waves");
    expect(names).not.toContain("tapered afro");
  });

  it("lets the line-up sit on top of a barbered cut, and nowhere else", () => {
    const waves = male().find(([style]) => style.name === "brushed waves")![0];
    expect(slotsFor(waves)).toContain("lineup");
    // Legality by construction: an ordinary cut cannot carry one.
    const plain = stylesFor("male", "Nordic", "30s").find(
      ([style]) => style.name === "plain short cut",
    )![0];
    expect(slotsFor(plain)).not.toContain("lineup");
  });

  it("still draws nonbinary coiled candidates from the female list — the named default", () => {
    const names = stylesFor("nonbinary", "West African", "30s").map(([style]) => style.name);
    expect(names).toContain("goddess braids");
  });
});

describe("F3 — set curls are presence, not default", () => {
  it("appears only at 70s+", () => {
    for (const band of ["20s", "40s", "60s"] as const) {
      const entry = stylesFor("female", "Nordic", band).find(
        ([style]) => style.name === "short set curls",
      );
      expect(entry?.[1] ?? 0, band).toBe(0);
    }
    const old = stylesFor("female", "Nordic", "70s+").find(
      ([style]) => style.name === "short set curls",
    );
    expect(old?.[1]).toBe(3);
  });

  it("stays a minority of the band — not every old lady looks like a granny", () => {
    const entries = stylesFor("female", "Nordic", "70s+");
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    const curls = entries.find(([style]) => style.name === "short set curls")![1];
    // Roughly one appearance every fourth sheet of eight, which is the ruling.
    expect(curls / total).toBeLessThan(0.06);
  });
});

describe("F7 — slicked back", () => {
  it("is wearable by the families that can hold it, and not by the ones that cannot", () => {
    for (const family of ["short", "mid-length", "long"]) {
      expect(wornStatesFor(family), family).toContain("slicked back");
    }
    // A buzz cut is not slicked back, and the shelf is how that stays unsayable.
    expect(wornStatesFor("shaved")).toEqual([]);
  });
});

describe("the coiled gate itself", () => {
  it("still covers exactly the two heritages with genuinely distinct barbering", () => {
    // Pinned: widening this is a stereotype-authoring decision, not a tweak.
    expect([...COILED_HERITAGES].sort()).toEqual(["Afro-Caribbean", "West African"]);
  });
});
