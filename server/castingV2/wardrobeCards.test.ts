/**
 * THE WARDROBE SECTION — the split, the path condition, and the row (§8.1).
 *
 * The wire-side negative that ASK 1 made a condition of this landing lives
 * next door in `wardrobeCardsAreDisplayOnly.test.ts`, because it is about a
 * different artifact: this file is about what the panel SAYS, and that one is
 * about what an engine is HANDED.
 */
import { describe, expect, it } from "vitest";

import { facePanel, PANEL_GROUPS } from "./facePanel";
import { pronounsForSex } from "./castPronouns";
import { HOUSE_WARDROBE_LINE, basicsWardrobeLine } from "./wardrobeLine";
import type { WardrobeResolution } from "./wardrobeLine";
import { wardrobePanelPieces, wardrobePieces, wardrobeSectionServed } from "./wardrobeCards";

const born = (path: "wardrobe" | "basics", line: string): WardrobeResolution =>
  ({ kind: "line", line, source: "born", path });

const panelFor = (wardrobe: WardrobeResolution | null) => facePanel({
  rows: [],
  pronouns: pronounsForSex("female"),
  contentUrl: (key) => `https://example.test/${key}`,
  maskUrl: (key) => `https://example.test/${key}`,
  wardrobe,
});

const wardrobeSectionOf = (wardrobe: WardrobeResolution | null) =>
  panelFor(wardrobe).groups.find((group) => group.group === "wardrobe") ?? null;

describe("the split is the join read backwards, and nothing else", () => {
  it("takes the house line apart into its three pieces", () => {
    expect(wardrobePieces(HOUSE_WARDROBE_LINE).map((one) => one.phrase)).toEqual([
      "a plain unbranded crew-neck tee in neutral grey",
      "plain straight-leg trousers in the same neutral grey",
      /* ⚠ WITHOUT the conjunction. The naive inverse of the join yields "and
         plain unbranded low shoes", which is the product putting a conjunction
         on a label. */
      "plain unbranded low shoes",
    ]);
  });

  it("⚠ strips `and` only at the START and only as a whole word", () => {
    /* The trap: a stripper that reached inside a phrase would eat the
       conjunction out of a real garment description. */
    expect(wardrobePieces("a black and white striped shirt, plain shoes")
      .map((one) => one.phrase))
      .toEqual(["a black and white striped shirt", "plain shoes"]);
    expect(wardrobePieces("a shirt, and boots").map((one) => one.phrase))
      .toEqual(["a shirt", "boots"]);
    /* And a word that merely BEGINS with the letters is untouched — "android"
       is not a conjunction, and a substring test would have said it was. */
    expect(wardrobePieces("an androgynous grey suit").map((one) => one.phrase))
      .toEqual(["an androgynous grey suit"]);
  });

  it("⚠ `bare chested` and `barefoot` ARE pieces — no taxonomy decides otherwise", () => {
    /*
      Ruled fable-1459 ASK 1, and it is the arm that stops a
      counts-as-a-garment rule creeping back in. They are not garments; they are
      what this person is wearing there, which is nothing, and that is a true
      and useful thing for a panel to say.
    */
    expect(wardrobePieces(basicsWardrobeLine("male")).map((one) => one.phrase))
      .toEqual(["bare chested", "in plain black fitted shorts", "barefoot"]);
  });

  it("drops nothing for failing a definition, and drops blanks", () => {
    /* Every non-blank fragment is a piece, whatever it says. A blank one is
       not: a row with nothing in it is a promise of a picture that does not
       exist. */
    expect(wardrobePieces("a tunic, , plain sandals").map((one) => one.phrase))
      .toEqual(["a tunic", "plain sandals"]);
    expect(wardrobePieces("")).toEqual([]);
    expect(wardrobePieces("   ")).toEqual([]);
    expect(wardrobePieces(null)).toEqual([]);
    expect(wardrobePieces(undefined)).toEqual([]);
  });

  it("⚠ ROUND-TRIPS a line that was composed from a list", () => {
    /*
      The whole argument for this split rule rather than a cleverer one:
      `editedWardrobeLine` joins free-lane items with ", ", so the inverse of
      that join cannot disagree with it. Written as a real round trip rather
      than as a claim about the separator.
    */
    const items = ["a dark canvas work jacket", "straight jeans", "plain boots"];
    expect(wardrobePieces(items.join(", ")).map((one) => one.phrase)).toEqual(items);
  });

  it("numbers the pieces by position, and by nothing else", () => {
    expect(wardrobePieces("a tunic, plain sandals").map((one) => one.index)).toEqual([0, 1]);
  });
});

describe("⚠ which paths get a wardrobe section — all three values, out loud", () => {
  it("serves the Wardrobe path and refuses the other two", () => {
    /*
      The third question (fable-1459 ASK 3). `basics` is refused because §7.2
      walls an outfit ask in its own words, so a tappable card there is D-180's
      dead end wearing a tap target; `unpathed` is refused because a path nobody
      chose is not a path that dresses anyone — and it is EVERY roll in both
      worlds, so serving it would be live behaviour on a dark feature.
    */
    expect(wardrobeSectionServed("wardrobe")).toBe(true);
    expect(wardrobeSectionServed("basics")).toBe(false);
    expect(wardrobeSectionServed(null)).toBe(false);
    expect(wardrobeSectionServed(undefined)).toBe(false);
  });

  it("draws nothing for `unpathed`, `incoherent` or a Basics line", () => {
    expect(wardrobePanelPieces({ kind: "unpathed" })).toEqual([]);
    expect(wardrobePanelPieces({ kind: "incoherent", path: "wardrobe" })).toEqual([]);
    expect(wardrobePanelPieces(born("basics", basicsWardrobeLine(null)))).toEqual([]);
    expect(wardrobePanelPieces(null)).toEqual([]);
    expect(wardrobePanelPieces(undefined)).toEqual([]);
    /* CONTROL — the same function DOES answer for the path it serves, so the
       five empties above are a fact about the paths and not about the reader. */
    expect(wardrobePanelPieces(born("wardrobe", HOUSE_WARDROBE_LINE))).toHaveLength(3);
  });
});

describe("the section on the panel", () => {
  it("⚠ IS ABSENT on an unpathed cast — every roll in both worlds today", () => {
    expect(wardrobeSectionOf({ kind: "unpathed" })).toBeNull();
    expect(wardrobeSectionOf(null)).toBeNull();
    /* And the panel it produces is the panel that shipped: no group of any kind
       appears for a face with no rows, which is the state this section must not
       disturb. */
    expect(panelFor(null).groups).toEqual([]);
  });

  it("draws one row per piece, in the line's own order", () => {
    const section = wardrobeSectionOf(born("wardrobe", HOUSE_WARDROBE_LINE));
    expect(section?.heading).toBe("Wardrobe");
    expect(section?.rows.map((row) => row.name)).toEqual([
      /* Her words, with the ENUMERATION'S article taken off the front and the
         first letter raised — de-listing, not re-wording. */
      "Plain unbranded crew-neck tee in neutral grey",
      "Plain straight-leg trousers in the same neutral grey",
      "Plain unbranded low shoes",
    ]);
  });

  it("⚠ says no possessive — this is not part of the person", () => {
    /*
      fable-1312's *never mixed with body features*, reaching the grammar.
      Every other row on this panel says "her" something because every other row
      IS her.
    */
    const section = wardrobeSectionOf(born("wardrobe", HOUSE_WARDROBE_LINE));
    for (const row of section?.rows ?? []) {
      expect(row.spoken, row.name).not.toMatch(/\bher\b/i);
      expect(row.prefill, row.name).not.toMatch(/\bher\b/i);
    }
    /* CONTROL — the possessive really is what the rest of the panel uses, so
       the absence above is a decision rather than a field nobody set. */
    expect(panelFor(null).possessive).toBe("her");
  });

  it("opens the ask the way every other row does", () => {
    const section = wardrobeSectionOf(born("wardrobe", "a red apron, dark jeans, plain shoes"));
    expect(section?.rows[0]?.prefill).toBe("Red apron — ");
  });

  it("⚠ carries NO picture and NO rectangle, and is drawn anyway", () => {
    /*
      The panel's oldest rule is *no box, no row*, because a rectangle is a
      promise about pixels. A wardrobe row makes no such promise: nothing has
      read this frame for a garment (that is 8B), so it has no crop and no
      region — and it must still appear, or the panel forgets what she is
      wearing because it could not photograph it.
    */
    const section = wardrobeSectionOf(born("wardrobe", HOUSE_WARDROBE_LINE));
    expect(section?.rows).toHaveLength(3);
    for (const row of section?.rows ?? []) {
      expect(row.cutouts).toEqual([]);
      expect(row.regions).toEqual([]);
      expect(row.instances).toEqual([]);
      /* SETTLED and never pending: a pending row is a place kept for a read
         that is running, and no read is running for a garment. */
      expect(row.state).toBe("settled");
      /* No words underneath the label — the phrase IS the row, and repeating it
         would be the row's own name pretending to be a reading of the frame. */
      expect(row.words).toEqual([]);
    }
  });

  it("⚠ keys each row by POSITION, never by her phrase", () => {
    /*
      A key spelled out of a customer's words looks exactly like a key that
      meant something. These name no library slot, no facet and no region — they
      exist so a list has stable keys and so hovering one lights one.
    */
    const section = wardrobeSectionOf(born("wardrobe", "a red apron, dark jeans, plain shoes"));
    expect(section?.rows.map((row) => row.slots)).toEqual([
      ["wardrobe:0"], ["wardrobe:1"], ["wardrobe:2"],
    ]);
    /* And they are UNIQUE, which is the defect this shape exists to avoid: a
       shared key would collide in any list that renders by it. */
    const keys = section!.rows.map((row) => row.slots.join(" "));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("⚠ comes LAST, after every part of the person", () => {
    /* Reading order is how the panel says this is not her. */
    expect(PANEL_GROUPS.at(-1)).toEqual({ group: "wardrobe", heading: "Wardrobe" });
  });
});
