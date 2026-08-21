/**
 * WHAT THE PRODUCT SAYS WHEN THE ROAD CANNOT STATE AN ASK (fable-471 §1).
 *
 * # The founder's specimen
 *
 * He tapped the panel's EARS row and asked for a cauliflower ear. The reading
 * filed it as a MARK, the scope said ears, and the repaint refused: `marks has
 * no library slot` under `ear@left`. What he read was:
 *
 *   > "That refinement didn't come through. Your credits have been returned."
 *
 * — which is the sentence a MALFUNCTION gets, on a road that knew exactly why
 * it refused. `cannot_say` landed as a class (fable-355) and its honest
 * sentence existed for exactly one facet: makeup, whose copy the founder ruled
 * (fable-354). Every other reason fell to the generic line.
 *
 * # One registry, not seven sentences scattered through a settlement
 *
 * This is fable-486 (f) in its user-facing half: one entry per refusal reason,
 * carrying the SENTENCE, whether the customer was charged, and the class the
 * reliability report counts it under. Three facts about one refusal, in one
 * place, so a new reason cannot ship with a class and no copy — the totality
 * test in `cannotSayCopy.test.ts` fails if it tries.
 *
 * # The voice
 *
 * The founder's, from the makeup ruling: name the gap, never imply a
 * malfunction, say what she can do next where there is something, and say what
 * happened to the money. **"It's coming" appears in exactly TWO sentences and
 * only while each thing is genuinely queued** — a promise inside a refusal is
 * the easiest line in a product to leave rotting, so each one is named here
 * with what it is waiting on:
 *
 *   `notASlot` for makeup   — makeup has no library slot; the founder ruled
 *                             this sentence himself (fable-354).
 *   `inkBeyondToday`        — the OPEN LANE (`OPEN_LANE_DESIGN_NOTE.md` §12),
 *                             designed, with the founder's own first live
 *                             tattoo ask as its defining test case
 *                             (fable-1233 §1).
 *
 * *(It said ONE until 2026-08-21. The count is written out rather than left as
 * an adjective precisely so the next addition has to come here and say what it
 * is waiting on — the promise this paragraph is about is the one that rots
 * silently.)*
 */
import type { RepaintAsksRefusal } from "./repaintAsks";

/**
 * Every reason this table must carry a sentence for.
 *
 * It is `repaintAsks`' own refusal union PLUS the doors that refuse a stateable
 * ask BEFORE the claim, which that module never sees and therefore cannot
 * name. `inkBeyondToday` is the first of those and it is written out rather
 * than folded in: adding a member to `RepaintAsksRefusal` for a refusal that
 * module can never raise would be a false sentence about what it does, and the
 * whole reason this registry exists is that a reason must not be able to ship
 * with the wrong label. The totality test still holds — one entry per member of
 * THIS type, whichever side of the claim its door sits on.
 *
 * `noInkToChange`, `inkOneChangeAtATime`, `inkRemovalNotYet` and
 * `whichInkToChange` are the transform road's four, and they belong here for
 * the same reason: all are raised by the prior question at the pre-claim ink
 * door (`inkPriorAsk`), which `repaintAsks` never sees.
 */
export type CannotSayReason =
  | RepaintAsksRefusal["reason"]
  | "inkBeyondToday"
  | "noInkToChange"
  | "inkOneChangeAtATime"
  | "inkRemovalNotYet"
  | "whichInkToChange";

/** What the settlement knows when it writes the sentence. */
export type CannotSayContext = {
  /**
   * The ask's own words, where the door carries them — "lip gloss", "a red
   * lip". Null everywhere else, and a sentence that needs them says the class
   * instead of inventing a noun she never used.
   */
  words: string | null;
  /** The facet the refusal was raised about, for the sentences that name it. */
  facet: string | null;
  /** How the product speaks about the part she pointed at — "her left ear". */
  scopeNoun: string | null;
  /**
   * TRUE when her balance really is where she left it.
   *
   * Some of these doors refuse before the claim and some after a refund, and
   * the sentence must not promise the money back until the refund is recorded —
   * that is the caller's fact, not this table's.
   */
  moneySafe: boolean;
};

const MONEY = (safe: boolean): string => (safe
  ? "Nothing was charged."
  : "Your credits have been returned.");

/** A leading noun, capitalised, or null when there is nothing to quote. */
function lead(context: CannotSayContext): string | null {
  const noun = context.words?.trim();
  if (!noun) return null;
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)}`;
}

export type CannotSayEntry = {
  /** The sentence the customer reads. */
  say: (context: CannotSayContext) => string;
  /**
   * Where this door sits relative to the claim, as the code stands TODAY.
   *
   * Recorded so the table can be read as a map of what a refusal costs, and
   * checked by the suite against the door that raises it: a `free` reason that
   * starts refusing after a charge is a regression nobody would otherwise see.
   */
  charge: "free" | "refunded";
};

export const CANNOT_SAY_COPY: Readonly<Record<CannotSayReason, CannotSayEntry>> = {
  /*
    THE FOUNDER'S OWN SENTENCE, unchanged (fable-354). Makeup is the one facet
    whose delta value IS the phrase she asked about, and the one with a promise
    in it — see the honesty condition in the header.
  */
  notASlot: {
    charge: "free",
    say: (context) => {
      const noun = lead(context);
      if (context.facet === "makeup") {
        return noun
          ? `${noun} is makeup, and makeup isn't something I can place yet — it's coming. `
            + MONEY(context.moneySafe)
          : `That's makeup, and makeup isn't something I can place yet — it's coming. `
            + MONEY(context.moneySafe);
      }
      /*
        THE SCOPED CASE, which is what the founder actually hit: the ask was
        read as a mark and he had pointed at her ear. Naming the part he
        pointed at is the whole difference between "the product is broken" and
        "I read that as something else".
      */
      if (context.scopeNoun) {
        return `I read that as a change to something other than ${context.scopeNoun}, so I `
          + `couldn't place it there. Try saying it about ${context.scopeNoun} on its own. `
          + MONEY(context.moneySafe);
      }
      return noun
        ? `${noun} isn't something I can place yet. ${MONEY(context.moneySafe)}`
        : `That isn't something I can place yet. ${MONEY(context.moneySafe)}`;
    },
  },
  /*
    THE PAIR'S ONE SIDE — the founder's ruled voice again (fable-354's shape):
    say the gap and hand back the thing she CAN do.
  */
  /*
    ONE SIDE NAMED, NOTHING POINTED AT (fable-604 §3a).

    Same voice as the pair's-one-side refusal above: say the gap and hand back
    the thing she can do. The alternative it offers is real for everyone who can
    reach this door — the repaint road sits inside the library scope, which is
    what draws the boxes she taps.
  */
  sideNamedWithoutScope: {
    /* Raised inside the recipe assembly, like the pair's-one-side refusal
       beside it — after the claim, so the money comes BACK rather than never
       leaving. The sentence says which of those two happened from the caller's
       own fact, never from this label. */
    charge: "refunded",
    say: (context) => {
      const said = lead(context);
      return (said ? `"${said}" names one side` : "That names one side")
        + " of a pair, and pointing at it is how I can work on just that one — tap it on her picture "
        + "and say it there. Said in a sentence I would have to change both, which isn't what you asked "
        + `for. ${MONEY(context.moneySafe)}`;
    },
  },
  perSideRemoval: {
    charge: "refunded",
    say: (context) => "Taking just one of a pair off isn't something I can do yet — ask for "
      + `both and they'll come off together. ${MONEY(context.moneySafe)}`,
  },
  /*
    A REMOVAL THE ROAD CANNOT EXPRESS. The repaint regenerates a feature from
    words, and a removal has no words to regenerate FROM — the road says the
    site is vacant instead, and where it cannot, this is the honest sentence.
  */
  removal: {
    charge: "refunded",
    say: (context) => "Taking that off isn't something I can do on this face yet. "
      + MONEY(context.moneySafe),
  },
  departure: {
    charge: "refunded",
    say: (context) => "I can't say that this has gone without describing what replaced it — "
      + `tell me what should be there instead. ${MONEY(context.moneySafe)}`,
  },
  /*
    A WORN THING THE PLACEMENT TABLE CANNOT NAME. The one refusal here that is
    genuinely owed work rather than a boundary — see `mintedSlots`' own
    `unnamedObject`.
  */
  unnamedObject: {
    charge: "refunded",
    say: (context) => {
      const noun = lead(context);
      return noun
        ? `${noun} isn't something I know where to put on her yet. ${MONEY(context.moneySafe)}`
        : `That isn't something I know where to put on her yet. ${MONEY(context.moneySafe)}`;
    },
  },
  /*
    AN INK ASK WITH NOWHERE ON HER NAMED.

    Not `unnamedObject`'s sentence, and the difference is what she can DO about
    it. That one says *I don't know where to put that on her* — a fact about our
    table, which she cannot act on. This one is a fact about her sentence: she
    asked for a tattoo and did not say where, and the answer that hands her the
    next move is to ask where.

    It reads as a QUESTION rather than a wall, because it is one — the same
    shape the take's own unreadable-placement answer takes, so a customer who
    reaches this door and one who reaches that one hear the product ask the same
    thing rather than two different apologies.

    `refunded` matches the door that raises it: `repaintAsksFor` runs inside the
    claim. The pre-claim ink branch asks where BEFORE any money moves, which is
    why this door should never be the one she meets — and why the sentence is
    written anyway rather than left to the fall-through nobody would read.
  */
  unplacedInk: {
    charge: "refunded",
    say: (context) => "I can put a tattoo on her, but I need to know where it goes — her neck, "
      + `an upper arm, her upper chest. Say where and I'll do it. ${MONEY(context.moneySafe)}`,
  },
  /*
    AN INK ASK WHOSE SHAPE THIS ROAD CANNOT STATE YET — told, never asked
    (ordered fable-1233 §2, from his own first live tattoo ask).

    The sibling above asks WHERE, and that is the right question for somebody
    who simply did not say. It is a nonsense question for *"add tattos to him
    inspired by the attached design"* with a whole flash sheet attached: he did
    not omit a placement, he asked for something whose shape is *wherever it
    fits* — plural pieces, a style rather than a copy. D-180 forbids a question
    whose premise the ask rejects, so this door tells him what works instead.

    The order in the sentence is deliberate: what he CAN have first, so the
    reply is a road rather than a wall, and the limit second.

    `asksInkBeyondToday` decides which of the two he reads, from HIS OWN WORDS —
    see that module for why plurality is not part of the test.
  */
  inkBeyondToday: {
    charge: "free",
    say: (context) => "Right now I can copy one design exactly, onto her neck, an upper arm "
      + "or her upper chest — point me at one design and one of those places and I'll do it. "
      + "Taking a whole sheet and working from the feel of it, across her, is being built and "
      + `isn't ready yet — it's coming. ${MONEY(context.moneySafe)}`,
  },
  /*
    SHE ASKED ABOUT A TATTOO SHE DOES NOT HAVE — and ONE sentence serves both
    ways of asking (designed opus-940 §3, ratified fable-1274 §3).

    *"Make it bigger"* and *"take his tattoos off"* are different asks with the
    same answer on a bare cast: there is nothing there. Before this, the first
    rendered a fresh design invented from her prose and charged for it, and the
    second was answered with *"I can put a tattoo on her, but I need to know
    where it goes"* — an offer to ADD, in reply to an ask to REMOVE. One
    sentence rather than two because the customer's situation is one situation,
    and two apologies for one gap is how a person comes to think they are using
    two products.

    The order is the house order: what she CAN have first, so the reply is a
    road rather than a wall, and the fact second. It hands her the same three
    places `unplacedInk` does, because that IS the next move from here and the
    two doors must not describe different products.

    `free`, and it is arithmetic: this door is above the claim, so there is
    nothing to give back.
  */
  noInkToChange: {
    charge: "free",
    /*
      IT OFFERS ONLY WHAT EXISTS. An earlier draft ended *"…and then make it
      bigger, move it, or take it off again"* — and taking one off is not built,
      so that sentence was a promise inside a refusal, which the header of this
      file names as the easiest line in a product to leave rotting.
    */
    say: (context) => "I can put a tattoo on her — her neck, an upper arm, her upper chest. "
      + "She hasn't got one yet, though, so there's nothing there to change or take off. "
      + MONEY(context.moneySafe),
  },
  /*
    SHE ASKED FOR A TATTOO TO COME OFF, AND IT IS REALLY THERE (ruled
    fable-1287 §3, condition (i)).

    The three sentences this replaces are all worse and two of them are false.
    Driven at the service (opus-948 §2), *"take his tattoos off"* landed on
    *"I can't find any tattoos on this face"* — said about a chain that names a
    delivered chest piece, which is the record-versus-pixels absurdity — or on
    *"That isn't something I know where to put on her yet"*, or on the placement
    question, an offer to ADD in reply to an ask to REMOVE.

    **So it starts by agreeing with his eyes.** `scopeNoun` is composed by the
    caller from the slot the chain resolved — *"his upper chest tattoo"* — and
    the sentence names it before it says no, because a *"not yet"* that begins
    by doubting what he is looking at is the one thing worse than a *"not yet"*.

    And the way out it names is REAL rather than a promise: backing up to an
    earlier version genuinely removes it today, and every delivered tattoo has a
    version before it by construction — `inkDelivered` is only ever written by a
    refine step.

    It persists NOTHING (condition (ii)): free, pre-claim, no absent facet and
    no delta a later carry could read. A half-filed ink removal would put *"no
    tattoos"* on the wire beside *"put the chest piece back exactly as it is"*,
    which is D-244's contradiction at full price.
  */
  /*
    SHE HAS TWO AND SAID "IT" — asked, never guessed (opus-940 §2, ratified
    fable-1274 §2).

    `slots[0]` is forbidden on this road and the price of the alternative is on
    the record: an ask that omitted a key member spanned two rows and
    `matches[0]` rode her LEFT ARM — 300 credits refunded twice for a design on
    the wrong anatomical side (DECISION_LOG R7-7G). A transform that silently
    picks one of two tattoos is that defect with a paid render attached.

    It is a QUESTION IN WORDS rather than a chip question, and that is the
    sibling's shape rather than a shortcut: `unplacedInk` directly above asks
    *"say where and I'll do it"* with no chips at all, and a chip question here
    would have to carry the slot list through the answer handle — machinery
    whose only purpose would be to re-say a sentence she can answer by typing
    three words. Her reply names a placement, and the narrowing that reads it is
    her own word matched against the surface's own noun.

    Every answer ACTS (D-180): each names a tattoo that exists and can be
    changed.
  */
  whichInkToChange: {
    charge: "free",
    say: (context) => `${context.scopeNoun ? `You've got more than one — ${context.scopeNoun}` : "You've got more than one tattoo"}`
      + `. Say which one and I'll do it. ${MONEY(context.moneySafe)}`,
  },
  inkRemovalNotYet: {
    charge: "free",
    say: (context) => `${context.scopeNoun ? `That's ${context.scopeNoun}, and taking` : "Taking"} `
      + "a tattoo off again isn't something I can do yet. For now, backing up to a version from "
      + `before it was added is the way to get rid of it. ${MONEY(context.moneySafe)}`,
  },
  /*
    TWO CHANGES IN ONE SENTENCE, and the road can state one (opus-948 §4).

    *"Make it bigger and darker"* is a reasonable thing to type and it is not
    one instruction: every transform clause ends by saying that everything else
    about the tattoo stays exactly as the picture shows it, so two of them
    contradict each other on the wire — the same design, the same ink, and
    darker ink, all in one prompt. Serving the first half silently would be a
    paid render answering half an ask, which is the thing D-181's law exists to
    stop.

    So it is said, free, before the claim, and it names the axes rather than
    apologising vaguely: every answer to it ACTS (D-180), because each one is a
    change this road can make today.
  */
  inkOneChangeAtATime: {
    charge: "free",
    say: (context) => "I can change one thing about a tattoo at a time — bigger or smaller, "
      + "higher or lower, darker or lighter. Say which one you'd like first and I'll do it, "
      + `then we can do the other. ${MONEY(context.moneySafe)}`,
  },
  uncatalogued: {
    charge: "refunded",
    say: (context) => "That's a part of her I can't work on yet. " + MONEY(context.moneySafe),
  },
  /*
    NOTHING TO SAY IT WITH. The read-back came back empty, so the road has no
    phrase to regenerate the feature from — an honest "ask me again" rather
    than a diagnosis she cannot act on.
  */
  noWords: {
    charge: "refunded",
    say: (context) => "I couldn't put that into words well enough to paint it. Try saying it "
      + `a different way. ${MONEY(context.moneySafe)}`,
  },
  nothingAsked: {
    charge: "free",
    say: (context) => "That didn't name anything to change. Say what you'd like different "
      + `about them. ${MONEY(context.moneySafe)}`,
  },
};

/** The sentence for a refusal, by its reason — never a generic line. */
export function cannotSaySentence(
  reason: CannotSayReason,
  context: CannotSayContext,
): string {
  return CANNOT_SAY_COPY[reason].say(context);
}

/**
 * THE LIKENESS CONFESSION — what a delivered take says when a comparison to a
 * real person was set aside (D-181), and it may only name what it took from
 * the parse (fable-490 §1b).
 *
 * # The sentence that lied
 *
 * The founder's vitiligo take carried: *"Made the eyes as you described.
 * Refining can't copy a real person's features, so that part of the comparison
 * was set aside."* — on a SKIN ask, on a face whose eyes nobody had mentioned.
 * The copy was written for the green-eyes case and hardcoded its facet, so
 * every later take asserted the same one.
 *
 * A confession that names the wrong feature is a false sentence in the
 * founder's own product voice: worse than a generic one, because it is
 * specific and wrong.
 */
export function likenessSetAsideNote(input: { subjects: readonly string[] }): string {
  const said = input.subjects
    .map((subject) => subject.toLowerCase())
    .filter((subject) => subject.length > 0);
  /*
    NO SUBJECT, NO CLAIM. A parse that filed nothing nameable gets the sentence
    without a feature in it rather than a guess — which is what the hardcoded
    "the eyes" was, every time it was not eyes.
  */
  const made = said.length > 0
    ? `Made the change to ${said.join(" and ")} as you described.`
    : "Made that as you described.";
  return `${made} Refining can't copy a real person's features, so that part of `
    + "the comparison was set aside.";
}

/**
 * THE PICTURE THAT DID NOT RIDE — said, never swallowed (D-181's law, pointed
 * at the reference lane).
 *
 * She attached a photograph and then asked for something the picture has
 * nothing to do with. Nothing is cut, nothing is read, and no house money is
 * spent on it — which is right, and which is exactly the situation where a
 * product stays quiet and lets her believe her picture was used.
 *
 * It names no feature deliberately: what is true here is that the ATTACHMENT
 * went unused, and a sentence guessing at which feature she meant would be the
 * hardcoded "the eyes" defect wearing a different hat.
 */
export function attachedPictureUnusedNote(): string {
  return "The picture you attached wasn't used — this change didn't ask for anything I could take from it.";
}
