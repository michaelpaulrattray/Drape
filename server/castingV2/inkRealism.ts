/**
 * WHAT A TATTOO IS ON SKIN — the one owner of the ink lanes' shared prose
 * (ordered fable-1180 §1, shaped fable-1184 §2; the precedent is
 * `sidePhrasing`, where two lanes say "left" and neither may drift).
 *
 * # Why this module exists at all, and it is an incident rather than a tidy
 *
 * The founder ruled `1-tattoo-on-neck.png` a FAIL with two defect classes: the
 * design printed itself onto his T-SHIRT, and his NECK WAS STRETCHED to fit it.
 * Then, on the chest frame: *"the tattoo looks a little bit fake like a drawing
 * rather than inset ink/slightly faded etc i know legacy studio did tattoos
 * pretty good"*. And the bar, in his own correction: **"it CAN'T look like a
 * sticker"** — a FAIL class at the frames gate, not room for polish.
 *
 * A grep of the four ink lanes, 2026-08-20, found the sentences already written
 * — in the wrong places:
 *
 * ```
 *   lane                                anti-sticker   not-on-clothing   healed
 *   ──────────────────────────────────────────────────────────────────────────
 *   legacy evidence composer                 —                —          healed
 *   the plate mint (inkPlateDoor)            ✓                —             —
 *   the sign views (inkViewReferences)       —                ✓             —
 *   THE REPAINT RECIPE — THE LIVE LANE       ✗                ✗             ✗
 * ```
 *
 * **The one lane with none of it is the lane that painted his failed frame.**
 * Its ink sentences describe what the PICTURE is and, on a carry, say *"keep it
 * exactly as it is"* — and reproduction of a drawing is a drawing. His two
 * defect classes are not mysterious engine behaviour; they are what that lane
 * asked for.
 *
 * # WHAT THIS COMMIT IS, stated so the next reader does not look for more
 *
 * A PURE EXTRACTION. Every string below is the prose its lane already sent,
 * byte for byte, moved to one home so the lanes cannot drift — not one word is
 * reworded here, because the sign-view lane paints today and its prose moving
 * house must not change its clothes. What the live lane is MISSING lands next,
 * additively, with its own like-for-like court.
 */

/**
 * THE ANTI-STICKER CLAUSE — his bar, and it was already house prose.
 *
 * Written physically rather than as an adjective, which is why it works: *"do
 * not make it look flat"* is a taste word an engine may agree with and ignore,
 * while *"follow the form underneath"* is a thing to draw.
 */
export const INK_SITS_ON_THE_FORM =
  "Follow the form underneath, so the design sits on the surface as ink on skin rather than as a flat sticker.";

/**
 * The same sentence in the plate prompt's own shape — a bullet, wrapped where
 * that prompt wraps.
 *
 * **Two forms of one sentence is exactly the drift this module exists to stop**,
 * so they are not two sentences: `inkRealism.test.ts` unwraps these lines and
 * asserts they ARE {@link INK_SITS_ON_THE_FORM}, which is a derived check rather
 * than a second list (working law 4). Change the sentence and the lines go red
 * until they agree with it.
 */
export const INK_SITS_ON_THE_FORM_LINES = Object.freeze([
  "- Follow the form underneath, so the design sits on the surface as ink on",
  "  skin rather than as a flat sticker.",
]);

/**
 * INK IS NOT A GRAPHIC ON A GARMENT — the founder's first named defect class,
 * and his own ruling about what a covered design gets.
 *
 * > *"tattos can still ride they may just not be visible fully yet so if you had
 * > a chest tatto reference with neck continuation you might see it poking out
 * > the top of the shirt but thats the extent for now"*
 *
 * So clothing COVERS ink rather than deleting it, and the wardrobe is never
 * altered to reveal more of it. The sentence is the sign views' own, unchanged.
 *
 * ⚠ **Its pronoun is hard-coded `her`, and this product casts men** — the frame
 * that bought this whole pass is a man with a tattoo on HIS neck. That is a
 * defect, it is not this commit's (nothing may be reworded here), and it is the
 * `hairTakeSentence` fix one road along: the pronoun is the CAST's. Named here
 * rather than left for somebody to find, because a wart moved to a new house
 * quietly is a wart nobody owns.
 */
export const INK_NOT_ON_CLOTHING =
  "It is ink on her skin — never printed, embroidered or otherwise placed on her clothing, and "
  + "never added to a garment as a graphic. Clothing covers ink rather than removing it: where a "
  + "tattoo runs under a garment, the part of it on bare skin appears exactly as it is and the "
  + "covered part simply does not show. Never change, move or open a garment to reveal more of a "
  + "tattoo — the clothing in a view is what it is, and the tattoo shows only where skin shows.";
