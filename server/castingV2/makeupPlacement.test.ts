import { describe, expect, it } from "vitest";

import { CATALOGUE } from "../../scripts/lib/askCatalogue.mjs";
import {
  MAKEUP_PLACEMENTS,
  PLACEMENT_OF_MAKEUP,
  makeupRegionFor,
  placementOfMakeup,
  regionOfPlacement,
} from "./makeupPlacement";

/**
 * THE COURT FOR THE PLACEMENT TABLE (fable-103).
 *
 * A closed vocabulary is only knowledge if it covers the asks the product
 * actually receives, so the catalogue's own makeup entries are the specimen set
 * — the same asks Tier A will spend on. Every one is classified here, in print,
 * so a placement that is wrong is wrong in public rather than in a mask.
 */
describe("where a makeup ask lands", () => {
  it("puts a lip ask on her lips — the walk's own specimen", () => {
    expect(placementOfMakeup("add nude lip gloss")).toBe("lips");
    expect(makeupRegionFor("add nude lip gloss")).toBe("lips");
    /*
      The defect, stated as its consequence: this used to be `face skin`, so a
      gloss ask claimed her whole face and the surrender rule handed it the
      freckles a previous render had delivered.
    */
    expect(makeupRegionFor("add nude lip gloss")).not.toBe("face skin");
  });

  /**
   * THE FOUNDER'S OWN BOUNDARY (fable-104). He asked the right question about
   * this table before it shipped: does "add gloss to her skin" still work?
   *
   * A word-keyed table without a context gate is a swamp with a menu — "gloss"
   * would drag a skin-finish ask onto her mouth. Her sentence names the
   * destination, so her sentence wins; the dictionary is only consulted when
   * she named a thing without naming a place.
   */
  it("never drags a skin or hair ask onto her mouth — the founder's three sentences", () => {
    expect(placementOfMakeup("add nude lip gloss"), "the positive").toBe("lips");
    expect(placementOfMakeup("add gloss to her skin"), "a skin finish").not.toBe("lips");
    expect(placementOfMakeup("gloss on her hair"), "a hair finish").not.toBe("lips");
    /*
      And the shapes they fall to. Skin resolves to the whole complexion, which
      is right. Hair has no makeup placement at all, so it falls to the coarse
      default rather than being given a confident wrong answer — a hair ask
      belongs to a hair facet upstream and should never arrive here.
    */
    expect(placementOfMakeup("add gloss to her skin")).toBe("full-face");
    expect(placementOfMakeup("gloss on her hair")).toBe("full-face");
  });

  it("lets her own destination outrank the dictionary", () => {
    /* A lip product, sent somewhere else on purpose. Her words are the spec. */
    expect(placementOfMakeup("gloss on her cheekbones")).toBe("cheeks");
    expect(placementOfMakeup("blush on her eyelids")).toBe("eyes");
  });

  it("takes the LONGEST match, so a lip liner is not an eyeliner", () => {
    /* "lip liner" contains "liner"; first-match order would put it on her lids. */
    expect(placementOfMakeup("a soft brown lip liner")).toBe("lips");
    expect(placementOfMakeup("winged eyeliner")).toBe("eyes");
  });

  it("defaults to full-face — today's exact behaviour — when it has never heard of the ask", () => {
    expect(placementOfMakeup("something nobody has ever asked for")).toBe("full-face");
    expect(placementOfMakeup(null)).toBe("full-face");
    expect(placementOfMakeup("")).toBe("full-face");
    /*
      The default must be the COARSE one. A default of `lips` would put her
      foundation on her mouth, which is worse than being unplaced.
    */
    expect(makeupRegionFor("something nobody has ever asked for")).toBe("face skin");
  });

  it("only ever answers with a region a segmenter is asked for", () => {
    const regions = new Set(MAKEUP_PLACEMENTS.map(regionOfPlacement));
    expect([...regions].sort()).toEqual(["eyes", "face skin", "lips"]);
  });

  it("has no entry that cannot be reached — every product word places something", () => {
    for (const entry of PLACEMENT_OF_MAKEUP) {
      for (const word of entry.words) {
        expect(placementOfMakeup(`a look with ${word} in it`), `"${word}"`).toBe(entry.placement);
      }
    }
  });

  /**
   * THE COURT ITSELF. Every makeup ask the catalogue will spend on, classified.
   *
   * `full-face` is a legitimate verdict — it is what the product does today —
   * so the bar is not "everything is placed", it is **nothing is MISplaced**:
   * an ask naming lips lands on lips, an ask naming eyes lands on eyes.
   */
  it("classifies every makeup ask in the catalogue, and misplaces none", () => {
    const asks = CATALOGUE.filter((entry) => entry.category === "makeup");
    expect(asks.length, "the catalogue still carries makeup asks").toBeGreaterThan(10);

    const table = asks.map((entry) => ({
      ask: entry.ask,
      placement: placementOfMakeup(entry.ask),
      region: makeupRegionFor(entry.ask),
    }));
    console.log(`\n  MAKEUP PLACEMENT COURT — ${table.length} catalogue asks\n`);
    for (const row of table) {
      console.log(`    ${row.placement.padEnd(10)} ${row.region.padEnd(10)} ${row.ask}`);
    }

    for (const row of table) {
      const said = row.ask.toLowerCase();
      if (/\blip|gloss|pout/.test(said)) expect(row.placement, row.ask).toBe("lips");
      else if (/eye|lash|mascara|liner|shadow/.test(said)) expect(row.placement, row.ask).toBe("eyes");
      else if (/blush|contour|bronzer|highlighter|cheek/.test(said)) expect(row.placement, row.ask).toBe("cheeks");
    }
    /* And the lip asks specifically stop claiming her whole face, which is the
       one class the walk proved was being taken. */
    const lipAsks = table.filter((row) => /\blip|gloss/.test(row.ask.toLowerCase()));
    expect(lipAsks.length).toBeGreaterThan(4);
    for (const row of lipAsks) expect(row.region, row.ask).toBe("lips");
  });
});
