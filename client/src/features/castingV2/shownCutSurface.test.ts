import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { inkDesignImagePath } from "@shared/inkDesignDelivery";

import { SHOWN_CUT_LABEL } from "./referenceAttachCopy";

/**
 * THE SHOWN CUT'S SURFACE — the half of "see or reject" that has to be LOOKED
 * AT (ruled fable-1127 §2; road (D)'s instance ruled fable-1156 §2).
 *
 * The server can mint a design, name it and offer it, and every one of those
 * facts is inert if the picture never reaches a screen. This file is the
 * keeper for the four properties that make the offer a decision rather than a
 * viewing window:
 *
 *   1. the picture is DRAWN, above the answers it is about;
 *   2. the page hands it the SERVER'S path and spells no address of its own;
 *   3. it dies with the question, so a cut never stands over a later ask;
 *   4. it is drawn on paper that does not invert with the theme — a black-line
 *      tattoo on transparency, drawn onto a dark panel, is a customer being
 *      asked to approve a picture she cannot see.
 *
 * Every negative assertion here carries its own positive control, because a
 * string match over a whole file is exactly the checker that quietly stops
 * matching after an ordinary edit and then proves nothing by staying silent.
 */
const PANEL = new URL("./components/RefinePanel.tsx", import.meta.url);
const PAGE = new URL("../../pages/CastingSheet.tsx", import.meta.url);
const STYLES = new URL("./castingV2.css", import.meta.url);

const withoutProse = (source: string): string => source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

describe("the cut is drawn where the question is", () => {
  it("draws the picture, with the label a screen reader is given", async () => {
    const source = withoutProse(await readFile(PANEL, "utf8"));
    expect(source).toContain("dpc-refine__shownCut");
    expect(source).toMatch(/<img src=\{shownCut\} alt=\{SHOWN_CUT_LABEL\} \/>/);
  });

  it("ABOVE the chips that answer for it, not below them", async () => {
    /*
      The order the decision is made in: read the sentence, look at the design,
      tap. A picture below its own answers is a picture nobody looked at before
      answering, and this is the one property of the layout that is about the
      decision rather than about taste.
    */
    const source = withoutProse(await readFile(PANEL, "utf8"));
    const cut = source.indexOf("dpc-refine__shownCut");
    const answers = source.indexOf("dpc-refine__answers");
    expect(cut).toBeGreaterThan(-1);
    expect(answers).toBeGreaterThan(-1);
    expect(cut, "the cut was drawn below the chips that answer for it").toBeLessThan(answers);
  });

  it("SPELLS NO ADDRESS — the path is the server's, built by the one speller", async () => {
    /*
      `shared/inkDesignDelivery.ts` owns the spelling of a design's address and
      the server builds it there. A client that assembled its own would be the
      second copy that drifts (working law 4) — and the failure mode is not a
      broken image: it is a surface that could just as easily be handed a
      permanently public STORAGE url, which is the one thing standing between a
      photograph of a person and a stranger.
    */
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    const page = withoutProse(await readFile(PAGE, "utf8"));
    const SPELLS_THE_PATH = /["'`]\/api\/ink-design/;
    expect(panel).not.toMatch(SPELLS_THE_PATH);
    expect(page).not.toMatch(SPELLS_THE_PATH);
    /* The control: the reader is not matching its own optimism. */
    expect(`const src = "/api/ink-design/" + id;`).toMatch(SPELLS_THE_PATH);
    /* And the address it is NOT spelling is a real one, so the check above is
       about the product's own route rather than about a string. */
    expect(inkDesignImagePath("d-minted")).toBe("/api/ink-design/d-minted");
  });

  it("takes the path off the ANSWER'S OWN FIELD — the road, not a surface for it", async () => {
    /*
      `entrance-before-the-road`: a drawn picture wired to nothing is five
      commits of finished road nobody can reach. The page reads the field the
      service actually sets (`RefineResult.design`), and it reads it on the
      question's branch, which is where the offer arrives.
    */
    const page = withoutProse(await readFile(PAGE, "utf8"));
    expect(page).toMatch(/setShownCut\(result\.design\?\.imagePath \?\? null\)/);
    expect(page).toMatch(/shownCut=\{reaskOptions \? shownCut : null\}/);
  });

  it("DIES WITH THE QUESTION — on the next ask and on a dismiss", async () => {
    /*
      A cut left on screen after the question is answered or dismissed describes
      a decision already taken — the stale-sentence defect that was fixed once
      for outcomes and once for offers, and would arrive here a third time.
    */
    const page = withoutProse(await readFile(PAGE, "utf8"));
    const cleared = page.match(/setShownCut\(null\)/g) ?? [];
    expect(cleared.length, "the cut outlives the question it was shown for")
      .toBeGreaterThanOrEqual(2);
  });
});

describe("the paper it is drawn on", () => {
  it("does not invert with the theme, and is not built from a token that does", async () => {
    /*
      THE ONE MECHANIZABLE DESIGN LAW ON THIS SURFACE.

      A cut is artwork on TRANSPARENCY. Every surface token in the system
      inverts between themes (`--surface` is #FFFFFF light, #1C1C1F dark), so a
      plate built from one is white in the theme nobody uses and near-black in
      the default — and a black-line tattoo drawn on it is invisible at the
      exact moment she is being asked to approve it.

      `--onScrim` is defined once and never re-declared, which is what makes it
      the same paper in both themes. This asserts the rule at the RULE rather
      than at a colour: the plate may not be built from an inverting token.
    */
    const styles = await readFile(STYLES, "utf8");
    const block = styles.slice(styles.indexOf(".dpc-refine__shownCut {"));
    const plate = block.slice(0, block.indexOf("}"));
    expect(plate).toContain("--onScrim");
    const INVERTS = /background:[^;]*var\(--(surface|raised|page|fill|media|well)\b/;
    expect(plate).not.toMatch(INVERTS);
    /* The control, so the absence above is not a test of its own regex. */
    expect("  background: var(--surface);").toMatch(INVERTS);
  });

  it("cannot crop the artwork, and is not a fixed box it would have to fit", async () => {
    /*
      `cover` would cut the edges off the very thing she is being asked to
      judge — and the edges are where the cutter's mistakes are: a dropped
      flourish, a clipped letter, an arm of a star left behind.

      **The rule got stronger after the drive photographed it.** A forced square
      does not crop, but it renders a 1200x1697 sleeve design at about 119px
      wide inside bars of nothing — legible as an element, unjudgeable as a
      design. So the plate is sized by the picture and bounded on both axes:
      there is no box for the artwork to be cropped INTO, which is a stronger
      promise than `contain` and the reason that declaration is gone.
    */
    const styles = await readFile(STYLES, "utf8");
    const plateBlock = styles.slice(styles.indexOf(".dpc-refine__shownCut {"));
    const plate = plateBlock.slice(0, plateBlock.indexOf("}"));
    const imageBlock = styles.slice(styles.indexOf(".dpc-refine__shownCut > img {"));
    const image = imageBlock.slice(0, imageBlock.indexOf("}"));
    expect(image).not.toContain("object-fit: cover");
    expect(plate).not.toContain("aspect-ratio");
    /* Bounded on BOTH axes, or a tall design pushes the chips off the panel. */
    expect(image).toContain("max-width");
    expect(image).toContain("max-height");
  });
});

describe("the label", () => {
  it("says what the picture IS, in her words rather than the cutter's", () => {
    /*
      Working law 8: she thinks of a design lifted off a photograph, not of a
      crop, a mask or a segment. The chips below it say what to DO about it, so
      this says only what it is.
    */
    expect(SHOWN_CUT_LABEL.toLowerCase()).toContain("design");
    expect(SHOWN_CUT_LABEL.toLowerCase()).toContain("your picture");
    for (const jargon of ["crop", "mask", "segment", "alpha", "cutout", "png"]) {
      expect(SHOWN_CUT_LABEL.toLowerCase().split(/[^a-z]+/)).not.toContain(jargon);
    }
  });
});
