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

/**
 * WHAT HAS BEEN ADDED SINCE THE PIN WAS TAKEN — declared here, and nowhere else.
 *
 * The pin's question is *did the contents MOVE, or did they CHANGE?* A
 * deliberate ADDITION is a third thing, and it must not be answerable by
 * regenerating the golden — that is the habit this file exists to refuse.
 *
 * So every assertion below compares the PINNED keys and nothing else, and a
 * separate assertion says the set of new keys is exactly this list. An addition
 * nobody declared reddens; a pinned value that drifts still reddens; and the
 * golden is never rewritten to agree with the code.
 *
 *   horns     promoted 2026-08-14 off four measurement courts (fable-525 §3,
 *             `docs/specs/V2_HORNS_VERDICT.md`) — one subject, one facet.
 *   wardrobe  item 8, 2026-08-23 — the Two Paths ruling's refine half
 *             (`CASTING_V2_TWO_PATHS_DESIGN.md` §7.1, countersigned
 *             fable-1334). It is the first subject a PATH can refuse, and the
 *             wall it opens was never this vocabulary's: the census measured
 *             *"put him in a plain black tee"* landing on `wall_unbacked`
 *             because `tee` is in no lexicon at all. A missing slot was the
 *             wall; a slot is what opens it.
 */
const ADDED_SUBJECTS = ["horns", "wardrobe"];
const ADDED_FACETS = ["horns", "wardrobe"];

/**
 * WHAT HAS CHANGED VALUE SINCE THE PIN — the third thing, declared the same way.
 *
 * The header's question is *did the contents MOVE, or did they CHANGE?*, and
 * the ADDED lists above answer a third case the pin met later: a key nobody had
 * when it was taken. This is the fourth: a key whose PINNED VALUE was
 * deliberately replaced.
 *
 * It is not a licence, and the shape is what keeps it from becoming one. The
 * golden is still never rewritten — `vocabularyPin.json` holds what `ink` held
 * before, untouched — and the new value is pinned HERE, in full. So the change
 * is recorded twice, from and to, and **a SECOND change to the same key
 * reddens exactly as the first one did**. A bare exclusion list would have made
 * this key free forever after one edit, which is the failure mode a golden
 * that agrees with whatever it is shown has, arrived at by a different road.
 *
 *   ink   `notASlot` → `{ perPlacement: "ink" }`, 2026-08-20, ruled fable-1146
 *         §2 on the build in fable-1137 §2. The `notASlot` reason had been the
 *         SPECIFICATION of the ink lane rather than a refusal of it — one slot
 *         per placement, its question from the placement — and the lane was
 *         built. The reason itself was not deleted: it rides verbatim in
 *         `FacetAssignment`'s `perPlacement` docblock, with its own arm in
 *         `referenceSlotCatalogue.test.ts` reading it off the source.
 */
const CHANGED_FACET_SLOTS: Record<string, unknown> = {
  /* Shape countersigned fable-1137 §2; the assignment approved fable-1146 §1;
     the fence string released fable-1146 §2. Cited on the entry rather than
     only in the note above, because a pinned change without its warrant beside
     it is half a record — the next person to read this line is deciding whether
     the change was authorised, and that answer must not be one scroll away. */
  ink: { perPlacement: "ink" },
};

/** The pinned part of a table: what the golden actually has an opinion about. */
function pinnedPart(
  table: Record<string, unknown>,
  added: readonly string[],
  changed: readonly string[] = [],
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(table).filter(
    ([key]) => !added.includes(key) && !changed.includes(key),
  ));
}

/** The pinned entries a declared change removed from comparison, as they are
 *  NOW — so the declaration is a pin of its own rather than a hole. */
function changedPart(
  table: Record<string, unknown>,
  changed: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(table).filter(([key]) => key in changed));
}

/** A list with the declared additions removed, IN ITS OWN ORDER — for the one
 *  pinned list whose order is load-bearing. */
function withoutAddedInOrder(list: readonly string[]): string[] {
  return list.filter((subject) => !ADDED_SUBJECTS.includes(subject));
}

/** The keys a table has gained since the pin, sorted. */
function addedPart(table: Record<string, unknown>, pinned: Record<string, unknown>): string[] {
  return Object.keys(table).filter((key) => !(key in pinned)).sort();
}

describe("the eight compile-closed tables", () => {
  it("hold exactly what they held before V1 began", () => {
    expect(pinnedPart(FREE_SUBJECTS, ADDED_SUBJECTS)).toEqual(pin.FREE_SUBJECTS);
    expect(pinnedPart(FREE_SUBJECT_KIND, ADDED_SUBJECTS)).toEqual(pin.FREE_SUBJECT_KIND);
    expect(pinnedPart(SUBJECT_NOUNS, ADDED_SUBJECTS)).toEqual(pin.SUBJECT_NOUNS);
    expect(pinnedPart(SUBJECT_QUALIFIER, ADDED_SUBJECTS)).toEqual(pin.SUBJECT_QUALIFIER);
    expect(pinnedPart(CHANGE_AMPLITUDE, ADDED_SUBJECTS)).toEqual(pin.CHANGE_AMPLITUDE);
    expect(pinnedPart(ZONE_SCOPE, ADDED_FACETS)).toEqual(pin.ZONE_SCOPE);
    expect(pinnedPart(FACET_SLOTS, ADDED_FACETS, Object.keys(CHANGED_FACET_SLOTS)))
      .toEqual(pinnedPart(pin.FACET_SLOTS, [], Object.keys(CHANGED_FACET_SLOTS)));
  });

  /*
    AND THE ONE VALUE SOMEBODY DELIBERATELY REPLACED IS PINNED TOO.

    Without this the declaration above would be a hole: `ink` would be excluded
    from the golden's comparison and compared to nothing, so the next edit to it
    would pass in silence. Here it is compared to the value the ruling put
    there, which is the pin doing its job one layer along.
  */
  it("hold the one value a ruling replaced, exactly as the ruling left it", () => {
    expect(changedPart(FACET_SLOTS, CHANGED_FACET_SLOTS)).toEqual(CHANGED_FACET_SLOTS);
    /* And the golden is untouched — it still holds what it held, which is the
       whole reason a change can be told from a regenerated agreement. */
    expect(pin.FACET_SLOTS).toHaveProperty("ink.notASlot");
  });

  it("have gained exactly the kinds somebody declared, and no others", () => {
    /*
      The other half of the relaxation above, and the half that makes it safe. A
      kind that arrives without being named here is indistinguishable from a
      kind that arrived by accident, which is precisely what the pin was for.
    */
    expect(addedPart(FREE_SUBJECTS, pin.FREE_SUBJECTS)).toEqual([...ADDED_SUBJECTS].sort());
    expect(addedPart(FREE_SUBJECT_KIND, pin.FREE_SUBJECT_KIND)).toEqual([...ADDED_SUBJECTS].sort());
    expect(addedPart(SUBJECT_NOUNS, pin.SUBJECT_NOUNS)).toEqual([...ADDED_SUBJECTS].sort());
    expect(addedPart(SUBJECT_QUALIFIER, pin.SUBJECT_QUALIFIER)).toEqual([...ADDED_SUBJECTS].sort());
    expect(addedPart(CHANGE_AMPLITUDE, pin.CHANGE_AMPLITUDE)).toEqual([...ADDED_SUBJECTS].sort());
    expect(addedPart(ZONE_SCOPE, pin.ZONE_SCOPE)).toEqual([...ADDED_FACETS].sort());
    expect(addedPart(FACET_SLOTS, pin.FACET_SLOTS)).toEqual([...ADDED_FACETS].sort());
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
    /*
      ⚠ PRESENTATION_SUBJECTS gained one and the order rule still holds — the
      pin is compared as a PREFIX rather than softened to a sort, because the
      reason it keeps its order has not changed: a lookup walks it and takes the
      first noun that matches.

      `wardrobe` is registered LAST (item 8, 2026-08-23), so every pinned
      position is where it was and the new member cannot displace one. A card
      inserted ahead of another would still redden this, which is the property
      worth keeping.
    */
    expect(PRESENTATION_SUBJECTS.slice(0, pin.PRESENTATION_SUBJECTS.length))
      .toEqual(pin.PRESENTATION_SUBJECTS);
    expect(withoutAddedInOrder(PRESENTATION_SUBJECTS)).toEqual(pin.PRESENTATION_SUBJECTS);
    const withoutAdded = (list: readonly string[]) =>
      list.filter((subject) => !ADDED_SUBJECTS.includes(subject)).sort();
    expect(withoutAdded(PLURAL_SUBJECTS)).toEqual([...pin.PLURAL_SUBJECTS].sort());
    expect(withoutAdded(DEPARTABLE_SUBJECTS)).toEqual([...pin.DEPARTABLE_SUBJECTS].sort());
    /* And the counts, so a sort cannot hide a kind quietly joining a list.
       Horns enrols in BOTH, and both are measurements rather than guesses: a
       pair is one ask (plural), and the removal court bought 3/3 gone and 3/3
       clean on two roads (departable). */
    expect(PLURAL_SUBJECTS).toHaveLength(pin.PLURAL_SUBJECTS.length + 1);
    expect(DEPARTABLE_SUBJECTS).toHaveLength(pin.DEPARTABLE_SUBJECTS.length + 1);
    expect([...PLURAL_SUBJECTS]).toContain("horns");
    expect([...DEPARTABLE_SUBJECTS]).toContain("horns");
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
    expect(pinnedPart(regions, ADDED_FACETS)).toEqual(pin.REGION_OF_FACET);
    /* And the added one's answer, written out rather than inherited: horns has
       NO region, which is a decision about the cutting vocabulary and not a
       statement that the segmenter cannot see them. */
    expect(regions.horns).toBeNull();
  });
});

describe("the edge table", () => {
  it("moves exactly the edges it moved before V1 began", () => {
    const edges = Object.fromEntries(
      edgeTableNames().map((facet) => [facet, anyFacetMovesAnEdge([facet as never])]));
    expect(pinnedPart(edges, ADDED_FACETS)).toEqual(pin.MOVES_ITS_EDGE);
    expect(edges.horns).toBe(true);
  });
});

describe("the pin itself", () => {
  it("covers every kind and facet the product has — a pin over a subset is not a pin", () => {
    /* The vacuous-zero check. If a table were emptied, every assertion above
       would pass over nothing at all. */
    expect(Object.keys(pin.FREE_SUBJECTS).length).toBe(28);
    expect(Object.keys(pin.ZONE_SCOPE).length).toBe(29);
    expect(Object.keys(pin.FREE_SUBJECTS)).toEqual(
      Object.keys(FREE_SUBJECTS).filter((subject) => !ADDED_SUBJECTS.includes(subject)));
    /* Sorted on both sides: `edgeTableNames()` sorts and the zone table keeps
       its authored order, and this is a question about MEMBERSHIP. */
    expect(Object.keys(pin.ZONE_SCOPE).sort()).toEqual(
      [...edgeTableNames()].filter((facet) => !ADDED_FACETS.includes(facet)).sort());
    /* And the additions are present in the live table, so this check cannot
       pass by the new facet being missing from both sides. */
    for (const facet of ADDED_FACETS) expect([...edgeTableNames()]).toContain(facet);
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
