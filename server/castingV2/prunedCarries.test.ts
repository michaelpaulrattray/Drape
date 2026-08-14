/**
 * THE PRUNED CARRY, DRIVEN — V3(c) step 2.
 *
 * What is on trial is a filter that REMOVES things from a paid render's
 * reference list. The expensive mistake is not the one it was built for (a
 * pruned crop riding); it is the opposite — dropping a crop that was never
 * pruned, which takes a feature off a customer's face for free. So the
 * exemptions get more arms here than the rule does.
 */
import { describe, expect, it } from "vitest";

import { carriesAfterPruning, slotsNamedByChain } from "./prunedCarries";
import type { StoredReference } from "./referenceLibrary";

const row = (over: Partial<StoredReference> = {}): StoredReference => ({
  id: 1,
  publicId: "ref-1",
  candidateId: 9,
  variantId: 5,
  role: "carry",
  slot: "earring@left",
  tier: "item",
  noun: "left earring",
  words: ["gold hoops"],
  storageKey: "casting-v2/library/earring-left.png",
  maskKey: null,
  digest: null,
  geometry: null,
  guard: null,
  refusal: null,
  version: 1,
  retiredAt: null,
  createdAt: new Date("2026-08-14T00:00:00Z"),
  ...over,
} as StoredReference);

describe("what the surviving chain still names", () => {
  it("names every slot of a feature the chain writes", () => {
    const named = slotsNamedByChain({ free: { hairCut: "a blunt bob" } });
    expect([...named]).toContain("hair");
  });

  it("names every accessory slot when the accessories facet survives", () => {
    /*
      Generous on purpose, and the asymmetry is the argument: which KIND a step
      named is a question about its words, not its facet. Over-supporting keeps
      a crop that could have been dropped; under-supporting takes a feature off
      a customer's face.
    */
    const named = slotsNamedByChain({ free: { statedAccessories: ["gold hoop earrings"] } });
    expect([...named]).toEqual(expect.arrayContaining(["earring@left", "earring@right", "glasses"]));
  });

  it("names NOTHING for an empty chain — the case the whole filter turns on", () => {
    expect([...slotsNamedByChain({})]).toEqual([]);
  });
});

describe("a crop rides only while its ask does", () => {
  it("drops a render-minted crop the chain no longer names", () => {
    const { rows, dropped } = carriesAfterPruning({
      rows: [row()],
      composed: { free: { hairCut: "longer hair" } },
    });
    expect(rows).toEqual([]);
    expect(dropped.map((one) => one.slot)).toEqual(["earring@left"]);
  });

  it("keeps it while the chain still names it", () => {
    const { rows, dropped } = carriesAfterPruning({
      rows: [row()],
      composed: { free: { statedAccessories: ["gold hoop earrings"], hairCut: "longer hair" } },
    });
    expect(rows.map((one) => one.slot)).toEqual(["earring@left"]);
    expect(dropped).toEqual([]);
  });

  it("NEVER drops a master-minted row, whatever the chain says", () => {
    /*
      Her own glasses, catalogued from the photograph before any edit landed. No
      chain step put them there, so no chain step may take them away — that is
      the vacancy road's job, and dropping them here would delete a feature she
      arrived with because she edited her hair.
    */
    const { rows, dropped } = carriesAfterPruning({
      rows: [row({ variantId: null, slot: "glasses", noun: "glasses" })],
      composed: { free: { hairCut: "longer hair" } },
    });
    expect(rows.map((one) => one.slot)).toEqual(["glasses"]);
    expect(dropped).toEqual([]);
  });

  it("NEVER drops a slot re-cut on every render", () => {
    /* Her build is minted by the RENDER rather than by an ask, so the chain not
       naming it means nothing at all. */
    const { rows } = carriesAfterPruning({
      rows: [row({ slot: "build", tier: "anatomy", noun: "build" })],
      composed: { free: { hairCut: "longer hair" } },
    });
    expect(rows.map((one) => one.slot)).toEqual(["build"]);
  });

  it("keeps her HAIR when the earrings step is pruned — the innocent-neighbour case", () => {
    /*
      The load-bearing case, and the reason this is a derivation rather than
      "retire the rows that step created": a crop is minted from a RENDER, and
      that render answered two asks. Her hair is innocent of her earrings.
    */
    const { rows, dropped } = carriesAfterPruning({
      rows: [
        row({ id: 1, slot: "earring@left" }),
        row({ id: 2, slot: "hair", tier: "anatomy", noun: "hair", words: ["longer hair"] }),
      ],
      composed: { free: { hairCut: "longer hair" } },
    });
    expect(rows.map((one) => one.slot)).toEqual(["hair"]);
    expect(dropped.map((one) => one.slot)).toEqual(["earring@left"]);
  });

  it("changes NOTHING on an ordinary render, where the chain names what the library holds", () => {
    /*
      The negative control for the whole feature. Almost every render in
      production has a chain that still names every crop it holds, and this
      filter must be invisible there — a filter that trimmed an ordinary
      render's references would be a silent feature loss on every edit.
    */
    const rows = [
      row({ id: 1, slot: "hair", tier: "anatomy", noun: "hair" }),
      row({ id: 2, slot: "lips", tier: "anatomy", noun: "lips" }),
      row({ id: 3, variantId: null, slot: "eye@left", tier: "anatomy", noun: "left eye" }),
    ];
    const result = carriesAfterPruning({
      rows,
      composed: { free: { hairCut: "a bob", lips: "fuller" } },
    });
    expect(result.rows).toEqual(rows);
    expect(result.dropped).toEqual([]);
  });
});
