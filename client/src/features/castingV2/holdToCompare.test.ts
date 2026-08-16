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
    const sheet = await readFile(SHEET, "utf8");
    expect(sheet).toContain('label: position === 0 ? "Original" : "Previous"');
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
  it("holds the first version against the Original, and every later one against its neighbour", async () => {
    /*
      The chain is a tree — forking from an earlier version is the whole
      interaction — but the rail draws it as a linear strip, which is the
      founder's own description: "you just click between accumulated edits".
      So "previous" is the step visually before it in that strip, because that
      is the one the person is comparing against in their head.
    */
    /* Asserted as two single-line facts rather than one span across a newline:
       this file is checked out CRLF on Windows, so a `\n` in the needle matches
       nothing and the test would fail for a reason that has no bearing on the
       rule it is about. */
    const sheet = await readFile(SHEET, "utf8");
    expect(sheet).toContain("? variants.data.originalImageUrl");
    expect(sheet).toContain("rail[position - 1]?.imageUrl ?? null");
    /* And the two arms belong to the same branch on `position`. */
    expect(sheet).toContain("const url = position === 0");
  });

  it("offers no comparison on the original, or on a version this payload does not know", async () => {
    /*
      Both are the same refusal: there is no honest previous frame, so there is
      no gesture. A version missing from the list is one that landed since this
      payload or was pruned — falling back to the head of a list it is not in
      would hold her face against a stranger's.
    */
    const sheet = await readFile(SHEET, "utf8");
    expect(sheet).toContain("if (!variants.data || shownVariantId === null) return null;");
    expect(sheet).toContain("if (position < 0) return null;");
    /* And a previous version whose picture never arrived is not a comparison. */
    expect(sheet).toContain("if (!url) return null;");
  });
});
