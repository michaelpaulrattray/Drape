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

/**
 * AN OPEN KIND IS NAMED BY THE CHAIN TOO — the 5b defect, driven (fable-900 §2a).
 *
 * # The specimen, and it was a paid render
 *
 * 5b minted the first crop this product has ever held for an uncatalogued word:
 * a halo, on dev candidate #375. The very next edit — *"give her copper hair"* —
 * dispatched **one reference, the master**, and the service's own log said why:
 * `dropped: ["open:halo"]` · *"a crop stopped riding because the chain no longer
 * asks for it"*. The delivered frame had no halo at all, charged and unrefused.
 *
 * # The cause is a DERIVATION, which is why these arms are here and not there
 *
 * `slotsNamedByChain` built its set from `facetsWrittenBy(composed)` — facets
 * only — and an open kind has no facet. So `open:<kind>` could never be named,
 * the row is not master-minted and not re-minted every render, and every open
 * kind's crop was dropped on every subsequent render **by construction**.
 *
 * Two answers to *what does this recipe name*, one derived from facets and one
 * living in `delta.open`, with the second invisible to the first (working law 4).
 * These arms were written RED, before the fix, and they fail on the old
 * derivation for exactly the reason the paid render did.
 */
describe("an open kind's crop rides while the chain still carries it", () => {
  it("names the open slot of a kind the composed delta holds", () => {
    const named = slotsNamedByChain({ open: { halo: { noun: "halo", words: "a halo" } } });
    expect([...named]).toContain("open:halo");
  });

  it("names it BESIDE the facets, never instead of them", () => {
    /* The composed delta of the specimen render: an open kind carried from an
       earlier step and a closed facet written by this one. */
    const named = slotsNamedByChain({
      open: { halo: { noun: "halo", words: "a halo" } },
      /* `hairColour` is a top-level AXIS, not a free subject — this is the walk's
         own composed delta, copied from the row rather than invented. */
      hairColour: "copper",
    });
    expect([...named]).toContain("open:halo");
    expect([...named]).toContain("hair");
  });

  it("KEEPS a minted open-kind crop while the chain carries the kind", () => {
    /* The regression arm for the paid render. `variantId` is non-null — the crop
       was minted by a variant, not the master — so no exemption saves it and the
       naming is the only thing that can. */
    const halo = row({ slot: "open:halo", noun: "halo", words: ["a halo"], variantId: 455 });
    const { rows, dropped } = carriesAfterPruning({
      rows: [halo],
      composed: { open: { halo: { noun: "halo", words: "a halo" } }, hairColour: "copper" },
    });
    expect(dropped).toEqual([]);
    expect(rows.map((one) => one.slot)).toEqual(["open:halo"]);
  });

  it("still DROPS an open-kind crop the chain no longer carries", () => {
    /* The negative control, and it is what keeps the fix from being "never drop
       an open kind": removing the step that added the halo must still take its
       crop off the next render, exactly as it does for a closed feature. Without
       this arm the fix would be indistinguishable from an exemption. */
    const halo = row({ slot: "open:halo", noun: "halo", words: ["a halo"], variantId: 455 });
    const { rows, dropped } = carriesAfterPruning({
      rows: [halo],
      composed: { hairColour: "copper" },
    });
    expect(rows).toEqual([]);
    expect(dropped.map((one) => one.slot)).toEqual(["open:halo"]);
  });

  it("names nothing for a malformed open key", () => {
    /* `readOpenKinds` refuses a spaced key on the way in, so this should be
       unreachable — and a key the catalogue cannot resolve must not enter the
       named set, because `parseSlot` refuses it at the library door and a name
       nothing can file is a name that hides a mismatch. */
    const named = slotsNamedByChain({ open: { "cat ears": { noun: "cat ears", words: "pointed cat ears" } } });
    expect([...named].filter((slot) => slot.startsWith("open:"))).toEqual([]);
  });
});

/**
 * A DISTRIBUTED KIND IS TWO ROWS, AND BOTH OF THEM ARE NAMED — the D1 wire
 * (founder ruling fable-987 §1, shape ruled fable-1001).
 *
 * # Why the rows are per-side at all
 *
 * `wings` is `distributed` under the locality class (fable-951): the instances
 * sit on opposite sides and one crop cannot hold both. The union of the two
 * would be a rectangle spanning her whole torso filed as her wings — the
 * wrong-boundary class — and the completeness guard cannot even fail it, since
 * its own read finds ONE wing and any rectangle containing that wing scores
 * 1.0. So a distributed kind mints the earring architecture instead: one row
 * per side, each honestly a picture of what its name says.
 *
 * # And that is exactly where the carry drop lives
 *
 * The chain names an open kind through `openSlotKey(kind)` — `open:wings` — and
 * a row filed under `open:wings@left` is a DIFFERENT STRING. Two answers to
 * *what does this recipe name* with the second invisible to the first, which is
 * the same shape as the halo that vanished off a paid render in 5b, one door
 * along. These arms are written RED against the wire, per fable-1001 §3.
 */
describe("a DISTRIBUTED open kind's two crops both ride (D1 wire)", () => {
  const wings = { open: { wings: { noun: "wings", words: "large black feathered wings" } } };

  it("names BOTH sides of a distributed kind the composed delta holds", () => {
    const named = slotsNamedByChain(wings);
    expect([...named]).toContain("open:wings@left");
    expect([...named]).toContain("open:wings@right");
  });

  it("still names the sideless key, because the locality is not known here", () => {
    /*
      This module reads a DELTA, and a delta says which kinds the chain carries
      and never where their instances sit — the locality lives in the property
      store, one read away. So the naming is deliberately generous in the
      direction the module already documents: name the sideless key and both
      sides, and let the mint decide which of the three it ever files under.
      Over-supporting keeps a crop that could have been dropped; under-supporting
      takes a feature off a customer's face.
    */
    expect([...slotsNamedByChain(wings)]).toContain("open:wings");
  });

  it("KEEPS both per-side crops while the chain carries the kind", () => {
    const left = row({ slot: "open:wings@left", noun: "wings", words: ["a black wing"], variantId: 461 });
    const right = row({ slot: "open:wings@right", noun: "wings", words: ["a black wing"], variantId: 461 });
    const { rows, dropped } = carriesAfterPruning({
      rows: [left, right],
      composed: { ...wings, hairColour: "copper" },
    });
    expect(dropped).toEqual([]);
    expect(rows.map((one) => one.slot)).toEqual(["open:wings@left", "open:wings@right"]);
  });

  it("still DROPS both when the chain no longer carries the kind", () => {
    /* The negative control, and it is the arm that keeps the fix from being an
       exemption for anything spelled `open:…@…`. Remove the step that asked for
       wings and BOTH crops come off the next render. */
    const left = row({ slot: "open:wings@left", noun: "wings", words: ["a black wing"], variantId: 461 });
    const right = row({ slot: "open:wings@right", noun: "wings", words: ["a black wing"], variantId: 461 });
    const { rows, dropped } = carriesAfterPruning({
      rows: [left, right],
      composed: { hairColour: "copper" },
    });
    expect(rows).toEqual([]);
    expect(dropped.map((one) => one.slot)).toEqual(["open:wings@left", "open:wings@right"]);
  });

  it("names no side for a malformed open key", () => {
    /* The same door the sideless arm guards: a key the catalogue cannot resolve
       must not enter the named set wearing a side either. */
    const named = slotsNamedByChain({ open: { "cat ears": { noun: "cat ears", words: "pointed cat ears" } } });
    expect([...named]).toEqual([]);
  });
});
