import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * THE SCRIM'S OWN SCROLLBARS — card 2615.
 *
 * The relay read it in PR #2614's frames: the version rail carried *"a bright
 * white scrollbar track about 5 px wide down its right edge"* in light mode,
 * *"a pale thumb in dark"* — an unstyled browser control inside an otherwise
 * glass, monochrome viewer.
 *
 * The cause is one assumption made at document level and inherited everywhere.
 * `client/src/index.css` paints every scrollbar track `var(--page)` and every
 * thumb `var(--dots)`, which is right for a scroller standing on the PAGE and
 * wrong for one standing on the SCRIM, because a scrim is dark in BOTH themes
 * while both of those tokens invert. In the light theme `--page` is `#FCFCFD`,
 * so the track is a white stripe on a dark scrim; `--dots` goes `#DEDEE2` →
 * `#3A3A42`, so the thumb is pale in one theme and dark in the other on a
 * surface that never changed.
 *
 * ⚠ **THE INSTANCE ON THE CARD IS ONE OF THREE, AND THE SWEEP IS WHY THIS FILE
 * DERIVES ITS POPULATION RATHER THAN LISTING IT.** The rail was reported; the
 * dock and the drawer scroll on the same scrim and had the same track. Listing
 * three class names here would pass for exactly as long as nobody adds a
 * fourth scroller to the viewer — so the last arm reads every scrolling rule
 * the stylesheet declares for a viewer surface and holds the scrollbar rules
 * equal to it. A new one reddens this file on the day it is written.
 *
 * What the arms cannot show is what it LOOKS like, which is working law 6 and
 * law 9's business: the frames, both themes, are on the pull request.
 */
const CASTING_CSS = new URL("./castingV2.css", import.meta.url);
const DOCUMENT_CSS = new URL("../../index.css", import.meta.url);

/** The scrim's three scrollers, as the stylesheet spells them. */
const SCRIM_SCROLLERS = [
  ".dpc-viewer__dock",
  ".dpc-viewer__drawer",
  '.dpc-refine__stack[data-layout="column"]',
] as const;

/**
 * One rule's body, sliced from its own opening brace.
 *
 * A whole-file `toContain` passes on an identical line in a neighbouring rule,
 * which is how a guard comes to read its own fix as coverage. So every arm
 * below asserts against a SLICE, and `anchorOnce` proves the slice's anchor
 * selected one rule rather than the first of several.
 */
function ruleBody(css: string, anchor: string): string {
  const start = css.indexOf(anchor);
  expect(start, `anchor not found: ${anchor}`).toBeGreaterThan(-1);
  const open = css.indexOf("{", start);
  return css.slice(open + 1, css.indexOf("}", open));
}

function anchorOnce(css: string, anchor: string): void {
  expect(css.split(anchor).length - 1, `anchor is not unique: ${anchor}`).toBe(1);
}

describe("a scroller on the viewer's scrim does not wear the document's page-coloured bar", () => {
  it("CONTROL — the document really does paint the track `--page` and the thumb `--dots`", async () => {
    const css = await readFile(DOCUMENT_CSS, "utf8");
    /*
      The negative control, and it is the whole reason the rules below exist.
      If this ever stops being true the override has become decoration, and
      this file should be re-read rather than left passing.
    */
    expect(ruleBody(css, "::-webkit-scrollbar-track {")).toContain("background: var(--page)");
    expect(ruleBody(css, "::-webkit-scrollbar-thumb {")).toContain("background: var(--dots)");
  });

  it("gives all three a transparent track, in both engines' vocabularies", async () => {
    const css = await readFile(CASTING_CSS, "utf8");
    const standards = ruleBody(css, `${SCRIM_SCROLLERS[0]},`);
    expect(standards).toContain("scrollbar-width: thin;");
    /* `scrollbar-color` takes thumb then track: the track is the second. */
    expect(standards).toMatch(/scrollbar-color:[^;]*\btransparent;/);

    const track = ruleBody(css, `${SCRIM_SCROLLERS[0]}::-webkit-scrollbar-track,`);
    expect(track).toContain("background: transparent;");
  });

  it("builds the thumb from `--onScrim`, which is white in both themes, and never from a token that inverts", async () => {
    const css = await readFile(CASTING_CSS, "utf8");
    const thumb = ruleBody(css, `${SCRIM_SCROLLERS[0]}::-webkit-scrollbar-thumb,`);
    expect(thumb).toContain("color-mix(in srgb, var(--onScrim) 28%, transparent)");
    /*
      The failure this names is specific: `--dots` is what `.dpc-sheetrow`
      correctly uses one surface over, so it is the token a later sweep would
      reach for while "unifying" these two.
    */
    expect(thumb).not.toContain("var(--dots)");

    const hovered = ruleBody(css, `${SCRIM_SCROLLERS[0]}:hover::-webkit-scrollbar-thumb,`);
    expect(hovered).toContain("color-mix(in srgb, var(--onScrim) 48%, transparent)");
  });

  it("writes the hover step in BOTH vocabularies, because Chromium reads only one of them", async () => {
    const css = await readFile(CASTING_CSS, "utf8");
    /*
      Once `scrollbar-color` is set, Chromium ignores the `::-webkit-scrollbar`
      rules for that element — so a hover step written only in webkit is a hover
      step that never happens in the browser this product is used in.
    */
    anchorOnce(css, `${SCRIM_SCROLLERS[0]}:hover,`);
    const standards = ruleBody(css, `${SCRIM_SCROLLERS[0]}:hover,`);
    expect(standards).toContain("color-mix(in srgb, var(--onScrim) 48%, transparent)");
    for (const selector of SCRIM_SCROLLERS) {
      expect(css.slice(css.indexOf(`${SCRIM_SCROLLERS[0]}:hover,`)).slice(0, 220)).toContain(`${selector}:hover`);
    }
  });

  it("leaves the row on the PAGE alone — `--dots` is right there and this is not a sweep over every bar", async () => {
    const css = await readFile(CASTING_CSS, "utf8");
    anchorOnce(css, ".dpc-sheetrow::-webkit-scrollbar-thumb {");
    expect(ruleBody(css, ".dpc-sheetrow::-webkit-scrollbar-thumb {")).toContain("background: var(--dots);");
  });

  it("DERIVED — every scrolling viewer surface the stylesheet declares is covered, so a fourth cannot ship bare", async () => {
    const css = await readFile(CASTING_CSS, "utf8");
    /*
      Read from the stylesheet rather than listed: a rule whose selector names
      a viewer surface (or the rail's column stack, which stands on the scrim
      inside it) AND declares a scrolling overflow.
    */
    const scrolling = new Set<string>();
    for (const match of css.matchAll(/^(\.dpc-(?:viewer__[a-z]+|refine__stack\[data-layout="column"\]))\s*\{([^}]*)\}/gim)) {
      if (/overflow(?:-[xy])?:\s*(?:auto|scroll)/i.test(match[2]!)) scrolling.add(match[1]!);
    }

    /* A sweep returning nothing is indistinguishable from one reading nothing. */
    expect(scrolling.size).toBeGreaterThan(0);
    expect([...scrolling].sort()).toEqual([...SCRIM_SCROLLERS].sort());

    /*
      Read the GROUP's selector list rather than grepping the whole file for
      the name: the last selector in a list carries no comma, and a bare
      `toContain(selector)` over the file would be satisfied by the very rule
      that declares the overflow.
    */
    const selectorList = (bar: string): string => {
      const at = css.indexOf(`${SCRIM_SCROLLERS[0]}${bar},`);
      anchorOnce(css, `${SCRIM_SCROLLERS[0]}${bar},`);
      expect(at, `no scrim rule for ${bar || "the standards properties"}`).toBeGreaterThan(-1);
      return css.slice(at, css.indexOf("{", at));
    };

    for (const bar of ["", "::-webkit-scrollbar", "::-webkit-scrollbar-track", "::-webkit-scrollbar-thumb"]) {
      const list = selectorList(bar);
      for (const selector of scrolling) {
        expect(list, `${selector}${bar} is not in the scrim rule`).toContain(`${selector}${bar}`);
      }
    }
  });
});
