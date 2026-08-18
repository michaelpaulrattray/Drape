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
