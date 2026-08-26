/**
 * HOW LONG A BRIEF MAY BE — two numbers, one road each (#131 slice D).
 *
 * `BRIEF_TEXT_MAX` (2,000) is the bound every roll has had since the entrance
 * existed, and it still binds every roll that COMPOSES HOUSE — every account
 * outside `CASTING_CREATIVE_REGISTER_SCOPE`. (Inside it, a FOLLOW or a
 * chip-edited roll composed house too until #154 — the family clause — and
 * took this bound; since then every flagged roll is the author road and takes
 * the other one.) The service refuses a longer brief FREE, before the claim,
 * with `BRIEF_TOO_LONG_MESSAGE`, so the house road is byte-identical to
 * today's even though the zod schema at the entrance now admits more.
 *
 * ⚠ The rule keys on the ROAD THE ROLL TAKES, not on the account's flag
 * (review of PR #137, finding 2): the first cut keyed on the flag alone, and a
 * flagged account's follow — which composed house at the time — would have
 * carried up to 4,000 characters into a compile whose announced caps were
 * sized for 2,000 (CLAUDE.md's brief-fidelity paragraph chose
 * `NOTES_MAX_FIDELITY` on the premise that the brief is bounded at 2,000 *by
 * construction* where the roll is accepted; that premise holds per ROAD, and
 * this is where it holds). The road and the flag coincide again since #154,
 * and the rule still keys on the road so that the day they part they part
 * here. The predicate is the compiler's own, stated once here and once there.
 *
 * `BRIEF_TEXT_MAX_AUTHOR_ROAD` (4,000) is what the entrance admits and what
 * the AUTHOR road is bounded at, and it exists for ONE reason: on that road the
 * prompt a sheet was painted from is shown on the sheet and offered back as
 * the next brief (*use as brief*, ruling rule 5). The author's budget is ~400
 * WORDS (rule 14), and 400 words is more than 2,000 characters: the court's
 * authored prompts measured 468–2,758 characters, 5 of 11 over 2,000
 * (`output/prompt-author-court-run2/prompts.json`, arms B/C/Cr). Past 4,000
 * the road refuses FREE too, with its own sentence — and the sheet does not
 * offer *use as brief* on a prompt this bound would refuse (the same finding).
 *
 * The rule is checked in the SERVICE rather than the schema because a zod
 * schema cannot know which road a roll takes; the service can.
 */
import { BRIEF_TEXT_MAX, BRIEF_TEXT_MAX_AUTHOR_ROAD } from "../../shared/briefLength";

export { BRIEF_TEXT_MAX, BRIEF_TEXT_MAX_AUTHOR_ROAD };

export const BRIEF_TOO_LONG_MESSAGE =
  "That brief is over 2,000 characters. Shorten it and roll again. You have not been charged.";
export const BRIEF_TOO_LONG_AUTHOR_ROAD_MESSAGE =
  "That brief is over 4,000 characters. Shorten it and roll again. You have not been charged.";

/**
 * The sentence a brief is refused with, or null when it may roll.
 *
 * `authorRoad` is the ROAD the compiler will take — since #154 the register
 * flag alone (`rollService` and `briefCompiler` decide it from the same input).
 */
export function briefTooLong(briefText: string, authorRoad: boolean): string | null {
  const bound = authorRoad ? BRIEF_TEXT_MAX_AUTHOR_ROAD : BRIEF_TEXT_MAX;
  if (briefText.length <= bound) return null;
  return authorRoad ? BRIEF_TOO_LONG_AUTHOR_ROAD_MESSAGE : BRIEF_TOO_LONG_MESSAGE;
}
