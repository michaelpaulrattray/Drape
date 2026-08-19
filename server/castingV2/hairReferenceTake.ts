/**
 * *"IT ASKS COLOUR? STYLE? OR FULL LOOK"* — what a customer is taking when the
 * thing she points at is HAIR (founder ruling, 2026-08-19, relayed fable-1047
 * §3 and amended fable-1048; sequenced fable-1071 §5).
 *
 * His words, verbatim:
 *
 * > *"if i supply a reference image and say copy hair from reference it asks
 * > color? style? or full look."*
 *
 * and the amendment that scopes the answer, the same day:
 *
 * > *"if someone wanted a hairstyle but a different hair color its important
 * > that the words that ride along with the reference state it the style only
 * > not the color etc"*
 *
 * # HAIR IS NOT ONE THING, AND THIS PRODUCT HAS KNOWN THAT SINCE D-142
 *
 * The three answers do not need a vocabulary of their own. Hair is already five
 * subject cards — cut, colour, texture, finish, and how it is worn — split
 * apart the day the founder's first stack lost a mullet to a colour edit. So a
 * take is a **CLAIM OVER FACETS**, and the three answers fall out of the split
 * that already exists:
 *
 *     colour     { hairShade }                  WORDS   — it carries fine as words
 *     style      the COMPLEMENT of colour       CROP    — a specific look
 *     fullLook   every hair facet               CROP    — a specific look
 *
 * # ONLY ONE OF THE THREE DECLARES A LIST, AND THAT IS THE POINT
 *
 * `colour` names its facets. `style` is that list read BACKWARDS over the hair
 * facets, and `fullLook` is the total. So *"the style only, not the colour"* is
 * not a second list maintained beside the first — **it is the same list, and
 * the two therefore cannot disagree about what the colour is.** A disclaimer
 * kept as its own list is the mirror law 4 forbids, and the drift would be the
 * exact failure his amendment exists to prevent: a customer who asked for a cut
 * and got somebody else's colour with it.
 *
 * The complement is also what makes a FUTURE facet safe. A hair card added
 * later joins `style` by default, which is right for a cut or a texture and
 * WRONG for anything colour-shaped — so the heading fence below is mechanical:
 * a hair card whose heading names COLOUR and is not in the colour take reddens
 * the suite (`hairReferenceTake.test.ts`). A `hairRoots` card headed "HAIR ROOT
 * COLOUR" would otherwise land in `style` silently and leak the one property
 * the take promises to leave alone.
 *
 * # THE PHRASES ARE CUSTOMER PROSE, AND THEY ARE TOTAL OVER THE FACETS
 *
 * The cards' own `heading` is a PROMPT heading — D-87's footprint check looks
 * for `SUBJECT: value` in the composed prompt, so those strings answer to an
 * instrument rather than to a person. "HAIR WORN" is not a phrase anybody says.
 *
 * So the ordinary words live here, keyed by facet and TOTAL over the hair
 * facets: a hair card added without a phrase throws rather than describing
 * itself by its own key. That is `referenceClassGate`'s idiom — the gap is
 * visible rather than filled by whoever notices it, because a phrase somebody
 * guessed at reads as chosen to the next person.
 */
import { FREE_SUBJECT_KEYS, SUBJECT_CARDS, type FreeSubject } from "./subjectCards";

/**
 * The hair facets, DERIVED from the cards rather than listed beside them.
 *
 * The prefix is the derivation, and it is exactly right on today's cards:
 * `facialHair` is a beard and is correctly outside it, because a beard is not
 * the hair on her head and no reference take has ever meant one. Both halves of
 * that are pinned by the suite, so the day the naming convention stops holding
 * is the day the suite says so rather than the day a beard rides in on a
 * hairstyle.
 */
export const HAIR_FACETS: readonly FreeSubject[] = FREE_SUBJECT_KEYS.filter(
  (subject) => subject.startsWith("hair"),
);

/**
 * THE COLOUR FACETS — the one declared list, and everything else is read off it.
 *
 * Kept as an array rather than a single key because "the colour" is a property
 * a product can grow more slots for (roots, highlights, a gloss) long before it
 * grows a new word for it, and the complement has to keep working when it does.
 */
export const HAIR_COLOUR_FACETS: readonly FreeSubject[] = ["hairShade"];

export const HAIR_TAKES = ["colour", "style", "fullLook"] as const;

export type HairTake = (typeof HAIR_TAKES)[number];

/**
 * ONE TAKE — and `form` is his ruling rather than a derivation.
 *
 * The general law says properties that carry fine as words stay words and
 * specific looks ride as cropped references (§7.11 ruling 4). Which side of it
 * each answer falls on is a judgement he made in the same sentence, so it is
 * recorded, not computed: *colour* is his own named example of the words half,
 * and *style* and *full look* are the specific-look half.
 */
export type HairTakeEntry = {
  readonly key: HairTake;
  /** The chip, in her words. Never a code, never a facet name. */
  readonly label: string;
  /** What this take CLAIMS. `null` means every hair facet. */
  readonly claims: readonly FreeSubject[] | null;
  readonly form: "words" | "crop";
};

const TAKES: Readonly<Record<HairTake, HairTakeEntry>> = Object.freeze({
  colour: Object.freeze({
    key: "colour",
    label: "the colour",
    claims: HAIR_COLOUR_FACETS,
    form: "words",
  }),
  style: Object.freeze({
    key: "style",
    label: "the style",
    /* THE COMPLEMENT, computed at the one place it is defined. See the header:
       a hand-written list here is the drift his amendment exists to stop. */
    claims: HAIR_FACETS.filter((facet) => !HAIR_COLOUR_FACETS.includes(facet)),
    form: "crop",
  }),
  fullLook: Object.freeze({
    key: "fullLook",
    label: "the whole look",
    /* Null rather than a copy of `HAIR_FACETS`: "everything" is a different
       fact from "these five", and a copy would silently stop meaning everything
       the day a sixth facet lands. */
    claims: null,
    form: "crop",
  }),
});

export function hairTakeEntry(take: HairTake): HairTakeEntry {
  return TAKES[take];
}

/** The facets this take claims — the total spelled out. */
export function hairTakeClaims(take: HairTake): readonly FreeSubject[] {
  return TAKES[take].claims ?? HAIR_FACETS;
}

/**
 * The facets this take explicitly does NOT claim.
 *
 * The complement of the claim over the hair facets, which is the whole
 * mechanism of ruling 5: a crop cannot scope itself — a picture of hair is a
 * picture of hair in some colour whether anybody asked for the colour or not —
 * so the WORDS are the scoping instrument, and they are derived from the same
 * list the claim is.
 */
export function hairTakeDisclaims(take: HairTake): readonly FreeSubject[] {
  const claimed = hairTakeClaims(take);
  return HAIR_FACETS.filter((facet) => !claimed.includes(facet));
}

/**
 * Ordinary words for one facet — total over the hair facets, so a card added
 * without one is refused rather than described by its own key.
 *
 * `Record<FreeSubject, string>` would be total over EVERY subject and would
 * make this file carry a phrase for teeth. Totality is asserted by the suite
 * against `HAIR_FACETS` instead, which is the set that actually has to be
 * covered.
 */
const FACET_PHRASE: Readonly<Partial<Record<FreeSubject, string>>> = Object.freeze({
  hairCut: "the cut",
  hairShade: "the colour",
  hairPattern: "the texture",
  hairFinish: "the finish",
  hairWorn: "how it is worn",
});

export function hairFacetPhrase(facet: FreeSubject): string {
  const phrase = FACET_PHRASE[facet];
  if (!phrase) {
    /* A programming error, not a customer's — and it is raised rather than
       defaulted for `referenceClassGate`'s reason: a facet silently described
       by its own key would ride into a sentence a person reads. */
    throw new Error(`no customer phrase is declared for the hair facet "${facet}"`);
  }
  return phrase;
}

/** "the cut, the texture and how it is worn" — an ordinary English list. */
export function joinPhrases(phrases: readonly string[]): string {
  if (phrases.length === 0) return "";
  if (phrases.length === 1) return phrases[0];
  return `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;
}

/**
 * THE SENTENCE THAT RIDES WITH THE TAKE — ruling 5, composed rather than typed.
 *
 * *"A crop never travels alone; a sentence travels with it. That sentence names
 * the property being taken AND ONLY THAT PROPERTY."*
 *
 * The disclaimer half appears only when there is something to disclaim, which
 * is what keeps `fullLook` from ending in an empty clause — and it NAMES the
 * facets rather than saying "nothing else", because *"not the colour"* is a
 * fact a reader and a person can both act on and *"only what I said"* is not.
 */
export function hairTakeSentence(take: HairTake): string {
  const claimed = joinPhrases(hairTakeClaims(take).map(hairFacetPhrase));
  const disclaimed = hairTakeDisclaims(take);
  const claim = `Take her hair from the reference: ${claimed}.`;
  if (disclaimed.length === 0) return claim;
  /*
    HERS, NOT THE REFERENCE'S — the cast keeps what this take did not ask for,
    which is the difference between scoping a property and replacing a person.

    The clause is worded this way round because the other way round is not
    English: the phrases carry their own article ("the cut"), so *"keep her own
    the cut"* is what a naive join produces. Caught by reading the composed
    output rather than by reading the code, which is the only way that class of
    defect is ever caught.
  */
  return `${claim} Do not take ${
    joinPhrases(disclaimed.map(hairFacetPhrase))
  } from the reference — keep hers.`;
}

/**
 * Whether a facet may be spoken for by this take.
 *
 * The read side of the same list, for the gate that keeps a reference read from
 * putting a colour it saw into a style-scoped ask. **Positive admission**: a
 * facet reaches the sentence only by being claimed.
 */
export function hairTakeAdmits(take: HairTake, facet: FreeSubject): boolean {
  return hairTakeClaims(take).includes(facet);
}

/* ------------------------------------------------------------------ *
 * READING THE ASK — is this about hair, and did she already say which *
 * ------------------------------------------------------------------ */

/**
 * The words that make an ask a HAIR ask — the cards' own nouns, plus the word
 * itself.
 *
 * Derived rather than listed for law 4's reason and for a second one this
 * product has already paid for: the near-miss gate's feature half was
 * hand-written, the hand-list omitted `nose`, and a correctly spelled word came
 * back as a typo question. A list that shadows a vocabulary drifts from it.
 *
 * So `ponytail`, `updo` and `braid` are in here because `hairWorn` names them,
 * and *"copy this updo from the reference"* is a hair ask whether or not
 * anybody remembered to write `updo` down.
 */
const HAIR_NOUNS: readonly string[] = [
  "hair",
  "hairstyle",
  ...HAIR_FACETS.flatMap((facet) => SUBJECT_CARDS[facet].nouns),
];

/** Every word in a sentence, lower-cased, punctuation gone. */
function words(instruction: string): string[] {
  return instruction.toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

/** Whether a phrase of one or more words appears in the sentence, in order. */
function says(said: readonly string[], phrase: string): boolean {
  const parts = phrase.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (parts.length === 0) return false;
  for (let start = 0; start + parts.length <= said.length; start += 1) {
    if (parts.every((part, offset) => said[start + offset] === part)) return true;
  }
  return false;
}

/**
 * Is this ask about her hair at all?
 *
 * **It errs toward YES on purpose, and the asymmetry is the whole reason there
 * is a rule about it.** Firing when she meant something else costs a free
 * question she can ignore by typing over it. NOT firing costs her a paid render
 * that quietly ignored the picture she attached — which is the reference lane
 * failing silently, and silence is the failure this product keeps buying.
 */
export function asksAboutHair(instruction: string): boolean {
  const said = words(instruction);
  return HAIR_NOUNS.some((noun) => says(said, noun));
}

/**
 * The take she already named, or `null` — and `null` is what raises the
 * question.
 *
 * **Conservative by design, and in the opposite direction from `asksAboutHair`
 * above.** A take read out of a sentence that did not clearly name one is a
 * GUESS, and his ruling is that the product asks rather than guesses. So a word
 * has to be unmistakable to count, and two takes named at once counts as
 * neither — *"the colour and the cut"* is a person describing a whole look in
 * her own words, and the right answer to it is the question.
 *
 * The colour words are the `hairShade` card's own nouns; only the two that name
 * the PROPERTY rather than a value are added here, because a value word like
 * "copper" belongs to the ask itself and not to this decision.
 */
export function hairTakeNamedIn(instruction: string): HairTake | null {
  const said = words(instruction);
  const named = new Set<HairTake>();
  const colourWords = [...SUBJECT_CARDS.hairShade.nouns, "colour", "color", "shade", "tone"];
  if (colourWords.some((word) => says(said, word))) named.add("colour");
  if (["style", "hairstyle", "cut", "haircut"].some((word) => says(said, word))) named.add("style");
  if (["whole look", "full look", "everything", "all of it"].some((word) => says(said, word))) {
    named.add("fullLook");
  }
  return named.size === 1 ? Array.from(named)[0] : null;
}

/**
 * The heading fence, exported so the suite drives it rather than re-deriving
 * the rule it is testing.
 *
 * A hair card whose PROMPT HEADING names colour and which the colour take does
 * not claim is a leak waiting for its first customer: the complement would put
 * it in `style`, and a style ask would carry somebody else's colour under a
 * sentence promising it would not.
 *
 * **The cards are a PARAMETER so the fence can be driven** (law 2). Asserting
 * that this returns nothing today proves only that today is clean — it cannot
 * tell a working fence from a deleted one. The positive control hands it a
 * `hairRoots` card headed "HAIR ROOT COLOUR" and requires this function, not a
 * re-implementation of its rule in a test, to name it.
 */
export function hairColourFacetsMissedByTheColourTake(
  cards: Readonly<Partial<Record<string, { readonly heading: string }>>> = SUBJECT_CARDS,
  facets: readonly FreeSubject[] = HAIR_FACETS,
): readonly FreeSubject[] {
  return facets.filter((facet) => {
    const heading = cards[facet]?.heading;
    if (heading === undefined) {
      /* A hair facet with no card is not a clean answer, and returning "no leak"
         for one would be an absence read as a green. */
      throw new Error(`no subject card for the hair facet "${facet}"`);
    }
    return heading.includes("COLOUR") && !HAIR_COLOUR_FACETS.includes(facet);
  });
}
