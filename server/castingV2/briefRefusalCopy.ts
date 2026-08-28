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
 * (`WARDROBE_PICK_REFUSED`), and `bornWardrobeLine` falls back to the house
 * line. **The customer is never told anything**, so there is no sentence and
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
  + "character from a game, film or show. Describe the kind of face you want and we'll cast that. "
  + "You have not been charged.";
export const NOT_A_BEING_MESSAGE =
  "This is a casting studio — it casts people and creatures, not objects, vehicles or places. "
  + "Describe who you want in the frame and we'll cast them. You have not been charged.";

/**
 * The sentence a reader outage answers with. Exported so the test that drives
 * the catch branch and the road note can cite the same words.
 */
export const READER_OUTAGE_MESSAGE =
  "The studio couldn't read your brief just now — the reader that turns your words into a casting call did not answer. "
  + "Nothing was cast and you have not been charged. Try again in a moment.";

/**
 * ⚠ **THIS SENTENCE WAS WRITTEN OUT TWICE, INLINE, AND EXPORTED NOWHERE** —
 * once for the interpreter's own `unsupported_cohort` verdict and once for a
 * styled brief whose reader was unavailable off the author road. Both raise
 * sites now read this constant.
 */
export const UNSUPPORTED_COHORT_MESSAGE =
  "Casting makes photographic people, and only ones who are nobody in particular — not a named person, not a character from a game or film, and not anime or illustration yet. Describe the kind of face you want and we'll cast that. You have not been charged.";

/**
 * EVERY WALL THE ROLL ENTRANCE PUTS UP, AND WHAT IT SAYS.
 *
 * All five are raised BEFORE the claim, so every one of them is free: the
 * compiler runs before `rollService` claims anything, which is why a refusal
 * here can be honest instead of apologetic.
 */
export const ROLL_REFUSAL_COPY = {
  /** The brief carries no subject the compiler can work with. */
  uninterpretable: BRIEF_TOO_SHORT_MESSAGE,
  /** A cohort exists in the sentence that no adapter is certified for (§I). */
  unsupported_cohort: UNSUPPORTED_COHORT_MESSAGE,
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
   * The brief reader never read the brief — the call threw (deadline,
   * transport, provider) or no engine is configured. Free, before the claim,
   * by founder ruling (#126, Crew reply #7: "refuse-free").
   */
  reader_outage: READER_OUTAGE_MESSAGE,
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
