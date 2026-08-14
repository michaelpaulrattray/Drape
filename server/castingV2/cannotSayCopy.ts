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
 * happened to the money. "It's coming" appears in exactly one sentence and only
 * while that thing is genuinely queued — a promise inside a refusal is the
 * easiest line in a product to leave rotting.
 */
import type { RepaintAsksRefusal } from "./repaintAsks";

export type CannotSayReason = RepaintAsksRefusal["reason"];

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
