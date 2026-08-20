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
 * # HOW THIS MODULE ARRIVED, in two commits and in this order on purpose
 *
 * **First a PURE EXTRACTION**: the constants below are the prose their lanes
 * already sent, byte for byte, moved to one home so the lanes cannot drift —
 * not one word reworded, because the sign-view lane paints today and its prose
 * may move house without changing clothes.
 *
 * **Then the ADDITIVE landing**: {@link inkRealismClause} and
 * {@link inkNotOnClothingClause}, the sentences the live lane never had, said in
 * the CAST's own pronoun. Nothing the extraction moved was touched to make room
 * for them — the two halves are legible apart in the history, which is what
 * makes it possible to tell a rendering difference caused by new words from one
 * caused by a move that was supposed to change nothing.
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

/**
 * WHAT A TATTOO IS ON SKIN, SAID TO THE PAINTER — the sentence the live lane
 * never had (ordered fable-1179 §2a, landed per fable-1184 §3b).
 *
 * # Every clause here is prior art, and the two that matter are legacy's
 *
 * The founder's memory was right: `server/casting/evidence/composer/inkComposer.ts`,
 * the D-133/D-138-era road, says *"Add exactly one **healed** tattoo"* and
 * *"Preserve realistic **skin pores, texture, lighting, and skin highlights over
 * the ink**"*. Those are the two doing the work, and neither is an adjective:
 *
 *   - **`healed`** is the whole translation in one word. A healed tattoo is
 *     settled into skin and slightly faded BY DEFINITION; fresh artwork is not.
 *   - **highlights passing OVER the ink** states the anti-sticker bar
 *     PHYSICALLY. *"Do not make it look flat"* is a taste word an engine can
 *     agree with and ignore; *"the skin's highlights pass over it"* is a thing
 *     to draw. A decal cannot have them.
 *
 * `slightly faded` and `follows the anatomy` are his own words for the same
 * fact, and {@link INK_SITS_ON_THE_FORM} is the house sentence for it.
 *
 * # Why this one takes PRONOUNS when the extracted constants do not
 *
 * Because the frame that bought this pass is a MAN with a tattoo on HIS neck.
 * The sign views' clause hard-codes "her" — a defect named where it lives — and
 * carrying that spelling into the lane that painted his failed frame would be
 * making a known wart worse in the exact place it was found. The pronoun is the
 * CAST's, which is `hairTakeSentence`'s rule and this room's oldest scar.
 *
 * # WHAT IT IS FOR, so a later reader does not soften it
 *
 * His bar, verbatim and corrected by him: **"it CAN'T look like a sticker."**
 * That is a FAIL class at the frames gate, not room for polish — so this
 * sentence's job is not decoration, and a frame that still reads as a decal is
 * a failure of this sentence rather than an engine limit.
 */
export function inkRealismClause(pronouns: { possessive: string }): string {
  return [
    "Draw it as a HEALED tattoo — ink that sits in the skin rather than artwork laid on top:",
    "matte, slightly faded, and following the form underneath so it curves with the body.",
    `Keep ${pronouns.possessive} own skin: its pores, its texture, its lighting, and its`,
    "highlights passing OVER the ink. It must not look like a sticker, a decal, a print or a",
    "drawing placed on the surface.",
  ].join(" ");
}

/**
 * WHERE THE DESIGN STOPS — the CARRY lane's own clause, and the only one in
 * this module that is not said on every ink road (ordered fable-1191 §1 after
 * the like-for-like court split).
 *
 * # The frame that bought it
 *
 * The realism landing fixed the fresh lane and did NOT fix the carry lane. Both
 * arms of the carry pair put the design on his T-SHIRT — `485` at `42652964`
 * and `487` at `283a0f37`, the second one with
 * {@link inkNotOnClothingClause} in full on the wire. So the prohibition is
 * present and is not enough, and this is not a synonym for it: it is the fact
 * the prohibition does not carry, which is WHERE THE EDGE IS.
 *
 * # Why the carry lane and not the fresh one
 *
 * Because of the sentence that is only ever said here:
 *
 * > *"He already has this tattoo: **keep it exactly as it is, in the same place
 * > and at the same size**."*
 *
 * On the fresh lane there is nothing to keep, so the clothing rule is the only
 * statement about extent and it lands. On the carry lane the render anchors on
 * the MASTER — which has no tattoo on it at all — while *"the same size"* points
 * at a picture that is 1200×1697 of artwork with no body in it. The painter is
 * told to preserve a size it has nothing to measure, and on both arms it chose
 * an extent that ran off the neck and onto cloth, larger than the design had
 * ever been. This clause gives it the one measure the frame actually contains.
 *
 * The fresh lane is deliberately left alone: it passed, and a clause added to a
 * passing frame is a change nobody courted.
 *
 * # The words are his
 *
 * > *"if you had a chest tatto reference with neck continuation you might see it
 * > poking out the top of the shirt but **thats the extent for now**"*
 * > (fable-1081)
 *
 * A boundary stated as a place rather than as a prohibition — the same lesson
 * `HAIR_ARRANGEMENTS` paid for: a wording that tells the painter WHERE beats one
 * that tells it what to conclude.
 */
export function inkStopsAtTheGarmentClause(pronouns: { possessive: string }): string {
  const their = pronouns.possessive;
  return `Its edge is where ${their} clothing begins. A tattoo that runs on under a garment shows only `
    + "the part above the neckline — it may poke out at the top of the collar and no further, and the "
    + `rest of it is simply not in this picture. Do not enlarge, extend or complete the design to make `
    + `more of it show, and do not draw any part of it onto ${their} clothing.`;
}

/**
 * The clothing rule in the CAST'S OWN PRONOUN — the same fact as
 * {@link INK_NOT_ON_CLOTHING}, for the lane that has pronouns to hand.
 *
 * It is a second SHAPE of one fact and not a second fact, the way the plate's
 * wrapped bullet is: `inkRealism.test.ts` holds them to the same words with the
 * pronouns substituted, so neither can be edited alone.
 */
export function inkNotOnClothingClause(pronouns: { possessive: string }): string {
  const their = pronouns.possessive;
  return `It is ink on ${their} skin — never printed, embroidered or otherwise placed on `
    + `${their} clothing, and never added to a garment as a graphic. Clothing covers ink rather `
    + "than removing it: where a tattoo runs under a garment, the part of it on bare skin appears "
    + "exactly as it is and the covered part simply does not show. Never change, move or open a "
    + "garment to reveal more of a tattoo — the clothing in a view is what it is, and the tattoo "
    + "shows only where skin shows.";
}
