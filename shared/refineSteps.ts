/**
 * THE FOUR REAL STAGES OF A REFINE — what the road announces as it passes.
 *
 * Founder directive (fable-020, re-ruled 2026-09-26 on card #55): *a thin
 * progress indicator during refinement advancing on REAL stage transitions
 * only — "No invented percentages, ever."* His filed spec for the loader he
 * chose names the four words the customer reads: `sending` · `painting` ·
 * `checking` · `finishing`, with the stage word under a single bar whose fill
 * is *the fraction of REAL stages completed*.
 *
 * # These are events, not a scale
 *
 * Each of the four is a line in `refineService`'s own pipeline, and the row is
 * marked when that line is reached — never on a clock, never by interpolation:
 *
 *   `preparing`  the row is ours and the picture is not yet at the engine —
 *                the master's bytes are being read and the prompt composed
 *                (on the masked road, several segmenter calls).
 *   `rendering`  the image call is out.
 *   `reading`    the frame is back and is being checked — the fault detector
 *                and the verification reader.
 *   `storing`    it passed; the bytes are going to storage and the variant is
 *                landing.
 *
 * **Nothing here is a duration and nothing here is a guess.** A step the road
 * does not reach is never written, and a row carrying no step says so rather
 * than being placed somewhere plausible — which is what "a stage that does not
 * fire is not shown" means on the surface.
 *
 * ⚠ **A STEP MAY GO BACKWARDS, ON PURPOSE.** A render that fails its
 * verification buys one free re-render (`attemptRender` runs twice), so the
 * road genuinely returns from `reading` to `rendering`. The bar retreats with
 * it, because the work retreated; a high-water mark would be the invented
 * number this whole card exists to refuse.
 *
 * # Why the vocabulary lives in `shared/`
 *
 * The road writes these words onto the row and the loader reads them off the
 * wire, and the two must never hold separate lists (working law 4). The COPY
 * is not here — the customer's four words live beside the surface that draws
 * them (`client/src/features/castingV2/refineProgress.ts`), because what the
 * road calls a step and what a person is told are two different jobs.
 */

export const REFINE_STEPS = ["preparing", "rendering", "reading", "storing"] as const;

export type RefineStep = typeof REFINE_STEPS[number];

/** A json column is validated, never trusted. */
export function isRefineStep(value: unknown): value is RefineStep {
  return typeof value === "string" && (REFINE_STEPS as readonly string[]).includes(value);
}

/**
 * HOW FAR ALONG THE FOUR THIS ONE IS — his bar's fill, and the only arithmetic
 * in the whole feature.
 *
 * Counted rather than written down: `preparing` is one stage of four reached,
 * so the bar stands at a quarter the moment she presses, and at four quarters
 * while the picture is being stored. A fifth step would move every figure by
 * editing the list above and nothing else.
 *
 * It is a POSITION AMONG REAL EVENTS and never a percentage of a wait: the bar
 * carries no number, and the surface that draws it prints none.
 */
export function refineStepFraction(step: RefineStep): number {
  return (REFINE_STEPS.indexOf(step) + 1) / REFINE_STEPS.length;
}
