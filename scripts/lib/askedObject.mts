import { verifyRender } from "../../server/castingV2/renderVerification";
import { facetOfSubject } from "../../server/castingV2/refineFacets";

export type EarReading = {
  side: string;
  read: boolean;
  verified: boolean;
  absent: boolean | null;
  /** Whether this ear is wearing the asked object. See the note on `absent`. */
  wearing: boolean;
  saw: string;
};

/**
 * IS THE ASKED OBJECT ON *THIS* EAR — asked of one ear at a time (fable-318 R3).
 *
 * The walk's pixel counter answers "is something hanging there", and shift 61 is
 * the run where that stopped being the same question: step 2 asked for dangly
 * cross earrings, delivered a cross on one ear and a plain hoop on the other,
 * and the counter said "a pair" because both ears had an earring on them. The
 * founder's ontology is a MATCHING pair — the asked object, on both — so the
 * clause needs a reading about the OBJECT and not only about its presence.
 *
 * Laterality is a property of the CROP rather than a question put to a reader.
 * Every instrument in this campaign that has been asked which ear it is looking
 * at has answered a class with an instance, so the frame is cut at her own
 * midline first and each half is asked, on its own, about the thing she typed.
 *
 * # `absent`, not `verified` — and that was MEASURED, not chosen
 *
 * `scripts/bake-per-ear-wording-disposable.mts` put three wordings to both of
 * shift 61's frames. In all twelve readings the PROSE was right — *"gold dangly
 * cross earring visible on her right ear"*, *"visible ear wears a small gold
 * hoop, not a cross earring"* — and `verified` was false almost everywhere,
 * including on a flawless matching pair, always for the same stated reason:
 * *"other side out of frame"*. The reader is answering about the PAIR, honestly,
 * because a pair is what the product's own prompt makes the subject. No wording
 * of the fact moved it; the crop changes what can be SEEN and not what is being
 * ASKED.
 *
 * `absent` was clean across every one of those readings: true on the ear wearing
 * the wrong object, never true on an ear wearing the right one. That is exactly
 * what the field means — *the asked-for thing is not in this photograph at all*
 * — and on a picture of one ear that is the question. So the verdict is read off
 * `absent`, `verified` is recorded beside it, and the reason is here rather than
 * in a commit message.
 */
export async function askedObjectOnEachEar(
  bytes: Buffer,
  asked: string,
  midline: number,
): Promise<EarReading[]> {
  const sharpModule = (await import("sharp")).default;
  const meta = await sharpModule(bytes).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  return await Promise.all(([
    { side: "left", left: 0, width: midline },
    { side: "right", left: midline, width: width - midline },
  ] as const).map(async (half) => {
    const halfBytes = await sharpModule(bytes)
      .extract({ left: half.left, top: 0, width: half.width, height })
      .png()
      .toBuffer();
    const verdict = await verifyRender({
      bytes: halfBytes,
      contentType: "image/png",
      facts: [{ facet: facetOfSubject("statedAccessories"), asked, binding: true }],
    });
    const check = verdict.checks[0];
    return {
      side: half.side,
      read: check?.read === true,
      verified: check?.verified === true,
      absent: typeof check?.absent === "boolean" ? check.absent : null,
      /* THE VERDICT, and it is the absence rather than the affirmation — see
         the note above. An ear the reader will not call empty is an ear wearing
         the thing she asked for. */
      wearing: check?.absent !== true,
      saw: check?.saw ?? "(nothing named)",
    };
  }));
}

