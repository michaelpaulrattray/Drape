/**
 * THE SELECTION IS THE FOUNDER'S BOUND, SO IT IS DRIVEN FROM BOTH SIDES.
 *
 * fable-876 §2 says a clause may supply ONLY facts the anchor cannot show and
 * may never re-describe the person. A selection that is too WIDE breaks the
 * bound; one that is too NARROW loses the customer's feature in silence — the
 * defect arrow 6 exists to close. Both arms are here, and the widest one is the
 * totality control: it reads the real catalogue rather than a list retyped
 * beside it.
 */
import { describe, expect, it } from "vitest";

import { catalogueSlots } from "./referenceSlotCatalogue";
import { parseSlot } from "./referenceSlots";
import {
  MAX_CARRIED_FEATURES,
  MAX_CLAUSE_CHARACTERS,
  cataloguedFeaturesWithRegion,
  composeViewFeatureWordsClause,
  regionForSlot,
  selectCarriedFeatureWords,
  type FeatureEntry,
} from "./viewFeatureWords";
import { anchorPresentsIn, type BodyAnchorRegion } from "../../shared/bodyAnchorRegions";

const entry = (over: Partial<FeatureEntry> & { slot: string }): FeatureEntry => ({
  noun: "thing",
  words: ["some words"],
  ...over,
});

/** The properties table, as this module sees it: kind → where it lives. */
const kinds = (rows: Record<string, BodyAnchorRegion>) =>
  (kind: string): BodyAnchorRegion | null => rows[kind] ?? null;

describe("the totality control — no catalogued feature can ever ride words", () => {
  it("every feature in the real catalogue has a body region here", () => {
    /*
      Read from `catalogueSlots()` rather than from a list beside it, so a
      feature added to the catalogue tomorrow arrives as a failing test. That is
      the whole reason this record exists — the outcome is identical for all of
      them today, and the day it is not, this is what says so.
    */
    const features = new Set(
      catalogueSlots().map((slot) => parseSlot(slot.slot)?.feature).filter((f): f is string => !!f),
    );
    const known = new Set(cataloguedFeaturesWithRegion());
    const missing = [...features].filter((feature) => !known.has(feature)).sort();
    expect(missing).toEqual([]);
  });

  it("and every one of those regions is one the anchor SHOWS", () => {
    /*
      The bound, stated as arithmetic over the catalogue: if any catalogued
      feature were anchored somewhere the master cannot see, this lane would
      start describing a person's face into six paid views, which is the drift
      fable-876 §2 forbids. This is the assertion that would catch it.
    */
    const hidden = cataloguedFeaturesWithRegion().filter((feature) => {
      const region = regionForSlot(feature, () => null);
      return region === null || !anchorPresentsIn(region, "master");
    });
    expect(hidden).toEqual([]);
  });

  it("a whole face's worth of catalogued slots rides NOTHING", () => {
    const entries = catalogueSlots().map((slot) => entry({ slot: slot.slot, words: ["described"] }));
    const selection = selectCarriedFeatureWords({
      entries,
      regionOf: (slot) => regionForSlot(slot, () => null),
    });
    expect(selection.carried).toEqual([]);
    expect(new Set(selection.declined.map((d) => d.reason))).toEqual(new Set(["shown"]));
  });
});

describe("what the anchor cannot show", () => {
  it("rides, with the region it was resolved at", () => {
    const selection = selectCarriedFeatureWords({
      entries: [entry({ slot: "open:tail", noun: "tail", words: ["long and scaled"] })],
      regionOf: (slot) => regionForSlot(slot, kinds({ tail: "belowWaist" })),
    });
    expect(selection.carried).toEqual([{
      slot: "open:tail",
      noun: "tail",
      words: ["long and scaled"],
      region: "belowWaist",
    }]);
  });

  it("takes a per-side open kind by the same route", () => {
    const selection = selectCarriedFeatureWords({
      entries: [entry({ slot: "open:claws@left", noun: "left claws", words: ["black talons"] })],
      regionOf: (slot) => regionForSlot(slot, kinds({ claws: "hands" })),
    });
    expect(selection.carried.map((c) => c.slot)).toEqual(["open:claws@left"]);
  });

  it("declines an open kind the anchor DOES show — wings sit on the torso", () => {
    const selection = selectCarriedFeatureWords({
      entries: [entry({ slot: "open:wings", noun: "wings", words: ["black feathered"] })],
      regionOf: (slot) => regionForSlot(slot, kinds({ wings: "torso" })),
    });
    expect(selection.carried).toEqual([]);
    expect(selection.declined).toEqual([{ slot: "open:wings", reason: "shown" }]);
  });

  it("DECLINES a feature the branch holds a crop of — the pixels carry it", () => {
    /*
      The probe's finding, as an arm (fable-1058 §2). A tail anchored below the
      waist was drawn curling up beside her shoulder and was plainly in the
      waist-up master; the crop the mint cut from that frame is the read fact
      that says so. Geometry alone said "hidden" and geometry alone was wrong.
    */
    const selection = selectCarriedFeatureWords({
      entries: [entry({ slot: "open:tail", noun: "tail", words: ["long scaled tail"], cropped: true })],
      regionOf: (slot) => regionForSlot(slot, kinds({ tail: "belowWaist" })),
    });
    expect(selection.carried).toEqual([]);
    expect(selection.declined).toEqual([{ slot: "open:tail", reason: "cropped" }]);
  });

  it("and CARRIES the same feature when the branch holds no crop of it", () => {
    /* The negative half, one field apart: without it the arm above would pass
       for a selection that had simply stopped carrying anything. */
    const selection = selectCarriedFeatureWords({
      entries: [entry({ slot: "open:tail", noun: "tail", words: ["long scaled tail"], cropped: false })],
      regionOf: (slot) => regionForSlot(slot, kinds({ tail: "belowWaist" })),
    });
    expect(selection.carried.map((feature) => feature.slot)).toEqual(["open:tail"]);
  });

  it("declines a kind nobody has answered for, rather than guessing a region", () => {
    /* The fail-closed side `readKindProperties` already chose: the cost of a
       null is that the feature carries exactly as it does today — nothing. */
    const selection = selectCarriedFeatureWords({
      entries: [entry({ slot: "open:whatsit", noun: "whatsit", words: ["indescribable"] })],
      regionOf: (slot) => regionForSlot(slot, kinds({})),
    });
    expect(selection.declined).toEqual([{ slot: "open:whatsit", reason: "regionUnknown" }]);
  });

  it("does NOT resurrect a feature she took off", () => {
    /*
      The library keeps the row when a feature is removed; the vacancy is the
      newest state. A lane that read the words underneath it would tell the
      engine about a tail the customer had just paid to have removed.
    */
    const selection = selectCarriedFeatureWords({
      entries: [entry({ slot: "open:tail", noun: "tail", words: ["long and scaled"], vacant: true })],
      regionOf: (slot) => regionForSlot(slot, kinds({ tail: "belowWaist" })),
    });
    expect(selection.carried).toEqual([]);
    expect(selection.declined).toEqual([{ slot: "open:tail", reason: "vacant" }]);
  });

  it("declines an entry whose words are blank rather than riding an empty line", () => {
    const selection = selectCarriedFeatureWords({
      entries: [entry({ slot: "open:tail", noun: "tail", words: ["", "   "] })],
      regionOf: (slot) => regionForSlot(slot, kinds({ tail: "belowWaist" })),
    });
    expect(selection.declined).toEqual([{ slot: "open:tail", reason: "noWords" }]);
  });

  it("caps the number of features and REPORTS the ones it turned away", () => {
    const entries = Array.from({ length: MAX_CARRIED_FEATURES + 2 }, (_, index) =>
      entry({ slot: `open:kind${index}`, noun: `kind${index}`, words: ["x"] }));
    const selection = selectCarriedFeatureWords({
      entries,
      regionOf: () => "belowWaist",
    });
    expect(selection.carried).toHaveLength(MAX_CARRIED_FEATURES);
    expect(selection.declined).toEqual([
      { slot: `open:kind${MAX_CARRIED_FEATURES}`, reason: "capped" },
      { slot: `open:kind${MAX_CARRIED_FEATURES + 1}`, reason: "capped" },
    ]);
  });
});

describe("the clause", () => {
  const carried = (slot: string, noun: string, words: string[]) => ({
    slot, noun, words, region: "belowWaist" as const,
  });

  it("is EMPTY for nothing carried — the inertness the bound rests on", () => {
    expect(composeViewFeatureWordsClause([])).toEqual({ clause: "", dropped: [] });
  });

  it("names each feature and states that the photograph outranks it", () => {
    const { clause } = composeViewFeatureWordsClause([
      carried("open:tail", "tail", ["a long scaled tail at the base of the spine"]),
    ]);
    expect(clause).toContain("- tail: a long scaled tail at the base of the spine");
    expect(clause).toContain("Everything the reference photograph DOES show is authoritative");
    /* Bound 3: it must not invite a re-imagining of what the pixels carry. */
    expect(clause).toContain("do not re-imagine the face, hair, skin or build from these words");
  });

  it("drops whole features to fit the character cap, and hands back what it dropped", () => {
    /*
      Never a mid-sentence cut: a fact with its end missing is worse than one
      fact fewer, and a cap that bit silently would read from outside exactly
      like a feature that was never there.
    */
    const long = "x".repeat(150);
    const input = [
      carried("open:a", "a", [long]),
      carried("open:b", "b", [long]),
      carried("open:c", "c", [long]),
    ];
    const { clause, dropped } = composeViewFeatureWordsClause(input);
    expect(clause.length).toBeLessThanOrEqual(MAX_CLAUSE_CHARACTERS);
    expect(dropped.map((d) => d.slot)).toEqual(["open:b", "open:c"]);
    expect(clause).toContain("- a: ");
    expect(clause).not.toContain("- b: ");
  });

  it("keeps ONE feature whole even when it alone exceeds the cap", () => {
    /* The alternative is an empty clause for a customer who has exactly one
       hidden feature, which loses the very thing the arrow is about. */
    const { clause, dropped } = composeViewFeatureWordsClause([
      carried("open:a", "a", ["y".repeat(MAX_CLAUSE_CHARACTERS * 2)]),
    ]);
    expect(dropped).toEqual([]);
    expect(clause.length).toBeGreaterThan(MAX_CLAUSE_CHARACTERS);
  });
});
