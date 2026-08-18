/**
 * THE BLANK FORMS A DESIGN IS PLATED ONTO — code-owned, in the tree, pinned by
 * digest (ruled fable-958 §1 on the recommendation in opus-701 §1).
 *
 * # WHY THEY LIVE IN THE REPOSITORY AND NOT IN R2
 *
 * These are read SERVER-side and posted to an image engine, which is a
 * different job from the static client assets under `assets/` in the bucket
 * (logos, swatches, served by URL). In the tree they are deterministic,
 * versioned with the code that reads them, cost no network round trip on the
 * mint path, and — the load-bearing one — **the bytes the founder approved are
 * the bytes in the commit.**
 *
 * # THE DIGEST IS THE FOUNDER'S APPROVAL, BOUND TO BYTES
 *
 * He approved these by LOOKING at them: near-white over grey (fable-942), one
 * neutral preview rather than a tone ladder (fable-943), and the arm at its full
 * limb rather than cropped at the forearm (fable-955). None of that survives a
 * file being swapped, and nothing downstream could tell — every plate minted
 * from a different template is a different artwork wearing the approved one's
 * name.
 *
 * So each template carries the sha256 his ruling landed on, the suite asserts
 * the file on disk still hashes to it, and the mint refuses rather than plating
 * onto a form nobody has seen. **A silently swapped template is a red suite,
 * never a different tattoo.**
 *
 * # WHAT IS NOT HERE
 *
 * No tone ladder — ruled out of the product, not merely unbuilt (fable-943): the
 * customer-facing preview is ONE NEUTRAL FORM, and the engine adapts ink to a
 * cast's own skin as native capability (fable-935). The archived tone candidates
 * live in `docs/specs/references/templates/ink-template-candidates-panel.png`,
 * which is why that panel is committed.
 *
 * No male form — absent by fable-934 §1a, drawn when needed or at his word.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { InkPlacement } from "../../shared/inkPlacementVocabulary";
import { INK_TEMPLATE_KINDS, type InkTemplateKind } from "../../shared/inkTemplateKinds";

/* The vocabulary is `shared/inkTemplateKinds.ts` — the plate table's enum is
   derived from it, and a second list here would be the parallel copy that
   drifts. Re-exported so this module stays the one place a caller needs. */
export { INK_TEMPLATE_KINDS, type InkTemplateKind };

export type InkTemplate = {
  readonly kind: InkTemplateKind;
  /** Repository-relative, so the failure of a missing file names the file. */
  readonly file: string;
  /** The sha256 of the bytes his ruling landed on. */
  readonly digest: string;
  readonly mime: string;
  /**
   * The form's own pixels.
   *
   * PINNED rather than decoded, and legitimately so: the bytes are pinned by
   * `digest`, so their dimensions are pinned with them — a file that decodes to
   * a different size is a file that hashes differently, and the mint refuses it
   * before ever asking how big it is. The suite reads the real files and
   * compares, so this is a measurement that stays measured rather than a
   * remembered number.
   *
   * The mint needs them because an output canvas is DERIVED from the template's
   * shape, and decoding a known file on every mint to learn a constant would be
   * a round trip bought to re-answer a settled question.
   */
  readonly width: number;
  readonly height: number;
  /**
   * THE VIEWS ON THE SHEET, left to right — and this field exists because its
   * absence cost a court (2026-08-18).
   *
   * Every committed template shows ONE form from several angles: the arm sheet
   * side / middle / back, the body sheet front / back. The plate prompt was
   * written for a template with one view and said so — *"a plain, featureless
   * mannequin form"*, then *"leave every other part of the form completely
   * bare"* — so the engine drew the design on the first view and left the other
   * two blank, which is exactly what it was told to do. The wrap court's first
   * plate came back with a serpent on the side view and two bare arms beside it.
   *
   * So the sheet's shape is DATA the prompt derives from rather than prose one
   * file remembers about another. A fourth view, or a new form with one, moves
   * the sentence by moving this list.
   */
  readonly views: readonly string[];
};

/**
 * The two forms, and the two digests.
 *
 * `arm` is the three-rotation turnaround — side, middle, back (founder ruling,
 * fable-964 §2). A wrap-around design has to stay consistent from every angle,
 * which is the property the first near-white version failed and the redo bought
 * with the elbow (fable-949 §2, fable-954 §1); whether a SHEET of angles reads
 * as one design at all is the wrap court, which runs after the render wiring.
 * `body` is front and back on one plate.
 */
export const INK_TEMPLATES: Readonly<Record<InkTemplateKind, InkTemplate>> = Object.freeze({
  arm: Object.freeze({
    kind: "arm",
    file: "assets/ink/arm-template.png",
    /*
      THE THREE-VIEW SHEET (founder ruling, fable-964 §2: "3 angles should be
      locked we dont need 4"). Side, middle, back.

      RE-LAID, NOT RE-DRAWN, and that is the fidelity choice: the three views
      are the founder-approved pixels at their NATIVE size, cropped out of the
      four-view sheet and set on a canvas a quarter narrower. Nothing is
      interpolated, so nothing is softened — and each view occupies a third of
      the frame rather than a quarter, which is the "bigger" that costs nothing.
      The dropped view was the second SIDE, chosen by measurement rather than by
      eye: it was the closest of any pair to the middle view (mean abs diff
      27.5 against 34.7 for the side that stayed), so it carried the least new
      information.

      The superseded four-view sheet is kept in
      `docs/specs/references/templates/superseded/` — the record says the sheet
      changed BY RULING, not silently.
    */
    digest: "371e9e2461b773edfac012e5373ae4f493b24702b0d43a5f0af128b52381bd36",
    mime: "image/png",
    width: 1152,
    height: 1024,
    views: ["side", "middle", "back"],
  }),
  body: Object.freeze({
    kind: "body",
    file: "assets/ink/body-template.png",
    digest: "65a478cc55bf03e2230f1ace55c8306b01928b0be3b173902e149e725a389ced",
    mime: "image/png",
    /* NOT a multiple of 16, which GPT Image 2's edit endpoint requires of an
       output canvas — `legalPlateCanvas` asks for 1248 and the plate comes back
       the same square his ruling landed on, six pixels smaller. Measured before
       it was paid for; see `inkPlateEngines.ts`. */
    width: 1254,
    height: 1254,
    views: ["front", "back"],
  }),
});

/**
 * WHICH FORM A PLACEMENT IS PLATED ONTO — a total function over the vocabulary,
 * so a fourth placement earned tomorrow does not compile until somebody has
 * decided which blank form it belongs to.
 *
 * That totality is `bodyAnchorRegions`' own method and it is here for the same
 * reason: a default would silently plate a new surface onto whichever form was
 * listed first, and nothing would say so.
 */
const TEMPLATE_FOR: Readonly<Record<InkPlacement, InkTemplateKind>> = Object.freeze({
  neck: "body",
  upperArm: "arm",
  upperChest: "body",
});

export function inkTemplateFor(placement: InkPlacement): InkTemplate {
  return INK_TEMPLATES[TEMPLATE_FOR[placement]];
}

export type LoadedInkTemplate = {
  readonly template: InkTemplate;
  readonly bytes: Buffer;
  /** What the file on disk actually hashes to — never assumed from the pin. */
  readonly digest: string;
};

/**
 * Read a template off disk and hash what was read.
 *
 * It returns the digest it MEASURED rather than the one it expected, and the
 * comparison is the door's job (`inkPlateTemplateRefusal`). A loader that
 * checked its own pin and returned a boolean would be a reader grading itself;
 * this hands the caller the fact and lets the refusal be driven directly.
 *
 * `null` is *the file is not there* — a deploy that lost an asset — which the
 * door tells apart from a file that is there and wrong.
 */
export async function loadInkTemplate(
  template: InkTemplate,
  root: string = process.cwd(),
): Promise<LoadedInkTemplate | null> {
  try {
    const bytes = await readFile(path.resolve(root, template.file));
    return { template, bytes, digest: createHash("sha256").update(bytes).digest("hex") };
  } catch {
    return null;
  }
}
