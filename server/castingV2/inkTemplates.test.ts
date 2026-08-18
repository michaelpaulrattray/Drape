import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { INK_PLACEMENTS } from "../../shared/inkPlacementVocabulary";
import {
  INK_TEMPLATES,
  inkTemplateFor,
  loadInkTemplate,
} from "./inkTemplates";

const ROOT = path.resolve(__dirname, "../..");

describe("the blank forms a design is plated onto", () => {
  /*
    THE ASSERTION THIS FILE EXISTS FOR.

    The founder approved these by LOOKING at them — near-white over grey
    (fable-942), one neutral form rather than a tone ladder (fable-943), the arm
    at its full limb rather than cropped (fable-955). None of that survives a
    file being swapped, and every plate minted from a different template would be
    a different artwork wearing the approved one's name.

    So his approval is bound to bytes: a silently swapped template is a RED
    SUITE, never a different tattoo.
  */
  it("still hashes to the bytes his ruling landed on", async () => {
    for (const template of Object.values(INK_TEMPLATES)) {
      const bytes = await readFile(path.resolve(ROOT, template.file));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(template.digest);
    }
  });

  it("reads a template off disk and reports what it MEASURED", async () => {
    const loaded = await loadInkTemplate(INK_TEMPLATES.arm, ROOT);
    expect(loaded).not.toBeNull();
    expect(loaded!.digest).toBe(INK_TEMPLATES.arm.digest);
    expect(loaded!.bytes.byteLength).toBeGreaterThan(100_000);
  });

  it("answers NOTHING for a file that is not there — a deploy that lost an asset", async () => {
    /* The negative arm, and it is not decoration: without it the loader could
       be returning a fixed digest and the test above would still pass. */
    const missing = await loadInkTemplate(
      { ...INK_TEMPLATES.arm, file: "assets/ink/there-is-no-such-form.png" },
      ROOT,
    );
    expect(missing).toBeNull();
  });

  it("carries the pixels the files actually have", async () => {
    /*
      THE PINNED SIZE IS A MEASUREMENT THAT STAYS MEASURED.

      The mint derives an output canvas from these numbers rather than decoding a
      known file on every mint. That is only legitimate while they are the file's
      own — so they are read off the real bytes here, not remembered. Pinning is
      safe for the same reason the digest is: bytes that decode to a different
      size hash differently, and the mint refuses those before asking how big
      they are.
    */
    for (const template of Object.values(INK_TEMPLATES)) {
      const meta = await sharp(path.resolve(ROOT, template.file)).metadata();
      expect({ width: meta.width, height: meta.height })
        .toEqual({ width: template.width, height: template.height });
    }
  });

  it("names a form for EVERY placement the vocabulary holds", () => {
    /* Total over the vocabulary, so a fourth placement earned tomorrow does not
       compile until somebody decides which blank form it belongs to. A default
       would plate a new surface onto whichever form was listed first and say
       nothing. */
    for (const placement of INK_PLACEMENTS) {
      const template = inkTemplateFor(placement);
      expect(Object.values(INK_TEMPLATES)).toContain(template);
    }
    expect(inkTemplateFor("upperArm").kind).toBe("arm");
    expect(inkTemplateFor("neck").kind).toBe("body");
    expect(inkTemplateFor("upperChest").kind).toBe("body");
  });

  it("gives the NECK a form with TWO views — which is why one tattoo can arrive as two", () => {
    /*
      MEASURED, the neck court (2026-08-19, ordered fable-1008 §4a).

      The neck is the released vocabulary's third placement and no arm had ever
      been run on it. The plate was minted and LOOKED AT before any arm was
      written, which is the round-one mislabel lesson applied at scoping time:
      the body form has a front view and a back view, the plate prompt draws the
      design on each so a wrap-around design reads as one design from every
      angle, and the minted neck plate therefore carries the artwork on the
      FRONT of the neck and again on the NAPE.

      So `backFull` is a must-SHOW arm for a neck design, not a must-not — and
      the render agreed: the sprig and its lettering arrived on the nape, ink on
      skin, the tee untouched. Had the arm been labelled must-not from the
      placement's name, a correct frame would have been filed as a bleed.
      (`output/view-reference-court/r6-neck-backFull.png`; closeUp and frontFull
      passed in the same sitting.)

      **AND THE SECOND SITTING OVERTURNED WHAT THAT SEEMED TO MEAN.** The two
      views the plate carries are not only why the nape is inked — they are why
      the tattoo can arrive TWICE. `sideClose` and `threeQuarter` show the neck
      turning, so both plate surfaces are plausibly in frame at once, and the
      engine drew both: a complete "SEMPRE" and sprig on the side of the neck
      and a second "SEM" and sprig behind it, bare skin between them. One
      tattoo, two copies, on two of the five package views
      (`output/view-reference-court/r7-neck-sideClose.png`).

      The clause's own "do not draw a second copy of it" cannot prevent it: from
      the engine's side nothing is duplicated — the reference picture contains
      the artwork twice and it is copying the picture, the same carrier law that
      decides which arm the side rides on. The three passing arms passed because
      only ONE plate surface was visible in each framing, which is a property of
      those framings rather than of the plate.

      **THIS IS THE PIN.** What decides both behaviours is `views`, not prose.
      The universal single-view spec (§7.10 of
      `V3B_INK_AND_MARKS_DESIGN_NOTE.md`, founder rulings fable-989/990) retires
      the front-and-back sheet for one-view plates — which removes the doubling
      and costs the back half of a genuine wrap. That is a decision the template
      commit must make out loud, and this test goes red the moment `views`
      moves, which is the whole point of it.
    */
    const template = inkTemplateFor("neck");
    expect(template.kind).toBe("body");
    expect(template.views).toContain("front");
    expect(template.views).toContain("back");
  });

  it("points at the code-owned path, never at the evidence directory", () => {
    /* fable-958 §1: moved, not duplicated. The prompt, the pre-crop source and
       the candidates panel stay in `docs/specs/references/templates/` as
       provenance; the file a mint READS lives in the tree it ships with. Two
       copies of an approved asset is the parallel copy that drifts, and here the
       drift would be a different tattoo. */
    for (const template of Object.values(INK_TEMPLATES)) {
      expect(template.file.startsWith("assets/ink/")).toBe(true);
      expect(template.file).not.toContain("docs/");
    }
  });
});
