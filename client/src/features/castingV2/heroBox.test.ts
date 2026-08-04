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
 * The contract that replaced it: **the pair's height derives from the copy
 * column and its own min-height, never from image intrinsics.** The slot image
 * is absolute-filled, so whatever art ships next crops to the box instead of
 * bending it.
 *
 * This lives here because the founder's UI contract says a mechanizable design
 * law belongs in the suite rather than in review memory — and because the only
 * assertion that ever guarded this box was a throwaway drive script asserting
 * the OPPOSITE ("genuinely taller than its slot"), which was true of the old
 * bug and is exactly the kind of memory that rots.
 */
const CSS = new URL("./castingV2.css", import.meta.url);

async function heroSlotImageRules(): Promise<string> {
  const css = await readFile(CSS, "utf8");
  const start = css.indexOf(".dpc-hero__slot > img {");
  expect(start, "the hero slot image rule must exist").toBeGreaterThan(0);
  return css.slice(start, css.indexOf("}", start));
}

describe("the hero pair is sized by its copy, never by its art", () => {
  it("absolute-fills the slot image so intrinsics cannot escape", async () => {
    const rule = await heroSlotImageRules();
    expect(rule).toContain("position: absolute");
    expect(rule).toContain("inset: 0");
    expect(rule).toContain("object-fit: cover");
  });

  /*
    The slot must be a containing block, or `inset: 0` resolves against
    something further up and the fill silently stops filling.
  */
  it("gives the image a positioned parent to fill", async () => {
    const css = await readFile(CSS, "utf8");
    const slot = css.slice(
      css.indexOf(".dpc-hero__slot {"),
      css.indexOf("}", css.indexOf(".dpc-hero__slot {")),
    );
    expect(slot).toContain("position: relative");
    expect(slot).toContain("overflow: hidden");
  });

  /*
    THE HEIGHT COMES FROM SOMEWHERE THAT IS NOT THE ART. A min-height on the
    pair is what makes the box definite; without it the absolute fill has
    nothing to fill and the slot collapses.
  */
  it("takes its height from a stated minimum, not from a picture", async () => {
    const css = await readFile(CSS, "utf8");
    const pair = css.slice(
      css.indexOf(".dpc-hero__pair"),
      css.indexOf(".dpc-hero__slot {"),
    );
    expect(pair).toMatch(/min-height:\s*\d+px/);
  });

  /* And the lesson stays written down where the next person will meet it. */
  it("keeps the reason in the stylesheet", async () => {
    const css = await readFile(CSS, "utf8");
    expect(css).toContain("The image can NEVER dictate the box");
  });
});
