/**
 * IS THIS ASK ABOUT INK SHE ALREADY HAS — the prior question, and the one
 * decision three roads hang from (designed opus-940 §2, countersigned
 * fable-1274 §2).
 *
 * # The question, and why it comes first
 *
 * *"Make it bigger"* and *"give him a tattoo on his chest"* are the same shape
 * to every reader downstream: a delta naming ink, with no picture attached.
 * Told apart nowhere, the first travels the second's road — a placement is
 * resolved out of the word *"chest"* and the product paints **a fresh design
 * invented from her prose**, on a master that has no ink. Driven at the service
 * (opus-948 §1): `kind: "rendered"`, charged, and his own piece never on the
 * wire. So the question is asked BEFORE the placement question, and its three
 * answers are three roads:
 *
 *   fresh    -> today's road: resolve a placement, ask where if she said none
 *   change   -> the transform road: her own delivered crop rides as the SOURCE
 *   gone     -> the removal road, which needs no placement at all
 *
 * # BOTH HALVES ARE REQUIRED, and each fails alone
 *
 *   (i)  HER SENTENCE points at something that exists AND says what should
 *        change about it. Extraction from her own words, never inference —
 *        fable-1192 §1's licence verbatim.
 *   (ii) THE CHAIN holds a delivered tattoo for a resolvable slot.
 *
 * (i) alone is a reading of intent with nothing behind it, and a cast with no
 * ink cannot have any of it changed — that is the zero answer, not a render.
 * (ii) alone would turn every ink ask on an already-inked person into a
 * transform, including *"give him a SECOND tattoo on his neck"*.
 *
 * # WHY A POINTER ALONE IS NOT ENOUGH — the arm that shaped the reading
 *
 * *"Put the dragon tattoo on his neck"* points at *the … tattoo* with a
 * definite article and is an ordinary FRESH ask. Pointer-only would refuse it.
 * So a pointer counts only beside a CHANGE — an axis word or a removal word —
 * and the indefinite forms are excluded outright (*"give him a bigger tattoo"*,
 * *"add another tattoo"*, *"a new design"*). What separates the two sentences
 * is not how confident a reader is; it is whether she named a change at all.
 *
 * # It reads WORDS and it decides nothing about slots
 *
 * The slot never comes from her sentence, because it usually is not in it — his
 * own words were *"make it bigger"*, with no placement anywhere. State decides;
 * see {@link inkSlotSheAsksAbout}, whose whole design is that `slots[0]` cannot
 * be written in it.
 */
import {
  INK_TRANSFORM_AXES, type InkTransform, type InkTransformAxis,
} from "../../shared/inkTransforms";
import {
  INK_PLACEMENTS, inkPlacementBareNoun, isInkPlacement,
} from "../../shared/inkPlacementVocabulary";
import { inkPlacementOfSlot, isInkSlot } from "./referenceSlots";
import { removalEvidence } from "./removalWords";

/**
 * WHAT SHE IS ASKING ABOUT INK SHE ALREADY HAS, or that she is not.
 *
 * `changes` is a LIST rather than one value because a sentence can name two
 * axes — *"make it bigger and darker"* — and the two are not composable today:
 * every clause in `inkTransformClause` ends by saying everything else stays as
 * the picture shows it, so two of them contradict each other on the wire. Read
 * as a list here and refused honestly at the door, rather than silently serving
 * the first half of an ask somebody paid for.
 */
export type InkPriorReading =
  | { want: "fresh" }
  | { want: "gone" }
  | { want: "change"; changes: readonly InkTransform[] };

/** The reading, from her own sentence and nothing else. */
export function readInkPriorAsk(instruction: string): InkPriorReading {
  const said = instruction.toLowerCase();
  if (!pointsAtInkSheHas(said)) return { want: "fresh" };
  /*
    THE REMOVAL WORDS ARE `removalWords`' OWN, never a second list beside them
    (working law 4). That module is what the removal road already weighs its
    evidence with, so the day *"scrub"* joins its vocabulary this reading gains
    it too — and the two cannot come to disagree about what an ask to take
    something off sounds like.

    `stated` only. `ambiguous` is the band holding words like `clear` and `no`,
    which describe a look as often as an absence, and a wrong reading here is a
    tattoo somebody paid for disappearing.
  */
  if (removalEvidence(said) === "stated") return { want: "gone" };
  const changes = changesNamedIn(said);
  if (changes.length === 0) return { want: "fresh" };
  return { want: "change", changes };
}

/**
 * SHE POINTED AT A TATTOO THAT ALREADY EXISTS — determiner and all.
 *
 * A definite, possessive or demonstrative determiner in front of an ink noun,
 * or the bare pronoun she uses when the tattoo is the only thing on screen
 * (*"make it bigger"*). `that` is deliberately NOT a bare pronoun here: it is a
 * determiner as often as a pronoun, and *"a tattoo that is bigger"* would read
 * as a pointer at something he has never had.
 */
function pointsAtInkSheHas(said: string): boolean {
  /*
    THE INDEFINITE FORMS DISQUALIFY THE WHOLE SENTENCE, and this clause is what
    keeps a fresh ask a fresh ask. *"Give him a bigger tattoo"* names a change
    word and an ink noun and is not about anything he has; so does *"add another
    tattoo"*, and *"a new design"*. Checked first, because a sentence can hold
    both forms and the indefinite one is the one saying she wants a new one.
  */
  if (INDEFINITE_INK.test(said)) return false;
  if (POINTED_INK.test(said)) return true;
  return /\b(?:it|them)\b/.test(said);
}

const INK_NOUNS = "tattoo|tattoos|tat|tats|design|designs|piece|artwork";

const INDEFINITE_INK = new RegExp(
  `\\b(?:a|an|another|some|new)\\b(?:\\s+[a-z-]+){0,3}\\s+\\b(?:${INK_NOUNS})\\b`,
);

/**
 * ⚠ AND THE SURFACE'S OWN NAME IS A POINTER TOO — because it is how she answers
 * the question this road asks her.
 *
 * *"You've got more than one — his upper chest tattoo and his neck tattoo. Say
 * which one and I'll do it."* The natural reply is *"the upper chest one"*, and
 * with ink nouns alone that sentence points at nothing: the reading fell back to
 * FRESH and the answer to the product's own question rendered a brand new
 * tattoo. Caught by driving the two-tattoo arm at the service, which is the only
 * place the question and its answer meet.
 *
 * A question whose answer the product cannot read is D-180's dead end wearing a
 * sentence, so the words the question puts in her mouth have to be words this
 * reading accepts.
 *
 * Derived from `INK_PLACEMENTS` through the vocabulary's own noun rather than
 * listed here: the day a fourth surface is measured it becomes an answerable
 * reply by existing, and there is no second spelling of *"upper chest"* to drift.
 */
const PLACEMENT_NOUNS = INK_PLACEMENTS.map(inkPlacementBareNoun).join("|");

const POINTED_INK = new RegExp(
  `\\b(?:the|his|her|their|its|that|those|this|these|my|our)\\b`
  + `(?:\\s+[a-z-]+){0,4}\\s+\\b(?:${INK_NOUNS}|ink|${PLACEMENT_NOUNS})\\b`,
);

/**
 * WHAT SHE SAID SHOULD CHANGE — one entry per axis she named.
 *
 * Per axis rather than per word, because a sentence naming two words on one
 * axis (*"bigger … larger"*) is one ask, and the earlier word is the one she
 * led with. Anything the closed vocabulary does not name is simply absent: a
 * sideways move has no member here, and its absence is a measurement rather
 * than an oversight (see `shared/inkTransforms.ts`).
 */
function changesNamedIn(said: string): readonly InkTransform[] {
  const found: InkTransform[] = [];
  for (const axis of INK_TRANSFORM_AXES) {
    const change = changeOnAxis(axis, said);
    if (change !== null) found.push(change);
  }
  return found;
}

/** One axis's word patterns; the earliest match in the sentence wins. */
type AxisPattern = { at: RegExp; make: (match: RegExpMatchArray) => InkTransform };

/*
  A STATED FACTOR IS ONLY EVER ONE SHE TYPED, and its DIRECTION is read off the
  number rather than derived — *"twice"* cannot mean smaller. That is reading
  her own words, not inventing a magnitude nobody agreed to, which is the line
  `InkTransform.factor` is written on.

  The factor forms come first because *"twice the size"* also contains no bare
  direction word at all, and *"3 times bigger"* contains one that would be read
  as factorless if the bare pattern won.
*/
const SIZE_PATTERNS: readonly AxisPattern[] = [
  {
    at: /\b(?:twice|double|2\s*x)\s+(?:the\s+size|its\s+size|as\s+(?:big|large))/,
    make: () => ({ axis: "size", direction: "bigger", factor: 2 }),
  },
  {
    at: /\b(?:triple|three\s+times|3\s*x)\s+(?:the\s+size|its\s+size|as\s+(?:big|large))/,
    make: () => ({ axis: "size", direction: "bigger", factor: 3 }),
  },
  {
    at: /\bhalf\s+(?:the\s+size|its\s+size|as\s+(?:big|large))/,
    make: () => ({ axis: "size", direction: "smaller", factor: 0.5 }),
  },
  {
    at: /\b(\d+(?:\.\d+)?)\s*(?:x|times)\s+(?:the\s+size|its\s+size|as\s+(?:big|large)|bigger|larger)/,
    make: (match) => ({ axis: "size", direction: "bigger", factor: Number(match[1]) }),
  },
  { at: /\b(?:bigger|larger)\b/, make: () => ({ axis: "size", direction: "bigger", factor: null }) },
  { at: /\b(?:smaller|tinier)\b/, make: () => ({ axis: "size", direction: "smaller", factor: null }) },
];

const HEIGHT_PATTERNS: readonly AxisPattern[] = [
  {
    at: /\b(?:higher|further\s+up|move\s+it\s+up|raise\s+it)\b/,
    make: () => ({ axis: "height", direction: "higher" }),
  },
  {
    at: /\b(?:lower|further\s+down|move\s+it\s+down|drop\s+it)\b/,
    make: () => ({ axis: "height", direction: "lower" }),
  },
];

const INTENSITY_PATTERNS: readonly AxisPattern[] = [
  {
    at: /\b(?:darker|bolder|stronger|heavier|denser)\b/,
    make: () => ({ axis: "intensity", direction: "darker" }),
  },
  {
    at: /\b(?:lighter|fainter|faded|softer|subtler)\b/,
    make: () => ({ axis: "intensity", direction: "lighter" }),
  },
];

/*
  DERIVED FROM THE AXIS LIST, so a new member of the closed vocabulary is a
  COMPILE ERROR here rather than an axis nobody can ask for. `INK_TRANSFORM_AXES`
  is the source of truth; this table is required to answer it in full.
*/
const PATTERNS: Readonly<Record<InkTransformAxis, readonly AxisPattern[]>> = {
  size: SIZE_PATTERNS,
  height: HEIGHT_PATTERNS,
  intensity: INTENSITY_PATTERNS,
};

function changeOnAxis(axis: InkTransformAxis, said: string): InkTransform | null {
  let earliest: { at: number; change: InkTransform } | null = null;
  for (const pattern of PATTERNS[axis]) {
    const match = said.match(pattern.at);
    if (match?.index === undefined) continue;
    if (earliest === null || match.index < earliest.at) {
      earliest = { at: match.index, change: pattern.make(match) };
    }
  }
  return earliest?.change ?? null;
}

/**
 * WHICH TATTOO SHE MEANS — from STATE, and `slots[0]` is forbidden here.
 *
 * # The scar this is written from
 *
 * An ask that omitted a key member spanned two rows and `matches[0]` rode her
 * LEFT ARM — a design on the wrong anatomical side, which on this road is a
 * refund and an apology (300 credits, twice, DECISION_LOG R7-7G). A transform
 * that silently picks one of two tattoos is that defect with a paid render
 * attached, so the shape of this function is that there is nowhere in it to
 * write an index.
 *
 * # Three answers, and the middle one is a QUESTION rather than a guess
 *
 *   none      she has no delivered tattoo at all — the honest sentence, free
 *   one       unambiguous, whether she named a place or not
 *   several   ASK WHICH. Legitimate under D-180 because every one of its
 *             answers ACTS: each names a tattoo that exists and can be changed
 *
 * # Her own word narrows it, and that is extraction rather than inference
 *
 * A customer with two tattoos who says *"make the chest one bigger"* has
 * already answered the question, and asking her again is the product not
 * listening. The narrowing is her own word matched against the SURFACE'S OWN
 * NOUN (`inkPlacementBareNoun`, one owner, never a second list of synonyms
 * here), so it can only ever confirm a slot she named and never invent one. If
 * her word matches two, or none, the ask-which stands.
 *
 * # AND A TAPPED RECTANGLE OUTRANKS BOTH (approved fable-1293 §2b)
 *
 * A `scope` is not a hint about which tattoo she means — it is the strongest
 * answer either question in this function can get, because she put her finger
 * on the pixels. `FaceRegions` sends it when the panel card she tapped carries
 * an instance, and the card was drawn FROM the delivery crop this transform
 * would use as its source, so the gesture and the source are the same fact.
 * A scoped ask therefore never reaches the ask-which question and never
 * consults her wording: asking *"which one?"* of somebody who just pointed is
 * the product not listening, one gesture louder than the case above.
 *
 * **It only ever answers for a slot the chain really delivered.** A scope
 * naming ink this branch does not hold is `none` — never a fallback to the
 * unscoped reading, which for a customer with exactly one OTHER tattoo would
 * resize the tattoo she did not point at. That is `slots[0]` wearing a
 * different hat, and this function's whole shape is that there is nowhere in it
 * to write one. The caller says so in her own words, naming the place she
 * pointed at rather than claiming she has no ink at all.
 */
export type InkSlotFromState =
  | { kind: "none" }
  | { kind: "one"; slot: string }
  | { kind: "several"; slots: readonly string[] };

export function inkSlotSheAsksAbout(
  instruction: string,
  deliveredSlots: readonly string[],
  /* The slot the tapped rectangle named, when she tapped one. `undefined` is
     the ask box with no gesture behind it — every route into this function
     before the panel's ink cards existed. */
  scope?: string,
): InkSlotFromState {
  /* Sorted so the ask-which question is stable across two identical asks —
     a question whose options reorder between renders reads as a different
     question about a different face. */
  const slots = Array.from(new Set(deliveredSlots)).sort();
  /*
    THE GESTURE FIRST, and BEFORE the `length === 0` exit on purpose: a scope
    that names nothing delivered is `none` for the reason the header gives, and
    routing it through the general answer would make the two indistinguishable
    at the call site — which is the difference between telling her she has no
    tattoos and telling her there is none where she pointed.

    Non-ink scopes are not this function's business and fall straight through:
    a scoped hair ask never reaches here, and one that did must not have its
    ink resolved by a slot that is not one.
  */
  if (scope !== undefined && isInkSlot(scope)) {
    return slots.includes(scope) ? { kind: "one", slot: scope } : { kind: "none" };
  }
  if (slots.length === 0) return { kind: "none" };
  if (slots.length === 1) return { kind: "one", slot: slots[0]! };
  const said = instruction.toLowerCase();
  const named = slots.filter((slot) => {
    const placement = inkPlacementOfSlot(slot)?.placement;
    if (placement === undefined || !isInkPlacement(placement)) return false;
    return said.includes(inkPlacementBareNoun(placement).toLowerCase());
  });
  if (named.length === 1) return { kind: "one", slot: named[0]! };
  return { kind: "several", slots };
}
