/**
 * HOW LONG A BRIEF MAY BE — the two numbers, shared because the sheet must know
 * them too (#131 slice D; review of PR #137, finding 1): a *use as brief*
 * button offered on a prompt the entrance would refuse is a dead control
 * wearing a button, so the client reads the same bound the server enforces.
 *
 * The RULE lives on the server (`server/castingV2/briefLength.ts`); this file
 * is only the numbers.
 */
export const BRIEF_TEXT_MAX = 2000;
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
