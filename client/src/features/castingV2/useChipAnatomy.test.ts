import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { referencesOf } from "../../../../server/castingV2/refineService";

/**
 * THE "USE" CHIP — what it shows, and what pressing it actually resubmits.
 *
 * FOUNDER RULING, verbatim (fable-1419 §2):
 *
 * > *"the only reference that go into that box are ones you use to generate the
 * > previous image with e.g i upload a reference on the previous image and say
 * > copy her hair that would ride in this box not her horns. that way when i
 * > press use im essentially regenerating the exact same prompt + reference
 * > image i used to generate this image so then i regenerate it again"*
 *
 * The chip used to show EVERY reference the render carried — her master, and
 * the carry crop of the horns she asked for four renders ago. Those are
 * MACHINERY. She did not attach them, they are not part of her ask, and listing
 * them turns *replay my ask* into a list of our internals.
 *
 * ⚠ **AND THE SECOND HALF OF HIS SENTENCE IS NOT BUILT.** *Use* fills the ask
 * box with the sentence and stops; it does not re-attach the picture. So
 * *"the exact same prompt + reference image"* is, today, the prompt. That is
 * filed rather than hidden — the arm below asserts what the button DOES, so the
 * gap is a red test away from anyone who assumes otherwise, and it is a founder
 * question whether Use should carry the attachment back with it.
 */
const PANEL = new URL("./components/RefinePanel.tsx", import.meta.url);

/** The code with its prose removed — a comment quoting a rule must not be
 *  mistaken for the rule being kept. */
const withoutProse = (source: string): string => source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("what the chip shows", () => {
  const recipe = (kinds: { key: string; kind: string; slot: string | null }[]) => ({
    repaint: { references: kinds.map((one) => ({ ...one, digest: "d", sentGeometry: "1x1" })) },
  });

  it("shows the picture she attached and NOT the machinery beside it", () => {
    const projected = referencesOf(recipe([
      { key: "casting-v2/candidates/master.png", kind: "master", slot: null },
      { key: "casting-v2/library/horns.png", kind: "carry", slot: "open:horns" },
      { key: "casting-v2/reference-attachments/hers.png", kind: "source", slot: "hair" },
    ]));
    expect(projected.map((one) => one.slot)).toEqual(["hair"]);
    /* His own example, both halves: the hair reference he uploaded rides in the
       box, and the horns do not. */
    expect(JSON.stringify(projected)).not.toContain("horns");
    expect(JSON.stringify(projected)).not.toContain("master");
  });

  it("shows nothing at all on a render she attached nothing to", () => {
    /* Almost every render. The honest chip is the sentence with no thumbnails,
       never a row of pictures she has no memory of choosing. */
    expect(referencesOf(recipe([
      { key: "casting-v2/candidates/master.png", kind: "master", slot: null },
    ]))).toEqual([]);
  });
});

describe("what pressing Use actually does", () => {
  it("⚠ FILLS THE BOX WITH THE SENTENCE AND SENDS NOTHING — prefill, never spend", async () => {
    /*
      Spending her credits is a deliberate act and stays one. `Use` prefills and
      stops, so the sentence is hers to edit and the duplicate warning fires for
      it exactly as it does for anything typed by hand.
    */
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    expect(panel).toContain("onClick={() => setInstruction(selectedRequest)}");
    /* And it is not wired to the submit path — a Use that spent would be a
       button that charges 25 credits for a click labelled with a verb. */
    expect(panel).not.toContain("onClick={() => submit(selectedRequest)");
  });

  it("⚠ DOES NOT RE-ATTACH THE PICTURE — the half of his sentence that is not built", async () => {
    /*
      His words are *"the exact same prompt + reference image"*. Today Use
      carries the prompt. The chip now shows exactly the pictures that rode, so
      the two sit next to each other and the gap is visible rather than assumed
      away.

      This arm is deliberately an assertion of ABSENCE with its own control
      below: if somebody builds the re-attach, this goes red and they read the
      note rather than discovering the ruling afterwards.
    */
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    const use = panel.slice(panel.indexOf("dpc-refine__madeUse"), panel.indexOf("dpc-refine__madeUse") + 320);
    expect(use).toContain("setInstruction(selectedRequest)");
    expect(use).not.toContain("setPicture");
    expect(use).not.toContain("referenceId");
  });

  it("CONTROL — the panel really does know how to attach a picture", async () => {
    /* Without this, the absence above could pass on a file that had no attach
       machinery at all, which would prove nothing about Use. */
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    expect(panel).toContain("setPicture");
  });
});
