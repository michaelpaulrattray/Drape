/**
 * HOW LONG A BRIEF MAY BE — two numbers, one road each (#131 slice D).
 *
 * `BRIEF_TEXT_MAX` (2,000) is the bound every roll has had since the entrance
 * existed, and it still binds every account outside
 * `CASTING_CREATIVE_REGISTER_SCOPE`: the service refuses a longer brief FREE,
 * before the claim, with `BRIEF_TOO_LONG_MESSAGE`, so the unflagged product is
 * byte-identical to today's even though the zod schema at the entrance now
 * admits more.
 *
 * `BRIEF_TEXT_MAX_AUTHOR_ROAD` (4,000) is what the entrance admits, and it
 * exists for ONE reason: on the author road the prompt a sheet was painted from
 * is shown on the sheet and offered back as the next brief (*use as brief*,
 * ruling rule 5 — "the expanded prompt is shown on the cast, editable"). The
 * author's budget is ~400 WORDS (rule 14), and 400 words is more than 2,000
 * characters: the court's authored prompts measured 468–2,758 characters, 5 of
 * 11 over 2,000 (`output/prompt-author-court-run2/prompts.json`, arms B/C/Cr).
 * So at the old bound *use as brief* would have been a control that refuses
 * its own content on rich and MAX sheets — D-107's dead control, wearing a
 * button. 4,000 is the budget's ceiling with room; the ruling (§6) kills the
 * 2,000-character cap on this road in favour of the word budget, and the word
 * budget is what bounds a flagged brief (`authorAllowance`, floor 40).
 *
 * The number is checked in the SERVICE rather than the schema because a zod
 * schema cannot know who is asking, and the flag is per account.
 */
export const BRIEF_TEXT_MAX = 2000;
export const BRIEF_TEXT_MAX_AUTHOR_ROAD = 4000;

export const BRIEF_TOO_LONG_MESSAGE =
  "That brief is over 2,000 characters. Shorten it and roll again. You have not been charged.";

/** True when this brief must be refused: longer than the unflagged bound, and the account is off the author road. */
export function briefTooLongOffTheRoad(briefText: string, authorRoad: boolean): boolean {
  return !authorRoad && briefText.length > BRIEF_TEXT_MAX;
}
