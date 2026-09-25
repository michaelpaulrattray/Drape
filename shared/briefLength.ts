/**
 * HOW LONG A BRIEF MAY BE — shared because the sheet must know it too (#131
 * slice D; review of PR #137, finding 1): a *use as brief* button offered on a
 * prompt the entrance would refuse is a dead control wearing a button, so the
 * client reads the same bound the server enforces.
 *
 * The RULE lives on the server (`server/castingV2/briefLength.ts`); this file
 * is only the numbers.
 *
 * ⚠ **IT WAS TWO NUMBERS UNTIL 2026-09-25 (#1204), AND THE SECOND ONE DIED OF
 * A RULING AIMED AT SOMETHING ELSE.** `BRIEF_TEXT_MAX` (2,000) bound every roll
 * that COMPOSED HOUSE — every account outside `CASTING_CREATIVE_REGISTER_SCOPE`.
 * That flag went to `all` on 2026-09-24 (his Crew reply #201), so the set it
 * described emptied, and a free refusal, its message and its arms went on
 * running for a road with nobody on it. Nothing reddened: the call site was
 * still there, still invoked, still green — the path-three class, which is why
 * the N1 milestone-close deep review was looking for exactly this shape.
 * His word, 2026-09-25: *"yes ill let the crew remove it"*.
 *
 * **The name keeps `_AUTHOR_ROAD` on purpose.** One bound is left, so the
 * suffix looks redundant — and it is the only thing recording WHICH of the two
 * roads' bounds survived, on a rung whose whole job is retiring the other road.
 * Renaming it would cost the reader that fact to save them a word.
 */
export const BRIEF_TEXT_MAX_AUTHOR_ROAD = 4000;

/**
 * ⚠ **AND THE FLOOR, which was TWO copies of a literal until the gate review of
 * PR #199 found what that costs.**
 *
 * The compiler has always refused a brief under three characters with a
 * sentence; the lobby's own dispatch gate had the same `3` typed on the client
 * and answered with a SILENT return. That was survivable while the only way to
 * reach it was the hero button beside a nearly-empty box. #196's concept modal
 * made it reachable from behind a PRICE — she edits the description down to one
 * character, taps *Cast it*, the dialog closes and nothing happens — which is
 * D-180's dead control with a number above it.
 *
 * So the floor and its sentence live here, and both sides read them. The
 * sentence is the SERVER'S existing one, unchanged, because a second wording of
 * the same refusal is how a customer learns the product has two opinions.
 */
export const BRIEF_TEXT_MIN = 3;

export const BRIEF_TOO_SHORT_MESSAGE =
  "That brief is too short to cast from. Describe the person in a sentence.";
