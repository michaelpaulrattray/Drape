import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { SEXES } from "../../shared/castingVocabularies";
import { INK_PLACEMENTS } from "../../shared/inkPlacementVocabulary";
import { INK_SIDES, sidesForInkPlacement } from "../../shared/inkReleasedPlacements";
import {
  EVERY_INK_TEMPLATE,
  INK_TEMPLATES,
  inkTemplateByDigest,
  inkTemplateFor,
  loadInkTemplate,
} from "./inkTemplates";

const ROOT = path.resolve(__dirname, "../..");

describe("the blank forms a design is plated onto", () => {
  /*
    THE ASSERTION THIS FILE EXISTS FOR.

    The founder approved these by LOOKING at them — the arm pair in his folder
    ("i seen the male templates in the folder already they look good", and
    "looks good" on the arm before it), the torso quartet under his blanket
    pre-approval of the finished set. None of that survives a file being
    swapped, and every plate minted from a different template would be a
    different artwork wearing the approved one's name.

    So his approval is bound to bytes: a silently swapped template is a RED
    SUITE, never a different tattoo.
  */
  it("still hashes to the bytes his ruling landed on", async () => {
    for (const template of EVERY_INK_TEMPLATE) {
      const bytes = await readFile(path.resolve(ROOT, template.file));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(template.digest);
    }
  });

  it("holds SIX blanks and every digest is its own", () => {
    /* Six, and six DISTINCT — a copy-paste that left two entries sharing a
       digest would make `inkTemplateByDigest` answer confidently with the
       wrong form, which is precisely the archaeology the lookup exists to
       replace. */
    expect(EVERY_INK_TEMPLATE).toHaveLength(6);
    expect(new Set(EVERY_INK_TEMPLATE.map((one) => one.digest)).size).toBe(6);
    expect(new Set(EVERY_INK_TEMPLATE.map((one) => one.file)).size).toBe(6);
  });

  it("reads a template off disk and reports what it MEASURED", async () => {
    const loaded = await loadInkTemplate(INK_TEMPLATES.armLeft, ROOT);
    expect(loaded).not.toBeNull();
    expect(loaded!.digest).toBe(INK_TEMPLATES.armLeft.digest);
    expect(loaded!.bytes.byteLength).toBeGreaterThan(100_000);
  });

  it("answers NOTHING for a file that is not there — a deploy that lost an asset", async () => {
    /* The negative arm, and it is not decoration: without it the loader could
       be returning a fixed digest and the test above would still pass. */
    const missing = await loadInkTemplate(
      { ...INK_TEMPLATES.armLeft, file: "assets/ink/there-is-no-such-form.png" },
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
    for (const template of EVERY_INK_TEMPLATE) {
      const meta = await sharp(path.resolve(ROOT, template.file)).metadata();
      expect({ width: meta.width, height: meta.height })
        .toEqual({ width: template.width, height: template.height });
    }
  });

  it("shows ONE view on every blank — the spec, asserted rather than remembered", () => {
    /*
      THE PIN THE WRAP COURT BOUGHT, now pointing the other way.

      It used to assert that the neck's form carried TWO views, because that was
      the fact behind two behaviours: the nape gets inked, AND the tattoo can
      arrive twice. The second sitting measured what the first could not see —
      `sideClose` and `threeQuarter` show the neck turning, both plate surfaces
      are plausibly in frame at once, and the engine drew both: a complete
      "SEMPRE" and sprig on the side of the neck and a second "SEM" and sprig
      behind it, bare skin between them. One customer's tattoo, two copies, on
      two of the five package views.

      So the single-view spec (founder, fable-989/990) removes the doubling and
      costs the back half of a genuine wrap — declared in `inkTemplates.ts`'
      own docblock as an accepted narrowing rather than left to whichever blank
      the routing happens to name.

      What decides both behaviours is `views`, not prose. This goes red the
      moment it moves, in either direction, which is the whole point of it.
    */
    for (const template of EVERY_INK_TEMPLATE) {
      expect(template.views).toHaveLength(1);
    }
    expect(inkTemplateFor({ placement: "neck", side: "centre", build: "female" }))
      .toEqual({ ok: true, template: INK_TEMPLATES.bodyFemaleFront });
  });

  it("names a form for EVERY placement, side and build the vocabularies hold", () => {
    /*
      TOTAL over three vocabularies at once, so nothing reachable falls to a
      default. `sidesForInkPlacement` is what a real caller is constrained by —
      the upload door refuses any other pairing before a row exists — so every
      tuple it can produce must resolve, for both builds that have a form.
    */
    for (const placement of INK_PLACEMENTS) {
      for (const side of sidesForInkPlacement(placement)) {
        for (const build of ["female", "male"] as const) {
          const choice = inkTemplateFor({ placement, side, build });
          expect(choice.ok).toBe(true);
          expect(EVERY_INK_TEMPLATE).toContain(choice.ok ? choice.template : null);
        }
      }
    }
    expect(SEXES).toContain("nonbinary");
  });

  it("plates the arm by the SIDE — because the picture carries the side, not the words", () => {
    /*
      THE MIRROR COURT'S FIX, asserted at the seam it landed on (2026-08-19).

      Five renders across three different claims — two carrying an explicit
      positional clause pointing the opposite way — put the ink on the image's
      LEFT arm every time; the same claim with the plate bytes MIRRORED landed
      on the image's right 3/3 against 2/2 as-is, interleaved in one sitting.
      The ink follows the plate's own geometry, so the side has to ride as
      geometry: a left-arm design plates onto the left-facing blank.

      What this test does NOT claim is which arm the delivered frame ends up
      carrying. That correspondence was measured on the retired three-view
      sheet, where the limb occupied a half of the frame; a single-limb plate
      has no frame half, and the re-run is owed. This asserts the routing, which
      is the part that is ours.
    */
    const left = inkTemplateFor({ placement: "upperArm", side: "left", build: "female" });
    const right = inkTemplateFor({ placement: "upperArm", side: "right", build: "female" });
    expect(left).toEqual({ ok: true, template: INK_TEMPLATES.armLeft });
    expect(right).toEqual({ ok: true, template: INK_TEMPLATES.armRight });
    /* The arm is one bare limb: the build must not change which blank it is. */
    for (const build of SEXES) {
      expect(inkTemplateFor({ placement: "upperArm", side: "left", build }))
        .toEqual({ ok: true, template: INK_TEMPLATES.armLeft });
    }
  });

  it("REFUSES a torso design for a build with no form, and never routes it to one", () => {
    /*
      Ruled fable-1025 §1. The two roads not taken are both worse than refusing:
      routing by the label infers a BODY from an IDENTITY (working law 8
      backwards), and reading the cast's frame spends a vision call answering a
      question the product has not decided.

      Driven on BOTH torso placements and on the absent build as well as the
      third one, because "no form" has two causes and a guard that handled only
      the named case would let a Cast with no stated sex fall to the female
      blank — which is the room calling every Cast "she", with a picture
      attached.
    */
    for (const placement of ["neck", "upperChest"] as const) {
      expect(inkTemplateFor({ placement, side: "centre", build: "nonbinary" }))
        .toEqual({ ok: false, reason: "noFormForBuild" });
      expect(inkTemplateFor({ placement, side: "centre", build: null }))
        .toEqual({ ok: false, reason: "noFormForBuild" });
    }
    /* The ARM is unaffected — the refusal must not have widened to the limb. */
    expect(inkTemplateFor({ placement: "upperArm", side: "right", build: "nonbinary" }).ok)
      .toBe(true);
  });

  it("refuses an arm side the vocabulary cannot mean, rather than defaulting to one", () => {
    /* `upperArm:centre` is refused by the upload door before a row exists, so
       this is unreachable through the product — and it is asserted anyway,
       because a total function with a hole is a hole a fourth caller finds.
       Mapping it silently to the left arm is the smuggled default. */
    expect(INK_SIDES).toContain("centre");
    expect(inkTemplateFor({ placement: "upperArm", side: "centre", build: "female" }))
      .toEqual({ ok: false, reason: "noFormForBuild" });
  });

  it("answers WHICH blank from a digest — the kind names the family, the digest the member", () => {
    /*
      Rider two of fable-1032 §3, and the reason the enum was not widened. A row
      that says `body` is the FAMILY; a reader wanting the exact form reads the
      digest, and this is that read as a function call rather than a hunt
      through the source tree.
    */
    for (const template of EVERY_INK_TEMPLATE) {
      expect(inkTemplateByDigest(template.digest)).toBe(template);
    }
    expect(inkTemplateByDigest("0".repeat(64))).toBeNull();
    /* The kinds are still exactly the two families, and both are still true. */
    expect(new Set(EVERY_INK_TEMPLATE.map((one) => one.kind))).toEqual(new Set(["arm", "body"]));
  });

  it("points at the code-owned path, never at the evidence directory", () => {
    /* fable-958 §1: moved, not duplicated. The prompt, the pre-crop source and
       the candidates panel stay in `docs/specs/references/templates/` as
       provenance; the file a mint READS lives in the tree it ships with. Two
       copies of an approved asset is the parallel copy that drifts, and here the
       drift would be a different tattoo. */
    for (const template of EVERY_INK_TEMPLATE) {
      expect(template.file.startsWith("assets/ink/")).toBe(true);
      expect(template.file).not.toContain("docs/");
    }
  });

  it("keeps the arm pair a MIRROR PAIR, in the bytes", async () => {
    /*
      The two arms are the same limb by CONSTRUCTION — the right is `flop()` of
      the left — and that is a property of the files, so it is asserted of the
      files. If someone regenerates one of them, this goes red rather than the
      product quietly holding two subtly different limbs and calling them a
      pair.

      The control is the same comparison WITHOUT the flip, which must not pass:
      a checker that cannot fail has said nothing.
    */
    const left = await sharp(path.resolve(ROOT, INK_TEMPLATES.armLeft.file)).raw().toBuffer();
    const right = await sharp(path.resolve(ROOT, INK_TEMPLATES.armRight.file)).raw().toBuffer();
    const flopped = await sharp(path.resolve(ROOT, INK_TEMPLATES.armLeft.file))
      .flop().raw().toBuffer();
    expect(right.equals(flopped)).toBe(true);
    expect(right.equals(left)).toBe(false);
  });

  it("lands every blank on ONE field value, which is what makes the set read as a set", async () => {
    /*
      fable-1031 bound (b), asserted rather than remembered. Measured on the
      border ring, which is field on every one of the six: the torso quartet
      came off the composite at exactly 254, and the arm pair was brought onto
      the same value — it arrived carrying a one-pixel ~237 frame and a field
      dithered across 253/254/255, and a plate prompt that ends "no border" must
      not hand the engine a picture with one.
    */
    for (const template of EVERY_INK_TEMPLATE) {
      const file = path.resolve(ROOT, template.file);
      const { width = 0, height = 0 } = await sharp(file).metadata();
      const raw = await sharp(file).raw().toBuffer();
      const seen = new Set<string>();
      const at = (x: number, y: number) => {
        const i = (y * width + x) * 3;
        seen.add(`${raw[i]},${raw[i + 1]},${raw[i + 2]}`);
      };
      for (let x = 0; x < width; x += 1) { at(x, 0); at(x, height - 1); }
      for (let y = 1; y < height - 1; y += 1) { at(0, y); at(width - 1, y); }
      expect({ form: template.name, field: Array.from(seen) }).toEqual({
        form: template.name,
        field: ["254,254,254"],
      });
    }
  });
});
