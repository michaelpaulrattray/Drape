import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { INK_REFERENCE_DROP_WORD } from "./InkAddPanel";

/**
 * CARD 1118 — the ink panel's *attach a reference picture* button took a
 * dropped picture and never answered the hand holding one.
 *
 * It is the law-7 sibling of #1087, and his words on that dialog describe this
 * button exactly: *"when i drag the new image over the old image and am holding
 * it over the old image before dropping to replace it the card doesnt highlight
 * or indicate im about to drop a new image in e.g it feels unresponsive."*
 *
 * What shipped here was `onDragOver={(event) => event.preventDefault()}` and
 * nothing else — no `dragenter`, no `dragleave`, no over-state of any kind. The
 * drop LANDED; that was never the defect. The dashed border the button wears is
 * a permanent hint, not an answer: it looked identical whether a picture was
 * over it or the pointer was on the other side of the screen.
 *
 * ⚠ **THE ARMS BELOW PIN THE SHARED HOOK, NOT A SECOND COPY OF THE COUNTING.**
 * A hand-rolled depth counter in this file would pass an arm that only asked
 * "does an over-state exist", and would then drift from the dialog's — which is
 * working law 4 with a UI accent. The counting lives once, in
 * `foundation/useFileDropTarget.ts`, and `conceptUpload.test.ts` owns the arms
 * about its behaviour.
 */
const PANEL = new URL("./InkAddPanel.tsx", import.meta.url);
const HOOK = new URL("../../../foundation/useFileDropTarget.ts", import.meta.url);

/** The prose says what the code must do; only the CODE is the subject. */
function withoutProse(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("the ink panel's reference button answers the hand holding a picture", () => {
  it("draws its over-state from its OWN zone, counted by the shared hook", async () => {
    const panel = withoutProse(await readFile(PANEL, "utf8"));

    /*
      THE WHOLE FINDING IN ONE PAIR: the button spreads a zone's handlers, and
      that zone's `over` is what changes how it looks. `preventDefault` alone —
      what shipped — satisfies neither.
    */
    expect(panel).toContain("const reference = useFileDropTarget(");
    expect(panel).toContain("{...reference.handlers}");
    expect(panel).toContain("reference.over");

    /* And the dead hand-rolled handler is GONE, not merely bypassed — a second
       drop path on the same element is how one of them stops being read. */
    expect(panel).not.toContain("onDragOver={(event) => event.preventDefault()}");
    expect(panel).not.toContain("const onDrop = ");
  });

  it("changes something a customer can SEE while the picture is in the air", async () => {
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    const button = panel.slice(
      panel.indexOf("{...reference.handlers}"),
      panel.indexOf("workflow.referenceError"),
    );
    expect(button.length).toBeGreaterThan(0);

    /*
      ⚠ THE BORDER IS THE ARM THAT MATTERS AND IT IS A *CHANGE*, NOT A PRESENCE.
      This button was already dashed and already bordered before the fix — an
      arm asserting "it has a border" would have passed against the defect. What
      has to be true is that the border it wears while a file is over it is a
      DIFFERENT one from the border it wears at rest.
    */
    expect(button).toContain("border-canvas-ink");
    expect(button).toContain("border-canvas-border-strong");
    const over = button.slice(button.indexOf("reference.over"));
    expect(over.indexOf("border-canvas-ink")).toBeLessThan(
      over.indexOf("border-canvas-border-strong"),
    );

    /* And the word changes with it — the wash alone is easy to miss on a small
       control that already carries a dashed edge. */
    expect(button).toContain("INK_REFERENCE_DROP_WORD");
  });

  it("says what happens to her PICTURE, never what carries it", () => {
    /*
      The disappearing-technology law, clause 6: a word on a path she must walk
      names the intention, not the machinery. *Attach* is this panel's own word
      — it says "Reference attached" the moment one lands — so the word she
      reads mid-drag is the word she reads after.
    */
    expect(INK_REFERENCE_DROP_WORD.toLowerCase()).toContain("drop");
    expect(INK_REFERENCE_DROP_WORD.toLowerCase()).toContain("attach");
    expect(INK_REFERENCE_DROP_WORD).not.toMatch(
      /upload|file|jpe?g|png|webp|byte|mb|blob|dataTransfer/i,
    );
  });

  it("counts depth in ONE place, which is why this file does not count at all", async () => {
    /*
      ⚠ THE SIBLING DEFECT THIS ARM EXISTS FOR. The cheap fix here was a
      `useState` boolean set on enter and cleared on leave — and it would have
      passed every arm above while flickering off the moment the pointer crossed
      onto the button's own thumbnail or its label, which are children. The
      counting is the load-bearing part and it is not this file's to own.
    */
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    expect(panel).not.toMatch(/\.current \+= 1;/);
    expect(panel).not.toMatch(/setIsDrag|setDragOver|setOver\(/);

    const hook = withoutProse(await readFile(HOOK, "utf8"));
    expect(hook).toMatch(/(\w+)\.current \+= 1;/);
    expect(hook).toMatch(/(\w+)\.current = Math\.max\(0, \1\.current - 1\);/);
    expect(hook).toMatch(/if \((\w+)\.current === 0\) set\w+\(false\);/);
  });

  it("is not lit by a drag carrying no file, and never eats a plain drop", async () => {
    /*
      Two hazards in one arm, both the hook's. Dragging selected TEXT must not
      light a picture target (#199's finding on the card), and `preventDefault`
      on dragover is what MAKES the element a target — without it the browser
      refuses the drop and NAVIGATES THE TAB to the file, taking her unsaved
      tattoo description with it.
    */
    const hook = withoutProse(await readFile(HOOK, "utf8"));
    const enter = hook.slice(hook.indexOf("onDragEnter"), hook.indexOf("onDragOver"));
    expect(enter).toContain('dataTransfer?.types?.includes("Files")');
    const over = hook.slice(hook.indexOf("onDragOver"), hook.indexOf("onDragLeave"));
    expect(over).toContain('dataTransfer?.types?.includes("Files")');
    expect(over).toContain("event.preventDefault();");
  });
});
