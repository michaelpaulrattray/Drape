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
 *                                   face in it
 *     makeup      WORDS             one describer read of the reference; the
 *                                   words carry, the picture does not
 *     eyeColour   CROP              the product's own proven eye-crop road
 *
 * Each class ingests by the form that carries it best, and the mannequin is
 * reserved for on-skin graphics. The fence is met by the FORM in every row: a
 * person cannot ride along a plate, a segmented cut, or a sentence.
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
    form: "crop",
    open: false,
  }),
  makeup: Object.freeze({
    key: "makeup",
    noun: "her makeup",
    form: "words",
    open: false,
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
 * What a customer is told about a feature this product cannot take yet.
 *
 * It names the feature and the state, and it does not pretend the reference was
 * wrong — the picture is fine, the road is not built.
 */
export function referenceIntentNotOpen(key: ReferenceIntent): string {
  return `We can't take ${ENTRIES[key].noun} from a reference yet — that one opens later. Nothing was charged.`;
}
