/**
 * WHERE AN INK DESIGN CAME FROM — the two answers a reference is allowed to
 * have, and the reason there are only two.
 *
 * # This is the fence's own vocabulary, and it is not new
 *
 * The blocking condition on reference-guided edits is the real-person fence
 * (fable-711 §3a): a reference must give the product a DESIGN and never a
 * person. The question is usually posed as *can we strip a face out of a
 * photograph* — and the legacy ink road answered a better one eighteen days
 * before this file existed. `inkCalibration.ts` types its inputs as
 *
 *     INK_CALIBRATION_SOURCE_KINDS = ["synthetic", "consented"]
 *
 * — i.e. the fence is not a filter applied to arbitrary pictures, it is a
 * constraint on what a reference may BE. Either we made it, or somebody agreed
 * to it. There is no third kind, and a picture that is neither does not get a
 * quieter label; it does not get in.
 *
 * # Why it rides from the first commit
 *
 * Ruled fable-922 §3a. A column now beats migrating rows that already claimed
 * something later: provenance added afterwards has to be back-filled with a
 * guess for every row written before it, and a guessed provenance is exactly
 * the value the fence cannot tolerate.
 *
 * # What it does NOT decide
 *
 * It does not say the upload is safe to render. For ink the plate is the fence
 * — an uploaded tattoo is re-drawn onto a neutral mannequin, so the photograph
 * never reaches a render (D-138, ruled fable-684 §2) — and that structure is
 * proven by its own court, not by this column (fable-919 §3). This records
 * WHAT WAS CLAIMED about the source, so a later reading has something to be
 * about.
 *
 * ⚠ And it does not say the upload is safe to MINT. The fence above is about
 * the RENDER; the plate mint receives the stored upload's raw bytes today
 * (`inkPlateMint.ts`), which is the gap build 3a closes — see
 * `shared/referenceIntents.ts` and V3B §7.11's fence section for the whole
 * truth, the founder's call, and the widening tripwire that bounds it.
 */
export const INK_PROVENANCES = ["synthetic", "consented"] as const;

export type InkProvenance = (typeof INK_PROVENANCES)[number];

export function isInkProvenance(value: string): value is InkProvenance {
  return (INK_PROVENANCES as readonly string[]).includes(value);
}
