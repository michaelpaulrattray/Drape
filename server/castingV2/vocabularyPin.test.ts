/**
 * THE VOCABULARY, PINNED BEFORE IT MOVES (V1, fable-395's build discipline).
 *
 * V1 collapses twelve hand-maintained tables into one registration card per
 * kind. The acceptance for the whole milestone is that **nothing changes**: the
 * tables are to be DERIVED from the cards, not rewritten, and the difference
 * between those two is invisible in a diff and loud in production.
 *
 * So the contents are pinned here first, in their own file, captured from the
 * shipped tables BEFORE a single card exists — and `vocabularyPin.json` is not
 * regenerated during the refactor. A golden that is refreshed when it fails is
 * a golden that agrees with whatever it is shown.
 *
 * Read this as the answer to one question, asked of each table after every step
 * of V1: *did the contents MOVE, or did they CHANGE?* A move keeps this green.
 *
 * The four SILENT lists are pinned too, and they are the reason the milestone
 * exists (F2): `PRESENTATION_SUBJECTS`, `PLURAL_SUBJECTS`,
 * `DEPARTABLE_SUBJECTS` and `REGION_OF_FACET` decide by ABSENCE, so a kind
 * missing from all four is not undecided — it is decided invisibly four times.
 * Pinning them means the refactor cannot quietly enrol a kind in a behaviour
 * nobody asked for, which is exactly the unowned-axis class at this layer.
 */
import { describe, expect, it } from "vitest";

import pin from "./vocabularyPin.json";
import { CHANGE_AMPLITUDE } from "./changeAmplitude";
import { FACET_SLOTS } from "./referenceSlotCatalogue";
import { SUBJECT_QUALIFIER } from "./subjectQualifiers";
import { ZONE_SCOPE } from "./zoneScope";
import {
  anyFacetMovesAnEdge,
  confusableNeighboursOf,
  edgeTableNames,
  fringeTableNames,
  hasFringeAtEdge,
  neighbourTableNames,
  regionNameOf,
} from "./maskedRefine";
import {
  DEPARTABLE_SUBJECTS,
  FREE_SUBJECTS,
  FREE_SUBJECT_KIND,
  PLURAL_SUBJECTS,
  PRESENTATION_SUBJECTS,
  SUBJECT_NOUNS,
} from "./refineSubjects";

describe("the eight compile-closed tables", () => {
  it("hold exactly what they held before V1 began", () => {
    expect(FREE_SUBJECTS).toEqual(pin.FREE_SUBJECTS);
    expect(FREE_SUBJECT_KIND).toEqual(pin.FREE_SUBJECT_KIND);
    expect(SUBJECT_NOUNS).toEqual(pin.SUBJECT_NOUNS);
    expect(SUBJECT_QUALIFIER).toEqual(pin.SUBJECT_QUALIFIER);
    expect(CHANGE_AMPLITUDE).toEqual(pin.CHANGE_AMPLITUDE);
    expect(ZONE_SCOPE).toEqual(pin.ZONE_SCOPE);
    expect(FACET_SLOTS).toEqual(pin.FACET_SLOTS);
  });
});

describe("the four that decide by absence", () => {
  it("enrol exactly the kinds they enrolled before V1 began", () => {
    /*
      MEMBERSHIP for the two set-lists, and the relaxation is argued rather than
      convenient.

      Deriving them from the cards puts them in REGISTRATION order rather than
      the order somebody typed them, and the pin caught exactly that on the
      first run: `["marks", "ink", "statedAccessories"]` became `["marks",
      "statedAccessories", "ink"]`. Same three kinds, different sequence.

      Every consumer was read before this line was softened: `isPluralSubject`
      and `isDepartableSubject` are `includes`; `refineDeparture.test.ts` walks
      the departable list as independent members; `repaintAsks` cites the
      plural list for its rule, not its order; `openKindPolicy` files both
      under the heading "the four lists, WHERE MEMBERSHIP IS THE ANSWER".
      Nothing reads position.

      `PRESENTATION_SUBJECTS` keeps its exact order, because it is derived from
      an object whose key order decides which noun a lookup finds first.
    */
    expect([...PRESENTATION_SUBJECTS]).toEqual(pin.PRESENTATION_SUBJECTS);
    expect([...PLURAL_SUBJECTS].sort()).toEqual([...pin.PLURAL_SUBJECTS].sort());
    expect([...DEPARTABLE_SUBJECTS].sort()).toEqual([...pin.DEPARTABLE_SUBJECTS].sort());
    /* And the counts, so a sort cannot hide a kind quietly joining a list. */
    expect(PLURAL_SUBJECTS).toHaveLength(pin.PLURAL_SUBJECTS.length);
    expect(DEPARTABLE_SUBJECTS).toHaveLength(pin.DEPARTABLE_SUBJECTS.length);
  });

  it("send each facet to the same region, INCLUDING the eight that go nowhere", () => {
    /*
      `REGION_OF_FACET` covers 21 of 29 facets and the missing 8 fall to null by
      omission — the fourth silent decider. Pinning the nulls is the point: a
      refactor that gave one of them a region would be adding a capability, and
      a refactor that dropped one would be removing a paid path, and neither
      would show up in a table's own diff.
    */
    const regions = Object.fromEntries(
      edgeTableNames().map((facet) => [facet, regionNameOf(facet as never)]));
    expect(regions).toEqual(pin.REGION_OF_FACET);
  });
});

describe("the edge table", () => {
  it("moves exactly the edges it moved before V1 began", () => {
    const edges = Object.fromEntries(
      edgeTableNames().map((facet) => [facet, anyFacetMovesAnEdge([facet as never])]));
    expect(edges).toEqual(pin.MOVES_ITS_EDGE);
  });
});

describe("the pin itself", () => {
  it("covers every kind and facet the product has — a pin over a subset is not a pin", () => {
    /* The vacuous-zero check. If a table were emptied, every assertion above
       would pass over nothing at all. */
    expect(Object.keys(pin.FREE_SUBJECTS).length).toBe(28);
    expect(Object.keys(pin.ZONE_SCOPE).length).toBe(29);
    expect(Object.keys(pin.FREE_SUBJECTS)).toEqual(Object.keys(FREE_SUBJECTS));
    /* Sorted on both sides: `edgeTableNames()` sorts and the zone table keeps
       its authored order, and this is a question about MEMBERSHIP. */
    expect(Object.keys(pin.ZONE_SCOPE).sort()).toEqual([...edgeTableNames()].sort());
  });

  it("CAN FAIL — the comparison, driven on a table with one value moved", () => {
    /* Without this, a `toEqual` against a mis-shaped fixture could be passing
       for the wrong reason forever. */
    const tampered = { ...pin.FREE_SUBJECTS, hairCut: "HAIRCUT" };
    expect(tampered).not.toEqual(pin.FREE_SUBJECTS);
    expect(FREE_SUBJECTS).not.toEqual(tampered);
  });
});

describe("the region tables", () => {
  /*
    CAPTURED FROM THE PRE-MOVE SOURCE, not from the code that replaced it.

    These two moved onto the region card after the pin file was first written,
    so their entries were read out of `git show HEAD:maskedRefine.ts` — the
    literal as it stood before the derivation — rather than from the derivation
    itself. A golden captured from the thing it is meant to check is not one.

    They matter behaviourally: a harvest reaches past its boundary only where
    `fringe` is true, and the neighbour list decides what "territory nobody
    asked about" means at a shared edge. A silent flip here is a paid render
    tearing at an edge, which is run-6's own defect.
  */
  it("say what they said before the region card existed", () => {
    const fringe = Object.fromEntries(
      Object.keys(pin.FRINGE_AT_EDGE).map((region) => [region, hasFringeAtEdge(region)]));
    expect(fringe).toEqual(pin.FRINGE_AT_EDGE);

    const neighbours = Object.fromEntries(
      Object.keys(pin.CONFUSABLE_NEIGHBOURS)
        .map((region) => [region, [...confusableNeighboursOf(region)]]));
    expect(neighbours).toEqual(pin.CONFUSABLE_NEIGHBOURS);
  });

  it("cover every region the tables declare — a pin over a subset is not a pin", () => {
    expect(Object.keys(pin.FRINGE_AT_EDGE).sort()).toEqual([...fringeTableNames()].sort());
    expect(Object.keys(pin.CONFUSABLE_NEIGHBOURS).sort()).toEqual([...neighbourTableNames()].sort());
  });
});
