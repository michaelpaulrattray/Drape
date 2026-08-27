/**
 * UPLOAD A CONCEPT — the words on the card, and the one rule about where the
 * description lands (#185 slice two, founder-ordered 2026-08-28).
 *
 * His order, verbatim:
 *
 * > *"the upload a person should be upload a concept or somthing like that …
 * > if you have a model already or concept or image you can upload it the
 * > image analyzer will analyze and describe it to the authour and cast it
 * > with the description … that way its easy for someone to upload an image
 * > and get a prompt to create someone similar without having to type it all
 * > out."*
 *
 * Slice one built the door (`castingV2.concept.describe`, dark behind
 * `CASTING_CONCEPT_UPLOAD_SCOPE`). This is the surface it is reached from, and
 * everything the customer READS about it lives here rather than inside the
 * component, so the copy can be driven by the suite without a DOM.
 *
 * # THE CARD SAYS WHAT THE ROAD ACTUALLY DOES, NOT WHAT AN UPLOAD USUALLY MEANS
 *
 * An "upload" control on a casting product reads as *cast THIS person*, and
 * that is precisely what this is not: the photograph never rides to an engine,
 * so what comes back is a TYPE and never a likeness (`conceptDescribe.ts`'s own
 * header, and `briefCompiler.ts`'s likeness wall still stands in front of the
 * compile). The line therefore states both halves — someone similar, and the
 * picture is not kept — because a customer who learns that from the result has
 * already been surprised once.
 *
 * The quotation-not-requirement law (founder, 2026-08-01) applies: the F5
 * placeholder this replaces promised *"Casting from your own photos"*, which is
 * a claim about likeness upload and is still not a thing the product does. The
 * coming-state below promises the capability that is genuinely queued.
 */

/**
 * One title for both states, because it is one thing — drawn live where the
 * door would admit her, and as an honest coming-state where it would not
 * (PROGRAM.md's placeholder amendment: honest or dark, never pretending).
 */
export const CONCEPT_CARD_TITLE = "Upload a concept";

/** The live line. Two facts, both load-bearing; see the header. */
export const CONCEPT_CARD_LINE =
  "A picture in, a description of the person out — straight into your brief to edit, "
  + "so you can cast someone similar. We never keep the picture.";

/**
 * The coming-state line, outside the scope. It names the capability that is
 * built and waiting rather than the one the prototype promised.
 */
export const CONCEPT_CARD_COMING =
  "Reading a person out of a picture you already have is coming. "
  + "For now, describe the person and cast them.";

/** Said on the card itself while the one describer call is in flight. */
export const CONCEPT_READING_LABEL = "Reading the picture…";

/**
 * OUR SENTENCE WHEN THE SERVER'S NEVER ARRIVED (`readableFailure`'s fallback).
 *
 * The door's own refusals are written for a reader and pass through untouched —
 * "I couldn't find a person in that picture", and the two that are honestly
 * about us. This one covers a transport or a parser, which knows nothing about
 * her picture and must not pretend to.
 */
export const CONCEPT_FAILED_FALLBACK = "That picture couldn't be read just now. Try again in a moment.";

/** Said when the browser itself could not read the chosen file. */
export const CONCEPT_FILE_UNREADABLE = "That file couldn't be read. Try another picture.";


/**
 * WHERE THE DESCRIPTION LANDS — appended, never on top of her own words.
 *
 * The box is usually empty when this card is tapped, and then the description
 * simply IS the brief, which is his sentence ("without having to type it all
 * out"). When it is not empty, the words already in it are hers and a silent
 * replace destroys them; a confirm dialog to protect two lines of typing is
 * heavier than the thing it protects. So: her sentence first, a blank line,
 * then what was read — the same order the author road composes in, and both
 * halves stay editable.
 *
 * It does not police LENGTH. The entrance owns that refusal
 * (`BRIEF_TEXT_MAX_AUTHOR_ROAD`, spoken, before the claim) and a second opinion
 * about how long a brief may be is exactly the parallel copy working law 4
 * forbids — `CONCEPT_DESCRIPTION_MAX` (1,200) is set well under both bounds so
 * a description alone can never reach one.
 */
export function briefWithDescription(existing: string, description: string): string {
  const kept = existing.trim();
  const read = description.trim();
  if (!kept) return read;
  if (!read) return kept;
  return `${kept}\n\n${read}`;
}
