/**
 * WHAT THE STUDIO SAYS WHEN IT SENDS A BRIEF BACK — the ROLL entrance's walls
 * (#206, the law-7 sweep of #192).
 *
 * # Why this module exists
 *
 * The capability atlas's door population read three shapes: `refusal("id"`
 * anywhere in `server/castingV2`, `reason: "id"` in `refineInterpreter.ts`
 * ALONE, and `"gate_*"` literals. The roll entrance refuses in a FOURTH shape —
 * `throw new BriefRefusal("id", MESSAGE)` — which nothing greps, so **all five
 * of its walls were invisible to the map**, and two of them are founder
 * boundaries the Prompt Author ruling explicitly KEEPS (`likeness`,
 * `not_a_being`). A door the map cannot see is exempt from the founder's map
 * law by accident, which is the whole content of #192 and of this.
 *
 * Measured before the repair (2026-08-29, at `docs/architecture/capability-atlas.json`):
 * `likeness`, `not_a_being`, `uninterpretable`, `reader_outage` and
 * `unsupported_cohort` — all five absent from the declared ids.
 *
 * # The criterion, inherited rather than re-invented
 *
 * **A refusal reason with a customer sentence is a DOOR** (#192). The table is
 * `Record<BriefRefusalCode, string>` — TypeScript refuses a new union member
 * with no sentence, and the atlas sees the new key the same hour because it
 * IMPORTS the table and reads its keys rather than grepping for them.
 *
 * ⚠ **AND THE SAME CRITERION IS WHY THE WARDROBE DOOR IS NOT HERE.** #206 filed
 * `wardrobeDoor.ts`'s eight ids (`blank`, `brand`, `digits`, `headwear`, `prop`,
 * `text`, `too_long`, `weapon`) as a sibling of this defect. Read at the bytes,
 * they are not doors at all: `parseWardrobePick` (`castingIntent.ts`) turns a
 * refused pick into `null`, the reason goes to a LOG COUNTER
 * (`WARDROBE_PICK_REFUSED`), and the sheet wears the house line either way —
 * since #203 slice 2 step (d) that is true whether the pick was refused or
 * admitted, because nothing reads it. **The customer is never told anything**,
 * so there is no sentence and
 * no door — they are internal decision reasons, the same class as the ~70
 * `reason:`-shaped ids #206 measured and declined to map. Recording the verdict
 * here rather than only on the card, because the next sweep will find that file
 * again and the criterion is what stops it being re-litigated. (The founder has
 * separately ruled the two-paths machinery retired — #203 — which reinforces
 * the verdict and is not what decides it.)
 *
 * ⚠ **THIS MODULE IMPORTS EXACTLY ONE THING, AND THAT IS STRUCTURAL** (the rule
 * `conceptDescribeCopy.ts` states after review of #207, finding 2). The
 * capability atlas imports this table, and the Atlas's charter is that it never
 * runs app code — so the union is declared HERE and `briefCompiler.ts` takes the
 * type from here, never the other way round. The one import is
 * `@shared/briefLength`, a leaf constants module with no imports of its own, and
 * `briefRefusalCopy.test.ts` asserts BOTH halves of that sentence: this file's
 * import list, and that the leaf is still a leaf. Copying
 * `BRIEF_TOO_SHORT_MESSAGE` instead would have been a second place stating one
 * sentence — working law 4, in the file whose subject is a vocabulary drifting
 * from itself.
 *
 * # The voice
 *
 * Sentences move BYTE-IDENTICAL (#206 is maintenance: zero customer-visible
 * change), and `briefRefusalCopy.test.ts` pins each one's bytes, because before
 * this commit `unsupported_cohort`'s sentence was pinned by nothing at all — it
 * was an inline literal written out TWICE, verbatim, at two raise sites. Two
 * copies of one customer sentence is working law 4 wearing a refusal's clothes:
 * either could have been reworded and nothing would have gone red.
 */
import { BRIEF_TOO_SHORT_MESSAGE } from "@shared/briefLength";

/**
 * The author road's two subject walls, in the customer's ear.
 *
 * Named exports as well as table entries because the roads map, the suite and
 * `conceptDescribeCopy.test.ts` all cite them by name — `NOT_A_BEING_MESSAGE`
 * is one half of a boundary whose other half is `CONCEPT_DESCRIBE_COPY.no_being`,
 * and an arm holds the two together on a shared clause.
 */
export const LIKENESS_MESSAGE =
  "Casting makes people and creatures who are nobody in particular — not a named person, and not a "
  + "character from a game, film or show. Describe the kind of face you want and we'll make that "
  + "character. "
  + "You have not been charged.";
export const NOT_A_BEING_MESSAGE =
  "Characters are people and creatures, not objects, vehicles or places. "
  + "Describe who you want in the frame and we'll make them. You have not been charged.";

/**
 * The sentence a reader outage answers with. Exported so the test that drives
 * the catch branch and the road note can cite the same words.
 */
export const READER_OUTAGE_MESSAGE =
  "The studio couldn't read your brief just now. "
  + "Nothing was made and you have not been charged. Try again in a moment.";

/**
 * THE SAME OUTAGE WHEN NO RETRY REACHES IT — our account, or no reader at all
 * (#2688, the second half; the sweep of #2686).
 *
 * `READER_OUTAGE_MESSAGE` above is honest about WHOSE fault it is and wrong
 * about what to do. *"Try again in a moment"* is true of a deadline or a dead
 * transport — the same brief a minute later is a different reading. It is a
 * **lie** when the provider has refused our own key, or when this deployment
 * has no reader configured at all: every retry it invites fails identically,
 * and the customer is left editing a brief that was never the problem.
 *
 * Measured rather than supposed: on production from 03:09Z on 2026-10-27 the
 * text account's key was disabled and every call answered `401`. The compiler
 * raised `reader_outage` for it, because `interpretBrief` returned one word
 * (`cause: "thrown"`) for both facts — so for the whole outage the founder's
 * own rolls were told to keep trying something that could not work.
 *
 * Three things it does, and each is the defect it replaces:
 *
 *   1. **It says "later", never "in a moment"** — the one thing a retry cannot
 *      fix must not be answered with an instruction to retry.
 *   2. **It does not send them back to their words.** The brief was never
 *      read; there is nothing in it to change. The sentence it replaces named
 *      the reader correctly and still left editing as the only thing to do,
 *      and `BRIEF_REFUSAL_FAULT` (`rollService.ts`) files both codes as
 *      `studio` so the sheet does not offer "Edit the brief" above either.
 *   3. **It keeps the money sentence**, in this road's own voice — nothing
 *      about the money moves in this change, and it never did: the compile
 *      runs before the claim, so every cause here was already free.
 *
 * ⚠ **IT IS A SIBLING OF TWO SENTENCES AND A COPY OF NEITHER.** The concept
 * door says this fact about a PICTURE (`conceptDescribeCopy.ts`'s
 * `READER_DOWN_MESSAGE`), the four picture roads say it about an attachment
 * (`readerDown.ts`'s `PICTURE_READER_DOWN_MESSAGE`), and Refine says it about
 * an edit. Each names its own noun and its own money, and this module may not
 * import any of them — the capability atlas reads this table and never runs
 * app code, which is the paragraph at the top of this file. **What must not
 * drift between them is the attribution and the advice**, and that is held by
 * arms rather than by this paragraph (`briefRefusalCopy.test.ts`).
 *
 * ⚠ **AND IT NAMES NO ENGINE, NO VENDOR AND NO STATUS CODE**, which is the
 * disappearing-technology law's one hard line (clause 5: no engine name on a
 * path someone must walk to reach their picture).
 */
export const READER_DOWN_MESSAGE =
  "The studio can't read briefs just now — that's something at our end, not your words. "
  + "Nothing was made and you have not been charged. Try again later.";

/*
  ⚠ `UNSUPPORTED_COHORT_MESSAGE` STOOD HERE AND IS GONE (#1495), and with it the
  `unsupported_cohort` member of the table below. It said:

      "Casting makes photographic people, and only ones who are nobody in
      particular — not a named person, not a character from a game or film, and
      not anime or illustration yet. Describe the kind of face you want and
      we'll cast that. You have not been charged."

  ⚠ That quote keeps the word `cast` where every live sentence on this road
  lost it (#2812, 2026-10-30), and it is left alone ON PURPOSE: the line above
  it says *"It said:"*, so this is a record of what a retired message read, and
  rewriting it would make the record claim words that sentence never carried.
  A sweep for the old wording meets it here and stops.

  Two things about it, and the second is why this is a correction rather than a
  tidy-up. It was the TWO-VALUED cohort question's wall, and that question is
  retired in this commit, so nothing can raise it. And its sentence had outlived
  the product it described: *"not anime or illustration yet"* was true when a
  single certified adapter painted photographic humans, and his word of
  2026-09-23 retired it — *"we already do creatures perfectly fine all types of
  creatures"*. An anime brief CASTS here now. So the door was unreachable AND
  its copy contradicted the studio; had it ever fired it would have told a
  customer something the product does not believe.

  The five-wall count in the paragraphs above is the count as it was at #206,
  and is left as the record of what that commit found. There are four.
*/

/**
 * EVERY WALL THE ROLL ENTRANCE PUTS UP, AND WHAT IT SAYS.
 *
 * All four are raised BEFORE the claim, so every one of them is free: the
 * compiler runs before `rollService` claims anything, which is why a refusal
 * here can be honest instead of apologetic.
 */
export const ROLL_REFUSAL_COPY = {
  /** The brief carries no subject the compiler can work with. */
  uninterpretable: BRIEF_TOO_SHORT_MESSAGE,
  /**
   * The brief asks for a real person or a named character — the one wall the
   * author road KEEPS from the cohort question (ruling §6 rule 5; a
   * customer's cast is theirs, and so is everyone else's).
   */
  likeness: LIKENESS_MESSAGE,
  /**
   * The brief asks for something that is not a being — an object, a vehicle,
   * a scene. THE one wall the author road ADDS (ruling §6: "someone asking for
   * an object should be refused like a car"). Free, before the claim.
   */
  not_a_being: NOT_A_BEING_MESSAGE,
  /**
   * The brief reader never read the brief, and the next try might — the call
   * threw: a deadline, a dead transport, a provider that was down. Free,
   * before the claim, by founder ruling (#126, Crew reply #7: "refuse-free").
   *
   * ⚠ **IT NO LONGER COVERS "no engine is configured" — THAT IS
   * `reader_down` BELOW** (#2688). This entry's docblock named both, and the
   * two were one door while `interpretBrief` returned one word for them.
   */
  reader_outage: READER_OUTAGE_MESSAGE,
  /**
   * The brief reader cannot read AT ALL — the provider refused our own key
   * (`cause: "account"`), or this deployment has no reader
   * (`cause: "unconfigured"`). Free before the claim exactly as its sibling
   * is; the only thing that differs is that it does not ask for a retry it
   * cannot honour. See {@link READER_DOWN_MESSAGE} for the measurement.
   */
  reader_down: READER_DOWN_MESSAGE,
} as const satisfies Readonly<Record<string, string>>;

/**
 * Every refusal a customer of the ROLL entrance may be shown, named.
 *
 * DERIVED FROM THE TABLE rather than declared beside it, for the reason
 * `ConceptDescribeRefusal` is: the sentence is what makes a reason a door, so
 * the table is the vocabulary and this is a reading of it.
 */
export type BriefRefusalCode = keyof typeof ROLL_REFUSAL_COPY;

/*
  NO `rollRefusalSentence(code)` HELPER, deliberately — the shape
  `conceptDescribeCopy.ts` has and this does not. That entrance chooses its
  reason at runtime and needs a lookup; here every raise site names its own
  constant, so a helper would be an unread export. The repo's uncalled-export
  sweep refused it, correctly, the first time it was written.
*/
