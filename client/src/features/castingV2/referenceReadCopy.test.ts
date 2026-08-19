import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  READ_CAPTION,
  READ_USE,
  droppedNote,
  makeupSurfaceWord,
  spokenList,
} from "./referenceReadCopy";

/**
 * THE COPY OF A ROAD THAT COSTS NOTHING AND CHANGES NOTHING, asserted rather
 * than remembered.
 *
 * The UI milestone contract (founder, 2026-08-01) makes the mechanizable half of
 * a copy audit a suite. These particular sentences carry two capability claims
 * that would be lies if the surface drifted:
 *
 *   1. **nothing has been spent and nothing has changed** — true only while the
 *      chip PREFILLS, and the moment any of this sends, the caption is a lie
 *      about her credits;
 *   2. **what did not come across is NAMED** — a dropped surface reported as a
 *      count, or not at all, is the quiet-truncation shape this program has paid
 *      for repeatedly (the 80-character makeup note, four surfaces in and two
 *      out, on every full face).
 */
const PANEL = new URL("./components/RefinePanel.tsx", import.meta.url);

const withoutProse = (source: string): string => source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

describe("the sentence about the sentence", () => {
  it("says outright that nothing has changed yet", () => {
    /* She is looking at words a reader wrote about HER photograph. Anything
       that reads as "we have changed her" is false: no credit has moved, no
       render has run, and the words are not even in the box. */
    expect(READ_CAPTION).toContain("nothing has changed yet");
  });

  it("is in her ontology — a photo she gave us, looked at", () => {
    /* Law 8: the user's own words govern. "Read from your photo", never
       "AI suggestion" and never a model's name. */
    expect(READ_CAPTION.toLowerCase()).toContain("your photo");
    for (const jargon of ["ai", "model", "vision", "prompt", "llm"]) {
      expect(READ_CAPTION.toLowerCase().split(/[^a-z]+/)).not.toContain(jargon);
    }
  });

  it("names no feature, because one caption now serves two readers", () => {
    /*
      The makeup link is deleted (founder ruling, fable-1051) and the reading it
      performed lives inside the universal road, where a hair colour is read by
      the same mechanism. A caption naming makeup would be a per-feature
      sentence on a road that has no per-feature doors left.
    */
    for (const feature of ["makeup", "hair", "eyes", "lips", "colour", "color"]) {
      expect(READ_CAPTION.toLowerCase().split(/[^a-z]+/)).not.toContain(feature);
    }
  });

  it("uses the SAME word as the chip that offers a version's own words back", () => {
    /*
      Both controls prefill and stop. Two controls that behave identically must
      read identically, or the second one teaches her that the first might send.
    */
    expect(READ_USE).toBe("Use");
  });
});

describe("what did not come across", () => {
  it("says nothing at all when nothing was dropped", () => {
    expect(droppedNote([])).toBeNull();
  });

  it("NAMES one dropped surface, singular, and tells her she can type it", () => {
    expect(droppedNote(["brows"]))
      .toBe("The brows didn't come across — type it yourself if you want it.");
  });

  it("names several as an English list rather than a join", () => {
    expect(droppedNote(["brows", "complexion"]))
      .toBe("The brows and complexion didn't come across — type them yourself if you want them.");
    expect(spokenList(["eyes", "lips", "brows"])).toBe("eyes, lips and brows");
  });

  it("shows a word for a surface the catalogue has never met", () => {
    /* A server that grows a fifth surface should show an honest plain word
       rather than break the panel — at worst plain, never wrong. */
    expect(makeupSurfaceWord("lashes")).toBe("lashes");
    expect(droppedNote(["lashes"])).toContain("The lashes");
  });

  it("never reports a count in place of the names", () => {
    const note = droppedNote(["brows", "complexion"])!;
    expect(note).not.toMatch(/\b(2|two|some|several)\b/i);
  });
});

describe("the offer prefills and stops", () => {
  it("has no send anywhere in the block that draws it", async () => {
    /*
      THE PROMISE, ASSERTED AT THE SURFACE RATHER THAN IN A COMMENT.

      `Use` fills the ask box. If adopting ever gained a send, the caption above
      would be a false statement about her credits — and the road would become
      illegal with it, since `refineDelta` has required since D-171 that the
      value appear in the customer's OWN instruction.

      The panel as a whole DOES send (that is what the Refine button is), so the
      assertion is scoped to the offer's own markup: everything between the
      caption and the note it ends with.
    */
    const source = withoutProse(await readFile(PANEL, "utf8"));
    const block = source.slice(source.indexOf("{offer ?"), source.indexOf("droppedNote(offer.dropped)"));
    expect(block.length).toBeGreaterThan(0);
    expect(block).not.toMatch(/onRefine|mutateAsync/);
    expect(block).toContain("onAdopt");

    /*
      THE POSITIVE CONTROL, without which the absence above is a test of its own
      regex — the surrounding panel sends, so the same detector run over it must
      find one. A checker that cannot fire proves nothing by staying silent.
    */
    expect(source).toMatch(/onRefine|mutateAsync/);
  });

  it("is drawn only when the road has actually said something", async () => {
    /*
      There is no control here to be absent outside a scope, which is the whole
      re-skin: the offer arrives on the refine's own answer, so an account the
      road does not serve simply never receives one.
    */
    const source = withoutProse(await readFile(PANEL, "utf8"));
    expect(source).toMatch(/\{offer \?/);
  });
});
