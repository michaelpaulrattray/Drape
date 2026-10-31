import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { ATTACH_DROP_WORD } from "./referenceAttachCopy";
import { withoutComments } from "../../../../server/testing/withoutComments";

/**
 * CARD #2912 — THE REFINE BOX TAKES A DROPPED PICTURE.
 *
 * His word, 2026-10-31, verbatim: *"also allow drag an drop of reference images
 * into the refine box"*. The box had exactly one door before this, the `+`
 * beside it, and a hand already holding a photograph had to put it down, find
 * the `+`, and find the file again.
 *
 * ⚠ **WHAT THESE ARMS ARE ABOUT IS NOT "DOES A DROP LAND".** Four shapes of
 * this feature all land a drop and three of them are defects, each one measured
 * on a neighbouring surface before this card existed:
 *
 *  1. **A second copy of the acceptance** — the picker's body duplicated under
 *     the drop handler. Working law 4 with a UI accent, and the half that
 *     drifts first is `resetSpot()`: without it a piece taken off the PREVIOUS
 *     photograph rides the next ask.
 *  2. **An over-state that is a presence rather than a change** — card 1118 on
 *     the ink panel next door: that button was already dashed and already
 *     bordered, so an arm asking "has it a border" passed against the defect.
 *  3. **A hand-rolled depth counter** — card 1087: a `useState` boolean set on
 *     enter and cleared on leave flickers off the moment the pointer crosses
 *     onto a CHILD, and this box is nothing but children (the field, the `+`,
 *     the priced button).
 *  4. **A drop claimed where there is no door** — the box would eat her
 *     photograph in silence outside `CASTING_REFERENCE_ATTACH_SCOPE`, where
 *     `reference.attach` answers NOT_FOUND.
 *
 * The behaviour of the counting itself is NOT this file's subject:
 * `conceptUpload.test.ts` owns the arms about `foundation/useFileDropTarget`.
 * What is pinned here is that this panel calls it rather than growing a fourth
 * copy of it.
 */
const PANEL = new URL("./components/RefinePanel.tsx", import.meta.url);
const HOOK = new URL("../../foundation/useFileDropTarget.ts", import.meta.url);
const CSS = new URL("./castingV2.css", import.meta.url);

/** The prose says what the code must do; only the CODE is the subject. */
async function panelCode(): Promise<string> {
  return withoutComments(await readFile(PANEL, "utf8"));
}

describe("the refine box takes a dropped picture", () => {
  it("sends BOTH doors to one acceptance, and the picker's old body is gone", async () => {
    const panel = await panelCode();

    /*
      THE WHOLE OF ARM 1. One function, reached from the zone and from the
      picker's `onChange`, and the inline body it replaced is DELETED rather
      than left beside it — two live acceptances on one surface is how one of
      them stops being read.
    */
    expect(panel).toContain("function acceptFile(file: File | null | undefined): void {");
    expect(panel).toContain("useFileDropTarget((files) => acceptFile(files?.[0]))");
    expect(panel).toContain("acceptFile(file);");
    expect(panel.match(/URL\.createObjectURL\(file\)/g) ?? []).toHaveLength(1);

    /*
      ⚠ AND `resetSpot()` IS INSIDE THE SHARED FUNCTION, which is the arm worth
      the most of the six. It is what forgets the pieces taken off the last
      photograph; a drop road that skipped it would send a cut of the OLD
      picture with the next paid ask, and every arm above would still pass.
    */
    const accept = panel.slice(
      panel.indexOf("function acceptFile("),
      panel.indexOf("function dropPicture("),
    );
    expect(accept.length).toBeGreaterThan(0);
    expect(accept).toContain("resetSpot();");
    expect(accept).toContain("URL.revokeObjectURL(picture.url)");
    expect(accept).toContain("setAttachRefusal(null);");
  });

  it("refuses the three states in which the `+` is not there to be pressed", async () => {
    /*
      A drop door has no `disabled` of its own, and a hand holding a file cannot
      read a button's state. So the refusal is in the acceptance itself: no door
      inside this scope, a render in flight, an attach already going up.
    */
    const panel = await panelCode();
    const accept = panel.slice(
      panel.indexOf("function acceptFile("),
      panel.indexOf("function dropPicture("),
    );
    expect(accept).toContain("if (!file || !attachPicture || busy || attaching) return;");
  });

  it("is ABSENT where there is no door, rather than a target that eats the file", async () => {
    /*
      ARM 4. `reference.attach` answers NOT_FOUND outside the scope and the `+`
      is absent there, so the drop must be too — a box that called
      `preventDefault` with nowhere to send the bytes would swallow her
      photograph and say nothing, which is the hook's own documented hazard.
    */
    const panel = await panelCode();
    expect(panel).toContain("const hasAttachDoor = Boolean(attachPicture);");
    expect(panel).toContain("{...(hasAttachDoor ? boxZone.handlers : {})}");
    expect(panel).toContain("{hasAttachDoor && boxZone.over ?");
  });

  it("changes the border PAST the one it already wears, not merely into one", async () => {
    /*
      ⚠ ARM 2, AND IT IS A COMPARISON RATHER THAN A PRESENCE. `.dpc-refine__box`
      has carried a border since #2533 (24% of `--onScrim`) and a stronger one
      on focus (52%), so a drop state at either of those values is invisible to
      the eye and green to a careless arm. It has to be past both.
    */
    const css = await readFile(CSS, "utf8");
    const rest = css.slice(css.indexOf(".dpc-refine__box {"));
    const atRest = /border: 1px solid color-mix\(in srgb, var\(--onScrim\) (\d+)%/.exec(rest);
    const focused = /\.dpc-refine__box:focus-within \{\s*border-color: color-mix\(in srgb, var\(--onScrim\) (\d+)%/
      .exec(css);
    expect(atRest).not.toBeNull();
    expect(focused).not.toBeNull();
    expect(Number(focused![1])).toBeGreaterThan(Number(atRest![1]));

    /* Solid `--onScrim` is past 100% of nothing — the token itself, which is
       strictly stronger than any `color-mix` of it with transparent. */
    const drop = css.slice(css.indexOf(".dpc-refine__box--drop {"));
    expect(drop.slice(0, 160)).toContain("border-color: var(--onScrim);");
    expect(drop.slice(0, 160)).not.toMatch(/border-color: color-mix/);
  });

  it("says it in a place she can read whether or not she has typed", async () => {
    /*
      ⚠ THE DEFECT THIS ARM EXISTS FOR WAS MINE AND I SHIPPED IT INTO MY OWN
      FIRST DRAFT: the sentence went into the field's `placeholder`, which is on
      screen only while the field is EMPTY — and somebody reaching for a
      photograph has usually already typed what to take from it. So the word
      would have been there in exactly the case nobody is in.

      The start page's brief box had already settled the shape
      (`dpc-hero__dropsay`): the sentence is laid OVER the box and the contents
      dim behind it. Same idiom, same tokens.
    */
    const panel = await panelCode();
    expect(panel).toContain('placeholder="Change something about them…"');
    expect(panel).toContain('<span className="dpc-refine__dropsay" aria-hidden="true">{ATTACH_DROP_WORD}</span>');

    const css = await readFile(CSS, "utf8");
    const say = css.slice(css.indexOf(".dpc-refine__dropsay {"));
    expect(say.slice(0, 260)).toContain("position: absolute;");
    /* The sentence must never become the thing that swallows the drop. */
    expect(say.slice(0, 260)).toContain("pointer-events: none;");
    /* And the contents behind it dim, so the sentence is legible over them. */
    expect(css).toContain(".dpc-refine__box--drop > :not(.dpc-refine__dropsay) {");
    /* The overlay needs a positioned parent, and this box never had one. */
    const box = css.slice(css.indexOf(".dpc-refine__box {"), css.indexOf(".dpc-refine__box:focus-within"));
    expect(box).toContain("position: relative;");
  });

  it("counts depth in ONE place, which is why this panel does not count at all", async () => {
    /*
      ARM 3. The cheap fix is a boolean, and it would pass every arm above while
      flickering off over the field, the `+` and the priced button — all three
      of them children of the box. ⚠ And there are already TWO hand-rolled
      copies of this counting on the casting page (`ConceptUploadCard` and
      `CastingV2`'s brief box); a third here is the drift, and they are a
      finding on the card rather than a sweep taken inside it.
    */
    const panel = await panelCode();
    /*
      ⚠ NARROWED, AND THE NARROWING IS ITSELF A FINDING. The ink panel's sibling
      arm reads `/\.current \+= 1;/` because that file counts nothing else; this
      panel does — `takenCount.current += 1` counts the pieces taken off a
      photograph and has nothing to do with dragging. An arm copied across
      verbatim goes red on honest code, which is how a suite teaches its reader
      to edit the arm rather than the panel. So the subject is a DRAG depth, by
      name.
    */
    expect(panel).not.toMatch(/dragDepth|dropDepth|depth\.current/);
    expect(panel).not.toMatch(/setDragging|setDragOver|setOver\(/);

    const hook = withoutComments(await readFile(HOOK, "utf8"));
    expect(hook).toMatch(/(\w+)\.current \+= 1;/);
    expect(hook).toMatch(/(\w+)\.current = Math\.max\(0, \1\.current - 1\);/);
    expect(hook).toMatch(/if \((\w+)\.current === 0\) set\w+\(false\);/);
  });

  it("guards the near miss, FILES ONLY, and only where the door exists", async () => {
    /*
      A drop that misses the box navigates the tab to the file and takes her
      typed ask and her place in the viewer with it — the browser's default
      wherever the page has claimed nothing, and the sheet page claims nothing
      today. The moment the box invites a photograph, that is one hand's width
      away.

      ⚠ BOTH NARROWINGS ARE LOAD-BEARING AND BOTH WERE PAID FOR ONCE ALREADY ON
      THE CONCEPT CARD. A bare `preventDefault` cancels EVERY drop on the page,
      which took dragging selected TEXT into a textarea away from everyone
      inside that flag; and mounting it unconditionally would change the
      browser's own behaviour for an account with no door at all.
    */
    const panel = await panelCode();
    const guard = panel.slice(
      panel.indexOf("if (!hasAttachDoor) return;"),
      panel.indexOf("}, [hasAttachDoor]);"),
    );
    expect(guard.length).toBeGreaterThan(0);
    expect(guard).toContain('dataTransfer?.types?.includes("Files")');
    expect(guard).toContain("event.preventDefault();");
    expect(guard).toContain('window.addEventListener("dragover", swallow);');
    expect(guard).toContain('window.addEventListener("drop", swallow);');
    /* Taken down with the panel — a listener that outlives its surface is a
       page-wide behaviour nobody can find the owner of. */
    expect(guard).toContain('window.removeEventListener("dragover", swallow);');
    expect(guard).toContain('window.removeEventListener("drop", swallow);');
  });

  it("says what happens to her PICTURE, never what carries it", () => {
    /*
      The disappearing-technology law, clause 6: a word on a path she must walk
      names the intention, never the machinery. *Attach* is this door's own word
      everywhere else on the surface, so the word she reads mid-drag is the word
      she reads after it lands.
    */
    expect(ATTACH_DROP_WORD.toLowerCase()).toContain("drop");
    expect(ATTACH_DROP_WORD.toLowerCase()).toContain("attach");
    expect(ATTACH_DROP_WORD).not.toMatch(
      /upload|file|jpe?g|png|webp|byte|\bmb\b|blob|dataTransfer|base64/i,
    );
    /* Short, because it stands over a box she is already looking at. */
    expect(ATTACH_DROP_WORD.length).toBeLessThan(44);
  });
});
