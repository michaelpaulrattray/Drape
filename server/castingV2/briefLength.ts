/**
 * HOW LONG A BRIEF MAY BE — one number, one road (#131 slice D, #1204).
 *
 * `BRIEF_TEXT_MAX_AUTHOR_ROAD` (4,000) is what the entrance admits and what
 * every roll is bounded at. It exists for ONE reason: the prompt a sheet was
 * painted from is shown on the sheet and offered back as the next brief (*use
 * as brief*, ruling rule 5). The author's budget is ~400 WORDS (rule 14), and
 * 400 words is more than 2,000 characters: the court's authored prompts
 * measured 468–2,758 characters, 5 of 11 over 2,000
 * (`output/prompt-author-court-run2/prompts.json`, arms B/C/Cr). Past 4,000 the
 * road refuses FREE, before the claim — and the sheet does not offer *use as
 * brief* on a prompt this bound would refuse (the same finding).
 *
 * ⚠ **THERE WERE TWO BOUNDS UNTIL 2026-09-25, AND THE SECOND ONE HAD NO
 * POPULATION** (#1204, found by the N1 milestone-close deep review; his word:
 * *"yes ill let the crew remove it"*).
 *
 * `BRIEF_TEXT_MAX` (2,000) bound every roll that COMPOSED HOUSE — every account
 * outside `CASTING_CREATIVE_REGISTER_SCOPE` — and refused a longer brief with
 * its own sentence. **That flag went to `all` on 2026-09-24** (his Crew reply
 * #201, the switch sitting), so from that moment every roll took the author
 * road and the house bound was a ternary arm nothing could reach. It stayed
 * green, stayed invoked, and stayed described here as a live rule: the
 * path-three shape this repository has now been bitten by four times, and the
 * reason the un-wiring differ cannot help — **the call site never went away.
 * The condition in front of it stopped being satisfiable.**
 *
 * ⚠ **AND ONE THING THE REMOVAL EXPOSES RATHER THAN CAUSES, said here because
 * this is where it was written down.** The paragraph that died was also the
 * stated justification for `NOTES_MAX_FIDELITY` (2,000, `castingIntent.ts`):
 * the flag catalogue argues that number is *"the BRIEF's own bound … a bound
 * true by construction beats one true by measurement."* **On the author road
 * the brief's own bound is 4,000, so that construction stopped holding on
 * 2026-09-24 — a day before this file mentioned it.** Nothing here changes what
 * any customer meets; what changes is that the premise is now visibly absent
 * instead of quietly false. Filed on its own card rather than re-decided in
 * passing, because choosing a notes bound is a measurement, not a tidy-up.
 *
 * The rule is checked in the SERVICE rather than the schema because the refusal
 * must be free and must happen before the claim.
 */
import { BRIEF_TEXT_MAX_AUTHOR_ROAD } from "../../shared/briefLength";

export { BRIEF_TEXT_MAX_AUTHOR_ROAD };

export const BRIEF_TOO_LONG_AUTHOR_ROAD_MESSAGE =
  "That brief is over 4,000 characters. Shorten it and roll again. You have not been charged.";

/** The sentence a brief is refused with, or null when it may roll. */
export function briefTooLong(briefText: string): string | null {
  if (briefText.length <= BRIEF_TEXT_MAX_AUTHOR_ROAD) return null;
  return BRIEF_TOO_LONG_AUTHOR_ROAD_MESSAGE;
}
