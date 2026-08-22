/**
 * ONE REGISTRY PER REFUSAL — copy, charge and report class in one place
 * (fable-486 §f, folded per fable-508 §3).
 *
 * # The shape this replaces
 *
 * A refusal reason lived in a union type, its sentence in a `switch`, its
 * charge behaviour in whichever caller happened to return it, and its
 * countability nowhere at all. Nothing held the three together, so a new
 * refusal could ship with a sentence and no answer to *does this cost her
 * anything* — which is the question a customer asks first and the one a refusal
 * must never leave to inference.
 *
 * It is the same registry shape `CANNOT_SAY_COPY` and `GUARD_REFUSALS` already
 * use, applied to the third family, and for the same reason: **silence becomes
 * a written decision.**
 *
 * # What each entry answers
 *
 * `say` — the customer's sentence. A function of the refusal rather than a
 * constant, because half of these carry the thing she asked about and a
 * refusal that cannot name it is a dead end wearing polite words.
 *
 * `charge` — what it costs her. Every one of these is `free` today and the
 * field exists so that the day one is not, saying so is unavoidable rather than
 * remembered. The sentences say it too; this is what a test can read.
 *
 * `report` — which class the reliability report counts it under. `wall` is the
 * product declining something it does not do; `gate` names what does work and
 * what is coming; `absorbed` is an ask that was already true; `unread` is a
 * sentence that did not come through.
 */
import type { RefineRefusal } from "./refineDelta";
import { inkNeedsDocumentMessage } from "./inkPlacement";
import { capitalize, pronounsForSex, type CastPronouns } from "./castPronouns";

export type RefusalCharge = "free" | "charged";
export type RefusalReportClass = "wall" | "gate" | "absorbed" | "unread";

export type RefusalEntry = {
  /** What the customer reads. */
  readonly say: (refusal: RefineRefusal, of: CastPronouns) => string;
  readonly charge: RefusalCharge;
  readonly report: RefusalReportClass;
};

/** Narrow a refusal to the variant that carries `asked`. */
const askedIn = (refusal: RefineRefusal): string =>
  ("asked" in refusal && typeof refusal.asked === "string" ? refusal.asked : "that");

/**
 * ⚠ THE CAST'S OWN PRONOUNS, AND `they` IS THE FALLBACK RATHER THAN `she`
 * (§5e's instance, met by the founder himself — fable-1244 §1a).
 *
 * Two of these sentences named a person. Both said *she*, hard-coded, and he
 * read one of them about his own male cast: *"She already has jacked build."*
 * `castPronouns.ts` already exists and already says why — the room called every
 * Cast "she" once before, and the segments panel called a male candidate's eyes
 * "hers" for exactly the same reason: two implementations of *which pronoun*.
 * This is the third, and it is now the same one.
 *
 * **The default is `they`, never `she`.** A caller with no identity in hand
 * gets correct English for a person whose pronouns are not known, which is the
 * only default that cannot misgender anybody. A `she` default would leave the
 * exact defect reachable through whichever call site was forgotten — and
 * `refusalMessage` has three.
 *
 * Verb agreement rides on `plural` rather than being remembered per sentence:
 * *"they have"* and *"she has"* are different words, and this file now writes
 * both.
 */
export const UNKNOWN_PRONOUNS: CastPronouns = pronounsForSex(null);

/** "has" · "have" — the agreement `plural` exists to stop three call sites remembering. */
const has = (of: CastPronouns): string => (of.plural ? "have" : "has");

/**
 * WHERE ELSE A TATTOO WOULD ACTUALLY WORK ON THIS CAST, as a clause.
 *
 * ⚠ The list is the REFUSAL'S, never this file's. `servedAndBare` derives it
 * where both facts are in hand — what this account's words road serves, and
 * what this cast's outfit leaves showing — and hands it over on the refusal.
 * A sentence that named the surfaces itself is the defect census finding 4(c)
 * caught in `inkNeedsDocumentMessage`: *"a neck tattoo is the one I can do"*,
 * said to accounts whose upper arm was already open. `gate_ink_uncarried` was
 * carrying the identical frozen promise — *"her neck or an upper arm"* — one
 * file over, and on a roll-neck cast it would name two surfaces under a jumper.
 *
 * **Empty is a real answer and it gets a real sentence.** An outfit that covers
 * everything this road serves leaves nowhere to offer, and offering somewhere
 * anyway is the dead-end-offer class D-180 forbids.
 */
const elsewhereClause = (refusal: RefineRefusal, of: CastPronouns): string => {
  const places = "alternatives" in refusal ? refusal.alternatives : [];
  if (places.length === 0) {
    return `There's nowhere else on ${of.object} I can put one from a description right now`;
  }
  const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");
  const named = places
    .map((place, at) => (at === 0 ? `${of.possessive} ${place}` : `${article(place)} ${place}`))
    .join(" or ");
  return `I can put it on ${named} now`;
};

export const REFINE_REFUSALS = {
  wall_likeness: {
    say: () => "Refining can't make someone look like a specific real person. Nothing was charged.",
    charge: "free",
    report: "wall",
  },
  wall_stage: {
    /*
      TWO SENTENCES UNDER ONE WALL — AND THEY ARE NOW TWO WALLS (census card C1,
      ruled fable-1335 §1). This entry keeps the BACKED sentence; the unbacked
      one moved to `wall_unbacked` below, with its own id, so the record can
      tell them apart the way the customer already could.

      BACKED — the stage lexicon matched a word in her sentence, so we know what
      she asked for and can say so, and can name what DOES work: "wardrobe or
      set" as a whole sentence read as a product that does not do jewellery,
      when jewellery is exactly what Refine is the stated channel for (D-160).

      `backed` survives on the type for refusals written before the field
      existed, and this sentence is what such a refusal has always been given.
    */
    say: (refusal) => `Refining changes the person, not the shoot — ${askedIn(refusal)} is a `
      + "garment, a prop or the set, which comes after Sign. Jewellery, glasses and piercings "
      + "do work here. Nothing was charged.",
    charge: "free",
    report: "wall",
  },
  wall_unbacked: {
    /*
      THE UNBACKED HALF, WITH ITS OWN NAME — and the sentence is unchanged, byte
      for byte, because nothing about what she reads was wrong.

      The model claimed the wall, took its re-look, and the lexicon still finds
      no stage word. Measured, that is where fantastical anatomy lands:
      *"give her antlers"* re-claims 3/3. Telling somebody that antlers are "a
      garment, a prop or the set" is a FALSE sentence, and a false refusal is
      worse than a vague one — so this half claims nothing about what the thing
      IS. That is exactly why it deserved its own id rather than a bit on
      another wall's: a reason that means two things cannot be counted.
    */
    say: (refusal) => `Refining can't do ${askedIn(refusal)} yet — it isn't one of the things `
      + "this can name. Faces, hair, skin, build and anything worn do work here. "
      + "Nothing was charged.",
    charge: "free",
    report: "wall",
  },
  wall_content: {
    say: () => "That one can't be rendered. Nothing was charged.",
    charge: "free",
    report: "wall",
  },
  wall_unfileable: {
    /* The honest version of wall (d): we will not render what we cannot write
       down, and the reason it could not be written down is that the words were
       not the user's own. */
    say: () => "That came back with more detail than you asked for, so it wasn't recorded — "
      + "and nothing is rendered that isn't recorded. Try saying it in your own words. "
      + "Nothing was charged.",
    charge: "free",
    report: "wall",
  },
  gate_ink_document: {
    /* The places the road serves THIS account, off the refusal's own bit —
       census 4(c): this sentence said "a neck tattoo" to accounts whose upper
       arm was open too. */
    say: (refusal) => inkNeedsDocumentMessage(
      "wordsRoadOpen" in refusal && refusal.wordsRoadOpen === true,
    ),
    charge: "free",
    report: "gate",
  },
  /*
    SHE NAMED A REAL PLACE AND THE PRODUCT CANNOT KEEP IT THERE — the words-road
    court's own sentence (drafted opus-960 §5, accepted verbatim fable-1301 §2).

    The court bought this: a chest ask RENDERS a perfectly good frame — the
    engine obeys the clothing clause and puts the ink on the sliver of skin above
    the collar — and the mint then finds nothing, because the reader is being
    asked about a chest under a t-shirt (D-226). The customer would pay, receive
    a tattoo, and lose it on the next edit.

    So the sentence does not apologise about documents, which is what she used to
    get. It names the real obstacle, the two places that work RIGHT NOW, and the
    one change that opens this one — and every answer to it acts, which is D-180
    satisfied rather than argued. The wardrobe road is real today.
  */
  gate_ink_uncarried: {
    say: (refusal, of) => {
      const place = "place" in refusal ? refusal.place : "there";
      return `${capitalize(of.possessive)} top covers ${of.possessive} ${place}, so a tattoo `
        + `there wouldn't survive the next edit. ${elsewhereClause(refusal, of)} — or change `
        + `what ${of.subject} ${of.plural ? "are" : "is"} wearing first. Nothing was charged.`;
    },
    charge: "free",
    report: "gate",
  },
  /*
    ITS TWIN, AND THE SPLIT IS THE WHOLE POINT (item 7a, fable-1368 ruling 1).

    While the product had ONE outfit these were one sentence about one surface:
    the upper chest, under the house crew tee, which the mint cannot segment
    because you cannot read a thing that is hidden. The Two Paths ruling pulls
    them apart — a cast born shirtless still cannot have a chest piece KEPT
    (the court on whether the mint fires there has not reported), and telling
    her *"your top covers your chest"* would be plainly false about the picture
    in front of her.

    So this one claims nothing about her clothes. It says the true thing: the
    render would land and the record would not, so it is not worth her money.
  */
  gate_ink_unkeepable: {
    say: (refusal, of) => {
      const place = "place" in refusal ? refusal.place : "there";
      return `I can't keep a tattoo on ${of.possessive} ${place} yet — it would render, and `
        + "then be lost on the next edit, so it isn't worth charging you for. "
        + `${elsewhereClause(refusal, of)}. Nothing was charged.`;
    },
    charge: "free",
    report: "gate",
  },
  /*
    AND THE THIRD, WHICH IS ABOUT US RATHER THAN ABOUT HER (fable-1368 ruling 1).

    Fails closed exactly like a covering and must never be REPORTED as one. The
    sentence therefore names OUR gap and not her outfit: we have not read what
    this outfit leaves showing, and we will not put a tattoo somewhere we cannot
    see. A fail-closed gate that lies about why it closed is how somebody learns
    to distrust every refusal this product writes.
  */
  gate_ink_coverage_unread: {
    say: (refusal, of) => {
      const place = "place" in refusal ? refusal.place : "there";
      return `I can't tell yet whether what ${of.subject} ${of.plural ? "are" : "is"} wearing `
        + `leaves ${of.possessive} ${place} showing, and I won't put a tattoo somewhere I `
        + `can't see. ${elsewhereClause(refusal, of)}. Nothing was charged.`;
    },
    charge: "free",
    report: "gate",
  },
  absorbed: {
    /*
      HER ONTOLOGY, NOT OURS (law 8). What she can see is that she asked for
      something the face already has; the model losing her sentence into a
      restatement is our business and not a sentence anybody wants to read.
    */
    say: (refusal, of) => `${capitalize(of.subject)} already ${has(of)} ${askedIn(refusal)} `
      + "— this would have changed nothing, so nothing was charged. Ask for more of it, "
      + "or say it another way.",
    charge: "free",
    report: "absorbed",
  },
  absorbed_departure: {
    /* The same fact about the other direction, in her words rather than ours:
       the thing is already off her, so there is nothing to take off. */
    say: (refusal, of) => `${askedIn(refusal)} — that's already off ${of.object}, so this `
      + "would have changed nothing and nothing was charged. Say what you'd like instead "
      + "and I'll put it on.",
    charge: "free",
    report: "absorbed",
  },
  empty: {
    say: () => "Say what you'd like changed — anything about the person themselves.",
    charge: "free",
    report: "unread",
  },
  unreadable: {
    say: () => "That one didn't come through clearly. Try naming what you want changed about "
      + "them. Nothing was charged.",
    charge: "free",
    report: "unread",
  },
} as const satisfies Record<RefineRefusal["reason"], RefusalEntry>;

/** Every refusal reason the product can return — derived, never a second list. */
export const REFUSAL_REASONS = Object.keys(REFINE_REFUSALS) as Array<RefineRefusal["reason"]>;
