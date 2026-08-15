/**
 * IS IT THE SAME ONE? — the promotion kit's standing INSTANCE-CONSTANCY arm.
 * (Ordered in fable-566 §2, generalised to every kind in fable-570 §2.)
 *
 * # The hole this fills
 *
 * The survival court asked two questions of every chained frame — is the thing
 * still there (PRESENCE), and is this still her (IDENTITY) — and crowned the
 * cheaper carrier when both arms tied. Neither question is *"are these the same
 * horns"*, so the axis nobody pinned was free to re-roll, which is the
 * unowned-axis class: **a court that cannot see re-rolling will crown words
 * again.**
 *
 * The founder named it before any measurement did: *"it's a feature, otherwise
 * they would change on every refinement"*, and then generalised it —
 * *"it's not just horns"*.
 *
 * # GEOMETRY DECIDES. The eye was tried, and it was refuted.
 *
 * ```
 * GEOMETRY   extent (area / her face's area) and aspect (w/h) of the feature,
 *            normalised against her own face on the SAME frame, because her
 *            head does not sit in the same pixels between renders. The verdict
 *            statistic is the WORST side, since a pair is constant only if both
 *            of it are.
 * THE EYE    recorded, never a verdict — see below.
 * ```
 *
 * The arm was designed with a reader beside the numbers, and its own negative
 * control killed that half in two attempts:
 *
 * ```
 * the same frame twice          geometry 0.0% / 0.0%     the eye: SAME  ✓
 * two DIFFERENT deliveries      geometry 26% extent,     the eye: SAME  ✗
 *   on the same face              26% aspect (left)
 * ```
 *
 * Asked loosely, the reader answered the KIND back ("horn shape, curvature,
 * ridged texture"). Asked to measure three specifics first — length against
 * base thickness, tip direction, ridge count — it produced the specifics and
 * still concluded *"identical ridge pattern, coloration and curvature angle
 * indicate the same horn"* about two horns that differ by a quarter of their
 * own extent. **A judge that cannot fail its negative control is not a judge**,
 * so its answer is recorded as an observation and never counted.
 *
 * The bar belongs to the court, and these two readings are what there is to
 * calibrate it with: 0% for one object photographed twice, 26% for two
 * deliveries. A court declaring 15% separates them — and a specimen landing
 * between 6% and 26% should buy more controls before anybody rules on it.
 *
 * # PER SIDE, always, for a bilateral kind
 *
 * Asked "horns" on a whole frame, the segmenter answers with ONE horn and not
 * always the same one — the placement axis swung by most of a face-width on the
 * first attempt at this reading. So a pair is read one half at a time (the
 * reader's own `regionSides`), and a side that does not answer is a NO-READ
 * rather than a zero.
 *
 * # What it refuses to do
 *
 * It never invents a verdict from a missing reading. A side with no answer, a
 * face that will not read, or a judge that returns nothing usable all come back
 * as `null` with the reason attached — the court then has an arm that tested
 * nothing, which is VOID and is a different thing from failing.
 */
import type { Buffer } from "node:buffer";

export type ConstancySide = {
  readonly side: "left" | "right" | "whole";
  /** Feature area as a share of her face's area, on that frame. */
  readonly parentExtent: number;
  readonly childExtent: number;
  /** |Δ| as a fraction of the parent's own reading. */
  readonly extentDrift: number;
  readonly parentAspect: number;
  readonly childAspect: number;
  readonly aspectDrift: number;
};

export type ConstancyReading = {
  /** Per side, or one entry for a whole-frame kind. Empty when nothing read. */
  readonly sides: readonly ConstancySide[];
  /**
   * The worst drift on any side — the verdict statistic, because a pair is
   * constant only if both of it are. Null when nothing read.
   */
  readonly worstDrift: number | null;
  /**
   * What a reader said about the crops — an OBSERVATION, never a verdict. It
   * failed its own negative control twice; see the header.
   */
  readonly judged: { readonly same: boolean; readonly saw: string } | null;
  /** What the arm actually SAW, for the court's `sawAtTheWire`. Null = tested nothing. */
  readonly saw: string | null;
  /** Why it tested nothing, when it did not. */
  readonly why: string | null;
};

type Mask = { data: Buffer; width: number; height: number };

type Reader = {
  region(input: { image: Buffer; name: string; absentIsAnswer?: boolean }): Promise<Mask>;
  regionSides?(input: { image: Buffer; name: string; absentIsAnswer?: boolean }):
  Promise<{ left: Mask; right: Mask } | null>;
};

type Judge = {
  complete(input: {
    system: string;
    user: string;
    images: { bytes: Buffer; contentType: string }[];
    json?: boolean;
  }): Promise<{ text: string }>;
};

function shapeOf(mask: Mask): { area: number; width: number; height: number } | null {
  let minX = mask.width, maxX = -1, minY = mask.height, maxY = -1, on = 0;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[y * mask.width + x]! <= 127) continue;
      on += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (on === 0) return null;
  return { area: on, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** The feature, cut to its own box, for the eye to compare. */
async function cropTo(bytes: Buffer, mask: Mask): Promise<Buffer | null> {
  const sharp = (await import("sharp")).default;
  const box = shapeOf(mask);
  if (!box) return null;
  const meta = await sharp(bytes).metadata();
  const scaleX = (meta.width ?? mask.width) / mask.width;
  const scaleY = (meta.height ?? mask.height) / mask.height;
  let minX = mask.width, minY = mask.height;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[y * mask.width + x]! <= 127) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
    }
  }
  return sharp(bytes)
    .extract({
      left: Math.max(0, Math.floor(minX * scaleX)),
      top: Math.max(0, Math.floor(minY * scaleY)),
      width: Math.max(1, Math.round(box.width * scaleX)),
      height: Math.max(1, Math.round(box.height * scaleY)),
    })
    .png()
    .toBuffer();
}

/**
 * Read one feature on two frames and say whether it is the same instance.
 *
 * `parent` is the frame that delivered the feature; `child` is the frame after
 * whatever the court did to it.
 */
export async function readConstancy(input: {
  reader: Reader;
  judge?: Judge;
  /** The kind's region word — the plain class noun, never a laterality word. */
  question: string;
  /** True for a kind the catalogue declares `perSide`. */
  bilateral: boolean;
  /** How the judge should name the thing, e.g. "horn". */
  noun: string;
  parent: Buffer;
  child: Buffer;
}): Promise<ConstancyReading> {
  const faceOf = async (bytes: Buffer) => {
    const mask = await input.reader.region({ image: bytes, name: "face", absentIsAnswer: true });
    return shapeOf(mask);
  };
  const [parentFace, childFace] = await Promise.all([faceOf(input.parent), faceOf(input.child)]);
  if (!parentFace || !childFace) {
    return {
      sides: [], worstDrift: null, judged: null, saw: null,
      why: "her face does not read on one of the frames",
    };
  }

  const readOne = async (bytes: Buffer): Promise<Record<string, Mask | null>> => {
    if (input.bilateral && input.reader.regionSides) {
      const sides = await input.reader.regionSides({ image: bytes, name: input.question, absentIsAnswer: true });
      if (sides === null) return { whole: null };
      return { left: sides.left, right: sides.right };
    }
    const mask = await input.reader.region({ image: bytes, name: input.question, absentIsAnswer: true });
    return { whole: mask };
  };

  const [parentMasks, childMasks] = await Promise.all([readOne(input.parent), readOne(input.child)]);
  const sides: ConstancySide[] = [];
  const missing: string[] = [];
  for (const key of Object.keys(parentMasks)) {
    const parentMask = parentMasks[key] ?? null;
    const childMask = childMasks[key] ?? null;
    const before = parentMask ? shapeOf(parentMask) : null;
    const after = childMask ? shapeOf(childMask) : null;
    if (!before || !after) { missing.push(key); continue; }
    const parentExtent = before.area / parentFace.area;
    const childExtent = after.area / childFace.area;
    const parentAspect = before.width / before.height;
    const childAspect = after.width / after.height;
    sides.push({
      side: key as ConstancySide["side"],
      parentExtent,
      childExtent,
      extentDrift: Math.abs(childExtent - parentExtent) / parentExtent,
      parentAspect,
      childAspect,
      aspectDrift: Math.abs(childAspect - parentAspect) / parentAspect,
    });
  }

  if (sides.length === 0) {
    return {
      sides: [],
      worstDrift: null,
      judged: null,
      saw: null,
      why: `the ${input.noun} does not read on ${missing.join(" and ")} of one frame`,
    };
  }

  /* THE EYE, on the crops rather than on the frames: two whole portraits invite
     a judgement about HER, which the identity arm already answers. */
  let judged: ConstancyReading["judged"] = null;
  if (input.judge) {
    const first = sides[0]!.side;
    const parentMask = parentMasks[first];
    const childMask = childMasks[first];
    const [beforeCrop, afterCrop] = await Promise.all([
      parentMask ? cropTo(input.parent, parentMask) : Promise.resolve(null),
      childMask ? cropTo(input.child, childMask) : Promise.resolve(null),
    ]);
    if (beforeCrop && afterCrop) {
      const answer = await input.judge.complete({
        system: "You are comparing two close-up crops of the same person's feature. JSON only.",
        /*
          THE PROMPT IS SPECIFIC BECAUSE THE VAGUE ONE FAILED ITS CONTROL.

          Asked "is it the same one — same shape, length, curve and surface", the
          reader answered SAME for two plainly different deliveries and named
          the KIND back at me ("horn shape, curvature, ridged texture"). A judge
          that compares category cannot see an instance re-roll, which is the
          whole axis this arm exists for.

          So it is made to measure before it decides: three specifics, each
          answered on its own, and the verdict derived from THEM rather than
          from an impression.
        */
        user: `Both images are close-up crops of the same person's ${input.noun}, before and `
          + "after an unrelated edit to the photograph. Do not judge the KIND of thing — both "
          + "are the same kind. Judge whether it is the SAME INDIVIDUAL ONE. "
          + "Measure three things in each image and compare them: "
          + "LENGTH (how long it is relative to its own thickness at the base), "
          + "CURVE (which way the tip points, and how sharply it bends), "
          + "SURFACE (how many ridges or bands are visible along it). "
          + "Answer as {\"length\": \"<image1 vs image2>\", \"curve\": \"<image1 vs image2>\", "
          + "\"surface\": \"<image1 vs image2>\", \"same\": true|false, \"saw\": \"<the one "
          + "difference that decided it, or what made them identical>\"}. "
          + "same is TRUE only if all three match closely enough that this is one object "
          + "photographed twice.",
        images: [
          { bytes: beforeCrop, contentType: "image/png" },
          { bytes: afterCrop, contentType: "image/png" },
        ],
        json: true,
      });
      const parsed = (() => {
        try { return JSON.parse(answer.text.replace(/```json|```/g, "").trim()); } catch { return null; }
      })();
      const saw = typeof parsed?.saw === "string" ? parsed.saw.trim() : "";
      /* D-235's asymmetry: an affirmative with nothing behind it is not a
         reading, so a verdict with no `saw` is no verdict. */
      judged = typeof parsed?.same === "boolean" && saw.length > 0
        ? { same: parsed.same, saw }
        : null;
    }
  }

  const worstDrift = Math.max(...sides.map((side) => Math.max(side.extentDrift, side.aspectDrift)));
  return {
    sides,
    worstDrift,
    judged,
    saw: `worst drift ${(worstDrift * 100).toFixed(0)}% · `
      + `${sides.length} side(s) read: `
      + sides.map((side) => `${side.side} ${(side.extentDrift * 100).toFixed(0)}% extent`).join(", ")
      + (judged ? ` · the eye says ${judged.same ? "same" : "REDRAWN"} (${judged.saw})` : " · no eye"),
    why: missing.length > 0 ? `no reading on ${missing.join(" and ")}` : null,
  };
}
