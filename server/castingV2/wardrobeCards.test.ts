/**
 * THE OUTFIT SPLIT, AND THE SECTION THAT IS NO LONGER DRAWN FROM IT (§8.1).
 *
 * ⚠ **The panel section retired with the paths (#203 slice 2, 2026-09-24)**;
 * the SPLIT RULE did not, and the first describe below is still its whole
 * specification. The second is the retirement's proof rather than its
 * description — see its own header for why eleven arms became three.
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
import { wardrobePieces } from "./wardrobeCards";

const born = (path: "wardrobe" | "basics", line: string): WardrobeResolution =>
  ({ kind: "line", line, source: "born", path });

const panelFor = (wardrobe: WardrobeResolution | null) => facePanel({
  rows: [],
  pronouns: pronounsForSex("female"),
  contentUrl: (key) => `https://example.test/${key}`,
  maskUrl: (key) => `https://example.test/${key}`,
  wardrobe,
});

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


/**
 * ⚠ THE SECTION IS RETIRED, AND THIS IS THE ARM THAT PROVES IT RATHER THAN
 * THE ONES THAT DESCRIBED IT (#203 slice 2, 2026-09-24).
 *
 * Eleven arms stood here across two describes: which of the three path values
 * got a section, and then what that section drew — its heading, its row order,
 * its keys, its missing rectangle, its place last on the panel. Every one of
 * them was a fact about machinery that is now deleted, and they die with it.
 *
 * What replaces them is the question they were really guarding: **no panel
 * draws a wardrobe section for anything, including the state that used to draw
 * one.** The type still admits a `line` on the Wardrobe path — thirteen rolls
 * on production carry a path, none of them holds a candidate — so the arm is
 * driven on exactly that resolution. A deletion the suite cannot see is a
 * deletion nobody proved.
 */
describe("no panel draws a wardrobe section, on any resolution", () => {
  it("⚠ not even for a LINE on the Wardrobe path — the state that used to draw one", () => {
    for (const wardrobe of [
      born("wardrobe", HOUSE_WARDROBE_LINE),
      born("basics", basicsWardrobeLine(null)),
      { kind: "unpathed" } as const,
      { kind: "incoherent", path: "wardrobe" } as const,
      null,
    ]) {
      const panel = panelFor(wardrobe);
      const headings = panel.groups.map((group) => group.heading);
      expect(headings, JSON.stringify(wardrobe)).not.toContain("Wardrobe");
      /* And no row of any section carries a wardrobe key — a section can be
         renamed, a row cannot hide. */
      const slots = panel.groups.flatMap((group) => group.rows).flatMap((row) => row.slots);
      expect(slots.filter((slot) => String(slot).startsWith("wardrobe:")), JSON.stringify(wardrobe))
        .toEqual([]);
    }
  });

  it("⚠ CONTROL — the same reading DOES see a section when there is one", () => {
    /*
      Without this the arm above passes on a panel builder that returns nothing
      at all, which is exactly what it would look like if the fixture had gone
      wrong rather than the section having gone away.
    */
    const panel = facePanel({
      rows: [{
        id: 1, publicId: "pub-1", candidateId: 7, variantId: 11,
        role: "carry", tier: "anatomy", slot: "lips" as never, noun: "lips",
        words: ["a fuller lip"], storageKey: null, maskKey: null, digest: null,
        geometry: { bbox: { x: 10, y: 20, width: 30, height: 40 }, frame: { width: 1000, height: 1500 } },
        guard: null, refusal: null, version: 1, retiredAt: null,
        createdAt: new Date(2026, 7, 10, 12, 0, 1),
      }] as never,
      pronouns: pronounsForSex("female"),
      contentUrl: (key) => `https://example.test/${key}`,
      maskUrl: (key) => `https://example.test/${key}`,
      wardrobe: born("wardrobe", HOUSE_WARDROBE_LINE),
    });
    expect(panel.groups.map((group) => group.heading)).toContain("Face");
    expect(panel.groups.flatMap((group) => group.rows).length).toBeGreaterThan(0);
    /* The same panel, with a wardrobe line on it, still has no wardrobe. */
    expect(panel.groups.map((group) => group.heading)).not.toContain("Wardrobe");
  });

  it("⚠ and the section is gone from the panel's own list of sections", () => {
    /* PANEL_GROUPS is what a renderer reads; a heading left in it would draw an
       empty section the moment anything else filled it. */
    expect(PANEL_GROUPS.map((group) => group.group)).not.toContain("wardrobe");
    expect(PANEL_GROUPS.at(-1)).toEqual({ group: "open", heading: "Also on this cast" });
  });
});
