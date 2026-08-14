/**
 * V1'S ACCEPTANCE: ADDING A KIND IS ONE FILE (the review's own bar).
 *
 * F5 measured the old cost — a free subject touched eight compile-closed tables
 * plus four lists that decided by absence, and 4–5 prose sites no test closed.
 * The claim now is that a kind is one card, and this is where that claim is
 * checked rather than asserted in a commit message.
 *
 * # How a scaffold kind is added without adding one
 *
 * The real registries are frozen literals, so this drives the DERIVATION over a
 * card set that includes a scaffold. That is the honest test of the claim: the
 * views are `tableOf`/`subjectsWhere` over whatever cards exist, so if they
 * answer for a kind that was never mentioned anywhere else, one card is
 * genuinely enough.
 */
import { describe, expect, it } from "vitest";

import {
  SUBJECT_CARDS,
  subjectsWhere,
  tableOf,
  type SubjectCard,
} from "./subjectCards";
import {
  FACET_CARDS,
  PRESERVATION_CATEGORIES,
  facetTableOf,
  type FacetCard,
} from "./facetCards";
import {
  REGION_CARDS,
  REGION_CARD_ENTRIES,
  regionTableOf,
  type RegionCard,
} from "./regionCards";

/** A kind nobody has catalogued, answering all eight questions. */
const SCAFFOLD: SubjectCard = {
  heading: "SCAFFOLD",
  kind: "degree",
  nouns: ["scaffold"],
  qualifier: { describe: ", as a scaffold" },
  amplitude: { levels: 10, basis: { reasoned: "a scaffold for the acceptance test" } },
  plural: false,
  departable: false,
  presentationNoun: null,
};

const SCAFFOLD_FACET: FacetCard = {
  zone: "fullFrame",
  slot: { notASlot: "a scaffold has no home in the library" },
  region: null,
  movesItsEdge: { moves: false, why: "a scaffold moves nothing" },
  naming: { shape: "hers" },
  preservation: { category: "boneStructure", phrase: "the same scaffold" },
};

describe("one card is enough", () => {
  /* The same derivation the shipped tables use, over a card set with one more. */
  const cards = { ...SUBJECT_CARDS, scaffold: SCAFFOLD };
  const entries = Object.entries(cards) as ReadonlyArray<readonly [string, SubjectCard]>;
  const derive = <T>(read: (card: SubjectCard) => T) =>
    Object.fromEntries(entries.map(([name, card]) => [name, read(card)]));

  it("answers every subject-keyed table for a kind nothing else has heard of", () => {
    const reads: ReadonlyArray<readonly [string, (card: SubjectCard) => unknown]> = [
      ["FREE_SUBJECTS", (card) => card.heading],
      ["FREE_SUBJECT_KIND", (card) => card.kind],
      ["SUBJECT_NOUNS", (card) => card.nouns],
      ["SUBJECT_QUALIFIER", (card) => card.qualifier],
      ["CHANGE_AMPLITUDE", (card) => card.amplitude],
    ];
    for (const [table, read] of reads) {
      const derived = derive(read) as Record<string, unknown>;
      expect(derived.scaffold, table).toBeDefined();
    }
  });

  it("answers the three enrolment lists by the card's own written decisions", () => {
    const plural = entries.filter(([, card]) => card.plural).map(([name]) => name);
    const departable = entries.filter(([, card]) => card.departable).map(([name]) => name);
    const presentation = entries.filter(([, card]) => card.presentationNoun !== null)
      .map(([name]) => name);
    /* Not in any of them — and that is now a WRITTEN no rather than a silence
       that three lists would each have read as their own default. */
    expect(plural).not.toContain("scaffold");
    expect(departable).not.toContain("scaffold");
    expect(presentation).not.toContain("scaffold");
  });

  it("enrols the scaffold the moment its card says so, and nowhere else", () => {
    const enrolled = { ...SUBJECT_CARDS, scaffold: { ...SCAFFOLD, plural: true } };
    const plural = Object.entries(enrolled).filter(([, card]) => card.plural).map(([name]) => name);
    expect(plural).toContain("scaffold");
    /* One field, one list. Nothing else moved. */
    const departable = Object.entries(enrolled)
      .filter(([, card]) => card.departable).map(([name]) => name);
    expect(departable).toEqual(subjectsWhere((card) => card.departable));
  });

  it("answers every facet-keyed table for a scaffold facet", () => {
    const facets = { ...FACET_CARDS, scaffold: SCAFFOLD_FACET };
    const entriesOf = Object.entries(facets) as ReadonlyArray<readonly [string, FacetCard]>;
    const deriveFacet = <T>(read: (card: FacetCard) => T) =>
      Object.fromEntries(entriesOf.map(([name, card]) => [name, read(card)])) as Record<string, T>;

    expect(deriveFacet((card) => card.zone).scaffold).toBe("fullFrame");
    expect(deriveFacet((card) => card.slot).scaffold).toEqual(SCAFFOLD_FACET.slot);
    expect(deriveFacet((card) => card.movesItsEdge).scaffold.moves).toBe(false);
    /* `region: null` is an answer: no masked path, stated rather than absent. */
    expect(deriveFacet((card) => card.region).scaffold).toBeNull();
  });

  it("answers the two WORD tables that used to be edited by hand", () => {
    /*
      MEASURED, not assumed. A scaffold face slot was added to all three
      registries and the suite named every remaining hand-site: the preservation
      tail had no phrase for the new facet, and the panel had no name for it —
      two more tables keyed on the vocabulary, both of them prose a customer
      reads. Both are views over the card now, so the same scaffold answers.
    */
    const facets = { ...FACET_CARDS, scaffold: SCAFFOLD_FACET };
    const entriesOf = Object.entries(facets) as ReadonlyArray<readonly [string, FacetCard]>;

    const naming = Object.fromEntries(entriesOf
      .filter(([, card]) => card.naming !== null)
      .map(([facet, card]) => [facet, card.naming]));
    expect(naming.scaffold).toEqual(SCAFFOLD_FACET.naming);

    const category = SCAFFOLD_FACET.preservation.category;
    const siblings = entriesOf
      .filter(([, card]) => card.preservation.category === category)
      .map(([facet]) => facet);
    expect(siblings).toContain("scaffold");
    /* And the category it joins is one the tail actually speaks. */
    expect(Object.keys(PRESERVATION_CATEGORIES)).toContain(category);
  });

  it("CAN FAIL — the same derivation over the shipped cards knows no scaffold", () => {
    /* The control that makes the four assertions above mean something: without
       the card, every one of those lookups is undefined. */
    expect((tableOf((card) => card.heading) as Record<string, unknown>).scaffold).toBeUndefined();
    expect((facetTableOf((card) => card.zone) as Record<string, unknown>).scaffold).toBeUndefined();
  });
});

/**
 * AND THE SAME QUESTION FOR AN ACCESSORY KIND (V1's other half).
 *
 * F5 measured the old cost: ~4 mandatory tables, a pair noun, two measurement
 * courts, a completeness specimen and 4–5 prose sites no test closed. Measured
 * again with a scaffold kind — a `choker` — the suite named exactly TWO source
 * sites, and both were facts about the REGION rather than the kind: whether its
 * material has fringe at the edge, and which regions its boundary is confused
 * with. Both are on the region card now, so a new kind is its accessory entry
 * plus its region card.
 */
describe("an accessory kind is its entry and its region", () => {
  const SCAFFOLD_REGION: RegionCard = {
    fringe: { at: false, why: "a scaffold has a solid edge" },
    neighbours: { with: ["hair"], why: "hair falls over everything" },
  };

  it("answers both region tables for a region nothing else has heard of", () => {
    const regions = { ...REGION_CARDS, scaffold: SCAFFOLD_REGION };
    const entries = Object.entries(regions) as ReadonlyArray<readonly [string, RegionCard]>;
    const derive = <T>(read: (card: RegionCard) => T) =>
      Object.fromEntries(entries.map(([region, card]) => [region, read(card)])) as Record<string, T>;

    expect(derive((card) => card.fringe.at).scaffold).toBe(false);
    expect(derive((card) => card.neighbours.with).scaffold).toEqual(["hair"]);
    /* And the phrasing is OPTIONAL — a region whose key is already the words
       sent carries no `askedAs`, which is every region but one. */
    expect(derive((card) => card.askedAs).scaffold).toBeUndefined();
  });

  it("CAN FAIL — the shipped regions know no scaffold", () => {
    expect((regionTableOf((card) => card.fringe) as Record<string, unknown>).scaffold)
      .toBeUndefined();
  });

  it("keeps a MEASURED phrasing wherever one was bought", () => {
    /* The lips reading is the only one so far, and it is data rather than a
       comment precisely so this can be asserted rather than read. */
    const measured = REGION_CARD_ENTRIES.filter(([, card]) => card.askedAs !== undefined);
    expect(measured.length).toBeGreaterThan(0);
    for (const [region, card] of measured) {
      expect(card.askedAs!.measured.length, region).toBeGreaterThanOrEqual(3);
      expect(card.askedAs!.words.length, region).toBeGreaterThan(0);
    }
  });
});
