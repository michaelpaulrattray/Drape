import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * THE ART CAN NEVER DICTATE THE HERO BOX (2026-08-05).
 *
 * A new right-hand frame with a taller intrinsic ratio ballooned the pair in
 * production. `height: 100%` on a flex-sized slot is circular — with no
 * definite height it resolves to auto, so the image's own proportions imposed
 * themselves and the card grew to match.
 *
 * The contract that replaced it: **the right column's height derives from the
 * copy column and its own min-height, never from image intrinsics.** The frame
 * is absolute-filled, so whatever art ships next crops to the box instead of
 * bending it.
 *
 * This lives here because the founder's UI contract says a mechanizable design
 * law belongs in the suite rather than in review memory — and because the only
 * assertion that ever guarded this box was a throwaway drive script asserting
 * the OPPOSITE ("genuinely taller than its slot"), which was true of the old
 * bug and is exactly the kind of memory that rots.
 *
 * ⚠ **RE-POINTED, NOT RELAXED (#234, 2026-08-29.)** The split-face pair it was
 * written against is gone; the deck that replaced it obeys the same law under
 * different class names, so the arms below now read `.dpc-deck*`. Each one
 * still fails on the construction that caused the original defect — a frame
 * sizing its own box — and the deck adds one the pair never needed: a card
 * states its WIDTH only, because `aspect-ratio` resolves an `auto` axis and a
 * stated height would silently win over the 4:5 the spec is built on.
 */
const CSS = new URL("./castingV2.css", import.meta.url);

async function rule(selector: string): Promise<string> {
  const css = await readFile(CSS, "utf8");
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} must exist`).toBeGreaterThan(0);
  return css.slice(start, css.indexOf("}", start));
}

describe("the hero deck is sized by its box, never by its art", () => {
  it("absolute-fills the card image so intrinsics cannot escape", async () => {
    const image = await rule(".dpc-deck__card > img");
    expect(image).toContain("position: absolute");
    expect(image).toContain("inset: 0");
    expect(image).toContain("object-fit: cover");
  });

  /*
    The card must be a containing block, or `inset: 0` resolves against
    something further up and the fill silently stops filling.
  */
  it("gives the image a positioned parent to fill", async () => {
    const card = await rule(".dpc-deck__card");
    expect(card).toContain("position: absolute");
    expect(card).toContain("overflow: hidden");
  });

  /*
    THE HEIGHT COMES FROM SOMEWHERE THAT IS NOT THE ART. A min-height on the
    column is what makes the box definite; without it the absolute fill has
    nothing to fill, the container query has no height to answer with, and the
    deck collapses.
  */
  it("takes its height from a stated minimum, not from a picture", async () => {
    const column = await rule(".dpc-deck");
    expect(column).toMatch(/min-height:\s*\d+px/);
    const stage = await rule(".dpc-deck__stage");
    expect(stage).toContain("container-type: size");
  });

  /*
    A CARD STATES WIDTH ONLY. `aspect-ratio` only resolves an `auto` axis, so a
    stated height would beat the ratio and hand back a stretched frame — the
    same class of defect as the original, arriving through the new geometry.
  */
  it("lets the ratio own the second axis", async () => {
    const card = await rule(".dpc-deck__card");
    expect(card).toContain("aspect-ratio: 4 / 5");
    expect(card).toContain("height: auto");
    const heights = [...card.matchAll(/(?<!aspect-|min-|max-)height:\s*([^;]+);/g)]
      .map((match) => match[1]!.trim());
    expect(heights, "a card may only ever state height: auto").toEqual(["auto"]);
    for (const variant of [".dpc-deck__card--centre", ".dpc-deck__card--peek"]) {
      const body = await rule(variant);
      expect(body, `${variant} must set width only`).toContain("width:");
      expect(body, `${variant} must not state a height`).not.toMatch(/(?<!aspect-|min-)height:/);
    }
  });

  /* And the lesson stays written down where the next person will meet it. */
  it("keeps the reason in the stylesheet", async () => {
    const css = await readFile(CSS, "utf8");
    expect(css).toContain("The image can NEVER dictate the box");
  });
});
