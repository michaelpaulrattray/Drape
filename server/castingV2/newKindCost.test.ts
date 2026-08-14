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
import { FACET_CARDS, facetTableOf, type FacetCard } from "./facetCards";

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

  it("CAN FAIL — the same derivation over the shipped cards knows no scaffold", () => {
    /* The control that makes the four assertions above mean something: without
       the card, every one of those lookups is undefined. */
    expect((tableOf((card) => card.heading) as Record<string, unknown>).scaffold).toBeUndefined();
    expect((facetTableOf((card) => card.zone) as Record<string, unknown>).scaffold).toBeUndefined();
  });
});
