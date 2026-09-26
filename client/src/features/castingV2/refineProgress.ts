import { refineStepFraction, type RefineStep } from "@shared/refineSteps";

/**
 * THE HONEST LOADER — what the picture is allowed to say while it waits (#55).
 *
 * # The order, and it is his
 *
 * Founder directive, fable-020: *a thin progress indicator during refinement
 * advancing on REAL stage transitions only — dispatch, painting, second pass,
 * checking, assembling — "No invented percentages, ever."* Re-ruled 2026-09-26
 * after he drew the loader himself across an evening of boards, closing with
 * *"i just adjusted thew ripple. its perfect now file it"*. The filed spec:
 *
 *   1. **One bar, one line** — its fill *the fraction of REAL stages
 *      completed*. His own words on the shape: *"make the bar one line not 4
 *      different line dont put the excpected time either and place the
 *      painting/state under the loading bar"*.
 *   2. **The stage word under the bar** — `sending` · `painting` · `checking` ·
 *      `finishing`, the one running.
 *   3. **No percentages, no clock, no expected time anywhere.**
 *
 * # Why the words are here and the steps are not
 *
 * `shared/refineSteps.ts` holds what the ROAD calls each stage, because the
 * road writes those words onto the row and this file reads them off the wire;
 * one list, two sides (working law 4). What a PERSON is told is a different
 * job, and it lives beside the surface that draws it. `preparing` is what the
 * pipeline is doing; *sending* is what is happening to her picture — which is
 * the disappearing-technology line exactly: name what is happening to their
 * picture, never what is doing it.
 *
 * # What this refuses to say, and it is the whole point
 *
 * A row the road has announced NOTHING about gets no bar and no word — not a
 * plausible one, not the first one, not the last one it had. *A stage that does
 * not fire is not shown.* That happens in two real situations and both are
 * short: the seconds between her press and the server's first row, and a render
 * claimed by a build that predates the announcement. In both the picture still
 * carries her own sentence and the dust, which claim only that something is
 * being worked on — which is true.
 *
 * A SETTLING row gets no bar either, and for a stronger reason: nobody is
 * rendering it. A progress bar over a row the recovery sweep is refunding is
 * the *"being drawn"* lie fable-467 was written about, wearing a graph.
 */

/** His four words, one per real stage of the road. */
const STEP_WORDS: Record<RefineStep, string> = {
  preparing: "sending",
  rendering: "painting",
  reading: "checking",
  storing: "finishing",
};

/**
 * WHAT THE BAR AND THE WORD SHOW, or null when there is nothing honest to show.
 *
 * `fraction` is a position among four real events and never a percentage of a
 * wait — the bar carries no number and the surface prints none.
 */
export type RefineProgress = {
  word: string;
  fraction: number;
};

export function refineProgress(wait: {
  stage: "queued" | "dispatched" | "settling";
  step: RefineStep | null;
}): RefineProgress | null {
  /* Nobody is rendering it. There is no road left to be a fraction of. */
  if (wait.stage === "settling") return null;
  /*
    CLAIMED AND NOT YET HANDED OVER — the same visible stage as `preparing`,
    because they are the same fact: ours, and not yet at the engine. Said here
    rather than written onto the row, since `queued` is the row's own status and
    a second announcement of it would be two sources for one thing.
  */
  if (wait.stage === "queued") return { word: STEP_WORDS.preparing, fraction: refineStepFraction("preparing") };
  if (wait.step === null) return null;
  return { word: STEP_WORDS[wait.step], fraction: refineStepFraction(wait.step) };
}
