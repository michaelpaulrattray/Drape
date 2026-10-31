/**
 * THE SPOTLIGHT'S WORDS — #14 slice 3b, apart from the component that draws
 * them, for the same reason `referenceAttachCopy.ts` is: the UI milestone
 * contract audits every customer-visible string, and the mechanizable half of
 * that audit is a suite rather than review memory.
 *
 * ## What the surface may say, and what it may not
 *
 * The disappearing-technology law, applied to a picture: the words say what is
 * happening TO the picture and never what is doing it. No "split", no
 * "segment", no "piece map", no engine, no percentage — the light on the
 * picture is the explanation, and a sentence describing the machinery under it
 * would be the machinery showing through (law 6 of the gate).
 *
 * There are deliberately few strings. Hovering needs none (the light IS the
 * answer), a tap needs none when it works (the chip is the answer), and a
 * picture that will not light says NOTHING at all — §3 item 1's fail-open is
 * *"nothing said about machinery"*, so the attach simply looks as it did.
 */

/**
 * WHILE THE PICTURE IS BEING READ — §3 item 1, the design's own words.
 *
 * Present tense, about THEIR picture, naming no catalogue: the exact defect his
 * finding 1 on #2566 caught in the cast panel's loader was a reading state that
 * listed what it was looking for.
 */
export const SPOTLIGHT_READING = "Reading your picture…";

/**
 * A TAP THAT FOUND NOTHING IT COULD TAKE — the design's §2 sentence, with one
 * word moved because a tap is about a PLACE.
 *
 * §2 wrote *"We couldn't find anything in this picture to take. You can still
 * describe what you want in words."* for a reading that found nothing, and its
 * 2026-10-31 amendment says the sentence survives where it is still true: *"a
 * TAP whose cut the judge refuses gets it."* After a tap, "in this picture"
 * would overclaim — the customer pointed at one spot, and the rest of the
 * picture may hold plenty — so the place is the spot they pointed at.
 */
export const SPOTLIGHT_NOTHING_THERE =
  "We couldn't find anything there to take. You can still describe what you want in words.";

/**
 * A TAP ON A FACE — the likeness fence, said rather than silent.
 *
 * §6: *"A face never lights, on any road, under any split"*, and the server
 * refuses a tap that found only a face. A tap that does nothing reads as a
 * broken picture, so the refusal says what was refused and what to do — and it
 * says it about faces in general, never about this person.
 */
export const SPOTLIGHT_NOT_A_FACE =
  "A face can't be taken from a picture. Tap something else, or describe what you want in words.";

/** The quiet chip while a tap is being taken — for a screen reader; sighted people see it pulse. */
export const SPOTLIGHT_TAKING_LABEL = "Taking that from your picture…";

/**
 * THE `×` ON A TAKEN CHIP — "let go", the design's own verb (§3 item 3: *"Tap
 * to take; tap again to let go"*). Tapping the piece again on the picture does
 * the same thing; this is the door for whoever reaches for the chip instead.
 */
export function letGoLabel(name: string | null): string {
  if (!name) return "Let go of this";
  /* The reader may capitalise its noun as if it were a title ("Leather
     jacket"); inside a sentence it is an ordinary word. */
  return `Let go of the ${name.charAt(0).toLowerCase()}${name.slice(1)}`;
}

/**
 * WHAT A SCREEN READER IS TOLD THE OPEN PICTURE IS.
 *
 * It names the act in the customer's terms — point and take — because the
 * picture is a control now, and a control with no name is one a screen reader
 * cannot find. Words still work for everyone, which is why it says so.
 */
export const SPOTLIGHT_STAGE_LABEL =
  "Your picture. Tap anything in it to take it, or describe what you want in words.";

/** What a taken chip with no name is called — the cut is shown, and nothing is guessed. */
export const SPOTLIGHT_UNNAMED_LABEL = "Something from your picture";
