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
import { anyFacetMovesAnEdge, edgeTableNames, regionNameOf } from "./maskedRefine";
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
    /* Order matters here as much as membership: `PRESENTATION_SUBJECTS` is read
       as a list by the routing bench, and a reordering that changed which
       subject a tie resolved to would be a behaviour change wearing a
       refactor's clothes. */
    expect([...PRESENTATION_SUBJECTS]).toEqual(pin.PRESENTATION_SUBJECTS);
    expect([...PLURAL_SUBJECTS]).toEqual(pin.PLURAL_SUBJECTS);
    expect([...DEPARTABLE_SUBJECTS]).toEqual(pin.DEPARTABLE_SUBJECTS);
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
