/**
 * WHAT A CUSTOMER IS TAKING FROM A REFERENCE — the intent vocabulary, and the
 * ingestion map that says how each one travels.
 *
 * # The founder's catch, which is why this exists
 *
 * > *"someone might upload a reference who has tattoos but only wants the hair
 * > transferred and we just wasted money on generating the tattoo onto a
 * > manequin?"* (fable-937)
 *
 * A reference is a picture of a whole person, and a picture of a whole person
 * contains things nobody asked for. So an upload DECLARES what is being taken
 * from it, and only the declared features are ever extracted. **No extraction
 * without intent; no money moves for a feature nobody asked to take.**
 *
 * # The ingestion map is a founder ruling, not an implementation choice
 *
 * fable-933, in his own words: *"i hair crop will work fine i promise only
 * thing that needs to go on a manequinn is tattoos at this point everything
 * else either runs as descriptive words such as copy her makeup the image is
 * looked at it describes her makeup in words. to carry through , eye color can
 * be cropped etc"*
 *
 *     tattoo      MANNEQUIN PLATE   the plate peels the design off the skin, so
 *                                   the photograph never reaches a render
 *     hair        CROP              the SEGMENTED hair region — a reader's cut,
 *                                   the artifact this product already mints from
 *                                   her own renders. Never a rectangle with a
 *                                   face in it. ⚠ REFINED 2026-08-19 — see
 *                                   below; hair is a QUESTION before it is a
 *                                   form
 *     makeup      WORDS             one describer read of the reference; the
 *                                   words carry, the picture does not
 *     eyeColour   CROP              the product's own proven eye-crop road
 *
 * Each class ingests by the form that carries it best, and the mannequin is
 * reserved for on-skin graphics. The fence is met by the FORM in every row: a
 * person cannot ride along a plate, a segmented cut, or a sentence.
 *
 * # THE RULE BEHIND THE MAP — his, 2026-08-19 (fable-1047)
 *
 * > *"things which would carry fine as words alone such as makeup or hair color
 * > stay as words but specific looks and feature must always ride as cropped
 * > refrences. from the reference photo supplied."*
 *
 * The four rows above were never wrong; they were four instances, and this is
 * the rule they were instances OF. A class arriving later is decided by asking
 * his question — *does this carry fine as words?* — rather than by adding a row
 * somebody guesses at.
 *
 * **And it refines `hair`, which is why that row now carries a warning.** Hair
 * from a reference is a QUESTION before it is a form: *"if i supply a reference
 * image and say copy hair from reference it asks color? style? or full look."*
 * Colour rides as WORDS; style and full look ride as the segmented CROP. So one
 * `form` per class is not the whole truth for hair, and **the shape of the fix
 * is deliberately NOT decided here** — the clarifying question is an
 * unbuilt road (`V3B_INK_AND_MARKS_DESIGN_NOTE.md` §7.11) whose design is
 * reviewed before it is built. `hair.form` stays `"crop"` because that is what
 * the STYLE and FULL-LOOK answers use, and because `hair.open` is `false`, so
 * no door acts on the field today and nothing is promised to anyone.
 *
 * Tattoo is EXTENDED by the same ruling: an upload may now be a photograph that
 * merely CONTAINS a tattoo, with the design cropped out of it before it reaches
 * the plate — his own hard case, *"e.g its a full person with thir face in it"*
 * — and a WORDS-ONLY tattoo ask mints no plate at all.
 *
 * # `open` is what is BUILT, and it is not the same question
 *
 * The map above is ruled. The forms are not all built. `open` says whether this
 * product can act on a declaration today, and today exactly one is — which is
 * why the upload door refuses the rest with a sentence rather than accepting a
 * declaration it would silently ignore. A declaration nobody acts on is the
 * quietest possible way to promise something.
 */
export const REFERENCE_INTENTS = ["tattoo", "hair", "makeup", "eyeColour"] as const;

export type ReferenceIntent = (typeof REFERENCE_INTENTS)[number];

/** How a feature travels from a reference into a render. */
export type IngestionForm = "mannequinPlate" | "crop" | "words";

export interface ReferenceIntentEntry {
  readonly key: ReferenceIntent;
  /** The customer's own words, for a picker and for refusals. */
  readonly noun: string;
  readonly form: IngestionForm;
  /** Whether the form is BUILT — see the header. */
  readonly open: boolean;
}

const ENTRIES: Readonly<Record<ReferenceIntent, ReferenceIntentEntry>> = Object.freeze({
  tattoo: Object.freeze({
    key: "tattoo",
    noun: "her tattoo",
    form: "mannequinPlate",
    /* The upload is built; the plate is not (the mannequin template is a
       founder taste gate). Open here means a design may be ATTACHED — the whole
       road is behind `CASTING_INK_STUDIO_SCOPE`, which is off. */
    open: true,
  }),
  hair: Object.freeze({
    key: "hair",
    noun: "her hair",
    /* The form of the STYLE and FULL-LOOK answers. Colour rides as words, so
       this class is a question before it is a form — see the header. Left as
       one value on purpose: `open` is false, no door reads it, and the shape
       that carries two answers is part of an unbuilt design. */
    form: "crop",
    open: false,
  }),
  makeup: Object.freeze({
    key: "makeup",
    noun: "her makeup",
    form: "words",
    /* BUILT 2026-08-18 (ruled fable-940/941): `castingV2.reference.readMakeup`
       reads the picture once and keeps nothing. It is a different DOOR from the
       ink upload — a words-form reference has no bytes to attach — which is why
       `inkIntentRefusal` now names the road instead of asking her to say what
       she is taking. */
    open: true,
  }),
  eyeColour: Object.freeze({
    key: "eyeColour",
    noun: "her eye colour",
    form: "crop",
    open: false,
  }),
});

export function isReferenceIntent(value: string): value is ReferenceIntent {
  return (REFERENCE_INTENTS as readonly string[]).includes(value);
}

export function referenceIntentEntry(key: ReferenceIntent): ReferenceIntentEntry {
  return ENTRIES[key];
}

/**
 * The ones a door may act on today, DERIVED from the map rather than listed
 * beside it (law 4). A form that ships flips one flag and this follows.
 */
export function openReferenceIntents(): readonly ReferenceIntent[] {
  return REFERENCE_INTENTS.filter((key) => ENTRIES[key].open);
}

export function referenceIntentIsOpen(key: ReferenceIntent): boolean {
  return ENTRIES[key].open;
}

/**
 * Which door serves this feature — DERIVED from the ingestion form, never from a
 * list of intent names kept beside it (law 4).
 *
 * A door is defined by what it does with the picture, and the map already says
 * that per feature: a `mannequinPlate` feature needs the bytes KEPT (there is a
 * plate to mint and to carry), while a `words` feature needs them READ AND
 * DROPPED. Those are different procedures because they are different promises,
 * not because somebody sorted them.
 *
 * The consequence that matters: when hair's crop form ships, it becomes
 * not-this-door automatically, and nobody has to remember to add it anywhere.
 */
export function referenceIntentIngestionForm(key: ReferenceIntent): IngestionForm {
  return ENTRIES[key].form;
}

/**
 * What a customer is told when the feature is open but this door is not the one
 * that serves it.
 *
 * The distinction is worth the sentence: *"say what you're taking"* to somebody
 * who just said it is the product failing to understand a correct answer, which
 * is a worse experience than being turned down.
 *
 * # The sentence derives from the FORM, and it did not always
 *
 * This function used to pick its subject by key and then say one hard-coded
 * thing: *"…isn't attached to a Cast — we read it from the picture and hand you
 * the words."* That was true of the only feature which could reach it, because
 * `inkIntentRefusal` checks OPENNESS first and makeup was the only open feature
 * served elsewhere.
 *
 * **The day hair's `open` flips, that ordering reverses and the sentence goes
 * out about a CROP** — telling a customer her hair is not attached to a Cast
 * (it is; a crop is kept under the candidate's purge path) and that she will be
 * handed words (there are none). A derivation pointed at the key while the
 * content assumed the form: the defect is invisible until the flag that arms it.
 *
 * So the `switch` is exhaustive on `IngestionForm` and returns `never` for an
 * unhandled one — a fifth form added to the map cannot compile until somebody
 * decides what this door says about it.
 */
export function referenceIntentWrongDoor(key: ReferenceIntent): string {
  const noun = ENTRIES[key].noun;
  switch (ENTRIES[key].form) {
    case "words":
      /* Nothing is kept at all, and saying so is the point: she is not being
         asked to hand over a picture of a person for us to hold. */
      return `${capitalize(noun)} isn't attached to a Cast — we read it from the picture and hand you the words. Nothing was charged.`;
    case "crop":
      /* Bytes ARE kept, so the honest difference is not keeping-vs-dropping —
         it is that a cut of her hair is not a design placed on a body, which is
         the only thing this door knows how to file. */
      return `${capitalize(noun)} comes across as a cut from the picture rather than a design placed on her, so it goes through its own step. Nothing was charged.`;
    case "mannequinPlate":
      /* Unreachable from the ink door, which IS the plate door — but a total
         function beats a `!` and an assumption, and the day a SECOND
         plate-form feature exists this is the sentence it needs. */
      return `${capitalize(noun)} is attached to a Cast somewhere else. Nothing was charged.`;
    default: {
      const unhandled: never = ENTRIES[key].form;
      throw new Error(`unhandled ingestion form: ${String(unhandled)}`);
    }
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * What a customer is told about a feature this product cannot take yet.
 *
 * It names the feature and the state, and it does not pretend the reference was
 * wrong — the picture is fine, the road is not built.
 */
export function referenceIntentNotOpen(key: ReferenceIntent): string {
  return `We can't take ${ENTRIES[key].noun} from a reference yet — that one opens later. Nothing was charged.`;
}
