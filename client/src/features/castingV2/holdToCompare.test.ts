import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * HOLD TO SEE THE FRAME BEFORE THIS ONE — the laws, mechanized (M12 row 3).
 *
 * The plan's M12 asks the focused editor for "current-vs-proposed". The
 * reconciliation's second pass found the capability already proven in the
 * product, on the road V2 replaced (`ImageViewerPanel`'s `compareUrl`, held
 * under a press in `StudioCanvas`), and fable-786 §3 approved it as an
 * INHERITANCE rather than a new invention. That word is the reason several of
 * these assertions exist: an inheritance that quietly drifts from the thing it
 * inherited is just a second implementation with a good story.
 *
 * What is deliberately NOT here: whether the comparison reads well to an eye.
 * That is law 6's business and belongs in front of the founder, not in a
 * `toContain`.
 */
const CSS = new URL("./castingV2.css", import.meta.url);
const VIEWER = new URL("./components/CandidateViewer.tsx", import.meta.url);
const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);
const COMPARE = new URL("./viewerCompare.ts", import.meta.url);
const LEGACY = new URL("../studio/components/StudioCanvas.tsx", import.meta.url);

async function rule(selector: string): Promise<string> {
  const css = await readFile(CSS, "utf8");
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} must exist`).toBeGreaterThan(0);
  return css.slice(start, css.indexOf("}", start));
}

describe("the previous frame is held, never fetched at the moment of asking", () => {
  it("mounts the compare frame whenever there is one, and only toggles visibility", async () => {
    /*
      THE ANTI-FLASH CONTRACT, and it is this viewer's founding rule rather than
      a preference: the picture changes when the next one can be PAINTED
      (`useShownFrame`). A `src` swapped at press time is a REQUEST, not a
      picture — the frame would arrive some milliseconds later, which is exactly
      long enough to destroy the only thing a comparison is for.

      `visibility` rather than `display: none` is the mechanism, for the same
      reason the sizer above it uses `visibility`: a hidden element is still
      decoded. `display: none` would let the browser skip the decode and hand
      back the flash this is built to prevent.
    */
    const layer = await rule(".dpc-viewer__compare");
    expect(layer).toContain("visibility: hidden");
    expect(layer).not.toContain("display: none");
    const shown = await rule('.dpc-viewer__plate[data-comparing="true"] > .dpc-viewer__compare');
    expect(shown).toContain("visibility: visible");
  });

  it("never swaps the live image's source to show the previous frame", async () => {
    const viewer = await readFile(VIEWER, "utf8");
    /*
      The negative half of the rule above, asserted on the code rather than
      inferred from the CSS. There is exactly one `src` bound to the frame on
      screen, and the compare layer is its own element with its own.
    */
    expect(viewer).toContain('src={compare.url}');
    expect(viewer).not.toMatch(/src=\{comparing \?/);
  });

  it("lands the compare frame exactly where the live one is", async () => {
    /*
      The two are the same face. Cropped or positioned differently, the hold
      would show a shift that belongs to the layout and read as something the
      edit did — which is worse than not having the gesture at all, because it
      manufactures a difference rather than merely hiding one.
    */
    const layer = await rule(".dpc-viewer__compare");
    expect(layer).toContain("position: absolute");
    expect(layer).toContain("inset: 0");
    expect(layer).toContain("object-fit: contain");
  });
});

describe("the gesture is the legacy road's, not a second invention", () => {
  it("holds for the same 150ms the legacy viewer holds for", async () => {
    /*
      Two viewers in one product answering the same gesture at different speeds
      are two products. The number is READ OFF the legacy road here rather than
      restated, so this fails if either side moves and nobody moved the other —
      which is the only failure mode worth a test, since a shared constant is
      not reachable across these two feature trees.
    */
    const legacy = await readFile(LEGACY, "utf8");
    const legacyHold = /setTimeout\(\s*\(\)\s*=>\s*\{\s*setIsComparing\(true\);\s*\},\s*(\d+)\)/
      .exec(legacy);
    expect(legacyHold, "the legacy hold delay must still be readable").not.toBeNull();

    const viewer = await readFile(VIEWER, "utf8");
    const ours = /const COMPARE_HOLD_MS = (\d+);/.exec(viewer);
    expect(ours).not.toBeNull();
    expect(ours![1]).toBe(legacyHold![1]);
  });

  it("carries the legacy road's own two labels, chosen by the caller", async () => {
    /*
      The label travels WITH the url, from whoever knows which frame it is. A
      viewer that guessed would be a second opinion about what the customer is
      looking at, and this component's whole law is that it does not learn what
      a version is.
    */
    /* The derivation moved out of the sheet on 2026-08-23 (fable-1437); the
       rule it carries did not. Both labels are still chosen where the frame is
       chosen, and the viewer still renders whatever it is handed. */
    const derivation = await readFile(COMPARE, "utf8");
    expect(derivation).toContain('label: "Original"');
    expect(derivation).toContain('label: "Before this edit"');
    const viewer = await readFile(VIEWER, "utf8");
    expect(viewer).toContain("{compare.label}");
  });
});

describe("the press promises nothing the surface does not keep", () => {
  it("never puts a grab cursor on the picture", async () => {
    /*
      The founder's 2026-08-02 ruling, one surface along: `zoom-in` was refused
      on tiles because it promises a magnification the viewer does not perform.
      `grab` promises that the picture can be DRAGGED, and it cannot — this
      gesture reveals and releases, it does not move anything. The legacy road
      does set `grab`; this is the one place the inheritance deliberately stops,
      and it stops here rather than in a reviewer's memory.
    */
    const css = await readFile(CSS, "utf8");
    const viewerCss = css.slice(css.indexOf(".dpc-viewer {"), css.indexOf(".dpc-card--openable"));
    expect(viewerCss).not.toContain("cursor: grab");
  });

  it("keeps the compare layer out of the pointer's way", async () => {
    /*
      The press lands on the photograph and the release must find it again. A
      compare image that accepted pointer events would become the target the
      moment it appeared, and on some paths the release would never reach the
      handler — stranding the viewer on a frame the customer is not looking at
      and did not choose.
    */
    const layer = await rule(".dpc-viewer__compare");
    expect(layer).toContain("pointer-events: none");
  });

  it("starts the hold only on the photograph, never on a region box", async () => {
    /*
      The regions lie over this same plate and are the other door onto a PAID
      edit. Without this guard, pointing at her eye swaps her whole face for as
      long as the finger is down — a gesture firing on a press that was aiming
      at something else entirely.
    */
    const viewer = await readFile(VIEWER, "utf8");
    expect(viewer).toContain('closest?.("img")');
  });

  it("ends the hold when the pointer leaves, is cancelled, or has nothing to hold against", async () => {
    const viewer = await readFile(VIEWER, "utf8");
    /* Leaving with the button down would otherwise strand the previous frame on
       screen with nothing holding it there. */
    expect(viewer).toContain("onPointerLeave={releaseCompare}");
    expect(viewer).toContain("onPointerCancel={releaseCompare}");
    /* And selecting the original mid-press removes the frame the badge is
       naming — the stalest thing a surface can say. */
    expect(viewer).toContain("if (!compare) releaseCompare();");
  });
});

describe("what counts as the frame before this one", () => {
  it("⚠ holds this version against the one the EDIT WAS APPLIED TO, never its rail neighbour", async () => {
    /*
      ⚠ THIS ARM PINNED THE OPPOSITE RULE UNTIL 2026-08-23, AND IT HAD AN
      ARGUMENT. Retired loudly rather than deleted, because a stood-down control
      that leaves no trace is how the next reader re-derives the defect:

        > "The chain is a tree — forking from an earlier version is the whole
        > interaction — but the rail draws it as a linear strip, which is the
        > founder's own description: 'you just click between accumulated edits'.
        > So 'previous' is the step visually before it in that strip, because
        > that is the one the person is comparing against in their head."

      It was a real argument and the FOUNDER ANSWERED IT, in his own words
      (fable-1437): the compare *"only shows the previous thumbnail version
      before it not necesarily the version you edited from which could have been
      2 versions ago which you forked from."* The gesture's whole meaning is
      before/after of ONE edit, so its before is that edit's own parent — a fact
      the record has held on `parentVariantId` all along, while the rail's
      strip-order was a display accident.

      The behaviour itself is driven in `viewerCompare.test.ts` against the real
      derivation, including the forked case. This arm keeps the WIRING honest:
      the sheet reads the shown row's parent and nothing else.
    */
    const derivation = await readFile(COMPARE, "utf8");
    expect(derivation).toContain("const parent = shown.parentVariantId ?? null;");
    expect(derivation).toContain("const from = rail.find((row) => row.variantId === parent);");
    /* And the defect must not creep back under any spelling. */
    expect(derivation).not.toContain("position - 1");
    const sheet = await readFile(SHEET, "utf8");
    expect(sheet).not.toContain("rail[position - 1]");
    expect(sheet).toContain("viewerCompareFor({");
  });

  it("offers no comparison on a version this payload does not know, or on a parent it cannot show", async () => {
    /*
      The same refusal as before, now with a THIRD case the old shape could not
      have: a parent that is named and not on the rail. Falling back to the
      neighbour is the retired defect; falling back to the MASTER is a different
      lie, since it would say the edit was made from the original when it was
      not. Both are refused, and both are driven in `viewerCompare.test.ts`.
    */
    const derivation = await readFile(COMPARE, "utf8");
    expect(derivation).toContain("if (shownVariantId === null) return null;");
    expect(derivation).toContain("if (!shown) return null;");
    expect(derivation).toContain("if (!from?.imageUrl) return null;");
  });
});
