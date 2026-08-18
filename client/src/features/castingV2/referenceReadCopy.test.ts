import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  MAKEUP_READ_ACTION,
  MAKEUP_READ_CAPTION,
  MAKEUP_READ_USE,
  makeupDroppedNote,
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
const CHIP = new URL("./components/ReferenceMakeupChip.tsx", import.meta.url);
const PANEL = new URL("./components/RefinePanel.tsx", import.meta.url);

const withoutProse = (source: string): string => source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

describe("the sentence about the sentence", () => {
  it("says outright that nothing has changed yet", () => {
    /* She is looking at words a reader wrote about HER photograph. Anything
       that reads as "we have changed her" is false: no credit has moved, no
       render has run, and the words are not even in the box. */
    expect(MAKEUP_READ_CAPTION).toContain("nothing has changed yet");
  });

  it("is in her ontology — a photo she gave us, looked at", () => {
    /* Law 8: the user's own words govern. "Read from your photo", never
       "AI suggestion" and never a model's name. */
    expect(MAKEUP_READ_CAPTION.toLowerCase()).toContain("your photo");
    for (const jargon of ["ai", "model", "vision", "prompt", "llm"]) {
      expect(MAKEUP_READ_CAPTION.toLowerCase().split(/[^a-z]+/)).not.toContain(jargon);
    }
  });

  it("names the door for what it takes, not for what runs", () => {
    expect(MAKEUP_READ_ACTION).toBe("Take the makeup from a photo");
  });

  it("uses the SAME word as the chip that offers a version's own words back", () => {
    /*
      Both controls prefill and stop. Two controls that behave identically must
      read identically, or the second one teaches her that the first might send.
    */
    expect(MAKEUP_READ_USE).toBe("Use");
  });
});

describe("what did not come across", () => {
  it("says nothing at all when nothing was dropped", () => {
    expect(makeupDroppedNote([])).toBeNull();
  });

  it("NAMES one dropped surface, singular, and tells her she can type it", () => {
    expect(makeupDroppedNote(["brows"]))
      .toBe("The brows didn't come across — type it yourself if you want it.");
  });

  it("names several as an English list rather than a join", () => {
    expect(makeupDroppedNote(["brows", "complexion"]))
      .toBe("The brows and complexion didn't come across — type them yourself if you want them.");
    expect(spokenList(["eyes", "lips", "brows"])).toBe("eyes, lips and brows");
  });

  it("shows a word for a surface the catalogue has never met", () => {
    /* A server that grows a fifth surface should show an honest plain word
       rather than break the panel — at worst plain, never wrong. */
    expect(makeupSurfaceWord("lashes")).toBe("lashes");
    expect(makeupDroppedNote(["lashes"])).toContain("The lashes");
  });

  it("never reports a count in place of the names", () => {
    const note = makeupDroppedNote(["brows", "complexion"])!;
    expect(note).not.toMatch(/\b(2|two|some|several)\b/i);
  });
});

describe("the chip prefills and stops", () => {
  it("has no call to anything that refines, anywhere in it", async () => {
    /*
      THE PROMISE, ASSERTED AT THE COMPONENT RATHER THAN IN A COMMENT.

      `Use` fills the ask box. If this surface ever gained a send, the caption
      above would be a false statement about her credits — and the road would
      also become illegal, since `refineDelta` has required since D-172 that a
      makeup value appear in the customer's OWN instruction.
    */
    const source = withoutProse(await readFile(CHIP, "utf8"));
    expect(source).not.toMatch(/onRefine|mutateAsync|refine\(/);
    expect(source).toContain("onUse(result.sentence)");

    /*
      THE POSITIVE CONTROL, without which the absence above is a test of its own
      regex. The panel beside it DOES send, so the same detector run over it must
      find one — a checker that cannot fire proves nothing by staying silent.
    */
    expect(withoutProse(await readFile(PANEL, "utf8"))).toMatch(/onRefine|mutateAsync|refine\(/);
  });

  it("is drawn only when the page hands it a reader", async () => {
    /*
      Absent rather than disabled outside the scope: the procedure answers
      NOT_FOUND there, so a drawn control would be one that refuses. Same
      doctrine as the Regenerate button one element along.
    */
    const source = withoutProse(await readFile(PANEL, "utf8"));
    expect(source).toMatch(/readMakeupFromPhoto \?/);
  });
});
