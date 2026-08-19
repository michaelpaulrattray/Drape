/**
 * IS THIS PICTURE EVEN OF THE THING SHE ASKED FOR — the out-of-class door,
 * ordered fable-1068 §4.
 *
 * # The specimen that bought it
 *
 * While pricing build two's attach read (opus-785 §3), the shipped makeup
 * reader was handed a photograph of a bald, bearded man with metal implants
 * across his scalp and jaw and one glowing red eye. There are no cosmetics
 * anywhere in that picture. It answered, in the makeup vocabulary, with no
 * hedge:
 *
 * > *"glowing red iris effect, mechanical seam detailing, prosthetic circuitry
 * > and metallic implant detailing"*
 *
 * Nothing was written and nothing was charged — it was a token count. But build
 * two hands that same reader **a customer's own uploaded photograph** and rides
 * its sentence into a paid render, and that is the `false-pass-guard` shape
 * exactly: an affirmative with no `saw` behind the thing it names.
 *
 * # WHY THE FIX IS A FIELD AND NOT A STERNER SENTENCE
 *
 * This module's sibling states the idiom already: the makeup ask *"has no field
 * for a person to arrive in"*, and the ink door's byte check *"is given no
 * declared mime and no filename on purpose — there is no field here for a claim
 * to arrive in."* **Structure is the fence.**
 *
 * Read that way the defect is obvious and it is not the reader's fault. Handed
 * a cyborg, the reader had exactly two shapes available to it: four cosmetic
 * surfaces, and *"is this face wearing makeup"*. It had **no field in which
 * "these are prosthetics" could arrive.** A model with no word for what it sees
 * reaches for the nearest word it has been given, which is what happened.
 *
 * So the fix is a field, and the field NAMES ITS OUT-OF-CLASS ANSWERS. That
 * second half is the whole mechanism: a reader offered only *cosmetics* and
 * *nothing* is a reader with the same two shapes and a longer prompt.
 *
 * # WHAT THIS MODULE DOES NOT CLAIM
 *
 * That the reader USES the word is an empirical question about a model, not a
 * property of this code, and law 9 governs it — a reader's answer is a pointer
 * to look, never a fact to file. So the vocabulary below is bought per road by
 * that road's own controls, on real specimens, in both directions: the
 * out-of-class subject must refuse AND a genuine one must still read through.
 * Makeup's pair is `scripts/court-out-of-class-disposable.mts`. **No other
 * road's vocabulary is declared here, because no other road has bought one** —
 * an invented list would be this program's own second-list defect, filed in
 * advance and read by the next builder as measured.
 */
import type { ReferenceIntent } from "../../shared/referenceIntents";

/**
 * The words one class may answer with.
 *
 * `inClass` admits. `nothing` is the honest empty answer — a bare face, a
 * stretch of unmarked skin — and it routes to the road's own *we could not see
 * any of it* refusal rather than to this door, because "there is none of it
 * here" and "this is not that kind of thing at all" are different facts and a
 * customer deserves the one that fits.
 */
export type ReferenceClassVocabulary =
  | {
      readonly declared: true;
      /** The one word that lets a read proceed. */
      readonly inClass: string;
      /** What the reader says when the class is simply absent from the picture. */
      readonly nothing: string;
      /**
       * The named alternatives. Not a filter — a BRIEF: this list is what gives
       * the reader somewhere other than the in-class word to put an answer.
       */
      readonly outOfClass: readonly string[];
    }
  /**
   * A road whose class words are not decided yet.
   *
   * Deliberately not a guess. The type is total over the intent vocabulary, so
   * the builder who opens hair or eye colour has to answer this question rather
   * than inherit somebody's speculation — and `referenceClassAskLines` throws
   * for an undeclared road, so no ask can be composed from a blank.
   */
  | { readonly declared: false };

const VOCABULARY: Readonly<Record<ReferenceIntent, ReferenceClassVocabulary>> = Object.freeze({
  makeup: Object.freeze({
    declared: true,
    inClass: "cosmetics",
    nothing: "nothing",
    /*
      MEASURED, not imagined — every member is a thing this reader has been seen
      to describe in makeup words, or is the direct neighbour of one. The cyborg
      specimen alone supplies `prosthetics` and `digital effect`; `mask`,
      `body paint` and `injury` are the three nearest cases a stylist would
      never call makeup and a describer plainly might.

      `something else` is last and is not a catch-all for laziness: it is the
      escape a closed list needs so that a reader facing an unlisted subject
      says so instead of picking the least wrong member — which is the defect
      this whole module exists for, one level down.
    */
    outOfClass: Object.freeze([
      "prosthetics",
      "mask",
      "body paint",
      "digital effect",
      "injury",
      "something else",
    ]),
  }),
  /*
    THE THREE THAT ARE NOT BOUGHT YET.

    Tattoo's sibling lands with the attach door's tattoo read, hair's and eye
    colour's with their forms. Each needs its own specimens in both directions
    before its words mean anything, and this program's rule is that a list
    nobody measured reads as measured to whoever finds it next.
  */
  tattoo: Object.freeze({ declared: false }),
  hair: Object.freeze({ declared: false }),
  eyeColour: Object.freeze({ declared: false }),
});

export function referenceClassVocabulary(intent: ReferenceIntent): ReferenceClassVocabulary {
  return VOCABULARY[intent];
}

/**
 * The lines that go into the ask, composed from the vocabulary rather than
 * typed beside it (law 4) — so a word added to the list above appears in the
 * prompt, and a word removed from it stops being an answer the door accepts.
 *
 * A test asserts these AT THE WIRE, on the outgoing request (invariant 5),
 * because a fence stated in a constant near the prompt is not a fence.
 */
export function referenceClassAskLines(intent: ReferenceIntent): string[] {
  const vocabulary = referenceClassVocabulary(intent);
  if (!vocabulary.declared) {
    /* A programming error, not a customer's: no road may compose an ask out of
       a class vocabulary nobody has decided. */
    throw new Error(`no class vocabulary is declared for "${intent}"`);
  }
  /*
    THE SHAPE OF THESE LINES IS MEASURED, and the first shape was wrong in a way
    no suite could see (`court-eye-drop-before-after-disposable.mts`).

    It asked the question across six lines, led with "BEFORE anything else",
    separated the in-class word from its alternatives with an em-dash, and spent
    two further lines warning the reader off. Against the shipped ask on the same
    frame, three reads each, the eye — a black smoky eye with winged liner, the
    loudest thing in the picture — went from spoken 3/3 to spoken 1/3. A class
    question is not supposed to cost a surface, and a longer, sterner preamble
    made a careful reader quieter everywhere.

    So it is three lines, one flat comma list with the in-class word inside it
    rather than defined against it, and exactly one instruction about what to do
    instead. The out-of-class words are still NAMED, which is the whole
    mechanism; what is gone is the scolding around them.
  */
  return [
    `First, say what is in this picture ("subject") using exactly one of these words:`,
    `${[vocabulary.inClass, ...vocabulary.outOfClass, vocabulary.nothing].join(", ")}.`,
    `Say "${vocabulary.inClass}" only if that is genuinely what you see; if it is one of the`,
    `others, name it rather than describing it as ${vocabulary.inClass} anyway.`,
  ];
}

/**
 * What the reader answered about the class.
 *
 * `unanswered` is its own verdict and is NOT out-of-class. A reply that never
 * addressed the question is a reply this door could not judge, and turning that
 * into *"what's on that face isn't makeup"* would be a claim about a real
 * person's photograph that no reader made. It is the presence gate's own scar
 * (`undefined` is not `no`) asked of the class question — and it is why the
 * caller spends the existing *we couldn't read that picture* sentence on it
 * rather than this door's.
 */
export type ReferenceClassVerdict =
  | { kind: "inClass" }
  | { kind: "outOfClass"; named: string }
  | { kind: "nothing" }
  | { kind: "unanswered" };

/**
 * Read the class answer.
 *
 * Matching is on the vocabulary's own words, loosely enough to survive a model
 * that answers `"Cosmetics."` or `"body-paint"` and strictly enough that an
 * unlisted word is `unanswered` rather than silently in-class. **Admission is
 * positive**: nothing reaches `inClass` except the in-class word itself.
 */
export function readReferenceClass(
  intent: ReferenceIntent,
  value: unknown,
): ReferenceClassVerdict {
  const vocabulary = referenceClassVocabulary(intent);
  if (!vocabulary.declared) return { kind: "unanswered" };
  if (typeof value !== "string") return { kind: "unanswered" };
  const plain = value.trim().toLowerCase().replace(/[.!]+$/, "").replace(/[-_]+/g, " ");
  if (!plain) return { kind: "unanswered" };
  if (matches(plain, vocabulary.inClass)) return { kind: "inClass" };
  if (matches(plain, vocabulary.nothing)) return { kind: "nothing" };
  /* Longest first, so a two-word member cannot be shadowed by a one-word one
     that happens to be a prefix of it. */
  const named = [...vocabulary.outOfClass]
    .sort((left, right) => right.length - left.length)
    .find((word) => matches(plain, word));
  if (named) return { kind: "outOfClass", named };
  return { kind: "unanswered" };
}

/**
 * Whether the answer IS this word — the whole answer, or the answer with the
 * politeness a model adds around one.
 *
 * Not `includes`: *"not cosmetics"* contains `cosmetics`, and a substring test
 * would admit the exact sentence this door exists to refuse.
 */
function matches(plain: string, word: string): boolean {
  if (plain === word) return true;
  /* The trailing full stop is already gone by the time this runs; what is left
     to survive is the article and the lead-in a model puts in front of a
     one-word answer. */
  return new RegExp(`^(it (is|looks like) )?((an?|the) )?${escape(word)}$`).test(plain);
}

function escape(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
