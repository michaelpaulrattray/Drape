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
 * He approved these by LOOKING at them. None of what he looked at survives a
 * file being swapped, and nothing downstream could tell — every plate minted
 * from a different template is a different artwork wearing the approved one's
 * name.
 *
 * So each template carries the sha256 his ruling landed on, the suite asserts
 * the file on disk still hashes to it, and the mint refuses rather than plating
 * onto a form nobody has seen. **A silently swapped template is a red suite,
 * never a different tattoo.**
 *
 * # THE SPEC: ONE VIEW PER PLATE, ONE FIELD, GREYSCALE (founder, fable-989/990)
 *
 * *"not multiple different angles as its confusing to the image engine wrapping
 * is just difficult to understand"*; *"greyscale like this also same
 * background, same colors"*; *"a right facing and left facing arm"*; *"all
 * other tatto references like front/back or legs should follow this aswell."*
 *
 * The turnarounds are RETIRED — the arm's three rotations and the body's
 * front-and-back sheet both go, and they go because a multi-view sheet was
 * measured to read as ONE DESIGN PER VIEW rather than as one design seen
 * several ways (the wrap court, 2026-08-19: a neck plate's two surfaces came
 * back as two complete tattoos with bare skin between them, on the two package
 * views that show the neck turning). The superseded sheets are kept under
 * `docs/specs/references/templates/superseded/` — the record says the set
 * changed BY MEASUREMENT, not silently.
 *
 * # WHAT A GENUINE WRAP PLATES ONTO — DECLARED, and the answer today is NO
 *
 * The wrap court's own consequence, stated here rather than left to whichever
 * blank the routing happens to name (ordered fable-1010 §2). A design that
 * genuinely continues around a surface — round the neck, round the limb — has
 * no form in this set that can carry it: every blank shows exactly one face of
 * one form, so a wrap can only be plated as the half that faces the camera.
 * **That is an accepted narrowing, recorded as a decision.** It costs the back
 * half of a wrapping piece and it buys the removal of a defect that turned one
 * customer's tattoo into two on two of five package views. The alternatives —
 * a blank drawn at an angle that carries the whole wrap, or a design that
 * DECLARES whether it wraps — stay available and neither is built. Nothing
 * sells a wrap meanwhile — though NOT for the reason this line once implied:
 * `RELEASED_INK_TUPLES` is empty AND is consulted by no door at all (fable-1064
 * §3); what holds today is `MANNEQUIN_ROAD_DEFERRED`. No tuple has
 * earned release at all.
 *
 * # WHAT IS NOT HERE
 *
 * No tone ladder — ruled out of the product, not merely unbuilt (fable-943):
 * the customer-facing preview is ONE NEUTRAL FORM, and the engine adapts ink to
 * a cast's own skin as native capability (fable-935). The archived tone
 * candidates live in
 * `docs/specs/references/templates/ink-template-candidates-panel.png`.
 *
 * No third body form. `SEXES` has three members and this set has two torso
 * forms, so a nonbinary cast has no torso blank and {@link inkTemplateFor}
 * REFUSES rather than picking one — see {@link InkTemplateChoice}. The arm is
 * one bare limb and serves every cast.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Sex } from "../../shared/castingVocabularies";
import type { InkPlacement } from "../../shared/inkPlacementVocabulary";
import type { InkSide } from "../../shared/inkReleasedPlacements";
import { INK_TEMPLATE_KINDS, type InkTemplateKind } from "../../shared/inkTemplateKinds";

/* The vocabulary is `shared/inkTemplateKinds.ts` — the plate table's enum is
   derived from it, and a second list here would be the parallel copy that
   drifts. Re-exported so this module stays the one place a caller needs. */
export { INK_TEMPLATE_KINDS, type InkTemplateKind };

/** The builds a torso blank exists for. `nonbinary` is absent BY ABSENCE. */
export type InkTemplateBuild = "female" | "male";

export type InkTemplate = {
  /**
   * The FAMILY, and the value written to `casting_ink_plates.templateKind`.
   * Which member of the family this is comes off `digest` — see
   * `shared/inkTemplateKinds.ts` and {@link inkTemplateByDigest}.
   */
  readonly kind: InkTemplateKind;
  /** How a person names this blank in a report. Never a customer-facing word. */
  readonly name: string;
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
   * THE VIEWS ON THE SHEET, left to right — ONE, on every blank in this set,
   * and the field stays because its absence cost a court (2026-08-18).
   *
   * The plate prompt derives its count, its view names and its meet-correctly
   * clause from this list rather than remembering a sentence about another
   * file. When the set held turnarounds, a prompt written for one view drew the
   * design once and left two views bare; now the set holds single views and the
   * multi-view sentences fall out of the prompt on their own. A form with two
   * views arriving tomorrow moves the sentence by moving this list, and
   * `inkTemplates.test.ts` goes red the moment it moves.
   */
  readonly views: readonly string[];
  /**
   * WHICH ARM THIS PICTURES — `null` on the torso forms, which are not lateral.
   *
   * **This field once carried the sentence *"the side is carried by the
   * PICTURE, not by the prompt"*, and the single-view court has taken that
   * sentence away** — see the header. The three-view measurement it rested on
   * still stands (flip a sheet whose limb occupies a frame HALF and the ink
   * crosses), but it was generalized into a rule, and on a single-limb blank
   * the rule is false: two arms carrying the same limb and the same artwork
   * orientation landed on opposite arms, and thirteen renders of fifteen went
   * to the image's right whatever the plate showed.
   *
   * So the field stays for what it honestly is — **which limb this blank
   * DEPICTS**, so a design is drawn on the anatomy it belongs to and a plate
   * row can say which blank it stood on. It is not a lever on where the ink
   * lands, and a reader who believes it is will reach for it as a fix.
   */
  readonly side: InkSide | null;
  /**
   * WHICH BUILD THIS WAS DRAWN FOR — `null` on the arm, which is one bare limb
   * and serves every cast.
   */
  readonly build: InkTemplateBuild | null;
};

/**
 * THE SIX BLANKS.
 *
 * The arm pair is the founder's own reference photograph, cleaned — every
 * tattoo and the monogram removed, everything else held — with the right arm
 * taken as `flop()` of the left, so the two are the same limb BY CONSTRUCTION
 * rather than by a second generation agreeing with the first. Its field was
 * then flattened onto the set's one value: the source carried a one-pixel ~237
 * frame around the whole plate and a field dithered across 253/254/255, and a
 * plate prompt that ends *"no border"* must not hand the engine a picture with
 * one. Only near-white moved — every pixel below 253 is byte-identical to what
 * he approved, measured `max delta 0`
 * (`scripts/build-ink-arm-blank-field-disposable.mts`, controls printed on
 * every run).
 *
 * The torso quartet is a composite on one flat 254 field, his approved torso
 * pixels preserved byte for byte outside the arm zones. The female BACK carries
 * a uniform +1 against its own source (`mean 1.00 max 1`) — its field was 253
 * where the set's is 254, and fable-1033 §1 ruled the DC offset in because THE
 * SET IS THE UNIT: a 253 plate beside three 254s is a visible seam in the thing
 * his eye actually judges, while a uniform +1 preserves every relationship in
 * the image.
 *
 * **Which arm is which is the eye's reading, and the court has now run — the
 * naming is right and IT IS NOT WHAT DECIDES.**
 *
 * The left blank is called the left arm because its medial contour — the
 * axillary fold the limb turns in on — sits on the image's left and its lateral
 * contour, deltoid and elbow, on the image's right, which is how a subject's
 * LEFT arm presents in a front-facing frame. Fifteen house renders on one
 * candidate settled what that naming buys
 * (`scripts/court-single-view-arm-mirror-disposable.mts` and its two
 * extensions; every frame read by eye, panel at
 * `output/single-view-arm-court/COURT-PANEL-single-view-arm.jpg`):
 *
 * ```
 * A  armLeft  blank, clause "her left"    5/5 landed on her LEFT arm    correct
 * B  the A plate hand-flopped, "her left" 2/2 landed on her RIGHT arm
 * C  armRight blank, clause "her right"   0/5 — all five on her LEFT arm
 * D  armRight blank, CLEAN plate, "right" 0/3 — all three on her LEFT arm
 * ```
 *
 * Thirteen of the fifteen put the ink on the IMAGE'S RIGHT half whatever the
 * blank depicted and whatever the sentence said. Her left arm IS the image's
 * right, so arm A is correct — and correct because the bias happens to agree
 * with it, not because the blank was chosen well. **Choosing the limb the
 * design belongs to does not move the ink to that limb**, which is the
 * hypothesis the six blanks were built on, and on the right side it fails
 * every time.
 *
 * This is the standing image-half law arriving on a third lane: her right eye
 * 3/6 against her left 6/6 on the repaint road, "her left ear" clearing the
 * image's RIGHT half 6 of 6 even mirrored, and now the plate road
 * (`docs/specs/V4_SIDE_INFERENCE_COURT.md` §6).
 *
 * So {@link ARM_FOR_SIDE} below stays exactly as it is — flipping it would
 * plate a right-side design onto a picture of her left arm and change nothing
 * about where the ink lands, trading a correct picture for a wrong one. The
 * line is not the fix, and the earlier note here that called it one was
 * written before the court. Nothing paid rides any of it — by the DEFERRAL,
 * which is the mechanism that actually holds (fable-1064 §3): `RELEASED_INK_TUPLES`
 * is empty, and this court is the evidence for keeping `upperArm:right` out of
 * it while `upperArm:left` is the only arm tuple with a reading behind it.
 */
export const INK_TEMPLATES = Object.freeze({
  armLeft: Object.freeze({
    kind: "arm",
    name: "left arm",
    file: "assets/ink/arm-left-template.png",
    digest: "c3d0f0e86e64da316af44aecccc36f460535d1a42d4c2dc04748a6d21414a953",
    mime: "image/png",
    width: 857,
    height: 1200,
    views: ["front"],
    side: "left",
    build: null,
  }),
  armRight: Object.freeze({
    kind: "arm",
    name: "right arm",
    file: "assets/ink/arm-right-template.png",
    digest: "15a8f019dc6f50fc00fc92868fab23defb848adb980c9b8eca919823833a3d58",
    mime: "image/png",
    width: 857,
    height: 1200,
    views: ["front"],
    side: "right",
    build: null,
  }),
  bodyFemaleFront: Object.freeze({
    kind: "body",
    name: "female front",
    file: "assets/ink/body-female-front-template.png",
    digest: "811b9efc182c7fde17b216fed04b6feee8a767c3f3c14b56289d0048c3f80e3a",
    mime: "image/png",
    /* NOT a multiple of 16, which GPT Image 2's edit endpoint requires of an
       output canvas — `legalPlateCanvas` asks for the nearest legal size and the
       plate comes back the square his ruling landed on, six pixels smaller.
       Measured before it was paid for; see `inkPlateEngines.ts`. */
    width: 1254,
    height: 1254,
    views: ["front"],
    side: null,
    build: "female",
  }),
  bodyFemaleBack: Object.freeze({
    kind: "body",
    name: "female back",
    file: "assets/ink/body-female-back-template.png",
    digest: "04b7994d6cea79aa0dc44bf266c75ef976a9bbee96a4245deeda2fa30aca43dd",
    mime: "image/png",
    width: 1254,
    height: 1254,
    views: ["back"],
    side: null,
    build: "female",
  }),
  bodyMaleFront: Object.freeze({
    kind: "body",
    name: "male front",
    file: "assets/ink/body-male-front-template.png",
    digest: "57cab07b76f8f131c281bc5a4ec537a8bd166f8fa2a5479407f971a8c22fd1df",
    mime: "image/png",
    width: 1254,
    height: 1254,
    views: ["front"],
    side: null,
    build: "male",
  }),
  bodyMaleBack: Object.freeze({
    kind: "body",
    name: "male back",
    file: "assets/ink/body-male-back-template.png",
    digest: "84ef4f24c85e12a0160b200f021b37ff70b05dc5aad97c9ef8491cc7843b752a",
    mime: "image/png",
    width: 1254,
    height: 1254,
    views: ["back"],
    side: null,
    build: "male",
  }),
}) satisfies Readonly<Record<string, InkTemplate>>;

export type InkTemplateName = keyof typeof INK_TEMPLATES;

/** Every blank, for the suite and for the digest lookup. */
export const EVERY_INK_TEMPLATE: readonly InkTemplate[] = Object.freeze(
  Object.values(INK_TEMPLATES) as readonly InkTemplate[],
);

/**
 * WHICH BLANK A PLATE STANDS ON, FROM ITS DIGEST — rider two of fable-1032 §3.
 *
 * The kind column names the family, so a month-later reader holding a row that
 * says `body` needs one more step to learn it was the male back. This is that
 * step, and it is a function call rather than a hunt through the source tree —
 * which is the exact cost the no-migration ruling agreed to pay and then
 * neutralised. `null` is a plate minted on a form this build no longer carries,
 * which is a real answer about an old row rather than a fault.
 */
export function inkTemplateByDigest(digest: string): InkTemplate | null {
  return EVERY_INK_TEMPLATE.find((template) => template.digest === digest) ?? null;
}

/**
 * WHICH ARM BLANK A SIDE PLATES ONTO — one line, and the court says LEAVE IT.
 *
 * It was written as "the line a re-run of the mirror court would flip". The
 * court ran (see the header): the naming is correct and flipping it would fix
 * nothing, because the blank is not what decides which arm the ink lands on.
 *
 * `centre` never reaches here: `upperArm` is `perSide` in the placement
 * vocabulary, so `sidesForInkPlacement` offers left and right only and the
 * upload door refuses `upperArm:centre` before a row is ever written. It is in
 * the record anyway because a total function over `InkSide` cannot be left with
 * a hole a fourth caller discovers, and mapping the impossible case to the left
 * arm silently is precisely the smuggled default this program keeps paying for
 * — so it is an explicit `null` and its caller refuses.
 */
const ARM_FOR_SIDE: Readonly<Record<InkSide, InkTemplate | null>> = Object.freeze({
  left: INK_TEMPLATES.armLeft,
  right: INK_TEMPLATES.armRight,
  centre: null,
});

/** Which torso blank a build plates onto. `nonbinary` has no form — see below. */
const TORSO_FOR_BUILD: Readonly<Record<Sex, InkTemplate | null>> = Object.freeze({
  female: INK_TEMPLATES.bodyFemaleFront,
  male: INK_TEMPLATES.bodyMaleFront,
  nonbinary: null,
});

/**
 * WHICH FAMILY A PLACEMENT IS PLATED ONTO — a total function over the placement
 * vocabulary, so a fourth placement earned tomorrow does not compile until
 * somebody has decided which blank form it belongs to.
 *
 * That totality is `bodyAnchorRegions`' own method and it is here for the same
 * reason: a default would silently plate a new surface onto whichever form was
 * listed first, and nothing would say so.
 *
 * **No placement routes to a BACK blank**, and that is a declared state rather
 * than an oversight: neck, upper arm and upper chest are all front surfaces.
 * The two back plates land with no caller until a back placement is earned.
 */
const FAMILY_FOR: Readonly<Record<InkPlacement, "arm" | "torso">> = Object.freeze({
  neck: "torso",
  upperArm: "arm",
  upperChest: "torso",
});

export type InkTemplateChoice =
  | { readonly ok: true; readonly template: InkTemplate }
  /**
   * THERE IS NO BLANK FOR THIS CAST'S BUILD, and refusing is the ruling
   * (fable-1025 §1).
   *
   * A nonbinary cast asking for a neck or upper-chest design has no torso form
   * in the set. The two roads not taken: routing by the label (a femme-reading
   * cast to the female blank) infers a BODY from an IDENTITY, which is working
   * law 8 pointed backwards and wrong often enough to reach a customer; reading
   * the cast's own frame spends a vision call answering a question the product
   * has not decided. So it refuses, charges nothing, and says the material is
   * not stocked yet.
   *
   * The ARM is unaffected — it is one bare limb and it serves every cast.
   */
  | { readonly ok: false; readonly reason: "noFormForBuild" };

/**
 * The blank a design plates onto: family from the placement, member from the
 * side or the build.
 *
 * Takes the cast's build rather than reading one, because the caller holds the
 * candidate and this module holds files.
 */
export function inkTemplateFor(input: {
  placement: InkPlacement;
  side: InkSide;
  build: Sex | null;
}): InkTemplateChoice {
  if (FAMILY_FOR[input.placement] === "arm") {
    const arm = ARM_FOR_SIDE[input.side];
    return arm ? { ok: true, template: arm } : { ok: false, reason: "noFormForBuild" };
  }
  /*
    A cast whose build was never stated has no torso form either, and it takes
    the same road as `nonbinary` rather than defaulting to the female blank —
    the room called every Cast "she" once already (`castPronouns.ts`), and this
    would be that mistake with a picture attached.
  */
  const torso = input.build ? TORSO_FOR_BUILD[input.build] : null;
  return torso ? { ok: true, template: torso } : { ok: false, reason: "noFormForBuild" };
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
