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
  "A picture in, a description of who is in it out — yours to read and edit before you cast, "
  + "so you can cast someone similar. We never keep the picture.";

/**
 * The coming-state line, outside the scope. It names the capability that is
 * built and waiting rather than the one the prototype promised.
 */
export const CONCEPT_CARD_COMING =
  "Reading a person or creature out of a picture you already have is coming. "
  + "For now, describe them and cast them.";

/** Said on the card itself while the one describer call is in flight. */
export const CONCEPT_READING_LABEL = "Reading the picture…";

/**
 * THE CARD'S DRAG-OVER LINE (#196, amendment 2).
 *
 * His words: *"i want to be able to drag and drop the image into the upload
 * concept card and it will auto open up the modal with the reference image in
 * it."* A drop target nobody can see is not a drop target, so the card says so
 * while a file is over it — which is also the whole of "the drop target is
 * discoverable" from his build notes.
 */
export const CONCEPT_CARD_DROP = "Drop it here — we'll read it straight away.";

/**
 * OUR SENTENCE WHEN THE SERVER'S NEVER ARRIVED (`readableFailure`'s fallback).
 *
 * The door's own refusals are written for a reader and pass through untouched —
 * "I couldn't find anyone in that picture", and the two that are honestly
 * about us. This one covers a transport or a parser, which knows nothing about
 * her picture and must not pretend to.
 */
export const CONCEPT_FAILED_FALLBACK = "That picture couldn't be read just now. Try again in a moment.";

/** Said when the browser itself could not read the chosen file. */
export const CONCEPT_FILE_UNREADABLE = "That file couldn't be read. Try another picture.";


/* --------------------------------------------------------- the review step */

/**
 * THE REVIEW MODAL'S WORDS (#196, his direction 2026-08-28).
 *
 * Verbatim: *"when you go to upload a concept image to be casted it opens in a
 * popout modal instead of putting it into the small prompt box? thoughts?"* —
 * adopted. The description no longer lands in the brief box on arrival; it
 * lands in a modal with the photograph beside it, and reaches the box only when
 * she says so.
 *
 * **It is a REVIEW STEP, not a wizard** — one modal, one confirm, no second
 * page and no options (settings stay in the gear). What it buys beyond comfort
 * is the check that the photo-beside-words view already proved it can catch:
 * a description read off the WRONG picture is invisible in a text box and
 * obvious when the two sit side by side (foreman-74 found exactly that in an
 * eye item, by opening the frames). The customer gets that check for free,
 * before spending anything.
 *
 * **Nothing is charged on either exit.** Abandoning costs her nothing and
 * confirming costs her nothing — the credits go at the roll, as they always
 * have; the describer read is house money and was already spent when these
 * words appeared.
 */
export const CONCEPT_REVIEW_EYEBROW = "UPLOAD A CONCEPT";

export const CONCEPT_REVIEW_TITLE = "This is what we'll cast";

/**
 * His own sentence, near enough to keep: *"this is what we'll cast — edit
 * anything"*. The second half states the thing a customer most needs to know
 * and least expects — that what casts is these WORDS and not the photograph,
 * which is what makes this a type rather than a likeness.
 */
export const CONCEPT_REVIEW_EXPLAINER =
  "Edit anything. We cast from these words, not from your picture — "
  + "so you get someone of this type, not this person. The picture isn't kept.";

/** The field's own mono label, in the house shape. */
export const CONCEPT_REVIEW_LABEL = "THE DESCRIPTION";

/** The one primary action. His words. */
export const CONCEPT_REVIEW_USE = "Use this brief";

/** The way out. Nothing is charged either way, so it says nothing about cost. */
export const CONCEPT_REVIEW_DISCARD = "Discard";

/** Drawn on the right while the one describer call is in flight. */
export const CONCEPT_REVIEW_READING = CONCEPT_READING_LABEL;

/* ------------------------------------------- the two entrances, and the cast */

/**
 * ⚠ **THE MODAL NOW OPENS BEFORE A PICTURE EXISTS, and it casts from inside
 * itself — his TWO AMENDMENTS on #196, both verbatim on the card.**
 *
 * > *"the button should be cast it and it automatically casts the prompt the
 * > same flow the original prompt and casting takes just through the modal"*
 *
 * > *"i want to be able to drag and drop the image into the upload concept card
 * > and it will auto open up the modal with the reference image in it
 * > alternatively i can click the card and it opens up the modal and then i can
 * > upload or drag and drop the reference image in - it gets analyzed - i read
 * > the brief decide whether to edit it and cast"*
 *
 * So the dialog has four states rather than two, and every string either state
 * needs lives here: **empty** (opened by a click, waiting for a picture),
 * **reading**, **refused**, and **read**. It is still one modal, one primary
 * action and no second page — what changed is that the primary now SPENDS,
 * which is why the price arrives with it below.
 *
 * # THE PRICE IS ABOVE THE BUTTON, NEVER ON IT — D-109, and the card's gloss
 *
 * The issue text glosses his amendment as *"with the price on it, per the
 * paid-button law"*. His own sentence says only *"the button should be cast
 * it"*, and the ratified law says the opposite of the gloss: **D-109 names
 * "Cast it" by name as an immediate-fire action, rules that cost is metadata
 * and never button text, and records that putting a price inside a confirm's
 * button was tried and reversed the same day.** So the button reads "Cast it"
 * and the number sits directly above it in the cost line — the sign modal's
 * shape exactly, and the letter of what he asked for: she cannot tap it without
 * the price in her eye.
 */
export const CONCEPT_REVIEW_CAST = "Cast it";

/**
 * THE EMPTY STATE'S TITLE — not "This is what we'll cast", because at this
 * point there is nothing to cast and a title that says otherwise is furniture
 * pretending to be a promise.
 */
export const CONCEPT_REVIEW_EMPTY_TITLE = "Start from a picture";

/**
 * The empty state's explainer. It carries the same two facts the card's line
 * does — someone SIMILAR, and the picture is not kept — because this is now a
 * place a customer can arrive at without having read the card at all (she
 * dropped a file on it, or she tapped it and is looking at this first).
 */
export const CONCEPT_REVIEW_EMPTY_EXPLAINER =
  "Drop a picture in, or choose one. We read the person out of it and write you a brief, "
  + "so you can cast someone similar — not this person. We never keep the picture.";

/** Inside the drop zone. */
export const CONCEPT_DROP_LINE = "Drop a picture here";

/** The picker's own button, and the way in for anyone who does not drag. */
export const CONCEPT_DROP_CHOOSE = "Choose a picture";

/**
 * SAID WHEN THE FILE POSITIVELY DECLARES ITSELF SOMETHING ELSE.
 *
 * It names the formats rather than the refusal, because "unsupported file type"
 * tells her what happened and not what to do. An unknown type is never refused
 * here at all — see `firstPictureFrom`.
 */
export const CONCEPT_NOT_A_PICTURE = "That isn't a picture we can read. Try a PNG, JPEG or WebP.";

/**
 * ⚠ **THE RETRY IS INSIDE THE MODAL NOW, AND THAT REVERSES WHAT SHIPPED.**
 *
 * PR #197's own docblock argued the modal should CLOSE on a refusal, on the
 * ground that an in-modal retry is the "extra options" his one-modal-one-confirm
 * order rules out. His amendment 2's build notes say the opposite in as many
 * words — *"a failed read gets a plain retry inside the modal, nothing
 * charged"* — and his word is newer and more specific, so it governs.
 *
 * It is also better than the argument it replaces: closing the dialog threw her
 * picture away, so recovering from a transport blip meant finding the file
 * again. Two exits are offered rather than one, because the refusals differ in
 * what they mean — a gateway blip is worth the same picture again, while
 * *"I couldn't find anyone in that picture"* is deterministic and a bare
 * retry would just spend house money to be told the same thing.
 */
export const CONCEPT_REVIEW_RETRY = "Try again";

/** The other exit from a refusal — the one that answers an honest wall. */
export const CONCEPT_REVIEW_ANOTHER = "Choose another picture";

/**
 * THE REFUSED STATE'S OWN TITLE — and it exists because the frame said so.
 *
 * ⚠ Driven at the running app, the refusal shipped under *"This is what we'll
 * cast"* with the read state's explainer above it: *"Edit anything. We cast
 * from these words…"* — said over a dialog holding NO words, because nothing
 * was read. Two claims about a thing that does not exist, on the one surface
 * whose whole job is telling her what will be cast.
 *
 * The door's own sentence carries the WHY, so this only has to carry the what,
 * and it says "that one" rather than "your picture" because the picture is
 * still on screen beside it and the next act may be a different one.
 */
export const CONCEPT_REVIEW_REFUSED_TITLE = "We couldn't read that one";

/**
 * THE WAY OUT WHILE THE READ IS STILL RUNNING.
 *
 * His build note asks for the progress line to come "with cancel", and Discard
 * is the wrong word for it: there is nothing to discard yet. Same button, same
 * position, same handler — only the label tracks what the tap actually does.
 */
export const CONCEPT_REVIEW_CANCEL = "Cancel";

/**
 * THE COUNT IS BARE — a number of characters and no denominator, deliberately.
 *
 * His direction asks for a character count and this is the whole of it. A
 * `184 / 300` would be a **lie about the product**: `CONCEPT_DESCRIPTION_MAX`
 * (300) bounds what the DESCRIBER may return and had already done its work
 * before these words appeared — after she edits them, nothing refuses at 301.
 * The only bound that governs the edited text is the roll entrance's, and the
 * entrance speaks that refusal itself, before the claim.
 *
 * So a denominator here would be a second copy of a server cap that does not
 * even apply (working law 4, and issue #27 names the class). If a ceiling is
 * ever genuinely wanted on this surface, the number rides the wire from the
 * door that owns it — never a constant typed on this side.
 */
export function conceptCountLabel(characters: number): string {
  return `${characters} character${characters === 1 ? "" : "s"}`;
}

/**
 * WHERE THE DESCRIPTION LANDS — appended, never on top of her own words.
 *
 * The box is usually empty when this card is tapped, and then the description
 * simply IS the brief, which is his sentence ("without having to type it all
 * out"). When it is not empty, the words already in it are hers and a silent
 * replace destroys them. So: her sentence first, a blank line, then what was
 * read — the same order the author road composes in, and both halves stay
 * editable.
 *
 * ⚠ **THE REVIEW MODAL (#196) DOES NOT CHANGE THIS RULE, and the temptation it
 * creates is worth naming.** Once she has read and edited the full description
 * in a dialog, *replace the box* becomes a defensible reading of his
 * "description lands in the prompt box" — and it is not the ratified one. The
 * append rule is founder record (#185, in CLAUDE.md's flag paragraph: *the
 * description lands beside her words, never on top of them*), and a review step
 * that quietly starts deleting her typing would be the review step doing the
 * one thing it exists to prevent. The earlier version of this paragraph argued
 * that "a confirm dialog to protect two lines of typing is heavier than the
 * thing it protects" — that argument was about a dialog whose ONLY job was
 * guarding the paste, and it is not the dialog he asked for; the modal earns
 * its weight by showing her the photograph beside the words.
 *
 * It does not police LENGTH. The entrance owns that refusal
 * (`BRIEF_TEXT_MAX_AUTHOR_ROAD`, spoken, before the claim) and a second opinion
 * about how long a brief may be is exactly the parallel copy working law 4
 * forbids — `CONCEPT_DESCRIPTION_MAX` (300 since his ruling, and 1,200 before
 * it) is set well under both bounds so a description alone can never reach one.
 */
export function briefWithDescription(existing: string, description: string): string {
  const kept = existing.trim();
  const read = description.trim();
  if (!kept) return read;
  if (!read) return kept;
  return `${kept}\n\n${read}`;
}
