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
 *
 * # ⚠ AND WHAT IT DOES TAKE, WHICH THIS FILE DID NOT SAY UNTIL 2026-08-20
 *
 * **THE MISSING-FORM DEMAND COUNTER IS DEAD WHILE THIS IS `true`.** Found at the
 * code (opus-821 §0), ordered into this file by fable-1114 §1, and it is one
 * import hop away from invisible:
 *
 *     recordInkFormDemand   ← one non-test caller: inkPlateMint's
 *                             `dependencies.countMissingForm` call
 *     mintInkPlate          ← one non-test caller: inkUploadService's
 *                             `dependencies.mint` call
 *     …and inkUploadService's MANNEQUIN_ROAD_DEFERRED early return fires
 *     FIRST, one statement above that call
 *
 * Named by SYMBOL rather than by line, and the reason is this block's own
 * history: it was written so the dead tally could be re-checked in one read,
 * and by 2026-08-21 two of its three line numbers pointed at unrelated comment
 * prose while every fact in it was still true. A stale line makes a true
 * sentence read as false to whoever checks it next; a symbol that moves fails
 * loudly, because a grep finding nothing IS the red light. (Ruled fable-1227
 * §2: on a live instruction surface, a pointer names a symbol a grep can
 * re-find.)
 *
 * So `casting_ink_form_demand` has counted nothing since the deferral, and dev
 * confirms it: zero rows. Nothing is broken — the customer still gets
 * {@link MANNEQUIN_DEFERRED_NOTE}, the design is still kept — but the
 * instrument the *"draw a third form"* decision was going to read is not
 * running, and a table with no rows looks the same as a question nobody asked.
 *
 * **This is the campaign's own hardest class and there is no mistake in it to
 * find**: a live control orphaned by a correct ruling aimed at something else
 * (CLAUDE.md working law 7's second half — the credit-velocity caps, the
 * sensitive-action gate, the refused-frame camera, and now this). It leaves no
 * failing test and no error, only a green suite and documents that go on
 * describing it. `CLAUDE.md`'s ink row called migration 0041 a prerequisite
 * *"because the thing being counted is the refusal a cast with no torso form
 * receives"* — a refusal that cannot currently be issued.
 *
 * It is written here rather than repaired, because the BEHAVIOUR is correct and
 * only the record was short. **The tally resumes when the road does**, and the
 * sitting that flips this constant owns re-reading whether its `kind`
 * vocabulary still fits — an open placement has no template at all, so
 * *"no torso form for this build"* is not what an open ask is missing.
 */

/**
 * Whether the mannequin/plate road is parked.
 *
 * `true` until the founder says otherwise.
 *
 * # ⚠ FLIPPING THIS IS NOT A ONE-LINE ACT. THE RESUMPTION PREREQUISITE:
 *
 * > **THE MANNEQUIN ROAD DOES NOT RESUME UNTIL THE RELEASE DOOR EXISTS, IS
 * > WIRED AT THE DISPATCH IT CLAIMS TO GOVERN, AND HAS BEEN DRIVEN RED.**
 * > (Ruled fable-1064 §3.)
 *
 * The reason, and it is a finding rather than caution: **the release gate this
 * road's paperwork rests on has no caller.** `isInkTupleReleased` and
 * `INK_PLACEMENT_NOT_RELEASED` are consulted by nothing outside their own test,
 * so *"release gates the render"* described a door that was never built. What
 * had been keeping ink off customers' photographs was the ABSENCE OF A PLATE —
 * and the day the studio flag opened for one account, a neck plate rode into a
 * signed Cast's views in a wire test written to check exactly that.
 *
 * So this constant is currently doing the release gate's job as well as its own.
 * Flip it back without building that door and the product returns to the state
 * the wire test found, with the paperwork still claiming a control that does not
 * exist. **The missing control is therefore converted into a named blocking
 * prerequisite of the act that needs it**, rather than patched into a road that
 * is parked — wiring a gate into a closed road would install a control nobody
 * can exercise, which is the defect bought at birth.
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
