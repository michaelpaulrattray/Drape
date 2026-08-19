/**
 * THE MANNEQUIN ROAD IS DEFERRED — founder ruling, 2026-08-19, relayed
 * fable-1053 §2, inside the seven-arrow answer:
 *
 * > *"tatto studio on manequins is deferred for now."*
 *
 * # What that has to mean in code, and why it is a constant rather than a flag
 *
 * `CASTING_INK_STUDIO_SCOPE` is ON for his account. The upload door is open, and
 * two things behind it belonged to the road he just parked:
 *
 *   1. **every upload MINTED A PLATE** — house money, a fal call and ~37s, to
 *      draw a design onto a mannequin form for a road nobody is building;
 *   2. **a plate would RIDE INTO HIS SIGN VIEWS** — the view-reference lane
 *      (47f8f3a2), which is correct behaviour for the road as designed and is
 *      not the road we are on this week.
 *
 * A deferral is not a scope: it is not per-user, it is not configuration, and
 * nobody should be able to turn it off by setting an environment variable. It is
 * one named condition with a citation, **reversible in a line** the day he says
 * the mannequin road resumes. `inkMannequinDeferral.test.ts` pins that both
 * consumers read THIS and not a copy of it.
 *
 * # What it deliberately does NOT touch
 *
 * The upload itself. A customer may still attach her design, it is still our own
 * copy under the candidate's purge path, still capped, still swept with her
 * Cast. **Storing is not spending**, and the design she attached is the seed the
 * road will use whenever it resumes — the deferral parks the drawing, not the
 * keeping.
 *
 * Nor the words-rendered ink road (`inkPlacement.ts`, D-133(a)), which never
 * touched a mannequin and is untouched here.
 */

/**
 * Whether the mannequin/plate road is parked.
 *
 * `true` until the founder says otherwise. Flipping it to `false` restores the
 * mint and the view-reference lane exactly as they were.
 */
export const MANNEQUIN_ROAD_DEFERRED = true;

/**
 * What an upload's caller is told about the plate that was not drawn.
 *
 * Honest and free of apology: nothing failed, nothing was charged, and the
 * design is kept. The alternative — a silent `minted: false` — is
 * indistinguishable from a mint that broke.
 */
export const MANNEQUIN_DEFERRED_NOTE =
  "Your design is saved. We're not drawing it onto a mannequin at the moment — "
  + "that part of the tattoo studio is paused. Nothing was charged.";
